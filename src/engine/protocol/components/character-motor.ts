import type {Component} from '../../core/types.js';
import type {CharacterMotorConfigV1,CharacterMotorStateV1,CharacterMotorMove,CharacterMotorStepResult} from '../../spatial/character-motor.js';
import type {LocomotionMotorFacts} from '../../animation/locomotion-facts.js';

/** A new movement authority. Legacy Velocity/GroundWalker are not a second input.
 * Position is meters in projection and Q10000 in state; yaw +Z -> +X.
 */
export interface CharacterMotor3D extends Component {
 readonly type:'CharacterMotor3D';readonly version:1;
 readonly motion:CharacterMotorConfigV1;
 readonly initial:{readonly positionQ:{readonly x:number;readonly y:number;readonly z:number};readonly stance:'standing'|'crouched';readonly yawUnits:number};
 readonly maxTurnUnitsPerSecond:number;
}
export interface CharacterMotorIntent3D extends Component {
 readonly type:'CharacterMotorIntent3D';readonly version:1;
 readonly move?:CharacterMotorMove;
 readonly jump?:{readonly seq:number};
 readonly facing?:{readonly seq:number;readonly mode:'move'|'direction';readonly xQ:number;readonly zQ:number};
}
export interface CharacterMotorPlayback3D extends Component {
 readonly type:'CharacterMotorPlayback3D';readonly version:1;readonly configCanonical:string;
 readonly motor:CharacterMotorStateV1;
 readonly yawUnits:number;readonly yawRemainder:number;readonly lastFacingSeq:number;
 readonly facing:{readonly mode:'move'|'direction';readonly xQ:number;readonly zQ:number};
 readonly facts:LocomotionMotorFacts;
 readonly result:CharacterMotorStepResult['result'];
 readonly events:readonly {readonly kind:'jump'|'land';readonly id:string;readonly instance:number;readonly obstacleId?:string;readonly impactSpeedQps?:number}[];
}
