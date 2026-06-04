import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/core/world.js';
import { spatialQueryCapability, queryRange, queryNearest } from './index.js';
import type { Transform } from '@engine/protocol/components.js';

function place(w: World, id: string, x: number, y: number) {
  w.createEntity(id);
  const t: Transform = { type: 'Transform', x, y, rotation: 0, scaleX: 1, scaleY: 1 };
  w.addComponent(id, t);
}

describe('spatial-query atom', () => {
  let world: World;
  beforeEach(() => {
    world = new World();
    place(world, 'origin', 0, 0);
    place(world, 'near', 30, 0);
    place(world, 'mid', 80, 0);
    place(world, 'far', 500, 0);
  });

  it('is a world-service atom with no per-tick system', () => {
    expect(spatialQueryCapability.systems).toHaveLength(0);
  });

  it('queryRange returns entities within the radius', () => {
    const inside = queryRange(world, 0, 0, 100).sort();
    expect(inside).toEqual(['mid', 'near', 'origin']);
  });

  it('queryRange excludes entities outside the radius', () => {
    expect(queryRange(world, 0, 0, 100)).not.toContain('far');
  });

  it('queryNearest returns closest entities in order, honoring exclude', () => {
    const nearest = queryNearest(world, 0, 0, 2, 'origin');
    expect(nearest).toEqual(['near', 'mid']);
  });

  it('SpatialIndex config defaults to a 64px grid', () => {
    expect(spatialQueryCapability.config.cellSize.default).toBe(64);
    expect(spatialQueryCapability.config.kind.default).toBe('grid');
  });
});
