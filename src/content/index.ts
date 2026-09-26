import { providerForUrl } from '../core/provider-registry';
import type { DetectedMedia } from '../core/types';
import { showDetectionToast } from './toast';

let cleanup: (() => void) | null = null;
let mountedKey = '';
let remountQueued = false;

function livePageUrl(): URL {
  return new URL(location.href);
}

function metadataFingerprint(): string {
  const parts: string[] = [];

  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href?.trim();
  const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content?.trim();
  if (canonical) parts.push('canonical=' + canonical);
  if (ogUrl) parts.push('og=' + ogUrl);

  for (const script of document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')) {
    const text = script.textContent?.trim();
    if (!text) continue;
    try {
      const parsed = JSON.parse(text);
      const stack = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (stack.length) {
        const value = stack.pop();
        if (!value || typeof value !== 'object') continue;
        const node = value as Record<string, unknown>;
        const types = [node['@type']].flat();
        if (types.includes('TVEpisode') || types.includes('Episode')) {
          const identity = [node.url, node['@id'], node.episodeNumber]
            .filter(v => typeof v === 'string' || typeof v === 'number')
            .join('|');
          if (identity) parts.push('episode=' + identity);
        }
        for (const child of Object.values(node)) {
          if (child && typeof child === 'object') {
            if (Array.isArray(child)) stack.push(...child);
            else stack.push(child);
          }
        }
      }
    } catch {
      // Ignore transient malformed structured data during SPA updates.
    }
  }

  return parts.join('||');
}

function pageKey(): string {
  return livePageUrl().href + '||' + metadataFingerprint();
}

async function reportDetected(media: DetectedMedia): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'TRACKER_DETECTED', payload: media });
  if (response?.ok && response.settings?.showToast !== false) showDetectionToast(media, response);
}

async function reportProgress(media: DetectedMedia): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'SYNC_PROGRESS', payload: media });
}

function mountForCurrentPage(force = false): void {
  const key = pageKey();
  if (!force && key === mountedKey) return;

  cleanup?.();
  cleanup = null;
  mountedKey = key;

  const url = livePageUrl();
  const provider = providerForUrl(url);
  if (!provider) return;

  const ctx = { url, document };
  let stopped = false;
  let detecting = false;
  let detected = false;
  let attempts = 0;
  const maxAttempts = 80;

  const stillCurrent = () => !stopped && pageKey() === key;

  const stopProgress = provider.observe?.(ctx, (media) => {
    if (stillCurrent()) void reportProgress(media).catch(() => undefined);
  }) ?? null;

  const stopDetectionTimer = () => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  const tryDetect = async () => {
    if (!stillCurrent() || detected || detecting) return;
    detecting = true;
    attempts += 1;

    try {
      const media = await provider.detect(ctx);
      if (!media || !stillCurrent()) {
        if (attempts >= maxAttempts) stopDetectionTimer();
        return;
      }

      detected = true;
      stopDetectionTimer();
      await reportDetected(media);
    } catch {
      if (attempts >= maxAttempts) stopDetectionTimer();
    } finally {
      detecting = false;
    }
  };

  let timer: number | null = window.setInterval(() => {
    void tryDetect();
  }, 500);

  void tryDetect();

  cleanup = () => {
    stopped = true;
    stopDetectionTimer();
    stopProgress?.();
  };
}

function queueRemount(): void {
  if (remountQueued) return;
  remountQueued = true;
  window.setTimeout(() => {
    remountQueued = false;
    mountForCurrentPage();
  }, 0);
}

const mutationObserver = new MutationObserver(queueRemount);
mutationObserver.observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  characterData: true,
  attributeFilter: ['href', 'content'],
});

mountForCurrentPage();

const navigationObserver = window.setInterval(mountForCurrentPage, 500);

window.addEventListener(
  'pagehide',
  () => {
    window.clearInterval(navigationObserver);
    mutationObserver.disconnect();
    cleanup?.();
  },
  { once: true },
);
