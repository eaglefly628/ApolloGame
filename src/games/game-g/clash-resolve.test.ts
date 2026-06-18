import { describe, it, expect } from 'vitest';
import { logistic, cardPoints, pEff, winrate, clashResolve, P_MAX, P_MIN, WR_MIN, WR_MAX } from './clash-resolve.js';
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
