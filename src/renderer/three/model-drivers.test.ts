import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { AssetManager, AssetDescriptor } from '@assets/index.js';
import type { AnimationDriver3D, AnimationDriverPlayback3D } from '@engine/protocol/components/animation-driver.js';
import { createAnimationDriver, stepAnimationDriver } from '@engine/animation/driver.js';
// @ts-expect-error Synthetic rig only; not provider or visual acceptance evidence.
import { makeMockCharacterGlb } from '../../../scripts/fixtures/character-pipeline/mock-character.mjs';
import { ModelPool } from './models.js';
function bytes(clipName?: string, doubled = false): ArrayBuffer {
  let result: Buffer = makeMockCharacterGlb({ clipName });
  if (doubled) {
    const length = result.readUInt32LE(12), json = JSON.parse(result.subarray(20, 20 + length).toString()), bin = result.subarray(28 + length); json.nodes[0].translation[1] = 1.9;
    const text = Buffer.from(JSON.stringify(json)), padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32); text.copy(padded);
    result = Buffer.alloc(28 + padded.length + bin.length); result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8); result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); result.writeUInt32LE(bin.length, 20 + padded.length); result.writeUInt32LE(0x004e4942, 24 + padded.length); bin.copy(result, 28 + padded.length);
  }
  return Uint8Array.from(result).buffer;
}
function config(asset: string | null = 'walk', durationTicks = 30, retarget?: 'humanoid'): AnimationDriver3D {
  return { type: 'AnimationDriver3D', version: 1, tickRate: 30, initialState: 'move', graph: { type: 'AnimGraph3D', clips: { move: { clip: asset ? 'walk' : 'builtin', ...(asset ? { asset } : {}), loop: false, ...(retarget ? { retarget } : {}) } }, states: { move: { clip: 'move' } }, params: { speed: 'speed' }, transitions: [] }, clips: { move: { durationTicks } } };
}
function setup() {
  const loaded = new Map<string, { descriptor: AssetDescriptor; handle: ArrayBuffer }>(), listeners = new Set<(e: { key: string }) => void>();
  const manager = { get: vi.fn((key: string) => loaded.get(key)), load: vi.fn(), onEvict(cb: (e: { key: string }) => void) { listeners.add(cb); return () => listeners.delete(cb); } };
  const scene = new THREE.Scene(), pool = new ModelPool(manager as unknown as AssetManager);
  const load = (key: string, handle: ArrayBuffer, motion = false) => loaded.set(key, { handle, descriptor: motion ? { kind: 'skeletal-animation', key, src: '/fixture.glb', skeleton: 'apollo-humanoid-v1', fps: 30, frames: 31, loop: false } : { kind: 'model', key, src: '/fixture.glb' } });
  const evict = (key: string) => { loaded.delete(key); for (const cb of listeners) cb({ key }); };
  return { loaded, manager, scene, pool, load, evict, listeners };
}
async function until(predicate: () => boolean): Promise<void> { for (let i = 0; i < 500; i++) { if (predicate()) return; await Promise.resolve(); } throw new Error('synthetic GLB readiness timeout'); }
async function ready(f: ReturnType<typeof setup>, id = 'a', key = 'model') { let object: THREE.Object3D | null = null; await until(() => !!(object = f.pool.ensure(f.scene, id, { type: 'Model3D', modelKey: key }))); return object!; }
async function driven(f: ReturnType<typeof setup>, c: AnimationDriver3D, p: AnimationDriverPlayback3D, id = 'a') { await until(() => { f.pool.applyDriver(id, c, p); return !!(f.pool as any).drivers.get(id)?.sampler || !!(f.pool as any).drivers.get(id)?.failed; }); }
function seek(c: AnimationDriver3D, ticks: number) { return stepAnimationDriver(c, createAnimationDriver(c), { commands: [{ seq: 1, op: 'seek', tick: ticks }] }).playback; }
function hips(object: THREE.Object3D) { let h!: THREE.Bone; object.traverse(n => { if ((n as THREE.Bone).isBone && n.name === 'Hips') h = n as THREE.Bone; }); return h; }
afterEach(() => vi.restoreAllMocks());
describe('ModelPool committed animation driver through real GLTFLoader', () => {
  it('samples delayed external motion at the latest snapshot, not parse or wall-clock time', async () => {
    const f = setup(), c = config(); f.load('model', bytes()); const object = await ready(f); const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    f.pool.applyDriver('a', c, seek(c, 3)); f.pool.update(1000); expect(hips(object).position.x).toBe(0);
    const p = seek(c, 24), before = JSON.stringify(p);
    f.pool.applyDriver('a', c, p); f.load('walk', bytes('walk'), true); await driven(f, c, p); f.pool.update(2000); expect(hips(object).position.x).toBeCloseTo(.04, 6);
    f.pool.update(999999); f.pool.update(1); expect(hips(object).position.x).toBeCloseTo(.04, 6); expect(JSON.stringify(p)).toBe(before); expect(warn).toHaveBeenCalledOnce(); expect(f.manager.load).not.toHaveBeenCalled(); f.pool.dispose(f.scene);
  });
  it('owns a validated configuration snapshot while an external clip is loading', async () => {
    const f = setup(), c = config(), p = seek(c, 15); f.load('model', bytes()); const object = await ready(f); vi.spyOn(console, 'warn').mockImplementation(() => {});
    f.pool.applyDriver('a', c, p);
    // A caller mutating its object cannot silently alter an asynchronous binding.
    (c.clips.move as { durationTicks: number }).durationTicks = 60;
    f.load('walk', bytes('walk'), true);
    await until(() => { f.pool.update(1000); return !!(f.pool as any).drivers.get('a')?.sampler; });
    expect(hips(object).position.x).toBeCloseTo(.025); expect((f.pool as any).drivers.get('a').config.clips.move.durationTicks).toBe(30);
    f.pool.applyDriver('a', c, p); expect((f.pool as any).drivers.size).toBe(0); f.pool.dispose(f.scene);
  });
  it('isolates model instances and restores exact first/end/rewound poses without advancing legacy mixers', async () => {
    const f = setup(), c = config(null); f.load('model', bytes('builtin')); const a = await ready(f), b = await ready(f, 'b');
    const oldUpdate = vi.spyOn((f.pool as any).anims.get('a').mixer, 'update');
    await driven(f, c, seek(c, 30)); await driven(f, c, seek(c, 12), 'b'); f.pool.update(1000); expect(hips(a).position.x).toBeCloseTo(.05); expect(hips(b).position.x).toBeCloseTo(.02);
    f.pool.applyDriver('a', c, seek(c, 0)); f.pool.update(5000); expect(hips(a).position.x).toBe(0); expect(hips(b).position.x).toBeCloseTo(.02); expect(oldUpdate).not.toHaveBeenCalled(); f.pool.dispose(f.scene);
  });
  it('renders serialized paused playback identically across restore, replay and arbitrary render frequency', async () => {
    const f = setup(), c = config(null); f.load('model', bytes('builtin')); const object = await ready(f);
    object.position.set(7, 8, 9);
    let p = createAnimationDriver(c); for (let i = 0; i < 15; i++) p = stepAnimationDriver(c, p).playback;
    p = stepAnimationDriver(c, p, { commands: [{ seq: 1, op: 'pause' }] }).playback;
    const saved = JSON.stringify(p); await driven(f, c, p);
    for (const time of [1000, 1001, 2000, 99999, 0]) { f.pool.update(time); expect(hips(object).position.x).toBeCloseTo(.025); }
    expect(object.position.toArray()).toEqual([7, 8, 9]); expect(JSON.stringify(p)).toBe(saved);
    f.pool.applyDriver('a', c, seek(c, 30)); f.pool.update(2000); expect(hips(object).position.x).toBeCloseTo(.05);
    f.pool.applyDriver('a', c, JSON.parse(saved)); f.pool.update(3000); expect(hips(object).position.x).toBeCloseTo(.025);
    p = stepAnimationDriver(c, p, { commands: [{ seq: 2, op: 'play', state: 'move' }] }).playback;
    f.pool.applyDriver('a', c, p); f.pool.update(4000); expect(hips(object).position.x).toBe(0); f.pool.dispose(f.scene);
  });
  it('rejects declared/native duration disagreement rather than changing submitted timing', async () => {
    const f = setup(), c = config(null, 60); f.load('model', bytes('builtin')); const object = await ready(f); const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), p = seek(c, 15), before = JSON.stringify(p);
    await driven(f, c, p); for (let i = 0; i < 5; i++) f.pool.applyDriver('a', c, p); f.pool.update(1000); expect((f.pool as any).drivers.get('a').failed).toBe(true); expect(warn).toHaveBeenCalledOnce(); expect(warn.mock.calls.flat().join(' ')).toContain('duration mismatch'); expect(JSON.stringify(p)).toBe(before); expect(hips(object).position.x).toBe(0); f.pool.dispose(f.scene);
  });
  it('preserves M1 retarget binding and per-instance source immutability', async () => {
    const f = setup(), c = config('walk', 30, 'humanoid'); f.load('model', bytes()); f.load('walk', bytes('walk', true), true); const object = await ready(f); vi.spyOn(console, 'info').mockImplementation(() => {});
    await driven(f, c, seek(c, 15)); f.pool.update(1000); expect(hips(object).position.x).toBeCloseTo(.0125, 6); expect(hips(object).position.y).toBeCloseTo(.475, 6); expect((f.pool as any).motions.get('walk').clip.duration).toBe(1); f.pool.dispose(f.scene);
  });
  it('evicts/reloads motion at the same snapshot, and clears bindings on model switch/sweep/disposal', async () => {
    const f = setup(), c = config(); f.load('model', bytes()); f.load('model2', bytes()); f.load('walk', bytes('walk'), true); const a = await ready(f); await driven(f, c, seek(c, 18)); f.pool.update(1000); expect(hips(a).position.x).toBeCloseTo(.03);
    const sampler = (f.pool as any).drivers.get('a').sampler; f.evict('walk'); expect((f.pool as any).drivers.get('a').sampler).toBeUndefined(); expect(() => sampler.sample([])).toThrow(/disposed/); expect(hips(a).position.x).toBe(0);
    f.load('walk', bytes('walk'), true); await driven(f, c, seek(c, 18)); f.pool.update(5000); expect(hips(a).position.x).toBeCloseTo(.03);
    const next = await ready(f, 'a', 'model2'); expect((f.pool as any).drivers.size).toBe(0); await driven(f, c, seek(c, 18)); f.pool.update(6000); expect(hips(next).position.x).toBeCloseTo(.03); f.pool.sweep(f.scene, new Set()); expect((f.pool as any).drivers.size).toBe(0); expect(f.pool.count).toBe(0); f.pool.dispose(f.scene); expect(f.listeners.size).toBe(0);
  });
  it('cancels a late GLTF callback after disposal without resurrecting a driver', async () => {
    const f = setup(), c = config(); f.load('model', bytes()); await ready(f); f.load('walk', bytes('walk'), true);
    const original = GLTFLoader.prototype.parse, callbacks: Array<() => void> = [];
    vi.spyOn(GLTFLoader.prototype, 'parse').mockImplementation(function (this: GLTFLoader, data, path, done, fail) { original.call(this, data, path, (gltf: GLTF) => callbacks.push(() => done(gltf)), fail); });
    f.pool.applyDriver('a', c, seek(c, 21)); await until(() => callbacks.length === 1); f.pool.dispose(f.scene); callbacks[0](); f.pool.update(1000); expect(f.pool.count).toBe(0); expect((f.pool as any).drivers.size).toBe(0); expect((f.pool as any).motions.size).toBe(0);
  });
  it('rejects mismatched playback, and explicit conflicts stop both new and legacy paths without fallback', async () => {
    const f = setup(), c = config(null); f.load('model', bytes('builtin')); const object = await ready(f); await driven(f, c, seek(c, 15)); f.pool.update(1000); expect(hips(object).position.x).toBeCloseTo(.025); const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wrong = { ...c, tickRate: 60 }; f.pool.applyDriver('a', wrong, seek(c, 15)); expect((f.pool as any).drivers.size).toBe(0); expect(hips(object).position.x).toBe(0); expect(warn).toHaveBeenCalledOnce();
    f.pool.applyAnim('a', { type: 'AnimState3D', clip: 'builtin' }); f.pool.rejectDriver('a', 'exclusive driver conflict'); f.pool.rejectDriver('a', 'exclusive driver conflict'); expect((f.pool as any).anims.get('a').action).toBeUndefined(); expect(warn).toHaveBeenCalledTimes(2); f.pool.update(2000); expect(hips(object).position.x).toBe(0); f.pool.dispose(f.scene);
  });
});
