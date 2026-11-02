import * as THREE from 'three';
import {bindSkeletalClip,type SkeletalClip,type SkeletonRest} from './skeletal-clips.js';
/** D3 never guesses a retarget mode. Exact retains the complete authored TRS;
 * humanoid M1 transfers rotations/Hips position only. Rest-valued redundant
 * channels are safe, but animated or non-rest unsupported channels must reject. */
export function bindPerformanceClip(source:SkeletalClip,clipName:string,target:THREE.Object3D,targetRest:SkeletonRest,retarget:'exact'|'humanoid'):THREE.AnimationClip {
 if(retarget==='exact')return bindSkeletalClip(source,clipName,target,targetRest);
 if(retarget!=='humanoid')throw Error('AnimationPerformance3D: explicit retarget exact|humanoid required');
 for(const t of source.tracks){
  if(t.property==='quaternion'||(t.bone==='Hips'&&t.property==='position'))continue;
  const rest=source.rest.bones.get(t.bone);if(!rest)throw Error('AnimationPerformance3D: source rest bone missing '+t.bone);
  const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();new THREE.Matrix4().fromArray(rest.local).decompose(position,rotation,scale);
  const expected=(t.property==='scale'?scale:position).toArray();
  const values=Array.from(t.track.values);
  const animated=values.some((v,i)=>v!==values[i%3]);
  if(t.track.getValueSize()!==3||animated||values.some((v,i)=>Math.abs(v-expected[i%3])>1e-5*Math.max(1,Math.abs(expected[i%3]))))throw Error(`AnimationPerformance3D: humanoid refuses animated/non-rest ${t.bone}.${t.property}; use exact or offline normalization`);
 }
 return bindSkeletalClip(source,clipName,target,targetRest,'humanoid');
}
