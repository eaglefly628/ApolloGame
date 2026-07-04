import { describe, it, expect } from 'vitest';
import { logistic, cardPoints, pEff, winrate, clashResolve, P_MAX, P_MIN, WR_MIN, WR_MAX, rollWithMods, rollDist, rollWinProb, rollWinProbMods, NO_ROLL_MODS, type RollMods } from './clash-resolve.js';
import type { RandomSeed } from '@engine/protocol/components.js';

const seed = (s: number): RandomSeed => ({ type: 'RandomSeed', seed: s, sequence: 0 });

describe('Game G · clash-resolve（doc19 §三 对决解算核 · pairwise logistic · 公平骨架）', () => {
  it('logistic：0→0.5、处处单调、两端趋 0/1', () => {
    expect(logistic(0)).toBeCloseTo(0.5, 6);
    expect(logistic(10)).toBeGreaterThan(0.99);
    expect(logistic(-10)).toBeLessThan(0.01);
    let prev = -1; for (let x = -6; x <= 6.0001; x += 0.5) { const y = logistic(x); expect(y).toBeGreaterThan(prev); prev = y; }
  });

  it('cardPoints：公平骨架 军衔=点数（王15 / A14 / K13 / Q12 / J11 / 10..2）', () => {
    expect(cardPoints('JOKER')).toBe(15); expect(cardPoints('★')).toBe(15);
    expect(cardPoints('A')).toBe(14); expect(cardPoints('K')).toBe(13); expect(cardPoints('Q')).toBe(12); expect(cardPoints('J')).toBe(11);
    expect(cardPoints('10')).toBe(10); expect(cardPoints('2')).toBe(2);
  });

  it('pEff：base+Σbuff 夹 [P_min,P_max]（防膨胀）', () => {
    expect(pEff(13, 4)).toBe(17);
    expect(pEff(13, 999)).toBe(P_MAX);
    expect(pEff(0, -999)).toBe(P_MIN);
  });

  it('winrate：等战力=50%、随点差单调、夹爆冷缝[3%,97%]（永不 0/100）、未夹区对称', () => {
    expect(winrate(10, 10)).toBeCloseTo(0.5, 6);
    expect(winrate(20, 10)).toBeGreaterThan(winrate(15, 10));
    expect(winrate(30, 0)).toBeLessThanOrEqual(WR_MAX); // 碾压也留缝
    expect(winrate(30, 0)).toBeGreaterThan(0.9);
    expect(winrate(0, 30)).toBeGreaterThanOrEqual(WR_MIN);
    expect(winrate(0, 30)).toBeLessThan(0.1);
    expect(winrate(15, 10) + winrate(10, 15)).toBeCloseTo(1, 6); // 未夹区对称
  });

  it('clashResolve：种子骰确定可回放 + 频率≈winrate（蒙特卡洛·仿真台基底）', () => {
    const r1 = seed(7), r2 = seed(7);
    for (let i = 0; i < 50; i++) expect(clashResolve(13, 11, r1)).toBe(clashResolve(13, 11, r2)); // 同 seed 同序列
    const wr = winrate(15, 10); const r = seed(123); let win = 0; const N = 4000;
    for (let i = 0; i < N; i++) if (clashResolve(15, 10, r)) win++;
    expect(win / N).toBeCloseTo(wr, 1); // 频率 ≈ 胜率（±~0.05）
  });
});

// ── 改掷层（REQ-G-天罡原生重构 §四.2·掷骰系天罡）──
describe('Game G · 改掷层 rollWithMods/rollDist/rollWinProbMods（掷骰系天罡）', () => {
  const sumDist = (d: Map<number, number>): number => [...d.values()].reduce((a, b) => a + b, 0);

  it('rollDist：无 mods = 均匀 [1,P]·概率和=1·退化等于 rollWinProb', () => {
    const d = rollDist(6, NO_ROLL_MODS);
    expect(sumDist(d)).toBeCloseTo(1, 10);
    for (let v = 1; v <= 6; v++) expect(d.get(v)).toBeCloseTo(1 / 6, 10);
    // rollWinProbMods(NO,NO) 逐字等于 rollWinProb
    const a = rollWinProb(9, 6), b = rollWinProbMods(9, 6, NO_ROLL_MODS, NO_ROLL_MODS);
    expect(b.pGreater).toBeCloseTo(a.pGreater, 12); expect(b.pEqual).toBeCloseTo(a.pEqual, 12);
  });

  it('鬼手 bonus：改掷 +2 → 分布整体右移·胜率升', () => {
    const base = rollWinProbMods(8, 8, NO_ROLL_MODS, NO_ROLL_MODS).pGreater;
    const boon = rollWinProbMods(8, 8, { bonus: 2, floor: 0, twice: 0 }, NO_ROLL_MODS).pGreater;
    expect(boon).toBeGreaterThan(base); // 我 +2 → 我更容易赢
    const d = rollDist(6, { bonus: 2, floor: 0, twice: 0 });
    expect([...d.keys()].sort((x, y) => x - y)).toEqual([3, 4, 5, 6, 7, 8]); // [1,6]+2 = [3,8]
    expect(sumDist(d)).toBeCloseTo(1, 10);
  });

  it('磐石 floor：掷下界 +2 → 掷 [3,P]·最小值=3·概率和=1', () => {
    const d = rollDist(6, { bonus: 0, floor: 2, twice: 0 });
    expect(Math.min(...d.keys())).toBe(3); expect(Math.max(...d.keys())).toBe(6);
    expect(sumDist(d)).toBeCloseTo(1, 10);
    for (let v = 3; v <= 6; v++) expect(d.get(v)).toBeCloseTo(1 / 4, 10); // [3,6] 均匀
    expect(rollWinProbMods(8, 8, { bonus: 0, floor: 2, twice: 0 }, NO_ROLL_MODS).pGreater).toBeGreaterThan(0.5); // 抬下界 → 占优
  });

  it('灌铅骰 twice：掷两次取高 → 偏高端·胜率升·分布和=1', () => {
    const d = rollDist(4, { bonus: 0, floor: 0, twice: 1 });
    expect(sumDist(d)).toBeCloseTo(1, 10);
    expect(d.get(4)!).toBeGreaterThan(d.get(1)!); // 取高 → 高值概率大
    expect(d.get(4)!).toBeCloseTo((16 - 9) / 16, 10); // P(max=4)=(4²-3²)/4²=7/16
    expect(rollWinProbMods(8, 8, { bonus: 0, floor: 0, twice: 1 }, NO_ROLL_MODS).pGreater).toBeGreaterThan(0.5);
  });

  it('rollWithMods：确定性(同种子同值)·范围正确·消费 rng (1+twice) 次', () => {
    const r1 = seed(7), r2 = seed(7);
    const m: RollMods = { bonus: 2, floor: 1, twice: 1 };
    expect(rollWithMods(6, r1, m)).toBe(rollWithMods(6, r2, m)); // 确定
    for (let i = 0; i < 200; i++) { const v = rollWithMods(6, seed(i), { bonus: 0, floor: 2, twice: 0 }); expect(v).toBeGreaterThanOrEqual(3); expect(v).toBeLessThanOrEqual(6); } // 掷 [3,6]
    // twice 消费两次 rng：seq 前进 2
    const rr = seed(1); rollWithMods(6, rr, { bonus: 0, floor: 0, twice: 1 }); expect(rr.sequence).toBe(2);
  });
});
