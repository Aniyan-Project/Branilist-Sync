export const NETFLIX_ANIME_GENRE_IDS = new Set<number>([
  2797624,
  7424,
  67614,
  2653,
  587,
  625,
  79307,
  9302,
  79488,
  452,
  79448,
  11146,
  79440,
  3063,
  79543,
  79427,
  10695,
  2729,
  79329,
  79572,
  64256,
  2951909,
  6721,
  2867325,
  1522234,
  1623841,
  81216565,
  3073,
  3095,
]);

export interface NetflixGenreClassification {
  genreIds: number[];
  isAnime: boolean;
}

function uniquePositiveIntegers(values: unknown[]): number[] {
  return [...new Set(values
    .map(value => typeof value === 'number' ? value : Number(value))
    .filter(value => Number.isSafeInteger(value) && value > 0))];
}

export function extractNetflixGenreIdsFromTitleHtml(html: string): number[] {
  if (!html || html.length > 10_000_000) return [];

  const candidates = [
    ...html.matchAll(/["']genres["']\s*:\s*(\[[\s\S]*?\])/gi),
    ...html.matchAll(/\\?"genres\\?"\s*:\s*(\[[\s\S]*?\])/gi),
  ];

  for (const match of candidates) {
    const raw = match[1];
    if (!raw || raw.length > 250_000) continue;

    const normalized = raw
      .replace(/\\(["'\\/bfnrt])/g, '$1')
      .replace(/\\u([0-9a-f]{4})/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)));

    const ids = uniquePositiveIntegers(
      [...normalized.matchAll(/["']?id["']?\s*:\s*["']?(\d{1,12})["']?/gi)]
        .map(item => item[1]),
    );

    if (ids.length) return ids;
  }

  return [];
}

export function classifyNetflixGenres(genreIds: number[]): NetflixGenreClassification {
  const ids = uniquePositiveIntegers(genreIds);
  return {
    genreIds: ids,
    isAnime: ids.some(id => NETFLIX_ANIME_GENRE_IDS.has(id)),
  };
}


const normalizeLabel = (value: string): string =>
  value.replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function extractNetflixGenreLabelsFromTitleDocument(document: Document): string[] {
  const selectors = [
    '.more-details-cell.cell-genres .more-details-item',
    '.more-details-item.item-genres',
    '[data-uia*="genre" i]:not([data-uia*="container" i])',
  ];

  const values: string[] = [];
  const seen = new Set<string>();

  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      const label = normalizeLabel(element.textContent ?? '');
      if (!label || label.length > 200 || seen.has(label)) continue;
      seen.add(label);
      values.push(label);
    }
  }

  return values.slice(0, 50);
}

export function classifyNetflixGenreLabels(labels: string[]): boolean {
  return labels.some(label => {
    const normalized = label.normalize('NFKC').toLowerCase();
    return /\banime\b/.test(normalized);
  });
}
