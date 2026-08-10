// 大混战战役核心测试（纯函数·钉死「配对/判生死/重编组/胜负」四步）。
import { describe, it, expect } from 'vitest';
import {
  pairCount, resolveDuel, regroup, countBySide, winnerOf, initialGroups, applyDuel,
  GROUP_SIZE, GROUPS_PER_SIDE, TOTAL_CARDS, type Group,
} from './melee-campaign.js';

/** 定长 flip 序列 → 可复现的「谁活谁死」。 */
const flipper = (seq: readonly boolean[]): (() => boolean) => {
  let i = 0;
  return () => seq[i++] ?? false;
};
const g = (id: string, side: 'red' | 'blue', n: number, x = 0, y = 0): Group =>
  ({ id, side, cards: Array.from({ length: n }, (_, i) => `${id}-${i}`), x, y });

describe('owner 定的规模口径', () => {
  it('24 张一组 · 每方 5 组 · 共 240 张', () => {
    expect(GROUP_SIZE).toBe(24);
    expect(GROUPS_PER_SIDE).toBe(5);
    expect(TOTAL_CARDS).toBe(240);
  });
  it('开局：10 组、每组满编、红蓝分列两侧', () => {
    const gs = initialGroups(40, 12);
    expect(gs).toHaveLength(GROUPS_PER_SIDE * 2);
    for (const q of gs) expect(q.cards).toHaveLength(GROUP_SIZE);
    expect(countBySide(gs)).toEqual({ red: 120, blue: 120 });
    expect(gs.filter((q) => q.side === 'red').every((q) => q.x < 0)).toBe(true);
    expect(gs.filter((q) => q.side === 'blue').every((q) => q.x > 0)).toBe(true);
  });
});

describe('pairCount · 人数不等按少的配', () => {
  it('取较小值', () => {
    expect(pairCount(24, 24)).toBe(24);
    expect(pairCount(13, 8)).toBe(8);
    expect(pairCount(0, 9)).toBe(0);
  });
});

describe('resolveDuel · 一对一判生死', () => {
  it('全正面 → 双方全活（一张不死）', () => {
    const r = resolveDuel(['a1', 'a2'], ['b1', 'b2'], flipper([true, true, true, true]));
    expect(r.aSurvivors).toEqual(['a1', 'a2']);
    expect(r.bSurvivors).toEqual(['b1', 'b2']);
    expect(r.aDead + r.bDead).toBe(0);
  });
  it('全反面 → 同归于尽（双反 25% 是真会发生的）', () => {
    const r = resolveDuel(['a1'], ['b1'], flipper([false, false]));
    expect(r.aSurvivors).toEqual([]);
    expect(r.bSurvivors).toEqual([]);
  });
  it('一正一反 → 正面那张活（抽取顺序=逐对先 a 后 b）', () => {
    const r = resolveDuel(['a1'], ['b1'], flipper([true, false]));
    expect(r.aSurvivors).toEqual(['a1']);
    expect(r.bSurvivors).toEqual([]);
  });
  it('⚠ 没配上对的牌原样存活（不参战 ≠ 死）', () => {
    // 3 打 1：只配 1 对，a 的后两张站着不动。
    const r = resolveDuel(['a1', 'a2', 'a3'], ['b1'], flipper([false, false]));
    expect(r.pairs).toBe(1);
    expect(r.aSurvivors).toEqual(['a2', 'a3']); // a1 阵亡·a2/a3 未参战
    expect(r.bSurvivors).toEqual([]);
    expect(r.aDead).toBe(1);
  });
  it('存活期望 = 每对 1.0 张（红蓝对称·战役是公平随机游走的根据）', () => {
    // 穷举一对的四种落面：双正/正反/反正/双反 → 总存活 2+1+1+0 = 4，四种等概率 → 每对每方期望 0.5、合计 1.0。
    const cases: [boolean, boolean][] = [[true, true], [true, false], [false, true], [false, false]];
    const total = cases.reduce((s, c) => {
      const r = resolveDuel(['a'], ['b'], flipper(c));
      return s + r.aSurvivors.length + r.bSurvivors.length;
    }, 0);
    expect(total).toBe(4);
    // 且双方各自的存活总数相等 → 无系统性偏袒
    const aLive = cases.reduce((s, c) => s + resolveDuel(['a'], ['b'], flipper(c)).aSurvivors.length, 0);
    const bLive = cases.reduce((s, c) => s + resolveDuel(['a'], ['b'], flipper(c)).bSurvivors.length, 0);
    expect(aLive).toBe(bLive);
  });
});

describe('regroup · 活着的重新编成小组', () => {
  it('同色散兵并进满编组，不丢牌', () => {
    const out = regroup([g('r0', 'red', 10), g('r1', 'red', 20), g('b0', 'blue', 5)]);
    expect(countBySide(out)).toEqual({ red: 30, blue: 5 });
    const red = out.filter((q) => q.side === 'red');
    expect(red.map((q) => q.cards.length)).toEqual([24, 6]); // 30 → 24 + 6
  });
  it('空队消失（不留 0 人幽灵队·否则会被拿去配对）', () => {
    const out = regroup([g('r0', 'red', 0), g('b0', 'blue', 3)]);
    expect(out.every((q) => q.cards.length > 0)).toBe(true);
    expect(out).toHaveLength(1);
  });
  it('不跨色合并', () => {
    const out = regroup([g('r0', 'red', 2, 0, 0), g('b0', 'blue', 2, 0, 0)]);
    expect(out).toHaveLength(2);
    for (const q of out) expect(new Set(q.cards.map((c) => c.slice(0, 1)))).toHaveProperty('size', 1);
  });
  it('确定性：同输入两次调用结果逐位相同', () => {
    const src = [g('r1', 'red', 7, 3, 1), g('r0', 'red', 9, -2, 5), g('b0', 'blue', 4, 1, 1)];
    expect(regroup(src)).toEqual(regroup(src));
  });
  it('总数守恒（重编组只搬家不杀人）', () => {
    const src = [g('r0', 'red', 17, 1, 1), g('r1', 'red', 23, 2, 2), g('b0', 'blue', 31, 3, 3)];
    const before = countBySide(src), after = countBySide(regroup(src));
    expect(after).toEqual(before);
  });
});

describe('winnerOf · 打到只剩一色', () => {
  it('双方都在 → 未分胜负', () => {
    expect(winnerOf([g('r', 'red', 1), g('b', 'blue', 1)])).toBeNull();
  });
  it('一色清零 → 另一色胜', () => {
    expect(winnerOf([g('r', 'red', 3)])).toBe('red');
    expect(winnerOf([g('b', 'blue', 3)])).toBe('blue');
  });
  it('同时清零 → 平局（双反同归于尽·不能当没这回事）', () => {
    expect(winnerOf([])).toBe('draw');
  });
});

describe('applyDuel · 结果写回编组表', () => {
  it('只替换参战两队·空队剔除·其余不动', () => {
    const src = [g('r0', 'red', 2), g('r1', 'red', 5), g('b0', 'blue', 2)];
    const out = applyDuel(src, 'r0', 'b0', { pairs: 2, aSurvivors: ['r0-1'], bSurvivors: [], aDead: 1, bDead: 2 });
    expect(out.find((q) => q.id === 'r0')?.cards).toEqual(['r0-1']);
    expect(out.find((q) => q.id === 'b0')).toBeUndefined();   // 全灭 → 剔除
    expect(out.find((q) => q.id === 'r1')?.cards).toHaveLength(5); // 没参战 → 不动
  });
});
