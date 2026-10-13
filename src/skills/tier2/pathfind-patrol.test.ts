import { expect, it } from 'vitest';
import { selectPatrolGoal } from './pathfind-patrol.js';

it('keeps the current A* target until arrival, then loops deterministically', () => {
  const patrol = { waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }], index: 1, loop: true };
  expect(selectPatrolGoal(patrol, 9, 0, .2)).toMatchObject({ x: 10, index: 1, changed: false });
  expect(selectPatrolGoal(patrol, 10, 0, .2)).toMatchObject({ x: 0, index: 0, changed: true });
  expect(selectPatrolGoal({ ...patrol, index: 4 }, 10, 0, .2)).toBeNull();
});
