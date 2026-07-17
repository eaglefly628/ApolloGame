// Game A ·《掼蛋夜宴》—— AI 层（capability-plan §4 例外②·owner 过审）。
// 结构=gdd §5：外层策略 = t2-behavior-tree **纯数据树**（一棵树·档位/性格差异全走黑板值，不改树）；
// 内层出牌 = 候选枚举（t3-hand-pattern.legalResponses·确定性升序）+ 估值规则查表。
// 确定性：无墙钟、无裸随机——「多变」性格的浮动经 mulberry32(种子) 取数；同种子同局面同决策。
// 拟人思考延迟=宿主表现层（不进本层）。宗师偷看=发牌期种子化记录（session 侧），此处以进攻阈值消费。
import type { IWorld } from '@engine/core/types.js';
import type { Card, RandomSeed, Flag, Resource } from '@engine/protocol/components.js';
import {
  tickBehaviorTree, registerBTLeaves, type BehaviorTree, type BTLeafTable,
} from '@skills/tier2/index.js';
import { legalResponses, type HandPatternConfig, type PatternMatch } from '@skills/tier3/index.js';
import { AI_TIERS, type AiTierSpec, type SeatSpec } from './rules.js';

export const BT_GAME_ID = 'game-a';

// ── 策略树（纯数据·一棵·黑板驱动）────────────────────────────────────────────
// 黑板契约（session 每次决策前写入 world 的 'bb' 实体）：
//   Flag  bb-leading          本手为领出
//   Flag  bb-partner-winning  当前墩由队友压住（让牌语义·L1 不设）
//   Flag  bb-only-bomb        应对候选只剩炸弹族
//   Flag  bb-endgame          有对手余牌 ≤5（压制节奏·L3+ 才设）
//   Resource bb-aggression    进攻倾向 0..100（性格基值+档位修正+多变浮动）
export const STRATEGY_TREE: BehaviorTree = {
  root: {
    type: 'selector',
    name: 'guandan-turn',
    children: [
      { type: 'sequence', children: [{ type: 'condition', leaf: 'flag', args: { id: 'bb-leading' } }, { type: 'action', leaf: 'decide', args: { move: 'lead' } }] },
      { type: 'sequence', children: [{ type: 'condition', leaf: 'flag', args: { id: 'bb-partner-winning' } }, { type: 'action', leaf: 'decide', args: { move: 'pass' } }] },
      {
        type: 'sequence',
        children: [
          { type: 'condition', leaf: 'flag', args: { id: 'bb-only-bomb' } },
          { type: 'condition', leaf: 'res-gte', args: { id: 'bb-aggression', value: 60 } },
          { type: 'action', leaf: 'decide', args: { move: 'bomb' } },
        ],
      },
      { type: 'sequence', children: [{ type: 'condition', leaf: 'flag', args: { id: 'bb-only-bomb' } }, { type: 'action', leaf: 'decide', args: { move: 'pass' } }] },
      { type: 'sequence', children: [{ type: 'condition', leaf: 'flag', args: { id: 'bb-endgame' } }, { type: 'action', leaf: 'decide', args: { move: 'press' } }] },
      { type: 'action', leaf: 'decide', args: { move: 'min' } },
    ],
  },
};

// ── 叶注册表（通用读黑板叶·函数=游戏层代码（TS 例外口径）·树/参数全为数据）─────────
const LEAVES: BTLeafTable = {
  flag: (world, _e, args) => {
    for (const [eid] of world.query('Flag')) {
      const f = world.getComponent<Flag>(eid, 'Flag');
      if (f && f.id === args.id) return !!f.active;
    }
    return false;
  },
  'res-gte': (world, _e, args) => {
    for (const [eid] of world.query('Resource')) {
      const r = world.getComponent<Resource>(eid, 'Resource');
      if (r && r.id === args.id) return r.current >= Number(args.value ?? 0);
    }
    return false;
  },
  decide: (_w, _e, args) => ({ move: String(args.move ?? 'min') }),
};
let leavesRegistered = false;
export function ensureBTLeaves(): void {
  if (leavesRegistered) return;
  registerBTLeaves(BT_GAME_ID, LEAVES);
  leavesRegistered = true;
}

// ── 性格基值（characters.md 标签 → 进攻倾向·风格与难度正交）──────────────────────
export type Personality = 'steady' | 'sharp' | 'wild';
export const PERSONALITY_AGGRESSION: Record<Personality, number> = {
  steady: 30, // 沉稳·护家（沈玉薇）
  sharp: 80, // 锋利·好胜（林曼笙）
  wild: 45, // 跳脱·爱起哄（顾念念·浮动 ±20 由种子取）
};
export function personalityOf(seat: SeatSpec): Personality {
  if (!seat.traits) return 'steady';
  if (seat.traits.includes('锋利')) return 'sharp';
  if (seat.traits.includes('跳脱')) return 'wild';
  return 'steady';
}

// ── 决策输入（session 投影·纯数据）────────────────────────────────────────────
export interface AiTurnInput {
  cfg: HandPatternConfig; // 本盘判型 config（levelRank 随盘变）
  hand: readonly Card[];
  target: readonly Card[] | null; // null=领出
  partnerWinning: boolean; // 当前墩由队友压住
  minOppCards: number; // 对手最少余牌
  tier: AiTierSpec['id'];
  personality: Personality;
  jitter: number; // [0,1) 种子取数（多变浮动·session 提供）
}
export interface AiDecision {
  move: 'lead' | 'pass' | 'bomb' | 'press' | 'min';
  cards: number[] | null; // null=过（牌下标无关·session 按牌码删）
  match: PatternMatch | null;
}

const isBombFamily = (m: PatternMatch): boolean => m.family === 'bomb' || m.family === 'straight-flush' || m.family === 'sky';
const cardsOf = (m: PatternMatch): number[] => m.cards.map((c) => c.suit * 100 + c.rank);

/** 一手决策：写黑板 → tick 策略树 → 按 move 令牌从候选里取牌（估值=确定性规则查表）。 */
export function chooseTurn(world: IWorld, input: AiTurnInput, seed?: RandomSeed): AiDecision {
  ensureBTLeaves();
  const cfg = input.cfg;
  const tierIdx = AI_TIERS.findIndex((t) => t.id === input.tier);
  const candidates = legalResponses(input.hand, input.target, cfg);
  const nonBomb = candidates.filter((m) => !isBombFamily(m));

  // 黑板写入（L1 无让牌/压制概念=旗恒 false；宗师 +10 进攻；多变 ±20 浮动）
  const aggBase = PERSONALITY_AGGRESSION[input.personality];
  const agg =
    aggBase +
    (input.tier === 'l4' ? 10 : 0) +
    (input.personality === 'wild' ? Math.floor(input.jitter * 41) - 20 : 0);
  setFlag(world, 'bb-leading', input.target === null);
  setFlag(world, 'bb-partner-winning', tierIdx >= 1 && input.partnerWinning);
  setFlag(world, 'bb-only-bomb', candidates.length > 0 && nonBomb.length === 0 && input.target !== null);
  setFlag(world, 'bb-endgame', tierIdx >= 2 && input.minOppCards <= 5);
  setRes(world, 'bb-aggression', Math.max(0, Math.min(100, agg)));

  const tick = tickBehaviorTree(STRATEGY_TREE, BT_GAME_ID, world, 'bb', seed);
  const move = (tick.action?.move as AiDecision['move']) ?? 'min';

  const pick = (m: PatternMatch | undefined): AiDecision =>
    m ? { move, cards: cardsOf(m), match: m } : { move: 'pass', cards: null, match: null };

  switch (move) {
    case 'lead': {
      // 领出估值：L1 最小起；L3+ 优先长牌型倾库存（同长取最小）；不领炸（炸留压制）
      const pool = nonBomb.length > 0 ? nonBomb : candidates;
      if (pool.length === 0) return { move: 'pass', cards: null, match: null };
      if (tierIdx >= 2) {
        let best = pool[0];
        for (const m of pool) if (m.length > best.length) best = m;
        return pick(best);
      }
      return pick(pool[0]);
    }
    case 'pass':
      return { move: 'pass', cards: null, match: null };
    case 'bomb':
      return pick(candidates.find(isBombFamily) ?? candidates[0]);
    case 'press': {
      // 压制节奏：非炸候选取最大；无非炸且攻性≥50 用炸，否则最小
      if (nonBomb.length > 0) return pick(nonBomb[nonBomb.length - 1]);
      if (agg >= 50) return pick(candidates.find(isBombFamily) ?? candidates[0]);
      return pick(candidates[0]);
    }
    case 'min':
    default:
      return pick(nonBomb[0] ?? candidates[0]);
  }
}

// 黑板小工具（'bb' 实体上的 Flag/Resource·蓝图静态建好）
function setFlag(world: IWorld, id: string, active: boolean): void {
  for (const [eid] of world.query('Flag')) {
    const f = world.getComponent<Flag>(eid, 'Flag');
    if (f?.id === id) {
      f.active = active;
      return;
    }
  }
}
function setRes(world: IWorld, id: string, value: number): void {
  for (const [eid] of world.query('Resource')) {
    const r = world.getComponent<Resource>(eid, 'Resource');
    if (r?.id === id) {
      r.current = value;
      return;
    }
  }
}
