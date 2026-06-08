import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import type { Resource, PlayedHand, Flag, Card, StringVar } from '@engine/protocol/components.js';
import {
  buildGameEBlueprint,
  card,
  toEngineCard,
  R_CHIPS,
  R_MULT,
  R_MONEY,
  R_HAND_SCORE,
  V_HAND_TYPE,
} from './blueprint.js';
import { STANDARD_DECK } from './deck.js';

// 真引擎整合：证明「数据 + 真能力」涌现出 Balatro 完整一手计分，无游戏 system 代码。
//   poker-eval(REQ-011) 判牌型给基础分 → effect-apply(REQ-012) 按 order 有序加乘小丑
//   → REQ-013 valueFrom：Bull 每$1+2c（量纲动态值）+ hand_score=chips×mult（资源×资源）。

function boot() {
  const e = new Engine({ tickRate: 60 });
  e.load(buildGameEBlueprint());
  return e;
}

/** 装配层「出牌」：填 PlayedHand.cards + 置 scoring=true（模拟点「出牌」）。 */
function play(e: Engine, cards: Card[], scoring = true): void {
  e.world.getComponent<PlayedHand>('table', 'PlayedHand')!.cards = cards;
  e.world.getComponent<Flag>('scoring', 'Flag')!.active = scoring;
}

const res = (e: Engine, id: string): number => {
  for (const [eid] of e.world.query('Resource')) {
    const r = e.world.getComponent<Resource>(eid, 'Resource');
    if (r && r.id === id) return r.current;
  }
  throw new Error(`no resource ${id}`);
};
const setRes = (e: Engine, id: string, v: number): void => {
  for (const [eid] of e.world.query('Resource')) {
    const r = e.world.getComponent<Resource>(eid, 'Resource');
    if (r && r.id === id) { r.current = v; return; }
  }
};
const handType = (e: Engine): string => {
  for (const [eid] of e.world.query('StringVar')) {
    const v = e.world.getComponent<StringVar>(eid, 'StringVar');
    if (v && v.id === V_HAND_TYPE) return v.value;
  }
  return '';
};
const tick = (e: Engine, n: number): void => {
  for (let i = 0; i < n; i++) e.world.tick();
};

describe('game-e · 真引擎完整一手计分（REQ-011/012/013 全链）', () => {
  it('出同花：基础35/4 → +50c/Bull+8c、+4mult、×3 → 93×24=2232', () => {
    const e = boot();
    play(e, [card(1, 2), card(1, 5), card(1, 7), card(1, 9), card(1, 11)]);
    tick(e, 5);
    expect(handType(e)).toBe('flush');
    expect(res(e, R_CHIPS)).toBe(93); // 35 +50 +(money4×2=8)
    expect(res(e, R_MULT)).toBe(24); // (4 +4) ×3，Jolly 不触发
    expect(res(e, R_HAND_SCORE)).toBe(2232); // 93 × 24（REQ-013 资源×资源）
  });

  it('出对子：Jolly 触发，先加后乘 → 68×42=2856', () => {
    const e = boot();
    play(e, [card(0, 13), card(3, 13), card(0, 2), card(1, 5), card(2, 9)]);
    tick(e, 5);
    expect(handType(e)).toBe('pair');
    expect(res(e, R_CHIPS)).toBe(68); // 10 +50 +8
    expect(res(e, R_MULT)).toBe(42); // (2 +4 +8) ×3
    expect(res(e, R_HAND_SCORE)).toBe(2856);
  });

  it('order 决定结果：先乘后加会是 (2×3)+4+8=18 ≠ 42 → 有序结算生效', () => {
    const e = boot();
    play(e, [card(0, 13), card(3, 13), card(0, 2), card(1, 5), card(2, 9)]);
    tick(e, 5);
    expect(res(e, R_MULT)).toBe(42);
    expect(res(e, R_MULT)).not.toBe(18);
  });

  it('Bull 是量纲动态值：money 变 → chips 跟着变（REQ-013 coeff）', () => {
    const e = boot();
    setRes(e, R_MONEY, 10); // 改钱
    play(e, [card(1, 2), card(1, 5), card(1, 7), card(1, 9), card(1, 11)]); // flush
    tick(e, 5);
    expect(res(e, R_CHIPS)).toBe(105); // 35 +50 +(money10×2=20)
    expect(res(e, R_HAND_SCORE)).toBe(105 * 24);
  });

  it('未出牌（scoring=false）：基础分设了但小丑不结算、hand_score=0', () => {
    const e = boot();
    play(e, [card(0, 7), card(1, 7), card(2, 7), card(0, 2), card(3, 9)], false);
    tick(e, 3);
    expect(handType(e)).toBe('three-of-a-kind');
    expect(res(e, R_CHIPS)).toBe(30);
    expect(res(e, R_MULT)).toBe(3);
    expect(res(e, R_HAND_SCORE)).toBe(0);
  });

  it('toEngineCard：数据牌组黑桃 10/J/Q/K/A → 同花顺端到端', () => {
    const e = boot();
    const want = ['10', 'J', 'Q', 'K', 'A'];
    const cards = STANDARD_DECK.filter((c) => c.suit === 'spades' && want.includes(c.rank)).map(toEngineCard);
    expect(cards.length).toBe(5);
    play(e, cards);
    tick(e, 5);
    expect(handType(e)).toBe('straight-flush');
    expect(res(e, R_CHIPS)).toBe(158); // 100 +50 +8
    expect(res(e, R_MULT)).toBe(36); // (8 +4) ×3
    expect(res(e, R_HAND_SCORE)).toBe(5688);
  });
});
