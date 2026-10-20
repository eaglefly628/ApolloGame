import type { GroundSurface3D } from '../protocol/components.js';

/** Pure geometry: callers own trace/rejection policy. No world, cache, clock or
 * floating point intersection arithmetic is used. Only the serialized Q table
 * is retained; temporary rational/BigInt values never enter the world. */
export type GroundPointQ = readonly [number, number, number];
export interface GroundTriangleInput {
  points: readonly [GroundPointQ, GroundPointQ, GroundPointQ];
  supportIds?: readonly string[];
}
export interface GroundSample { heightQ: number; triangleId: number }
export const GROUND_LIMITS = Object.freeze({
  coordinateQ: 10_000_000_000, triangles: 4096, cells: 65536,
  references: 262144, overlapPairs: 1_000_000, walkCuts: 16384,
});

type Rat = { n: bigint; d: bigint };
type Plane = { x: bigint; z: bigint; c: bigint; d: bigint };
type Tri = { p: readonly GroundPointQ[]; plane: Plane; minX: number; maxX: number; minZ: number; maxZ: number };
type Interval = { lo: Rat; hi: Rat; id: number; tri: Tri };
const ZERO: Rat = { n: 0n, d: 1n }, ONE: Rat = { n: 1n, d: 1n };
const bi = BigInt;
function fail(reason: string): never { throw new Error(`GroundSurface3D: ${reason}`); }
function q(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || Math.abs(value) > GROUND_LIMITS.coordinateQ) fail(`${label} must be an integer Q within ±${GROUND_LIMITS.coordinateQ}`);
}
function step(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > GROUND_LIMITS.coordinateQ * 2) fail(`${label} must be a nonnegative integer Q`);
}
function gcd(a: bigint, b: bigint): bigint {
  if (a < 0n) a = -a;
  while (b !== 0n) { const next = a % b; a = b; b = next; }
  return a;
}
function rat(n: bigint, d: bigint): Rat {
  if (d < 0n) { n = -n; d = -d; }
  if (d === 0n) fail('zero rational denominator');
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
function cmp(a: Rat, b: Rat): number {
  const v = a.n * b.d - b.n * a.d;
  return v < 0n ? -1 : v > 0n ? 1 : 0;
}
function ceilDiv(n: bigint, d: bigint): bigint { return n / d + (n > 0n && n % d !== 0n ? 1n : 0n); }
function orient(a: GroundPointQ, b: GroundPointQ, x: bigint, z: bigint): bigint {
  return (bi(b[0]) - bi(a[0])) * (z - bi(a[2])) - (bi(b[2]) - bi(a[2])) * (x - bi(a[0]));
}
function triangle(points: readonly GroundPointQ[]): Tri {
  const [a, b, c] = points;
  const dx1 = bi(b[0]) - bi(a[0]), dy1 = bi(b[1]) - bi(a[1]), dz1 = bi(b[2]) - bi(a[2]);
  const dx2 = bi(c[0]) - bi(a[0]), dy2 = bi(c[1]) - bi(a[1]), dz2 = bi(c[2]) - bi(a[2]);
  let nx = dy1 * dz2 - dz1 * dy2, ny = dz1 * dx2 - dx1 * dz2, nz = dx1 * dy2 - dy1 * dx2;
  if (ny === 0n) fail('triangle has degenerate XZ coverage');
  if (ny * ny < nx * nx + nz * nz) fail('triangle exceeds the 45 degree walkable slope');
  if (ny < 0n) { nx = -nx; ny = -ny; nz = -nz; }
  return {
    p: points, plane: { x: -nx, z: -nz, c: nx * bi(a[0]) + ny * bi(a[1]) + nz * bi(a[2]), d: ny },
    minX: Math.min(a[0], b[0], c[0]), maxX: Math.max(a[0], b[0], c[0]),
    minZ: Math.min(a[2], b[2], c[2]), maxZ: Math.max(a[2], b[2], c[2]),
  };
}
function readTriangle(surface: GroundSurface3D, id: number): Tri {
  if (!Number.isSafeInteger(id) || id < 0 || id >= surface.triangles.length / 9) fail('live bucket has invalid triangle index');
  const start = id * 9, p = surface.triangles;
  for (let i = start; i < start + 9; i++) q(p[i], 'live triangle coordinate');
  return triangle([[p[start], p[start + 1], p[start + 2]], [p[start + 3], p[start + 4], p[start + 5]], [p[start + 6], p[start + 7], p[start + 8]]]);
}
function samePlane(a: Plane, b: Plane): boolean {
  return a.x * b.d === b.x * a.d && a.z * b.d === b.z * a.d && a.c * b.d === b.c * a.d;
}
/** Strict projection overlap on every edge normal is equivalent to positive
 * area intersection for two nondegenerate convex XZ triangles. Edge/point
 * contacts are deliberately legal, including discontinuous stair boundaries. */
function positiveOverlap(a: Tri, b: Tri): boolean {
  if (a.maxX <= b.minX || b.maxX <= a.minX || a.maxZ <= b.minZ || b.maxZ <= a.minZ) return false;
  for (const t of [a, b]) for (let i = 0; i < 3; i++) {
    const p = t.p[i], next = t.p[(i + 1) % 3];
    const ax = -(bi(next[2]) - bi(p[2])), az = bi(next[0]) - bi(p[0]);
    const projection = (tri: Tri): [bigint, bigint] => {
      const values = tri.p.map(v => bi(v[0]) * ax + bi(v[2]) * az);
      return [values.reduce((m, v) => v < m ? v : m), values.reduce((m, v) => v > m ? v : m)];
    };
    const [amin, amax] = projection(a), [bmin, bmax] = projection(b);
    if (amax <= bmin || bmax <= amin) return false;
  }
  return true;
}

export function bakeGroundSurface(input: readonly GroundTriangleInput[], options: { cellSizeQ?: number } = {}): GroundSurface3D {
  if (!Array.isArray(input) || input.length === 0 || input.length > GROUND_LIMITS.triangles) fail(`triangle count must be 1..${GROUND_LIMITS.triangles}`);
  const cellSizeQ = options.cellSizeQ ?? 5000;
  if (!Number.isSafeInteger(cellSizeQ) || cellSizeQ <= 0 || cellSizeQ > GROUND_LIMITS.coordinateQ) fail('cellSizeQ must be a positive integer Q');
  const supportIds: string[][] = [], triangles: number[] = [];
  const geometry = Array.from(input, (entry, id) => {
    if (!entry || !Array.isArray(entry.points) || entry.points.length !== 3) fail(`triangle ${id} requires three points`);
    const points = Array.from(entry.points, (point: GroundPointQ, index: number) => {
      if (!Array.isArray(point) || point.length !== 3) fail(`triangle ${id} point ${index} requires XYZ`);
      for (const value of point) q(value, `triangle ${id}`);
      const clean = point.map(value => value === 0 ? 0 : value) as unknown as GroundPointQ;
      triangles.push(...clean);
      return clean;
    });
    const ids = entry.supportIds ?? [];
    if (!Array.isArray(ids) || ids.length > 4096) fail(`triangle ${id} has invalid supportIds`);
    for (const value of ids) if (typeof value !== 'string' || value.length === 0 || value.length > 1024 || /[\u0000-\u001f]/u.test(value)) fail(`triangle ${id} has invalid supportIds`);
    supportIds.push([...new Set(ids)].sort());
    return triangle(points);
  });
  const minX = Math.min(...geometry.map(t => t.minX)), maxX = Math.max(...geometry.map(t => t.maxX));
  const minZ = Math.min(...geometry.map(t => t.minZ)), maxZ = Math.max(...geometry.map(t => t.maxZ));
  const originXQ = Math.floor(minX / cellSizeQ) * cellSizeQ, originZQ = Math.floor(minZ / cellSizeQ) * cellSizeQ;
  const cols = Math.floor((maxX - originXQ) / cellSizeQ) + 1, rows = Math.floor((maxZ - originZQ) / cellSizeQ) + 1;
  if (cols * rows > GROUND_LIMITS.cells) fail(`cell budget exceeds ${GROUND_LIMITS.cells}`);
  const buckets: number[][] = Array.from({ length: cols * rows }, () => []);
  const checked = new Set<number>();
  let references = 0;
  for (let id = 0; id < geometry.length; id++) {
    const t = geometry[id];
    const x0 = Math.floor((t.minX - originXQ) / cellSizeQ), x1 = Math.floor((t.maxX - originXQ) / cellSizeQ);
    const z0 = Math.floor((t.minZ - originZQ) / cellSizeQ), z1 = Math.floor((t.maxZ - originZQ) / cellSizeQ);
    if (references + (x1 - x0 + 1) * (z1 - z0 + 1) > GROUND_LIMITS.references) fail(`bucket reference budget exceeds ${GROUND_LIMITS.references}`);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const bucket = buckets[z * cols + x];
      for (const previous of bucket) {
        const pair = id * GROUND_LIMITS.triangles + previous;
        if (checked.has(pair)) continue;
        if (checked.size >= GROUND_LIMITS.overlapPairs) fail(`overlap pair budget exceeds ${GROUND_LIMITS.overlapPairs}`);
        checked.add(pair);
        const other = geometry[previous];
        if (!samePlane(t.plane, other.plane) && positiveOverlap(t, other)) fail(`triangles ${previous} and ${id} overlap in XZ at different heights`);
      }
      bucket.push(id); references++;
    }
  }
  const offsets = [0], indices: number[] = [];
  for (const bucket of buckets) { indices.push(...bucket); offsets.push(indices.length); }
  return { type: 'GroundSurface3D', originXQ: originXQ || 0, originZQ: originZQ || 0, cellSizeQ, cols, rows, triangles, supportIds, offsets, indices };
}

/** Load/restore validation, intentionally separate from hot-path sampling.
 * Canonical rebaking also proves no stale, forged or truncated spatial index
 * hides a triangle. Caller snapshots/freezes validated input for its lifetime. */
export function assertGroundSurface(surface: GroundSurface3D): void {
  if (!surface || surface.type !== 'GroundSurface3D' || !Array.isArray(surface.triangles) || surface.triangles.length === 0 || surface.triangles.length > GROUND_LIMITS.triangles * 9 || surface.triangles.length % 9 !== 0 || !Array.isArray(surface.supportIds) || surface.supportIds.length !== surface.triangles.length / 9) fail('invalid serialized triangle table');
  if (!Array.isArray(surface.offsets) || surface.offsets.length > GROUND_LIMITS.cells + 1 || !Array.isArray(surface.indices) || surface.indices.length > GROUND_LIMITS.references) fail('serialized bucket budget exceeded');
  const input: GroundTriangleInput[] = [];
  for (let i = 0; i < surface.triangles.length / 9; i++) {
    const a = i * 9, p = surface.triangles;
    input.push({ points: [[p[a], p[a + 1], p[a + 2]], [p[a + 3], p[a + 4], p[a + 5]], [p[a + 6], p[a + 7], p[a + 8]]], supportIds: surface.supportIds[i] });
  }
  const canonical = bakeGroundSurface(input, { cellSizeQ: surface.cellSizeQ });
  for (const key of ['originXQ', 'originZQ', 'cellSizeQ', 'cols', 'rows', 'triangles', 'supportIds', 'offsets', 'indices'] as const) {
    if (JSON.stringify(surface[key]) !== JSON.stringify(canonical[key])) fail(`noncanonical or invalid ${key}`);
  }
}

/** Cheap live checks also protect direct World/prefab mutations after startup
 * validation. They inspect table dimensions and only the buckets being read;
 * they never rescan all serialized geometry on a tick. */
function liveFrame(surface: GroundSurface3D): void {
  if (!surface || !Number.isSafeInteger(surface.cellSizeQ) || surface.cellSizeQ <= 0 || surface.cellSizeQ > GROUND_LIMITS.coordinateQ
    || !Number.isSafeInteger(surface.cols) || surface.cols <= 0 || !Number.isSafeInteger(surface.rows) || surface.rows <= 0
    || surface.cols * surface.rows > GROUND_LIMITS.cells
    || !Number.isSafeInteger(surface.originXQ) || Math.abs(surface.originXQ) > GROUND_LIMITS.coordinateQ * 2
    || !Number.isSafeInteger(surface.originZQ) || Math.abs(surface.originZQ) > GROUND_LIMITS.coordinateQ * 2
    || !Array.isArray(surface.triangles) || surface.triangles.length === 0 || surface.triangles.length % 9 !== 0 || surface.triangles.length > GROUND_LIMITS.triangles * 9
    || !Array.isArray(surface.indices) || surface.indices.length > GROUND_LIMITS.references
    || !Array.isArray(surface.offsets) || surface.offsets.length !== surface.cols * surface.rows + 1) fail('invalid live table dimensions or budget');
}
function liveBucket(surface: GroundSurface3D, bucket: number): [number, number] {
  const start = surface.offsets[bucket], end = surface.offsets[bucket + 1];
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > surface.indices.length) fail('invalid live bucket offsets');
  return [start, end];
}
function liveIndex(surface: GroundSurface3D, offset: number): number {
  const id = surface.indices[offset];
  if (!Number.isSafeInteger(id) || id < 0 || id >= surface.triangles.length / 9) fail('live bucket has invalid triangle index');
  return id;
}
function bucketAt(surface: GroundSurface3D, xQ: number, zQ: number): number {
  liveFrame(surface);
  const col = Math.floor((xQ - surface.originXQ) / surface.cellSizeQ), row = Math.floor((zQ - surface.originZQ) / surface.cellSizeQ);
  return col < 0 || col >= surface.cols || row < 0 || row >= surface.rows ? -1 : row * surface.cols + col;
}
function contains(tri: Tri, x: bigint, z: bigint): boolean {
  const sign = orient(tri.p[0], tri.p[1], bi(tri.p[2][0]), bi(tri.p[2][2])) > 0n ? 1n : -1n;
  for (let i = 0; i < 3; i++) if (orient(tri.p[i], tri.p[(i + 1) % 3], x, z) * sign < 0n) return false;
  return true;
}
function height(tri: Tri, x: bigint, z: bigint): number {
  const p = tri.plane;
  return Number(ceilDiv(p.x * x + p.z * z + p.c, p.d));
}
export function sampleGroundSurface(surface: GroundSurface3D, xQ: number, zQ: number, preferredTriangle?: number): GroundSample | undefined {
  q(xQ, 'xQ'); q(zQ, 'zQ');
  const bucket = bucketAt(surface, xQ, zQ);
  if (bucket < 0) return undefined;
  const [start, end] = liveBucket(surface, bucket);
  if (preferredTriangle !== undefined) for (let i = start; i < end; i++) if (liveIndex(surface, i) === preferredTriangle) {
    const t = readTriangle(surface, preferredTriangle);
    if (contains(t, bi(xQ), bi(zQ))) return { heightQ: height(t, bi(xQ), bi(zQ)), triangleId: preferredTriangle };
    break;
  }
  for (let i = start; i < end; i++) {
    const id = liveIndex(surface, i), t = readTriangle(surface, id);
    if (contains(t, bi(xQ), bi(zQ))) return { heightQ: height(t, bi(xQ), bi(zQ)), triangleId: id };
  }
  return undefined;
}

function clip(tri: Tri, id: number, x0: bigint, z0: bigint, x1: bigint, z1: bigint): Interval | undefined {
  let lo = ZERO, hi = ONE;
  const sign = orient(tri.p[0], tri.p[1], bi(tri.p[2][0]), bi(tri.p[2][2])) > 0n ? 1n : -1n;
  for (let i = 0; i < 3; i++) {
    const a = tri.p[i], b = tri.p[(i + 1) % 3];
    const v0 = orient(a, b, x0, z0) * sign, v1 = orient(a, b, x1, z1) * sign;
    if (v0 < 0n && v1 < 0n) return undefined;
    if (v0 < 0n) { const cut = rat(-v0, v1 - v0); if (cmp(cut, lo) > 0) lo = cut; }
    if (v1 < 0n) { const cut = rat(v0, v0 - v1); if (cmp(cut, hi) < 0) hi = cut; }
    if (cmp(lo, hi) > 0) return undefined;
  }
  return { lo, hi, id, tri };
}
function heightAt(tri: Tri, t: Rat, x0: bigint, z0: bigint, dx: bigint, dz: bigint): number {
  const p = tri.plane;
  return Number(ceilDiv(p.x * (x0 * t.d + dx * t.n) + p.z * (z0 * t.d + dz * t.n) + p.c * t.d, p.d * t.d));
}
function allowed(delta: number, up: number, down: number): boolean { return delta >= -down && delta <= up; }

/** A finite, exact partition of the requested segment. Triangle half-plane
 * clipping supplies all interval endpoints, so even a one-Q hole or a stair
 * between samples is detected. Height limits apply only at plane changes,
 * never to continuous ascent over the length of a ramp. */
export function walkGroundSurface(
  surface: GroundSurface3D, fromXQ: number, fromZQ: number, toXQ: number, toZQ: number,
  fromHeightQ: number, maxUpQ: number, maxDownQ: number, preferredTriangle?: number,
): GroundSample | undefined {
  q(fromXQ, 'fromXQ'); q(fromZQ, 'fromZQ'); q(toXQ, 'toXQ'); q(toZQ, 'toZQ'); q(fromHeightQ, 'fromHeightQ');
  step(maxUpQ, 'maxUpQ'); step(maxDownQ, 'maxDownQ');
  const start = sampleGroundSurface(surface, fromXQ, fromZQ, preferredTriangle);
  if (!start || !allowed(start.heightQ - fromHeightQ, maxUpQ, maxDownQ)) return undefined;
  if (fromXQ === toXQ && fromZQ === toZQ) return start;
  if (bucketAt(surface, toXQ, toZQ) < 0) return undefined;
  const minCol = Math.floor((Math.min(fromXQ, toXQ) - surface.originXQ) / surface.cellSizeQ);
  const maxCol = Math.floor((Math.max(fromXQ, toXQ) - surface.originXQ) / surface.cellSizeQ);
  const minRow = Math.floor((Math.min(fromZQ, toZQ) - surface.originZQ) / surface.cellSizeQ);
  const maxRow = Math.floor((Math.max(fromZQ, toZQ) - surface.originZQ) / surface.cellSizeQ);
  if ((maxCol - minCol + 1) * (maxRow - minRow + 1) > GROUND_LIMITS.cells) fail('walk cell budget exceeded');
  const candidates = new Set<number>();
  let referenceReads = 0;
  for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
    const bucket = row * surface.cols + col;
    const [start, end] = liveBucket(surface, bucket);
    referenceReads += end - start;
    if (referenceReads > GROUND_LIMITS.references) fail('live walk reference budget exceeded');
    for (let i = start; i < end; i++) candidates.add(liveIndex(surface, i));
  }
  const x0 = bi(fromXQ), z0 = bi(fromZQ), x1 = bi(toXQ), z1 = bi(toZQ), dx = x1 - x0, dz = z1 - z0;
  const intervals: Interval[] = [];
  const cuts: Rat[] = [ZERO, ONE];
  for (const id of [...candidates].sort((a, b) => a - b)) {
    const interval = clip(readTriangle(surface, id), id, x0, z0, x1, z1);
    if (interval && cmp(interval.lo, interval.hi) < 0) { intervals.push(interval); cuts.push(interval.lo, interval.hi); }
  }
  if (cuts.length > GROUND_LIMITS.walkCuts) fail('walk cut budget exceeded');
  cuts.sort(cmp);
  const unique = cuts.filter((value, index) => index === 0 || cmp(value, cuts[index - 1]) !== 0);
  const events = intervals.flatMap(interval => [{ t: interval.lo, add: true, interval }, { t: interval.hi, add: false, interval }]);
  events.sort((a, b) => cmp(a.t, b.t) || Number(a.add) - Number(b.add) || a.interval.id - b.interval.id);
  const active = new Map<number, Interval>();
  // A lazy-deletion min heap keeps worst-case segment partition work bounded
  // by O(triangles log triangles), including many overlapping coplanar faces.
  const heap: number[] = [];
  const push = (id: number): void => {
    let index = heap.length; heap.push(id);
    while (index > 0) { const parent = (index - 1) >> 1; if (heap[parent] <= id) break; heap[index] = heap[parent]; index = parent; }
    heap[index] = id;
  };
  const pop = (): void => {
    const tail = heap.pop();
    if (!heap.length || tail === undefined) return;
    let index = 0;
    while (index * 2 + 1 < heap.length) {
      const a = index * 2 + 1, b = a + 1, child = b < heap.length && heap[b] < heap[a] ? b : a;
      if (heap[child] >= tail) break;
      heap[index] = heap[child]; index = child;
    }
    heap[index] = tail;
  };
  let eventIndex = 0;
  let previous = readTriangle(surface, start.triangleId), previousId = start.triangleId;
  for (let i = 0; i + 1 < unique.length; i++) {
    const left = unique[i];
    // Sweep exact interval endpoints. Active triangles cover the whole open
    // partition until the next event, rather than just a sampled midpoint.
    while (eventIndex < events.length && cmp(events[eventIndex].t, left) <= 0) {
      const event = events[eventIndex++];
      if (event.add) { active.set(event.interval.id, event.interval); push(event.interval.id); }
      else active.delete(event.interval.id);
    }
    while (heap.length && !active.has(heap[0])) pop();
    if (heap.length === 0) return undefined;
    const current = active.get(previousId) ?? active.get(heap[0])!;
    const delta = heightAt(current.tri, left, x0, z0, dx, dz) - heightAt(previous, left, x0, z0, dx, dz);
    if (!allowed(delta, maxUpQ, maxDownQ)) return undefined;
    previous = current.tri; previousId = current.id;
  }
  return { heightQ: heightAt(previous, ONE, x0, z0, dx, dz), triangleId: previousId };
}
