import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Check, ChevronLeft, ChevronRight, Info, Play } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { AnimeSummary } from '../../types/anilist';
import {
  formatFormatLabel,
  getDisplayTitle,
  stripHtml,
} from '../../utils/format';
import { useUserLibrary } from '../../hooks/useUserLibrary';

interface HeroSpotlightProps {
  items: AnimeSummary[];
}

export function HeroSpotlight({ items }: HeroSpotlightProps) {
  const featured = items.filter((i) => i.bannerImage || i.coverImage.extraLarge).slice(0, 5);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const { isSaved, toggleWatchlist } = useUserLibrary();

  useEffect(() => {
    if (featured.length <= 1 || paused) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % featured.length);
    }, 7500);
    return () => clearInterval(timer);
  }, [featured.length, paused]);

  if (featured.length === 0) return null;

  const current = featured[index % featured.length];
  const title = getDisplayTitle(current);
  const synopsis = stripHtml(current.description);
  const saved = isSaved(current.id);
  const backdrop =
    current.bannerImage || current.coverImage.extraLarge || current.coverImage.large || '';

  const metaParts: string[] = [];
  if (current.format) metaParts.push(formatFormatLabel(current.format));
  if (current.seasonYear) metaParts.push(String(current.seasonYear));
  if (current.episodes) metaParts.push(`${current.episodes} Episodes`);
  if (current.averageScore) metaParts.push(`${(current.averageScore / 10).toFixed(1)} Score`);
  if (current.genres?.length) metaParts.push(current.genres.slice(0, 3).join(' / '));

  return (
    <section
      aria-label="Featured anime spotlight"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative min-h-[540px] sm:min-h-[600px] lg:min-h-[680px] w-full overflow-hidden bg-[#08090C]"
    >
      {/* Background Artwork with Cinematic Crossfade */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          <img
            src={backdrop}
            alt={title}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover object-center"
          />
          {/* Measured Multi-Directional Contrast Scrims */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-[#08090C] via-[#08090C]/80 to-[#08090C]/20"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-transparent to-[#08090C]/55"
            aria-hidden="true"
          />
        </motion.div>
      </AnimatePresence>

      {/* Foreground Content */}
      <div className="relative z-10 mx-auto flex min-h-[540px] sm:min-h-[600px] lg:min-h-[680px] max-w-7xl flex-col justify-end px-4 pb-12 pt-24 sm:px-6 lg:px-8 lg:pb-16">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-2xl"
            >
              {/* Unboxed Metadata Line */}
              <p className="text-xs sm:text-sm font-medium text-[#D1D5DB]">
                {metaParts.join(' · ')}
              </p>

              <h1 className="mt-3 font-display text-[clamp(2rem,4.3vw,3.75rem)] font-bold leading-[1.06] tracking-tight text-white [text-wrap:balance]">
                {title}
              </h1>

              {synopsis && (
                <p className="mt-4 line-clamp-3 max-w-xl text-sm sm:text-base leading-relaxed text-[#C4C9D4]">
                  {synopsis}
                </p>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to={`/watch/${current.id}`}
                  className="inline-flex min-h-[44px] items-center gap-2.5 rounded-lg bg-[#E5383B] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#f0484b] whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  <span>Watch Now</span>
                </Link>

                <Link
                  to={`/anime/${current.id}`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/15 bg-white/[0.07] px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/[0.14] whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                  <span>More Info</span>
                </Link>

                <button
                  type="button"
                  onClick={() =>
                    toggleWatchlist({
                      animeId: current.id,
                      title,
                      coverImage:
                        current.coverImage.large || current.coverImage.extraLarge || '',
                      format: current.format,
                      seasonYear: current.seasonYear,
                      episodes: current.episodes,
                      averageScore: current.averageScore,
                    })
                  }
                  aria-label={saved ? 'Remove from Watchlist' : 'Add to Watchlist'}
                  className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border transition-colors ${
                    saved
                      ? 'border-[#E5383B] bg-[#E5383B]/20 text-white'
                      : 'border-white/15 bg-white/[0.07] text-white/90 hover:bg-white/[0.14]'
                  }`}
                >
                  {saved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Featured Slide Controls */}
          {featured.length > 1 && (
            <div className="flex items-center gap-3 self-start lg:self-end">
              <div className="flex items-center gap-1.5" role="tablist" aria-label="Featured slides">
                {featured.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={idx === index}
                    aria-label={`Show ${getDisplayTitle(item)}`}
                    onClick={() => setIndex(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === index ? 'w-8 bg-[#E5383B]' : 'w-2.5 bg-white/30 hover:bg-white/55'
                    }`}
                  />
                ))}
              </div>
              <div className="ml-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setIndex((prev) => (prev - 1 + featured.length) % featured.length)
                  }
                  aria-label="Previous featured anime"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-black/45 text-white transition-colors hover:bg-white/15"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIndex((prev) => (prev + 1) % featured.length)}
                  aria-label="Next featured anime"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-black/45 text-white transition-colors hover:bg-white/15"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
