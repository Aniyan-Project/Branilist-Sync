export type MediaKind = 'ANIME' | 'MANGA';

export interface DetectedMedia {
  providerId: string;
  providerMediaId?: string;
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

export interface BranilistProfile {
  id: number;
  username: string;
  displayName: string;
  scopes: string[];
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
  | { type: 'TRACKER_DETECTED'; payload: DetectedMedia }
  | { type: 'AUTH_LOGIN' }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_STATUS' }
  | { type: 'SYNC_PROGRESS'; payload: DetectedMedia };
