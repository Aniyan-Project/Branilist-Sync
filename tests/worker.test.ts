import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  write: vi.fn(),
  saveMapping: vi.fn(),
  getLibrary: vi.fn(),
  updateLibrary: vi.fn(),
  getMediaDetail: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('../src/core/auth', () => ({ authStatus: async () => ({ authenticated: true }), login: vi.fn(), logout: mocks.logout }));
vi.mock('../src/core/api', () => ({
  resolveMedia: mocks.resolve,
  syncProgress: mocks.write,
  saveUserMapping: mocks.saveMapping,
  getLibrary: mocks.getLibrary,
  updateLibrary: mocks.updateLibrary,
  getMediaDetail: mocks.getMediaDetail,
  getMe: vi.fn(),
}));
const id = 'a'.repeat(32);
const url = 'https://www.crunchyroll.com/watch/G123';
const source = { id, url, frameId: 0, tab: {} };
const popup = { id, url: `chrome-extension://${id}/src/ui/popup/popup.html` };
const media = { providerId: 'crunchyroll', providerMediaId: 'G123', canonicalUrl: url, kind: 'ANIME', title: 'Example', episode: 3, progressPercent: 90 };
const safe = { matched: true, mediaId: 42, requiresConfirmation: false, confidence: 1, action: 'MATCHED', previousProgress: 2, newProgress: 3 };
let listener: (message: unknown, sender: unknown, reply: (value: unknown) => void) => boolean;
let storage: Record<string, unknown>;
const send = (message: unknown, sender = source as unknown) => new Promise<any>(resolve => listener(message, sender, resolve));
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); storage = {};
  mocks.resolve.mockResolvedValue(safe);
  mocks.write.mockResolvedValue({ ...safe, action: 'PROGRESS_UPDATED' });
  mocks.saveMapping.mockResolvedValue(undefined);
  mocks.getLibrary.mockResolvedValue({ items: [{ mediaId: 42 }] });
  mocks.updateLibrary.mockResolvedValue(undefined);
  mocks.getMediaDetail.mockResolvedValue({ id: 42, title: { romaji: 'Example' } });
  vi.stubGlobal('chrome', {
    runtime: { id, getURL: (path: string) => `chrome-extension://${id}/${path}`, onMessage: { addListener: (fn: typeof listener) => { listener = fn; } } },
    identity: { getRedirectURL: () => `https://${id}.chromiumapp.org/oauth2` },
    storage: { local: {
      setAccessLevel: async () => {}, get: async () => structuredClone(storage),
      set: async (values: Record<string, unknown>) => { Object.assign(storage, structuredClone(values)); },
      remove: async (keys: string[]) => { keys.forEach(key => delete storage[key]); },
    } },
  });
  await import('../src/background/service-worker');
});
it('serializes duplicate detections into one write', async () => {
  const message = { type: 'SYNC_PROGRESS', payload: media };
  await Promise.all([send(message), send(message), send(message)]);
  expect(mocks.write).toHaveBeenCalledTimes(1);
});
it('blocks content-script auth and forged retry payloads', async () => {
  expect((await send({ type: 'AUTH_LOGOUT' })).ok).toBe(false);
  expect((await send({ type: 'SYNC_RETRY', retryId: 'forged', payload: media }, popup)).ok).toBe(false);
  expect(mocks.logout).not.toHaveBeenCalled(); expect(mocks.write).not.toHaveBeenCalled();
});
it('does not overlap logout with writes and clears persisted events', async () => {
  let finish!: (value: unknown) => void;
  mocks.write.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const tracking = send({ type: 'SYNC_PROGRESS', payload: media });
  await vi.waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(1));
  const logout = send({ type: 'AUTH_LOGOUT' }, popup);
  await Promise.resolve(); expect(mocks.logout).not.toHaveBeenCalled();
  finish({ ...safe, action: 'PROGRESS_UPDATED' });
  await Promise.all([tracking, logout]);
  expect(mocks.logout).toHaveBeenCalledTimes(1);
  expect(storage['branilist.sync.v4']).toBeUndefined();
  expect(storage['branilist.detected']).toBeUndefined();
});

it('resolves detections and saves a user correction without exposing credentials', async () => {
  const detected = await send({ type: 'TRACKER_DETECTED', payload: media });
  expect(detected.ok).toBe(true);
  expect(detected.result).toEqual(safe);
  expect(mocks.resolve).toHaveBeenCalledTimes(1);

  const corrected = await send({ type: 'SAVE_USER_MAPPING', payload: { media, mediaId: 42 } });
  expect(corrected.ok).toBe(true);
  expect(mocks.saveMapping).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'crunchyroll' }), 42);
  expect(mocks.resolve).toHaveBeenCalledTimes(2);
});

it('allows library operations only from the trusted popup', async () => {
  expect((await send({ type: 'LIBRARY_GET' })).ok).toBe(false);
  expect(mocks.getLibrary).not.toHaveBeenCalled();

  const list = await send({ type: 'LIBRARY_GET' }, popup);
  expect(list.ok).toBe(true);
  expect(list.items).toEqual([{ mediaId: 42 }]);

  const update = await send({
    type: 'LIBRARY_UPDATE',
    mediaId: 42,
    payload: { status: 'CURRENT', progress: 3, score: 8.5, repeatCount: 0 },
  }, popup);
  expect(update.ok).toBe(true);
  expect(mocks.updateLibrary).toHaveBeenCalledWith(42, {
    status: 'CURRENT', progress: 3, score: 8.5, repeatCount: 0,
  });
});

it('keeps public media detail access behind the trusted popup message boundary', async () => {
  expect((await send({ type: 'MEDIA_GET', mediaId: 42 })).ok).toBe(false);
  const detail = await send({ type: 'MEDIA_GET', mediaId: 42 }, popup);
  expect(detail.ok).toBe(true);
  expect(detail.media.id).toBe(42);
});
