import { describe, expect, it } from 'vitest';
import { extractNetflixNetworkEpisodes } from '../src/providers/netflix/network';

describe('Netflix network metadata', () => {
  it('extracts the current episode from metadata responses', () => {
    const payload = {
      video: {
        id: 81234567,
        title: 'Example Anime',
        type: 'show',
        currentEpisode: 81600002,
        seasons: [
          {
            seq: 1,
            title: 'Season 1',
            episodes: [
              { id: 81600001, seq: 1, title: 'Episode 1' },
              { id: 81600002, seq: 2, title: 'Episode 2' },
            ],
          },
        ],
      },
    };

    expect(extractNetflixNetworkEpisodes(payload)).toEqual([{
      watchId: '81600002',
      titleId: '81234567',
      providerMediaId: '81234567?s=1',
      seriesTitle: 'Example Anime',
      seasonTitle: 'Season 1',
      episodeTitle: 'Episode 2',
      seasonNumber: 1,
      episode: 2,
      isMovie: false,
    }]);
  });

  it('supports anime movies as one-episode titles', () => {
    expect(extractNetflixNetworkEpisodes({
      video: { id: '81239999', title: 'Anime Movie', type: 'movie' },
    })).toEqual([{
      watchId: '81239999',
      titleId: '81239999',
      providerMediaId: '81239999?s=1',
      seriesTitle: 'Anime Movie',
      seasonNumber: 1,
      episode: 1,
      isMovie: true,
    }]);
  });

  it('ignores incomplete metadata', () => {
    expect(extractNetflixNetworkEpisodes({
      video: { id: 81234567, type: 'show', currentEpisode: 81600002 },
    })).toEqual([]);
  });
});
