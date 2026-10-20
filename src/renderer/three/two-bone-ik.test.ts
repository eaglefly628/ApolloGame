import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { solveTwoBone } from './two-bone-ik.js';
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const distance = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('analytic two-bone position solution', () => {
  it('reaches a 3D point with original segment lengths and a declared pole, without mutating inputs', () => {
    const inputs = [v(), v(1), v(2), v(1, .5, .5), v(0, 0, 4)], before = inputs.map(p => p.toArray());
    const solved = solveTwoBone(inputs[0], inputs[1], inputs[2], inputs[3], inputs[4])!;
    expect(solved.reachable).toBe(true); expect(distance(solved.end, inputs[3])).toBeLessThan(.000001); expect(distance(solved.mid, inputs[0])).toBeCloseTo(1, 10); expect(distance(solved.end, solved.mid)).toBeCloseTo(1, 10); expect(solved.mid.z).toBeGreaterThan(.5); expect(inputs.map(p => p.toArray())).toEqual(before);
  });
  it('stretches to the nearest outer point and folds to the nearest inner point', () => {
    const outer = solveTwoBone(v(), v(2), v(3), v(10), v(0, 3))!; expect(outer.reachable).toBe(false); expect(outer.mid.toArray()).toEqual([2, 0, 0]); expect(outer.end.toArray()).toEqual([3, 0, 0]);
    const inner = solveTwoBone(v(), v(2), v(3), v(.1), v(0, 3))!; expect(inner.reachable).toBe(false); expect(inner.mid.x).toBeCloseTo(2); expect(inner.end.x).toBeCloseTo(1); expect(distance(inner.end, inner.mid)).toBeCloseTo(1);
  });
  it('does not flip the elbow across the outer reach boundary', () => {
    let previous = v(); for (const x of [1.8, 1.99, 1.999999, 2, 2.00001, 4]) { const solution = solveTwoBone(v(), v(1, .2), v(2), v(x * Math.hypot(1, .2)), v(0, 4))!; expect(solution.mid.y).toBeGreaterThanOrEqual(0); if (previous.lengthSq()) expect(solution.mid.distanceTo(previous)).toBeLessThan(.4); previous = solution.mid; }
  });
  it('keeps the current bend plane by default and uses a stable reference when collinear', () => {
    const bent = solveTwoBone(v(), v(1, 0, 1), v(2), v(1.5))!; expect(bent.mid.z).toBeGreaterThan(0); expect(bent.mid.y).toBe(0);
    const first = solveTwoBone(v(), v(1), v(2), v(1))!, again = solveTwoBone(v(), v(1), v(2), v(1))!; expect(first.mid.toArray()).toEqual(again.mid.toArray()); expect(first.mid.toArray().every(Number.isFinite)).toBe(true);
    const parallel = solveTwoBone(v(), v(1), v(2), v(1), v(100))!; expect(parallel.mid.toArray()).toEqual(first.mid.toArray());
  });
  it('handles a coincident equal-length target and opposite poles without NaN', () => {
    const folded = solveTwoBone(v(), v(1), v(), v())!; expect(folded.end.toArray()).toEqual([0, 0, 0]); expect(distance(folded.mid, v())).toBeCloseTo(1);
    const up = solveTwoBone(v(), v(1), v(2), v(1), v(0, 2))!, down = solveTwoBone(v(), v(1), v(2), v(1), v(0, -2))!; expect(up.mid.y).toBeGreaterThan(0); expect(down.mid.y).toBeLessThan(0);
  });
  it.each([1e-200, 1e-100, 1, 1e100, 1e200])('preserves relative reach and lengths at finite scale %s', scale => {
    const solved = solveTwoBone(v(), v(scale), v(2 * scale), v(scale, scale), v(0, 0, scale))!;
    expect(solved).toBeDefined(); expect(solved.mid.toArray().every(Number.isFinite)).toBe(true); expect(solved.end.x / scale).toBeCloseTo(1, 10); expect(solved.end.y / scale).toBeCloseTo(1, 10); expect(distance(solved.mid, v()) / scale).toBeCloseTo(1, 10); expect(distance(solved.end, solved.mid) / scale).toBeCloseTo(1, 10);
  });
  it('handles an extremely distant target with tiny bones and shared huge translation on another axis', () => {
    const tiny = solveTwoBone(v(), v(1e-200), v(2e-200), v(1e300))!; expect(tiny.end.x).toBe(2e-200); expect(tiny.mid.x).toBe(1e-200);
    const translated = solveTwoBone(v(1e200), v(1e200, 1), v(1e200, 2), v(1e200, 1, 1))!; expect(translated.end.toArray()).toEqual([1e200, 1, 1]);
  });
  it('keeps representable coordinates finite when an intermediate scaled displacement alone overflows', () => {
    const solved = solveTwoBone(v(-1e308), v(1e308), v(), v())!;
    expect(solved).toBeDefined(); expect(solved.mid.x).toBeCloseTo(1e308); expect(solved.end.x).toBe(0);
  });
  it.each([['zero first', v(), v(), v(1), v(1)], ['zero second', v(), v(1), v(1), v(1)], ['nonfinite', v(), v(1), v(2), v(Infinity)]])('rejects %s safely', (_, root, mid, end, target) => { expect(solveTwoBone(root as THREE.Vector3, mid as THREE.Vector3, end as THREE.Vector3, target as THREE.Vector3)).toBeUndefined(); });
});
