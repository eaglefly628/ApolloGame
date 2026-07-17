import { describe, it, expect } from 'vitest';
import { HoldemSession, handStrength } from './game-session.js';
import { CLOTHING_ITEMS, WARDROBE_TOTAL } from './wardrobe.js';
import type { Card } from '@engine/protocol/components.js';

const H = (suit: number, rank: number): Card => ({ suit, rank });
const START = 1000;
const SIX_START = 6 * START;

/** 全局筹码守恒不变式：手内在 hand.players(stack+total)、不在手的家在 session.stack。 */
function totalChips(s: HoldemSession): number {
  if (!s.hand) return s.seats.reduce((a, x) => a + x.stack, 0);
  const inHand = new Set(s.hand.players.map((p) => p.seat));
  const handSum = s.hand.players.reduce((a, p) => a + p.stack + p.total, 0);
  const rest = s.seats.filter((x) => !inHand.has(x.seat)).reduce((a, x) => a + x.stack, 0);
  return handSum + rest;
}
function pawnedValue(s: HoldemSession): number {
  let v = 0;
  for (const seat of s.seats) for (const id of seat.pawned) v += CLOTHING_ITEMS.find((c) => c.id === id)!.value;
  return v;
}

describe('game-c game-session — 开局与推进', () => {
  it('构造即开第一手：发牌/公共牌/轮转就绪', () => {
    const s = new HoldemSession(20260717);
    expect(s.handNo).toBe(1);
    expect(s.deal).toBeTruthy();
    expect(s.hero.stack).toBeGreaterThan(0);
    expect(s.holeOf(0)).toHaveLength(2); // 主角底牌
    // AI 已自动推进到主角行动 或 已摊牌
    expect(s.isHeroTurn || s.phase === 'showdown').toBe(true);
  });

  it('筹码守恒：开局 Σ栈+投入 = 6000（无典当）', () => {
    const s = new HoldemSession(20260717);
    expect(totalChips(s)).toBe(SIX_START + pawnedValue(s));
  });
});

describe('game-c game-session — 完整一手到摊牌（牌逻辑跑通）', () => {
  it('主角跟到摊牌 → 有赢家 + 分池守恒', () => {
    const s = new HoldemSession(42);
    let guard = 0;
    while (s.phase === 'betting' && guard++ < 50) {
      const la = s.legalForHero();
      if (!la) break;
      s.heroAct(la.check ? { kind: 'check' } : { kind: 'call' }); // 主角一路过/跟
    }
    expect(s.phase).toBe('showdown');
    expect(s.showdown).toBeTruthy();
    expect(s.showdown!.winners.length).toBeGreaterThanOrEqual(1);
    // 分池守恒：赢得总额 = 底池
    const won = s.showdown!.rows.reduce((a, r) => a + r.won, 0);
    expect(won).toBe(s.showdown!.potTotal);
    expect(totalChips(s)).toBe(SIX_START + pawnedValue(s)); // 结算后守恒
  });

  it('摊牌行含牌型 + 赢家成牌 5 张', () => {
    const s = new HoldemSession(42);
    let guard = 0;
    while (s.phase === 'betting' && guard++ < 50) { const la = s.legalForHero(); if (!la) break; s.heroAct(la.check ? { kind: 'check' } : { kind: 'call' }); }
    const champ = s.showdown!.rows.find((r) => s.showdown!.winners.includes(r.seat))!;
    expect(champ.type).toBeTruthy();
    if (champ.best.length) expect(champ.best).toHaveLength(5); // 非全弃收池
  });
});

describe('game-c game-session — 玩到局终（多手循环不崩）', () => {
  it('主角一路弃牌 → 筹码/衣物耗尽 → 局终判负（终止·守恒）', () => {
    const s = new HoldemSession(20260717);
    let guard = 0;
    while (s.phase !== 'gameover' && guard++ < 2000) {
      if (s.isHeroTurn) {
        const la = s.legalForHero()!;
        s.heroAct(la.check ? { kind: 'check' } : { kind: 'fold' }); // 免费过牌、面注即弃
      } else if (s.phase === 'showdown') {
        expect(totalChips(s)).toBe(SIX_START + pawnedValue(s)); // 每次摊牌后守恒
        s.nextHand();
      } else break; // AI 应已自动推进（不该到这）
    }
    expect(s.phase).toBe('gameover');
    expect(s.winnerSide).not.toBeNull();
    expect(guard).toBeLessThan(2000); // 确实终止（非死循环）
  });

  it('确定性：同 seed + 同主角行动序列 → 同结果', () => {
    const play = (): { hands: number; side: string | null; heroChips: number } => {
      const s = new HoldemSession(777);
      let g = 0;
      while (s.phase !== 'gameover' && g++ < 2000) {
        if (s.isHeroTurn) { const la = s.legalForHero()!; s.heroAct(la.check ? { kind: 'check' } : { kind: 'fold' }); }
        else if (s.phase === 'showdown') s.nextHand();
        else break;
      }
      return { hands: s.handNo, side: s.winnerSide, heroChips: s.hero.stack };
    };
    expect(play()).toEqual(play());
  });
});

describe('game-c game-session — 典当续命', () => {
  it('pawn 扣衣加筹（面值）·重复典当无效', () => {
    const s = new HoldemSession(20260717);
    const before = s.seats[1].stack;
    expect(s.pawn(1, 'lingerie')).toBe(true);
    expect(s.seats[1].stack).toBe(before + 1000);
    expect(s.pawn(1, 'lingerie')).toBe(false); // 已当
    expect(s.wardrobeLeft(1)).toBe(CLOTHING_ITEMS.length - 1);
  });

  it('全套典当上限 = 衣物总值 2450', () => {
    const s = new HoldemSession(1);
    for (const c of CLOTHING_ITEMS) s.pawn(3, c.id);
    expect(s.wardrobeLeft(3)).toBe(0);
    expect([...s.seats[3].pawned].reduce((a, id) => a + CLOTHING_ITEMS.find((c) => c.id === id)!.value, 0)).toBe(WARDROBE_TOTAL);
  });
});

describe('game-c game-session — AI 手力（不作弊·占位策略）', () => {
  it('翻前：对子 > 两高张 > 弱散张', () => {
    const pair = handStrength([H(0, 14), H(1, 14)], []);
    const highs = handStrength([H(0, 14), H(1, 13)], []);
    const weak = handStrength([H(0, 7), H(1, 2)], []);
    expect(pair).toBeGreaterThan(highs);
    expect(highs).toBeGreaterThan(weak);
  });

  it('翻后：成牌越强手力越高（同花顺 > 高牌）', () => {
    const board = [H(0, 5), H(0, 9), H(1, 2)];
    const sf = handStrength([H(0, 6), H(0, 7)], [H(0, 5), H(0, 8), H(0, 9)]); // 同花顺听/成
    const hc = handStrength([H(2, 3), H(3, 2)], board); // 高牌
    expect(sf).toBeGreaterThan(hc);
  });
});
