import { describe, it, expect } from 'vitest';
import { standardArmy, HOME_HP } from './index.js';
import { initLiveBattle, stepLiveBattle, runLiveBattle, liveHash, type DeployCmd } from './live-combat.js';

// doc 18 · 3D-2 live 遭遇解析器：验证 live 化后 outcome-first 不破（确定性逐拍 hash 稳）+ 胜负方向 + live favor 杠杆。
const preboard = (side: 'a' | 'b', bias: number): DeployCmd[] =>
  standardArmy(side, bias).map((c) => ({ tick: 1, side, lane: c.lane, unit: { id: c.id, rank: c.rank, suit: c.suit, favor: c.favor, general: c.general } }));
const fresh = (seed: number): ReturnType<typeof initLiveBattle> => initLiveBattle(seed, HOME_HP);

describe('Game G · live-combat（doc 18 核心博弈 · 逐拍 live 解析器）', () => {
  it('确定性：同 seed + 同投放指令流 → 逐拍 liveHash 一致、收敛出胜负（outcome-first 不破）', () => {
    const d = [...preboard('a', 6), ...preboard('b', -4)];
    const b1 = fresh(7), b2 = fresh(7);
    for (let i = 0; i < 2000 && b1.winner === 'pending'; i++) {
      stepLiveBattle(b1, d);
      stepLiveBattle(b2, d);
      expect(liveHash(b1)).toBe(liveHash(b2)); // 逐拍指纹一致
    }
    expect(b1.winner).not.toBe('pending'); // 收敛
    expect(b1.winner).toBe(b2.winner);
  });

  it('胜负方向：压倒性强军攻克敌老家 → 胜；反向 → 负', () => {
    const settle = (aBias: number, bBias: number, seed: number): string => {
      const b = fresh(seed);
      runLiveBattle(b, [...preboard('a', aBias), ...preboard('b', bBias)]);
      return b.winner;
    };
    expect(settle(30, -30, 7)).toBe('a');
    expect(settle(-30, 30, 7)).toBe('b');
  });

  it('live favor 杠杆：中路投强援 → 该路更稳、我家受创不更多（以少胜多基底；遭遇拍读当下 favor）', () => {
    const base = [...preboard('a', -6), ...preboard('b', 6)];
    const reinforce: DeployCmd[] = [0, 1, 2].map((i) => ({ tick: 1, side: 'a', lane: 1, unit: { id: `a_re${i}`, rank: 'K', suit: 'S', favor: 92, general: false } }));
    const homeAfter = (extra: DeployCmd[]): number => { const b = fresh(11); runLiveBattle(b, [...base, ...extra]); return b.homeA; };
    expect(homeAfter(reinforce)).toBeGreaterThanOrEqual(homeAfter([])); // 强援 → 中路不被清空 → 我老家不更惨
  });

  it('终止性：投放流跑到底必出胜负、不死循环（< maxTicks）', () => {
    const b = fresh(3);
    runLiveBattle(b, [...preboard('a', 0), ...preboard('b', 0)]);
    expect(['a', 'b', 'draw']).toContain(b.winner);
    expect(b.tick).toBeLessThan(4000);
  });
});
