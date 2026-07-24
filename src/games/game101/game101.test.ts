import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { validateLayoutNode } from '@ui/components/index.js';
import type { Resource, PrefabOrigin, InputQueue, RawInputData, Transform, MergeDrop, DeliverDrop, Order, Timer } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { buildS1, buildS1Live } from './s1.js';
import { RES, ENERGY, ENERGY_REGEN_TICKS, mergeRules, GENERATORS, generatorOutput, cellCenter, TIMED_ITEM, TIMED_SEC, TICKS_PER_SEC } from './theme.js';

// ── headless 助手 ─────────────────────────────────────────────────────────────
function res(e: Engine, id: string): number { return e.world.getComponent<Resource>(id, 'Resource')?.current ?? 0; }
function tickN(e: Engine, n: number): void { for (let i = 0; i < n; i++) e.world.tick(); }
function countTemplate(e: Engine, templateId: string): number {
  let n = 0;
  for (const [id] of e.world.query('PrefabOrigin')) {
    const po = e.world.getComponent<PrefabOrigin>(id, 'PrefabOrigin');
    if (po && po.templateId === templateId) n++;
  }
  return n;
}
function setInput(e: Engine, actions: RawInputData[]): void {
  const eid = 'input';
  if (!e.world.hasComponent(eid, 'InputQueue')) e.world.createEntity(eid);
  e.world.addComponent(eid, { type: 'InputQueue', actions } as InputQueue);
}
// 模拟点某生成器一次：注入 down → tick（clickable→craft-recipe）→ 清输入 → 再 tick（event-when→caster→prefab）。
function tapGen(e: Engine, genCell: number): void {
  const p = cellCenter(genCell);
  setInput(e, [{ source: 't', x: p.x, y: p.y, phase: 'down' } as RawInputData]);
  e.world.tick();
  setInput(e, []);
  e.world.tick(); // event-when 发 do_spawn → caster 发 SpawnRequest
  e.world.tick(); // prefab 展开成实例（盖 PrefabOrigin）
}
// 拖放合并（merge-on-place）：把 from 拖到 to → 注入 MergeDrop → 裁决 + prefab 展开。
function itemsOf(e: Engine, template: string): string[] {
  const out: string[] = [];
  for (const [id] of e.world.query('PrefabOrigin')) {
    const po = e.world.getComponent<PrefabOrigin>(id, 'PrefabOrigin');
    if (po && po.templateId === template) out.push(id);
  }
  return out;
}
function dragMerge(e: Engine, from: string, to: string): void {
  const t = e.world.getComponent<Transform>(to, 'Transform');
  const cid = 'drop-test';
  if (!e.world.hasComponent(cid, 'MergeDrop')) e.world.createEntity(cid);
  e.world.addComponent(cid, { type: 'MergeDrop', from, to, x: t?.x ?? 0, y: t?.y ?? 0 } as MergeDrop);
  e.world.tick(); // merge-on-place → destroy from+to + spawn into
  e.world.tick(); // prefab 展开次级
}
// 拖成品去交付（order-fulfill）：注入 DeliverDrop{item,order} → 裁模板匹配 + 销毁实例 + 集齐发奖。
function deliverTo(e: Engine, item: string, orderId: string): void {
  const cid = 'deliver-test';
  if (!e.world.hasComponent(cid, 'DeliverDrop')) e.world.createEntity(cid);
  e.world.addComponent(cid, { type: 'DeliverDrop', item, order: `order-${orderId}` } as DeliverDrop);
  e.world.tick(); // order-fulfill：匹配→DestroyRequest+发奖
  e.world.tick(); // destroy-apply 回收实例
}

describe('game101 ·《海港绯闻》M1a 玩法核（未涉门能力面·数据驱动）', () => {
  it('蓝图是纯数据：消费现有能力 + 关键单例齐全（零专属系统）', () => {
    const bp = buildBlueprint();
    expect(bp.capabilities.length).toBeGreaterThanOrEqual(8);
    const ids = Object.keys(bp.entities);
    for (const key of ['energy', 'coins', 'stars', 'exp', 'library']) expect(ids).toContain(key);
    // 每链每级一条 merge 规则（最高级封顶不写）：食6+渔6+薯4+咖5+工5 各 -1 = 5+5+3+4+4 = 21 条。
    expect(mergeRules().length).toBe(21);
    expect(() => JSON.stringify(bp.entities)).not.toThrow();
  });

  it('起始资源符合配置（体力/金币/星星/经验）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    expect(res(e, RES.energy)).toBe(100);
    expect(res(e, RES.coins)).toBe(0);
    expect(res(e, RES.stars)).toBe(0);
    expect(res(e, RES.exp)).toBe(0);
  });

  it('seed 物品经 prefab 展开：首拍后棋盘出现初始 Lv1 物品实例', () => {
    const e = new Engine(); e.load(buildBlueprint());
    expect(countTemplate(e, 'food_1')).toBe(0); // load 时只有 SpawnRequest 载体
    tickN(e, 1);                                 // prefab 展开 seedItems
    expect(countTemplate(e, 'food_1')).toBe(2);
    expect(countTemplate(e, 'fish_1')).toBe(2);
    expect(countTemplate(e, 'coffee_1')).toBe(2);
  });

  it('拖放合并：seed 两个 food_1 不自动合并·拖一个到另一个才合成 food_2（merge-on-place）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 2); // seed 展开
    expect(countTemplate(e, 'food_1')).toBe(2); // ★ 不自动合并（区别 merge-rule）
    tickN(e, 10);
    expect(countTemplate(e, 'food_1')).toBe(2); // 跑再多拍也不自动合
    const ids = itemsOf(e, 'food_1');
    dragMerge(e, ids[0], ids[1]); // 拖同类 → 合成
    expect(countTemplate(e, 'food_1')).toBe(0);
    expect(countTemplate(e, 'food_2')).toBe(1);
  });

  it('确定性：两把独立跑同 tick → 同 hash（可回放/lockstep 就绪）', () => {
    const a = new Engine(); a.load(buildBlueprint());
    const b = new Engine(); b.load(buildBlueprint());
    tickN(a, 50); tickN(b, 50);
    expect(a.hash()).toBe(b.hash());
  });

  it('体力恢复：低于上限时每 regenIntervalSec 涓流 +1（over-time·挂钟隔离在 timer 输入层）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    e.world.getComponent<Resource>('energy', 'Resource')!.current = 50; // 白盒：造出恢复余量
    tickN(e, ENERGY_REGEN_TICKS - 1);
    expect(res(e, RES.energy)).toBe(50);              // 未到周期不涨
    tickN(e, 1);
    expect(res(e, RES.energy)).toBe(51);              // 到周期 +1
    tickN(e, ENERGY_REGEN_TICKS);
    expect(res(e, RES.energy)).toBe(52);              // 再一周期再 +1
  });

  it('体力不超上限：满体力时恢复被 cap 钳住（over-time local clamp）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    expect(res(e, RES.energy)).toBe(ENERGY.cap);
    tickN(e, ENERGY_REGEN_TICKS * 2);
    expect(res(e, RES.energy)).toBe(ENERGY.cap);      // 不超 cap
  });

  it('S1 主界面是合法 LayoutNode（validate 零 issue·静态稿 + 活板 benchmark 版）', () => {
    expect(validateLayoutNode(buildS1())).toEqual([]);
    const cells = new Array(63).fill(null);
    cells[0] = { emoji: '🧊', gen: 'gen_fridge' };
    cells[8] = { emoji: '🥗', deliverable: true };
    cells[9] = { emoji: '🍝' };
    cells[10] = { emoji: '🦀', timer: 12 };
    const live = buildS1Live({ energy: 34, coins: 305, gems: 8, level: 12, cells, burstCell: 9, orders: [
      { char: '周航', slots: [{ itemEmoji: '🥗', filled: false, want: true }], coins: 44, stars: 2, deliverable: true, mood: 0.4, moodFace: '😊', fly: { id: 'fly-0', label: '🪙+44' } },
      { char: '老陈', slots: [{ itemEmoji: '🐠', filled: true, want: false }, { itemEmoji: '🐠', filled: false, want: false }], coins: 78, stars: 2, deliverable: false, mood: 0, moodFace: '😐' },
      { char: '苏晴', slots: [{ itemEmoji: '☕', filled: false, want: false }], coins: 220, stars: 3, deliverable: false, mood: 1, moodFace: '😍', timed: true, timeLeft: 24 },
    ] });
    expect(live.type).toBe('Screen');
    expect(validateLayoutNode(live)).toEqual([]);
  });

  it('限时菜单：共享 menu Timer 循环推进驱动限时订单 ⏱（e1-timer·不销毁·区别 life）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    const t0 = e.world.getComponent<Timer>('menu-timer', 'Timer');
    expect(t0?.id).toBe('menu');
    expect(t0?.loop).toBe(true);        // 循环刷新
    const el0 = t0!.elapsed;
    tickN(e, 60);
    expect(e.world.getComponent<Timer>('menu-timer', 'Timer')!.elapsed).toBeGreaterThan(el0); // 每拍推进
  });

  it('限时物：带 life Timer 的鲜货到期自毁（timer + lifetime 能力组合）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 2); // seed 展开
    expect(countTemplate(e, TIMED_ITEM)).toBe(1);       // 限时鲜货在板
    tickN(e, TIMED_SEC * TICKS_PER_SEC);                 // 跑满存活期
    expect(countTemplate(e, TIMED_ITEM)).toBe(0);       // 到期 lifetime 销毁
  });

  // ── 生成器（S4 可玩核·点击→耗体力→固定产出·原子）─────────────────────────
  it('生成器点击：耗 1 体力 + 产出该生成器的固定 L1 物品（原子·非加权）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    const g = GENERATORS[0]; // 冰箱 cell 0 → food_1
    const out = generatorOutput(g);
    tickN(e, 4); // 先让 seed 展开+合并稳定
    const e0 = res(e, RES.energy);
    const c0 = countTemplate(e, out);
    tapGen(e, g.cell);
    expect(res(e, RES.energy)).toBe(e0 - g.energyCost); // 扣体力
    expect(countTemplate(e, out)).toBe(c0 + 1);          // 产出一个固定 L1
  });

  it('体力不足拒绝：能量=0 时点生成器不扣不产（craft-recipe 原子 afford）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 4);
    e.world.getComponent<Resource>('energy', 'Resource')!.current = 0;
    const g = GENERATORS[0];
    const out = generatorOutput(g);
    const c0 = countTemplate(e, out);
    tapGen(e, g.cell);
    expect(res(e, RES.energy)).toBe(0);          // 不扣
    expect(countTemplate(e, out)).toBe(c0);      // 不产
  });

  it('生成器产出 + 拖放合并：点工具箱 2 次→2×tool_1（不自动合）→ 拖合成 tool_2', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 4);
    expect(countTemplate(e, 'tool_1')).toBe(0); // 工具链无 seed
    tapGen(e, 3); tapGen(e, 3); // 产 2 个 tool_1
    tickN(e, 1);
    expect(countTemplate(e, 'tool_1')).toBe(2); // 不自动合并
    const ids = itemsOf(e, 'tool_1');
    dragMerge(e, ids[0], ids[1]); // 拖合成
    expect(countTemplate(e, 'tool_1')).toBe(0);
    expect(countTemplate(e, 'tool_2')).toBe(1);
  });

  // ── 订单交付（G2 核心 meta·order-fulfill 闭环）───────────────────────────────
  it('订单交付：合出 food_2 拖给周航 → 消耗该成品实例 + 金币 +44（order-fulfill 闭环）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 2); // seed food_1 展开
    const f1 = itemsOf(e, 'food_1');
    dragMerge(e, f1[0], f1[1]); // 拖合成 food_2（周航订单 needItems=['food_2']）
    expect(countTemplate(e, 'food_2')).toBe(1);
    const dish = itemsOf(e, 'food_2')[0];
    const c0 = res(e, RES.coins);
    const sat0 = res(e, 'sat_o_zhou');
    deliverTo(e, dish, 'o_zhou');
    expect(res(e, RES.coins)).toBe(c0 + 44);       // 单槽集齐即发奖
    expect(countTemplate(e, 'food_2')).toBe(0);    // 成品实例被消耗
    expect(res(e, 'sat_o_zhou')).toBe(sat0 + 1);   // 满意度（心情）+1
  });

  it('订单交付：交错模板不误交（拖 fish_2 给要 food_2 的周航 → 不消耗不发奖）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 2);
    const s1 = itemsOf(e, 'fish_1');
    dragMerge(e, s1[0], s1[1]); // → fish_2
    const wrong = itemsOf(e, 'fish_2')[0];
    const c0 = res(e, RES.coins);
    deliverTo(e, wrong, 'o_zhou'); // 周航要 food_2·非 fish_2
    expect(res(e, RES.coins)).toBe(c0);            // 不发奖
    expect(countTemplate(e, 'fish_2')).toBe(1);    // 不消耗
    const ord = e.world.getComponent<Order>('order-o_zhou', 'Order');
    expect(ord?.filled).toEqual([false]);          // 槽未满
  });

  it('确定性：接生成器后两把同操作序列 → 同 hash（可回放）', () => {
    const a = new Engine(); a.load(buildBlueprint());
    const b = new Engine(); b.load(buildBlueprint());
    tickN(a, 4); tickN(b, 4);
    tapGen(a, 1); tapGen(b, 1);
    tickN(a, 20); tickN(b, 20);
    expect(a.hash()).toBe(b.hash());
  });
});
