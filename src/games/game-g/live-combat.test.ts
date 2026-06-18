import { describe, it, expect } from 'vitest';
import { standardArmy, HOME_HP } from './index.js';
import { initLiveBattle, stepLiveBattle, runLiveBattle, liveHash, type DeployCmd } from './live-combat.js';

// doc 18/19 · 3D-2 live 解析器 + 3D-CLASH 对决核：验证 live 化后 outcome-first 不破（确定性逐拍 hash）
// + 公平骨架（base=点数·双方同副；强弱来自经营 buff，非泵 favor）+ 胜负方向 + live buff 杠杆。
const preboard = (side: 'a' | 'b', buff: number): DeployCmd[] =>
  standardArmy(side, 0).map((c) => ({ tick: 1, side, lane: c.lane, unit: { id: c.id, rank: c.rank, suit: c.suit, general: c.general, buff } }));
const fresh = (seed: number): ReturnType<typeof initLiveBattle> => initLiveBattle(seed, HOME_HP);

describe('Game G · live-combat（doc18/19 · 逐拍 live · pairwise clash-resolve）', () => {
  it('确定性：同 seed + 同投放流 → 逐拍 liveHash 一致、收敛出胜负（outcome-first 不破）', () => {
    const d = [...preboard('a', 2), ...preboard('b', 0)];
    const b1 = fresh(7), b2 = fresh(7);
    for (let i = 0; i < 2000 && b1.winner === 'pending'; i++) {
      stepLiveBattle(b1, d);
      stepLiveBattle(b2, d);
      expect(liveHash(b1)).toBe(liveHash(b2));
    }
    expect(b1.winner).not.toBe('pending');
    expect(b1.winner).toBe(b2.winner);
  });

  it('公平骨架 · 胜负方向：经营 buff 强者攻克敌老家 → 胜；反向 → 负（base 点数双方同副、不靠泵 favor）', () => {
    const settle = (aBuff: number, bBuff: number, seed: number): string => {
      const b = fresh(seed);
      runLiveBattle(b, [...preboard('a', aBuff), ...preboard('b', bBuff)]);
      return b.winner;
    };
    expect(settle(12, 0, 7)).toBe('a');
    expect(settle(0, 12, 7)).toBe('b');
  });

  it('live buff 杠杆：中路投高 buff 强援 → 该路更稳、我家受创不更多（以少胜多基底；遭遇拍读当下 P_eff）', () => {
    const base = [...preboard('a', 0), ...preboard('b', 4)]; // 敌经营略强
    const reinforce: DeployCmd[] = [0, 1, 2].map((i) => ({ tick: 1, side: 'a', lane: 1, unit: { id: `a_re${i}`, rank: 'K', suit: 'S', general: false, buff: 14 } }));
    const homeAfter = (extra: DeployCmd[]): number => { const b = fresh(11); runLiveBattle(b, [...base, ...extra]); return b.homeA; };
    expect(homeAfter(reinforce)).toBeGreaterThanOrEqual(homeAfter([]));
  });

  it('终止性：投放流跑到底必出胜负、不死循环（< maxTicks）', () => {
    const b = fresh(3);
    runLiveBattle(b, [...preboard('a', 0), ...preboard('b', 0)]);
    expect(['a', 'b', 'draw']).toContain(b.winner);
    expect(b.tick).toBeLessThan(4000);
  });
});
