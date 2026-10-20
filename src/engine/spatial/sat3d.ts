// Deterministic convex 3D SAT. Hulls supply baked vertices and all face normals;
// topology is recovered internally without extending the Collider3D protocol.
// Only arithmetic and sqrt enter the simulation (no trig, clock or randomness).
export interface V3 { x: number; y: number; z: number; }
export interface Poly { verts: readonly V3[]; axes: readonly V3[]; c: V3; }
export interface Sep { nx: number; ny: number; nz: number; depth: number; }

const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const along = (p: V3, d: V3, t: number): V3 => ({ x: p.x + t * d.x, y: p.y + t * d.y, z: p.z + t * d.z });

// Canonical signs make axis ties independent of A/B enumeration order. Every
// candidate is normalized, including caller-supplied face normals.
function unit(v: V3): V3 | null {
  const length = Math.sqrt(dot(v, v));
  if (!(length > 0) || !Number.isFinite(length)) return null;
  const sign = (v.x || v.y || v.z) < 0 ? -1 : 1;
  return { x: (sign * v.x / length) || 0, y: (sign * v.y / length) || 0, z: (sign * v.z / length) || 0 };
}
const axisKey = (v: V3): string => `${v.x},${v.y},${v.z}`;
const before = (a: V3, b: V3): boolean => a.x < b.x || (a.x === b.x && (a.y < b.y || (a.y === b.y && a.z < b.z)));

export function boxToPoly(min: V3, max: V3): Poly {
  const verts: V3[] = [];
  for (const z of [min.z, max.z]) for (const y of [min.y, max.y]) for (const x of [min.x, max.x]) verts.push({ x, y, z });
  return { verts, axes: [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }],
    c: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 } };
}

// Use a common nearby origin to avoid subtracting large world projections.
function project(verts: readonly V3[], axis: V3, origin: V3): { min: number; max: number } {
  let min = Infinity, max = -Infinity;
  for (const v of verts) {
    const d = dot(sub(v, origin), axis);
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { min, max };
}

interface Features { faces: V3[]; edges: Array<readonly [V3, V3]>; directions: V3[]; }
/** Recover actual edges as supporting-plane intersections, never face diagonals.
 * Cost is O(F*V + sum(incidentFaces(vertex)^2)); no all-vertex-pairs search.
 * Collinear subdivisions are collapsed to the two extrema of each intersection.
 * A normal can support a face at only one end (e.g. tetrahedron), so both ends
 * are inspected and point/line supports are excluded from the face list. */
function features(P: Poly): Features {
  const faces: V3[] = [], seen = new Set<string>();
  for (const candidate of P.axes) {
    const axis = unit(candidate);
    if (axis && !seen.has(axisKey(axis))) { seen.add(axisKey(axis)); faces.push(axis); }
  }
  const incident: number[][] = P.verts.map(() => []), planes: V3[] = [], planeSets = new Set<string>();
  const origin = P.verts[0] ?? P.c;
  for (const axis of faces) {
    const bounds = project(P.verts, axis, origin);
    const epsilon = 64 * Number.EPSILON * Math.max(1, bounds.max - bounds.min);
    for (const support of [bounds.min, bounds.max]) {
      const indices: number[] = [];
      for (let i = 0; i < P.verts.length; i++) if (Math.abs(dot(sub(P.verts[i]!, origin), axis) - support) <= epsilon) indices.push(i);
      if (indices.length < 3) continue;
      const a = P.verts[indices[0]!]!;
      const first = indices.map(i => sub(P.verts[i]!, a)).find(d => dot(d, d) > 0);
      if (!first || !indices.some(i => { const n = cross(first, sub(P.verts[i]!, a)); return dot(n, n) > 0; })) continue;
      // Triangulations can supply numerically different normals for the same
      // coplanar face. Its vertex support set identifies one geometric plane.
      const key = indices.join(',');
      if (planeSets.has(key)) continue;
      planeSets.add(key);
      const id = planes.length;
      planes.push(axis);
      for (const i of indices) incident[i]!.push(id);
    }
  }
  const intersections = new Map<string, { direction: V3; min: number; max: number; a: number; b: number }>();
  for (let v = 0; v < incident.length; v++) {
    const ids = incident[v]!;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i]!, b = ids[j]!, key = `${a},${b}`;
      let edge = intersections.get(key);
      if (!edge) {
        const direction = unit(cross(planes[a]!, planes[b]!));
        if (!direction) continue;
        edge = { direction, min: Infinity, max: -Infinity, a: v, b: v };
        intersections.set(key, edge);
      }
      const p = dot(sub(P.verts[v]!, origin), edge.direction);
      if (p < edge.min) { edge.min = p; edge.a = v; }
      if (p > edge.max) { edge.max = p; edge.b = v; }
    }
  }
  const edges: Features['edges'] = [], directions: V3[] = [], edgeKeys = new Set<string>(), directionKeys = new Set<string>();
  for (const e of intersections.values()) {
    if (e.a === e.b) continue;
    const key = `${Math.min(e.a, e.b)},${Math.max(e.a, e.b)}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    const a = P.verts[e.a]!, b = P.verts[e.b]!;
    edges.push([a, b]);
    const direction = unit(sub(b, a))!;
    if (!directionKeys.has(axisKey(direction))) { directionKeys.add(axisKey(direction)); directions.push(direction); }
  }
  return { faces, edges, directions };
}

// The shortest interval exit, rather than intersection width, also handles one
// shape contained inside the other. Touching has zero depth and is not overlap.
function tester(A: readonly V3[], B: readonly V3[], radius: number, delta: V3): { test: (candidate: V3) => boolean; result: () => Sep | null } {
  let depth = Infinity, normal: V3 | null = null, bestAxis: V3 | null = null;
  const origin = A[0] ?? { x: 0, y: 0, z: 0 };
  return {
    test(candidate) {
      const axis = unit(candidate);
      if (!axis) return true;
      const a = project(A, axis, origin), b = project(B, axis, origin);
      const forward = a.max - b.min + radius, backward = b.max - a.min + radius;
      const overlap = Math.min(forward, backward);
      if (overlap <= 0) return false;
      if (overlap < depth || (overlap === depth && bestAxis && before(axis, bestAxis))) {
        depth = overlap; bestAxis = axis;
        const sign = forward < backward ? 1 : backward < forward ? -1 : dot(axis, delta) < 0 ? -1 : 1;
        normal = { x: (sign * axis.x) || 0, y: (sign * axis.y) || 0, z: (sign * axis.z) || 0 };
      }
      return true;
    },
    result: () => normal && Number.isFinite(depth) ? { nx: normal.x, ny: normal.y, nz: normal.z, depth } : null,
  };
}

export function satPolyPoly3(A: Poly, B: Poly): Sep | null {
  const a = features(A), b = features(B), sat = tester(A.verts, B.verts, 0, sub(B.c, A.c));
  for (const axis of [...a.faces, ...b.faces]) if (!sat.test(axis)) return null;
  // Stream axes so separated dense hulls do not allocate an E_A * E_B array.
  for (const u of a.directions) for (const v of b.directions) if (!sat.test(cross(u, v))) return null;
  return sat.result();
}

// Closest points on two finite segments (including either zero-length segment).
function closestSegments(a: V3, b: V3, c: V3, d: V3): V3 {
  const u = sub(b, a), v = sub(d, c), w = sub(a, c);
  const uu = dot(u, u), vv = dot(v, v), uv = dot(u, v), uw = dot(u, w), vw = dot(v, w);
  let s = 0, t = 0;
  if (uu === 0) t = vv === 0 ? 0 : clamp01(vw / vv);
  else if (vv === 0) s = clamp01(-uw / uu);
  else {
    const denominator = uu * vv - uv * uv;
    if (denominator > 0) s = clamp01((uv * vw - uw * vv) / denominator);
    t = (uv * s + vw) / vv;
    if (t < 0) { t = 0; s = clamp01(-uw / uu); }
    else if (t > 1) { t = 1; s = clamp01((uv - uw) / uu); }
  }
  return sub(along(c, v, t), along(a, u, s));
}

/** Poly -> capsule, including both end caps and the complete side segment.
 * Faces and edge×segment axes are the facets of Poly minus segment. Closest
 * edge/segment and vertex/segment vectors cover its rounded edge/vertex regions.
 * This also gives the sphere case exactly when both segment endpoints coincide. */
export function satPolyCapsule3(P: Poly, a: V3, b: V3, radius: number): Sep | null {
  const f = features(P), center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
  const sat = tester(P.verts, [a, b], radius, sub(center, P.c));
  for (const axis of f.faces) if (!sat.test(axis)) return null;
  const direction = unit(sub(b, a));
  if (direction) for (const edge of f.directions) if (!sat.test(cross(edge, direction))) return null;
  for (const [c, d] of f.edges) if (!sat.test(closestSegments(c, d, a, b))) return null;
  for (const v of P.verts) if (!sat.test(closestSegments(v, v, a, b))) return null;
  return sat.result();
}

export function satPolySphere3(P: Poly, center: V3, radius: number): Sep | null {
  return satPolyCapsule3(P, center, center, radius);
}
