import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Compass, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useUserLibrary } from '../hooks/useUserLibrary';
import { formatFormatLabel } from '../utils/format';
import { ImageWithFallback } from '../components/common/ImageWithFallback';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

type WatchlistSort = 'added' | 'title' | 'score';

export function WatchlistPage() {
  const { watchlist, toggleWatchlist } = useUserLibrary();
  const [sortBy, setSortBy] = useState<WatchlistSort>('added');
  const [pendingRemoveId, setPendingRemoveId] = useState<number | null>(null);

  const sorted = useMemo(() => {
    const copy = [...watchlist];
    if (sortBy === 'title') {
      copy.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'score') {
      copy.sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));
    } else {
      copy.sort((a, b) => b.addedAt - a.addedAt);
    }
    return copy;
  }, [watchlist, sortBy]);

  const targetEntry = watchlist.find((w) => w.animeId === pendingRemoveId);

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
              Watchlist
            </h1>
            <p className="mt-1 text-sm text-[#9aa2b1]">
              {watchlist.length} saved {watchlist.length === 1 ? 'title' : 'titles'} ·
              Stored locally in your browser
            </p>
          </div>

          {watchlist.length > 0 && (
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#10131A] p-1">
              {(
                [
                  { id: 'added', label: 'Recently Added' },
                  { id: 'title', label: 'A–Z' },
                  { id: 'score', label: 'Score' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSortBy(opt.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    sortBy === opt.id
                      ? 'bg-[#E5383B] text-white'
                      : 'text-[#9aa2b1] hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-white/[0.08] bg-[#10131A] p-12 text-center">
            <Bookmark className="mx-auto h-10 w-10 text-[#687080]" aria-hidden="true" />
            <h2 className="mt-4 font-display text-xl font-semibold text-white">
              Your watchlist is empty
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#9aa2b1]">
              Bookmark anime from the homepage, discovery catalog, or any series page to keep
              track of what to watch next.
            </p>
            <Link
              to="/discover"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#E5383B] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#f0484b]"
            >
              <Compass className="h-4 w-4" />
              <span>Discover Anime</span>
            </Link>
          </div>
        ) : (
          <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {sorted.map((item) => (
              <div key={item.animeId} className="group relative flex flex-col">
                <Link
                  to={`/anime/${item.animeId}`}
                  className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#11141c]"
                >
                  <ImageWithFallback
                    src={item.coverImage}
                    alt={item.title}
                    fallbackTitle={item.title}
                    className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-60" />
                </Link>

                <button
                  type="button"
                  onClick={() => setPendingRemoveId(item.animeId)}
                  aria-label={`Remove ${item.title} from Watchlist`}
                  className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black/75 text-[#D1D5DB] opacity-0 transition-opacity hover:border-[#E5383B] hover:text-[#E5383B] group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <Link to={`/anime/${item.animeId}`} className="mt-2.5 px-0.5">
                  <h3 className="line-clamp-1 font-display text-[15px] font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-[#9aa2b1]">
                    {[
                      formatFormatLabel(item.format),
                      item.seasonYear,
                      item.averageScore ? `${(item.averageScore / 10).toFixed(1)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(targetEntry)}
        title="Remove from Watchlist"
        description={`Remove "${targetEntry?.title ?? ''}" from your locally saved watchlist?`}
        confirmLabel="Remove"
        destructive
        onCancel={() => setPendingRemoveId(null)}
        onConfirm={() => {
          if (targetEntry) toggleWatchlist(targetEntry);
          setPendingRemoveId(null);
        }}
      />
    </motion.div>
  );
}
