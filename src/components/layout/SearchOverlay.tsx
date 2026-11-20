import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Search, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useDebounce } from '../../hooks/useDebounce';
import { useUserLibrary } from '../../hooks/useUserLibrary';
import { searchSuggestions } from '../../services/anilist';
import type { AnimeSummary } from '../../types/anilist';
import { formatFormatLabel, getDisplayTitle } from '../../utils/format';
import { ImageWithFallback } from '../common/ImageWithFallback';

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 280);
  const [results, setResults] = useState<AnimeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { searchHistory, addSearchTerm, removeSearchTerm, clearSearchTerms } =
    useUserLibrary();

  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      return;
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    searchSuggestions(trimmed, controller.signal)
      .then((items) => {
        setResults(items);
        setActiveIndex(-1);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Search failed');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, open]);

  const handleSelectAnime = (anime: AnimeSummary) => {
    const title = getDisplayTitle(anime);
    addSearchTerm(query.trim() || title);
    onClose();
    navigate(`/anime/${anime.id}`);
  };

  const handleSubmitFullSearch = (termOverride?: string) => {
    const target = (termOverride ?? query).trim();
    if (!target) return;
    addSearchTerm(target);
    onClose();
    navigate(`/discover?q=${encodeURIComponent(target)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        results.length > 0 ? (prev <= 0 ? results.length - 1 : prev - 1) : -1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        handleSelectAnime(results[activeIndex]);
      } else {
        handleSubmitFullSearch();
      }
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 px-4 pt-16 sm:pt-24 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Search anime catalog"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#10131A] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input Bar */}
            <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3.5">
              <Search className="h-5 w-5 shrink-0 text-[#9aa2b1]" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search anime titles, genres, or franchises..."
                aria-label="Search anime"
                className="w-full bg-transparent text-base text-white placeholder-[#687080] focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search query"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9aa2b1] hover:bg-white/5 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-[#9aa2b1] hover:text-white"
              >
                Esc
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[65vh] overflow-y-auto p-3 sm:p-4">
              {!query.trim() && (
                <div>
                  <div className="mb-2 flex items-center justify-between px-2">
                    <span className="text-xs font-medium text-[#9aa2b1]">
                      Recent Searches
                    </span>
                    {searchHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={clearSearchTerms}
                        className="text-xs text-[#687080] transition-colors hover:text-[#E5383B]"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {searchHistory.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-[#687080]">
                      Type an anime title to search across the AniList catalog.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {searchHistory.map((term) => (
                        <li
                          key={term}
                          className="flex items-center justify-between rounded-xl px-2 py-1.5 hover:bg-white/[0.04]"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setQuery(term);
                              handleSubmitFullSearch(term);
                            }}
                            className="flex flex-1 items-center gap-3 text-left text-sm text-[#F4F5F7]"
                          >
                            <Clock className="h-4 w-4 text-[#687080]" aria-hidden="true" />
                            <span>{term}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSearchTerm(term)}
                            aria-label={`Remove ${term} from recent searches`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#687080] hover:text-white"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {query.trim() && loading && (
                <div className="space-y-2.5 p-2">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="flex items-center gap-3">
                      <div className="h-14 w-10 rounded-lg skeleton-shimmer" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-2/3 rounded skeleton-shimmer" />
                        <div className="h-3 w-1/3 rounded skeleton-shimmer" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {query.trim() && !loading && error && (
                <p className="p-4 text-center text-sm text-[#E5383B]">{error}</p>
              )}

              {query.trim() && !loading && !error && results.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-[#9aa2b1]">
                    No anime matched &ldquo;{query}&rdquo;.
                  </p>
                </div>
              )}

              {query.trim() && !loading && results.length > 0 && (
                <div className="space-y-1">
                  {results.map((anime, idx) => {
                    const title = getDisplayTitle(anime);
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={anime.id}
                        type="button"
                        onClick={() => handleSelectAnime(anime)}
                        className={`flex w-full items-center gap-3.5 rounded-xl p-2 text-left transition-colors ${
                          isActive ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'
                        }`}
                      >
                        <ImageWithFallback
                          src={anime.coverImage.medium || anime.coverImage.large}
                          alt={title}
                          className="h-16 w-11 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-display text-sm font-semibold text-white">
                            {title}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-[#9aa2b1]">
                            {[
                              formatFormatLabel(anime.format),
                              anime.seasonYear,
                              anime.episodes ? `${anime.episodes} ep` : null,
                              anime.averageScore
                                ? `${(anime.averageScore / 10).toFixed(1)} score`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-[#687080]" aria-hidden="true" />
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => handleSubmitFullSearch()}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.07]"
                  >
                    <span>View all results for &ldquo;{query.trim()}&rdquo;</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
