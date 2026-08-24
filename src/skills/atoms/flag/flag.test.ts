import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import { flagCapability } from './index.js';
import type { Flag } from '@engine/protocol/components.js';

describe('F2 flag — World integration', () => {
  it('addComponent / getComponent round-trip', () => {
    const world = new World();
    world.createEntity('player');
    const flag: Flag = { type: 'Flag', id: 'grounded', active: false };
    world.addComponent('player', flag);

    const retrieved = world.getComponent<Flag>('player', 'Flag');
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe('grounded');
    expect(retrieved!.active).toBe(false);
  });






});

describe('F2 flag — capability metadata', () => {
  it('id matches periodic table entry', () => {
    expect(flagCapability.id).toBe('f2-flag');
  });

  it('systems array is empty (flag is pure data, no built-in system)', () => {
    expect(flagCapability.systems).toHaveLength(0);
  });

  it('provides exactly the Flag component', () => {
    expect(Object.keys(flagCapability.components.provides)).toEqual(['Flag']);
  });

  it('Flag component has category "config"', () => {
    expect(flagCapability.components.provides.Flag.category).toBe('config');
  });

  it('Flag fields match periodic table: id (string) + active (boolean)', () => {
    const fields = flagCapability.components.provides.Flag.fields;
    expect(fields.id.type).toBe('string');
    expect(fields.active.type).toBe('boolean');
    expect(Object.keys(fields)).toEqual(['id', 'active']);
  });

  it('reads / writes / consumes are all empty', () => {
    expect(flagCapability.components.reads).toHaveLength(0);
    expect(flagCapability.components.writes).toHaveLength(0);
    expect(flagCapability.components.consumes).toHaveLength(0);
  });

  it('config exposes id (input) and active (toggle, default false)', () => {
    expect(flagCapability.config.id.ui.control).toBe('input');
    expect(flagCapability.config.active.ui.control).toBe('toggle');
    expect(flagCapability.config.active.default).toBe(false);
  });
});
