// 牌组构筑数据层（契约 A/B + 乙3 自动构筑）·纯函数单测。
// 守护：放牌费用 4 档（doc14 §九）/ 52 池 id↔索引一致 / 一键自动构筑确定性 + 费用曲线铺开 + 偏好已拥有。
import { describe, it, expect } from 'vitest';
import { POKER_PICK_SIZE, POOL_CARD_IDS, isPoolCardId, cardFavorIndex, deployCost, rankOfCardId, autoBuildPokerPicks, dizhiMerge, dizhiTotal, dizhiTopTier, inlayBonus, effectiveDeckFavors, DIZHI_INLAY_FAVOR, type InlayEntry } from './blueprint.js';

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

// 地支消耗品 + 附魔（owner 2026-06-21）：卡包按档计数·满3自动升档·镶入消耗一张·52 牌 1:1 favor 单一真相。
describe('Game G · 地支消耗品 + 附魔数据层', () => {
  it('三合升档 dizhiMerge：满 3 同档 → 1 高档（铜→银→金·封顶金·钻待开放）', () => {
    expect(dizhiMerge([3, 0, 0])).toEqual([0, 1, 0]); // 3铜→1银
    expect(dizhiMerge([2, 0, 0])).toEqual([2, 0, 0]); // 不足3不并
    expect(dizhiMerge([9, 0, 0])).toEqual([0, 0, 1]); // 9铜→3银→1金（连锁）
    expect(dizhiMerge([3, 3, 0])).toEqual([0, 1, 1]); // 链式：3铜→1银（共4银）→3银并1金、余1银
    expect(dizhiMerge([2, 2, 5])).toEqual([2, 2, 5]); // 金不再升（钻待开放·封顶）
  });
  it('卡包计数 dizhiTotal / 最高档 dizhiTopTier', () => {
    expect(dizhiTotal([2, 1, 0])).toBe(3);
    expect(dizhiTotal(undefined)).toBe(0);
    expect(dizhiTopTier([2, 0, 0])).toBe(1); // 铜
    expect(dizhiTopTier([2, 1, 0])).toBe(2); // 最高银
    expect(dizhiTopTier([0, 0, 0])).toBe(0); // 空
  });
  it('附魔加成 inlayBonus：按各条目锁定档位累加（铜/银/金）', () => {
    const entries: InlayEntry[] = [{ b: '子', t: 1 }, { b: '丑', t: 3 }];
    expect(inlayBonus(entries)).toBe(DIZHI_INLAY_FAVOR[1] + DIZHI_INLAY_FAVOR[3]); // 4+14
    expect(inlayBonus([])).toBe(0);
    expect(inlayBonus(undefined)).toBe(0);
  });
  it('52 牌 1:1 单一真相：effectiveDeckFavors 只按牌位索引叠加镶嵌·不串位·档位锁定不随后续变', () => {
    const deck = Array.from({ length: 52 }, () => 50);
    const inlays: Record<string, InlayEntry[]> = { '0': [{ b: '子', t: 3 }], '51': [{ b: '丑', t: 1 }] };
    const eff = effectiveDeckFavors(deck, inlays);
    expect(eff[0]).toBe(50 + DIZHI_INLAY_FAVOR[3]); // 牌位0(♠A) +金
    expect(eff[51]).toBe(50 + DIZHI_INLAY_FAVOR[1]); // 牌位51(♣2) +铜
    expect(eff[1]).toBe(50); // 未镶牌位不受影响（不串位）
    expect(eff.length).toBe(52); // 始终 52 张
    // 档位锁定：favor 只看 inlays 里存的 t，不依赖任何"当前拥有档位"——改组/战局读同一份即一致。
    expect(effectiveDeckFavors(deck, undefined)).toEqual(deck); // 无镶嵌 = 原样
  });
});
