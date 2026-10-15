import { describe, expect, it } from 'vitest';
import { World } from '@engine/core/world.js';
import type { DebugTrace, Shape, Transform, Velocity } from '@engine/protocol/components.js';
import type { CrowdAvoidance } from '@engine/protocol/components/crowd.js';
import { crowdAvoidanceCapability } from './crowd-avoidance.js';

function approach(otherRadius: number, distance = 4) {
  const world = new World();
  for (const system of crowdAvoidanceCapability.systems) world.addSystem(system);
  for (const [id, x, radius, speed] of [
    ['moving', 0, .8, .055], ['other', distance, otherRadius, 0],
  ] as const) {
    world.createEntity(id);
    world.addComponent(id, { type: 'Transform', x, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } as Transform);
    world.addComponent(id, { type: 'Velocity', vx: speed, vy: 0, angular: 0 } as Velocity);
    world.addComponent(id, { type: 'Shape', kind: 'circle', radius } as Shape);
    world.addComponent(id, { type: 'CrowdAvoidance', radius, maxSpeed: .055,
      timeHorizon: 30, neighborDistance: 9, anticipatoryOffset: .8 } as CrowdAvoidance);
  }
  world.createEntity('trace');
  world.addComponent('trace', { type: 'DebugTrace', events: [], max: 8 } as DebugTrace);
  world.tick();
  return { velocity: world.getComponent<Velocity>('moving', 'Velocity')!,
    trace: world.getComponent<DebugTrace>('trace', 'DebugTrace')! };
}

describe('size-aware pre-avoidance through the public crowd capability', () => {
  it('gives a larger oncoming footprint a stronger lateral correction at the same range', () => {
    const small = approach(.8);
    const large = approach(2.5);
    expect(Math.abs(large.velocity.vy)).toBeGreaterThan(Math.abs(small.velocity.vy) + .003);
    expect(large.trace.events.some(event => event.kind === 'transition' &&
      event.what.includes('提前侧偏 1'))).toBe(true);
  });
  it('sees a large footprint before a small one at the same farther centre distance', () => {
    const small = approach(.8, 4.5);
    const large = approach(2.5, 4.5);
    expect(Math.abs(large.velocity.vy)).toBeGreaterThan(Math.abs(small.velocity.vy));
  });
});
