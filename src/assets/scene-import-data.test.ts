import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetManager, StubAssetLoader } from './asset-manager.js';
import type { LoadedAsset } from './asset-types.js';
import { parseAssetIndex, registerAssetIndex } from './asset-index.js';
import { parseSceneImportData, verifySceneImportBytes } from './scene-import-data.js';
import type { SceneImportData } from './scene-import-data.js';

const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
function fixture() {
  const json = JSON.stringify({ asset: { version: '2.0' }, nodes: [{ name: 'nav_floor' }], scenes: [{ nodes: [0] }], scene: 0 });
  const body = Buffer.from(json + ' '.repeat((4-json.length%4)%4));
  const bytes = new ArrayBuffer(20+body.byteLength), view = new DataView(bytes);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,bytes.byteLength,true);
  view.setUint32(12,body.byteLength,true);view.setUint32(16,0x4e4f534a,true);new Uint8Array(bytes,20).set(body);
  const scene: SceneImportData = { version:1, sourceSha256:createHash('sha256').update(new Uint8Array(bytes)).digest('hex'), nodes:[
    { index:0, path:[0], name:'nav_floor', kind:'navigation', worldMatrix:[...identity], positions:[0,0,0, 1,0,0, 0,0,1], indices:[0,1,2], bounds:{min:[0,0,0],max:[1,0,1]} },
  ] };
  return { bytes, scene };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('E5 scene asset trust boundary', () => {
  it('copies and deeply freezes generated data without retaining caller arrays', () => {
    const { scene } = fixture(), parsed = parseSceneImportData(scene);
    expect(parsed).toEqual(scene); expect(parsed).not.toBe(scene);
    expect(parsed.nodes[0].positions).not.toBe(scene.nodes[0].positions);
    expect(Object.isFrozen(parsed.nodes[0].bounds?.max)).toBe(true);
    (scene.nodes[0].positions as number[])[0] = 99;
    expect(parsed.nodes[0].positions?.[0]).toBe(0);
  });
  it.each([
    ['unknown executable field', (s:any) => { s.script='return true'; }],
    ['fake mock flag', (s:any) => { s.mock=true; }],
    ['unbound source', (s:any) => { s.sourceSha256='not-a-sha'; }],
    ['wrong role', (s:any) => { s.nodes[0].kind='display'; }],
    ['NaN matrix', (s:any) => { s.nodes[0].worldMatrix[0]=NaN; }],
    ['non-affine matrix', (s:any) => { s.nodes[0].worldMatrix[3]=1; }],
    ['bad triangle index', (s:any) => { s.nodes[0].indices[0]=3; }],
    ['false bounds', (s:any) => { s.nodes[0].bounds.max[0]=9; }],
    ['unquantized position', (s:any) => { s.nodes[0].positions[0]=0.12345678; }],
    ['missing ancestor', (s:any) => { s.nodes[0].path=[42,0]; }],
    ['path cycle', (s:any) => { s.nodes[0].path=[0,0]; }],
    ['duplicate index', (s:any) => { s.nodes.push(structuredClone(s.nodes[0])); }],
  ])('rejects %s before assembly', (_label, change) => {
    const { scene }=fixture(); change(scene); expect(() => parseSceneImportData(scene)).toThrow(/scene-import/);
  });
  it('rejects nested semantics, but permits repeated display names addressed by distinct node indices', () => {
    const { scene }=fixture(), root={index:1,path:[1],name:'group',kind:'display',worldMatrix:[...identity]};
    const value:any={...scene,nodes:[root,{...scene.nodes[0],path:[1,0]}, {...root,index:2,path:[1,2]}]};
    expect(parseSceneImportData(value).nodes).toHaveLength(3);
    value.nodes[0]={...root,name:'pick_parent',kind:'pick',positions:[0,0,0,1,0,0,0,0,1],indices:[0,1,2],bounds:{min:[0,0,0],max:[1,0,1]}};
    expect(() => parseSceneImportData(value)).toThrow(/nests semantic/);
  });
  it('verifies the exact GLB and rejects a changed file or stub before exposing scene data', async () => {
    const {scene,bytes}=fixture(); expect(await verifySceneImportBytes(scene,bytes)).toEqual(scene);
    const changed=bytes.slice(0);new Uint8Array(changed)[changed.byteLength-1]^=1;
    await expect(verifySceneImportBytes(scene,changed)).rejects.toThrow(/SHA256 mismatch/);
    await expect(verifySceneImportBytes(scene,{stub:true})).rejects.toThrow(/actual GLB/);
    await expect(verifySceneImportBytes(scene,new ArrayBuffer(0))).rejects.toThrow(/complete GLB/);
  });
  it('index metadata survives registration, and only a loaded verified model enters the catalog', async () => {
    const {scene,bytes}=fixture(), m=new AssetManager({load:async()=>({handle:bytes,width:0,height:0})});
    const index=parseAssetIndex({version:1,assets:[{id:'yard',type:'mesh',status:'filled',description:'Yard',path:'/yard.glb',spec:{scene}}]});
    registerAssetIndex(m,index); expect(() => m.sceneImportCatalog(['yard'])).toThrow(/verified/);
    await m.load('yard');expect(m.sceneImportCatalog(['yard']).yard).toEqual(scene);
    expect(Object.isFrozen(m.sceneImportCatalog())).toBe(true);
    m.unload('yard');expect(() => m.sceneImportCatalog(['yard'])).toThrow(/verified/);
  });
  it('failed source verification releases the fetched handle, caches nothing, and permits a corrected retry', async () => {
    const {scene,bytes}=fixture(), release=vi.fn(), changed=bytes.slice(0);new Uint8Array(changed)[changed.byteLength-1]^=1;
    const load=vi.fn().mockResolvedValueOnce({handle:changed,width:0,height:0}).mockResolvedValue({handle:bytes,width:0,height:0});
    const m=new AssetManager({load,release});m.register({kind:'model',key:'yard',src:'/yard.glb',scene});
    await expect(m.load('yard')).rejects.toThrow(/SHA256 mismatch/);
    expect(m.isLoaded('yard')).toBe(false);expect(release).toHaveBeenCalledOnce();expect(m.sceneImportCatalog()).toEqual({});
    await m.load('yard');expect(m.sceneImportCatalog(['yard']).yard).toEqual(scene);expect(load).toHaveBeenCalledTimes(2);
  });
  it('a stale verified result after clear cannot overwrite a replacement model or catalog', async () => {
    const {scene,bytes}=fixture(); const pending:Array<(value:{handle:ArrayBuffer;width:number;height:number})=>void>=[],released:LoadedAsset[]=[];
    const m=new AssetManager({load:()=>new Promise(resolve=>pending.push(resolve)),release:a=>released.push(a)});
    m.register({kind:'model',key:'yard',src:'/old.glb',scene});const old=m.load('yard');m.clear();
    m.register({kind:'model',key:'yard',src:'/new.glb',scene});const fresh=m.load('yard');pending[1]({handle:bytes,width:0,height:0});await fresh;
    const current=m.get('yard');pending[0]({handle:bytes.slice(0),width:0,height:0});await old;
    expect(m.get('yard')).toBe(current);expect(m.sceneImportCatalog(['yard']).yard).toEqual(scene);expect(released).toHaveLength(1);
  });
  it('re-registration with stale generated metadata cannot reuse an older verified catalog', async () => {
    const {scene,bytes}=fixture(),m=new AssetManager({load:async()=>({handle:bytes,width:0,height:0})});
    m.register({kind:'model',key:'yard',src:'/yard.glb',scene});await m.load('yard');
    m.register({kind:'model',key:'yard',src:'/yard.glb',scene:{...scene,sourceSha256:'a'.repeat(64)}});
    expect(() => m.sceneImportCatalog(['yard'])).toThrow(/verified/);
  });
  it('clear while SHA verification is pending cannot republish an old catalog or delete the replacement inflight', async () => {
    const { scene, bytes } = fixture(), digest = Uint8Array.from(Buffer.from(scene.sourceSha256, 'hex')).buffer;
    const hashes: Array<(value: ArrayBuffer) => void> = [];
    vi.stubGlobal('crypto', { subtle: { digest: vi.fn(() => new Promise<ArrayBuffer>(resolve => hashes.push(resolve))) } });
    const released: LoadedAsset[] = [], m = new AssetManager({ load: async () => ({ handle: bytes.slice(0), width: 0, height: 0 }), release: a => released.push(a) });
    m.register({ kind: 'model', key: 'yard', src: '/old.glb', scene }); const old = m.load('yard');
    for (let i = 0; i < 6; i++) await Promise.resolve(); expect(hashes).toHaveLength(1);
    m.clear(); m.register({ kind: 'model', key: 'yard', src: '/new.glb', scene }); const fresh = m.load('yard');
    for (let i = 0; i < 6; i++) await Promise.resolve(); expect(hashes).toHaveLength(2);
    hashes[0](digest); await old; expect(m.sceneImportCatalog()).toEqual({}); expect(released).toHaveLength(1);
    expect(m.load('yard')).toBe(fresh); hashes[1](digest); await fresh;
    expect(m.sceneImportCatalog(['yard']).yard).toEqual(scene); expect(released).toHaveLength(1);
  });
  it('scene verification fails closed when the SHA verifier is unavailable', async () => {
    const { scene, bytes } = fixture(); vi.stubGlobal('crypto', undefined);
    await expect(verifySceneImportBytes(scene, bytes)).rejects.toThrow(/verifier unavailable/);
  });
  it('legacy loaders and unannotated models retain their original no-crypto behavior', async () => {
    const m=new AssetManager(new StubAssetLoader());vi.stubGlobal('crypto',undefined);
    m.register({kind:'model',key:'legacy',src:'/legacy.glb'});await m.load('legacy');expect(m.isLoaded('legacy')).toBe(true);expect(m.sceneImportCatalog()).toEqual({});
  });
});
