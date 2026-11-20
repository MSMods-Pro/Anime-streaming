export const ALL_PROVIDERS = [
  'anikoto',
  'kaa',
  'animegg',
  'reanime',
  'aniwaves',
  'mkissa',
  'anizone',
  'animenosub',
  'senshi',
  'animedunya',
  'animeonsen',
  'anipm',
] as const;

export type ProviderName = (typeof ALL_PROVIDERS)[number];

export type AudioType = 'sub' | 'dub';

export interface FranchiseItem {
  relation: string;
  anilistId: number;
  title: string;
  type: string;
  format: string;
}

export interface AnimeMappings {
  id: number;
  title?: string | null;
  type?: string | null;
  format?: string | null;
  episodes?: number | null;
  malId?: number | null;
  aniId?: number | null;
  anidbId?: number | null;
  animePlanetId?: string | null;
  kitsuId?: number | null;
  imdbId?: string | null;
  themoviedbId?: number | null;
  thetvdbId?: number | null;
  synonyms?: string[];
  franchise?: FranchiseItem[];
}

export interface MapResponse {
  mappings?: AnimeMappings | null;
  error?: string;
}

export interface RawEpisodeItem {
  id: string;
  audio?: AudioType;
  number: number;
  sourceNumber?: number | string;
  title?: string | null;
  titleJapanese?: string | null;
  titleRomanji?: string | null;
  description?: string | null;
  image?: string | null;
  airDate?: string | null;
  duration?: number | null;
  filler?: boolean;
  recap?: boolean;
  uncensored?: boolean;
}

export interface RawProviderEpisodesBlock {
  error?: string;
  meta?: Record<string, unknown>;
  episodes?: {
    sub?: RawEpisodeItem[];
    dub?: RawEpisodeItem[];
  };
}

export interface RawEpisodesResponse {
  page?: number;
  type?: string;
  mappings?: AnimeMappings | null;
  [provider: string]: unknown;
}

export interface ProviderEpisodesData {
  provider: ProviderName;
  metaTitle?: string;
  sub: RawEpisodeItem[];
  dub: RawEpisodeItem[];
}

export interface NormalizedEpisodesResult {
  mappings: AnimeMappings | null;
  availableProviders: ProviderEpisodesData[];
  unavailableProviders: Array<{ provider: ProviderName; reason: string }>;
}

export interface RawSubtitleTrack {
  url: string;
  label?: string;
  language?: string;
  srclang?: string;
  format?: string;
  default?: boolean;
  source?: string;
}

export interface RawStreamItem {
  url: string;
  type?: 'hls' | 'mp4' | 'embed' | string;
  server?: string;
  audio?: AudioType;
  quality?: string;
  embed?: string;
  embedUrl?: string;
  referer?: string;
  headers?: Record<string, string>;
  priority?: number;
  isActive?: boolean;
  key?: string;
  playlist_key?: string;
  subtitles?: RawSubtitleTrack[];
}

export interface RawWatchResponse {
  anime?: string;
  anilistId?: number;
  malId?: number;
  episode?: number;
  ep?: number;
  audio?: AudioType;
  server?: string;
  stream_url?: string;
  embed?: string;
  intro?: { start: number; end: number } | null;
  outro?: { start: number; end: number } | null;
  streams?: RawStreamItem[];
  subtitles?: RawSubtitleTrack[];
  error?: string;
}

export interface NormalizedSubtitle {
  id: string;
  label: string;
  lang: string;
  rawUrl: string;
  proxyUrl: string;
  format: 'vtt' | 'srt' | 'ass';
  isDefault: boolean;
}

export interface NormalizedStream {
  id: string;
  server: string;
  kind: 'hls' | 'mp4' | 'embed';
  rawUrl: string;
  playbackUrl: string;
  embedFallbackUrl?: string;
  referer?: string;
  quality?: string;
  hasEncryptionKey?: boolean;
  subtitles: NormalizedSubtitle[];
}

export interface NormalizedWatchData {
  provider: ProviderName;
  audio: AudioType;
  episodeNumber: number;
  streams: NormalizedStream[];
  intro?: { start: number; end: number } | null;
  outro?: { start: number; end: number } | null;
}
