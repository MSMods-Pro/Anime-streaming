import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { ANILIST_GENRES, discoverAnime } from '../services/anilist';
import type { AnimeSummary, DiscoverSort, PageInfo } from '../types/anilist';
import { AnimeCard } from '../components/common/AnimeCard';

const MOVIE_SORTS: Array<{ value: DiscoverSort; label: string }> = [
  { value: 'POPULARITY_DESC', label: 'Most Popular' },
  { value: 'SCORE_DESC', label: 'Highest Rated' },
  { value: 'TRENDING_DESC', label: 'Trending' },
  { value: 'START_DATE_DESC', label: 'Newest Releases' },
];

export function MoviesPage() {
  const [genre, setGenre] = useState('');
  const [sort, setSort] = useState<DiscoverSort>('POPULARITY_DESC');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AnimeSummary[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [genre, sort]);

  useEffect(() => {
    const controller = new AbortController();
    const isFirst = page === 1;
    if (isFirst) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    discoverAnime(
      {
        format: 'MOVIE',
        genre: genre || undefined,
        sort,
      },
      page,
      24,
      controller.signal
    )
      .then((res) => {
        setPageInfo(res.pageInfo);
        setItems((prev) => (isFirst ? res.media : [...prev, ...res.media]));
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load movies');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      });

    return () => controller.abort();
  }, [genre, sort, page, retryTick]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-[#08090C] pb-24 pt-20 md:pt-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Anime Movies
            </h1>
            <p className="mt-1 text-sm text-[#9aa2b1]">
              Theatrical features, standalone films, and canonical franchise movies.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#10131A] p-1 overflow-x-auto">
            {MOVIE_SORTS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSort(opt.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  sort === opt.value
                    ? 'bg-[#E5383B] text-white'
                    : 'text-[#9aa2b1] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Genre Filter Row */}
        <div className="no-scrollbar -mx-4 mt-5 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <button
            type="button"
            onClick={() => setGenre('')}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              genre === ''
                ? 'bg-white text-[#08090C]'
                : 'border border-white/[0.08] bg-[#10131A] text-[#9aa2b1] hover:text-white'
            }`}
          >
            All Genres
          </button>
          {ANILIST_GENRES.slice(0, 12).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(genre === g ? '' : g)}
              className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                genre === g
                  ? 'bg-white text-[#08090C]'
                  : 'border border-white/[0.08] bg-[#10131A] text-[#9aa2b1] hover:text-white'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="mt-7">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-xl skeleton-shimmer" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#10131A] p-10 text-center">
              <p className="text-base font-semibold text-white">{error}</p>
              <button
                type="button"
                onClick={() => setRetryTick((t) => t + 1)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#E5383B] px-4 py-2 text-sm font-medium text-white"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Retry</span>
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#10131A] p-12 text-center">
              <p className="text-base font-semibold text-white">No movies found</p>
              <p className="mt-1 text-sm text-[#9aa2b1]">Try clearing the genre filter.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {items.map((movie) => (
                  <AnimeCard key={movie.id} anime={movie} />
                ))}
              </div>
              {pageInfo?.hasNextPage && (
                <div className="mt-10 flex justify-center">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => setPage((p) => p + 1)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-white/15 bg-[#10131A] px-8 py-2.5 text-sm font-medium text-white hover:border-white/30"
                  >
                    {loadingMore ? 'Loading more...' : 'Load More Movies'}
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
