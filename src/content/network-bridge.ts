import { extractCrunchyrollNetworkEpisodes } from '../providers/crunchyroll/network';
import { netflixTitleLooksAnime } from '../providers/netflix/eligibility';
import { extractNetflixNetworkEpisodes } from '../providers/netflix/network';

type ProviderId = 'crunchyroll' | 'netflix';

const host = location.hostname.toLowerCase();
const provider: ProviderId | null =
  ['www.crunchyroll.com', 'crunchyroll.com'].includes(host)
    ? 'crunchyroll'
    : ['www.netflix.com', 'netflix.com'].includes(host)
      ? 'netflix'
      : null;

const nativeFetch = window.fetch.bind(window);
const netflixEligibility = new Map<string, Promise<boolean>>();
let jsonResponsesSeen = 0;
let netflixProbePending = false;
let lastNetflixProbeAt = 0;
let lastNetflixProbedWatchId = '';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function currentNetflixWatchId(): string | undefined {
  return location.pathname.match(/\/watch\/(\d+)(?:\/|$)/)?.[1];
}

function netflixMemberApiBase(): string | undefined {
  const root = record((window as unknown as { netflix?: unknown }).netflix);
  const reactContext = record(root?.reactContext);
  const models = record(reactContext?.models);
  const services = record(models?.services);
  const data = record(services?.data);
  const memberapi = record(data?.memberapi);
  const hostname = typeof memberapi?.hostname === 'string' ? memberapi.hostname.trim() : '';
  const paths = Array.isArray(memberapi?.path) ? memberapi.path : [];
  const firstPath = typeof paths[0] === 'string' ? paths[0].trim() : '';

  if (!hostname || !firstPath || !/^[a-z0-9.-]+$/i.test(hostname) || !hostname.toLowerCase().endsWith('.netflix.com')) {
    return undefined;
  }
  if (!firstPath.startsWith('/') || firstPath.includes('..')) return undefined;
  return `https://${hostname}${firstPath.replace(/\/$/, '')}`;
}

function eventName(kind: 'episode' | 'diagnostic') {
  return provider ? `branilist-sync:${provider}-network-${kind}` : '';
}

function emitDiagnostic(payload: Record<string, unknown>) {
  if (!provider) return;
  window.dispatchEvent(new CustomEvent(eventName('diagnostic'), {
    detail: JSON.stringify({
      active: true,
      providerId: provider,
      jsonResponsesSeen,
      ...payload,
    }),
  }));
}

function netflixIsAnime(titleId: string): Promise<boolean> {
  const existing = netflixEligibility.get(titleId);
  if (existing) return existing;

  const check = nativeFetch(`https://www.netflix.com/title/${encodeURIComponent(titleId)}`, {
    method: 'GET',
    credentials: 'include',
    redirect: 'follow',
  }).then(async response => {
    if (!response.ok) return false;
    const html = await response.text();
    return netflixTitleLooksAnime(html);
  }).catch(() => false);

  netflixEligibility.set(titleId, check);
  return check;
}

async function emitEpisodes(url: string, payload: unknown) {
  if (!provider) return;
  jsonResponsesSeen += 1;
  const now = new Date().toISOString();

  emitDiagnostic({
    lastRequestUrl: url.slice(0, 1000),
    lastRequestAt: now,
  });

  if (provider === 'crunchyroll') {
    for (const episode of extractCrunchyrollNetworkEpisodes(payload)) {
      emitDiagnostic({
        lastEpisodeId: episode.episodeProviderId,
        lastEpisodeNumber: episode.episode,
        lastEpisodeAt: now,
      });
      window.dispatchEvent(new CustomEvent(eventName('episode'), {
        detail: JSON.stringify(episode),
      }));
    }
    return;
  }

  for (const episode of extractNetflixNetworkEpisodes(payload)) {
    const anime = await netflixIsAnime(episode.titleId);
    emitDiagnostic({
      lastAnimeEligible: anime,
      lastAnimeTitleId: episode.titleId,
    });
    if (!anime) continue;

    emitDiagnostic({
      lastEpisodeId: episode.watchId,
      lastEpisodeNumber: episode.episode,
      lastEpisodeAt: now,
    });

    window.dispatchEvent(new CustomEvent(eventName('episode'), {
      detail: JSON.stringify(episode),
    }));
  }
}

async function probeNetflixMetadata(): Promise<void> {
  if (provider !== 'netflix' || netflixProbePending) return;

  const watchId = currentNetflixWatchId();
  if (!watchId || watchId === lastNetflixProbedWatchId) return;

  const now = Date.now();
  if (now - lastNetflixProbeAt < 2000) return;
  lastNetflixProbeAt = now;

  const base = netflixMemberApiBase();
  if (!base) {
    emitDiagnostic({ metadataProbe: 'waiting_for_context' });
    return;
  }

  netflixProbePending = true;
  const url = `${base}/metadata?movieid=${encodeURIComponent(watchId)}`;

  try {
    const response = await nativeFetch(url, {
      method: 'GET',
      credentials: 'include',
      redirect: 'follow',
    });
    if (!response.ok) {
      emitDiagnostic({ metadataProbe: `http_${response.status}` });
      return;
    }

    const payload = await response.json();
    await emitEpisodes(url, payload);
    lastNetflixProbedWatchId = watchId;
    emitDiagnostic({ metadataProbe: 'ok', metadataProbeWatchId: watchId });
  } catch {
    emitDiagnostic({ metadataProbe: 'failed' });
  } finally {
    netflixProbePending = false;
  }
}

if (provider) emitDiagnostic({ startedAt: new Date().toISOString() });

if (provider === 'netflix') {
  void probeNetflixMetadata();
  window.setInterval(() => void probeNetflixMetadata(), 500);
}

window.fetch = async (...args: Parameters<typeof fetch>) => {
  const response = await nativeFetch(...args);
  try {
    const input = args[0];
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (provider && contentType.includes('json')) {
      void response.clone().json().then(data => emitEpisodes(url, data)).catch(() => undefined);
    }
  } catch {
    // Never interfere with the site's own fetch response.
  }
  return response;
};

const originalOpen = XMLHttpRequest.prototype.open;
const requestUrls = new WeakMap<XMLHttpRequest, string>();

XMLHttpRequest.prototype.open = function (
  method: string,
  url: string | URL,
  ...rest: [boolean?, string?, string?]
) {
  requestUrls.set(this, String(url));
  this.addEventListener('load', () => {
    if (!provider) return;
    const requestUrl = requestUrls.get(this);
    if (!requestUrl) return;

    try {
      if (this.responseType === 'json' && this.response) {
        void emitEpisodes(requestUrl, this.response);
        return;
      }

      if ((this.responseType === '' || this.responseType === 'text') && this.responseText) {
        const contentType = this.getResponseHeader('content-type')?.toLowerCase() ?? '';
        if (contentType.includes('json')) void emitEpisodes(requestUrl, JSON.parse(this.responseText));
      }
    } catch {
      // Observing metadata must never break the player request.
    }
  }, { once: true });

  return originalOpen.call(this, method, url, ...(rest as [boolean]));
};
