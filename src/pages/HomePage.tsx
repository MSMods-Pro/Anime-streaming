import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { getHomeCatalog } from '../services/anilist';
import type { AnimeSummary, HomeCatalog } from '../types/anilist';
import {
  formatFormatLabel,
  formatTimecode,
  getDisplayTitle,
  stripHtml,
} from '../utils/format';
import { useUserLibrary } from '../hooks/useUserLibrary';
import { HeroSpotlight } from '../components/home/HeroSpotlight';
import { AnimeCard } from '../components/common/AnimeCard';
import { ImageWithFallback } from '../components/common/ImageWithFallback';

function HorizontalRail({
  title,
  subtitle,
  seeAllTo,
  items,
  variant = 'poster',
}: {
  title: string;
  subtitle?: string;
  seeAllTo: string;
  items: AnimeSummary[];
  variant?: 'poster' | 'landscape';
}) {
  const railRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (dir: -1 | 1) => {
    if (!railRef.current) return;
    const width = railRef.current.clientWidth;
    railRef.current.scrollBy({ left: dir * width * 0.78, behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs sm:text-sm text-[#9aa2b1]">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollByAmount(-1)}
              aria-label={`Scroll ${title} left`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#10131A] text-[#9aa2b1] transition-colors hover:border-white/20 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount(1)}
              aria-label={`Scroll ${title} right`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#10131A] text-[#9aa2b1] transition-colors hover:border-white/20 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Link
            to={seeAllTo}
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-[#9aa2b1] transition-colors hover:text-white whitespace-nowrap shrink-0"
          >
            <span>View all</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div
        ref={railRef}
        className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 snap-x snap-mandatory"
      >
        {items.map((anime) => (
          <div
            key={anime.id}
            className={`shrink-0 snap-start ${
              variant === 'landscape'
                ? 'w-[76vw] sm:w-[320px] lg:w-[360px]'
                : 'w-[42vw] sm:w-[175px] lg:w-[192px]'
            }`}
          >
            <AnimeCard anime={anime} variant={variant} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function HomePage() {
  const [catalog, setCatalog] = useState<HomeCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const { continueWatching, removeProgress } = useUserLibrary();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getHomeCatalog(controller.signal)
      .then((data) => setCatalog(data))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load catalog');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadTick]);

  if (loading && !catalog) {
    return (
      <div className="min-h-screen bg-[#08090C] pb-20">
        <div className="h-[580px] w-full skeleton-shimmer" />
        <div className="mx-auto mt-10 max-w-7xl space-y-12 px-4 sm:px-6 lg:px-8">
          {[1, 2, 3].map((row) => (
            <div key={row}>
              <div className="mb-4 h-7 w-48 rounded skeleton-shimmer" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                {[1, 2, 3, 4, 5, 6].map((col) => (
                  <div key={col} className="aspect-[2/3] rounded-xl skeleton-shimmer" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !catalog) {
    return (
      <div className="flex min-h-[75vh] flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-white">
          Unable to load anime catalog
        </h1>
        <p className="mt-2 max-w-md text-sm text-[#9aa2b1]">{error}</p>
        <button
          type="button"
          onClick={() => setReloadTick((n) => n + 1)}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#E5383B] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#f0484b]"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!catalog) return null;

  const seasonalLead = catalog.seasonal[0];
  const seasonalRest = catalog.seasonal.slice(1, 5);
  const trendingTop = catalog.trending.slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-[#08090C] pb-16"
    >
      {/* Hero Spotlight */}
      <HeroSpotlight items={catalog.trending} />

      <div className="mt-10 space-y-14 sm:space-y-16">
        {/* 1. Continue Watching (Persisted in Browser) */}
        {continueWatching.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">
                  Continue Watching
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-[#9aa2b1]">
                  Pick up right where you left off on this device
                </p>
              </div>
              <Link
                to="/history"
                className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-[#9aa2b1] transition-colors hover:text-white whitespace-nowrap shrink-0"
              >
                <span>History</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {continueWatching.slice(0, 4).map((entry) => {
                const pct =
                  entry.duration > 0
                    ? Math.min(100, Math.round((entry.position / entry.duration) * 100))
                    : 0;
                return (
                  <div
                    key={entry.animeId}
                    className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#10131A]"
                  >
                    <Link
                      to={`/watch/${entry.animeId}/${entry.episodeNumber}?provider=${entry.provider}&audio=${entry.audio}`}
                      className="block"
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-[#151923]">
                        <ImageWithFallback
                          src={entry.episodeImage || entry.bannerImage || entry.coverImage}
                          alt={entry.animeTitle}
                          fallbackTitle={entry.animeTitle}
                          className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                        <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs font-medium text-white">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E5383B]">
                            <Play className="h-3.5 w-3.5 fill-current" />
                          </span>
                          <span className="font-mono-tabular">
                            Ep {entry.episodeNumber} · {formatTimecode(entry.position)}
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full bg-[#E5383B]"
                          />
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="truncate font-display text-sm font-semibold text-white">
                          {entry.animeTitle}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-[#9aa2b1]">
                          {entry.episodeTitle
                            ? entry.episodeTitle
                            : `Episode ${entry.episodeNumber}`}{' '}
                          · {entry.audio.toUpperCase()}
                        </p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeProgress(entry.animeId)}
                      aria-label={`Remove ${entry.animeTitle} from Continue Watching`}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/70 text-[#9aa2b1] opacity-0 transition-opacity hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 2. Trending Ranked Grid (Distinct Ranked Editorial Treatment) */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">
                Trending Now
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#9aa2b1]">
                Most watched and discussed series across AniList right now
              </p>
            </div>
            <Link
              to="/discover?sort=TRENDING_DESC"
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-[#9aa2b1] transition-colors hover:text-white whitespace-nowrap shrink-0"
            >
              <span>Explore trending</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {trendingTop.map((anime, idx) => (
              <AnimeCard key={anime.id} anime={anime} rankIndex={idx + 1} />
            ))}
          </div>
        </section>

        {/* 3. Seasonal Editorial Split Spotlight */}
        {seasonalLead && (
          <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">
                  {catalog.seasonLabel} Season
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-[#9aa2b1]">
                  Standout premieres and ongoing seasonal highlights
                </p>
              </div>
              <Link
                to="/discover?sort=POPULARITY_DESC"
                className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-[#9aa2b1] transition-colors hover:text-white whitespace-nowrap shrink-0"
              >
                <span>Full season</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
              {/* Featured Seasonal Card */}
              <Link
                to={`/anime/${seasonalLead.id}`}
                className="group relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10131A] p-6 lg:col-span-6"
              >
                <ImageWithFallback
                  src={
                    seasonalLead.bannerImage ||
                    seasonalLead.coverImage.extraLarge ||
                    seasonalLead.coverImage.large
                  }
                  alt={getDisplayTitle(seasonalLead)}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-[#08090C]/70 to-black/20"
                  aria-hidden="true"
                />
                <div className="relative z-10">
                  <p className="text-xs font-medium text-[#D1D5DB]">
                    {[
                      formatFormatLabel(seasonalLead.format),
                      seasonalLead.genres?.slice(0, 3).join(' / '),
                      seasonalLead.averageScore
                        ? `${(seasonalLead.averageScore / 10).toFixed(1)} Score`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-bold text-white [text-wrap:balance]">
                    {getDisplayTitle(seasonalLead)}
                  </h3>
                  <p className="mt-2 line-clamp-2 max-w-lg text-sm text-[#C4C9D4]">
                    {stripHtml(seasonalLead.description)}
                  </p>
                </div>
              </Link>

              {/* 4 Companion Seasonal Posters */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:col-span-6 lg:grid-cols-2">
                {seasonalRest.map((anime) => (
                  <Link
                    key={anime.id}
                    to={`/anime/${anime.id}`}
                    className="group flex items-center gap-3.5 rounded-xl border border-white/[0.07] bg-[#10131A] p-2.5 transition-colors hover:border-white/20 hover:bg-[#141822]"
                  >
                    <ImageWithFallback
                      src={anime.coverImage.large || anime.coverImage.medium}
                      alt={getDisplayTitle(anime)}
                      className="h-24 w-16 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 font-display text-sm font-semibold text-white group-hover:text-[#E5383B] transition-colors">
                        {getDisplayTitle(anime)}
                      </h3>
                      <p className="mt-1 text-xs text-[#9aa2b1]">
                        {[
                          formatFormatLabel(anime.format),
                          anime.episodes ? `${anime.episodes} ep` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {anime.genres?.length ? (
                        <p className="mt-0.5 truncate text-[11px] text-[#687080]">
                          {anime.genres.slice(0, 2).join(', ')}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 4. Popular All-Time Rail */}
        <HorizontalRail
          title="All-Time Popular"
          subtitle="Acclaimed series with enduring fan followings"
          seeAllTo="/discover?sort=POPULARITY_DESC"
          items={catalog.popular}
        />

        {/* 5. Anime Movies Widescreen Landscape Showcase */}
        <HorizontalRail
          title="Cinema & Feature Films"
          subtitle="Theatrical anime features presented in widescreen"
          seeAllTo="/movies"
          items={catalog.movies}
          variant="landscape"
        />

        {/* 6. Latest Releases (Currently Airing) */}
        <HorizontalRail
          title="Latest Releases"
          subtitle="New series currently airing this cycle"
          seeAllTo="/discover?status=RELEASING&sort=START_DATE_DESC"
          items={catalog.latestReleases}
        />

        {/* 7. Recently Updated Grid */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">
                Recently Updated
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#9aa2b1]">
                Ongoing broadcasts with fresh episode activity
              </p>
            </div>
            <Link
              to="/discover?status=RELEASING&sort=UPDATED_AT_DESC"
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-[#9aa2b1] transition-colors hover:text-white whitespace-nowrap shrink-0"
            >
              <span>View schedule</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {catalog.recentlyUpdated.slice(0, 6).map((anime) => {
              const epSubtitle = anime.nextAiringEpisode
                ? `Ep ${anime.nextAiringEpisode.episode} upcoming`
                : formatFormatLabel(anime.format);
              return (
                <AnimeCard
                  key={anime.id}
                  anime={anime}
                  subtitleOverride={epSubtitle}
                />
              );
            })}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
