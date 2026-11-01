/** D2 primitive, not a world motor. Exact piecewise point/AABB distance for a
 * translating vertical capsule vs a static axis-aligned box. Q coordinates in,
 * conservative integer TOI out. No ray-only proxy, endpoint stepping or trig.
 * A vertical capsule reduces to a point/sphere against a box extended downward
 * by its cylindrical segment length. Distance squared is piecewise quadratic.
 * The discriminant uses BigInt; ceil integer sqrt makes entry conservative.
 * TOI truncation contributes <=0.1Q at the permitted max delta; root rounding
 * contributes <0.5Q. Callers must maintain >=2Q contact skin when quantizing poses.
 * Hulls, rotation, moving obstacles and response are deliberately not implemented.
 */
export const SWEEP_TIME_Q = 1_000_000_000;
export const SWEEP_NORMAL_Q = 1_000_000;
export interface SweepVectorQ { readonly x: number; readonly y: number; readonly z: number }
export interface CapsuleBoxSweepInput { readonly foot: SweepVectorQ; readonly delta: SweepVectorQ; readonly radiusQ: number; readonly heightQ: number; readonly box: { readonly min: SweepVectorQ; readonly max: SweepVectorQ } }
export type CapsuleBoxSweepResult = { readonly kind: 'clear' } | { readonly kind: 'initial-overlap' } | { readonly kind: 'hit'; readonly timeQ: number; readonly normalQ: SweepVectorQ };
type V = readonly [bigint,bigint,bigint];
type Fraction = { n: bigint; d: bigint };
const axes = ['x','y','z'] as const;
function fail(reason: string): never { throw new Error('capsule-box-sweep: '+reason); }
function object(v: unknown, keys: readonly string[]): asserts v is Record<string,unknown> {
  if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail('plain object required');
  if(Object.getOwnPropertySymbols(v).length||Object.getOwnPropertyNames(v).length!==keys.length)fail('closed fields required');
  for(const k of keys){const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!('value'in d)||!d.enumerable)fail('data fields required');}
}
function integer(n: unknown, max: number, min=-max): asserts n is number { if(typeof n!=='number'||!Number.isSafeInteger(n)||n<min||n>max)fail('integer coordinate/range required'); }
function vector(v: unknown, limit: number): V {object(v,axes);for(const k of axes)integer(v[k],limit);return [BigInt(v.x as number),BigInt(v.y as number),BigInt(v.z as number)];}
function cmp(a: Fraction,b: Fraction): number {const n=a.n*b.d-b.n*a.d;return n<0n?-1:n>0n?1:0;}
function frac(n: bigint,d: bigint): Fraction {return d<0n?{n:-n,d:-d}:{n,d};}
function ceilSqrt(n: bigint): bigint {
  if(n<0n)fail('negative discriminant');if(n<2n)return n;
  let x=1n<<BigInt(Math.ceil(n.toString(2).length/2));let y=(x+n/x)/2n;
  while(y<x){x=y;y=(x+n/x)/2n;}return x*x===n?x:x+1n;
}
const dot=(a: V,b: V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function distanceVector(p: V,lo: V,hi: V): V {return p.map((n,i)=>n<lo[i]?n-lo[i]:n>hi[i]?n-hi[i]:0n) as unknown as V;}
function normalAt(p: V,v: V,lo: V,hi: V,t: number): SweepVectorQ {
  const den=BigInt(SWEEP_TIME_Q),n=BigInt(t);const point=p.map((x,i)=>x*den+v[i]*n) as unknown as V;
  const low=lo.map(x=>x*den) as unknown as V,high=hi.map(x=>x*den) as unknown as V;
  const distance=distanceVector(point,low,high),length=ceilSqrt(dot(distance,distance));if(length===0n)fail('undefined entry normal');
  const components=distance.map(x=>Number(x*BigInt(SWEEP_NORMAL_Q)/length));return {x:components[0],y:components[1],z:components[2]};
}
export function sweepCapsuleBoxQ(input: CapsuleBoxSweepInput): CapsuleBoxSweepResult {
  object(input,['foot','delta','radiusQ','heightQ','box']);const foot=vector(input.foot,1_000_000_000),v=vector(input.delta,100_000_000);
  integer(input.radiusQ,1_000_000,1);integer(input.heightQ,10_000_000,2*input.radiusQ);
  object(input.box,['min','max']);const minimum=vector(input.box.min,1_000_000_000),maximum=vector(input.box.max,1_000_000_000);
  for(let i=0;i<3;i++)if(minimum[i]>=maximum[i])fail('box must have positive volume');
  const r=BigInt(input.radiusQ),segment=BigInt(input.heightQ)-2n*r;
  const p: V=[foot[0],foot[1]+r,foot[2]],lo: V=[minimum[0],minimum[1]-segment,minimum[2]],hi=maximum;
  const initial=distanceVector(p,lo,hi),c0=dot(initial,initial)-r*r;
  if(c0<0n)return {kind:'initial-overlap'};
  if(v.every(n=>n===0n))return {kind:'clear'};
  if(c0===0n){if(dot(initial,v)>=0n)return {kind:'clear'};return {kind:'hit',timeQ:0,normalQ:normalAt(p,v,lo,hi,0)};}
  const boundaries: Fraction[]=[{n:0n,d:1n},{n:1n,d:1n}];
  for(let i=0;i<3;i++)if(v[i]!==0n)for(const bound of [lo[i],hi[i]]){const t=frac(bound-p[i],v[i]);if(t.n>0n&&t.n<t.d)boundaries.push(t);}
  boundaries.sort(cmp);const cuts=boundaries.filter((x,i)=>i===0||cmp(x,boundaries[i-1])!==0);
  const polynomial=(a: bigint,b: bigint,c: bigint,t: Fraction)=>a*t.n*t.n+b*t.n*t.d+c*t.d*t.d;
  for(let i=0;i<cuts.length-1;i++){
    const start=cuts[i],end=cuts[i+1],mid={n:start.n*end.d+end.n*start.d,d:2n*start.d*end.d};
    const intercept: bigint[]=[],slope: bigint[]=[];
    for(let k=0;k<3;k++){const position=p[k]*mid.d+v[k]*mid.n;const bound=position<lo[k]*mid.d?lo[k]:position>hi[k]*mid.d?hi[k]:null;intercept.push(bound===null?0n:p[k]-bound);slope.push(bound===null?0n:v[k]);}
    const a=dot(slope as unknown as V,slope as unknown as V),b=2n*dot(intercept as unknown as V,slope as unknown as V),c=dot(intercept as unknown as V,intercept as unknown as V)-r*r;
    let entry: Fraction;
    if(polynomial(a,b,c,start)<=0n)entry=start;
    else {
      if(a===0n||2n*a*start.n+b*start.d>=0n)continue;
      const discriminant=b*b-4n*a*c;if(discriminant<0n)continue;
      if(polynomial(a,b,c,end)>0n&&2n*a*end.n+b*end.d<0n)continue;
      entry={n:-b-ceilSqrt(discriminant),d:2n*a};if(cmp(entry,start)<0)entry=start;if(cmp(entry,end)>0)continue;
    }
    const timeQ=Number(entry.n*BigInt(SWEEP_TIME_Q)/entry.d);
    if(timeQ<0||timeQ>SWEEP_TIME_Q)fail('entry outside sweep');
    return {kind:'hit',timeQ,normalQ:normalAt(p,v,lo,hi,timeQ)};
  }
  return {kind:'clear'};
}
