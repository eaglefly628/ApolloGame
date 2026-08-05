import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { MergeDrop, MergeRule, PrefabOrigin, Transform, SpawnRequest } from '@engine/protocol/components.js';
import { mergeOnPlaceCapability } from './merge-on-place.js';

function w0(): World {
  const w = new World();
  for (const s of mergeOnPlaceCapability.systems) w.addSystem(s);
  return w;
}
function item(w: World, id: string, template: string, x: number, y: number, seq = 0): void {
  w.createEntity(id);
  w.addComponent(id, { type: 'PrefabOrigin', templateId: template, seq, localId: 'body' } as PrefabOrigin);
  w.addComponent(id, { type: 'Transform', x, y, rotation: 0, scaleX: 1, scaleY: 1 } as Transform);
}
function rule(w: World, template: string, into: string): void {
  const id = `rule:${template}`;
  w.createEntity(id);
  w.addComponent(id, { type: 'MergeRule', template, need: 2, into } as MergeRule);
}
function drop(w: World, from: string, to: string | undefined, x: number, y: number): void {
  const id = 'drop';
  w.createEntity(id);
  w.addComponent(id, { type: 'MergeDrop', from, ...(to ? { to } : {}), x, y } as MergeDrop);
}
function spawnReqs(w: World): SpawnRequest[] {
  return w.query('SpawnRequest').map(([id]) => w.getComponent<SpawnRequest>(id, 'SpawnRequest')!).filter(Boolean);
}

describe('T2 merge-on-place — metadata', () => {
  it('id / 读 MergeDrop+PrefabOrigin+Transform+MergeRule / 写 Transform+Destroy+Spawn', () => {
    expect(mergeOnPlaceCapability.id).toBe('t2-merge-on-place');
    expect(mergeOnPlaceCapability.components.reads).toEqual(['MergeDrop', 'PrefabOrigin', 'Transform', 'MergeRule']);
    expect(mergeOnPlaceCapability.components.consumes).toEqual(['MergeDrop']);
  });
});

describe('T2 merge-on-place — 拖放裁决', () => {
  it('同模板 + 有 MergeRule → 销毁 from+to·在 to 处 spawn into', () => {
    const w = w0();
    rule(w, 'a', 'b');
    item(w, 'i1', 'a', 100, 100, 0);
    item(w, 'i2', 'a', 200, 100, 1);
    drop(w, 'i1', 'i2', 200, 100);
    w.tick();
    expect(w.hasComponent('i1', 'DestroyRequest')).toBe(true);
    expect(w.hasComponent('i2', 'DestroyRequest')).toBe(true);
    const reqs = spawnReqs(w);
    expect(reqs.length).toBe(1);
    expect(reqs[0].templateId).toBe('b');
    expect(reqs[0].x).toBe(200); expect(reqs[0].y).toBe(100); // 在 to 处
    expect(w.hasComponent('drop', 'MergeDrop')).toBe(false); // 消费
  });

  it('拖到空格（无 to）→ 移动 from 到落点·不合成', () => {
    const w = w0();
    rule(w, 'a', 'b');
    item(w, 'i1', 'a', 100, 100, 0);
    drop(w, 'i1', undefined, 500, 300);
    w.tick();
    const t = w.getComponent<Transform>('i1', 'Transform')!;
    expect(t.x).toBe(500); expect(t.y).toBe(300);
    expect(w.hasComponent('i1', 'DestroyRequest')).toBe(false);
    expect(spawnReqs(w).length).toBe(0);
  });

  it('异模板 → 交换位置·不合成', () => {
    const w = w0();
    rule(w, 'a', 'b');
    item(w, 'i1', 'a', 100, 100, 0);
    item(w, 'i2', 'c', 200, 100, 1);
    drop(w, 'i1', 'i2', 200, 100);
    w.tick();
    const t1 = w.getComponent<Transform>('i1', 'Transform')!;
    const t2 = w.getComponent<Transform>('i2', 'Transform')!;
    expect(t1.x).toBe(200); expect(t2.x).toBe(100); // 交换
    expect(w.hasComponent('i1', 'DestroyRequest')).toBe(false);
    expect(spawnReqs(w).length).toBe(0);
  });

  it('封顶（无 MergeRule）同模板 → 交换·不合成', () => {
    const w = w0();
    item(w, 'i1', 'top', 100, 100, 0);
    item(w, 'i2', 'top', 200, 100, 1);
    drop(w, 'i1', 'i2', 200, 100);
    w.tick();
    expect(w.hasComponent('i1', 'DestroyRequest')).toBe(false);
    expect(spawnReqs(w).length).toBe(0);
    expect(w.getComponent<Transform>('i1', 'Transform')!.x).toBe(200); // 交换
  });
});

// ── 回归（engine-review-2026-08-04 §3.3 · P1）─────────────────────────────
// 载体/事件实体 id 原先只用每拍归零的计数器命名。MergeEvent 由 merge-proximity-clear/juice
// 之类下游「read-then-consume」，**但游戏不一定装了这些消费者**——那上一拍的 mev:1 会一直在，
// 次拍再合并时 createEntity 撞名 → 硬抛 `Entity "mev:1" already exists` 当场崩局。
// 修：id 带 world.getVersion() 拍号（每拍 +1、同拍内全系统同值、全对端一致 → 跨拍唯一且不破确定性）。
describe('T2 merge-on-place — 跨拍 id 唯一（无 MergeEvent 消费者时也不得撞名硬崩）', () => {
  it('连续两拍各合并一次（不装任何 MergeEvent/SpawnRequest 消费者）→ 不抛', () => {
    const w = w0();
    rule(w, 'egg', 'chick');

    item(w, 'a1', 'egg', 0, 0);
    item(w, 'a2', 'egg', 1, 0);
    drop(w, 'a1', 'a2', 1, 0);
    expect(() => w.tick()).not.toThrow();

    // 第二拍：再来一组同模板合并。上一拍产出的 mev/mop 实体仍在（无消费者），
    // 旧实现在此撞名硬抛。
    item(w, 'b1', 'egg', 5, 5);
    item(w, 'b2', 'egg', 6, 5);
    drop(w, 'b1', 'b2', 6, 5);
    expect(() => w.tick()).not.toThrow();

    // 两拍各产出一条 spawn 请求，彼此独立（没有互相覆盖/丢失）
    expect(spawnReqs(w).filter((r) => r.templateId === 'chick').length).toBe(2);
  });
});

