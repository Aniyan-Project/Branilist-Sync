import { accessToken, refreshAccessToken } from './auth';
import type {
  BranilistProfile,
  DetectedMedia,
  ProvidersResponse,
  ResolveResult,
} from './types';
import { stableEventKey } from './tracking';

const API_BASE = 'https://branilist.com/api/extension/v1';

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
    return fetch(`${API_BASE}${path}`, { ...init, headers });
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

export async function getProviders(): Promise<ProvidersResponse> {
  return jsonResponse<ProvidersResponse>(
    await authorizedFetch('/providers'),
    'Providers Branilist Sync',
  );
}

export async function resolveMedia(media: DetectedMedia): Promise<ResolveResult> {
  const response = await authorizedFetch('/resolve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(eventPayload(media)),
  });
  return jsonResponse<ResolveResult>(response, 'Resolução da mídia');
}

export async function syncProgress(media: DetectedMedia): Promise<ResolveResult> {
  const occurredAt = new Date().toISOString();
  const payload = eventPayload(media, occurredAt);
  const idempotencyKey = stableEventKey(media, occurredAt);

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
