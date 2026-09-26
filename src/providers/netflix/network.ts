import { netflixSeasonIdentity } from './identity';

export interface NetflixNetworkEpisode {
  watchId: string;
  titleId: string;
  providerMediaId: string;
  seriesTitle: string;
  seasonTitle?: string;
  episodeTitle?: string;
  seasonNumber: number;
  episode: number;
  isMovie: boolean;
}

type Obj = Record<string, unknown>;

const object = (value: unknown): Obj | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const int = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const id = (value: unknown): string | undefined => {
  const normalized = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  return /^\d{1,20}$/.test(normalized) ? normalized : undefined;
};

export function extractNetflixNetworkEpisodes(payload: unknown): NetflixNetworkEpisode[] {
  const found = new Map<string, NetflixNetworkEpisode>();
  const seen = new Set<object>();

  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value as object)) return;
    seen.add(value as object);

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const node = object(value);
    if (!node) return;

    const video = object(node.video);
    if (video) {
      const titleId = id(video.id);
      const seriesTitle = text(video.title);
      const type = text(video.type)?.toLowerCase();
      const seasons = Array.isArray(video.seasons) ? video.seasons : [];

      if (titleId && seriesTitle && type === 'movie') {
        const providerMediaId = netflixSeasonIdentity(titleId, 1);
        if (providerMediaId) {
          found.set(titleId, {
            watchId: titleId,
            titleId,
            providerMediaId,
            seriesTitle,
            seasonNumber: 1,
            episode: 1,
            isMovie: true,
          });
        }
      }

      const currentEpisodeId = id(video.currentEpisode);
      if (titleId && seriesTitle && currentEpisodeId && seasons.length) {
        for (const seasonValue of seasons) {
          const season = object(seasonValue);
          if (!season) continue;
          const seasonNumber = int(season.seq ?? season.season_number ?? season.sequence);
          const episodes = Array.isArray(season.episodes) ? season.episodes : [];
          if (!seasonNumber) continue;

          for (const episodeValue of episodes) {
            const episode = object(episodeValue);
            if (!episode || id(episode.id) !== currentEpisodeId) continue;
            const episodeNumber = int(episode.seq ?? episode.episode_number ?? episode.sequence);
            if (!episodeNumber) continue;
            const providerMediaId = netflixSeasonIdentity(titleId, seasonNumber);
            if (!providerMediaId) continue;

            found.set(currentEpisodeId, {
              watchId: currentEpisodeId,
              titleId,
              providerMediaId,
              seriesTitle,
              seasonTitle: text(season.title),
              episodeTitle: text(episode.title),
              seasonNumber,
              episode: episodeNumber,
              isMovie: false,
            });
          }
        }
      }
    }

    Object.values(node).forEach(visit);
  };

  visit(payload);
  return [...found.values()];
}
