import { expect, it } from 'vitest';
import { World } from '@engine/core/world.js';
import type { CrowdAvoidance } from '@engine/protocol/components/crowd.js';
import type { Transform, Velocity, PathFollow } from '@engine/protocol/components.js';
import { bakeNavigationProfile } from './navigation-grid.js';
import { prepareEdgeRepaths } from './crowd-edge-repath.js';

it('preplans an available side-route slot for a unit far off its authored lane', () => {
  const world = new World();
  world.createEntity('route');
  world.addComponent('route', bakeNavigationProfile({ type: 'NavigationGrid', originX: 0, originY: 0,
    cellSize: 1, cols: 9, rows: 9 }, 0)!);
  world.createEntity('ox');
  world.addComponent('ox', { type: 'Transform', x: 7.5, y: 4.5, rotation: 0, scaleX: 1, scaleY: 1 } as Transform);
  world.addComponent('ox', { type: 'Velocity', vx: 0, vy: .1, angular: 0 } as Velocity);
  world.addComponent('ox', { type: 'PathFollow', waypoints: [{ x: 4.5, y: 1.5 }, { x: 4.5, y: 7.5 }],
    speed: .1, index: 1 } as PathFollow);
  world.addComponent('ox', { type: 'CrowdAvoidance', radius: .35, maxSpeed: .1,
    flowGuide: { fieldId: 'route', pathfindDistance: 2, edgeRepathSlots: 1 } } as CrowdAvoidance);
  const result = prepareEdgeRepaths(world, ['ox']);
  expect(result.edgeGranted.has('ox')).toBe(true);
  expect(result.preplannedRoutes.get('ox')?.length).toBeGreaterThan(0);
});
