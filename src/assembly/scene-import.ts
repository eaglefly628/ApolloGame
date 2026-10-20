import { parseSceneImportData, type SceneImportCatalog, type SceneImportNode } from '@assets/scene-import-data.js';
import { bakeNavGraph } from '@engine/spatial/navmesh.js';
import type { EntityBlueprint } from './demo.assembly.js';
import { expandEntities } from './entity-templates.js';

type V3 = readonly [number, number, number];
type V2 = readonly [number, number];
type Tri = readonly [V3, V3, V3];
interface Hull { points: V3[]; axes: number[]; edges: Array<readonly [V3, V3]>; minY: number; maxY: number; flatTop: boolean; }
const EPS = 1e-8;
const CELL = 0.5;
const HEIGHT = 1.8;
const SUPPORT_TOLERANCE = 0.002;
const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const key3 = (p: V3): string => p.join(',');
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const q = (n: number): number => Math.round(n * 10000) / 10000 || 0;

function reject(message: string): never {
  // Load-time diagnostics: no world exists yet and no sim trace can be attached.
  console.warn(`[scene-import] reject: ${message}`);
  throw new Error(`scene-import: ${message}`);
}
function triangles(n: SceneImportNode): Tri[] {
  const p = n.positions!;
  const point = (i: number): V3 => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
  const out: Tri[] = [];
  for (let i = 0; i < n.indices!.length; i += 3) out.push([point(n.indices![i]), point(n.indices![i + 1]), point(n.indices![i + 2])]);
  return out;
}

/** Reject open/concave meshes instead of silently replacing them with their convex hull.
 * Vertex identity is geometric, so ordinary glTF UV/normal seam duplication is valid. */
function convexHull(n: SceneImportNode): Hull {
  const tris = triangles(n);
  const points = [...new Map(tris.flatMap(t => t.map(p => [key3(p), p] as const))).values()];
  if (points.length * tris.length > 8_000_000) reject(`collision node ${n.index}: convex validation budget exceeded; simplify the static collision mesh`);
  const edges = new Map<string, { count: number; pair: readonly [V3, V3] }>();
  const axes = new Map<string, V3>();
  let volume = false;
  for (const [a, b, c] of tris) {
    let normal = cross(sub(b, a), sub(c, a));
    const length = Math.sqrt(dot(normal, normal));
    if (length < EPS) reject(`collision node ${n.index}: degenerate triangle`);
    normal = normal.map(v => v / length) as unknown as V3;
    let positive = false, negative = false;
    for (const p of points) {
      const d = dot(normal, sub(p, a));
      if (d > EPS) positive = true;
      if (d < -EPS) negative = true;
    }
    if (positive && negative) reject(`collision node ${n.index}: concave mesh; split into multiple col_* convex meshes`);
    volume ||= positive || negative;
    const first = normal.find(v => Math.abs(v) > EPS)!;
    if (first < 0) normal = normal.map(v => -v) as unknown as V3;
    // Keep unit normals at full precision. Rounding can merge distinct face
    // axes or change SAT penetration distances even though source vertices are quantized.
    axes.set(key3(normal), normal);
    for (const pair of [[a, b], [b, c], [c, a]] as const) {
      const k = pair.map(key3).sort().join('/');
      const old = edges.get(k);
      if (old) old.count++; else edges.set(k, { count: 1, pair });
    }
  }
  if (!volume || points.length < 4 || [...edges.values()].some(e => e.count !== 2)) reject(`collision node ${n.index}: requires a closed convex volume`);
  const maxY = points.reduce((v, p) => Math.max(v, p[1]), -Infinity);
  return { points, axes: [...axes.values()].flat(), edges: [...edges.values()].map(e => e.pair),
    minY: points.reduce((v, p) => Math.min(v, p[1]), Infinity), maxY, flatTop: tris.some(t => t.every(p => Math.abs(p[1] - maxY) < EPS)) };
}
const turn = (a: V2, b: V2, c: V2): number => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function polygonHull(points: V2[]): V2[] {
  const ps = [...new Map(points.map(p => [p.join(','), p])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (list: V2[]): V2[] => {
    const out: V2[] = [];
    for (const p of list) { while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], p) <= EPS) out.pop(); out.push(p); }
    return out;
  };
  return [...half(ps).slice(0, -1), ...half([...ps].reverse()).slice(0, -1)];
}

/** Clip the convex solid to the agent's occupied height before projecting to XZ.
 * A floor below the nav face does not become an obstacle; overhead geometry is ignored. */
function obstacle(h: Hull, y: number): V2[] | undefined {
  if (h.maxY <= y + EPS || h.minY >= y + HEIGHT - EPS) return;
  // T7 nav helpers commonly sit 1mm below a substantial flat support top. Do not
  // apply this tolerance to a thin solid sitting on/above the nav face.
  if (h.maxY <= y + SUPPORT_TOLERANCE && h.minY < y - SUPPORT_TOLERANCE
    && h.flatTop) return;
  const points = h.points.filter(p => p[1] >= y && p[1] <= y + HEIGHT).map(p => [p[0], p[2]] as V2);
  for (const [a, b] of h.edges) for (const plane of [y, y + HEIGHT]) {
    if ((a[1] < plane && b[1] > plane) || (b[1] < plane && a[1] > plane)) {
      const t = (plane - a[1]) / (b[1] - a[1]);
      points.push([a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return polygonHull(points);
}

/** SAT against an open cell: touching its border alone does not block neighbours. */
function polygonInCell(poly: readonly V2[], x: number, z: number): boolean {
  const corners: V2[] = [[x, z], [x + CELL, z], [x + CELL, z + CELL], [x, z + CELL]];
  const axes: V2[] = [[1, 0], [0, 1]];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    axes.push([a[1] - b[1], b[0] - a[0]]);
  }
  return axes.every(a => {
    const p = poly.map(v => v[0] * a[0] + v[1] * a[1]), c = corners.map(v => v[0] * a[0] + v[1] * a[1]);
    return Math.min(Math.max(...p), Math.max(...c)) - Math.max(Math.min(...p), Math.min(...c)) > EPS;
  });
}
function segmentInCell(a: V2, b: V2, x: number, z: number): boolean {
  let lo = 0, hi = 1;
  for (const [k, min] of [[0, x], [1, z]] as const) {
    const d = b[k] - a[k];
    if (Math.abs(d) < EPS) { if (a[k] <= min + EPS || a[k] >= min + CELL - EPS) return false; }
    else {
      const t0 = (min + EPS - a[k]) / d, t1 = (min + CELL - EPS - a[k]) / d;
      lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1));
    }
  }
  return hi >= lo;
}
function insideTriangle(p: V2, t: Tri): boolean {
  const v = t.map(a => [a[0], a[2]] as V2);
  const signs = [turn(v[0], v[1], p), turn(v[1], v[2], p), turn(v[2], v[0], p)];
  return signs.every(s => s >= -EPS) || signs.every(s => s <= EPS);
}

/** Exact local union-side classification, without probing at a fixed offset that
 * could jump across a narrow gap. Values on a triangle edge use the directional
 * derivative of its oriented half-plane test. */
function unionSides(point: V2, normal: V2, ts: readonly Tri[]): readonly [boolean, boolean] {
  let left = false, right = false;
  for (const t of ts) {
    const v = t.map(p => [p[0], p[2]] as V2), orientation = Math.sign(turn(v[0], v[1], v[2]));
    let positive = true, negative = true;
    for (let i = 0; i < 3; i++) {
      const a = v[i], b = v[(i + 1) % 3];
      const side = orientation * turn(a, b, point);
      if (side < -EPS) { positive = false; negative = false; break; }
      if (Math.abs(side) <= EPS) {
        const derivative = orientation * ((b[0] - a[0]) * normal[1] - (b[1] - a[1]) * normal[0]);
        if (derivative < -EPS) positive = false;
        if (derivative > EPS) negative = false;
      }
    }
    left ||= positive; right ||= negative;
    if (left && right) break;
  }
  return [left, right];
}
function navigationBoundary(ts: readonly Tri[]): Array<{ a: V2; b: V2 }> {
  const edges = new Map<string, { a: V2; b: V2; left: boolean; right: boolean }>();
  for (const t of ts) for (const [p, q, r] of [[t[0], t[1], t[2]], [t[1], t[2], t[0]], [t[2], t[0], t[1]]]) {
    const key = [key3(p), key3(q)].sort().join('/');
    let edge = edges.get(key);
    if (!edge) { edge = { a: [p[0], p[2]], b: [q[0], q[2]], left: false, right: false }; edges.set(key, edge); }
    const side = turn(edge.a, edge.b, [r[0], r[2]]);
    if (side > 0) edge.left = true; else edge.right = true;
  }
  // Full shared edges covered from both sides cannot become union boundaries.
  const candidates = [...edges.values()].filter(e => !e.left || !e.right);
  const boundary: Array<{ a: V2; b: V2 }> = [];
  for (const edge of candidates) {
    const { a, b } = edge, dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz;
    const cuts = [0, 1];
    for (const other of candidates) {
      if (other === edge) continue;
      const ex = other.b[0] - other.a[0], ez = other.b[1] - other.a[1];
      const px = other.a[0] - a[0], pz = other.a[1] - a[1], denominator = dx * ez - dz * ex;
      if (Math.abs(denominator) > EPS) {
        const t = (px * ez - pz * ex) / denominator, u = (px * dz - pz * dx) / denominator;
        if (t > 0 && t < 1 && u >= -EPS && u <= 1 + EPS) cuts.push(t);
      } else if (Math.abs(px * dz - pz * dx) <= EPS) {
        // Collinear partial overlaps must also split at both endpoints.
        for (const p of [other.a, other.b]) {
          const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length2;
          if (t > 0 && t < 1) cuts.push(t);
        }
      }
    }
    cuts.sort((a, b) => a - b);
    const length = Math.sqrt(length2), normal: V2 = [-dz / length, dx / length];
    const at = (t: number): V2 => [a[0] + dx * t, a[1] + dz * t];
    for (let i = 1; i < cuts.length; i++) {
      if ((cuts[i] - cuts[i - 1]) * length <= EPS) continue;
      const [left, right] = unionSides(at((cuts[i - 1] + cuts[i]) / 2), normal, ts);
      if (left !== right) boundary.push({ a: at(cuts[i - 1]), b: at(cuts[i]) });
    }
  }
  return boundary;
}

function navigation(nodes: readonly SceneImportNode[], hulls: readonly Hull[], importId: string): EntityBlueprint {
  const ts = nodes.flatMap(triangles);
  const y = ts[0][0][1];
  // E5's existing planar graph has no per-node elevation or vertical movement.
  // Keep the source triangles intact in the asset catalog for R2 terrain support.
  if (ts.some(t => t.some(p => Math.abs(p[1] - y) > EPS))) reject('E5 navigation supports one horizontal level only; sloped or multi-level nav requires R2 terrain navigation');
  for (const t of ts) {
    if (Math.abs(turn([t[0][0], t[0][2]], [t[1][0], t[1][2]], [t[2][0], t[2][2]])) < EPS) reject('navigation contains a degenerate triangle');
  }
  const boundary = navigationBoundary(ts);
  const points = ts.flat();
  const minX = Math.floor(points.reduce((v, p) => Math.min(v, p[0]), Infinity) / CELL) * CELL;
  const minZ = Math.floor(points.reduce((v, p) => Math.min(v, p[2]), Infinity) / CELL) * CELL;
  const cols = Math.ceil((points.reduce((v, p) => Math.max(v, p[0]), -Infinity) - minX) / CELL);
  const rows = Math.ceil((points.reduce((v, p) => Math.max(v, p[2]), -Infinity) - minZ) / CELL);
  if (cols < 1 || rows < 1 || cols * rows > 262144) reject('navigation grid exceeds 262144 cells');
  const obstacles = hulls.map(h => obstacle(h, y)).filter((p): p is V2[] => !!p && p.length >= 3);
  const blocked = new Uint8Array(cols * rows).fill(1);
  const visit = (ps: readonly V2[], f: (i: number, x: number, z: number) => void): void => {
    const xs = ps.map(p => p[0]), zs = ps.map(p => p[1]);
    const c0 = Math.max(0, Math.floor((Math.min(...xs) - minX) / CELL));
    const c1 = Math.min(cols - 1, Math.floor((Math.max(...xs) - minX) / CELL));
    const r0 = Math.max(0, Math.floor((Math.min(...zs) - minZ) / CELL));
    const r1 = Math.min(rows - 1, Math.floor((Math.max(...zs) - minZ) / CELL));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) f(r * cols + c, minX + c * CELL, minZ + r * CELL);
  };
  // Rasterize each real triangle only over its bounds. A union can change cell
  // membership only across an outer boundary, including sub-cell hole boundaries.
  for (const t of ts) visit(t.map(p => [p[0], p[2]] as V2), (i, x, z) => {
    if (insideTriangle([x + CELL / 2, z + CELL / 2], t)) blocked[i] = 0;
  });
  for (const e of boundary) visit([e.a, e.b], (i, x, z) => { if (segmentInCell(e.a, e.b, x, z)) blocked[i] = 1; });
  for (const p of obstacles) visit(p, (i, x, z) => { if (polygonInCell(p, x, z)) blocked[i] = 1; });
  const graph = bakeNavGraph({ originX: minX + CELL / 2, originZ: minZ + CELL / 2, cellSize: CELL, cols, rows }, blocked);
  return {
    NavigationGrid: { originX: minX, originY: minZ, cellSize: CELL, cols, rows, blocked: Array.from(blocked) },
    NavigationProfile: { gridId: importId, radius: 0 },
    NavGraph: { ...graph, grid: { originX: minX, originY: minZ, cellSize: CELL, cols, rows, blocked: Array.from(blocked), cost: Array.from(blocked, () => 1) } },
  };
}

/** Discover actual imports after the same template/repeat expansion as manifest loading. */
export function sceneImportKeys(raw: unknown): readonly string[] {
  if (!obj(raw) || !obj(raw.entities)) return [];
  const keys = new Set<string>();
  for (const comps of Object.values(expandEntities(raw))) {
    if (obj(comps) && obj(comps.SceneImport3D) && typeof comps.SceneImport3D.modelKey === 'string' && comps.SceneImport3D.modelKey.trim()) keys.add(comps.SceneImport3D.modelKey);
  }
  return [...keys].sort();
}

/** Pure, atomic load-time expansion. No IO, asset lookup, systems or world mutation.
 * The caller supplies only SHA-verified catalog records. Already-expanded entities
 * have no SceneImport3D marker, so Engine.load can safely apply this again. */
export function expandSceneImports<T extends Record<string, unknown>>(entities: T, catalog?: SceneImportCatalog): T {
  if (!Object.values(entities).some(c => obj(c) && own(c, 'SceneImport3D'))) return entities;
  const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [id, comps] of Object.entries(entities)) out[id] = comps;
  for (const importId of Object.keys(entities).sort()) {
    const comps = entities[importId];
    if (!obj(comps) || !own(comps, 'SceneImport3D')) continue;
    const spec = comps.SceneImport3D;
    if (!obj(spec) || typeof spec.modelKey !== 'string' || !spec.modelKey.trim() || spec.rules !== 'default'
      || Object.keys(spec).some(k => !['type', 'modelKey', 'rules'].includes(k))) reject(`${importId}: expected SceneImport3D{modelKey,rules:"default"}`);
    for (const key of ['Transform', 'Transform3D', 'Model3D', 'Hierarchy', 'Anim3D', 'Pivot3D', 'Path3D', 'RigidBody3D', 'NavMesh', 'NavigationGrid', 'NavigationProfile', 'NavGraph']) {
      if (own(comps, key)) reject(`${importId}: ${key} override conflicts with baked world coordinates`);
    }
    if (!catalog || !own(catalog, spec.modelKey)) reject(`${importId}: missing verified scene catalog for model "${spec.modelKey}"`);
    const scene = parseSceneImportData(catalog[spec.modelKey]);
    const ordered = [...scene.nodes].sort((a, b) => {
      for (let i = 0; i < Math.min(a.path.length, b.path.length); i++) if (a.path[i] !== b.path[i]) return a.path[i] - b.path[i];
      return a.path.length - b.path.length;
    });
    const hulls = new Map<number, Hull>();
    for (const n of ordered) if (n.kind === 'collision') hulls.set(n.index, convexHull(n));
    const { SceneImport3D: _drop, ...rest } = comps;
    const navs = ordered.filter(n => n.kind === 'navigation');
    out[importId] = { ...rest,
      Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, Transform3D: { x: 0, y: 0, z: 0 },
      Model3D: { modelKey: spec.modelKey, excludeNodes: ordered.filter(n => ['pick', 'navigation', 'spawn'].includes(n.kind)).map(n => n.index) },
      ...(navs.length ? navigation(navs, [...hulls.values()], importId) : {}),
    };
    for (const n of ordered) {
      if (n.kind === 'display') continue;
      const id = `${importId}/node-${n.path.join('-')}`;
      if (own(out, id)) reject(`generated entity id conflict "${id}"`);
      if (n.kind === 'spawn' && n.worldMatrix.slice(12, 15).some(v => Math.abs(v) > 1_000_000)) reject(`spawn node ${n.index}: exceeds world coordinate budget`);
      const center = n.kind === 'spawn' ? [q(n.worldMatrix[12]), q(n.worldMatrix[13]), q(n.worldMatrix[14])]
        : n.bounds!.min.map((v, i) => q((v + n.bounds!.max[i]) / 2));
      const entity: EntityBlueprint = { Transform: { x: center[0], y: center[2], rotation: 0, scaleX: 1, scaleY: 1 }, Transform3D: { x: center[0], y: center[1], z: center[2] } };
      if (n.kind === 'collision') {
        const hull = hulls.get(n.index)!;
        entity.Collider3D = { kind: 'hull', baseY: center[1], verts: hull.points.flatMap(p => p.map((v, i) => q(v - center[i]))), axes: hull.axes };
      }
      if (n.kind === 'pick') { entity.Model3D = { modelKey: spec.modelKey, nodeIndex: n.index, origin: center }; entity.Pickable3D = { signal: 'scene.pick' }; }
      out[id] = entity;
    }
  }
  return out as T;
}
