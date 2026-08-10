// duel-scheduler 测试：小队遭遇的并发/错峰调度是纯函数，必须钉死——它直接决定同时有多少刚体在跑。
import { describe, it, expect } from 'vitest';
import { planDuelStarts, pairKey, pairMembers, safeMaxConcurrent, activeBodyCount, DEFAULT_SCHEDULER, type SchedulerState } from './duel-scheduler.js';

const st = (o: Partial<SchedulerState>): SchedulerState => ({
  candidates: [], active: new Set(), immune: new Set(), lastStartTick: -Infinity, tick: 1000, ...o,
});

describe('pairKey · 无序对稳定键', () => {
  it('与传入顺序无关', () => { expect(pairKey('r1', 'b2')).toBe(pairKey('b2', 'r1')); });
  it('可还原两个成员', () => { expect(pairMembers(pairKey('r1', 'b2'))).toEqual(['b2', 'r1']); });
});

describe('planDuelStarts · 错峰（owner「不要互相同时开始」）', () => {
  it('距上次开战不足 startGapTicks → 一对都不开', () => {
    const s = st({ candidates: [{ a: 'r1', b: 'b1', dist: 1 }], lastStartTick: 1000, tick: 1010 });
    expect(planDuelStarts(s, { ...DEFAULT_SCHEDULER, startGapTicks: 45 })).toEqual([]);
  });
  it('隔够了才放行', () => {
    const s = st({ candidates: [{ a: 'r1', b: 'b1', dist: 1 }], lastStartTick: 1000, tick: 1045 });
    expect(planDuelStarts(s, { ...DEFAULT_SCHEDULER, startGapTicks: 45 })).toEqual([pairKey('r1', 'b1')]);
  });
  it('**同一 tick 绝不齐开**：候选再多，一 tick 也只开 maxStartsPerTick 对', () => {
    const s = st({ candidates: [
      { a: 'r1', b: 'b1', dist: 1 }, { a: 'r2', b: 'b2', dist: 2 }, { a: 'r3', b: 'b3', dist: 3 },
    ] });
    expect(planDuelStarts(s, { ...DEFAULT_SCHEDULER, maxStartsPerTick: 1, maxConcurrent: 5 })).toHaveLength(1);
  });
});

describe('planDuelStarts · 并发上限（刚体预算的硬闸）', () => {
  it('已达 maxConcurrent → 不再开', () => {
    const s = st({ candidates: [{ a: 'r3', b: 'b3', dist: 1 }], active: new Set([pairKey('r1', 'b1'), pairKey('r2', 'b2')]) });
    expect(planDuelStarts(s, { ...DEFAULT_SCHEDULER, maxConcurrent: 2 })).toEqual([]);
  });
  it('还有额度就开，但不超额', () => {
    const s = st({ candidates: [{ a: 'r2', b: 'b2', dist: 1 }, { a: 'r3', b: 'b3', dist: 2 }], active: new Set([pairKey('r1', 'b1')]) });
    const out = planDuelStarts(s, { maxConcurrent: 2, startGapTicks: 0, maxStartsPerTick: 9 });
    expect(out).toHaveLength(1); // 额度只剩 1
  });
});

describe('planDuelStarts · 占用与免疫', () => {
  it('一个小队同时只能参与一场（本 tick 内也不得被选两次）', () => {
    const s = st({ candidates: [{ a: 'r1', b: 'b1', dist: 1 }, { a: 'r1', b: 'b2', dist: 2 }] });
    const out = planDuelStarts(s, { maxConcurrent: 5, startGapTicks: 0, maxStartsPerTick: 9 });
    expect(out).toEqual([pairKey('r1', 'b1')]); // r1 已被占用 → 第二对跳过
  });
  it('正在打的一方不能接新战', () => {
    const s = st({ candidates: [{ a: 'r1', b: 'b2', dist: 1 }], active: new Set([pairKey('r1', 'b1')]) });
    expect(planDuelStarts(s, { maxConcurrent: 5, startGapTicks: 0, maxStartsPerTick: 9 })).toEqual([]);
  });
  it('打过的对互免·不再开', () => {
    const s = st({ candidates: [{ a: 'r1', b: 'b1', dist: 1 }], immune: new Set([pairKey('r1', 'b1')]) });
    expect(planDuelStarts(s, { maxConcurrent: 5, startGapTicks: 0, maxStartsPerTick: 9 })).toEqual([]);
  });
  it('自己不打自己', () => {
    const s = st({ candidates: [{ a: 'r1', b: 'r1', dist: 0 }] });
    expect(planDuelStarts(s, { maxConcurrent: 5, startGapTicks: 0, maxStartsPerTick: 9 })).toEqual([]);
  });
});

describe('planDuelStarts · 确定性', () => {
  it('近的先打', () => {
    const s = st({ candidates: [{ a: 'r1', b: 'b1', dist: 9 }, { a: 'r2', b: 'b2', dist: 1 }] });
    expect(planDuelStarts(s, { maxConcurrent: 5, startGapTicks: 0, maxStartsPerTick: 1 })).toEqual([pairKey('r2', 'b2')]);
  });
  it('同距时按 pairKey 字典序 —— 全序 tie-break·同输入必同输出', () => {
    const s1 = st({ candidates: [{ a: 'r2', b: 'b2', dist: 5 }, { a: 'r1', b: 'b1', dist: 5 }] });
    const s2 = st({ candidates: [{ a: 'r1', b: 'b1', dist: 5 }, { a: 'r2', b: 'b2', dist: 5 }] });
    const cfg = { maxConcurrent: 5, startGapTicks: 0, maxStartsPerTick: 1 };
    expect(planDuelStarts(s1, cfg)).toEqual(planDuelStarts(s2, cfg)); // 候选顺序不影响结果
  });
});

describe('刚体预算护栏', () => {
  it('activeBodyCount：对数 × 2 × 每队人数', () => {
    expect(activeBodyCount(2, 36)).toBe(144);
    expect(activeBodyCount(3, 36)).toBe(216); // ← 超 150 预算·正是要拦的
  });
  it('safeMaxConcurrent：36 人队在 150 体预算下最多 2 对同时打', () => {
    expect(safeMaxConcurrent(36, 150)).toBe(2);
    expect(activeBodyCount(safeMaxConcurrent(36, 150), 36)).toBeLessThanOrEqual(150);
  });
  it('小队越小可并发越多·但至少给 1（不能卡死）', () => {
    expect(safeMaxConcurrent(10, 150)).toBe(7);
    expect(safeMaxConcurrent(500, 150)).toBe(1);
  });
  it('缺省配置与 36 人队自洽：DEFAULT 的并发 2 正好等于安全上限', () => {
    expect(DEFAULT_SCHEDULER.maxConcurrent).toBe(safeMaxConcurrent(36, 150));
  });
});
