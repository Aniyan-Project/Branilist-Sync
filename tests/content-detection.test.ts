// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  detect: vi.fn(),
  observe: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('../src/core/provider-registry', () => ({
  providerForUrl: () => ({
    id: 'crunchyroll',
    name: 'Crunchyroll',
    hosts: ['www.crunchyroll.com'],
    kind: 'ANIME',
    matches: () => true,
    detect: mocks.detect,
    observe: mocks.observe,
  }),
}));

vi.mock('../src/content/toast', () => ({
  showDetectionToast: mocks.toast,
}));

const media = {
  providerId: 'crunchyroll',
  providerMediaId: 'SEASON123',
  providerEpisodeId: 'GMKUXG2E0',
  providerSeasonId: 'SEASON123',
  providerSeriesId: 'G24H1N334',
  kind: 'ANIME',
  title: 'The Detective Is Already Dead',
  episode: 1,
  canonicalUrl: 'https://www.crunchyroll.com/pt-br/watch/GMKUXG2E0/example',
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  mocks.detect.mockReset();
  mocks.observe.mockReset();
  mocks.toast.mockReset();
  mocks.observe.mockReturnValue(() => undefined);
  vi.stubGlobal('location', new URL('https://www.crunchyroll.com/pt-br/watch/GMKUXG2E0/example'));
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('retries detection on the same URL until Crunchyroll metadata becomes available', async () => {
  mocks.detect
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(media);

  await import('../src/content/index');
  await vi.advanceTimersByTimeAsync(1600);
  await Promise.resolve();

  expect(mocks.detect).toHaveBeenCalledTimes(3);
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: 'TRACKER_DETECTED',
    payload: media,
  });
  expect(mocks.toast).toHaveBeenCalledTimes(1);
});

it('does not keep detecting after the first successful detection', async () => {
  mocks.detect.mockResolvedValue(media);

  await import('../src/content/index');
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(5000);

  expect(mocks.detect).toHaveBeenCalledTimes(1);
  expect(mocks.toast).toHaveBeenCalledTimes(1);
});


it('remounts detection when Crunchyroll SPA metadata switches to the next episode', async () => {
  const nextMedia = {
    ...media,
    providerMediaId: 'SEASON123',
    providerEpisodeId: 'GNEXT123',
    episode: 2,
    canonicalUrl: 'https://www.crunchyroll.com/pt-br/watch/GNEXT123/next',
  };
  mocks.detect
    .mockResolvedValueOnce(media)
    .mockResolvedValueOnce(nextMedia);

  await import('../src/content/index');
  await Promise.resolve();
  expect(mocks.detect).toHaveBeenCalledTimes(1);

  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = nextMedia.canonicalUrl;
  document.head.append(canonical);

  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(10);
  await Promise.resolve();

  expect(mocks.detect).toHaveBeenCalledTimes(2);
  expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith({
    type: 'TRACKER_DETECTED',
    payload: nextMedia,
  });
});


it('uses the live Crunchyroll URL as authority even while canonical metadata is stale', async () => {
  const nextUrl = 'https://www.crunchyroll.com/pt-br/watch/GNEXT123/next';
  const nextMedia = {
    ...media,
    providerEpisodeId: 'GNEXT123',
    episode: 2,
    canonicalUrl: nextUrl,
  };

  const staleCanonical = document.createElement('link');
  staleCanonical.rel = 'canonical';
  staleCanonical.href = media.canonicalUrl;
  document.head.append(staleCanonical);

  mocks.detect
    .mockResolvedValueOnce(media)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(nextMedia);

  await import('../src/content/index');
  await Promise.resolve();
  expect(mocks.detect).toHaveBeenCalledTimes(1);

  (location as unknown as URL).href = nextUrl;
  await vi.advanceTimersByTimeAsync(550);
  await Promise.resolve();

  expect(mocks.detect).toHaveBeenCalledTimes(2);

  staleCanonical.href = nextUrl;
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(550);
  await Promise.resolve();

  expect(mocks.detect).toHaveBeenCalledTimes(3);
  expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith({
    type: 'TRACKER_DETECTED',
    payload: nextMedia,
  });
});
