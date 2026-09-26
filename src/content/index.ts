import { providerForUrl } from '../core/provider-registry';
import type { DetectedMedia } from '../core/types';
import { showDetectionToast } from './toast';

let cleanup: (() => void) | null = null;
let mountedKey = '';
let remountQueued = false;

function candidatePageUrl(): URL {
  const live = new URL(location.href);
  const candidates = [
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const candidate = new URL(raw, live);
      if (candidate.origin !== live.origin) continue;
      if (providerForUrl(candidate)) return candidate;
    } catch {
      // Ignore transient/stale SPA metadata.
    }
  }
  return live;
}

function pageKey(): string {
  const live = location.href;
  const effective = candidatePageUrl().href;
  return live === effective ? live : live + '|' + effective;
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

  const url = candidatePageUrl();
  const provider = providerForUrl(url);
  if (!provider) return;

  const ctx = { url, document };
  let stopped = false;
  let detecting = false;
  let detected = false;
  let attempts = 0;
  const maxAttempts = 40;

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
  }, 750);

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

const dispatchNavigation = () => window.dispatchEvent(new Event('branilist:navigation'));
const originalPushState = history.pushState.bind(history);
const originalReplaceState = history.replaceState.bind(history);

history.pushState = function (...args: Parameters<History['pushState']>) {
  originalPushState(...args);
  dispatchNavigation();
};
history.replaceState = function (...args: Parameters<History['replaceState']>) {
  originalReplaceState(...args);
  dispatchNavigation();
};

window.addEventListener('popstate', dispatchNavigation);
window.addEventListener('branilist:navigation', queueRemount);

const metadataObserver = new MutationObserver(queueRemount);
metadataObserver.observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['href', 'content'],
});

mountForCurrentPage();

const navigationObserver = window.setInterval(mountForCurrentPage, 750);

window.addEventListener(
  'pagehide',
  () => {
    window.clearInterval(navigationObserver);
    metadataObserver.disconnect();
    window.removeEventListener('popstate', dispatchNavigation);
    window.removeEventListener('branilist:navigation', queueRemount);
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    cleanup?.();
  },
  { once: true },
);
