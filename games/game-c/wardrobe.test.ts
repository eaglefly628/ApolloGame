import { describe, it, expect } from 'vitest';
import { World } from '@zerocraft/engine/engine/core/world.js';
import type { Resource, Signal } from '@zerocraft/engine/engine/protocol/components.js';
import { craftRecipeCapability } from '@zerocraft/engine/skills/tier2/craft-recipe.js';
import {
  CLOTHING_ITEMS, WARDROBE_TOTAL, buildPawnEntities,
  chipsResourceId, clothingResourceId, pawnSignal, wardrobeItemIds,
} from './wardrobe.js';

// 典当=引擎 t2-craft-recipe 解释纯数据配方——本测试起真 World 挂真系统跑全链（不 mock 引擎）。
function pawnWorld(seats: number[]): World {
  const w = new World();
  for (const s of craftRecipeCapability.systems) w.addSystem(s);
  for (const [eid, bp] of Object.entries(buildPawnEntities(seats))) {
    w.createEntity(eid);
    for (const [type, fields] of Object.entries(bp)) w.addComponent(eid, { type, ...fields } as never);
  }
  for (const seat of seats) {
    // 筹码 Resource=装配层契约件（此处照约定建）：min 0、max 容纳全部典当收益。
    const eid = `res:chips:${seat}`;
    w.createEntity(eid);
    w.addComponent(eid, { type: 'Resource', id: chipsResourceId(seat), current: 0, min: 0, max: Infinity } as Resource);
  }
  return w;
}

const val = (w: World, id: string): number => {
  for (const [eid] of w.query('Resource')) {
    const r = w.getComponent<Resource>(eid, 'Resource')!;
    if (r.id === id) return r.current;
  }
  throw new Error(`无 Resource ${id}`);
};

/** 发一拍典当信号并 tick（信号实体即建即销——模拟 UI 单拍 action 信号）。 */
function firePawn(w: World, seat: number, itemId: string): void {
  const sid = `sig:${seat}:${itemId}`;
  w.createEntity(sid);
  w.addComponent(sid, { type: 'Signal', name: pawnSignal(seat, itemId), source: sid } as Signal);
  w.tick();
  w.destroyEntity(sid);
}

describe('game-c wardrobe — 衣物表（owner 拍板数值）', () => {
  it('六件·总值 2450·id 无重', () => {
    expect(CLOTHING_ITEMS).toHaveLength(6);
    expect(WARDROBE_TOTAL).toBe(2450);
    expect(new Set(CLOTHING_ITEMS.map((c) => c.id)).size).toBe(6);
    expect(CLOTHING_ITEMS.find((c) => c.id === 'lingerie')!.value).toBe(1000);
  });

  it('蓝图片段=纯数据（可 JSON 序列化·无函数）', () => {
    const bp = buildPawnEntities([0, 1]);
    expect(JSON.parse(JSON.stringify(bp))).toEqual(bp);
    expect(Object.keys(bp)).toHaveLength(2 * 6 * 2); // 每席每件=衣物实体+配方实体
    expect(wardrobeItemIds(0)).toHaveLength(6);
  });
});

describe('game-c wardrobe — 典当全链（真 World × 引擎 craft-recipe）', () => {
  it('典当一件：原子扣衣物 + 加面值筹码', () => {
    const w = pawnWorld([0, 1]);
    firePawn(w, 0, 'earrings');
    expect(val(w, chipsResourceId(0))).toBe(100);
    expect(val(w, clothingResourceId(0, 'earrings'))).toBe(0);
    expect(val(w, chipsResourceId(1))).toBe(0); // 邻座不受扰
    expect(val(w, clothingResourceId(1, 'earrings'))).toBe(1);
  });

  it('同件二次典当：不可负担 → 整单不动（引擎原子性防重）', () => {
    const w = pawnWorld([0]);
    firePawn(w, 0, 'lingerie');
    expect(val(w, chipsResourceId(0))).toBe(1000);
    firePawn(w, 0, 'lingerie');
    expect(val(w, chipsResourceId(0))).toBe(1000); // 不重复入账
    expect(val(w, clothingResourceId(0, 'lingerie'))).toBe(0);
  });

  it('自由点选顺序·当完六件=总值 2450（续命上限）', () => {
    const w = pawnWorld([0]);
    for (const item of [...CLOTHING_ITEMS].reverse()) firePawn(w, 0, item.id); // 逆序点当（顺序自由=owner 拍板）
    expect(val(w, chipsResourceId(0))).toBe(WARDROBE_TOTAL);
    for (const item of CLOTHING_ITEMS) expect(val(w, clothingResourceId(0, item.id))).toBe(0);
  });

  it('六席并行互不串扰（信号名带席位）', () => {
    const seats = [0, 1, 2, 3, 4, 5];
    const w = pawnWorld(seats);
    firePawn(w, 3, 'top');
    firePawn(w, 5, 'socks');
    expect(val(w, chipsResourceId(3))).toBe(500);
    expect(val(w, chipsResourceId(5))).toBe(200);
    for (const s of [0, 1, 2, 4]) expect(val(w, chipsResourceId(s))).toBe(0);
  });
});
