/** D2a candidate: pure fixed-tick world-vector motor. Static AABB only; no yaw,
 * terrain, slopes, steps, hulls, dynamic obstacles, root motion or moving supports.
 * Q=10000/m; micro units retain integration residues, never drive a second position.
 * CCD sweeps each integrated tick displacement as a straight segment; no curved or rotating sweep.
 * Stance collision height switches instantly; authored animation timing is not implemented.
 */
import {sweepCapsuleBoxQ, SWEEP_TIME_Q, SWEEP_NORMAL_Q} from './capsule-box-sweep.js';
import type {SweepVectorQ} from './capsule-box-sweep.js';
export const MOTOR_Q_PER_METER = 10_000;
const MICRO = 1_000_000;
const POSITION_LIMIT = 1_000_000_000;
type Vector = SweepVectorQ;
type Stance = 'standing' | 'crouched';
type Mode = 'grounded' | 'rising' | 'falling' | 'landing' | 'recovering';
export interface CharacterMotorConfigV1 {
  readonly version: 1; readonly unitsPerMeter: 10000; readonly tickRate: number;
  readonly body: {readonly kind:'capsule';readonly radiusQ:number;readonly standingHeightQ:number;readonly crouchedHeightQ:number;readonly skinQ:number};
  readonly maxWalkSpeedQps:number; readonly maxRunSpeedQps:number; readonly maxCrouchSpeedQps:number;
  readonly accelQps2:number; readonly brakeQps2:number; readonly airControlQps2:number;
  readonly gravityQps2:number; readonly jumpSpeedQps:number; readonly terminalFallSpeedQps:number;
  readonly recoverTicks:number;
  readonly collision:{readonly kind:'static-aabb';readonly maxObstacles:number;readonly maxContacts:number;readonly maxSlideIterations:number;readonly maxDeltaQ:number};
}
export interface CharacterMotorObstacle {readonly kind:'static-aabb';readonly id:string;readonly min:Vector;readonly max:Vector}
export interface CharacterMotorMove {readonly seq:number;readonly xQ:number;readonly zQ:number;readonly gait:'walk'|'run';readonly stance:Stance}
export interface CharacterMotorStateV1 {
  readonly version:1; readonly configCanonical:string; readonly tick:number;
  readonly positionQ:Vector; readonly positionRemainderQ:Vector; readonly velocityMicroQps:Vector;
  readonly accelRemainder:number; readonly gravityRemainder:number;
  readonly stance:Stance; readonly mode:Mode; readonly modeTicks:number;
  readonly lastMoveSeq:number; readonly lastJumpSeq:number;
  readonly move:{readonly xQ:number;readonly zQ:number;readonly gait:'walk'|'run';readonly stance:Stance};
  readonly jumpInstance:number; readonly landingInstance:number; readonly supportId?:string;
}
/** timeQ is local to that slide segment, not a global tick timestamp. */
export interface CharacterMotorContact {readonly obstacleId:string;readonly timeQ:number;readonly normalQ:Vector}
/** Event ids are actor-state scoped; a world integration must namespace them by stable actor id. */
export interface CharacterMotorEvent {readonly kind:'jump'|'land';readonly id:string;readonly instance:number;readonly obstacleId?:string;readonly impactSpeedQps?:number}
export interface CharacterMotorStepResult {
  readonly state:CharacterMotorStateV1;
  readonly result:{readonly desiredDeltaQ:Vector;readonly acceptedDeltaQ:Vector;readonly contacts:readonly CharacterMotorContact[];readonly blockedReasons:readonly string[]};
  readonly events:readonly CharacterMotorEvent[];
}
type Mutable<T> = {-readonly[K in keyof T]:T[K] extends object?Mutable<T[K]>:T[K]};
type State = Mutable<CharacterMotorStateV1>;
const axes=['x','y','z'] as const;
const zero=():Vector=>({x:0,y:0,z:0});
const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
function fail(message:string):never {throw new Error('CharacterMotorV1: '+message);}
function integer(v:unknown,label:string,min:number,max:number):asserts v is number {
  if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)fail(label+' integer/range');
}
function tree(value:unknown):void {
  const seen=new WeakSet<object>();let count=0;
  function visit(v:unknown,depth:number):void {
    if(++count>12000||depth>12)fail('data budget');
    if(typeof v==='number'){if(!Number.isFinite(v))fail('nonfinite');return;}
    if(typeof v==='string'){if(v.length>100000)fail('string budget');return;}
    if(v===null||typeof v==='boolean')return;
    if(!v||typeof v!=='object')fail('JSON data required');
    if(seen.has(v))fail('cyclic/shared references');seen.add(v);
    if(Object.getOwnPropertySymbols(v).length)fail('symbol fields');
    const names=Object.getOwnPropertyNames(v),keys=Object.keys(v);
    if(Array.isArray(v)){
      if(Object.getPrototypeOf(v)!==Array.prototype||v.length>128||names.length!==v.length+1||keys.length!==v.length)fail('dense array budget');
    }else if(![Object.prototype,null].includes(Object.getPrototypeOf(v))||names.length!==keys.length)fail('plain enumerable data required');
    for(const k of keys){if(['__proto__','prototype','constructor'].includes(k))fail('unsafe field');const d=Object.getOwnPropertyDescriptor(v,k)!;if(!('value'in d))fail('accessor');visit(d.value,depth+1);}
  }visit(value,0);
}
function fields(v:unknown,required:readonly string[],optional:readonly string[]=[],label='object'):Record<string,unknown>{
  if(!v||typeof v!=='object'||Array.isArray(v))fail(label+' object required');const r=v as Record<string,unknown>;
  if(required.some(k=>!Object.hasOwn(r,k))||Object.keys(r).some(k=>!required.includes(k)&&!optional.includes(k)))fail(label+' closed fields');return r;
}
function id(v:unknown):asserts v is string {if(typeof v!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(v))fail('stable id');}
function vector(v:unknown,label:string,limit:number):asserts v is Vector {
  const r=fields(v,axes,[],label);for(const a of axes)integer(r[a],label+'.'+a,-limit,limit);
}
function canonical(v:unknown):string {
  if(v===null||typeof v!=='object')return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}';
}
function sqrtCeil(n:bigint):bigint {
  if(n<2n)return n;let a=1n<<BigInt(Math.ceil(n.toString(2).length/2)),b=(a+n/a)/2n;
  while(b<a){a=b;b=(a+n/a)/2n;}return a*a===n?a:a+1n;
}
const sq=(v:Vector):bigint=>axes.reduce((s,a)=>s+BigInt(v[a])*BigInt(v[a]),0n);
const safe=(n:bigint):number=>{if(n>BigInt(Number.MAX_SAFE_INTEGER)||n<BigInt(-Number.MAX_SAFE_INTEGER))fail('integer overflow');return Number(n);};
function height(c:CharacterMotorConfigV1,s:Stance):number{return s==='standing'?c.body.standingHeightQ:c.body.crouchedHeightQ;}
export function validateCharacterMotorConfig(value:unknown):CharacterMotorConfigV1 {
  tree(value);const c=fields(value,['version','unitsPerMeter','tickRate','body','maxWalkSpeedQps','maxRunSpeedQps','maxCrouchSpeedQps','accelQps2','brakeQps2','airControlQps2','gravityQps2','jumpSpeedQps','terminalFallSpeedQps','recoverTicks','collision']);
  if(c.version!==1||c.unitsPerMeter!==MOTOR_Q_PER_METER)fail('version/Q scale');integer(c.tickRate,'tickRate',1,240);
  const b=fields(c.body,['kind','radiusQ','standingHeightQ','crouchedHeightQ','skinQ']);if(b.kind!=='capsule')fail('only vertical capsule supported');
  integer(b.radiusQ,'radiusQ',2,1000000);integer(b.skinQ,'skinQ',2,b.radiusQ);integer(b.standingHeightQ,'standingHeightQ',2*b.radiusQ,10000000);integer(b.crouchedHeightQ,'crouchedHeightQ',2*b.radiusQ,b.standingHeightQ);
  for(const k of ['maxWalkSpeedQps','maxRunSpeedQps','maxCrouchSpeedQps','jumpSpeedQps','terminalFallSpeedQps'])integer(c[k],k,1,10000000);
  for(const k of ['accelQps2','brakeQps2','airControlQps2','gravityQps2'])integer(c[k],k,1,100000000);
  integer(c.recoverTicks,'recoverTicks',0,2400);
  const p=fields(c.collision,['kind','maxObstacles','maxContacts','maxSlideIterations','maxDeltaQ']);if(p.kind!=='static-aabb')fail('only static-aabb collision supported');
  integer(p.maxObstacles,'maxObstacles',1,128);integer(p.maxContacts,'maxContacts',1,16);integer(p.maxSlideIterations,'maxSlideIterations',1,16);integer(p.maxDeltaQ,'maxDeltaQ',1,100000000);
  return value as CharacterMotorConfigV1;
}
function obstacles(c:CharacterMotorConfigV1,value:unknown):readonly CharacterMotorObstacle[]{
  tree(value);if(!Array.isArray(value)||value.length>c.collision.maxObstacles)fail('obstacle budget');const ids=new Set<string>();
  for(const row of value){const r=fields(row,['kind','id','min','max']);if(r.kind!=='static-aabb')fail('terrain/hull/dynamic/steps unsupported');id(r.id);if(ids.has(r.id))fail('duplicate obstacle');ids.add(r.id);vector(r.min,'min',POSITION_LIMIT);vector(r.max,'max',POSITION_LIMIT);for(const a of axes)if(r.min[a]>=r.max[a])fail('positive box required');}
  return [...value].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
}
function checkMove(value:unknown,withSeq:boolean):void {
  const m=fields(value,[...(withSeq?['seq']:[]),'xQ','zQ','gait','stance']);if(withSeq)integer(m.seq,'move seq',1,Number.MAX_SAFE_INTEGER);
  integer(m.xQ,'move xQ',-MOTOR_Q_PER_METER,MOTOR_Q_PER_METER);integer(m.zQ,'move zQ',-MOTOR_Q_PER_METER,MOTOR_Q_PER_METER);
  if(m.gait!=='walk'&&m.gait!=='run')fail('gait');if(m.stance!=='standing'&&m.stance!=='crouched')fail('stance');
}
export function validateCharacterMotorState(c:CharacterMotorConfigV1,value:unknown):CharacterMotorStateV1 {
  validateCharacterMotorConfig(c);tree(value);const s=fields(value,['version','configCanonical','tick','positionQ','positionRemainderQ','velocityMicroQps','accelRemainder','gravityRemainder','stance','mode','modeTicks','lastMoveSeq','lastJumpSeq','move','jumpInstance','landingInstance'],['supportId']);
  if(s.version!==1||s.configCanonical!==canonical(c))fail('state identity');vector(s.positionQ,'positionQ',POSITION_LIMIT);vector(s.positionRemainderQ,'positionRemainderQ',MICRO-1);vector(s.velocityMicroQps,'velocityMicroQps',10000000*MICRO);
  for(const k of ['tick','modeTicks','lastMoveSeq','lastJumpSeq','jumpInstance','landingInstance'])integer(s[k],k,0,Number.MAX_SAFE_INTEGER-1);
  integer(s.accelRemainder,'accelRemainder',0,c.tickRate-1);integer(s.gravityRemainder,'gravityRemainder',0,c.tickRate-1);checkMove(s.move,false);
  if(s.stance!=='standing'&&s.stance!=='crouched')fail('state stance');if(!['grounded','rising','falling','landing','recovering'].includes(s.mode as string))fail('state mode');
  if(s.supportId!==undefined)id(s.supportId);
  if((s.modeTicks as number)>(s.tick as number)||(s.jumpInstance as number)>(s.tick as number)||(s.landingInstance as number)>(s.tick as number))fail('snapshot lifecycle counters');
  const vy=(s.velocityMicroQps as Vector).y;
  if(['grounded','landing','recovering'].includes(s.mode as string)&&(vy!==0||s.supportId===undefined))fail('supported mode snapshot');
  if((s.mode==='rising'&&(vy<=0||s.supportId!==undefined))||(s.mode==='falling'&&(vy>0||s.supportId!==undefined)))fail('air mode snapshot');
  return value as CharacterMotorStateV1;
}
function collision(c:CharacterMotorConfigV1,position:Vector,stance:Stance,delta:Vector,box:CharacterMotorObstacle){
  return sweepCapsuleBoxQ({foot:position,delta,radiusQ:c.body.radiusQ,heightQ:height(c,stance),box:{min:box.min,max:box.max}});
}
function blocked(c:CharacterMotorConfigV1,p:Vector,stance:Stance,boxes:readonly CharacterMotorObstacle[]):boolean {
  return boxes.some(box=>collision(c,p,stance,zero(),box).kind==='initial-overlap');
}
function support(c:CharacterMotorConfigV1,p:Vector,stance:Stance,boxes:readonly CharacterMotorObstacle[]):string|undefined {
  let best:{id:string;timeQ:number}|undefined;
  for(const b of boxes){const r=collision(c,p,stance,{x:0,y:-(c.body.skinQ+2),z:0},b);if(r.kind==='initial-overlap')fail('initial-overlap');if(r.kind==='hit'&&r.normalQ.y>=999000&&(!best||r.timeQ<best.timeQ))best={id:b.id,timeQ:r.timeQ};}
  return best?.id;
}
export function createCharacterMotor(c:CharacterMotorConfigV1,initial:{readonly positionQ:Vector;readonly stance:Stance},rawObstacles:readonly CharacterMotorObstacle[]):CharacterMotorStateV1 {
  validateCharacterMotorConfig(c);tree(initial);fields(initial,['positionQ','stance']);vector(initial.positionQ,'spawn position',POSITION_LIMIT);if(initial.stance!=='standing'&&initial.stance!=='crouched')fail('spawn stance');const boxes=obstacles(c,rawObstacles);
  if(blocked(c,initial.positionQ,initial.stance,boxes))fail('initial-overlap spawn');const supportId=support(c,initial.positionQ,initial.stance,boxes);
  return {version:1,configCanonical:canonical(c),tick:0,positionQ:{...initial.positionQ},positionRemainderQ:zero(),velocityMicroQps:zero(),accelRemainder:0,gravityRemainder:0,stance:initial.stance,mode:supportId?'grounded':'falling',modeTicks:0,lastMoveSeq:0,lastJumpSeq:0,move:{xQ:0,zQ:0,gait:'walk',stance:initial.stance},jumpInstance:0,landingInstance:0,...(supportId?{supportId}:{})};
}
function mode(s:State,next:Mode):void {if(s.mode!==next){s.mode=next;s.modeTicks=0;}}
/** Exact piecewise constant acceleration area, rounded only below one micro-Q. */
function accelerate(old:Vector,target:Vector,a:number,rate:number,remainder:number):{velocity:Vector;displacement:Vector;remainder:number}{
  const diff={x:target.x-old.x,y:target.y-old.y,z:target.z-old.z};const length=sqrtCeil(sq(diff)),budget=BigInt(a)*BigInt(MICRO)+BigInt(remainder),limit=budget/BigInt(rate);
  if(length===0n)return {velocity:{...target},displacement:Object.fromEntries(axes.map(k=>[k,safe(BigInt(target[k])/BigInt(rate))])) as unknown as Vector,remainder:0};
  const reached=length<=limit;
  const velocity=Object.fromEntries(axes.map(k=>[k,reached?target[k]:old[k]+safe(BigInt(diff[k])*limit/length)])) as unknown as Vector;
  const displacement=Object.fromEntries(axes.map(k=>[k,reached?safe(BigInt(target[k])/BigInt(rate)-BigInt(diff[k])*length/(2n*BigInt(a)*BigInt(MICRO))):safe((BigInt(old[k])+BigInt(velocity[k]))/(2n*BigInt(rate)))])) as unknown as Vector;
  return {velocity,displacement,remainder:reached?0:Number(budget%BigInt(rate))};
}
/** Remove inward normal component with integer correction so rounding cannot leave an inward residue. */
function slide(v:Vector,n:Vector):Vector {
  const d=axes.reduce((s,k)=>s+BigInt(v[k])*BigInt(n[k]),0n);if(d>=0n)return {...v};const n2=sq(n);if(n2===0n)fail('zero contact normal');
  const out=Object.fromEntries(axes.map(k=>[k,v[k]-safe(BigInt(n[k])*d/n2)])) as unknown as Mutable<Vector>;
  const inward=axes.reduce((s,k)=>s+BigInt(out[k])*BigInt(n[k]),0n);
  if(inward<0n){let a:'x'|'y'|'z'='x';for(const k of axes)if(Math.abs(n[k])>Math.abs(n[a]))a=k;const magnitude=BigInt(Math.abs(n[a]));out[a]+=(n[a]>0?1:-1)*safe((-inward+magnitude-1n)/magnitude);}
  return out;
}
function sweepSlide(c:CharacterMotorConfigV1,s:State,desired:Vector,boxes:readonly CharacterMotorObstacle[]):CharacterMotorContact[]{
  let remaining={...desired};const contacts:CharacterMotorContact[]=[];
  for(let iteration=0;axes.some(k=>remaining[k]!==0);iteration++){
    if(iteration>=c.collision.maxSlideIterations)fail('slide iteration budget');
    let nearest:{box:CharacterMotorObstacle;timeQ:number;normalQ:Vector}|undefined;
    for(const box of boxes){const hit=collision(c,s.positionQ,s.stance,remaining,box);if(hit.kind==='initial-overlap')fail('initial-overlap during sweep');if(hit.kind==='hit'&&(!nearest||hit.timeQ<nearest.timeQ))nearest={box,timeQ:hit.timeQ,normalQ:hit.normalQ};}
    if(!nearest){for(const k of axes)s.positionQ[k]+=remaining[k];break;}
    if(contacts.length>=c.collision.maxContacts)fail('contact budget');contacts.push({obstacleId:nearest.box.id,timeQ:nearest.timeQ,normalQ:{...nearest.normalQ}});
    const travel=Object.fromEntries(axes.map(k=>[k,safe(BigInt(remaining[k])*BigInt(nearest!.timeQ)/BigInt(SWEEP_TIME_Q))])) as unknown as Vector;
    for(const k of axes){const n=nearest.normalQ[k];const offset=n===0?0:(n>0?1:-1)*safe((BigInt(Math.abs(n))*BigInt(c.body.skinQ)+BigInt(SWEEP_NORMAL_Q)-1n)/BigInt(SWEEP_NORMAL_Q));s.positionQ[k]+=travel[k]+offset;}
    remaining=slide({x:remaining.x-travel.x,y:remaining.y-travel.y,z:remaining.z-travel.z},nearest.normalQ);
    s.velocityMicroQps=slide(s.velocityMicroQps,nearest.normalQ);
    // A flat wall must not discard the tangent-axis integration remainder.
    for(const k of axes)if(nearest.normalQ[k]!==0)s.positionRemainderQ[k]=0;
  }
  if(blocked(c,s.positionQ,s.stance,boxes))fail('overlap after quantized slide');return contacts;
}
/** Old seqs are validated then ignored, not payload-authenticated; there is no jump buffer/coyote time.
 * Jump is standing+grounded only. Recovery does not block horizontal control, but cannot accept a new jump.
 */
export function stepCharacterMotor(c:CharacterMotorConfigV1,previous:CharacterMotorStateV1,input:{readonly move?:CharacterMotorMove;readonly jump?:{readonly seq:number};readonly obstacles:readonly CharacterMotorObstacle[]}):CharacterMotorStepResult {
  validateCharacterMotorState(c,previous);tree(input);fields(input,['obstacles'],['move','jump']);const boxes=obstacles(c,input.obstacles);
  if(Object.hasOwn(input,'move'))checkMove(input.move,true);if(Object.hasOwn(input,'jump')){const j=fields(input.jump,['seq']);integer(j.seq,'jump seq',1,Number.MAX_SAFE_INTEGER);}
  if(blocked(c,previous.positionQ,previous.stance,boxes))fail('initial-overlap');const s=copy(previous) as State;s.tick++;s.modeTicks++;const blockedReasons:string[]=[],events:CharacterMotorEvent[]=[];
  if(input.move&&input.move.seq>s.lastMoveSeq){s.lastMoveSeq=input.move.seq;const {seq:_,...m}=input.move;s.move={...m};}
  if(s.move.stance==='crouched')s.stance='crouched';else if(s.stance==='crouched'){if(blocked(c,s.positionQ,'standing',boxes))blockedReasons.push('stand-blocked');else s.stance='standing';}
  const supportBefore=support(c,s.positionQ,s.stance,boxes);const onGround=supportBefore!==undefined&&s.velocityMicroQps.y<=0&&s.mode!=='rising';
  if(s.mode==='landing')mode(s,c.recoverTicks===0?'grounded':'recovering');else if(s.mode==='recovering'&&s.modeTicks>=c.recoverTicks)mode(s,'grounded');
  if(!onGround&&(s.mode==='grounded'||s.mode==='recovering'||s.mode==='landing'))mode(s,'falling');
  let jumped=false;
  if(input.jump&&input.jump.seq>s.lastJumpSeq){s.lastJumpSeq=input.jump.seq;
    if(!onGround||s.mode!=='grounded')blockedReasons.push('jump-not-grounded');
    else if(s.stance!=='standing')blockedReasons.push('jump-crouched');
    else {const ceiling=boxes.some(b=>{const h=collision(c,s.positionQ,s.stance,{x:0,y:c.body.skinQ+2,z:0},b);return h.kind==='hit'&&h.normalQ.y<0;});
      if(ceiling)blockedReasons.push('jump-ceiling');else{s.jumpInstance++;s.velocityMicroQps.y=c.jumpSpeedQps*MICRO;s.gravityRemainder=0;mode(s,'rising');jumped=true;events.push({kind:'jump',id:'jump:'+s.jumpInstance,instance:s.jumpInstance});}
    }
  }
  const speed=s.stance==='crouched'?c.maxCrouchSpeedQps:s.move.gait==='run'?c.maxRunSpeedQps:c.maxWalkSpeedQps;
  const length=sqrtCeil(BigInt(s.move.xQ)**2n+BigInt(s.move.zQ)**2n);const denominator=length>BigInt(MOTOR_Q_PER_METER)?length:BigInt(MOTOR_Q_PER_METER);
  const target={x:safe(BigInt(speed)*BigInt(MICRO)*BigInt(s.move.xQ)/denominator),y:0,z:safe(BigInt(speed)*BigInt(MICRO)*BigInt(s.move.zQ)/denominator)};
  const horizontal=accelerate({x:s.velocityMicroQps.x,y:0,z:s.velocityMicroQps.z},target,onGround?(s.move.xQ===0&&s.move.zQ===0?c.brakeQps2:c.accelQps2):c.airControlQps2,c.tickRate,s.accelRemainder);
  s.velocityMicroQps.x=horizontal.velocity.x;s.velocityMicroQps.z=horizontal.velocity.z;s.accelRemainder=horizontal.remainder;
  let verticalDisplacement=0;
  if(onGround&&!jumped){s.velocityMicroQps.y=0;s.gravityRemainder=0;}
  else {const vertical=accelerate({x:0,y:s.velocityMicroQps.y,z:0},{x:0,y:-c.terminalFallSpeedQps*MICRO,z:0},c.gravityQps2,c.tickRate,s.gravityRemainder);s.velocityMicroQps.y=vertical.velocity.y;s.gravityRemainder=vertical.remainder;verticalDisplacement=vertical.displacement.y;if(s.velocityMicroQps.y<=0)mode(s,'falling');}
  const displacement={x:horizontal.displacement.x,y:verticalDisplacement,z:horizontal.displacement.z};const desired=zero() as Mutable<Vector>;
  for(const k of axes){const numerator=BigInt(s.positionRemainderQ[k])+BigInt(displacement[k]);desired[k]=safe(numerator/BigInt(MICRO));s.positionRemainderQ[k]=safe(numerator%BigInt(MICRO));}
  if(sq(desired)>BigInt(c.collision.maxDeltaQ)**2n)fail('delta budget');const oldPosition={...s.positionQ};const impactSpeed=Math.max(0,Math.trunc(-s.velocityMicroQps.y/MICRO));const contacts=sweepSlide(c,s,desired,boxes);
  if(contacts.length)blockedReasons.push('collision');if(contacts.some(x=>x.normalQ.y<0)&&s.mode==='rising'){s.velocityMicroQps.y=0;mode(s,'falling');}
  const supportAfter=s.velocityMicroQps.y<=0?support(c,s.positionQ,s.stance,boxes):undefined;
  if(supportAfter){s.supportId=supportAfter;s.velocityMicroQps.y=0;if(s.mode==='falling'||s.mode==='rising'||jumped){s.landingInstance++;mode(s,'landing');events.push({kind:'land',id:'land:'+s.landingInstance,instance:s.landingInstance,obstacleId:supportAfter,impactSpeedQps:impactSpeed});}}
  else {delete s.supportId;mode(s,s.velocityMicroQps.y>0?'rising':'falling');}
  vector(s.positionQ,'accepted position',POSITION_LIMIT);
  const accepted={x:s.positionQ.x-oldPosition.x,y:s.positionQ.y-oldPosition.y,z:s.positionQ.z-oldPosition.z};
  if(sq(accepted)>BigInt(c.collision.maxDeltaQ)**2n)fail('accepted delta budget');
  validateCharacterMotorState(c,s);
  return {state:s,result:{desiredDeltaQ:{...desired},acceptedDeltaQ:accepted,contacts,blockedReasons},events};
}
