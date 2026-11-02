/** D4 pure request/accepted-feedback core. No World, renderer, physics mutation or I/O.
 * Hosts commit pending + motor + accepted state atomically; never add this delta twice.
 */
import {validateDriverTree} from '../protocol/components/animation-driver.js';
import {yawDirectionQ} from './yaw-fixed.js';
import type {RootMotion3D,RootMotionPointQ,RootMotionCursor,RootMotionPose,RootMotionAnchor,RootMotionInput,RootMotionRequest,RootMotionFeedback,RootMotionPlayback3D,RootMotionWarpState} from '../protocol/components/root-motion.js';
export type {RootMotion3D,RootMotionInput,RootMotionRequest,RootMotionFeedback,RootMotionPlayback3D} from '../protocol/components/root-motion.js';
const MICRO=1000000n,TURN=65536,MAX_TIME=1000000000;
const zero=():RootMotionPointQ=>({x:0,z:0});
function fail(s:string):never{throw new Error('RootMotion3D: '+s);}
function int(v:unknown,min:number,max:number):asserts v is number{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)fail('integer range');}
function fields(v:unknown,required:string[],optional:string[]=[]):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))fail('object');const r=v as Record<string,unknown>;if(required.some(k=>!Object.hasOwn(r,k))||Object.keys(r).some(k=>!required.includes(k)&&!optional.includes(k)))fail('closed fields');return r;}
function identity(v:unknown):string{if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(identity).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+identity((v as Record<string,unknown>)[k])).join(',')+'}';}
function clone<T>(v:T):T{return JSON.parse(identity(v)) as T;}
function id(v:unknown):asserts v is string{if(typeof v!=='string'||v.length<1||v.length>128)fail('id');}
function point(v:unknown,bound=1000000000):asserts v is RootMotionPointQ{const r=fields(v,['x','z']);int(r.x,-bound,bound);int(r.z,-bound,bound);}
function pose(v:unknown):asserts v is RootMotionPose{const r=fields(v,['positionQ','yawUnits']);point(r.positionQ);int(r.yawUnits,0,65535);}
function anchor(v:unknown):asserts v is RootMotionAnchor{const r=fields(v,['id','positionQ','yawUnits']);id(r.id);point(r.positionQ);int(r.yawUnits,0,65535);}
function wrap(y:number):number{return ((y%TURN)+TURN)%TURN;}
function yawError(to:number,from:number):number{const v=wrap(to-from+32768)-32768;return v===-32768?32768:v;}
function lengthWithin(p:RootMotionPointQ,b:number):boolean{return BigInt(p.x)**2n+BigInt(p.z)**2n<=BigInt(b)**2n;}
function round(n:bigint,d:bigint):bigint{return n<0n?-((-n+d/2n)/d):(n+d/2n)/d;}
function safe(n:bigint):number{const v=Number(n);if(!Number.isSafeInteger(v))fail('arithmetic budget');return v;}
function cursor(c:RootMotion3D,v:unknown):asserts v is RootMotionCursor{const r=fields(v,['cycle','subtick']);int(r.cycle,0,1000000);int(r.subtick,0,c.durationSubticks);if(c.loop==='once'?r.cycle!==0:r.subtick===c.durationSubticks)fail('cursor endpoint convention');}
function time(c:RootMotion3D,v:RootMotionCursor):number{const n=v.cycle*c.durationSubticks+v.subtick;int(n,0,MAX_TIME);return n;}
export function validateRootMotion3D(value:unknown):RootMotion3D{
 validateDriverTree(value);const r=fields(value,['type','version','sourceSha256','inPlaceClipSha256','carrier','tickRate','durationSubticks','loop','endpointPolicy','samples','limits'],['warp']);
 if(r.type!=='RootMotion3D'||r.version!==1||r.endpointPolicy!=='accumulate-se2'||!['once','repeat'].includes(r.loop as string))fail('version/loop');
 for(const h of [r.sourceSha256,r.inPlaceClipSha256])if(typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h))fail('SHA256');
 const carrier=fields(r.carrier,['policy','bone','vertical']);if(!['hips-linear-xz-v1','root-bone-xz-yaw-v1'].includes(carrier.policy as string)||carrier.vertical!=='motor')fail('carrier');id(carrier.bone);if(carrier.policy==='hips-linear-xz-v1'&&carrier.bone!=='Hips')fail('Hips carrier');
 int(r.tickRate,1,240);int(r.durationSubticks,1,36000000);const l=fields(r.limits,['maxDeltaQ','maxYawDeltaUnits','maxCyclesPerStep']);int(l.maxDeltaQ,1,100000000);int(l.maxYawDeltaUnits,0,65536);int(l.maxCyclesPerStep,1,32);
 if(!Array.isArray(r.samples)||r.samples.length<2||r.samples.length>256)fail('sample budget');let previous=-1;
 for(const s of r.samples){const p=fields(s,['atSubtick','positionQ','yawUnits']);int(p.atSubtick,0,r.durationSubticks);if(p.atSubtick<=previous)fail('sample ordering');previous=p.atSubtick;point(p.positionQ,100000000);int(p.yawUnits,-1048576,1048576);if(carrier.policy==='hips-linear-xz-v1'&&p.yawUnits!==0)fail('linear extraction has no yaw');}
 const c=value as RootMotion3D,first=c.samples[0],last=c.samples.at(-1)!;if(first.atSubtick!==0||first.positionQ.x!==0||first.positionQ.z!==0||first.yawUnits!==0||last.atSubtick!==c.durationSubticks)fail('explicit zero/start and duration endpoint');
 if(c.carrier.policy==='hips-linear-xz-v1')for(const s of c.samples)for(const axis of ['x','z']as const)if(BigInt(s.positionQ[axis])*BigInt(c.durationSubticks)!==BigInt(last.positionQ[axis])*BigInt(s.atSubtick))fail('linear extraction curve mismatch');
 if(c.warp){const w=fields(c.warp,['startSubtick','endSubtick','maxCorrectionQ','maxYawCorrectionUnits']);int(w.startSubtick,0,c.durationSubticks-1);int(w.endSubtick,(w.startSubtick as number)+1,c.durationSubticks);int(w.maxCorrectionQ,0,100000000);int(w.maxYawCorrectionUnits,0,32768);if(c.loop!=='once')fail('warp only once clips');}
 return c;
}
function sample(c:RootMotion3D,t:number):{x:bigint;z:bigint;yaw:number}{
 let i=1;while(i<c.samples.length-1&&c.samples[i].atSubtick<t)i++;const a=c.samples[i-1],b=c.samples[i],n=BigInt(t-a.atSubtick),d=BigInt(b.atSubtick-a.atSubtick);
 return{x:BigInt(a.positionQ.x)*MICRO+round(BigInt(b.positionQ.x-a.positionQ.x)*MICRO*n,d),z:BigInt(a.positionQ.z)*MICRO+round(BigInt(b.positionQ.z-a.positionQ.z)*MICRO*n,d),yaw:a.yawUnits+safe(round(BigInt(b.yawUnits-a.yawUnits)*n,d))};
}
/** Uses the EXISTING yaw-fixed Q1e6 basis. BigInt products retain micro-Q residue.
 * Basis interpolation error is inherited, not exact trigonometry (see D4 contract). */
function rotate(x:bigint,z:bigint,yaw:number):{x:bigint;z:bigint}{const d=yawDirectionQ(wrap(yaw)),s=BigInt(d.xQ),co=BigInt(d.zQ);return{x:round(x*co+z*s,MICRO),z:round(-x*s+z*co,MICRO)};}
function native(c:RootMotion3D,from:RootMotionCursor,to:RootMotionCursor,yaw:number,alignment?:number):{x:bigint;z:bigint;yaw:number}{
 let x=0n,z=0n,totalYaw=0,cycle=from.cycle,t=from.subtick;const crossings=to.cycle-cycle;if(crossings<0||crossings>c.limits.maxCyclesPerStep)fail('loop budget/backward advance');
 for(let part=0;part<=crossings;part++){
  const end=cycle===to.cycle?to.subtick:c.durationSubticks,a=sample(c,t),b=sample(c,end),v=rotate(b.x-a.x,b.z-a.z,alignment??(yaw+totalYaw-a.yaw));x+=v.x;z+=v.z;totalYaw+=b.yaw-a.yaw;cycle++;t=0;
 }
 return{x,z,yaw:totalYaw};
}
function warpData(c:RootMotion3D,w:RootMotionWarpState):{x:bigint;z:bigint;yaw:number;alignment:number}{
 if(!c.warp)fail('unexpected warp state');anchor(w.anchor);pose(w.startPose);const a={cycle:0,subtick:c.warp.startSubtick},b={cycle:0,subtick:c.warp.endSubtick},n=native(c,a,b,w.startPose.yawUnits),x=BigInt(w.anchor.positionQ.x-w.startPose.positionQ.x)*MICRO-n.x,z=BigInt(w.anchor.positionQ.z-w.startPose.positionQ.z)*MICRO-n.z,yaw=yawError(w.anchor.yawUnits,wrap(w.startPose.yawUnits+n.yaw));
 if(x*x+z*z>BigInt(c.warp.maxCorrectionQ)**2n*MICRO*MICRO||Math.abs(yaw)>c.warp.maxYawCorrectionUnits)fail('warp correction limit');return{x,z,yaw,alignment:w.startPose.yawUnits-sample(c,c.warp.startSubtick).yaw};
}
function state(c:RootMotion3D,value:unknown,checkPending=true):asserts value is RootMotionPlayback3D{
 validateDriverTree(value);const r=fields(value,['type','version','configCanonical','actorId','instance','epoch','lastDriverTick','cursor','remainderMicroQ'],['pose','warp','pending','lastFeedback']);if(r.type!=='RootMotionPlayback3D'||r.version!==1||r.configCanonical!==identity(c))fail('playback identity');id(r.actorId);int(r.instance,1,1000000000);int(r.epoch,0,1000000000);int(r.lastDriverTick,0,MAX_TIME);cursor(c,r.cursor);time(c,r.cursor as RootMotionCursor);point(r.remainderMicroQ,999999);if(r.pose!==undefined)pose(r.pose);
 if(r.warp!==undefined){fields(r.warp,['anchor','startPose']);warpData(c,r.warp as RootMotionWarpState);if(time(c,r.cursor as RootMotionCursor)<c.warp!.startSubtick)fail('warp lifecycle');}
 if(r.lastFeedback!==undefined){feedback(r.lastFeedback);const f=r.lastFeedback as RootMotionFeedback;if(f.actorId!==r.actorId||f.instance!==r.instance||f.epoch!==r.epoch||f.driverTick!==r.lastDriverTick)fail('feedback lifecycle');}
 if(r.pending!==undefined){const p=fields(r.pending,['input','request']);if(!checkPending)fail('pending request not consumed');const base=clearPending(value as RootMotionPlayback3D);const plan=prepare(c,base,p.input as RootMotionInput);if(identity(p.request)!==identity(plan.request))fail('pending request mismatch');}
}
function clearPending(p:RootMotionPlayback3D):RootMotionPlayback3D{const out={...p};delete out.pending;return out;}
function feedback(v:unknown):asserts v is RootMotionFeedback{validateDriverTree(v);const r=fields(v,['requestId','actorId','instance','epoch','driverTick','acceptedDeltaQ','acceptedYawDeltaUnits','blocked']);id(r.actorId);if(typeof r.requestId!=='string'||r.requestId.length<1||r.requestId.length>1024)fail('requestId');int(r.instance,1,1000000000);int(r.epoch,0,1000000000);int(r.driverTick,1,MAX_TIME);point(r.acceptedDeltaQ,100000000);int(r.acceptedYawDeltaUnits,-65536,65536);if(typeof r.blocked!=='boolean')fail('blocked bool');}
export function validateRootMotionPlayback(c:RootMotion3D,value:unknown):RootMotionPlayback3D{validateRootMotion3D(c);state(c,value);return value;}
export function createRootMotionPlayback(config:RootMotion3D,actorId:string,instance:number,at:RootMotionCursor={cycle:0,subtick:0},driverTick=0):RootMotionPlayback3D{
 const c=validateRootMotion3D(config);id(actorId);int(instance,1,1000000000);cursor(c,at);time(c,at);int(driverTick,0,MAX_TIME);return{type:'RootMotionPlayback3D',version:1,configCanonical:identity(c),actorId,instance,epoch:0,lastDriverTick:driverTick,cursor:clone(at),remainderMicroQ:zero()};
}
function input(c:RootMotion3D,p:RootMotionPlayback3D,value:unknown):asserts value is RootMotionInput{
 validateDriverTree(value);const v=fields(value,['actorId','instance','epoch','driverTick','cursor','mode','pose'],['anchor']);if(v.actorId!==p.actorId||v.instance!==p.instance||v.epoch!==p.epoch)fail('actor/instance/epoch mismatch');int(v.driverTick,1,MAX_TIME);if(v.driverTick!==p.lastDriverTick+1)fail('driver tick already consumed or skipped');cursor(c,v.cursor);time(c,v.cursor as RootMotionCursor);if(v.mode!=='advance'&&v.mode!=='seek')fail('mode');pose(v.pose);if(p.pose!==undefined&&identity(p.pose)!==identity(v.pose))fail('accepted pose mismatch');if(v.anchor!==undefined)anchor(v.anchor);
}
function prepare(c:RootMotion3D,p:RootMotionPlayback3D,i:RootMotionInput):{request:RootMotionRequest;remainder:RootMotionPointQ;warp:RootMotionWarpState|undefined}{
 input(c,p,i);if(i.mode!=='advance')fail('seek has no pending request');const from=time(c,p.cursor),to=time(c,i.cursor);if(to<from)fail('backward advance requires seek');let w=p.warp,x=0n,z=0n,yaw=0;
 if(c.warp&&to>c.warp.startSubtick&&from<c.warp.endSubtick){
  if(from<c.warp.startSubtick||i.cursor.cycle!==0)fail('warp start must be sampled exactly');if(w===undefined){if(from!==c.warp.startSubtick||!i.anchor)fail('sim anchor required at warp start');w={anchor:clone(i.anchor),startPose:clone(i.pose)};}if(i.anchor&&identity(i.anchor)!==identity(w.anchor))fail('warp anchor changed');
  const data=warpData(c,w),end=Math.min(to,c.warp.endSubtick),n=native(c,p.cursor,{cycle:0,subtick:end},i.pose.yawUnits,data.alignment),len=BigInt(c.warp.endSubtick-c.warp.startSubtick),a=BigInt(from-c.warp.startSubtick),b=BigInt(end-c.warp.startSubtick);
  x=n.x+round(data.x*b,len)-round(data.x*a,len);z=n.z+round(data.z*b,len)-round(data.z*a,len);yaw=n.yaw+safe(round(BigInt(data.yaw)*b,len)-round(BigInt(data.yaw)*a,len));
  if(to>end){const tail=native(c,{cycle:0,subtick:end},i.cursor,wrap(i.pose.yawUnits+yaw));x+=tail.x;z+=tail.z;yaw+=tail.yaw;}
 }else{if(i.anchor)fail('anchor outside active window');const n=native(c,p.cursor,i.cursor,i.pose.yawUnits);x=n.x;z=n.z;yaw=n.yaw;}
 x+=BigInt(p.remainderMicroQ.x);z+=BigInt(p.remainderMicroQ.z);const deltaQ={x:safe(x/MICRO),z:safe(z/MICRO)};
 if(!lengthWithin(deltaQ,c.limits.maxDeltaQ)||Math.abs(yaw)>c.limits.maxYawDeltaUnits)fail('request displacement/yaw limit');
 const requestId=JSON.stringify([p.actorId,p.instance,p.epoch,i.driverTick,p.cursor.cycle,p.cursor.subtick,i.cursor.cycle,i.cursor.subtick,c.sourceSha256,c.inPlaceClipSha256,i.pose,i.anchor??null,deltaQ,yaw]);
 return{request:{requestId,actorId:p.actorId,instance:p.instance,epoch:p.epoch,driverTick:i.driverTick,deltaQ,yawDeltaUnits:yaw},remainder:{x:safe(x%MICRO),z:safe(z%MICRO)},warp:w};
}
export function proposeRootMotion(config:RootMotion3D,previous:RootMotionPlayback3D,value:RootMotionInput):{playback:RootMotionPlayback3D;request:RootMotionRequest|null}{
 const c=validateRootMotion3D(config);state(c,previous,false);input(c,previous,value);const p=clone(previous),i=clone(value);
 if(i.mode==='seek'){if(i.anchor)fail('seek cannot bind anchor');int(p.epoch+1,0,1000000000);const next={...clearPending(p),epoch:p.epoch+1,lastDriverTick:i.driverTick,cursor:i.cursor,remainderMicroQ:zero(),pose:i.pose};delete next.warp;delete next.lastFeedback;return{playback:next,request:null};}
 const plan=prepare(c,p,i);return{playback:{...p,pending:{input:i,request:plan.request}},request:clone(plan.request)};
}
export function acceptRootMotion(config:RootMotion3D,pending:RootMotionPlayback3D,value:RootMotionFeedback):RootMotionPlayback3D{
 const c=validateRootMotion3D(config);state(c,pending);feedback(value);if(!pending.pending)fail('no pending request/already consumed');const p=clone(pending),f=clone(value),i=p.pending!.input,plan=prepare(c,clearPending(p),i),r=plan.request;
 for(const k of ['requestId','actorId','instance','epoch','driverTick']as const)if(f[k]!==r[k])fail('feedback request identity');
 if(!lengthWithin(f.acceptedDeltaQ,c.limits.maxDeltaQ)||BigInt(f.acceptedDeltaQ.x)**2n+BigInt(f.acceptedDeltaQ.z)**2n>BigInt(r.deltaQ.x)**2n+BigInt(r.deltaQ.z)**2n)fail('accepted delta exceeds request budget');
 if(BigInt(f.acceptedDeltaQ.x)*BigInt(r.deltaQ.x)+BigInt(f.acceptedDeltaQ.z)*BigInt(r.deltaQ.z)<0n)fail('accepted delta opposes request');
 if(Math.abs(f.acceptedYawDeltaUnits)>Math.abs(r.yawDeltaUnits)||f.acceptedYawDeltaUnits*r.yawDeltaUnits<0)fail('accepted yaw exceeds request');const equal=f.acceptedDeltaQ.x===r.deltaQ.x&&f.acceptedDeltaQ.z===r.deltaQ.z&&f.acceptedYawDeltaUnits===r.yawDeltaUnits;if(f.blocked===equal)fail('blocked/accepted mismatch');
 const acceptedPose={positionQ:{x:i.pose.positionQ.x+f.acceptedDeltaQ.x,z:i.pose.positionQ.z+f.acceptedDeltaQ.z},yawUnits:wrap(i.pose.yawUnits+f.acceptedYawDeltaUnits)};pose(acceptedPose);
 const next:RootMotionPlayback3D={...clearPending(p),lastDriverTick:i.driverTick,cursor:i.cursor,remainderMicroQ:f.blocked?zero():plan.remainder,pose:acceptedPose,...(plan.warp?{warp:plan.warp}:{}),lastFeedback:f};state(c,next);return next;
}
