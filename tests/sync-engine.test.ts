import { describe, expect, it, vi } from 'vitest';
import { SyncEngine, type SyncSnapshot } from '../src/core/sync-engine';
import type { DetectedMedia, ResolveResult } from '../src/core/types';
const media: DetectedMedia = { providerId: 'crunchyroll', providerMediaId: 'G123', kind: 'ANIME', title: 'Example', episode: 3, progressPercent: 90, canonicalUrl: 'https://www.crunchyroll.com/watch/G123' };
const safe: ResolveResult = { matched: true, requiresConfirmation: false, mediaId: 42, confidence: 1, action: 'MATCHED', previousProgress: 2, newProgress: 3 };
function setup() {
  let storage: SyncSnapshot | undefined;
  const deps = {
    load: async () => storage ? structuredClone(storage) : undefined,
    save: async (snapshot: SyncSnapshot) => { storage = structuredClone(snapshot); },
    resolve: vi.fn(async () => safe),
    write: vi.fn(async () => ({ ...safe, action: 'PROGRESS_UPDATED' })),
  };
  return { deps, engine: new SyncEngine(deps) };
}
describe('durable safe synchronization', () => {
  it.each([{ matched: false }, { requiresConfirmation: true }, { requiresConfirmation: undefined }, { mediaId: undefined }, { confidence: 0.89 }, { action: 'UNKNOWN' }])('does not write unsafe resolution %o', async patch => {
    const { deps, engine } = setup();
    deps.resolve.mockResolvedValue({ ...safe, ...patch } as ResolveResult);
    expect((await engine.run(media)).status).toBe('confirmation_required');
    expect(deps.write).not.toHaveBeenCalled();
  });
  it('resolves again after manual review, never accepts a chosen ID from popup', async () => {
    const { deps, engine } = setup();
    deps.resolve.mockResolvedValueOnce({ ...safe, requiresConfirmation: true });
    const state = await engine.run(media);
    expect(deps.write).not.toHaveBeenCalled();
    expect((await engine.run(undefined, state.retryId)).status).toBe('synced');
    expect(deps.resolve).toHaveBeenCalledTimes(2);
  });
  it('replays identical event after unknown network outcome and worker restart', async () => {
    const { deps, engine } = setup();
    deps.write.mockRejectedValueOnce(new Error('connection lost after commit'));
    const failed = await engine.run(media);
    const first = structuredClone(deps.write.mock.calls[0][0]);
    expect(failed.status).toBe('error');
    const restarted = new SyncEngine(deps);
    expect((await restarted.run(undefined, failed.retryId)).status).toBe('synced');
    const second = deps.write.mock.calls[1][0];
    expect(second.id).toBe(first.id);
    expect(second.occurredAt).toBe(first.occurredAt);
    expect(second.media).toEqual(first.media);
  });
  it('does not auto-retry repeated observations or lose the failure', async () => {
    const { deps, engine } = setup();
    deps.write.mockRejectedValueOnce(new Error('offline'));
    const failed = await engine.run(media);
    expect(await engine.run({ ...media, progressPercent: 99 })).toEqual(failed);
    expect(deps.write).toHaveBeenCalledTimes(1);
  });
  it('blocks tracking confirmation and unknown outcomes from claiming success', async () => {
    const { deps, engine } = setup();
    deps.write.mockResolvedValueOnce({ ...safe, action: 'REQUIRES_CONFIRMATION', requiresConfirmation: true });
    expect((await engine.run(media)).status).toBe('confirmation_required');
    deps.write.mockResolvedValueOnce({ ...safe, action: 'UNEXPECTED' });
    expect((await engine.run({ ...media, providerMediaId: 'G456' })).status).toBe('error');
  });
  it('does not send until durable storage succeeds', async () => {
    const { deps, engine } = setup();
    deps.save = async () => { throw new Error('quota'); };
    await expect(engine.run(media)).rejects.toThrow('quota');
    expect(deps.write).not.toHaveBeenCalled();
  });
  it.each([NaN, Infinity, -1, 89.99, 101])('blocks invalid progress %s', async progressPercent => {
    const { deps, engine } = setup();
    await expect(engine.run({ ...media, progressPercent })).rejects.toThrow();
    expect(deps.resolve).not.toHaveBeenCalled();
    expect(deps.write).not.toHaveBeenCalled();
  });
});


describe('automatic durable retries', () => {
  it('persists a scheduled retry for an offline write and exposes it as due later', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
    try {
      const { deps, engine } = setup();
      deps.write.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const failed = await engine.run(media);
      expect(failed).toMatchObject({
        status: 'error',
        autoRetry: true,
        retryKind: 'network',
        attempts: 1,
      });
      expect(failed.nextAttemptAt).toBeTruthy();

      const dueAt = Date.parse(failed.nextAttemptAt!);
      expect(await engine.nextRetryAt()).toBe(dueAt);
      expect(await engine.dueRetryIds(dueAt - 1)).toEqual([]);
      expect(await engine.dueRetryIds(dueAt)).toEqual([failed.retryId]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('replays the same durable event automatically when its alarm becomes due', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
    try {
      const { deps, engine } = setup();
      deps.write
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({ ...safe, action: 'PROGRESS_UPDATED' });

      const failed = await engine.run(media);
      const firstEvent = structuredClone(deps.write.mock.calls[0][0]);
      const dueAt = Date.parse(failed.nextAttemptAt!);

      vi.setSystemTime(new Date(dueAt + 1));
      const synced = await engine.run(undefined, failed.retryId, 'automatic');

      expect(synced.status).toBe('synced');
      expect(deps.write).toHaveBeenCalledTimes(2);
      expect(deps.write.mock.calls[1][0].id).toBe(firstEvent.id);
      expect(deps.write.mock.calls[1][0].occurredAt).toBe(firstEvent.occurredAt);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not automatically retry authentication or permanent client failures', async () => {
    const { deps, engine } = setup();
    deps.write.mockRejectedValueOnce({ status: 401, message: 'Sessão Branilist expirada' });

    const auth = await engine.run(media);
    expect(auth).toMatchObject({
      status: 'error',
      autoRetry: false,
      retryKind: 'auth',
      httpStatus: 401,
      attempts: 1,
    });
    expect(auth.nextAttemptAt).toBeUndefined();
    expect(await engine.nextRetryAt()).toBeUndefined();
  });

  it('persists Retry-After based rate-limit scheduling', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
    try {
      const { deps, engine } = setup();
      deps.write.mockRejectedValueOnce({ status: 429, retryAfterMs: 120_000 });

      const failed = await engine.run(media);
      expect(failed).toMatchObject({
        status: 'error',
        autoRetry: true,
        retryKind: 'rate_limit',
        httpStatus: 429,
      });
      expect(Date.parse(failed.nextAttemptAt!)).toBeGreaterThanOrEqual(
        Date.now() + 120_000 * 0.85,
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
