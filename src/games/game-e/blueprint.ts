import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { Card } from '@engine/protocol/components.js';
import { resourceCapability, flagCapability, stringVariableCapability } from '@atom-skills/index.js';
import { eventWhenCapability, effectApplyCapability } from '@skills/tier2/index.js';
import { pokerHandCapability, cardScoringCapability } from '@skills/tier3/index.js';
import { HAND_RANKINGS, type HandType } from './hand-rankings.js';
import { RANK_ORDER, type Card as DataCard } from './deck.js';

// ════════════════════════════════════════════════════════════════════════
//  Game E · 计分链蓝图 —— 纯数据装配真能力，零游戏 system 代码。
//
//  一拍计分（同 tick）：
//    poker-eval(Update) 读 PlayedHand → 判牌型 → set 基础 chips/mult + 写 hand_type
//      → event-when(Update) 按 flag/hand_type 发信号(score / jolly_fire)
//      → effect-apply(Commit) 按 order 升序对 chips/mult 加/乘（小丑结算）
//
//  分工严守 manifesto：判牌型=poker-hand(REQ-011)，加乘有序=effect-apply(REQ-012)，
//  其余（选牌/盲注/回合）用 flag/condition/event-when 重组。小丑 = 一条 Effect 数据。
//  仍缺 REQ-013(valueFrom)：score=chips×mult 的「资源×资源」与量纲动态值小丑(Bull/Banner)待它。
// ════════════════════════════════════════════════════════════════════════

// 资源 / 信号 / 变量 id（测试与装配共用）。
export const R_CHIPS = 'chips';
export const R_MULT = 'mult';
export const R_MONEY = 'money';
export const R_HAND_SCORE = 'hand_score'; // 本手最终得分 = chips × mult（REQ-013 valueFrom timesResourceId）
export const V_HAND_TYPE = 'hand_type';
export const F_SCORING = 'scoring';
export const SIG_SCORE = 'score';
export const SIG_JOLLY = 'jolly_fire';
// 回合循环（增量1：可玩切片）。round_score 跨手累加；hands_left 每出一手 -1；blind_target 过关线。
export const R_ROUND_SCORE = 'round_score';
export const R_HANDS_LEFT = 'hands_left';
export const R_DISCARDS_LEFT = 'discards_left';
export const R_BLIND = 'blind_target';
export const SIG_COMMIT = 'hand_committed'; // 边沿信号：每"出一手"触发一次（与 score 的 level 区分）

// 数据牌型 id（下划线）→ 引擎 poker-hand 牌型名（连字符）。
const HAND_TYPE_TO_ENGINE: Record<HandType, string> = {
  high_card: 'high-card',
  pair: 'pair',
  two_pair: 'two-pair',
  three_kind: 'three-of-a-kind',
  straight: 'straight',
  flush: 'flush',
  full_house: 'full-house',
  four_kind: 'four-of-a-kind',
  straight_flush: 'straight-flush',
  five_kind: 'five-of-a-kind',
  flush_house: 'flush-house',
  flush_five: 'flush-five',
};

/** 由数据牌型表构造 poker-hand 的 rankingTable（引擎键名）。 */
export function buildRankingTable(): Record<string, { chips: number; mult: number }> {
  const table: Record<string, { chips: number; mult: number }> = {};
  for (const id of Object.keys(HAND_RANKINGS) as HandType[]) {
    const r = HAND_RANKINGS[id];
    table[HAND_TYPE_TO_ENGINE[id]] = { chips: r.baseChips, mult: r.baseMult };
  }
  return table;
}

/** 引擎牌型名中「包含对子」的全集（maxCount≥2）。Balatro：三条/葫芦/四条等都 contains pair。 */
export const ENGINE_HANDS_CONTAINING_PAIR: readonly string[] = [
  'pair',
  'two-pair',
  'three-of-a-kind',
  'full-house',
  'four-of-a-kind',
  'five-of-a-kind',
  'flush-house',
  'flush-five',
];

// 花色名 → 引擎数字（0..3）。
const SUIT_TO_NUM: Record<DataCard['suit'], number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };

/** 数据牌 {suit,rank(字符串)} → 引擎牌 {suit:0..3, rank:2..14}。 */
export function toEngineCard(c: DataCard): Card {
  return { suit: SUIT_TO_NUM[c.suit], rank: RANK_ORDER[c.rank] };
}

/** 便捷构造引擎牌（直接给数字）。 */
export const card = (suit: number, rank: number): Card => ({ suit, rank });

// Balatro 标准每牌基础筹码（纯数据，引擎不写死）：2..10=点值，J/Q/K=10，A=11。
// card-scoring(REQ-014) 逐张 pass 据此累加 chips（= 牌型基础 + Σ每张牌 baseChips）。
export const BASE_CHIPS_BY_RANK: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  '11': 10, '12': 10, '13': 10, '14': 11,
};

/** 一手牌的逐张 baseChips 之和（测试/UI 投影；与 card-score-pass 同源数据）。 */
export function sumBaseChips(cards: readonly Card[]): number {
  return cards.reduce((s, c) => s + (BASE_CHIPS_BY_RANK[String(c.rank)] ?? 0), 0);
}

export function buildGameEBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    // ── 计分资源（基础值由 poker-eval set，小丑在其上加乘）──
    chips: { Resource: { id: R_CHIPS, current: 0, min: 0, max: 1_000_000_000_000 } } as unknown as EntityBlueprint,
    mult: { Resource: { id: R_MULT, current: 0, min: 0, max: 1_000_000_000 } } as unknown as EntityBlueprint,
    money: { Resource: { id: R_MONEY, current: 4, min: -20, max: 1_000_000 } } as unknown as EntityBlueprint,
    handScore: { Resource: { id: R_HAND_SCORE, current: 0, min: 0, max: 1_000_000_000_000 } } as unknown as EntityBlueprint,

    // 牌型名（poker-eval 写；条件类小丑用 condition.string 读）。
    handType: { StringVar: { id: V_HAND_TYPE, value: '' } } as unknown as EntityBlueprint,

    // 计分开关（装配层/输入层在「出牌」时置 true → 驱动 score 信号）。
    scoring: { Flag: { id: F_SCORING, active: false } } as unknown as EntityBlueprint,

    // ── 回合循环资源（增量1：单局可玩切片）。round_score 跨手累加、过 blind_target 即胜；hands_left 出一手 -1。──
    roundScore: { Resource: { id: R_ROUND_SCORE, current: 0, min: 0, max: 1_000_000_000_000 } } as unknown as EntityBlueprint,
    handsLeft: { Resource: { id: R_HANDS_LEFT, current: 4, min: 0, max: 99 } } as unknown as EntityBlueprint,
    discardsLeft: { Resource: { id: R_DISCARDS_LEFT, current: 3, min: 0, max: 99 } } as unknown as EntityBlueprint,
    blindTarget: { Resource: { id: R_BLIND, current: 300, min: 0, max: 1_000_000_000_000 } } as unknown as EntityBlueprint,

    // ── 牌桌（单例）：评估器 + 逐张计分配置 + 当前出的牌（选牌交互填 cards）。──
    // PokerHand(REQ-011) 出牌型基础分；PerCardScore(REQ-014) 在其上逐张累加 baseChips（chips = 牌型基础 + Σ每张牌）。
    table: {
      PokerHand: { rankingTable: buildRankingTable(), chipsResource: R_CHIPS, multResource: R_MULT, handTypeVar: V_HAND_TYPE },
      PerCardScore: { chipsResource: R_CHIPS, baseChipsByRank: BASE_CHIPS_BY_RANK },
      PlayedHand: { cards: [] as Card[] },
    } as unknown as EntityBlueprint,

    // ── 信号门：scoring → score（每帧）；hand_type∈含对子 → jolly_fire ──
    gate_score: { EventWhen: { signal: SIG_SCORE, when: { kind: 'flag', id: F_SCORING }, mode: 'level', armed: false } } as unknown as EntityBlueprint,
    gate_jolly: {
      EventWhen: {
        signal: SIG_JOLLY,
        when: {
          kind: 'and',
          of: [
            { kind: 'flag', id: F_SCORING },
            { kind: 'or', of: ENGINE_HANDS_CONTAINING_PAIR.map((h) => ({ kind: 'string', id: V_HAND_TYPE, equals: h })) },
          ],
        },
        mode: 'level',
        armed: false,
      },
    } as unknown as EntityBlueprint,

    // ── 小丑 = Effect 数据（按 order 升序结算；order 对乘法是语义关键）──
    joker_base: { Effect: { onSignal: SIG_SCORE, kind: 'modify-resource', targetId: R_MULT, op: 'add', value: 4, order: 10 } } as unknown as EntityBlueprint,
    joker_chips: { Effect: { onSignal: SIG_SCORE, kind: 'modify-resource', targetId: R_CHIPS, op: 'add', value: 50, order: 5 } } as unknown as EntityBlueprint,
    joker_jolly: { Effect: { onSignal: SIG_JOLLY, kind: 'modify-resource', targetId: R_MULT, op: 'add', value: 8, order: 11 } } as unknown as EntityBlueprint,
    joker_cavendish: { Effect: { onSignal: SIG_SCORE, kind: 'modify-resource', targetId: R_MULT, op: 'mul', value: 3, order: 100 } } as unknown as EntityBlueprint,
    joker_bull: { Effect: { onSignal: SIG_SCORE, kind: 'modify-resource', targetId: R_CHIPS, op: 'add', valueFrom: { resourceId: R_MONEY, coeff: 2 }, order: 6 } } as unknown as EntityBlueprint,

    score_combine: { Effect: { onSignal: SIG_SCORE, kind: 'modify-resource', targetId: R_HAND_SCORE, op: 'set', valueFrom: { resourceId: R_CHIPS, timesResourceId: R_MULT }, order: 1000 } } as unknown as EntityBlueprint,

    // ── 回合进度（边沿：每"出一手"一次，与计分链的 level 区分）──
    // gate_commit 在 scoring 上升沿发 hand_committed（一次）；round_accumulate/hands_decrement 监听它，
    // 故多 tick 持有 scoring 也只累加/递减一次（与计分链每 tick 幂等重算解耦）。
    gate_commit: { EventWhen: { signal: SIG_COMMIT, when: { kind: 'flag', id: F_SCORING }, mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    // round_score += hand_score（order>score_combine 的 1000 → 同 tick 读到刚 set 的本手分）。
    round_accumulate: { Effect: { onSignal: SIG_COMMIT, kind: 'modify-resource', targetId: R_ROUND_SCORE, op: 'add', valueFrom: { resourceId: R_HAND_SCORE }, order: 2000 } } as unknown as EntityBlueprint,
    hands_decrement: { Effect: { onSignal: SIG_COMMIT, kind: 'modify-resource', targetId: R_HANDS_LEFT, op: 'add', value: -1, order: 2001 } } as unknown as EntityBlueprint,
  };

  return {
    capabilities: [
      resourceCapability,
      flagCapability,
      stringVariableCapability,
      pokerHandCapability,
      cardScoringCapability, // REQ-014：逐张 baseChips 累加 + 逐张小丑 + retrigger
      eventWhenCapability,
      effectApplyCapability,
    ],
    entities,
  };
}
