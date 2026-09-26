export type MediaKind = 'ANIME' | 'MANGA';
export type MediaTitleLanguage = 'AUTO' | 'PORTUGUESE' | 'ENGLISH' | 'ROMAJI' | 'NATIVE';
export type LibraryStatus = 'PLANNING' | 'CURRENT' | 'COMPLETED' | 'PAUSED' | 'DROPPED';

export interface CrunchyrollBridgeDiagnostics {
  providerId?: string;
  active: boolean;
  startedAt?: string;
  jsonResponsesSeen: number;
  lastRequestUrl?: string;
  lastRequestAt?: string;
  lastEpisodeId?: string;
  lastEpisodeNumber?: number;
  lastEpisodeAt?: string;
}

export interface EpisodeNavigationState {
  providerId: string;
  previousEpisodeId?: string;
  episodeProviderId: string;
  canonicalUrl: string;
  detectedAt: string;
}

export interface ExtensionSettings {
  autoSync: boolean;
  showToast: boolean;
  toastDurationSeconds: number;
  quickPlusStartsCurrent: boolean;
}

export interface DetectedMedia {
  providerId: string;
  providerMediaId?: string;
  providerEpisodeId?: string;
  providerSeasonId?: string;
  providerSeasonSlug?: string;
  providerSeasonNumber?: number;
  providerSeriesId?: string;
  kind: MediaKind;
  title: string;
  episode?: number;
  chapter?: number;
  episodeTitle?: string;
  seasonTitle?: string;
  progressPercent?: number;
  canonicalUrl: string;
  externalIds?: Partial<Record<'ANILIST' | 'MAL', string>>;
}

export interface CurrentResolution {
  media: DetectedMedia;
  result: ResolveResult;
  resolvedAt: string;
}

export interface ResolveResult {
  matched: boolean;
  mediaId?: number;
  action: string;
  previousProgress: number;
  newProgress: number;
  confidence: number;
  requiresConfirmation: boolean;
  reason?: string;
  candidates?: number[];
  duplicate?: boolean;
}

export interface CatalogSearchItem {
  id: number;
  slug: string;
  type: MediaKind;
  format: string;
  title: {
    romaji?: string | null;
    english?: string | null;
    portuguese?: string | null;
  };
  coverImage?: string | null;
  averageScore?: number | null;
  popularity: number;
}

export interface CatalogSearchResponse {
  items: CatalogSearchItem[];
}

export interface BranilistProfile {
  id: number;
  username: string;
  displayName: string;
  titleLanguage: MediaTitleLanguage;
  localeCode: string;
  scopes: string[];
}

export interface LibraryMedia {
  id: number;
  slug: string;
  type: MediaKind;
  format: string;
  title: {
    romaji?: string | null;
    english?: string | null;
    portuguese?: string | null;
    native?: string | null;
  };
  coverImage?: string | null;
  bannerImage?: string | null;
  description?: string | null;
  episodes?: number | null;
  chapters?: number | null;
  averageScore?: number | null;
  popularity: number;
}

export interface LibraryEntry {
  mediaId: number;
  status: LibraryStatus;
  progress: number;
  score?: number | null;
  repeatCount: number;
  updatedAt?: string;
  media: LibraryMedia;
}

export interface LibraryResponse {
  items: LibraryEntry[];
}

export interface LibraryUpdate {
  status: LibraryStatus;
  progress: number;
  score?: number | null;
  repeatCount: number;
}

export interface MediaDetail {
  id: number;
  slug: string;
  type: MediaKind;
  status: string;
  format: string;
  title: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
    portuguese?: string | null;
  };
  description?: string | null;
  coverImage?: string | null;
  bannerImage?: string | null;
  episodes?: number | null;
  chapters?: number | null;
  seasonYear?: number | null;
  averageScore?: number | null;
  popularity: number;
  isAdult: boolean;
}

export interface ProviderInfo {
  id: string;
  mediaType: MediaKind;
  hosts: string[];
}

export interface ProvidersResponse {
  items: ProviderInfo[];
  animeCompletionPercent: number;
}

export interface SyncState {
  retryId?: string;
  status: 'idle' | 'detected' | 'ignored' | 'resolved' | 'confirmation_required' | 'synced' | 'error';
  message?: string;
  media?: DetectedMedia;
  result?: ResolveResult;
  updatedAt: string;
}

export interface TrackerContext {
  url: URL;
  document: Document;
}

export interface TrackerProvider {
  id: string;
  name: string;
  hosts: readonly string[];
  kind: MediaKind | 'BOTH';
  matches(url: URL): boolean;
  detect(ctx: TrackerContext): Promise<DetectedMedia | null>;
  observe?(ctx: TrackerContext, emit: (media: DetectedMedia) => void): () => void;
}

export type ExtensionMessage =
  | { type: 'SYNC_RETRY'; retryId: string }
  | { type: 'TRACKER_DETECTED'; payload: DetectedMedia }
  | { type: 'EPISODE_NAVIGATED'; payload: EpisodeNavigationState }
  | { type: 'BRIDGE_DIAGNOSTIC'; payload: Partial<CrunchyrollBridgeDiagnostics> }
  | { type: 'TRACKER_CLEARED'; payload: { providerId: 'crunchyroll' | 'netflix'; canonicalUrl: string } }
  | { type: 'SAVE_USER_MAPPING'; payload: { media: DetectedMedia; mediaId: number } }
  | { type: 'AUTH_LOGIN' }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_STATUS' }
  | { type: 'SETTINGS_GET' }
  | { type: 'SETTINGS_SET'; payload: ExtensionSettings }
  | { type: 'LIBRARY_GET' }
  | { type: 'LIBRARY_UPDATE'; mediaId: number; payload: LibraryUpdate }
  | { type: 'MEDIA_GET'; mediaId: number }
  | { type: 'SYNC_PROGRESS'; payload: DetectedMedia };
