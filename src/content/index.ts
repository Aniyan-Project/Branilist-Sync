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

  void provider.detect(ctx).then((media) => {
    if (media && location.href === url.href) void reportDetected(media).catch(() => undefined);
  });

  cleanup = provider.observe?.(ctx, (media) => {
    if (location.href === url.href) void reportProgress(media).catch(() => undefined);
  }) ?? null;
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
