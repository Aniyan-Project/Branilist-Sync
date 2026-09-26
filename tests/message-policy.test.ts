import { beforeEach, expect, it, vi } from 'vitest';
import { trustedPopup, validateDetection } from '../src/core/message-policy';
const id = 'a'.repeat(32); const url = 'https://www.crunchyroll.com/watch/G123';
const media = { providerId: 'crunchyroll', providerMediaId: 'G123', kind: 'ANIME', episode: 3, title: 'Example', canonicalUrl: url, externalIds: { ANILIST: '999' } };
beforeEach(() => vi.stubGlobal('chrome', { runtime: { id, getURL: (path: string) => `chrome-extension://${id}/${path}` } }));
it('accepts only its popup for privileged messages', () => {
  expect(trustedPopup({ id, url, tab: {} as chrome.tabs.Tab })).toBe(false);
  expect(trustedPopup({ id, url: `chrome-extension://${id}/src/ui/popup/popup.html` })).toBe(true);
});
it('validates source and strips untrusted external IDs', () => {
  expect(validateDetection(media, { id, url, frameId: 0, tab: {} as chrome.tabs.Tab })).not.toHaveProperty('externalIds');
});
it('accepts a season identity only when bound to the current episode', () => {
  const value = { ...media, providerMediaId: 'SEASON123', providerEpisodeId: 'G123', providerSeasonId: 'SEASON123', providerSeriesId: 'SERIES123' };
  expect(validateDetection(value, { id, url, frameId: 0, tab: {} as chrome.tabs.Tab })).toMatchObject({
    providerMediaId: 'SEASON123',
    providerEpisodeId: 'G123',
    providerSeasonId: 'SEASON123',
    providerSeriesId: 'SERIES123',
  });
  expect(() => validateDetection({ ...value, providerEpisodeId: 'G999' }, { id, url, frameId: 0, tab: {} as chrome.tabs.Tab })).toThrow();
});
it.each([
  { id, url: 'https://evil.test/watch/G123', frameId: 0, tab: {} },
  { id, url, frameId: 1, tab: {} }, { id, url, frameId: 0 },
  { id: 'other', url, frameId: 0, tab: {} },
])('rejects forged or unrelated sender %o', sender => {
  expect(() => validateDetection(media, sender as chrome.runtime.MessageSender)).toThrow();
});


it('accepts a live SPA canonical episode even when sender.url is still the previous watch page', () => {
  const live = {
    ...media,
    providerMediaId: 'SEASON123',
    providerEpisodeId: 'G456',
    providerSeasonId: 'SEASON123',
    canonicalUrl: 'https://www.crunchyroll.com/watch/G456',
  };
  expect(validateDetection(live, {
    id,
    url: 'https://www.crunchyroll.com/watch/G123',
    frameId: 0,
    tab: {} as chrome.tabs.Tab,
  })).toMatchObject({
    providerEpisodeId: 'G456',
    canonicalUrl: 'https://www.crunchyroll.com/watch/G456',
  });
});


it('uses series identity when season identity is unavailable', () => {
  const value = {
    ...media,
    providerMediaId: 'SERIES123',
    providerEpisodeId: 'G123',
    providerSeriesId: 'SERIES123',
  };
  expect(validateDetection(value, {
    id,
    url,
    frameId: 0,
    tab: {} as chrome.tabs.Tab,
  })).toMatchObject({
    providerMediaId: 'SERIES123',
    providerEpisodeId: 'G123',
    providerSeriesId: 'SERIES123',
  });
});


it('accepts a stable series plus season slug identity for Crunchyroll', () => {
  const value = {
    ...media,
    providerMediaId: 'SERIES123|season-one-portuguese-dub',
    providerEpisodeId: 'G123',
    providerSeriesId: 'SERIES123',
    providerSeasonSlug: 'season-one-portuguese-dub',
  };
  expect(validateDetection(value, {
    id,
    url,
    frameId: 0,
    tab: {} as chrome.tabs.Tab,
  })).toMatchObject({
    providerMediaId: 'SERIES123|season-one-portuguese-dub',
    providerEpisodeId: 'G123',
    providerSeriesId: 'SERIES123',
    providerSeasonSlug: 'season-one-portuguese-dub',
  });
});


it('validates Netflix detections with stable title and season identity', () => {
  const netflix = {
    providerId: 'netflix',
    providerMediaId: '81234567?s=1',
    providerEpisodeId: '81600002',
    providerSeriesId: '81234567',
    providerSeasonNumber: 1,
    kind: 'ANIME',
    title: 'Example Anime',
    episode: 2,
    canonicalUrl: 'https://www.netflix.com/watch/81600002',
  };
  expect(validateDetection(netflix, {
    id,
    url: 'https://www.netflix.com/watch/81600001',
    frameId: 0,
    tab: {} as chrome.tabs.Tab,
  })).toMatchObject({
    providerId: 'netflix',
    providerMediaId: '81234567?s=1',
    providerEpisodeId: '81600002',
    providerSeriesId: '81234567',
    providerSeasonNumber: 1,
    episode: 2,
  });
});

it('rejects Netflix metadata whose watch ID or stable identity does not match', () => {
  const netflix = {
    providerId: 'netflix',
    providerMediaId: '81234567?s=1',
    providerEpisodeId: '81600002',
    providerSeriesId: '81234567',
    providerSeasonNumber: 1,
    kind: 'ANIME',
    title: 'Example Anime',
    episode: 2,
    canonicalUrl: 'https://www.netflix.com/watch/81600002',
  };
  expect(() => validateDetection(
    { ...netflix, providerMediaId: '81234567?s=2' },
    { id, url: 'https://www.netflix.com/watch/81600001', frameId: 0, tab: {} as chrome.tabs.Tab },
  )).toThrow();
  expect(() => validateDetection(
    { ...netflix, providerEpisodeId: '81600003' },
    { id, url: 'https://www.netflix.com/watch/81600001', frameId: 0, tab: {} as chrome.tabs.Tab },
  )).toThrow();
});
