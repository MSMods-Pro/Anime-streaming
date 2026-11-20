import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  Bookmark,
  Check,
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
  getAnimeMapping,
} from '../services/anivexa';
import type { AnimeDetail } from '../types/anilist';
import type {
  AnimeMappings,
  AudioType,
  NormalizedEpisodesResult,
  ProviderName,
} from '../types/anivexa';
import {
  formatFormatLabel,
  formatSeasonLabel,
  formatStatusLabel,
  getDisplayTitle,
  getSecondaryTitle,
  stripHtml,
} from '../utils/format';
import { useUserLibrary } from '../hooks/useUserLibrary';
import { ImageWithFallback } from '../components/common/ImageWithFallback';
import { AnimeCard } from '../components/common/AnimeCard';

const EPISODES_PER_PAGE = 50;

export function AnimeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const anilistId = Number(id);

  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [loadingAnime, setLoadingAnime] = useState(true);
  const [animeError, setAnimeError] = useState<string | null>(null);

  const [mapping, setMapping] = useState<AnimeMappings | null>(null);
  const [episodesData, setEpisodesData] = useState<NormalizedEpisodesResult | null>(null);
  const [loadingEpisodes, setLoadingEpisodes] = useState(true);
  const [episodesError, setEpisodesError] = useState<string | null>(null);

  const [selectedProvider, setSelectedProvider] = useState<ProviderName | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<AudioType>('sub');
  const [epSearch, setEpSearch] = useState('');
  const [epChunkPage, setEpChunkPage] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);

  const { isSaved, toggleWatchlist, continueWatching, prefs } = useUserLibrary();

  // Fetch AniList details
  useEffect(() => {
    if (!Number.isFinite(anilistId) || anilistId <= 0) {
      setAnimeError('Invalid anime ID');
      setLoadingAnime(false);
      return;
    }

    const controller = new AbortController();
    setLoadingAnime(true);
    setAnimeError(null);

    getAnimeDetails(anilistId, controller.signal)
      .then((detail) => {
        setAnime(detail);
        document.title = `${getDisplayTitle(detail)} — ANIVEXA`;
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setAnimeError(err instanceof Error ? err.message : 'Failed to load anime details');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingAnime(false);
      });

    return () => controller.abort();
  }, [anilistId, reloadTick]);

  // Fetch Anivexa mapping + verified episodes
  useEffect(() => {
    if (!Number.isFinite(anilistId) || anilistId <= 0) return;
    const controller = new AbortController();
    setLoadingEpisodes(true);
    setEpisodesError(null);

    getAnimeMapping(anilistId, controller.signal).then((m) => {
      if (!controller.signal.aborted && m) setMapping(m);
    });

    getAnimeEpisodes(anilistId, controller.signal)
      .then((res) => {
        setEpisodesData(res);
        if (res.mappings) setMapping(res.mappings);
        if (res.availableProviders.length > 0) {
          const preferred = res.availableProviders[0];
          setSelectedProvider(preferred.provider);
          if (prefs.preferredAudio === 'dub' && preferred.dub.length > 0) {
            setSelectedAudio('dub');
          } else if (preferred.sub.length > 0) {
            setSelectedAudio('sub');
          } else if (preferred.dub.length > 0) {
            setSelectedAudio('dub');
          }
        } else {
          setSelectedProvider(null);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setEpisodesError(
          err instanceof Error ? err.message : 'Failed to retrieve episode sources'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingEpisodes(false);
      });

    return () => controller.abort();
  }, [anilistId, reloadTick]);

  const activeProviderBlock = useMemo(() => {
    if (!episodesData || !selectedProvider) return null;
    return (
      episodesData.availableProviders.find((p) => p.provider === selectedProvider) ?? null
    );
  }, [episodesData, selectedProvider]);

  const currentEpisodes = useMemo(() => {
    if (!activeProviderBlock) return [];
    const list =
      selectedAudio === 'dub' ? activeProviderBlock.dub : activeProviderBlock.sub;
    if (!epSearch.trim()) return list;
    const q = epSearch.trim().toLowerCase();
    return list.filter(
      (ep) =>
        String(ep.number).includes(q) ||
        (ep.title && ep.title.toLowerCase().includes(q))
    );
  }, [activeProviderBlock, selectedAudio, epSearch]);

  const chunkCount = Math.max(1, Math.ceil(currentEpisodes.length / EPISODES_PER_PAGE));
  const safeChunk = Math.min(epChunkPage, chunkCount - 1);
  const visibleEpisodes = useMemo(() => {
    const start = safeChunk * EPISODES_PER_PAGE;
    return currentEpisodes.slice(start, start + EPISODES_PER_PAGE);
  }, [currentEpisodes, safeChunk]);

  useEffect(() => {
    setEpChunkPage(0);
  }, [selectedProvider, selectedAudio, epSearch]);

  const resumeProgress = continueWatching.find((p) => p.animeId === anilistId) ?? null;

  if (loadingAnime && !anime) {
    return (
      <div className="min-h-screen bg-[#08090C] pb-24">
        <div className="h-[380px] w-full skeleton-shimmer" />
        <div className="mx-auto -mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 md:flex-row">
            <div className="h-72 w-48 shrink-0 rounded-xl skeleton-shimmer" />
            <div className="flex-1 space-y-4 pt-12">
              <div className="h-9 w-2/3 rounded skeleton-shimmer" />
              <div className="h-5 w-1/3 rounded skeleton-shimmer" />
              <div className="h-24 w-full rounded skeleton-shimmer" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (animeError || !anime) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <AlertCircle className="h-10 w-10 text-[#E5383B]" />
        <h1 className="mt-4 font-display text-2xl font-semibold text-white">
          Unable to load anime
        </h1>
        <p className="mt-2 max-w-md text-sm text-[#9aa2b1]">
          {animeError || 'Anime not found on AniList.'}
        </p>
        <button
          type="button"
          onClick={() => setReloadTick((t) => t + 1)}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#E5383B] px-5 py-2.5 text-sm font-medium text-white"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const title = getDisplayTitle(anime);
  const secondaryTitle = getSecondaryTitle(anime);
  const synopsis = stripHtml(anime.description);
  const saved = isSaved(anime.id);
  const mainStudios =
    anime.studios?.edges
      .filter((e) => e.isMain)
      .map((e) => e.node.name)
      .join(', ') || '';

  const relatedAnime =
    anime.relations?.edges
      .filter(
        (e) =>
          e.node &&
          ['TV', 'TV_SHORT', 'MOVIE', 'OVA', 'ONA', 'SPECIAL'].includes(
            e.node.format || ''
          )
      )
      .slice(0, 6) || [];

  const recommendedAnime =
    anime.recommendations?.nodes
      .map((n) => n.mediaRecommendation)
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .slice(0, 6) || [];

  const anySubAvailable = Boolean(
    episodesData?.availableProviders.some((p) => p.sub.length > 0)
  );
  const anyDubAvailable = Boolean(
    episodesData?.availableProviders.some((p) => p.dub.length > 0)
  );

  const primaryWatchEp = resumeProgress?.episodeNumber || currentEpisodes[0]?.number || 1;
  const primaryWatchHref = selectedProvider
    ? `/watch/${anime.id}/${primaryWatchEp}?provider=${selectedProvider}&audio=${selectedAudio}`
    : `/watch/${anime.id}/${primaryWatchEp}`;

  const metadataLine = [
    formatFormatLabel(anime.format),
    formatSeasonLabel(anime.season, anime.seasonYear) || anime.startDate?.year,
    formatStatusLabel(anime.status),
    anime.episodes ? `${anime.episodes} Episodes` : null,
    anime.duration ? `${anime.duration} min` : null,
    anime.averageScore ? `${(anime.averageScore / 10).toFixed(1)} Score` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-[#08090C] pb-24"
    >
      {/* Cinematic Top Banner */}
      <div className="relative h-[300px] sm:h-[380px] lg:h-[430px] w-full overflow-hidden bg-[#10131A]">
        <ImageWithFallback
          src={anime.bannerImage || anime.coverImage.extraLarge || anime.coverImage.large}
          alt={title}
          loading="eager"
          className="h-full w-full object-cover object-center opacity-70"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-[#08090C]/60 to-[#08090C]/40"
          aria-hidden="true"
        />
      </div>

      <div className="relative z-10 mx-auto -mt-32 sm:-mt-40 max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main Series Info Split */}
        <div className="flex flex-col gap-6 md:flex-row md:gap-10">
          {/* Poster */}
          <div className="w-40 sm:w-52 lg:w-60 shrink-0 self-start overflow-hidden rounded-xl border border-white/15 bg-[#10131A] shadow-2xl">
            <ImageWithFallback
              src={anime.coverImage.extraLarge || anime.coverImage.large}
              alt={title}
              loading="eager"
              className="aspect-[2/3] w-full object-cover"
            />
          </div>

          {/* Title, Actions, Synopsis */}
          <div className="flex-1 pt-2 md:pt-16">
            <p className="text-xs sm:text-sm font-medium text-[#D1D5DB]">{metadataLine}</p>

            <h1 className="mt-2 font-display text-[clamp(1.75rem,3.5vw,3rem)] font-bold leading-tight tracking-tight text-white [text-wrap:balance]">
              {title}
            </h1>

            {secondaryTitle && (
              <p className="mt-1 text-sm text-[#9aa2b1]">{secondaryTitle}</p>
            )}

            {/* Genres & Audio Availability as Clean Unboxed Text */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-[#9aa2b1]">
              {anime.genres?.length ? (
                <span>{anime.genres.join(' · ')}</span>
              ) : null}
              {mainStudios && <span>Studio: {mainStudios}</span>}
              {!loadingEpisodes && episodesData && (anySubAvailable || anyDubAvailable) && (
                <span className="text-[#F4F5F7]">
                  Audio:{' '}
                  {[anySubAvailable ? 'SUB' : null, anyDubAvailable ? 'DUB' : null]
                    .filter(Boolean)
                    .join(' / ')}
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {(!episodesData || episodesData.availableProviders.length > 0) && (
                <Link
                  to={primaryWatchHref}
                  className="inline-flex min-h-[44px] items-center gap-2.5 rounded-lg bg-[#E5383B] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#f0484b] whitespace-nowrap shrink-0"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>
                    {resumeProgress
                      ? `Resume Episode ${resumeProgress.episodeNumber}`
                      : 'Watch Episode 1'}
                  </span>
                </Link>
              )}

              <button
                type="button"
                onClick={() =>
                  toggleWatchlist({
                    animeId: anime.id,
                    title,
                    coverImage:
                      anime.coverImage.large || anime.coverImage.extraLarge || '',
                    format: anime.format,
                    seasonYear: anime.seasonYear,
                    episodes: anime.episodes,
                    averageScore: anime.averageScore,
                  })
                }
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  saved
                    ? 'border-[#E5383B] bg-[#E5383B]/15 text-white'
                    : 'border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12]'
                }`}
              >
                {saved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                <span>{saved ? 'In Watchlist' : 'Add to Watchlist'}</span>
              </button>
            </div>

            {synopsis && (
              <p className="mt-6 max-w-3xl whitespace-pre-line text-sm sm:text-[15px] leading-relaxed text-[#C4C9D4]">
                {synopsis}
              </p>
            )}

            {mapping?.synonyms && mapping.synonyms.length > 0 && (
              <p className="mt-4 text-xs text-[#687080]">
                Also known as: {mapping.synonyms.slice(0, 5).join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Episodes & Providers Section */}
        <section className="mt-14 border-t border-white/[0.08] pt-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold text-white">
                Episodes & Streaming Providers
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#9aa2b1]">
                {loadingEpisodes
                  ? 'Checking available streaming providers...'
                  : episodesData?.availableProviders.length
                  ? `${episodesData.availableProviders.length} verified ${
                      episodesData.availableProviders.length === 1
                        ? 'provider'
                        : 'providers'
                    } available`
                  : 'No streaming providers mapped for this title'}
              </p>
            </div>

            {activeProviderBlock && (
              <div className="flex flex-wrap items-center gap-3">
                {/* SUB / DUB Switcher */}
                <div
                  role="group"
                  aria-label="Audio language"
                  className="flex items-center rounded-lg border border-white/10 bg-[#10131A] p-1"
                >
                  <button
                    type="button"
                    disabled={activeProviderBlock.sub.length === 0}
                    onClick={() => setSelectedAudio('sub')}
                    className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-35 ${
                      selectedAudio === 'sub'
                        ? 'bg-[#E5383B] text-white'
                        : 'text-[#9aa2b1] hover:text-white'
                    }`}
                  >
                    SUB ({activeProviderBlock.sub.length})
                  </button>
                  <button
                    type="button"
                    disabled={activeProviderBlock.dub.length === 0}
                    onClick={() => setSelectedAudio('dub')}
                    className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-35 ${
                      selectedAudio === 'dub'
                        ? 'bg-[#E5383B] text-white'
                        : 'text-[#9aa2b1] hover:text-white'
                    }`}
                  >
                    DUB ({activeProviderBlock.dub.length})
                  </button>
                </div>

                {/* Episode Quick Filter */}
                {(activeProviderBlock.sub.length > 12 ||
                  activeProviderBlock.dub.length > 12) && (
                  <div className="relative w-44">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#687080]" />
                    <input
                      type="text"
                      value={epSearch}
                      onChange={(e) => setEpSearch(e.target.value)}
                      placeholder="Filter episode..."
                      aria-label="Filter episodes"
                      className="h-9 w-full rounded-lg border border-white/10 bg-[#10131A] pl-8 pr-3 text-xs text-white placeholder-[#687080] focus:border-[#E5383B] focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Verified Provider Buttons */}
          {!loadingEpisodes && episodesData && episodesData.availableProviders.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {episodesData.availableProviders.map((prov) => {
                const isSelected = prov.provider === selectedProvider;
                return (
                  <button
                    key={prov.provider}
                    type="button"
                    onClick={() => {
                      setSelectedProvider(prov.provider);
                      if (selectedAudio === 'dub' && prov.dub.length === 0) {
                        setSelectedAudio('sub');
                      } else if (selectedAudio === 'sub' && prov.sub.length === 0) {
                        setSelectedAudio('dub');
                      }
                    }}
                    className={`rounded-lg border px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'border-[#E5383B] bg-[#E5383B]/15 text-white'
                        : 'border-white/10 bg-[#10131A] text-[#9aa2b1] hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {PROVIDER_LABELS[prov.provider] || prov.provider}
                  </button>
                );
              })}
            </div>
          )}

          {/* Episodes Loading */}
          {loadingEpisodes && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#10131A] p-6 text-sm text-[#9aa2b1]">
              <Loader2 className="h-5 w-5 animate-spin text-[#E5383B]" />
              <span>Resolving Anivexa mappings and episode lists...</span>
            </div>
          )}

          {/* Episodes Error */}
          {!loadingEpisodes && episodesError && (
            <div className="mt-6 rounded-xl border border-white/[0.08] bg-[#10131A] p-6 text-center">
              <p className="text-sm text-[#E5383B]">{episodesError}</p>
              <button
                type="button"
                onClick={() => setReloadTick((t) => t + 1)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/15"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* No Available Providers */}
          {!loadingEpisodes &&
            !episodesError &&
            episodesData &&
            episodesData.availableProviders.length === 0 && (
              <div className="mt-6 rounded-xl border border-white/[0.08] bg-[#10131A] p-8 text-center">
                <p className="font-display text-base font-semibold text-white">
                  No verified streaming providers available
                </p>
                <p className="mt-1 text-sm text-[#9aa2b1]">
                  {anime.status === 'NOT_YET_RELEASED'
                    ? 'This title has not aired yet.'
                    : 'None of the Anivexa providers returned a confident episode match for this AniList ID.'}
                </p>
              </div>
            )}

          {/* Chunked Pagination Bar for Long Series */}
          {chunkCount > 1 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {Array.from({ length: chunkCount }).map((_, idx) => {
                const startEp = currentEpisodes[idx * EPISODES_PER_PAGE]?.number;
                const endEp =
                  currentEpisodes[
                    Math.min(currentEpisodes.length - 1, (idx + 1) * EPISODES_PER_PAGE - 1)
                  ]?.number;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setEpChunkPage(idx)}
                    className={`rounded-md px-3 py-1.5 font-mono-tabular text-xs transition-colors ${
                      safeChunk === idx
                        ? 'bg-white text-[#08090C] font-semibold'
                        : 'border border-white/10 bg-[#10131A] text-[#9aa2b1] hover:text-white'
                    }`}
                  >
                    {startEp}–{endEp}
                  </button>
                );
              })}
            </div>
          )}

          {/* Episode List */}
          {!loadingEpisodes && visibleEpisodes.length > 0 && selectedProvider && (
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {visibleEpisodes.map((ep) => {
                const isResumeTarget = resumeProgress?.episodeNumber === ep.number;
                return (
                  <Link
                    key={ep.id}
                    to={`/watch/${anime.id}/${ep.number}?provider=${selectedProvider}&audio=${selectedAudio}`}
                    className={`group flex items-center gap-4 rounded-xl border p-3 transition-colors ${
                      isResumeTarget
                        ? 'border-[#E5383B]/60 bg-[#E5383B]/[0.08]'
                        : 'border-white/[0.07] bg-[#10131A] hover:border-white/20 hover:bg-[#141822]'
                    }`}
                  >
                    {ep.image ? (
                      <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-[#151923]">
                        <ImageWithFallback
                          src={ep.image}
                          alt={ep.title || `Episode ${ep.number}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                          <Play className="h-5 w-5 fill-current text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#151923] font-mono-tabular text-base font-semibold text-white group-hover:bg-[#E5383B] transition-colors">
                        {ep.number}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-[#9aa2b1]">
                        <span className="font-mono-tabular font-semibold text-white">
                          Episode {ep.number}
                        </span>
                        {ep.filler && <span>· Filler</span>}
                        {ep.airDate && <span>· {ep.airDate}</span>}
                        {isResumeTarget && (
                          <span className="font-medium text-[#E5383B]">· In Progress</span>
                        )}
                      </div>
                      {ep.title && (
                        <h3 className="mt-1 truncate font-display text-sm font-semibold text-white group-hover:text-[#E5383B] transition-colors">
                          {ep.title}
                        </h3>
                      )}
                      {ep.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-[#9aa2b1]">
                          {ep.description}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Related Anime */}
        {relatedAnime.length > 0 && (
          <section className="mt-14 border-t border-white/[0.08] pt-10">
            <h2 className="mb-5 font-display text-xl font-semibold text-white">
              Related Series & Films
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {relatedAnime.map((edge) => (
                <AnimeCard
                  key={`${edge.relationType}-${edge.node.id}`}
                  anime={edge.node}
                  subtitleOverride={
                    edge.relationType
                      ? edge.relationType.replace(/_/g, ' ').toLowerCase()
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* Recommendations */}
        {recommendedAnime.length > 0 && (
          <section className="mt-14 border-t border-white/[0.08] pt-10">
            <h2 className="mb-5 font-display text-xl font-semibold text-white">
              Recommended Next
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {recommendedAnime.map((rec) => (
                <AnimeCard key={rec.id} anime={rec} />
              ))}
            </div>
          </section>
        )}
      </div>
    </motion.div>
  );
}
