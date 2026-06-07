import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Perception, Relation, Transform, Tag } from '@engine/protocol/components.js';
import { aggroCapability } from './aggro.js';

const PLAYER = 1 << 1;
const xf = (x: number, y: number): Transform => ({ type: 'Transform', x, y, rotation: 0, scaleX: 1, scaleY: 1 });
const rel = (w: World, e: string): Relation | undefined => w.getComponent<Relation>(e, 'Relation');

function world(): World {
  const w = new World();
  for (const s of aggroCapability.systems) w.addSystem(s);
  return w;
}
function target(w: World, id: string, x: number, y: number, flags = PLAYER): void {
  w.createEntity(id);
  w.addComponent(id, xf(x, y));
  w.addComponent(id, { type: 'Tag', flags } as Tag);
}
function perceiver(w: World, id: string, x: number, y: number, p: Omit<Perception, 'type'>): void {
  w.createEntity(id);
  w.addComponent(id, xf(x, y));
  w.addComponent(id, { type: 'Perception', ...p } as Perception);
}

describe('aggro — 元数据 / 定序', () => {
  it('id 正确 + runsBefore motion-apply', () => {
    expect(aggroCapability.id).toBe('t3-aggro');
    expect(aggroCapability.systems[0].runsBefore).toContain('motion-apply');
  });
});

describe('aggro — 索敌 → Relation(target)', () => {
  it('锁定视野内最近的 targetTag 阵营', () => {
    const w = world();
    perceiver(w, 'm', 0, 0, { targetTag: PLAYER, sightRadius: 0 });
    target(w, 'p_far', 100, 0);
    target(w, 'p_near', 20, 0);
    w.tick();
    expect(rel(w, 'm')).toMatchObject({ kind: 'target', targetId: 'p_near' });
  });

  it('视野外 → 不锁定', () => {
    const w = world();
    perceiver(w, 'm', 0, 0, { targetTag: PLAYER, sightRadius: 50 });
    target(w, 'p', 100, 0); // dist 100 > 50
    w.tick();
    expect(rel(w, 'm')).toBeUndefined();
  });

  it('目标离开视野 → 清掉 Relation(target)', () => {
    const w = world();
    perceiver(w, 'm', 0, 0, { targetTag: PLAYER, sightRadius: 50 });
    target(w, 'p', 20, 0);
    w.tick();
    expect(rel(w, 'm')).toMatchObject({ targetId: 'p' });
    // 目标跑远。
    w.getComponent<Transform>('p', 'Transform')!.x = 200;
    w.tick();
    expect(rel(w, 'm')).toBeUndefined(); // 丢失目标
  });

  it('只锁 targetTag 阵营（不锁同阵营/无标签）', () => {
    const w = world();
    perceiver(w, 'm', 0, 0, { targetTag: PLAYER, sightRadius: 0 });
    target(w, 'ally', 5, 0, 1 << 2); // 非 PLAYER 阵营，更近
    target(w, 'p', 30, 0, PLAYER);
    w.tick();
    expect(rel(w, 'm')).toMatchObject({ targetId: 'p' }); // 跳过非目标阵营的更近者
  });
});
