import {
  ALL_PROVIDERS,
  type AnimeMappings,
  type AudioType,
  type MapResponse,
  type NormalizedEpisodesResult,
  type NormalizedStream,
  type NormalizedSubtitle,
  type NormalizedWatchData,
  type ProviderEpisodesData,
  type ProviderName,
  type RawEpisodeItem,
  type RawEpisodesResponse,
  type RawProviderEpisodesBlock,
  type RawStreamItem,
  type RawSubtitleTrack,
  type RawWatchResponse,
} from '../types/anivexa';

const ANIVEXA_BASE_URL = 'https://anivexa-api-zeta-blue.vercel.app';

// Provider priority ordered by verified direct custom-player compatibility
const PROVIDER_PRIORITY: ProviderName[] = [
  'anikoto',
  'kaa',
  'animegg',
  'reanime',
  'aniwaves',
  'anizone',
  'mkissa',
  'animenosub',
  'animeonsen',
  'anipm',
  'senshi',
  'animedunya',
];

export const PROVIDER_LABELS: Record<ProviderName, string> = {
  anikoto: 'Anikoto',
  kaa: 'KickAssAnime',
  animegg: 'AnimeGG',
  reanime: 'ReAnime',
  aniwaves: 'AniWaves',
  anizone: 'AniZone',
  mkissa: 'MKissa',
  animenosub: 'AnimeNoSub',
  animeonsen: 'AnimeOnsen',
  anipm: 'Ani.pm',
  senshi: 'Senshi',
  animedunya: 'AnimeDunya',
};

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const apiCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const hit = apiCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    apiCache.delete(key);
    return null;
  }
  return hit.data as T;
}

function setCached<T>(key: string, data: T, ttlMs: number): void {
  apiCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

async function fetchAnivexaJson<T>(
  path: string,
  signal?: AbortSignal,
  timeoutMs = 22000
): Promise<T> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const res = await fetch(`${ANIVEXA_BASE_URL}${cleanPath}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Anivexa API returned HTTP ${res.status} for ${cleanPath}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function getAnimeMapping(
  anilistId: number,
  signal?: AbortSignal
): Promise<AnimeMappings | null> {
  const key = `map_${anilistId}`;
  const cached = getCached<AnimeMappings | null>(key);
  if (cached !== null) return cached;

  try {
    const data = await fetchAnivexaJson<MapResponse>(`/map/${anilistId}`, signal, 12000);
    const mappings = data.mappings ?? null;
    setCached(key, mappings, 15 * 60 * 1000);
    return mappings;
  } catch {
    return null;
  }
}

function sanitizeEpisodesArray(items: unknown, audio: AudioType): RawEpisodeItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((ep): ep is RawEpisodeItem => Boolean(ep && typeof ep === 'object' && 'id' in ep))
    .map((ep) => ({
      ...ep,
      audio: ep.audio || audio,
      number: Number(ep.number),
    }))
    .filter((ep) => Number.isFinite(ep.number) && typeof ep.id === 'string' && ep.id.length > 0)
    .sort((a, b) => a.number - b.number);
}

export async function getAnimeEpisodes(
  anilistId: number,
  signal?: AbortSignal
): Promise<NormalizedEpisodesResult> {
  const key = `episodes_${anilistId}`;
  const cached = getCached<NormalizedEpisodesResult>(key);
  if (cached) return cached;

  const raw = await fetchAnivexaJson<RawEpisodesResponse>(`/episodes/${anilistId}`, signal, 25000);

  const availableProviders: ProviderEpisodesData[] = [];
  const unavailableProviders: Array<{ provider: ProviderName; reason: string }> = [];

  for (const provider of PROVIDER_PRIORITY) {
    const block = raw[provider] as RawProviderEpisodesBlock | undefined;
    if (!block || typeof block !== 'object') {
      unavailableProviders.push({ provider, reason: 'No data returned' });
      continue;
    }

    if (block.error) {
      unavailableProviders.push({ provider, reason: String(block.error) });
      continue;
    }

    const sub = sanitizeEpisodesArray(block.episodes?.sub, 'sub');
    const dub = sanitizeEpisodesArray(block.episodes?.dub, 'dub');

    if (sub.length === 0 && dub.length === 0) {
      unavailableProviders.push({ provider, reason: 'No episodes available' });
      continue;
    }

    const metaTitle =
      typeof block.meta?.title === 'string' ? block.meta.title : undefined;

    availableProviders.push({
      provider,
      metaTitle,
      sub,
      dub,
    });
  }

  // Also include any unknown provider keys if API adds one in the future
  for (const [keyName, value] of Object.entries(raw)) {
    if (
      keyName === 'page' ||
      keyName === 'type' ||
      keyName === 'mappings' ||
      (ALL_PROVIDERS as readonly string[]).includes(keyName)
    ) {
      continue;
    }
    const block = value as RawProviderEpisodesBlock | undefined;
    if (block && typeof block === 'object' && !block.error && block.episodes) {
      const sub = sanitizeEpisodesArray(block.episodes.sub, 'sub');
      const dub = sanitizeEpisodesArray(block.episodes.dub, 'dub');
      if (sub.length > 0 || dub.length > 0) {
        availableProviders.push({
          provider: keyName as ProviderName,
          sub,
          dub,
        });
      }
    }
  }

  const normalized: NormalizedEpisodesResult = {
    mappings: raw.mappings ?? null,
    availableProviders,
    unavailableProviders,
  };

  setCached(key, normalized, 5 * 60 * 1000);
  return normalized;
}

export function buildProxyMediaUrl(
  targetUrl: string,
  referer?: string,
  subFormat?: 'vtt' | 'srt' | 'ass'
): string {
  const params = new URLSearchParams({ url: targetUrl });
  if (referer) params.set('referer', referer);
  if (subFormat) params.set('subFormat', subFormat);
  return `/api/proxy?${params.toString()}`;
}

function normalizeSubtitleFormat(sub: RawSubtitleTrack): 'vtt' | 'srt' | 'ass' | null {
  const fmt = (sub.format || '').toLowerCase();
  const lowerUrl = sub.url.toLowerCase();
  // .sup (PGS bitmap) cannot be rendered natively as WebVTT text
  if (fmt === 'sup' || lowerUrl.endsWith('.sup')) return null;
  if (fmt === 'srt' || lowerUrl.endsWith('.srt')) return 'srt';
  if (fmt === 'ass' || fmt === 'ssa' || lowerUrl.endsWith('.ass') || lowerUrl.endsWith('.ssa')) {
    return 'ass';
  }
  return 'vtt';
}

function normalizeSubtitles(
  tracks: RawSubtitleTrack[] | undefined,
  referer?: string
): NormalizedSubtitle[] {
  if (!Array.isArray(tracks)) return [];
  const seen = new Set<string>();
  const out: NormalizedSubtitle[] = [];

  tracks.forEach((t, idx) => {
    if (!t?.url || seen.has(t.url)) return;
    const fmt = normalizeSubtitleFormat(t);
    if (!fmt) return;
    seen.add(t.url);
    const label = (t.label || t.language || t.srclang || `Track ${idx + 1}`).trim();
    const lang = (t.srclang || label.slice(0, 2) || 'en').toLowerCase();
    out.push({
      id: `sub-${idx}-${lang}`,
      label,
      lang,
      rawUrl: t.url,
      proxyUrl: buildProxyMediaUrl(t.url, referer, fmt),
      format: fmt,
      isDefault: Boolean(t.default),
    });
  });

  return out;
}

function resolveReferer(item: RawStreamItem): string | undefined {
  if (item.referer) return item.referer;
  if (item.headers) {
    for (const [k, v] of Object.entries(item.headers)) {
      if (k.toLowerCase() === 'referer' && v) return v;
    }
  }
  return undefined;
}

function detectStreamKind(item: RawStreamItem): 'hls' | 'mp4' | 'embed' {
  const t = (item.type || '').toLowerCase();
  if (t === 'embed' || t === 'iframe') return 'embed';
  if (t === 'mp4') return 'mp4';
  if (t === 'hls' || t === 'm3u8') return 'hls';
  const u = item.url.toLowerCase();
  if (u.includes('.m3u8')) return 'hls';
  if (u.includes('.mp4')) return 'mp4';
  return 'embed';
}

export async function getWatchSources(
  episodeWatchId: string,
  provider: ProviderName,
  audio: AudioType,
  episodeNumber: number,
  signal?: AbortSignal
): Promise<NormalizedWatchData> {
  const cacheKey = `watch_${episodeWatchId}`;
  const cached = getCached<NormalizedWatchData>(cacheKey);
  if (cached) return cached;

  const raw = await fetchAnivexaJson<RawWatchResponse>(episodeWatchId, signal, 20000);
  if (raw.error) {
    throw new Error(raw.error);
  }

  const rawList: RawStreamItem[] = Array.isArray(raw.streams) ? [...raw.streams] : [];
  if (rawList.length === 0 && raw.stream_url) {
    rawList.push({
      url: raw.stream_url,
      type: raw.stream_url.includes('.m3u8') ? 'hls' : 'mp4',
      server: raw.server || 'Primary',
      embed: raw.embed,
      subtitles: raw.subtitles,
    });
  }

  const streams: NormalizedStream[] = [];
  const seenUrls = new Set<string>();

  rawList.forEach((item, idx) => {
    if (!item?.url || seenUrls.has(item.url)) return;
    seenUrls.add(item.url);

    const kind = detectStreamKind(item);
    const referer = resolveReferer(item);
    const hasEncryptionKey = Boolean(item.key || item.playlist_key);
    const embedFallbackUrl = item.embed || item.embedUrl;
    const serverName = item.server || `Server ${idx + 1}`;
    const subtitles = normalizeSubtitles(item.subtitles || raw.subtitles, referer);

    if (kind === 'embed') {
      streams.push({
        id: `${provider}-embed-${idx}`,
        server: serverName,
        kind: 'embed',
        rawUrl: item.url,
        playbackUrl: item.url,
        referer,
        quality: item.quality,
        subtitles: [],
      });
      return;
    }

    // If a stream carries a cipher key (e.g. reanime flixcloud), its m3u8 may be encrypted
    // and unplayable directly without embed fallback — keep embedFallbackUrl attached.
    const playbackUrl = buildProxyMediaUrl(item.url, referer);

    streams.push({
      id: `${provider}-${kind}-${idx}`,
      server: serverName,
      kind,
      rawUrl: item.url,
      playbackUrl,
      embedFallbackUrl,
      referer,
      quality: item.quality,
      hasEncryptionKey,
      subtitles,
    });

    // Also expose embed option separately if the direct stream has an encryption key
    if (hasEncryptionKey && embedFallbackUrl && !seenUrls.has(embedFallbackUrl)) {
      seenUrls.add(embedFallbackUrl);
      streams.push({
        id: `${provider}-embed-fallback-${idx}`,
        server: `${serverName} (Embed)`,
        kind: 'embed',
        rawUrl: embedFallbackUrl,
        playbackUrl: embedFallbackUrl,
        referer,
        subtitles: [],
      });
    }
  });

  // Sort streams so playable direct unencrypted HLS/MP4 come before encrypted/embed streams
  streams.sort((a, b) => {
    const score = (s: NormalizedStream) => {
      if (s.kind === 'hls' && !s.hasEncryptionKey) return 0;
      if (s.kind === 'mp4' && !s.hasEncryptionKey) return 1;
      if (s.kind === 'hls' && s.hasEncryptionKey) return 2;
      return 3;
    };
    return score(a) - score(b);
  });

  const normalized: NormalizedWatchData = {
    provider,
    audio,
    episodeNumber,
    streams,
    intro: raw.intro ?? null,
    outro: raw.outro ?? null,
  };

  setCached(cacheKey, normalized, 3 * 60 * 1000);
  return normalized;
}
