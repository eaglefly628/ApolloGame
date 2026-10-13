import { expect, it } from 'vitest';
import { World } from '@engine/core/world.js';
import type { CrowdAvoidance } from '@engine/protocol/components/crowd.js';
import type { Shape, Transform, Velocity } from '@engine/protocol/components.js';
import { updateFootprints } from './crowd-footprint.js';

it('shrinks only after a persistent stall and restores the circle after clear movement', () => {
  const world = new World();
  world.createEntity('ox');
  const transform: Transform = { type: 'Transform', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  const shape: Shape = { type: 'Shape', kind: 'circle', radius: 1 };
  world.addComponent('ox', transform);
  world.addComponent('ox', shape);
  world.addComponent('ox', { type: 'Velocity', vx: .1, vy: 0, angular: 0 } as Velocity);
  world.addComponent('ox', { type: 'CrowdAvoidance', radius: 1, maxSpeed: .1,
    yieldAfterTicks: 3, lastX: 0, lastY: 0, stuckTicks: 2 } as CrowdAvoidance);
  const stalled = updateFootprints(world, ['ox']);
  expect(stalled.shrunk).toBe(1);
  expect(shape.radius).toBeLessThan(1);
  for (let i = 0; i < 5; i++) { transform.x += .1; updateFootprints(world, ['ox']); }
  expect(shape.radius).toBe(1);
});
