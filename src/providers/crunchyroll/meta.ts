export interface CrunchyrollMetadata {
  providerMediaId: string;
  episodeProviderId: string;
  seasonProviderId?: string;
  seriesProviderId?: string;
  seriesTitle: string;
  episode: number;
  episodeTitle?: string;
  seasonTitle?: string;
}
type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const providerToken = (value: unknown): string | null => {
  const raw = text(value);
  return raw && /^[A-Z0-9]{4,32}$/i.test(raw) ? raw : null;
};

export function crunchyrollMediaId(url: URL): string | null {
  if (url.protocol !== 'https:' || !['www.crunchyroll.com', 'crunchyroll.com'].includes(url.hostname) || url.port || url.username || url.password) return null;
  return url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?watch\/([A-Z0-9]+)(?:\/|$)/i)?.[1] ?? null;
}

export function crunchyrollSeriesId(url: URL): string | null {
  if (url.protocol !== 'https:' || !['www.crunchyroll.com', 'crunchyroll.com'].includes(url.hostname) || url.port || url.username || url.password) return null;
  return url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?series\/([A-Z0-9]+)(?:\/|$)/i)?.[1] ?? null;
}

function entityId(value: unknown, kind: 'series' | 'season'): string | null {
  const node = object(value);
  if (!node) return providerToken(value);
  for (const candidate of [node.identifier, node.id, node[kind + '_id'], node[kind + 'Id']]) {
    const direct = providerToken(candidate);
    if (direct) return direct;
  }
  for (const candidate of [node.url, node['@id']]) {
    const raw = text(candidate);
    if (!raw || raw.startsWith('#')) continue;
    const direct = providerToken(raw);
    if (direct) return direct;
    try {
      const url = new URL(raw, 'https://www.crunchyroll.com');
      if (kind === 'series') {
        const series = crunchyrollSeriesId(url);
        if (series) return series;
      }
      const pattern = kind === 'season'
        ? /\/(?:seasons?|content\/v2\/cms\/seasons)\/([A-Z0-9]+)(?:\/|$)/i
        : /\/(?:series|content\/v2\/cms\/series)\/([A-Z0-9]+)(?:\/|$)/i;
      const match = url.pathname.match(pattern);
      if (match) return match[1];
    } catch {
      // Ignore non-URL identifiers.
    }
  }
  return null;
}

export function parseEpisodeNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(?:(?:episode|ep\.?|epis[oó]dio)\s*#?\s*)?(\d+(?:[.,]\d+)?)$/i);
  const parsed = match ? Number(match[1].replace(',', '.')) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function jsonNodes(document: Document, selector: string): Obj[] {
  const result: Obj[] = [];
  function visit(value: unknown) {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const node = object(value);
    if (!node) return;
    result.push(node);
    for (const child of Object.values(node)) {
      if (child && typeof child === 'object') visit(child);
    }
  }
  for (const script of document.querySelectorAll(selector)) {
    try { visit(JSON.parse(script.textContent ?? '')); } catch { /* Ignore malformed third-party data. */ }
  }
  return result;
}

function nodes(document: Document): Obj[] {
  return jsonNodes(document, 'script[type="application/ld+json"]');
}

interface EmbeddedIdentity {
  seasonProviderId?: string;
  seriesProviderId?: string;
  conflict: boolean;
}

export function parseCrunchyrollEmbeddedIdentity(document: Document, episodeProviderId: string): EmbeddedIdentity {
  const matches = jsonNodes(document, 'script[type="application/json"]')
    .filter(node => {
      const ids = [node.id, node.episode_id, node.episodeId, node.content_id, node.contentId]
        .map(providerToken)
        .filter(Boolean);
      if (ids.includes(episodeProviderId)) return true;
      for (const candidate of [node.url, node.href]) {
        const raw = text(candidate);
        if (!raw) continue;
        try { if (crunchyrollMediaId(new URL(raw, document.URL)) === episodeProviderId) return true; } catch { /* ignore */ }
      }
      return false;
    });

  const seasons = new Set<string>();
  const series = new Set<string>();
  for (const node of matches) {
    const season = providerToken(node.season_id) ?? providerToken(node.seasonId) ?? entityId(node.season, 'season');
    const serie = providerToken(node.series_id) ?? providerToken(node.seriesId) ?? entityId(node.series, 'series');
    if (season) seasons.add(season);
    if (serie) series.add(serie);
  }
  return {
    seasonProviderId: seasons.size === 1 ? [...seasons][0] : undefined,
    seriesProviderId: series.size === 1 ? [...series][0] : undefined,
    conflict: seasons.size > 1 || series.size > 1,
  };
}

export function parseCrunchyrollJsonLd(document: Document, url = new URL(document.URL)): Omit<CrunchyrollMetadata, 'providerMediaId' | 'episodeProviderId'> | null {
  const all = nodes(document);
  const deref = (value: unknown): Obj | null => {
    const obj = object(value);
    const ref = typeof value === 'string' ? value : text(obj?.['@id']);
    return all.find(node => ref && node['@id'] === ref && node !== obj) ?? obj;
  };
  const episodes = all.filter(node => [node['@type']].flat().some(type => type === 'TVEpisode' || type === 'Episode'));
  const candidates: Omit<CrunchyrollMetadata, 'providerMediaId' | 'episodeProviderId'>[] = [];
  for (const node of episodes) {
    const identity = text(node.url) ?? text(node['@id']);
    if (identity && !identity.startsWith('#')) {
      try { if (crunchyrollMediaId(new URL(identity, url)) !== crunchyrollMediaId(url)) continue; } catch { continue; }
    } else if (episodes.length !== 1) continue;
    const episode = parseEpisodeNumber(node.episodeNumber);
    const season = deref(node.partOfSeason);
    const series = deref(node.partOfSeries) ?? deref(season?.partOfSeries);
    const seriesTitle = text(series?.name) ?? text(series?.headline);
    if (!episode || !Number.isSafeInteger(episode) || !seriesTitle || /^crunchyroll$/i.test(seriesTitle)) continue;
    const seasonNumber = season ? text(season.seasonNumber) ?? season.seasonNumber : undefined;
    candidates.push({
      seriesTitle,
      episode,
      episodeTitle: text(node.name) ?? undefined,
      seasonTitle: season ? text(season.name) ?? ('Season ' + (seasonNumber ?? 'unknown')) : undefined,
      seasonProviderId: entityId(season, 'season') ?? undefined,
      seriesProviderId: entityId(series, 'series') ?? undefined,
    });
  }
  if (!candidates.length) return null;
  const first = candidates[0];
  return candidates.every(item =>
    item.seriesTitle === first.seriesTitle &&
    item.episode === first.episode &&
    item.seasonTitle === first.seasonTitle &&
    item.seasonProviderId === first.seasonProviderId &&
    item.seriesProviderId === first.seriesProviderId
  ) ? first : null;
}

function seriesIdFromExactTitleLink(document: Document, seriesTitle: string): string | undefined {
  const normalized = seriesTitle.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const ids = new Set<string>();
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href*="/series/"]')) {
    if (anchor.textContent?.trim().replace(/\s+/g, ' ').toLocaleLowerCase() !== normalized) continue;
    try {
      const href = anchor.getAttribute('href');
      if (!href) continue;
      const id = crunchyrollSeriesId(new URL(href, 'https://www.crunchyroll.com'));
      if (id) ids.add(id);
    } catch { /* ignore malformed links */ }
  }
  return ids.size === 1 ? [...ids][0] : undefined;
}

export function parseCrunchyrollMetadata(url: URL, document: Document): CrunchyrollMetadata | null {
  const episodeProviderId = crunchyrollMediaId(url);
  if (!episodeProviderId) return null;
  // Crunchyroll keeps canonical/og:url stale across SPA episode navigation.
  // The live /watch/{episodeId} URL is authoritative; structured episode data
  // below must still bind to that exact episode ID before we accept it.
  const structured = parseCrunchyrollJsonLd(document, url);
  if (!structured) return null;
  const embedded = parseCrunchyrollEmbeddedIdentity(document, episodeProviderId);
  if (embedded.conflict) return null;
  if (structured.seasonProviderId && embedded.seasonProviderId && structured.seasonProviderId !== embedded.seasonProviderId) return null;
  if (structured.seriesProviderId && embedded.seriesProviderId && structured.seriesProviderId !== embedded.seriesProviderId) return null;

  const seasonProviderId = structured.seasonProviderId ?? embedded.seasonProviderId;
  const seriesProviderId = structured.seriesProviderId ?? embedded.seriesProviderId ?? seriesIdFromExactTitleLink(document, structured.seriesTitle);

  return {
    ...structured,
    episodeProviderId,
    seasonProviderId,
    seriesProviderId,
    providerMediaId: seasonProviderId ?? seriesProviderId ?? episodeProviderId,
  };
}
