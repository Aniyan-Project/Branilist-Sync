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
const source = { id, url, frameId: 0, tab: { id: 1 } };
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
  expect(storage['branilist.tracker-sessions.v1']).toBeUndefined();
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


it('allows content to read settings but only trusted popup can change them', async () => {
  const defaults = await send({ type: 'SETTINGS_GET' });
  expect(defaults.ok).toBe(true);
  expect(defaults.settings).toMatchObject({
    autoSync: true,
    showToast: true,
    toastDurationSeconds: 30,
    quickPlusStartsCurrent: true,
  });

  const forged = await send({
    type: 'SETTINGS_SET',
    payload: { autoSync: false, showToast: false, toastDurationSeconds: 10, quickPlusStartsCurrent: false },
  });
  expect(forged.ok).toBe(false);

  const saved = await send({
    type: 'SETTINGS_SET',
    payload: { autoSync: false, showToast: true, toastDurationSeconds: 45, quickPlusStartsCurrent: false },
  }, popup);
  expect(saved.ok).toBe(true);
  expect(saved.settings).toEqual({
    autoSync: false,
    showToast: true,
    toastDurationSeconds: 45,
    quickPlusStartsCurrent: false,
  });
});

it('skips automatic tracking when auto sync is disabled', async () => {
  await send({
    type: 'SETTINGS_SET',
    payload: { autoSync: false, showToast: true, toastDurationSeconds: 30, quickPlusStartsCurrent: true },
  }, popup);

  const result = await send({ type: 'SYNC_PROGRESS', payload: media });
  expect(result).toMatchObject({ ok: true, skipped: true, reason: 'auto_sync_disabled' });
  expect(mocks.write).not.toHaveBeenCalled();
});

it('returns recent durable sync history to the popup', async () => {
  await send({ type: 'SYNC_PROGRESS', payload: media });
  const status = await send({ type: 'AUTH_STATUS' }, popup);
  expect(status.ok).toBe(true);
  expect(status.history).toHaveLength(1);
  expect(status.history[0]).toMatchObject({
    status: 'synced',
    media: expect.objectContaining({ title: 'Example' }),
  });
  expect(status.history[0].occurredAt).toBeTruthy();
});


it('persists Crunchyroll bridge diagnostics for popup troubleshooting', async () => {
  const diagnostic = await send({
    type: 'BRIDGE_DIAGNOSTIC',
    payload: {
      active: true,
      startedAt: '2026-09-26T16:00:00Z',
      jsonResponsesSeen: 7,
      lastRequestUrl: 'https://www.crunchyroll.com/content/v2/cms/objects/G8WUN0X72',
      lastRequestAt: '2026-09-26T16:00:05Z',
      lastEpisodeId: 'G8WUN0X72',
      lastEpisodeNumber: 3,
      lastEpisodeAt: '2026-09-26T16:00:05Z',
    },
  });
  expect(diagnostic.ok).toBe(true);

  const status = await send({ type: 'AUTH_STATUS' }, popup);
  expect(status.bridgeDiagnostics).toMatchObject({
    active: true,
    jsonResponsesSeen: 7,
    lastEpisodeId: 'G8WUN0X72',
    lastEpisodeNumber: 3,
  });
});


it('clears the current detection when Crunchyroll SPA leaves a watch page', async () => {
  await send({ type: 'TRACKER_DETECTED', payload: media });
  const sessionsBeforeClear = storage['branilist.tracker-sessions.v1'] as Record<string, any>;
  expect(sessionsBeforeClear['1:0:crunchyroll']?.detected).toBeTruthy();

  const cleared = await send({
    type: 'TRACKER_CLEARED',
    payload: {
      providerId: 'crunchyroll',
      canonicalUrl: 'https://www.crunchyroll.com/series/G24H1N334/example',
    },
  });
  expect(cleared.ok).toBe(true);
  const sessionsAfterClear = storage['branilist.tracker-sessions.v1'] as Record<string, any>;
  expect(sessionsAfterClear['1:0:crunchyroll']?.detected).toBeUndefined();
  expect(sessionsAfterClear['1:0:crunchyroll']?.episodeNavigation).toBeUndefined();
});


it('persists the latest current resolution separately from progress sync state', async () => {
  const detected = await send({ type: 'TRACKER_DETECTED', payload: media });
  expect(detected.ok).toBe(true);

  const status = await send({ type: 'AUTH_STATUS' }, popup);
  expect(status.currentResolution).toMatchObject({
    media: expect.objectContaining({
      providerId: 'crunchyroll',
      episode: 3,
    }),
    result: expect.objectContaining({
      matched: true,
      mediaId: 42,
    }),
  });
  expect(status.currentResolution.resolvedAt).toBeTruthy();
});

it('clears the current resolution when leaving a watch page', async () => {
  await send({ type: 'TRACKER_DETECTED', payload: media });
  const sessionsBeforeClear = storage['branilist.tracker-sessions.v1'] as Record<string, any>;
  expect(sessionsBeforeClear['1:0:crunchyroll']?.currentResolution).toBeTruthy();

  const cleared = await send({
    type: 'TRACKER_CLEARED',
    payload: {
      providerId: 'crunchyroll',
      canonicalUrl: 'https://www.crunchyroll.com/series/G24H1N334/example',
    },
  });
  expect(cleared.ok).toBe(true);
  const sessionsAfterClear = storage['branilist.tracker-sessions.v1'] as Record<string, any>;
  expect(sessionsAfterClear['1:0:crunchyroll']?.currentResolution).toBeUndefined();
});


it('migrates a trusted episode-level correction to the stable Crunchyroll season identity', async () => {
  const stableMedia = {
    ...media,
    providerMediaId: 'SERIES123|season-one-portuguese-dub',
    providerEpisodeId: 'G123',
    providerSeriesId: 'SERIES123',
    providerSeasonSlug: 'season-one-portuguese-dub',
  };

  mocks.resolve
    .mockResolvedValueOnce({
      matched: false,
      requiresConfirmation: true,
      confidence: 0,
      action: 'REQUIRES_CONFIRMATION',
      previousProgress: 0,
      newProgress: 0,
    })
    .mockResolvedValueOnce(safe);

  const detected = await send({ type: 'TRACKER_DETECTED', payload: stableMedia });
  expect(detected.ok).toBe(true);
  expect(detected.result).toEqual(safe);

  expect(mocks.resolve).toHaveBeenNthCalledWith(1, expect.objectContaining({
    providerMediaId: 'SERIES123|season-one-portuguese-dub',
  }));
  expect(mocks.resolve).toHaveBeenNthCalledWith(2, expect.objectContaining({
    providerMediaId: 'G123',
  }));
  expect(mocks.saveMapping).toHaveBeenCalledWith(
    expect.objectContaining({ providerMediaId: 'SERIES123|season-one-portuguese-dub' }),
    42,
  );
});


it('persists active Netflix player diagnostics before metadata is detected', async () => {
  const netflixSource = {
    id,
    url: 'https://www.netflix.com/browse',
    frameId: 0,
    tab: { id: 2 },
  } as chrome.runtime.MessageSender;

  const diagnostic = await send({
    type: 'PROVIDER_DIAGNOSTIC',
    payload: {
      providerId: 'netflix',
      active: true,
      canonicalUrl: 'https://www.netflix.com/browse',
      pathname: '/browse',
      hasVideo: true,
      hasPlayerRoot: true,
      hasTitleRoot: true,
      hasWatchId: false,
      playerTitleText: 'Mushoku Tensei: Jobless Reincarnation T1:E1',
    },
  }, netflixSource);

  expect(diagnostic.ok).toBe(true);

  const status = await send({ type: 'AUTH_STATUS' }, popup);
  expect(status.providerDiagnostics).toMatchObject({
    providerId: 'netflix',
    active: true,
    lastCanonicalUrl: 'https://www.netflix.com/browse',
    lastPathname: '/browse',
    hasVideo: true,
    hasPlayerRoot: true,
    hasTitleRoot: true,
    hasWatchId: false,
    playerTitleText: 'Mushoku Tensei: Jobless Reincarnation T1:E1',
  });
  expect(status.providerDiagnostics.lastProbeAt).toBeTruthy();
});


it('isolates Crunchyroll and Netflix state across different tabs', async () => {
  const crunchySource = {
    id,
    url: 'https://www.crunchyroll.com/watch/G123',
    frameId: 0,
    tab: { id: 11 },
  } as chrome.runtime.MessageSender;
  const netflixSource = {
    id,
    url: 'https://www.netflix.com/watch/81402903',
    frameId: 0,
    tab: { id: 22 },
  } as chrome.runtime.MessageSender;
  const netflixMedia = {
    providerId: 'netflix',
    providerMediaId: '80987039|season:1',
    providerEpisodeId: '81402903',
    providerSeasonId: '1',
    providerSeriesId: '80987039',
    canonicalUrl: 'https://www.netflix.com/watch/81402903',
    kind: 'ANIME',
    title: 'Mushoku Tensei: Jobless Reincarnation',
    episode: 3,
  };

  expect((await send({ type: 'TRACKER_DETECTED', payload: media }, crunchySource)).ok).toBe(true);
  expect((await send({ type: 'TRACKER_DETECTED', payload: netflixMedia }, netflixSource)).ok).toBe(true);

  const crunchyStatus = await send({ type: 'AUTH_STATUS', activeTabId: 11 }, popup);
  const netflixStatus = await send({ type: 'AUTH_STATUS', activeTabId: 22 }, popup);

  expect(crunchyStatus.lastDetected).toMatchObject({
    providerId: 'crunchyroll',
    title: 'Example',
  });
  expect(netflixStatus.lastDetected).toMatchObject({
    providerId: 'netflix',
    title: 'Mushoku Tensei: Jobless Reincarnation',
    episode: 3,
  });
  expect(crunchyStatus.sessions).toHaveLength(2);
  expect(netflixStatus.sessions).toHaveLength(2);
});

it('keeps two Netflix tabs independent', async () => {
  const netflixTabA = {
    id,
    url: 'https://www.netflix.com/watch/81402903',
    frameId: 0,
    tab: { id: 31 },
  } as chrome.runtime.MessageSender;
  const netflixTabB = {
    id,
    url: 'https://www.netflix.com/watch/81726714',
    frameId: 0,
    tab: { id: 32 },
  } as chrome.runtime.MessageSender;

  const mediaA = {
    providerId: 'netflix',
    providerMediaId: '80987039|season:1',
    providerEpisodeId: '81402903',
    providerSeasonId: '1',
    providerSeriesId: '80987039',
    canonicalUrl: 'https://www.netflix.com/watch/81402903',
    kind: 'ANIME',
    title: 'Mushoku Tensei: Jobless Reincarnation',
    episode: 3,
  };
  const mediaB = {
    providerId: 'netflix',
    providerMediaId: '81278456|season:1',
    providerEpisodeId: '81726714',
    providerSeasonId: '1',
    providerSeriesId: '81278456',
    canonicalUrl: 'https://www.netflix.com/watch/81726714',
    kind: 'ANIME',
    title: 'Another Anime',
    episode: 1,
  };

  expect((await send({ type: 'TRACKER_DETECTED', payload: mediaA }, netflixTabA)).ok).toBe(true);
  expect((await send({ type: 'TRACKER_DETECTED', payload: mediaB }, netflixTabB)).ok).toBe(true);

  const statusA = await send({ type: 'AUTH_STATUS', activeTabId: 31 }, popup);
  const statusB = await send({ type: 'AUTH_STATUS', activeTabId: 32 }, popup);

  expect(statusA.lastDetected?.providerEpisodeId).toBe('81402903');
  expect(statusB.lastDetected?.providerEpisodeId).toBe('81726714');
});

it('clears a Netflix watch change only in the originating tab', async () => {
  const crunchySource = {
    id,
    url: 'https://www.crunchyroll.com/watch/G123',
    frameId: 0,
    tab: { id: 41 },
  } as chrome.runtime.MessageSender;
  const netflixSource = {
    id,
    url: 'https://www.netflix.com/watch/81402903',
    frameId: 0,
    tab: { id: 42 },
  } as chrome.runtime.MessageSender;
  const netflixMedia = {
    providerId: 'netflix',
    providerMediaId: '80987039|season:1',
    providerEpisodeId: '81402903',
    providerSeasonId: '1',
    providerSeriesId: '80987039',
    canonicalUrl: 'https://www.netflix.com/watch/81402903',
    kind: 'ANIME',
    title: 'Mushoku Tensei: Jobless Reincarnation',
    episode: 3,
  };

  await send({ type: 'TRACKER_DETECTED', payload: media }, crunchySource);
  await send({ type: 'TRACKER_DETECTED', payload: netflixMedia }, netflixSource);

  const changedNetflixSource = {
    ...netflixSource,
    url: 'https://www.netflix.com/watch/82682360?trackId=264265097',
  } as chrome.runtime.MessageSender;
  const changed = await send({
    type: 'NETFLIX_WATCH_CHANGED',
    payload: {
      watchId: '82682360',
      canonicalUrl: 'https://www.netflix.com/watch/82682360',
    },
  }, changedNetflixSource);

  expect(changed.ok).toBe(true);

  const netflixStatus = await send({ type: 'AUTH_STATUS', activeTabId: 42 }, popup);
  const crunchyStatus = await send({ type: 'AUTH_STATUS', activeTabId: 41 }, popup);

  expect(netflixStatus.lastDetected).toBeUndefined();
  expect(netflixStatus.currentResolution).toBeUndefined();
  expect(crunchyStatus.lastDetected).toMatchObject({
    providerId: 'crunchyroll',
    title: 'Example',
  });
});
