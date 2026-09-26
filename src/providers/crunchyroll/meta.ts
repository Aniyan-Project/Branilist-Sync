export interface CrunchyrollMetadata {
  providerMediaId: string;
  seriesTitle: string;
  episode: number;
  episodeTitle?: string;
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function crunchyrollMediaId(url: URL): string | null {
  const match = url.pathname.match(/\/watch\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

export function parseEpisodeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (!normalized) return null;

  const direct = Number(normalized.replace(',', '.'));
  if (Number.isFinite(direct) && direct > 0) return direct;

  const match = normalized.match(/(?:episode|ep\.?|epis[oó]dio)\s*#?\s*(\d+(?:[.,]\d+)?)/i);
  if (!match) return null;

  const parsed = Number(match[1].replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseJsonLdNode(node: unknown): Omit<CrunchyrollMetadata, 'providerMediaId'> | null {
  const obj = asObject(node);
  if (!obj) return null;

  const graph = Array.isArray(obj['@graph']) ? obj['@graph'] : null;
  if (graph) {
    for (const child of graph) {
      const parsed = parseJsonLdNode(child);
      if (parsed) return parsed;
    }
  }

  const rawType = obj['@type'];
  const types = Array.isArray(rawType) ? rawType : [rawType];
  const isEpisode = types.some((type) =>
    typeof type === 'string' && /TVEpisode|Episode/i.test(type),
  );
  if (!isEpisode) return null;

  const episode = parseEpisodeNumber(obj.episodeNumber);
  if (!episode) return null;

  const series =
    asObject(obj.partOfSeries) ??
    asObject(obj.partOfSeason) ??
    asObject(obj.isPartOf);

  const seriesTitle =
    asNonEmptyString(series?.name) ??
    asNonEmptyString(series?.headline);

  if (!seriesTitle) return null;

  return {
    seriesTitle,
    episode,
    episodeTitle: asNonEmptyString(obj.name) ?? undefined,
  };
}

export function parseCrunchyrollJsonLd(document: Document): Omit<CrunchyrollMetadata, 'providerMediaId'> | null {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');

  for (const script of scripts) {
    if (!script.textContent?.trim()) continue;

    try {
      const json = JSON.parse(script.textContent) as unknown;
      const nodes = Array.isArray(json) ? json : [json];

      for (const node of nodes) {
        const parsed = parseJsonLdNode(node);
        if (parsed) return parsed;
      }
    } catch {
      // JSON-LD de terceiros pode ser inválido; seguimos para as próximas fontes.
    }
  }

  return null;
}

function metaContent(document: Document, selectors: string[]): string | null {
  for (const selector of selectors) {
    const content = document.querySelector<HTMLMetaElement>(selector)?.content?.trim();
    if (content) return content;
  }
  return null;
}

export function parseCrunchyrollMetadata(url: URL, document: Document): CrunchyrollMetadata | null {
  const providerMediaId = crunchyrollMediaId(url);
  if (!providerMediaId) return null;

  const structured = parseCrunchyrollJsonLd(document);
  if (structured) {
    return { providerMediaId, ...structured };
  }

  // Fallback conservador. Só sincroniza se conseguirmos título de série e episódio separadamente.
  const seriesTitle = metaContent(document, [
    'meta[property="og:site_name"]',
    'meta[name="twitter:title"]',
  ]);

  const episodeText =
    document.querySelector('[data-t="episode-number"]')?.textContent ??
    document.querySelector('[class*="episode"]')?.textContent ??
    '';

  const episode = parseEpisodeNumber(episodeText);

  if (!seriesTitle || !episode) return null;

  return {
    providerMediaId,
    seriesTitle,
    episode,
    episodeTitle: metaContent(document, ['meta[property="og:title"]']) ?? undefined,
  };
}
