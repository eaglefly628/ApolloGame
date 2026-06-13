// Game F · 牌组加载器（T2，game-f-core-combat-dev.md「唯一新逻辑」）+ 首发牌组数据（T5）。
// 宪法：游戏=数据。本模块不发明能力——只把「牌组数组」物化成现成 capability 的规则实体
//（group-count / EventWhen / Effect / banded / card-pile 权重），最弱 LLM 也能产出牌组数据。
import type { EntityBlueprint } from '../../assembly/demo.assembly.js';
import { FACT_WEI, BENCH_OCC } from './constants.js';
import type { Faction } from './heroes.js';

// 卡牌 = {触发条件, 效果} 算子（D0 核对：Game E joker 架构已全覆盖）。v1「虎豹铁骑」只用这三类。
export type CardSpec =
  // 连携/职业 buff：开战锁存「在板某 tag 数」→ 线性写全队伤害系数（hitbox scaleByResource 读 dmg_scale_a）。
  | { kind: 'synergy-buff'; id: string; tagMask: number; perUnit: number }
  // 回合 buff：前 N 回合（round_idx ≤ untilRound）开战额外伤害系数（banded by round）。
  | { kind: 'round-buff'; id: string; untilRound: number; bonus: number }
  // 商店权重：把某些英雄码在牌袋里加权（预配权重，洗入更多某势力）。
  | { kind: 'shop-weight'; id: string; codes: number[]; copies: number };

export interface Deck {
  id: string;
  name: string;
  faction: Faction; // 出生倾向（轻风味）；深度在卡，不在势力
  cards: CardSpec[];
}

// 首发牌组「虎豹铁骑」(魏·速攻 Aggro)：deck-spec §1，全 ✅复用、零缺口依赖——验证闭环的最简基线。
export const HUBAO_DECK: Deck = {
  id: 'hubao',
  name: '虎豹铁骑',
  faction: 'wei',
  cards: [
    // 虎豹骑令 ⭐：每有 1 魏（骑）·全队 +攻。「魏骑」v1 简化=在板魏势力单位（骑兵职业位待 roster 扩充再细分）。
    { kind: 'synergy-buff', id: 'hubao_edict', tagMask: BENCH_OCC | FACT_WEI, perUnit: 0.06 },
    // 速攻令：前 3 回合伤害 +15%（序盘压制）。
    { kind: 'round-buff', id: 'blitz', untilRound: 3, bonus: 0.15 },
    // 募兵：商店魏国权重 +（魏码各多 2 张洗入牌袋）。
    { kind: 'shop-weight', id: 'levy', codes: [1, 2, 3, 4, 5, 6], copies: 2 },
  ],
};

export interface DeckRules {
  entities: Record<string, EntityBlueprint>;
  shopBias: { codes: number[]; copies: number }[];
}

// 物化：deck → 规则实体（合并进 world 蓝图）+ 商店牌袋偏置。
// 沿用蜀魂 bond 成熟模式（blueprint.ts §羁绊）：GroupCount→count 资源；开战 edge 锁存 → Effect 写 dmg_scale_a。
// dmg_scale_a 已由 prep 进入时复位为 1（round_ui prep onEnter），故此处只加锁存、不管复位（同蜀魂纪律）。
export function buildDeckRules(deck: Deck): DeckRules {
  const ents: Record<string, EntityBlueprint> = {};
  const shopBias: { codes: number[]; copies: number }[] = [];
  const combat = { kind: 'state', fsmId: 'round_ui', equals: 'combat' };
  for (const card of deck.cards) {
    if (card.kind === 'synergy-buff') {
      const cr = `deck_count_${card.id}`;
      ents[`gc_${card.id}`] = { GroupCount: { countResource: cr, requiredTag: card.tagMask, onBoard: true } };
      ents[`r_${cr}`] = { Resource: { id: cr, current: 0, min: 0, max: 99 } };
      ents[`when_${card.id}`] = { EventWhen: { signal: card.id, when: combat, mode: 'edge', armed: false } };
      // 线性：dmg_scale_a += count × perUnit，开战拍施加一次（封顶靠 dmg_scale_a 资源 max）。
      ents[`eff_${card.id}`] = { Effect: { onSignal: card.id, kind: 'modify-resource', targetId: 'dmg_scale_a', op: 'add', value: 0, valueFrom: { resourceId: cr, coeff: card.perUnit } } };
    } else if (card.kind === 'round-buff') {
      // banded：开战 ∧ round_idx ≤ untilRound → dmg_scale_a += bonus（前 N 回合压制）。
      ents[`when_${card.id}`] = { EventWhen: { signal: card.id, when: { kind: 'and', of: [combat, { kind: 'resource', id: 'round_idx', cmp: 'lte', value: card.untilRound }] }, mode: 'edge', armed: false } };
      ents[`eff_${card.id}`] = { Effect: { onSignal: card.id, kind: 'modify-resource', targetId: 'dmg_scale_a', op: 'add', value: card.bonus } };
    } else {
      shopBias.push({ codes: card.codes, copies: card.copies });
    }
  }
  return { entities: ents, shopBias };
}

// 把偏置应用到基础牌袋（追加副本；保持确定性次序——只追加不重排，既有验收断言不动）。
export function applyShopBias(baseDeck: number[], shopBias: { codes: number[]; copies: number }[]): number[] {
  const out = [...baseDeck];
  for (const b of shopBias) for (let i = 0; i < b.copies; i++) out.push(...b.codes);
  return out;
}
