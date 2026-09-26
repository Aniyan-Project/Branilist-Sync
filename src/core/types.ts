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
