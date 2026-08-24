import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Transform } from '@engine/protocol/components.js';
import { transformCapability } from './index.js';

describe('A1 transform — capability metadata', () => {
  it('id and version are correct', () => {
    expect(transformCapability.id).toBe('a1-transform');
    expect(transformCapability.version).toBe('1.0.0');
  });

  it('has no systems (pure data atom)', () => {
    expect(transformCapability.systems).toHaveLength(0);
  });

  it('reads / writes / consumes are all empty', () => {
    expect(transformCapability.components.reads).toHaveLength(0);
    expect(transformCapability.components.writes).toHaveLength(0);
    expect(transformCapability.components.consumes).toHaveLength(0);
  });

  it('provides Transform with correct category', () => {
    const schema = transformCapability.components.provides['Transform'];
    expect(schema).toBeDefined();
    expect(schema.category).toBe('config');
  });

  it('Transform fields match periodic table A1 definition', () => {
    const fields = transformCapability.components.provides['Transform'].fields;
    expect(fields['x'].type).toBe('number');
    expect(fields['y'].type).toBe('number');
    expect(fields['rotation'].type).toBe('number');
    expect(fields['scaleX'].type).toBe('number');
    expect(fields['scaleY'].type).toBe('number');
    expect(Object.keys(fields)).toHaveLength(5);
  });

  it('config exposes all five initial-value params with correct defaults', () => {
    const cfg = transformCapability.config;
    expect(cfg['x'].default).toBe(0);
    expect(cfg['y'].default).toBe(0);
    expect(cfg['rotation'].default).toBe(0);
    expect(cfg['scaleX'].default).toBe(1);
    expect(cfg['scaleY'].default).toBe(1);
  });

  it('config controls are sliders', () => {
    const cfg = transformCapability.config;
    for (const key of ['x', 'y', 'rotation', 'scaleX', 'scaleY']) {
      expect(cfg[key].ui.control).toBe('slider');
    }
  });
});

describe('A1 transform — component via World', () => {
  it('addComponent / getComponent round-trip preserves all fields', () => {
    const world = new World();
    world.createEntity('e1');

    const transform: Transform = {
      type: 'Transform',
      x: 100,
      y: 200,
      rotation: Math.PI / 4,
      scaleX: 2,
      scaleY: 3,
    };

    world.addComponent('e1', transform);

    const got = world.getComponent<Transform>('e1', 'Transform');
    expect(got).toBeDefined();
    expect(got!.type).toBe('Transform');
    expect(got!.x).toBe(100);
    expect(got!.y).toBe(200);
    expect(got!.rotation).toBe(Math.PI / 4);
    expect(got!.scaleX).toBe(2);
    expect(got!.scaleY).toBe(3);
  });








});
