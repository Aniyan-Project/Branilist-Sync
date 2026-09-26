import { providerForHost, providerForUrl } from '../core/provider-registry';
import { crunchyrollMediaId } from '../providers/crunchyroll/meta';
import type { CrunchyrollBridgeDiagnostics, DetectedMedia } from '../core/types';
import type { CrunchyrollNetworkEpisode } from '../providers/crunchyroll/network';
import { crunchyrollSeasonIdentity } from '../providers/crunchyroll/identity';
import { showDetectionToast, showEpisodeChangeToast } from './toast';

let cleanup: (() => void) | null = null;
let mountedKey = '';
let mountedProviderId: string | undefined;
let remountQueued = false;
let currentCrunchyrollEpisodeId = crunchyrollMediaId(new URL(location.href)) ?? undefined;
let lastClearedPage: string | undefined;
const networkEpisodeCache = new Map<string, CrunchyrollNetworkEpisode>();

function livePageUrl(): URL {
  return new URL(location.href);
}

function metadataFingerprint(): string {
  const parts: string[] = [];

  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href?.trim();
  const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content?.trim();
  if (canonical) parts.push('canonical=' + canonical);
  if (ogUrl) parts.push('og=' + ogUrl);

  const playerTitle = document
    .querySelector<HTMLElement>('[data-uia="video-title"], [data-uia="player-title"], .video-title')
    ?.textContent
    ?.replace(/\s+/g, ' ')
    .trim();
  if (playerTitle) parts.push('player=' + playerTitle.slice(0, 600));

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

function pageKey(providerId?: string): string {
  const url = livePageUrl();
  return `${providerId ?? providerForUrl(url)?.id ?? 'none'}||${url.href}||${metadataFingerprint()}`;
}

async function reportDetected(media: DetectedMedia): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'TRACKER_DETECTED', payload: media });
  if (response?.ok && response.settings?.showToast !== false) showDetectionToast(media, response);
}

async function reportProgress(media: DetectedMedia): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'SYNC_PROGRESS', payload: media });
}

async function clearTrackerForCurrentPage(providerId?: string): Promise<void> {
  if (!providerId) return;

  const url = livePageUrl();
  const canonicalUrl = `${url.origin}${url.pathname}`;
  const clearKey = `${providerId}|${canonicalUrl}`;
  if (lastClearedPage === clearKey) return;

  lastClearedPage = clearKey;
  cleanup?.();
  cleanup = null;
  mountedKey = '';
  mountedProviderId = undefined;
  if (providerId === 'crunchyroll') currentCrunchyrollEpisodeId = undefined;

  await chrome.runtime.sendMessage({
    type: 'TRACKER_CLEARED',
    payload: { providerId, canonicalUrl },
  }).catch(() => undefined);
}

function networkEpisodeToMedia(
  episode: CrunchyrollNetworkEpisode,
  expectedEpisodeId = crunchyrollMediaId(livePageUrl()) ?? undefined,
): DetectedMedia | null {
  const url = livePageUrl();
  const liveEpisodeId = expectedEpisodeId;
  const token = (value: unknown): string | undefined =>
    typeof value === 'string' && /^[A-Z0-9]{4,32}$/i.test(value) ? value : undefined;
  const optionalText = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() && value.length <= 300 ? value.trim() : undefined;

  const episodeProviderId = token(episode.episodeProviderId);
  const seasonProviderId = episode.seasonProviderId == null ? undefined : token(episode.seasonProviderId);
  const seriesProviderId = episode.seriesProviderId == null ? undefined : token(episode.seriesProviderId);
  const seasonSlug = typeof episode.seasonSlug === 'string' ? episode.seasonSlug.trim().toLowerCase() : undefined;
  const seriesTitle = optionalText(episode.seriesTitle);
  const episodeTitle = optionalText(episode.episodeTitle);
  const seasonTitle = optionalText(episode.seasonTitle);
  const episodeNumber = Number(episode.episode);

  if (
    !liveEpisodeId ||
    liveEpisodeId !== episodeProviderId ||
    !seriesTitle ||
    !Number.isSafeInteger(episodeNumber) ||
    episodeNumber < 1
  ) return null;

  return {
    providerId: 'crunchyroll',
    providerMediaId: crunchyrollSeasonIdentity(seriesProviderId, seasonSlug, seasonProviderId, episodeProviderId),
    providerEpisodeId: episodeProviderId,
    providerSeasonId: seasonProviderId,
    providerSeasonSlug: seasonSlug,
    providerSeriesId: seriesProviderId,
    kind: 'ANIME',
    title: seriesTitle,
    episode: episodeNumber,
    episodeTitle,
    seasonTitle,
    canonicalUrl: `${url.origin}${url.pathname}`,
  };
}

window.addEventListener('branilist-sync:crunchyroll-network-diagnostic', event => {
  const raw = (event as CustomEvent<string>).detail;
  if (typeof raw !== 'string' || raw.length > 4096) return;
  try {
    const payload = JSON.parse(raw) as Partial<CrunchyrollBridgeDiagnostics>;
    void chrome.runtime.sendMessage({ type: 'BRIDGE_DIAGNOSTIC', payload }).catch(() => undefined);
  } catch {
    // Ignore malformed diagnostics from the page world.
  }
});

async function activateCachedEpisode(episodeId: string, previousEpisodeId?: string): Promise<boolean> {
  const cached = networkEpisodeCache.get(episodeId);
  if (!cached) return false;

  const media = networkEpisodeToMedia(cached, episodeId);
  if (!media) return false;

  currentCrunchyrollEpisodeId = episodeId;
  mountedKey = '';
  mountedProviderId = 'crunchyroll';

  if (previousEpisodeId && previousEpisodeId !== episodeId) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EPISODE_NAVIGATED',
        payload: {
          providerId: 'crunchyroll',
          previousEpisodeId,
          episodeProviderId: episodeId,
          canonicalUrl: media.canonicalUrl,
          detectedAt: new Date().toISOString(),
        },
      });
      if (response?.ok && response.settings?.showToast !== false) {
        showEpisodeChangeToast(previousEpisodeId, episodeId, response.settings?.toastDurationSeconds ?? 12);
      }
    } catch {
      // Cached metadata can still be reported even if navigation telemetry fails.
    }
  }

  await reportDetected(media);
  mountForCurrentPage(true);
  return true;
}

window.addEventListener('branilist-sync:crunchyroll-network-episode', event => {
  const raw = (event as CustomEvent<string>).detail;
  if (typeof raw !== 'string' || raw.length > 4096) return;

  let detail: CrunchyrollNetworkEpisode;
  try {
    detail = JSON.parse(raw) as CrunchyrollNetworkEpisode;
  } catch {
    return;
  }

  networkEpisodeCache.set(detail.episodeProviderId, detail);

  const liveEpisodeId = crunchyrollMediaId(livePageUrl()) ?? undefined;
  if (!liveEpisodeId || liveEpisodeId !== detail.episodeProviderId) return;

  const previousEpisodeId = currentCrunchyrollEpisodeId;
  void activateCachedEpisode(liveEpisodeId, previousEpisodeId).catch(() => undefined);
});

function mountForCurrentPage(force = false): void {
  const url = livePageUrl();
  const provider = providerForUrl(url);
  if (!provider) return;

  lastClearedPage = undefined;
  const key = pageKey(provider.id);
  if (!force && key === mountedKey) return;

  cleanup?.();
  cleanup = null;
  mountedKey = key;
  mountedProviderId = provider.id;

  const ctx = { url, document };
  let stopped = false;
  let detecting = false;
  let detected = false;
  let attempts = 0;
  const maxAttempts = 80;

  const stillCurrent = () =>
    !stopped &&
    providerForUrl(livePageUrl())?.id === provider.id &&
    pageKey(provider.id) === key;

  const stopProgress = provider.observe?.(ctx, (media) => {
    if (stillCurrent()) void reportProgress(media).catch(() => undefined);
  }) ?? null;

  let timer: number | null = null;

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

  timer = window.setInterval(() => {
    void tryDetect();
  }, 500);

  void tryDetect();

  cleanup = () => {
    stopped = true;
    stopDetectionTimer();
    stopProgress?.();
  };
}

async function detectCrunchyrollEpisodeNavigation(): Promise<void> {
  const url = livePageUrl();
  if (providerForUrl(url)?.id !== 'crunchyroll') return;

  const nextEpisodeId = crunchyrollMediaId(url) ?? undefined;
  if (!nextEpisodeId || nextEpisodeId === currentCrunchyrollEpisodeId) return;

  const previousEpisodeId = currentCrunchyrollEpisodeId;
  currentCrunchyrollEpisodeId = nextEpisodeId;
  mountedKey = '';

  if (await activateCachedEpisode(nextEpisodeId, previousEpisodeId)) return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'EPISODE_NAVIGATED',
      payload: {
        providerId: 'crunchyroll',
        previousEpisodeId,
        episodeProviderId: nextEpisodeId,
        canonicalUrl: `${url.origin}${url.pathname}`,
        detectedAt: new Date().toISOString(),
      },
    });
    if (response?.ok && response.settings?.showToast !== false) {
      showEpisodeChangeToast(
        previousEpisodeId,
        nextEpisodeId,
        response.settings?.toastDurationSeconds ?? 12,
      );
    }
  } catch {
    // A navigation hint must never block the safe parser from retrying.
  }
}

async function reconcileCurrentPage(): Promise<void> {
  const url = livePageUrl();
  const provider = providerForUrl(url);

  if (!provider) {
    const hostProvider = providerForHost(url);
    await clearTrackerForCurrentPage(mountedProviderId ?? hostProvider?.id);
    return;
  }

  lastClearedPage = undefined;
  if (provider.id === 'crunchyroll') await detectCrunchyrollEpisodeNavigation();
  mountForCurrentPage();
}

function queueRemount(): void {
  if (remountQueued) return;
  remountQueued = true;
  window.setTimeout(() => {
    remountQueued = false;
    void reconcileCurrentPage();
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

void reconcileCurrentPage();

const navigationObserver = window.setInterval(() => {
  void reconcileCurrentPage();
}, 250);

window.addEventListener(
  'pagehide',
  () => {
    window.clearInterval(navigationObserver);
    mutationObserver.disconnect();
    cleanup?.();
  },
  { once: true },
);
