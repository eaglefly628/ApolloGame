// 牌组构筑数据层（契约 A/B + 乙3 自动构筑）·纯函数单测。
// 守护：放牌费用 4 档（doc14 §九）/ 52 池 id↔索引一致 / 一键自动构筑确定性 + 费用曲线铺开 + 偏好已拥有。
import { describe, it, expect } from 'vitest';
import { POKER_PICK_SIZE, POOL_CARD_IDS, isPoolCardId, cardFavorIndex, deployCost, rankOfCardId, autoBuildPokerPicks } from './blueprint.js';

describe('Game G · 牌组构筑数据层（DEV-CHECKLIST 契约 A/B + 乙3）', () => {
  it('放牌费用 4 档（点 2-4=0 / 5-7=1 / 8-10=2 / J Q K A=3）', () => {
    for (const r of ['2', '3', '4']) expect(deployCost(r)).toBe(0);
    for (const r of ['5', '6', '7']) expect(deployCost(r)).toBe(1);
    for (const r of ['8', '9', '10']) expect(deployCost(r)).toBe(2);
    for (const r of ['J', 'Q', 'K', 'A']) expect(deployCost(r)).toBe(3);
    expect(deployCost('★')).toBe(3); // 未知（JOKER/★）按最高档
  });

  it('52 收藏池：id 唯一·52 张·index 即 favor 索引（suit*13+rank·与大厅同序）', () => {
    expect(POOL_CARD_IDS).toHaveLength(52);
    expect(new Set(POOL_CARD_IDS).size).toBe(52);
    expect(POOL_CARD_IDS[0]).toBe('AS'); // ♠ A = index 0
    expect(POOL_CARD_IDS[13]).toBe('AH'); // ♥ A = index 13
    expect(POOL_CARD_IDS[51]).toBe('2C'); // ♣ 2 = index 51
    expect(cardFavorIndex('AS')).toBe(0);
    expect(cardFavorIndex('2C')).toBe(51);
    expect(cardFavorIndex('zz')).toBe(-1); // 非法
    expect(isPoolCardId('10D')).toBe(true);
    expect(isPoolCardId('XX')).toBe(false);
    expect(rankOfCardId('10D')).toBe('10');
    expect(rankOfCardId('AS')).toBe('A');
  });

  it('一键自动构筑：恰 16 张·合法·不重复·确定性（同输入恒同输出）', () => {
    expect(POKER_PICK_SIZE).toBe(16); // owner 2026-06-21：13→16
    const favors = Array.from({ length: 52 }, (_, i) => 40 + (i % 20));
    const isOwned = (id: string): boolean => cardFavorIndex(id) % 3 === 0;
    const a = autoBuildPokerPicks({ favors, isOwned });
    const b = autoBuildPokerPicks({ favors, isOwned });
    expect(a).toHaveLength(POKER_PICK_SIZE);
    expect(a).toEqual(b); // 确定性
    expect(new Set(a).size).toBe(a.length); // 不重复
    for (const id of a) expect(isPoolCardId(id)).toBe(true); // 合法卡
  });

  it('一键自动构筑：费用曲线铺开（每档都有·不全大点·目标 [4,4,4,4]）', () => {
    const favors = Array.from({ length: 52 }, () => 50);
    const picks = autoBuildPokerPicks({ favors, isOwned: () => false });
    const byTier = [0, 0, 0, 0];
    for (const id of picks) byTier[deployCost(rankOfCardId(id))]++;
    expect(byTier).toEqual([4, 4, 4, 4]); // 均匀分布·非全 3 费
    expect(byTier[0]).toBeGreaterThan(0); // 有低费
    expect(byTier[3]).toBeLessThan(picks.length); // 不全大点
  });

  it('一键自动构筑：偏好已拥有（同档已拥有优先入选）', () => {
    const favors = Array.from({ length: 52 }, () => 50); // favor 全等 → owned 成唯一区分
    const ownAS = autoBuildPokerPicks({ favors, isOwned: (id) => id === 'AS' });
    expect(ownAS).toContain('AS'); // 已拥有的 A♠（3 费档）被优先选入
  });
});
