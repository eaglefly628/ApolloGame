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
import { legalResponses, beats, type HandPatternConfig, type PatternMatch } from '@skills/tier3/index.js';
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

/**
 * 领出选牌启发（hint 与 AI chooseTurn 共用·纯函数·确定性·全档一致）。
 * 掼蛋以先出光手牌者胜 → 领出的正解是**倾长牌型快速倒库存**、把「手数」压到最少（顺子/三连对/钢板/
 * 三带二 6/5 张 > 三张 > 对子 > 单张），同长取最小 rank（不浪费大牌）；两条保留原则：
 *   ①**绝不主动领炸**——炸弹/同花顺/天王炸留作被压时反击；
 *   ②**不拆炸凑牌型**——手里成炸的那几张牌不拿去当三张/对子领出（否则毁掉炸弹，观感像 bug）。
 * 故领出只从「安全非炸牌型」（组合不含任何成炸牌）里挑；仅当无安全牌可领（残局手牌全成炸）才用全候选收尾。
 * 这修掉「领出恒取 legalResponses[0]=最小单张 → 全局退化成单张流」+「领三张拆掉四张炸」（owner 2026-07-18 报）。
 * candidates = legalResponses(hand, null, cfg)（已 tier→rank→length 升序）。空手返回 null（兜底过）。
 */
export function pickLead(candidates: readonly PatternMatch[]): PatternMatch | null {
  if (candidates.length === 0) return null;
  // 保炸不拆——只护**天然同点炸弹**（family 'bomb' 且 wildsUsed===0：手里真有 4~10 张同点，拆成三张/
  // 对子=毁炸·观感像 bug）。三条排除，防「过度保炸」把 AI 逼到死攥牌：
  //   ① 同花顺/天王炸：牌与普通牌型大量重叠（如 ♥A2345 占掉一串低红桃），且「不主动领它们」已由 nonBomb 过滤保证；
  //   ② 逢人配拼出的炸（wildsUsed>0）：一张逢人配能把**任一**三张凑成炸，全保留=把每个三张都锁死（错）——
  //      逢人配只有一张，最多成一个炸，不该让所有三张都当「潜在炸」被保留。
  const bombCards = new Set<number>();
  for (const m of candidates) if (m.family === 'bomb' && m.wildsUsed === 0) for (const c of m.cards) bombCards.add(c.suit * 100 + c.rank);
  const nonBomb = candidates.filter((m) => !isBombFamily(m));
  const safe = nonBomb.filter((m) => !m.cards.some((c) => bombCards.has(c.suit * 100 + c.rank)));
  const pool = safe.length > 0 ? safe : candidates; // 无安全非炸牌（全成炸）→ 残局用全候选收尾
  let best = pool[0];
  for (const m of pool) {
    if (m.length > best.length || (m.length === best.length && m.rank < best.rank)) best = m;
  }
  return best;
}

/** 一手决策：写黑板 → tick 策略树 → 按 move 令牌从候选里取牌（估值=确定性规则查表）。 */
export function chooseTurn(world: IWorld, input: AiTurnInput, seed?: RandomSeed): AiDecision {
  ensureBTLeaves();
  const cfg = input.cfg;
  const tierIdx = AI_TIERS.findIndex((t) => t.id === input.tier);
  // 应对候选经引擎自身 beats 复核：滤掉「意图能压、matchPattern 规范判读却压不过」的歧义应对
  //（引擎 t3-hand-pattern 逢人配判读缺口·A-008），只留 act 真会收的那批 → AI 不空过、不出被判非法的牌。
  const raw = legalResponses(input.hand, input.target, cfg);
  const candidates = input.target === null ? raw : raw.filter((m) => beats(m.cards, input.target!, cfg));
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
    case 'lead':
      // 领出：全档倾长牌型倒库存、不主动领炸（pickLead·hint 与 AI 同一启发·防单张流退化）。
      return pick(pickLead(candidates) ?? undefined);
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
