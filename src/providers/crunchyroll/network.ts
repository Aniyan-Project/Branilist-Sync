export interface CrunchyrollNetworkEpisode {
  episodeProviderId: string;
  seasonProviderId?: string;
  seasonSlug?: string;
  seriesProviderId?: string;
  seriesTitle: string;
  seasonTitle?: string;
  episodeTitle?: string;
  episode: number;
}

type Obj = Record<string, unknown>;

const object = (value: unknown): Obj | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const token = (value: unknown): string | undefined => {
  const valueText = text(value);
  return valueText && /^[A-Z0-9]{4,32}$/i.test(valueText) ? valueText : undefined;
};

const positiveEpisode = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export function extractCrunchyrollNetworkEpisodes(payload: unknown): CrunchyrollNetworkEpisode[] {
  const found = new Map<string, CrunchyrollNetworkEpisode>();
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

    if (node.type === 'episode') {
      const meta = object(node.episode_metadata);
      const episodeProviderId = token(node.id);
      const episode = positiveEpisode(meta?.episode_number);
      const seriesTitle = text(meta?.series_title);

      if (episodeProviderId && episode && seriesTitle) {
        found.set(episodeProviderId, {
          episodeProviderId,
          seasonProviderId: token(meta?.season_id),
          seasonSlug: text(meta?.season_slug_title),
          seriesProviderId: token(meta?.series_id),
          seriesTitle,
          seasonTitle: text(meta?.season_title),
          episodeTitle: text(node.title),
          episode,
        });
      }
    }

    Object.values(node).forEach(visit);
  };

  visit(payload);
  return [...found.values()];
}
