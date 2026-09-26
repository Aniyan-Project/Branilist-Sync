// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  episodeToast: vi.fn(),
}));

vi.mock('../src/content/toast', () => ({
  showDetectionToast: mocks.toast,
  showEpisodeChangeToast: mocks.episodeToast,
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  mocks.toast.mockReset();
  mocks.episodeToast.mockReset();
  vi.stubGlobal('location', new URL('https://www.netflix.com/watch/81600001'));
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn().mockResolvedValue({
        ok: true,
        authenticated: true,
        settings: { showToast: true, toastDurationSeconds: 30 },
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

function emitEpisode(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('branilist-sync:netflix-network-episode', {
    detail: JSON.stringify(detail),
  }));
}

it('detects the active Netflix episode from network metadata', async () => {
  await import('../src/content/netflix');

  emitEpisode({
    watchId: '81600001',
    titleId: '81234567',
    providerMediaId: '81234567?s=1',
    seriesTitle: 'Example Anime',
    seasonTitle: 'Season 1',
    episodeTitle: 'Episode 1',
    seasonNumber: 1,
    episode: 1,
    isMovie: false,
  });
  await Promise.resolve();
  await Promise.resolve();

  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: 'TRACKER_DETECTED',
    payload: expect.objectContaining({
      providerId: 'netflix',
      providerMediaId: '81234567?s=1',
      providerEpisodeId: '81600001',
      providerSeriesId: '81234567',
      providerSeasonNumber: 1,
      episode: 1,
    }),
  });
  expect(mocks.toast).toHaveBeenCalledTimes(1);
});

it('tracks Netflix SPA episode changes without a reload', async () => {
  await import('../src/content/netflix');

  emitEpisode({
    watchId: '81600001',
    titleId: '81234567',
    providerMediaId: '81234567?s=1',
    seriesTitle: 'Example Anime',
    seasonNumber: 1,
    episode: 1,
    isMovie: false,
  });
  await Promise.resolve();

  (location as unknown as URL).href = 'https://www.netflix.com/watch/81600002';
  emitEpisode({
    watchId: '81600002',
    titleId: '81234567',
    providerMediaId: '81234567?s=1',
    seriesTitle: 'Example Anime',
    seasonNumber: 1,
    episode: 2,
    isMovie: false,
  });
  await Promise.resolve();
  await Promise.resolve();

  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: 'EPISODE_NAVIGATED',
    payload: expect.objectContaining({
      providerId: 'netflix',
      previousEpisodeId: '81600001',
      episodeProviderId: '81600002',
      canonicalUrl: 'https://www.netflix.com/watch/81600002',
    }),
  });
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: 'TRACKER_DETECTED',
    payload: expect.objectContaining({
      providerId: 'netflix',
      providerEpisodeId: '81600002',
      providerMediaId: '81234567?s=1',
      episode: 2,
    }),
  });
  expect(mocks.episodeToast).toHaveBeenCalled();
});

it('clears the current Netflix media after leaving the player', async () => {
  await import('../src/content/netflix');

  emitEpisode({
    watchId: '81600001',
    titleId: '81234567',
    providerMediaId: '81234567?s=1',
    seriesTitle: 'Example Anime',
    seasonNumber: 1,
    episode: 1,
    isMovie: false,
  });
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
