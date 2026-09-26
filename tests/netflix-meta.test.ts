// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  netflixPlayerProbe,
  netflixSeasonIdentity,
  netflixSeriesIdentity,
  netflixWatchId,
  netflixWatchIdFromDocument,
  parseNetflixEpisodeLabel,
  parseNetflixMetadata,
} from '../src/providers/netflix/meta';

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
});

describe('netflixWatchId', () => {
  it('extracts the numeric watch id from secure Netflix URLs', () => {
    expect(netflixWatchId(new URL('https://www.netflix.com/watch/81234567'))).toBe('81234567');
  });

  it('rejects non-watch and unrelated URLs', () => {
    expect(netflixWatchId(new URL('https://www.netflix.com/browse'))).toBeNull();
    expect(netflixWatchId(new URL('https://example.com/watch/81234567'))).toBeNull();
  });
});

describe('parseNetflixEpisodeLabel', () => {
  it.each([
    ['S1:E2', { season: 1, episode: 2 }],
    ['T2:E10', { season: 2, episode: 10 }],
    ['Season 3 Episode 4', { season: 3, episode: 4 }],
    ['Temporada 4 Episódio 12', { season: 4, episode: 12 }],
  ])('parses %p', (input, expected) => {
    expect(parseNetflixEpisodeLabel(input)).toEqual(expected);
  });

  it.each(['Episode 4', 'Temporada 2', '', null, undefined])(
    'rejects incomplete label %p',
    input => expect(parseNetflixEpisodeLabel(input)).toBeNull(),
  );
});

describe('parseNetflixMetadata', () => {
  it('extracts a conservative season identity from the visible player title', () => {
    document.body.innerHTML = `
      <div data-uia="video-title">
        <h4>Frieren: Beyond Journey's End</h4>
        <span>T1:E5</span>
        <span>Phantoms of the Dead</span>
      </div>
    `;

    expect(
      parseNetflixMetadata(new URL('https://www.netflix.com/watch/81234567'), document),
    ).toEqual({
      providerMediaId: netflixSeasonIdentity("Frieren: Beyond Journey's End", 1),
      episodeProviderId: '81234567',
      providerSeasonId: '1',
      providerSeriesId: netflixSeriesIdentity("Frieren: Beyond Journey's End"),
      seriesTitle: "Frieren: Beyond Journey's End",
      season: 1,
      episode: 5,
      episodeTitle: 'Phantoms of the Dead',
      seasonTitle: 'Season 1',
    });
  });

  it('keeps the mapping identity stable when only the episode/watch id changes', () => {
    const first = netflixSeasonIdentity('Example Anime', 2);
    const second = netflixSeasonIdentity('Example Anime', 2);
    expect(first).toBe(second);
    expect(first).not.toContain('81234567');
  });

  it('fails closed when the player does not expose both season and episode numbering', () => {
    document.body.innerHTML = `
      <div data-uia="video-title">
        <h4>Example Anime</h4>
        <span>Episode 5</span>
      </div>
    `;
    expect(parseNetflixMetadata(new URL('https://www.netflix.com/watch/81234567'), document)).toBeNull();
  });
});


it('accepts a localized Netflix watch path', () => {
  expect(netflixWatchId(new URL('https://www.netflix.com/pt-br/watch/81234567'))).toBe('81234567');
});

it('recovers the watch id from canonical metadata when location is a player overlay route', () => {
  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = 'https://www.netflix.com/watch/81234567';
  document.head.append(canonical);

  expect(
    netflixWatchIdFromDocument(new URL('https://www.netflix.com/browse'), document),
  ).toBe('81234567');
});

it('recognizes active Netflix player evidence independently from the route', () => {
  document.body.innerHTML = `
    <div data-uia="watch-video">
      <video></video>
      <div data-uia="video-title"><span>T1:E1</span></div>
    </div>
  `;
  expect(netflixPlayerProbe(document)).toMatchObject({
    hasVideo: true,
    hasPlayerRoot: true,
    hasTitleRoot: true,
    active: true,
  });
});
