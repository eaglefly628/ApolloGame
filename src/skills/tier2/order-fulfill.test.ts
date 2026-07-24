import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import { orderFulfillCapability } from './order-fulfill.js';
import type { Order, DeliverDrop, PrefabOrigin, Resource } from '@engine/protocol/components.js';

// headless：装能力 + 造订单/成品/资源，注 DeliverDrop 跑一拍看裁决。
function mkWorld(): World {
  const w = new World();
  for (const sys of orderFulfillCapability.systems) w.addSystem(sys);
  return w;
}
function mkItem(w: World, id: string, templateId: string): void {
  w.createEntity(id);
  w.addComponent(id, { type: 'PrefabOrigin', templateId, seq: 0, localId: 'body' } as PrefabOrigin);
}
function mkOrder(w: World, id: string, o: Partial<Order> & { needItems: string[]; reward: Order['reward'] }): void {
  w.createEntity(id);
  w.addComponent(id, { type: 'Order', orderId: id, filled: o.needItems.map(() => false), resetOnComplete: false, ...o } as Order);
}
function mkRes(w: World, id: string, current = 0, max = 999999): void {
  w.createEntity(id);
  w.addComponent(id, { type: 'Resource', id, current, min: 0, max } as Resource);
}
function deliver(w: World, item: string, order: string): void {
  const cid = `dd:${item}:${order}`;
  w.createEntity(cid);
  w.addComponent(cid, { type: 'DeliverDrop', item, order } as DeliverDrop);
  w.tick();
}
const res = (w: World, id: string): number => w.getComponent<Resource>(id, 'Resource')?.current ?? 0;
const filled = (w: World, id: string): boolean[] => w.getComponent<Order>(id, 'Order')!.filled;
const alive = (w: World, id: string): boolean => w.hasComponent(id, 'PrefabOrigin') && !w.hasComponent(id, 'DestroyRequest');

describe('order-fulfill · 拖成品交付订单（消耗棋盘实例·多槽·集齐发奖）', () => {
  it('元数据自描述齐全', () => {
    expect(orderFulfillCapability.id).toBe('t2-order-fulfill');
    expect(orderFulfillCapability.components.provides.Order).toBeTruthy();
    expect(orderFulfillCapability.components.provides.DeliverDrop).toBeTruthy();
    expect(orderFulfillCapability.components.consumes).toContain('DeliverDrop');
  });

  it('单槽命中：交付匹配成品 → 销毁该实例 + 该 slot 置满 + 集齐发奖', () => {
    const w = mkWorld();
    mkRes(w, 'coins'); mkRes(w, 'stars');
    mkOrder(w, 'ord', { needItems: ['dish_a'], reward: [{ resourceId: 'coins', amount: 44 }, { resourceId: 'stars', amount: 2 }] });
    mkItem(w, 'it', 'dish_a');
    deliver(w, 'it', 'ord');
    expect(filled(w, 'ord')).toEqual([true]);
    expect(w.hasComponent('it', 'DestroyRequest')).toBe(true); // 消耗该成品实例
    expect(res(w, 'coins')).toBe(44); // 集齐发奖
    expect(res(w, 'stars')).toBe(2);
  });

  it('不命中：模板不在需求 → 无改动（不销毁·不置满·不发奖）', () => {
    const w = mkWorld();
    mkRes(w, 'coins');
    mkOrder(w, 'ord', { needItems: ['dish_a'], reward: [{ resourceId: 'coins', amount: 44 }] });
    mkItem(w, 'it', 'dish_x'); // 异模板
    deliver(w, 'it', 'ord');
    expect(filled(w, 'ord')).toEqual([false]);
    expect(alive(w, 'it')).toBe(true);
    expect(res(w, 'coins')).toBe(0);
  });

  it('多槽：逐个交付·未集齐不发奖·最后一个集齐才发', () => {
    const w = mkWorld();
    mkRes(w, 'coins');
    mkOrder(w, 'ord', { needItems: ['dish_a', 'dish_b', 'dish_a'], reward: [{ resourceId: 'coins', amount: 100 }] });
    mkItem(w, 'i1', 'dish_a'); mkItem(w, 'i2', 'dish_a'); mkItem(w, 'i3', 'dish_b');
    deliver(w, 'i1', 'ord');
    expect(filled(w, 'ord')).toEqual([true, false, false]); // 落第一个 a slot
    expect(res(w, 'coins')).toBe(0); // 未集齐
    deliver(w, 'i3', 'ord');
    expect(filled(w, 'ord')).toEqual([true, true, false]); // dish_b 命中 slot1（唯一 b 需求）
    expect(res(w, 'coins')).toBe(0);
    deliver(w, 'i2', 'ord');
    expect(filled(w, 'ord').every((f) => f)).toBe(true);
    expect(res(w, 'coins')).toBe(100); // 集齐发奖
  });

  it('已满 slot 不重复占：同模板两次交付第二次落下一个同模板未满 slot', () => {
    const w = mkWorld();
    mkRes(w, 'coins');
    mkOrder(w, 'ord', { needItems: ['dish_a', 'dish_a'], reward: [{ resourceId: 'coins', amount: 10 }] });
    mkItem(w, 'i1', 'dish_a'); mkItem(w, 'i2', 'dish_a');
    deliver(w, 'i1', 'ord'); expect(filled(w, 'ord')).toEqual([true, false]);
    deliver(w, 'i2', 'ord'); expect(filled(w, 'ord')).toEqual([true, true]);
    expect(res(w, 'coins')).toBe(10);
  });

  it('resetOnComplete=true：集齐发奖后清空 filled 重新接单', () => {
    const w = mkWorld();
    mkRes(w, 'coins');
    mkOrder(w, 'ord', { needItems: ['dish_a'], reward: [{ resourceId: 'coins', amount: 5 }], resetOnComplete: true });
    mkItem(w, 'i1', 'dish_a');
    deliver(w, 'i1', 'ord');
    expect(res(w, 'coins')).toBe(5);
    expect(filled(w, 'ord')).toEqual([false]); // 重置接单
  });

  it('发奖钳进资源上限', () => {
    const w = mkWorld();
    mkRes(w, 'coins', 995, 1000);
    mkOrder(w, 'ord', { needItems: ['dish_a'], reward: [{ resourceId: 'coins', amount: 44 }] });
    mkItem(w, 'i1', 'dish_a');
    deliver(w, 'i1', 'ord');
    expect(res(w, 'coins')).toBe(1000); // 995+44=1039 钳到 1000
  });

  it('DeliverDrop 消费即清（一拍后载体不残留）', () => {
    const w = mkWorld();
    mkRes(w, 'coins');
    mkOrder(w, 'ord', { needItems: ['dish_a'], reward: [{ resourceId: 'coins', amount: 5 }] });
    mkItem(w, 'i1', 'dish_a');
    deliver(w, 'i1', 'ord');
    expect(w.query('DeliverDrop').length).toBe(0);
  });
});
