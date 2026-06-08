import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Card, PlayedHand, PokerHand, PerCardScore, PerCardRule, PerCardRetrigger, Resource } from '@engine/protocol/components.js';
import { cardScoringCapability, matchPerCardWhen } from './card-scoring.js';
import { pokerHandCapability } from './poker-hand.js';

// 牌速记：c(suit, rank)。点数 A=14, K=13, Q=12, J=11；花色 0..3（♠♥♦♣）。
const c = (suit: number, rank: number): Card => ({ suit, rank });
const A = 14, K = 13, Q = 12, J = 11;
const DIAMONDS = 2, HEARTS = 1;
// Balatro 标准每牌基础筹码：2..10=点值，J/Q/K=10，A=11。纯数据，引擎不写死。
const BASE_CHIPS: Record<string, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, '11': 10, '12': 10, '13': 10, '14': 11 };

// ── 纯逻辑：matchPerCardWhen 谓词 ────────────────────────────────
describe('card-scoring — matchPerCardWhen 谓词求值', () => {
  it('always 永真', () => expect(matchPerCardWhen({ kind: 'always' }, c(0, 5), 0)).toBe(true));
  it('suit 命中花色', () => {
    expect(matchPerCardWhen({ kind: 'suit', suit: DIAMONDS }, c(DIAMONDS, 5), 3)).toBe(true);
    expect(matchPerCardWhen({ kind: 'suit', suit: DIAMONDS }, c(HEARTS, 5), 3)).toBe(false);
  });
  it('rankIn：人头 = [11,12,13]（A=14 不含）', () => {
    const face = { kind: 'rankIn' as const, ranks: [J, Q, K] };
    expect(matchPerCardWhen(face, c(0, K), 0)).toBe(true);
    expect(matchPerCardWhen(face, c(0, A), 0)).toBe(false);
    expect(matchPerCardWhen(face, c(0, 10), 0)).toBe(false);
  });
  it('rankIn：偶(Even Steven)=[2,4,6,8,10]，A 不算偶（rank14 不在表 → 数据正确表达 Balatro 语义）', () => {
    const even = { kind: 'rankIn' as const, ranks: [2, 4, 6, 8, 10] };
    expect(matchPerCardWhen(even, c(0, 10), 0)).toBe(true);
    expect(matchPerCardWhen(even, c(0, A), 0)).toBe(false); // A=14 不在偶表（虽 14%2==0，靠数据而非取模）
    expect(matchPerCardWhen(even, c(0, 7), 0)).toBe(false);
  });
  it('index 命中序号（首张=0）', () => {
    expect(matchPerCardWhen({ kind: 'index', eq: 0 }, c(0, 5), 0)).toBe(true);
    expect(matchPerCardWhen({ kind: 'index', eq: 0 }, c(0, 5), 1)).toBe(false);
  });
  it('and/or/not 布尔组合', () => {
    const w = { kind: 'and' as const, of: [{ kind: 'suit' as const, suit: DIAMONDS }, { kind: 'rankIn' as const, ranks: [J, Q, K] }] };
    expect(matchPerCardWhen(w, c(DIAMONDS, K), 0)).toBe(true); // ♦ 且 人头
    expect(matchPerCardWhen(w, c(DIAMONDS, 5), 0)).toBe(false);
    expect(matchPerCardWhen({ kind: 'or', of: [{ kind: 'suit', suit: DIAMONDS }, { kind: 'suit', suit: HEARTS }] }, c(HEARTS, 5), 0)).toBe(true);
    expect(matchPerCardWhen({ kind: 'not', of: { kind: 'suit', suit: DIAMONDS } }, c(HEARTS, 5), 0)).toBe(true);
  });
});

// ── 系统 card-score-pass：手搭 World 跑逐张 pass ──────────────────
interface SetupOpts {
  rules?: Array<{ id: string; rule: Omit<PerCardRule, 'type'> }>;
  retriggers?: Array<{ id: string; rt: Omit<PerCardRetrigger, 'type'> }>;
  max?: number;
}
function loadPass(cards: Card[], opts: SetupOpts = {}): World {
  const w = new World();
  for (const s of cardScoringCapability.systems) w.addSystem(s);
  w.createEntity('table');
  w.addComponent('table', { type: 'PerCardScore', chipsResource: 'chips', baseChipsByRank: BASE_CHIPS } as PerCardScore);
  w.addComponent('table', { type: 'PlayedHand', cards } as PlayedHand);
  const max = opts.max ?? 1_000_000;
  for (const id of ['chips', 'mult']) {
    w.createEntity(`res:${id}`);
    w.addComponent(`res:${id}`, { type: 'Resource', id, current: 0, min: 0, max } as Resource);
  }
  for (const { id, rule } of opts.rules ?? []) {
    w.createEntity(id);
    w.addComponent(id, { type: 'PerCardRule', ...rule } as PerCardRule);
  }
  for (const { id, rt } of opts.retriggers ?? []) {
    w.createEntity(id);
    w.addComponent(id, { type: 'PerCardRetrigger', ...rt } as PerCardRetrigger);
  }
  return w;
}
const res = (w: World, id: string): number => w.getComponent<Resource>(`res:${id}`, 'Resource')!.current;

describe('card-score-pass — 逐张 baseChips 累加', () => {
  it('5 张牌 baseChips 累加：2+5+7+9+(K=10)=33', () => {
    const w = loadPass([c(0, 2), c(0, 5), c(0, 7), c(0, 9), c(0, K)]);
    w.tick();
    expect(res(w, 'chips')).toBe(33);
  });
  it('A=11、人头=10：A+K+Q+J+10 = 11+10+10+10+10 = 51', () => {
    const w = loadPass([c(0, A), c(0, K), c(0, Q), c(0, J), c(0, 10)]);
    w.tick();
    expect(res(w, 'chips')).toBe(51);
  });
  it('空手牌 → 不结算（chips 保持原值）', () => {
    const w = loadPass([]);
    w.getComponent<Resource>('res:chips', 'Resource')!.current = 77;
    w.tick();
    expect(res(w, 'chips')).toBe(77);
  });
  it('幂等：重复 tick 不重复累加（每 tick 从 0 重算需上游 set；本测无上游 → 会累加，证明"add 语义"成立）', () => {
    // 注：本能力是 add；幂等由上游 poker-eval 每 tick set 基础分保证（见集成测）。此处单独 tick 一次验加法本身。
    const w = loadPass([c(0, 2), c(0, 3)]);
    w.tick();
    expect(res(w, 'chips')).toBe(5);
  });
});

describe('card-score-pass — 逐张小丑规则（PerCardRule）', () => {
  it('Greedy：每张♦ +3 mult（手里 3 张♦ → +9）', () => {
    const w = loadPass([c(DIAMONDS, 2), c(DIAMONDS, 5), c(DIAMONDS, 9), c(HEARTS, 7), c(0, K)], {
      rules: [{ id: 'greedy', rule: { when: { kind: 'suit', suit: DIAMONDS }, op: 'add', targetResource: 'mult', value: 3 } }],
    });
    w.tick();
    expect(res(w, 'mult')).toBe(9);
  });
  it('Scary Face：每张人头 +30 chips（叠加在 baseChips 上）', () => {
    const w = loadPass([c(0, K), c(0, Q), c(0, 5)], {
      rules: [{ id: 'scary', rule: { when: { kind: 'rankIn', ranks: [J, Q, K] }, op: 'add', targetResource: 'chips', value: 30 } }],
    });
    w.tick();
    // baseChips: K10+Q10+5 = 25；Scary: K,Q 两张人头 ×30 = 60 → 85
    expect(res(w, 'chips')).toBe(85);
  });
  it('Even Steven：每张偶(rankIn[2,4,6,8,10]) +4 mult', () => {
    const w = loadPass([c(0, 2), c(0, 4), c(0, 7), c(0, A)], {
      rules: [{ id: 'even', rule: { when: { kind: 'rankIn', ranks: [2, 4, 6, 8, 10] }, op: 'add', targetResource: 'mult', value: 4 } }],
    });
    w.tick();
    expect(res(w, 'mult')).toBe(8); // 2 张偶(2,4) ×4
  });
  it('钳上下限：mult 超 max 钳住', () => {
    const w = loadPass([c(DIAMONDS, 2), c(DIAMONDS, 5)], {
      rules: [{ id: 'greedy', rule: { when: { kind: 'suit', suit: DIAMONDS }, op: 'add', targetResource: 'mult', value: 3 } }],
      max: 5,
    });
    w.tick();
    expect(res(w, 'mult')).toBe(5); // 3+3=6 钳到 5
  });
});

describe('card-score-pass — retrigger（核心：聚合表达不了的乘性耦合）', () => {
  it('Hanging Chad：首张 +2 重触发 → 首张 baseChips 计 3 次', () => {
    const w = loadPass([c(0, 5), c(0, 7)], {
      retriggers: [{ id: 'chad', rt: { when: { kind: 'index', eq: 0 }, extra: 2 } }],
    });
    w.tick();
    // 首张5 ×3次 = 15；次张7 ×1 = 7 → 22
    expect(res(w, 'chips')).toBe(22);
  });
  it('★retrigger × 逐张小丑 乘性耦合：首张♦被 Greedy 命中，重触发 → +3 ×3 = +9（非 +3）', () => {
    const w = loadPass([c(DIAMONDS, 5), c(HEARTS, 7)], {
      rules: [{ id: 'greedy', rule: { when: { kind: 'suit', suit: DIAMONDS }, op: 'add', targetResource: 'mult', value: 3 } }],
      retriggers: [{ id: 'chad', rt: { when: { kind: 'index', eq: 0 }, extra: 2 } }],
    });
    w.tick();
    // 首张♦：Greedy 触发 1+2=3 次 → +9 mult。这正是 `count(♦)×3`=3 表达不了的（位置耦合）。
    expect(res(w, 'mult')).toBe(9);
  });
  it('retrigger 不命中的牌不重复（index!=0 的牌正常 1 次）', () => {
    const w = loadPass([c(0, 5), c(DIAMONDS, 9)], {
      rules: [{ id: 'greedy', rule: { when: { kind: 'suit', suit: DIAMONDS }, op: 'add', targetResource: 'mult', value: 3 } }],
      retriggers: [{ id: 'chad', rt: { when: { kind: 'index', eq: 0 }, extra: 2 } }],
    });
    w.tick();
    // ♦ 在 index1（非首张）→ Greedy 只 1 次 = +3
    expect(res(w, 'mult')).toBe(3);
  });
});

// ── 集成：poker-eval(set 牌型基础) + card-score-pass(add 逐张) 同 tick 幂等 ──
describe('card-score-pass + poker-eval 集成（幂等：多 tick 持平）', () => {
  function loadChain(cards: Card[]): World {
    const w = new World();
    for (const s of pokerHandCapability.systems) w.addSystem(s);
    for (const s of cardScoringCapability.systems) w.addSystem(s);
    w.createEntity('table');
    w.addComponent('table', {
      type: 'PokerHand', rankingTable: { 'flush': { chips: 35, mult: 4 } }, chipsResource: 'chips', multResource: 'mult',
    } as PokerHand);
    w.addComponent('table', { type: 'PerCardScore', chipsResource: 'chips', baseChipsByRank: BASE_CHIPS } as PerCardScore);
    w.addComponent('table', { type: 'PlayedHand', cards } as PlayedHand);
    for (const id of ['chips', 'mult']) {
      w.createEntity(`res:${id}`);
      w.addComponent(`res:${id}`, { type: 'Resource', id, current: 0, min: 0, max: 1_000_000 } as Resource);
    }
    return w;
  }
  it('同花 5 张：poker set chips=35 → 逐张 add baseChips → 35 + (2+5+7+9+K10)=33 → 68；多 tick 持平', () => {
    const w = loadChain([c(1, 2), c(1, 5), c(1, 7), c(1, 9), c(1, K)]);
    w.tick();
    expect(res(w, 'chips')).toBe(68); // 35 牌型基础 + 33 逐张
    expect(res(w, 'mult')).toBe(4); // 牌型基础 mult（无逐张 mult 小丑）
    w.tick();
    w.tick();
    expect(res(w, 'chips')).toBe(68); // ★幂等：poker-eval 每 tick 重 set 35，逐张重 add 33 → 持平不漂移
  });
});
