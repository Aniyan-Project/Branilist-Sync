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
