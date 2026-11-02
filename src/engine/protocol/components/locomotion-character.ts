/** Optional exact target binding. Calibration status is declared metadata;
 * browser runtime validates identity only, never offline review receipts. */
import type {Component} from '../../core/types.js';
import type {LocomotionCharacter3D as Binding} from '../../animation/locomotion-character.js';
export interface LocomotionCharacter3D extends Component,Binding {readonly type:'LocomotionCharacter3D'}
export {validateLocomotionCharacter3D} from '../../animation/locomotion-character.js';
import {t} from '../../core/schema.js';
export const LOCOMOTION_CHARACTER_SCHEMAS={LocomotionCharacter3D:t.obj({version:t.lit(1),profileSha256:t.str(),target:t.obj({skinSha256:t.str(),selector:t.obj({modelKey:t.asset('model'),nodeIndex:t.any('null or integer 0..100000; closed imperative validator required'),excludeNodes:t.arr(t.num()),origin:t.arr(t.num()),scale:t.num()}),effectiveScale:t.num(),restSha256:t.str()}),retarget:t.obj({policy:t.lit('humanoid-v1'),sources:t.arr(t.obj({asset:t.asset('skeletal-animation'),sourceSha256:t.str(),restSha256:t.str(),hipRatio:t.num()}))}),calibration:t.obj({artifactSha256:t.str(),status:t.enum(['unreviewed','reviewed']),scope:t.lit('target-specific-locomotion')})})} as const;
