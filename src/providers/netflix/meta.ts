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

  return url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?watch\/(\d{4,20})(?:\/|$)/i)?.[1] ?? null;
}

export interface NetflixPlayerProbe {
  hasVideo: boolean;
  hasPlayerRoot: boolean;
  hasTitleRoot: boolean;
  active: boolean;
  playerTitleText?: string;
}

export function netflixPlayerProbe(document: Document): NetflixPlayerProbe {
  const video = document.querySelector('video');
  const playerRoot = document.querySelector(
    '[data-uia="watch-video"], [data-uia="video-player"], [data-uia="player"], .watch-video, .watch-video--player-view',
  );
  const titleRoot = document.querySelector(
    '[data-uia="video-title"], [data-uia="player-title"], .video-title',
  );
  const playerTitleText = text(titleRoot?.textContent) ?? undefined;

  const hasVideo = Boolean(video);
  const hasPlayerRoot = Boolean(playerRoot);
  const hasTitleRoot = Boolean(titleRoot);

  return {
    hasVideo,
    hasPlayerRoot,
    hasTitleRoot,
    active: hasVideo && (hasPlayerRoot || hasTitleRoot),
    playerTitleText,
  };
}

function watchIdFromCandidate(value: unknown, base: URL): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    return netflixWatchId(new URL(raw, base));
  } catch {
    return null;
  }
}

export function netflixWatchIdFromDocument(url: URL, document: Document): string | null {
  const direct = netflixWatchId(url);
  if (direct) return direct;

  for (const candidate of [
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content,
  ]) {
    const id = watchIdFromCandidate(candidate, url);
    if (id) return id;
  }

  const scopedRoots = [
    document.querySelector('[data-uia="video-title"]'),
    document.querySelector('[data-uia="player-title"]'),
    document.querySelector('[data-uia="watch-video"]'),
    document.querySelector('[data-uia="video-player"]'),
    document.querySelector('.watch-video'),
  ].filter((value): value is Element => Boolean(value));

  for (const root of scopedRoots) {
    for (const anchor of root.querySelectorAll<HTMLAnchorElement>('a[href*="/watch/"]')) {
      const id = watchIdFromCandidate(anchor.href, url);
      if (id) return id;
    }
    for (const element of [root, ...root.querySelectorAll<HTMLElement>('[data-videoid],[data-video-id]')]) {
      for (const attr of ['data-videoid', 'data-video-id']) {
        const raw = element.getAttribute(attr);
        if (raw && /^\d{4,20}$/.test(raw)) return raw;
      }
    }
  }

  const video = document.querySelector<HTMLVideoElement>('video');
  if (video) {
    for (const attr of ['data-videoid', 'data-video-id']) {
      const raw = video.getAttribute(attr);
      if (raw && /^\d{4,20}$/.test(raw)) return raw;
    }
  }

  return null;
}

export function netflixSeriesIdentity(title: string): string {
  const normalized = title.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  return `title:${normalized.slice(0, 160)}`;
}

export function netflixSeasonIdentity(title: string, season: number): string {
  return `${netflixSeriesIdentity(title)}|season:${season}`;
}

export function netflixProviderMediaIdentity(
  seriesProviderId: string | undefined,
  title: string,
  season: number,
): string {
  const stableSeriesId = seriesProviderId && /^\d{4,20}$/.test(seriesProviderId)
    ? seriesProviderId
    : netflixSeriesIdentity(title);
  return `${stableSeriesId}|season:${season}`;
}

export function parseNetflixSeasonNumber(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return null;

  const compact = raw.match(/\b(?:S|T)\s*(\d{1,4})\s*(?=[:·•-]?\s*E\s*\d)/i);
  if (compact) return safePositiveInteger(compact[1]);

  const verbose = raw.match(/\b(?:season|temporada|saison|staffel|stagione)\s*(\d{1,4})\b/i);
  return verbose ? safePositiveInteger(verbose[1]) : null;
}

export function parseNetflixEpisodeNumber(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return null;

  const compact = raw.match(/\bE\s*(\d{1,5})\b/i);
  if (compact) return safePositiveInteger(compact[1]);

  const verbose = raw.match(/\b(?:episode|epis[oó]dio|épisode|folge|episodio)\s*(\d{1,5})\b/i);
  return verbose ? safePositiveInteger(verbose[1]) : null;
}

export function parseNetflixEpisodeLabel(value: unknown): { season: number; episode: number } | null {
  const season = parseNetflixSeasonNumber(value);
  const episode = parseNetflixEpisodeNumber(value);
  return season && episode ? { season, episode } : null;
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

function seasonFromPlayer(document: Document, titleRoot: Element): number | null {
  const roots = [
    titleRoot.closest('[data-uia="watch-video"], [data-uia="video-player"], [data-uia="player"], .watch-video, .watch-video--player-view'),
    document.querySelector('[data-uia="watch-video"]'),
    document.querySelector('[data-uia="video-player"]'),
    document.querySelector('.watch-video'),
  ].filter((value): value is Element => Boolean(value));

  const selectors = [
    '[data-uia*="season"]',
    '[aria-label*="Temporada" i]',
    '[aria-label*="Season" i]',
    '[aria-label*="Saison" i]',
    '[aria-label*="Staffel" i]',
    '[aria-label*="Stagione" i]',
    'button',
    'span',
  ];

  const seen = new Set<Element>();
  for (const root of roots) {
    for (const selector of selectors) {
      for (const element of root.querySelectorAll(selector)) {
        if (seen.has(element)) continue;
        seen.add(element);
        for (const value of [
          element.textContent,
          element.getAttribute('aria-label'),
          element.getAttribute('data-uia'),
        ]) {
          const season = parseNetflixSeasonNumber(value);
          if (season) return season;
        }
      }
    }
  }

  for (const meta of document.querySelectorAll<HTMLMetaElement>(
    'meta[name*="season" i], meta[property*="season" i]',
  )) {
    const season = parseNetflixSeasonNumber(meta.content);
    if (season) return season;
  }

  return null;
}

function titleFromRoot(root: Element, values: string[]): string | null {
  for (const selector of ['h4', 'h3', 'h2', 'h1']) {
    const value = text(root.querySelector(selector)?.textContent);
    if (value && value.length <= 300 && !parseNetflixEpisodeLabel(value)) return value;
  }

  return values.find(value => !parseNetflixEpisodeLabel(value) && !/^\d+[.:]\d+$/.test(value)) ?? null;
}

export function parseNetflixMetadata(url: URL, document: Document): NetflixMetadata | null {
  const episodeProviderId = netflixWatchIdFromDocument(url, document);
  if (!episodeProviderId) return null;

  const roots = [
    ...document.querySelectorAll('[data-uia="video-title"], [data-uia="player-title"], .video-title'),
  ];

  for (const root of roots) {
    const rootText = text(root.textContent);
    const episode = parseNetflixEpisodeNumber(rootText);
    if (!rootText || !episode) continue;

    const explicitSeason = parseNetflixSeasonNumber(rootText);
    const season = explicitSeason ?? seasonFromPlayer(document, root);
    if (!season) continue;

    const numbering = { season, episode };
    const values = candidateTexts(root);
    const seriesTitle = titleFromRoot(root, values);
    if (!seriesTitle) continue;

    const labelIndex = values.findIndex(value => parseNetflixEpisodeNumber(value) !== null);
    const episodeTitle = values
      .slice(labelIndex >= 0 ? labelIndex + 1 : 0)
      .find(value => value !== seriesTitle && parseNetflixEpisodeNumber(value) === null && parseNetflixSeasonNumber(value) === null);

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
