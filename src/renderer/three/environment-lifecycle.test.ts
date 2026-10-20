import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { WebGLObjects } from 'three/src/renderers/webgl/WebGLObjects.js';
import { WebGLGeometries } from 'three/src/renderers/webgl/WebGLGeometries.js';
import { WebGLAttributes } from 'three/src/renderers/webgl/WebGLAttributes.js';
import { AssetManager } from '@assets/index.js';
import type { Sky3D } from '@engine/protocol/components.js';
import { ThreeRenderer } from '../three-renderer.js';
import { World } from '@engine/core/world.js';
import { CameraRig } from './camera-rig.js';
import { LightRig } from './lights.js';
import { ModelPool } from './models.js';

interface Access {
  scene: THREE.Scene; gl: THREE.WebGLRenderer; sky: THREE.Mesh | null;
  envTarget: THREE.WebGLRenderTarget | null; hdriTarget: THREE.WebGLRenderTarget | null;
  hdriKey: string; hdriSource: ArrayBuffer | null;
  syncSky(sky: Sky3D | null): void; syncEnv(sky: Sky3D | null): void;
  roomEnv(): THREE.Texture; hdriEnv(key: string): THREE.Texture | null;
}
function disposed(object: { addEventListener(type: 'dispose', listener: () => void): void }) {
  const event = vi.fn(); object.addEventListener('dispose', event); return event;
}
function fixture(assets?: AssetManager) {
  const renderer = new ThreeRenderer({ assets }), access = renderer as unknown as Access;
  access.scene = new THREE.Scene();
  const gl = { dispose: vi.fn(), forceContextLoss: vi.fn(), domElement: { remove: vi.fn() } };
  access.gl = gl as unknown as THREE.WebGLRenderer;
  return { renderer, access, gl };
}
const sky: Sky3D = { type: 'Sky3D', top: 0x224466, bottom: 0x8899aa, env: .6 };

/** Actual native buffer ownership/event code with a fake GL allocator. This is CPU evidence, not a GPU render. */
function nativeRoomBuffers() {
  const live = new Set<object>();
  const gl = {
    ARRAY_BUFFER: 34962, FLOAT: 5126,
    createBuffer: () => { const buffer = {}; live.add(buffer); return buffer; },
    deleteBuffer: (buffer: object) => { live.delete(buffer); }, bindBuffer: () => {}, bufferData: () => {},
  };
  const attributes = new WebGLAttributes(gl as unknown as WebGLRenderingContext), info = { render: { frame: 1 }, memory: { geometries: 0 } };
  const states = { releaseStatesOfGeometry: () => {}, releaseStatesOfObject: () => {} };
  // The installed implementation also accepts bindingStates as its fourth argument;
  // the declarations omit it. Bridge only this native test boundary.
  const NativeGeometries = WebGLGeometries as unknown as new (...args: unknown[]) => WebGLGeometries;
  const geometries = new NativeGeometries(gl, attributes, info, states);
  const objects = new WebGLObjects(gl as unknown as WebGLRenderingContext, geometries, attributes,
    states as unknown as ConstructorParameters<typeof WebGLObjects>[3], info as unknown as ConstructorParameters<typeof WebGLObjects>[4]);
  return { live, info, upload(room: THREE.Scene) { room.traverse(object => { if (object instanceof THREE.Mesh) objects.update(object); }); } };
}
function outputs() {
  const targets: THREE.WebGLRenderTarget[] = [], targetEvents: ReturnType<typeof disposed>[] = [], textureEvents: ReturnType<typeof disposed>[] = [];
  function make() {
    const target = new THREE.WebGLRenderTarget(16, 8);
    targets.push(target); targetEvents.push(disposed(target)); textureEvents.push(disposed(target.texture)); return target;
  }
  return { targets, targetEvents, textureEvents, make };
}
/** Seed real native-owned resources without issuing render calls; native dispose remains unmocked. */
function generatorResources(generator: THREE.PMREMGenerator) {
  const pingPong = new THREE.WebGLRenderTarget(16, 8), lod = new THREE.Mesh(new THREE.PlaneGeometry());
  const blur = new THREE.ShaderMaterial(), ggx = new THREE.ShaderMaterial(), equirect = new THREE.ShaderMaterial();
  const background = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  Object.assign(generator, {
    _pingPongRenderTarget: pingPong, _lodMeshes: [lod], _blurMaterial: blur,
    _ggxMaterial: ggx, _equirectMaterial: equirect, _backgroundBox: background,
  });
  return [pingPong, lod.geometry, blur, ggx, equirect, background.geometry, background.material].map(disposed);
}
function radiance(value = 64): ArrayBuffer {
  const header = new TextEncoder().encode('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 2 +X 4\n');
  const bytes = new Uint8Array(header.length + 32); bytes.set(header);
  for (let i = header.length; i < bytes.length; i += 4) bytes.set([value, 32, 16, 129], i);
  return bytes.buffer;
}
function assetSource() {
  const files = new Map<string, ArrayBuffer>();
  const assets = new AssetManager({ load: async descriptor => ({ handle: files.get(descriptor.key), width: 0, height: 0 }) });
  async function put(key: string, bytes: ArrayBuffer) {
    if (assets.isLoaded(key)) assets.unload(key); files.set(key, bytes); assets.register({ kind: 'model', key, src: `${key}.hdr` }); await assets.load(key);
  }
  return { assets, put };
}

beforeEach(() => {
  vi.spyOn(console, 'debug').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ createLinearGradient: () => ({ addColorStop: () => {} }), createRadialGradient: () => ({ addColorStop: () => {} }), fillRect: () => {} }) }) });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Sky and PMREM resource ownership (CPU native objects; no GPU acceptance claim)', () => {
  it.each(['replace', 'remove', 'destroy'] as const)('disposes a real sky map, geometry and material exactly once on %s', operation => {
    const { renderer, access } = fixture(); access.syncSky({ ...sky, env: 0 });
    const mesh = access.sky!, material = mesh.material as THREE.MeshBasicMaterial;
    const mapEvent = disposed(material.map!), geometryEvent = disposed(mesh.geometry), materialEvent = disposed(material);
    if (operation === 'replace') access.syncSky({ ...sky, top: 0x998877, env: 0 });
    if (operation === 'remove') access.syncSky(null);
    renderer.destroy(); renderer.destroy();
    for (const event of [mapEvent, geometryEvent, materialEvent]) expect(event).toHaveBeenCalledOnce();
    expect(access.envTarget).toBeNull(); expect(access.hdriTarget).toBeNull();
  });

  it.each(['cloud-enable', 'cloud-tint'] as const)('redraws static env0 Sky for %s and removal/re-add while unchanged skies stay skipped', change => {
    const { renderer, access, gl } = fixture(), draw = vi.fn();
    Object.assign(gl, { render: draw, shadowMap: {}, properties: { get: () => ({}) }, info: { reset: () => {}, memory: { geometries: 0, textures: 0 }, render: { calls: 0, triangles: 0 } } });
    Object.assign(access, { cameras: new CameraRig(50, 1.6), lights: new LightRig(access.scene), models: new ModelPool() });
    const world = new World(); world.createEntity('environment');
    const initial: Sky3D = { ...sky, env: 0, clouds: change === 'cloud-tint', cloudTint: 0xffffff };
    const updated: Sky3D = change === 'cloud-enable' ? { ...initial, clouds: true } : { ...initial, cloudTint: 0xff4400 };
    world.addComponent('environment', initial);
    const step = () => renderer.sync(world.readView()), map = () => (access.sky!.material as THREE.MeshBasicMaterial).map!;
    step(); expect(draw).toHaveBeenCalledOnce(); const firstMap = map(), firstDispose = disposed(firstMap);
    for (let i = 0; i < 10; i++) step(); expect(draw).toHaveBeenCalledOnce();
    world.addComponent('environment', updated); step();
    expect(map()).not.toBe(firstMap); expect(firstDispose).toHaveBeenCalledOnce(); expect(draw).toHaveBeenCalledTimes(2);
    const secondDispose = disposed(map());
    for (let i = 0; i < 10; i++) step(); expect(draw).toHaveBeenCalledTimes(2);
    world.removeComponent('environment', 'Sky3D'); step();
    expect(access.sky).toBeNull(); expect(secondDispose).toHaveBeenCalledOnce(); expect(draw).toHaveBeenCalledTimes(3);
    world.addComponent('environment', updated); step(); expect(draw).toHaveBeenCalledTimes(4);
    const lastDispose = disposed(map());
    for (let i = 0; i < 10; i++) step(); expect(draw).toHaveBeenCalledTimes(4);
    renderer.destroy(); renderer.destroy(); expect(lastDispose).toHaveBeenCalledOnce();
    expect(firstDispose).toHaveBeenCalledOnce(); expect(secondDispose).toHaveBeenCalledOnce();
  });

  it('owns the Room output RT independently of generator internals and releases native instanceMatrix buffers immediately', () => {
    const { renderer, access, gl } = fixture(), out = outputs(), buffers = nativeRoomBuffers();
    const resources = new Set<THREE.BufferGeometry | THREE.Material>();
    const resourceEvents: ReturnType<typeof disposed>[] = [], instanceEvents: ReturnType<typeof disposed>[] = [], internalEvents: ReturnType<typeof disposed>[] = [];
    const fromScene = vi.spyOn(THREE.PMREMGenerator.prototype, 'fromScene').mockImplementation(function (this: THREE.PMREMGenerator, room) {
      internalEvents.push(...generatorResources(this));
      room.traverse(object => {
        if (object instanceof THREE.Mesh) { resources.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material); }
        if (object instanceof THREE.InstancedMesh) instanceEvents.push(disposed(object));
      });
      for (const resource of resources) resourceEvents.push(disposed(resource));
      buffers.upload(room); expect(buffers.live.size).toBe(3); return out.make();
    });
    const generatorDispose = vi.spyOn(THREE.PMREMGenerator.prototype, 'dispose');
    access.syncEnv(sky); const texture = access.scene.environment;
    expect(texture).toBe(out.targets[0]!.texture); expect(access.envTarget).toBe(out.targets[0]);
    expect(instanceEvents).toHaveLength(1); expect(instanceEvents[0]).toHaveBeenCalledOnce();
    for (const event of [...resourceEvents, ...internalEvents]) expect(event).toHaveBeenCalledOnce();
    expect(buffers.info.memory.geometries).toBe(0); expect(buffers.live.size).toBe(0);
    expect(generatorDispose).toHaveBeenCalledOnce(); expect(out.targetEvents[0]).not.toHaveBeenCalled();
    for (let i = 0; i < 200; i++) { access.syncEnv(null); expect(access.scene.environment).toBeNull(); access.syncEnv(sky); expect(access.scene.environment).toBe(texture); }
    expect(fromScene).toHaveBeenCalledOnce();
    gl.forceContextLoss.mockImplementation(() => { expect(out.targetEvents[0]).toHaveBeenCalledOnce(); expect(buffers.live.size).toBe(0); });
    renderer.destroy(); renderer.destroy();
    expect(out.targetEvents[0]).toHaveBeenCalledOnce(); expect(out.textureEvents[0]).not.toHaveBeenCalled();
    expect(access.envTarget).toBeNull(); expect(access.scene.environment).toBeNull(); expect(gl.forceContextLoss).toHaveBeenCalledOnce();
  });

  it('cleans the exposed Room resources and generator even when native conversion throws before returning an output', () => {
    const { renderer, access } = fixture(), buffers = nativeRoomBuffers(), events: ReturnType<typeof disposed>[] = [];
    vi.spyOn(THREE.PMREMGenerator.prototype, 'fromScene').mockImplementation(room => {
      const seen = new Set<THREE.BufferGeometry | THREE.Material>();
      room.traverse(object => { if (object instanceof THREE.Mesh) { seen.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) seen.add(material); } });
      for (const object of seen) events.push(disposed(object)); buffers.upload(room); throw new Error('upstream conversion failed');
    });
    const generatorDispose = vi.spyOn(THREE.PMREMGenerator.prototype, 'dispose');
    expect(() => access.roomEnv()).toThrow('upstream conversion failed');
    expect(buffers.live.size).toBe(0); for (const event of events) expect(event).toHaveBeenCalledOnce();
    expect(generatorDispose).toHaveBeenCalledOnce(); expect(access.envTarget).toBeNull(); renderer.destroy();
  });

  it('falls back while missing, accepts same-key late bytes, caches hits and rebuilds same-key reloaded bytes', async () => {
    const source = assetSource(), { renderer, access } = fixture(source.assets), out = outputs();
    const room = vi.spyOn(THREE.PMREMGenerator.prototype, 'fromScene').mockImplementation(() => out.make());
    const eqEvents: ReturnType<typeof disposed>[] = [];
    const fromEq = vi.spyOn(THREE.PMREMGenerator.prototype, 'fromEquirectangular').mockImplementation(eq => {
      expect(eq).toBeInstanceOf(THREE.DataTexture); expect((eq as THREE.DataTexture).image.width).toBe(4); expect((eq as THREE.DataTexture).image.height).toBe(2);
      eqEvents.push(disposed(eq)); return out.make();
    });
    const parse = vi.spyOn(HDRLoader.prototype, 'parse'), generatorDispose = vi.spyOn(THREE.PMREMGenerator.prototype, 'dispose');
    const config = { ...sky, envMap: 'studio' };
    for (let i = 0; i < 100; i++) access.syncEnv(config);
    expect(console.debug).toHaveBeenCalledTimes(1); expect(room).toHaveBeenCalledOnce(); expect(fromEq).not.toHaveBeenCalled();
    await source.put('studio', radiance()); access.syncEnv(config);
    expect(fromEq).toHaveBeenCalledOnce(); expect(out.targets).toHaveLength(2);
    expect(access.scene.environment).toBe(out.targets[1]!.texture);
    for (let i = 0; i < 100; i++) access.syncEnv(config);
    expect(parse).toHaveBeenCalledOnce(); expect(fromEq).toHaveBeenCalledOnce(); expect(eqEvents[0]).toHaveBeenCalledOnce();
    source.assets.unload('studio'); access.syncEnv(config); expect(access.scene.environment).toBe(out.targets[0]!.texture);
    expect(out.targetEvents[1]).not.toHaveBeenCalled(); // One cached HDR output is retained while waiting.
    const nextBytes = radiance(96); await source.put('studio', nextBytes); access.syncEnv(config);
    expect(parse).toHaveBeenCalledTimes(2); expect(fromEq).toHaveBeenCalledTimes(2);
    expect(out.targetEvents[1]).toHaveBeenCalledOnce(); expect(access.hdriSource).toBe(nextBytes);
    expect(access.scene.environment).toBe(out.targets[2]!.texture); expect(console.warn).not.toHaveBeenCalled();
    expect(generatorDispose).toHaveBeenCalledTimes(3);
    renderer.destroy(); renderer.destroy();
    for (const event of out.targetEvents) expect(event).toHaveBeenCalledOnce();
    for (const event of out.textureEvents) expect(event).not.toHaveBeenCalled();
    for (const event of eqEvents) expect(event).toHaveBeenCalledOnce();
    expect(access.hdriSource).toBeNull(); expect(access.hdriKey).toBe('');
  });

  it('draws static scenes only when actual HDR output or intensity changes, including same-key arrival and replacement', async () => {
    const source = assetSource(), { renderer, access, gl } = fixture(source.assets), out = outputs(), draw = vi.fn();
    Object.assign(gl, { render: draw, shadowMap: {}, properties: { get: () => ({}) }, info: { reset: () => {}, memory: { geometries: 0, textures: 0 }, render: { calls: 0, triangles: 0 } } });
    Object.assign(access, { cameras: new CameraRig(50, 1.6), lights: new LightRig(access.scene), models: new ModelPool(source.assets) });
    vi.spyOn(THREE.PMREMGenerator.prototype, 'fromScene').mockImplementation(() => out.make());
    vi.spyOn(THREE.PMREMGenerator.prototype, 'fromEquirectangular').mockImplementation(() => out.make());
    const world = new World(); world.createEntity('environment');
    const config = { ...sky, envMap: 'studio' }; world.addComponent('environment', config);
    const step = () => renderer.sync(world.readView());
    step(); expect(draw).toHaveBeenCalledOnce();
    for (let i = 0; i < 10; i++) step(); expect(draw).toHaveBeenCalledOnce();
    await source.put('studio', radiance()); step(); expect(draw).toHaveBeenCalledTimes(2);
    for (let i = 0; i < 10; i++) step(); expect(draw).toHaveBeenCalledTimes(2);
    await source.put('studio', radiance(96)); step(); expect(draw).toHaveBeenCalledTimes(3);
    await source.put('other', radiance(48)); world.addComponent('environment', { ...config, envMap: 'other' }); step(); expect(draw).toHaveBeenCalledTimes(4);
    world.addComponent('environment', { ...config, envMap: 'other', env: .3 }); step(); expect(draw).toHaveBeenCalledTimes(5);
    world.addComponent('environment', { ...config, envMap: 'other', env: 0 }); step(); expect(draw).toHaveBeenCalledTimes(6);
    for (let i = 0; i < 10; i++) step(); expect(draw).toHaveBeenCalledTimes(6);
    world.addComponent('environment', { ...config, envMap: 'other', env: .3 }); step(); expect(draw).toHaveBeenCalledTimes(7);
    for (let i = 0; i < 10; i++) step(); expect(draw).toHaveBeenCalledTimes(7);
    renderer.destroy(); for (const event of out.targetEvents) expect(event).toHaveBeenCalledOnce();
  });

  it('releases A on B success, releases B on bad input, memoizes only the failed bytes and recovers a new buffer under that key', async () => {
    const source = assetSource(), { renderer, access } = fixture(source.assets), out = outputs();
    vi.spyOn(THREE.PMREMGenerator.prototype, 'fromScene').mockImplementation(() => out.make());
    vi.spyOn(THREE.PMREMGenerator.prototype, 'fromEquirectangular').mockImplementation(() => out.make());
    const parse = vi.spyOn(HDRLoader.prototype, 'parse');
    await source.put('a', radiance()); access.syncEnv({ ...sky, envMap: 'a' });
    await source.put('b', radiance(96)); access.syncEnv({ ...sky, envMap: 'b' });
    expect(out.targetEvents[0]).toHaveBeenCalledOnce(); expect(out.targetEvents[1]).not.toHaveBeenCalled();
    await source.put('bad', new Uint8Array([1, 2, 3]).buffer); access.syncEnv({ ...sky, envMap: 'bad' });
    expect(out.targetEvents[1]).toHaveBeenCalledOnce(); expect(access.hdriTarget).toBeNull();
    expect(access.scene.environment).toBe(out.targets[2]!.texture);
    for (let i = 0; i < 100; i++) access.syncEnv({ ...sky, envMap: 'bad' });
    expect(parse).toHaveBeenCalledTimes(3); expect(console.warn).toHaveBeenCalledOnce();
    await source.put('bad', radiance()); access.syncEnv({ ...sky, envMap: 'bad' });
    expect(parse).toHaveBeenCalledTimes(4); expect(access.scene.environment).toBe(out.targets[3]!.texture);
    expect(console.debug).toHaveBeenCalledTimes(3); expect(console.warn).toHaveBeenCalledOnce();
    renderer.destroy(); for (const event of out.targetEvents) expect(event).toHaveBeenCalledOnce();
  });

  it('releases the prior HDR output and the exposed eq/generator on conversion failure without claiming unreturned native RT recovery', async () => {
    const source = assetSource(), { renderer, access } = fixture(source.assets), out = outputs();
    const eqEvents: ReturnType<typeof disposed>[] = [];
    const convert = vi.spyOn(THREE.PMREMGenerator.prototype, 'fromEquirectangular').mockImplementation(eq => { eqEvents.push(disposed(eq)); return out.make(); });
    const generatorDispose = vi.spyOn(THREE.PMREMGenerator.prototype, 'dispose');
    await source.put('a', radiance()); expect(access.hdriEnv('a')).toBe(out.targets[0]?.texture);
    convert.mockImplementationOnce(eq => { eqEvents.push(disposed(eq)); throw new Error('upstream render failed before output'); });
    await source.put('b', radiance(96)); expect(access.hdriEnv('b')).toBeNull();
    expect(out.targetEvents[0]).toHaveBeenCalledOnce(); for (const event of eqEvents) expect(event).toHaveBeenCalledOnce();
    expect(generatorDispose).toHaveBeenCalledTimes(2); expect(console.warn).toHaveBeenCalledOnce();
    expect(access.hdriEnv('b')).toBeNull(); expect(convert).toHaveBeenCalledTimes(2);
    renderer.destroy(); expect(out.targetEvents[0]).toHaveBeenCalledOnce();
  });
});
