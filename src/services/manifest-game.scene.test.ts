// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({events:[] as string[],input:null as any,catalog:Promise.resolve(undefined) as Promise<any>,clear:vi.fn(),parse:vi.fn(),art:vi.fn(),hit:null as {signal:string;arg:string}|null,canvas:null as HTMLCanvasElement|null}));
vi.mock('./scene-game-assets.js',()=>({createManifestAssets:()=>({clear:state.clear}),loadManifestSceneCatalog:()=>state.catalog}));
vi.mock('../assembly/manifest.js',()=>({parseManifest:(raw:any,opts:any)=>{state.events.push('parse');state.parse(raw,opts);return {capabilities:[],entities:{}};}}));
vi.mock('../assembly/resolve-art-refs.js',()=>({resolveArtRefs:(raw:any)=>({manifest:raw})}));
vi.mock('@assets/index.js',()=>({artlibRecords:()=>[],loadGameArtInto:state.art}));
vi.mock('../runtime/engine.js',()=>({Engine:class {
 constructor(opts:any){state.input=opts.input;state.events.push('engine');}
 load(){state.events.push('load');}
 attachRenderer(renderer:any,container:HTMLElement){renderer.init(container);}
 start(){state.events.push('start');}
 stop(){state.events.push('stop');}
}}));
vi.mock('@renderer/index.js',()=>({CanvasRenderer:class {
 constructor(){state.events.push('canvas-renderer');}
 init(container:HTMLElement){state.canvas=document.createElement('canvas');container.append(state.canvas);}
 destroy(){state.events.push('destroy-canvas');}
}}));
vi.mock('@renderer/three-renderer.js',()=>({ThreeRenderer:class {
 constructor(){state.events.push('three-renderer');}
 init(container:HTMLElement){state.canvas=document.createElement('canvas');container.append(state.canvas);}
 pick(){return state.hit;}
 destroy(){state.events.push('destroy-three');}
}}));
import { mountManifestGame } from './manifest-game.js';
beforeEach(()=>{
 state.events.length=0;state.input=null;state.hit=null;state.canvas=null;state.clear.mockReset();state.parse.mockReset();state.art.mockReset();state.art.mockResolvedValue(true);state.catalog=Promise.resolve(undefined);
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.includes('manifest.json')?{ok:true,json:async()=>({entities:{yard:{SceneImport3D:{modelKey:'yard',rules:'default'}}}})}:{ok:false}));
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();document.body.innerHTML='';});
describe('manifest scene startup and input lifecycle',()=>{
 it('does not construct any world before verified scene data resolves; then selects Three and sends pick arg through queued input',async()=>{
  let finish!:(data:any)=>void;state.catalog=new Promise(resolve=>{finish=resolve;});
  const container=document.createElement('div'),unmount=mountManifestGame('scene')(container);
  await vi.waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));expect(state.events).toEqual([]);
  const catalog={yard:{version:1}};finish(catalog);await vi.waitFor(()=>expect(state.events).toContain('start'));
  expect(state.events).toEqual(['parse','engine','load','three-renderer','start']);expect(state.parse.mock.calls[0][1]).toEqual({sceneImports:catalog});expect(state.art).not.toHaveBeenCalled();
  state.hit={signal:'scene.pick',arg:'yard/node-2'};state.canvas!.dispatchEvent(new PointerEvent('pointerdown',{clientX:10,clientY:20}));
  expect(state.input.commandsForTick(1)[0].actions[0]).toMatchObject({key:'scene.pick',arg:'yard/node-2',phase:'action'});
  state.hit=null;state.canvas!.dispatchEvent(new PointerEvent('pointerdown'));expect(state.input.commandsForTick(2)).toEqual([]);
  unmount();expect(state.clear).toHaveBeenCalledOnce();expect(state.events.slice(-2)).toEqual(['stop','destroy-three']);
  state.canvas!.dispatchEvent(new PointerEvent('pointerdown'));expect(state.input.commandsForTick(3)).toEqual([]);
 });
 it('a verification failure never creates or starts an engine and leaves an explicit error',async()=>{
  state.catalog=Promise.reject(new Error('SHA mismatch'));const container=document.createElement('div'),unmount=mountManifestGame('scene')(container);
  await vi.waitFor(()=>expect(container.textContent).toContain('场景资源未就绪'));
  expect(state.events).toEqual([]);expect(state.clear).toHaveBeenCalledOnce();expect(state.art).not.toHaveBeenCalled();unmount();
 });
 it('unmount before required assets resolve cannot resurrect a world or renderer',async()=>{
  let finish!:(data:any)=>void;state.catalog=new Promise(resolve=>{finish=resolve;});const container=document.createElement('div'),unmount=mountManifestGame('scene')(container);
  await vi.waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));unmount();finish({yard:{version:1}});
  for(let i=0;i<12;i++)await Promise.resolve();expect(state.events).toEqual([]);expect(state.clear).toHaveBeenCalledOnce();expect(container.children).toHaveLength(0);
 });
 it('old manifests retain Canvas and nonblocking visual art loading',async()=>{
  const container=document.createElement('div'),unmount=mountManifestGame('old')(container);await vi.waitFor(()=>expect(state.events).toContain('start'));
  expect(state.events).toEqual(['parse','engine','load','canvas-renderer','start']);expect(state.art).toHaveBeenCalledOnce();unmount();expect(state.events.at(-1)).toBe('destroy-canvas');
 });
});
