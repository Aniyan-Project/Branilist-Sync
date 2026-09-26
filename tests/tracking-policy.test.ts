import { describe, expect, it } from 'vitest';
import { ANIME_COMPLETION_PERCENT, shouldTrackProgress } from '../src/core/tracking';
import type { DetectedMedia } from '../src/core/types';

const anime: DetectedMedia = {
  providerId: 'crunchyroll',
  providerMediaId: 'G123',
  kind: 'ANIME',
  title: 'Example Anime',
  episode: 3,
  progressPercent: 90,
  canonicalUrl: 'https://www.crunchyroll.com/watch/G123/example',
};

describe('tracking policy', () => {
  it('uses the backend anime completion threshold', () => {
    expect(ANIME_COMPLETION_PERCENT).toBe(90);
    expect(shouldTrackProgress({ ...anime, progressPercent: 89.9 })).toBe(false);
    expect(shouldTrackProgress(anime)).toBe(true);
  });

  it('requires an integer chapter for manga', () => {
    const manga: DetectedMedia = {
      providerId: 'comikey',
      kind: 'MANGA',
      title: 'Example Manga',
      chapter: 12,
      canonicalUrl: 'https://comikey.com/read/example',
    };

    expect(shouldTrackProgress(manga)).toBe(true);
    expect(shouldTrackProgress({ ...manga, chapter: 12.5 })).toBe(false);
  });

});
