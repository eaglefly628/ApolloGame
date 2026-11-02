/** Pure bridge from world-facing movement data to motor facts and authoritative yaw.
 * No World mutation or renderer input. Host commits all actors atomically.
 */
import type {CharacterMotor3D,CharacterMotorIntent3D,CharacterMotorPlayback3D} from '../protocol/components/character-motor.js';
import {createCharacterMotor,stepCharacterMotor,validateCharacterMotorConfig,validateCharacterMotorState,type CharacterMotorObstacle,type CharacterMotorRootMotionRequest} from './character-motor.js';
import {advanceYaw,directionYawUnits,worldToLocalQ} from '../animation/yaw-fixed.js';
import {validateDriverTree} from '../protocol/components/animation-driver.js';
const Q=10000;
function fail(s:string):never{throw new Error('CharacterMotor3D: '+s);}
function int(v:unknown,min:number,max:number):asserts v is number{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)fail('integer range');}
function fields(v:unknown,required:string[],optional:string[]=[]):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))fail('object required');const r=v as Record<string,unknown>;if(required.some(k=>!Object.hasOwn(r,k))||Object.keys(r).some(k=>!required.includes(k)&&!optional.includes(k)))fail('closed fields');return r;}
function canonical(v:unknown):string{if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}';}
function vector(v:unknown,limit:number):void{const r=fields(v,['x','y','z']);for(const x of ['x','y','z'])int(r[x],-limit,limit);}
function sqrtFloor(n:bigint):bigint{if(n<2n)return n;let x=1n<<BigInt(Math.ceil(n.toString(2).length/2)),y=(x+n/x)/2n;while(y<x){x=y;y=(x+n/x)/2n;}return x;}
function facing(v:unknown,seq:boolean):void{const r=fields(v,[...(seq?['seq']:[]),'mode','xQ','zQ']);if(seq)int(r.seq,1,Number.MAX_SAFE_INTEGER-1);if(r.mode!=='move'&&r.mode!=='direction')fail('facing mode');int(r.xQ,-Q,Q);int(r.zQ,-Q,Q);}
function desiredSpeed(c:CharacterMotor3D,m:CharacterMotorPlayback3D['motor']):number{const speed=m.stance==='crouched'?c.motion.maxCrouchSpeedQps:m.move.gait==='run'?c.motion.maxRunSpeedQps:c.motion.maxWalkSpeedQps;const n=sqrtFloor(BigInt(m.move.xQ)**2n+BigInt(m.move.zQ)**2n);return Number(BigInt(speed)*(n>BigInt(Q)?BigInt(Q):n)/BigInt(Q));}
function yawTarget(p:CharacterMotorPlayback3D):number{const v=p.facing.mode==='move'?{xQ:p.motor.move.xQ,zQ:p.motor.move.zQ}:p.facing;return directionYawUnits(v.xQ,v.zQ,p.yawUnits);}
function yawError(yaw:number,target:number):number{const error=((target-yaw+32768)%65536+65536)%65536-32768;return error===-32768?32768:error;}
export function validateCharacterMotor3D(value:unknown):CharacterMotor3D{
 validateDriverTree(value);const c=fields(value,['type','version','motion','initial','maxTurnUnitsPerSecond']);if(c.type!=='CharacterMotor3D'||c.version!==1)fail('config version');
 const motion=validateCharacterMotorConfig(c.motion),initial=fields(c.initial,['positionQ','stance','yawUnits']);vector(initial.positionQ,1e9);if(initial.stance!=='standing'&&initial.stance!=='crouched')fail('initial stance');int(initial.yawUnits,0,65535);int(c.maxTurnUnitsPerSecond,0,655360);
 if(motion.collision.maxDeltaQ*motion.tickRate>1e9)fail('accepted-speed projection budget');return value as CharacterMotor3D;
}
export function validateCharacterMotorIntent3D(value:unknown):CharacterMotorIntent3D{
 validateDriverTree(value);const r=fields(value,['type','version'],['move','jump','facing']);if(r.type!=='CharacterMotorIntent3D'||r.version!==1)fail('intent version');
 if(r.move!==undefined){const m=fields(r.move,['seq','xQ','zQ','gait','stance']);int(m.seq,1,Number.MAX_SAFE_INTEGER-1);int(m.xQ,-Q,Q);int(m.zQ,-Q,Q);if(m.gait!=='walk'&&m.gait!=='run')fail('gait');if(m.stance!=='standing'&&m.stance!=='crouched')fail('stance');}
 if(r.jump!==undefined)int(fields(r.jump,['seq']).seq,1,Number.MAX_SAFE_INTEGER-1);if(r.facing!==undefined)facing(r.facing,true);return value as CharacterMotorIntent3D;
}
function facts(c:CharacterMotor3D,p:CharacterMotorPlayback3D):CharacterMotorPlayback3D['facts']{
 const delta=p.result.acceptedDeltaQ,rate=c.motion.tickRate,local=worldToLocalQ(delta.x*rate,delta.z*rate,p.yawUnits);
 return{seq:p.motor.tick,localLateralQps:local.lateralQ,localForwardQps:local.forwardQ,acceptedDistanceQ:Number(sqrtFloor(BigInt(delta.x)**2n+BigInt(delta.z)**2n)),desiredSpeedQps:desiredSpeed(c,p.motor),mode:p.motor.mode==='rising'?'rising':p.motor.mode==='falling'?'falling':'grounded',stance:p.motor.stance,yawErrorUnits:yawError(p.yawUnits,yawTarget(p)),jumpInstance:p.motor.jumpInstance,landingInstance:p.motor.landingInstance};
}
export function validateCharacterMotorPlayback3D(c:CharacterMotor3D,value:unknown):CharacterMotorPlayback3D{
 validateCharacterMotor3D(c);validateDriverTree(value);const p=fields(value,['type','version','configCanonical','motor','yawUnits','yawRemainder','lastFacingSeq','facing','facts','result','events']);
 if(p.type!=='CharacterMotorPlayback3D'||p.version!==1||p.configCanonical!==canonical(c))fail('playback identity');validateCharacterMotorState(c.motion,p.motor);int(p.yawUnits,0,65535);int(p.yawRemainder,0,c.motion.tickRate-1);int(p.lastFacingSeq,0,Number.MAX_SAFE_INTEGER-1);facing(p.facing,false);
 const result=fields(p.result,['desiredDeltaQ','acceptedDeltaQ','contacts','blockedReasons']);vector(result.desiredDeltaQ,c.motion.collision.maxDeltaQ);vector(result.acceptedDeltaQ,c.motion.collision.maxDeltaQ);
 if(!Array.isArray(result.contacts)||result.contacts.length>c.motion.collision.maxContacts)fail('contacts');for(const contact of result.contacts){const h=fields(contact,['obstacleId','timeQ','normalQ']);if(typeof h.obstacleId!=='string'||!h.obstacleId.length||h.obstacleId.length>128)fail('contact id');int(h.timeQ,0,1e9);vector(h.normalQ,1e6);}
 if(!Array.isArray(result.blockedReasons)||result.blockedReasons.length>5||result.blockedReasons.some(x=>!['collision','stand-blocked','jump-not-grounded','jump-crouched','jump-ceiling'].includes(x)))fail('blocked reasons');
 if(!Array.isArray(p.events)||p.events.length>2)fail('events');const eventKinds=new Set<string>();let eventActor:string|undefined;for(const event of p.events){const e=fields(event,['kind','id','instance'],['obstacleId','impactSpeedQps']);if(e.kind!=='jump'&&e.kind!=='land')fail('event kind');if(typeof e.id!=='string'||!e.id.length||e.id.length>512)fail('event id');int(e.instance,1,Number.MAX_SAFE_INTEGER-1);if(e.obstacleId!==undefined&&(typeof e.obstacleId!=='string'||e.obstacleId.length>128))fail('obstacle id');if(e.impactSpeedQps!==undefined)int(e.impactSpeedQps,0,1e7);const motor=(value as CharacterMotorPlayback3D).motor,counter=e.kind==='jump'?motor.jumpInstance:motor.landingInstance,suffix=`:${e.kind}:${e.instance}`;if(e.instance!==counter||!(e.id as string).endsWith(suffix)||(e.id as string).length<=suffix.length||eventKinds.has(e.kind as string))fail('event lifecycle identity');eventKinds.add(e.kind as string);const actor=(e.id as string).slice(0,-suffix.length);if(eventActor!==undefined&&eventActor!==actor)fail('event actor mismatch');eventActor=actor;if(e.kind==='land'?(e.obstacleId!==motor.supportId||e.impactSpeedQps===undefined):(e.obstacleId!==undefined||e.impactSpeedQps!==undefined))fail('event payload mismatch');}
 // Facts are a projection, not a second user-controlled truth.
 if(canonical(p.facts)!==canonical(facts(c,value as CharacterMotorPlayback3D)))fail('facts projection mismatch');return value as CharacterMotorPlayback3D;
}
export function createCharacterMotorPlayback3D(c:CharacterMotor3D,obstacles:readonly CharacterMotorObstacle[]):CharacterMotorPlayback3D{
 validateCharacterMotor3D(c);const m=createCharacterMotor(c.motion,{positionQ:c.initial.positionQ,stance:c.initial.stance},obstacles);const zero=()=>({x:0,y:0,z:0});
 const p={type:'CharacterMotorPlayback3D' as const,version:1 as const,configCanonical:canonical(c),motor:m,yawUnits:c.initial.yawUnits,yawRemainder:0,lastFacingSeq:0,facing:{mode:'move' as const,xQ:0,zQ:0},result:{desiredDeltaQ:zero(),acceptedDeltaQ:zero(),contacts:[],blockedReasons:[]},events:[],facts:null as unknown as CharacterMotorPlayback3D['facts']};p.facts=facts(c,p);validateCharacterMotorPlayback3D(c,p);return p;
}
export function stepCharacterMotorPlayback3D(c:CharacterMotor3D,previous:CharacterMotorPlayback3D,actorId:string,intent:CharacterMotorIntent3D|undefined,obstacles:readonly CharacterMotorObstacle[],rootMotion?:(CharacterMotorRootMotionRequest&{readonly yawDeltaUnits:number})):CharacterMotorPlayback3D{
 validateCharacterMotorPlayback3D(c,previous);if(typeof actorId!=='string'||!actorId.length||actorId.length>256)fail('actor identity');if(intent!==undefined)validateCharacterMotorIntent3D(intent);
 if(rootMotion!==undefined){validateDriverTree(rootMotion);fields(rootMotion,['requestId','deltaQ','yawDeltaUnits']);int(rootMotion.yawDeltaUnits,-65536,65536);if(intent?.facing)fail('root motion and facing intent are exclusive');}
 const result=stepCharacterMotor(c.motion,previous.motor,{obstacles,...(intent?.move?{move:intent.move}:{}),...(intent?.jump?{jump:intent.jump}:{}),...(rootMotion?{rootMotion:{requestId:rootMotion.requestId,deltaQ:rootMotion.deltaQ}}:{})});
 let direction=previous.facing,lastFacingSeq=previous.lastFacingSeq;if(intent?.facing&&intent.facing.seq>lastFacingSeq){const {seq,...v}=intent.facing;direction={...v};lastFacingSeq=seq;}
 const p={...previous,motor:result.state,facing:direction,lastFacingSeq,result:result.result,events:result.events.map(e=>({...e,id:`${actorId}:${e.id}`}))};
 if(rootMotion){
  // The upright capsule is yaw-invariant. A quantized root yaw therefore has
  // no separate rotational collision sweep and cannot also face a velocity target.
  p.yawUnits=((previous.yawUnits+rootMotion.yawDeltaUnits)%65536+65536)%65536;p.yawRemainder=0;p.facing={mode:'move',xQ:0,zQ:0};
 }else{const turn=advanceYaw(previous.yawUnits,yawTarget(p),c.maxTurnUnitsPerSecond,c.motion.tickRate,previous.yawRemainder);p.yawUnits=turn.yawUnits;p.yawRemainder=turn.remainder;}
 p.facts=facts(c,p);validateCharacterMotorPlayback3D(c,p);return p;
}
