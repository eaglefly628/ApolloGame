// Offline wiring/lifecycle tests. Real decoder proof lives in
// scripts/compressed-models.integration.mjs; no mocked decode is acceptance.
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { GLTFLoader, GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import type { AssetManager } from '@assets/index.js';
import { ModelPool } from './models.js';
import { ModelCodecs } from './model-codecs.js';

const fake = vi.hoisted(() => ({
  dracos: [] as any[], ktxs: [] as any[], loaders: [] as any[],
  dracoInit: undefined as undefined | Promise<void>, ktxInit: undefined as undefined | Promise<void>,
  parseThrow: undefined as Error | undefined,
}));
vi.mock('three/addons/libs/meshopt_decoder.module.js', () => ({ MeshoptDecoder: { supported: true, ready: Promise.resolve() } }));
vi.mock('three/addons/loaders/DRACOLoader.js', () => ({ DRACOLoader: class {
  path = ''; workers: { terminate: ReturnType<typeof vi.fn> }[] = []; blob = false;
  dispose() { this.workers.forEach(w => w.terminate()); this.workers = []; this.blob = false; return this; }
  constructor() { fake.dracos.push(this); }
  setDecoderPath(path: string) { this.path = path; return this; }
  _initDecoder() { return (fake.dracoInit ?? Promise.resolve()).then(() => { this.blob = true; }); }
  _getWorker() { return this._initDecoder().then(() => { const worker = { terminate: vi.fn() }; this.workers.push(worker); return worker; }); }
} }));
vi.mock('three/addons/loaders/KTX2Loader.js', () => ({ KTX2Loader: class {
  path = ''; renderer: unknown; transcoderPending?: Promise<void>; blob = false;
  workerPool = { dispose: vi.fn() }; finish?: (texture: THREE.CompressedTexture) => void;
  dispose() { this.blob = false; this.workerPool.dispose(); return this; }
  constructor() { fake.ktxs.push(this); }
  setTranscoderPath(path: string) { this.path = path; return this; }
  detectSupport(renderer: unknown) { this.renderer = renderer; return this; }
  init() { return this.transcoderPending ??= (fake.ktxInit ?? Promise.resolve()).then(() => { this.blob = true; }); }
  parse(_buffer: ArrayBuffer, onLoad: (texture: THREE.CompressedTexture) => void) { this.finish = onLoad; }
} }));
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: class {
  plugins = new Set<(parser: GLTFParser) => { beforeRoot(): void }>(); parses: any[] = [];
  draco: any; meshopt: any; ktx2: any;
  constructor() { fake.loaders.push(this); }
  setDRACOLoader(value: unknown) { this.draco = value; return this; }
  setMeshoptDecoder(value: unknown) { this.meshopt = value; return this; }
  setKTX2Loader(value: unknown) { this.ktx2 = value; return this; }
  register(cb: any) { this.plugins.add(cb); return this; }
  unregister(cb: any) { this.plugins.delete(cb); return this; }
  parse(buffer: ArrayBuffer, path: string, onLoad: any, onError: any) {
    if (fake.parseThrow) throw fake.parseThrow;
    const parser = {
      json: JSON.parse(new TextDecoder().decode(buffer)), options: { ktx2Loader: this.ktx2 },
      loadGeometries: vi.fn(async () => []), loadMaterial: vi.fn(async () => new THREE.MeshBasicMaterial()),
      loadImageSource: vi.fn(async () => new THREE.Texture()), getDependency: vi.fn(async () => null),
      loadTextureImage: vi.fn(async () => null),
    } as unknown as GLTFParser;
    // Native GLTFLoader snapshots plugin factories synchronously at parse start.
    const plugins = [...this.plugins].map(cb => cb(parser));
    this.parses.push({ buffer, path, onLoad, onError, parser, plugins });
    try { for (const plugin of plugins) plugin.beforeRoot(); } catch (e) { onError(e); }
  }
} }));
const renderer = {} as THREE.WebGLRenderer;
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
function parser(json: Record<string, unknown> = {}) { return { json, options: {} } as GLTFParser; }
function assets(docs: Record<string, Record<string, unknown>>) { return { get: (key: string) => docs[key] ? { handle: new TextEncoder().encode(JSON.stringify(docs[key])).buffer } : undefined } as unknown as AssetManager; }
function ensure(pool: ModelPool, scene: THREE.Scene, key = 'cube', id = key) { return pool.ensure(scene, id, { type: 'Model3D', modelKey: key }); }
function model() { const geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial(), map = new THREE.Texture(); material.map = map; const scene = new THREE.Group(); scene.add(new THREE.Mesh(geometry, material)); return { scene, geometry, material, map }; }
beforeEach(() => { fake.dracos.length=0; fake.ktxs.length=0; fake.loaders.length=0; fake.dracoInit=undefined; fake.ktxInit=undefined; fake.parseThrow=undefined; });
afterEach(() => { vi.restoreAllMocks(); });

describe('ModelCodecs offline loader contracts', () => {
  it('connects local Draco + bundled meshopt without starting workers, creates KTX2 only when needed', () => {
    const codecs = new ModelCodecs(renderer); const loader: any = new TestLoader();
    codecs.connect(loader as GLTFLoader); codecs.prepare(parser());
    expect(fake.dracos[0].path).toBe('/__vendor/three-r184/draco/');
    expect(loader.draco).toBe(fake.dracos[0]); expect(loader.meshopt.supported).toBe(true);
    expect(fake.dracos[0].blob).toBe(false); expect(fake.ktxs).toHaveLength(0);
    const p=parser({ extensionsRequired: ['KHR_texture_basisu'] });codecs.prepare(p);
    expect(fake.ktxs).toHaveLength(1);expect(fake.ktxs[0].path).toBe('/__vendor/three-r184/basis/');expect(fake.ktxs[0].renderer).toBe(renderer);
    expect(p.options.ktx2Loader).toBe(fake.ktxs[0]);expect(loader.ktx2).toBe(fake.ktxs[0]);
    codecs.prepare(parser({ textures:[{ extensions:{ KHR_texture_basisu:{ source:0 } } }] }));expect(fake.ktxs).toHaveLength(1);
    codecs.dispose();
  });
  it('rejects KTX2 without renderer but preserves legacy uncompressed prepare', () => {
    const codecs=new ModelCodecs();expect(()=>codecs.prepare(parser())).not.toThrow();
    expect(()=>codecs.prepare(parser({extensionsUsed:['KHR_texture_basisu']}))).toThrow(/WebGLRenderer/);expect(fake.ktxs).toHaveLength(0);codecs.dispose();
  });
  it('disposal during Draco initialization releases late Blob and prevents worker creation', async () => {
    const pending=deferred();fake.dracoInit=pending.promise;const codecs=new ModelCodecs(), draco=fake.dracos[0];
    const worker=draco._getWorker(1,1);const rejection=expect(worker).rejects.toThrow(/disposed/);
    codecs.dispose();pending.resolve();await rejection;expect(draco.blob).toBe(false);expect(draco.workers).toHaveLength(0);
    await expect(draco._getWorker(2,1)).rejects.toThrow(/disposed/);
  });
  it('disposal stops live Draco workers', async () => {
    const codecs=new ModelCodecs(),draco=fake.dracos[0];const worker=await draco._getWorker(1,1);codecs.dispose();expect(worker.terminate).toHaveBeenCalledOnce();expect(draco.blob).toBe(false);
  });
  it('disposal during KTX2 initialization releases late Blob and rejects reuse', async () => {
    const pending=deferred();fake.ktxInit=pending.promise;const codecs=new ModelCodecs(renderer);codecs.prepare(parser({extensionsUsed:['KHR_texture_basisu']}));const ktx=fake.ktxs[0];
    const init=ktx.init();const rejection=expect(init).rejects.toThrow(/disposed/);codecs.dispose();expect(ktx.workerPool.dispose).toHaveBeenCalled();pending.resolve();await rejection;
    expect(ktx.blob).toBe(false);await expect(ktx.init()).rejects.toThrow(/disposed/);
  });
  it('late KTX2 texture is disposed and never delivered to onLoad', () => {
    const codecs=new ModelCodecs(renderer);codecs.prepare(parser({extensionsUsed:['KHR_texture_basisu']}));const ktx=fake.ktxs[0],load=vi.fn(),error=vi.fn();
    ktx.parse(new ArrayBuffer(1),load,error);codecs.dispose();const texture=new THREE.CompressedTexture([], 1, 1),disposed=vi.spyOn(texture,'dispose');ktx.finish(texture);
    expect(disposed).toHaveBeenCalledOnce();expect(load).not.toHaveBeenCalled();expect(error).toHaveBeenCalledOnce();
  });
});
// Imported mock constructor, preserving the production GLTFLoader API shape.
import { GLTFLoader as TestLoader } from 'three/addons/loaders/GLTFLoader.js';

describe('ModelPool offline parse/resource contracts', () => {
  it('loads legacy uncompressed models, caches parse, and clones per-instance materials', () => {
    const pool=new ModelPool(assets({cube:{}})),scene=new THREE.Scene();expect(ensure(pool,scene)).toBeNull();const loader=fake.loaders[0],m=model();
    expect(loader.plugins.size).toBe(0);expect(loader.parses).toHaveLength(1);loader.parses[0].onLoad({scene:m.scene,animations:[]});
    const a=ensure(pool,scene),b=ensure(pool,scene,'cube','second');expect(a).not.toBeNull();expect(b).not.toBe(a);expect(loader.parses).toHaveLength(1);
    expect((a!.children[0] as THREE.Mesh).material).not.toBe((b!.children[0] as THREE.Mesh).material);pool.dispose(scene);expect(pool.count).toBe(0);
  });
  it.each(['callback','synchronous'])('diagnoses a %s parse failure only once and still loads another key', (kind) => {
    const error=vi.spyOn(console,'error').mockImplementation(()=>{}),pool=new ModelPool(assets({bad:{},good:{}})),scene=new THREE.Scene();
    if(kind==='synchronous')fake.parseThrow=new Error('broken fixture');ensure(pool,scene,'bad');fake.parseThrow=undefined;
    if(kind==='callback')fake.loaders[0].parses[0].onError(new Error('broken fixture'));
    for(let i=0;i<12;i++)expect(ensure(pool,scene,'bad')).toBeNull();expect(error).toHaveBeenCalledTimes(1);expect(error.mock.calls[0][0]).toContain('bad');
    ensure(pool,scene,'good');const parsed=fake.loaders[0].parses.at(-1),m=model();parsed.onLoad({scene:m.scene});expect(ensure(pool,scene,'good')).not.toBeNull();pool.dispose(scene);
  });
  it('rejects swallowed KTX2 texture failure instead of admitting a missing-texture model', async () => {
    const error=vi.spyOn(console,'error').mockImplementation(()=>{}),pool=new ModelPool(assets({bad:{textures:[{extensions:{KHR_texture_basisu:{source:0}}}]}}),renderer),scene=new THREE.Scene();
    ensure(pool,scene,'bad');const parsed=fake.loaders[0].parses[0];
    await expect(parsed.parser.loadTextureImage(0,0,{})).rejects.toThrow(/KTX2 texture failed/);
    parsed.onError(new Error('KTX2 texture failed'));expect(ensure(pool,scene,'bad')).toBeNull();expect(error).toHaveBeenCalledOnce();pool.dispose(scene);
  });
  it('dispose releases pending resources, ignores late parse and allows a clean new generation', async () => {
    const pool=new ModelPool(assets({cube:{images:[{uri:'data:image/png;base64,',mimeType:'image/png'}]}})),scene=new THREE.Scene();ensure(pool,scene);const first=fake.loaders[0].parses[0],m=model();
    const geometryDispose=vi.spyOn(m.geometry,'dispose'),materialDispose=vi.spyOn(m.material,'dispose'),textureDispose=vi.spyOn(m.map,'dispose');
    const pendingTexture=await first.parser.loadImageSource(0,{}),pendingDispose=vi.spyOn(pendingTexture,'dispose');
    pool.dispose(scene);expect(pendingDispose).toHaveBeenCalledOnce();first.onLoad({scene:m.scene});expect(pool.count).toBe(0);expect(geometryDispose).toHaveBeenCalledOnce();expect(materialDispose).toHaveBeenCalledOnce();expect(textureDispose).toHaveBeenCalledOnce();
    ensure(pool,scene);expect(fake.loaders).toHaveLength(2);expect(fake.loaders[1].parses).toHaveLength(1);pool.dispose(scene);
  });
  it('dispose of one pending key does not contaminate another parser resource owner', async () => {
    vi.spyOn(console,'error').mockImplementation(()=>{});
    const pool=new ModelPool(assets({a:{},b:{}})),scene=new THREE.Scene();ensure(pool,scene,'a');ensure(pool,scene,'b');const [a,b]=fake.loaders[0].parses,m=model();
    b.onLoad({scene:m.scene});const dispose=vi.spyOn(m.geometry,'dispose');a.onError(new Error('expected a failure'));expect(dispose).not.toHaveBeenCalled();expect(ensure(pool,scene,'b')).not.toBeNull();pool.dispose(scene);expect(dispose).toHaveBeenCalledOnce();
  });
});
