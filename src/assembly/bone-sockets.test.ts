import {describe,it,expect,vi} from 'vitest';
import {validateBoneSocketReferences} from './bone-sockets.js';
import {validateInverseKinematics} from './inverse-kinematics.js';
import {expandSceneImports} from './scene-import.js';
import {parseManifest} from './manifest.js';
import {parseManifestAsync} from './manifest-async.js';
import {Engine} from '@runtime/engine.js';
import {NON_DETERMINISTIC,hashSnapshot} from '@net/determinism.js';
import {World} from '@engine/core/world.js';
const sockets=()=>({version:1,sockets:{grip:{bone:'RightHand',frame:'bone-local',offset:[.01,0,0],rotation:[0,0,0]}}});
function scene():any{return{actor:{Model3D:{modelKey:'skin'},BoneSockets3D:sockets(),IK3D:{chains:[{kind:'two-bone',root:'RightUpperArm',mid:'RightLowerArm',end:'RightHand',effectorSocket:'grip',target:{entity:'future',socket:'surface',offset:[0,0,0]},weight:1}]}},prop:{Mesh3D:{shape:'box',width:.1,height:.1},Attach3D:{parentId:'actor',socket:'grip',offset:[0,0,0],rot:[0,0,0]}}};}
const performance=()=>({version:1,tickRate:30,clips:{pose:{asset:'pose',clipName:'pose',retarget:'exact',sourceSha256:'a'.repeat(64),durationTicks:10}},slots:{upper:{order:0,mode:'override',bones:['RightHand'],weightQ:1000000}},montages:{hold:{slot:'upper',priority:1,blendInTicks:2,blendOutTicks:2,sections:[{id:'loop',clip:'pose',startTick:0,endTick:10,mode:'hold'}]}}});
describe('hand Socket assembly and new-authority IK',()=>{
 it('validates a named prop grip and tolerates an unresolved dynamic target without changing data',()=>{const s=scene(),before=JSON.stringify(s);expect(()=>validateBoneSocketReferences(s)).not.toThrow();expect(JSON.stringify(s)).toBe(before);});
 it.each([(s:any)=>delete s.actor.Model3D,(s:any)=>s.prop.Attach3D.socket='unknown',(s:any)=>s.actor.IK3D.chains[0].effectorSocket='missing',(s:any)=>s.actor.BoneSockets3D.sockets.grip.bone='LeftHand',(s:any)=>s.future={Model3D:{modelKey:'target'}}])('rejects present incompatible declarations %# before loading',mutate=>{const s=scene();mutate(s);expect(()=>validateBoneSocketReferences(s)).toThrow();});
 it('matches dynamic target socket names when that actor is present',()=>{const s=scene();s.future={Model3D:{modelKey:'other'},BoneSockets3D:{version:1,sockets:{surface:{bone:'LeftHand',frame:'bone-local',offset:[0,0,0],rotation:[0,0,0]}}}};expect(()=>validateBoneSocketReferences(s)).not.toThrow();});
 it.each(['constructor','toString','hasOwnProperty'])('does not treat inherited dictionary name %s as a declared socket',name=>{const s=scene();s.prop.Attach3D.socket=name;expect(()=>validateBoneSocketReferences(s)).toThrow(/missing socket/);});
 it('never executes a Socket component getter during SceneImport validation',()=>{const s=scene();let calls=0;Object.defineProperty(s.actor,'BoneSockets3D',{enumerable:true,get(){calls++;return sockets();}});expect(()=>expandSceneImports(s)).toThrow(/accessor/);expect(calls).toBe(0);});
 it('allows IK weights to follow a performance slot without requiring the conflicting legacy graph',()=>{const s=scene();s.actor.AnimationPerformance3D=performance();s.actor.IK3D.chains[0].weight={source:'performance-slot',slot:'upper'};expect(()=>validateInverseKinematics(s)).not.toThrow();s.actor.IK3D.chains[0].weight.slot='missing';vi.spyOn(console,'warn').mockImplementation(()=>{});expect(()=>validateInverseKinematics(s)).toThrow(/missing performance slot/);vi.restoreAllMocks();});
 it('keeps rest-calibrated Socket definitions out of simulation hash',()=>{expect(NON_DETERMINISTIC.has('BoneSockets3D')).toBe(true);const w=new World();w.createEntity('actor');const before=hashSnapshot(w.snapshot());w.addComponent('actor',{...sockets(),type:'BoneSockets3D'} as any);expect(hashSnapshot(w.snapshot())).toBe(before);});
 it('inferred render-only Socket provider has the same sync/async manifest path',async()=>{const s=scene(),a=parseManifest({entities:s}),b=await parseManifestAsync({entities:s});expect(a.capabilities.some(c=>c.id==='l7-bone-sockets')).toBe(true);expect(a.entities).toEqual(b.entities);const e=new Engine();expect(()=>e.load(a)).not.toThrow();});
});
