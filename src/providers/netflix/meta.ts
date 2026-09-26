export interface NetflixMetadata {
  providerMediaId: string;
  episodeProviderId: string;
  providerSeasonId: string;
  providerSeriesId: string;
  seriesTitle: string;
  season: number;
  episode: number;
  episodeTitle?: string;
  seasonTitle?: string;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.replace(/\s+/g, ' ').trim() : null;

function safePositiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function netflixWatchId(url: URL): string | null {
  if (
    url.protocol !== 'https:' ||
    !['www.netflix.com', 'netflix.com'].includes(url.hostname) ||
    url.port ||
    url.username ||
    url.password
  ) return null;

  return url.pathname.match(/^\/watch\/(\d{4,20})(?:\/|$)/)?.[1] ?? null;
}

export function netflixSeriesIdentity(title: string): string {
  const normalized = title.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  return `title:${normalized.slice(0, 160)}`;
}

export function netflixSeasonIdentity(title: string, season: number): string {
  return `${netflixSeriesIdentity(title)}|season:${season}`;
}

export function parseNetflixEpisodeLabel(value: unknown): { season: number; episode: number } | null {
  const raw = text(value);
  if (!raw) return null;

  const compact = raw.match(/\b(?:S|T)\s*(\d{1,4})\s*[:·•-]\s*E\s*(\d{1,5})\b/i);
  if (compact) {
    const season = safePositiveInteger(compact[1]);
    const episode = safePositiveInteger(compact[2]);
    return season && episode ? { season, episode } : null;
  }

  const verbose = raw.match(
    /\b(?:season|temporada|saison|staffel|stagione)\s*(\d{1,4})\b[^\d]{0,50}\b(?:episode|epis[oó]dio|épisode|folge|episodio)\s*(\d{1,5})\b/i,
  );
  if (verbose) {
    const season = safePositiveInteger(verbose[1]);
    const episode = safePositiveInteger(verbose[2]);
    return season && episode ? { season, episode } : null;
  }

  return null;
}

function candidateTexts(root: Element): string[] {
  const values: string[] = [];
  const seen = new Set<string>();

  for (const element of root.querySelectorAll('h1,h2,h3,h4,strong,span')) {
    const value = text(element.textContent);
    if (!value || value.length > 300 || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }

  return values;
}

function titleFromRoot(root: Element, values: string[]): string | null {
  for (const selector of ['h4', 'h3', 'h2', 'h1']) {
    const value = text(root.querySelector(selector)?.textContent);
    if (value && value.length <= 300 && !parseNetflixEpisodeLabel(value)) return value;
  }

  return values.find(value => !parseNetflixEpisodeLabel(value) && !/^\d+[.:]\d+$/.test(value)) ?? null;
}

export function parseNetflixMetadata(url: URL, document: Document): NetflixMetadata | null {
  const episodeProviderId = netflixWatchId(url);
  if (!episodeProviderId) return null;

  const roots = [
    ...document.querySelectorAll('[data-uia="video-title"], [data-uia="player-title"], .video-title'),
  ];

  for (const root of roots) {
    const rootText = text(root.textContent);
    const numbering = parseNetflixEpisodeLabel(rootText);
    if (!rootText || !numbering) continue;

    const values = candidateTexts(root);
    const seriesTitle = titleFromRoot(root, values);
    if (!seriesTitle) continue;

    const labelIndex = values.findIndex(value => parseNetflixEpisodeLabel(value) !== null);
    const episodeTitle = values
      .slice(labelIndex >= 0 ? labelIndex + 1 : 0)
      .find(value => value !== seriesTitle && !parseNetflixEpisodeLabel(value));

    const providerSeriesId = netflixSeriesIdentity(seriesTitle);
    const providerSeasonId = String(numbering.season);

    return {
      providerMediaId: netflixSeasonIdentity(seriesTitle, numbering.season),
      episodeProviderId,
      providerSeasonId,
      providerSeriesId,
      seriesTitle,
      season: numbering.season,
      episode: numbering.episode,
      episodeTitle,
      seasonTitle: `Season ${numbering.season}`,
    };
  }

  return null;
}
