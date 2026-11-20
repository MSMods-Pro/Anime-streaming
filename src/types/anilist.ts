export type MediaFormat =
  | 'TV'
  | 'TV_SHORT'
  | 'MOVIE'
  | 'SPECIAL'
  | 'OVA'
  | 'ONA'
  | 'MUSIC';

export type MediaStatus =
  | 'FINISHED'
  | 'RELEASING'
  | 'NOT_YET_RELEASED'
  | 'CANCELLED'
  | 'HIATUS';

export type MediaSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

export interface MediaTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
}

export interface MediaCoverImage {
  extraLarge?: string | null;
  large?: string | null;
  medium?: string | null;
  color?: string | null;
}

export interface FuzzyDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

export interface NextAiringEpisode {
  airingAt: number;
  timeUntilAiring: number;
  episode: number;
}

export interface MediaTrailer {
  id?: string | null;
  site?: string | null;
  thumbnail?: string | null;
}

export interface StudioNode {
  id: number;
  name: string;
  isAnimationStudio: boolean;
}

export interface AnimeSummary {
  id: number;
  idMal?: number | null;
  title: MediaTitle;
  coverImage: MediaCoverImage;
  bannerImage?: string | null;
  format?: MediaFormat | null;
  status?: MediaStatus | null;
  season?: MediaSeason | null;
  seasonYear?: number | null;
  episodes?: number | null;
  duration?: number | null;
  genres?: string[];
  averageScore?: number | null;
  popularity?: number | null;
  trending?: number | null;
  description?: string | null;
  isAdult?: boolean;
  nextAiringEpisode?: NextAiringEpisode | null;
  startDate?: FuzzyDate | null;
}

export interface AnimeRelationEdge {
  relationType?: string | null;
  node: AnimeSummary;
}

export interface AnimeRecommendationNode {
  rating?: number | null;
  mediaRecommendation?: AnimeSummary | null;
}

export interface AnimeDetail extends AnimeSummary {
  synonyms?: string[];
  countryOfOrigin?: string | null;
  source?: string | null;
  hashtag?: string | null;
  trailer?: MediaTrailer | null;
  studios?: {
    edges: Array<{
      isMain: boolean;
      node: StudioNode;
    }>;
  } | null;
  relations?: {
    edges: AnimeRelationEdge[];
  } | null;
  recommendations?: {
    nodes: AnimeRecommendationNode[];
  } | null;
}

export interface HomeCatalog {
  trending: AnimeSummary[];
  popular: AnimeSummary[];
  seasonal: AnimeSummary[];
  latestReleases: AnimeSummary[];
  movies: AnimeSummary[];
  recentlyUpdated: AnimeSummary[];
  seasonLabel: string;
}

export type DiscoverSort =
  | 'TRENDING_DESC'
  | 'POPULARITY_DESC'
  | 'SCORE_DESC'
  | 'START_DATE_DESC'
  | 'UPDATED_AT_DESC';

export interface DiscoverFilters {
  search?: string;
  genre?: string;
  year?: number;
  season?: MediaSeason;
  format?: MediaFormat;
  status?: MediaStatus;
  sort?: DiscoverSort;
}

export interface PageInfo {
  total?: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
  perPage: number;
}

export interface DiscoverPageResult {
  pageInfo: PageInfo;
  media: AnimeSummary[];
}
