import type { HandType } from './hand-rankings.js';
import type { Suit } from './deck.js';
import { jokerArtKey } from './assets.js';

// ════════════════════════════════════════════════════════════════════════
//  Game E · 小丑牌数据（纯数据：每张小丑 = 一条声明式计分规则）
//  每张小丑映射到引擎的 Condition→Event→Effect：
//    trigger → 挂在哪个信号（event-when 产）  ·  when → ConditionExpr（条件门控）
//    {op,target,value} → Effect（modify-resource，op 由 REQ-012 提供 add|mul）
//  「最弱 LLM 能产出这一行 {op,target,value} 吗？能 → 数据接口。」——不写游戏 system。
//  起手 14 张全部是官方真实小丑（名字/数值/型号对齐 Balatro Wiki · Jokers）。
// ════════════════════════════════════════════════════════════════════════

/** 官方 7 型（效果产出分类）。 */
export type JokerType = '+c' | '+m' | 'Xm' | '++' | '!!' | '...' | '+$';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

/** 计分修改：op 作用于 target，value 为量。mul 需引擎 REQ-012。 */
export type ScoreOp = 'add' | 'mul';
export type ScoreTarget = 'chips' | 'mult' | 'money';

/** 触发时机 → 决定 effect 监听的信号（事件分类学）。 */
export type Trigger =
  | 'on_hand_scored' // Indep.：出牌结算时一次
  | 'on_card_scored' // On Scored：每张计分牌（需 REQ-011 逐张迭代）
  | 'on_round_end' // 回合结束
  | 'on_blind_selected'; // 选盲注时

/** 条件门控（映射 ConditionExpr）。缺省=无条件。 */
export type JokerCondition =
  | { readonly kind: 'always' }
  | { readonly kind: 'hand_contains'; readonly hand: HandType } // 含某牌型
  | { readonly kind: 'hand_size_lte'; readonly n: number } // 出牌张数 ≤ n
  | { readonly kind: 'card_suit'; readonly suit: Suit } // 逐张：该牌花色（配 on_card_scored）
  | { readonly kind: 'card_face' } // 逐张：人头牌
  | { readonly kind: 'card_even' }; // 逐张：偶数点

/** 动态值来源（量纲类，如「每 $1」「每剩 1 弃牌」）。映射候选 REQ-013 valueFrom。 */
export interface ValueFrom {
  readonly resourceId: string; // 如 'money' / 'discards'
  readonly coeff: number; // value = coeff × resource.current
}

export interface JokerCard {
  readonly id: string;
  readonly name: string;
  readonly rarity: Rarity;
  readonly cost: number;
  readonly jokerType: JokerType;
  readonly trigger: Trigger;
  readonly when: JokerCondition;
  readonly op: ScoreOp;
  readonly target: ScoreTarget;
  /** 静态量；若用 valueFrom 则为系数语义（见 valueFrom）。 */
  readonly value: number;
  /** 量纲动态值（候选 REQ-013）；缺省=静态 value。 */
  readonly valueFrom?: ValueFrom;
  /** 美术 key（jokerArtKey(id)）；缺图自动退化占位。 */
  readonly artKey: string;
  /** 人话描述（= 数据的投影，渲染叠在卡面，见 design §七）。 */
  readonly text: string;
}

const J = (j: Omit<JokerCard, 'artKey'>): JokerCard => ({ ...j, artKey: jokerArtKey(j.id) });

/** 起手 14 张：刻意铺满 7 型 × 激活时机，验证 REQ-011/012 表达力。 */
export const STARTER_JOKERS: readonly JokerCard[] = [
  J({ id: 'joker', name: 'Joker', rarity: 'common', cost: 2, jokerType: '+m', trigger: 'on_hand_scored', when: { kind: 'always' }, op: 'add', target: 'mult', value: 4, text: '+4 倍率' }),
  J({ id: 'greedy_joker', name: 'Greedy Joker', rarity: 'common', cost: 5, jokerType: '+m', trigger: 'on_card_scored', when: { kind: 'card_suit', suit: 'diamonds' }, op: 'add', target: 'mult', value: 3, text: '每张计分的 ♦ +3 倍率' }),
  J({ id: 'lusty_joker', name: 'Lusty Joker', rarity: 'common', cost: 5, jokerType: '+m', trigger: 'on_card_scored', when: { kind: 'card_suit', suit: 'hearts' }, op: 'add', target: 'mult', value: 3, text: '每张计分的 ♥ +3 倍率' }),
  J({ id: 'jolly_joker', name: 'Jolly Joker', rarity: 'common', cost: 3, jokerType: '+m', trigger: 'on_hand_scored', when: { kind: 'hand_contains', hand: 'pair' }, op: 'add', target: 'mult', value: 8, text: '含对子 → +8 倍率' }),
  J({ id: 'zany_joker', name: 'Zany Joker', rarity: 'common', cost: 4, jokerType: '+m', trigger: 'on_hand_scored', when: { kind: 'hand_contains', hand: 'three_kind' }, op: 'add', target: 'mult', value: 12, text: '含三条 → +12 倍率' }),
  J({ id: 'half_joker', name: 'Half Joker', rarity: 'common', cost: 5, jokerType: '+m', trigger: 'on_hand_scored', when: { kind: 'hand_size_lte', n: 3 }, op: 'add', target: 'mult', value: 20, text: '出牌 ≤3 张 → +20 倍率' }),
  J({ id: 'scary_face', name: 'Scary Face', rarity: 'common', cost: 4, jokerType: '+c', trigger: 'on_card_scored', when: { kind: 'card_face' }, op: 'add', target: 'chips', value: 30, text: '每张计分的人头牌 +30 筹码' }),
  J({ id: 'even_steven', name: 'Even Steven', rarity: 'common', cost: 4, jokerType: '+m', trigger: 'on_card_scored', when: { kind: 'card_even' }, op: 'add', target: 'mult', value: 4, text: '每张计分的偶数牌 +4 倍率' }),
  J({ id: 'banner', name: 'Banner', rarity: 'common', cost: 5, jokerType: '+c', trigger: 'on_hand_scored', when: { kind: 'always' }, op: 'add', target: 'chips', value: 30, valueFrom: { resourceId: 'discards', coeff: 30 }, text: '每剩 1 次弃牌 +30 筹码' }),
  J({ id: 'bull', name: 'Bull', rarity: 'uncommon', cost: 6, jokerType: '+c', trigger: 'on_hand_scored', when: { kind: 'always' }, op: 'add', target: 'chips', value: 2, valueFrom: { resourceId: 'money', coeff: 2 }, text: '每有 $1 +2 筹码' }),
  J({ id: 'cavendish', name: 'Cavendish', rarity: 'common', cost: 4, jokerType: 'Xm', trigger: 'on_hand_scored', when: { kind: 'always' }, op: 'mul', target: 'mult', value: 3, text: '×3 倍率' }),
  J({ id: 'the_duo', name: 'The Duo', rarity: 'rare', cost: 8, jokerType: 'Xm', trigger: 'on_hand_scored', when: { kind: 'hand_contains', hand: 'pair' }, op: 'mul', target: 'mult', value: 2, text: '含对子 → ×2 倍率' }),
  J({ id: 'golden_joker', name: 'Golden Joker', rarity: 'common', cost: 6, jokerType: '+$', trigger: 'on_round_end', when: { kind: 'always' }, op: 'add', target: 'money', value: 4, text: '回合结束 +$4' }),
  J({ id: 'hanging_chad', name: 'Hanging Chad', rarity: 'common', cost: 4, jokerType: '...', trigger: 'on_card_scored', when: { kind: 'always' }, op: 'add', target: 'chips', value: 0, text: '首张计分牌额外重触发 2 次' }),
];

/** 按 id 取小丑。 */
export const JOKER_BY_ID: ReadonlyMap<string, JokerCard> = new Map(STARTER_JOKERS.map((j) => [j.id, j]));
