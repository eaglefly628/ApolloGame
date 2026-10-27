import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { AssetManager, AssetDescriptor } from '@assets/index.js';
import type { AnimGraph3D } from '@engine/protocol/components.js';
// @ts-expect-error Explicit synthetic fixture, not provider/ARP acceptance evidence.
import { makeMockCharacterGlb } from '../../../scripts/fixtures/character-pipeline/mock-character.mjs';
import { ModelPool } from './models.js';

function bytes(clipName?: string, edit?: (json: any, bin: Buffer) => void | Buffer): ArrayBuffer {
  let result: Buffer = makeMockCharacterGlb({ clipName });
  if (edit) {
    const length = result.readUInt32LE(12), json = JSON.parse(result.subarray(20, 20 + length).toString()); let bin: Buffer = Buffer.from(result.subarray(28 + length)); const changed = edit(json, bin); if (changed) bin = changed; json.buffers[0].byteLength = bin.length;
    const text = Buffer.from(JSON.stringify(json)), padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32); text.copy(padded);
    result = Buffer.alloc(28 + padded.length + bin.length); result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
    result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); result.writeUInt32LE(bin.length, 20 + padded.length); result.writeUInt32LE(0x004e4942, 24 + padded.length); bin.copy(result, 28 + padded.length);
  }
  return Uint8Array.from(result).buffer;
}
function graph(speed = 1, asset: string | undefined = 'walk', clip = 'walk', loop?: boolean): AnimGraph3D {
  return { type: 'AnimGraph3D', clips: { action: { ...(asset === undefined ? {} : { asset }), clip, speed, ...(loop === undefined ? {} : { loop }) } }, states: { move: { clip: 'action' } }, params: { speed: 'speed' }, transitions: [] };
}
function setup() {
  const loaded = new Map<string, { descriptor: AssetDescriptor; handle: ArrayBuffer }>(), listeners = new Set<(e: { key: string }) => void>();
  const manager = { get: vi.fn((key: string) => loaded.get(key)), load: vi.fn(), onEvict(callback: (e: { key: string }) => void) { listeners.add(callback); return () => listeners.delete(callback); } };
  const scene = new THREE.Scene(), pool = new ModelPool(manager as unknown as AssetManager);
  const load = (key: string, handle: ArrayBuffer, motion = false, loop = true) => loaded.set(key, { handle, descriptor: motion ? { kind: 'skeletal-animation', key, src: '/fixture.glb', skeleton: 'apollo-humanoid-v1', fps: 30, frames: 31, loop } : { kind: 'model', key, src: '/fixture.glb' } });
  const evict = (key: string) => { loaded.delete(key); for (const callback of listeners) callback({ key }); };
  return { pool, scene, manager, loaded, listeners, load, evict };
}
async function until(predicate: () => boolean): Promise<void> { for (let i = 0; i < 300; i++) { if (predicate()) return; await Promise.resolve(); } throw new Error('real GLB parse timeout'); }
async function ready(f: ReturnType<typeof setup>, id = 'a', modelKey = 'model'): Promise<THREE.Object3D> { let result: THREE.Object3D | null = null; await until(() => !!(result = f.pool.ensure(f.scene, id, { type: 'Model3D', modelKey }))); return result!; }
async function playing(f: ReturnType<typeof setup>, id = 'a', spec = graph()): Promise<void> { await until(() => { f.pool.applyGraph(id, spec, {}); return !!(f.pool as any).graphs.get(id)?.controller || !!(f.pool as any).graphs.get(id)?.failed; }); }
function hips(object: THREE.Object3D): THREE.Bone { let bone!: THREE.Bone; object.traverse(n => { if ((n as THREE.Bone).isBone && n.name === 'Hips') bone = n as THREE.Bone; }); return bone; }
function skinned(object: THREE.Object3D): THREE.SkinnedMesh { let mesh!: THREE.SkinnedMesh; object.traverse(n => { if ((n as THREE.SkinnedMesh).isSkinnedMesh) mesh = n as THREE.SkinnedMesh; }); return mesh; }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('ModelPool external animation graphs through real GLTFLoader', () => {
  it('M1: a motion authored on a skin with different proportions is rejected strictly but plays with retarget humanoid, hip travel scaled', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), info = vi.spyOn(console, 'info').mockImplementation(() => {}), f = setup();
    // Motion skin has hips twice as high (rest 1.9 vs 0.95): exact binding must refuse it.
    f.load('model', bytes()); f.load('walk', bytes('walk', json => { json.nodes[0].translation[1] = 1.9; }), true); await ready(f);
    await playing(f); expect((f.pool as any).graphs.get('a').failed).toBe(true); expect(warn).toHaveBeenCalledOnce();
    const retarget: AnimGraph3D = { ...graph(), clips: { action: { asset: 'walk', clip: 'walk', speed: 1, retarget: 'humanoid' } } };
    await playing(f, 'a', retarget); expect((f.pool as any).graphs.get('a').controller).toBeDefined(); expect(warn).toHaveBeenCalledOnce();
    expect(info.mock.calls.flat().join(' ')).toContain('hip scale 0.500');
    f.pool.update(1000); for (let ms = 1100; ms <= 1500; ms += 100) f.pool.update(ms); // update caps each step at 0.1s
    // Source hips sample at 0.5s = (0.025, 0.95, 0) against rest (0, 1.9, 0): delta (0.025, -0.95, 0) × 0.5 onto target rest (0, 0.95, 0).
    const h = hips((f.pool as any).instances.get('a')).position;
    expect(h.x).toBeCloseTo(0.0125, 5); expect(h.y).toBeCloseTo(0.475, 5); expect(h.z).toBeCloseTo(0, 6);
    f.pool.dispose(f.scene);
  });
  it('binds one motion to two different meshes plus two instances with independent skeletons/actions and no loads or source mutation', async () => {
    const f = setup(); f.load('model', bytes()); f.load('different', bytes(undefined, (json, bin) => { const p = json.accessors[0]; bin.writeFloatLE(-.6, json.bufferViews[p.bufferView].byteOffset); })); f.load('walk', bytes('walk'), true);
    const a = await ready(f), b = await ready(f, 'b'), c = await ready(f, 'c', 'different');
    a.position.set(7, 8, 9); b.position.set(-7, 2, 4);
    const vertex = (object: THREE.Object3D) => { object.updateMatrixWorld(true); skinned(object).skeleton.update(); return skinned(object).getVertexPosition(0, new THREE.Vector3()); };
    const before = [a, b, c].map(vertex);
    await playing(f); await playing(f, 'b', graph(.5)); await playing(f, 'c', graph(2));
    const source = (f.pool as any).motions.get('walk'), sourceName = source.clip.tracks[0].name;
    f.pool.update(1000); for (let time = 1100; time <= 1400; time += 100) f.pool.update(time);
    expect(hips(a).position.x).toBeCloseTo(.02, 5); expect(hips(b).position.x).toBeCloseTo(.01, 5); expect(hips(c).position.x).toBeCloseTo(.04, 5);
    [a, b, c].map(vertex).forEach((value, index) => expect(value.x - before[index].x).toBeCloseTo([.02, .01, .04][index], 5));
    expect(a.position.toArray()).toEqual([7, 8, 9]); expect(b.position.toArray()).toEqual([-7, 2, 4]); expect(skinned(a).skeleton).not.toBe(skinned(b).skeleton); expect(hips(a)).not.toBe(hips(b));
    expect(skinned(a).geometry).toBe(skinned(b).geometry); expect(skinned(a).geometry).not.toBe(skinned(c).geometry); expect(source.clip.tracks[0].name).toBe(sourceName);
    expect(f.manager.load).not.toHaveBeenCalled(); f.pool.dispose(f.scene);
  });

  it('invalidates asynchronous static readiness and clear/restoration once, and stops after the last one-shot frame', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = setup(); f.load('model', bytes()); const object = await ready(f);
    for (let i = 0; i < 5; i++) f.pool.applyGraph('a', graph(0), {}); expect(warn).toHaveBeenCalledOnce(); expect(f.pool.update(1000)).toBe(0);
    f.load('walk', bytes('walk'), true, false); await playing(f, 'a', graph(0));
    expect(f.pool.update(1100)).toBeGreaterThan(0); expect(f.pool.update(1200)).toBe(0);
    await playing(f, 'a', graph(1)); f.pool.update(1300); for (let time = 1400; time <= 2400; time += 100) f.pool.update(time);
    expect(hips(object).position.x).toBeCloseTo(.05, 5); expect(f.pool.update(2500)).toBe(0);
    f.pool.clearGraph('a'); expect(hips(object).position.x).toBeCloseTo(0); expect(f.pool.update(2600)).toBeGreaterThan(0); expect(f.pool.update(2700)).toBe(0);
    f.pool.clearGraph('a'); expect(f.pool.update(2800)).toBe(0); f.pool.applyGraph('a', graph(1, 'missing'), {}); expect((f.pool as any).missingMotions.size).toBe(1); f.pool.sweep(f.scene, new Set()); expect((f.pool as any).missingMotions.size).toBe(0); f.pool.dispose(f.scene);
  });

  it('retains old named fallback, quarter-second fade, and same-name loop behavior when legacy takes priority', async () => {
    const f = setup(); f.load('model', bytes('builtin')); f.load('walk', bytes('walk'), true); await ready(f); await playing(f);
    f.pool.applyAnim('a', { type: 'AnimState3D', clip: 'missing', loop: true });
    expect((f.pool as any).graphs.size).toBe(0);
    const anim = (f.pool as any).anims.get('a'); expect(anim.action.getClip().name).toBe('builtin'); expect(anim.action.loop).toBe(THREE.LoopRepeat);
    expect(anim.action._weightInterpolant.parameterPositions[1] - anim.action._weightInterpolant.parameterPositions[0]).toBeCloseTo(.25);
    f.pool.applyAnim('a', { type: 'AnimState3D', clip: 'missing', loop: false, speed: 2 }); expect(anim.action.loop).toBe(THREE.LoopRepeat); expect(anim.action.timeScale).toBe(2);
    f.pool.dispose(f.scene);
  });

  it('refuses actual wrong descriptor kinds for models and motions, warning only on the rejected generation', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), parse = vi.spyOn(GLTFLoader.prototype, 'parse'), f = setup();
    f.load('wrong-model', bytes('walk'), true); for (let i = 0; i < 5; i++) expect(f.pool.ensure(f.scene, 'bad', { type: 'Model3D', modelKey: 'wrong-model' })).toBeNull(); expect(parse).not.toHaveBeenCalled(); expect(warn).toHaveBeenCalledOnce();
    f.load('model', bytes()); f.load('walk', bytes('walk')); await ready(f); await playing(f); for (let i = 0; i < 5; i++) f.pool.applyGraph('a', graph(), {});
    expect(parse).toHaveBeenCalledOnce(); expect(warn).toHaveBeenCalledTimes(3); f.pool.dispose(f.scene);
  });

  it('gates external URIs before parser invocation and passes a frozen byte snapshot', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = setup(); f.load('model', bytes()); await ready(f);
    const original = GLTFLoader.prototype.parse, parser = vi.spyOn(GLTFLoader.prototype, 'parse');
    f.load('walk', bytes('walk', json => { json.images = [{ uri: 'https://invalid/hidden.png' }]; }), true); await playing(f); expect(parser).not.toHaveBeenCalled();
    f.evict('walk'); const handle = bytes('walk'); f.load('walk', handle, true); await playing(f); expect(parser).toHaveBeenCalledOnce(); expect(parser.mock.calls[0][0]).not.toBe(handle); expect(new Uint8Array(parser.mock.calls[0][0] as ArrayBuffer)).toEqual(new Uint8Array(handle)); expect(warn).toHaveBeenCalledTimes(2); expect(GLTFLoader.prototype.parse).not.toBe(original);
    f.pool.dispose(f.scene);
  });

  it('rejects bad rest/exact names once then rebuilds after resource eviction, graph changes and model selectors', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = setup(); f.load('model', bytes()); f.load('walk', bytes('walk', json => { json.nodes[4].translation[1] += .01; }), true); await ready(f); await playing(f);
    expect(warn).toHaveBeenCalledOnce(); for (let i = 0; i < 20; i++) f.pool.applyGraph('a', graph(), {}); expect(warn).toHaveBeenCalledOnce();
    f.evict('walk'); f.load('walk', bytes('walk'), true); await playing(f); expect((f.pool as any).graphs.get('a').controller).toBeDefined();
    f.pool.applyGraph('a', graph(1, 'walk', 'missing'), {}); expect(warn).toHaveBeenCalledTimes(2); await playing(f); f.pool.update(1000); f.pool.update(1100);
    const original = (f.pool as any).instances.get('a'); const selected = f.pool.ensure(f.scene, 'a', { type: 'Model3D', modelKey: 'model', origin: [1, 0, 0] }); expect(selected).not.toBe(original); expect((f.pool as any).graphs.size).toBe(0); await playing(f); expect(warn).toHaveBeenCalledTimes(2); f.pool.dispose(f.scene);
  });

  it('owns external scene geometry/material/skeleton and cancels late real parse callbacks without contaminating reloads', async () => {
    const f = setup(); f.load('model', bytes()); await ready(f);
    const original = GLTFLoader.prototype.parse, held: { gltf: GLTF; deliver(): void }[] = [];
    vi.spyOn(GLTFLoader.prototype, 'parse').mockImplementation(function (this: GLTFLoader, data, path, success, failure) { original.call(this, data, path, gltf => { held.push({ gltf, deliver: () => success(gltf) }); }, failure); });
    f.load('walk', bytes('walk'), true); f.pool.applyGraph('a', graph(), {}); await until(() => held.length === 1);
    const old = held[0], mesh = skinned(old.gltf.scene), resources = [vi.spyOn(mesh.geometry, 'dispose'), vi.spyOn(mesh.material as THREE.Material, 'dispose'), vi.spyOn(mesh.skeleton, 'dispose')];
    f.evict('walk'); for (const disposed of resources) expect(disposed).toHaveBeenCalledOnce();
    f.load('walk', bytes('walk'), true); f.pool.applyGraph('a', graph(), {}); await until(() => held.length === 2); const freshMesh = skinned(held[1].gltf.scene), freshDisposed = [vi.spyOn(freshMesh.geometry, 'dispose'), vi.spyOn(freshMesh.material as THREE.Material, 'dispose'), vi.spyOn(freshMesh.skeleton, 'dispose')]; held[1].deliver(); await playing(f); for (const release of freshDisposed) expect(release).toHaveBeenCalledOnce();
    const motion = (f.pool as any).motions.get('walk'), controller = (f.pool as any).graphs.get('a').controller; old.deliver();
    expect((f.pool as any).motions.get('walk')).toBe(motion); expect((f.pool as any).graphs.get('a').controller).toBe(controller); for (const disposed of resources) expect(disposed).toHaveBeenCalledOnce();
    f.pool.dispose(f.scene); expect(f.listeners.size).toBe(0);
  });

  it.each([false, true])('owns embedded image Blob URLs and late ImageBitmap disposal (cancel=%s)', async cancel => {
    const f = setup(); f.load('model', bytes()); await ready(f);
    class Bitmap { readonly width = 1; readonly height = 1; close = vi.fn(); }
    vi.stubGlobal('ImageBitmap', Bitmap); vi.stubGlobal('createImageBitmap', vi.fn()); vi.stubGlobal('self', globalThis);
    const image = new Bitmap(); let decode: (() => void) | undefined;
    vi.spyOn(THREE.ImageBitmapLoader.prototype, 'load').mockImplementation((_url, loaded) => { decode = () => loaded?.(image as unknown as ImageBitmap); });
    const created = vi.spyOn(URL, 'createObjectURL'), revoked = vi.spyOn(URL, 'revokeObjectURL'), disposed = vi.spyOn(THREE.Texture.prototype, 'dispose');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nZkAAAAASUVORK5CYII=', 'base64');
    f.load('walk', bytes('walk', (json, bin) => {
      json.images = [{ bufferView: json.bufferViews.length, mimeType: 'image/png' }]; json.bufferViews.push({ buffer: 0, byteOffset: bin.length, byteLength: png.length }); json.textures = [{ source: 0 }]; json.materials = [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }]; json.meshes[0].primitives[0].material = 0;
      const next = Buffer.alloc(Math.ceil((bin.length + png.length) / 4) * 4); bin.copy(next); png.copy(next, bin.length); return next;
    }), true);
    f.pool.applyGraph('a', graph(), {}); await until(() => !!decode); expect(created).toHaveBeenCalledOnce();
    if (cancel) { f.evict('walk'); expect(revoked).toHaveBeenCalledOnce(); }
    decode!();
    if (cancel) await until(() => image.close.mock.calls.length === 1); else await playing(f);
    expect(image.close).toHaveBeenCalledOnce(); expect(disposed).toHaveBeenCalled(); expect(revoked).toHaveBeenCalledOnce(); expect(revoked.mock.calls[0][0]).toBe(created.mock.results[0].value);
    if (cancel) expect((f.pool as any).motions.size).toBe(0); f.pool.dispose(f.scene);
  });

  it('disposes failed extraction scene resources and ignores pending old success after pool disposal/reuse', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = setup(); f.load('model', bytes()); await ready(f);
    const original = GLTFLoader.prototype.parse, held: { gltf: GLTF; deliver(): void }[] = [];
    vi.spyOn(GLTFLoader.prototype, 'parse').mockImplementation(function (this: GLTFLoader, data, path, success, failure) { original.call(this, data, path, gltf => { held.push({ gltf, deliver: () => success(gltf) }); }, failure); });
    f.load('walk', bytes('walk'), true); f.pool.applyGraph('a', graph(), {}); await until(() => held.length === 1);
    const mesh = skinned(held[0].gltf.scene), disposed = [vi.spyOn(mesh.geometry, 'dispose'), vi.spyOn(mesh.material as THREE.Material, 'dispose'), vi.spyOn(mesh.skeleton, 'dispose')];
    held[0].gltf.animations[0].tracks[0].values[0] = NaN; held[0].deliver(); for (const release of disposed) expect(release).toHaveBeenCalledOnce(); expect(warn).toHaveBeenCalledOnce();
    f.evict('walk'); f.load('walk', bytes('walk'), true); f.pool.applyGraph('a', graph(), {}); await until(() => held.length === 2); f.pool.dispose(f.scene); held[1].deliver(); expect((f.pool as any).motions.size).toBe(0); expect((f.pool as any).motionState.size).toBe(0);
    f.pool.dispose(f.scene);
  });

  it('rejects malformed/cyclic direct graph input once, clears previous bindings and clamps only graph clock reversal', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), f = setup(); f.load('model', bytes()); f.load('walk', bytes('walk'), true); const object = await ready(f); await playing(f); f.pool.update(1000); f.pool.update(1100); expect(hips(object).position.x).toBeGreaterThan(0);
    const invalid: any = { type: 'AnimGraph3D', clips: null, states: null, params: null }; invalid.cycle = invalid;
    for (let i = 0; i < 5; i++) expect(() => f.pool.applyGraph('a', invalid, {})).not.toThrow(); expect(warn).toHaveBeenCalledOnce(); expect((f.pool as any).graphs.size).toBe(0); expect(hips(object).position.x).toBeCloseTo(0);
    await playing(f); expect(() => f.pool.update(900)).not.toThrow(); f.pool.dispose(f.scene);
  });

  it('keeps native action/binding/cache counts bounded across 20,000 frames, sweep and unload/reload cycles', async () => {
    const f = setup(); f.load('model', bytes()); f.load('walk', bytes('walk'), true); await ready(f); await playing(f);
    for (let round = 0; round < 4; round++) {
      const controller = (f.pool as any).graphs.get('a').controller; controller.update(0, {}); const baseline = controller.debug.resources;
      for (let frame = 0; frame < 5000; frame++) { f.pool.applyGraph('a', graph(), {}); f.pool.update(1000 + (round * 5000 + frame) * 16); }
      expect(controller.debug.resources).toEqual(baseline); expect((f.pool as any).motions.size).toBe(1); expect((f.pool as any).motionParsing.size).toBe(0); expect((f.pool as any).graphs.size).toBe(1);
      f.evict('walk'); expect(controller.debug.resources.actions).toBe(0); expect(controller.debug.resources.bindings).toBe(0); f.load('walk', bytes('walk'), true); await playing(f);
    }
    f.pool.sweep(f.scene, new Set()); expect((f.pool as any).graphs.size).toBe(0); expect(f.pool.count).toBe(0); expect(f.pool.update(500000)).toBeGreaterThan(0); expect(f.pool.update(500016)).toBe(0);
    f.pool.dispose(f.scene); expect((f.pool as any).motions.size).toBe(0); expect(f.manager.load).not.toHaveBeenCalled();
  });
});
