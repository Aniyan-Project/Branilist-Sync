import { extractCrunchyrollNetworkEpisodes } from '../providers/crunchyroll/network';

const EPISODE_EVENT = 'branilist-sync:crunchyroll-network-episode';
const DIAG_EVENT = 'branilist-sync:crunchyroll-network-diagnostic';

let jsonResponsesSeen = 0;

function emitDiagnostic(payload: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent(DIAG_EVENT, {
    detail: JSON.stringify({
      active: true,
      jsonResponsesSeen,
      ...payload,
    }),
  }));
}

function emitFrom(url: string, payload: unknown) {
  jsonResponsesSeen += 1;
  const now = new Date().toISOString();
  emitDiagnostic({
    lastRequestUrl: url.slice(0, 1000),
    lastRequestAt: now,
  });

  for (const episode of extractCrunchyrollNetworkEpisodes(payload)) {
    emitDiagnostic({
      lastEpisodeId: episode.episodeProviderId,
      lastEpisodeNumber: episode.episode,
      lastEpisodeAt: now,
    });
    window.dispatchEvent(new CustomEvent(EPISODE_EVENT, {
      detail: JSON.stringify(episode),
    }));
  }
}

emitDiagnostic({ startedAt: new Date().toISOString() });

const originalFetch = window.fetch.bind(window);
window.fetch = async (...args: Parameters<typeof fetch>) => {
  const response = await originalFetch(...args);
  try {
    const input = args[0];
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (contentType.includes('json')) {
      void response.clone().json().then(data => emitFrom(url, data)).catch(() => undefined);
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
    const requestUrl = requestUrls.get(this);
    if (!requestUrl) return;
    try {
      if (this.responseType === 'json' && this.response) {
        emitFrom(requestUrl, this.response);
        return;
      }
      if ((this.responseType === '' || this.responseType === 'text') && this.responseText) {
        const contentType = this.getResponseHeader('content-type')?.toLowerCase() ?? '';
        if (contentType.includes('json')) emitFrom(requestUrl, JSON.parse(this.responseText));
      }
    } catch {
      // Observing metadata must never break the player request.
    }
  }, { once: true });
  return originalOpen.call(this, method, url, ...(rest as [boolean]));
};
