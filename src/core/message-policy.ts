import type { DetectedMedia } from './types';
import { crunchyrollMediaId } from '../providers/crunchyroll/meta';
import { crunchyrollSeasonIdentity } from '../providers/crunchyroll/identity';
import {
  netflixProviderMediaIdentity,
  netflixSeriesIdentity,
  netflixWatchId,
} from '../providers/netflix/meta';

const providerToken = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[A-Z0-9]{4,32}$/i.test(value) ? value : undefined;

function safeProgress(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error('Progresso inválido.');
  }
  return value;
}

function safeText(value: unknown, max = 300): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > max) return undefined;
  return normalized;
}

function validateCrunchyroll(media: DetectedMedia, source: URL, canonical: URL): DetectedMedia {
  const episodeId = crunchyrollMediaId(canonical);
  const declaredEpisodeId = providerToken(media.providerEpisodeId);
  const seasonId = providerToken(media.providerSeasonId);
  const seriesId = providerToken(media.providerSeriesId);
  const seasonSlug = typeof media.providerSeasonSlug === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(media.providerSeasonSlug) &&
    media.providerSeasonSlug.length <= 120
    ? media.providerSeasonSlug.toLowerCase()
    : undefined;
  const providerMediaId = safeText(media.providerMediaId, 200);
  const title = safeText(media.title);
  const expectedProviderMediaId = crunchyrollSeasonIdentity(seriesId, seasonSlug, seasonId, episodeId);
  const allowedHost = ['www.crunchyroll.com', 'crunchyroll.com'].includes(source.hostname);

  if (!allowedHost || !episodeId || source.origin !== canonical.origin ||
    media.providerId !== 'crunchyroll' || media.kind !== 'ANIME' ||
    (declaredEpisodeId && declaredEpisodeId !== episodeId) ||
    !providerMediaId || providerMediaId !== expectedProviderMediaId ||
    !title || !Number.isSafeInteger(media.episode) || media.episode! <= 0) {
    throw new Error('Mídia inválida para esta página.');
  }

  return {
    providerId: 'crunchyroll',
    providerMediaId,
    providerEpisodeId: episodeId,
    providerSeasonId: seasonId,
    providerSeasonSlug: seasonSlug,
    providerSeriesId: seriesId,
    kind: 'ANIME',
    title,
    episode: media.episode,
    progressPercent: safeProgress(media.progressPercent),
    canonicalUrl: `${canonical.origin}${canonical.pathname}`,
    seasonTitle: safeText(media.seasonTitle),
    episodeTitle: safeText(media.episodeTitle),
  };
}

function validateNetflix(media: DetectedMedia, source: URL, canonical: URL): DetectedMedia {
  const episodeId = netflixWatchId(canonical);
  const title = safeText(media.title);
  const providerMediaId = safeText(media.providerMediaId, 200);
  const declaredEpisodeId = typeof media.providerEpisodeId === 'string' && /^\d{4,20}$/.test(media.providerEpisodeId)
    ? media.providerEpisodeId
    : undefined;
  const season = typeof media.providerSeasonId === 'string' && /^\d{1,4}$/.test(media.providerSeasonId)
    ? Number(media.providerSeasonId)
    : NaN;
  const seriesId = safeText(media.providerSeriesId, 200);
  const allowedHost = ['www.netflix.com', 'netflix.com'].includes(source.hostname);
  const titleIdentity = netflixSeriesIdentity(title ?? '');
  const stableSeriesId = seriesId && /^\d{4,20}$/.test(seriesId) ? seriesId : undefined;
  const acceptedSeriesIdentity = stableSeriesId ?? titleIdentity;
  const expectedProviderMediaId = netflixProviderMediaIdentity(stableSeriesId, title ?? '', season);

  if (!allowedHost || !episodeId || source.origin !== canonical.origin ||
    media.providerId !== 'netflix' || media.kind !== 'ANIME' ||
    !declaredEpisodeId || declaredEpisodeId !== episodeId ||
    !title || !Number.isSafeInteger(season) || season <= 0 ||
    !Number.isSafeInteger(media.episode) || media.episode! <= 0 ||
    seriesId !== acceptedSeriesIdentity ||
    providerMediaId !== expectedProviderMediaId) {
    throw new Error('Mídia inválida para esta página.');
  }

  return {
    providerId: 'netflix',
    providerMediaId,
    providerEpisodeId: episodeId,
    providerSeasonId: String(season),
    providerSeriesId: seriesId,
    kind: 'ANIME',
    title,
    episode: media.episode,
    progressPercent: safeProgress(media.progressPercent),
    canonicalUrl: `${canonical.origin}${canonical.pathname}`,
    seasonTitle: safeText(media.seasonTitle),
    episodeTitle: safeText(media.episodeTitle),
  };
}

export function trustedPopup(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && !sender.tab && sender.url === chrome.runtime.getURL('src/ui/popup/popup.html');
}

export function validateDetection(value: unknown, sender: chrome.runtime.MessageSender): DetectedMedia {
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0) {
    throw new Error('Origem não autorizada.');
  }
  if (!value || typeof value !== 'object') throw new Error('Mídia inválida.');

  const media = value as DetectedMedia;
  const source = new URL(sender.url ?? '');
  const canonical = new URL(media.canonicalUrl);

  if (source.protocol !== 'https:' || canonical.protocol !== 'https:') {
    throw new Error('Origem não autorizada.');
  }

  if (media.providerId === 'crunchyroll') return validateCrunchyroll(media, source, canonical);
  if (media.providerId === 'netflix') return validateNetflix(media, source, canonical);

  throw new Error('Provider não autorizado.');
}
