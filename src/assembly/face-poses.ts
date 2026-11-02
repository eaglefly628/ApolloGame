import {validateFacePose3D} from '@engine/protocol/components/face-pose.js';
import {validateDriverTree} from '@engine/protocol/components/animation-driver.js';
import {validateAnimationPerformance3D} from '@engine/protocol/components/animation-performance.js';
import {animationDriverData} from './animation-drivers.js';
/** Structural references only. Actual mesh/morph existence is a native asset gate. */
export function validateFacePoses(entities:Record<string,unknown>):void {
 const rows=Object.entries(Object.getOwnPropertyDescriptors(entities));
 if(!rows.some(([,d])=>'value'in d&&d.value&&typeof d.value==='object'&&Object.hasOwn(d.value,'FacePose3D')))return;
 validateDriverTree(entities);
 for(const[id,d]of rows){const row=d.value as Record<string,unknown>;if(!row||typeof row!=='object'||!Object.hasOwn(row,'FacePose3D'))continue;
  try{
   const config=validateFacePose3D(animationDriverData(row.FacePose3D,'FacePose3D'));
   const model=animationDriverData(row.Model3D,'Model3D');if(typeof model.modelKey!=='string'||!model.modelKey.trim())throw Error('Model3D required');
   for(const channel of Object.values(config.channels))if(typeof channel.weight!=='number'){
    const performance=validateAnimationPerformance3D(animationDriverData(row.AnimationPerformance3D,'AnimationPerformance3D'));
    if(!Object.hasOwn(performance.slots,channel.weight.slot))throw Error(`missing performance slot ${channel.weight.slot}`);
   }
  }catch(error){throw Error(`face-pose: ${id}: ${String(error)}`);}
 }
}
