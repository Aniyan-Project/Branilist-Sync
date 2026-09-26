import { ANIME_COMPLETION_PERCENT } from '../core/tracking';
import { observeVideoProgress } from '../core/video-progress';
import type { DetectedMedia, TrackerProvider } from '../core/types';
import {
  netflixProviderMediaIdentity,
  netflixWatchId,
  netflixWatchIdFromDocument,
  parseNetflixMetadata,
} from './netflix/meta';
import type { NetflixNetworkEpisode } from './netflix/network';

let latestNetworkEpisode: NetflixNetworkEpisode | null = null;

export function setNetflixNetworkEpisode(value: NetflixNetworkEpisode | null): void {
  latestNetworkEpisode = value;
}

function fromNetwork(url: URL, document: Document): DetectedMedia | null {
  const episode = latestNetworkEpisode;
  if (!episode) return null;

  const liveWatchId = netflixWatchIdFromDocument(url, document);
  if (!liveWatchId || liveWatchId !== episode.episodeProviderId) return null;

  return {
    providerId: 'netflix',
    providerMediaId: netflixProviderMediaIdentity(
      episode.seriesProviderId,
      episode.seriesTitle,
      episode.season,
    ),
    providerEpisodeId: episode.episodeProviderId,
    providerSeasonId: episode.seasonProviderId,
    providerSeriesId: episode.seriesProviderId,
    kind: 'ANIME',
    title: episode.seriesTitle,
    episode: episode.episode,
    episodeTitle: episode.episodeTitle,
    seasonTitle: `Season ${episode.season}`,
    canonicalUrl: `${url.origin}${url.pathname}`,
  };
}

export const netflixProvider: TrackerProvider = {
  id: 'netflix',
  name: 'Netflix',
  hosts: ['www.netflix.com', 'netflix.com'],
  kind: 'ANIME',

  matches(url) {
    return Boolean(netflixWatchId(url));
  },

  async detect({ url, document }) {
    const network = fromNetwork(url, document);
    if (network) return network;

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
        const current = await thisProvider.detect({
          url: new URL(location.href),
          document: ctx.document,
        });
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
