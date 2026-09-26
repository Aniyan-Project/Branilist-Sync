const ANIME_GENRE_IDS = new Set([
  7424, 6721, 9302, 67614, 2653, 587, 625, 79307, 79488, 452,
  79448, 11146, 79440, 3063, 79543, 79427, 10695, 2729, 79329,
  79572, 64256, 2951909, 2867325, 1522234, 1623841, 81216565,
  3073, 3095,
]);

export function netflixAnimeGenreIdsFromHtml(html: string): number[] {
  const normalized = html.replace(/\\\"/g, '"');
  const matches = normalized.match(/"genres"\s*:\s*\[[\s\S]{0,12000}?\]/gi) ?? [];
  const ids = new Set<number>();

  for (const block of matches) {
    for (const match of block.matchAll(/"id"\s*:\s*(\d{1,10})/g)) {
      const value = Number(match[1]);
      if (Number.isSafeInteger(value)) ids.add(value);
    }
  }

  return [...ids];
}

export function netflixTitleLooksAnime(html: string): boolean {
  const ids = netflixAnimeGenreIdsFromHtml(html);
  if (ids.some(id => ANIME_GENRE_IDS.has(id))) return true;

  // Conservative fallback for payloads that expose localized labels rather than IDs.
  const normalized = html.replace(/\\\"/g, '"');
  const genreBlocks = normalized.match(/"genres"\s*:\s*\[[\s\S]{0,12000}?\]/gi) ?? [];
  return genreBlocks.some(block => /\banime\b/i.test(block));
}
