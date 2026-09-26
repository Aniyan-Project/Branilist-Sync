import type { DetectedMedia } from './types';

export const ANIME_COMPLETION_PERCENT = 90;

export function shouldTrackProgress(media: DetectedMedia): boolean {
  if (media.kind === 'ANIME') {
    return Boolean(media.episode && (media.progressPercent ?? 0) >= ANIME_COMPLETION_PERCENT);
  }
  return Boolean(media.chapter && Number.isInteger(media.chapter));
}

export function stableEventKey(media: DetectedMedia, occurredAt: string): string {
  const identity = [
    media.providerId,
    media.providerMediaId ?? '',
    media.kind,
    media.title,
    media.episode ?? '',
    media.chapter ?? '',
    media.canonicalUrl,
    occurredAt,
  ].join('|');

  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `branilist-sync-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
