import { describe, expect, it } from 'vitest';
import { crunchyrollLegacyMappingIds, crunchyrollSeasonIdentity } from '../src/providers/crunchyroll/identity';

describe('Crunchyroll mapping identity', () => {
  it('uses series plus season slug as the stable identity', () => {
    expect(crunchyrollSeasonIdentity(
      'G24H1N334',
      'the-detective-is-already-dead-portuguese-dub',
      undefined,
      'GMKUXG2E0',
    )).toBe('G24H1N334|the-detective-is-already-dead-portuguese-dub');

    expect(crunchyrollSeasonIdentity(
      'G24H1N334',
      'the-detective-is-already-dead-portuguese-dub',
      undefined,
      'GPWUKD78W',
    )).toBe('G24H1N334|the-detective-is-already-dead-portuguese-dub');
  });

  it('falls back safely when season slug is unavailable', () => {
    expect(crunchyrollSeasonIdentity('SERIES123', undefined, 'SEASON123', 'EP123')).toBe('SEASON123');
    expect(crunchyrollSeasonIdentity('SERIES123', undefined, undefined, 'EP123')).toBe('SERIES123');
    expect(crunchyrollSeasonIdentity(undefined, undefined, undefined, 'EP123')).toBe('EP123');
  });

  it('only migrates season-safe legacy IDs', () => {
    expect(crunchyrollLegacyMappingIds({
      providerMediaId: 'SERIES123|season-one',
      providerSeasonId: 'SEASON123',
      providerSeriesId: 'SERIES123',
      providerEpisodeId: 'EP123',
    })).toEqual(['SEASON123', 'EP123']);
  });
});
