/** D1 deterministic full-body clock/weights only. No renderer, wall clock, world or event routing.
 * Ordering: new seq commands in array order -> (unless play/seek) first graph condition -> one tick.
 * Paused steps consume commands/increment host tick but freeze all animation clocks/fades.
 * play/seek suppress transitions and advancement for that step. Conditions never infer clip completion.
 * Each alias emits in lexical order; within alias: initial at0, crossed markers, complete, loop at0.
 * Markers use (old,new]; at0 occurs once on first positive advance and once on every wrap.
 * Boundary markers at duration precede completion; loop at0 belongs to the next cycle.
 * Zero-weight clips emit nothing. Overflow rejects whole step; callers retain their original snapshot.
 */
import type { AnimGraphState, AnimGraphTransition } from '../protocol/components/anim-graph.js';
import type { AnimationDriver3D, AnimationDriverPlayback3D, AnimationDriverEvent, AnimationDriverParams, AnimationDriverOperation,AnimationDriverTransition } from '../protocol/components/animation-driver.js';
import { ANIMATION_SUBTICKS, ANIMATION_MAX_EVENTS, animationDriverIdentity, driverFixed, driverReject, driverInt, driverFields, validateAnimationDriver3D, validateAnimationDriverCommand3D, validateAnimationDriverPlayback3D } from '../protocol/components/animation-driver.js';

type Mutable<T> = { -readonly [P in keyof T]: T[P] extends object ? Mutable<T[P]> : T[P] };
type Playback = Mutable<AnimationDriverPlayback3D>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const aliases = (config: AnimationDriver3D): string[] => Object.keys(config.clips).sort();
const zero = (config: AnimationDriver3D): Record<string,number> => Object.fromEntries(aliases(config).map(a=>[a,0]));
function paramsCheck(config: AnimationDriver3D, params: AnimationDriverParams): void {
  driverFields(params,Object.keys(config.graph.params),'params');
  for(const [alias,v] of Object.entries(params)) {
    if(v===undefined)continue;const source=config.graph.params[alias];
    if(source==='speed'?(typeof v!=='number'||!Number.isFinite(v)):source.startsWith('flag:')?typeof v!=='boolean':typeof v!=='string'||v.length>256)driverReject('parameter source type');
  }
}
function target(config: AnimationDriver3D, p: Playback, state: string, params: AnimationDriverParams): Record<string,number> {
  const data=config.graph.states[state];const w=zero(config);
  if(data.clip!==undefined) w[data.clip]=1;
  else {
    const {param,points}=data.blend;const value=params[param];if(typeof value!=='number')return {...p.targets[state]};
    if(value<=points[0].at)w[points[0].clip]=1;
    else if(value>=points[points.length-1].at)w[points[points.length-1].clip]=1;
    else for(let i=1;i<points.length;i++) {const left=points[i-1],right=points[i];if(value>right.at)continue;const span=right.at-left.at;const t=Number.isFinite(span)?(value-left.at)/span:(value/2-left.at/2)/(right.at/2-left.at/2);w[left.clip]+=1-t;w[right.clip]+=t;break;}
  }
  p.targets[state]={...w};return w;
}
function matches(t: Pick<AnimGraphTransition,'whenParam'|'cmp'|'value'>, params: AnimationDriverParams): boolean {
  const a=params[t.whenParam],b=t.value;if(a===undefined||typeof a!==typeof b)return false;
  switch(t.cmp){case'eq':return a===b;case'ne':return a!==b;case'gt':return typeof a==='number'&&typeof b==='number'&&a>b;case'gte':return typeof a==='number'&&typeof b==='number'&&a>=b;case'lt':return typeof a==='number'&&typeof b==='number'&&a<b;case'lte':return typeof a==='number'&&typeof b==='number'&&a<=b;}
}
function reset(p: Playback, alias: string): void {
  driverInt(p.nextInstance,'nextInstance',1,Number.MAX_SAFE_INTEGER-1);
  p.clips[alias]={cursorSubticks:0,cycle:0,instance:p.nextInstance++,started:false,completed:false};
}
function stateAliases(s: AnimGraphState): string[] {return s.clip!==undefined?[s.clip]:[...new Set(s.blend.points.map(p=>p.clip))];}
function enter(config: AnimationDriver3D,p: Playback,state: string,params: AnimationDriverParams,fadeTicks: number,preserveLive=false): void {
  const from={...p.weights};p.state=state;target(config,p,state,params);
  if(config.transitions!==undefined)p.stateElapsedTicks=0;
  // A condition changes graph state, not the identity of an already audible clip stream.
  // Explicit play/create use preserveLive=false, including aliases shared with the previous state.
  for(const a of stateAliases(config.graph.states[state]).sort())if(!preserveLive||from[a]===0)reset(p,a);
  if(fadeTicks)p.transition={elapsedTicks:0,durationTicks:fadeTicks,fromWeights:from};else delete p.transition;
}
function mix(config: AnimationDriver3D,p: Playback,params: AnimationDriverParams,advance: boolean): void {
  const goal=target(config,p,p.state,params);let f=p.transition;
  if(f&&advance){f={...f,elapsedTicks:Math.min(f.durationTicks,f.elapsedTicks+1)};p.transition=f;}
  const t=f?f.elapsedTicks/f.durationTicks:1;const old={...p.weights};
  for(const a of aliases(config)){p.weights[a]=f?f.fromWeights[a]*(1-t)+goal[a]*t:goal[a];if(p.weights[a]>0&&old[a]===0&&(p.clips[a].instance===0||p.clips[a].started||p.clips[a].cursorSubticks>0||p.clips[a].completed))reset(p,a);}
  if(f&&f.elapsedTicks===f.durationTicks)delete p.transition;
}
export function createAnimationDriver(config: AnimationDriver3D,params: AnimationDriverParams={}): AnimationDriverPlayback3D {
  validateAnimationDriver3D(config);paramsCheck(config,params);
  const p: Playback={type:'AnimationDriverPlayback3D',version:1,configIdentity:animationDriverIdentity(config),tick:0,state:config.initialState,paused:false,lastCommandSeq:0,nextInstance:1,clips:Object.fromEntries(aliases(config).map(a=>[a,{cursorSubticks:0,cycle:0,instance:0,started:false,completed:false}])),weights:zero(config),targets:Object.fromEntries(Object.keys(config.graph.states).map(s=>[s,zero(config)])),events:[]};
  enter(config,p,config.initialState,params,0);mix(config,p,params,false);return p;
}
function event(p: Playback,alias: string,type: 'notify'|'complete',atTick: number,notifyId?: string): void {
  if(p.events.length>=ANIMATION_MAX_EVENTS)driverReject('event budget exceeded');const c=p.clips[alias];
  const data: AnimationDriverEvent={id:`${c.instance}:${alias}:${c.cycle}:${type}:${notifyId??'end'}`,kind:type,alias,instance:c.instance,cycle:c.cycle,atTick,...(notifyId===undefined?{}:{notifyId})};p.events.push(data);
}
function advance(config: AnimationDriver3D,p: Playback,alias: string): void {
  const c=p.clips[alias],meta=config.clips[alias],clip=config.graph.clips[alias];let remaining=driverFixed(clip.speed??1,ANIMATION_SUBTICKS,'speed');
  if(!remaining||c.completed)return;
  const markers=[...(meta.notifies??[])].sort((a,b)=>a.atTick-b.atTick||(a.id<b.id?-1:a.id>b.id?1:0));
  if(!c.started){c.started=true;for(const n of markers)if(n.atTick===0)event(p,alias,'notify',0,n.id);}
  const duration=meta.durationTicks*ANIMATION_SUBTICKS;
  while(remaining>0){const before=c.cursorSubticks;const after=Math.min(duration,before+remaining);for(const n of markers)if(n.atTick*ANIMATION_SUBTICKS>before&&n.atTick*ANIMATION_SUBTICKS<=after)event(p,alias,'notify',n.atTick,n.id);
    remaining-=after-before;c.cursorSubticks=after;
    if(after===duration){event(p,alias,'complete',meta.durationTicks);if(!clip.loop){c.completed=true;break;}driverInt(c.cycle,'cycle',0,Number.MAX_SAFE_INTEGER-1);c.cycle++;c.cursorSubticks=0;for(const n of markers)if(n.atTick===0)event(p,alias,'notify',0,n.id);}
  }
}
/** New seqs apply in order. Consumed seqs are strict-shape/reference checked then ignored, even if their old payload changed.
 * This is an idempotency cursor, not historical payload authentication; no unbounded command journal is retained. */
export function stepAnimationDriver(config: AnimationDriver3D,playback: AnimationDriverPlayback3D,input: {readonly params?: AnimationDriverParams;readonly commands?: readonly AnimationDriverOperation[]}={}): {playback:AnimationDriverPlayback3D;events:readonly AnimationDriverEvent[]} {
  validateAnimationDriverPlayback3D(config,playback);driverFields(input,['params','commands'],'step input');const params=input.params??{};paramsCheck(config,params);
  const commands=input.commands??[];validateAnimationDriverCommand3D({type:'AnimationDriverCommand3D',version:1,commands});
  for(const c of commands)if(c.op==='play'&&!Object.hasOwn(config.graph.states,c.state))driverReject('play state missing reference');
  const p=clone(playback) as Playback;p.events=[];driverInt(p.tick,'tick',0,Number.MAX_SAFE_INTEGER-1);p.tick++;let controlled=false;
  for(const c of commands){if(c.seq<=p.lastCommandSeq)continue;p.lastCommandSeq=c.seq;
    if(c.op==='play'){if(!Object.hasOwn(config.graph.states,c.state))driverReject('play state missing reference');enter(config,p,c.state,params,0);mix(config,p,params,false);p.paused=false;controlled=true;}
    else if(c.op==='pause')p.paused=true;
    else if(c.op==='resume')p.paused=false;
    else {for(const a of aliases(config)){if(p.weights[a]===0)continue;const clock=p.clips[a],duration=config.clips[a].durationTicks;clock.cursorSubticks=(config.graph.clips[a].loop?c.tick%duration:Math.min(c.tick,duration))*ANIMATION_SUBTICKS;clock.cycle=config.graph.clips[a].loop?Math.floor(c.tick/duration):0;clock.completed=!config.graph.clips[a].loop&&c.tick>=duration;clock.started=true;}if(config.transitions!==undefined)p.stateElapsedTicks=c.tick;controlled=true;}
  }
  if(!p.paused&&!controlled){
    if(config.transitions!==undefined){
      let selected:AnimationDriverTransition|undefined;
      for(const rule of config.transitions){
        if(rule.from!==p.state||(p.stateElapsedTicks??0)<rule.minStateTicks||selected&&selected.priority>=rule.priority)continue;
        if(rule.all.every(c=>c.kind==='complete'?p.clips[c.clip].completed:matches({whenParam:c.param,cmp:c.cmp,value:c.value},params)))selected=rule;
      }
      if(selected)enter(config,p,selected.to,params,selected.fadeTicks,true);
    }else{const t=config.graph.transitions.find(t=>t.from===p.state&&matches(t,params));if(t)enter(config,p,t.to,params,driverFixed(t.fade,config.tickRate,'fade'),true);}
    mix(config,p,params,true);for(const a of aliases(config))if(p.weights[a]>0)advance(config,p,a);
    if(config.transitions!==undefined){driverInt(p.stateElapsedTicks,'state age',0,999999999);p.stateElapsedTicks++;}
  }
  validateAnimationDriverPlayback3D(config,p);return{playback:p,events:p.events};
}
/** Pure absolute renderer sampling; snapshot weights and times are authoritative. */
export function projectAnimationDriver(config: AnimationDriver3D,playback: AnimationDriverPlayback3D): {samples:Readonly<Record<string,{readonly timeSeconds:number;readonly weight:number}>>} {
  validateAnimationDriverPlayback3D(config,playback);return{samples:Object.fromEntries(aliases(config).map(a=>[a,{timeSeconds:playback.clips[a].cursorSubticks/(ANIMATION_SUBTICKS*config.tickRate),weight:playback.weights[a]}]))};
}
