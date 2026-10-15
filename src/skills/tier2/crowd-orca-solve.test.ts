import { expect, it } from 'vitest';
import type { OrcaAgent, OrcaStats } from './orca.js';
import { solveCrowdVelocity } from './crowd-orca-solve.js';

it('retries a zero-speed head-on solution laterally while respecting the speed cap', () => {
  const actor: OrcaAgent = { x: 0, y: 0, vx: .1, vy: 0, radius: .35, idx: 0, reciprocal: true };
  const obstacle: OrcaAgent = { x: .7, y: 0, vx: 0, vy: 0, radius: .35, idx: 1, reciprocal: false };
  const stats: OrcaStats = { degenerate: 0, oneSided: 0, infeasible: 0 };
  const result = solveCrowdVelocity('ox', actor, [obstacle], { x: .1, y: 0 },
    { x: .1, y: 0 }, .1, 8, true, stats);
  expect(Math.hypot(result.raw.x, result.raw.y)).toBeLessThan(.01);
  expect(result.recovered).toBe(true);
  expect(Math.hypot(result.out.x, result.out.y)).toBeGreaterThan(.09);
  expect(Math.hypot(result.out.x, result.out.y)).toBeLessThanOrEqual(.1000001);
});

it('begins a wider side arc for a larger approaching circular footprint', () => {
  const actor: OrcaAgent = { x: 0, y: 0, vx: .1, vy: 0, radius: .4, idx: 0, reciprocal: true };
  const stats: OrcaStats = { degenerate: 0, oneSided: 0, infeasible: 0 };
  const obstacle = (radius: number): OrcaAgent =>
    ({ x: 3, y: 0, vx: 0, vy: 0, radius, idx: 1, reciprocal: false });
  const small = solveCrowdVelocity('moving', actor, [obstacle(.4)], { x: .1, y: 0 },
    { x: .1, y: 0 }, .1, 30, false, stats, .8);
  const large = solveCrowdVelocity('moving', actor, [obstacle(1.6)], { x: .1, y: 0 },
    { x: .1, y: 0 }, .1, 30, false, stats, .8);
  expect(small.steered).toBe(true);
  expect(large.steered).toBe(true);
  expect(Math.abs(large.out.y)).toBeGreaterThan(Math.abs(small.out.y) + .01);
  expect(Math.hypot(large.out.x, large.out.y)).toBeLessThanOrEqual(.1000001);
});
