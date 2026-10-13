import { describe, expect, it } from 'vitest';
import { World } from '@engine/core/world.js';
import type { CrowdAvoidance } from '@engine/protocol/components/crowd.js';
import type { FlowField, PathFollow, Transform, Velocity } from '@engine/protocol/components.js';
import { navigationGridCapability } from './navigation-grid.js';
import { crowdAvoidanceCapability } from './crowd-avoidance.js';
import { blendFlowDirection, flowGuideWeight } from './crowd-flow-guide.js';

function guidedWorld(x: number, speed = .1) {
  const world = new World({ strict: true });
  for (const capability of [navigationGridCapability, crowdAvoidanceCapability]) {
    for (const system of capability.systems) world.addSystem(system);
  }
  world.createEntity('map');
  world.addComponent('map', { type: 'NavigationGrid', originX: 0, originY: 0, cellSize: 1, cols: 9, rows: 9 });
  world.createEntity('corridor');
  world.addComponent('corridor', {
    type: 'NavigationProfile', gridId: 'map', radius: .35,
    goals: Array.from({ length: 9 }, (_, row) => ({ x: 4.5, y: row + .5 })),
  });
  world.createEntity('agent');
  world.addComponent('agent', { type: 'Transform', x, y: 4.5, rotation: 0, scaleX: 1, scaleY: 1 } as Transform);
  world.addComponent('agent', { type: 'Velocity', vx: 0, vy: speed, angular: 0 } as Velocity);
  world.addComponent('agent', {
    type: 'PathFollow', waypoints: [{ x: 4.5, y: 1.5 }, { x: 4.5, y: 7.5 }],
    index: 1, speed: .1,
  } as PathFollow);
  world.addComponent('agent', {
    type: 'CrowdAvoidance', radius: .35, maxSpeed: .1,
    flowGuide: { fieldId: 'corridor', weight: 0, repathDistance: 1 },
  } as CrowdAvoidance);
  return world;
}

describe('grid flow guides an authored route before ORCA', () => {
  it('steers an off-corridor agent toward the shared grid corridor', () => {
    const world = guidedWorld(7.5);
    world.tick();
    expect(world.getComponent<FlowField>('corridor', 'FlowField')?.goals).toHaveLength(7);
    const velocity = world.getComponent<Velocity>('agent', 'Velocity')!;
    expect(velocity.vx).toBeLessThan(-.09);
    expect(Math.abs(velocity.vy)).toBeLessThan(.01);
  });

  it('leaves on-route motion and an explicit stop unchanged', () => {
    const onRoute = guidedWorld(5.5);
    onRoute.tick();
    expect(onRoute.getComponent<Velocity>('agent', 'Velocity')).toMatchObject({ vx: 0, vy: .1 });
    const stopped = guidedWorld(7.5, 0);
    stopped.tick();
    expect(stopped.getComponent<Velocity>('agent', 'Velocity')).toMatchObject({ vx: 0, vy: 0 });
  });

  it('raises influence smoothly with lateral distance and preserves speed', () => {
    const world = guidedWorld(6);
    const transform = world.getComponent<Transform>('agent', 'Transform')!;
    const path = world.getComponent<PathFollow>('agent', 'PathFollow')!;
    const guide = world.getComponent<CrowdAvoidance>('agent', 'CrowdAvoidance')!.flowGuide!;
    expect(flowGuideWeight(transform, path, guide)).toBeCloseTo(.5);
    transform.x = 4.5;
    transform.y = 10;
    expect(flowGuideWeight(transform, path, guide)).toBe(0);
    const blended = blendFlowDirection({ x: 0, y: .1 }, { x: -1, y: 0 }, .5)!;
    expect(blended.x).toBeLessThan(0);
    expect(blended.y).toBeGreaterThan(0);
    expect(Math.hypot(blended.x, blended.y)).toBeCloseTo(.1);
  });

  it('rejects malformed optional data without interrupting the simulation', () => {
    const nullGuide = guidedWorld(7.5);
    nullGuide.getComponent<CrowdAvoidance>('agent', 'CrowdAvoidance')!.flowGuide = null as never;
    expect(() => nullGuide.tick()).not.toThrow();

    const nullWaypoint = guidedWorld(7.5);
    nullWaypoint.getComponent<PathFollow>('agent', 'PathFollow')!.waypoints[1] = null as never;
    expect(() => nullWaypoint.tick()).not.toThrow();

    const missingGoals = guidedWorld(7.5);
    missingGoals.tick();
    missingGoals.removeComponent('corridor', 'NavigationProfile');
    missingGoals.getComponent<FlowField>('corridor', 'FlowField')!.goals = undefined as never;
    Object.assign(missingGoals.getComponent<Velocity>('agent', 'Velocity')!, { vx: 0, vy: .1 });
    expect(() => missingGoals.tick()).not.toThrow();
    expect(missingGoals.getComponent<Velocity>('agent', 'Velocity')).toMatchObject({ vx: 0, vy: .1 });

    const oversized = guidedWorld(7.5);
    oversized.tick();
    oversized.removeComponent('corridor', 'NavigationProfile');
    oversized.getComponent<FlowField>('corridor', 'FlowField')!.cols = Number.MAX_SAFE_INTEGER;
    Object.assign(oversized.getComponent<Velocity>('agent', 'Velocity')!, { vx: 0, vy: .1 });
    expect(() => oversized.tick()).not.toThrow();
    expect(oversized.getComponent<Velocity>('agent', 'Velocity')).toMatchObject({ vx: 0, vy: .1 });
  });
});
