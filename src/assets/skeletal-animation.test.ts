import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetManager, StubAssetLoader, ModelAssetLoader, isModelHandle, parseAssetIndex, registerAssetIndex } from './index.js';
import type { AssetLoader, SkeletalAnimationDescriptor } from './index.js';
import { parseSkeletalAnimationSpec } from './skeletal-animation-data.js';

const spec = { skeleton: 'apollo-humanoid-v1' as const, fps: 30, frames: 31, loop: true };
const entry = { id: 'motion/walk', type: 'animation', description: 'walk', status: 'filled', path: 'motions/walk.glb', spec };
const descriptor: SkeletalAnimationDescriptor = { kind: 'skeletal-animation', key: entry.id, src: entry.path, ...spec };
const indexOf = (metadata: unknown) => ({ version: 1, assets: [{ ...entry, spec: metadata }] });

// A self-contained two-key GLB: no renderer/decoder participates in these byte-loading tests.
function clipBytes(): Uint8Array {
  const data = new Float32Array([0, 1, 0, 0, 0, 1, 0, 0, 1, 0]);
  const doc = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'Hips' }],
    buffers: [{ byteLength: data.byteLength }], bufferViews: [{ buffer: 0, byteLength: 8 }, { buffer: 0, byteOffset: 8, byteLength: 32 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
      { bufferView: 1, componentType: 5126, count: 2, type: 'VEC4' }],
    animations: [{ name: 'walk', samplers: [{ input: 0, output: 1 }], channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }] }] };
  const json = new TextEncoder().encode(JSON.stringify(doc));
  const padded = Math.ceil(json.length / 4) * 4;
  const bytes = new Uint8Array(12 + 8 + padded + 8 + data.byteLength), view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.length, true);
  view.setUint32(12, padded, true); view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(32, 20, 20 + padded); bytes.set(json, 20);
  view.setUint32(20 + padded, data.byteLength, true); view.setUint32(24 + padded, 0x004e4942, true);
  bytes.set(new Uint8Array(data.buffer), 28 + padded);
  return bytes;
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('E2 skeletal animation asset metadata', () => {
  it.each([
    ['skeleton', 'other'], ['skeleton', null], ['fps', undefined], ['fps', 0], ['fps', 121], ['fps', 1.5],
    ['fps', NaN], ['fps', Infinity], ['fps', '30'], ['frames', undefined], ['frames', 1], ['frames', 36002],
    ['frames', 2.5], ['frames', Infinity], ['loop', undefined], ['loop', 'true'], ['loop', 0], ['extra', true],
  ])('rejects malformed %s=%s before registration', (field, value) => {
    expect(() => parseAssetIndex(indexOf({ ...spec, [field]: value }))).toThrow(/skeletal-animation/);
  });

  it('accepts both inclusive sampling limits and both loop modes', () => {
    expect(parseSkeletalAnimationSpec({ ...spec, fps: 1, frames: 2, loop: false })).toEqual({ ...spec, fps: 1, frames: 2, loop: false });
    expect(parseSkeletalAnimationSpec({ ...spec, fps: 120, frames: 36001 })).toEqual({ ...spec, fps: 120, frames: 36001 });
  });

  it('direct physical registration also rejects invalid sampling metadata', () => {
    const manager = new AssetManager(new StubAssetLoader());
    expect(() => manager.register({ ...descriptor, fps: 0 })).toThrow(/fps/);
    expect(manager.has(descriptor.key)).toBe(false);
  });

  it('bridges only explicitly skeletal entries, preserving 2D atlas animation and legacy metadata', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const manager = new AssetManager(new StubAssetLoader());
    manager.register({ kind: 'atlas', key: 'atlas', src: 'sprites.png', frames: {
      a: { x: 4, y: 8, w: 16, h: 24 }, b: { x: 30, y: 0, w: 8, h: 12 },
    } });
    manager.registerAnimation({ key: 'attack', atlas: 'atlas', frames: ['b', 'a'] });
    const index = parseAssetIndex({ version: 1, assets: [entry,
      { ...entry, id: 'old', spec: { frames: ['b', 'a'], atlas: 'atlas', freeform: true } },
      { ...entry, id: 'pending', status: 'tbf' },
    ] });
    registerAssetIndex(manager, index, '/assets'); registerAssetIndex(manager, index, '/assets');
    expect(log.mock.calls.filter(call => String(call[0]).includes('skip legacy animation'))).toHaveLength(1);
    expect(manager.has('old')).toBe(false); expect(manager.has('pending')).toBe(false);
    await manager.load('atlas');
    expect(manager.resolve('attack', 0)).toMatchObject({ sx: 30, sy: 0, sw: 8, sh: 12 });
    expect(manager.resolve('attack', 1)).toMatchObject({ sx: 4, sy: 8, sw: 16, sh: 24 });
    expect(manager.resolve('attack', 2)).toBeUndefined();
    const loaded = await manager.load(entry.id);
    expect(loaded.descriptor).toEqual({ ...descriptor, src: '/assets/motions/walk.glb' });
    expect(loaded).toMatchObject({ width: 0, height: 0 });
    expect(manager.resolve(entry.id, 0)).toBeUndefined();
  });

  it('rejects legacy animations as physical group members', () => {
    expect(() => parseAssetIndex({ ...indexOf({ fps: 30 }), groups: { scene: [entry.id] } })).toThrow(/非物理资产/);
  });

  it('validates malformed metadata when a caller bypasses parseAssetIndex', () => {
    const manager = new AssetManager(new StubAssetLoader());
    expect(() => registerAssetIndex(manager, indexOf({ ...spec, loop: 1 }) as never)).toThrow(/loop/);
    expect(manager.has(entry.id)).toBe(false);
  });
});

describe('E2 skeletal physical byte loading and groups', () => {
  it('fetches real ArrayBuffer bytes through the existing loader and keeps the distinct kind', async () => {
    const bytes = clipBytes(), manager = new AssetManager(new ModelAssetLoader());
    const src = 'data:model/gltf-binary;base64,' + Buffer.from(bytes).toString('base64');
    const index = parseAssetIndex({ version: 1, assets: [{ ...entry, path: src, spec: { ...spec, fps: 1, frames: 2 } }] });
    registerAssetIndex(manager, index);
    const loaded = await manager.load(entry.id);
    expect(loaded.handle).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(loaded.handle as ArrayBuffer)).toEqual(bytes);
    expect(loaded.descriptor.kind).toBe('skeletal-animation');
    expect(loaded.descriptor.kind).not.toBe('model');
    expect(loaded).toMatchObject({ width: 0, height: 0 });
    expect(isModelHandle(loaded.handle)).toBe(true); // Legacy byte guard remains unchanged; kind disambiguates.
    expect(manager.resolve(entry.id)).toBeUndefined();
  });

  it('uses the same relative URL fetch and HTTP failure semantics as models', async () => {
    const bytes = clipBytes().buffer;
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, arrayBuffer: async () => bytes })
      .mockResolvedValueOnce({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetcher);
    const loader = new ModelAssetLoader('/base/');
    expect((await loader.load(descriptor)).handle).toBe(bytes);
    expect(fetcher).toHaveBeenNthCalledWith(1, '/base/motions/walk.glb');
    await expect(loader.load(descriptor)).rejects.toThrow(/HTTP 404/);
  });

  it('shares physical group ownership, evicts once after the last reference, and reloads fresh bytes', async () => {
    const evicted: string[] = [];
    const load = vi.fn(async () => ({ handle: clipBytes().buffer, width: 0, height: 0 }));
    const release = vi.fn();
    const manager = new AssetManager({ load, release });
    const index = parseAssetIndex({ ...indexOf(spec), groups: { A: [entry.id], B: [entry.id] }, initialGroup: 'A' });
    registerAssetIndex(manager, index);
    manager.onEvict(event => evicted.push(event.key));
    await Promise.all([manager.preloadGroup('A'), manager.preloadGroup('B')]);
    const first = manager.get(entry.id)!;
    expect(load).toHaveBeenCalledTimes(1);
    expect(manager.groupProgress('A')).toMatchObject({ status: 'ready', loaded: 1, total: 1 });
    manager.releaseGroup('A'); expect(manager.get(entry.id)).toBe(first); expect(release).not.toHaveBeenCalled();
    manager.releaseGroup('B'); expect(manager.get(entry.id)).toBeUndefined();
    expect(evicted).toEqual([entry.id]); expect(release).toHaveBeenCalledTimes(1); expect(release).toHaveBeenCalledWith(first);
    await manager.preloadGroup('A');
    expect(load).toHaveBeenCalledTimes(2); expect(manager.get(entry.id)!.handle).not.toBe(first.handle);
    manager.clear(); expect(release).toHaveBeenCalledTimes(2);
  });

  it('discards cancelled skeletal bytes without replacing the next group generation', async () => {
    const pending: ((value: { handle: ArrayBuffer; width: number; height: number }) => void)[] = [];
    const release = vi.fn(), loader: AssetLoader = {
      load: () => new Promise(resolve => pending.push(resolve)), release,
    };
    const manager = new AssetManager(loader);
    registerAssetIndex(manager, parseAssetIndex({ ...indexOf(spec), groups: { A: [entry.id] } }));
    const old = manager.preloadGroup('A');
    const cancelled = expect(old).rejects.toMatchObject({ name: 'AbortError' });
    manager.releaseGroup('A'); await cancelled;
    const fresh = manager.preloadGroup('A'), newBytes = clipBytes().buffer as ArrayBuffer;
    pending[1]({ handle: newBytes, width: 0, height: 0 }); await fresh;
    const oldBytes = clipBytes().buffer as ArrayBuffer;
    pending[0]({ handle: oldBytes, width: 0, height: 0 });
    await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(1));
    expect(release.mock.calls[0][0].handle).toBe(oldBytes);
    expect(manager.get(entry.id)!.handle).toBe(newBytes);
    expect(manager.groupProgress('A')!.status).toBe('ready');
  });
});
