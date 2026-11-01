import {describe,expect,it} from 'vitest';
import {
  createGaitPhaseGroup, validateGaitPhaseGroup, validateGaitPhaseState,
  stepGaitPhaseGroup, projectGaitPhaseGroup, seekGaitPhaseGroup, selectGaitLeader,
  GAIT_MAX_DISTANCE_Q, GAIT_MAX_CYCLE,
} from './gait-phase.js';
import type {GaitPhaseGroupV1,GaitPhaseStateV1} from './gait-phase.js';

type Mutable<T> = {-readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K]};
const clone=<T>(v:T):Mutable<T>=>JSON.parse(JSON.stringify(v));
function group():GaitPhaseGroupV1 {
  return {
    version:1,id:'gait',referenceStrideDistanceQ:1000,
    markers:[
      {id:'LP',phaseQ:0,foot:'left',kind:'plant'},
      {id:'LL',phaseQ:250000,foot:'left',kind:'lift'},
      {id:'RP',phaseQ:500000,foot:'right',kind:'plant'},
      {id:'RL',phaseQ:750000,foot:'right',kind:'lift'},
    ],
    members:{
      walk:{durationSubticks:1000,markers:[{id:'LP',atSubtick:0},{id:'LL',atSubtick:200},{id:'RP',atSubtick:600},{id:'RL',atSubtick:850}],strideDistanceQ:1000,sourceSha256:'a'.repeat(64),calibrationStatus:'reviewed',provenance:'Synthetic test markers authored for testing; no real measured contact.'},
      run:{durationSubticks:600,markers:[{id:'RP',atSubtick:50},{id:'RL',atSubtick:200},{id:'LP',atSubtick:300},{id:'LL',atSubtick:450}],strideDistanceQ:2000,sourceSha256:'b'.repeat(64),calibrationStatus:'reviewed',provenance:'Synthetic second member with rotated source origin.'},
    },
  };
}
const move=(c:GaitPhaseGroupV1,s:GaitPhaseStateV1,d:number,weightsQ={walk:500000,run:500000})=>stepGaitPhaseGroup(c,s,{acceptedDistanceQ:d,weightsQ});

describe('D2 pure shared calibrated gait phase',()=>{
  it('requires explicit phase0 anchor and reviewed source identities; creates without emitting',()=>{const c=group(),s=createGaitPhaseGroup(c,7);expect(s).toMatchObject({phaseQ:0,cycle:0,remainder:0,instance:7,started:false});expect(projectGaitPhaseGroup(c,s).samples).toEqual({run:{timeSubticks:300,clipCycle:0},walk:{timeSubticks:0,clipCycle:0}});});
  it('freezes the whole phase state while stationary, with no initial or repeated plant event',()=>{const c=group(),s=createGaitPhaseGroup(c);expect(move(c,s,0).state).toEqual(s);expect(move(c,s,0).events).toEqual([]);let p=move(c,s,123).state;const before=clone(p);p=move(c,p,0).state;expect(p).toEqual(before);});
  it('freezes an inactive whole group for empty or all-zero weights despite positive accepted displacement',()=>{const c=group(),initial=createGaitPhaseGroup(c),active=move(c,initial,123).state;for(const previous of [initial,active])for(const weightsQ of [{},{walk:0,run:0}] as Record<string,number>[]){const before=JSON.stringify(previous);const result=stepGaitPhaseGroup(c,previous,{acceptedDistanceQ:1000,weightsQ});expect(result.leader).toBeUndefined();expect(result.state).toEqual(previous);expect(result.events).toEqual([]);expect(JSON.stringify(previous)).toBe(before);}});
  it('integrates fractional distances exactly with persisted rational remainder',()=>{const c=clone(group());c.referenceStrideDistanceQ=3;let s=createGaitPhaseGroup(c);s=move(c,s,1).state;expect(s).toMatchObject({phaseQ:333333,remainder:1});s=move(c,s,1).state;expect(s).toMatchObject({phaseQ:666666,remainder:2});s=move(c,s,1).state;expect(s).toMatchObject({phaseQ:0,cycle:1,remainder:0});});
  it('can accumulate distance below one phaseQ without rounding it away',()=>{const c=clone(group());c.referenceStrideDistanceQ=1000000000000;let s=createGaitPhaseGroup(c);let r=move(c,s,1);expect(r.state.phaseQ).toBe(0);expect(r.state.remainder).toBe(1000000);expect(r.events.map(e=>e.markerId)).toEqual(['LP']);r=move(c,r.state,1);expect(r.events).toEqual([]);expect(r.state.remainder).toBe(2000000);});
  it('crossing a stride emits only one plant per group marker, not one per blended clip',()=>{const c=group();const r=move(c,createGaitPhaseGroup(c,4),1000);expect(r.events.map(e=>[e.markerId,e.cycle,e.foot])).toEqual([['LP',0,'left'],['RP',0,'right'],['LP',1,'left']]);expect(new Set(r.events.map(e=>e.id)).size).toBe(3);expect(r.events.every(e=>e.kind==='plant'&&e.instance===4)).toBe(true);expect(r.state).toMatchObject({phaseQ:0,cycle:1});});
  it('uses half-open traversal at exact boundaries and does not duplicate the current marker',()=>{const c=group();let r=move(c,createGaitPhaseGroup(c),500);expect(r.events.map(e=>e.markerId)).toEqual(['LP','RP']);r=move(c,r.state,1);expect(r.events).toEqual([]);r=move(c,r.state,499);expect(r.events.map(e=>[e.markerId,e.cycle])).toEqual([['LP',1]]);});
  it('multiple crossed loops enumerate plants in chronological group order',()=>{const c=group();const r=move(c,createGaitPhaseGroup(c),2500);expect(r.events.map(e=>[e.cycle,e.markerId])).toEqual([[0,'LP'],[0,'RP'],[1,'LP'],[1,'RP'],[2,'LP'],[2,'RP']]);expect(r.state).toMatchObject({cycle:2,phaseQ:500000});});
  it('chooses a leader only by maximum weightQ then stable clip id',()=>{const c=group();expect(selectGaitLeader(c,{walk:500000,run:500000})).toBe('run');expect(selectGaitLeader(c,{walk:700000,run:300000})).toBe('walk');expect(selectGaitLeader(c,{walk:0,run:0})).toBeUndefined();});
  it('leader switches and a weight0 member reenter without resetting shared phase',()=>{const c=group();let r=move(c,createGaitPhaseGroup(c),250,{walk:1000000,run:0});expect(r.leader).toBe('walk');expect(r.state.phaseQ).toBe(250000);const a=projectGaitPhaseGroup(c,r.state);expect(a.samples.run.timeSubticks).toBe(450);r=move(c,r.state,0,{walk:0,run:1000000});expect(r.leader).toBe('run');expect(r.state.phaseQ).toBe(250000);expect(projectGaitPhaseGroup(c,r.state)).toEqual(a);r=move(c,r.state,250,{walk:0,run:1000000});expect(projectGaitPhaseGroup(c,r.state).samples.run).toEqual({timeSubticks:50,clipCycle:1});});
  it('maps nonuniform marker segments exactly, including a member origin inside its clip',()=>{const c=group(),s=createGaitPhaseGroup(c);const at=(phaseQ:number)=>projectGaitPhaseGroup(c,seekGaitPhaseGroup(c,s,{phaseQ,cycle:0})).samples;expect(at(125000)).toEqual({run:{timeSubticks:375,clipCycle:0},walk:{timeSubticks:100,clipCycle:0}});expect(at(375000)).toEqual({run:{timeSubticks:550,clipCycle:0},walk:{timeSubticks:400,clipCycle:0}});expect(at(500000)).toEqual({run:{timeSubticks:50,clipCycle:1},walk:{timeSubticks:600,clipCycle:0}});expect(at(875000)).toEqual({run:{timeSubticks:250,clipCycle:1},walk:{timeSubticks:925,clipCycle:0}});});
  it('projected absolute clip time is monotonically nondecreasing across group wraps',()=>{const c=group(),s=createGaitPhaseGroup(c);const previous={walk:-1,run:-1};for(let cycle=0;cycle<3;cycle++)for(let phaseQ=0;phaseQ<1000000;phaseQ+=7919){const p=projectGaitPhaseGroup(c,seekGaitPhaseGroup(c,s,{phaseQ,cycle})).samples;for(const alias of ['walk','run'] as const){const absolute=p[alias].clipCycle*c.members[alias].durationSubticks+p[alias].timeSubticks;expect(absolute).toBeGreaterThanOrEqual(previous[alias]);previous[alias]=absolute;}}});
  it('seek has no events and does not retroactively emit an anchor on the next move',()=>{const c=group(),s=createGaitPhaseGroup(c,8);const q=seekGaitPhaseGroup(c,s,{phaseQ:0,cycle:7});expect(q).toMatchObject({started:true,instance:8,remainder:0});expect(move(c,q,1).events).toEqual([]);expect(s).toMatchObject({started:false,cycle:0});});
  it('JSON snapshot rollback deterministically replays identical plant ids and samples',()=>{const c=group();const s=move(c,createGaitPhaseGroup(c),250).state;const saved=JSON.stringify(s);const first=move(c,s,1000),second=move(c,JSON.parse(saved),1000);expect(second).toEqual(first);expect(projectGaitPhaseGroup(c,second.state)).toEqual(projectGaitPhaseGroup(c,first.state));expect(JSON.stringify(s)).toBe(saved);expect(JSON.stringify(first)).not.toContain('BigInt');});
  it('distance batching preserves final rational phase and the exact event sequence',()=>{const c=clone(group());c.referenceStrideDistanceQ=997;let p=createGaitPhaseGroup(c);const events=[];for(let i=0;i<17;i++){const r=move(c,p,137);events.push(...r.events);p=r.state;}const whole=move(c,createGaitPhaseGroup(c),17*137);expect(p).toEqual(whole.state);expect(events).toEqual(whole.events);});
  it('uses exact BigInt segment products near duration budget and keeps outputs JSON-safe',()=>{const c=clone(group());c.members.walk.durationSubticks=1000000000000;c.members.walk.markers=[{id:'LP',atSubtick:0},{id:'LL',atSubtick:1},{id:'RP',atSubtick:999999999998},{id:'RL',atSubtick:999999999999}];const s=seekGaitPhaseGroup(c,createGaitPhaseGroup(c),{phaseQ:375001,cycle:7});const p=projectGaitPhaseGroup(c,s);expect(p.samples.walk).toEqual({timeSubticks:500003999999,clipCycle:7});expect(Number.isSafeInteger(p.samples.walk.timeSubticks)).toBe(true);expect(()=>JSON.stringify(p)).not.toThrow();});
  it('projection can wrap a rotated member near the final allowed group cycle without negative clip cycles',()=>{const c=group(),s=seekGaitPhaseGroup(c,createGaitPhaseGroup(c),{phaseQ:750000,cycle:GAIT_MAX_CYCLE});expect(projectGaitPhaseGroup(c,s).samples.run).toEqual({timeSubticks:200,clipCycle:GAIT_MAX_CYCLE+1});});
  it('permits a phase0 lift anchor but does not manufacture an initial plant',()=>{const c=clone(group());c.markers[0].kind='lift';c.markers[1].kind='plant';expect(move(c,createGaitPhaseGroup(c),1).events).toEqual([]);expect(move(c,createGaitPhaseGroup(c),250).events.map(e=>e.markerId)).toEqual(['LL']);});
});

describe('D2 hostile input and finite work budgets',()=>{
  it.each([
    ['missing marker',(c:any)=>c.members.walk.markers.pop()],
    ['extra marker',(c:any)=>c.members.walk.markers.push({id:'extra',atSubtick:900})],
    ['duplicate marker',(c:any)=>c.members.walk.markers[1].id='LP'],
    ['wrong cyclic order',(c:any)=>{c.members.walk.markers[1].id='RP';c.members.walk.markers[2].id='LL';}],
    ['equal times',(c:any)=>c.members.walk.markers[1].atSubtick=0],
    ['terminal time',(c:any)=>c.members.walk.markers[3].atSubtick=1000],
    ['negative time',(c:any)=>c.members.walk.markers[0].atSubtick=-1],
    ['negative duration',(c:any)=>c.members.walk.durationSubticks=-1],
    ['missing plant foot',(c:any)=>c.markers[2].kind='lift'],
    ['duplicate canonical id',(c:any)=>c.markers[1].id='LP'],
    ['unsorted canonical phase',(c:any)=>c.markers[1].phaseQ=750000],
    ['endpoint phase',(c:any)=>c.markers[3].phaseQ=1000000],
    ['no phase0 anchor',(c:any)=>c.markers[0].phaseQ=1],
    ['unreviewed',(c:any)=>c.members.walk.calibrationStatus='draft'],
    ['missing provenance',(c:any)=>c.members.walk.provenance=''],
    ['bad source SHA',(c:any)=>c.members.walk.sourceSha256='a'.repeat(63)],
    ['NaN',(c:any)=>c.referenceStrideDistanceQ=NaN],
    ['unknown field',(c:any)=>c.description='not contact evidence'],
    ['unknown member field',(c:any)=>c.members.walk.contact=true],
  ])('rejects %s',(_name,mutate)=>{const c=clone(group());mutate(c);expect(()=>validateGaitPhaseGroup(c)).toThrow();});
  it('rejects more than 64 members, >32 markers, unknown/noninteger weights and overloaded sum',()=>{const c=clone(group());for(let i=0;i<64;i++)c.members['extra'+i]=clone(c.members.walk);expect(()=>validateGaitPhaseGroup(c)).toThrow(/1..64/);const d=clone(group());d.markers=Array.from({length:33},(_,i)=>({...d.markers[0],id:'m'+i,phaseQ:i}));expect(()=>validateGaitPhaseGroup(d)).toThrow(/2..32/);for(const w of [{missing:1},{walk:.5},{walk:-1},{walk:1000001},{walk:600000,run:600000}] as Record<string,number>[])expect(()=>selectGaitLeader(group(),w)).toThrow();});
  it('distance overflow, backwards travel and excess events reject without mutating inputs',()=>{const c=group(),s=createGaitPhaseGroup(c),before=JSON.stringify(s);for(const d of [-1,.5,NaN,GAIT_MAX_DISTANCE_Q+1,32000])expect(()=>move(c,s,d)).toThrow();expect(JSON.stringify(s)).toBe(before);expect(move(c,s,31500).events).toHaveLength(64);});
  it('cycle overflow is rejected even if distance is within its own budget',()=>{const c=group(),s=seekGaitPhaseGroup(c,createGaitPhaseGroup(c),{cycle:GAIT_MAX_CYCLE,phaseQ:999999});expect(()=>move(c,s,1)).toThrow(/cycle overflow/);});
  it.each([
    ['wrong identity',(s:any)=>s.configCanonical+=' '],
    ['bad phase',(s:any)=>s.phaseQ=1000000],
    ['bad remainder',(s:any)=>s.remainder=1000],
    ['fractional cycle',(s:any)=>s.cycle=.5],
    ['unstarted advanced',(s:any)=>s.phaseQ=1],
    ['instance zero',(s:any)=>s.instance=0],
    ['unknown field',(s:any)=>s.events=[]],
  ])('rejects snapshot %s',(_name,mutate)=>{const c=group(),s=clone(createGaitPhaseGroup(c));mutate(s);expect(()=>validateGaitPhaseState(c,s)).toThrow();});
  it('binds full config canonically, not object-key order or a collision-prone short digest',()=>{const c=group(),s=createGaitPhaseGroup(c);const changed=clone(c);changed.members.walk.sourceSha256='c'.repeat(64);expect(()=>projectGaitPhaseGroup(changed,s)).toThrow(/identity/);const reordered={...c,members:{run:c.members.run,walk:c.members.walk}};expect(()=>projectGaitPhaseGroup(reordered,s)).not.toThrow();});
  it('rejects hidden/accessor hooks and shared object graphs without invoking them',()=>{let called=false;const c:any=clone(group());Object.defineProperty(c,'toJSON',{value:()=>{called=true;return {};}});expect(()=>createGaitPhaseGroup(c)).toThrow();expect(called).toBe(false);const d:any=clone(group());Object.defineProperty(d.members.walk,'durationSubticks',{enumerable:true,get(){called=true;return 1000;}});expect(()=>createGaitPhaseGroup(d)).toThrow(/accessor/);expect(called).toBe(false);const e:any=clone(group());e.members.run=e.members.walk;expect(()=>createGaitPhaseGroup(e)).toThrow(/shared/);});
  it('rejects seek beyond half-open phase and unknown step/seek fields',()=>{const c=group(),s=createGaitPhaseGroup(c);expect(()=>seekGaitPhaseGroup(c,s,{phaseQ:1000000,cycle:0})).toThrow();expect(()=>seekGaitPhaseGroup(c,s,{phaseQ:0,cycle:0,events:true} as any)).toThrow();expect(()=>stepGaitPhaseGroup(c,s,{acceptedDistanceQ:1,weightsQ:{},timeSeconds:1} as any)).toThrow();});
  it('full validation and every projection/step preserve configuration bytes',()=>{const c=group(),before=JSON.stringify(c),s=createGaitPhaseGroup(c);move(c,s,500);projectGaitPhaseGroup(c,s);seekGaitPhaseGroup(c,s,{phaseQ:200000,cycle:1});expect(JSON.stringify(c)).toBe(before);});
});
