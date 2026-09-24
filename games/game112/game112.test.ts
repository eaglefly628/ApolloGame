import { describe, it, expect } from 'vitest';
import type { Effect } from '@zerocraft/engine/engine/protocol/components.js';
import { HallSession } from './session.js';
import { buildBlueprint, EMPTY_STATE, type PersistedState } from './blueprint.js';
import { routeAction, normalizeState } from './game112.js';
import { UI_ACTIONS } from './ui.js';
import {
  ACTIVE_CAT, STARDUST, RELATIONS, MOOD_DRIFT, CARE_ACTIONS, SHOP_ITEMS, CHAPTERS, OFFLINE_EVENTS, OFFLINE_ACK_KEY,
  relId, buyKey, placeKey, offlineKey, offlineTierOf, chapterFlag,
} from './world-data.js';
import { resourceOf, flagOn } from './project.js';

const rel = (s: HallSession, k: 'closeness' | 'ease' | 'heartlight' | 'mood'): number => resourceOf(s.world, relId(k, ACTIVE_CAT));
const withState = (p: Partial<PersistedState>): PersistedState => ({ ...EMPTY_STATE, ...p });

describe('game112 世界装配（S3 骨架关：引擎吃得下·空跑不炸）', () => {
  it('blueprint 装载 + 空跑 2 tick 零异常，关系四量初值 = 表', () => {
    const s = new HallSession(112);
    s.step(2);
    for (const r of RELATIONS) expect(rel(s, r.key), r.key).toBe(r.start);
    expect(resourceOf(s.world, STARDUST)).toBe(0);
  });

  it('心光只增：蓝图里没有任何负向写心光的 Effect（数据纪律·结构测试）', () => {
    const bp = buildBlueprint(112);
    const heart = relId('heartlight', ACTIVE_CAT);
    for (const [id, e] of Object.entries(bp.entities)) {
      const fx = (e as { Effect?: Omit<Effect, 'type'> }).Effect;
      if (fx?.kind === 'modify-resource' && fx.targetId === heart) expect(Number(fx.value), id).toBeGreaterThan(0);
      const recipe = (e as { CraftRecipe?: { costs: { id: string }[] } }).CraftRecipe;
      if (recipe) expect(recipe.costs.map((c) => c.id), id).not.toContain(heart);
    }
  });
});

describe('game112 陪伴动作（具名 action → keybind → Effect·零解释器）', () => {
  it('轻声呼唤：亲近 +2 · 兴致 +6 · 星砂 +1（一拍反馈）', () => {
    const s = new HallSession(112);
    const before = { c: rel(s, 'closeness'), m: rel(s, 'mood'), d: resourceOf(s.world, STARDUST) };
    s.act('cat.greet');
    s.step(); // Effect 在 Commit 相位写，下一拍读到
    expect(rel(s, 'closeness')).toBe(before.c + 2);
    expect(rel(s, 'mood')).toBe(before.m + 6);
    expect(resourceOf(s.world, STARDUST)).toBe(before.d + 1);
  });

  it('陪它坐坐：心光 +2 · 安心 +2；表里每个动作都真有对应 Effect（撤修锚点：改坏表值即红）', () => {
    const s = new HallSession(112);
    s.act('cat.sit'); s.step();
    expect(rel(s, 'heartlight')).toBe(2);
    expect(rel(s, 'ease')).toBe(22);
    const sit = CARE_ACTIONS.find((a) => a.id === 'sit')!;
    expect(sit.effects.find((e) => e.res === relId('heartlight', ACTIVE_CAT))?.amount).toBe(2);
  });

  it('兴致自然下行：每 period 拍 -1（t2-over-time·duration 0 永续）', () => {
    const s = new HallSession(112);
    const m0 = rel(s, 'mood');
    s.step(MOOD_DRIFT.period + 1);
    expect(rel(s, 'mood')).toBe(m0 - 1);
  });
});

describe('game112 星砂杂货铺（craft-recipe：可负担才成交，否则整单不动）', () => {
  it('星砂不够 → 不扣不给不置旗', () => {
    const s = new HallSession(112, withState({ stardust: 10 }));
    s.act(buyKey('feather')); s.step();
    expect(resourceOf(s.world, STARDUST)).toBe(10);
    expect(s.hall().owned).toEqual([]);
  });

  it('星砂够 → 扣价、物品 +1、own 旗置位；放到馆里 → placed 旗置位、主厅可见', () => {
    const s = new HallSession(112, withState({ stardust: 50 }));
    const feather = SHOP_ITEMS.find((i) => i.id === 'feather')!;
    s.act(buyKey('feather')); s.step();
    expect(resourceOf(s.world, STARDUST)).toBe(50 - feather.price);
    expect(s.hall().owned).toEqual([{ id: 'feather', name: feather.name, kind: 'toy', count: 1, placed: false }]);
    s.act(placeKey('feather')); s.step();
    expect(s.hall().owned[0]?.placed).toBe(true);
    // 再买一次 40 的软垫：剩 20 不够 → 不动
    s.act(buyKey('cushion')); s.step();
    expect(s.hall().owned.map((o) => o.id)).toEqual(['feather']);
  });
});

describe('game112 回忆章节（心光阈值 edge 解锁 → t3-dialogue 推进）', () => {
  it('心光到阈值那一拍解锁，之前不解锁；章节可读到底', () => {
    const chap = CHAPTERS[0]!;
    const s = new HallSession(112, withState({ relations: { [relId('heartlight', ACTIVE_CAT)]: chap.unlockHeartlight - 2 } }));
    s.step();
    expect(flagOn(s.world, chapterFlag(chap.id))).toBe(false);
    s.act('cat.sit'); s.step(2); // +2 → 达阈 → EventWhen edge → Effect set-flag（各一拍）
    expect(flagOn(s.world, chapterFlag(chap.id))).toBe(true);
    expect(s.hall().chapters[0]?.unlocked).toBe(true);

    let r = s.reading(chap.id)!;
    expect(r.speaker).toBe('旁白'); expect(r.ended).toBe(false); expect(r.options).toBeUndefined();
    s.act('dialogue.advance'); r = s.reading(chap.id)!;
    expect(r.text).toContain('从前有个人');
    s.act('dialogue.advance'); r = s.reading(chap.id)!;
    expect(r.options).toHaveLength(2);
    s.act('dialogue.choose', { x: 1 }); r = s.reading(chap.id)!;
    expect(r.ended).toBe(true);
    expect(r.text).toContain('尾巴尖');
  });

  it('局外持久态往返：心光/亲近/物品/章节/游标带走，兴致不带走（当次临时）', () => {
    const s = new HallSession(112, withState({ stardust: 60 }));
    s.act(buyKey('paperbag')); s.act('cat.greet'); s.step();
    const p = s.persisted();
    expect(p.items).toEqual({ paperbag: 1 });
    expect(p.relations[relId('closeness', ACTIVE_CAT)]).toBe(2);
    expect(Object.keys(p.relations)).not.toContain(relId('mood', ACTIVE_CAT));
    const s2 = new HallSession(7, p);
    expect(resourceOf(s2.world, STARDUST)).toBe(60 - 20 + 1); // 买纸袋 -20 · 呼唤 +1
    expect(rel(s2, 'closeness')).toBe(2);
    expect(rel(s2, 'mood')).toBe(RELATIONS.find((r) => r.key === 'mood')!.start);
    expect(s2.hall().owned.map((o) => o.id)).toEqual(['paperbag']);
  });
});

describe('game112 离线小事件（分档 key → weighted-spawn 种子抽模板 → prefab 展开）', () => {
  it('回馆注入一档 → 恰好展开一个装饰模板（文案来自表）；看过了 → 批量回收', () => {
    const s = new HallSession(112);
    s.act(offlineKey('long')); s.step();
    const ev = s.hall().offlineEvents;
    expect(ev).toHaveLength(1);
    expect(OFFLINE_EVENTS.map((e) => e.text)).toContain(ev[0]);
    s.act(OFFLINE_ACK_KEY); s.step();
    expect(s.hall().offlineEvents).toEqual([]);
  });

  it('宿主分档：<5min 无 · <2h short · <1d long · 否则 days（墙钟只在宿主）', () => {
    expect(offlineTierOf(60_000)).toBeUndefined();
    expect(offlineTierOf(30 * 60_000)).toBe('short');
    expect(offlineTierOf(5 * 3600_000)).toBe('long');
    expect(offlineTierOf(3 * 86400_000)).toBe('days');
  });
});

describe('game112 确定性', () => {
  it('同 seed + 同动作序列 → 同快照 hash；换 seed 离线事件可不同但仍在表内', () => {
    const script = (s: HallSession): string => {
      s.act('cat.greet'); s.act(offlineKey('short')); s.act('cat.sit'); s.step(10);
      return s.hash();
    };
    expect(script(new HallSession(112, withState({ stardust: 30 })))).toBe(script(new HallSession(112, withState({ stardust: 30 }))));
    const s3 = new HallSession(9, withState({ stardust: 30 })); script(s3);
    expect(OFFLINE_EVENTS.map((e) => e.text)).toContain(s3.hall().offlineEvents[0]);
  });
});

describe('game112 宿主路由（UI action → 具名输入·纯查表）', () => {
  it('UI_ACTIONS 每个动作都有路由（无孤儿按钮）；带参动作闭集外 → 什么都不发生', () => {
    for (const a of UI_ACTIONS) {
      const arg = a === 'shop.buy' || a === 'decor.place' ? 'feather' : a === 'memory.read' ? CHAPTERS[0]!.id : a === 'memory.choose' ? '0' : undefined;
      expect(routeAction(a, arg), a).toBeDefined();
    }
    expect(routeAction('shop.buy', 'not-an-item')).toBeUndefined();
    expect(routeAction('memory.read', 'nope')).toBeUndefined();
    expect(routeAction('memory.choose', 'x')).toBeUndefined();
    expect(routeAction('decor.place', 'feather')).toEqual({ key: placeKey('feather'), screen: 'hall' });
  });

  it('坏档守卫：非对象/坏字段回空档，不让坏数据进蓝图', () => {
    expect(normalizeState(null)).toEqual(EMPTY_STATE);
    expect(normalizeState({ stardust: 'x', relations: { a: 'b', c: 3 }, items: 5, placed: [1, 'feather'], chapters: 'no', cursors: { k: 1, j: 'n2' } }))
      .toEqual({ stardust: 0, relations: { c: 3 }, items: {}, placed: ['feather'], chapters: [], cursors: { j: 'n2' } });
  });
});
