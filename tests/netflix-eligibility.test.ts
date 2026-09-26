import { describe, expect, it } from 'vitest';
import { netflixAnimeGenreIdsFromHtml, netflixTitleLooksAnime } from '../src/providers/netflix/eligibility';

describe('Netflix anime eligibility', () => {
  it('detects known anime genre IDs from embedded title metadata', () => {
    const html = '<script>{"genres":[{"id":7424,"name":"Anime"},{"id":83,"name":"TV"}]}</script>';
    expect(netflixAnimeGenreIdsFromHtml(html)).toEqual([7424, 83]);
    expect(netflixTitleLooksAnime(html)).toBe(true);
  });

  it('rejects ordinary non-anime titles', () => {
    const html = '<script>{"genres":[{"id":83,"name":"TV Dramas"},{"id":6548,"name":"Comedies"}]}</script>';
    expect(netflixTitleLooksAnime(html)).toBe(false);
  });

  it('accepts an explicit anime genre label as conservative fallback', () => {
    const html = '<script>{"genres":[{"id":999999,"name":"Anime Series"}]}</script>';
    expect(netflixTitleLooksAnime(html)).toBe(true);
  });

  it('parses escaped JSON blobs from the title page', () => {
    const html = '<script>{\\"genres\\":[{\\"id\\":7424,\\"name\\":\\"Anime\\"}]}</script>';
    expect(netflixTitleLooksAnime(html)).toBe(true);
  });
});
