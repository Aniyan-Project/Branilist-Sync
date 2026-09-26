export interface NetflixNetworkEpisode {
  episodeProviderId: string;
  seasonProviderId: string;
  seriesProviderId: string;
  seriesTitle: string;
  season: number;
  episode: number;
  episodeTitle?: string;
}

type Obj = Record<string, unknown>;

const object = (value: unknown): Obj | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;

const positiveInteger = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const numericId = (value: unknown): string | null => {
  const raw = typeof value === 'number' || typeof value === 'string' ? String(value).trim() : '';
  return /^\d{4,20}$/.test(raw) ? raw : null;
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.replace(/\s+/g, ' ').trim().slice(0, 300) : null;

export function extractNetflixNetworkEpisode(payload: unknown): NetflixNetworkEpisode | null {
  const root = object(payload);
  const video = object(root?.video);
  if (!video) return null;

  const seriesProviderId = numericId(video.id);
  const seriesTitle = text(video.title);
  const currentEpisodeId = numericId(video.currentEpisode);
  const seasons = Array.isArray(video.seasons) ? video.seasons : [];

  if (!seriesProviderId || !seriesTitle || !currentEpisodeId) return null;

  for (const seasonValue of seasons) {
    const season = object(seasonValue);
    const seasonNumber = positiveInteger(season?.seq);
    const episodes = Array.isArray(season?.episodes) ? season.episodes : [];
    if (!seasonNumber) continue;

    for (const episodeValue of episodes) {
      const episode = object(episodeValue);
      const episodeProviderId = numericId(episode?.id);
      if (episodeProviderId !== currentEpisodeId) continue;

      const episodeNumber = positiveInteger(episode?.seq);
      if (!episodeNumber) return null;

      return {
        episodeProviderId,
        seasonProviderId: String(seasonNumber),
        seriesProviderId,
        seriesTitle,
        season: seasonNumber,
        episode: episodeNumber,
        episodeTitle: text(episode?.title) ?? undefined,
      };
    }
  }

  return null;
}
