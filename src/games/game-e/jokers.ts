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
  | { readonly kind: 'card_even' } // 逐张：偶数点
  | { readonly kind: 'card_odd' } // 逐张：奇数点（A 计奇）
  | { readonly kind: 'card_rank_in'; readonly ranks: readonly number[] } // 逐张：点数 ∈ 集合（引擎 rank 2..14；Fibonacci 等）
  | { readonly kind: 'resource_cmp'; readonly id: string; readonly cmp: 'lte' | 'gte' | 'eq'; readonly value: number }; // 读某 Resource 比较（如剩余弃牌=0）

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
  /** 第二条效果（同 trigger/when）：双产出小丑用（Scholar=A +20筹+4倍、Walkie=10/4 +10筹+4倍）。 */
  readonly extra?: { readonly op: ScoreOp; readonly target: ScoreTarget; readonly value: number };
  /** 概率门（REQ-E-023②）：命中 when 后再按 num/den roll 才施用（Bloodstone 每张♥ 1/2 ×1.5、Business Card 人头 1/2 +$2）。 */
  readonly chance?: { readonly num: number; readonly den: number };
  /** 计数缩放（REQ-E-023① countOf）：value 视作"每个该类实体 ×value"（Abstract 每小丑 +3 倍）。 */
  readonly countTag?: 'jokers';
  /** 留手生效（REQ-E-023③）：on_card_scored 规则改对"留在手里没出的牌"求值（Baron 留手 K ×1.5）。 */
  readonly held?: boolean;
  /** 重触发次数（REQ-014 PerCardRetrigger）：>0 表示首张计分牌额外重触发 N 次（Hanging Chad=2）。 */
  readonly retrigger?: number;
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
  J({ id: 'cavendish', name: 'Cavendish', rarity: 'uncommon', cost: 6, jokerType: 'Xm', trigger: 'on_hand_scored', when: { kind: 'always' }, op: 'mul', target: 'mult', value: 3, text: '×3 倍率' }),
  J({ id: 'the_duo', name: 'The Duo', rarity: 'rare', cost: 8, jokerType: 'Xm', trigger: 'on_hand_scored', when: { kind: 'hand_contains', hand: 'pair' }, op: 'mul', target: 'mult', value: 2, text: '含对子 → ×2 倍率' }),
  J({ id: 'golden_joker', name: 'Golden Joker', rarity: 'common', cost: 6, jokerType: '+$', trigger: 'on_round_end', when: { kind: 'always' }, op: 'add', target: 'money', value: 4, text: '回合结束 +$4' }),
  J({ id: 'hanging_chad', name: 'Hanging Chad', rarity: 'common', cost: 4, jokerType: '...', trigger: 'on_card_scored', when: { kind: 'always' }, op: 'add', target: 'chips', value: 0, retrigger: 2, text: '首张计分牌额外重触发 2 次' }),
  // ── 补全：现有能力可忠实表达的官方小丑（数值对齐 Balatro Wiki）──
  J({ id: 'wrathful_joker', name: 'Wrathful Joker', rarity: 'common', cost: 5, jokerType: '+m', trigger: 'on_card_scored', when: { kind: 'card_suit', suit: 'spades' }, op: 'add', target: 'mult', value: 3, text: '每张计分的 ♠ +3 倍率' }),
  J({ id: 'gluttonous_joker', name: 'Gluttonous Joker', rarity: 'common', cost: 5, jokerType: '+m', trigger: 'on_card_scored', when: { kind: 'card_suit', suit: 'clubs' }, op: 'add', target: 'mult', value: 3, text: '每张计分的 ♣ +3 倍率' }),
  J({ id: 'odd_todd', name: 'Odd Todd', rarity: 'common', cost: 4, jokerType: '+c', trigger: 'on_card_scored', when: { kind: 'card_odd' }, op: 'add', target: 'chips', value: 31, text: '每张计分的奇数牌(A,3,5,7,9) +31 筹码' }),
  J({ id: 'fibonacci', name: 'Fibonacci', rarity: 'uncommon', cost: 8, jokerType: '+m', trigger: 'on_card_scored', when: { kind: 'card_rank_in', ranks: [14, 2, 3, 5, 8] }, op: 'add', target: 'mult', value: 8, text: '每张计分的 A/2/3/5/8 +8 倍率' }),
  J({ id: 'mad_joker', name: 'Mad Joker', rarity: 'common', cost: 4, jokerType: '+m', trigger: 'on_hand_scored', when: { kind: 'hand_contains', hand: 'two_pair' }, op: 'add', target: 'mult', value: 10, text: '含两对 → +10 倍率' }),
  J({ id: 'sly_joker', name: 'Sly Joker', rarity: 'common', cost: 3, jokerType: '+c', trigger: 'on_hand_scored', when: { kind: 'hand_contains', hand: 'pair' }, op: 'add', target: 'chips', value: 50, text: '含对子 → +50 筹码' }),
  J({ id: 'wily_joker', name: 'Wily Joker', rarity: 'common', cost: 4, jokerType: '+c', trigger: 'on_hand_scored', when: { kind: 'hand_contains', hand: 'three_kind' }, op: 'add', target: 'chips', value: 100, text: '含三条 → +100 筹码' }),
  J({ id: 'clever_joker', name: 'Clever Joker', rarity: 'common', cost: 4, jokerType: '+c', trigger: 'on_hand_scored', when: { kind: 'hand_contains', hand: 'two_pair' }, op: 'add', target: 'chips', value: 80, text: '含两对 → +80 筹码' }),
  J({ id: 'the_trio', name: 'The Trio', rarity: 'rare', cost: 8, jokerType: 'Xm', trigger: 'on_hand_scored', when: { kind: 'hand_contains', hand: 'three_kind' }, op: 'mul', target: 'mult', value: 3, text: '含三条 → ×3 倍率' }),
  J({ id: 'the_family', name: 'The Family', rarity: 'rare', cost: 8, jokerType: 'Xm', trigger: 'on_hand_scored', when: { kind: 'hand_contains', hand: 'four_kind' }, op: 'mul', target: 'mult', value: 4, text: '含四条 → ×4 倍率' }),
  J({ id: 'gros_michel', name: 'Gros Michel', rarity: 'common', cost: 5, jokerType: '+m', trigger: 'on_hand_scored', when: { kind: 'always' }, op: 'add', target: 'mult', value: 15, text: '+15 倍率' }),
  // ── REQ-E-022 落地：含顺子/含同花条件小丑（poker-eval 暴露 isFlush/isStraight Flag 后成纯数据）──
  J({ id: 'crazy_joker', name: 'Crazy Joker', rarity: 'common', cost: 4, jokerType: '+m', trigger: 'on_hand_scored', when: { kind: 'hand_contains', hand: 'straight' }, op: 'add', target: 'mult', value: 12, text: '含顺子 → +12 倍率' }),
  J({ id: 'droll_joker', name: 'Droll Joker', rarity: 'common', cost: 4, jokerType: '+m', trigger: 'on_hand_scored', when: { kind: 'hand_contains', hand: 'flush' }, op: 'add', target: 'mult', value: 10, text: '含同花 → +10 倍率' }),
  J({ id: 'devious_joker', name: 'Devious Joker', rarity: 'common', cost: 4, jokerType: '+c', trigger: 'on_hand_scored', when: { kind: 'hand_contains', hand: 'straight' }, op: 'add', target: 'chips', value: 100, text: '含顺子 → +100 筹码' }),
  J({ id: 'crafty_joker', name: 'Crafty Joker', rarity: 'common', cost: 4, jokerType: '+c', trigger: 'on_hand_scored', when: { kind: 'hand_contains', hand: 'flush' }, op: 'add', target: 'chips', value: 80, text: '含同花 → +80 筹码' }),
  J({ id: 'the_order', name: 'The Order', rarity: 'rare', cost: 8, jokerType: 'Xm', trigger: 'on_hand_scored', when: { kind: 'hand_contains', hand: 'straight' }, op: 'mul', target: 'mult', value: 3, text: '含顺子 → ×3 倍率' }),
  J({ id: 'the_tribe', name: 'The Tribe', rarity: 'rare', cost: 8, jokerType: 'Xm', trigger: 'on_hand_scored', when: { kind: 'hand_contains', hand: 'flush' }, op: 'mul', target: 'mult', value: 2, text: '含同花 → ×2 倍率' }),
  // ── B 组：现有能力即可表达（无引擎工）──
  J({ id: 'smiley_face', name: 'Smiley Face', rarity: 'common', cost: 4, jokerType: '+m', trigger: 'on_card_scored', when: { kind: 'card_face' }, op: 'add', target: 'mult', value: 5, text: '每张计分人头牌 +5 倍率' }),
  J({ id: 'arrowhead', name: 'Arrowhead', rarity: 'uncommon', cost: 7, jokerType: '+c', trigger: 'on_card_scored', when: { kind: 'card_suit', suit: 'spades' }, op: 'add', target: 'chips', value: 50, text: '每张计分的 ♠ +50 筹码' }),
  J({ id: 'onyx_agate', name: 'Onyx Agate', rarity: 'uncommon', cost: 7, jokerType: '+m', trigger: 'on_card_scored', when: { kind: 'card_suit', suit: 'clubs' }, op: 'add', target: 'mult', value: 7, text: '每张计分的 ♣ +7 倍率' }),
  J({ id: 'rough_gem', name: 'Rough Gem', rarity: 'uncommon', cost: 7, jokerType: '+$', trigger: 'on_card_scored', when: { kind: 'card_suit', suit: 'diamonds' }, op: 'add', target: 'money', value: 1, text: '每张计分的 ♦ +$1' }),
  J({ id: 'triboulet', name: 'Triboulet', rarity: 'legendary', cost: 20, jokerType: 'Xm', trigger: 'on_card_scored', when: { kind: 'card_rank_in', ranks: [12, 13] }, op: 'mul', target: 'mult', value: 2, text: '每张计分的 K/Q ×2 倍率' }),
  J({ id: 'mystic_summit', name: 'Mystic Summit', rarity: 'common', cost: 5, jokerType: '+m', trigger: 'on_hand_scored', when: { kind: 'resource_cmp', id: 'discards_left', cmp: 'lte', value: 0 }, op: 'add', target: 'mult', value: 15, text: '剩余弃牌为 0 时 +15 倍率' }),
  J({ id: 'scholar', name: 'Scholar', rarity: 'common', cost: 4, jokerType: '++', trigger: 'on_card_scored', when: { kind: 'card_rank_in', ranks: [14] }, op: 'add', target: 'chips', value: 20, extra: { op: 'add', target: 'mult', value: 4 }, text: '每张计分的 A +20 筹码 +4 倍率' }),
  J({ id: 'walkie_talkie', name: 'Walkie Talkie', rarity: 'common', cost: 4, jokerType: '++', trigger: 'on_card_scored', when: { kind: 'card_rank_in', ranks: [10, 4] }, op: 'add', target: 'chips', value: 10, extra: { op: 'add', target: 'mult', value: 4 }, text: '每张计分的 10/4 +10 筹码 +4 倍率' }),
  // ── REQ-E-023 ① 计数缩放 / ② 概率（主程引擎落地后接线）──
  J({ id: 'abstract_joker', name: 'Abstract Joker', rarity: 'common', cost: 4, jokerType: '+m', trigger: 'on_hand_scored', when: { kind: 'always' }, op: 'add', target: 'mult', value: 3, countTag: 'jokers', text: '每拥有 1 个小丑 +3 倍率' }),
  J({ id: 'bloodstone', name: 'Bloodstone', rarity: 'uncommon', cost: 7, jokerType: 'Xm', trigger: 'on_card_scored', when: { kind: 'card_suit', suit: 'hearts' }, op: 'mul', target: 'mult', value: 1.5, chance: { num: 1, den: 2 }, text: '每张计分 ♥ 1/2 概率 ×1.5 倍率' }),
  J({ id: 'business_card', name: 'Business Card', rarity: 'common', cost: 4, jokerType: '+$', trigger: 'on_card_scored', when: { kind: 'card_face' }, op: 'add', target: 'money', value: 2, chance: { num: 1, den: 2 }, text: '每张计分人头牌 1/2 概率 +$2' }),
  // ── REQ-E-023 ③ 留手牌结算（HeldHand）──
  J({ id: 'baron', name: 'Baron', rarity: 'rare', cost: 8, jokerType: 'Xm', trigger: 'on_card_scored', when: { kind: 'card_rank_in', ranks: [13] }, op: 'mul', target: 'mult', value: 1.5, held: true, text: '每张留在手里的 K ×1.5 倍率' }),
  J({ id: 'shoot_the_moon', name: 'Shoot the Moon', rarity: 'common', cost: 5, jokerType: '+m', trigger: 'on_card_scored', when: { kind: 'card_rank_in', ranks: [12] }, op: 'add', target: 'mult', value: 13, held: true, text: '每张留在手里的 Q +13 倍率' }),
];

/** 按 id 取小丑。 */
export const JOKER_BY_ID: ReadonlyMap<string, JokerCard> = new Map(STARTER_JOKERS.map((j) => [j.id, j]));

/** 商店稀有度权重（对齐 Balatro：常见 ~70% / 罕见 ~25% / 稀有 ~5%）。越强越稀有 → 不会每店都刷到强乘法小丑。 */
export const RARITY_WEIGHT: Readonly<Record<Rarity, number>> = { common: 70, uncommon: 25, rare: 5, legendary: 1 };

/** 稀有度加权抽 n 张未拥有的小丑（rand=取数器，注入以保确定性/可测）。 */
export function rollJokerOffer(ownedIds: ReadonlySet<string>, n: number, rand: () => number): JokerCard[] {
  const tmp = STARTER_JOKERS.filter((j) => !ownedIds.has(j.id));
  const offer: JokerCard[] = [];
  for (let k = 0; k < n && tmp.length; k++) {
    const total = tmp.reduce((s, j) => s + RARITY_WEIGHT[j.rarity], 0);
    let roll = rand() * total;
    let pick = 0;
    for (let i = 0; i < tmp.length; i++) { roll -= RARITY_WEIGHT[tmp[i].rarity]; if (roll <= 0) { pick = i; break; } }
    offer.push(tmp.splice(pick, 1)[0]);
  }
  return offer;
}
