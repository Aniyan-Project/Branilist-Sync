// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';

const html = readFileSync('src/ui/popup/popup.html', 'utf8');

const pendingMedia = {
  title: '<img src=x onerror=alert(1)>',
  episode: 3,
  providerId: 'crunchyroll',
};

const currentMedia = {
  title: 'The Detective Is Already Dead',
  episode: 1,
  providerId: 'crunchyroll',
  providerEpisodeId: 'GMKUXG2E0',
  providerSeasonId: 'SEASON123',
  providerSeriesId: 'G24H1N334',
};

function state(status = 'confirmation_required') {
  return {
    ok: true,
    authenticated: true,
    profile: { username: 'tester', displayName: 'Tester' },
    pending: [{ status, retryId: 'stored-event', media: pendingMedia, message: 'Revise no Branilist' }],
    lastSync: { status, retryId: 'stored-event', media: pendingMedia, message: 'Revise no Branilist' },
    lastDetected: currentMedia,
  };
}

const button = (id: string) => document.querySelector<HTMLButtonElement>(`#${id}`)!;

beforeEach(() => {
  vi.resetModules();
  document.documentElement.innerHTML = html;
});

it('keeps current page media visible while showing an older pending event separately', async () => {
  const send = vi.fn().mockResolvedValue(state());
  vi.stubGlobal('chrome', { runtime: { sendMessage: send }, tabs: { create: vi.fn() } });

  await import('../src/ui/popup/popup');
  await vi.waitFor(() => expect(button('refresh').disabled).toBe(false));

  expect(document.querySelector('#current-media-title')?.textContent).toBe(currentMedia.title);
  expect(document.querySelector('#current-media-detail')?.textContent).toContain('episódio GMKUXG2E0');
  expect(document.querySelector('#current-media-detail')?.textContent).toContain('temporada SEASON123');
  expect(document.querySelector('#current-media-detail')?.textContent).toContain('série G24H1N334');

  expect(document.querySelector('#pending-media-title')?.textContent).toBe(pendingMedia.title);
  expect(document.querySelector('#pending-media-title img')).toBeNull();
  expect(button('retry').textContent).toBe('Verificar novamente');
});

it('retries using only the persisted event ID', async () => {
  const send = vi.fn().mockResolvedValue(state());
  vi.stubGlobal('chrome', { runtime: { sendMessage: send }, tabs: { create: vi.fn() } });

  await import('../src/ui/popup/popup');
  await vi.waitFor(() => expect(button('refresh').disabled).toBe(false));

  let finish!: (value: unknown) => void;
  send.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));

  button('retry').click();
  expect(button('retry').disabled).toBe(true);
  expect(button('auth').disabled).toBe(true);
  expect(send.mock.calls.at(-1)?.[0]).toEqual({ type: 'SYNC_RETRY', retryId: 'stored-event' });

  finish({ ok: true });
  await vi.waitFor(() => expect(button('retry').disabled).toBe(false));
});

it('recovers from an initial connection error on refresh', async () => {
  const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(state('error'));
  vi.stubGlobal('chrome', { runtime: { sendMessage: send } });

  await import('../src/ui/popup/popup');
  await vi.waitFor(() => expect(document.querySelector('#account')?.textContent).toBe('offline'));

  button('refresh').click();
  await vi.waitFor(() => expect(document.querySelector('#account')?.className).toBe('card'));
  expect(button('retry').textContent).toBe('Tentar novamente');
});

it('hides retries when the account is disconnected', async () => {
  vi.stubGlobal('chrome', {
    runtime: { sendMessage: vi.fn().mockResolvedValue({ ...state(), authenticated: false }) },
  });

  await import('../src/ui/popup/popup');
  await vi.waitFor(() => expect(button('refresh').disabled).toBe(false));
  expect(button('retry').hidden).toBe(true);
});
