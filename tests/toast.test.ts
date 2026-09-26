// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { searchCatalog } from '../src/content/toast';

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
