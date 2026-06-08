import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { Card } from '@engine/protocol/components.js';
import { resourceCapability, flagCapability, stringVariableCapability } from '@atom-skills/index.js';
import { eventWhenCapability, effectApplyCapability } from '@skills/tier2/index.js';
import { pokerHandCapability } from '@skills/tier3/index.js';
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

    // ── 牌桌（单例）：评估器 + 当前出的牌（选牌交互填 cards）。──
    table: {
      PokerHand: { rankingTable: buildRankingTable(), chipsResource: R_CHIPS, multResource: R_MULT, handTypeVar: V_HAND_TYPE },
      PlayedHand: { cards: [] as Card[] },
    } as unknown as EntityBlueprint,

    // ── 信号门：scoring → score（每帧）；hand_type∈含对子 → jolly_fire ──
    gate_score: { EventWhen: { signal: SIG_SCORE, when: { kind: 'flag', id: F_SCORING }, mode: 'level', armed: false } } as unknown as EntityBlueprint,
    gate_jolly: {
      EventWhen: {
        signal: SIG_JOLLY,
        // 条件类小丑也要被「出牌中」门控：scoring 且 牌型含对子，才发 jolly_fire。
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
    // Joker：+4 Mult（无条件）。
    joker_base: { Effect: { onSignal: SIG_SCORE, kind: 'modify-resource', targetId: R_MULT, op: 'add', value: 4, order: 10 } } as unknown as EntityBlueprint,
    // Sly Joker 风味：+50 Chips（无条件，演示 +chips）。
    joker_chips: { Effect: { onSignal: SIG_SCORE, kind: 'modify-resource', targetId: R_CHIPS, op: 'add', value: 50, order: 5 } } as unknown as EntityBlueprint,
    // Jolly Joker：含对子 → +8 Mult（条件，靠 gate_jolly 信号）。
    joker_jolly: { Effect: { onSignal: SIG_JOLLY, kind: 'modify-resource', targetId: R_MULT, op: 'add', value: 8, order: 11 } } as unknown as EntityBlueprint,
    // Cavendish：×3 Mult（无条件，order 最大 → 最后乘，先加后乘）。
    joker_cavendish: { Effect: { onSignal: SIG_SCORE, kind: 'modify-resource', targetId: R_MULT, op: 'mul', value: 3, order: 100 } } as unknown as EntityBlueprint,
    // Bull：每 $1 +2 Chips（量纲动态值，REQ-013 valueFrom coeff）。
    joker_bull: { Effect: { onSignal: SIG_SCORE, kind: 'modify-resource', targetId: R_CHIPS, op: 'add', valueFrom: { resourceId: R_MONEY, coeff: 2 }, order: 6 } } as unknown as EntityBlueprint,

    // ── 最终合并（REQ-013 valueFrom timesResourceId）：hand_score = chips × mult。
    // order 最大(1000) → 在所有小丑改完 chips/mult 之后才读（effect-apply 就地连写，lookup 按引用读最新值）。
    // op:'set' → 每帧幂等设为当前 chips×mult（累计入总分=另一条边沿信号的后续工作）。
    score_combine: { Effect: { onSignal: SIG_SCORE, kind: 'modify-resource', targetId: R_HAND_SCORE, op: 'set', valueFrom: { resourceId: R_CHIPS, timesResourceId: R_MULT }, order: 1000 } } as unknown as EntityBlueprint,
  };

  return {
    capabilities: [
      resourceCapability,
      flagCapability,
      stringVariableCapability,
      pokerHandCapability, // REQ-011：判牌型给基础分
      eventWhenCapability, // 条件 → 信号
      effectApplyCapability, // REQ-012：op/order 加乘有序结算
    ],
    entities,
  };
}
