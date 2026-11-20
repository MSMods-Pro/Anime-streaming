import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Play,
  RotateCcw,
  Search,
} from 'lucide-react';
import { motion } from 'motion/react';
import { getAnimeDetails } from '../services/anilist';
import {
  PROVIDER_LABELS,
  getAnimeEpisodes,
  getWatchSources,
} from '../services/anivexa';
import {
  getAnimeProgress,
  recordWatchHistory,
  savePlaybackProgress,
} from '../services/storage';
import type { AnimeDetail } from '../types/anilist';
import type {
  AudioType,
  NormalizedEpisodesResult,
  NormalizedWatchData,
  ProviderName,
} from '../types/anivexa';
import { getDisplayTitle } from '../utils/format';
import { useUserLibrary } from '../hooks/useUserLibrary';
import { AnivexaPlayer } from '../components/player/AnivexaPlayer';

const EPISODES_CHUNK = 50;

export function WatchPage() {
  const { id, ep } = useParams<{ id: string; ep?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const anilistId = Number(id);
  const urlProvider = searchParams.get('provider') as ProviderName | null;
  const urlAudio = searchParams.get('audio') as AudioType | null;

  const { isSaved, toggleWatchlist, prefs, updatePrefs } = useUserLibrary();

  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [episodesData, setEpisodesData] = useState<NormalizedEpisodesResult | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const [provider, setProvider] = useState<ProviderName | null>(urlProvider);
  const [audio, setAudio] = useState<AudioType>(urlAudio || prefs.preferredAudio || 'sub');
  const [episodeNumber, setEpisodeNumber] = useState<number>(() => {
    const parsed = Number(ep);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    const saved = getAnimeProgress(anilistId);
    return saved?.episodeNumber || 1;
  });

  const [watchData, setWatchData] = useState<NormalizedWatchData | null>(null);
  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [loadingSource, setLoadingSource] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourceReloadTick, setSourceReloadTick] = useState(0);
  const [initReloadTick, setInitReloadTick] = useState(0);

  const [epFilter, setEpFilter] = useState('');
  const [epChunk, setEpChunk] = useState(0);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);

  // Sync episodeNumber when route :ep param changes
  useEffect(() => {
    if (ep) {
      const parsed = Number(ep);
      if (Number.isFinite(parsed) && parsed > 0) {
        setEpisodeNumber(parsed);
      }
    }
    setAutoNextCountdown(null);
  }, [ep]);

  // Load AniList metadata + Anivexa episodes
  useEffect(() => {
    if (!Number.isFinite(anilistId) || anilistId <= 0) {
      setInitError('Invalid anime ID');
      setLoadingInit(false);
      return;
    }

    const controller = new AbortController();
    setLoadingInit(true);
    setInitError(null);

    Promise.all([
      getAnimeDetails(anilistId, controller.signal),
      getAnimeEpisodes(anilistId, controller.signal),
    ])
      .then(([detail, epRes]) => {
        setAnime(detail);
        setEpisodesData(epRes);

        if (epRes.availableProviders.length > 0) {
          // Pick requested provider if valid, otherwise highest priority provider
          const matchedProv =
            (urlProvider &&
              epRes.availableProviders.find((p) => p.provider === urlProvider)) ||
            epRes.availableProviders[0];

          setProvider(matchedProv.provider);

          let chosenAudio: AudioType = urlAudio || prefs.preferredAudio || 'sub';
          if (chosenAudio === 'dub' && matchedProv.dub.length === 0) chosenAudio = 'sub';
          if (chosenAudio === 'sub' && matchedProv.sub.length === 0) chosenAudio = 'dub';
          setAudio(chosenAudio);

          // Ensure episodeNumber exists in list
          const list = chosenAudio === 'dub' ? matchedProv.dub : matchedProv.sub;
          if (list.length > 0 && !ep) {
            const saved = getAnimeProgress(anilistId);
            const target =
              saved && list.some((e) => e.number === saved.episodeNumber)
                ? saved.episodeNumber
                : list[0].number;
            setEpisodeNumber(target);
          }
        } else {
          setProvider(null);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setInitError(err instanceof Error ? err.message : 'Failed to load streaming data');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingInit(false);
      });

    return () => controller.abort();
  }, [anilistId, initReloadTick]);

  const activeProviderBlock = useMemo(() => {
    if (!episodesData || !provider) return null;
    return episodesData.availableProviders.find((p) => p.provider === provider) ?? null;
  }, [episodesData, provider]);

  const episodeList = useMemo(() => {
    if (!activeProviderBlock) return [];
    return audio === 'dub' ? activeProviderBlock.dub : activeProviderBlock.sub;
  }, [activeProviderBlock, audio]);

  const currentEpisodeObj = useMemo(() => {
    return (
      episodeList.find((e) => e.number === episodeNumber) ||
      episodeList[0] ||
      null
    );
  }, [episodeList, episodeNumber]);

  // Update document title
  useEffect(() => {
    if (anime) {
      document.title = `${getDisplayTitle(anime)} · Ep ${episodeNumber} — ANIVEXA`;
    }
  }, [anime, episodeNumber]);

  // Keep URL search params synced with provider & audio
  useEffect(() => {
    if (!provider) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('provider', provider);
        next.set('audio', audio);
        return next;
      },
      { replace: true }
    );
  }, [provider, audio, setSearchParams]);

  // Fetch Watch Stream Sources whenever provider, audio, or episode changes
  useEffect(() => {
    if (!provider || !currentEpisodeObj) {
      setWatchData(null);
      return;
    }

    const controller = new AbortController();
    setLoadingSource(true);
    setSourceError(null);
    setActiveStreamIndex(0);

    getWatchSources(
      currentEpisodeObj.id,
      provider,
      audio,
      currentEpisodeObj.number,
      controller.signal
    )
      .then((res) => {
        setWatchData(res);
        setActiveStreamIndex(0);
        if (anime) {
          recordWatchHistory({
            animeId: anime.id,
            animeTitle: getDisplayTitle(anime),
            coverImage: anime.coverImage.large || anime.coverImage.extraLarge || '',
            episodeNumber: currentEpisodeObj.number,
            episodeTitle: currentEpisodeObj.title,
            episodeImage: currentEpisodeObj.image,
            provider,
            audio,
            position: 0,
            duration: currentEpisodeObj.duration || 0,
          });
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setWatchData(null);
        setSourceError(
          err instanceof Error ? err.message : 'Failed to resolve stream URLs'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSource(false);
      });

    return () => controller.abort();
  }, [provider, audio, currentEpisodeObj?.id, sourceReloadTick]);

  // Saved resume position for this exact episode
  const initialResumeTime = useMemo(() => {
    const saved = getAnimeProgress(anilistId);
    if (saved && saved.episodeNumber === episodeNumber && !saved.completed) {
      return saved.position;
    }
    return 0;
  }, [anilistId, episodeNumber]);

  const currentIdxInList = episodeList.findIndex((e) => e.number === episodeNumber);
  const hasPrevEpisode = currentIdxInList > 0;
  const hasNextEpisode =
    currentIdxInList >= 0 && currentIdxInList < episodeList.length - 1;

  const goToEpisode = useCallback(
    (num: number) => {
      if (!provider) return;
      setAutoNextCountdown(null);
      navigate(`/watch/${anilistId}/${num}?provider=${provider}&audio=${audio}`);
    },
    [anilistId, provider, audio, navigate]
  );

  // Auto-next countdown timer
  useEffect(() => {
    if (autoNextCountdown === null) return;
    if (autoNextCountdown <= 0) {
      if (hasNextEpisode) {
        goToEpisode(episodeList[currentIdxInList + 1].number);
      }
      setAutoNextCountdown(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setAutoNextCountdown((c) => (c !== null ? c - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [autoNextCountdown, hasNextEpisode, episodeList, currentIdxInList, goToEpisode]);

  const handleProgressUpdate = useCallback(
    (position: number, duration: number) => {
      if (!anime || !provider || !currentEpisodeObj) return;
      savePlaybackProgress({
        animeId: anime.id,
        animeTitle: getDisplayTitle(anime),
        coverImage: anime.coverImage.large || anime.coverImage.extraLarge || '',
        bannerImage: anime.bannerImage,
        episodeNumber: currentEpisodeObj.number,
        episodeTitle: currentEpisodeObj.title,
        episodeImage: currentEpisodeObj.image,
        provider,
        audio,
        position,
        duration,
      });
    },
    [anime, provider, audio, currentEpisodeObj]
  );

  // Filtered & chunked episode list for sidebar
  const filteredEpisodes = useMemo(() => {
    if (!epFilter.trim()) return episodeList;
    const q = epFilter.trim().toLowerCase();
    return episodeList.filter(
      (e) =>
        String(e.number).includes(q) ||
        (e.title && e.title.toLowerCase().includes(q))
    );
  }, [episodeList, epFilter]);

  const chunkCount = Math.max(1, Math.ceil(filteredEpisodes.length / EPISODES_CHUNK));
  const safeChunk = Math.min(epChunk, chunkCount - 1);
  const pagedEpisodes = useMemo(() => {
    const start = safeChunk * EPISODES_CHUNK;
    return filteredEpisodes.slice(start, start + EPISODES_CHUNK);
  }, [filteredEpisodes, safeChunk]);

  // Keep active episode's chunk selected on load
  useEffect(() => {
    if (epFilter.trim()) return;
    const idx = filteredEpisodes.findIndex((e) => e.number === episodeNumber);
    if (idx >= 0) {
      setEpChunk(Math.floor(idx / EPISODES_CHUNK));
    }
  }, [episodeNumber, filteredEpisodes.length, epFilter]);

  if (loadingInit) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#08090C] px-4 pt-16">
        <Loader2 className="h-9 w-9 animate-spin text-[#E5383B]" />
        <p className="mt-3 text-sm text-[#9aa2b1]">Preparing theater & streaming providers...</p>
      </div>
    );
  }

  if (initError || !anime) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center bg-[#08090C] px-6 pt-16 text-center">
        <AlertCircle className="h-10 w-10 text-[#E5383B]" />
        <h1 className="mt-4 font-display text-2xl font-semibold text-white">
          Unable to load watch page
        </h1>
        <p className="mt-2 max-w-md text-sm text-[#9aa2b1]">
          {initError || 'Series could not be loaded.'}
        </p>
        <button
          type="button"
          onClick={() => setInitReloadTick((t) => t + 1)}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#E5383B] px-5 py-2.5 text-sm font-medium text-white"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const title = getDisplayTitle(anime);
  const saved = isSaved(anime.id);

  // Providers that actually contain the current episode (or any episodes)
  const providersWithEpisodes = episodesData?.availableProviders ?? [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-[#08090C] pb-20 pt-16 md:pt-20"
    >
      <div className="mx-auto max-w-[1440px] px-3 sm:px-6 lg:px-8">
        {/* Top Breadcrumb Bar */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Link
            to={`/anime/${anime.id}`}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[#9aa2b1] transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="truncate max-w-[260px] sm:max-w-md">{title}</span>
          </Link>

          <button
            type="button"
            onClick={() =>
              toggleWatchlist({
                animeId: anime.id,
                title,
                coverImage: anime.coverImage.large || anime.coverImage.extraLarge || '',
                format: anime.format,
                seasonYear: anime.seasonYear,
                episodes: anime.episodes,
                averageScore: anime.averageScore,
              })
            }
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              saved
                ? 'border-[#E5383B] bg-[#E5383B]/15 text-white'
                : 'border-white/10 bg-[#10131A] text-[#D1D5DB] hover:border-white/25'
            }`}
          >
            {saved ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            <span>{saved ? 'Saved' : 'Watchlist'}</span>
          </button>
        </div>

        {/* Theater Layout: Player + Episode Sidebar */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          {/* Left Column: Player & Source Controls */}
          <div className="min-w-0 space-y-5">
            {provider && currentEpisodeObj ? (
              <div className="relative">
                <AnivexaPlayer
                  animeTitle={title}
                  episodeNumber={currentEpisodeObj.number}
                  episodeTitle={currentEpisodeObj.title}
                  provider={provider}
                  audio={audio}
                  streams={watchData?.streams ?? []}
                  activeStreamIndex={activeStreamIndex}
                  onSelectStreamIndex={setActiveStreamIndex}
                  intro={watchData?.intro}
                  outro={watchData?.outro}
                  initialTime={initialResumeTime}
                  hasPrevEpisode={hasPrevEpisode}
                  hasNextEpisode={hasNextEpisode}
                  onPrevEpisode={() =>
                    hasPrevEpisode && goToEpisode(episodeList[currentIdxInList - 1].number)
                  }
                  onNextEpisode={() =>
                    hasNextEpisode && goToEpisode(episodeList[currentIdxInList + 1].number)
                  }
                  onProgressUpdate={handleProgressUpdate}
                  onEnded={() => {
                    if (prefs.autoNext && hasNextEpisode) {
                      setAutoNextCountdown(5);
                    }
                  }}
                  loadingSource={loadingSource}
                  sourceError={sourceError}
                  onRetrySource={() => setSourceReloadTick((t) => t + 1)}
                  prefs={prefs}
                  onUpdatePrefs={updatePrefs}
                />

                {/* Auto-Next Countdown Bar */}
                {autoNextCountdown !== null && hasNextEpisode && (
                  <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-[#E5383B]/40 bg-[#10131A] px-4 py-3">
                    <p className="text-xs sm:text-sm text-white">
                      Playing Episode {episodeList[currentIdxInList + 1].number} in{' '}
                      <span className="font-mono-tabular font-bold text-[#E5383B]">
                        {autoNextCountdown}s
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAutoNextCountdown(null)}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#9aa2b1] hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          goToEpisode(episodeList[currentIdxInList + 1].number)
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#E5383B] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#f0484b]"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        <span>Play Now</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center rounded-xl border border-white/10 bg-[#10131A] p-8 text-center">
                <AlertCircle className="h-9 w-9 text-[#E5383B]" />
                <p className="mt-3 font-display text-lg font-semibold text-white">
                  No verified streaming provider available
                </p>
                <p className="mt-1 max-w-md text-sm text-[#9aa2b1]">
                  Anivexa did not return playable episodes for this series.
                </p>
                <Link
                  to={`/anime/${anime.id}`}
                  className="mt-5 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                >
                  Back to Details
                </Link>
              </div>
            )}

            {/* Episode Header + Prev/Next */}
            {currentEpisodeObj && (
              <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <h1 className="font-display text-lg sm:text-xl font-bold text-white">
                    Episode {currentEpisodeObj.number}
                    {currentEpisodeObj.title ? ` — ${currentEpisodeObj.title}` : ''}
                  </h1>
                  {currentEpisodeObj.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs sm:text-sm text-[#9aa2b1]">
                      {currentEpisodeObj.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={!hasPrevEpisode}
                    onClick={() =>
                      hasPrevEpisode && goToEpisode(episodeList[currentIdxInList - 1].number)
                    }
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/10 bg-[#10131A] px-3.5 text-xs font-medium text-white transition-colors hover:border-white/25 disabled:opacity-35"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Prev</span>
                  </button>
                  <button
                    type="button"
                    disabled={!hasNextEpisode}
                    onClick={() =>
                      hasNextEpisode && goToEpisode(episodeList[currentIdxInList + 1].number)
                    }
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/10 bg-[#10131A] px-3.5 text-xs font-medium text-white transition-colors hover:border-white/25 disabled:opacity-35"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Provider, Audio (SUB/DUB), and Server Management Panel */}
            {providersWithEpisodes.length > 0 && (
              <div className="space-y-4 rounded-xl border border-white/[0.08] bg-[#10131A] p-4 sm:p-5">
                {/* Row 1: SUB / DUB + Providers */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="mb-2 text-xs font-medium text-[#9aa2b1]">
                      Streaming Provider
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {providersWithEpisodes.map((prov) => {
                        const hasSelectedAudio =
                          audio === 'dub' ? prov.dub.length > 0 : prov.sub.length > 0;
                        const active = prov.provider === provider;
                        return (
                          <button
                            key={prov.provider}
                            type="button"
                            onClick={() => {
                              setProvider(prov.provider);
                              if (!hasSelectedAudio) {
                                const fallbackAudio =
                                  prov.sub.length > 0 ? 'sub' : 'dub';
                                setAudio(fallbackAudio);
                                updatePrefs({ preferredAudio: fallbackAudio });
                              }
                            }}
                            className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                              active
                                ? 'border-[#E5383B] bg-[#E5383B] text-white'
                                : 'border-white/10 bg-[#08090C] text-[#D1D5DB] hover:border-white/25'
                            }`}
                          >
                            {PROVIDER_LABELS[prov.provider] || prov.provider}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {activeProviderBlock && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-[#9aa2b1]">Audio</p>
                      <div className="inline-flex rounded-lg border border-white/10 bg-[#08090C] p-1">
                        <button
                          type="button"
                          disabled={activeProviderBlock.sub.length === 0}
                          onClick={() => {
                            setAudio('sub');
                            updatePrefs({ preferredAudio: 'sub' });
                          }}
                          className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-35 ${
                            audio === 'sub'
                              ? 'bg-[#E5383B] text-white'
                              : 'text-[#9aa2b1] hover:text-white'
                          }`}
                        >
                          SUB
                        </button>
                        <button
                          type="button"
                          disabled={activeProviderBlock.dub.length === 0}
                          onClick={() => {
                            setAudio('dub');
                            updatePrefs({ preferredAudio: 'dub' });
                          }}
                          className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-35 ${
                            audio === 'dub'
                              ? 'bg-[#E5383B] text-white'
                              : 'text-[#9aa2b1] hover:text-white'
                          }`}
                        >
                          DUB
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Row 2: Servers returned by active provider */}
                {watchData && watchData.streams.length > 0 && (
                  <div className="border-t border-white/[0.06] pt-4">
                    <p className="mb-2 text-xs font-medium text-[#9aa2b1]">
                      Playback Servers ({watchData.streams.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {watchData.streams.map((stream, idx) => (
                        <button
                          key={stream.id}
                          type="button"
                          onClick={() => setActiveStreamIndex(idx)}
                          className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            activeStreamIndex === idx
                              ? 'border-white bg-white text-[#08090C]'
                              : 'border-white/10 bg-[#08090C] text-[#D1D5DB] hover:border-white/25'
                          }`}
                        >
                          <span>{stream.server}</span>
                          <span className="opacity-65 uppercase">{stream.kind}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Episode List Sidebar */}
          {episodeList.length > 0 && (
            <aside className="flex max-h-[680px] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#10131A]">
              <div className="border-b border-white/[0.08] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-semibold text-white">
                    Episodes ({episodeList.length})
                  </h2>
                  {episodeList.length > 10 && (
                    <div className="relative w-36">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#687080]" />
                      <input
                        type="text"
                        value={epFilter}
                        onChange={(e) => setEpFilter(e.target.value)}
                        placeholder="Find ep..."
                        aria-label="Find episode"
                        className="h-8 w-full rounded-md border border-white/10 bg-[#08090C] pl-8 pr-2 text-xs text-white placeholder-[#687080] focus:border-[#E5383B] focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {chunkCount > 1 && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {Array.from({ length: chunkCount }).map((_, idx) => {
                      const s = filteredEpisodes[idx * EPISODES_CHUNK]?.number;
                      const e =
                        filteredEpisodes[
                          Math.min(
                            filteredEpisodes.length - 1,
                            (idx + 1) * EPISODES_CHUNK - 1
                          )
                        ]?.number;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setEpChunk(idx)}
                          className={`rounded px-2 py-1 font-mono-tabular text-[11px] ${
                            safeChunk === idx
                              ? 'bg-[#E5383B] text-white'
                              : 'bg-[#08090C] text-[#9aa2b1] hover:text-white'
                          }`}
                        >
                          {s}–{e}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-white/[0.05]">
                {pagedEpisodes.map((epItem) => {
                  const isActive = epItem.number === episodeNumber;
                  return (
                    <button
                      key={epItem.id}
                      type="button"
                      onClick={() => goToEpisode(epItem.number)}
                      className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors ${
                        isActive
                          ? 'bg-[#E5383B]/15 text-white'
                          : 'text-[#D1D5DB] hover:bg-white/[0.04]'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-9 shrink-0 items-center justify-center rounded-md font-mono-tabular text-xs font-semibold ${
                          isActive
                            ? 'bg-[#E5383B] text-white'
                            : 'bg-[#08090C] text-[#9aa2b1]'
                        }`}
                      >
                        {epItem.number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-white">
                          {epItem.title || `Episode ${epItem.number}`}
                        </p>
                        {epItem.filler && (
                          <p className="text-[11px] text-[#9aa2b1]">Filler</p>
                        )}
                      </div>
                      {isActive && (
                        <Play className="h-3.5 w-3.5 shrink-0 fill-current text-[#E5383B]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </aside>
          )}
        </div>
      </div>
    </motion.div>
  );
}
