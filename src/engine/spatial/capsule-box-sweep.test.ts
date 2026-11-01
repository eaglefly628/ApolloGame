import {describe,it,expect} from 'vitest';
import {sweepCapsuleBoxQ,SWEEP_TIME_Q,type CapsuleBoxSweepInput} from './capsule-box-sweep.js';
const input=():CapsuleBoxSweepInput=>({foot:{x:0,y:0,z:0},delta:{x:1000,y:0,z:0},radiusQ:10,heightQ:40,box:{min:{x:100,y:-100,z:-100},max:{x:101,y:100,z:100}}});
describe('continuous vertical capsule vs static box primitive',()=>{
 it('cannot tunnel through a thin wall despite a far endpoint',()=>{expect(sweepCapsuleBoxQ(input())).toEqual({kind:'hit',timeQ:90_000_000,normalQ:{x:-1_000_000,y:0,z:0}});});
 it('finds landing from above and ceiling contact on the actual capsule top',()=>{
  const floor={...input(),foot:{x:0,y:100,z:0},delta:{x:0,y:-200,z:0},box:{min:{x:-100,y:-10,z:-100},max:{x:100,y:0,z:100}}};expect(sweepCapsuleBoxQ(floor)).toEqual({kind:'hit',timeQ:500_000_000,normalQ:{x:0,y:1_000_000,z:0}});
  const ceiling={...input(),delta:{x:0,y:100,z:0},box:{min:{x:-100,y:60,z:-100},max:{x:100,y:80,z:100}}};expect(sweepCapsuleBoxQ(ceiling)).toEqual({kind:'hit',timeQ:200_000_000,normalQ:{x:0,y:-1_000_000,z:0}});
 });
 it('does not block tangent ground movement or movement away from a touching wall',()=>{
  const floor={...input(),box:{min:{x:-10000,y:-10,z:-100},max:{x:10000,y:0,z:100}}};expect(sweepCapsuleBoxQ(floor)).toEqual({kind:'clear'});
  expect(sweepCapsuleBoxQ({...input(),foot:{x:90,y:0,z:0},delta:{x:-100,y:0,z:0}})).toEqual({kind:'clear'});
  expect(sweepCapsuleBoxQ({...input(),foot:{x:90,y:0,z:0}})).toMatchObject({kind:'hit',timeQ:0});
 });
 it('keeps rounded corners rather than sweeping only the capsule bounding prism',()=>{
  const corner={...input(),foot:{x:-20000,y:0,z:-9000},delta:{x:10000,y:0,z:0},radiusQ:10000,heightQ:40000,box:{min:{x:0,y:-100000,z:0},max:{x:100000,y:100000,z:100000}}};
  expect(sweepCapsuleBoxQ(corner)).toEqual({kind:'clear'});
  const hit=sweepCapsuleBoxQ({...corner,delta:{x:20000,y:0,z:0}});expect(hit.kind).toBe('hit');if(hit.kind==='hit'){const exact=(20000-Math.sqrt(10000**2-9000**2))/20000;expect(hit.timeQ/SWEEP_TIME_Q).toBeLessThanOrEqual(exact);expect(exact-hit.timeQ/SWEEP_TIME_Q).toBeLessThan(.00005);expect(hit.normalQ.z).toBeLessThan(-890000);}
 });
 it('reports initial penetration distinctly and does not mutate source input',()=>{const x={...input(),foot:{x:100,y:0,z:0}};const before=JSON.stringify(x);expect(sweepCapsuleBoxQ(x)).toEqual({kind:'initial-overlap'});expect(JSON.stringify(x)).toBe(before);});
 it('handles an end-of-segment contact, stationary misses, and negative motion symmetrically',()=>{
  expect(sweepCapsuleBoxQ({...input(),delta:{x:90,y:0,z:0}})).toMatchObject({kind:'hit',timeQ:SWEEP_TIME_Q});
  expect(sweepCapsuleBoxQ({...input(),delta:{x:0,y:0,z:0}})).toEqual({kind:'clear'});
  expect(sweepCapsuleBoxQ({...input(),foot:{x:201,y:0,z:0},delta:{x:-1000,y:0,z:0}})).toMatchObject({kind:'hit',timeQ:90_000_000,normalQ:{x:1_000_000}});
 });
 it('rejects bad geometry, budget violations and accessors without executing them',()=>{
  expect(()=>sweepCapsuleBoxQ({...input(),heightQ:19})).toThrow();expect(()=>sweepCapsuleBoxQ({...input(),delta:{x:1e9,y:0,z:0}})).toThrow();expect(()=>sweepCapsuleBoxQ({...input(),radiusQ:NaN})).toThrow();
  let called=false;const x=Object.defineProperty(input(),'foot',{enumerable:true,get(){called=true;return {x:0,y:0,z:0};}});expect(()=>sweepCapsuleBoxQ(x)).toThrow();expect(called).toBe(false);
 });
 it('does not miss sampled interior intersections in reproducible diagonal sweeps',()=>{
  let seed=19;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  const box={min:{x:-100,y:-100,z:-100},max:{x:100,y:100,z:100}};
  for(let n=0;n<80;n++){
   const q={foot:{x:(next()%1200)-600,y:(next()%800)-400,z:(next()%1200)-600},delta:{x:(next()%2000)-1000,y:(next()%1000)-500,z:(next()%2000)-1000},radiusQ:20,heightQ:80,box};
   const out=sweepCapsuleBoxQ(q);let seen=false;
   for(let i=0;i<=1000;i++){const t=i/1000,x=q.foot.x+q.delta.x*t,y=q.foot.y+20+q.delta.y*t,z=q.foot.z+q.delta.z*t;const dx=Math.max(-100-x,0,x-100),dy=Math.max(-140-y,0,y-100),dz=Math.max(-100-z,0,z-100);if(dx*dx+dy*dy+dz*dz<400-1e-8){seen=true;break;}}
   if(out.kind==='clear')expect(seen).toBe(false);
  }
 });
});
