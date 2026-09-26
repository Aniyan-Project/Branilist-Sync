export interface CrunchyrollMetadata {
  providerMediaId: string;
  seriesTitle: string;
  episode: number;
  episodeTitle?: string;
  seasonTitle?: string;
}
type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
export function crunchyrollMediaId(url: URL): string | null {
  if (url.protocol !== 'https:' || !['www.crunchyroll.com', 'crunchyroll.com'].includes(url.hostname) || url.port || url.username || url.password) return null;
  return url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?watch\/([A-Z0-9]+)(?:\/|$)/i)?.[1] ?? null;
}
export function parseEpisodeNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(?:(?:episode|ep\.?|epis[oó]dio)\s*#?\s*)?(\d+(?:[.,]\d+)?)$/i);
  const parsed = match ? Number(match[1].replace(',', '.')) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
function nodes(document: Document): Obj[] {
  const result: Obj[] = [];
  function visit(value: unknown) {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const node = object(value);
    if (!node) return;
    result.push(node);
    if (Array.isArray(node['@graph'])) visit(node['@graph']);
  }
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { visit(JSON.parse(script.textContent ?? '')); } catch { /* Ignore malformed third-party data. */ }
  }
  return result;
}
export function parseCrunchyrollJsonLd(document: Document, url = new URL(document.URL)): Omit<CrunchyrollMetadata, 'providerMediaId'> | null {
  const all = nodes(document);
  const deref = (value: unknown): Obj | null => {
    const obj = object(value);
    const ref = typeof value === 'string' ? value : text(obj?.['@id']);
    return all.find(node => ref && node['@id'] === ref && node !== obj) ?? obj;
  };
  const episodes = all.filter(node => [node['@type']].flat().some(type => type === 'TVEpisode' || type === 'Episode'));
  const candidates: Omit<CrunchyrollMetadata, 'providerMediaId'>[] = [];
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
    candidates.push({ seriesTitle, episode, episodeTitle: text(node.name) ?? undefined,
      seasonTitle: season ? text(season.name) ?? `Season ${text(season.seasonNumber) ?? season.seasonNumber ?? 'unknown'}` : undefined });
  }
  if (!candidates.length) return null;
  const first = candidates[0];
  return candidates.every(item => item.seriesTitle === first.seriesTitle && item.episode === first.episode && item.seasonTitle === first.seasonTitle) ? first : null;
}
export function parseCrunchyrollMetadata(url: URL, document: Document): CrunchyrollMetadata | null {
  const providerMediaId = crunchyrollMediaId(url);
  if (!providerMediaId) return null;
  // SPA transitions can leave the previous episode's metadata mounted briefly.
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content;
  for (const identity of [canonical, ogUrl]) {
    if (identity) {
      try { if (crunchyrollMediaId(new URL(identity, url)) !== providerMediaId) return null; } catch { return null; }
    }
  }
  const structured = parseCrunchyrollJsonLd(document, url);
  if (structured) return { providerMediaId, ...structured };
  // No generic title/class fallback: site names, recommendations and season names
  // are not evidence of the currently playing series.
  return null;
}
