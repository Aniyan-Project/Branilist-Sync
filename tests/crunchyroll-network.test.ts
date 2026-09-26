import { describe, expect, it } from 'vitest';
import { extractCrunchyrollNetworkEpisodes } from '../src/providers/crunchyroll/network';

describe('Crunchyroll network metadata', () => {
  it('extracts episode identity from a CMS objects response', () => {
    const payload = {
      data: [{
        type: 'episode',
        id: 'G8WUN0X72',
        title: 'É de Qualidade Yui-nyan',
        episode_metadata: {
          episode_number: 3,
          season_id: 'SEASON123',
          series_id: 'G24H1N334',
          series_title: 'The Detective Is Already Dead',
          season_title: 'The Detective Is Already Dead (Portuguese Dub)',
        },
      }],
      total: 1,
    };

    expect(extractCrunchyrollNetworkEpisodes(payload)).toEqual([{
      episodeProviderId: 'G8WUN0X72',
      seasonProviderId: 'SEASON123',
      seriesProviderId: 'G24H1N334',
      seriesTitle: 'The Detective Is Already Dead',
      seasonTitle: 'The Detective Is Already Dead (Portuguese Dub)',
      episodeTitle: 'É de Qualidade Yui-nyan',
      episode: 3,
    }]);
  });

  it('ignores non-episode and incomplete objects', () => {
    const payload = {
      data: [
        { type: 'movie', id: 'MOVIE1', title: 'Movie' },
        { type: 'episode', id: 'BAD1', episode_metadata: { episode_number: 2 } },
        { type: 'episode', id: 'BAD2', episode_metadata: { episode_number: 0, series_title: 'Example' } },
      ],
    };
    expect(extractCrunchyrollNetworkEpisodes(payload)).toEqual([]);
  });

  it('deduplicates the same episode across nested response structures', () => {
    const episode = {
      type: 'episode',
      id: 'G8WUN0X72',
      title: 'Episode 3',
      episode_metadata: {
        episode_number: 3,
        series_id: 'G24H1N334',
        series_title: 'Example',
      },
    };
    expect(extractCrunchyrollNetworkEpisodes({ data: [episode], included: { episode } })).toHaveLength(1);
  });
});
