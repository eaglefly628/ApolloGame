import { expect, it } from 'vitest';
import { World } from '@engine/core/world.js';
import type { CrowdAvoidance } from '@engine/protocol/components/crowd.js';
import type { Line3D, Transform } from '@engine/protocol/components.js';
import { clearDebugVectors, writeDebugVectors } from './crowd-debug-vectors.js';

it('draws avoidance as the difference from desired to adopted velocity and clears it', () => {
  const world = new World();
  for (const name of ['desired', 'raw', 'actual', 'avoid']) {
    const id = `vectors:${name}`;
    world.createEntity(id);
    world.addComponent(id, { type: 'Line3D', points: [] } as Line3D);
  }
  const cfg: CrowdAvoidance = { type: 'CrowdAvoidance', radius: .5, maxSpeed: .1,
    debugVectorPrefix: 'vectors', debugVectorScale: 10 };
  const t: Transform = { type: 'Transform', x: 2, y: 3, rotation: 0, scaleX: 1, scaleY: 1 };
  expect(writeDebugVectors(world, cfg, t, { x: .1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: .1 })).toBe(0);
  const avoid = world.getComponent<Line3D>('vectors:avoid', 'Line3D')!.points;
  expect(avoid[0]).toEqual([3, 1.12, 3]);
  expect(avoid[1]).toEqual([2, 1.12, 4]);
  clearDebugVectors(world, cfg);
  expect(world.getComponent<Line3D>('vectors:avoid', 'Line3D')!.points).toEqual([]);
});
