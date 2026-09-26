// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  detect: vi.fn(),
  observe: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('../src/core/provider-registry', () => {
  const provider = {
    id: 'netflix',
    name: 'Netflix',
    hosts: ['www.netflix.com'],
    kind: 'ANIME',
    matches: (url: URL) => url.hostname === 'www.netflix.com' && /^\/watch\//.test(url.pathname),
    detect: mocks.detect,
    observe: mocks.observe,
  };
  return {
    providerForUrl: (url: URL) => provider.matches(url) ? provider : undefined,
    providerForHost: (url: URL) => provider.hosts.includes(url.hostname) ? provider : undefined,
  };
});

vi.mock('../src/content/toast', () => ({
  showDetectionToast: mocks.toast,
  showEpisodeChangeToast: vi.fn(),
}));

const first = {
  providerId: 'netflix',
  providerMediaId: 'title:example anime|season:1',
  providerEpisodeId: '81234567',
  providerSeasonId: '1',
  providerSeriesId: 'title:example anime',
  kind: 'ANIME',
  title: 'Example Anime',
  episode: 1,
  canonicalUrl: 'https://www.netflix.com/watch/81234567',
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  mocks.detect.mockReset();
  mocks.observe.mockReset();
  mocks.toast.mockReset();
  mocks.observe.mockReturnValue(() => undefined);
  vi.stubGlobal('location', new URL(first.canonicalUrl));
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn().mockResolvedValue({
        ok: true,
        authenticated: true,
        result: { matched: true, mediaId: 15, requiresConfirmation: false },
      }),
    },
  });
});

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  document.head.replaceChildren();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('mounts a Netflix provider without Crunchyroll-specific routing', async () => {
  mocks.detect.mockResolvedValue(first);

  await import('../src/content/index');
  await Promise.resolve();

  expect(mocks.detect).toHaveBeenCalledTimes(1);
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: 'TRACKER_DETECTED',
    payload: first,
  });
  expect(mocks.toast).toHaveBeenCalledTimes(1);
});

it('remounts when Netflix changes watch id through SPA navigation', async () => {
  const next = {
    ...first,
    providerEpisodeId: '81234568',
    episode: 2,
    canonicalUrl: 'https://www.netflix.com/watch/81234568',
  };
  mocks.detect
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce(next);

  await import('../src/content/index');
  await Promise.resolve();

  (location as unknown as URL).href = next.canonicalUrl;
  await vi.advanceTimersByTimeAsync(300);
  await Promise.resolve();

  expect(mocks.detect).toHaveBeenCalledTimes(2);
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: 'TRACKER_DETECTED',
    payload: next,
  });
});

it('clears the active Netflix tracker when leaving the player', async () => {
  mocks.detect.mockResolvedValue(first);

  await import('../src/content/index');
  await Promise.resolve();

  (location as unknown as URL).href = 'https://www.netflix.com/browse';
  await vi.advanceTimersByTimeAsync(300);
  await Promise.resolve();

  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: 'TRACKER_CLEARED',
    payload: {
      providerId: 'netflix',
      canonicalUrl: 'https://www.netflix.com/browse',
    },
  });
});
