import {describe,it,expect} from 'vitest';
import {World} from '@engine/core/world.js';
import type {Transform,Velocity,Line3D,DebugTrace} from '@engine/protocol/components.js';
import type {CrowdAvoidance} from '@engine/protocol/components/crowd.js';
import {crowdAvoidanceCapability as crowd} from './crowd-avoidance.js';
import {motionApplyCapability as motion} from '../tier1/motion-apply.js';
import {overlapDetectCapability as overlap} from '../atoms/overlap-detect/index.js';
import {collisionResolveCapability as collision} from './collision-resolve.js';
import {orcaVelocity} from './orca.js';

const suffixes=['desired','raw','actual','avoid'];
function world(physics=false){const w=new World({strict:true});for(const c of physics?[crowd,motion,overlap,collision]:[crowd])for(const s of c.systems)w.addSystem(s);return w;}
function actor(w:World,id:string,x:number,y:number,vx=0){
 w.createEntity(id);w.addComponent(id,{type:'Transform',x,y,rotation:0,scaleX:1,scaleY:1});
 w.addComponent(id,{type:'Velocity',vx,vy:0,angular:0});
 w.addComponent(id,{type:'CrowdAvoidance',radius:.35,maxSpeed:.1,zeroEscape:true});
 w.addComponent(id,{type:'Shape',kind:'circle',radius:.35});
}
function vectors(w:World){cfg(w).debugVectorPrefix='vectors';for(const suffix of suffixes){const id=`vectors:${suffix}`;w.createEntity(id);w.addComponent(id,{type:'Line3D',points:[]});}}
const cfg=(w:World)=>w.getComponent<CrowdAvoidance>('a','CrowdAvoidance')!;
const v=(w:World)=>w.getComponent<Velocity>('a','Velocity')!;
const t=(w:World)=>w.getComponent<Transform>('a','Transform')!;
const points=(w:World,suffix:string)=>w.getComponent<Line3D>(`vectors:${suffix}`,'Line3D')!.points;
function trace(w:World){w.createEntity('trace');w.addComponent('trace',{type:'DebugTrace',events:[],max:20});}
function rejected(w:World,reason:string){const events=w.getComponent<DebugTrace>('trace','DebugTrace')!.events;
 expect(events.some(e=>e.kind==='reject'&&e.what.includes(reason))).toBe(true);expect(events.length).toBeLessThanOrEqual(3);}

describe('independent zero escape review',()=>{
 it('lateral candidates remain constrained by both side neighbors',()=>{
  const w=world();actor(w,'a',0,0,.1);actor(w,'front',.7,0);actor(w,'top',0,.7);actor(w,'bottom',0,-.7);
  const expected=orcaVelocity({x:0,y:0,vx:.1,vy:0,radius:.35,idx:0,reciprocal:true},
   [{x:0,y:-.7},{x:.7,y:0},{x:0,y:.7}].map((p,i)=>({...p,vx:0,vy:0,radius:.35,idx:i+1,reciprocal:false})),
   {x:.1,y:0},.1,8,1);
  w.tick();expect([v(w).vx,v(w).vy]).toEqual([expected.x,expected.y]);
  expect(Math.hypot(v(w).vx,v(w).vy)).toBeLessThan(.008);
 });
 it('zero escape is independent of creation order, debug data, and snapshot history',()=>{
  const build=(reverse=false,debug=false)=>{const w=world(true);for(const id of reverse?['b','a']:['a','b'])actor(w,id,id==='a'?0:.7,0,id==='a'?.1:0);if(debug)vectors(w);return w;};
  const advance=(w:World,n:number)=>{for(let i=0;i<n;i++){v(w).vx=.1;v(w).vy=0;w.tick();}};
  const a=build(),b=build(true,true);advance(a,1);advance(b,1);
  expect(Math.abs(v(a).vy)).toBeGreaterThan(.09);
  const restored=build();restored.restore(JSON.parse(JSON.stringify(a.snapshot())));
  advance(a,30);advance(b,30);advance(restored,30);
  for(const w of [b,restored])expect([t(w),v(w),cfg(w)]).toEqual([t(a),v(a),{...cfg(a),...(w===b?{debugVectorPrefix:'vectors'}:{})}]);
 });
 it('full collision composition clips lateral motion at static walls; shown actual is pre-collision solver output',()=>{
  const w=world(true);actor(w,'a',0,0,.1);actor(w,'front',.7,0);vectors(w);
  // Both lateral sides are solid but intentionally not ORCA agents.
  for(const [id,y] of [['up',.6],['down',-.6]] as const){w.createEntity(id);w.addComponent(id,{type:'Transform',x:0,y,rotation:0,scaleX:1,scaleY:1});w.addComponent(id,{type:'Shape',kind:'box',width:4,height:.5});}
  w.tick();expect(t(w).y).toBeCloseTo(0,10);expect(v(w).vy).toBeCloseTo(0,10);
  expect(Math.abs(points(w,'actual')[1][2]-points(w,'actual')[0][2])).toBeCloseTo(5);
 });
 it('rejected numeric config clears previous vectors instead of leaving a stale moving arrow',()=>{
  const w=world();actor(w,'a',0,0,.1);vectors(w);w.tick();expect(points(w,'actual').length).toBe(5);
  trace(w);cfg(w).maxSpeed=-1;w.tick();expect(v(w).vx).toBe(0);rejected(w,'非法 1');
  for(const suffix of suffixes)expect(points(w,suffix)).toEqual([]);
 });
 it('legacy avoidance takeover clears obsolete crowd vectors',()=>{
  const w=world();actor(w,'a',0,0,.1);vectors(w);w.tick();
  trace(w);w.addComponent('a',{type:'FlowAgent',fieldId:'legacy',speed:.1,orca:{radius:.35}});w.tick();rejected(w,'重复配置保留旧行为 1');
  for(const suffix of suffixes)expect(points(w,suffix)).toEqual([]);
 });
 it('malformed debug prefix is rejected without throwing during a tick',()=>{
  const w=world();actor(w,'a',0,0,.1);cfg(w).debugVectorPrefix=null as unknown as string;
  expect(()=>w.tick()).not.toThrow();expect(v(w).vx).toBe(0);
 });
 it('non-boolean zeroEscape values are rejected instead of enabling escape by truthiness',()=>{
  for(const value of ['false',1,null]){
   const w=world();actor(w,'a',0,0,.1);actor(w,'front',.7,0);trace(w);
   cfg(w).zeroEscape=value as unknown as boolean;w.tick();
   expect([v(w).vx,v(w).vy]).toEqual([0,0]);rejected(w,'非法 1');
  }
 });
});
