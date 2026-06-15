// Game F · 牌组加载器（T2，game-f-core-combat-dev.md「唯一新逻辑」）+ 首发牌组数据（T5）。
// 宪法：游戏=数据。本模块不发明能力——只把「牌组数组」物化成现成 capability 的规则实体
//（group-count / EventWhen / Effect / banded / card-pile 权重），最弱 LLM 也能产出牌组数据。
import type { EntityBlueprint } from '../../assembly/demo.assembly.js';
import { FACT_WEI, FACT_SHU, ASSASSIN, BENCH_OCC } from './constants.js';
import type { Faction } from './heroes.js';

// 卡牌 = {触发条件, 效果} 算子（D0 核对：Game E joker 架构已全覆盖）。v1 + deck#2 用这四类。
export type CardSpec =
  // 连携/职业 buff：开战锁存「在板某 tag 数」→ 线性写全队伤害系数（hitbox scaleByResource 读 dmg_scale_a）。
  | { kind: 'synergy-buff'; id: string; tagMask: number; perUnit: number }
  // 阈值连携：在板某 tag 数**越阶梯阈值** → 阶梯 banded buff（"够 N 个才质变"，区别于线性 synergy-buff）。
  | { kind: 'threshold-buff'; id: string; tagMask: number; tiers: { at: number; bonus: number }[] }
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

// 牌组 #2「兴复汉室」(蜀·连携)：deck-spec #2 现实修正（roster 无刘备 → 五虎/全蜀 conn"越多越强、满编质变"）。
// 与「虎豹铁骑」(魏·速攻) 对称——一势力一起手组。验证 threshold-buff 范式（阈值台阶，非线性）。
export const HANSHI_DECK: Deck = {
  id: 'hanshi',
  name: '兴复汉室',
  faction: 'shu',
  cards: [
    // 桃园誓 ⭐：在板蜀 ≥3 → +20%；≥5（满编）→ 再 +25%（兴复质变）。banded 阶梯，开战锁存。
    { kind: 'threshold-buff', id: 'taoyuan', tagMask: BENCH_OCC | FACT_SHU, tiers: [{ at: 3, bonus: 0.20 }, { at: 5, bonus: 0.25 }] },
    // 章武：前 3 回合伤害 +12%（序盘不被速攻压死）。
    { kind: 'round-buff', id: 'zhangwu', untilRound: 3, bonus: 0.12 },
    // 募贤：商店蜀码加权（蜀将各多 2 张洗入牌袋）。
    { kind: 'shop-weight', id: 'muxian', codes: [1, 2, 3, 4, 5, 6], copies: 2 },
  ],
};

// 牌组 #3「白衣渡江」(吴·刺客斩首)：game-f-wu-faction-seed.md §二。场上刺客越多越强；斩杀走 F-061 职业 trait（已 done）。
// 待命：依赖吴 faction（已落 WU_ROSTER）+ 3-faction plumbing（多人重构）。plumbing 到位前**不入 DECK_REGISTRY**（不可选、不会被错误构建）。
export const BAIYI_DECK: Deck = {
  id: 'baiyi',
  name: '白衣渡江',
  faction: 'wu',
  cards: [
    // 白衣 ⭐：在板刺客 ≥2 → +18%；≥4（成军）→ 再 +22%。斩杀=刺客职业 trait（F-061）。
    { kind: 'threshold-buff', id: 'baiyi', tagMask: BENCH_OCC | ASSASSIN, tiers: [{ at: 2, bonus: 0.18 }, { at: 4, bonus: 0.22 }] },
    { kind: 'round-buff', id: 'jinfan', untilRound: 3, bonus: 0.12 }, // 锦帆：序盘压制
    { kind: 'shop-weight', id: 'muci', codes: [1, 2, 3, 4, 5, 6], copies: 3 }, // 募刺：吴刺客加权（码待 3-faction codesFor 定）
  ],
};

// 牌组登记表（id → 真实 Deck）：大厅选牌组 → 取真组交引擎。未实装的展示牌组回退首发组。
// 注：BAIYI（吴）待 3-faction plumbing 才入表（现入会因 rosterFor('wu') 占位布局打不正常）。
export const DECK_REGISTRY: Record<string, Deck> = {
  hubao: HUBAO_DECK,
  hanshi: HANSHI_DECK,
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
    } else if (card.kind === 'threshold-buff') {
      // 阈值连携：count = 在板某 tag 数；每档 banded（开战 ∧ count ≥ at → dmg_scale_a += bonus）。
      // = synergy-buff 的计数 + round-buff 的 banded 阈值拼装，零引擎改动。
      const cr = `deck_count_${card.id}`;
      ents[`gc_${card.id}`] = { GroupCount: { countResource: cr, requiredTag: card.tagMask, onBoard: true } };
      ents[`r_${cr}`] = { Resource: { id: cr, current: 0, min: 0, max: 99 } };
      card.tiers.forEach((t, k) => {
        const sig = `${card.id}_t${k}`;
        ents[`when_${sig}`] = { EventWhen: { signal: sig, when: { kind: 'and', of: [combat, { kind: 'resource', id: cr, cmp: 'gte', value: t.at }] }, mode: 'edge', armed: false } };
        ents[`eff_${sig}`] = { Effect: { onSignal: sig, kind: 'modify-resource', targetId: 'dmg_scale_a', op: 'add', value: t.bonus } };
      });
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
