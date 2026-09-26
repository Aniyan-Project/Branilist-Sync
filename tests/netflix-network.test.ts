import { describe, expect, it } from 'vitest';
import { extractNetflixNetworkEpisode } from '../src/providers/netflix/network';

describe('Netflix memberapi metadata', () => {
  it('extracts the current episode and season from structured metadata', () => {
    const payload = {
      video: {
        id: 81234567,
        title: 'Mushoku Tensei: Jobless Reincarnation',
        currentEpisode: 81402901,
        seasons: [
          {
            seq: 1,
            episodes: [
              { id: 81402901, seq: 1, title: 'Episode 1' },
              { id: 81402902, seq: 2, title: 'Episode 2' },
            ],
          },
        ],
      },
    };

    expect(extractNetflixNetworkEpisode(payload)).toEqual({
      episodeProviderId: '81402901',
      seasonProviderId: '1',
      seriesProviderId: '81234567',
      seriesTitle: 'Mushoku Tensei: Jobless Reincarnation',
      season: 1,
      episode: 1,
      episodeTitle: 'Episode 1',
    });
  });

  it('finds the current episode in the correct season', () => {
    const payload = {
      video: {
        id: '81234567',
        title: 'Example Anime',
        currentEpisode: '90000003',
        seasons: [
          { seq: 1, episodes: [{ id: '90000001', seq: 1 }] },
          { seq: 2, episodes: [{ id: '90000003', seq: 7 }] },
        ],
      },
    };

    expect(extractNetflixNetworkEpisode(payload)).toMatchObject({
      season: 2,
      episode: 7,
      seasonProviderId: '2',
      episodeProviderId: '90000003',
    });
  });

  it('fails closed for incomplete or inconsistent metadata', () => {
    expect(extractNetflixNetworkEpisode(null)).toBeNull();
    expect(extractNetflixNetworkEpisode({ video: { id: 1 } })).toBeNull();
    expect(extractNetflixNetworkEpisode({
      video: {
        id: '81234567',
        title: 'Example',
        currentEpisode: '90000001',
        seasons: [{ seq: 1, episodes: [{ id: '90000099', seq: 1 }] }],
      },
    })).toBeNull();
  });
});
