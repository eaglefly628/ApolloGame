import {t} from '../../core/schema.js';
import {validateDriverTree} from './animation-driver.js';
import type {Component} from '../../core/types.js';
/** Q10000 metres, Y-up; +Z forward and positive yaw toward +X, 65536/turn.
 * Y is exclusively motor-owned. This component is not registered by this module. */
export interface RootMotionPointQ {readonly x:number;readonly z:number}
export interface RootMotionCursor {readonly cycle:number;readonly subtick:number}
export interface RootMotionPose {readonly positionQ:RootMotionPointQ;readonly yawUnits:number}
export interface RootMotionAnchor extends RootMotionPose {readonly id:string}
export interface RootMotion3D extends Component {
 readonly type:'RootMotion3D';readonly version:1;
 readonly sourceSha256:string;readonly inPlaceClipSha256:string;
 readonly carrier:{readonly policy:'hips-linear-xz-v1'|'root-bone-xz-yaw-v1';readonly bone:string;readonly vertical:'motor'};
 readonly tickRate:number;readonly durationSubticks:number;
 readonly loop:'once'|'repeat';readonly endpointPolicy:'accumulate-se2';
 readonly samples:readonly {readonly atSubtick:number;readonly positionQ:RootMotionPointQ;readonly yawUnits:number}[];
 readonly limits:{readonly maxDeltaQ:number;readonly maxYawDeltaUnits:number;readonly maxCyclesPerStep:number};
 /** Once-only window. The host supplies one immutable sim anchor at window start.
  * Unsupported/missed starts reject; bounds reject rather than silently clamp. */
 readonly warp?:{readonly startSubtick:number;readonly endSubtick:number;readonly maxCorrectionQ:number;readonly maxYawCorrectionUnits:number};
}
export interface RootMotionInput {
 readonly actorId:string;readonly instance:number;readonly epoch:number;readonly driverTick:number;
 readonly cursor:RootMotionCursor;readonly mode:'advance'|'seek';readonly pose:RootMotionPose;
 readonly anchor?:RootMotionAnchor;
}
export interface RootMotionRequest {
 readonly requestId:string;readonly actorId:string;readonly instance:number;readonly epoch:number;readonly driverTick:number;
 readonly deltaQ:RootMotionPointQ;readonly yawDeltaUnits:number;
}
export interface RootMotionFeedback {
 readonly requestId:string;readonly actorId:string;readonly instance:number;readonly epoch:number;readonly driverTick:number;
 readonly acceptedDeltaQ:RootMotionPointQ;readonly acceptedYawDeltaUnits:number;readonly blocked:boolean;
}
export interface RootMotionWarpState {readonly anchor:RootMotionAnchor;readonly startPose:RootMotionPose}
export interface RootMotionPlayback3D extends Component {
 readonly type:'RootMotionPlayback3D';readonly version:1;readonly configCanonical:string;
 readonly actorId:string;readonly instance:number;readonly epoch:number;readonly lastDriverTick:number;
 readonly cursor:RootMotionCursor;readonly remainderMicroQ:RootMotionPointQ;readonly pose?:RootMotionPose;
 readonly warp?:RootMotionWarpState;
 readonly pending?:{readonly input:RootMotionInput;readonly request:RootMotionRequest};
 readonly lastFeedback?:RootMotionFeedback;
}

/** Assembly pairs this with RootMotion3D and exactly one real authoritative source.
 * No independent root clock. Shape validation does not resolve these references. */
export interface RootMotionSource3D extends Component {
 readonly type:'RootMotionSource3D';readonly version:1;
 readonly driver:{readonly kind:'animation-driver';readonly clip:string}|{readonly kind:'performance-slot';readonly slot:string;readonly clip:string};
 readonly warpAnchorId?:string;
}
function sourceFields(value:unknown,required:string[],optional:string[]=[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('RootMotionSource3D: object required');const r=value as Record<string,unknown>;
 if(required.some(k=>!Object.hasOwn(r,k))||Object.keys(r).some(k=>!required.includes(k)&&!optional.includes(k)))throw new Error('RootMotionSource3D: closed fields');return r;
}
function sourceId(value:unknown):void{if(typeof value!=='string'||value.length<1||value.length>128)throw new Error('RootMotionSource3D: reference id');}
export function validateRootMotionSource3D(value:unknown):RootMotionSource3D{
 validateDriverTree(value);const r=sourceFields(value,['type','version','driver'],['warpAnchorId']);if(r.type!=='RootMotionSource3D'||r.version!==1)throw new Error('RootMotionSource3D: type/version');
 const driver=sourceFields(r.driver,['kind','clip'],['slot']);sourceId(driver.clip);
 if(driver.kind==='animation-driver'){if(Object.hasOwn(driver,'slot'))throw new Error('RootMotionSource3D: animation driver has no slot');}
 else if(driver.kind==='performance-slot'){sourceFields(r.driver,['kind','slot','clip']);sourceId(driver.slot);}
 else throw new Error('RootMotionSource3D: driver kind');if(Object.hasOwn(r,'warpAnchorId'))sourceId(r.warpAnchorId);return value as RootMotionSource3D;
}
const pointSchema=t.obj({x:t.num(),z:t.num()}),cursorSchema=t.obj({cycle:t.num(),subtick:t.num()}),poseSchema=t.obj({positionQ:pointSchema,yawUnits:t.num()}),anchorSchema=t.obj({id:t.entity(),positionQ:pointSchema,yawUnits:t.num()});
const requestSchema=t.obj({requestId:t.str(),actorId:t.entity(),instance:t.num(),epoch:t.num(),driverTick:t.num(),deltaQ:pointSchema,yawDeltaUnits:t.num()});
const feedbackSchema=t.obj({requestId:t.str(),actorId:t.entity(),instance:t.num(),epoch:t.num(),driverTick:t.num(),acceptedDeltaQ:pointSchema,acceptedYawDeltaUnits:t.num(),blocked:t.bool()});
const inputSchema=t.obj({actorId:t.entity(),instance:t.num(),epoch:t.num(),driverTick:t.num(),cursor:cursorSchema,mode:t.enum(['advance','seek']),pose:poseSchema,anchor:t.opt(anchorSchema)});
/** Structural provider schemas. Semantic validators enforce integers, bounds,
 * source pairing and deterministic request projection; no permissive any fields. */
export const ROOT_MOTION_SCHEMAS={
 RootMotion3D:t.obj({version:t.lit(1),sourceSha256:t.str(),inPlaceClipSha256:t.str(),carrier:t.obj({policy:t.enum(['hips-linear-xz-v1','root-bone-xz-yaw-v1']),bone:t.str(),vertical:t.lit('motor')}),tickRate:t.num(),durationSubticks:t.num(),loop:t.enum(['once','repeat']),endpointPolicy:t.lit('accumulate-se2'),samples:t.arr(t.obj({atSubtick:t.num(),positionQ:pointSchema,yawUnits:t.num()})),limits:t.obj({maxDeltaQ:t.num(),maxYawDeltaUnits:t.num(),maxCyclesPerStep:t.num()}),warp:t.opt(t.obj({startSubtick:t.num(),endSubtick:t.num(),maxCorrectionQ:t.num(),maxYawCorrectionUnits:t.num()}))}),
 RootMotionSource3D:t.obj({version:t.lit(1),driver:t.union([t.obj({kind:t.lit('animation-driver'),clip:t.str()}),t.obj({kind:t.lit('performance-slot'),slot:t.str(),clip:t.str()})],'kind'),warpAnchorId:t.opt(t.entity())}),
 RootMotionPlayback3D:t.obj({version:t.lit(1),configCanonical:t.str(),actorId:t.entity(),instance:t.num(),epoch:t.num(),lastDriverTick:t.num(),cursor:cursorSchema,remainderMicroQ:pointSchema,pose:t.opt(poseSchema),warp:t.opt(t.obj({anchor:anchorSchema,startPose:poseSchema})),pending:t.opt(t.obj({input:inputSchema,request:requestSchema})),lastFeedback:t.opt(feedbackSchema)})
} as const;
