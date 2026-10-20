import { describe, expect, it } from 'vitest';
import { boxToPoly, satPolyCapsule3, satPolyPoly3, satPolySphere3, type Poly, type Sep, type V3 } from './sat3d.js';

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const tetra: Poly = {
  verts: [v(0, 0, 0), v(2, 0, 0), v(0, 2, 0), v(0, 0, 2)],
  axes: [v(1, 0, 0), v(0, 1, 0), v(0, 0, 1), v(1, 1, 1)], c: v(.5, .5, .5),
};
const cube = boxToPoly(v(-1, -1, -1), v(1, 1, 1));
function normal(hit: Sep | null, expected: V3, depth: number): void {
  expect(hit).not.toBeNull();
  expect(hit!.nx).toBeCloseTo(expected.x, 10);
  expect(hit!.ny).toBeCloseTo(expected.y, 10);
  expect(hit!.nz).toBeCloseTo(expected.z, 10);
  expect(hit!.depth).toBeCloseTo(depth, 10);
  expect(hit!.nx ** 2 + hit!.ny ** 2 + hit!.nz ** 2).toBeCloseTo(1, 12);
}
const reciprocal = (n: number): number => 1 / Math.sqrt(n);

describe('convex SAT actual face, edge and vertex features', () => {
  it('sphere near tetra face: normalized plane and exact depth', () => {
    normal(satPolySphere3(tetra, v(.7, .7, .7), .1), v(reciprocal(3), reciprocal(3), reciprocal(3)), .1 - .1 / Math.sqrt(3));
  });
  it('sphere near tetra edge: separated by a real edge axis, despite all face intervals overlapping', () => {
    expect(satPolySphere3(tetra, v(1.1, 1.1, -.1), .12)).toBeNull();
    normal(satPolySphere3(tetra, v(1.1, 1.1, -.1), .2), v(reciprocal(3), reciprocal(3), -reciprocal(3)), .2 - Math.sqrt(.03));
  });
  it('sphere near tetra vertex: all three signed components are required', () => {
    expect(satPolySphere3(tetra, v(2.1, -.1, -.1), .12)).toBeNull();
    normal(satPolySphere3(tetra, v(2.1, -.1, -.1), .2), v(reciprocal(3), -reciprocal(3), -reciprocal(3)), .2 - Math.sqrt(.03));
  });
  it('tetra vs AABB needs actual edge cross edge axes', () => {
    const b = boxToPoly(v(1.01, 1.01, -.14), v(1.19, 1.19, .06));
    expect(satPolyPoly3(tetra, b)).toBeNull();
    expect(satPolyPoly3(b, tetra)).toBeNull();
  });
  it('contained sphere depth reaches the closest exit rather than its diameter', () => {
    const center = v(.2, .3, .4), hit = satPolySphere3(tetra, center, .1)!;
    normal(hit, v(-1, 0, 0), .3);
    expect(satPolySphere3(tetra, v(center.x + hit.nx * (hit.depth + 1e-9), center.y, center.z), .1)).toBeNull();
  });
  it('contained poly depth reaches an exit; swapping A/B reverses the normal', () => {
    const a = boxToPoly(v(-2, -2, -2), v(2, 2, 2)), b = boxToPoly(v(.5, -.2, -.2), v(1, .2, .2));
    normal(satPolyPoly3(a, b), v(1, 0, 0), 1.5);
    normal(satPolyPoly3(b, a), v(-1, 0, 0), 1.5);
  });
  it('exact face touching and the adjacent strict-overlap/strict-separation cases', () => {
    expect(satPolySphere3(cube, v(1.25, 0, 0), .25)).toBeNull();
    expect(satPolySphere3(cube, v(1.25 + 1e-8, 0, 0), .25)).toBeNull();
    normal(satPolySphere3(cube, v(1.25 - 1e-8, 0, 0), .25), v(1, 0, 0), 1e-8);
    expect(satPolyPoly3(cube, boxToPoly(v(1, -.5, -.5), v(2, .5, .5)))).toBeNull();
  });
  it('scaled normals, reversed normals and translated hulls keep normalized results', () => {
    const shifted = v(40000, -10000, 5000), p: Poly = {
      c: v(tetra.c.x + shifted.x, tetra.c.y + shifted.y, tetra.c.z + shifted.z),
      verts: tetra.verts.map(a => v(a.x + shifted.x, a.y + shifted.y, a.z + shifted.z)),
      axes: tetra.axes.map(a => v(-7 * a.x, -7 * a.y, -7 * a.z)),
    };
    normal(satPolySphere3(p, v(shifted.x + .7, shifted.y + .7, shifted.z + .7), .1), v(reciprocal(3), reciprocal(3), reciprocal(3)), .1 - .1 / Math.sqrt(3));
  });
  it('tiny valid hull edges are normalized before crossing', () => {
    const scale = 1e-5, p: Poly = { verts: tetra.verts.map(a => v(a.x * scale, a.y * scale, a.z * scale)), axes: tetra.axes, c: v(.5 * scale, .5 * scale, .5 * scale) };
    expect(satPolyPoly3(p, boxToPoly(v(1.01 * scale, 1.01 * scale, -.14 * scale), v(1.19 * scale, 1.19 * scale, .06 * scale)))).toBeNull();
  });
});

describe('convex SAT complete capsule segment', () => {
  it('bottom cap touches a sloped tetra face while the centroid proxy sphere misses it', () => {
    normal(satPolyCapsule3(tetra, v(1.8, .15, .1), v(1.8, 1.65, .1), .15), v(reciprocal(3), reciprocal(3), reciprocal(3)), .15 - .05 / Math.sqrt(3));
  });
  it('top cap reaches the lower face', () => {
    normal(satPolyCapsule3(tetra, v(.3, -1.5, .3), v(.3, -.1, .3), .15), v(0, -1, 0), .05);
  });
  it('side contact with a real vertical edge uses the closest segment feature', () => {
    normal(satPolyCapsule3(tetra, v(-.1, .2, -.1), v(-.1, 1.2, -.1), .2), v(-reciprocal(2), 0, -reciprocal(2)), .2 - Math.sqrt(.02));
    expect(satPolyCapsule3(tetra, v(-.1, .2, -.1), v(-.1, 1.2, -.1), .12)).toBeNull();
  });
  it('end cap outside an edge or vertex does not become a false positive', () => {
    expect(satPolyCapsule3(tetra, v(1.1, .1, 1.1), v(1.1, 1.4, 1.1), .12)).toBeNull();
    expect(satPolyCapsule3(tetra, v(2.1, -1, -.1), v(2.1, -.1, -.1), .12)).toBeNull();
    normal(satPolyCapsule3(tetra, v(2.1, -1, -.1), v(2.1, -.1, -.1), .2), v(reciprocal(3), -reciprocal(3), -reciprocal(3)), .2 - Math.sqrt(.03));
  });
  it('deep segment intersection uses the edge cross segment exit of the swept solid', () => {
    normal(satPolyCapsule3(tetra, v(1.8, -100, .1), v(1.8, 100, .1), .15), v(reciprocal(2), 0, reciprocal(2)), .15 + .1 / Math.sqrt(2));
  });
  it('side face touching is null; a zero-length capsule is bit-identical to a sphere', () => {
    expect(satPolyCapsule3(cube, v(1.25, -.5, 0), v(1.25, .5, 0), .25)).toBeNull();
    for (const center of [v(.2, .3, .4), v(1.1, 1.1, -.1), v(2.1, -.1, -.1), v(.7, .7, .7)]) {
      expect(satPolyCapsule3(tetra, center, center, .2)).toEqual(satPolySphere3(tetra, center, .2));
    }
  });
  it('reversing segment endpoints preserves contact and depth', () => {
    const a = v(-.1, .2, -.1), b = v(-.1, 1.2, -.1);
    expect(satPolyCapsule3(tetra, a, b, .2)).toEqual(satPolyCapsule3(tetra, b, a, .2));
  });
});

describe('convex topology complexity and determinism', () => {
  it('dense coplanar face samples stay within a linear coordinate-access budget', () => {
    let reads = 0;
    const count = (p: V3): V3 => ({ get x() { reads++; return p.x; }, get y() { reads++; return p.y; }, get z() { reads++; return p.z; } });
    const verts = [...cube.verts];
    for (let x = 0; x < 25; x++) for (let y = 0; y < 25; y++) verts.push(v(-1 + x / 12, -1 + y / 12, 1));
    const dense: Poly = { ...cube, verts: verts.map(count) };
    const other = boxToPoly(v(.5, -.5, -.5), v(1.5, .5, .5));
    expect(satPolyPoly3(dense, other)).toEqual(satPolyPoly3(cube, other));
    // A face diagonal is not an edge. Searching/crossing all vertex pairs makes
    // coordinate work grow quadratically or worse on this equivalent solid.
    expect(reads).toBeLessThan(150 * verts.length);
  });
  it('input restore/replay produces the same bytes and does not mutate geometry', () => {
    const snapshot = JSON.stringify(tetra), a = v(1.8, .15, .1), b = v(1.8, 1.65, .1);
    const first = JSON.stringify(satPolyCapsule3(tetra, a, b, .15));
    for (let i = 0; i < 20; i++) {
      const restored: Poly = JSON.parse(snapshot);
      expect(JSON.stringify(satPolyCapsule3(restored, a, b, .15))).toBe(first);
    }
    expect(JSON.stringify(tetra)).toBe(snapshot);
  });
});
