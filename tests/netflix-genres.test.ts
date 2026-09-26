// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  classifyNetflixGenreLabels,
  classifyNetflixGenres,
  extractNetflixGenreIdsFromTitleHtml,
  extractNetflixGenreLabelsFromTitleDocument,
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


it('classifies anime from the scoped Netflix genres section when numeric ids are absent', () => {
  const document = new DOMParser().parseFromString(`
    <div class="more-details-cell cell-genres">
      <div class="more-details-label">Genres</div>
      <span class="more-details-item item-genres">Sci-Fi & Fantasy Anime</span>
      <span class="more-details-item item-genres">Anime based on Light Novels</span>
      <span class="more-details-item item-genres">Anime Series</span>
    </div>
    <div>Recommended: Anime title elsewhere</div>
  `, 'text/html');

  const labels = extractNetflixGenreLabelsFromTitleDocument(document);
  expect(labels).toEqual([
    'Sci-Fi & Fantasy Anime',
    'Anime based on Light Novels',
    'Anime Series',
  ]);
  expect(classifyNetflixGenreLabels(labels)).toBe(true);
});

it('does not treat unrelated page text mentioning anime as genre evidence', () => {
  const document = new DOMParser().parseFromString(`
    <div class="more-details-cell cell-genres">
      <span class="more-details-item item-genres">Crime TV Shows</span>
      <span class="more-details-item item-genres">TV Dramas</span>
    </div>
    <section>Because you watched Anime Series</section>
  `, 'text/html');

  const labels = extractNetflixGenreLabelsFromTitleDocument(document);
  expect(labels).toEqual(['Crime TV Shows', 'TV Dramas']);
  expect(classifyNetflixGenreLabels(labels)).toBe(false);
});


it('extracts comma-separated genres from a public Netflix title details section', () => {
  const document = new DOMParser().parseFromString(`
    <section>
      <h3>More Details</h3>
      <div class="detail-row">
        <h4>Genres</h4>
        <p>Sci-Fi &amp; Fantasy Anime, Japanese, Anime based on Light Novels, Anime Series</p>
      </div>
    </section>
  `, 'text/html');

  const labels = extractNetflixGenreLabelsFromTitleDocument(document);
  expect(labels).toEqual([
    'Sci-Fi & Fantasy Anime',
    'Japanese',
    'Anime based on Light Novels',
    'Anime Series',
  ]);
  expect(classifyNetflixGenreLabels(labels)).toBe(true);
});

it('supports Portuguese public genre headings without scanning unrelated recommendations', () => {
  const document = new DOMParser().parseFromString(`
    <section>
      <div>
        <span>Gêneros</span>
        <div>Anime de ficção científica e fantasia, Japonês, Séries de anime</div>
      </div>
      <div>Recomendado porque você viu Anime</div>
    </section>
  `, 'text/html');

  const labels = extractNetflixGenreLabelsFromTitleDocument(document);
  expect(labels).toEqual([
    'Anime de ficção científica e fantasia',
    'Japonês',
    'Séries de anime',
  ]);
  expect(classifyNetflixGenreLabels(labels)).toBe(true);
});
