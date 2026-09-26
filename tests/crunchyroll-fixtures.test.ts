// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCrunchyrollMetadata } from '../src/providers/crunchyroll/meta';
const url = new URL('https://www.crunchyroll.com/watch/G123/episode');
const fixture = (name: string) => new DOMParser().parseFromString(readFileSync(`tests/fixtures/crunchyroll/${name}.html`, 'utf8'), 'text/html');
describe('representative Crunchyroll HTML', () => {
  it('ignores malformed JSON and site/recommendation titles', () => {
    expect(parseCrunchyrollMetadata(url, fixture('localized'))).toMatchObject({ providerMediaId: 'G123', seriesTitle: 'Série de exemplo', episode: 3 });
  });
  it('resolves graph references and preserves season evidence for backend review', () => {
    expect(parseCrunchyrollMetadata(url, fixture('season-graph'))).toMatchObject({ seriesTitle: 'Example Anime', seasonTitle: 'Season 2', episode: 3 });
  });
  it('never guesses from generic site metadata or episode cards', () => {
    expect(parseCrunchyrollMetadata(url, fixture('unsafe-fallback'))).toBeNull();
  });
  it('blocks stale SPA metadata until canonical URL catches up', () => {
    expect(parseCrunchyrollMetadata(new URL('https://www.crunchyroll.com/watch/G456/next'), fixture('localized'))).toBeNull();
  });
  it.each(['0', '-1', '12.5', 'Special', 'Episode 3 - title'])('blocks unsafe episode number %s', episode => {
    const doc = fixture('localized');
    doc.querySelectorAll('script')[1].textContent = JSON.stringify({ '@type': 'TVEpisode', episodeNumber: episode, partOfSeries: { name: 'Example' } });
    expect(parseCrunchyrollMetadata(url, doc)).toBeNull();
  });
  it('blocks conflicting current-page episode nodes', () => {
    const doc = fixture('localized');
    const script = doc.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({ '@type': 'TVEpisode', url: url.href, episodeNumber: 5, partOfSeries: { name: 'Other' } });
    doc.head.append(script);
    expect(parseCrunchyrollMetadata(url, doc)).toBeNull();
  });
  it.each(['https://evil.test/watch/G123', 'http://www.crunchyroll.com/watch/G123', 'https://www.crunchyroll.com/series/G123'])('blocks unsupported URL %s', href => {
    expect(parseCrunchyrollMetadata(new URL(href), fixture('localized'))).toBeNull();
  });
});
