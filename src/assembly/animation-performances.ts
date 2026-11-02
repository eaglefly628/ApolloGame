import {validateDriverTree,validateAnimationDriver3D} from '@engine/protocol/components/animation-driver.js';
import {validateAnimationPerformance3D,validateAnimationPerformancePlayback3D,validateAnimationPerformanceCommand3D} from '@engine/protocol/components/animation-performance.js';
import {compileLocomotionDriver3D} from '@engine/animation/locomotion-driver.js';
import {animationDriverData} from './animation-drivers.js';
const types=['AnimationPerformance3D','AnimationPerformancePlayback3D','AnimationPerformanceCommand3D'];
/** Structural pairing and common clock only. Asset bytes, masks against actual
 * skeletons and additive reference readiness are renderer validation gates. */
export function validateAnimationPerformances(entities:Record<string,unknown>,tickRate?:number):void {
 const rows=Object.entries(Object.getOwnPropertyDescriptors(entities));
 if(!rows.some(([,d])=>'value'in d&&d.value&&typeof d.value==='object'&&types.some(t=>Object.hasOwn(d.value,t))))return;
 validateDriverTree(entities);
 for(const[id,d]of rows){const row=d.value as Record<string,unknown>;if(!row||typeof row!=='object'||!types.some(t=>Object.hasOwn(row,t)))continue;
  try{
   if(!Object.hasOwn(row,'AnimationPerformance3D'))throw Error('orphan performance playback/command');
   const c=validateAnimationPerformance3D(animationDriverData(row.AnimationPerformance3D,'AnimationPerformance3D'));
   if(tickRate!==undefined&&c.tickRate!==tickRate)throw Error('performance/Engine clock mismatch');
   const hasD1=Object.hasOwn(row,'AnimationDriver3D'),hasLoco=Object.hasOwn(row,'LocomotionDriver3D');
   if(hasD1===hasLoco)throw Error('exactly one authoritative D1 or locomotion base required');
   for(const old of ['AnimGraph3D','AnimState3D'])if(Object.hasOwn(row,old))throw Error('legacy animation ownership conflict');
   const base=hasD1?validateAnimationDriver3D(animationDriverData(row.AnimationDriver3D,'AnimationDriver3D')):compileLocomotionDriver3D(animationDriverData(row.LocomotionDriver3D,'LocomotionDriver3D')).configuration;
   if(base.tickRate!==c.tickRate)throw Error('base/performance clock mismatch');
   const model=animationDriverData(row.Model3D,'Model3D');if(typeof model.modelKey!=='string'||!model.modelKey.trim())throw Error('Model3D required');
   if(Object.hasOwn(row,'AnimationPerformanceCommand3D'))validateAnimationPerformanceCommand3D(c,animationDriverData(row.AnimationPerformanceCommand3D,'AnimationPerformanceCommand3D'));
   if(Object.hasOwn(row,'AnimationPerformancePlayback3D')){
    const p=validateAnimationPerformancePlayback3D(c,animationDriverData(row.AnimationPerformancePlayback3D,'AnimationPerformancePlayback3D'));
    if(p.actorId!==id)throw Error('snapshot actor identity mismatch');
    const basePlayback=row[hasD1?'AnimationDriverPlayback3D':'LocomotionPlayback3D'];
    if(!basePlayback)throw Error('performance restore requires base playback');
   }
  }catch(error){throw Error(`animation-performance: ${id}: ${error instanceof Error?error.message:String(error)}`);}
 }
}
