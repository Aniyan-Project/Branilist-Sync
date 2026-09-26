import { describe, expect, it } from 'vitest';
import { crunchyrollMediaId, parseEpisodeNumber } from '../src/providers/crunchyroll/meta';

describe('crunchyrollMediaId', () => {
  it('extracts the stable watch id', () => {
    expect(
      crunchyrollMediaId(new URL('https://www.crunchyroll.com/watch/GE00379230JAJP/leave-it-to-laffey')),
    ).toBe('GE00379230JAJP');
  });

  it('does not match non-watch pages', () => {
    expect(crunchyrollMediaId(new URL('https://www.crunchyroll.com/series/ABC/example'))).toBeNull();
  });
});

describe('parseEpisodeNumber', () => {
  it.each([
    ['Episode 7', 7],
    ['Ep. 12', 12],
    ['Episódio 3', 3],
    ['episodio 9', 9],
    [4, 4],
    ['12.5', 12.5],
  ])('parses %p as %p', (input, expected) => {
    expect(parseEpisodeNumber(input)).toBe(expected);
  });

  it.each(['Special', '', 'Episode zero', 0, -1, null, undefined])(
    'rejects unsafe value %p',
    (input) => {
      expect(parseEpisodeNumber(input)).toBeNull();
    },
  );
});
