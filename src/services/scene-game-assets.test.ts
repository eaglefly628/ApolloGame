import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetManager } from '@assets/asset-manager.js';
import { createManifestAssets, loadManifestSceneCatalog } from './scene-game-assets.js';
const raw={templates:{scene:{SceneImport3D:{modelKey:'{{key}}',rules:'default'}}},entities:{yard:{$template:'scene',$params:{key:'yard'}}}};
function fixture() {
  const json=Buffer.from('{"asset":{"version":"2.0"}}  '), bytes=new ArrayBuffer(20+json.length), view=new DataView(bytes);
  for(const [offset,value]of [[0,0x46546c67],[4,2],[8,bytes.byteLength],[12,json.length],[16,0x4e4f534a]])view.setUint32(offset,value,true);
  new Uint8Array(bytes,20).set(json);
  const scene={version:1,sourceSha256:createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),nodes:[{index:0,path:[0],name:'spawn_hero',kind:'spawn',worldMatrix:[1,0,0,0,0,1,0,0,0,0,1,0,1,0,2,1]}]};
  const index={version:1,assets:[{id:'yard',type:'mesh',description:'scene',status:'filled',path:'/yard.glb',spec:{scene}},{id:'unrelated',type:'mesh',description:'later',status:'filled',path:'/later.glb'}],groups:{scene:['yard']},initialGroup:'scene'};
  return {bytes,scene,index};
}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('manifest scene asset startup',()=>{
  it('old manifests make no scene-index request and retain their nonblocking art path',async()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    const m=new AssetManager({load:vi.fn()});expect(await loadManifestSceneCatalog(m,{entities:{hero:{Shape:{}}}},'old')).toBeUndefined();expect(fetcher).not.toHaveBeenCalled();
  });
  it('template-selected scenes wait for actual bytes and verification before returning a catalog; unrelated groups stay unloaded',async()=>{
    const {bytes,scene,index}=fixture();vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>index})));
    let finish!:(v:{handle:ArrayBuffer;width:number;height:number})=>void;
    const load=vi.fn(()=>new Promise<{handle:ArrayBuffer;width:number;height:number}>(r=>{finish=r;})),m=new AssetManager({load});
    const result=loadManifestSceneCatalog(m,raw,'test');let settled=false;void result.then(()=>{settled=true;});
    for(let i=0;i<12;i++)await Promise.resolve();expect(load).toHaveBeenCalledOnce();expect(settled).toBe(false);
    finish({handle:bytes,width:0,height:0});expect((await result)?.yard).toEqual(scene);expect(m.isLoaded('unrelated')).toBe(false);
  });
  it('missing index or bad source metadata aborts required startup rather than returning an empty scene',async()=>{
    const m=new AssetManager({load:vi.fn()});vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:404})));
    await expect(loadManifestSceneCatalog(m,raw,'test')).rejects.toThrow(/startup aborted/);
    const {bytes,index}=fixture();index.assets[0].spec!.scene.sourceSha256='a'.repeat(64);
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>index})));
    const bad=new AssetManager({load:async()=>({handle:bytes,width:0,height:0})});
    await expect(loadManifestSceneCatalog(bad,raw,'test')).rejects.toThrow(/startup aborted/);expect(bad.isLoaded('yard')).toBe(false);
  });
  it('an already-aborted startup sends no index request',async()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const controller=new AbortController();controller.abort();
    await expect(loadManifestSceneCatalog(new AssetManager({load:vi.fn()}),raw,'test',controller.signal)).rejects.toMatchObject({name:'AbortError'});expect(fetcher).not.toHaveBeenCalled();
  });
  it('the generic manifest loader routes model bytes and image handles through their existing loaders',async()=>{
    const {bytes}=fixture();vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,arrayBuffer:async()=>bytes})));
    class ImageStub {onload?:()=>void;naturalWidth=8;naturalHeight=4;set src(_value:string){queueMicrotask(()=>this.onload?.());}}
    vi.stubGlobal('Image',ImageStub);const m=createManifestAssets();m.register({kind:'model',key:'model',src:'/model.glb'});m.register({kind:'texture',key:'texture',src:'/texture.png'});
    expect((await m.load('model')).handle).toBe(bytes);const texture=await m.load('texture');expect(texture).toMatchObject({width:8,height:4});expect(texture.handle).toHaveProperty('image');
  });
});
