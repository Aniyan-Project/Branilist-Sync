import { providerForUrl } from '../core/provider-registry';
import type { DetectedMedia } from '../core/types';

let cleanup: (() => void) | null = null;
let mountedHref = '';

async function emit(media: DetectedMedia): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'TRACKER_DETECTED', payload: media });
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
    if (media) void emit(media);
  });

  cleanup = provider.observe?.(ctx, (media) => void emit(media)) ?? null;
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
