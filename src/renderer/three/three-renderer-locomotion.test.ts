import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '@engine/core/world.js';
import { hashSnapshot } from '@net/determinism.js';
import { characterMotorCapability } from '@skills/tier2/character-motor.js';
import type { CharacterMotor3D } from '@engine/protocol/components/character-motor.js';
import { ThreeRenderer } from '../three-renderer.js';
import { CameraRig } from './camera-rig.js';
import { LightRig } from './lights.js';
function motor(): CharacterMotor3D { return { type:'CharacterMotor3D',version:1,motion:{version:1,unitsPerMeter:10000,tickRate:60,body:{kind:'capsule',radiusQ:2000,standingHeightQ:18000,crouchedHeightQ:10000,skinQ:2},maxWalkSpeedQps:20000,maxRunSpeedQps:40000,maxCrouchSpeedQps:10000,accelQps2:40000,brakeQps2:60000,airControlQps2:20000,gravityQps2:98000,jumpSpeedQps:40000,terminalFallSpeedQps:100000,recoverTicks:2,collision:{kind:'static-aabb',maxObstacles:16,maxContacts:8,maxSlideIterations:8,maxDeltaQ:1000000}},initial:{positionQ:{x:0,y:0,z:0},stance:'standing',yawUnits:16384},maxTurnUnitsPerSecond:65536 }; }
function world() {
  const w=new World({strict:true});for(const system of characterMotorCapability.systems)w.addSystem(system);
  w.createEntity('actor');w.addComponent('actor',motor());w.addComponent('actor',{type:'Model3D',modelKey:'synthetic'});
  w.createEntity('floor');w.addComponent('floor',{type:'Transform',x:0,y:0,rotation:0,scaleX:1,scaleY:1});w.addComponent('floor',{type:'Collider3D',kind:'box',halfX:100,halfY:.5,halfZ:100,baseY:-1});w.tick();return w;
}
/** Real orchestration/Three objects with a fake GPU allocator. Native GLTF pose
 * and source-byte checks are exercised separately in model-locomotion-drivers. */
function renderer() {
  const r=new ThreeRenderer(),access=r as any,object=new THREE.Group();
  access.scene=new THREE.Scene();access.scene.add(object);const objects=new Map<string,THREE.Object3D>([['actor',object]]);
  const gl={dispose:vi.fn(),forceContextLoss:vi.fn(),domElement:{remove:vi.fn()},render:vi.fn(),shadowMap:{},properties:{get:()=>({})},info:{reset:()=>{},memory:{geometries:0,textures:0},render:{calls:0,triangles:0}}};
  const models={get count(){return objects.size;},ensure:vi.fn((scene:THREE.Scene,id:string)=>{let next=objects.get(id);if(!next){next=new THREE.Group();objects.set(id,next);scene.add(next);}return next;}),update:vi.fn(()=>0),sweep:vi.fn(),dispose:vi.fn(),clearDriver:vi.fn(),clearGraph:vi.fn(),rejectDriver:vi.fn(),applyAnim:vi.fn(),applyGraph:vi.fn(),applyDriver:vi.fn(),applyLocomotionDriver:vi.fn(),applyAnimationPerformance:vi.fn(),clearPerformance:vi.fn(),applyFace:vi.fn(),setRootMotionBinding:vi.fn(()=>true),getAnimationDiagnostics:vi.fn(()=>[]),instance:(id:string)=>objects.get(id)};
  Object.assign(access,{gl,cameras:new CameraRig(50,1.6),lights:new LightRig(access.scene),models});return{r,object,models,objects};
}
beforeEach(()=>{vi.stubGlobal('document',{createElement:()=>({getContext:()=>({createLinearGradient:()=>({addColorStop:()=>{}}),createRadialGradient:()=>({addColorStop:()=>{}}),fillRect:()=>{}})})});});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('actual ThreeRenderer locomotion dispatch and motor pose authority (CPU orchestration)',()=>{
  it('ignores raw FaceDir wallclock steering and parent Pivot for a validated motor pose without changing world hash',()=>{
    const w=world(),f=renderer();w.addComponent('actor',{type:'FaceDir',x:-1,y:0});w.createEntity('pivot');w.addComponent('pivot',{type:'Transform3D',x:100,y:100,z:100,rotY:2});w.addComponent('pivot',{type:'Pivot3D',children:['actor']});
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{}),before=hashSnapshot(w.snapshot());f.r.sync(w.readView());
    expect(f.object.position.toArray()).toEqual([0,0,0]);expect(f.object.rotation.y).toBeCloseTo(Math.PI/2);expect(hashSnapshot(w.snapshot())).toBe(before);
    expect(warn.mock.calls.flat().join(' ')).toContain('CharacterMotor3D');expect(warn.mock.calls.flat().join(' ')).toContain('Pivot3D');f.r.destroy();
  });
  it('ignores a raw motor Attach3D child while retaining ordinary props attached to its hand',()=>{
    const w=world(),f=renderer(),parent=new THREE.Group(),parentHand=new THREE.Bone(),actorHand=new THREE.Bone();parentHand.name='Hand';parent.add(parentHand);f.objects.set('parent',parent);(f.r as any).scene.add(parent);actorHand.name='Hand';actorHand.position.set(1,.5,0);f.object.add(actorHand);
    w.createEntity('parent');w.addComponent('parent',{type:'Transform',x:10,y:0,rotation:0,scaleX:1,scaleY:1});w.addComponent('parent',{type:'Model3D',modelKey:'parent'});w.addComponent('actor',{type:'Attach3D',parentId:'parent',bone:'Hand',offset:[0,0,0],rot:[0,0,0]});
    w.createEntity('prop');w.addComponent('prop',{type:'Transform',x:50,y:0,rotation:0,scaleX:1,scaleY:1});w.addComponent('prop',{type:'Model3D',modelKey:'prop'});w.addComponent('prop',{type:'Attach3D',parentId:'actor',bone:'Hand',offset:[0,0,0],rot:[0,0,0]});
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{}),before=hashSnapshot(w.snapshot());f.r.sync(w.readView());expect(f.object.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([0,0,0]);
    const attached=f.objects.get('prop')!.getWorldPosition(new THREE.Vector3());expect(attached.x).toBeCloseTo(0);expect(attached.y).toBeCloseTo(.5);expect(attached.z).toBeCloseTo(-1);expect(warn.mock.calls.flat().join(' ')).toContain('Attach3D');expect(hashSnapshot(w.snapshot())).toBe(before);f.r.destroy();
  });
  it.each(['LocomotionDriver3D','LocomotionPlayback3D','LocomotionCommand3D','LocomotionCharacter3D','AnimationDriver3D','AnimationDriverPlayback3D','AnimationDriverCommand3D'])('rejects orphan %s instead of falling back to a legacy animation',type=>{
    const w=world(),f=renderer();w.addComponent('actor',{type:'AnimState3D',clip:'legacy'});w.addComponent('actor',{type});
    f.r.sync(w.readView());expect(f.models.rejectDriver).toHaveBeenCalledOnce();expect(f.models.applyAnim).not.toHaveBeenCalled();expect(f.models.applyGraph).not.toHaveBeenCalled();expect(f.models.applyDriver).not.toHaveBeenCalled();expect(f.models.applyLocomotionDriver).not.toHaveBeenCalled();f.r.destroy();
  });
  it.each(['LocomotionDriver3D','LocomotionPlayback3D','LocomotionCommand3D','LocomotionCharacter3D'])('rejects a D1 pair with competing raw %s',type=>{
    const w=world(),f=renderer();w.addComponent('actor',{type:'AnimationDriver3D'});w.addComponent('actor',{type:'AnimationDriverPlayback3D'});w.addComponent('actor',{type});
    f.r.sync(w.readView());expect(f.models.rejectDriver).toHaveBeenCalledOnce();expect(f.models.applyAnim).not.toHaveBeenCalled();expect(f.models.applyGraph).not.toHaveBeenCalled();expect(f.models.applyDriver).not.toHaveBeenCalled();expect(f.models.applyLocomotionDriver).not.toHaveBeenCalled();f.r.destroy();
  });
  it.each(['AnimationPerformance3D','AnimationPerformancePlayback3D','AnimationPerformanceCommand3D'])('rejects raw orphan %s before applying a legacy base',type=>{
    const w=world(),f=renderer();w.addComponent('actor',{type:'AnimState3D',clip:'legacy'});w.addComponent('actor',{type});f.r.sync(w.readView());expect(f.models.rejectDriver).toHaveBeenCalledOnce();expect(f.models.applyAnim).not.toHaveBeenCalled();expect(f.models.applyAnimationPerformance).not.toHaveBeenCalled();f.r.destroy();
  });
  it('keeps a pure legacy AnimState route unchanged when no versioned ownership marker exists',()=>{
    const w=world(),f=renderer();w.addComponent('actor',{type:'AnimState3D',clip:'legacy'});f.r.sync(w.readView());expect(f.models.rejectDriver).not.toHaveBeenCalled();expect(f.models.applyAnim).toHaveBeenCalledOnce();f.r.destroy();
  });
  it.each(['AnimState3D','AnimGraph3D','AnimationDriver3D','AnimationDriverPlayback3D','AnimationDriverCommand3D'])('rejects raw %s plus locomotion before it can fall back to a legacy mixer',type=>{
    const w=world(),f=renderer();
    // Deliberately malformed raw construction: exclusivity must precede parsing
    // either graph, and must not let a legacy component gain playback authority.
    w.addComponent('actor',{type:'LocomotionDriver3D',version:1});w.addComponent('actor',{type:'LocomotionPlayback3D',version:1,playback:{},events:[]});w.addComponent('actor',{type});
    f.r.sync(w.readView());expect(f.models.rejectDriver).toHaveBeenCalledOnce();expect(f.models.applyAnim).not.toHaveBeenCalled();expect(f.models.applyGraph).not.toHaveBeenCalled();expect(f.models.applyDriver).not.toHaveBeenCalled();expect(f.models.applyLocomotionDriver).not.toHaveBeenCalled();f.r.destroy();
  });
});
