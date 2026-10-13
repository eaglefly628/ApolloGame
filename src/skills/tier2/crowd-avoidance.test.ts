import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import { topologicalSort } from '@engine/core/topological-sort.js';
import type { Transform, Velocity, FlowAgent, DebugTrace, Shape, Line3D, Mass, PathFollow } from '@engine/protocol/components.js';
import type { CrowdAvoidance } from '@engine/protocol/components/crowd.js';
import { crowdAvoidanceCapability as crowd } from './crowd-avoidance.js';
import { pathfindCapability as nav } from './pathfind.js';
import { flowFieldCapability as flow } from './flow-field.js';
import { motionApplyCapability as motion } from '../tier1/motion-apply.js';
import { steeringCapability } from './steering.js';
import { pathFollowCapability } from './path-follow.js';
import { collisionResolveCapability as collision } from './collision-resolve.js';
import { overlapDetectCapability as overlap } from '../atoms/overlap-detect/index.js';
import { expectRestoreContinues, tickN } from '../../test-fixtures/test-kit.js';
import { contactBetween } from '@engine/spatial/contact.js';

const xf=(x:number,y:number):Transform=>({type:'Transform',x,y,rotation:0,scaleX:1,scaleY:1});
function actor(w:World,id:string,x:number,y:number,vx:number, cfg:Partial<CrowdAvoidance>={}) {
  w.createEntity(id);w.addComponent(id,xf(x,y));
  w.addComponent(id,{type:'Velocity',vx,vy:0,angular:0} as Velocity);
  w.addComponent(id,{type:'CrowdAvoidance',radius:.35,maxSpeed:.1,...cfg} as CrowdAvoidance);
}
function build(reverse=false,mixed=false) {
  const w=new World();for(const cap of [crowd,nav,flow,motion])for(const s of cap.systems)w.addSystem(s);
  w.createEntity('graph');w.addComponent('graph',{type:'NavGraph',nodes:[{x:1,y:3},{x:7,y:3}],edges:[{a:0,b:1}]});
  w.createEntity('goalA');w.addComponent('goalA',xf(7,3));w.createEntity('goalB');w.addComponent('goalB',xf(1,3));
  w.createEntity('field');w.addComponent('field',{type:'FlowField',id:'west',cols:10,rows:8,cellSize:1,originX:0,originY:0,goals:[{x:1,y:3}]});
  for(const id of reverse?['b','a']:['a','b']) {
    actor(w,id,id==='a'?1:7,id==='a'?2.9:3.1,id==='a'?.1:-.1);
    if(mixed&&id==='b')w.addComponent(id,{type:'FlowAgent',fieldId:'west',speed:.1,arriveRange:.15});
    else {w.addComponent(id,{type:'NavAgent',speed:.1,arriveRange:.1});w.addComponent(id,{type:'Relation',kind:'target',targetId:id==='a'?'goalA':'goalB'});}
  }
  return w;
}
const v=(w:World,id:string)=>w.getComponent<Velocity>(id,'Velocity')!;
const p=(w:World,id:string)=>w.getComponent<Transform>(id,'Transform')!;

describe('通用 ORCA',()=>{
  it('Mass 与持续卡住时间共同决定让行份额；旧配置仍对半',()=>{
    const run=(mode:boolean,stalled=false)=>{
      const w=new World();for(const s of crowd.systems)w.addSystem(s);
      actor(w,'cart',0,0,.1,{radius:2.5,maxSpeed:.1,...(mode?{priorityMode:'mass-stall' as const}:{})});
      actor(w,'ox',3.3,0,-.1,{radius:.8,maxSpeed:.1,...(mode?{priorityMode:'mass-stall' as const}:{})});
      w.addComponent('cart',{type:'Mass',value:12} as Mass);
      w.addComponent('ox',{type:'Mass',value:1} as Mass);
      if(stalled)Object.assign(w.getComponent<CrowdAvoidance>('ox','CrowdAvoidance')!,{stuckTicks:90,lastX:3.3,lastY:0});
      w.tick();return {cart:v(w,'cart').vx,ox:v(w,'ox').vx,stuck:w.getComponent<CrowdAvoidance>('ox','CrowdAvoidance')!.stuckTicks};
    };
    const equal=run(false),weighted=run(true),stalled=run(true,true);
    expect(weighted.cart).toBeGreaterThan(equal.cart+.04);
    expect(weighted.ox).toBeGreaterThan(equal.ox+.04);
    expect(stalled.stuck).toBe(91);
    expect(stalled.cart).toBeLessThan(weighted.cart);
  });
  it('载具惯性先平滑路线期望速度，再交 ORCA 求解',()=>{
    const w=new World();for(const cap of [crowd,pathFollowCapability])for(const s of cap.systems)w.addSystem(s);
    actor(w,'cart',0,0,.1,{desiredInertia:.8});
    w.addComponent('cart',{type:'PathFollow',waypoints:[{x:-10,y:0}],speed:.1,index:0,loop:false,arriveRadius:.01} as PathFollow);
    w.tick();
    expect(v(w,'cart').vx).toBeCloseTo(.06,9);
    expect(v(w,'cart').vy).toBeCloseTo(0,9);
  });
  it('正前方静止邻居使首次 ORCA 解为零时，侧向重解恢复安全速度并画出修正矢量',()=>{
    const w=new World();for(const s of crowd.systems)w.addSystem(s);
    actor(w,'moving',0,0,.1,{zeroEscape:true,debugVectorPrefix:'vectors',debugVectorScale:10});
    actor(w,'block',.7,0,0);
    for(const suffix of ['desired','raw','actual','avoid']){
      const id=`vectors:${suffix}`;w.createEntity(id);
      w.addComponent(id,{type:'Line3D',points:[]} as Line3D);
    }
    w.createEntity('trace');w.addComponent('trace',{type:'DebugTrace',events:[],max:20});
    w.tick();
    expect(v(w,'moving').vx).toBeCloseTo(0);
    expect(Math.abs(v(w,'moving').vy)).toBeCloseTo(.1);
    const points=(suffix:string)=>w.getComponent<Line3D>(`vectors:${suffix}`,'Line3D')!.points;
    expect(points('desired')[1]).toEqual([1,1,0]);
    expect(points('raw')).toHaveLength(0);
    expect(points('actual')).toHaveLength(5);
    expect(points('avoid')[0]?.[0]).toBeCloseTo(1);
    expect(points('avoid')[1]?.[2]).toBeCloseTo(v(w,'moving').vy*10);
    const events=w.getComponent<DebugTrace>('trace','DebugTrace')!.events;
    expect(events.some(e=>e.kind==='transition'&&e.what.includes('零速重解成功 1'))).toBe(true);
    expect(events.length).toBeLessThanOrEqual(3);
  });
  it('零速度修正缺省关闭，明确停止的单位也不自行移动',()=>{
    const w=new World();for(const s of crowd.systems)w.addSystem(s);
    actor(w,'moving',0,0,.1);actor(w,'block',.7,0,0);actor(w,'idle',5,0,0,{zeroEscape:true});
    w.tick();
    expect(Math.hypot(v(w,'moving').vx,v(w,'moving').vy)).toBeLessThan(1e-10);
    expect(v(w,'idle').vx).toBe(0);expect(v(w,'idle').vy).toBe(0);
  });
  it('侧向重解能绕过静止圆形单位，硬碰撞仍阻止穿透',()=>{
    const w=new World();for(const cap of [crowd,motion,overlap,collision])for(const s of cap.systems)w.addSystem(s);
    actor(w,'moving',0,0,.1,{zeroEscape:true});actor(w,'block',.7,0,0);
    for(const id of ['moving','block'])w.addComponent(id,{type:'Shape',kind:'circle',radius:.35} as Shape);
    let minimum=Infinity;
    for(let i=0;i<35;i++){
      v(w,'moving').vx=.1;v(w,'moving').vy=0;w.tick();
      minimum=Math.min(minimum,Math.hypot(p(w,'moving').x-p(w,'block').x,p(w,'moving').y-p(w,'block').y));
    }
    expect(minimum).toBeGreaterThanOrEqual(.7-1e-6);
    expect(p(w,'moving').x).toBeGreaterThan(1);
  });
  it('A* 两队迎面：降低接近速度、绕行后抵达各自目标',()=>{
    const w=build();let min=Infinity;
    for(let i=0;i<150;i++){w.tick();min=Math.min(min,Math.hypot(p(w,'a').x-p(w,'b').x,p(w,'a').y-p(w,'b').y));}
    expect(min).toBeGreaterThan(.64);
    expect(p(w,'a').x).toBeGreaterThan(6.8);expect(p(w,'b').x).toBeLessThan(1.2);
  });
  it('A* 与流场共享避让，不按目标类型隔离邻居',()=>{
    const w=build(false,true);let min=Infinity;
    for(let i=0;i<160;i++){w.tick();min=Math.min(min,Math.hypot(p(w,'a').x-p(w,'b').x,p(w,'a').y-p(w,'b').y));}
    expect(min).toBeGreaterThan(.6);expect(p(w,'a').x).toBeGreaterThan(6.5);expect(Math.floor(p(w,'b').x)).toBe(1);expect(Math.floor(p(w,'b').y)).toBe(3);
  });
  it('同位的有移动意图单位确定地分开，异半径进入约束',()=>{
    const w=new World();for(const s of crowd.systems)w.addSystem(s);
    actor(w,'a',0,0,.1,{radius:.7});actor(w,'b',0,0,-.1,{radius:.4});w.tick();
    expect(Math.hypot(v(w,'a').vx-v(w,'b').vx,v(w,'a').vy-v(w,'b').vy)).toBeGreaterThan(.1);
    expect([v(w,'a').vx,v(w,'a').vy,v(w,'b').vx,v(w,'b').vy].every(Number.isFinite)).toBe(true);
  });
  it('无目标/到达/定身产生的零意图不被避让推动，其他单位单方让行',()=>{
    const w=build();w.removeComponent('a','Relation');tickN(w,20);
    expect(p(w,'a').x).toBe(1);expect(p(w,'a').y).toBe(2.9);expect(v(w,'a').vx).toBe(0);
    w.addComponent('b',{type:'Status',flags:1});
    const a=w.getComponent<import('@engine/protocol/components.js').NavAgent>('b','NavAgent')!;a.haltStatusMask=1;
    const before={x:p(w,'b').x,y:p(w,'b').y};tickN(w,10);expect({x:p(w,'b').x,y:p(w,'b').y}).toEqual(before);
  });
  it('实体创建顺序颠倒不改变轨迹，恢复后继续一致',()=>{
    const a=build(),b=build(true);tickN(a,100);tickN(b,100);
    expect([p(a,'a'),p(a,'b'),v(a,'a'),v(a,'b')]).toEqual([p(b,'a'),p(b,'b'),v(b,'a'),v(b,'b')]);
    expectRestoreContinues(()=>build(false,true),w=>tickN(w,35),w=>tickN(w,90));
  });
  it('非法参数停下并留痕，不将 NaN 传给邻居',()=>{
    for(const cfg of [{radius:-1},{maxSpeed:NaN},{maxNeighbors:1.5},{timeHorizon:0},{neighborDistance:Infinity},{yieldAfterTicks:1},{nudgeStrength:NaN}]){
      const w=new World();for(const s of crowd.systems)w.addSystem(s);actor(w,'a',0,0,.1,cfg);actor(w,'b',1,0,-.1);
      w.createEntity('trace');w.addComponent('trace',{type:'DebugTrace',events:[],max:20});w.tick();
      expect(v(w,'a').vx).toBe(0);expect(Number.isFinite(v(w,'b').vx)).toBe(true);
      const events=w.getComponent<DebugTrace>('trace','DebugTrace')!.events;
      expect(events.some(e=>e.kind==='reject'&&e.what.includes('非法 1'))).toBe(true);expect(events.length).toBeLessThanOrEqual(3);
    }
  });
  it('旧流场避让与新配置同时填写时不二次求解，旧世界逐位兼容',()=>{
    const a=build(false,true),b=build(false,true);
    for(const w of [a,b]){w.getComponent<FlowAgent>('b','FlowAgent')!.orca={radius:.35};w.removeComponent('a','CrowdAvoidance');}
    b.removeComponent('b','CrowdAvoidance');tickN(a,20);tickN(b,20);
    expect([p(a,'b'),v(a,'b')]).toEqual([p(b,'b'),v(b,'b')]);
  });
  it('导航+转向+路径跟随+避让+移动组合在严格模式零定序环',()=>{
    const systems=[...crowd.systems,...nav.systems,...flow.systems,...motion.systems,...steeringCapability.systems,...pathFollowCapability.systems];
    const ids=topologicalSort(systems,{softCycle:'throw'}).map(s=>s.id);
    expect(ids.indexOf('crowd-capture')).toBeLessThan(ids.indexOf('nav-follow'));
    expect(ids.indexOf('flow-field')).toBeLessThan(ids.indexOf('crowd-avoidance'));
    expect(ids.indexOf('crowd-avoidance')).toBeLessThan(ids.indexOf('motion-apply'));
  });
  it('长时间无前向进展才收缩圆形碰撞体，空间不足时不恢复，脱困后恢复原半径',()=>{
    const w=new World();for(const s of crowd.systems)w.addSystem(s);
    actor(w,'a',0,0,.1,{radius:1,yieldAfterTicks:3,minRadiusScale:.8,radiusStep:.1});
    w.addComponent('a',{type:'Shape',kind:'circle',radius:1} as Shape);
    w.createEntity('block');w.addComponent('block',xf(1.3,0));
    w.addComponent('block',{type:'Shape',kind:'circle',radius:.5} as Shape);
    const shape=()=>w.getComponent<Shape>('a','Shape')!;
    w.tick();expect(shape().radius).toBe(1);
    v(w,'a').vx=.1;w.tick();expect(shape().radius).toBe(1);
    v(w,'a').vx=.1;w.tick();expect(shape().radius).toBe(1);
    v(w,'a').vx=.1;w.tick();expect(shape().radius).toBeCloseTo(.9);
    v(w,'a').vx=.1;w.tick();expect(shape().radius).toBeCloseTo(.8);
    expect(w.getComponent<CrowdAvoidance>('a','CrowdAvoidance')!.radius).toBe(1);
    for(let i=0;i<6;i++){v(w,'a').vx=0;v(w,'a').vy=0;w.tick();}
    expect(shape().radius).toBeCloseTo(.8);
    p(w,'a').x=-1;
    for(let i=0;i<3;i++){v(w,'a').vx=0;v(w,'a').vy=0;w.tick();}
    expect(shape().radius).toBeCloseTo(1);
  });
  it('ORCA、位移与硬碰撞同时运行：收缩只是撞墙后的兜底，仍不能穿墙',()=>{
    const w=new World();for(const cap of [crowd,motion,overlap,collision])for(const s of cap.systems)w.addSystem(s);
    actor(w,'a',0,0,.1,{radius:.35,maxSpeed:.1,yieldAfterTicks:5,minRadiusScale:.8,radiusStep:.05});
    w.addComponent('a',{type:'Shape',kind:'circle',radius:.35} as Shape);
    w.createEntity('wall');w.addComponent('wall',xf(1,0));
    w.addComponent('wall',{type:'Shape',kind:'box',width:.2,height:5} as Shape);
    const radius=()=>w.getComponent<Shape>('a','Shape')!.radius!;
    const wallShape=w.getComponent<Shape>('wall','Shape')!;
    for(let i=0;i<35;i++){
      v(w,'a').vx=.1;v(w,'a').vy=0;w.tick();
      expect(p(w,'a').x+radius()).toBeLessThanOrEqual(.900001);
    }
    expect(radius()).toBeCloseTo(.35);
    expect(Math.abs(p(w,'a').y)).toBeGreaterThan(.1);
    for(let i=0;i<150;i++){
      v(w,'a').vx=.1;v(w,'a').vy=0;w.tick();
      expect(contactBetween(p(w,'a'),w.getComponent<Shape>('a','Shape')!,p(w,'wall'),wallShape)?.depth ?? 0).toBeLessThan(1e-6);
    }
    expect(p(w,'a').x).toBeGreaterThan(1.5);
    expect(radius()).toBeCloseTo(.35);
    for(let i=0;i<20;i++){v(w,'a').vx=-.1;v(w,'a').vy=0;w.tick();}
    expect(radius()).toBeCloseTo(.35);
  });
  it('扰动与圆形足迹收缩的运行态可快照恢复',()=>{
    const make=()=>{
      const w=new World();for(const s of crowd.systems)w.addSystem(s);
      actor(w,'a',0,0,.1,{radius:1,yieldAfterTicks:3,minRadiusScale:.8,radiusStep:.1});
      w.addComponent('a',{type:'Shape',kind:'circle',radius:1} as Shape);
      return w;
    };
    expectRestoreContinues(make,w=>{
      for(let i=0;i<7;i++){v(w,'a').vx=.1;v(w,'a').vy=0;w.tick();}
      expect(w.getComponent<Shape>('a','Shape')!.radius).toBeCloseTo(.8);
    },w=>{
      p(w,'a').x=-1;
      for(let i=0;i<6;i++){v(w,'a').vx=0;v(w,'a').vy=0;w.tick();}
      expect(w.getComponent<Shape>('a','Shape')!.radius).toBeCloseTo(1);
    });
  });
});
