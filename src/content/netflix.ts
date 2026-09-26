import { ANIME_COMPLETION_PERCENT } from '../core/tracking';
import type { DetectedMedia, CrunchyrollBridgeDiagnostics } from '../core/types';
import { observeVideoProgress } from '../core/video-progress';
import { netflixWatchId } from '../providers/netflix/identity';
import type { NetflixNetworkEpisode } from '../providers/netflix/network';
import { showDetectionToast, showEpisodeChangeToast } from './toast';

const cache = new Map<string, NetflixNetworkEpisode>();
let currentWatchId = netflixWatchId(new URL(location.href));
let currentMedia: DetectedMedia | null = null;
let lastClearedUrl: string | undefined;

function liveUrl(): URL {
  return new URL(location.href);
}

function toMedia(episode: NetflixNetworkEpisode, expectedWatchId = netflixWatchId(liveUrl())): DetectedMedia | null {
  const url = liveUrl();
  if (!expectedWatchId || episode.watchId !== expectedWatchId) return null;
  if (!/^\d{1,20}$/.test(episode.watchId) || !/^\d{1,20}$/.test(episode.titleId)) return null;
  if (!episode.providerMediaId || episode.providerMediaId.length > 200) return null;
  if (!episode.seriesTitle?.trim() || episode.seriesTitle.length > 300) return null;
  if (!Number.isSafeInteger(episode.episode) || episode.episode < 1) return null;
  if (!Number.isSafeInteger(episode.seasonNumber) || episode.seasonNumber < 1) return null;

  return {
    providerId: 'netflix',
    providerMediaId: episode.providerMediaId,
    providerEpisodeId: episode.watchId,
    providerSeriesId: episode.titleId,
    providerSeasonNumber: episode.seasonNumber,
    kind: 'ANIME',
    title: episode.seriesTitle.trim(),
    episode: episode.episode,
    episodeTitle: episode.episodeTitle?.slice(0, 300),
    seasonTitle: episode.seasonTitle?.slice(0, 300),
    canonicalUrl: `${url.origin}${url.pathname}`,
  };
}

async function reportDetected(media: DetectedMedia): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'TRACKER_DETECTED', payload: media });
  if (response?.ok && response.settings?.showToast !== false) showDetectionToast(media, response);
}

async function clearCurrent(): Promise<void> {
  const url = liveUrl();
  const canonicalUrl = `${url.origin}${url.pathname}`;
  if (lastClearedUrl === canonicalUrl) return;
  lastClearedUrl = canonicalUrl;
  currentMedia = null;
  currentWatchId = undefined;

  await chrome.runtime.sendMessage({
    type: 'TRACKER_CLEARED',
    payload: { providerId: 'netflix', canonicalUrl },
  }).catch(() => undefined);
}

async function activate(watchId: string, previousWatchId?: string): Promise<boolean> {
  const cached = cache.get(watchId);
  if (!cached) return false;

  const media = toMedia(cached, watchId);
  if (!media) return false;

  currentWatchId = watchId;
  currentMedia = media;
  lastClearedUrl = undefined;

  if (previousWatchId && previousWatchId !== watchId) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EPISODE_NAVIGATED',
        payload: {
          providerId: 'netflix',
          previousEpisodeId: previousWatchId,
          episodeProviderId: watchId,
          canonicalUrl: media.canonicalUrl,
          detectedAt: new Date().toISOString(),
        },
      });
      if (response?.ok && response.settings?.showToast !== false) {
        showEpisodeChangeToast(previousWatchId, watchId, response.settings?.toastDurationSeconds ?? 12);
      }
    } catch {
      // Detection remains useful even when transition telemetry fails.
    }
  }

  await reportDetected(media);
  return true;
}

window.addEventListener('branilist-sync:netflix-network-diagnostic', event => {
  const raw = (event as CustomEvent<string>).detail;
  if (typeof raw !== 'string' || raw.length > 4096) return;

  try {
    const payload = JSON.parse(raw) as Partial<CrunchyrollBridgeDiagnostics>;
    void chrome.runtime.sendMessage({
      type: 'BRIDGE_DIAGNOSTIC',
      payload: { ...payload, providerId: 'netflix' },
    }).catch(() => undefined);
  } catch {
    // Ignore malformed diagnostics.
  }
});

window.addEventListener('branilist-sync:netflix-network-episode', event => {
  const raw = (event as CustomEvent<string>).detail;
  if (typeof raw !== 'string' || raw.length > 8192) return;

  let detail: NetflixNetworkEpisode;
  try {
    detail = JSON.parse(raw) as NetflixNetworkEpisode;
  } catch {
    return;
  }

  if (!detail?.watchId) return;
  cache.set(detail.watchId, detail);

  const liveWatchId = netflixWatchId(liveUrl());
  if (!liveWatchId || liveWatchId !== detail.watchId) return;

  const previousWatchId = currentWatchId;
  void activate(liveWatchId, previousWatchId).catch(() => undefined);
});

const stopProgress = observeVideoProgress(document, {
  thresholdPercent: ANIME_COMPLETION_PERCENT,
  async onThreshold(progressPercent) {
    if (!currentMedia) return false;
    const liveWatchId = netflixWatchId(liveUrl());
    if (!liveWatchId || liveWatchId !== currentMedia.providerEpisodeId) return false;

    await chrome.runtime.sendMessage({
      type: 'SYNC_PROGRESS',
      payload: { ...currentMedia, progressPercent },
    });
    return true;
  },
});

async function pollNavigation() {
  const url = liveUrl();
  const nextWatchId = netflixWatchId(url);

  if (!nextWatchId) {
    await clearCurrent();
    return;
  }

  lastClearedUrl = undefined;
  if (nextWatchId === currentWatchId && currentMedia) return;

  const previousWatchId = currentWatchId;
  currentWatchId = nextWatchId;

  if (await activate(nextWatchId, previousWatchId)) return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'EPISODE_NAVIGATED',
      payload: {
        providerId: 'netflix',
        previousEpisodeId: previousWatchId,
        episodeProviderId: nextWatchId,
        canonicalUrl: `${url.origin}${url.pathname}`,
        detectedAt: new Date().toISOString(),
      },
    });

    if (response?.ok && response.settings?.showToast !== false && previousWatchId && previousWatchId !== nextWatchId) {
      showEpisodeChangeToast(previousWatchId, nextWatchId, response.settings?.toastDurationSeconds ?? 12);
    }
  } catch {
    // Wait for the network bridge metadata.
  }
}

if (!currentWatchId) void clearCurrent();

const navigationTimer = window.setInterval(() => void pollNavigation(), 250);

window.addEventListener('pagehide', () => {
  window.clearInterval(navigationTimer);
  stopProgress();
}, { once: true });
