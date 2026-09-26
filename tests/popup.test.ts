// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';

const html = readFileSync('src/ui/popup/popup.html', 'utf8');

const currentMedia = {
  title: 'The Detective Is Already Dead (Portuguese Dub)',
  episode: 1,
  providerId: 'crunchyroll',
  providerEpisodeId: 'GMKUXG2E0',
  providerSeriesId: 'G24H1N334',
};

const libraryItem = {
  mediaId: 15,
  status: 'CURRENT',
  progress: 1,
  score: 8.5,
  repeatCount: 0,
  media: {
    id: 15,
    slug: 'the-detective-is-already-dead',
    type: 'ANIME',
    title: {
      romaji: 'Tantei wa Mou, Shindeiru.',
      english: 'The Detective Is Already Dead',
      portuguese: 'O Detetive Já Está Morto',
    },
    coverImage: 'https://branilist.com/example.webp',
    total: 12,
  },
};

function authState() {
  return {
    ok: true,
    authenticated: true,
    profile: {
      id: 1,
      username: 'tester',
      displayName: 'Tester',
      titleLanguage: 'ROMAJI',
      localeCode: 'pt-BR',
      scopes: ['profile', 'list:read', 'list:write'],
    },
    pending: [],
    lastDetected: currentMedia,
    lastSync: null,
    oauth: { clientId: 'branilist-sync', extensionId: 'abc', redirectUri: 'https://abc.chromiumapp.org/oauth2' },
  };
}

beforeEach(() => {
  vi.resetModules();
  document.documentElement.innerHTML = html;
});

it('uses the Branilist title preference in the library and opens media detail', async () => {
  const send = vi.fn(async (message: { type: string }) => {
    if (message.type === 'AUTH_STATUS') return authState();
    if (message.type === 'LIBRARY_GET') return { ok: true, items: [structuredClone(libraryItem)] };
    if (message.type === 'MEDIA_GET') return {
      ok: true,
      media: {
        id: 15,
        slug: libraryItem.media.slug,
        type: 'ANIME',
        status: 'FINISHED',
        format: 'TV',
        title: libraryItem.media.title,
        description: 'Uma descrição segura.',
        coverImage: libraryItem.media.coverImage,
        bannerImage: null,
        episodes: 12,
        chapters: null,
        seasonYear: 2021,
        averageScore: 74,
        popularity: 100,
        isAdult: false,
      },
    };
    return { ok: true };
  });
  vi.stubGlobal('chrome', { runtime: { sendMessage: send }, tabs: { create: vi.fn() } });

  await import('../src/ui/popup/popup');
  await vi.waitFor(() => expect(document.querySelector('#account-summary')?.textContent).toContain('@tester'));

  document.querySelector<HTMLButtonElement>('[data-tab="library"]')!.click();
  await vi.waitFor(() => expect(document.querySelector('.library-item strong')?.textContent).toBe('Tantei wa Mou, Shindeiru.'));

  document.querySelector<HTMLButtonElement>('.library-item')!.click();
  await vi.waitFor(() => expect(document.querySelector('#detail-description')?.textContent).toBe('Uma descrição segura.'));
  expect(document.querySelector('#detail-hero strong')?.textContent).toBe('Tantei wa Mou, Shindeiru.');
});

it('updates status, progress and half-star score from the detail screen', async () => {
  const send = vi.fn(async (message: { type: string }) => {
    if (message.type === 'AUTH_STATUS') return authState();
    if (message.type === 'LIBRARY_GET') return { ok: true, items: [structuredClone(libraryItem)] };
    if (message.type === 'MEDIA_GET') return {
      ok: true,
      media: {
        id: 15, slug: 'x', type: 'ANIME', status: 'FINISHED', format: 'TV',
        title: libraryItem.media.title, episodes: 12, popularity: 1, isAdult: false,
      },
    };
    if (message.type === 'LIBRARY_UPDATE') return { ok: true };
    return { ok: true };
  });
  vi.stubGlobal('chrome', { runtime: { sendMessage: send }, tabs: { create: vi.fn() } });

  await import('../src/ui/popup/popup');
  await vi.waitFor(() => expect(document.querySelector('#account-summary')?.textContent).toContain('@tester'));
  document.querySelector<HTMLButtonElement>('[data-tab="library"]')!.click();
  await vi.waitFor(() => expect(document.querySelector('.library-item')).not.toBeNull());
  document.querySelector<HTMLButtonElement>('.library-item')!.click();
  await vi.waitFor(() => expect(document.querySelector('#detail-form')).not.toBeNull());

  const progress = document.querySelector<HTMLInputElement>('#detail-progress')!;
  const score = document.querySelector<HTMLInputElement>('#detail-score')!;
  progress.value = '2';
  score.value = '9.5';
  document.querySelector<HTMLFormElement>('#detail-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

  await vi.waitFor(() => {
    expect(send).toHaveBeenCalledWith({
      type: 'LIBRARY_UPDATE',
      mediaId: 15,
      payload: { status: 'CURRENT', progress: 2, score: 9.5, repeatCount: 0 },
    });
  });
  expect(document.querySelector('#detail-feedback')?.textContent).toBe('Lista atualizada.');
});

it('keeps current page detection visible in the current tab', async () => {
  vi.stubGlobal('chrome', {
    runtime: { sendMessage: vi.fn().mockResolvedValue(authState()) },
    tabs: { create: vi.fn() },
  });

  await import('../src/ui/popup/popup');
  await vi.waitFor(() => expect(document.querySelector('#current-media-title')?.textContent).toBe(currentMedia.title));
  expect(document.querySelector('#current-media-detail')?.textContent).toContain('episódio GMKUXG2E0');
});
