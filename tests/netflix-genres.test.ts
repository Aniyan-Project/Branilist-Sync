import { describe, expect, it } from 'vitest';
import {
  classifyNetflixGenres,
  extractNetflixGenreIdsFromTitleHtml,
  NETFLIX_ANIME_GENRE_IDS,
} from '../src/providers/netflix/genres';

describe('Netflix anime genre classification', () => {
  it('extracts genre ids from Netflix title HTML', () => {
    const html = `
      <script>
        window.__data = {
          "genres": [
            {"id": 7424, "name": "Anime"},
            {"id": 11146, "name": "Fantasy"}
          ]
        };
      </script>
    `;

    expect(extractNetflixGenreIdsFromTitleHtml(html)).toEqual([7424, 11146]);
  });

  it('extracts genre ids from escaped JSON-like title payloads', () => {
    const html = String.raw`{"genres":[{"id":6721},{"id":999999}]}`;
    expect(extractNetflixGenreIdsFromTitleHtml(html)).toEqual([6721, 999999]);
  });

  it('confirms anime when any Netflix anime genre id matches', () => {
    expect(NETFLIX_ANIME_GENRE_IDS.has(7424)).toBe(true);
    expect(classifyNetflixGenres([999999, 7424])).toEqual({
      genreIds: [999999, 7424],
      isAnime: true,
    });
  });

  it('rejects ordinary series and movies without an anime genre id', () => {
    expect(classifyNetflixGenres([83, 11714, 6548])).toEqual({
      genreIds: [83, 11714, 6548],
      isAnime: false,
    });
  });

  it('fails closed when no genres can be extracted', () => {
    expect(extractNetflixGenreIdsFromTitleHtml('<html><body>No genres</body></html>')).toEqual([]);
    expect(classifyNetflixGenres([]).isAnime).toBe(false);
  });
});
