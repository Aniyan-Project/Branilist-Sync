import { providerForUrl } from '../core/provider-registry';
import type { DetectedMedia } from '../core/types';
import { showDetectionToast } from './toast';

let cleanup: (() => void) | null = null;
let mountedHref = '';

async function reportDetected(media: DetectedMedia): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'TRACKER_DETECTED', payload: media });
  if (response?.ok) showDetectionToast(media, response);
}

async function reportProgress(media: DetectedMedia): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'SYNC_PROGRESS', payload: media });
}

function mountForCurrentPage(): void {
  if (location.href === mountedHref) return;

  cleanup?.();
  cleanup = null;
  mountedHref = location.href;

  const url = new URL(location.href);
  const provider = providerForUrl(url);
  if (!provider) return;

  const ctx = { url, document };
  let stopped = false;
  let detecting = false;
  let detected = false;
  let attempts = 0;
  const maxAttempts = 40;

  const stopProgress = provider.observe?.(ctx, (media) => {
    if (location.href === url.href) void reportProgress(media).catch(() => undefined);
  }) ?? null;

  const stopDetectionTimer = () => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  const tryDetect = async () => {
    if (stopped || detected || detecting || location.href !== url.href) return;
    detecting = true;
    attempts += 1;

    try {
      const media = await provider.detect(ctx);
      if (!media || stopped || location.href !== url.href) {
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

mountForCurrentPage();

const navigationObserver = window.setInterval(mountForCurrentPage, 750);

window.addEventListener(
  'pagehide',
  () => {
    window.clearInterval(navigationObserver);
    cleanup?.();
  },
  { once: true },
);
