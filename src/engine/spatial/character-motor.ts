/** D2a candidate: pure fixed-tick world-vector motor. Static AABB only; no yaw,
 * terrain, slopes, hulls, dynamic obstacles or moving supports. Optional box-step only.
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
  /** Opt-in kinematic box staircase policy, not a slope controller. Supports
   * a witnessed capsule/top-edge contact as well as the flat top. The capsule
   * foot centre may be below the supporting box top; no sole/IK claim follows.
   * All attempted routes share the existing contact/iteration/path budgets. */
  readonly ground?:{readonly kind:'box-step';readonly maxStepUpQ:number;readonly maxSnapDownQ:number};
}
export interface CharacterMotorObstacle {readonly kind:'static-aabb';readonly id:string;readonly min:Vector;readonly max:Vector}
export interface CharacterMotorMove {readonly seq:number;readonly xQ:number;readonly zQ:number;readonly gait:'walk'|'run';readonly stance:Stance}
/** Already quantized world-space horizontal displacement from the authoritative
 * animation planner. Instance/cursor/request replay belongs to that planner;
 * this motor still exclusively owns collision, gravity and vertical lifecycle. */
export interface CharacterMotorRootMotionRequest {
  readonly requestId:string;
  readonly deltaQ:{readonly x:number;readonly z:number};
}
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
  tree(value);const c=fields(value,['version','unitsPerMeter','tickRate','body','maxWalkSpeedQps','maxRunSpeedQps','maxCrouchSpeedQps','accelQps2','brakeQps2','airControlQps2','gravityQps2','jumpSpeedQps','terminalFallSpeedQps','recoverTicks','collision'],['ground']);
  if(c.version!==1||c.unitsPerMeter!==MOTOR_Q_PER_METER)fail('version/Q scale');integer(c.tickRate,'tickRate',1,240);
  const b=fields(c.body,['kind','radiusQ','standingHeightQ','crouchedHeightQ','skinQ']);if(b.kind!=='capsule')fail('only vertical capsule supported');
  integer(b.radiusQ,'radiusQ',2,1000000);integer(b.skinQ,'skinQ',2,b.radiusQ);integer(b.standingHeightQ,'standingHeightQ',2*b.radiusQ,10000000);integer(b.crouchedHeightQ,'crouchedHeightQ',2*b.radiusQ,b.standingHeightQ);
  for(const k of ['maxWalkSpeedQps','maxRunSpeedQps','maxCrouchSpeedQps','jumpSpeedQps','terminalFallSpeedQps'])integer(c[k],k,1,10000000);
  for(const k of ['accelQps2','brakeQps2','airControlQps2','gravityQps2'])integer(c[k],k,1,100000000);
  integer(c.recoverTicks,'recoverTicks',0,2400);
  const p=fields(c.collision,['kind','maxObstacles','maxContacts','maxSlideIterations','maxDeltaQ']);if(p.kind!=='static-aabb')fail('only static-aabb collision supported');
  integer(p.maxObstacles,'maxObstacles',1,128);integer(p.maxContacts,'maxContacts',1,16);integer(p.maxSlideIterations,'maxSlideIterations',1,16);integer(p.maxDeltaQ,'maxDeltaQ',1,100000000);
  if(Object.hasOwn(c,'ground')){
    const g=fields(c.ground,['kind','maxStepUpQ','maxSnapDownQ']);
    if(g.kind!=='box-step')fail('ground kind');
    const limit=Math.min(b.standingHeightQ,p.maxDeltaQ);
    integer(g.maxStepUpQ,'maxStepUpQ',0,limit);integer(g.maxSnapDownQ,'maxSnapDownQ',0,limit);
    if(g.maxStepUpQ===0&&g.maxSnapDownQ===0)fail('empty ground policy');
  }
  return value as CharacterMotorConfigV1;
}
function obstacles(c:CharacterMotorConfigV1,value:unknown):readonly CharacterMotorObstacle[]{
  tree(value);if(!Array.isArray(value)||value.length>c.collision.maxObstacles)fail('obstacle budget');const ids=new Set<string>();
  for(const row of value){const r=fields(row,['kind','id','min','max']);if(r.kind!=='static-aabb')fail('terrain/hull/dynamic unsupported');id(r.id);if(ids.has(r.id))fail('duplicate obstacle');ids.add(r.id);vector(r.min,'min',POSITION_LIMIT);vector(r.max,'max',POSITION_LIMIT);for(const a of axes)if(r.min[a]>=r.max[a])fail('positive box required');}
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
/** Exact sweep witness for this restricted kinematic step policy. At the hit
 * time the capsule bottom-sphere centre is above the box top, so the closest
 * box feature is its top face/edge, not a vertical side or underside. Keep the
 * native normal: edge support is deliberately not called a flat sole contact. */
function topEdgeWitness(c:CharacterMotorConfigV1,p:Vector,dy:number,box:CharacterMotorObstacle,hit:{timeQ:number;normalQ:Vector}):boolean {
  return hit.normalQ.y>0&&(BigInt(p.y+c.body.radiusQ-box.max.y)*BigInt(SWEEP_TIME_Q)+BigInt(dy)*BigInt(hit.timeQ)>=0n);
}
function nearTopEdge(c:CharacterMotorConfigV1,p:Vector,b:CharacterMotorObstacle):boolean {
  const dy=p.y+c.body.radiusQ-b.max.y;if(dy<0)return false;
  const dx=Math.max(b.min.x-p.x,0,p.x-b.max.x),dz=Math.max(b.min.z-p.z,0,p.z-b.max.z);
  return BigInt(dx)**2n+BigInt(dy)**2n+BigInt(dz)**2n<=BigInt(c.body.radiusQ+c.body.skinQ+2)**2n;
}
function support(c:CharacterMotorConfigV1,p:Vector,stance:Stance,boxes:readonly CharacterMotorObstacle[],referenceSupportId?:string,allowEdge=true):string|undefined {
  let best:{id:string;distance:bigint}|undefined;
  const shortDy=-(c.body.skinQ+2),reference=referenceSupportId?boxes.find(b=>b.id===referenceSupportId):undefined;
  for(const b of boxes){
    let dy=shortDy,r=collision(c,p,stance,{x:0,y:dy,z:0},b);
    if(r.kind==='initial-overlap')fail('initial-overlap');
    let accepted=r.kind==='hit'&&r.normalQ.y>=999000;
    // Near a steep rounded upper edge, a skin-sized normal gap requires a
    // longer vertical probe. The exact squared-distance gate prevents this
    // probe from turning empty space far below the capsule into support.
    if(!accepted&&c.ground&&allowEdge&&nearTopEdge(c,p,b)){
      dy=-(2*c.body.radiusQ+c.body.skinQ+2);r=collision(c,p,stance,{x:0,y:dy,z:0},b);
      if(r.kind==='initial-overlap')fail('initial-overlap');
      accepted=r.kind==='hit'&&topEdgeWitness(c,p,dy,b,r);
    }
    if(!accepted||r.kind!=='hit')continue;
    if(c.ground&&reference){const rise=b.max.y-reference.max.y;if(rise>c.ground.maxStepUpQ||rise< -c.ground.maxSnapDownQ)continue;}
    const distance=BigInt(-dy)*BigInt(r.timeQ);
    if(!best||distance<best.distance)best={id:b.id,distance};
  }
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
interface SweepBudget {iterations:number;contacts:number;pathQ:bigint}
function chargePath(c:CharacterMotorConfigV1,b:SweepBudget,delta:Vector):void {
  b.pathQ+=sqrtCeil(sq(delta));if(b.pathQ>BigInt(c.collision.maxDeltaQ))fail('ground path delta budget');
}
function sweepSlide(c:CharacterMotorConfigV1,s:State,desired:Vector,boxes:readonly CharacterMotorObstacle[],budget?:SweepBudget):CharacterMotorContact[]{
  if(budget)chargePath(c,budget,desired);
  let remaining={...desired};const contacts:CharacterMotorContact[]=[];
  for(let iteration=0;axes.some(k=>remaining[k]!==0);iteration++){
    if((budget?budget.iterations++:iteration)>=c.collision.maxSlideIterations)fail('slide iteration budget');
    let nearest:{box:CharacterMotorObstacle;timeQ:number;normalQ:Vector}|undefined;
    for(const box of boxes){const hit=collision(c,s.positionQ,s.stance,remaining,box);if(hit.kind==='initial-overlap')fail('initial-overlap during sweep');if(hit.kind==='hit'&&(!nearest||hit.timeQ<nearest.timeQ))nearest={box,timeQ:hit.timeQ,normalQ:hit.normalQ};}
    if(!nearest){for(const k of axes)s.positionQ[k]+=remaining[k];break;}
    if((budget?budget.contacts++:contacts.length)>=c.collision.maxContacts)fail('contact budget');contacts.push({obstacleId:nearest.box.id,timeQ:nearest.timeQ,normalQ:{...nearest.normalQ}});
    const travel=Object.fromEntries(axes.map(k=>[k,safe(BigInt(remaining[k])*BigInt(nearest!.timeQ)/BigInt(SWEEP_TIME_Q))])) as unknown as Vector;
    for(const k of axes){const n=nearest.normalQ[k];const offset=n===0?0:(n>0?1:-1)*safe((BigInt(Math.abs(n))*BigInt(c.body.skinQ)+BigInt(SWEEP_NORMAL_Q)-1n)/BigInt(SWEEP_NORMAL_Q));s.positionQ[k]+=travel[k]+offset;}
    remaining=slide({x:remaining.x-travel.x,y:remaining.y-travel.y,z:remaining.z-travel.z},nearest.normalQ);
    s.velocityMicroQps=slide(s.velocityMicroQps,nearest.normalQ);
    // A flat wall must not discard the tangent-axis integration remainder.
    for(const k of axes)if(nearest.normalQ[k]!==0)s.positionRemainderQ[k]=0;
  }
  if(blocked(c,s.positionQ,s.stance,boxes))fail('overlap after quantized slide');return contacts;
}
/** A vertical candidate segment stops at the first exact hit; it never slides
 * around a ceiling or invents support. All attempted routes share one tick budget. */
function verticalSweep(c:CharacterMotorConfigV1,s:State,dy:number,boxes:readonly CharacterMotorObstacle[],budget:SweepBudget):{clear:boolean;contacts:CharacterMotorContact[]}{
  const delta={x:0,y:dy,z:0};chargePath(c,budget,delta);
  if(budget.iterations++>=c.collision.maxSlideIterations)fail('slide iteration budget');
  let nearest:{box:CharacterMotorObstacle;timeQ:number;normalQ:Vector}|undefined;
  for(const box of boxes){const hit=collision(c,s.positionQ,s.stance,delta,box);if(hit.kind==='initial-overlap')fail('initial-overlap during ground sweep');if(hit.kind==='hit'&&(!nearest||hit.timeQ<nearest.timeQ))nearest={box,timeQ:hit.timeQ,normalQ:hit.normalQ};}
  if(!nearest){s.positionQ.y+=dy;return {clear:true,contacts:[]};}
  if(budget.contacts++>=c.collision.maxContacts)fail('contact budget');
  // This is a vertical stop, not a slide. Back off along the vertical cast
  // axis, retaining requested XZ and avoiding rounded normal-axis drift.
  s.positionQ.y+=safe(BigInt(dy)*BigInt(nearest.timeQ)/BigInt(SWEEP_TIME_Q))+(nearest.normalQ.y>0?c.body.skinQ:nearest.normalQ.y<0?-c.body.skinQ:0);
  if(blocked(c,s.positionQ,s.stance,boxes))fail('overlap after ground sweep');
  return {clear:false,contacts:[{obstacleId:nearest.box.id,timeQ:nearest.timeQ,normalQ:{...nearest.normalQ}}]};
}
function groundRoute(c:CharacterMotorConfigV1,start:State,ordinary:State,desired:Vector,ordinaryContacts:CharacterMotorContact[],boxes:readonly CharacterMotorObstacle[],supportId:string,budget:SweepBudget):{state:State;contacts:CharacterMotorContact[]}{
  const g=c.ground!;const originalSurface=boxes.find(b=>b.id===supportId)!.max.y;
  const progress=(p:Vector)=>BigInt(p.x-start.positionQ.x)*BigInt(desired.x)+BigInt(p.z-start.positionQ.z)*BigInt(desired.z);
  const requested=BigInt(desired.x)**2n+BigInt(desired.z)**2n;
  const acceptable=(s:State)=>{const id=support(c,s.positionQ,s.stance,boxes);if(!id)return false;const rise=boxes.find(b=>b.id===id)!.max.y-originalSurface;return rise<=g.maxStepUpQ&&rise>=-g.maxSnapDownQ;};
  // A rounded capsule may otherwise slide upward along a tall box corner. The
  // opt-in policy never accepts a rise beyond its explicit surface-height gate.
  if(ordinary.positionQ.y-start.positionQ.y>g.maxStepUpQ+c.body.skinQ+2||(ordinary.positionQ.y>start.positionQ.y&&ordinaryContacts.some(contact=>contact.normalQ.y>0&&boxes.find(box=>box.id===contact.obstacleId)!.max.y-originalSurface>g.maxStepUpQ))){ordinary=copy(start);ordinary.velocityMicroQps.x=0;ordinary.velocityMicroQps.z=0;}
  let normalSupport=support(c,ordinary.positionQ,ordinary.stance,boxes);
  if(normalSupport&&!acceptable(ordinary)){ordinary=copy(start);ordinary.velocityMicroQps.x=0;ordinary.velocityMicroQps.z=0;normalSupport=supportId;}
  if(normalSupport&&acceptable(ordinary)){ordinary.velocityMicroQps.y=0;ordinary.positionRemainderQ.y=0;}
  if(normalSupport&&acceptable(ordinary)&&progress(ordinary.positionQ)>=requested)return {state:ordinary,contacts:ordinaryContacts};
  if(requested===0n)return {state:ordinary,contacts:ordinaryContacts};
  // A complete unobstructed horizontal move needs only the downward segment.
  if(!normalSupport&&progress(ordinary.positionQ)>=requested&&g.maxSnapDownQ>0){
    const candidate=copy(ordinary),down=verticalSweep(c,candidate,-(g.maxSnapDownQ+c.body.skinQ+2),boxes,budget);
    if(!down.clear&&down.contacts[0].normalQ.y>0&&acceptable(candidate)){candidate.velocityMicroQps.y=0;candidate.positionRemainderQ.y=0;return {state:candidate,contacts:[...ordinaryContacts,...down.contacts]};}
    return {state:ordinary,contacts:ordinaryContacts};
  }
  if(g.maxStepUpQ===0||progress(ordinary.positionQ)>=requested)return {state:ordinary,contacts:ordinaryContacts};
  const candidate=copy(start),lift=g.maxStepUpQ+c.body.skinQ+2;
  const up=verticalSweep(c,candidate,lift,boxes,budget);
  if(!up.clear)return {state:ordinary,contacts:ordinaryContacts};
  const across=sweepSlide(c,candidate,{x:desired.x,y:0,z:desired.z},boxes,budget);
  const down=verticalSweep(c,candidate,-(lift+g.maxSnapDownQ+c.body.skinQ+2),boxes,budget);
  if(!down.clear&&down.contacts[0].normalQ.y>0&&acceptable(candidate)&&progress(candidate.positionQ)>progress(ordinary.positionQ)){
    candidate.velocityMicroQps.y=0;candidate.positionRemainderQ.y=0;
    return {state:candidate,contacts:[...across,...down.contacts]};
  }
  return {state:ordinary,contacts:ordinaryContacts};
}
/** Old seqs are validated then ignored, not payload-authenticated; there is no jump buffer/coyote time.
 * Jump is standing+grounded only. Recovery does not block horizontal control, but cannot accept a new jump.
 */
export function stepCharacterMotor(c:CharacterMotorConfigV1,previous:CharacterMotorStateV1,input:{readonly move?:CharacterMotorMove;readonly jump?:{readonly seq:number};readonly obstacles:readonly CharacterMotorObstacle[];readonly rootMotion?:CharacterMotorRootMotionRequest}):CharacterMotorStepResult {
  validateCharacterMotorState(c,previous);tree(input);fields(input,['obstacles'],['move','jump','rootMotion']);const boxes=obstacles(c,input.obstacles);
  if(Object.hasOwn(input,'move'))checkMove(input.move,true);if(Object.hasOwn(input,'jump')){const j=fields(input.jump,['seq']);integer(j.seq,'jump seq',1,Number.MAX_SAFE_INTEGER);}
  if(Object.hasOwn(input,'rootMotion')){
    const r=fields(input.rootMotion,['requestId','deltaQ']);
    if(typeof r.requestId!=='string'||r.requestId.length<1||r.requestId.length>512||/[\u0000-\u001f\u007f]/.test(r.requestId))fail('root request identity');
    const d=fields(r.deltaQ,['x','z']);
    for(const k of ['x','z'])integer(d[k],'root delta.'+k,-c.collision.maxDeltaQ,c.collision.maxDeltaQ);
  }
  if(blocked(c,previous.positionQ,previous.stance,boxes))fail('initial-overlap');const s=copy(previous) as State;s.tick++;s.modeTicks++;const blockedReasons:string[]=[],events:CharacterMotorEvent[]=[];
  if(input.move&&input.move.seq>s.lastMoveSeq){s.lastMoveSeq=input.move.seq;const {seq:_,...m}=input.move;s.move={...m};}
  if(input.rootMotion&&(s.move.xQ!==0||s.move.zQ!==0))fail('root motion and velocity move are exclusive');
  if(s.move.stance==='crouched')s.stance='crouched';else if(s.stance==='crouched'){if(blocked(c,s.positionQ,'standing',boxes))blockedReasons.push('stand-blocked');else s.stance='standing';}
  const supportBefore=support(c,s.positionQ,s.stance,boxes,previous.supportId,['grounded','landing','recovering'].includes(previous.mode));const onGround=supportBefore!==undefined&&s.velocityMicroQps.y<=0&&s.mode!=='rising';
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
  const horizontal=input.rootMotion?{
    velocity:{x:input.rootMotion.deltaQ.x*c.tickRate*MICRO,y:0,z:input.rootMotion.deltaQ.z*c.tickRate*MICRO},
    displacement:{x:input.rootMotion.deltaQ.x*MICRO,y:0,z:input.rootMotion.deltaQ.z*MICRO},remainder:0,
  }:accelerate({x:s.velocityMicroQps.x,y:0,z:s.velocityMicroQps.z},target,onGround?(s.move.xQ===0&&s.move.zQ===0?c.brakeQps2:c.accelQps2):c.airControlQps2,c.tickRate,s.accelRemainder);
  if(input.rootMotion){
    // Changing horizontal authority cannot carry a fractional velocity-integrated
    // displacement into the paired, already-quantized root trajectory.
    s.positionRemainderQ.x=0;s.positionRemainderQ.z=0;
    for(const k of ['x','z'] as const)integer(horizontal.velocity[k],'root velocity projection',-10000000*MICRO,10000000*MICRO);
  }
  s.velocityMicroQps.x=horizontal.velocity.x;s.velocityMicroQps.z=horizontal.velocity.z;s.accelRemainder=horizontal.remainder;
  let verticalDisplacement=0;
  if(onGround&&!jumped){s.velocityMicroQps.y=0;s.gravityRemainder=0;}
  else {const vertical=accelerate({x:0,y:s.velocityMicroQps.y,z:0},{x:0,y:-c.terminalFallSpeedQps*MICRO,z:0},c.gravityQps2,c.tickRate,s.gravityRemainder);s.velocityMicroQps.y=vertical.velocity.y;s.gravityRemainder=vertical.remainder;verticalDisplacement=vertical.displacement.y;if(s.velocityMicroQps.y<=0)mode(s,'falling');}
  const displacement={x:horizontal.displacement.x,y:verticalDisplacement,z:horizontal.displacement.z};const desired=zero() as Mutable<Vector>;
  for(const k of axes){const numerator=BigInt(s.positionRemainderQ[k])+BigInt(displacement[k]);desired[k]=safe(numerator/BigInt(MICRO));s.positionRemainderQ[k]=safe(numerator%BigInt(MICRO));}
  if(sq(desired)>BigInt(c.collision.maxDeltaQ)**2n)fail('delta budget');const oldPosition={...s.positionQ};const impactSpeed=Math.max(0,Math.trunc(-s.velocityMicroQps.y/MICRO));
  const mayGround=!!c.ground&&onGround&&!jumped&&['grounded','landing','recovering'].includes(previous.mode);
  const budget:SweepBudget|undefined=mayGround?{iterations:0,contacts:0,pathQ:0n}:undefined;
  const beforeSweep=mayGround?copy(s):undefined;
  let contacts=sweepSlide(c,s,desired,boxes,budget);
  if(beforeSweep&&budget&&supportBefore){const route=groundRoute(c,beforeSweep,s,desired,contacts,boxes,supportBefore,budget);Object.assign(s,route.state);contacts=route.contacts;}
  if(contacts.length)blockedReasons.push('collision');if(contacts.some(x=>x.normalQ.y<0)&&s.mode==='rising'){s.velocityMicroQps.y=0;mode(s,'falling');}
  const supportAfter=s.velocityMicroQps.y<=0?support(c,s.positionQ,s.stance,boxes,supportBefore,mayGround):undefined;
  if(supportAfter){s.supportId=supportAfter;s.velocityMicroQps.y=0;if(s.mode==='falling'||s.mode==='rising'||jumped){s.landingInstance++;mode(s,'landing');events.push({kind:'land',id:'land:'+s.landingInstance,instance:s.landingInstance,obstacleId:supportAfter,impactSpeedQps:impactSpeed});}}
  else {delete s.supportId;mode(s,s.velocityMicroQps.y>0?'rising':'falling');}
  vector(s.positionQ,'accepted position',POSITION_LIMIT);
  const accepted={x:s.positionQ.x-oldPosition.x,y:s.positionQ.y-oldPosition.y,z:s.positionQ.z-oldPosition.z};
  if(sq(accepted)>BigInt(c.collision.maxDeltaQ)**2n)fail('accepted delta budget');
  validateCharacterMotorState(c,s);
  return {state:s,result:{desiredDeltaQ:{...desired},acceptedDeltaQ:accepted,contacts,blockedReasons},events};
}
