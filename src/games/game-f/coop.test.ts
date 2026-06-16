import { describe, it, expect } from 'vitest';
import { computeCoopIsland, distributeBossLoot, COOP_GOAL_PER_OWNER, type OwnerContribution } from './coop.js';

const O = (name: string, contribution: number): OwnerContribution => ({ name, faction: '蜀', human: false, contribution });

describe('多人 B·slice1 · 共享岛协作核（computeCoopIsland）', () => {
  it('三方贡献累加 = 岛进度；阈值 = owner 数 × 每人目标', () => {
    const r = computeCoopIsland([O('a', 30), O('b', 20), O('c', 10)]);
    expect(r.progress).toBe(60);
    expect(r.goal).toBe(3 * COOP_GOAL_PER_OWNER);
    expect(r.fallen).toBe(false);
  });
  it('满阈值 → 岛陷落', () => {
    expect(computeCoopIsland([O('a', 150), O('b', 150), O('c', 0)]).fallen).toBe(true); // 300≥300
  });
  it('排名降序 + 岛主=最高贡献；等值稳定保序', () => {
    const r = computeCoopIsland([O('玄德', 10), O('仲谋', 50), O('孟德', 50)]);
    expect(r.ranking.map((o) => o.name)).toEqual(['仲谋', '孟德', '玄德']); // 50,50(稳定),10
    expect(r.owner).toBe('仲谋');
  });
  it('负贡献钳 0，不拉低岛进度', () => {
    expect(computeCoopIsland([O('a', -5), O('b', 40)]).progress).toBe(40);
  });
});

describe('多人 B·slice2 · Boss 宝箱掷点分卡（distributeBossLoot）', () => {
  const pool = [{ id: 'x', name: 'x', weight: 1 }];
  it('按贡献轮选：排名第一先挑，份额随名次（3卡: 高2/低1）', () => {
    const shares = distributeBossLoot([O('low', 10), O('high', 90)], 3, pool, () => 0);
    expect(shares[0].name).toBe('high'); // 贡献最高排第一
    expect(shares.find((s) => s.name === 'high')!.cards.length).toBe(2);
    expect(shares.find((s) => s.name === 'low')!.cards.length).toBe(1);
  });
  it('lootCount=0 或空池 → 各 0 张', () => {
    expect(distributeBossLoot([O('a', 1)], 0, pool, () => 0)[0].cards.length).toBe(0);
    expect(distributeBossLoot([O('a', 1)], 3, [], () => 0)[0].cards.length).toBe(0);
  });
});
