import * as THREE from 'three';
import {AnimationDriverPoseSampler,type DriverPoseClip} from './animation-driver-pose.js';
import type {PerformancePoseLayer} from '@engine/animation/performance-driver.js';
interface LocalPose {position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3}
const pose=(b:THREE.Object3D):LocalPose=>({position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()});
function bones(root:THREE.Object3D):Map<string,THREE.Bone>{const result=new Map<string,THREE.Bone>();root.traverse(n=>{if(!(n as THREE.Bone).isBone)return;if(result.has(n.name))throw Error('AnimationPerformance3D: ambiguous target bone '+n.name);result.set(n.name,n as THREE.Bone);});return result;}
/** Isolated clone, independent native actions, explicit local masked composition.
 * The clone must be the same selected target skeleton at its captured static rest;
 * bound clip UUID tracks address that clone, never the visible actor. */
export class AnimationPerformancePoseSampler {
 private readonly target:Map<string,THREE.Bone>;private readonly sampleBones:Map<string,THREE.Bone>;
 private readonly native:AnimationDriverPoseSampler;private readonly lastBase=new Map<string,LocalPose>();private readonly staticPose=new Map<string,LocalPose>();
 private disposed=false;private signature?:string;
 constructor(private readonly root:THREE.Object3D,private readonly samplingRoot:THREE.Object3D,tickRate:number,clips:ReadonlyMap<string,DriverPoseClip>,masks:readonly(readonly string[])[]){
  this.target=bones(root);this.sampleBones=bones(samplingRoot);
  for(const mask of masks)for(const name of mask)if(!this.target.has(name)||!this.sampleBones.has(name))throw Error('AnimationPerformance3D: missing mask bone '+name);
  for(const[name,b]of this.sampleBones)this.staticPose.set(name,pose(b));
  this.native=new AnimationDriverPoseSampler(samplingRoot,tickRate,clips);
 }
 /** Restore before any base mixer binds or samples. This also removes last IK
  * edits and prevents an overlay becoming the next base action's original pose. */
 restoreBase():void{if(this.disposed)return;for(const[name,p]of this.lastBase){const b=this.target.get(name)!;b.position.copy(p.position);b.quaternion.copy(p.quaternion);b.scale.copy(p.scale);}this.root.updateMatrixWorld(true);}
 private sample(clip:string,timeSeconds:number):Map<string,LocalPose>{
  for(const[name,p]of this.staticPose){const b=this.sampleBones.get(name)!;b.position.copy(p.position);b.quaternion.copy(p.quaternion);b.scale.copy(p.scale);}
  this.native.sample([{clip,timeSeconds,weight:1}]);return new Map([...this.sampleBones].map(([name,b])=>[name,pose(b)]));
 }
 apply(layers:readonly PerformancePoseLayer[]):{changed:boolean}{
  if(this.disposed)throw Error('AnimationPerformance3D: sampler disposed');
  // Sample/validate all inputs before mutating any visible bone.
  const groups=new Map<string,{layer:PerformancePoseLayer;pose:Map<string,LocalPose>;reference?:Map<string,LocalPose>}[]>();
  for(const layer of layers){if(!Number.isInteger(layer.weightQ)||layer.weightQ<0||layer.weightQ>1000000)throw Error('AnimationPerformance3D: invalid layer weight');if(!layer.weightQ)continue;
   if(layer.mode==='additive'&&!layer.reference)throw Error('AnimationPerformance3D: additive reference required');
   const sampled=this.sample(layer.clip,layer.timeSeconds),reference=layer.reference?this.sample(layer.reference.clip,layer.reference.timeSeconds):undefined;
   for(const name of layer.bones){if(!this.target.has(name)||!sampled.has(name))throw Error('AnimationPerformance3D: missing mask bone '+name);if(reference){const a=sampled.get(name)!,b=reference.get(name);if(!b||[...a.scale.toArray(),...b.scale.toArray()].some(n=>!Number.isFinite(n)||n<=1e-8))throw Error('AnimationPerformance3D: incompatible additive scale/reference');}}
   const group=groups.get(layer.slot)??[];group.push({layer,pose:sampled,reference});groups.set(layer.slot,group);
  }
  const ordered=[...groups.values()].sort((a,b)=>a[0].layer.order-b[0].layer.order);
  for(const group of ordered){const first=group[0].layer,total=group.reduce((n,g)=>n+g.layer.weightQ,0);if(group.length>2||total>1000000||group.some(g=>g.layer.mode!==first.mode||g.layer.order!==first.order||JSON.stringify(g.layer.bones)!==JSON.stringify(first.bones)))throw Error('AnimationPerformance3D: incompatible slot composition');if(first.mode==='additive'&&group.some(g=>g.layer.reference?.clip!==first.reference?.clip||g.layer.reference?.timeSeconds!==first.reference?.timeSeconds))throw Error('AnimationPerformance3D: slot reference mismatch');}
  this.lastBase.clear();for(const[name,b]of this.target)this.lastBase.set(name,pose(b));
  // Each slot: normalize its outgoing/incoming pose first, then apply ONCE to base.
  for(const group of ordered){const first=group[0].layer,total=group.reduce((n,g)=>n+g.layer.weightQ,0),alpha=total/1000000;
   for(const name of first.bones){const bone=this.target.get(name)!,a=group[0].pose.get(name)!,mixed={position:a.position.clone(),quaternion:a.quaternion.clone(),scale:a.scale.clone()};
    if(group.length===2){const b=group[1].pose.get(name)!,t=group[1].layer.weightQ/total;mixed.position.lerp(b.position,t);mixed.quaternion.slerp(b.quaternion,t);mixed.scale.lerp(b.scale,t);}
    if(first.mode==='override'){bone.position.lerp(mixed.position,alpha);bone.quaternion.slerp(mixed.quaternion,alpha);bone.scale.lerp(mixed.scale,alpha);}
    else{const reference=group[0].reference!.get(name)!;
     bone.position.addScaledVector(mixed.position.clone().sub(reference.position),alpha);
     const delta=reference.quaternion.clone().invert().multiply(mixed.quaternion).normalize();bone.quaternion.multiply(new THREE.Quaternion().slerp(delta,alpha)).normalize();
     bone.scale.multiply(new THREE.Vector3(1,1,1).lerp(mixed.scale.clone().divide(reference.scale),alpha));
    }
   }
  }
  this.root.updateMatrixWorld(true);const signature=JSON.stringify(layers),changed=signature!==this.signature;this.signature=signature;return{changed};
 }
 dispose():void{if(this.disposed)return;this.restoreBase();this.disposed=true;this.native.dispose();const skeletons=new Set<THREE.Skeleton>();this.samplingRoot.traverse(n=>{if((n as THREE.SkinnedMesh).skeleton)skeletons.add((n as THREE.SkinnedMesh).skeleton);});for(const s of skeletons)s.dispose();this.lastBase.clear();this.staticPose.clear();}
}
