import { describe, expect, it } from 'vitest';
import { netflixSeasonIdentity, netflixWatchId } from '../src/providers/netflix/identity';

describe('Netflix identity', () => {
  it('extracts the active watch ID from Netflix URLs', () => {
    expect(netflixWatchId(new URL('https://www.netflix.com/watch/81612345'))).toBe('81612345');
    expect(netflixWatchId(new URL('https://www.netflix.com/browse'))).toBeUndefined();
  });

  it('uses title plus season as the stable mapping identity', () => {
    expect(netflixSeasonIdentity('81234567', 1)).toBe('81234567?s=1');
    expect(netflixSeasonIdentity('81234567', 2)).toBe('81234567?s=2');
  });
});
