import{createAnimationPerformance,stepAnimationPerformance}from'@engine/animation/performance-driver.js';
import type{AnimationPerformance3D}from'@engine/protocol/components/animation-performance.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { AssetManager, AssetDescriptor } from '@assets/index.js';
import type { AnimationDriver3D, AnimationDriverPlayback3D } from '@engine/protocol/components/animation-driver.js';
import { createAnimationDriver, stepAnimationDriver } from '@engine/animation/driver.js';
// @ts-expect-error Synthetic rig only; not provider or visual acceptance evidence.
import { makeMockCharacterGlb } from '../../../scripts/fixtures/character-pipeline/mock-character.mjs';
import { createHash, webcrypto } from 'node:crypto';
import type { RootMotion3D } from '@engine/protocol/components/root-motion.js';
import type { NativeRootMotionBinding } from './root-motion-binding.js';
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

const sha=(b:ArrayBuffer)=>createHash('sha256').update(new Uint8Array(b)).digest('hex');
function root(c:AnimationDriver3D,p:AnimationDriverPlayback3D,digest:string):NativeRootMotionBinding {
 const curve:RootMotion3D={type:'RootMotion3D',version:1,sourceSha256:'a'.repeat(64),inPlaceClipSha256:digest,carrier:{policy:'hips-linear-xz-v1',bone:'Hips',vertical:'motor'},tickRate:30,durationSubticks:30000,loop:'once',endpointPolicy:'accumulate-se2',samples:[{atSubtick:0,positionQ:{x:0,z:0},yawUnits:0},{atSubtick:30000,positionQ:{x:0,z:1000},yawUnits:0}],limits:{maxDeltaQ:10000,maxYawDeltaUnits:0,maxCyclesPerStep:1}};
 return {curve,source:{type:'RootMotionSource3D',version:1,driver:{kind:'animation-driver',clip:'move'}},baseConfig:c,basePlayback:p};
}
// eslint-disable-next-line zerocraft/no-timers -- Poll real GLTF/WebCrypto readiness, not simulation time; fake timers cannot settle the native digest.
async function rootReady(f:ReturnType<typeof setup>,c:AnimationDriver3D,p:AnimationDriverPlayback3D,b:NativeRootMotionBinding){for(let i=0;i<100;i++){f.pool.applyDriver('a',c,p,b);f.pool.update(i*10);const row=f.pool.getAnimationDiagnostics().find(x=>x.kind==='root');if(row?.status!=='loading')return row;await new Promise(r=>setTimeout(r,2));}throw Error('root readiness timeout');}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('pairs actual native bytes, ignores render wall clock and restores committed JSON pose',async()=>{
 vi.stubGlobal('crypto',webcrypto);const f=setup(),b=bytes('walk'),c=config(),p=seek(c,15);f.load('model',bytes());f.load('walk',b,true);const obj=await ready(f),binding=root(c,p,sha(b));
 expect(await rootReady(f,c,p,binding)).toMatchObject({status:'ready'});expect(hips(obj).position.x).toBeCloseTo(.025);const saved=JSON.stringify(p);
 f.pool.update(999999);expect(hips(obj).position.x).toBeCloseTo(.025);expect(JSON.stringify(p)).toBe(saved);
 const restored=JSON.parse(saved);expect(await rootReady(f,c,restored,root(c,restored,sha(b)))).toMatchObject({status:'ready'});expect(hips(obj).position.x).toBeCloseTo(.025);f.pool.dispose(f.scene);
});
it('refuses wrong actual SHA without applying root pose, and explicit removal restores D1',async()=>{
 vi.stubGlobal('crypto',webcrypto);vi.spyOn(console,'warn').mockImplementation(()=>{});const f=setup(),c=config(),p=seek(c,20);f.load('model',bytes());f.load('walk',bytes('walk'),true);const obj=await ready(f);
 expect(await rootReady(f,c,p,root(c,p,'f'.repeat(64)))).toMatchObject({status:'rejected',reason:expect.stringMatching(/SHA mismatch/)});expect(hips(obj).position.x).toBe(0);
 f.pool.applyDriver('a',c,p,null);f.pool.update(1);expect(hips(obj).position.x).toBeCloseTo(1/30);expect(f.pool.getAnimationDiagnostics().some(x=>x.kind==='root')).toBe(false);f.pool.dispose(f.scene);
});
it('rejects wrong alias and never falls back to a root pose',async()=>{
 vi.stubGlobal('crypto',webcrypto);vi.spyOn(console,'warn').mockImplementation(()=>{});const f=setup(),b=bytes('walk'),c=config(),p=seek(c,15);f.load('model',bytes());f.load('walk',b,true);const obj=await ready(f),bad=root(c,p,sha(b));(bad as {source:NativeRootMotionBinding['source']}).source={...bad.source,driver:{kind:'animation-driver',clip:'missing'}};
 expect(f.pool.setRootMotionBinding('a',bad)).toBe(false);expect(f.pool.getAnimationDiagnostics()).toContainEqual(expect.objectContaining({kind:'root',status:'rejected'}));
 await rootReady(f,c,p,root(c,p,'f'.repeat(64)));f.pool.update(1);expect(hips(obj).position.x).toBe(0);f.pool.dispose(f.scene);
});
it('eviction invalidates paired bytes and reload requires a fresh exact digest',async()=>{
 vi.stubGlobal('crypto',webcrypto);const f=setup(),b=bytes('walk'),c=config(),p=seek(c,18);f.load('model',bytes());f.load('walk',b,true);const obj=await ready(f),binding=root(c,p,sha(b));expect(await rootReady(f,c,p,binding)).toMatchObject({status:'ready'});
 f.evict('walk');f.pool.update(1);expect(f.pool.getAnimationDiagnostics().find(x=>x.kind==='root')?.status).toBe('loading');expect(hips(obj).position.x).toBe(0);
 f.load('walk',b,true);expect(await rootReady(f,c,p,binding)).toMatchObject({status:'ready'});expect(hips(obj).position.x).toBeCloseTo(.03);f.pool.dispose(f.scene);
});
it('keeps inactive idle available while proactively verifying the paused root source SHA',async()=>{
 const pending:Array<()=>void>=[];vi.stubGlobal('crypto',{subtle:{digest:(_algorithm:unknown,data:BufferSource)=>new Promise<ArrayBuffer>((resolve,reject)=>{pending.push(()=>{webcrypto.subtle.digest('SHA-256',data as ArrayBuffer).then(resolve,reject);});})}});
 const f=setup(),b=bytes('walk'),base=config(),c:AnimationDriver3D={...base,initialState:'idle',graph:{...base.graph,clips:{...base.graph.clips,idle:{clip:'builtin',loop:false}},states:{...base.graph.states,idle:{clip:'idle'}}},clips:{...base.clips,idle:{durationTicks:30}}};const p=stepAnimationDriver(c,createAnimationDriver(c),{commands:[{seq:1,op:'seek',tick:15}]}).playback;
 f.load('model',bytes('builtin'));f.load('walk',b,true);const obj=await ready(f),binding=root(c,p,sha(b));await driven(f,c,p);f.pool.setRootMotionBinding('a',binding);f.pool.update(1);expect(hips(obj).position.x).toBeCloseTo(.025);expect(f.pool.getAnimationDiagnostics().find(x=>x.kind==='root')?.status).toBe('loading');
 expect(pending.length).toBeGreaterThan(0);for(const finish of pending.splice(0))finish();expect(await rootReady(f,c,p,binding)).toMatchObject({status:'ready',reason:expect.stringContaining('inactive')});expect(hips(obj).position.x).toBeCloseTo(.025);f.pool.dispose(f.scene);
});

it('root performance mask checks every actual retained target bone, not a 17-bone declaration',async()=>{
 vi.stubGlobal('crypto',webcrypto);const f=setup(),b=bytes('walk'),c=config(),p=seek(c,0);f.load('model',bytes());f.load('walk',b,true);const object=await ready(f);await driven(f,c,p);let skeleton!:THREE.Skeleton;object.traverse(n=>{if((n as THREE.SkinnedMesh).isSkinnedMesh)skeleton=(n as THREE.SkinnedMesh).skeleton;});const bones=skeleton.bones.map(n=>n.name);const extra=new THREE.Bone();extra.name='FingerExtra';object.add(extra);skeleton.bones.push(extra);
 const pc:AnimationPerformance3D={type:'AnimationPerformance3D',version:1,tickRate:30,clips:{move:{asset:'walk',clipName:'walk',sourceSha256:sha(b),durationTicks:30,retarget:'exact'}},slots:{body:{order:0,mode:'override',bones,weightQ:1000000}},montages:{walk:{slot:'body',priority:1,blendInTicks:0,blendOutTicks:0,sections:[{id:'once',clip:'move',startTick:0,endTick:30,mode:'once'}]}}};
 const pp=stepAnimationPerformance(pc,createAnimationPerformance(pc,'a'),{commands:[{seq:1,op:'play',montage:'walk'}]});const binding:NativeRootMotionBinding={...root(c,p,sha(b)),source:{type:'RootMotionSource3D',version:1,driver:{kind:'performance-slot',slot:'body',clip:'move'}},performanceConfig:pc,performancePlayback:pp};expect(f.pool.setRootMotionBinding('a',binding)).toBe(true);f.pool.update(1);expect(f.pool.getAnimationDiagnostics()).toContainEqual(expect.objectContaining({kind:'root',status:'rejected',reason:expect.stringContaining('every retained target bone')}));f.pool.dispose(f.scene);
});

it('diagnostics are immutable cache reads, and absent crypto rejects only opted-in root verification',async()=>{
 vi.stubGlobal('crypto',undefined);const f=setup(),b=bytes('walk'),c=config(),p=seek(c,15);f.load('model',bytes());f.load('walk',b,true);const object=await ready(f);expect(await rootReady(f,c,p,root(c,p,sha(b)))).toMatchObject({status:'rejected',reason:expect.stringContaining('SHA unavailable')});expect(hips(object).position.x).toBe(0);const count=f.manager.get.mock.calls.length,first=f.pool.getAnimationDiagnostics();expect(Object.isFrozen(first)).toBe(true);expect(first.every(Object.isFrozen)).toBe(true);for(let i=0;i<10;i++)f.pool.getAnimationDiagnostics();expect(f.manager.get.mock.calls.length).toBe(count);f.pool.applyDriver('a',c,p,null);f.pool.update(10);expect(hips(object).position.x).toBeCloseTo(.025);f.pool.dispose(f.scene);
});

it('actual committed active native snapshot overrides a stale inactive root context',async()=>{
 vi.stubGlobal('crypto',webcrypto);const f=setup(),b=bytes('walk'),base=config(),c:AnimationDriver3D={...base,initialState:'idle',graph:{...base.graph,clips:{...base.graph.clips,idle:{clip:'builtin',loop:false}},states:{...base.graph.states,idle:{clip:'idle'}}},clips:{...base.clips,idle:{durationTicks:30}}},idle=createAnimationDriver(c),active=stepAnimationDriver(c,idle,{commands:[{seq:1,op:'play',state:'move'}]}).playback;
// eslint-disable-next-line zerocraft/no-timers -- Allow real native SHA callbacks to settle while testing stale-context rejection; this never steps simulation.
 f.load('model',bytes('builtin'));f.load('walk',b,true);const object=await ready(f);await driven(f,c,active);f.pool.setRootMotionBinding('a',root(c,idle,'f'.repeat(64)));for(let i=0;i<30;i++){f.pool.update(i);await new Promise(r=>setTimeout(r,1));}expect(f.pool.getAnimationDiagnostics()).toContainEqual(expect.objectContaining({kind:'root',status:'rejected'}));expect(hips(object).position.x).toBe(0);f.pool.dispose(f.scene);
});
