import type { MediaFormat } from './anilist';
import type { AudioType, ProviderName } from './anivexa';

export interface WatchlistEntry {
  animeId: number;
  title: string;
  coverImage: string;
  format?: MediaFormat | null;
  seasonYear?: number | null;
  episodes?: number | null;
  averageScore?: number | null;
  addedAt: number;
}

export interface PlaybackProgressEntry {
  animeId: number;
  animeTitle: string;
  coverImage: string;
  bannerImage?: string | null;
  episodeNumber: number;
  episodeTitle?: string | null;
  episodeImage?: string | null;
  provider: ProviderName;
  audio: AudioType;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: number;
}

export interface WatchHistoryEntry {
  id: string; // `${animeId}:${episodeNumber}`
  animeId: number;
  animeTitle: string;
  coverImage: string;
  episodeNumber: number;
  episodeTitle?: string | null;
  episodeImage?: string | null;
  provider: ProviderName;
  audio: AudioType;
  position: number;
  duration: number;
  watchedAt: number;
}

export interface PlayerPreferences {
  preferredAudio: AudioType;
  seekSeconds: number;
  autoNext: boolean;
  playbackSpeed: number;
  volume: number;
  muted: boolean;
  subtitleSize: 'sm' | 'md' | 'lg';
}
