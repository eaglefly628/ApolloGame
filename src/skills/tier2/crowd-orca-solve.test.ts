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
