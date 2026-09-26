import { observeVideoProgress } from '../core/video-progress';
import type { DetectedMedia, TrackerProvider } from '../core/types';
import { parseCrunchyrollMetadata } from './crunchyroll/meta';

export const crunchyrollProvider: TrackerProvider = {
  id: 'crunchyroll',
  name: 'Crunchyroll',
  hosts: ['www.crunchyroll.com', 'crunchyroll.com'],
  kind: 'ANIME',

  matches(url) {
    return this.hosts.includes(url.hostname) && /\/watch\//.test(url.pathname);
  },

  async detect({ url, document }) {
    const metadata = parseCrunchyrollMetadata(url, document);
    if (!metadata) return null;

    return {
      providerId: this.id,
      providerMediaId: metadata.providerMediaId,
      kind: 'ANIME',
      title: metadata.seriesTitle,
      episode: metadata.episode,
      episodeTitle: metadata.episodeTitle,
      canonicalUrl: url.href,
    };
  },

  observe(ctx, emit) {
    let current: DetectedMedia | null = null;

    void this.detect(ctx).then((detected) => {
      current = detected;
    });

    const stopProgress = observeVideoProgress(ctx.document, {
      thresholdPercent: 80,
      onThreshold(progressPercent) {
        if (!current?.episode) return;

        emit({
          ...current,
          progressPercent,
        });
      },
    });

    return () => {
      stopProgress();
    };
  },
};
