import * as THREE from 'three';
import {AnimationGraphController} from '../../src/renderer/three/animation-graph.js';
import{describe,it,expect}from'vitest';
import{runtimeSocketProfile,socketControlData,socketAnimationGraph,type RuntimeSocketProfile}from'./runtime-controls.js';
const profile=():RuntimeSocketProfile=>({clipId:'clip',effectorBone:'RightTip',targetBone:'LeftContact',rightChain:{kind:'two-bone',root:'RightUpperArm',mid:'RightLowerArm',end:'RightTip',target:{entity:'actor',bone:'LeftContact',offset:[0,0,0]},weight:1},leftMoverChain:{kind:'two-bone',root:'LeftUpperArm',mid:'LeftLowerArm',end:'LeftHand',target:{entity:'SocketLeftHandMover',offset:[0,0,0]},weight:1},initialLeftHandWorldM:[.1,1,.3],embeddedSkinSha256:'a'.repeat(64),props:[],skinBounds:[[-1,0,-1],[1,2,1]],coordinateSpace:'model-space metres before optional display normalization'});
describe('data-only live Socket interaction controls',()=>{
 it('builds ordered left-mover/right-contact constraints from this Skin calibration',()=>{const p=profile(),a=socketControlData(p,2,[.03,0,0],true,.22);expect(a.target).toEqual({type:'Transform3D',x:.23,y:2,z:.6});expect(a.ik.chains.map(c=>c.weight)).toEqual([1,1]);expect(a.ik.chains[1].target.bone).toBe('LeftContact');expect(p.rightChain.weight).toBe(1);});
 it('lets the unshifted left hand follow the base clip and can disable live right IK for comparison',()=>{expect(socketControlData(profile(),1,[0,0,0],false,.22).ik.chains.map(c=>c.weight)).toEqual([0,0]);});
 it('rejects a profile from another Skin or invalid movement',()=>{const p=profile(),report={runtimeSockets:{version:1,bySkin:{skin:p}}};expect(runtimeSocketProfile(report,{id:'skin',sha256:'a'.repeat(64)})).toBe(p);expect(()=>runtimeSocketProfile(report,{id:'skin',sha256:'b'.repeat(64)})).toThrow();expect(()=>socketControlData(p,1,[.2,0,0],true,.22)).toThrow();expect(()=>socketControlData(p,1,[0,0,0],true,.5)).toThrow();});
});

it('releases contact and attention outside the interaction state',()=>{const d=socketControlData(profile(),1,[.03,0,0],true,.22,false);expect(d.ik.chains.map(c=>c.weight)).toEqual([0,0]);expect(d.ik.lookAt?.weight).toBe(0);const graph=socketAnimationGraph('source');expect(graph.params.interaction).toBe('flag:socket-interacting');expect(graph.transitions.map(t=>[t.from,t.to,t.value])).toEqual([['idle','interact',true],['interact','idle',false]]);expect(graph.clips.idle.speed).toBe(0);});

it('native graph enters interaction, plays, then returns to the still pose from a Flag parameter',()=>{
 const root=new THREE.Group(),bone=new THREE.Bone();bone.name='Hand';root.add(bone);
 const clip=new THREE.AnimationClip('source',1,[new THREE.VectorKeyframeTrack('Hand.position',[0,1],[0,0,0,1,0,0])]);
 const graph=socketAnimationGraph('source');graph.clips.motion.speed=1;
 const controller=new AnimationGraphController(root,graph,new Map([['idle',{clip,loop:true}],['motion',{clip,loop:true}]]));
 controller.update(0,{interaction:false});expect(bone.position.x).toBe(0);
 controller.update(.2,{interaction:true});controller.update(.2,{interaction:true});expect(controller.debug.state).toBe('interact');expect(bone.position.x).toBeGreaterThan(.1);
 controller.update(.2,{interaction:false});controller.update(.2,{interaction:false});expect(controller.debug.state).toBe('idle');expect(bone.position.x).toBeCloseTo(0);controller.dispose();
});
