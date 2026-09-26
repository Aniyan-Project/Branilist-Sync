import type { DetectedMedia } from './types';
import { crunchyrollMediaId } from '../providers/crunchyroll/meta';
import { crunchyrollSeasonIdentity } from '../providers/crunchyroll/identity';
import { netflixSeasonIdentity, netflixWatchId } from '../providers/netflix/identity';

const providerToken = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[A-Z0-9]{4,32}$/i.test(value) ? value : undefined;

const netflixToken = (value: unknown): string | undefined => {
  const normalized = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  return /^\d{1,20}$/.test(normalized) ? normalized : undefined;
};

const hostAllowed = (providerId: string, hostname: string): boolean => {
  if (providerId === 'crunchyroll') return ['www.crunchyroll.com', 'crunchyroll.com'].includes(hostname);
  if (providerId === 'netflix') return ['www.netflix.com', 'netflix.com'].includes(hostname);
  return false;
};

export function trustedPopup(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && !sender.tab && sender.url === chrome.runtime.getURL('src/ui/popup/popup.html');
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
  const providerMediaId = typeof media.providerMediaId === 'string' && media.providerMediaId.length <= 200
    ? media.providerMediaId
    : undefined;
  const expectedProviderMediaId = crunchyrollSeasonIdentity(seriesId, seasonSlug, seasonId, episodeId);

  if (!episodeId || source.origin !== canonical.origin ||
    (declaredEpisodeId && declaredEpisodeId !== episodeId) ||
    !providerMediaId || providerMediaId !== expectedProviderMediaId ||
    typeof media.title !== 'string' || !media.title.trim() || media.title.length > 300 ||
    !Number.isSafeInteger(media.episode) || media.episode! <= 0) {
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
    title: media.title.trim(),
    episode: media.episode,
    progressPercent: media.progressPercent,
    canonicalUrl: `${canonical.origin}${canonical.pathname}`,
    seasonTitle: typeof media.seasonTitle === 'string' ? media.seasonTitle.slice(0, 300) : undefined,
    episodeTitle: typeof media.episodeTitle === 'string' ? media.episodeTitle.slice(0, 300) : undefined,
  };
}

function validateNetflix(media: DetectedMedia, source: URL, canonical: URL): DetectedMedia {
  const watchId = netflixWatchId(canonical);
  const declaredEpisodeId = netflixToken(media.providerEpisodeId);
  const titleId = netflixToken(media.providerSeriesId);
  const seasonNumber = Number(media.providerSeasonNumber);
  const providerMediaId = typeof media.providerMediaId === 'string' && media.providerMediaId.length <= 200
    ? media.providerMediaId
    : undefined;
  const expectedProviderMediaId = netflixSeasonIdentity(titleId, seasonNumber);

  if (!watchId || source.origin !== canonical.origin ||
    declaredEpisodeId !== watchId ||
    !titleId ||
    !Number.isSafeInteger(seasonNumber) || seasonNumber < 1 ||
    !providerMediaId || providerMediaId !== expectedProviderMediaId ||
    typeof media.title !== 'string' || !media.title.trim() || media.title.length > 300 ||
    !Number.isSafeInteger(media.episode) || media.episode! <= 0) {
    throw new Error('Mídia inválida para esta página.');
  }

  return {
    providerId: 'netflix',
    providerMediaId,
    providerEpisodeId: watchId,
    providerSeriesId: titleId,
    providerSeasonNumber: seasonNumber,
    kind: 'ANIME',
    title: media.title.trim(),
    episode: media.episode,
    progressPercent: media.progressPercent,
    canonicalUrl: `${canonical.origin}${canonical.pathname}`,
    seasonTitle: typeof media.seasonTitle === 'string' ? media.seasonTitle.slice(0, 300) : undefined,
    episodeTitle: typeof media.episodeTitle === 'string' ? media.episodeTitle.slice(0, 300) : undefined,
  };
}

export function validateDetection(value: unknown, sender: chrome.runtime.MessageSender): DetectedMedia {
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0) throw new Error('Origem não autorizada.');
  if (!value || typeof value !== 'object') throw new Error('Mídia inválida.');

  const media = value as DetectedMedia;
  if (media.kind !== 'ANIME' || !['crunchyroll', 'netflix'].includes(media.providerId)) {
    throw new Error('Provider inválido.');
  }

  const source = new URL(sender.url ?? '');
  const canonical = new URL(media.canonicalUrl);

  if (!hostAllowed(media.providerId, source.hostname) || !hostAllowed(media.providerId, canonical.hostname)) {
    throw new Error('Origem não autorizada.');
  }

  if (media.providerId === 'crunchyroll') return validateCrunchyroll(media, source, canonical);
  return validateNetflix(media, source, canonical);
}
