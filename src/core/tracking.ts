import type { DetectedMedia } from './types';
export const ANIME_COMPLETION_PERCENT = 90;
export function shouldTrackProgress(media: DetectedMedia): boolean {
  if (media.kind === 'ANIME') {
    return Number.isSafeInteger(media.episode) && media.episode! > 0 &&
      Number.isFinite(media.progressPercent) && media.progressPercent! >= ANIME_COMPLETION_PERCENT && media.progressPercent! <= 100;
  }
  return media.kind === 'MANGA' && Number.isSafeInteger(media.chapter) && media.chapter! > 0;
}
