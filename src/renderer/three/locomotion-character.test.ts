import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { AssetManager, AssetDescriptor } from '@assets/index.js';
import { LOCOMOTION_STATES, compileLocomotionDriver3D, createLocomotionDriver, stepLocomotionDriver, type LocomotionDriver3D, type LocomotionPlayback } from '@engine/animation/locomotion-driver.js';
import { createAnimationDriver, stepAnimationDriver } from '@engine/animation/driver.js';
import type { AnimationDriver3D } from '@engine/protocol/components/animation-driver.js';
// @ts-expect-error Synthetic normalized rig only, not real calibration evidence.
import { makeMockCharacterGlb } from '../../../scripts/fixtures/character-pipeline/mock-character.mjs';
import {validateLocomotionCharacter3D} from '@engine/animation/locomotion-character.js';
import {createCharacterBinding,restIdentity,profileIdentity} from '@engine/host/locomotion-character.js';
import {serializeSkeletonRest} from './skeletal-clips.js';
import {validateLocomotionCharacters} from '../../assembly/locomotion-characters.js';
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

async function binding(f:ReturnType<typeof setup>,c:LocomotionDriver3D){const target=(f.pool as any).cache.get('model'),source=(f.pool as any).motions.get('motion');return createCharacterBinding(c,{skinSha256:sha(target.snapshot),model:{modelKey:'model'},effectiveScale:1,rest:await restIdentity(serializeSkeletonRest(target.rest))},[{asset:'motion',sha256:sha(bytes()),rest:await restIdentity(serializeSkeletonRest(source.rest))}],{artifactSha256:'f'.repeat(64),status:'unreviewed',scope:'target-specific-locomotion'});}
async function prepared(){const f=setup(),motion=bytes(),c=config(sha(motion));f.load('model',bytes());f.load('motion',motion,true);const object=await ready(f);await driven(f,c,pose(c,0));const b=await binding(f,c);return{f,c,object,b};}
async function bound(f:ReturnType<typeof setup>,c:LocomotionDriver3D,b:any,p=pose(c,250000)){await until(()=>{f.pool.applyLocomotionDriver('a',c,p,b,{type:'Model3D',modelKey:'model'});const entry=(f.pool as any).locomotionDrivers.get('a');return!!entry?.sampler||!!entry?.failed;});return(f.pool as any).locomotionDrivers.get('a');}
describe('real target binding ModelPool readiness and immutable snapshot identity',()=>{
 it('profile SHA is compiler-normalized and idempotent across authored sample/triangle order',async()=>{const c=config(sha(bytes())),normalized=compileLocomotionDriver3D(c).configuration;expect(await profileIdentity(c)).toBe(await profileIdentity(normalized));const swapped=structuredClone(c);(swapped.spaces.standing.samples as any[]).reverse();(swapped.spaces.standing.triangles as any[]).reverse();expect(await profileIdentity(swapped)).toBe(await profileIdentity(c));});
 it('builds actual native sampler only after exact model/profile/rest/source identities; unreviewed metadata does not pretend human approval',async()=>{const{f,c,b,object}=await prepared();const e=await bound(f,c,b);expect(e.bindingReady).toBe(true);expect(e.sampler).toBeDefined();f.pool.update(0);expect(hips(object).position.x).toBeCloseTo(.0125,6);expect(b.calibration.status).toBe('unreviewed');f.pool.dispose(f.scene);});
 it.each(['skin','targetRest','sourceRest','ratio','profile','sourceSHA','modelScale','selector'])('rejects actual %s mismatch without old-driver fallback',async kind=>{const{f,c,b,object}=await prepared(),warn=vi.spyOn(console,'warn').mockImplementation(()=>{});if(kind==='skin')b.target.skinSha256='0'.repeat(64);if(kind==='targetRest')b.target.restSha256='0'.repeat(64);if(kind==='sourceRest')b.retarget.sources[0].restSha256='0'.repeat(64);if(kind==='ratio')b.retarget.sources[0].hipRatio=2;if(kind==='profile')b.profileSha256='0'.repeat(64);if(kind==='sourceSHA')b.retarget.sources[0].sourceSha256='0'.repeat(64);if(kind==='modelScale')b.target.selector.scale=2;if(kind==='selector')b.target.selector.origin=[1,0,0];const e=await bound(f,c,b);expect(e.failed).toBe(true);expect(e.sampler).toBeUndefined();expect((f.pool as any).drivers.size).toBe(0);expect(warn).toHaveBeenCalled();f.pool.dispose(f.scene);});
 it('checks final real object scale and model scale on every application',async()=>{const{f,c,b,object}=await prepared();await bound(f,c,b);object.scale.setScalar(2);await bound(f,c,b);expect((f.pool as any).locomotionDrivers.get('a').failed).toBe(true);object.scale.set(1,2,1);const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});f.pool.applyLocomotionDriver('a',c,pose(c,0),b,{type:'Model3D',modelKey:'model'});expect((f.pool as any).locomotionDrivers.size).toBe(0);expect(warn).toHaveBeenCalled();f.pool.dispose(f.scene);});
 it('missing SHA crypto refuses bound playback while old technical path remains playable',async()=>{const{f,c,b}=await prepared();const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});vi.stubGlobal('crypto',{});const e=await bound(f,c,b);expect(e.failed).toBe(true);expect(e.sampler).toBeUndefined();f.pool.applyLocomotionDriver('a',c,pose(c,250000));expect((f.pool as any).locomotionDrivers.get('a').sampler).toBeDefined();expect(warn).toHaveBeenCalled();f.pool.dispose(f.scene);});
 it('hashes decoded model snapshot, not mutable AssetManager bytes',async()=>{const{f,c,b}=await prepared();new Uint8Array(f.loaded.get('model')!.handle).fill(0);const e=await bound(f,c,b);expect(e.sampler).toBeDefined();f.pool.dispose(f.scene);});
// eslint-disable-next-line zerocraft/no-unseeded-random, zerocraft/no-timers -- Native WebCrypto/GLTF readiness regression: real digest callbacks need host task turns; no simulation clock is advanced by this wait.
 it.each(['source-evict','model-evict','dispose','replace'])('late identity promises cannot commit after %s',async kind=>{const{f,c,b}=await prepared();const actual=globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle),release:Array<()=>void>=[];vi.spyOn(globalThis.crypto.subtle,'digest').mockImplementation(((algorithm:any,data:any)=>new Promise(resolve=>{release.push(()=>{void actual(algorithm,data).then(resolve);});}))as any);f.pool.applyLocomotionDriver('a',c,pose(c,0),b,{type:'Model3D',modelKey:'model'});const old=(f.pool as any).locomotionDrivers.get('a');expect(old.bindingPending).toBe(true);if(kind==='source-evict')f.evict('motion');if(kind==='model-evict')f.evict('model');if(kind==='dispose')f.pool.dispose(f.scene);if(kind==='replace')f.pool.applyLocomotionDriver('a',c,pose(c,0));for(let pass=0;pass<30;pass++){while(release.length)release.shift()!();await new Promise(r=>setTimeout(r,2));}expect(old.sampler).toBeUndefined();expect(old.bindingReady).not.toBe(true);f.pool.dispose(f.scene);});
 it('closed declaration validator refuses hooks/unknown fields and assembly orphan/mismatched source',async()=>{const{f,c,b}=await prepared();expect(validateLocomotionCharacter3D(b).version).toBe(1);expect(()=>validateLocomotionCharacters({actor:{LocomotionCharacter3D:b,LocomotionDriver3D:c,Model3D:{modelKey:'model'}}})).not.toThrow();expect(()=>validateLocomotionCharacter3D({...b,extra:1})).toThrow();let hooks=0;const bad={...b};Object.defineProperty(bad,'target',{enumerable:true,get(){hooks++;return b.target;}});expect(()=>validateLocomotionCharacter3D(bad)).toThrow();expect(hooks).toBe(0);expect(()=>validateLocomotionCharacters({actor:{LocomotionCharacter3D:b}})).toThrow();expect(()=>validateLocomotionCharacters({actor:{LocomotionCharacter3D:b,LocomotionDriver3D:c,Model3D:{modelKey:'wrong'}}})).toThrow(/selector/);f.pool.dispose(f.scene);});
});
