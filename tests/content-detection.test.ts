// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  detect: vi.fn(),
  observe: vi.fn(),
  toast: vi.fn(),
  episodeToast: vi.fn(),
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
  showEpisodeChangeToast: mocks.episodeToast,
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
  mocks.episodeToast.mockReset();
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


it('emits immediate episode navigation state and toast when the live watch ID changes', async () => {
  mocks.detect.mockResolvedValue(media);

  await import('../src/content/index');
  await Promise.resolve();

  (location as unknown as URL).href = 'https://www.crunchyroll.com/pt-br/watch/G8WUN0X72/next';
  await vi.advanceTimersByTimeAsync(300);
  await Promise.resolve();

  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: 'EPISODE_NAVIGATED',
    payload: expect.objectContaining({
      providerId: 'crunchyroll',
      previousEpisodeId: 'GMKUXG2E0',
      episodeProviderId: 'G8WUN0X72',
      canonicalUrl: 'https://www.crunchyroll.com/pt-br/watch/G8WUN0X72/next',
    }),
  });
  expect(mocks.episodeToast).toHaveBeenCalledWith(
    'GMKUXG2E0',
    'G8WUN0X72',
    expect.any(Number),
  );
});


it('uses Crunchyroll network metadata as the primary episode signal', async () => {
  mocks.detect.mockResolvedValue(null);

  vi.stubGlobal('location', new URL('https://www.crunchyroll.com/pt-br/watch/G8WUN0X72/episode-3'));
  await import('../src/content/index');
  await Promise.resolve();

  window.dispatchEvent(new CustomEvent('branilist-sync:crunchyroll-network-episode', {
    detail: JSON.stringify({
      episodeProviderId: 'G8WUN0X72',
      seasonProviderId: 'SEASON123',
      seriesProviderId: 'G24H1N334',
      seriesTitle: 'The Detective Is Already Dead',
      seasonTitle: 'Portuguese Dub',
      episodeTitle: 'É de Qualidade Yui-nyan',
      episode: 3,
    }),
  }));
  await Promise.resolve();
  await Promise.resolve();

  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: 'TRACKER_DETECTED',
    payload: {
      providerId: 'crunchyroll',
      providerMediaId: 'SEASON123',
      providerEpisodeId: 'G8WUN0X72',
      providerSeasonId: 'SEASON123',
      providerSeriesId: 'G24H1N334',
      kind: 'ANIME',
      title: 'The Detective Is Already Dead',
      episode: 3,
      episodeTitle: 'É de Qualidade Yui-nyan',
      seasonTitle: 'Portuguese Dub',
      canonicalUrl: 'https://www.crunchyroll.com/pt-br/watch/G8WUN0X72/episode-3',
    },
  });
});

it('rejects forged network metadata for a different watch ID', async () => {
  mocks.detect.mockResolvedValue(null);

  vi.stubGlobal('location', new URL('https://www.crunchyroll.com/pt-br/watch/G8WUN0X72/episode-3'));
  await import('../src/content/index');
  await Promise.resolve();

  window.dispatchEvent(new CustomEvent('branilist-sync:crunchyroll-network-episode', {
    detail: JSON.stringify({
      episodeProviderId: 'GOTHER123',
      seriesTitle: 'Wrong episode',
      episode: 99,
    }),
  }));
  await Promise.resolve();

  expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
    expect.objectContaining({ type: 'TRACKER_DETECTED' }),
  );
});


it('uses cached prefetched metadata for the episode selected by the live URL', async () => {
  mocks.detect.mockResolvedValue(null);

  const start = new URL('https://www.crunchyroll.com/pt-br/watch/GMKUXG2E0/episode-1');
  vi.stubGlobal('location', start);

  await import('../src/content/index');
  await Promise.resolve();

  const emit = (detail: Record<string, unknown>) => {
    window.dispatchEvent(new CustomEvent('branilist-sync:crunchyroll-network-episode', {
      detail: JSON.stringify(detail),
    }));
  };

  emit({
    episodeProviderId: 'GMKUXG2E0',
    seasonProviderId: 'SEASON123',
    seriesProviderId: 'G24H1N334',
    seriesTitle: 'The Detective Is Already Dead',
    episodeTitle: 'Episode 1',
    episode: 1,
  });
  emit({
    episodeProviderId: 'GPWUKD78W',
    seasonProviderId: 'SEASON123',
    seriesProviderId: 'G24H1N334',
    seriesTitle: 'The Detective Is Already Dead',
    episodeTitle: 'Episode 2',
    episode: 2,
  });
  emit({
    episodeProviderId: 'G8WUN0X72',
    seasonProviderId: 'SEASON123',
    seriesProviderId: 'G24H1N334',
    seriesTitle: 'The Detective Is Already Dead',
    episodeTitle: 'Episode 3',
    episode: 3,
  });
  await Promise.resolve();

  (location as unknown as URL).href = 'https://www.crunchyroll.com/pt-br/watch/GPWUKD78W/episode-2';
  await vi.advanceTimersByTimeAsync(300);
  await Promise.resolve();
  await Promise.resolve();

  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: 'TRACKER_DETECTED',
    payload: expect.objectContaining({
      providerEpisodeId: 'GPWUKD78W',
      episode: 2,
      episodeTitle: 'Episode 2',
    }),
  });

  expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith({
    type: 'TRACKER_DETECTED',
    payload: expect.objectContaining({
      providerEpisodeId: 'G8WUN0X72',
      episode: 3,
    }),
  });
});
