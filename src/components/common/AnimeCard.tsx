import { Link } from 'react-router-dom';
import { Bookmark, Check, Play } from 'lucide-react';
import type { AnimeSummary } from '../../types/anilist';
import { formatFormatLabel, getDisplayTitle } from '../../utils/format';
import { ImageWithFallback } from './ImageWithFallback';
import { useUserLibrary } from '../../hooks/useUserLibrary';

interface AnimeCardProps {
  anime: AnimeSummary;
  variant?: 'poster' | 'landscape';
  subtitleOverride?: string;
  rankIndex?: number;
}

export function AnimeCard({
  anime,
  variant = 'poster',
  subtitleOverride,
  rankIndex,
}: AnimeCardProps) {
  const { isSaved, toggleWatchlist } = useUserLibrary();
  const title = getDisplayTitle(anime);
  const saved = isSaved(anime.id);
  const imageSrc =
    variant === 'landscape'
      ? anime.bannerImage || anime.coverImage.extraLarge || anime.coverImage.large
      : anime.coverImage.extraLarge || anime.coverImage.large || anime.coverImage.medium;

  const metaParts: string[] = [];
  if (anime.format) metaParts.push(formatFormatLabel(anime.format));
  if (anime.seasonYear) metaParts.push(String(anime.seasonYear));
  if (anime.averageScore) metaParts.push(`${(anime.averageScore / 10).toFixed(1)}`);

  const handleWatchlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWatchlist({
      animeId: anime.id,
      title,
      coverImage: anime.coverImage.large || anime.coverImage.extraLarge || '',
      format: anime.format,
      seasonYear: anime.seasonYear,
      episodes: anime.episodes,
      averageScore: anime.averageScore,
    });
  };

  return (
    <Link
      to={`/anime/${anime.id}`}
      className="group relative flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E5383B] rounded-xl"
    >
      <div
        className={`relative w-full overflow-hidden rounded-xl bg-[#11141c] border border-white/[0.07] transition-colors duration-200 group-hover:border-white/20 ${
          variant === 'landscape' ? 'aspect-video' : 'aspect-[2/3]'
        }`}
      >
        <ImageWithFallback
          src={imageSrc}
          alt={title}
          fallbackTitle={title}
          className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
        />

        {/* Subtle bottom scrim for hover affordances */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent opacity-60 transition-opacity duration-200 group-hover:opacity-90"
          aria-hidden="true"
        />

        {typeof rankIndex === 'number' && (
          <div className="pointer-events-none absolute left-3 top-3 font-display text-2xl font-bold leading-none text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] font-mono-tabular">
            {String(rankIndex).padStart(2, '0')}
          </div>
        )}

        {/* Quick Watchlist Toggle */}
        <button
          type="button"
          onClick={handleWatchlistClick}
          aria-label={saved ? `Remove ${title} from Watchlist` : `Add ${title} to Watchlist`}
          title={saved ? 'In Watchlist' : 'Add to Watchlist'}
          className={`absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-150 ${
            saved
              ? 'border-[#E5383B]/60 bg-[#E5383B] text-white opacity-100'
              : 'border-white/15 bg-black/65 text-white/85 opacity-0 backdrop-blur-sm hover:bg-black/85 group-hover:opacity-100 focus-visible:opacity-100'
          }`}
        >
          {saved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>

        {/* Center subtle play indicator on hover */}
        <div
          className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 text-xs font-medium text-white/95 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden="true"
        >
          <Play className="h-3.5 w-3.5 fill-current text-[#E5383B]" />
          <span>View Series</span>
        </div>
      </div>

      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-1 font-display text-[15px] font-semibold tracking-tight text-[#F4F5F7] transition-colors duration-150 group-hover:text-white">
          {title}
        </h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-[#9aa2b1]">
          {subtitleOverride || metaParts.join(' · ') || 'Anime'}
        </p>
      </div>
    </Link>
  );
}
