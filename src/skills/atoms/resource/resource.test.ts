import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/core/world.js';
import { resourceCapability } from './index.js';
import type { Resource, ResourceModify } from '@engine/protocol/components.js';

const system = resourceCapability.systems[0];

function makeResource(id: string, current: number, min: number, max: number): Resource {
  return { type: 'Resource', id, current, min, max };
}

function makeModify(resourceId: string, amount: number): ResourceModify {
  return { type: 'ResourceModify', resourceId, amount };
}

describe('resource-apply system', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    world.addSystem(system);
  });

  it('positive amount increases current, clamped to max', () => {
    world.createEntity('e1');
    world.addComponent('e1', makeResource('hp', 90, 0, 100));
    world.addComponent('e1', makeModify('hp', 20));

    world.tick();

    const res = world.getComponent<Resource>('e1', 'Resource')!;
    expect(res.current).toBe(100);
  });

  it('negative amount decreases current, clamped to min', () => {
    world.createEntity('e1');
    world.addComponent('e1', makeResource('hp', 10, 0, 100));
    world.addComponent('e1', makeModify('hp', -50));

    world.tick();

    const res = world.getComponent<Resource>('e1', 'Resource')!;
    expect(res.current).toBe(0);
  });

  it('clamps to non-zero min (min = -50)', () => {
    world.createEntity('e1');
    world.addComponent('e1', makeResource('temp', -30, -50, 100));
    world.addComponent('e1', makeModify('temp', -40));

    world.tick();

    const res = world.getComponent<Resource>('e1', 'Resource')!;
    expect(res.current).toBe(-50);
  });

  it('positive amount stays within range without clamping', () => {
    world.createEntity('e1');
    world.addComponent('e1', makeResource('mp', 40, 0, 100));
    world.addComponent('e1', makeModify('mp', 30));

    world.tick();

    const res = world.getComponent<Resource>('e1', 'Resource')!;
    expect(res.current).toBe(70);
  });

  it('negative amount stays within range without clamping', () => {
    world.createEntity('e1');
    world.addComponent('e1', makeResource('hp', 80, 0, 100));
    world.addComponent('e1', makeModify('hp', -20));

    world.tick();

    const res = world.getComponent<Resource>('e1', 'Resource')!;
    expect(res.current).toBe(60);
  });

  it('resourceId mismatch leaves Resource unchanged', () => {
    world.createEntity('e1');
    world.addComponent('e1', makeResource('hp', 80, 0, 100));
    world.addComponent('e1', makeModify('mp', -20));

    world.tick();

    const res = world.getComponent<Resource>('e1', 'Resource')!;
    expect(res.current).toBe(80);
  });

  it('ResourceModify is consumed after one tick', () => {
    world.createEntity('e1');
    world.addComponent('e1', makeResource('hp', 50, 0, 100));
    world.addComponent('e1', makeModify('hp', 10));

    world.tick();

    expect(world.hasComponent('e1', 'ResourceModify')).toBe(false);
  });

  it('ResourceModify consumed even when resourceId does not match', () => {
    world.createEntity('e1');
    world.addComponent('e1', makeResource('hp', 50, 0, 100));
    world.addComponent('e1', makeModify('mp', 10));

    world.tick();

    expect(world.hasComponent('e1', 'ResourceModify')).toBe(false);
  });

  it('no ResourceModify leaves Resource unchanged', () => {
    world.createEntity('e1');
    world.addComponent('e1', makeResource('hp', 50, 0, 100));

    world.tick();

    const res = world.getComponent<Resource>('e1', 'Resource')!;
    expect(res.current).toBe(50);
  });

  it('clamps exactly at max boundary', () => {
    world.createEntity('e1');
    world.addComponent('e1', makeResource('hp', 100, 0, 100));
    world.addComponent('e1', makeModify('hp', 1));

    world.tick();

    const res = world.getComponent<Resource>('e1', 'Resource')!;
    expect(res.current).toBe(100);
  });

  it('clamps exactly at min boundary', () => {
    world.createEntity('e1');
    world.addComponent('e1', makeResource('hp', 0, 0, 100));
    world.addComponent('e1', makeModify('hp', -1));

    world.tick();

    const res = world.getComponent<Resource>('e1', 'Resource')!;
    expect(res.current).toBe(0);
  });

  it('R11 全局路由：ResourceModify 挂在别的实体，按 id 路由到持有资源的实体', () => {
    world.createEntity('game-state');
    world.addComponent('game-state', makeResource('affection_S', 30, 0, 100));
    // 修改挂在一个完全无关的"事件"实体上，只带 id —— 不知道资源住哪
    world.createEntity('dialogue-event');
    world.addComponent('dialogue-event', makeModify('affection_S', 5));

    world.tick();

    expect(world.getComponent<Resource>('game-state', 'Resource')!.current).toBe(35);
    expect(world.hasComponent('dialogue-event', 'ResourceModify')).toBe(false); // 仍被消费
  });

  it('R11 同实体优先：多实体同名资源，co-located 改各自的（不被全局路由抢走）', () => {
    world.createEntity('p1');
    world.addComponent('p1', makeResource('hp', 50, 0, 100));
    world.addComponent('p1', makeModify('hp', 20));
    world.createEntity('p2');
    world.addComponent('p2', makeResource('hp', 80, 0, 100));
    world.addComponent('p2', makeModify('hp', -30));

    world.tick();

    expect(world.getComponent<Resource>('p1', 'Resource')!.current).toBe(70);
    expect(world.getComponent<Resource>('p2', 'Resource')!.current).toBe(50);
  });

  it('multiple entities are processed independently', () => {
    world.createEntity('e1');
    world.addComponent('e1', makeResource('hp', 50, 0, 100));
    world.addComponent('e1', makeModify('hp', 20));

    world.createEntity('e2');
    world.addComponent('e2', makeResource('hp', 80, 0, 100));
    world.addComponent('e2', makeModify('hp', -30));

    world.tick();

    const r1 = world.getComponent<Resource>('e1', 'Resource')!;
    const r2 = world.getComponent<Resource>('e2', 'Resource')!;
    expect(r1.current).toBe(70);
    expect(r2.current).toBe(50);
  });
});
