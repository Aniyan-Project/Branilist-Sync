// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { searchCatalog, showDetectionToast } from '../src/content/toast';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('searches Branilist and keeps only the requested media type', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      items: [
        { id: 15, slug: 'detective', type: 'ANIME', format: 'TV', title: { romaji: 'The Detective Is Already Dead' }, popularity: 10 },
        { id: 16, slug: 'detective-manga', type: 'MANGA', format: 'MANGA', title: { romaji: 'Detective Manga' }, popularity: 5 },
      ],
    }),
  });
  vi.stubGlobal('fetch', fetchMock);

  const items = await searchCatalog('the detective is already dead', 'ANIME');

  expect(items.map(item => item.id)).toEqual([15]);
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('q=the%20detective%20is%20already%20dead'),
    expect.objectContaining({ credentials: 'omit' }),
  );
});

it('fails closed when the Branilist search request fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  await expect(searchCatalog('detective', 'ANIME')).rejects.toThrow('Falha ao pesquisar');
});


it('shows a detection toast only once for the same provider episode', () => {
  document.querySelector('#branilist-sync-toast-host')?.remove();

  const media = {
    providerId: 'netflix',
    providerMediaId: '81234567|season:1',
    providerEpisodeId: '81402901',
    providerSeasonId: '1',
    providerSeriesId: '81234567',
    kind: 'ANIME' as const,
    title: 'Mushoku Tensei: Jobless Reincarnation',
    episode: 1,
    canonicalUrl: 'https://www.netflix.com/watch/81402901',
  };
  const feedback = {
    authenticated: true,
    result: {
      matched: true,
      mediaId: 15,
      action: 'MATCHED',
      previousProgress: 0,
      newProgress: 0,
      confidence: 1,
      requiresConfirmation: false,
    },
    settings: {
      autoSync: true,
      showToast: true,
      toastDurationSeconds: 30,
      quickPlusStartsCurrent: true,
    },
  };

  showDetectionToast(media, feedback);
  const firstHost = document.querySelector('#branilist-sync-toast-host');
  expect(firstHost).not.toBeNull();

  firstHost?.remove();

  showDetectionToast({
    ...media,
    providerMediaId: 'title:mushoku tensei: jobless reincarnation|season:1',
  }, feedback);

  expect(document.querySelector('#branilist-sync-toast-host')).toBeNull();
});
