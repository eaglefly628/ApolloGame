import { t } from '../../core/schema.js';
import type { Component } from '../../core/types.js';
import type { AnimGraph3D, AnimGraphParamValue } from './anim-graph.js';
import { validateAnimGraph3D } from './anim-graph.js';
import { fnv1a32 } from '../../math/hash.js';

export const ANIMATION_SUBTICKS = 1000;
export const ANIMATION_MAX_EVENTS = 1024;
export interface AnimationDriverTiming { readonly durationTicks: number; readonly notifies?: readonly { readonly id: string; readonly atTick: number }[] }
export type AnimationDriverCondition=
 |{readonly kind:'param';readonly param:string;readonly cmp:'eq'|'ne'|'gt'|'gte'|'lt'|'lte';readonly value:number|string|boolean}
 |{readonly kind:'complete';readonly clip:string};
export interface AnimationDriverTransition {readonly from:string;readonly to:string;readonly priority:number;readonly minStateTicks:number;readonly fadeTicks:number;readonly all:readonly AnimationDriverCondition[];}
/** D1 full-body/1D only. Each graph clip must explicitly declare loop. */
export interface AnimationDriver3D extends Component {
  readonly type: 'AnimationDriver3D'; readonly version: 1; readonly graph: AnimGraph3D;
  readonly tickRate: number; readonly initialState: string; readonly clips: Readonly<Record<string, AnimationDriverTiming>>;
  /** Optional D1 extension: AND conditions, clip completion and explicit ordered
   * priorities. Embedded legacy graph transitions must be empty in this mode. */
  readonly transitions?:readonly AnimationDriverTransition[];
}
export type AnimationDriverOperation =
  | { readonly seq: number; readonly op: 'play'; readonly state: string }
  | { readonly seq: number; readonly op: 'pause' }
  | { readonly seq: number; readonly op: 'resume' }
  | { readonly seq: number; readonly op: 'seek'; readonly tick: number };
export interface AnimationDriverCommand3D extends Component { readonly type: 'AnimationDriverCommand3D'; readonly version: 1; readonly commands: readonly AnimationDriverOperation[] }
export interface AnimationDriverEvent {
  readonly id: string; readonly kind: 'notify' | 'complete'; readonly alias: string;
  readonly instance: number; readonly cycle: number; readonly atTick: number; readonly notifyId?: string;
}
export interface AnimationDriverCursor { readonly cursorSubticks: number; readonly cycle: number; readonly instance: number; readonly started: boolean; readonly completed: boolean }
export interface AnimationDriverPlayback3D extends Component {
  readonly type: 'AnimationDriverPlayback3D'; readonly version: 1;
  readonly configIdentity: { readonly canonical: string; readonly fnv: number };
  readonly tick: number; readonly state: string; readonly paused: boolean; readonly lastCommandSeq: number; readonly nextInstance: number;
  readonly stateElapsedTicks?:number;
  readonly clips: Readonly<Record<string, AnimationDriverCursor>>;
  readonly weights: Readonly<Record<string, number>>;
  readonly targets: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly transition?: { readonly elapsedTicks: number; readonly durationTicks: number; readonly fromWeights: Readonly<Record<string, number>> };
  readonly events: readonly AnimationDriverEvent[];
}
export type AnimationDriverParams = Readonly<Record<string, AnimGraphParamValue>>;
export function driverReject(message: string): never { throw new Error(`AnimationDriver3D: ${message}`); }
/** No prototypes, accessors, symbols, cycles/shared references, undefined or nonfinite JSON values. */
export function validateDriverTree(value: unknown): void {
  const seen = new WeakSet<object>(); let count = 0;
  const visit = (v: unknown, depth: number): void => {
    if (++count > 100000 || depth > 24) driverReject('data tree budget');
    if (typeof v === 'number') { if (!Number.isFinite(v)) driverReject('nonfinite data'); return; }
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return;
    if (!v || typeof v !== 'object') driverReject('JSON data required');
    if (seen.has(v)) driverReject('cyclic/shared data references'); seen.add(v);
    if (Object.getOwnPropertySymbols(v).length) driverReject('symbol fields');
    if (Array.isArray(v)) {
      if(Object.getPrototypeOf(v)!==Array.prototype)driverReject('plain array required');
      if (v.length > 4096 || Object.keys(v).length !== v.length || Object.getOwnPropertyNames(v).length!==v.length+1) driverReject('array budget/sparse/extra fields');
    } else {if (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) driverReject('plain data required');if(Object.getOwnPropertyNames(v).length!==Object.keys(v).length)driverReject('hidden data fields');}
    for (const k of Object.keys(v)) {
      if (['__proto__','constructor','prototype'].includes(k)) driverReject('unsafe field');
      const d = Object.getOwnPropertyDescriptor(v,k)!; if (!('value' in d)) driverReject('accessor field'); visit(d.value,depth+1);
    }
  }; visit(value,0);
}
export function driverFields(v: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) driverReject(`${label} object required`);
  if(Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)driverReject(`${label} plain object required`);
  if(Object.getOwnPropertySymbols(v).length||Object.getOwnPropertyNames(v).length!==Object.keys(v).length)driverReject(`${label} hidden fields`);
  for(const d of Object.values(Object.getOwnPropertyDescriptors(v)))if(!('value' in d))driverReject(`${label} accessor field`);
  const r = v as Record<string, unknown>; for (const k of Object.keys(r)) if (!keys.includes(k)) driverReject(`${label} unknown field ${k}`); return r;
}
export function driverInt(v: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER): asserts v is number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) driverReject(`${label} integer ${min}..${max} required`);
}
function exactKeys(v: unknown, names: readonly string[], label: string): Record<string, unknown> {
  const r = driverFields(v,names,label); if (Object.keys(r).length !== names.length || names.some(n => !Object.hasOwn(r,n))) driverReject(`${label} aliases mismatch`); return r;
}
function reference(v: unknown, table: object, label: string): asserts v is string { if (typeof v !== 'string' || !Object.hasOwn(table,v)) driverReject(`${label} missing reference`); }
function bool(v: unknown, label: string): void { if (typeof v !== 'boolean') driverReject(`${label} boolean required`); }
export function driverFixed(v: number, scale: number, label: string): number {
  const n = Math.round(v*scale); if (!Number.isSafeInteger(n) || n/scale!==v) driverReject(`${label} exceeds fixed precision`); return n;
}
function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '['+v.map(canonical).join(',')+']';
  return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}';
}
/** Canonical bytes are authoritative; FNV is only a diagnostic digest. */
export function animationDriverIdentity(config: AnimationDriver3D): { canonical: string; fnv: number } {
  const text=canonical(config); return {canonical:text,fnv:fnv1a32(text)};
}
export function validateAnimationDriver3D(value: unknown): AnimationDriver3D {
  validateDriverTree(value); const d=driverFields(value,['type','version','graph','tickRate','initialState','clips','transitions'],'config');
  if (d.type!=='AnimationDriver3D'||d.version!==1) driverReject('config type/version');
  const graph=validateAnimGraph3D(d.graph); if(graph.type!=='AnimGraph3D') driverReject('embedded graph type required');
  driverInt(d.tickRate,'tickRate',1,240); reference(d.initialState,graph.states,'initialState');
  const timings=exactKeys(d.clips,Object.keys(graph.clips),'clips');
  for (const [alias,clip] of Object.entries(graph.clips)) {
    if(typeof clip.loop!=='boolean') driverReject('explicit clip.loop required');
    driverFixed(clip.speed??1,ANIMATION_SUBTICKS,'clip speed');
    const t=driverFields(timings[alias],['durationTicks','notifies'],'timing'); driverInt(t.durationTicks,'durationTicks',1,1000000000);
    if(t.notifies!==undefined) {
      if(!Array.isArray(t.notifies)||t.notifies.length>64) driverReject('notifies max64'); const ids=new Set<string>();
      for(const n of t.notifies) {const f=driverFields(n,['id','atTick'],'notify');if(typeof f.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(f.id)||ids.has(f.id))driverReject('notify unique stable id');ids.add(f.id);driverInt(f.atTick,'notify atTick',0,t.durationTicks);}
    }
  }
  // D1 self-conditions would restart their fade every tick; use a fresh-seq play to retrigger.
  // This tighter driver boundary does not change the legacy E2 AnimGraph validator.
  for(const t of graph.transitions){if(t.from===t.to)driverReject('self condition transition is unsupported; retrigger with play');driverFixed(t.fade,d.tickRate,'transition fade ticks');}
  if(d.transitions!==undefined){
    if(!Array.isArray(d.transitions)||d.transitions.length>128||graph.transitions.length)driverReject('extended transitions max128 and exclusive with graph transitions');
    for(const raw of d.transitions){const tr=driverFields(raw,['from','to','priority','minStateTicks','fadeTicks','all'],'extended transition');reference(tr.from,graph.states,'transition from');reference(tr.to,graph.states,'transition to');if(tr.from===tr.to)driverReject('self transition; use explicit play');driverInt(tr.priority,'priority',0,65535);driverInt(tr.minStateTicks,'minimum state ticks',0,1000000000);driverInt(tr.fadeTicks,'fade ticks',0,14400);
      if(!Array.isArray(tr.all)||!tr.all.length||tr.all.length>16)driverReject('AND conditions1..16');
      for(const rawCondition of tr.all){const c=driverFields(rawCondition,rawCondition?.kind==='complete'?['kind','clip']:['kind','param','cmp','value'],'condition');
        if(c.kind==='complete'){reference(c.clip,graph.clips,'complete clip');const state=graph.states[tr.from],live=state.clip!==undefined?[state.clip]:state.blend.points.map(x=>x.clip);if(graph.clips[c.clip].loop||!live.includes(c.clip))driverReject('completion requires a nonloop clip in the source state');}
        else if(c.kind==='param'){reference(c.param,graph.params,'condition param');if(!['eq','ne','gt','gte','lt','lte'].includes(c.cmp as string))driverReject('condition comparator');const source=graph.params[c.param],expected=source==='speed'?'number':source.startsWith('flag:')?'boolean':'string';if(typeof c.value!==expected||(typeof c.value==='number'&&!Number.isFinite(c.value))||(typeof c.value==='string'&&c.value.length>256))driverReject('condition value/source type');if(expected!=='number'&&c.cmp!=='eq'&&c.cmp!=='ne')driverReject('ordered condition requires numeric parameter');}
        else driverReject('unknown condition kind');
      }
    }
  }
  return value as AnimationDriver3D;
}
export function validateAnimationDriverCommand3D(value: unknown): AnimationDriverCommand3D {
  validateDriverTree(value);const d=driverFields(value,['type','version','commands'],'command');if(d.type!=='AnimationDriverCommand3D'||d.version!==1||!Array.isArray(d.commands)||d.commands.length>64)driverReject('command type/version/max64');
  let seq=0;for(const raw of d.commands){const c=driverFields(raw,['seq','op',...(raw?.op==='play'?['state']:raw?.op==='seek'?['tick']:[])],'operation');driverInt(c.seq,'command seq',1);if(c.seq<=seq)driverReject('commands strictly increasing');seq=c.seq;
    if(c.op==='play'){if(typeof c.state!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(c.state))driverReject('play state alias');}
    else if(c.op==='seek')driverInt(c.tick,'seek tick',0,1000000000);
    else if(c.op!=='pause'&&c.op!=='resume')driverReject('unknown command');
  }return value as AnimationDriverCommand3D;
}
function weights(value: unknown, aliases: readonly string[], label: string): void {
  const r=exactKeys(value,aliases,label);let sum=0;for(const n of Object.values(r)){if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>1)driverReject('invalid weight');sum+=n;}if(sum>1+1e-9)driverReject('weights exceed one');
}
export function validateAnimationDriverPlayback3D(config: AnimationDriver3D, value: unknown): AnimationDriverPlayback3D {
  validateAnimationDriver3D(config);validateDriverTree(value);const p=driverFields(value,['type','version','configIdentity','tick','state','paused','lastCommandSeq','nextInstance','clips','weights','targets','transition','events','stateElapsedTicks'],'playback');
  if(p.type!=='AnimationDriverPlayback3D'||p.version!==1)driverReject('playback type/version');
  const id=driverFields(p.configIdentity,['canonical','fnv'],'identity'), expected=animationDriverIdentity(config);if(id.canonical!==expected.canonical||id.fnv!==expected.fnv)driverReject('config identity mismatch');
  driverInt(p.tick,'tick');driverInt(p.lastCommandSeq,'lastCommandSeq');driverInt(p.nextInstance,'nextInstance',1);reference(p.state,config.graph.states,'playback state');bool(p.paused,'paused');
  if(config.transitions!==undefined)driverInt(p.stateElapsedTicks,'state elapsed ticks',0,1000000000);else if(p.stateElapsedTicks!==undefined)driverReject('state elapsed only belongs to extended transition mode');
  const aliases=Object.keys(config.clips);const cs=exactKeys(p.clips,aliases,'playback clips');const instances=new Set<number>();
  for(const alias of aliases){const c=driverFields(cs[alias],['cursorSubticks','cycle','instance','started','completed'],'cursor');const duration=config.clips[alias].durationTicks*ANIMATION_SUBTICKS;driverInt(c.cursorSubticks,'cursorSubticks',0,duration);driverInt(c.cycle,'cycle');driverInt(c.instance,'instance');bool(c.started,'started');bool(c.completed,'completed');
    if(c.instance>0){if(c.instance>=(p.nextInstance as number)||instances.has(c.instance))driverReject('instance identity');instances.add(c.instance);}
    if(config.graph.clips[alias].loop&&(c.cursorSubticks===duration||c.completed))driverReject('loop cursor/completion');
    if(!config.graph.clips[alias].loop&&c.cycle!==0)driverReject('nonloop cycle');
    if(!c.started&&(c.cursorSubticks!==0||c.cycle!==0||c.completed))driverReject('unstarted cursor');
    if(c.completed&&c.cursorSubticks!==duration)driverReject('completion cursor');
    if(c.instance===0&&(c.started||c.completed||c.cursorSubticks!==0||c.cycle!==0))driverReject('unentered cursor');
  }
  weights(p.weights,aliases,'weights');for(const a of aliases)if((p.weights as Record<string,number>)[a]>0&&(cs[a] as {instance:number}).instance===0)driverReject('weighted unentered clip');const targets=exactKeys(p.targets,Object.keys(config.graph.states),'targets');for(const [state,target] of Object.entries(targets)){weights(target,aliases,'target weights');const data=config.graph.states[state];const allowed=data.clip!==undefined?[data.clip]:data.blend.points.map(p=>p.clip);const positive=Object.entries(target as Record<string,number>).filter(([,w])=>w>0);const sum=positive.reduce((n,[,w])=>n+w,0);if((sum>0&&Math.abs(sum-1)>1e-9)||positive.some(([a])=>!allowed.includes(a)))driverReject('target state weights');if(data.clip===undefined&&positive.length>1&&!data.blend.points.some((point,i)=>i>0&&positive.every(([a])=>a===point.clip||a===data.blend.points[i-1].clip)))driverReject('nonadjacent blend target');}
  if(p.transition!==undefined){const t=driverFields(p.transition,['elapsedTicks','durationTicks','fromWeights'],'transition');driverInt(t.durationTicks,'transition duration',1,14400);driverInt(t.elapsedTicks,'transition elapsed',0,(t.durationTicks as number)-1);weights(t.fromWeights,aliases,'transition weights');}
  if(!Array.isArray(p.events)||p.events.length>ANIMATION_MAX_EVENTS)driverReject('events max1024');const eventIds=new Set<string>();
  for(const raw of p.events){const e=driverFields(raw,['id','kind','alias','instance','cycle','atTick','notifyId'],'event');reference(e.alias,config.clips,'event alias');driverInt(e.instance,'event instance',1,(p.nextInstance as number)-1);driverInt(e.cycle,'event cycle');driverInt(e.atTick,'event tick',0,config.clips[e.alias].durationTicks);
    if(e.kind==='notify'){const n=config.clips[e.alias].notifies?.find(n=>n.id===e.notifyId&&n.atTick===e.atTick);if(!n)driverReject('event notify reference');}else if(e.kind!=='complete'||e.notifyId!==undefined||e.atTick!==config.clips[e.alias].durationTicks)driverReject('event completion');
    const cursor=cs[e.alias] as AnimationDriverCursor;if(e.instance!==cursor.instance||e.cycle>cursor.cycle)driverReject('event cursor identity');
    const eid=`${e.instance}:${e.alias}:${e.cycle}:${e.kind}:${e.kind==='notify'?e.notifyId:'end'}`;if(e.id!==eid||eventIds.has(eid))driverReject('event identity');eventIds.add(eid);
  }
  return value as AnimationDriverPlayback3D;
}

// Structural catalogue schema; strict validators above enforce budgets, references and fixed precision.
const weightSchema=t.rec(t.num());
const operationSchema=t.union([
 t.obj({seq:t.num(),op:t.lit('play'),state:t.str()}),t.obj({seq:t.num(),op:t.lit('pause')}),
 t.obj({seq:t.num(),op:t.lit('resume')}),t.obj({seq:t.num(),op:t.lit('seek'),tick:t.num()})
],'op');
const graphSchema=t.obj({type:t.lit('AnimGraph3D'),clips:t.rec(t.obj({asset:t.opt(t.str()),clip:t.str(),speed:t.opt(t.num()),loop:t.bool(),retarget:t.opt(t.lit('humanoid'))})),states:t.rec(t.union([t.obj({clip:t.str()}),t.obj({blend:t.obj({param:t.str(),points:t.arr(t.obj({at:t.num(),clip:t.str()}))})})])),transitions:t.arr(t.obj({from:t.str(),to:t.str(),whenParam:t.str(),cmp:t.enum(['eq','ne','gt','gte','lt','lte']),value:t.union([t.num(),t.str(),t.bool()]),fade:t.num()})),params:t.rec(t.str())});
const extendedTransition=t.obj({from:t.str(),to:t.str(),priority:t.num(),minStateTicks:t.num(),fadeTicks:t.num(),all:t.arr(t.union([t.obj({kind:t.lit('param'),param:t.str(),cmp:t.enum(['eq','ne','gt','gte','lt','lte']),value:t.union([t.num(),t.str(),t.bool()])}),t.obj({kind:t.lit('complete'),clip:t.str()})],'kind'))});
export const ANIMATION_DRIVER_SCHEMAS={
 AnimationDriver3D:t.obj({version:t.lit(1),graph:graphSchema,tickRate:t.num(),initialState:t.str(),clips:t.rec(t.obj({durationTicks:t.num(),notifies:t.opt(t.arr(t.obj({id:t.str(),atTick:t.num()})))})),transitions:t.opt(t.arr(extendedTransition))}),
 AnimationDriverCommand3D:t.obj({version:t.lit(1),commands:t.arr(operationSchema)}),
 AnimationDriverPlayback3D:t.obj({version:t.lit(1),configIdentity:t.obj({canonical:t.str(),fnv:t.num()}),tick:t.num(),state:t.str(),paused:t.bool(),lastCommandSeq:t.num(),nextInstance:t.num(),stateElapsedTicks:t.opt(t.num()),clips:t.rec(t.obj({cursorSubticks:t.num(),cycle:t.num(),instance:t.num(),started:t.bool(),completed:t.bool()})),weights:weightSchema,targets:t.rec(weightSchema),transition:t.opt(t.obj({elapsedTicks:t.num(),durationTicks:t.num(),fromWeights:weightSchema})),events:t.arr(t.obj({id:t.str(),kind:t.enum(['notify','complete']),alias:t.str(),instance:t.num(),cycle:t.num(),atTick:t.num(),notifyId:t.opt(t.str())}))})
} as const;
