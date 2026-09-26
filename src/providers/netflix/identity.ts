export function netflixWatchId(url: URL): string | undefined {
  if (!['www.netflix.com', 'netflix.com'].includes(url.hostname)) return undefined;
  const match = url.pathname.match(/\/watch\/(\d+)(?:\/|$)/);
  return match?.[1];
}

export function netflixSeasonIdentity(titleId: unknown, seasonNumber: unknown): string | undefined {
  const id = typeof titleId === 'number' || typeof titleId === 'string' ? String(titleId) : '';
  const season = Number(seasonNumber);
  if (!/^\d{1,20}$/.test(id) || !Number.isSafeInteger(season) || season < 1 || season > 999) return undefined;
  return `${id}?s=${season}`;
}
