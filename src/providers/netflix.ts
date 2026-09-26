import { ANIME_COMPLETION_PERCENT } from '../core/tracking';
import { observeVideoProgress } from '../core/video-progress';
import type { TrackerProvider } from '../core/types';
import { netflixWatchId, parseNetflixMetadata } from './netflix/meta';

export const netflixProvider: TrackerProvider = {
  id: 'netflix',
  name: 'Netflix',
  hosts: ['www.netflix.com', 'netflix.com'],
  kind: 'ANIME',

  matches(url) {
    return Boolean(netflixWatchId(url));
  },

  async detect({ url, document }) {
    const metadata = parseNetflixMetadata(url, document);
    if (!metadata) return null;

    return {
      providerId: this.id,
      providerMediaId: metadata.providerMediaId,
      providerEpisodeId: metadata.episodeProviderId,
      providerSeasonId: metadata.providerSeasonId,
      providerSeriesId: metadata.providerSeriesId,
      kind: 'ANIME',
      title: metadata.seriesTitle,
      episode: metadata.episode,
      episodeTitle: metadata.episodeTitle,
      seasonTitle: metadata.seasonTitle,
      canonicalUrl: `${url.origin}${url.pathname}`,
    };
  },

  observe(ctx, emit) {
    let stopped = false;

    const stopProgress = observeVideoProgress(ctx.document, {
      thresholdPercent: ANIME_COMPLETION_PERCENT,
      async onThreshold(progressPercent) {
        if (stopped) return false;
        const current = await thisProvider.detect(ctx);
        if (stopped || !current?.episode) return false;
        emit({ ...current, progressPercent });
        return true;
      },
    });

    return () => {
      stopped = true;
      stopProgress();
    };
  },
};

const thisProvider = netflixProvider;
