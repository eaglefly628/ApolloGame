import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import type { Resource, PrefabOrigin } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { RES, ENERGY, ENERGY_REGEN_TICKS, mergeRules } from './theme.js';

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

  it('merge-2 确定性合并：2×food_1 → 1×food_2（need:2·最老先合·封顶自然终止）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 6); // 展开 → 合并 → prefab 落产物，留足连锁拍数
    expect(countTemplate(e, 'food_1')).toBe(0);
    expect(countTemplate(e, 'food_2')).toBe(1);
    // 其它链同样各合成一个次级
    expect(countTemplate(e, 'fish_2')).toBe(1);
    expect(countTemplate(e, 'coffee_2')).toBe(1);
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
});
