import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Compass, Play, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useUserLibrary } from '../hooks/useUserLibrary';
import { PROVIDER_LABELS } from '../services/anivexa';
import { formatRelativeTime, formatTimecode } from '../utils/format';
import { ImageWithFallback } from '../components/common/ImageWithFallback';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export function HistoryPage() {
  const {
    continueWatching,
    history,
    removeProgress,
    removeHistory,
    clearHistory,
  } = useUserLibrary();
  const [confirmClear, setConfirmClear] = useState(false);

  const isEmpty = continueWatching.length === 0 && history.length === 0;

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
              Watch History
            </h1>
            <p className="mt-1 text-sm text-[#9aa2b1]">
              Resume active episodes or revisit recently watched series · Stored locally in
              your browser
            </p>
          </div>

          {!isEmpty && (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#10131A] px-4 text-xs font-medium text-[#D1D5DB] transition-colors hover:border-[#E5383B]/60 hover:text-[#E5383B] whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear All History</span>
            </button>
          )}
        </div>

        {isEmpty ? (
          <div className="mt-12 rounded-2xl border border-white/[0.08] bg-[#10131A] p-12 text-center">
            <Clock className="mx-auto h-10 w-10 text-[#687080]" aria-hidden="true" />
            <h2 className="mt-4 font-display text-xl font-semibold text-white">
              No watch history yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#9aa2b1]">
              Episodes you watch on this device will appear here so you can resume playback
              where you left off.
            </p>
            <Link
              to="/discover"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#E5383B] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#f0484b]"
            >
              <Compass className="h-4 w-4" />
              <span>Browse Anime</span>
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-12">
            {/* Continue Watching Section */}
            {continueWatching.length > 0 && (
              <section>
                <h2 className="mb-4 font-display text-lg sm:text-xl font-semibold text-white">
                  Continue Watching
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {continueWatching.map((entry) => {
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
                              {entry.episodeTitle || `Episode ${entry.episodeNumber}`} ·{' '}
                              {formatRelativeTime(entry.updatedAt)}
                            </p>
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeProgress(entry.animeId)}
                          aria-label={`Remove ${entry.animeTitle} from Continue Watching`}
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/75 text-[#9aa2b1] opacity-0 transition-opacity hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Full Episode Watch History */}
            {history.length > 0 && (
              <section>
                <h2 className="mb-4 font-display text-lg sm:text-xl font-semibold text-white">
                  Recently Watched Episodes
                </h2>
                <div className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08] bg-[#10131A]">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 p-3.5 transition-colors hover:bg-white/[0.03] sm:px-5"
                    >
                      <Link
                        to={`/watch/${item.animeId}/${item.episodeNumber}?provider=${item.provider}&audio=${item.audio}`}
                        className="flex min-w-0 flex-1 items-center gap-4"
                      >
                        <ImageWithFallback
                          src={item.episodeImage || item.coverImage}
                          alt={item.animeTitle}
                          className="h-16 w-24 shrink-0 rounded-lg object-cover sm:h-16 sm:w-28"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-display text-sm sm:text-base font-semibold text-white">
                            {item.animeTitle}
                          </h3>
                          <p className="mt-0.5 truncate text-xs sm:text-sm text-[#D1D5DB]">
                            Episode {item.episodeNumber}
                            {item.episodeTitle ? ` · ${item.episodeTitle}` : ''}
                          </p>
                          <p className="mt-1 text-xs text-[#687080]">
                            {PROVIDER_LABELS[item.provider] || item.provider} ·{' '}
                            {item.audio.toUpperCase()} · {formatRelativeTime(item.watchedAt)}
                          </p>
                        </div>
                      </Link>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          to={`/watch/${item.animeId}/${item.episodeNumber}?provider=${item.provider}&audio=${item.audio}`}
                          aria-label={`Resume ${item.animeTitle} Episode ${item.episodeNumber}`}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.07] px-3 text-xs font-medium text-white transition-colors hover:bg-[#E5383B]"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span className="hidden sm:inline">Watch</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeHistory(item.id)}
                          aria-label={`Remove ${item.animeTitle} Episode ${item.episodeNumber} from history`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#687080] transition-colors hover:bg-white/5 hover:text-[#E5383B]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear Watch History"
        description="This will remove all locally stored watch history and Continue Watching progress from this browser. Your Watchlist will not be affected."
        confirmLabel="Clear History"
        destructive
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearHistory();
          setConfirmClear(false);
        }}
      />
    </motion.div>
  );
}
