import { describe, it, expect } from 'vitest';
import type { Card } from '@engine/protocol/components.js';
import {
  HOLDEM_TYPE_ORDER, rank5, bestOf7, holdemRank, compareRank,
  buildDeck, dealHoldem, cardToCode, codeToCard,
} from './holdem-eval.js';

// 牌面速记：'AS KH TD 2C' → Card[]（点 23456789TJQKA·花 S♠0 H♥1 D♦2 C♣3）。
const RANKS: Record<string, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };
const SUITS: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
const H = (s: string): Card[] => s.trim().split(/\s+/).map((t) => ({ suit: SUITS[t[1]], rank: RANKS[t[0]] }));

describe('game-c holdem-eval — 牌型全序（kicker 全深度）', () => {
  it('九型强弱链（与引擎 evaluateHand 判型一致的德州序）', () => {
    const ladder = [
      H('AS KH QD JC 9S'), // high-card
      H('AS AH QD JC 9S'), // pair
      H('AS AH QD QC 9S'), // two-pair
      H('AS AH AD QC 9S'), // three-of-a-kind
      H('5S 6H 7D 8C 9S'), // straight
      H('AS KS QS JS 9S'), // flush
      H('AS AH AD 9C 9S'), // full-house
      H('AS AH AD AC 9S'), // four-of-a-kind
      H('5S 6S 7S 8S 9S'), // straight-flush
    ];
    for (let i = 1; i < ladder.length; i++) {
      expect(compareRank(rank5(ladder[i]), rank5(ladder[i - 1]))).toBeGreaterThan(0);
    }
    expect(HOLDEM_TYPE_ORDER).toHaveLength(9);
  });

  it('四条比踢脚', () => {
    expect(compareRank(rank5(H('AS AH AD AC KS')), rank5(H('AS AH AD AC QS')))).toBeGreaterThan(0);
  });

  it('葫芦先比三条再比对', () => {
    expect(compareRank(rank5(H('KS KH KD 2C 2S')), rank5(H('QS QH QD AC AS')))).toBeGreaterThan(0);
    expect(compareRank(rank5(H('KS KH KD 3C 3S')), rank5(H('KS KH KD 2C 2S')))).toBeGreaterThan(0);
  });

  it('同花逐张比到第 5 张', () => {
    expect(compareRank(rank5(H('AS KS 9S 7S 3S')), rank5(H('AH KH 9H 7H 2H')))).toBeGreaterThan(0);
    expect(compareRank(rank5(H('AS KS 9S 7S 3S')), rank5(H('AH KH 9H 7H 3H')))).toBe(0); // 花色无大小
  });

  it('顺子按最高张；A 低轮子=5 高（最小顺）', () => {
    const wheel = rank5(H('AS 2H 3D 4C 5S'));
    const six = rank5(H('2S 3H 4D 5C 6S'));
    const broadway = rank5(H('TS JH QD KC AS'));
    expect(compareRank(six, wheel)).toBeGreaterThan(0);
    expect(compareRank(broadway, six)).toBeGreaterThan(0);
    expect(wheel[1]).toBe(5);
  });

  it('两对：高对→低对→踢脚 三层决胜', () => {
    expect(compareRank(rank5(H('AS AH 3D 3C KS')), rank5(H('KS KH QD QC AS')))).toBeGreaterThan(0);
    expect(compareRank(rank5(H('AS AH 3D 3C QS')), rank5(H('AS AH 2D 2C KS')))).toBeGreaterThan(0);
    expect(compareRank(rank5(H('AS AH 3D 3C KS')), rank5(H('AS AH 3D 3C QS')))).toBeGreaterThan(0);
  });

  it('对子踢脚三深；高牌五深', () => {
    expect(compareRank(rank5(H('8S 8H AD QC 3S')), rank5(H('8S 8H AD JC 9S')))).toBeGreaterThan(0);
    expect(compareRank(rank5(H('AS KH QD 9C 7S')), rank5(H('AS KH QD 9C 6S')))).toBeGreaterThan(0);
  });

  it('同花顺 > 四条（跨型压制）', () => {
    expect(compareRank(rank5(H('5S 6S 7S 8S 9S')), rank5(H('AS AH AD AC KS')))).toBeGreaterThan(0);
  });
});

describe('game-c holdem-eval — 7 选 5 最优', () => {
  it('公共牌四条+踢脚：踢脚取 7 张里最大（底牌不够大=打公共牌）', () => {
    const a = holdemRank(H('2C 3D'), H('AS AH AD AC KS'));
    const b = holdemRank(H('QC JD'), H('AS AH AD AC KS'));
    expect(compareRank(a.value, b.value)).toBe(0); // 双方最优都是 AAAA+K（board plays）→ 平分
  });

  it('口袋对入两对：AAKK9 压 AA99K（第二对更大）', () => {
    const r = holdemRank(H('9S 9H'), H('AS AH KD KC 2S'));
    expect(r.value[0]).toBe(HOLDEM_TYPE_ORDER.indexOf('two-pair'));
    expect(r.value.slice(1, 4)).toEqual([14, 13, 9]); // 高对A·低对K·踢脚9（口袋9只当踢脚）
  });

  it('七张同花取最大 5 张', () => {
    const r = holdemRank(H('2S 3S'), H('AS KS QS JS 9H'));
    expect(r.value[0]).toBe(HOLDEM_TYPE_ORDER.indexOf('flush'));
    expect(r.value.slice(1)).toEqual([14, 13, 12, 11, 3]);
  });

  it('底牌 A 参与轮子', () => {
    const r = holdemRank(H('AD 2C'), H('3S 4H 5D KS QH'));
    expect(r.value[0]).toBe(HOLDEM_TYPE_ORDER.indexOf('straight'));
    expect(r.value[1]).toBe(5);
  });

  it('同花顺压四条（7 张同池对抗）', () => {
    const sf = holdemRank(H('6S 7S'), H('8S 9S TS TH TD'));
    const quad = holdemRank(H('TC 2C'), H('8S 9S TS TH TD'));
    expect(sf.value[0]).toBe(HOLDEM_TYPE_ORDER.indexOf('straight-flush'));
    expect(quad.value[0]).toBe(HOLDEM_TYPE_ORDER.indexOf('four-of-a-kind'));
    expect(compareRank(sf.value, quad.value)).toBeGreaterThan(0);
  });

  it('best 返回构成最优的 5 张（点降序）', () => {
    const { best } = holdemRank(H('9S 9H'), H('AS AH KD KC 2S'));
    expect(best.map((c) => c.rank)).toEqual([14, 14, 13, 13, 9]);
  });

  it('张数校验：非 2+5 / 非 5..7 抛错', () => {
    expect(() => holdemRank(H('AS'), H('2S 3S 4S 5S 6S'))).toThrow();
    expect(() => bestOf7(H('AS KS QS JS'))).toThrow();
    expect(() => rank5(H('AS KS QS JS'))).toThrow();
  });
});

describe('game-c holdem-eval — 发牌流（引擎 seededShuffle 积木·确定性）', () => {
  it('基准牌序 52 张无重（牌码=card-pile 契约 suit*100+rank）', () => {
    const deck = buildDeck();
    const codes = new Set(deck.map(cardToCode));
    expect(deck).toHaveLength(52);
    expect(codes.size).toBe(52);
    expect(codeToCard(cardToCode({ suit: 3, rank: 14 }))).toEqual({ suit: 3, rank: 14 });
  });

  it('同 seed 逐张复现；异 seed 不同局', () => {
    const a = dealHoldem(20260717, 6);
    const b = dealHoldem(20260717, 6);
    const c = dealHoldem(20260718, 6);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('六席 17 张全场无重', () => {
    const { holes, board } = dealHoldem(42, 6);
    const all = [...holes.flat(), ...board].map(cardToCode);
    expect(holes).toHaveLength(6);
    expect(all).toHaveLength(17);
    expect(new Set(all).size).toBe(17);
  });

  it('烧牌开关只位移公共牌（底牌不变·仪式感开关不改公平）', () => {
    const plain = dealHoldem(7, 6);
    const burned = dealHoldem(7, 6, { burn: true });
    expect(burned.holes).toEqual(plain.holes);
    expect(burned.board).not.toEqual(plain.board);
  });
});
