/** D2 pure, authored convex 2D topology. Integer velocities are local X/Z Q/second.
 * This module neither selects locomotion states nor advances animation/movement. */
export const BLEND_SPACE_WEIGHT_Q = 1_000_000;
export interface BlendSpaceSample2D { readonly id: string; readonly clip: string; readonly xQps: number; readonly yQps: number; }
export interface BlendSpaceTriangle2D { readonly id: string; readonly vertices: readonly [string, string, string]; }
export interface BlendSpaceDefinition2D { readonly samples: readonly BlendSpaceSample2D[]; readonly triangles: readonly BlendSpaceTriangle2D[]; }
export interface BlendSpaceWeights2D {
  readonly samples: readonly { readonly id: string; readonly clip: string; readonly weightQ: number }[];
  readonly clips: Readonly<Record<string, number>>;
  readonly region: { readonly kind: 'inside'; readonly triangleId: string } | { readonly kind: 'projected'; readonly edgeId: string };
}
interface Point extends BlendSpaceSample2D { readonly x: bigint; readonly y: bigint; }
interface Triangle { readonly id: string; readonly points: readonly [Point, Point, Point]; readonly area: bigint; }
interface Edge { readonly id: string; readonly a: Point; readonly b: Point; readonly owners: readonly string[]; }
interface Data { readonly points: readonly Point[]; readonly triangles: readonly Triangle[]; readonly boundary: readonly Edge[]; }
function reject(message: string): never { throw new Error(`BlendSpace2D: ${message}`); }
const cmp = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const abs = (n: bigint): bigint => n < 0n ? -n : n;
function strictTree(value: unknown): void {
  const seen = new WeakSet<object>(); let budget = 0;
  const visit = (v: unknown, depth: number): void => {
    if (++budget > 10000 || depth > 8) reject('input tree budget');
    if (typeof v === 'number') { if (!Number.isFinite(v)) reject('finite data required'); return; }
    if (typeof v === 'string') { if (v.length > 256) reject('string budget'); return; }
    if (v === null || typeof v === 'boolean') return;
    if (!v || typeof v !== 'object') reject('plain JSON data required');
    if (seen.has(v)) reject('shared/cyclic references'); seen.add(v);
    if (Object.getOwnPropertySymbols(v).length) reject('symbol fields');
    const names = Object.getOwnPropertyNames(v);
    if (Array.isArray(v)) {
      const d = Object.getOwnPropertyDescriptor(v, 'length')!;
      if (Object.getPrototypeOf(v) !== Array.prototype || v.length > 384 || names.length !== v.length + 1 || !('value' in d)) reject('array shape/budget');
      for (let i = 0; i < v.length; i++) if (!Object.hasOwn(v, String(i))) reject('sparse array');
    } else {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(v))) reject('plain object required');
      if (names.length !== Object.keys(v).length) reject('hidden fields');
    }
    for (const name of names) {
      if (Array.isArray(v) && name === 'length') continue;
      if (['__proto__', 'prototype', 'constructor'].includes(name)) reject('unsafe field');
      const d = Object.getOwnPropertyDescriptor(v, name)!;
      if (!('value' in d) || !d.enumerable) reject('accessor/hidden fields');
      visit(d.value, depth + 1);
    }
  }; visit(value, 0);
}
function fields(v: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) reject(`${label} object required`);
  const o = v as Record<string, unknown>;
  if (Object.keys(o).length !== keys.length || keys.some(k => !Object.hasOwn(o, k))) reject(`${label} closed fields`);
  return o;
}
function identifier(v: unknown): asserts v is string { if (typeof v !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v)) reject('stable id required'); }
function coordinate(v: unknown): asserts v is number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || Math.abs(v) > 1_000_000_000 || Object.is(v, -0)) reject('integer coordinate ±1e9 required, no negative zero'); }
function orient(a: Point, b: Point, c: { readonly x: bigint; readonly y: bigint }): bigint { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function edgeId(a: Point, b: Point): string { return cmp(a.id, b.id) < 0 ? `${a.id}|${b.id}` : `${b.id}|${a.id}`; }
function between(a: Point, b: Point, p: Point): boolean { return p.x >= (a.x < b.x ? a.x : b.x) && p.x <= (a.x > b.x ? a.x : b.x) && p.y >= (a.y < b.y ? a.y : b.y) && p.y <= (a.y > b.y ? a.y : b.y); }
function badIntersection(e: Edge, f: Edge): boolean {
  const a = orient(e.a, e.b, f.a), b = orient(e.a, e.b, f.b), c = orient(f.a, f.b, e.a), d = orient(f.a, f.b, e.b);
  if (a === 0n && b === 0n && c === 0n && d === 0n) {
    const key = e.a.x !== e.b.x ? 'x' : 'y';
    const lo1 = e.a[key] < e.b[key] ? e.a[key] : e.b[key], hi1 = e.a[key] > e.b[key] ? e.a[key] : e.b[key];
    const lo2 = f.a[key] < f.b[key] ? f.a[key] : f.b[key], hi2 = f.a[key] > f.b[key] ? f.a[key] : f.b[key];
    const lo = lo1 > lo2 ? lo1 : lo2, hi = hi1 < hi2 ? hi1 : hi2;
    if (lo > hi) return false;
    if (lo < hi) return true; // Distinct overlapping edges, including same-ray shared vertices.
  } else if (!((a === 0n && between(e.a,e.b,f.a)) || (b === 0n && between(e.a,e.b,f.b)) || (c === 0n && between(f.a,f.b,e.a)) || (d === 0n && between(f.a,f.b,e.b)) || (a * b < 0n && c * d < 0n))) return false;
  // A single shared endpoint is the only permitted intersection.
  return ![e.a.id,e.b.id].some(id => id === f.a.id || id === f.b.id);
}
function centroidStrictlyInside(a: Triangle, b: Triangle): boolean {
  const x = a.points.reduce((s,p) => s+p.x,0n), y = a.points.reduce((s,p) => s+p.y,0n);
  return b.points.every((p,i) => { const q=b.points[(i+1)%3];return (q.x-p.x)*(y-3n*p.y)-(q.y-p.y)*(x-3n*p.x)>0n; });
}
function build(definition: unknown): { readonly canonical: BlendSpaceDefinition2D; readonly data: Data } {
  strictTree(definition);const raw=fields(definition,['samples','triangles'],'definition');
  if (!Array.isArray(raw.samples) || raw.samples.length < 3 || raw.samples.length > 64 || !Array.isArray(raw.triangles) || raw.triangles.length < 1 || raw.triangles.length > 128) reject('samples/triangles budget');
  const points: Point[]=[], pointById=new Map<string,Point>(), coordinates=new Set<string>();
  for (const row of raw.samples) {
    const s=fields(row,['id','clip','xQps','yQps'],'sample');identifier(s.id);identifier(s.clip);coordinate(s.xQps);coordinate(s.yQps);
    const xy=`${s.xQps},${s.yQps}`;if(pointById.has(s.id)||coordinates.has(xy))reject('duplicate sample id/coordinate');
    const p=Object.freeze({id:s.id,clip:s.clip,xQps:s.xQps,yQps:s.yQps,x:BigInt(s.xQps),y:BigInt(s.yQps)});points.push(p);pointById.set(p.id,p);coordinates.add(xy);
  }
  points.sort((a,b)=>cmp(a.id,b.id));const triangles:Triangle[]=[], triangleIds=new Set<string>(), faces=new Set<string>(), used=new Set<string>();
  const edges=new Map<string,{id:string;a:Point;b:Point;owners:string[]}>();
  for(const row of raw.triangles) {
    const t=fields(row,['id','vertices'],'triangle');identifier(t.id);
    if(triangleIds.has(t.id)||!Array.isArray(t.vertices)||t.vertices.length!==3)reject('duplicate triangle id/vertices shape');triangleIds.add(t.id);
    const ids=t.vertices as unknown[];ids.forEach(identifier);if(new Set(ids).size!==3)reject('triangle repeated vertex');
    const face=(ids as string[]).slice().sort(cmp).join('|');if(faces.has(face))reject('duplicate triangle');faces.add(face);
    let ps=ids.map(id=>{const p=pointById.get(id as string);if(!p)reject('unknown vertex');used.add(p.id);return p;}) as [Point,Point,Point];
    let area=orient(ps[0],ps[1],ps[2]);if(area===0n)reject('degenerate triangle');if(area<0n){ps=[ps[0],ps[2],ps[1]];area=-area;}
    const first=ps.reduce((best,p,i)=>cmp(p.id,ps[best].id)<0?i:best,0);ps=[ps[first],ps[(first+1)%3],ps[(first+2)%3]];
    triangles.push(Object.freeze({id:t.id,points:Object.freeze(ps),area}));
    for(let i=0;i<3;i++){const a=ps[i],b=ps[(i+1)%3],id=edgeId(a,b),old=edges.get(id);if(old){if(old.owners.length===2||old.a.id===a.id)reject('nonmanifold or overlapping adjacent triangles');old.owners.push(t.id);}else edges.set(id,{id,a,b,owners:[t.id]});}
  }
  if(used.size!==points.length)reject('unused sample');triangles.sort((a,b)=>cmp(a.id,b.id));
  const allEdges=[...edges.values()].sort((a,b)=>cmp(a.id,b.id));
  for(let i=0;i<allEdges.length;i++)for(let j=i+1;j<allEdges.length;j++)if(badIntersection(allEdges[i],allEdges[j]))reject('crossing/overlapping/T-junction edges');
  for(let i=0;i<triangles.length;i++)for(let j=i+1;j<triangles.length;j++)if(centroidStrictlyInside(triangles[i],triangles[j])||centroidStrictlyInside(triangles[j],triangles[i]))reject('overlapping triangle interiors');
  const adjacent=new Map(triangles.map(t=>[t.id,[] as string[]]));for(const e of allEdges)if(e.owners.length===2){adjacent.get(e.owners[0])!.push(e.owners[1]);adjacent.get(e.owners[1])!.push(e.owners[0]);}
  const reached=new Set<string>(), queue=[triangles[0].id];while(queue.length){const id=queue.pop()!;if(reached.has(id))continue;reached.add(id);queue.push(...adjacent.get(id)!);}if(reached.size!==triangles.length)reject('disconnected topology');
  const boundary=allEdges.filter(e=>e.owners.length===1), next=new Map<string,Point>(), incoming=new Set<string>();
  for(const e of boundary){if(next.has(e.a.id)||incoming.has(e.b.id))reject('nonmanifold boundary');next.set(e.a.id,e.b);incoming.add(e.b.id);}
  if(boundary.length<3)reject('missing convex boundary');const loop:Point[]=[], seen=new Set<string>();let p=boundary[0].a;
  while(!seen.has(p.id)){seen.add(p.id);loop.push(p);const q=next.get(p.id);if(!q)reject('open boundary');p=q;}
  if(p.id!==loop[0].id||loop.length!==boundary.length)reject('holes/multiple boundary loops');
  for(let i=0;i<loop.length;i++)if(orient(loop[i],loop[(i+1)%loop.length],loop[(i+2)%loop.length])<0n)reject('domain must be convex');
  const boundaryArea=loop.reduce((s,p,i)=>s+p.x*loop[(i+1)%loop.length].y-p.y*loop[(i+1)%loop.length].x,0n);
  if(boundaryArea<=0n||triangles.reduce((s,t)=>s+t.area,0n)!==boundaryArea)reject('hole/overlap/area mismatch');
  const canonical=Object.freeze({samples:Object.freeze(points.map(p=>Object.freeze({id:p.id,clip:p.clip,xQps:p.xQps,yQps:p.yQps}))),triangles:Object.freeze(triangles.map(t=>Object.freeze({id:t.id,vertices:Object.freeze(t.points.map(p=>p.id)) as readonly [string,string,string]})))});
  return {canonical,data:Object.freeze({points:Object.freeze(points),triangles:Object.freeze(triangles),boundary:Object.freeze(boundary.map(e=>Object.freeze({...e,owners:Object.freeze(e.owners)})))})};
}

/** Runtime-opaque compiler result. Recompile canonical data after deserialization.
 * Private data prevents callers forging a malformed compiled topology; no global cache. */
class CompiledSpace {
  readonly canonical: BlendSpaceDefinition2D;
  readonly #data: Data;
  constructor(definition: unknown) { const built=build(definition);this.canonical=built.canonical;this.#data=built.data;Object.freeze(this); }
  evaluate(input: unknown): BlendSpaceWeights2D {
    strictTree(input);const q=fields(input,['xQps','yQps'],'query');coordinate(q.xQps);coordinate(q.yQps);const p={x:BigInt(q.xQps),y:BigInt(q.yQps)};
    let numerators:ReadonlyMap<string,bigint>|undefined,denominator=1n;let region:BlendSpaceWeights2D['region']|undefined;
    for(const t of this.#data.triangles){const [a,b,c]=t.points,ns=[orient(b,c,p),orient(c,a,p),orient(a,b,p)];if(ns.every(n=>n>=0n)){numerators=new Map(t.points.map((point,i)=>[point.id,ns[i]]));denominator=t.area;region={kind:'inside',triangleId:t.id};break;}}
    if(!numerators){let best:{edge:Edge;dot:bigint;len2:bigint;distanceN:bigint;distanceD:bigint}|undefined;
      for(const edge of this.#data.boundary){const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,len2=dx*dx+dy*dy;let dot=(p.x-edge.a.x)*dx+(p.y-edge.a.y)*dy;dot=dot<0n?0n:dot>len2?len2:dot;
        const nx=(p.x-edge.a.x)*len2-dx*dot,ny=(p.y-edge.a.y)*len2-dy*dot;const distanceN=nx*nx+ny*ny,distanceD=len2*len2;
        // Sorted edge IDs make exact equal-distance ties stable.
        if(!best||distanceN*best.distanceD<best.distanceN*distanceD)best={edge,dot,len2,distanceN,distanceD};}
      const chosen=best!;numerators=new Map([[chosen.edge.a.id,chosen.len2-chosen.dot],[chosen.edge.b.id,chosen.dot]]);denominator=chosen.len2;region={kind:'projected',edgeId:chosen.edge.id};}
    const apportioned=this.#data.points.map(point=>{const n=(numerators!.get(point.id)??0n)*BigInt(BLEND_SPACE_WEIGHT_Q);return{point,weightQ:Number(n/denominator),remainder:n%denominator};});
    const rest=BLEND_SPACE_WEIGHT_Q-apportioned.reduce((s,p)=>s+p.weightQ,0);
    const ordered=apportioned.slice().sort((a,b)=>a.remainder===b.remainder?cmp(a.point.id,b.point.id):a.remainder>b.remainder?-1:1);for(let i=0;i<rest;i++)ordered[i].weightQ++;
    const clips=new Map<string,number>();for(const w of apportioned)clips.set(w.point.clip,(clips.get(w.point.clip)??0)+w.weightQ);
    return Object.freeze({samples:Object.freeze(apportioned.map(w=>Object.freeze({id:w.point.id,clip:w.point.clip,weightQ:w.weightQ}))),clips:Object.freeze(Object.fromEntries([...clips].sort(([a],[b])=>cmp(a,b)))),region:Object.freeze(region!)});
  }
}
Object.freeze(CompiledSpace.prototype);
export type CompiledBlendSpace2D = CompiledSpace;
export function compileBlendSpace2D(definition: unknown): CompiledBlendSpace2D { return new CompiledSpace(definition); }
export function evaluateBlendSpace2D(space: CompiledBlendSpace2D, input: unknown): BlendSpaceWeights2D {
  // Never invoke an arbitrary input object's evaluate method.
  return CompiledSpace.prototype.evaluate.call(space,input);
}
