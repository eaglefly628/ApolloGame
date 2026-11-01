import {validateDriverTree} from '@engine/protocol/components/animation-driver.js';
import {compileLocomotionDriver3D, type LocomotionDriver3D} from '@engine/animation/locomotion-driver.js';
import {validateLocomotionPlayback3D, validateLocomotionCommand3D} from '@engine/animation/locomotion-envelope.js';
import {validateCharacterMotor3D, validateCharacterMotorPlayback3D} from '@engine/spatial/character-motor-driver.js';

const TYPES = ['LocomotionDriver3D', 'LocomotionPlayback3D', 'LocomotionCommand3D'] as const;
const EXCLUSIVE = ['AnimationDriver3D', 'AnimationDriverPlayback3D', 'AnimationDriverCommand3D', 'AnimGraph3D', 'AnimState3D'] as const;
const own = (v:object,k:string):boolean => Object.hasOwn(v,k);
function fail(s:string):never { throw new Error(`locomotion-drivers: ${s}`); }
function record(v:unknown):v is Record<string,unknown> {return v!==null && typeof v==='object' && !Array.isArray(v);}
function normalize(value:unknown,type:string):unknown {
  if(!record(value)) fail(`${type}: component object required`);
  if(own(value,'type') && value.type!==type) fail(`${type}: conflicting component type`);
  return {...JSON.parse(JSON.stringify(value)),type};
}
/** Pure full-batch structural validation. Asset bytes, retargeting and foot quality
 * are deliberately not certified by declared asset keys, hashes or calibration labels.
 * Motor scene/projection validation remains the separate motor assembly boundary.
 */
export function validateLocomotionDrivers(entities:Record<string,unknown>,tickRate?:number):void {
  if(!record(entities)) fail('entities object required');
  const rows:Array<[string,Record<string,unknown>]> = [];
  for(const [id,d] of Object.entries(Object.getOwnPropertyDescriptors(entities))) {
    if(!('value' in d)) fail(`${id}: entity accessor is not data`);
    if(record(d.value)) rows.push([id,d.value]);
  }
  const involved=rows.filter(([,row])=>TYPES.some(t=>own(row,t)));
  if(!involved.length) return;
  validateDriverTree(entities);
  for(const [id,d] of Object.entries(Object.getOwnPropertyDescriptors(entities))) if(!record(d.value)) fail(`${id}: entity component map required`);
  if(tickRate!==undefined && (!Number.isInteger(tickRate)||tickRate<1||tickRate>240)) fail('Engine tickRate must be integer 1..240');
  for(const [id,row] of involved) {
    try {
      if(!own(row,'LocomotionDriver3D')) fail('orphan playback/command requires LocomotionDriver3D');
      for(const type of EXCLUSIVE) if(own(row,type)) fail(`${type} conflicts with locomotion animation authority`);
      if(!own(row,'CharacterMotor3D')) fail('CharacterMotor3D required');
      const motor=validateCharacterMotor3D(normalize(row.CharacterMotor3D,'CharacterMotor3D'));
      const model=normalize(row.Model3D,'Model3D') as Record<string,unknown>;
      if(typeof model.modelKey!=='string'||!model.modelKey.trim()) fail('nonempty Model3D.modelKey required');
      const config=normalize(row.LocomotionDriver3D,'LocomotionDriver3D') as LocomotionDriver3D;
      const compiled=compileLocomotionDriver3D(config);
      if(config.tickRate!==motor.motion.tickRate || (tickRate!==undefined && config.tickRate!==tickRate)) fail('locomotion/motor/Engine tickRate mismatch');
      if(own(row,'LocomotionCommand3D')) validateLocomotionCommand3D(normalize(row.LocomotionCommand3D,'LocomotionCommand3D'));
      if(own(row,'LocomotionPlayback3D')) {
        if(!own(row,'CharacterMotorPlayback3D')||!own(row,'CharacterMotorEnvironment3D')) fail('locomotion snapshot requires motor playback/environment pair');
        const mp=validateCharacterMotorPlayback3D(motor,normalize(row.CharacterMotorPlayback3D,'CharacterMotorPlayback3D'));
        const env=normalize(row.CharacterMotorEnvironment3D,'CharacterMotorEnvironment3D') as Record<string,unknown>;
        if(env.version!==1 || Object.keys(env).sort().join(',')!=='staticSceneCanonical,type,version' || typeof env.staticSceneCanonical!=='string') fail('invalid motor environment shape');
        const lp=validateLocomotionPlayback3D(compiled,normalize(row.LocomotionPlayback3D,'LocomotionPlayback3D')).playback;
        if(lp.lastFactsSeq!==mp.motor.tick) fail('lastFactsSeq must equal motor tick');
        if(lp.seenJumpInstance>mp.motor.jumpInstance||lp.seenLandingInstance>mp.motor.landingInstance) fail('locomotion counters exceed motor counters');
      }
    } catch(error) {throw new Error(`locomotion-drivers: ${id}: ${error instanceof Error?error.message:String(error)}`);}
  }
}
