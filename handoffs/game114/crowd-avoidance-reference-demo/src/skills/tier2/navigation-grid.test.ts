import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import { topologicalSort } from '@engine/core/topological-sort.js';
import type { NavGraph, NavAgent, NavPath, Transform, Velocity, FlowField, DebugTrace } from '@engine/protocol/components.js';
import type { NavigationGrid, NavigationProfile } from '@engine/protocol/components/navigation-grid.js';
import { navigationGridCapability as grid, bakeNavigationProfile, clearNavigationGridCache, navigationGridBakes } from './navigation-grid.js';
import { pathfindCapability as nav, clearPathfindGraphCache, graphCell } from './pathfind.js';
import { flowFieldCapability as flow, bakeFlowField, clearFlowFieldCache } from './flow-field.js';
import { crowdAvoidanceCapability as crowd } from './crowd-avoidance.js';
import { motionApplyCapability as motion } from '../tier1/motion-apply.js';
import { steeringCapability } from './steering.js';
import { pathFollowCapability } from './path-follow.js';
import { tickN } from '../../test-fixtures/test-kit.js';

const xf = (x:number,y:number):Transform => ({type:'Transform',x,y,rotation:0,scaleX:1,scaleY:1});
const map = (over:Partial<NavigationGrid>={}):NavigationGrid => ({type:'NavigationGrid',originX:0,originY:0,cellSize:1,cols:9,rows:9,...over});
function setup(g=map(), radius=0, strict=false) {
  const w = new World({strict});
  for(const cap of [grid,nav,flow,motion]) for(const s of cap.systems) w.addSystem(s);
  w.createEntity('map'); w.addComponent('map',g);
  w.createEntity('profile');w.addComponent('profile',{type:'NavigationProfile',gridId:'map',radius,goals:[{x:7.5,y:4.5}]} as NavigationProfile);
  w.createEntity('target');w.addComponent('target',xf(7.5,4.5));
  w.createEntity('a');w.addComponent('a',xf(1.5,4.5));w.addComponent('a',{type:'NavAgent',graphId:'profile',speed:.1,arriveRange:.05} as NavAgent);
  w.addComponent('a',{type:'Relation',kind:'target',targetId:'target'});
  return w;
}
const pos=(w:World)=>w.getComponent<Transform>('a','Transform')!;
const vel=(w:World)=>w.getComponent<Velocity>('a','Velocity')!;
const path=(w:World)=>w.getComponent<NavPath>('a','NavPath')!;

describe('shared navigation grid',()=>{
  it('corner origin converts to navmesh centers without half-cell error, arbitrary cell sizes',()=>{
    for(const size of [.1,.3,1,12]) {
      const g=map({originX:-10,originY:7,cellSize:size,cols:3,rows:2});
      const result=bakeNavigationProfile(g,0)!;
      expect(result.nodes).toHaveLength(6);
      expect(result.nodes[0]).toEqual({x:-10+size/2,y:7+size/2});
      expect(graphCell(result,-10,7)).toBe(0);
      expect(graphCell(result,-10-1e-6,7)).toBe(-1);
      expect(graphCell(result,-10+3*size+1e-6,7)).toBe(-1);
    }
  });
  it('small clearance crosses a narrow passage but large profile cannot, boundary clearance is conservative',()=>{
    const blocked=new Array(17*17).fill(0);
    // Wall from top to bottom, three-cell opening in rows 7..9.
    for(let r=0;r<17;r++) if(r<7||r>9) blocked[r*17+8]=1;
    const g=map({cols:17,rows:17,blocked});
    const small=bakeNavigationProfile(g,.3)!, large=bakeNavigationProfile(g,1.1)!;
    expect(graphCell(small,8.5,8.5)).toBeGreaterThanOrEqual(0);
    expect(graphCell(large,8.5,8.5)).toBe(-1);
    expect(graphCell(small,.5,8.5)).toBe(-1);
    expect(graphCell(small,1.5,8.5)).toBeGreaterThanOrEqual(0);
    for(let i=0;i<blocked.length;i++)if(blocked[i])expect(small.grid!.blocked[i]).toBe(1);
  });
  it('diagonally touching walls have no graph edge and no flow route',()=>{
    const w=setup(map({cols:2,rows:2,blocked:[0,1,1,0]}));
    w.getComponent<NavigationProfile>('profile','NavigationProfile')!.goals=[{x:1.5,y:1.5}];w.tick();
    const graph=w.getComponent<NavGraph>('profile','NavGraph')!, field=w.getComponent<FlowField>('profile','FlowField')!;
    expect(graph.edges).toEqual([]);expect(field.blocked).toEqual([0,1,1,0]);
    expect(Array.from(bakeFlowField(field).dir).slice(0,2)).toEqual([0,0]);
  });
  it('A* and flow use matching masks and both route around a wall',()=>{
    const blocked=new Array(81).fill(0);for(let r=2;r<7;r++)blocked[r*9+4]=1;
    const w=setup(map({blocked}));
    w.createEntity('f');w.addComponent('f',xf(1.5,4.5));w.addComponent('f',{type:'FlowAgent',fieldId:'profile',speed:.05});
    w.tick();const g=w.getComponent<NavGraph>('profile','NavGraph')!,f=w.getComponent<FlowField>('profile','FlowField')!;
    expect(g.grid!.blocked).toEqual(f.blocked);expect(g.grid!.cost).toEqual(f.cost);
    for(let i=0;i<400;i++) {
      w.tick();for(const id of ['a','f']){const p=w.getComponent<Transform>(id,'Transform')!;expect(graphCell(g,p.x,p.y)).toBeGreaterThanOrEqual(0);}
    }
    expect(Math.hypot(pos(w).x-7.5,pos(w).y-4.5)).toBeLessThan(.1);
    const p=w.getComponent<Transform>('f','Transform')!;expect(Math.floor(p.x)).toBe(7);expect(Math.floor(p.y)).toBe(4);
  });
  it('goal-only change preserves graph identity and does not rebake static geometry',()=>{
    clearNavigationGridCache();const w=setup();w.tick();const old=w.getComponent('profile','NavGraph');const count=navigationGridBakes();
    w.getComponent<NavigationProfile>('profile','NavigationProfile')!.goals=[{x:2.5,y:3.5}];w.tick();
    expect(w.getComponent('profile','NavGraph')).toBe(old);expect(navigationGridBakes()).toBe(count);
    expect(w.getComponent<FlowField>('profile','FlowField')!.goals).toEqual([{x:2.5,y:3.5}]);
  });
  it('tracks a moving target within its grid cell without running A* every tick',()=>{
    const w=setup();w.tick();
    const target=w.getComponent<Transform>('target','Transform')!;
    const first=path(w).gx;
    target.x+=.12;w.tick();
    expect(path(w).gx).toBe(first);
    expect(path(w).age).toBe(2);
    expect(vel(w).vx).toBeGreaterThan(0);
    target.x=6.5;w.tick();
    expect(path(w).gx).toBe(6.5);
    expect(path(w).age).toBe(1);
  });
  it('patrols fixed grid waypoints without chasing a moving target or stop-go jitter',()=>{
    const w=setup();
    w.removeComponent('a','Relation');
    w.getComponent<NavAgent>('a','NavAgent')!.patrol={waypoints:[{x:1.5,y:4.5},{x:7.5,y:4.5}],index:0,loop:true};
    let forward=0,backward=0,nearStops=0,changes=0,lastIndex=0;
    for(let i=0;i<180;i++){
      w.tick();
      const agent=w.getComponent<NavAgent>('a','NavAgent')!;
      if(agent.patrol!.index!==lastIndex){changes++;lastIndex=agent.patrol!.index!;}
      if(vel(w).vx>.01)forward++;
      if(vel(w).vx<-.01)backward++;
      const goal=agent.patrol!.waypoints[agent.patrol!.index!]!;
      if(Math.hypot(pos(w).x-goal.x,pos(w).y-goal.y)<.5&&Math.hypot(vel(w).vx,vel(w).vy)<.005)nearStops++;
    }
    expect(changes).toBeGreaterThanOrEqual(2);
    expect(forward).toBeGreaterThan(30);
    expect(backward).toBeGreaterThan(30);
    expect(nearStops).toBeLessThan(3);
  });
  it('preserves patrol target selection through snapshot restoration and rejects bad points',()=>{
    const make=()=>{
      const w=setup(map(),0,true);
      w.removeComponent('a','Relation');
      w.getComponent<NavAgent>('a','NavAgent')!.patrol={waypoints:[{x:1.5,y:4.5},{x:7.5,y:4.5}],index:0,loop:true};
      return w;
    };
    const a=make();tickN(a,15);const snapshot=JSON.parse(JSON.stringify(a.snapshot()));
    tickN(a,90);
    const b=make();b.restore(snapshot);tickN(b,90);
    expect(b.snapshot()).toEqual(a.snapshot());
    b.getComponent<NavAgent>('a','NavAgent')!.patrol!.waypoints[0].x=NaN;
    b.tick();
    expect(vel(b)).toMatchObject({vx:0,vy:0});
    expect(b.hasComponent('a','NavPath')).toBe(false);
  });
  it('obstacle updates invalidate path immediately and unreachable stops instead of fallback',()=>{
    const w=setup();w.tick();const key=path(w).graphKey;
    const blocked=new Array(81).fill(0);for(let r=0;r<9;r++)blocked[r*9+4]=1;
    w.getComponent<NavigationGrid>('map','NavigationGrid')!.blocked=blocked;w.tick();
    expect(path(w).graphKey).not.toBe(key);expect(path(w).reachable).toBe(false);expect(vel(w)).toMatchObject({vx:0,vy:0});
    w.getComponent<NavigationGrid>('map','NavigationGrid')!.blocked=undefined;w.tick();
    expect(path(w).reachable).toBe(true);expect(vel(w).vx).toBeGreaterThan(0);
  });
  it('explicit profile selection bypasses singleton and profile switches invalidate cache',()=>{
    const w=setup(map(),0,true);
    w.createEntity('other');w.addComponent('other',{type:'NavGraph',nodes:[{x:1.5,y:4.5},{x:7.5,y:4.5}],edges:[]} as NavGraph);
    w.tick();expect(vel(w).vx).toBeGreaterThan(0);
    w.getComponent<NavAgent>('a','NavAgent')!.graphId='other';w.tick();expect(path(w).reachable).toBe(false);expect(vel(w).vx).toBe(0);
    w.getComponent<NavAgent>('a','NavAgent')!.graphId='missing';w.tick();expect(vel(w).vx).toBe(0);expect(w.hasComponent('a','NavPath')).toBe(false);
  });
  it('off-grid / blocked targets and malformed explicit graphs stop safely',()=>{
    const w=setup();w.tick();w.getComponent<Transform>('target','Transform')!.x=99;w.tick();expect(vel(w).vx).toBe(0);
    w.removeComponent('profile','NavigationProfile');w.addComponent('profile',{type:'NavGraph',nodes:null,edges:[]} as unknown as NavGraph);
    expect(()=>w.tick()).not.toThrow();expect(vel(w).vx).toBe(0);
  });
  it('invalid authored data removes stale outputs and records bounded trace',()=>{
    for(const bad of [{cellSize:0},{cols:NaN},{cost:[1]},{blocked:[2]},{originX:Infinity}]) {
      const w=setup();w.createEntity('trace');w.addComponent('trace',{type:'DebugTrace',events:[],max:30});w.tick();
      Object.assign(w.getComponent('map','NavigationGrid')!,bad);w.tick();
      expect(w.hasComponent('profile','NavGraph')).toBe(false);expect(w.hasComponent('profile','FlowField')).toBe(false);expect(vel(w).vx).toBe(0);
      const events=w.getComponent<DebugTrace>('trace','DebugTrace')!.events;
      expect(events.some(e=>e.system==='navigation-grid'&&e.kind==='reject')).toBe(true);
    }
  });
  it('slow movement survives repeated replans and high speed does not overshoot waypoints',()=>{
    const w=setup();w.getComponent<NavAgent>('a','NavAgent')!.speed=.005;tickN(w,500);expect(pos(w).x).toBeGreaterThan(3.9);
    const fast=setup();fast.getComponent<NavAgent>('a','NavAgent')!.speed=10;tickN(fast,10);expect(pos(fast).x).toBe(7.5);
  });
  it('cache clearing and snapshot restoration preserve output and future trajectory',()=>{
    const a=setup();tickN(a,15);const snap=JSON.parse(JSON.stringify(a.snapshot()));
    tickN(a,100);clearNavigationGridCache();clearPathfindGraphCache();clearFlowFieldCache();
    const b=setup();b.restore(snap);tickN(b,100);expect(b.snapshot()).toEqual(a.snapshot());
    const g=map();const one=bakeNavigationProfile(g,.3)!;one.nodes.length=0;
    expect(bakeNavigationProfile(g,.3)!.nodes.length).toBeGreaterThan(0);
  });
  it('new stages mix with all movement systems without ordering cycles or strict access violations',()=>{
    const caps=[grid,nav,flow,crowd,motion,steeringCapability,pathFollowCapability];
    const sorted=topologicalSort(caps.flatMap(c=>[...c.systems]),{softCycle:'throw'}).map(s=>s.id);
    expect(sorted.indexOf('navigation-grid')).toBeLessThan(sorted.indexOf('nav-follow'));
    expect(sorted.indexOf('crowd-avoidance')).toBeLessThan(sorted.indexOf('motion-apply'));
    const w=setup(map(),0,true);for(const cap of [crowd,steeringCapability,pathFollowCapability])for(const s of cap.systems)w.addSystem(s);
    w.addComponent('a',{type:'CrowdAvoidance',radius:.1,maxSpeed:.1});expect(()=>tickN(w,5)).not.toThrow();
  });
});
