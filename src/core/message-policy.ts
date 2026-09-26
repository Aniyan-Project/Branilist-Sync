import type { DetectedMedia } from './types';
import { crunchyrollMediaId } from '../providers/crunchyroll/meta';
export function trustedPopup(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && !sender.tab && sender.url === chrome.runtime.getURL('src/ui/popup/popup.html');
}
export function validateDetection(value: unknown, sender: chrome.runtime.MessageSender): DetectedMedia {
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0) throw new Error('Origem não autorizada.');
  if (!value || typeof value !== 'object') throw new Error('Mídia inválida.');
  const media = value as DetectedMedia;
  const source = new URL(sender.url ?? '');
  const canonical = new URL(media.canonicalUrl);
  const id = crunchyrollMediaId(source);
  if (!id || crunchyrollMediaId(canonical) !== id || source.origin !== canonical.origin ||
    media.providerId !== 'crunchyroll' || media.kind !== 'ANIME' || media.providerMediaId !== id ||
    typeof media.title !== 'string' || !media.title.trim() || media.title.length > 300 ||
    !Number.isSafeInteger(media.episode) || media.episode! <= 0) throw new Error('Mídia inválida para esta página.');
  return { providerId: 'crunchyroll', providerMediaId: id, kind: 'ANIME', title: media.title.trim(),
    episode: media.episode, progressPercent: media.progressPercent, canonicalUrl: `${source.origin}${source.pathname}`,
    seasonTitle: typeof media.seasonTitle === 'string' ? media.seasonTitle.slice(0, 300) : undefined,
    episodeTitle: typeof media.episodeTitle === 'string' ? media.episodeTitle.slice(0, 300) : undefined };
}
