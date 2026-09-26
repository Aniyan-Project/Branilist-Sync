import { accessToken, refreshAccessToken } from './auth';
import type {
  BranilistProfile,
  DetectedMedia,
  LibraryResponse,
  LibraryUpdate,
  MediaDetail,
  ProvidersResponse,
  ResolveResult,
} from './types';
import type { PendingEvent } from './sync-engine';

const API_BASE = 'https://branilist.com/api/extension/v1';
const PUBLIC_API_BASE = 'https://branilist.com/api/v1';

type EventPayload = {
  provider: string;
  providerMediaId?: string;
  mediaType: string;
  title: string;
  episodeTitle?: string;
  seasonTitle?: string;
  episode?: number;
  chapter?: number;
  progressPercent?: number;
  sourceUrl: string;
  occurredAt?: string;
  externalIds?: Partial<Record<'ANILIST' | 'MAL', string>>;
};

function eventPayload(media: DetectedMedia, occurredAt?: string): EventPayload {
  return {
    provider: media.providerId,
    providerMediaId: media.providerMediaId,
    mediaType: media.kind,
    title: media.title,
    episodeTitle: media.episodeTitle,
    seasonTitle: media.seasonTitle,
    episode: media.episode,
    chapter: media.chapter,
    progressPercent: media.progressPercent,
    sourceUrl: media.canonicalUrl,
    occurredAt,
    externalIds: media.externalIds,
  };
}

async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${token}`);
    return fetch(`${API_BASE}${path}`, { ...init, headers, signal: AbortSignal.timeout(15000), redirect: 'error' });
  };

  const token = await accessToken();
  if (!token) throw new Error('Conta Branilist não vinculada');

  let response = await send(token);
  if (response.status === 401) {
    const refreshed = await refreshAccessToken(true);
    if (!refreshed) throw new Error('Sessão Branilist expirada');
    response = await send(refreshed);
  }
  return response;
}

async function jsonResponse<T>(response: Response, context: string): Promise<T> {
  if (!response.ok) {
    let detail = '';
    try {
      const payload = (await response.json()) as { error?: string; error_description?: string };
      detail = payload.error_description ?? payload.error ?? '';
    } catch {
      // Resposta sem JSON: status HTTP já é suficiente para diagnóstico.
    }
    throw new Error(`${context}: HTTP ${response.status}${detail ? ` — ${detail}` : ''}`);
  }
  return (await response.json()) as T;
}

export async function getMe(): Promise<BranilistProfile> {
  return jsonResponse<BranilistProfile>(await authorizedFetch('/me'), 'Perfil Branilist');
}

export async function getLibrary(): Promise<LibraryResponse> {
  return jsonResponse<LibraryResponse>(
    await authorizedFetch('/library'),
    'Lista Branilist',
  );
}

export async function updateLibrary(mediaId: number, payload: LibraryUpdate): Promise<void> {
  const response = await authorizedFetch(`/library/${mediaId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  await jsonResponse<{ ok: boolean; mediaId: number }>(response, 'Atualização da lista');
}

export async function getMediaDetail(mediaId: number): Promise<MediaDetail> {
  const response = await fetch(`${PUBLIC_API_BASE}/media/${mediaId}`, {
    method: 'GET',
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  return jsonResponse<MediaDetail>(response, 'Detalhes da mídia');
}

export async function getProviders(): Promise<ProvidersResponse> {
  return jsonResponse<ProvidersResponse>(
    await authorizedFetch('/providers'),
    'Providers Branilist Sync',
  );
}

export async function saveUserMapping(media: DetectedMedia, mediaId: number): Promise<void> {
  if (!media.providerMediaId) throw new Error('Identidade do provider ausente');

  const response = await authorizedFetch('/mappings/user', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      provider: media.providerId,
      providerMediaId: media.providerMediaId,
      mediaType: media.kind,
      mediaId,
    }),
  });
  await jsonResponse<{ ok: boolean; mediaId: number }>(response, 'Correção de correspondência');
}

export async function resolveMedia(media: DetectedMedia): Promise<ResolveResult> {
  const response = await authorizedFetch('/resolve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(eventPayload(media)),
  });
  return jsonResponse<ResolveResult>(response, 'Resolução da mídia');
}

export async function syncProgress(event: PendingEvent): Promise<ResolveResult> {
  const { media, occurredAt } = event;
  const payload = eventPayload(media, occurredAt);
  const idempotencyKey = `branilist-sync-v1-${event.id}`;

  const response = await authorizedFetch('/tracking/events', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  return jsonResponse<ResolveResult>(response, 'Tracking Branilist');
}
