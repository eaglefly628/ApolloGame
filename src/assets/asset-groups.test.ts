import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetManager } from './asset-manager.js';
import type { AssetLoader, LoadedAsset } from './asset-types.js';

type Result = Awaited<ReturnType<AssetLoader['load']>>;
function controlled() {
  const calls: Array<{ key: string; resolve: (result: Result) => void; reject: (reason: Error) => void }> = [];
  const released: LoadedAsset[] = [];
  const loader: AssetLoader = {
    load: (descriptor) => new Promise<Result>((resolve, reject) => calls.push({ key: descriptor.key, resolve, reject })),
    release: (asset) => { released.push(asset); },
  };
  const manager = new AssetManager(loader);
  for (const key of ['a', 'b', 'shared', 'unused']) manager.register({ kind: 'texture', key, src: `${key}.png` });
  const succeed = (index: number, generation = index) => calls[index].resolve({ handle: { key: calls[index].key, generation }, width: 8, height: 16 });
  return { manager, loader, calls, released, succeed };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const capture = (promise: Promise<unknown>) => promise.then(() => undefined, (error: unknown) => error);

afterEach(() => vi.restoreAllMocks());

describe('asset groups — registration and progress', () => {
  it('registration performs no I/O, deduplicates keys in first-seen order, and snapshots start unloaded', async () => {
    const { manager: m, calls, succeed } = controlled();
    m.registerGroups({ scene: ['b', 'a', 'b'], empty: [] });
    expect(calls).toEqual([]);
    expect(m.groupProgress('scene')).toEqual({ group: 'scene', status: 'unloaded', loaded: 0, failed: 0, total: 2, errors: [] });
    const p = m.preloadGroup('scene');
    expect(calls.map((c) => c.key)).toEqual(['b', 'a']);
    expect(m.groupProgress('scene')).toMatchObject({ status: 'loading', loaded: 0, total: 2 });
    succeed(0); await flush();
    expect(m.groupProgress('scene')).toMatchObject({ status: 'loading', loaded: 1, failed: 0 });
    succeed(1); await p;
    expect(m.groupProgress('scene')).toMatchObject({ status: 'ready', loaded: 2, total: 2 });
  });

  it.each(['', '1scene', 'bad/name', 'bad space', `a${'x'.repeat(64)}`])('rejects invalid group id %j atomically', (id) => {
    const { manager: m, calls } = controlled();
    expect(() => m.registerGroups({ valid: ['a'], [id]: ['b'] })).toThrow();
    expect(m.groupProgress('valid')).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it('allows the boundary group id and rejects unknown keys or animation aliases without partial registration', () => {
    const { manager: m, calls } = controlled();
    m.registerGroups({ [`A${'x'.repeat(63)}`]: [] });
    m.registerAnimation({ key: 'animation', atlas: 'a', frames: [] });
    expect(() => m.registerGroups({ good: ['a'], invalid: ['missing'] })).toThrow();
    expect(m.groupProgress('good')).toBeUndefined();
    expect(() => m.registerGroups({ alias: ['animation'] })).toThrow();
    expect(calls).toEqual([]);
  });

  it('unknown progress is safe to query while unknown actions reject', async () => {
    const { manager: m, calls } = controlled();
    expect(m.groupProgress('missing')).toBeUndefined();
    await expect(m.preloadGroup('missing')).rejects.toThrow();
    expect(() => m.releaseGroup('missing')).toThrow();
    expect(calls).toEqual([]);
  });

  it('re-registers identical active groups, atomically rejects changing them, and permits changes after release', async () => {
    const { manager: m, succeed, calls } = controlled();
    m.registerGroups({ scene: ['a'] });
    const p = m.preloadGroup('scene'); succeed(0); await p;
    m.registerGroups({ scene: ['a', 'a'] });
    expect(() => m.registerGroups({ added: ['b'], scene: ['b'] })).toThrow();
    expect(m.groupProgress('added')).toBeUndefined();
    expect(m.groupProgress('scene')).toMatchObject({ status: 'ready', total: 1 });
    m.releaseGroup('scene');
    m.registerGroups({ scene: ['b'] });
    const next = m.preloadGroup('scene');
    expect(calls.map((c) => c.key)).toEqual(['a', 'b']);
    succeed(1); await next;
  });

  it('copies group definitions and progress/errors so external mutation cannot change manager state', async () => {
    const { manager: m, calls } = controlled();
    const keys = ['a']; m.registerGroups({ scene: keys }); keys.push('b');
    const p = capture(m.preloadGroup('scene')); calls[0].reject(new Error('broken')); await p;
    const snapshot = m.groupProgress('scene')!;
    try { (snapshot as { loaded: number }).loaded = 999; } catch { /* frozen snapshots are valid */ }
    try { (snapshot.errors[0] as { message: string }).message = 'rewritten'; } catch { /* frozen snapshots are valid */ }
    try { (snapshot.errors as Array<{ key: string; message: string }>).push({ key: 'b', message: 'fake' }); } catch { /* frozen snapshots are valid */ }
    expect(m.groupProgress('scene')).toEqual({ group: 'scene', status: 'failed', loaded: 0, failed: 1, total: 1, errors: [{ key: 'a', message: 'broken' }] });
  });

  it('empty groups resolve ready with zero statistical total and no loader work', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { manager: m, calls } = controlled(); m.registerGroups({ empty: [] });
    await m.preloadGroup('empty');
    expect(m.groupProgress('empty')).toEqual({ group: 'empty', status: 'ready', loaded: 0, failed: 0, total: 0, errors: [] });
    expect(calls).toEqual([]);
    expect(log.mock.calls.flat().join(' ')).toMatch(/skip/i);
  });

  it('waits for every member before AggregateError and retries only failed members', async () => {
    const { manager: m, calls, succeed } = controlled(); m.registerGroups({ scene: ['a', 'b'] });
    let settled = false;
    const p = capture(m.preloadGroup('scene')).then((e) => { settled = true; return e; });
    calls[0].reject(new Error('a failed')); await flush();
    expect(settled).toBe(false);
    succeed(1); const error = await p;
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toHaveLength(1);
    expect(m.groupProgress('scene')).toEqual({ group: 'scene', status: 'failed', loaded: 1, failed: 1, total: 2, errors: [{ key: 'a', message: 'a failed' }] });
    const retry = m.preloadGroup('scene');
    expect(calls.map((c) => c.key)).toEqual(['a', 'b', 'a']);
    expect(m.groupProgress('scene')).toMatchObject({ status: 'loading', loaded: 1, failed: 0, errors: [] });
    succeed(2); await retry;
    expect(m.groupProgress('scene')).toMatchObject({ status: 'ready', loaded: 2, failed: 0 });
    m.releaseGroup('scene'); expect(m.isLoaded('b')).toBe(false);
  });
});

describe('asset groups — retain, pins, and observable eviction', () => {
  it('repeated preloads of the same active group retain once and one release evicts it', async () => {
    const { manager: m, calls, succeed, released } = controlled(); m.registerGroups({ scene: ['a'] });
    const one = m.preloadGroup('scene'); const two = m.preloadGroup('scene');
    expect(calls).toHaveLength(1); succeed(0); await Promise.all([one, two]);
    await m.preloadGroup('scene'); expect(calls).toHaveLength(1);
    const asset = m.get('a'); const evictions: string[] = []; const off = m.onEvict((event) => evictions.push(event.key));
    m.releaseGroup('scene');
    expect(m.groupProgress('scene')).toMatchObject({ status: 'unloaded', loaded: 0 });
    expect(m.isLoaded('a')).toBe(false); expect(released).toEqual([asset]); expect(evictions).toEqual(['a']);
    m.releaseGroup('scene'); expect(released).toHaveLength(1); off();
  });

  it('multiple groups share a key and independent progress, releasing only their own resources', async () => {
    const { manager: m, calls, succeed, released } = controlled();
    m.registerGroups({ left: ['a', 'shared'], right: ['shared', 'b'] });
    const left = m.preloadGroup('left'); const right = m.preloadGroup('right');
    expect(calls.map((c) => c.key)).toEqual(['a', 'shared', 'b']);
    succeed(1); await flush();
    for (const id of ['left', 'right']) expect(m.groupProgress(id)).toMatchObject({ status: 'loading', loaded: 1, total: 2 });
    succeed(0); await left;
    m.releaseGroup('left'); expect(m.isLoaded('a')).toBe(false); expect(m.isLoaded('shared')).toBe(true);
    expect(m.groupProgress('right')).toMatchObject({ loaded: 1, status: 'loading' });
    succeed(2); await right; m.releaseGroup('right');
    expect(released.map((a) => a.descriptor.key)).toEqual(['a', 'shared', 'b']);
  });

  it.each(['before', 'during', 'after'] as const)('legacy load %s group preload pins the shared inflight/cache until unload', async (timing) => {
    const { manager: m, calls, succeed, released } = controlled(); m.registerGroups({ scene: ['a'] });
    let direct: Promise<LoadedAsset> | undefined;
    if (timing === 'before') direct = m.load('a');
    const group = m.preloadGroup('scene');
    if (timing === 'during') direct = m.load('a');
    succeed(0); await group;
    if (timing === 'after') direct = m.load('a');
    await direct;
    m.releaseGroup('scene'); expect(m.isLoaded('a')).toBe(true); expect(calls).toHaveLength(1); expect(released).toEqual([]);
    m.unload('a'); expect(m.isLoaded('a')).toBe(false); expect(released).toHaveLength(1);
  });

  it('a direct load joining group inflight survives release before I/O completes and keeps its pin', async () => {
    const { manager: m, calls, succeed, released } = controlled(); m.registerGroups({ scene: ['a'] });
    const group = capture(m.preloadGroup('scene')); const direct = m.load('a');
    const evictions = vi.fn(); m.onEvict(evictions);
    m.releaseGroup('scene'); expect(await group).toMatchObject({ name: 'AbortError' });
    expect(evictions).not.toHaveBeenCalled(); expect(calls).toHaveLength(1);
    succeed(0); const asset = await direct;
    expect(m.get('a')).toBe(asset); expect(released).toEqual([]);
    expect(m.groupProgress('scene')).toMatchObject({ status: 'unloaded', loaded: 0 });
    m.unload('a'); expect(m.get('a')).toBeUndefined(); expect(released).toEqual([asset]);
  });

  it('unload removes a legacy pin without evicting a key still retained by a group', async () => {
    const { manager: m, succeed, released } = controlled(); m.registerGroups({ scene: ['a'] });
    const direct = m.load('a'); const group = m.preloadGroup('scene'); succeed(0); await Promise.all([direct, group]);
    m.unload('a'); expect(m.isLoaded('a')).toBe(true); expect(released).toEqual([]);
    m.releaseGroup('scene'); expect(m.isLoaded('a')).toBe(false); expect(released).toHaveLength(1);
  });

  it('loadAll preserves legacy pins for all registered physical assets', async () => {
    const { manager: m, calls, succeed } = controlled(); m.registerGroups({ scene: ['a', 'b'] });
    const all = m.loadAll(); for (let i = 0; i < calls.length; i++) succeed(i); await all;
    await m.preloadGroup('scene'); m.releaseGroup('scene');
    expect(['a', 'b', 'shared', 'unused'].map((k) => m.isLoaded(k))).toEqual([true, true, true, true]);
    m.unload('a'); expect(m.isLoaded('a')).toBe(false); expect(m.isLoaded('b')).toBe(true);
  });

  it('isolates throwing group/eviction observers and release hooks, supports unsubscribe, and cleans every key', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { manager: m, loader, succeed } = controlled(); m.registerGroups({ scene: ['a', 'b'] });
    const seen = vi.fn(); m.subscribeGroups(() => { throw new Error('observer'); }); const stop = m.subscribeGroups(seen);
    const evictions = vi.fn(); m.onEvict(() => { throw new Error('eviction'); }); const off = m.onEvict(evictions);
    loader.release = vi.fn(() => { throw new Error('release'); });
    const p = m.preloadGroup('scene'); succeed(0); succeed(1); await p;
    expect(seen).toHaveBeenCalled(); stop(); const count = seen.mock.calls.length;
    expect(() => m.releaseGroup('scene')).not.toThrow();
    expect(seen).toHaveBeenCalledTimes(count); expect(evictions.mock.calls.map(([e]) => e.key)).toEqual(['a', 'b']);
    expect(loader.release).toHaveBeenCalledTimes(2); expect(m.isLoaded('a')).toBe(false); expect(m.isLoaded('b')).toBe(false);
    off(); const again = m.preloadGroup('scene'); succeed(2); succeed(3); await again; m.clear();
    expect(evictions).toHaveBeenCalledTimes(2);
  });
});

describe('asset groups — cancellation and request identity races', () => {
  it('release rejects the waiting facade immediately with AbortError and does not cancel another group sharing the key', async () => {
    const { manager: m, calls, succeed } = controlled(); m.registerGroups({ left: ['shared'], right: ['shared'] });
    const left = capture(m.preloadGroup('left')); const right = m.preloadGroup('right');
    m.releaseGroup('left'); expect(await left).toMatchObject({ name: 'AbortError' });
    expect(m.groupProgress('left')).toMatchObject({ status: 'unloaded', loaded: 0 });
    expect(calls).toHaveLength(1); succeed(0); await right;
    expect(m.groupProgress('right')).toMatchObject({ status: 'ready', loaded: 1 });
    expect(m.groupProgress('left')).toMatchObject({ status: 'unloaded', loaded: 0 });
  });

  it.each(['success', 'failure'] as const)('cancel then reload: stale %s cannot overwrite new cache, delete its inflight, or change progress', async (outcome) => {
    const { manager: m, calls, succeed, released } = controlled(); m.registerGroups({ scene: ['a'] });
    const old = capture(m.preloadGroup('scene')); m.releaseGroup('scene');
    expect(await old).toMatchObject({ name: 'AbortError' });
    const next = m.preloadGroup('scene'); expect(calls).toHaveLength(2);
    if (outcome === 'success') succeed(0, 100); else calls[0].reject(new Error('obsolete failure'));
    await flush();
    expect(m.get('a')).toBeUndefined();
    expect(m.groupProgress('scene')).toMatchObject({ status: 'loading', loaded: 0, failed: 0, errors: [] });
    const direct = m.load('a'); expect(calls).toHaveLength(2);
    succeed(1, 200); await Promise.all([next, direct]);
    expect(m.get('a')?.handle).toEqual({ key: 'a', generation: 200 });
    expect(m.groupProgress('scene')).toMatchObject({ status: 'ready', loaded: 1, failed: 0 });
    expect(released.map((a) => a.handle)).toEqual(outcome === 'success' ? [{ key: 'a', generation: 100 }] : []);
  });

  it('late old success after the new generation is ready never replaces or evicts the new asset', async () => {
    const { manager: m, succeed, released } = controlled(); m.registerGroups({ scene: ['a'] });
    const old = capture(m.preloadGroup('scene')); m.releaseGroup('scene'); await old;
    const next = m.preloadGroup('scene'); succeed(1, 2); await next; const current = m.get('a');
    succeed(0, 1); await flush();
    expect(m.get('a')).toBe(current); expect(released.map((a) => a.handle)).toEqual([{ key: 'a', generation: 1 }]);
    expect(m.groupProgress('scene')).toMatchObject({ status: 'ready', loaded: 1, failed: 0 });
  });

  it.each(['success', 'failure'] as const)('clear invalidates old %s without deleting same-key replacement inflight or resurrecting groups', async (outcome) => {
    const { manager: m, calls, succeed, released } = controlled(); m.registerGroups({ scene: ['a'] });
    const old = capture(m.preloadGroup('scene')); m.clear();
    expect(await old).toMatchObject({ name: 'AbortError' });
    expect(m.has('a')).toBe(false); expect(m.groupProgress('scene')).toBeUndefined();
    m.register({ kind: 'texture', key: 'a', src: 'new.png' }); m.registerGroups({ scene: ['a'] });
    const next = m.preloadGroup('scene');
    if (outcome === 'success') succeed(0, 1); else calls[0].reject(new Error('old catch'));
    await flush(); const direct = m.load('a'); expect(calls).toHaveLength(2);
    expect(m.get('a')).toBeUndefined(); expect(m.groupProgress('scene')).toMatchObject({ status: 'loading', failed: 0 });
    succeed(1, 2); await Promise.all([next, direct]);
    expect(m.get('a')?.descriptor.src).toBe('new.png'); expect(m.get('a')?.handle).toEqual({ key: 'a', generation: 2 });
    expect(released).toHaveLength(outcome === 'success' ? 1 : 0);
  });

  it('cancelling pending keys emits key eviction before late results and does not notify for unrelated keys', async () => {
    const { manager: m, succeed, released } = controlled(); m.registerGroups({ scene: ['a'] });
    const unrelated = m.load('b'); const old = capture(m.preloadGroup('scene'));
    const events: Array<{ key: string; asset?: LoadedAsset }> = []; m.onEvict((event) => events.push(event));
    m.releaseGroup('scene'); expect(await old).toMatchObject({ name: 'AbortError' });
    expect(events).toEqual([{ key: 'a', asset: undefined }]);
    succeed(1); succeed(0); await unrelated; await flush();
    expect(m.isLoaded('a')).toBe(false); expect(m.isLoaded('b')).toBe(true);
    expect(released.map((asset) => asset.descriptor.key)).toEqual(['a']);
    expect(events).toHaveLength(1);
  });

  it('clear on an inflight legacy load allows its promise to finish but discards and releases its result', async () => {
    const { manager: m, succeed, released } = controlled(); const old = m.load('a');
    m.clear(); succeed(0); const result = await old;
    expect(m.get('a')).toBeUndefined(); expect(m.has('a')).toBe(false); expect(released).toEqual([result]);
  });
});
