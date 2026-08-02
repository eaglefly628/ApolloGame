// Game A ·《掼蛋夜宴》—— AI 层（capability-plan §4 例外②·owner 过审）。
// 结构=gdd §5：外层策略 = t2-behavior-tree **纯数据树**（一棵树·档位/性格差异全走黑板值，不改树）；
// 内层出牌 = 候选枚举（t3-hand-pattern.legalResponses·确定性升序）+ 估值规则查表。
// 确定性：无墙钟、无裸随机——「多变」性格的浮动经 mulberry32(种子) 取数；同种子同局面同决策。
// 拟人思考延迟=宿主表现层（不进本层）。宗师偷看=发牌期种子化记录（session 侧），此处以进攻阈值消费。
import type { IWorld } from '@zerocraft/engine/engine/core/types.js';
import type { Card, RandomSeed, Flag, Resource } from '@zerocraft/engine/engine/protocol/components.js';
import {
  tickBehaviorTree, registerBTLeaves, type BehaviorTree, type BTLeafTable,
} from '@zerocraft/engine/skills/tier2/index.js';
import { legalResponses, beats, effRank, type HandPatternConfig, type PatternMatch } from '@zerocraft/engine/skills/tier3/index.js';
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
  peekedOpp?: readonly number[]; // L4 宗师本座发牌期偷看到的对手牌码（真消费=知对手火力·A-019）；非 L4 空
}
export interface AiDecision {
  move: 'lead' | 'pass' | 'bomb' | 'press' | 'min';
  cards: number[] | null; // null=过（牌下标无关·session 按牌码删）
  match: PatternMatch | null;
}

const isBombFamily = (m: PatternMatch): boolean => m.family === 'bomb' || m.family === 'straight-flush' || m.family === 'sky';
const cardsOf = (m: PatternMatch): number[] => m.cards.map((c) => c.suit * 100 + c.rank);

/**
 * 天然同点炸弹（family 'bomb' 且 wildsUsed===0：手里真有 4~10 张同点）占用的牌码集合。
 * 「不拆炸弹」是掼蛋铁律——炸弹是反压利器，拆成三张/对子/单张=毁炸、牌力大减（web 策略：拆炸让单牌变多、
 * 牌型变散、炸数减少）。排除同花顺/天王炸（与普通牌大量重叠·全护会把 AI 逼到死攥牌）与逢人配拼的炸
 * （wildsUsed>0：一张百搭最多成一个炸·不该把每个三张都当潜在炸锁死）。领出/应对共用此护栏。
 */
function naturalBombCards(candidates: readonly PatternMatch[]): Set<number> {
  const s = new Set<number>();
  for (const m of candidates) if (m.family === 'bomb' && m.wildsUsed === 0) for (const c of m.cards) s.add(c.suit * 100 + c.rank);
  return s;
}
const consumesBomb = (m: PatternMatch, bomb: Set<number>): boolean => m.cards.some((c) => bomb.has(c.suit * 100 + c.rank));

// ── 不拆牌型（owner 2026-07-18「提示别拆我的三条凑对子」）──────────────────────────
// 手里各点数的**非逢人配**张数（逢人配灵活·不算固定组）。
function rankCounts(hand: readonly Card[], cfg: HandPatternConfig): Map<number, number> {
  const wr = cfg.wild?.rank ?? -1, ws = cfg.wild?.suit ?? -1;
  const m = new Map<number, number>();
  for (const c of hand) if (!(c.rank === wr && c.suit === ws)) m.set(c.rank, (m.get(c.rank) ?? 0) + 1);
  return m;
}
/** play 是否「拆了 ≥3 张的同点组」（用了某点一部分、留下残余）——整只出该组（用光）不算拆。 */
function splitsGroup(m: PatternMatch, counts: Map<number, number>, cfg: HandPatternConfig): boolean {
  const wr = cfg.wild?.rank ?? -1, ws = cfg.wild?.suit ?? -1;
  const used = new Map<number, number>();
  for (const c of m.cards) if (!(c.rank === wr && c.suit === ws)) used.set(c.rank, (used.get(c.rank) ?? 0) + 1);
  for (const [r, u] of used) { const held = counts.get(r) ?? 0; if (held >= 3 && u < held) return true; }
  return false;
}
/** 软偏好：候选里有「不拆 ≥3 组」的就只留它们（否则原样返回·hand 缺省=不过滤）。 */
function preferNoSplit(pool: PatternMatch[], cfg: HandPatternConfig, hand?: readonly Card[]): PatternMatch[] {
  if (!hand) return pool;
  const counts = rankCounts(hand, cfg);
  const clean = pool.filter((m) => !splitsGroup(m, counts, cfg));
  return clean.length > 0 ? clean : pool;
}

/**
 * 领出选牌启发（hint 与 AI chooseTurn 共用·纯函数·确定性·全档一致）。掼蛋策略（web 校准·owner 2026-07-18）：
 *   ①**先出小牌·保留大牌**——留 K/A/级牌/王（premium）作后手反压，先倒小牌型探路/倒库存（原实现只按「长度→最小
 *     rank」→ 会先甩高对，如打2时先领对2（级牌·次大）——owner 报「先出大的后出小的」根因）；
 *   ②**绝不主动领炸 + 不拆炸凑型**——炸弹/同花顺/天王炸留反压，成炸的牌不拿去当三张/对子领出；
 *   ③在可领池里倾长牌型倒库存（顺子/三连对/钢板/三带二 > 三张 > 对子 > 单张·防退化成单张流），同长取最小 rank。
 * candidates = legalResponses(hand, null, cfg)（已升序）。空手返回 null（兜底过）。
 */
export function pickLead(candidates: readonly PatternMatch[], cfg: HandPatternConfig, hand?: readonly Card[]): PatternMatch | null {
  if (candidates.length === 0) return null;
  const bombCards = naturalBombCards(candidates);
  const nonBomb = candidates.filter((m) => !isBombFamily(m));
  const safe = nonBomb.filter((m) => !consumesBomb(m, bombCards)); // 不拆炸
  // 无安全非炸牌（手牌全是成炸的牌·如满手 5张6+5张Q 两只炸）→ 只在「整只炸弹 + 不拆炸的非炸」里挑：
  // 整炸=正当收尾（不拆），拆炸的 full/plate 一律排除（否则同长同 rank 下 full 排在炸前会被选中=拆炸·owner 报根因）。
  const base = safe.length > 0 ? safe : candidates.filter((m) => isBombFamily(m) || !consumesBomb(m, bombCards));
  // 保留大牌：K 及以上（K/A/级牌/王）留后手·先从非 premium 里领；无非 premium 才动大牌。
  const premium = effRank(13, cfg); // effRank(K)——含 K/A/级牌/王
  const nonPrem = base.filter((m) => m.rank < premium);
  // 尽量不拆 ≥3 组（软偏好·owner 2026-07-18「别拆我三条凑对子」）——传 hand 时生效。
  const pool = preferNoSplit(nonPrem.length > 0 ? nonPrem : base, cfg, hand);
  let best = pool[0]!;
  for (const m of pool) {
    if (m.length > best.length || (m.length === best.length && m.rank < best.rank)) best = m;
  }
  return best;
}

/**
 * 最小应对启发（hint 用）：取最小的**不拆炸**应对——安全非炸牌型优先，无则退到整只炸弹（整炸=没拆·如唯一
 * 能压钢板的真炸）；只剩「拆炸凑小牌型」的应对返回 null（=建议过·炸留反压·owner 报「四张7拆成两对」根因）。
 * candidates=已 beats 过滤的应对候选（升序）。整炸不算拆——真炸时仍会提示它（曾并入 A-008 已修 `214fc846`）。
 */
export function pickMinResponse(candidates: readonly PatternMatch[], cfg?: HandPatternConfig, hand?: readonly Card[]): PatternMatch | null {
  const bombCards = naturalBombCards(candidates);
  const usable = candidates.filter((m) => isBombFamily(m) || !consumesBomb(m, bombCards)); // 不拆炸（整炸可）
  // 尽量不拆 ≥3 组（软·owner 2026-07-18）——传 cfg+hand 时生效；候选升序·取最小的不拆组解。
  const pool = cfg && hand ? preferNoSplit(usable, cfg, hand) : usable;
  return pool[0] ?? null;
}

/** 一手决策：写黑板 → tick 策略树 → 按 move 令牌从候选里取牌（估值=确定性规则查表）。 */
export function chooseTurn(world: IWorld, input: AiTurnInput, seed?: RandomSeed): AiDecision {
  ensureBTLeaves();
  const cfg = input.cfg;
  const tierIdx = AI_TIERS.findIndex((t) => t.id === input.tier);
  // 应对候选经引擎自身 beats 复核：滤掉「意图能压、matchPattern 规范判读却压不过」的歧义应对
  //（曾治引擎 t3-hand-pattern 逢人配判读缺口·A-008·已修 `214fc846`→防御性复核·幂等），只留 act 真会收的那批 → AI 不空过、不出被判非法的牌。
  const raw = legalResponses(input.hand, input.target, cfg);
  const candidates = input.target === null ? raw : raw.filter((m) => beats(m.cards, input.target!, cfg));
  const nonBomb = candidates.filter((m) => !isBombFamily(m));

  // 宗师读牌真消费（L4·A-019）：偷看到对手握 premium（K/A/级牌/王）→ 知对手有后手火力，抢先倒牌自保（+12 进攻）。
  // 偷看保真度→黑板初值（引擎 REQ-BT 口径·A-021）；HUD「会读牌」公平告知由此为真（决策真吃偷看·非纯摆设）。
  const peekLoaded = !!input.peekedOpp?.some((code) => effRank(code % 100, cfg) >= effRank(13, cfg));
  // 黑板写入（L1 无让牌/压制概念=旗恒 false；宗师 +10 进攻；多变 ±20 浮动；读到对手火力 +12）
  const aggBase = PERSONALITY_AGGRESSION[input.personality];
  const agg =
    aggBase +
    (input.tier === 'l4' ? 10 : 0) +
    (input.personality === 'wild' ? Math.floor(input.jitter * 41) - 20 : 0) +
    (peekLoaded ? 12 : 0);
  setFlag(world, 'bb-leading', input.target === null);
  setFlag(world, 'bb-partner-winning', tierIdx >= 1 && input.partnerWinning);
  setFlag(world, 'bb-only-bomb', candidates.length > 0 && nonBomb.length === 0 && input.target !== null);
  setFlag(world, 'bb-endgame', tierIdx >= 2 && input.minOppCards <= 5);
  setRes(world, 'bb-aggression', Math.max(0, Math.min(100, agg)));

  const tick = tickBehaviorTree(STRATEGY_TREE, BT_GAME_ID, world, 'bb', seed);
  const move = (tick.action?.move as AiDecision['move']) ?? 'min';

  const pick = (m: PatternMatch | undefined): AiDecision =>
    m ? { move, cards: cardsOf(m), match: m } : { move: 'pass', cards: null, match: null };

  // 应对护炸：不拿成炸的牌去凑小牌型压小墩（掼蛋铁律·owner 报「把四张7拆成两对出」根因）。
  const bombCards = naturalBombCards(candidates);
  // 应对候选：不拆炸 + 尽量不拆 ≥3 组（owner「别拆我三条凑对子」·软偏好）。
  const safeNonBomb = preferNoSplit(nonBomb.filter((m) => !consumesBomb(m, bombCards)), cfg, input.hand);

  switch (move) {
    case 'lead':
      // 领出：先出小牌保留大牌、倾长倒库存、不主动领炸/不拆炸、不拆三条（pickLead·hint 与 AI 同一启发）。
      return pick(pickLead(candidates, cfg, input.hand) ?? undefined);
    case 'pass':
      return { move: 'pass', cards: null, match: null };
    case 'bomb':
      // 真炸=整只炸弹压（family bomb·非拆散）；无炸兜底取候选首。
      return pick(candidates.find(isBombFamily) ?? candidates[0]);
    case 'press': {
      // 压制节奏：取最大的**不拆炸/不拆组**非炸应对；无则够凶(≥50)动整炸、否则宁可过（不为小墩拆炸）。
      if (safeNonBomb.length > 0) return pick(safeNonBomb[safeNonBomb.length - 1]);
      if (agg >= 50) return pick(candidates.find(isBombFamily) ?? candidates[0]);
      return { move: 'pass', cards: null, match: null };
    }
    case 'min':
    default:
      // 最小应对：取最小的**不拆炸**非炸应对；只剩拆炸的应对→过（炸留反压·不拆）。
      return safeNonBomb.length > 0 ? pick(safeNonBomb[0]) : { move: 'pass', cards: null, match: null };
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
