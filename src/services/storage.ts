import type {
  PlaybackProgressEntry,
  PlayerPreferences,
  WatchHistoryEntry,
  WatchlistEntry,
} from '../types/user';

const KEYS = {
  WATCHLIST: 'anivexa_watchlist_v1',
  PROGRESS: 'anivexa_progress_v1',
  HISTORY: 'anivexa_history_v1',
  SEARCH: 'anivexa_search_history_v1',
  PREFS: 'anivexa_player_prefs_v1',
} as const;

export const STORAGE_CHANGE_EVENT = 'anivexa:storage-change';

function emitChange() {
  window.dispatchEvent(new CustomEvent(STORAGE_CHANGE_EVENT));
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    emitChange();
  } catch {
    // Storage quota exceeded or unavailable
  }
}

// Watchlist
export function getWatchlist(): WatchlistEntry[] {
  return readJson<WatchlistEntry[]>(KEYS.WATCHLIST, []).sort(
    (a, b) => b.addedAt - a.addedAt
  );
}

export function isInWatchlist(animeId: number): boolean {
  return getWatchlist().some((item) => item.animeId === animeId);
}

export function addToWatchlist(entry: Omit<WatchlistEntry, 'addedAt'>): void {
  const list = getWatchlist();
  if (list.some((item) => item.animeId === entry.animeId)) return;
  writeJson(KEYS.WATCHLIST, [{ ...entry, addedAt: Date.now() }, ...list]);
}

export function removeFromWatchlist(animeId: number): void {
  const list = getWatchlist().filter((item) => item.animeId !== animeId);
  writeJson(KEYS.WATCHLIST, list);
}

export function toggleWatchlist(entry: Omit<WatchlistEntry, 'addedAt'>): boolean {
  if (isInWatchlist(entry.animeId)) {
    removeFromWatchlist(entry.animeId);
    return false;
  }
  addToWatchlist(entry);
  return true;
}

// Playback Progress & Continue Watching
export function getAllProgress(): PlaybackProgressEntry[] {
  return readJson<PlaybackProgressEntry[]>(KEYS.PROGRESS, []).sort(
    (a, b) => b.updatedAt - a.updatedAt
  );
}

export function getContinueWatchingList(): PlaybackProgressEntry[] {
  return getAllProgress().filter(
    (entry) => !entry.completed && entry.position >= 5
  );
}

export function getAnimeProgress(animeId: number): PlaybackProgressEntry | null {
  return getAllProgress().find((entry) => entry.animeId === animeId) ?? null;
}

export function isEpisodeCompleted(position: number, duration: number): boolean {
  if (!Number.isFinite(duration) || duration <= 0) return false;
  // Require at least 90% watched OR within last 75 seconds of a full-length episode
  const ratio = position / duration;
  return ratio >= 0.9 || (duration > 180 && duration - position <= 75);
}

export function savePlaybackProgress(
  payload: Omit<PlaybackProgressEntry, 'completed' | 'updatedAt'>
): void {
  if (!Number.isFinite(payload.position) || payload.position < 3) return;
  const completed = isEpisodeCompleted(payload.position, payload.duration);
  const now = Date.now();

  const existing = getAllProgress().filter((e) => e.animeId !== payload.animeId);
  const next: PlaybackProgressEntry = {
    ...payload,
    completed,
    updatedAt: now,
  };
  writeJson(KEYS.PROGRESS, [next, ...existing].slice(0, 80));
}

export function removeProgressEntry(animeId: number): void {
  const next = getAllProgress().filter((e) => e.animeId !== animeId);
  writeJson(KEYS.PROGRESS, next);
}

// Watch History
export function getWatchHistory(): WatchHistoryEntry[] {
  return readJson<WatchHistoryEntry[]>(KEYS.HISTORY, []).sort(
    (a, b) => b.watchedAt - a.watchedAt
  );
}

export function recordWatchHistory(
  payload: Omit<WatchHistoryEntry, 'id' | 'watchedAt'>
): void {
  const id = `${payload.animeId}:${payload.episodeNumber}`;
  const existing = getWatchHistory().filter((item) => item.id !== id);
  const next: WatchHistoryEntry = {
    ...payload,
    id,
    watchedAt: Date.now(),
  };
  writeJson(KEYS.HISTORY, [next, ...existing].slice(0, 150));
}

export function removeHistoryEntry(id: string): void {
  const next = getWatchHistory().filter((item) => item.id !== id);
  writeJson(KEYS.HISTORY, next);
}

export function clearAllHistory(): void {
  writeJson(KEYS.HISTORY, []);
  writeJson(KEYS.PROGRESS, []);
}

// Search History
export function getSearchHistory(): string[] {
  return readJson<string[]>(KEYS.SEARCH, []);
}

export function addSearchHistory(term: string): void {
  const clean = term.trim();
  if (!clean) return;
  const next = [clean, ...getSearchHistory().filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(0, 10);
  writeJson(KEYS.SEARCH, next);
}

export function removeSearchHistoryItem(term: string): void {
  const next = getSearchHistory().filter((t) => t !== term);
  writeJson(KEYS.SEARCH, next);
}

export function clearSearchHistory(): void {
  writeJson(KEYS.SEARCH, []);
}

// Player Preferences
const DEFAULT_PREFS: PlayerPreferences = {
  preferredAudio: 'sub',
  seekSeconds: 10,
  autoNext: true,
  playbackSpeed: 1,
  volume: 1,
  muted: false,
  subtitleSize: 'md',
};

export function getPlayerPreferences(): PlayerPreferences {
  return { ...DEFAULT_PREFS, ...readJson<Partial<PlayerPreferences>>(KEYS.PREFS, {}) };
}

export function updatePlayerPreferences(patch: Partial<PlayerPreferences>): PlayerPreferences {
  const updated = { ...getPlayerPreferences(), ...patch };
  writeJson(KEYS.PREFS, updated);
  return updated;
}
