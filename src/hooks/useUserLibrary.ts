import { useCallback, useEffect, useState } from 'react';
import {
  STORAGE_CHANGE_EVENT,
  addSearchHistory,
  clearAllHistory,
  clearSearchHistory,
  getContinueWatchingList,
  getPlayerPreferences,
  getSearchHistory,
  getWatchHistory,
  getWatchlist,
  removeHistoryEntry,
  removeProgressEntry,
  removeSearchHistoryItem,
  toggleWatchlist,
  updatePlayerPreferences,
} from '../services/storage';
import type {
  PlaybackProgressEntry,
  PlayerPreferences,
  WatchHistoryEntry,
  WatchlistEntry,
} from '../types/user';

export function useUserLibrary() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(() => getWatchlist());
  const [continueWatching, setContinueWatching] = useState<PlaybackProgressEntry[]>(() =>
    getContinueWatchingList()
  );
  const [history, setHistory] = useState<WatchHistoryEntry[]>(() => getWatchHistory());
  const [searchHistory, setSearchHistory] = useState<string[]>(() => getSearchHistory());
  const [prefs, setPrefs] = useState<PlayerPreferences>(() => getPlayerPreferences());

  const refresh = useCallback(() => {
    setWatchlist(getWatchlist());
    setContinueWatching(getContinueWatchingList());
    setHistory(getWatchHistory());
    setSearchHistory(getSearchHistory());
    setPrefs(getPlayerPreferences());
  }, []);

  useEffect(() => {
    const onCustom = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('anivexa_')) refresh();
    };
    window.addEventListener(STORAGE_CHANGE_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(STORAGE_CHANGE_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  const isSaved = useCallback(
    (animeId: number) => watchlist.some((item) => item.animeId === animeId),
    [watchlist]
  );

  const handleToggleWatchlist = useCallback(
    (entry: Omit<WatchlistEntry, 'addedAt'>) => toggleWatchlist(entry),
    []
  );

  return {
    watchlist,
    continueWatching,
    history,
    searchHistory,
    prefs,
    isSaved,
    toggleWatchlist: handleToggleWatchlist,
    removeProgress: removeProgressEntry,
    removeHistory: removeHistoryEntry,
    clearHistory: clearAllHistory,
    addSearchTerm: addSearchHistory,
    removeSearchTerm: removeSearchHistoryItem,
    clearSearchTerms: clearSearchHistory,
    updatePrefs: updatePlayerPreferences,
  };
}
