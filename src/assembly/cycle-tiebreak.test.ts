import { describe, it, expect, vi, afterEach } from 'vitest';
import { World } from '@engine/core/world.js';
import type { CapabilityDefinition } from '@engine/core/define-capability.js';
import { ALL_CAPABILITIES, CAPABILITY_REGISTRY } from './capability-registry.js';

// ══════════════════════════════════════════════════════════════════════════
//  REQ-CYCLEHAZ 方案 B —— 真能力装载冒烟（引擎单测在 engine/core/topological-sort.test.ts 钉算法，
//  这里钉「Lead 核查点名的真组合确实装得进 + 顺序确定」）。
//
//  背景：组件推断边规则下两系统 RMW 同一黑板组件即互为前驱成 2-环，全库普查 101 能力两两配对
//  得 65 对成环（热点 = Resource/Flag/State/CardPile）。B 前这些组合 load 即抛 Circular。
//  本文件取 Lead 点名的最小复现 + 三对代表组合，走**真实装载路径**（World.addSystem → tick）验收。
// ══════════════════════════════════════════════════════════════════════════

/** 按能力**注册表序**（atoms→tier1→tier2→tier3）取能力 = 模拟按注册序装载。 */
function inRegistryOrder(ids: string[]): CapabilityDefinition[] {
  const want = new Set(ids);
  const caps = ALL_CAPABILITIES.filter((c) => want.has(c.id));
  const missing = ids.filter((id) => !CAPABILITY_REGISTRY.has(id));
  if (missing.length) throw new Error(`测试引用了未注册能力：${missing.join(', ')}`);
  return caps;
}

/** 真实装载：新建 world、按给定顺序 addSystem，返回定序后的 system id 序列。 */
function loadOrder(caps: CapabilityDefinition[]): string[] {
  const w = new World();
  for (const c of caps) for (const s of c.systems ?? []) w.addSystem(s);
  const ids = w.getSortedSystems().map((s) => s.id); // 触发 topologicalSort
  expect(() => w.tick()).not.toThrow(); // 空世界跑一拍：装得进也跑得动
  return ids;
}

/** 装两次（各自新 world）→ 顺序必须逐位一致（同一世界每次装载同序·录放一致）。 */
function loadTwice(ids: string[]): string[] {
  const first = loadOrder(inRegistryOrder(ids));
  const second = loadOrder(inRegistryOrder(ids));
  expect(second).toEqual(first);
  return first;
}

let warnSpy: ReturnType<typeof vi.spyOn>;
function captureWarn(): string[] {
  const seen: string[] = [];
  warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    seen.push(String(args[0]));
  });
  return seen;
}
afterEach(() => vi.restoreAllMocks());

describe('REQ-CYCLEHAZ B — Lead 点名最小复现（真能力）', () => {
  it('① t3-timeline + f1-resource（双方 RMW Resource·2-环）装得进且顺序确定', () => {
    const warns = captureWarn();
    const order = loadTwice(['t3-timeline', 'f1-resource']);
    expect(order).toContain('timeline');
    expect(order).toContain('resource-apply');
    // 按注册表序装载 → atom(f1-resource) 在 tier3(t3-timeline) 之前 = 平局键即 tier 序。
    expect(order.indexOf('resource-apply')).toBeLessThan(order.indexOf('timeline'));
    expect(warns.some((w) => w.includes('timeline') && w.includes('resource-apply'))).toBe(true);
  });

  it('② t2-event-when 叠加成 3-环（event-when→timeline→resource-apply）装得进', () => {
    const warns = captureWarn();
    const order = loadTwice(['t2-event-when', 't3-timeline', 'f1-resource']);
    for (const id of ['event-when', 'timeline', 'resource-apply']) expect(order).toContain(id);
    // timeline 自带 runsAfter:['event-when'] = 硬约束，平局裁决不许推翻它。
    expect(order.indexOf('event-when')).toBeLessThan(order.indexOf('timeline'));
    expect(warns.length).toBeGreaterThan(0);
  });

  it('④ 平局键与 tier/注册序一致：按注册表序装载 → 低 tier 在前', () => {
    captureWarn();
    const order = loadTwice(['f1-resource', 't2-event-when', 't3-timeline']);
    const rank = (id: string): number => order.indexOf(id);
    expect(rank('resource-apply')).toBeLessThan(rank('event-when')); // atom < tier2
    expect(rank('event-when')).toBeLessThan(rank('timeline')); // tier2 < tier3
  });

  it('平局键 = 装载序：反序装载则裁决反转（键就是注册序本身）', () => {
    captureWarn();
    const forward = loadOrder(inRegistryOrder(['t3-timeline', 'f1-resource']));
    const reversed = loadOrder([...inRegistryOrder(['t3-timeline', 'f1-resource'])].reverse());
    expect(forward.indexOf('resource-apply')).toBeLessThan(forward.indexOf('timeline'));
    expect(reversed.indexOf('timeline')).toBeLessThan(reversed.indexOf('resource-apply'));
  });
});

// 65 对成环清单里的三对代表组合（剧情线/卡牌线必然同装）——装得进 + 顺序确定。
describe('REQ-CYCLEHAZ B — 代表组合装载冒烟', () => {
  const combos: Array<[string, string[], string[]]> = [
    ['dialogue × flow（剧情线 M4 必踩·闭环组件 Flag/Resource/State）', ['t3-dialogue', 't3-flow'], ['dialogue', 'flow']],
    ['card-play × card-pile（卡牌线·闭环组件 Flag/PlayedHand）', ['t2-card-play', 't2-card-pile'], ['card-play-input', 'card-pile']],
    ['dialogue × timeline（剧情线 M4 必踩·闭环组件 Flag/Resource）', ['t3-dialogue', 't3-timeline'], ['dialogue', 'timeline']],
  ];

  for (const [label, capIds, sysIds] of combos) {
    it(`${label} 装得进且顺序确定`, () => {
      captureWarn();
      const order = loadTwice(capIds);
      for (const id of sysIds) expect(order).toContain(id);
      expect(new Set(order).size).toBe(order.length); // 无重复
    });
  }
});
