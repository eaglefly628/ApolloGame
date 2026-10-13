import { describe, expect, it } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Transform, NavPath, Velocity, NavGraph, FlowField } from '@engine/protocol/components.js';
import { navigationGridCapability as grid, bakeNavigationProfile, clearNavigationGridCache } from './navigation-grid.js';
import { pathfindCapability as nav, clearPathfindGraphCache, graphCell } from './pathfind.js';
import { motionApplyCapability as motion } from '../tier1/motion-apply.js';
import type { NavigationGrid } from '@engine/protocol/components/navigation-grid.js';
import { bakeFlowField } from './flow-field-core.js';

const data = (blocked?: number[]): NavigationGrid => ({ type:'NavigationGrid',originX:10,originY:-4,cellSize:1,cols:5,rows:3,blocked });
function world(speed=.1, repathPeriod=30) {
  const w=new World();for(const c of [grid,nav,motion])for(const s of c.systems)w.addSystem(s);
  w.createEntity('map');w.addComponent('map',data());
  w.createEntity('profile');w.addComponent('profile',{type:'NavigationProfile',gridId:'map',radius:0});
  w.createEntity('goal');w.addComponent('goal',{type:'Transform',x:14.5,y:-2.5,rotation:0,scaleX:1,scaleY:1});
  w.createEntity('a');w.addComponent('a',{type:'Transform',x:10.5,y:-2.5,rotation:0,scaleX:1,scaleY:1});
  w.addComponent('a',{type:'NavAgent',graphId:'profile',speed,arriveRange:.01,repathPeriod});
  w.addComponent('a',{type:'Relation',kind:'target',targetId:'goal'});
  return w;
}
const pos=(w:World)=>w.getComponent<Transform>('a','Transform')!;

describe('REQ-114 independent grid review',()=>{
  it('nonzero corner origin is converted into exact cell centers, without cache aliases',()=>{
    clearNavigationGridCache();const a=bakeNavigationProfile(data(),0)!;
    expect(a.nodes[0]).toEqual({x:10.5,y:-3.5});
    a.nodes[0].x=999;a.grid!.blocked[0]=1;
    const b=bakeNavigationProfile(data(),0)!;
    expect(b.nodes[0]).toEqual({x:10.5,y:-3.5});expect(b.grid!.blocked[0]).toBe(0);
  });
  it('new disconnect immediately invalidates a previously cached reachable path',()=>{
    const w=world();w.tick();expect(w.getComponent<NavPath>('a','NavPath')!.reachable).toBe(true);
    const m=w.getComponent<NavigationGrid>('map','NavigationGrid')!;
    m.blocked=Array.from({length:15},(_,i)=>i%5===2?1:0);
    const old={x:pos(w).x,y:pos(w).y};w.tick();
    expect({x:pos(w).x,y:pos(w).y}).toEqual(old);
    expect(w.getComponent<NavPath>('a','NavPath')!.reachable).toBe(false);
    expect(w.getComponent<Velocity>('a','Velocity')!.vx).toBe(0);
  });
  it('slow movement continues forward across periodic replans',()=>{
    const w=world(.005,30);
    for(let i=0;i<500;i++)w.tick();
    expect(pos(w).x).toBeGreaterThan(12);
  });
  it('malformed explicitly selected graph rejects before dereferencing nodes',()=>{
    const w=world();w.tick();w.removeComponent('profile','NavigationProfile');
    w.addComponent('profile',{type:'NavGraph',nodes:null,edges:[]} as unknown as NavGraph);
    expect(()=>w.tick()).not.toThrow();
    expect(w.getComponent<Velocity>('a','Velocity')!.vx).toBe(0);
  });
  it('malformed explicit grid metadata without required arrays stops safely',()=>{
    for(const missing of ['blocked','cost']){
      const w=world();w.tick();w.removeComponent('profile','NavigationProfile');
      const graph=w.getComponent<NavGraph>('profile','NavGraph')!;
      delete (graph.grid as unknown as Record<string,unknown>)[missing];
      expect(()=>w.tick()).not.toThrow();
      expect(w.getComponent<Velocity>('a','Velocity')!.vx).toBe(0);
    }
  });
  it('shared terrain flow chooses an edge consistent with its integration cost',()=>{
    const g:NavigationGrid={type:'NavigationGrid',originX:0,originY:0,cellSize:1,cols:3,rows:2,cost:[10,1,1,1,1,1]};
    const w=new World();for(const s of grid.systems)w.addSystem(s);
    w.createEntity('map');w.addComponent('map',g);
    w.createEntity('p');w.addComponent('p',{type:'NavigationProfile',gridId:'map',radius:0,goals:[{x:2.5,y:1.5}]});
    w.tick();const field=w.getComponent<FlowField>('p','FlowField')!;
    expect(field.costAware).toBe(true);
    const flow=bakeFlowField(field);
    const dx=flow.dir[0],dy=flow.dir[1],next=dy*3+dx;
    const chosenCost=flow.integration[next]+(dx&&dy?14:10)*10;
    expect(chosenCost).toBe(flow.integration[0]);
  });
  it('clearing graph cache cannot change a world after serialized graph edges change',()=>{
    const run=(clear:boolean)=>{
      clearPathfindGraphCache();const w=world(.1,0);w.tick();
      w.getComponent<NavGraph>('profile','NavGraph')!.edges=[];
      if(clear)clearPathfindGraphCache();
      w.tick();return {x:pos(w).x,path:w.getComponent<NavPath>('a','NavPath')};
    };
    expect(run(false)).toEqual(run(true));
  });
  it('in-place graph edge, node, and grid metadata mutations invalidate exact path identity',()=>{
    const mutations:Array<(g:NavGraph)=>void>=[
      g=>{g.edges[0].cost=5;},
      g=>{g.nodes[0].x+=.25;},
      g=>{g.grid!.originX-=.25;},
      g=>{g.grid!.blocked[0]=1;},
      g=>{g.grid!.cost[0]=3;},
    ];
    for(const mutate of mutations){
      clearPathfindGraphCache();const w=world(.1,1000);w.tick();
      const before=w.getComponent<NavPath>('a','NavPath')!.graphKey;
      mutate(w.getComponent<NavGraph>('profile','NavGraph')!);
      w.tick();const path=w.getComponent<NavPath>('a','NavPath')!;
      expect(path.graphKey).not.toBe(before);
      expect(path.age).toBe(1);
    }
  });
  it('off-center starts and frequent replanning keep each navigation segment out of blocked cells',()=>{
    for(const speed of [.05,.49,1.9])for(const offset of [.01,.5,.99]){
      const w=world(speed,1);
      w.getComponent<NavigationGrid>('map','NavigationGrid')!.blocked=Array.from({length:15},(_,i)=>i===7?1:0);
      pos(w).x=10.99;pos(w).y=-3+offset;
      for(let tick=0;tick<120;tick++){
        const before={x:pos(w).x,y:pos(w).y};w.tick();
        const after=pos(w),g=w.getComponent<NavGraph>('profile','NavGraph')!;
        for(let sample=0;sample<=10;sample++){
          const t=sample/10;
          expect(graphCell(g,before.x+(after.x-before.x)*t,before.y+(after.y-before.y)*t)).toBeGreaterThanOrEqual(0);
        }
      }
      expect(Math.hypot(pos(w).x-14.5,pos(w).y+2.5)).toBeLessThan(.02);
    }
  });
});
