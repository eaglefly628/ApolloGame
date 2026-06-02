import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/core/world.js';
import { overlapDetectCapability } from './index.js';
import type { Transform, Shape, Overlap } from '@engine/protocol/components.js';

const system = overlapDetectCapability.systems[0];

function place(w: World, id: string, x: number, y: number, shape: Shape) {
  w.createEntity(id);
  const t: Transform = { type: 'Transform', x, y, rotation: 0, scaleX: 1, scaleY: 1 };
  w.addComponent(id, t);
  w.addComponent(id, shape);
}
function box(width: number, height: number): Shape {
  return { type: 'Shape', kind: 'box', width, height };
}
function circle(radius: number): Shape {
  return { type: 'Shape', kind: 'circle', radius };
}
function overlaps(w: World): Overlap[] {
  return w.query('Overlap').map(([id]) => w.getComponent<Overlap>(id, 'Overlap')!);
}

describe('overlap-detect system', () => {
  let world: World;
  beforeEach(() => {
    world = new World();
    world.addSystem(system);
  });

  it('detects overlapping boxes with axis-of-min-penetration normal + depth', () => {
    place(world, 'a', 0, 0, box(32, 32));
    place(world, 'b', 20, 0, box(32, 32));
    world.tick();
    const o = overlaps(world);
    expect(o).toHaveLength(1);
    expect(o[0].normalX).toBe(1);
    expect(o[0].normalY).toBe(0);
    expect(o[0].depth).toBe(12);
  });

  it('reports nothing when boxes are apart', () => {
    place(world, 'a', 0, 0, box(32, 32));
    place(world, 'b', 40, 0, box(32, 32));
    world.tick();
    expect(overlaps(world)).toHaveLength(0);
  });

  it('detects overlapping circles with a normalized normal', () => {
    place(world, 'a', 0, 0, circle(10));
    place(world, 'b', 15, 0, circle(10));
    world.tick();
    const o = overlaps(world);
    expect(o).toHaveLength(1);
    expect(o[0].depth).toBeCloseTo(5);
    expect(o[0].normalX).toBeCloseTo(1);
    expect(o[0].normalY).toBeCloseTo(0);
  });

  it('detects box vs circle', () => {
    place(world, 'a', 0, 0, box(20, 20));
    place(world, 'b', 15, 0, circle(8));
    world.tick();
    const o = overlaps(world);
    expect(o).toHaveLength(1);
    expect(o[0].depth).toBeCloseTo(3);
  });

  it('clears stale overlaps once entities separate', () => {
    place(world, 'a', 0, 0, box(32, 32));
    place(world, 'b', 20, 0, box(32, 32));
    world.tick();
    expect(overlaps(world)).toHaveLength(1);

    world.getComponent<Transform>('b', 'Transform')!.x = 200;
    world.tick();
    expect(overlaps(world)).toHaveLength(0);
  });
});
