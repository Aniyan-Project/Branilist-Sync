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
