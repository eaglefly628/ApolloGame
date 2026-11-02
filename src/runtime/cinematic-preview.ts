import {validateFacePoses} from '@assembly/face-poses.js';
import {validateAnimationCueSignals} from '@assembly/animation-cue-signals.js';
/** D6 common-clock preview host. All actors share World ticks. UI pause freezes
 * the whole scene, including gravity; animation-only pause commands keep their
 * original semantics. This host does not dispatch external audio/gameplay effects.
 * Seek restores the baseline and resimulates cue data, never edits bone poses. */
import type {Engine} from './engine.js';
import type {WorldSnapshot} from '@engine/core/types.js';
import {validateDriverTree,driverFields,driverInt,validateAnimationDriverCommand3D,type AnimationDriverOperation,type AnimationDriver3D} from '@engine/protocol/components/animation-driver.js';
import {validateAnimationPerformanceCommand3D,type PerformanceOperation,type AnimationPerformance3D} from '@engine/protocol/components/animation-performance.js';
import {validateLocomotionCommand3D} from '@engine/animation/locomotion-envelope.js';
import type {LocomotionCommand} from '@engine/animation/locomotion-driver.js';
import {validateCharacterMotorIntent3D} from '@engine/spatial/character-motor-driver.js';
import type {CharacterMotorIntent3D} from '@engine/protocol/components/character-motor.js';
import {validateAnimationDrivers} from '@assembly/animation-drivers.js';
import {validateCharacterMotors} from '@assembly/character-motors.js';
import {validateLocomotionDrivers} from '@assembly/locomotion-drivers.js';
import {validateAnimationPerformances} from '@assembly/animation-performances.js';
import {validateLocomotionCharacters} from '@assembly/locomotion-characters.js';
import {validateRootMotions} from '@assembly/root-motions.js';
import {validateBoneSocketReferences} from '@assembly/bone-sockets.js';
import {canonicalCharacterData} from '@engine/animation/locomotion-character.js';

export type CinematicCue={readonly atFrame:number;readonly actorId:string}&(
 {readonly kind:'animation-driver';readonly operation:AnimationDriverOperation}|
 {readonly kind:'performance';readonly operation:PerformanceOperation}|
 {readonly kind:'locomotion';readonly operation:LocomotionCommand}|
 {readonly kind:'motor';readonly intent:Omit<CharacterMotorIntent3D,'type'|'version'>});
export interface CinematicPreviewProgram {readonly version:1;readonly tickRate:number;readonly durationFrames:number;readonly maxSeekSteps:number;readonly cues:readonly CinematicCue[];}
export interface CinematicPreviewCheckpoint {readonly version:1;readonly programIdentity:string;readonly frame:number;readonly world:WorldSnapshot;readonly order:readonly string[];}
const clone=<T>(v:T):T=>structuredClone(v);
function fail(s:string):never{throw Error('cinematic-preview: '+s);}
const commandType={ 'animation-driver':'AnimationDriverCommand3D',performance:'AnimationPerformanceCommand3D',locomotion:'LocomotionCommand3D'} as const;
function comparableWorld(snapshot:WorldSnapshot):string{
 const data=clone(snapshot);for(const row of Object.values(data))delete row.DebugTrace;
 return canonicalCharacterData(data);
}

function validateProgram(engine:Engine,raw:unknown):CinematicPreviewProgram {
 validateDriverTree(raw);const r=driverFields(raw,['version','tickRate','durationFrames','maxSeekSteps','cues'],'cinematic program');
 if(r.version!==1)fail('program version');driverInt(r.tickRate,'tickRate',1,240);if(r.tickRate!==engine.tickRate)fail('program/Engine tickRate mismatch');
 driverInt(r.durationFrames,'durationFrames',1,36000);driverInt(r.maxSeekSteps,'maxSeekSteps',1,36001);
 if(!Array.isArray(r.cues)||r.cues.length>2048)fail('cue budget');
 const lastSeq=new Map<string,number>();let lastFrame=-1;
 for(const value of r.cues){
  if(!value||typeof value!=='object'||Array.isArray(value))fail('cue object');
  const kind=Object.getOwnPropertyDescriptor(value,'kind')?.value;
  const c=driverFields(value,['atFrame','actorId','kind',kind==='motor'?'intent':'operation'],'cue');
  driverInt(c.atFrame,'atFrame',0,r.durationFrames as number);if(c.atFrame<lastFrame)fail('cues must be sorted by frame');lastFrame=c.atFrame;
  if(typeof c.actorId!=='string'||!c.actorId.length||!engine.world.query().some(([id])=>id===c.actorId))fail('cue actor missing');
  const actor=c.actorId;
  const sequence=(seq:unknown,part:string)=>{
   driverInt(seq,'cue seq',1);const key=JSON.stringify([actor,part]);let prior=lastSeq.get(key);
   if(prior===undefined){
    const name=part==='animation-driver'?'AnimationDriverPlayback3D':part==='performance'?'AnimationPerformancePlayback3D':part==='locomotion'?'LocomotionPlayback3D':'CharacterMotorPlayback3D';
    const saved=engine.world.getComponent<any>(actor,name);if(saved)validateDriverTree(saved);
    prior=part==='locomotion'?(saved?.playback?.lastCommandSeq??0):part==='animation-driver'||part==='performance'?(saved?.lastCommandSeq??0):part==='move'?(saved?.motor?.lastMoveSeq??0):part==='jump'?(saved?.motor?.lastJumpSeq??0):(saved?.lastFacingSeq??0);
   }
   if(seq<=prior!)fail('cue sequences must exceed baseline and increase per actor/channel');lastSeq.set(key,seq);
  };
  if(kind==='animation-driver'){
   const cfg=engine.world.getComponent<AnimationDriver3D>(actor,'AnimationDriver3D');if(!cfg)fail('animation cue needs D1 base');
   validateAnimationDriverCommand3D({type:'AnimationDriverCommand3D',version:1,commands:[c.operation]});
   const op=c.operation as AnimationDriverOperation;if(op.op==='play'&&!Object.hasOwn(cfg.graph.states,op.state))fail('unknown animation state');sequence(op.seq,kind);
  }else if(kind==='performance'){
   const cfg=engine.world.getComponent<AnimationPerformance3D>(actor,'AnimationPerformance3D');if(!cfg)fail('montage cue needs performance configuration');
   validateAnimationPerformanceCommand3D(cfg,{type:'AnimationPerformanceCommand3D',version:1,commands:[c.operation]});sequence((c.operation as PerformanceOperation).seq,kind);
  }else if(kind==='locomotion'){
   if(!engine.world.hasComponent(actor,'LocomotionDriver3D'))fail('locomotion cue needs configuration');
   validateLocomotionCommand3D({type:'LocomotionCommand3D',version:1,commands:[c.operation]});sequence((c.operation as LocomotionCommand).seq,kind);
  }else if(kind==='motor'){
   if(!engine.world.hasComponent(actor,'CharacterMotor3D'))fail('motor cue needs configuration');
   driverFields(c.intent,['move','jump','facing'],'motor cue intent');
   const intent=validateCharacterMotorIntent3D({...(c.intent as object),type:'CharacterMotorIntent3D',version:1});
   for(const part of ['move','jump','facing'] as const)if(intent[part])sequence(intent[part]!.seq,part);
  }else fail('unknown cue kind');
 }
 return clone(raw as CinematicPreviewProgram);
}

export class CinematicPreviewSession {
 readonly #program:CinematicPreviewProgram;
 readonly #engine:Engine;readonly #baseline:WorldSnapshot;readonly #order:readonly string[];readonly #identity:string;
 #frame=-1;#playing=false;
 constructor(engine:Engine,program:CinematicPreviewProgram){
  this.#program=validateProgram(engine,program);this.#engine=engine;engine.stop();
  this.#baseline=engine.world.snapshot();this.#order=engine.world.snapshotOrder();
  this.#identity=JSON.stringify({program:this.#program,baseline:this.#baseline,order:this.#order});
 }
 get program():CinematicPreviewProgram{return clone(this.#program);}
 get frame():number{return this.#frame;}
 get playing():boolean{return this.#playing;}
 play():void{this.#engine.stop();this.#playing=true;}
 pause():void{this.#playing=false;this.#engine.stop();}
 #guard():void{if(this.#engine.isRunning)fail('live Engine clock conflicts with preview clock');if(this.#engine.tickRate!==this.#program.tickRate)fail('Engine clock changed');}
 #one():void{
  const frame=this.#frame+1;if(frame>this.#program.durationFrames){this.#playing=false;return;}
  const groups=new Map<string,{actorId:string;type:string;commands:unknown[]}>();
  for(const cue of this.#program.cues){if(cue.atFrame!==frame)continue;
   if(cue.kind==='motor'){
    const previous=this.#engine.world.getComponent<CharacterMotorIntent3D>(cue.actorId,'CharacterMotorIntent3D');
    this.#engine.world.addComponent(cue.actorId,{...previous,...clone(cue.intent),type:'CharacterMotorIntent3D',version:1});
   }else{
    const type=commandType[cue.kind],key=JSON.stringify([cue.actorId,type]);let group=groups.get(key);
    if(!group){group={actorId:cue.actorId,type,commands:[]};groups.set(key,group);}group.commands.push(clone(cue.operation));
   }
  }
  for(const group of groups.values())this.#engine.world.addComponent(group.actorId,{type:group.type,version:1,commands:group.commands} as any);
  this.#engine.world.tick();this.#frame=frame;
 }
 #transaction(run:()=>void):void{
  this.#guard();const old=this.#engine.world.snapshot(),order=this.#engine.world.snapshotOrder(),frame=this.#frame,playing=this.#playing;
  try{run();}catch(error){this.#engine.world.restore(old,order);this.#frame=frame;this.#playing=playing;throw error;}
  this.#engine.renderSnapshot();
 }
 /** Manual single-frame stepping is available while paused. */
 step():void{this.#transaction(()=>this.#one());}
 /** Host uses the existing FixedStepClock to determine count; no second actor clock. */
 advance(count:number):void{driverInt(count,'preview step count',0,240);if(!this.#playing||count===0)return;this.#transaction(()=>{for(let i=0;i<count&&this.#playing;i++)this.#one();});}
 seek(frame:number):void{
  driverInt(frame,'preview frame',0,this.#program.durationFrames);if(frame+1>this.#program.maxSeekSteps)fail('seek replay budget');
  this.#transaction(()=>{this.#engine.world.restore(clone(this.#baseline),this.#order);this.#frame=-1;for(let i=0;i<=frame;i++)this.#one();});
 }
 checkpoint():CinematicPreviewCheckpoint{return{version:1,programIdentity:this.#identity,frame:this.#frame,world:this.#engine.world.snapshot(),order:this.#engine.world.snapshotOrder()};}
 restore(raw:CinematicPreviewCheckpoint):void{
  validateDriverTree(raw);const c=driverFields(raw,['version','programIdentity','frame','world','order'],'preview checkpoint');
  if(c.version!==1||c.programIdentity!==this.#identity)fail('checkpoint belongs to a different program/baseline');driverInt(c.frame,'checkpoint frame',-1,this.#program.durationFrames);
  if(!Array.isArray(c.order)||c.order.some(id=>typeof id!=='string')||new Set(c.order).size!==c.order.length||!c.world||typeof c.world!=='object'||Array.isArray(c.world)||c.order.length!==Object.keys(c.world).length||c.order.some(id=>!Object.hasOwn(c.world as object,id)))fail('checkpoint order/world mismatch');
  const entities=c.world as Record<string,unknown>;
  validateAnimationDrivers(entities,this.#program.tickRate);validateCharacterMotors(entities,this.#program.tickRate);validateLocomotionDrivers(entities,this.#program.tickRate);validateAnimationPerformances(entities,this.#program.tickRate);validateLocomotionCharacters(entities);
  validateRootMotions(entities,this.#program.tickRate);
  validateBoneSocketReferences(entities);
  validateFacePoses(entities);
  validateAnimationCueSignals(entities,this.#program.tickRate);
  if((c.frame as number)+1>this.#program.maxSeekSteps)fail('checkpoint replay budget');
  this.#transaction(()=>{
   // A program id alone cannot bind an arbitrary frame label to a World pose.
   // Replay validates cursor/cue/history consistency, including all actor clocks.
   this.#engine.world.restore(clone(this.#baseline),this.#order);this.#frame=-1;
   for(let i=0;i<=(c.frame as number);i++)this.#one();
   if(comparableWorld(this.#engine.world.snapshot())!==comparableWorld(c.world as WorldSnapshot)||JSON.stringify(this.#engine.world.snapshotOrder())!==JSON.stringify(c.order))fail('checkpoint frame/world does not match replay');
   this.#engine.world.restore(clone(c.world as WorldSnapshot),c.order as string[]);this.#frame=c.frame as number;
  });
 }
}
