import { defineCapability } from '@engine/core/define-capability.js';
import { SystemPhase } from '@engine/core/types.js';
import type { IWorld } from '@engine/core/types.js';
import type { Card, PlayedHand, PokerHand, Resource, StringVar } from '@engine/protocol/components.js';
import { findByComponentId } from '@engine/core/query.js';

// ═══════════════════════════════════════════════════════════════
//  poker-hand —— 「一手牌 → 牌型 + 基础分」确定性评估器（REQ-011；Tier3「算法/解释器型机制」大类）。
//
//  Condition→Event→Effect 是反应式布尔逻辑，表达不了「5 张是不是同花顺」这种带计数/排序的算法——
//  扑克牌型判定正是这类缺口（与已落地的 match3-board「网格连消」、tilemap「瓦片碰撞」完全同构）。
//
//  分工（严守 manifesto：选牌/洗牌/盲注/回合/经济全用现有能力重组，本能力只补"判牌型"这一真缺口）：
//    - 选牌/弃牌/出牌触发 → clickable + effect-apply（装配层填 PlayedHand.cards）。
//    - 洗牌发牌          → random（RandomSeed 整数 PRNG）。
//    - 盲注线/回合状态机   → condition + event-when + state。
//    - 小丑 ×mult / +chips → effect-apply 的 op/order（REQ-012）。
//    - 「这手是什么牌型、基础多少分」→ ★本能力★（纯算法，LLM 产不出同一份数据 → 下沉成引擎解释器）。
//
//  poker-eval（Update 相位，早于小丑结算的 effect-apply=Commit）：读同实体 PlayedHand → evaluateHand
//  → 按 rankingTable **set** 基础 chips/mult 两个 Resource（基础值，被后续小丑乘/加修正）→ 可选写牌型名 StringVar。
//  确定性：纯整数/枚举比较与计数（花色相等、点数大小、张数），不碰浮点超越函数 → lockstep/录放安全。
// ═══════════════════════════════════════════════════════════════

// 牌型名（priority 从低到高的全集；rankingTable 的键即取自此集）。
export type HandType =
  | 'high-card'
  | 'pair'
  | 'two-pair'
  | 'three-of-a-kind'
  | 'straight'
  | 'flush'
  | 'full-house'
  | 'four-of-a-kind'
  | 'straight-flush'
  | 'five-of-a-kind' // Balatro：小丑/特殊牌组可凑 5 张同点
  | 'flush-house' // 葫芦 + 同花
  | 'flush-five'; // 5 张同点同花

// 牌型评估结果：最高牌型 + 计数派生事实（供「逐张/按花色/按点数」迭代的小丑读）。
export interface HandEval {
  type: HandType;
  rankCounts: ReadonlyMap<number, number>; // 点数 → 张数（按点数计数接口）
  suitCounts: ReadonlyMap<number, number>; // 花色 → 张数（按花色计数接口）
  isFlush: boolean; // 同花（≥5 张且全同花色）
  isStraight: boolean; // 顺子（5 张相异且连续，含 A 高 / A 低轮子）
}

// ── 纯算法 helper（导出供单测；无副作用，确定性）────────────────────────────

// 按字段计数（点数/花色）。返回普通 Map（值=张数）；调用方若需遍历请自行按 key 排序保证确定性。
function countBy(cards: readonly Card[], pick: (c: Card) => number): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of cards) m.set(pick(c), (m.get(pick(c)) ?? 0) + 1);
  return m;
}

// 5 张相异点数是否构成顺子：常规连续（max-min===4）或 A 低轮子（A-2-3-4-5，A 当 1）。
export function isStraightRanks(distinctRanks: readonly number[]): boolean {
  if (distinctRanks.length !== 5) return false;
  const s = [...distinctRanks].sort((a, b) => a - b);
  if (s[4] - s[0] === 4) return true; // 普通顺（含 10-J-Q-K-A=10..14 的 Broadway）
  // A 低轮子：2,3,4,5,14（A 既高又低）
  return s[0] === 2 && s[1] === 3 && s[2] === 4 && s[3] === 5 && s[4] === 14;
}

// 牌型判定（纯函数：有序卡集 → 稳定结果）。priority 从高到低短路，所以"并列取高"（如葫芦不会被判成对子）。
export function evaluateHand(cards: readonly Card[]): HandEval {
  const rankCounts = countBy(cards, (c) => c.rank);
  const suitCounts = countBy(cards, (c) => c.suit);

  // 张数降序（[最多, 次多, ...]），驱动 N 条/葫芦/两对判定，与具体点数无关。
  const counts = [...rankCounts.values()].sort((a, b) => b - a);
  const maxCount = counts[0] ?? 0;
  const secondCount = counts[1] ?? 0;

  // 同花：≥5 张且只有一种花色。顺子：恰 5 张、5 个相异点数且连续。
  const isFlush = cards.length >= 5 && suitCounts.size === 1;
  const isStraight = cards.length === 5 && rankCounts.size === 5 && isStraightRanks([...rankCounts.keys()]);

  let type: HandType;
  if (maxCount === 5 && isFlush) type = 'flush-five';
  else if (maxCount === 5) type = 'five-of-a-kind';
  else if (maxCount === 3 && secondCount === 2 && isFlush) type = 'flush-house';
  else if (isStraight && isFlush) type = 'straight-flush';
  else if (maxCount === 4) type = 'four-of-a-kind';
  else if (maxCount === 3 && secondCount === 2) type = 'full-house';
  else if (isFlush) type = 'flush';
  else if (isStraight) type = 'straight';
  else if (maxCount === 3) type = 'three-of-a-kind';
  else if (maxCount === 2 && secondCount === 2) type = 'two-pair';
  else if (maxCount === 2) type = 'pair';
  else type = 'high-card';

  return { type, rankCounts, suitCounts, isFlush, isStraight };
}

// ── 系统副作用 helper：按 id 全局定位并写 Resource.current（set 基础值，钳 [min,max]）/ StringVar.value。──
function setResourceBase(world: IWorld, resourceId: string, value: number): void {
  if (!resourceId) return;
  const e = findByComponentId(world, 'Resource', 'id', resourceId);
  if (!e) return;
  const r = world.getComponent<Resource>(e, 'Resource');
  if (r) r.current = value < r.min ? r.min : value > r.max ? r.max : value;
}
function setHandTypeVar(world: IWorld, varId: string, value: string): void {
  const e = findByComponentId(world, 'StringVar', 'id', varId);
  if (!e) return;
  const v = world.getComponent<StringVar>(e, 'StringVar');
  if (v) v.value = value;
}

export const pokerHandCapability = defineCapability({
  id: 't3-poker-hand',
  version: '1.0.0',

  describe: {
    name: 'poker-hand',
    summary:
      '扑克牌型评估器：读同实体 PlayedHand → 确定性判定最高牌型（高牌…同花顺/五条/同花葫芦/同花五）→ 按 rankingTable set 基础 chips/mult 两 Resource，可选写牌型名 StringVar。Balatro 式卡牌玩法底座。',
    semantic: ['tier3', 'mechanic', 'cards', 'poker', 'algorithm'],
    whenToUse:
      'Balatro 式 roguelike 卡牌 / 任何"判牌型给基础分"的玩法。挂 PokerHand{rankingTable,chipsResource,multResource} + PlayedHand{cards} 于同一"牌桌"实体；选牌交互（clickable/random/effect）填 cards，本能力出基础分，小丑用 effect-apply op/order（REQ-012）做修正。',
    examples: [
      'Balatro 牌桌：PokerHand{ rankingTable:{ "pair":{chips:10,mult:2}, "flush":{chips:35,mult:4}, "straight-flush":{chips:100,mult:8} }, chipsResource:"chips", multResource:"mult" } + PlayedHand{cards:[...]}',
      '出同花顺：PlayedHand{ cards:[{suit:0,rank:10},{suit:0,rank:11},{suit:0,rank:12},{suit:0,rank:13},{suit:0,rank:14}] } → 牌型 straight-flush → set chips=100,mult=8',
      '打出同花 → 触发某小丑：PokerHand.handTypeVar:"lastHand" → poker-eval 写 StringVar(lastHand="flush") → condition{string,eq,"flush"} 读到 → 小丑 effect 生效',
    ],
  },

  components: {
    provides: {
      PlayedHand: {
        category: 'event',
        describe: '本次出的牌（有序，供逐张迭代/按花色·点数计数）。由选牌交互装配填充；空=本帧不评估。',
        fields: {
          cards: { type: 'string', describe: '出的牌数组 Card[]，每张 {suit:0..3, rank:2..14(A=14,J/Q/K=11/12/13)}；有序' },
        },
      },
      PokerHand: {
        category: 'config',
        describe: '牌型评估器配置（单例挂"牌桌"实体）：牌型→基础分表 + 输出 Resource/StringVar 路由。',
        fields: {
          rankingTable: { type: 'string', describe: '牌型名→{chips,mult} 的 Record（纯数据表，设计可调，键取自牌型全集）' },
          chipsResource: { type: 'string', describe: '写基础 chips 的 Resource id（按 id 全局定位）' },
          multResource: { type: 'string', describe: '写基础 mult 的 Resource id' },
          handTypeVar: { type: 'string', describe: '可选：写牌型名的 StringVar id（供 condition string 读"打出某牌型→小丑触发"）' },
        },
      },
    },
    reads: ['PokerHand', 'PlayedHand', 'Resource'],
    writes: ['Resource', 'StringVar'],
    consumes: [],
  },

  config: {},

  systems: [
    {
      // poker-eval：读同实体 PlayedHand → 判牌型 → set 基础 chips/mult + 牌型名。Update 相位
      // （早于小丑结算的 effect-apply=Commit）：先把"基础值"写进 Resource，再被同 tick 的 ×mult/+chips 修正。
      id: 'poker-eval',
      phase: SystemPhase.Update,
      reads: ['PokerHand', 'PlayedHand', 'Resource'],
      writes: ['Resource', 'StringVar'],
      consumes: [],
      execute(world: IWorld) {
        for (const [eid] of world.query('PokerHand', 'PlayedHand')) {
          const cfg = world.getComponent<PokerHand>(eid, 'PokerHand')!;
          const played = world.getComponent<PlayedHand>(eid, 'PlayedHand')!;
          if (played.cards.length === 0) continue; // 无出牌 → 不评估（基础分由装配层在新回合清零）
          const evald = evaluateHand(played.cards);
          const base = cfg.rankingTable[evald.type] ?? { chips: 0, mult: 0 };
          setResourceBase(world, cfg.chipsResource, base.chips);
          setResourceBase(world, cfg.multResource, base.mult);
          if (cfg.handTypeVar) setHandTypeVar(world, cfg.handTypeVar, evald.type);
        }
      },
    },
  ],
});
