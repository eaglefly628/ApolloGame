// Parser callbacks are controlled here to exercise races. Real raw/Draco/KTX2
// group decoding and resource lifetimes run in scene-asset-groups.integration.mjs.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import type { AssetManager } from '@assets/index.js';
import { ModelPool } from './models.js';

const fake = vi.hoisted(() => ({ parses: [] as any[] }));
vi.mock('./model-codecs.js', () => ({ ModelCodecs: class { connect() {} prepare() {} dispose() {} } }));
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: class {
  plugins = new Set<(parser: GLTFParser) => unknown>();
  register(plugin: any) { this.plugins.add(plugin); return this; }
  unregister(plugin: any) { this.plugins.delete(plugin); return this; }
  parse(buffer: ArrayBuffer, _path: string, onLoad: any, onError: any) {
    const parser = {
      json: { images: [{ uri: 'fixture.png' }] }, options: {}, loadGeometries: async () => [],
      loadMaterial: async () => new THREE.MeshBasicMaterial(),
      loadImageSource: async () => new THREE.Texture(),
      getDependency: async () => null, loadTextureImage: async () => null,
    } as unknown as GLTFParser;
    for (const plugin of this.plugins) plugin(parser);
    fake.parses.push({ buffer, parser, onLoad, onError });
  }
} }));

function source() {
  const loaded = new Map<string, { handle: ArrayBuffer }>();
  const listeners = new Set<(event: { key: string }) => void>();
  const manager = {
    get: (key: string) => loaded.get(key),
    onEvict: vi.fn((listener: (event: { key: string }) => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }),
  };
  return {
    manager: manager as unknown as AssetManager, listeners, subscribe: manager.onEvict,
    load(key: string) { const handle = new ArrayBuffer(1); loaded.set(key, { handle }); return handle; },
    evict(key: string) { loaded.delete(key); for (const listener of listeners) listener({ key }); },
  };
}
function ensure(pool: ModelPool, scene: THREE.Scene, key: string, id = key) {
  return pool.ensure(scene, id, { type: 'Model3D', modelKey: key });
}
function model(name = 'model', skinned = false) {
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
  const map = new THREE.Texture(); material.map = map;
  const scene = new THREE.Group(); scene.name = name;
  if (skinned) {
    const mesh = new THREE.SkinnedMesh(geometry, material), bone = new THREE.Bone();
    mesh.add(bone); mesh.bind(new THREE.Skeleton([bone])); scene.add(mesh);
  } else scene.add(new THREE.Mesh(geometry, material));
  const animations = [new THREE.AnimationClip('move', 1, [new THREE.VectorKeyframeTrack('.position', [0, 1], [0, 0, 0, 1, 0, 0])])];
  return { scene, animations, geometry, material, map };
}
function disposal(m: ReturnType<typeof model>) {
  return [vi.spyOn(m.geometry, 'dispose'), vi.spyOn(m.material, 'dispose'), vi.spyOn(m.map, 'dispose')];
}
beforeEach(() => { fake.parses.length = 0; });
afterEach(() => { vi.restoreAllMocks(); });

describe('ModelPool asset group eviction', () => {
  it('subscribes lazily and evicts all A instances, clone skeletons and template resources while retaining B', () => {
    const assets = source(), pool = new ModelPool(assets.manager), scene = new THREE.Scene();
    const handle = assets.load('a'); assets.load('b');
    const sourceClose = vi.fn(); Object.assign(handle, { close: sourceClose });
    expect(assets.listeners.size).toBe(0);
    ensure(pool, scene, 'a'); ensure(pool, scene, 'b');
    expect(assets.listeners.size).toBe(1); expect(assets.subscribe).toHaveBeenCalledOnce();
    const a = model('a', true), b = model('b'), aDisposed = disposal(a), bDisposed = disposal(b);
    fake.parses[0].onLoad(a); fake.parses[1].onLoad(b);
    const first = ensure(pool, scene, 'a')!, second = ensure(pool, scene, 'a', 'a2')!, kept = ensure(pool, scene, 'b')!;
    const nested = new THREE.Group(); scene.add(nested); nested.add(first);
    const cloneMaterials = [first, second].map(obj => vi.spyOn((obj.children[0] as THREE.Mesh).material as THREE.Material, 'dispose'));
    const boneTextures = [first, second].map(obj => {
      const skeleton = (obj.children[0] as THREE.SkinnedMesh).skeleton;
      expect(skeleton).not.toBe((a.scene.children[0] as THREE.SkinnedMesh).skeleton);
      skeleton.computeBoneTexture(); return vi.spyOn(skeleton.boneTexture!, 'dispose');
    });
    pool.applyAnim('a', { type: 'AnimState3D', clip: 'move' });
    const stopped = vi.spyOn(THREE.AnimationMixer.prototype, 'stopAllAction');
    const uncached = vi.spyOn(THREE.AnimationMixer.prototype, 'uncacheRoot');
    assets.evict('a');
    expect(pool.count).toBe(1); expect(first.parent).toBeNull(); expect(second.parent).toBeNull(); expect(kept.parent).toBe(scene);
    for (const dispose of [...aDisposed, ...cloneMaterials, ...boneTextures]) expect(dispose).toHaveBeenCalledOnce();
    for (const dispose of bDisposed) expect(dispose).not.toHaveBeenCalled();
    expect(stopped).toHaveBeenCalledTimes(2); expect(uncached).toHaveBeenCalledTimes(2);
    expect(sourceClose).not.toHaveBeenCalled();
    expect(ensure(pool, scene, 'b')).toBe(kept); expect(ensure(pool, scene, 'a')).toBeNull();
    expect(fake.parses).toHaveLength(2);
    pool.dispose(scene); for (const dispose of bDisposed) expect(dispose).toHaveBeenCalledOnce();
  });

  it.each([
    ['success', 'pending'], ['failure', 'pending'], ['success', 'ready'], ['failure', 'ready'],
  ])('ignores old A %s after evict/reload while new A is %s and B continues', (outcome, phase) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const assets = source(), pool = new ModelPool(assets.manager), scene = new THREE.Scene();
    assets.load('a'); assets.load('b'); ensure(pool, scene, 'a'); ensure(pool, scene, 'b');
    const [old, other] = fake.parses;
    assets.evict('a'); const currentHandle = assets.load('a'); ensure(pool, scene, 'a');
    const current = fake.parses[2], fresh = model('new-a'), late = model('old-a'), lateDisposed = disposal(late);
    expect(current.buffer).toBe(currentHandle);
    if (phase === 'ready') current.onLoad(fresh);
    if (outcome === 'success') old.onLoad(late); else old.onError(new Error('old parse failed'));
    if (phase === 'pending') {
      expect(ensure(pool, scene, 'a')).toBeNull(); expect(fake.parses).toHaveLength(3); current.onLoad(fresh);
    }
    other.onLoad(model('b'));
    expect(ensure(pool, scene, 'a')?.name).toBe('new-a'); expect(ensure(pool, scene, 'b')?.name).toBe('b');
    expect(pool.count).toBe(2); expect(error).not.toHaveBeenCalled();
    if (outcome === 'success') for (const dispose of lateDisposed) expect(dispose).toHaveBeenCalledOnce();
    pool.dispose(scene);
  });

  it('releases partial parse resources immediately and admits fresh resources after key reload', async () => {
    const assets = source(), pool = new ModelPool(assets.manager), scene = new THREE.Scene();
    assets.load('a'); ensure(pool, scene, 'a'); const old = fake.parses[0];
    const texture = await old.parser.loadImageSource(0, {}), dispose = vi.spyOn(texture, 'dispose');
    assets.evict('a'); expect(dispose).toHaveBeenCalledOnce();
    assets.load('a'); ensure(pool, scene, 'a'); fake.parses[1].onLoad(model('fresh'));
    expect(ensure(pool, scene, 'a')?.name).toBe('fresh'); pool.dispose(scene);
  });

  it('allows an evicted failed key to parse again', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const assets = source(), pool = new ModelPool(assets.manager), scene = new THREE.Scene();
    assets.load('a'); ensure(pool, scene, 'a'); fake.parses[0].onError(new Error('bad data'));
    for (let i = 0; i < 3; i++) ensure(pool, scene, 'a');
    expect(fake.parses).toHaveLength(1); expect(error).toHaveBeenCalledOnce();
    assets.evict('a'); assets.load('a'); ensure(pool, scene, 'a'); expect(fake.parses).toHaveLength(2);
    fake.parses[1].onLoad(model('retry')); expect(ensure(pool, scene, 'a')?.name).toBe('retry'); pool.dispose(scene);
  });

  it('unsubscribes on dispose and resubscribes on reuse without admitting an old parse', () => {
    const assets = source(), pool = new ModelPool(assets.manager), scene = new THREE.Scene();
    assets.load('a'); ensure(pool, scene, 'a'); const old = fake.parses[0];
    pool.dispose(scene); expect(assets.listeners.size).toBe(0);
    ensure(pool, scene, 'a'); expect(assets.listeners.size).toBe(1); expect(assets.subscribe).toHaveBeenCalledTimes(2);
    old.onLoad(model('disposed')); expect(ensure(pool, scene, 'a')).toBeNull();
    fake.parses[1].onLoad(model('reused')); expect(ensure(pool, scene, 'a')?.name).toBe('reused');
    assets.evict('a'); expect(pool.count).toBe(0); pool.dispose(scene); expect(assets.listeners.size).toBe(0);
  });
});
