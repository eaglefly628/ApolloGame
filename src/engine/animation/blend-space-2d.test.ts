import { describe, expect, it } from 'vitest';
import { compileBlendSpace2D, evaluateBlendSpace2D, BLEND_SPACE_WEIGHT_Q, type BlendSpaceDefinition2D, type CompiledBlendSpace2D } from './blend-space-2d.js';
function fan(): BlendSpaceDefinition2D { return { samples: [
  {id:'O',clip:'idle',xQps:0,yQps:0},{id:'E',clip:'right',xQps:100,yQps:0},{id:'N',clip:'forward',xQps:0,yQps:100},{id:'W',clip:'left',xQps:-100,yQps:0},{id:'S',clip:'back',xQps:0,yQps:-100}], triangles:[
  {id:'a',vertices:['O','E','N']},{id:'b',vertices:['O','N','W']},{id:'c',vertices:['O','W','S']},{id:'d',vertices:['O','S','E']}] }; }
function tri(): BlendSpaceDefinition2D { return {samples:[{id:'A',clip:'one',xQps:0,yQps:0},{id:'B',clip:'two',xQps:3,yQps:0},{id:'C',clip:'three',xQps:0,yQps:3}],triangles:[{id:'only',vertices:['A','B','C']}]}; }
const clone = <T>(x:T): T => JSON.parse(JSON.stringify(x)) as T;
const weights=(s:CompiledBlendSpace2D,xQps:number,yQps:number)=>Object.fromEntries(evaluateBlendSpace2D(s,{xQps,yQps}).samples.map(p=>[p.id,p.weightQ]));
describe('authored convex 2D blend-space compiler and exact integer weights',()=>{
  it('samples every fan vertex, center and edge using independently calculated barycentric weights',()=>{
    const s=compileBlendSpace2D(fan());
    for(const [id,x,y] of [['O',0,0],['E',100,0],['N',0,100],['W',-100,0],['S',0,-100]] as const){const w=weights(s,x,y);expect(w[id]).toBe(1_000_000);expect(Object.values(w).reduce((a,b)=>a+b,0)).toBe(1_000_000);}
    expect(weights(s,25,25)).toEqual({E:250000,N:250000,O:500000,S:0,W:0});
    expect(weights(s,50,0)).toEqual({E:500000,N:0,O:500000,S:0,W:0});
    expect(evaluateBlendSpace2D(s,{xQps:50,yQps:0}).region).toEqual({kind:'inside',triangleId:'a'});
  });
  it('apportions equal thirds by greatest remainder and stable sample IDs',()=>{
    const s=compileBlendSpace2D(tri());expect(weights(s,1,1)).toEqual({A:333334,B:333333,C:333333});
    // At (2,0), exact fractions are A=1/3 and B=2/3. B has the larger remainder.
    expect(weights(s,2,0)).toEqual({A:333333,B:666667,C:0});
  });
  it('projects outside to the closest boundary segment without extrapolation, with stable vertex-edge ties',()=>{
    const s=compileBlendSpace2D(fan());expect(weights(s,100,100)).toEqual({E:500000,N:500000,O:0,S:0,W:0});
    expect(evaluateBlendSpace2D(s,{xQps:200,yQps:0}).region).toEqual({kind:'projected',edgeId:'E|N'});
    expect(weights(s,200,0)).toEqual({E:1000000,N:0,O:0,S:0,W:0});
    expect(weights(s,-200,-200)).toEqual({E:0,N:0,O:0,S:500000,W:500000});
  });
  it('uses rational nearest-edge projection for unequal-length edges',()=>{
    const source={samples:[{id:'A',clip:'a',xQps:0,yQps:0},{id:'B',clip:'b',xQps:4,yQps:0},{id:'C',clip:'c',xQps:0,yQps:2}],triangles:[{id:'t',vertices:['A','B','C']}]};
    const s=compileBlendSpace2D(source);const r=evaluateBlendSpace2D(s,{xQps:3,yQps:2});
    // Projection onto x+2y=4: (3,2)-(3/5,6/5)=(12/5,4/5), B=.6/C=.4.
    expect(r.region).toEqual({kind:'projected',edgeId:'B|C'});expect(weights(s,3,2)).toEqual({A:0,B:600000,C:400000});
  });
  it('normalizes CW/rotated triangles and source insertion order to identical canonical data and results',()=>{
    const original=fan(), scrambled=clone(original) as any;scrambled.samples.reverse();scrambled.triangles.reverse();for(const t of scrambled.triangles)t.vertices=[t.vertices[1],t.vertices[0],t.vertices[2]];
    const a=compileBlendSpace2D(original),b=compileBlendSpace2D(scrambled);expect(a.canonical).toEqual(b.canonical);
    for(const [x,y] of [[0,0],[30,-10],[50,0],[200,200],[-80,60]])expect(evaluateBlendSpace2D(a,{xQps:x,yQps:y})).toEqual(evaluateBlendSpace2D(b,{xQps:x,yQps:y}));
  });
  it('aggregates duplicate clip aliases after exact sample apportionment',()=>{
    const f=clone(fan()) as any;f.samples.find((p:any)=>p.id==='N').clip='idle';const s=compileBlendSpace2D(f);const r=evaluateBlendSpace2D(s,{xQps:25,yQps:25});
    expect(r.clips).toEqual({back:0,idle:750000,left:0,right:250000});expect(Object.values(r.clips).reduce((a,b)=>a+b,0)).toBe(BLEND_SPACE_WEIGHT_Q);
  });
  it('keeps >2^53 area comparisons exact using the ±1e9 coordinate limits',()=>{
    const s=compileBlendSpace2D({samples:[{id:'A',clip:'a',xQps:-1000000000,yQps:-1000000000},{id:'B',clip:'b',xQps:1000000000,yQps:-1000000000},{id:'C',clip:'c',xQps:0,yQps:1000000000}],triangles:[{id:'t',vertices:['A','B','C']}]});
    expect(weights(s,0,0)).toEqual({A:250000,B:250000,C:500000});expect(weights(s,1000000000,1000000000)).toEqual({A:0,B:200000,C:800000});
  });
  it('accepts a convex boundary with an authored collinear boundary sample',()=>{
    const s=compileBlendSpace2D({samples:[{id:'A',clip:'a',xQps:0,yQps:0},{id:'B',clip:'b',xQps:2,yQps:0},{id:'C',clip:'c',xQps:4,yQps:0},{id:'D',clip:'d',xQps:0,yQps:4}],triangles:[{id:'a',vertices:['A','B','D']},{id:'b',vertices:['B','C','D']}]});expect(weights(s,2,0)).toEqual({A:0,B:1000000,C:0,D:0});
  });
  it.each([
    ['duplicate point ID',(d:any)=>{d.samples[1].id=d.samples[0].id;}],
    ['duplicate coordinates',(d:any)=>{d.samples[1].xQps=0;d.samples[1].yQps=0;}],
    ['unknown reference',(d:any)=>{d.triangles[0].vertices[0]='unknown';}],
    ['repeated vertex',(d:any)=>{d.triangles[0].vertices[1]=d.triangles[0].vertices[0];}],
    ['duplicate triangle',(d:any)=>{d.triangles.push({...d.triangles[0],id:'another',vertices:[...d.triangles[0].vertices].reverse()});}],
    ['duplicate triangle ID',(d:any)=>{d.triangles[1].id=d.triangles[0].id;}],
    ['unused point',(d:any)=>{d.samples.push({id:'unused',clip:'x',xQps:1,yQps:1});}],
    ['NaN',(d:any)=>{d.samples[0].xQps=NaN;}],
    ['fraction',(d:any)=>{d.samples[0].xQps=.5;}],
    ['unsafe coordinate',(d:any)=>{d.samples[0].xQps=1000000001;}],
    ['negative zero',(d:any)=>{d.samples[0].xQps=-0;}],
    ['extra field',(d:any)=>{d.samples[0].speed=1;}],
  ])('rejects %s without repairing author input',(_name,mutate)=>{const d=clone(fan());mutate(d);expect(()=>compileBlendSpace2D(d)).toThrow(/BlendSpace2D/);});
  it('rejects degenerate triangles, concave domains, disconnection and overlapping interiors',()=>{
    const make=(xy:number[][],ts:number[][])=>({samples:xy.map(([xQps,yQps],i)=>({id:`p${i}`,clip:'x',xQps,yQps})),triangles:ts.map((ids,i)=>({id:`t${i}`,vertices:ids.map(n=>`p${n}`)}))});
    const bad=[
      make([[0,0],[1,0],[2,0]],[[0,1,2]]),
      make([[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]],[[0,1,2],[0,2,3],[0,3,4],[0,4,5]]),
      make([[0,0],[2,0],[0,2],[10,10],[12,10],[10,12]],[[0,1,2],[3,4,5]]),
      make([[0,0],[10,0],[0,10],[1,1],[2,1],[1,2]],[[0,1,2],[3,4,5]]),
      make([[0,0],[4,0],[2,4],[0,3],[4,3],[2,-1]],[[0,1,2],[3,4,5]]),
    ];for(const d of bad)expect(()=>compileBlendSpace2D(d)).toThrow(/BlendSpace2D/);
  });
  it('rejects holes, T-junctions and nonmanifold edges',()=>{
    const make=(xy:number[][],ts:number[][])=>({samples:xy.map(([xQps,yQps],i)=>({id:`p${i}`,clip:'x',xQps,yQps})),triangles:ts.map((ids,i)=>({id:`t${i}`,vertices:ids.map(n=>`p${n}`)}))});
    const ring=make([[0,0],[6,0],[6,6],[0,6],[2,2],[4,2],[4,4],[2,4]],[[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]]);
    expect(()=>compileBlendSpace2D(ring)).toThrow(/holes|boundary/);
    expect(()=>compileBlendSpace2D(make([[0,0],[4,0],[4,4],[0,4],[2,2]],[[0,1,2],[0,4,3],[4,2,3]]))).toThrow(/overlapping|junction/);
    expect(()=>compileBlendSpace2D(make([[0,0],[4,0],[2,2],[2,-2],[2,3]],[[0,1,2],[1,0,3],[0,1,4]]))).toThrow(/nonmanifold|overlapping/);
  });
  it('rejects hooks/accessors/hidden arrays/symbols/shared references without calling hooks',()=>{
    let calls=0;const bad:unknown[]=[];let d:any=clone(fan());Object.defineProperty(d,'toJSON',{value:()=>{calls++;return fan();}});bad.push(d);
    d=clone(fan());Object.defineProperty(d.samples[0],'xQps',{enumerable:true,get(){calls++;return 0;}});bad.push(d);
    d=clone(fan());Object.defineProperty(d.samples,'map',{value:()=>{calls++;return [];}});bad.push(d);
    d=clone(fan());d.samples[0][Symbol('bad')]=1;bad.push(d);
    d=clone(fan());d.triangles[1].vertices=d.triangles[0].vertices;bad.push(d);
    d=clone(fan());Object.setPrototypeOf(d.samples,Object.create(Array.prototype));bad.push(d);
    for(const x of bad)expect(()=>compileBlendSpace2D(x)).toThrow(/BlendSpace2D/);expect(calls).toBe(0);
  });
  it('refuses sparse arrays, cycles and budget overflows before geometry',()=>{
    const d:any=clone(fan());delete d.samples[1];expect(()=>compileBlendSpace2D(d)).toThrow(/array/);
    const cycle:any=clone(fan());cycle.loop=cycle;expect(()=>compileBlendSpace2D(cycle)).toThrow();
    const huge:any=clone(fan());huge.samples=Array.from({length:65},(_,i)=>({id:`p${i}`,clip:'x',xQps:i,yQps:i*i}));expect(()=>compileBlendSpace2D(huge)).toThrow(/budget/);
    huge.samples=clone(fan().samples);huge.triangles=Array.from({length:129},(_,i)=>({id:`t${i}`,vertices:['a','b','c']}));expect(()=>compileBlendSpace2D(huge)).toThrow(/budget/);
  });
  it('compiles the full 64-point budget and keeps integer weights nonnegative/exact over a grid',()=>{
    // 63 points on a convex parabola boundary; its closing chord is the upper edge.
    const samples=Array.from({length:63},(_,x)=>({id:`b${String(x).padStart(2,'0')}`,clip:'boundary',xQps:x,yQps:x*x}));
    samples.push({id:'center',clip:'center',xQps:31,yQps:1400});
    const triangles=Array.from({length:63},(_,i)=>({id:`t${String(i).padStart(2,'0')}`,vertices:['center',samples[i].id,samples[(i+1)%63].id]}));
    const s=compileBlendSpace2D({samples,triangles});expect(s.canonical.samples).toHaveLength(64);
    for(let x=-5;x<=65;x+=5)for(let y=-100;y<=4000;y+=137){const r=evaluateBlendSpace2D(s,{xQps:x,yQps:y});expect(r.samples.every(p=>Number.isInteger(p.weightQ)&&p.weightQ>=0)).toBe(true);expect(r.samples.reduce((sum,p)=>sum+p.weightQ,0)).toBe(1000000);expect(Object.values(r.clips).reduce((sum,n)=>sum+n,0)).toBe(1000000);}
  });
  it('rejects malformed queries and forged compiled objects without dispatching user methods',()=>{
    const s=compileBlendSpace2D(fan());let calls=0;const query={yQps:0};Object.defineProperty(query,'xQps',{enumerable:true,get(){calls++;return 0;}});
    for(const q of [query,{xQps:0,yQps:0,extra:1},{xQps:0,yQps:Infinity},{xQps:1.5,yQps:0}])expect(()=>evaluateBlendSpace2D(s,q)).toThrow();
    expect(()=>evaluateBlendSpace2D({evaluate(){calls++;}} as unknown as CompiledBlendSpace2D,{xQps:0,yQps:0})).toThrow();expect(calls).toBe(0);
  });
  it('does not mutate author data and exposes only deeply frozen canonical/output data',()=>{
    const d=fan(),before=JSON.stringify(d),s=compileBlendSpace2D(d),r=evaluateBlendSpace2D(s,{xQps:25,yQps:25});expect(JSON.stringify(d)).toBe(before);
    expect(()=>{(s.canonical.samples[0] as any).xQps=99;}).toThrow();expect(()=>{(r.clips as any).idle=0;}).toThrow();expect(()=>{(r.samples[0] as any).weightQ=0;}).toThrow();
    expect(weights(s,25,25)).toEqual({E:250000,N:250000,O:500000,S:0,W:0});
  });
});
