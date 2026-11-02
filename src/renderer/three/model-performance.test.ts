import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { AssetManager, AssetDescriptor } from '@assets/index.js';
import { LOCOMOTION_STATES, compileLocomotionDriver3D, createLocomotionDriver, stepLocomotionDriver, type LocomotionDriver3D, type LocomotionPlayback } from '@engine/animation/locomotion-driver.js';
// @ts-expect-error Synthetic GLB authoring helper only.
import {writeComposedGlb,unpackGlb} from '../../../scripts/lib/motion-compose-glb.mjs';
import { createAnimationDriver, stepAnimationDriver } from '@engine/animation/driver.js';
import type { AnimationDriver3D } from '@engine/protocol/components/animation-driver.js';
// @ts-expect-error Synthetic normalized rig only, not real calibration evidence.
import { makeMockCharacterGlb } from '../../../scripts/fixtures/character-pipeline/mock-character.mjs';
import {createAnimationPerformance,stepAnimationPerformance} from '@engine/animation/performance-driver.js';
import type {AnimationPerformance3D} from '@engine/protocol/components/animation-performance.js';
import { ModelPool } from './models.js';
import { prepareLocomotionPose, unwrapLocomotionPlayback } from './locomotion-driver-pose.js';
function bytes(doubled = false): ArrayBuffer {
  let result: Buffer = makeMockCharacterGlb({ clipName: 'walk' });
  if (doubled) {
    const length = result.readUInt32LE(12), json = JSON.parse(result.subarray(20, 20 + length).toString()), bin = result.subarray(28 + length); json.nodes[0].translation[1] = 1.9;
    const text = Buffer.from(JSON.stringify(json)), padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32); text.copy(padded);
    result = Buffer.alloc(28 + padded.length + bin.length); result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8); result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); result.writeUInt32LE(bin.length, 20 + padded.length); result.writeUInt32LE(0x004e4942, 24 + padded.length); bin.copy(result, 28 + padded.length);
  }
  return Uint8Array.from(result).buffer;
}
const sha = (buffer: ArrayBuffer) => createHash('sha256').update(new Uint8Array(buffer)).digest('hex');
function config(hash: string, durationTicks = 30): LocomotionDriver3D {
  const once = new Set(['start','stop','turn-positive','turn-negative','crouch-in','crouch-out','jump-start','land','recover']), clips: any = {}, states: any = {}, members: any = {};
  for (const id of LOCOMOTION_STATES) {
    if (id === 'move' || id === 'crouched-move') { states[id] = { node: { kind: 'blend2d', space: id === 'move' ? 'standing' : 'crouched' }, minTicks: 0, interruptible: true, restartOnEnter: false, onComplete: 'stay' }; continue; }
    clips[id] = { asset: 'motion', clipName: 'walk', loop: !once.has(id), durationTicks, sourceSha256: hash, motionSpace: 'in-place', sync: 'free' };
    states[id] = { node: { kind: 'clip', clip: id }, minTicks: 1, interruptible: false, restartOnEnter: once.has(id), onComplete: once.has(id) ? id === 'land' ? 'recover' : 'motor' : 'stay' };
  }
  for (const id of ['N','E','S','W']) {
    clips[id] = { asset: 'motion', clipName: 'walk', loop: true, durationTicks, sourceSha256: hash, motionSpace: 'in-place', sync: 'gait' };
    members[id] = { durationSubticks: durationTicks * 1000, markers: [{ id: 'L', atSubtick: 0 }, { id: 'R', atSubtick: durationTicks * 500 }], strideDistanceQ: id === 'E' ? 2000 : 1000, sourceSha256: hash, calibrationStatus: 'reviewed', provenance: 'Synthetic math/render fixture; no measured real stride or in-place quality approval.' };
  }
  const space = (idle: string) => ({ samples: [{ id:'O',clip:idle,xQps:0,yQps:0 },{id:'N',clip:'N',xQps:0,yQps:100},{id:'E',clip:'E',xQps:100,yQps:0},{id:'S',clip:'S',xQps:0,yQps:-100},{id:'W',clip:'W',xQps:-100,yQps:0}], triangles: [{id:'a',vertices:['O','E','N']as const},{id:'b',vertices:['O','N','W']as const},{id:'c',vertices:['O','W','S']as const},{id:'d',vertices:['O','S','E']as const}] });
  return { type:'LocomotionDriver3D',version:1,tickRate:30,localAxes:{up:'Y',forward:'+Z',lateral:'+X'},stridePolicy:'weighted-measured',thresholds:{moveEnterQps:10,moveExitQps:5,turnEnterUnits:1000,turnExitUnits:500},clips,states,spaces:{standing:space('idle'),crouched:space('crouched-idle')},gait:{version:1,id:'render',referenceStrideDistanceQ:1000,markers:[{id:'L',phaseQ:0,foot:'left',kind:'plant'},{id:'R',phaseQ:500000,foot:'right',kind:'plant'}],members} };
}
function pose(c: LocomotionDriver3D, phaseQ: number): LocomotionPlayback {
  const compiled = compileLocomotionDriver3D(c);
  return stepLocomotionDriver(compiled, createLocomotionDriver(compiled), { facts: {seq:1,localLateralQps:0,localForwardQps:100,acceptedDistanceQ:0,desiredSpeedQps:100,mode:'grounded',stance:'standing',yawErrorUnits:0,jumpInstance:0,landingInstance:0}, commands:[{seq:1,op:'preview-seek',state:'move',tick:0,phaseQ,cycle:0}] }).state;
}
function setup() {
  const loaded = new Map<string,{descriptor: AssetDescriptor;handle:ArrayBuffer}>(), listeners = new Set<(e:{key:string})=>void>();
  const manager = { get: vi.fn((key:string)=>loaded.get(key)), load: vi.fn(), onEvict(cb:(e:{key:string})=>void){listeners.add(cb);return()=>listeners.delete(cb);} };
  const scene = new THREE.Scene(), pool = new ModelPool(manager as unknown as AssetManager);
  const load = (key:string,handle:ArrayBuffer,motion=false)=>loaded.set(key,{handle,descriptor:motion?{kind:'skeletal-animation',key,src:'/synthetic.glb',skeleton:'apollo-humanoid-v1',fps:30,frames:31,loop:true}:{kind:'model',key,src:'/synthetic.glb'}});
  const evict = (key:string)=>{loaded.delete(key);for(const cb of listeners)cb({key});};return{pool,scene,loaded,manager,load,evict,listeners};
}
async function until(predicate:()=>boolean):Promise<void>{for(let i=0;i<300;i++){if(predicate())return;await new Promise<void>(r=>setTimeout(r,0));}throw new Error('synthetic locomotion readiness timeout');}
async function ready(f:ReturnType<typeof setup>,id='a',key='model'){let result:THREE.Object3D|null=null;await until(()=>!!(result=f.pool.ensure(f.scene,id,{type:'Model3D',modelKey:key})));return result!;}
async function driven(f:ReturnType<typeof setup>,c:LocomotionDriver3D,p:LocomotionPlayback,id='a'){await until(()=>{f.pool.applyLocomotionDriver(id,c,p);const entry=(f.pool as any).locomotionDrivers.get(id);return!!entry?.sampler||!!entry?.failed;});}
function hips(object:THREE.Object3D){let bone!:THREE.Bone;object.traverse(n=>{if((n as THREE.Bone).isBone&&n.name==='Hips')bone=n as THREE.Bone;});return bone;}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

function perf(hash:string):AnimationPerformance3D{return{type:'AnimationPerformance3D',version:1,tickRate:30,clips:{gesture:{asset:'gesture',clipName:'walk',sourceSha256:hash,durationTicks:30,retarget:'humanoid'}},slots:{upper:{order:0,mode:'override',bones:['Hips'],weightQ:500000}},montages:{wave:{slot:'upper',priority:1,blendInTicks:0,blendOutTicks:0,sections:[{id:'body',clip:'gesture',startTick:0,endTick:30,mode:'hold'}]}}};}
function perfPose(c:AnimationPerformance3D,id='a',tick=15){let p=createAnimationPerformance(c,id);p=stepAnimationPerformance(c,p,{commands:[{seq:1,op:'play',montage:'wave'}]});return stepAnimationPerformance(c,p,{commands:[{seq:2,op:'preview-seek',slot:'upper',section:'body',tick}]});}
async function base(){const f=setup(),motion=bytes(),c=config(sha(motion));f.load('model',bytes());f.load('motion',motion,true);const object=await ready(f);await driven(f,c,pose(c,250000));f.pool.update(0);return{f,c,object};}
async function performanceReady(f:ReturnType<typeof setup>,c:AnimationPerformance3D,p=perfPose(c)){await until(()=>{f.pool.applyAnimationPerformance('a',c,p);const e=(f.pool as any).performances.get('a');return !!e?.sampler||!!e?.failed;});return(f.pool as any).performances.get('a');}
function fullTrs(delta=.02,scaleDelta=.2){const original=Buffer.from(bytes()),{doc}=unpackGlb(original),samples=Array.from({length:31},(_,frame)=>Object.fromEntries(doc.skins[0].joints.map((i:number)=>{const n=doc.nodes[i];return[n.name,{translation:n.name==='Spine'?[delta*frame/30,...(n.translation??[0,0,0]).slice(1)]:n.translation??[0,0,0],rotation:n.rotation??[0,0,0,1],scale:n.name==='Spine'?[1+scaleDelta*frame/30,1,1]:n.scale??[1,1,1]}];})));return Uint8Array.from(writeComposedGlb(original,{id:'full',fps:30,frames:31,samples,THREE})).buffer;}
describe('performance overlays real source/SHA/retarget/native clone lifecycle',()=>{
 it('base then partial override is exact, repeat wallclock does not accumulate, JSON seek restore is deterministic',async()=>{const{f,c,object}=await base(),gesture=bytes(),pc=perf(sha(gesture));f.load('gesture',gesture,true);const p=perfPose(pc),before=JSON.stringify(p);await performanceReady(f,pc,p);for(const ms of [1,1,2000,999999]){f.pool.update(ms);expect(hips(object).position.x).toBeCloseTo(.01875,6);}expect(JSON.stringify(p)).toBe(before);const changed=perfPose(pc,'a',24);f.pool.applyAnimationPerformance('a',pc,changed);f.pool.update(0);expect(hips(object).position.x).toBeCloseTo(.02625,6);f.pool.applyAnimationPerformance('a',pc,JSON.parse(before));f.pool.update(0);expect(hips(object).position.x).toBeCloseTo(.01875,6);f.pool.clearPerformance('a');f.pool.update(0);expect(hips(object).position.x).toBeCloseTo(.0125,6);f.pool.dispose(f.scene);});
 it('explicit exact preserves real GLB non-hip animated translation and scale; humanoid refuses instead of dropping',async()=>{const{f,object}=await base(),glb=fullTrs(),pc=perf(sha(glb));(pc.clips.gesture as any).clipName='full';(pc.clips.gesture as any).retarget='exact';(pc.slots.upper as any).bones=['Spine'];(pc.slots.upper as any).weightQ=1000000;f.load('gesture',glb,true);const e=await performanceReady(f,pc);expect(e.sampler).toBeDefined();f.pool.update(1);const bone=object.getObjectByName('Spine')!;expect(bone.position.x).toBeCloseTo(.01,6);expect(bone.scale.x).toBeCloseTo(1.1,6);(pc.clips.gesture as any).retarget='humanoid';const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});const refused=await performanceReady(f,pc);expect(refused.failed).toBe(true);expect(refused.sampler).toBeUndefined();expect(warn.mock.calls.flat().join(' ')).toContain('humanoid refuses');f.pool.dispose(f.scene);});
 it('unkeyed base bones are restored before each overlay, so partial Spine layers cannot accumulate',async()=>{const{f,object}=await base(),glb=fullTrs(),pc=perf(sha(glb));(pc.clips.gesture as any).clipName='full';(pc.clips.gesture as any).retarget='exact';(pc.slots.upper as any).bones=['Spine'];f.load('gesture',glb,true);await performanceReady(f,pc);for(const ms of [1,1,1000,2000]){f.pool.update(ms);expect(object.getObjectByName('Spine')!.position.x).toBeCloseTo(.005,6);}f.pool.clearPerformance('a');f.pool.update(0);expect(object.getObjectByName('Spine')!.position.x).toBe(0);f.pool.dispose(f.scene);});
 it('even tiny animated non-hip tracks refuse humanoid instead of disappearing under a rest tolerance',async()=>{const{f}=await base(),glb=fullTrs(1e-6,0),pc=perf(sha(glb));(pc.clips.gesture as any).clipName='full';(pc.slots.upper as any).bones=['Spine'];f.load('gesture',glb,true);const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});const e=await performanceReady(f,pc);expect(e.failed).toBe(true);expect(warn.mock.calls.flat().join(' ')).toContain('humanoid refuses');f.pool.dispose(f.scene);});
 it('unloaded source stays pending without replacing base; wrong SHA refuses overlay',async()=>{const{f,c,object}=await base(),pc=perf('0'.repeat(64)),warn=vi.spyOn(console,'warn').mockImplementation(()=>{});f.pool.applyAnimationPerformance('a',pc,perfPose(pc));f.pool.update(1);expect((f.pool as any).performances.get('a').sampler).toBeUndefined();expect(hips(object).position.x).toBeCloseTo(.0125);f.load('gesture',bytes(),true);const e=await performanceReady(f,pc);expect(e.failed).toBe(true);expect(e.sampler).toBeUndefined();expect(warn).toHaveBeenCalled();f.pool.dispose(f.scene);});
 it('explicit mask/source/reference absence rejects, never expands to full body',async()=>{const{f}=await base(),pc=perf(sha(bytes()));f.load('gesture',bytes(),true);(pc.slots.upper.bones as string[])[0]='Missing';const e=await performanceReady(f,pc);expect(e.failed).toBe(true);expect(e.sampler).toBeUndefined();f.pool.dispose(f.scene);});
 it('actor ownership rejects copied snapshots; same config independent actors retain independent actions',async()=>{const{f,c,object}=await base(),pc=perf(sha(bytes()));f.load('gesture',bytes(),true);const other=await ready(f,'b');await driven(f,c,pose(c,750000),'b');await performanceReady(f,pc);f.pool.applyAnimationPerformance('b',pc,perfPose(pc,'b',24));await until(()=>{f.pool.update(1);return !!(f.pool as any).performances.get('b').sampler;});expect(hips(object).position.x).toBeCloseTo(.01875);expect(hips(other).position.x).toBeCloseTo(.03875);f.pool.applyAnimationPerformance('b',pc,perfPose(pc,'a'));expect((f.pool as any).performances.has('b')).toBe(false);f.pool.update(1);expect(hips(object).position.x).toBeCloseTo(.01875);f.pool.dispose(f.scene);});
 it('source eviction disposes clone and reload builds fresh; model swap/dispose removes overlay owners',async()=>{const{f,c}=await base(),pc=perf(sha(bytes()));f.load('gesture',bytes(),true);const e=await performanceReady(f,pc),old=e.sampler;f.pool.update(1);f.evict('gesture');expect(e.sampler).toBeUndefined();expect(()=>old.apply([])).toThrow(/disposed/);f.load('gesture',bytes(),true);await performanceReady(f,pc);expect(e.sampler).toBeDefined();expect(e.sampler).not.toBe(old);f.load('model2',bytes());await until(()=>!!f.pool.ensure(f.scene,'a',{type:'Model3D',modelKey:'model2'}));expect((f.pool as any).performances.has('a')).toBe(false);f.pool.dispose(f.scene);expect((f.pool as any).performances.size).toBe(0);});
// eslint-disable-next-line zerocraft/no-timers -- Native GLTFLoader asynchronous callback cleanup needs a host task turn; fake timers cannot complete the real parse callback.
 it('late source parse after actor disposal cannot resurrect performance clone',async()=>{const{f}=await base(),pc=perf(sha(bytes()));let finish:any;const parse=GLTFLoader.prototype.parse;vi.spyOn(GLTFLoader.prototype,'parse').mockImplementation(function(this:GLTFLoader,...args:any[]){finish=()=>parse.apply(this,args as any);});f.load('gesture',bytes(),true);f.pool.applyAnimationPerformance('a',pc,perfPose(pc));expect(finish).toBeDefined();f.pool.dispose(f.scene);finish();await new Promise(r=>setTimeout(r,20));expect((f.pool as any).performances.size).toBe(0);expect(f.pool.count).toBe(0);});
});
