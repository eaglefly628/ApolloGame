import { expect, it } from 'vitest';
import type { CrowdAvoidance } from '@engine/protocol/components/crowd.js';
import { nudgeSide, valid } from './crowd-config.js';

it('rejects malformed optional avoidance settings without changing a valid default', () => {
  const base: CrowdAvoidance = { type: 'CrowdAvoidance', radius: .8, maxSpeed: .1 };
  expect(valid(base)).toBe(true);
  expect(valid({ ...base, timeHorizon: 0 })).toBe(false);
  expect(valid({ ...base, flowGuide: { fieldId: 'route', pathfindDistance: 2, releaseDistance: 3 } })).toBe(false);
  expect(valid({ ...base, flowGuide: { fieldId: 'route', pathfindDistance: 2, releaseDistance: 1 } })).toBe(true);
});

it('keeps a stable fallback side for a given entity id', () => {
  expect(nudgeSide('ox-7')).toBe(nudgeSide('ox-7'));
  expect(Math.abs(nudgeSide('ox-7'))).toBe(1);
});
