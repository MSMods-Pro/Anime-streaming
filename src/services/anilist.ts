import type {
  AnimeDetail,
  AnimeSummary,
  DiscoverFilters,
  DiscoverPageResult,
  HomeCatalog,
} from '../types/anilist';
import { getCurrentAnimeSeason } from '../utils/format';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

const MEDIA_SUMMARY_FIELDS = `
  id
  idMal
  title {
    romaji
    english
    native
  }
  coverImage {
    extraLarge
    large
    medium
    color
  }
  bannerImage
  format
  status
  season
  seasonYear
  episodes
  duration
  genres
  averageScore
  popularity
  trending
  description(asHtml: false)
  isAdult
  nextAiringEpisode {
    airingAt
    timeUntilAiring
    episode
  }
  startDate {
    year
    month
    day
  }
`;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

async function queryAniList<T>(
  query: string,
  variables: Record<string, unknown> = {},
  signal?: AbortSignal,
  retries = 1
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);

  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const response = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    if (response.status === 429 && retries > 0) {
      const retryAfter = Number(response.headers.get('Retry-After')) || 2;
      await new Promise((r) => setTimeout(r, Math.min(retryAfter * 1000, 4000)));
      return queryAniList<T>(query, variables, signal, retries - 1);
    }

    if (!response.ok) {
      throw new Error(`AniList API responded with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: T;
      errors?: Array<{ message: string }>;
    };

    if (payload.errors?.length) {
      throw new Error(payload.errors[0].message || 'AniList GraphQL error');
    }

    if (!payload.data) {
      throw new Error('AniList returned empty response');
    }

    return payload.data;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function getHomeCatalog(signal?: AbortSignal): Promise<HomeCatalog> {
  const cacheKey = 'home_catalog_v1';
  const cached = getCached<HomeCatalog>(cacheKey);
  if (cached) return cached;

  const { season, year, label } = getCurrentAnimeSeason();

  const query = `
    query HomeCatalog($season: MediaSeason, $seasonYear: Int) {
      trending: Page(page: 1, perPage: 12) {
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
          ${MEDIA_SUMMARY_FIELDS}
        }
      }
      popular: Page(page: 1, perPage: 12) {
        media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_SUMMARY_FIELDS}
        }
      }
      seasonal: Page(page: 1, perPage: 12) {
        media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_SUMMARY_FIELDS}
        }
      }
      latestReleases: Page(page: 1, perPage: 12) {
        media(type: ANIME, status: RELEASING, sort: START_DATE_DESC, format_in: [TV, ONA], isAdult: false) {
          ${MEDIA_SUMMARY_FIELDS}
        }
      }
      movies: Page(page: 1, perPage: 12) {
        media(type: ANIME, format: MOVIE, sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_SUMMARY_FIELDS}
        }
      }
      recentlyUpdated: Page(page: 1, perPage: 12) {
        media(type: ANIME, status: RELEASING, sort: UPDATED_AT_DESC, isAdult: false) {
          ${MEDIA_SUMMARY_FIELDS}
        }
      }
    }
  `;

  const data = await queryAniList<{
    trending: { media: AnimeSummary[] };
    popular: { media: AnimeSummary[] };
    seasonal: { media: AnimeSummary[] };
    latestReleases: { media: AnimeSummary[] };
    movies: { media: AnimeSummary[] };
    recentlyUpdated: { media: AnimeSummary[] };
  }>(query, { season, seasonYear: year }, signal);

  const result: HomeCatalog = {
    trending: data.trending.media,
    popular: data.popular.media,
    seasonal: data.seasonal.media,
    latestReleases: data.latestReleases.media,
    movies: data.movies.media,
    recentlyUpdated: data.recentlyUpdated.media,
    seasonLabel: label,
  };

  setCached(cacheKey, result, 5 * 60 * 1000);
  return result;
}

export async function discoverAnime(
  filters: DiscoverFilters,
  page = 1,
  perPage = 24,
  signal?: AbortSignal
): Promise<DiscoverPageResult> {
  const cleanVars: Record<string, unknown> = {
    page,
    perPage,
    sort: filters.sort || (filters.search ? 'SEARCH_MATCH' : 'TRENDING_DESC'),
  };

  if (filters.search?.trim()) cleanVars.search = filters.search.trim();
  if (filters.genre && filters.genre !== 'ALL') cleanVars.genre = filters.genre;
  if (filters.year) cleanVars.seasonYear = filters.year;
  if (filters.season) cleanVars.season = filters.season;
  if (filters.format) cleanVars.format = filters.format;
  if (filters.status) cleanVars.status = filters.status;

  const cacheKey = `discover_${JSON.stringify(cleanVars)}`;
  const cached = getCached<DiscoverPageResult>(cacheKey);
  if (cached) return cached;

  const query = `
    query DiscoverAnime(
      $page: Int
      $perPage: Int
      $search: String
      $genre: String
      $seasonYear: Int
      $season: MediaSeason
      $format: MediaFormat
      $status: MediaStatus
      $sort: [MediaSort]
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
          perPage
        }
        media(
          type: ANIME
          isAdult: false
          search: $search
          genre: $genre
          seasonYear: $seasonYear
          season: $season
          format: $format
          status: $status
          sort: $sort
        ) {
          ${MEDIA_SUMMARY_FIELDS}
        }
      }
    }
  `;

  const data = await queryAniList<{ Page: DiscoverPageResult }>(
    query,
    cleanVars,
    signal
  );

  setCached(cacheKey, data.Page, 2 * 60 * 1000);
  return data.Page;
}

export async function searchSuggestions(
  searchText: string,
  signal?: AbortSignal
): Promise<AnimeSummary[]> {
  const trimmed = searchText.trim();
  if (!trimmed) return [];

  const cacheKey = `suggest_${trimmed.toLowerCase()}`;
  const cached = getCached<AnimeSummary[]>(cacheKey);
  if (cached) return cached;

  const query = `
    query SearchSuggestions($search: String) {
      Page(page: 1, perPage: 7) {
        media(type: ANIME, isAdult: false, search: $search, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
          ${MEDIA_SUMMARY_FIELDS}
        }
      }
    }
  `;

  const data = await queryAniList<{ Page: { media: AnimeSummary[] } }>(
    query,
    { search: trimmed },
    signal
  );

  setCached(cacheKey, data.Page.media, 2 * 60 * 1000);
  return data.Page.media;
}

export async function getAnimeDetails(
  id: number,
  signal?: AbortSignal
): Promise<AnimeDetail> {
  const cacheKey = `anime_detail_${id}`;
  const cached = getCached<AnimeDetail>(cacheKey);
  if (cached) return cached;

  const query = `
    query AnimeDetails($id: Int) {
      Media(id: $id, type: ANIME) {
        ${MEDIA_SUMMARY_FIELDS}
        synonyms
        countryOfOrigin
        source
        hashtag
        trailer {
          id
          site
          thumbnail
        }
        studios(isMain: true) {
          edges {
            isMain
            node {
              id
              name
              isAnimationStudio
            }
          }
        }
        relations {
          edges {
            relationType(version: 2)
            node {
              ${MEDIA_SUMMARY_FIELDS}
            }
          }
        }
        recommendations(page: 1, perPage: 10, sort: [RATING_DESC, ID]) {
          nodes {
            rating
            mediaRecommendation {
              ${MEDIA_SUMMARY_FIELDS}
            }
          }
        }
      }
    }
  `;

  const data = await queryAniList<{ Media: AnimeDetail }>(query, { id }, signal);
  setCached(cacheKey, data.Media, 10 * 60 * 1000);
  return data.Media;
}

export const ANILIST_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mahou Shoujo',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
] as const;
