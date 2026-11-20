import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { motion } from 'motion/react';
import { ANILIST_GENRES, discoverAnime } from '../services/anilist';
import type {
  AnimeSummary,
  DiscoverFilters,
  DiscoverSort,
  MediaFormat,
  MediaSeason,
  MediaStatus,
  PageInfo,
} from '../types/anilist';
import { useDebounce } from '../hooks/useDebounce';
import { AnimeCard } from '../components/common/AnimeCard';

const SORT_OPTIONS: Array<{ value: DiscoverSort; label: string }> = [
  { value: 'TRENDING_DESC', label: 'Trending' },
  { value: 'POPULARITY_DESC', label: 'Most Popular' },
  { value: 'SCORE_DESC', label: 'Highest Rated' },
  { value: 'START_DATE_DESC', label: 'Newest Releases' },
  { value: 'UPDATED_AT_DESC', label: 'Recently Updated' },
];

const FORMAT_OPTIONS: Array<{ value: MediaFormat | ''; label: string }> = [
  { value: '', label: 'All Formats' },
  { value: 'TV', label: 'TV Series' },
  { value: 'MOVIE', label: 'Movie' },
  { value: 'ONA', label: 'ONA' },
  { value: 'OVA', label: 'OVA' },
  { value: 'SPECIAL', label: 'Special' },
];

const STATUS_OPTIONS: Array<{ value: MediaStatus | ''; label: string }> = [
  { value: '', label: 'Any Status' },
  { value: 'RELEASING', label: 'Currently Airing' },
  { value: 'FINISHED', label: 'Completed' },
  { value: 'NOT_YET_RELEASED', label: 'Upcoming' },
];

const SEASON_OPTIONS: Array<{ value: MediaSeason | ''; label: string }> = [
  { value: '', label: 'Any Season' },
  { value: 'WINTER', label: 'Winter' },
  { value: 'SPRING', label: 'Spring' },
  { value: 'SUMMER', label: 'Summer' },
  { value: 'FALL', label: 'Fall' },
];

const CURRENT_YEAR = new Date().getFullYear() + 1;
const YEAR_OPTIONS = Array.from({ length: 35 }, (_, i) => CURRENT_YEAR - i);

export function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') || '');
  const debouncedSearch = useDebounce(searchInput, 350);

  const [genre, setGenre] = useState(() => searchParams.get('genre') || '');
  const [format, setFormat] = useState<MediaFormat | ''>(
    () => (searchParams.get('format') as MediaFormat) || ''
  );
  const [status, setStatus] = useState<MediaStatus | ''>(
    () => (searchParams.get('status') as MediaStatus) || ''
  );
  const [season, setSeason] = useState<MediaSeason | ''>(
    () => (searchParams.get('season') as MediaSeason) || ''
  );
  const [year, setYear] = useState<number | ''>(() => {
    const y = Number(searchParams.get('year'));
    return Number.isFinite(y) && y > 1950 ? y : '';
  });
  const [sort, setSort] = useState<DiscoverSort>(
    () => (searchParams.get('sort') as DiscoverSort) || 'TRENDING_DESC'
  );

  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AnimeSummary[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  // Sync URL params when filters change
  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch.trim()) next.set('q', debouncedSearch.trim());
    if (genre) next.set('genre', genre);
    if (format) next.set('format', format);
    if (status) next.set('status', status);
    if (season) next.set('season', season);
    if (year) next.set('year', String(year));
    if (sort && sort !== 'TRENDING_DESC') next.set('sort', sort);
    setSearchParams(next, { replace: true });
    setPage(1);
  }, [debouncedSearch, genre, format, status, season, year, sort, setSearchParams]);

  // Fetch filtered anime
  useEffect(() => {
    const controller = new AbortController();
    const isFirstPage = page === 1;
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    const filters: DiscoverFilters = {
      search: debouncedSearch || undefined,
      genre: genre || undefined,
      format: format || undefined,
      status: status || undefined,
      season: season || undefined,
      year: year || undefined,
      sort,
    };

    discoverAnime(filters, page, 24, controller.signal)
      .then((res) => {
        setPageInfo(res.pageInfo);
        setItems((prev) => (isFirstPage ? res.media : [...prev, ...res.media]));
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load catalog');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      });

    return () => controller.abort();
  }, [debouncedSearch, genre, format, status, season, year, sort, page, retryTick]);

  const hasActiveFilters = Boolean(
    searchInput || genre || format || status || season || year || sort !== 'TRENDING_DESC'
  );

  const resetFilters = () => {
    setSearchInput('');
    setGenre('');
    setFormat('');
    setStatus('');
    setSeason('');
    setYear('');
    setSort('TRENDING_DESC');
    setPage(1);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-[#08090C] pb-24 pt-20 md:pt-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-6 md:flex-row md:items-end">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Discover Anime
            </h1>
            <p className="mt-1 text-sm text-[#9aa2b1]">
              Search and filter the live AniList catalogue by genre, season, format, and status.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 sm:w-72">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#687080]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search title..."
                aria-label="Search anime titles"
                className="h-11 w-full rounded-lg border border-white/10 bg-[#10131A] pl-9 pr-8 text-sm text-white placeholder-[#687080] focus:border-[#E5383B] focus:outline-none"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#687080] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                showFilters
                  ? 'border-[#E5383B] bg-[#E5383B]/15 text-white'
                  : 'border-white/10 bg-[#10131A] text-[#D1D5DB] hover:border-white/20'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Genre Interactive Filter Row */}
        <div className="no-scrollbar -mx-4 mt-5 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <button
            type="button"
            onClick={() => setGenre('')}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              genre === ''
                ? 'bg-[#E5383B] text-white'
                : 'border border-white/[0.08] bg-[#10131A] text-[#9aa2b1] hover:text-white'
            }`}
          >
            All Genres
          </button>
          {ANILIST_GENRES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(genre === g ? '' : g)}
              className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                genre === g
                  ? 'bg-[#E5383B] text-white'
                  : 'border border-white/[0.08] bg-[#10131A] text-[#9aa2b1] hover:text-white'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Expandable Select Filters */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-white/[0.08] bg-[#10131A] p-4 sm:grid-cols-3 lg:grid-cols-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#9aa2b1]">Sort By</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as DiscoverSort)}
                className="h-10 w-full rounded-lg border border-white/10 bg-[#08090C] px-3 text-sm text-white focus:border-[#E5383B] focus:outline-none"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#9aa2b1]">Format</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as MediaFormat | '')}
                className="h-10 w-full rounded-lg border border-white/10 bg-[#08090C] px-3 text-sm text-white focus:border-[#E5383B] focus:outline-none"
              >
                {FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#9aa2b1]">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MediaStatus | '')}
                className="h-10 w-full rounded-lg border border-white/10 bg-[#08090C] px-3 text-sm text-white focus:border-[#E5383B] focus:outline-none"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#9aa2b1]">Season</span>
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value as MediaSeason | '')}
                className="h-10 w-full rounded-lg border border-white/10 bg-[#08090C] px-3 text-sm text-white focus:border-[#E5383B] focus:outline-none"
              >
                {SEASON_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#9aa2b1]">Year</span>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}
                className="h-10 w-full rounded-lg border border-white/10 bg-[#08090C] px-3 text-sm text-white focus:border-[#E5383B] focus:outline-none"
              >
                <option value="">Any Year</option>
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* Active Filter Summary */}
        {hasActiveFilters && (
          <div className="mt-4 flex items-center justify-between text-xs text-[#9aa2b1]">
            <span>
              {pageInfo?.total
                ? `${pageInfo.total.toLocaleString()} matching titles`
                : 'Filtered results'}
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="font-medium text-[#E5383B] hover:underline"
            >
              Reset all filters
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="mt-7">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="aspect-[2/3] rounded-xl skeleton-shimmer" />
                  <div className="h-4 w-3/4 rounded skeleton-shimmer" />
                  <div className="h-3 w-1/2 rounded skeleton-shimmer" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#10131A] p-10 text-center">
              <p className="font-display text-lg font-semibold text-white">
                Failed to load discovery results
              </p>
              <p className="mt-1 text-sm text-[#9aa2b1]">{error}</p>
              <button
                type="button"
                onClick={() => setRetryTick((t) => t + 1)}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#E5383B] px-4 py-2 text-sm font-medium text-white hover:bg-[#f0484b]"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Retry</span>
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#10131A] p-12 text-center">
              <p className="font-display text-lg font-semibold text-white">
                No anime matched your filters
              </p>
              <p className="mt-1 text-sm text-[#9aa2b1]">
                Try broadening your genre, year, or search query.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-5 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {items.map((anime) => (
                  <AnimeCard key={anime.id} anime={anime} />
                ))}
              </div>

              {pageInfo?.hasNextPage && (
                <div className="mt-10 flex justify-center">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => setPage((p) => p + 1)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-white/15 bg-[#10131A] px-8 py-2.5 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-[#161a24] disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading more...' : 'Load More Anime'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
