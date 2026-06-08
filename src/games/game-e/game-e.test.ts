import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import type { Resource, PlayedHand, Flag, Card, StringVar } from '@engine/protocol/components.js';
import {
  buildGameEBlueprint,
  card,
  toEngineCard,
  R_CHIPS,
  R_MULT,
  V_HAND_TYPE,
} from './blueprint.js';
import { STANDARD_DECK } from './deck.js';

// 真引擎整合：证明「数据 + 真能力」涌现出 Balatro 计分链，无游戏 system 代码。
//   poker-eval(REQ-011) 判牌型给基础分 → effect-apply(REQ-012) 按 order 有序加乘小丑。

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

describe('game-e · 真引擎计分链', () => {
  it('出同花：poker-eval 给基础分(35/4)，小丑 +50chips / +4mult / ×3mult 有序结算', () => {
    const e = boot();
    // 5 张红桃、点数相异且非顺：flush（base chips 35, mult 4）。
    play(e, [card(1, 2), card(1, 5), card(1, 7), card(1, 9), card(1, 11)]);
    tick(e, 5);
    expect(handType(e)).toBe('flush');
    // chips: 35 +50 = 85
    expect(res(e, R_CHIPS)).toBe(85);
    // mult: (4 +4) ×3 = 24（Jolly 不触发：同花不含对子）
    expect(res(e, R_MULT)).toBe(24);
  });

  it('出对子：Jolly(含对子+8) 触发，先加后乘 → (2+4+8)×3=42', () => {
    const e = boot();
    // K,K + 2,5,9：一对 K。
    play(e, [card(0, 13), card(3, 13), card(0, 2), card(1, 5), card(2, 9)]);
    tick(e, 5);
    expect(handType(e)).toBe('pair');
    expect(res(e, R_CHIPS)).toBe(60); // 10 +50
    expect(res(e, R_MULT)).toBe(42); // (2 +4 +8) ×3
  });

  it('order 决定结果：若先乘后加则为 (2×3)+4+8=18 ≠ 42 → 证明有序结算生效', () => {
    const e = boot();
    play(e, [card(0, 13), card(3, 13), card(0, 2), card(1, 5), card(2, 9)]);
    tick(e, 5);
    expect(res(e, R_MULT)).toBe(42);
    expect(res(e, R_MULT)).not.toBe(18);
  });

  it('未出牌（scoring=false）：基础分设了但小丑不结算', () => {
    const e = boot();
    // 三条：base three-of-a-kind {chips:30, mult:3}。scoring=false → 不发 score 信号。
    play(e, [card(0, 7), card(1, 7), card(2, 7), card(0, 2), card(3, 9)], false);
    tick(e, 3);
    expect(handType(e)).toBe('three-of-a-kind');
    expect(res(e, R_CHIPS)).toBe(30); // 仅基础，无 +50
    expect(res(e, R_MULT)).toBe(3); // 仅基础，无加乘
  });

  it('toEngineCard：数据牌组(字符串花色点数) → 引擎牌，能被评估为同花顺', () => {
    const e = boot();
    // 从标准牌组取黑桃 10/J/Q/K/A → 皇家同花顺(straight-flush)。
    const want = ['10', 'J', 'Q', 'K', 'A'];
    const cards = STANDARD_DECK.filter((c) => c.suit === 'spades' && want.includes(c.rank)).map(toEngineCard);
    expect(cards.length).toBe(5);
    play(e, cards);
    tick(e, 5);
    expect(handType(e)).toBe('straight-flush');
    expect(res(e, R_CHIPS)).toBe(150); // 100 +50
    expect(res(e, R_MULT)).toBe(36); // (8 +4) ×3
  });
});
