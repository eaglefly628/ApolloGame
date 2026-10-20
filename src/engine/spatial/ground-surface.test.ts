import { describe, expect, it } from 'vitest';
import {
  assertGroundSurface, bakeGroundSurface, GROUND_LIMITS, sampleGroundSurface, walkGroundSurface,
  type GroundPointQ, type GroundTriangleInput,
} from './ground-surface.js';

function patch(x0: number, x1: number, z0: number, z1: number, y0 = 0, y1 = y0): GroundTriangleInput[] {
  const a: GroundPointQ = [x0, y0, z0], b: GroundPointQ = [x1, y1, z0];
  const c: GroundPointQ = [x1, y1, z1], d: GroundPointQ = [x0, y0, z1];
  return [{ points: [a, b, c] }, { points: [a, c, d] }];
}
const walk = (s: ReturnType<typeof bakeGroundSurface>, x0: number, x1: number, y0 = 0, up = 25, down = 50, z = 25, preferred?: number) =>
  walkGroundSurface(s, x0, z, x1, z, y0, up, down, preferred);

describe('GroundSurface3D integer table and point sampling', () => {
  it('bakes deterministic canonical JSON, snapshots source arrays and normalizes negative zero', () => {
    const input = patch(-100, 100, -100, 100);
    input[0].supportIds = ['wall-z', 'floor-a', 'wall-z'];
    const a = bakeGroundSurface(input, { cellSizeQ: 50 });
    expect(a).toEqual(bakeGroundSurface(input, { cellSizeQ: 50 }));
    expect(a.supportIds[0]).toEqual(['floor-a', 'wall-z']);
    expect(a.triangles.some(value => Object.is(value, -0))).toBe(false);
    (input[0].points[0] as unknown as number[])[1] = 9;
    expect(sampleGroundSurface(a, 0, 0)?.heightQ).toBe(0);
    expect(() => assertGroundSurface(a)).not.toThrow();
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
  it('uses floor for negative cells and rejects actual out-of-bounds rather than clamping', () => {
    const s = bakeGroundSurface(patch(-10001, -1, -10001, -1, -3000), { cellSizeQ: 5000 });
    expect(s.originXQ).toBe(-15000);
    expect(sampleGroundSurface(s, -10001, -10001)?.heightQ).toBe(-3000);
    expect(sampleGroundSurface(s, -1, -1)?.heightQ).toBe(-3000);
    expect(sampleGroundSurface(s, 0, -1)).toBeUndefined();
    expect(sampleGroundSurface(s, -10002, -10001)).toBeUndefined();
  });
  it('uses exact barycentric upward rounding for positive and negative heights', () => {
    const positive = bakeGroundSurface([{ points: [[0, 0, 0], [3, 1, 0], [0, 0, 3]] }]);
    const negative = bakeGroundSurface([{ points: [[0, -1, 0], [3, 0, 0], [0, -1, 3]] }]);
    expect(sampleGroundSurface(positive, 1, 0)?.heightQ).toBe(1);
    expect(sampleGroundSurface(negative, 1, 0)?.heightQ).toBe(0);
    expect(sampleGroundSurface(negative, 0, 1)?.heightQ).toBe(-1);
    expect(sampleGroundSurface(positive, 2, 2)).toBeUndefined();
  });
  it('retains stable order and honors a valid previous triangle on a shared boundary', () => {
    const s = bakeGroundSurface(patch(0, 100, 0, 100));
    expect(sampleGroundSurface(s, 50, 50)?.triangleId).toBe(0);
    expect(sampleGroundSurface(s, 50, 50, 1)?.triangleId).toBe(1);
    expect(sampleGroundSurface(s, 50, 50, 900)?.triangleId).toBe(0);
    expect(sampleGroundSurface(s, 90, 10, 1)?.triangleId).toBe(0);
  });
  it('handles large Q products beyond IEEE exact integer multiplication', () => {
    const k = 9_999_999_000;
    const s = bakeGroundSurface([{ points: [[k, k, k], [k + 300, k + 100, k], [k, k, k + 300]] }], { cellSizeQ: 1000 });
    expect(sampleGroundSurface(s, k + 1, k + 1)?.heightQ).toBe(k + 1);
    expect(sampleGroundSurface(s, k + 150, k + 150)?.heightQ).toBe(k + 50);
    expect(sampleGroundSurface(s, k + 151, k + 150)).toBeUndefined();
  });
  it('accepts identical planes regardless of winding, but rejects positive-area layered or crossing planes', () => {
    const flat = patch(0, 100, 0, 100);
    expect(() => bakeGroundSurface([...flat, { points: [...flat[0].points].reverse() as [GroundPointQ, GroundPointQ, GroundPointQ] }])).not.toThrow();
    expect(() => bakeGroundSurface([...flat, ...patch(25, 75, 25, 75, 10)])).toThrow(/overlap in XZ at different heights/);
    expect(() => bakeGroundSurface([...flat, ...patch(25, 75, 25, 75, -10, 10)])).toThrow(/overlap in XZ at different heights/);
    // These overlap in their bboxes but their projected triangles are disjoint.
    expect(() => bakeGroundSurface([
      { points: [[0, 0, 0], [100, 0, 0], [0, 0, 100]] },
      { points: [[100, 5, 100], [60, 5, 100], [100, 5, 60]] },
    ])).not.toThrow();
  });
  it('accepts a 45-degree ramp and rejects vertical, degenerate, steep and noninteger inputs', () => {
    expect(() => bakeGroundSurface(patch(0, 100, 0, 100, 0, 100))).not.toThrow();
    expect(() => bakeGroundSurface(patch(0, 100, 0, 100, 0, 101))).toThrow(/45 degree/);
    expect(() => bakeGroundSurface([{ points: [[0, 0, 0], [0, 10, 0], [0, 0, 10]] }])).toThrow(/degenerate/);
    expect(() => bakeGroundSurface(patch(0.1, 100, 0, 100))).toThrow(/integer Q/);
    expect(() => bakeGroundSurface(patch(0, Infinity, 0, 100))).toThrow(/integer Q/);
    expect(() => bakeGroundSurface(patch(0, 100, 0, 100, 0, GROUND_LIMITS.coordinateQ + 1))).toThrow(/integer Q/);
  });
  it('rejects forged/truncated index tables during explicit load validation', () => {
    const s = bakeGroundSurface(patch(0, 100, 0, 100));
    expect(() => assertGroundSurface({ ...s, indices: [] })).toThrow(/noncanonical or invalid indices/);
    expect(() => assertGroundSurface({ ...s, offsets: [0, 0] })).toThrow(/offsets/);
    expect(() => assertGroundSurface({ ...s, originXQ: 999 })).toThrow(/originXQ/);
    expect(() => assertGroundSurface({ ...s, supportIds: [] })).toThrow(/triangle table/);
    expect(() => assertGroundSurface({ ...s, triangles: new Array((GROUND_LIMITS.triangles + 1) * 9).fill(0) })).toThrow(/triangle table/);
  });
  it('enforces triangle, cell and reference budgets without silent truncation', () => {
    expect(() => bakeGroundSurface([])).toThrow(/triangle count/);
    expect(() => bakeGroundSurface(new Array(4097).fill(patch(0, 1, 0, 1)[0]))).toThrow(/triangle count/);
    expect(() => bakeGroundSurface(patch(0, 256, 0, 256), { cellSizeQ: 1 })).toThrow(/cell budget/);
    const large = patch(0, 1270, 0, 1270)[0];
    expect(() => bakeGroundSurface(new Array(5).fill(large), { cellSizeQ: 5 })).toThrow(/reference budget/);
    expect(() => bakeGroundSurface(patch(0, 100, 0, 100), { cellSizeQ: 0 })).toThrow(/cellSizeQ/);
  });
  it('rejects dense overlap work at its explicit pair budget', () => {
    const point = patch(0, 10, 0, 10)[0];
    expect(() => bakeGroundSurface(new Array(1416).fill(point))).toThrow(/overlap pair budget exceeds 1000000/);
  });
  it('rejects sparse malformed arrays and excessive serialized buckets explicitly', () => {
    expect(() => bakeGroundSurface(new Array(1))).toThrow(/requires three points/);
    const entry = { points: [[0, 0, 0], [1, 0, 0], [0, 0, 1]], supportIds: new Array(1) } as GroundTriangleInput;
    expect(() => bakeGroundSurface([entry])).toThrow(/invalid supportIds/);
    const s = bakeGroundSurface(patch(0, 100, 0, 100));
    expect(() => assertGroundSurface({ ...s, indices: new Array(GROUND_LIMITS.references + 1) })).toThrow(/bucket budget/);
  });
  it('rejects bad live bucket offsets before an unbounded loop can start', () => {
    const s = bakeGroundSurface(patch(0, 10000, 0, 10000));
    for (const bad of [-1, -Infinity, Infinity, NaN, 1.5, Number.MAX_SAFE_INTEGER]) {
      const offsets = [...s.offsets]; offsets[0] = bad;
      const live = { ...s, offsets };
      expect(() => sampleGroundSurface(live, 1, 1)).toThrow(/live bucket offsets/);
      expect(() => walkGroundSurface(live, 1, 1, 9999, 9999, 0, 25, 50)).toThrow(/live bucket offsets/);
    }
    const offsets = [...s.offsets]; offsets[2] = -Infinity;
    expect(() => walkGroundSurface({ ...s, offsets }, 1, 1, 9999, 9999, 0, 25, 50)).toThrow(/live bucket offsets/);
  });
  it('rejects bad live dimensions, triangle indices and coordinates in visited buckets', () => {
    const s = bakeGroundSurface(patch(0, 100, 0, 100));
    for (const change of [{ cellSizeQ: 0 }, { cellSizeQ: Infinity }, { cols: Infinity }, { rows: -1 }, { cols: 65537 }, { originXQ: NaN }]) {
      expect(() => sampleGroundSurface({ ...s, ...change }, 1, 1)).toThrow(/live table dimensions/);
    }
    for (const id of [-1, Infinity, NaN, .5, 2]) {
      expect(() => sampleGroundSurface({ ...s, indices: [id, 1] }, 1, 1)).toThrow(/invalid triangle index/);
    }
    const triangles = [...s.triangles]; triangles[0] = Infinity;
    expect(() => sampleGroundSurface({ ...s, triangles }, 1, 1)).toThrow(/live triangle coordinate/);
  });
});

describe('GroundSurface3D complete segment traversal', () => {
  it('walks a continuous long ramp without treating total ascent as a step', () => {
    const s = bakeGroundSurface(patch(0, 10000, 0, 1000, 0, 10000));
    expect(walkGroundSurface(s, 0, 500, 10000, 500, 0, 0, 0)?.heightQ).toBe(10000);
    expect(walkGroundSurface(s, 10000, 500, 0, 500, 10000, 0, 0)?.heightQ).toBe(0);
  });
  it('crosses a slope change continuously even when its cut is a noninteger rational coordinate', () => {
    const a: GroundTriangleInput = { points: [[0, 0, 0], [100, 100, 0], [100, 100, 100]] };
    const b: GroundTriangleInput = { points: [[0, 0, 0], [100, 100, 100], [0, 0, 100]] };
    const s = bakeGroundSurface([a, b]);
    expect(walkGroundSurface(s, 1, 99, 99, 1, 1, 0, 0)).toEqual({ heightQ: 99, triangleId: 0 });
  });
  it('crosses a ramp to flat transition continuously with zero allowed step height', () => {
    const s = bakeGroundSurface([...patch(-100, 0, 0, 100, -100, 0), ...patch(0, 100, 0, 100)]);
    expect(walk(s, -99, 99, -99, 0, 0)?.heightQ).toBe(0);
    expect(walk(s, 99, -99, 0, 0, 0)?.heightQ).toBe(-99);
  });
  it('keeps a legal staircase discontinuous and refuses too-high and too-low steps', () => {
    const s = bakeGroundSurface([...patch(-100, 0, 0, 100), ...patch(0, 100, 0, 100, 25)]);
    expect(walk(s, -50, 50)?.heightQ).toBe(25);
    expect(walk(s, -50, 50, 0, 24)).toBeUndefined();
    expect(walk(s, 50, -50, 25, 0, 25)?.heightQ).toBe(0);
    expect(walk(s, 50, -50, 25, 0, 24)).toBeUndefined();
    expect(sampleGroundSurface(s, -1, 25)?.heightQ).toBe(0);
    expect(sampleGroundSurface(s, 1, 25)?.heightQ).toBe(25);
  });
  it('uses the preferred support at a step endpoint, then checks the next departure', () => {
    const s = bakeGroundSurface([...patch(-100, 0, 0, 100), ...patch(0, 100, 0, 100, 100)]);
    const edge = walk(s, -50, 0)!;
    expect(edge.heightQ).toBe(0);
    expect(walk(s, 0, 50, 0, 25, 50, 25, edge.triangleId)).toBeUndefined();
    expect(walk(s, 0, -50, 0, 25, 50, 25, edge.triangleId)?.heightQ).toBe(0);
  });
  it('rejects a one-Q interior hole despite supported endpoints and a long single tick', () => {
    const s = bakeGroundSurface([...patch(-10000, 4321, 0, 100), ...patch(4322, 10000, 0, 100)]);
    expect(sampleGroundSurface(s, -9999, 25)).toBeDefined();
    expect(sampleGroundSurface(s, 9999, 25)).toBeDefined();
    expect(walk(s, -9999, 9999)).toBeUndefined();
  });
  it('detects a sub-Q projected gap between two diagonal boundaries exactly', () => {
    const s = bakeGroundSurface([
      { points: [[-10000, 0, -10000], [0, 0, -10000], [0, 0, 10000]] },
      { points: [[0, 0, 0], [1, 0, 10000], [10000, 0, 0]] },
    ]);
    // At z=1, the uncovered interval is (0, 1/10000) Q.
    expect(sampleGroundSurface(s, -1, 1)).toBeDefined();
    expect(sampleGroundSurface(s, 1, 1)).toBeDefined();
    expect(walkGroundSurface(s, -1, 1, 1, 1, 0, 0, 0)).toBeUndefined();
  });
  it('rejects a narrow intermediate high platform even if start and end heights match', () => {
    const s = bakeGroundSurface([...patch(-10000, 4321, 0, 100), ...patch(4321, 4322, 0, 100, 26), ...patch(4322, 10000, 0, 100)]);
    expect(walk(s, -9999, 9999)).toBeUndefined();
    expect(walk(s, -9999, 9999, 0, 26, 26)?.heightQ).toBe(0);
  });
  it('rejects an interior triangular hole that does not coincide with grid boundaries', () => {
    // Two finite rectangles leave a gap only along this diagonal segment.
    const s = bakeGroundSurface([...patch(0, 49, 0, 100), ...patch(50, 100, 0, 100)]);
    expect(walkGroundSurface(s, 1, 1, 99, 99, 0, 25, 50)).toBeUndefined();
    expect(walkGroundSurface(s, 1, 1, 49, 99, 0, 25, 50)).toBeDefined();
  });
  it('does not reject union coverage merely because one overlapping face ends', () => {
    const s = bakeGroundSurface([...patch(0, 60, 0, 100), ...patch(40, 100, 0, 100)]);
    expect(walk(s, 1, 99)?.heightQ).toBe(0);
    expect(walk(s, 99, 1)?.heightQ).toBe(0);
    expect(walkGroundSurface(s, 1, 1, 99, 99, 0, 0, 0)?.heightQ).toBe(0);
  });
  it('walks exactly along triangle edges and through vertex joins without inventing support across a hole', () => {
    const s = bakeGroundSurface(patch(0, 100, 0, 100));
    expect(walkGroundSurface(s, 0, 0, 100, 100, 0, 0, 0)).toBeDefined();
    expect(walkGroundSurface(s, 0, 0, 100, 0, 0, 0, 0)).toBeDefined();
    const disconnected = bakeGroundSurface([...patch(0, 10, 0, 10), ...patch(20, 30, 20, 30)]);
    expect(walkGroundSurface(disconnected, 1, 1, 29, 29, 0, 100, 100)).toBeUndefined();
  });
  it('rejects missing starts, outside endpoints and stale impossible starting heights', () => {
    const s = bakeGroundSurface(patch(0, 100, 0, 100));
    expect(walk(s, -1, 50)).toBeUndefined();
    expect(walk(s, 50, 101)).toBeUndefined();
    expect(walk(s, 50, 50)).toEqual(sampleGroundSurface(s, 50, 25));
    expect(walk(s, 50, 50, 51)).toBeUndefined();
    expect(() => walk(s, 50, 51, 0, -1)).toThrow(/maxUpQ/);
    expect(() => walk(s, 50, 51, 0, 1.5)).toThrow(/maxUpQ/);
  });
  it('uses no retained state across repeated walks or serialized table restoration', () => {
    const s = bakeGroundSurface([...patch(-100, 0, 0, 100), ...patch(0, 100, 0, 100, 20)]);
    const json = JSON.stringify(s), restored = JSON.parse(json);
    for (let i = 0; i < 20; i++) expect(walk(s, -50, 50)).toEqual(walk(restored, -50, 50));
    expect(JSON.stringify(s)).toBe(json);
  });
});
