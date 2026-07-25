import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { validateLayoutNode } from '@ui/components/index.js';
import type { Resource, PrefabOrigin, InputQueue, RawInputData, Transform, MergeDrop, DeliverDrop, Order, Timer, Blocker, SpawnRequest, Flag } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { buildS1, buildS1Live } from './s1.js';
import { RES, ENERGY, ENERGY_REGEN_TICKS, mergeRules, GENERATORS, cellCenter, cellIndexOf, TIMED_ITEM, TIMED_SEC, TICKS_PER_SEC, BUBBLES } from './theme.js';

// ── headless 助手 ─────────────────────────────────────────────────────────────
function res(e: Engine, id: string): number { return e.world.getComponent<Resource>(id, 'Resource')?.current ?? 0; }
function tickN(e: Engine, n: number): void { for (let i = 0; i < n; i++) e.world.tick(); }
// 某生成器掉落表内所有物件的板上总数（加权产出=表内任一·故按表求和验「产了一个」）。
function dropCount(e: Engine, g: { dropTable: { item: string }[] }): number {
  return g.dropTable.reduce((s, d) => s + countTemplate(e, d.item), 0);
}
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
    tickN(e, 1);                                 // prefab 展开 seedItems（初始关卡：3 稻谷 food_1 起手）
    expect(countTemplate(e, 'food_1')).toBe(3);
  });

  it('拖放合并：seed food_1 不自动合并·拖一个到另一个才合成 food_2（merge-on-place）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 2); // seed 展开（3 个 food_1）
    expect(countTemplate(e, 'food_1')).toBe(3); // ★ 不自动合并（区别 merge-rule）
    tickN(e, 10);
    expect(countTemplate(e, 'food_1')).toBe(3); // 跑再多拍也不自动合
    const ids = itemsOf(e, 'food_1');
    dragMerge(e, ids[0], ids[1]); // 拖同类 → 合成（product 唯一·food_1 原料数被挖掘 reveal 干扰故只验 product）
    expect(countTemplate(e, 'food_2')).toBe(1); // 合出 1 个 food_2（merge-on-place 生效）
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
    cells[11] = { emoji: '🔒', cover: 3 };
    const live = buildS1Live({ energy: 34, coins: 305, gems: 8, level: 12, cells, burstCell: 9, dragGhost: { emoji: '🍅', x: 300, y: 900 }, orders: [
      { char: '周航', slots: [{ itemEmoji: '🥗', filled: false, want: true }], coins: 44, stars: 2, deliverable: true, mood: 0.4, moodFace: '😊', fly: { id: 'fly-0', label: '🪙+44' }, celebrate: true },
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

  // 初始关卡：种子 3 稻谷在开洞 cell 7,8,9；cell 16(row2col2)=1 层覆盖·在 cell8 合并 3×3 内。
  function grainAt(e: Engine, cell: number): string {
    return itemsOf(e, 'food_1').find((id) => { const t = e.world.getComponent<Transform>(id, 'Transform'); return t && cellIndexOf(t.x, t.y) === cell; })!;
  }
  it('挖掘解锁：邻近二消挖开阻碍层·1 层归零清层（merge-proximity-clear 闭环·核心乐趣）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 2); // seed 展开（3 稻谷在 cell 7,8,9）
    expect(e.world.getComponent<Blocker>('cover-16', 'Blocker')?.layers).toBe(1); // cell16=1 层·在 cell8 合并 3×3 内
    const at8 = grainAt(e, 8); const other = itemsOf(e, 'food_1').find((id) => id !== at8)!;
    dragMerge(e, other, at8); // 合并落点=cell8 → MergeEvent → 挖 3×3 邻格（含 cell16）
    tickN(e, 2);
    expect(e.world.hasComponent('cover-16', 'Blocker')).toBe(false); // 1 层归零 → 清层解锁（挖开）
  });

  it('挖掘：深层远格不受近处二消影响（cell 48 深 3 层·距 seed 合并远）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 2);
    expect(e.world.getComponent<Blocker>('cover-48', 'Blocker')?.layers).toBe(3); // 深格初始 3 层
    const at8 = grainAt(e, 8); const other = itemsOf(e, 'food_1').find((id) => id !== at8)!;
    dragMerge(e, other, at8);
    tickN(e, 2);
    expect(e.world.getComponent<Blocker>('cover-48', 'Blocker')?.layers).toBe(3); // 远格不动
  });

  it('生成器渐解锁：起始生成器格(1/2/3)被覆盖·挖开后可用（四基础料不全给）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 2);
    expect(e.world.getComponent<Blocker>('cover-1', 'Blocker')?.layers).toBe(2); // 咖啡机格起始 2 层覆盖
    expect(e.world.hasComponent('gen-gen_coffee', 'Clickable')).toBe(true); // 生成器实体仍在（只是被盖·挖开即现）
  });

  // ── 生成器（S4 可玩核·点击→耗全局体力→weighted-spawn 加权抽产出）─────────────
  it('生成器点击：耗 1 体力（全局 craft-recipe）+ weighted-spawn 产出掉落表内一个物件', () => {
    const e = new Engine(); e.load(buildBlueprint());
    const g = GENERATORS[0]; // 米仓 cell 0 → food 链掉落表
    tickN(e, 4); // 先让 seed 展开+合并稳定
    const e0 = res(e, RES.energy);
    const c0 = dropCount(e, g);
    tapGen(e, g.cell);
    expect(res(e, RES.energy)).toBe(e0 - g.energyCost); // 扣全局体力
    expect(dropCount(e, g)).toBe(c0 + 1);               // 掉落表内恰多一个（具体哪档由加权抽定）
  });

  it('生成器加权：多次点米仓 → 产出跨掉落表多档（证真加权·非恒吐首项）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    const g = GENERATORS[0]; // food_1 w60 / food_2 w30 / food_3 w10
    tickN(e, 4);
    e.world.getComponent<Resource>('energy', 'Resource')!.current = 100; // 备足体力多点
    const base = g.dropTable.map((d) => countTemplate(e, d.item));
    for (let i = 0; i < 24; i++) tapGen(e, g.cell); // 固定种子=确定性序列
    const now = g.dropTable.map((d) => countTemplate(e, d.item));
    const gained = now.map((v, i) => v - base[i]);
    expect(gained.reduce((a, b) => a + b, 0)).toBe(24);       // 每点恰产一个
    expect(gained.filter((x) => x > 0).length).toBeGreaterThan(1); // ≥2 档命中=真加权（非恒首项）
  });

  it('产出可见性（bug 修复）：生成器产出落在自己格 → 移动意图挪到空格（否则盖生成器下=点了没反应）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 4);
    const g = GENERATORS[0]; // 米仓 cell 0
    const c0 = dropCount(e, g);
    tapGen(e, g.cell);
    // 加权产出=掉落表内任一 → 按落点（生成器格）而非模板找刚产的实例。
    const fresh = e.world.query('PrefabOrigin').map(([id]) => id).find((id) => {
      const po = e.world.getComponent<PrefabOrigin>(id, 'PrefabOrigin');
      const t = e.world.getComponent<Transform>(id, 'Transform');
      return po && g.dropTable.some((d) => d.item === po.templateId) && t && cellIndexOf(t.x, t.y) === g.cell;
    });
    expect(dropCount(e, g)).toBe(c0 + 1);
    expect(fresh).toBeTruthy(); // 确认产出确实落在生成器格（weighted-spawn at 自身位·被盖住不可见）
    // 宿主修复机制：注入移动意图（MergeDrop 无 to）→ merge-on-place 挪到空格 20 → 可见可拖。
    const free = cellCenter(20);
    e.world.createEntity('reloc');
    e.world.addComponent('reloc', { type: 'MergeDrop', from: fresh!, x: free.x, y: free.y } as MergeDrop);
    e.world.tick();
    const t2 = e.world.getComponent<Transform>(fresh!, 'Transform')!;
    expect(cellIndexOf(t2.x, t2.y)).toBe(20); // 挪到空格 = 可见
  });

  it('体力不足拒绝：能量=0 时点生成器不扣不产（craft-recipe 原子 afford）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 4);
    e.world.getComponent<Resource>('energy', 'Resource')!.current = 0;
    const g = GENERATORS[0];
    const c0 = dropCount(e, g);
    tapGen(e, g.cell);
    expect(res(e, RES.energy)).toBe(0);      // 不扣
    expect(dropCount(e, g)).toBe(c0);        // craft-recipe afford 挡在前 → 无信号进 weighted-spawn → 不产
  });

  it('生成器产链可拖合：注入 2×tool_1（甜点链）→ 拖合成 tool_2', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 4);
    expect(countTemplate(e, 'tool_1')).toBe(0); // 工具/甜点链无 seed
    // 直接注入两个 tool_1（避开生成器加权 RNG 耦合·合成机制独立验）：SpawnRequest 载体·prefab 首拍展开自回收。
    for (let k = 0; k < 2; k++) {
      const c = cellCenter(30 + k); e.world.createEntity(`inj-tool-${k}`);
      e.world.addComponent(`inj-tool-${k}`, { type: 'SpawnRequest', templateId: 'tool_1', x: c.x, y: c.y } as SpawnRequest);
    }
    tickN(e, 1);
    expect(countTemplate(e, 'tool_1')).toBe(2); // 不自动合并
    const ids = itemsOf(e, 'tool_1');
    dragMerge(e, ids[0], ids[1]); // 拖合成
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

  it('订单交付：交错模板不误交（拖稻谷 food_1 给要 food_2 的周航 → 不消耗不发奖）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 2);
    const wrong = itemsOf(e, 'food_1')[0]; // 稻谷 food_1（周航要 food_2 米饭·不匹配）
    const c0 = res(e, RES.coins);
    deliverTo(e, wrong, 'o_zhou');
    expect(res(e, RES.coins)).toBe(c0);                       // 不发奖
    expect(e.world.hasComponent(wrong, 'PrefabOrigin')).toBe(true); // 该稻谷未被消耗
    const ord = e.world.getComponent<Order>('order-o_zhou', 'Order');
    expect(ord?.filled).toEqual([false]);                    // 槽未满
  });

  // ── 泡泡锁（G3·bubble-wrapper·点破扣金币→spawn 真物→destroy 泡泡·金币回收出口）──
  it('泡泡锁：金币足→点破扣 30 币 + 出真物 coffee_2 + 泡泡实体销毁', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 2);
    const b = BUBBLES[0]; // b_coffee @ cell 15 · coffee_2 · 30
    e.world.getComponent<Resource>(RES.coins, 'Resource')!.current = 50; // 白盒授币（足付）
    expect(e.world.hasComponent(`bubble-${b.id}`, 'Tag')).toBe(true);
    const c0 = countTemplate(e, b.item);
    tapGen(e, b.cell); // 点 = down@泡泡格 → clickable→craft-recipe 扣币→event-when→caster+effect
    tickN(e, 1);
    expect(res(e, RES.coins)).toBe(20);                     // 50-30=扣币
    expect(countTemplate(e, b.item)).toBe(c0 + 1);          // 出真物
    expect(e.world.hasComponent(`bubble-${b.id}`, 'Tag')).toBe(false); // 泡泡销毁
  });

  it('泡泡锁：金币不足→不扣不破（craft-recipe 原子 afford·回收门槛）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 2);
    const b = BUBBLES[0];
    e.world.getComponent<Resource>(RES.coins, 'Resource')!.current = 10; // 不足 30
    const c0 = countTemplate(e, b.item);
    tapGen(e, b.cell);
    tickN(e, 1);
    expect(res(e, RES.coins)).toBe(10);                     // 不扣
    expect(countTemplate(e, b.item)).toBe(c0);              // 不产
    expect(e.world.hasComponent(`bubble-${b.id}`, 'Tag')).toBe(true); // 泡泡仍在
  });

  // ── 进度推进②（攒星 → 里程碑解锁新区 → 达标关卡完成·全组合·零引擎改动）──────────
  it('里程碑解锁：攒够 3⭐ → 西仓星锁 marker 批量销毁（destroy-tagged 开区）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 2);
    // 星锁 marker 初始在场（西仓 cell 49-55）。
    expect(e.world.hasComponent('starlock-m_west-49', 'Tag')).toBe(true);
    expect(e.world.hasComponent('starlock-m_east-56', 'Tag')).toBe(true); // 东仓 6⭐ 未达
    e.world.getComponent<Resource>('stars', 'Resource')!.current = 3; // 白盒攒够西仓门槛
    tickN(e, 2); // event-when(stars≥3·edge) → effect destroy-tagged 清西仓 marker
    expect(e.world.hasComponent('starlock-m_west-49', 'Tag')).toBe(false); // 西仓开区
    expect(e.world.hasComponent('starlock-m_west-55', 'Tag')).toBe(false);
    expect(e.world.hasComponent('starlock-m_east-56', 'Tag')).toBe(true);  // 东仓仍锁（6⭐ 未到）
  });

  it('关卡完成：攒够目标 10⭐ → level_done 旗置真', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 2);
    expect(e.world.getComponent<Flag>('level-flag', 'Flag')?.active).toBe(false);
    e.world.getComponent<Resource>('stars', 'Resource')!.current = 10; // 达标
    tickN(e, 2); // event-when(stars≥10·edge) → set-flag level_done
    expect(e.world.getComponent<Flag>('level-flag', 'Flag')?.active).toBe(true);
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
