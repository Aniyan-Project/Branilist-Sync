import { ANIME_COMPLETION_PERCENT } from '../core/tracking';
import { observeVideoProgress } from '../core/video-progress';
import type { DetectedMedia, TrackerProvider } from '../core/types';
import { crunchyrollMediaId, parseCrunchyrollMetadata } from './crunchyroll/meta';

export const crunchyrollProvider: TrackerProvider = {
  id: 'crunchyroll',
  name: 'Crunchyroll',
  hosts: ['www.crunchyroll.com', 'crunchyroll.com'],
  kind: 'ANIME',

  matches(url) {
    return Boolean(crunchyrollMediaId(url));
  },

  async detect({ url, document }) {
    const metadata = parseCrunchyrollMetadata(url, document);
    if (!metadata) return null;

    return {
      providerId: this.id,
      providerMediaId: metadata.providerMediaId,
      providerEpisodeId: metadata.episodeProviderId,
      providerSeasonId: metadata.seasonProviderId,
      providerSeriesId: metadata.seriesProviderId,
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
        if (stopped || ctx.document.location.href !== ctx.url.href) return false;
        const current = await thisProvider.detect(ctx);
        if (stopped || ctx.document.location.href !== ctx.url.href || !current?.episode) return false;
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
const thisProvider = crunchyrollProvider;
