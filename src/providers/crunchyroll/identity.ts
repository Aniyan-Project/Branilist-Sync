const token = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[A-Z0-9]{4,32}$/i.test(value) ? value : undefined;

const slug = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value) && value.length <= 120
    ? value.toLowerCase()
    : undefined;

export function crunchyrollSeasonIdentity(
  seriesProviderId: unknown,
  seasonSlug: unknown,
  seasonProviderId?: unknown,
  episodeProviderId?: unknown,
): string | undefined {
  const seriesId = token(seriesProviderId);
  const normalizedSlug = slug(seasonSlug);
  if (seriesId && normalizedSlug) return `${seriesId}|${normalizedSlug}`;
  return token(seasonProviderId) ?? seriesId ?? token(episodeProviderId);
}

export function crunchyrollLegacyMappingIds(input: {
  providerMediaId?: string;
  providerSeasonId?: string;
  providerSeriesId?: string;
  providerEpisodeId?: string;
}): string[] {
  const ids = [
    input.providerSeasonId,
    input.providerEpisodeId,
  ].filter((value): value is string => Boolean(value && value !== input.providerMediaId));
  return [...new Set(ids)];
}
