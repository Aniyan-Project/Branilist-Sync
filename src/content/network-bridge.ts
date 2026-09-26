import { extractCrunchyrollNetworkEpisodes } from '../providers/crunchyroll/network';
import { extractNetflixNetworkEpisodes } from '../providers/netflix/network';

type ProviderId = 'crunchyroll' | 'netflix';

const host = location.hostname.toLowerCase();
const provider: ProviderId | null =
  ['www.crunchyroll.com', 'crunchyroll.com'].includes(host)
    ? 'crunchyroll'
    : ['www.netflix.com', 'netflix.com'].includes(host)
      ? 'netflix'
      : null;

let jsonResponsesSeen = 0;

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

function emitEpisodes(url: string, payload: unknown) {
  if (!provider) return;
  jsonResponsesSeen += 1;
  const now = new Date().toISOString();

  emitDiagnostic({
    lastRequestUrl: url.slice(0, 1000),
    lastRequestAt: now,
  });

  const episodes = provider === 'crunchyroll'
    ? extractCrunchyrollNetworkEpisodes(payload)
    : extractNetflixNetworkEpisodes(payload);

  for (const episode of episodes) {
    const episodeId = provider === 'crunchyroll'
      ? episode.episodeProviderId
      : episode.watchId;
    const episodeNumber = episode.episode;

    emitDiagnostic({
      lastEpisodeId: episodeId,
      lastEpisodeNumber: episodeNumber,
      lastEpisodeAt: now,
    });

    window.dispatchEvent(new CustomEvent(eventName('episode'), {
      detail: JSON.stringify(episode),
    }));
  }
}

if (provider) emitDiagnostic({ startedAt: new Date().toISOString() });

const originalFetch = window.fetch.bind(window);
window.fetch = async (...args: Parameters<typeof fetch>) => {
  const response = await originalFetch(...args);
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
        emitEpisodes(requestUrl, this.response);
        return;
      }

      if ((this.responseType === '' || this.responseType === 'text') && this.responseText) {
        const contentType = this.getResponseHeader('content-type')?.toLowerCase() ?? '';
        if (contentType.includes('json')) emitEpisodes(requestUrl, JSON.parse(this.responseText));
      }
    } catch {
      // Observing metadata must never break the player request.
    }
  }, { once: true });

  return originalOpen.call(this, method, url, ...(rest as [boolean]));
};
