import { extractCrunchyrollNetworkEpisodes } from '../providers/crunchyroll/network';

const EVENT = 'branilist-sync:crunchyroll-network-episode';
const relevant = (url: string) => /\/cms\/(?:objects|episodes?)\//i.test(url) || /\/cms\/objects(?:\?|$)/i.test(url);

function emitFrom(url: string, payload: unknown) {
  if (!relevant(url)) return;
  for (const episode of extractCrunchyrollNetworkEpisodes(payload)) {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: JSON.stringify(episode) }));
  }
}

const originalFetch = window.fetch.bind(window);
window.fetch = async (...args: Parameters<typeof fetch>) => {
  const response = await originalFetch(...args);
  try {
    const input = args[0];
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (relevant(url)) {
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (contentType.includes('json')) {
        void response.clone().json().then(data => emitFrom(url, data)).catch(() => undefined);
      }
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
    if (!requestUrl || !relevant(requestUrl)) return;
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
      // Reading/cloning metadata must never break the player request.
    }
  }, { once: true });
  return originalOpen.call(this, method, url, ...(rest as [boolean]));
};
