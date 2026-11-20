import type { AnimeSummary, MediaFormat, MediaSeason, MediaStatus } from '../types/anilist';

export function getDisplayTitle(anime: Pick<AnimeSummary, 'title'>): string {
  return (
    anime.title.english ||
    anime.title.romaji ||
    anime.title.native ||
    'Untitled Anime'
  );
}

export function getSecondaryTitle(anime: Pick<AnimeSummary, 'title'>): string | null {
  const main = getDisplayTitle(anime);
  if (anime.title.romaji && anime.title.romaji !== main) return anime.title.romaji;
  if (anime.title.native && anime.title.native !== main) return anime.title.native;
  return null;
}

export function stripHtml(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatFormatLabel(format?: MediaFormat | null): string {
  switch (format) {
    case 'TV':
      return 'TV Series';
    case 'TV_SHORT':
      return 'TV Short';
    case 'MOVIE':
      return 'Movie';
    case 'SPECIAL':
      return 'Special';
    case 'OVA':
      return 'OVA';
    case 'ONA':
      return 'ONA';
    case 'MUSIC':
      return 'Music';
    default:
      return 'Anime';
  }
}

export function formatStatusLabel(status?: MediaStatus | null): string {
  switch (status) {
    case 'FINISHED':
      return 'Completed';
    case 'RELEASING':
      return 'Airing';
    case 'NOT_YET_RELEASED':
      return 'Upcoming';
    case 'CANCELLED':
      return 'Cancelled';
    case 'HIATUS':
      return 'On Hiatus';
    default:
      return 'Unknown';
  }
}

export function formatSeasonLabel(season?: MediaSeason | null, year?: number | null): string {
  if (!season && !year) return '';
  const s = season ? season.charAt(0) + season.slice(1).toLowerCase() : '';
  return [s, year].filter(Boolean).join(' ');
}

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function getCurrentAnimeSeason(): { season: MediaSeason; year: number; label: string } {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  let season: MediaSeason = 'WINTER';
  if (month >= 4 && month <= 6) season = 'SPRING';
  else if (month >= 7 && month <= 9) season = 'SUMMER';
  else if (month >= 10 && month <= 12) season = 'FALL';

  return {
    season,
    year,
    label: `${season.charAt(0) + season.slice(1).toLowerCase()} ${year}`,
  };
}
