import { describe,it,expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Transform,Velocity,Shape,DebugTrace } from '@engine/protocol/components.js';
import type { CrowdAvoidance } from '@engine/protocol/components/crowd.js';
import { crowdAvoidanceCapability as crowd } from './crowd-avoidance.js';
import { orcaVelocity } from './orca.js';
import { contactBetween } from '@engine/spatial/contact.js';
import { topologicalSort } from '@engine/core/topological-sort.js';
import { dragPlaceCapability } from './drag-place.js';

function actor(w:World,id:string,x:number,y:number,opts:Partial<CrowdAvoidance>={},r=1){
  w.createEntity(id);w.addComponent(id,{type:'Transform',x,y,rotation:0,scaleX:1,scaleY:1});
  w.addComponent(id,{type:'Velocity',vx:.1,vy:0,angular:0});
  w.addComponent(id,{type:'Shape',kind:'circle',radius:r});
  w.addComponent(id,{type:'CrowdAvoidance',radius:1,maxSpeed:.1,yieldAfterTicks:6,minRadiusScale:.8,radiusStep:.1,...opts});
}
function world(){const w=new World({strict:true});for(const s of crowd.systems)w.addSystem(s);return w;}
const v=(w:World,id='a')=>w.getComponent<Velocity>(id,'Velocity')!;
const s=(w:World,id='a')=>w.getComponent<Shape>(id,'Shape')!;
const t=(w:World,id='a')=>w.getComponent<Transform>(id,'Transform')!;
const cfg=(w:World,id='a')=>w.getComponent<CrowdAvoidance>(id,'CrowdAvoidance')!;
function step(w:World,n:number){for(let i=0;i<n;i++){for(const id of ['a','b'])if(w.hasComponent(id,'Velocity')){v(w,id).vx=.1;v(w,id).vy=0;}w.tick();}}

describe('independent crowd nudge/recovery review',()=>{
  it('shape resizing and drag placement compose without a new two-system ordering cycle',()=>{
    expect(()=>topologicalSort([...crowd.systems,...dragPlaceCapability.systems],{softCycle:'throw'})).not.toThrow();
  });
  it('even minimum delay gives lateral nudge a tick before shrinking',()=>{
    const w=world();actor(w,'a',0,0,{yieldAfterTicks:3});
    step(w,2);
    expect(Math.abs(v(w).vy)).toBeGreaterThan(0);
    expect(s(w).radius).toBe(1);
  });
  it('shrunken circle radius is the actual radius supplied to ORCA',()=>{
    const w=world();actor(w,'a',0,0,{lastX:0,lastY:0,stuckTicks:6});
    actor(w,'b',1.5,.15,{radius:.2,yieldAfterTicks:undefined},.2);v(w,'b').vx=0;
    const expected=orcaVelocity({x:0,y:0,vx:.1,vy:0,radius:.9,idx:0,reciprocal:true},
      [{x:1.5,y:.15,vx:0,vy:0,radius:.2,idx:1,reciprocal:false}],
      {x:.1/Math.sqrt(1.25),y:.05/Math.sqrt(1.25)},.1,8,1);
    w.tick();expect(s(w).radius).toBeCloseTo(.9);
    expect([v(w).vx,v(w).vy]).toEqual([expected.x,expected.y]);
  });
  it('simultaneous recovery checks earlier restored neighbors and explains blocked expansion',()=>{
    for(const reverse of [false,true]){
      const w=world();for(const id of reverse?['b','a']:['a','b']){
        const x=id==='a'?0:1.75;actor(w,id,x,0,{lastX:x,lastY:0,clearTicks:3},.8);v(w,id).vx=0;
      }
      w.createEntity('trace');w.addComponent('trace',{type:'DebugTrace',events:[],max:20});
      w.tick();expect(s(w,'a').radius).toBeCloseTo(.9);expect(s(w,'b').radius).toBeCloseTo(.8);
      expect(contactBetween(t(w,'a'),s(w,'a'),t(w,'b'),s(w,'b'))).toBeNull();
      const events=w.getComponent<DebugTrace>('trace','DebugTrace')!.events;
      expect(events.some(e=>e.kind==='reject'&&e.what.includes('恢复空间不足 1'))).toBe(true);
      expect(events.length).toBeLessThanOrEqual(3);
    }
  });
  it('nudge and shrink state continues identically after JSON snapshot restore',()=>{
    const make=()=>{const w=world();actor(w,'a',0,0);actor(w,'b',4,0);return w;};
    const a=make();step(a,8);const snapshot=JSON.parse(JSON.stringify(a.snapshot()));
    const b=make();b.restore(snapshot);step(a,12);step(b,12);
    for(const id of ['a','b'])expect([cfg(a,id),s(a,id),v(a,id),t(a,id)]).toEqual([cfg(b,id),s(b,id),v(b,id),t(b,id)]);
    expect(s(a).radius).toBeCloseTo(.8);
  });
  it('disabled recovery preserves the original component and physical radius',()=>{
    const w=world();actor(w,'a',0,0,{yieldAfterTicks:undefined});
    const before=structuredClone(cfg(w));step(w,20);
    expect(cfg(w)).toEqual(before);expect(s(w).radius).toBe(1);expect(v(w).vy).toBe(0);
  });
});
