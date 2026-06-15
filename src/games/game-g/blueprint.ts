import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import { transformCapability, nextRandom, tagCapability, resourceCapability, stateCapability, timerCapability } from '@atom-skills/index.js';
import { tweenCapability } from '@skills/tier1/index.js';
import { groupCountCapability, eventWhenCapability, effectApplyCapability } from '@skills/tier2/index.js';
import { isStraightRanks } from '@skills/tier3/poker-hand.js'; // 复用 Game E 牌型算法(顺子检测)
import type { HandType } from '@skills/tier3/poker-hand.js';
import type { RandomSeed } from '@engine/protocol/components.js';

// ═══════════════════════════════════════════════════════════════
//  Game G《翻命扑克》—— outcome-first + 3D 表现（v2，用户 2026-06-14 拍板）。
//
//  统一原则：**gameplay = 确定性数据（规则先定胜负）；表现 = 3D 翻牌，单向被胜负驱动、不回灌 gameplay。**
//  不是物理掷出生死——是**先定胜负、再 choreograph 物理翻牌**到既定面：正面=活、反面=死。
//
//    胜负规则 = decideFaceUp(favor, 种子)：属性加权的**确定性种子硬币**（lockstep 安全；越高 favor 越易正面）。
//    翻牌表现 = tween 把 Transform.rotation 缓动到既定面（正面 ≡ 2π·k、反面 ≡ 2π·k+π）。
//    3D 渲染 = ThreeRenderer 读 Card3D+Transform：画 3D 翻转 + 抛飞相撞编排（按 side/pairKey 配对）。
//
//  零游戏专属系统、零新 capability：复用现成 tween + Transform + random(PRNG)；3D 只在渲染后端 + render-only Card3D。
//  红线：翻牌/抛飞/相撞都是表现，不决定胜负 → 跨端浮点不影响 gameplay → 实时多人/多人干预可行（权威=整数胜负）。
//
//  （已回退：旧 settle-read/impulse + 物理决定胜负的 buildGameGBlueprint/buildGameGMelee —— 见 DESIGN §v2。）
// ═══════════════════════════════════════════════════════════════

export const CARD_W = 120;
export const CARD_H = 168;
const FLIP_SPINS = 2; // 翻牌空翻圈数（drama，纯表现）
const FLIP_DURATION = 90; // 翻牌时长（tick）

// 落定到既定面的目标旋转角：正面 = 2π·spins（≡0，cos>0），反面 = 2π·spins+π（≡π，cos<0）。
function flipTarget(faceUp: boolean, spins: number): number {
  return 2 * Math.PI * spins + (faceUp ? 0 : Math.PI);
}

/**
 * 胜负规则（v2 核心）：**属性加权的确定性种子硬币**。
 * P(正面=活) = clamp(favor/100, 0.05, 0.95)；用引擎 PRNG（nextRandom 推进 rng 序列）→ lockstep 安全、可重放。
 * 这是上游"先定胜负"的决策函数（单机本地跑；多人时即服务器权威的同一份确定性逻辑）。
 */
export function decideFaceUp(favor: number, rng: RandomSeed): boolean {
  const p = Math.min(0.95, Math.max(0.05, favor / 100));
  return nextRandom(rng) < p;
}

// favor 钳到 [5,95] 整数（士气/溃散叠加后用）。
const clampFavor = (f: number): number => Math.max(5, Math.min(95, Math.round(f)));

// 标准 52 牌：序号 → 点数/花色（贴"52 牌组"语义；render-only，渲染器画牌面用）。
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C']; // ♠♥♦♣
export function cardFace(i: number): { rank: string; suit: string } {
  const idx = ((i % 52) + 52) % 52; // 归一到 [0,52)
  return { rank: RANKS[idx % 13], suit: SUITS[Math.floor(idx / 13) % 4] };
}

interface FlipOpts {
  faceUp: boolean;
  x: number;
  y: number;
  spins?: number;
  frontTint?: number;
  backTint?: number;
  side?: 'a' | 'b';
  pairKey?: number;
  rank?: string;
  suit?: string;
}

// 一张牌的 3D 翻牌实体：Transform(位姿) + Card3D(正反面/牌面/配对，render-only) + Tween(翻到既定面)。
function flipCardEntity(o: FlipOpts): EntityBlueprint {
  const card: Record<string, unknown> = { frontTint: o.frontTint ?? 0xeab308, backTint: o.backTint ?? 0x334155, width: CARD_W, height: CARD_H };
  if (o.side) card.side = o.side;
  if (o.pairKey !== undefined) card.pairKey = o.pairKey;
  if (o.rank) card.rank = o.rank;
  if (o.suit) card.suit = o.suit;
  return {
    Transform: { x: o.x, y: o.y, rotation: 0, scaleX: 1, scaleY: 1 },
    Card3D: card,
    Tween: { target: 'Transform.rotation', from: 0, to: flipTarget(o.faceUp, o.spins ?? FLIP_SPINS), elapsed: 0, duration: FLIP_DURATION, easing: 'easeOut', done: false },
  };
}

/**
 * 单张 3D 翻牌（既定胜负作入参）：胜负先定（faceUp）、tween 翻到该面。
 * 用于浏览器骨架 demo（按钮直接给定结果）与最小验证。
 */
export function buildGameG3DFlip(faceUp: boolean, spins: number = FLIP_SPINS): WorldBlueprint {
  return {
    capabilities: [transformCapability, tweenCapability],
    entities: { card: flipCardEntity({ faceUp, x: 0, y: 0, spins }) },
  };
}

// 一张参战牌（最弱 LLM 能填）：id + 属性 favor（升级偏置，越高越易活）+ 可选位置/外观/牌面。
export interface FateCard {
  id: string;
  favor: number; // 0..100：属性/局外升级偏置 → P(正面=活)
  x?: number;
  y?: number;
  spins?: number;
  frontTint?: number;
  backTint?: number;
  rank?: string; // 缺省按序号自动派牌面
  suit?: string;
}

/**
 * 一局掷命（v2）：对每张牌按其 favor 跑**属性加权种子硬币**先定胜负，再 3D 翻到既定面。
 * seed 决定整局结果（同 seed+同牌 → 同结果，确定性/可重放/多人一致）。胜负=数据决策，翻牌=表现。
 */
export function buildGameGDuel3D(cards: FateCard[], seed: number = 1): WorldBlueprint {
  const rng: RandomSeed = { type: 'RandomSeed', seed, sequence: 0 };
  const entities: Record<string, EntityBlueprint> = {};
  const n = cards.length;
  cards.forEach((c, i) => {
    const faceUp = decideFaceUp(c.favor, rng); // 胜负先定（属性加权种子）
    const x = c.x ?? (i - (n - 1) / 2) * (CARD_W + 40); // 缺省横向排开
    const f = cardFace(i);
    entities[c.id] = flipCardEntity({ faceUp, x, y: c.y ?? 0, spins: c.spins, frontTint: c.frontTint, backTint: c.backTint, rank: c.rank ?? f.rank, suit: c.suit ?? f.suit });
  });
  return { capabilities: [transformCapability, tweenCapability], entities };
}

// ═══════════════════════════════════════════════════════════════
//  MVP-1：收口"一局"（outcome-first）+ 体量与撞击观感。两队牌按 favor 掷命（规则先定正/反）→
//  3D 牌阵抛飞相撞落定表现 → 数存活（group-count 按队 Tag）→ 翻牌演完那拍比存活数定胜负 → 结算掉材。
//  全是 gameF 重组、零新 capability：胜负=数据(decideFaceUp)，存活=Tag 含 ALIVE 位，
//  判胜负=group-count→event-when(vsResource 比两队存活,edge)→effect(set-state 胜者 + 给材料)。
//  布局：A[i] 与 B[i] 配成对（同 pairKey，A 左 B 右），渲染器据此让两牌跃向同一相撞点（撞击观感，纯表现）。
//  门=Timer(翻牌时长)：动画演完再结算；胜负其实从装配即定（确定性/可重放/多人一致）。
// ═══════════════════════════════════════════════════════════════
export const TEAM_A = 1 << 1; // 我方
export const TEAM_B = 1 << 2; // 敌方
export const ALIVE = 1 << 3; // 落定正面=活（Tag 含此位才计入存活）
const MATCH_REWARD = 10; // 我方(A)胜 → 材料 +N
const A_FRONT = 0xeab308; // 我方牌面暖金
const B_FRONT = 0x38bdf8; // 敌方牌面冷青
const CARD_BACK = 0x334155; // 反面石板
// 牌阵网格（2D px）：每个 cell 一对（A 左 / B 右），跃向 cell 中心相撞。
const CELL_W = 200;
const CELL_H = 220;
const PAIR_DX = 66; // 对内 A/B 左右分开

function gridCols(pairs: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(pairs * 1.7))); // 略宽于正方，贴 16:9 台面
}
function cellCenter(i: number, cols: number, total: number): { cx: number; cy: number } {
  const rows = Math.ceil(total / cols);
  const col = i % cols;
  const row = Math.floor(i / cols);
  return { cx: (col - (cols - 1) / 2) * CELL_W, cy: (row - (rows - 1) / 2) * CELL_H };
}

const MATCH_CAPS = [
  transformCapability,
  tweenCapability,
  tagCapability,
  resourceCapability,
  stateCapability,
  timerCapability,
  groupCountCapability,
  eventWhenCapability,
  effectApplyCapability,
];

/**
 * 一局 NvN 掷命（MVP-1）：teamA(我) vs teamB(敌)。装配顺序 teamA→teamB 先把胜负全定下来（PRNG 序列确定、
 * 与既有测试回放一致），再把 A[i]/B[i] 配对铺进牌阵网格（撞击观感由渲染器据 side/pairKey 编排）。
 * group-count 数两队存活 → Timer 到点(翻牌演完)→ 比存活数 → 写 winner 状态 + 我方胜给材料。
 */
export function buildGameGMatch(teamA: FateCard[], teamB: FateCard[], seed: number = 1, reward: number = MATCH_REWARD): WorldBlueprint {
  const rng: RandomSeed = { type: 'RandomSeed', seed, sequence: 0 };
  const entities: Record<string, EntityBlueprint> = {};

  // ① 先定胜负（顺序 A 全部 → B 全部，PRNG 序列确定、测试可回放）。
  const facesA = teamA.map((c) => decideFaceUp(c.favor, rng));
  const facesB = teamB.map((c) => decideFaceUp(c.favor, rng));

  // ② 配对铺阵：A[i]/B[i] 同 cell（A 左 B 右、同 pairKey）→ 渲染器让两牌跃向 cell 中心相撞。
  const pairs = Math.max(teamA.length, teamB.length);
  const cols = gridCols(pairs);
  const place = (c: FateCard, faceUp: boolean, team: number, side: 'a' | 'b', pairKey: number, front: number): void => {
    const { cx, cy } = cellCenter(pairKey, cols, pairs);
    const f = cardFace(pairKey);
    const ent = flipCardEntity({
      faceUp,
      x: c.x ?? cx + (side === 'a' ? -PAIR_DX : PAIR_DX),
      y: c.y ?? cy,
      spins: c.spins,
      frontTint: c.frontTint ?? front,
      backTint: c.backTint ?? CARD_BACK,
      side,
      pairKey,
      rank: c.rank ?? f.rank,
      suit: c.suit ?? f.suit,
    });
    ent.Tag = { flags: team | (faceUp ? ALIVE : 0) }; // 正面=活 → 计入该队存活
    entities[c.id] = ent;
  };
  teamA.forEach((c, i) => place(c, facesA[i], TEAM_A, 'a', i, A_FRONT));
  teamB.forEach((c, i) => place(c, facesB[i], TEAM_B, 'b', i, B_FRONT));

  // ③ 数存活（含齐 队位|ALIVE）→ 两个数值事实
  entities.gc_a = { GroupCount: { countResource: 'a_alive', requiredTag: TEAM_A | ALIVE } };
  entities.gc_b = { GroupCount: { countResource: 'b_alive', requiredTag: TEAM_B | ALIVE } };
  entities.res_a = { Resource: { id: 'a_alive', current: 0, min: 0, max: 999 } };
  entities.res_b = { Resource: { id: 'b_alive', current: 0, min: 0, max: 999 } };
  entities.res_mats = { Resource: { id: 'mats', current: 0, min: 0, max: 99999 } };
  entities.winner = { State: { fsmId: 'winner', current: 'pending' } };
  entities.clock = { Timer: { id: 'match_clock', elapsed: 0, duration: FLIP_DURATION, loop: false } };

  // ④ 结算门：Timer 到点(翻牌演完)那拍，按存活数 vsResource 比 → 三选一定胜负（edge，互斥各一发）。
  const gate = (cmp: string, sig: string, winState: string, mats: number): void => {
    const when = {
      kind: 'and',
      of: [
        { kind: 'timer', id: 'match_clock', cmp: 'gte', value: FLIP_DURATION },
        { kind: 'resource', id: 'a_alive', cmp, value: 0, vsResource: 'b_alive' },
      ],
    };
    entities[`when_${sig}`] = { EventWhen: { signal: sig, when, mode: 'edge', armed: false } };
    entities[`fx_${sig}_st`] = { Effect: { onSignal: sig, kind: 'set-state', targetId: 'winner', value: winState } };
    if (mats > 0) entities[`fx_${sig}_mat`] = { Effect: { onSignal: sig, kind: 'modify-resource', targetId: 'mats', value: mats } };
  };
  gate('gt', 'a_wins', 'a', reward); // a_alive > b_alive → 我胜，掉材
  gate('lt', 'b_wins', 'b', 0); // a_alive < b_alive → 敌胜
  gate('eq', 'draw', 'draw', 0); // 平

  return { capabilities: MATCH_CAPS, entities };
}

export { FLIP_DURATION, FLIP_SPINS, flipTarget, MATCH_REWARD };

// ── T-G5 · 战役 / run 结构（design/11）──
// 一个 run = 5 场连战 + 3 命线：输一场扣 1 命，命尽=结束，打穿 5 场=通关。
// 战役曲线：敌方 favor 偏置逐场升，终局第 5 场=Boss 牌王座(更强 + 起手干预)。场间养成另在 mount。
export const RUN_BATTLES = 5;
export const RUN_LIVES = 3;
const BATTLE_LABELS = ['序战 · 杂兵', '前哨 · 偏师', '中军 · 名将', '精锐 · 机关', '终局 · 牌王座 BOSS'];
export interface BattleSpec { enemyBias: number; boss: boolean; label: string }
/** 第 i 场(0-based)的敌军强度/是否 Boss。敌 favor 偏置逐场升(-10,-5,0,5)，终局 Boss 额外 +8(=18,牌王座)。 */
export function battleSpec(i: number): BattleSpec {
  const boss = i >= RUN_BATTLES - 1;
  return { enemyBias: -10 + i * 5 + (boss ? 8 : 0), boss, label: BATTLE_LABELS[i] ?? `第 ${i + 1} 战` };
}

// ── 场间三选一增益（design/11 §三 · roguelike 养成核）──
// 胜一场后的短窗：三随机增益里选一项，改 牌组 favor / 命 / 干预能量◈ / 材料。**纯数据**（最弱 LLM 能填 {kind,amount}）
// + 小解释器 applyBuff，与大厅商城同类的存档变更——零新 capability、headless 可测。选择即流派（养成核）。
// kind 'joker' = 流派钥匙（白嫖一张小丑 → 构筑分叉，design reply#10 StS/Balatro 式，T-G6 小丑就绪后接）。
export type BuffKind = 'deck-all' | 'deck-weak' | 'lives' | 'energy' | 'materials' | 'joker';
export interface RunBuff { id: string; name: string; desc: string; kind: BuffKind; amount: number; count?: number; jokerId?: string }
// 被增益作用的存档子集（Save 的子结构；解耦 mount 的 Save 类型，便于 headless 测）。含 jokers（流派钥匙落点）。
export interface BuffTarget { deck: number[]; lives: number; leverEnergy: number; materials: number; jokers: string[] }
export const BETWEEN_BUFFS: RunBuff[] = [
  { id: 'drill', name: '整训', desc: '全军 favor +4', kind: 'deck-all', amount: 4 },
  { id: 'elite', name: '精兵', desc: '最弱 10 张 favor +8', kind: 'deck-weak', amount: 8, count: 10 },
  { id: 'conscript', name: '征兵', desc: '战役 +1 命 ❤', kind: 'lives', amount: 1 },
  { id: 'stockpile', name: '囤能', desc: '干预能量 +3 ◈', kind: 'energy', amount: 3 },
  { id: 'revenue', name: '财源', desc: '材料 +25', kind: 'materials', amount: 25 },
];
/** 施加一项场间增益（就地改存档子集）。纯函数式语义：同 target+buff → 同结果（可测、可重放）。 */
export function applyBuff(t: BuffTarget, b: RunBuff): void {
  if (b.kind === 'deck-all') t.deck = t.deck.map((f) => clampFavor(f + b.amount));
  else if (b.kind === 'deck-weak') {
    const order = t.deck.map((f, i) => [f, i] as const).sort((x, y) => x[0] - y[0]);
    const n = Math.min(b.count ?? t.deck.length, t.deck.length);
    for (let k = 0; k < n; k++) t.deck[order[k][1]] = clampFavor(t.deck[order[k][1]] + b.amount);
  } else if (b.kind === 'lives') t.lives += b.amount;
  else if (b.kind === 'energy') t.leverEnergy = Math.min(LEVER_CAP, t.leverEnergy + b.amount);
  else if (b.kind === 'materials') t.materials += b.amount;
  else if (b.kind === 'joker') { if (b.jokerId && !t.jokers.includes(b.jokerId)) t.jokers.push(b.jokerId); } // 流派钥匙：白嫖小丑（去重）
}

// ═══════════════════════════════════════════════════════════════
//  G2 · 战场结构（军衔 / 三路 / 布阵 / 将领牵动）—— design/06。owner 愿景核心。
//
//  一副 54 张(52+2王) = 一支按军衔(点数)成军、分三路(各18)列阵的军队。开局布阵分兵三路，
//  交战时**自上而下逐级掷命**：先掷该路主将——主将活→本路下属 +士气 favor、主将亡→−溃散 favor
//  （擒贼先擒王 → 连锁溃散）——再掷下属。三路各自数存活定路胜负，**胜 2/3 路 = 赢**(best-of-3)。
//
//  全是现成能力重组、**零新 capability**（守 §六）：军衔/三路/布阵=数据(tag+布局)；逐张掷命=decideFaceUp；
//  将领牵动="集合写"用 **build 时逐级 favor 调整**重组(不预设 group-effect 缺口)；数存活/路胜负=group-count+event-when。
//  outcome-first 红线不变：胜负 build 时即定(确定性/可重放)，3D 抛飞相撞只是表现。
// ═══════════════════════════════════════════════════════════════
export const LANE = [1 << 4, 1 << 5, 1 << 6]; // 上/中/下路 Tag 位
const MORALE = 8; // 主将在场：本路下属 +favor（士气）
const ROUT = 14; // 主将阵亡：本路下属 −favor（溃散连锁）
const LANE_SEP = 640; // 三路 x 间距（2D px）
const ACELL_W = 168;
const ACELL_H = 150; // 路内 3×6 子格

// 军衔 → 基础 favor（高军衔更易活）。JOKER/K=大队长, Q/J=中队长, 10-7=小队长, A-6=兵。
function rankFavor(rank: string): number {
  if (rank === 'JOKER' || rank === 'K') return 80;
  if (rank === 'Q' || rank === 'J') return 66;
  if (rank === '10' || rank === '9' || rank === '8' || rank === '7') return 56;
  return 46;
}
const ARMY_RANKS = ['K', 'Q', 'J', '10', '9', '8', '7', 'A', '2', '3', '4', '5', '6'];

export interface ArmyCard {
  id: string;
  rank: string;
  lane: number; // 0/1/2 = 上/中/下路
  favor: number; // 含 favorBias 的基础 favor（未含士气/溃散）
  general: boolean; // 是否本路主将（最高军衔）
  suit: string; // 花色 S/H/D/C（同花卡数花色用；render 也用）
}

/** 一方 54 张(52+2王)成军：按军衔降序蛇形发三路(各18)，每路首张(最高军衔)=路主将。favorBias=该方整体强弱。 */
export function standardArmy(prefix: string, favorBias = 0): ArmyCard[] {
  const ranks: string[] = ['JOKER', 'JOKER'];
  for (const r of ARMY_RANKS) for (let s = 0; s < 4; s++) ranks.push(r);
  const order = ranks.map((r, i) => ({ r, i, f: rankFavor(r) })).sort((a, b) => b.f - a.f || a.i - b.i);
  const army: ArmyCard[] = [];
  const counts = [0, 0, 0];
  order.forEach((o, k) => {
    const lane = k % 3;
    const idx = counts[lane]++;
    army.push({ id: `${prefix}_l${lane}_${idx}`, rank: o.r, lane, favor: clampFavor(rankFavor(o.r) + favorBias), general: idx === 0, suit: SUITS[army.length % 4] });
  });
  return army;
}

// 结局联动族小丑（design/12 §五.5）：在确定性单遍解析里**前向生效**（只改未翻牌 → 无二次解析、hash 稳）。
export interface LinkJokers { martyr: boolean; chain: boolean }
const SHI_REVENGE = 10; // 死士：本路首死后，余下未翻的兵 +favor（报仇·死战）

// 将领牵动：逐路自上而下掷命——先掷主将，按主将生死给本路下属 ±favor，再掷下属。返回 id→faceUp。
// PRNG 顺序固定（lane 0→1→2，路内主将先、其余按生成序）→ 可回放、确定性。
// moraleScale[lane]：本路士气倍率（旗手/枭雄放大 `06` 士气，仅放大士气不放大溃散；只改 favor 值、不改掷命次数→序列不变）。
// links：结局联动（死士首死→余部 +报仇；连环首活→牵下一张跳掷命置活）。均前向、只动未翻牌 → 单遍确定、hash 稳。
function resolveArmy(army: ArmyCard[], rng: RandomSeed, moraleScale: readonly number[] = [1, 1, 1], links: LinkJokers = { martyr: false, chain: false }): Map<string, boolean> {
  const face = new Map<string, boolean>();
  for (const lane of [0, 1, 2]) {
    const laneCards = army.filter((c) => c.lane === lane);
    const gen = laneCards.find((c) => c.general)!;
    const fg = decideFaceUp(gen.favor, rng); // 先掷主将
    face.set(gen.id, fg);
    const shift = fg ? Math.round(MORALE * (moraleScale[lane] ?? 1)) : -ROUT; // 主将活=士气(可被旗手/枭雄放大)，亡=溃散(不放大)
    let forceNext = false; // 连环：被上一张牵起 → 这张跳掷命置活
    let martyrFired = false; // 死士：本路已出现首死 → 后续 +报仇
    let chainUsed = false; // 连环每路只牵一次
    for (const c of laneCards) {
      if (c.general) continue;
      let alive: boolean;
      if (forceNext) { alive = true; forceNext = false; } // 连环牵活（跳掷命，同护盾族）
      else alive = decideFaceUp(clampFavor(c.favor + shift + (links.martyr && martyrFired ? SHI_REVENGE : 0)), rng);
      face.set(c.id, alive);
      if (alive) { if (links.chain && !chainUsed) { chainUsed = true; forceNext = true; } } // 首个活牵起下一张
      else if (links.martyr) martyrFired = true; // 首死起，余部得报仇
    }
  }
  return face;
}

function laneSlot(lane: number, i: number, isA: boolean): { x: number; y: number } {
  const laneX = (lane - 1) * LANE_SEP;
  const col = i % 3;
  const row = Math.floor(i / 3); // 3×6 = 18
  const cellX = laneX + (col - 1) * ACELL_W;
  const cellY = (row - 2.5) * ACELL_H;
  return { x: cellX + (isA ? -PAIR_DX : PAIR_DX), y: cellY }; // A 左 / B 右，跃向 cell 中心相撞
}

// ── T-G3 · 开局布阵 / 分兵（design/09，田忌赛马）──
// 30 军官(大队长6/中队长8/小队长16) 由玩家分三路，24 兵自动补到 18/路；每路最高军衔=主将。
// Formation = 各路军官数(和=30) → 决定哪路强/弃。预设给易上手，AI 暗布阵给读心。纯数据、零新能力。
const OFFICER_RANKS: string[] = (() => {
  const r = ['JOKER', 'JOKER'];
  for (const x of ['K', 'Q', 'J', '10', '9', '8', '7']) for (let i = 0; i < 4; i++) r.push(x);
  return r; // 30，军衔降序
})();
const TROOP_RANKS: string[] = (() => {
  const r: string[] = [];
  for (const x of ['A', '2', '3', '4', '5', '6']) for (let i = 0; i < 4; i++) r.push(x);
  return r; // 24
})();

export interface Formation {
  officers: [number, number, number]; // 各路(上/中/下)军官数，和必须=30
}
// 首版 4 预设（命名分布；石头剪刀布闭环 → 读心有意义，见 design/09 §三）。
export const FORMATION_PRESETS: Record<string, Formation> = {
  均衡: { officers: [10, 10, 10] },
  锋矢: { officers: [6, 18, 6] }, // 攻中
  两翼: { officers: [13, 4, 13] }, // 弃中
  田忌: { officers: [2, 14, 14] }, // 弃上
};
export const PRESET_NAMES = ['均衡', '锋矢', '两翼', '田忌'];

// 按军官配额把军衔降序的军官轮转发三路（跳过已满路）→ 每路得均衡的高低军官，配额精确。
function deployOfficers(quota: readonly number[]): string[][] {
  const lanes: string[][] = [[], [], []];
  const cap = [...quota];
  let li = 0;
  for (const off of OFFICER_RANKS) {
    let guard = 0;
    while (cap[li] === 0 && guard++ < 3) li = (li + 1) % 3;
    if (cap[li] === 0) break; // 全满（理论上不会，sum=30）
    lanes[li].push(off);
    cap[li]--;
    li = (li + 1) % 3;
  }
  return lanes;
}

/**
 * 按布阵发兵成军：30 军官按 Formation 分三路、24 兵自动补到 18/路，每路首席(最高军衔)=主将。
 * 无 Formation → 回退 standardArmy(军衔蛇形=均衡，零迁移)。输出与 standardArmy 同构(ArmyCard[])，喂 buildGameGArmyMatch。
 */
export function armyFromFormation(prefix: string, favorBias: number, formation?: Formation): ArmyCard[] {
  if (!formation) return standardArmy(prefix, favorBias);
  const offLanes = deployOfficers(formation.officers);
  const need = [0, 1, 2].map((l) => 18 - offLanes[l].length); // 各路补兵数(和=24)
  const troopLanes: string[][] = [[], [], []];
  let li = 0;
  for (const t of TROOP_RANKS) {
    let guard = 0;
    while (need[li] === 0 && guard++ < 3) li = (li + 1) % 3;
    if (need[li] === 0) break;
    troopLanes[li].push(t);
    need[li]--;
    li = (li + 1) % 3;
  }
  const army: ArmyCard[] = [];
  for (const lane of [0, 1, 2]) {
    const laneRanks = [...offLanes[lane], ...troopLanes[lane]]; // 军官在前(高 favor)→ idx0=主将
    laneRanks.forEach((rank, idx) => {
      army.push({ id: `${prefix}_l${lane}_${idx}`, rank, lane, favor: clampFavor(rankFavor(rank) + favorBias), general: idx === 0, suit: SUITS[army.length % 4] });
    });
  }
  return army;
}

// ── T-G4 · 干预卡 / 功能牌（design/10）──
// 干预 = 花「干预能量◈」在**揭晓前**改 favor/主将/兵力 → 三路掷命读改后值。outcome-first 红线：只改掷命前输入、不回灌。
// 首发 4 张(favor-mod + 斩将 + 增援)，同花/护盾/重翻 留后续(需 D0 核 poker-hand / status)。
export const LEVER_START = 3; // 开局能量
export const LEVER_CAP = 6; // 上限
export const LEVER_REGEN = 2; // 每关回能
export type LeverKind = 'bless' | 'curse' | 'shield' | 'decapitate' | 'reinforce' | 'flush';
export const LEVER_CATALOG: Record<LeverKind, { name: string; cost: number; side: 'a' | 'b'; desc: string }> = {
  bless: { name: '祝福', cost: 1, side: 'a', desc: '我某路全员 favor +20' },
  curse: { name: '诅咒', cost: 1, side: 'b', desc: '敌某路全员 favor −20' },
  shield: { name: '护盾', cost: 2, side: 'a', desc: '我某路最弱牌反面免死(favor→92)' },
  decapitate: { name: '斩首令', cost: 3, side: 'b', desc: '敌某路主将必掉→该路溃散(−14)' },
  reinforce: { name: '增援', cost: 3, side: 'a', desc: '我某路 +2 兵(go-wide 该路)' },
  flush: { name: '牌型', cost: 2, side: 'a', desc: '我某路凑成的最高牌型→逐级 +favor(对子→同花顺)' },
};
export interface Intervention { kind: LeverKind; lane: number }
const BLESS = 20, CURSE = 20, DECAP_FAVOR = 8;

// 牌型阶梯（design/10 D 类，复用 Game E poker-hand 思想）：评一路(18+张)凑成的最高扑克牌型 → 逐级 favor。
// 注：evaluateHand 限定恰 5 张/全同花，整路不适用——故按"路"语义算特征(同花=≥5 同色/顺子=路内含 5 连点,
//   用 poker-hand 的 isStraightRanks 真算法 + HandType 枚举)，体现"52 张扑克身份的回报"。
const RANK_NUM: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2, JOKER: 15 };
const TIER_BUFF: Partial<Record<HandType, number>> = {
  'straight-flush': 18, 'four-of-a-kind': 14, 'full-house': 12, flush: 10, straight: 9, 'three-of-a-kind': 7, 'two-pair': 5, pair: 3, 'high-card': 0,
};
export function laneHandTier(cards: ArmyCard[]): { type: HandType; buff: number } {
  const rankCounts = new Map<number, number>();
  const suitCounts = new Map<string, number>();
  for (const c of cards) {
    const r = RANK_NUM[c.rank] ?? 0;
    rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  }
  const counts = [...rankCounts.values()].sort((a, b) => b - a);
  const maxR = counts[0] ?? 0, secR = counts[1] ?? 0;
  const maxSuit = Math.max(0, ...suitCounts.values());
  const distinct = [...rankCounts.keys()].sort((a, b) => a - b);
  let hasStraight = false;
  for (let i = 0; i + 5 <= distinct.length && !hasStraight; i++) hasStraight = isStraightRanks(distinct.slice(i, i + 5));
  if (!hasStraight && [2, 3, 4, 5, 14].every((r) => rankCounts.has(r))) hasStraight = isStraightRanks([2, 3, 4, 5, 14]); // A 低轮子
  const isFlush = maxSuit >= 5; // 路内同色 ≥5
  let type: HandType;
  if (isFlush && hasStraight) type = 'straight-flush';
  else if (maxR >= 4) type = 'four-of-a-kind';
  else if (maxR === 3 && secR >= 2) type = 'full-house';
  else if (isFlush) type = 'flush';
  else if (hasStraight) type = 'straight';
  else if (maxR === 3) type = 'three-of-a-kind';
  else if (maxR === 2 && secR === 2) type = 'two-pair';
  else if (maxR === 2) type = 'pair';
  else type = 'high-card';
  return { type, buff: TIER_BUFF[type] ?? 0 };
}

/**
 * 揭晓前施加干预（改 favor / 斩将 / 加兵）→ 返回改后的 a/b 军，喂 buildGameGArmyMatch。
 * outcome-first：只改掷命前输入；胜负仍 build 时由规则定、可回放（同 seed+同干预序列 → 同结果）。
 * 斩首=把敌该路主将 favor 压到 8(极易掉)，掉则经 06 将领牵动自动 −14 溃散；增援=该路 +2 兵(路可达 20)。
 *
 * **对称（design/13 §二）**：`caster` = 施加方。增益(bless/shield/reinforce/flush)落己方、削弱(curse/decapitate)落敌方——
 * side 参数化、非两套算子。玩家干预 caster='a'(默认，行为不变)；**Boss 起手干预 caster='b'**：诅咒/斩首落玩家(a)、增益落 Boss(b)。
 * bias = 施加方整体偏置（增援新兵用）。两次调用(先玩家 caster='a'、再 Boss caster='b')链式叠加，均揭晓前、outcome-first 不破。
 */
export function applyInterventions(armyA: ArmyCard[], armyB: ArmyCard[], list: Intervention[], bias = 0, caster: 'a' | 'b' = 'a'): { a: ArmyCard[]; b: ArmyCard[] } {
  let a = armyA.map((c) => ({ ...c }));
  let b = armyB.map((c) => ({ ...c }));
  const selfIsA = caster === 'a';
  const self = (): ArmyCard[] => (selfIsA ? a : b); // 施加方己军
  const enemy = (): ArmyCard[] => (selfIsA ? b : a); // 对手军
  const setSelf = (next: ArmyCard[]): void => { if (selfIsA) a = next; else b = next; };
  const setEnemy = (next: ArmyCard[]): void => { if (selfIsA) b = next; else a = next; };
  for (const iv of list) {
    if (iv.kind === 'bless') setSelf(self().map((c) => (c.lane === iv.lane ? { ...c, favor: clampFavor(c.favor + BLESS) } : c)));
    else if (iv.kind === 'curse') setEnemy(enemy().map((c) => (c.lane === iv.lane ? { ...c, favor: clampFavor(c.favor - CURSE) } : c)));
    else if (iv.kind === 'decapitate') setEnemy(enemy().map((c) => (c.lane === iv.lane && c.general ? { ...c, favor: DECAP_FAVOR } : c)));
    else if (iv.kind === 'reinforce') {
      const cur = self();
      const n = cur.filter((c) => c.lane === iv.lane).length;
      setSelf([...cur,
        { id: `${caster}_l${iv.lane}_rf${n}`, rank: 'A', lane: iv.lane, favor: clampFavor(46 + bias), general: false, suit: 'S' },
        { id: `${caster}_l${iv.lane}_rf${n + 1}`, rank: '2', lane: iv.lane, favor: clampFavor(46 + bias), general: false, suit: 'H' }]);
    } else if (iv.kind === 'shield') {
      // 护盾：本路最弱牌 favor 拉到 92（≈反面免死，揭晓前抬高其活率）。
      const cur = self();
      const lane = cur.filter((c) => c.lane === iv.lane);
      if (lane.length) {
        const weak = lane.reduce((m, c) => (c.favor < m.favor ? c : m), lane[0]);
        setSelf(cur.map((c) => (c.id === weak.id ? { ...c, favor: 92 } : c)));
      }
    } else if (iv.kind === 'flush') {
      // 牌型：评本路凑成的最高扑克牌型 → 逐级 +favor（对子→同花顺，复用 poker-hand 阶梯）。
      const cur = self();
      const { buff } = laneHandTier(cur.filter((c) => c.lane === iv.lane));
      if (buff > 0) setSelf(cur.map((c) => (c.lane === iv.lane ? { ...c, favor: clampFavor(c.favor + buff) } : c)));
    }
  }
  return { a, b };
}

/** 布阵预估（build 时算，喂布阵屏预估条）：每路 Σfavor / 主将军衔点数 / 牌数。 */
export function laneEstimates(army: ArmyCard[]): { sumFavor: number; general: string; count: number }[] {
  return [0, 1, 2].map((lane) => {
    const lc = army.filter((c) => c.lane === lane);
    const gen = lc.find((c) => c.general);
    return { sumFavor: lc.reduce((a, c) => a + c.favor, 0), general: gen ? (gen.rank === 'JOKER' ? '★' : gen.rank) : '-', count: lc.length };
  });
}

// ── 终局 Boss 阵容（design/13 · 每 run 轮换一名牌王座）──
// 每 Boss = 一个拟人化扑克人格，强度全用 3 个**数据**杠杆表达：formation(力压哪路)/favorBias(多强)/openingLevers(起手干预)。
// 起手干预 = 对 Boss(B)侧跑 applyInterventions(caster='b')：增益落 Boss 己方、诅咒/斩首落玩家——**对称、零新算子**(design/13 §二)。
// taunt/persona 仅 flavor(UI 台词)、无可执行逻辑——力量全在三杠杆，守"整个游戏是数据"(最弱 LLM 能填 BossSpec)。
export interface BossSpec { id: string; name: string; persona: string; formation: Formation; favorBias: number; openingLevers: Intervention[]; taunt: string; archetype: Archetype }
const BOSS_BIAS = 14; // 终局基准偏置(≈battleSpec(4)=18 同档，余强度由 openingLevers 补)；数值可调，平衡总表归 design G。
export const BOSS_ROSTER: BossSpec[] = [
  { id: 'spadeK', name: '黑桃王·铁壁', persona: '沉稳防守', archetype: 'general', formation: FORMATION_PRESETS['均衡'], favorBias: BOSS_BIAS, openingLevers: [{ kind: 'bless', lane: 0 }, { kind: 'bless', lane: 1 }, { kind: 'bless', lane: 2 }], taunt: '铜墙铁壁，寸土不让。' },
  { id: 'heartQ', name: '红桃皇后·倾国', persona: '妖艳压制', archetype: 'probability', formation: FORMATION_PRESETS['锋矢'], favorBias: BOSS_BIAS, openingLevers: [{ kind: 'curse', lane: 0 }, { kind: 'curse', lane: 1 }], taunt: '一顾倾人城，再顾倾你军。' },
  { id: 'diamondJ', name: '方块J·诡牌', persona: '花哨赌徒', archetype: 'cardtype', formation: FORMATION_PRESETS['均衡'], favorBias: BOSS_BIAS, openingLevers: [{ kind: 'flush', lane: 0 }, { kind: 'flush', lane: 1 }, { kind: 'flush', lane: 2 }], taunt: '满手好牌，张张要命。' },
  { id: 'clubK', name: '梅花K·人海', persona: '暴兵碾压', archetype: 'wide', formation: FORMATION_PRESETS['均衡'], favorBias: BOSS_BIAS - 4, openingLevers: [{ kind: 'reinforce', lane: 0 }, { kind: 'reinforce', lane: 1 }, { kind: 'reinforce', lane: 2 }], taunt: '人海无尽，淹没你的旗。' },
  { id: 'bigJoker', name: '大王·天命', persona: '疯赌', archetype: 'tianji', formation: FORMATION_PRESETS['锋矢'], favorBias: BOSS_BIAS + 6, openingLevers: [{ kind: 'flush', lane: 1 }], taunt: '天命在我，一掷定乾坤！' },
  { id: 'smallJoker', name: '小王·无常', persona: '阴狠刺客', archetype: 'decap', formation: FORMATION_PRESETS['两翼'], favorBias: BOSS_BIAS, openingLevers: [{ kind: 'decapitate', lane: 0 }, { kind: 'decapitate', lane: 1 }, { kind: 'decapitate', lane: 2 }], taunt: '擒贼擒王，先取你将首。' },
];
/** 取第 idx 名 Boss（每 run 轮换；越界自动归一）。 */
export function bossFor(idx: number): BossSpec {
  const n = BOSS_ROSTER.length;
  return BOSS_ROSTER[((idx % n) + n) % n];
}

// ── T-G6 · 小丑牌（融牌面的持久"改规则"被动 · design/12 §二）──
// 借 Game E 小丑的**声明式数据哲学**（每张 = 一条 {kind,params} 规则 + text 人话），但**域不同**：
//   Game E joker = 运行时计分(on_hand_scored→chips/mult)；Game G **outcome-first** → joker = **build 时军阵 favor 变换**（揭晓前定、不回灌）。
// 故复用"数据+解释器"范式、**不复用 Game E 运行时**（同 D0 §同花未复用 evaluateHand 之理）。applyJokers 在 resolveArmy 前跑、**零新能力**。
// 局外持久：融在玩家牌组上（save.jokers），跨 run 不清零——"牌组身份"养成核(owner 愿景)。
// 本批 4 张=纯 build 时 favor 变换(同袍/赌徒/先登/不屈)；士气放大族(旗手/枭雄)、结局联动族(死士/连环/督粮/影武者)待后续切片(需 resolve 时钩子)。
export type JokerKind = 'suit-synergy' | 'polarize' | 'lane-pref' | 'diehard' | 'morale' | 'link';
export type Archetype = 'decap' | 'cardtype' | 'general' | 'wide' | 'probability' | 'tianji'; // 6 流派 id（design/12 §四）
export interface JokerCard {
  id: string; name: string; kind: JokerKind; cost: number; archetype: Archetype; text: string;
  amount?: number; // favor 量
  lane?: number; // lane-pref 偏好路
  moraleMul?: number; // morale：本路士气倍率（旗手 1.5 / 枭雄 2）
}
export const GAME_G_JOKERS: JokerCard[] = [
  { id: 'comrade', name: '同袍', kind: 'suit-synergy', cost: 18, archetype: 'cardtype', amount: 2, text: '本路每有 1 张同花色 → 该牌 +2 favor（牌型流：往一路堆同花越爽）' },
  { id: 'gambler', name: '赌徒', kind: 'polarize', cost: 16, archetype: 'probability', amount: 12, text: '全军 favor 两极化：≥50 的更高、<50 的更低（概率流：高风险高回报）' },
  { id: 'vanguard', name: '先登', kind: 'lane-pref', cost: 15, archetype: 'wide', amount: 8, lane: 0, text: '上路全员 +8 favor（铺场流：主攻上路）' },
  { id: 'diehard', name: '不屈', kind: 'diehard', cost: 22, archetype: 'probability', amount: 88, text: '全军 favor 不足 88 的拉到 88（近免死、稳翻正面）' },
  { id: 'bannerman', name: '旗手', kind: 'morale', cost: 17, archetype: 'general', moraleMul: 1.5, text: '全军主将士气加成 ×1.5（主将活则全路涌 · 将领流核心）' },
  { id: 'warlord', name: '枭雄', kind: 'morale', cost: 24, archetype: 'general', moraleMul: 2, text: '顶级主将(K/王)所在路，士气加成 ×2（堆高军衔主将碾压一路）' },
  { id: 'martyr', name: '死士', kind: 'link', cost: 16, archetype: 'wide', text: '本路首张兵阵亡 → 该路余下未翻的兵 +10 favor（报仇·死战 · 铺场流）' },
  { id: 'chain', name: '连环', kind: 'link', cost: 19, archetype: 'wide', text: '本路首张兵翻正 → 牵起下一张未翻的兵必活（连环索 · 铺场流）' },
];
/** 从已融小丑取结局联动开关（死士/连环）→ 喂 resolveArmy 前向生效。 */
export function jokerLinks(jokerIds: readonly string[]): LinkJokers {
  return { martyr: jokerIds.includes('martyr'), chain: jokerIds.includes('chain') };
}
export const JOKER_BY_ID: ReadonlyMap<string, JokerCard> = new Map(GAME_G_JOKERS.map((j) => [j.id, j]));

/** 流派钥匙：把"未拥有的小丑"包成场间三选一可白嫖的 RunBuff（design reply#10：场间选择=构筑分叉）。已拥有的不再出。 */
export function jokerKeyBuffs(ownedIds: readonly string[]): RunBuff[] {
  return GAME_G_JOKERS.filter((j) => !ownedIds.includes(j.id)).map((j) => ({
    id: `key_${j.id}`, name: `🃏钥匙·${j.name}`, desc: `融入小丑【${j.name}】：${j.text}`, kind: 'joker', amount: 0, jokerId: j.id,
  }));
}

// ── T-G6 · 流派 + 克制网（design/12 §四 · 身份 + 石头剪刀布）──
// 流派 = 由已融小丑浮现的身份；克制网 = **双 3-环** rock-paper-scissors（无唯一最优 → 看对手临场调布阵/干预）。
// 纯数据：每流派 {keyJokers, counters} 最弱 LLM 能填；detectArchetype 数已融小丑归属、archetypeMatchup 查克制——零新能力。
export interface ArchetypeSpec { id: Archetype; name: string; desc: string; keyJokers: string[]; counters: Archetype }
export const ARCHETYPES: ArchetypeSpec[] = [
  // 核心 3-环（`12` §四明示）：斩首 克 将领 克 铺场 克 斩首。
  { id: 'decap', name: '斩首流', desc: '攒能量秒敌主将引溃散', keyJokers: [], counters: 'general' }, // 钥匙：督粮/影武者(待实现)
  { id: 'general', name: '将领流', desc: '主将士气碾压一路', keyJokers: ['bannerman', 'warlord'], counters: 'wide' },
  { id: 'wide', name: '铺场流', desc: 'go-wide + 连锁必活', keyJokers: ['vanguard', 'martyr', 'chain'], counters: 'decap' },
  // 次 3-环（我的合理映射，待 design 校准）：牌型 克 概率 克 弃一保二 克 牌型。
  { id: 'cardtype', name: '牌型流', desc: '堆同花色/连号成高牌型', keyJokers: ['comrade'], counters: 'probability' },
  { id: 'probability', name: '概率流', desc: '改命堆高 favor 稳翻正', keyJokers: ['gambler', 'diehard'], counters: 'tianji' },
  { id: 'tianji', name: '弃一保二流', desc: '弃一路、经济滚两路', keyJokers: [], counters: 'cardtype' }, // 钥匙：田忌布阵/督粮(待)
];
const ARCH_BY_ID: ReadonlyMap<Archetype, ArchetypeSpec> = new Map(ARCHETYPES.map((a) => [a.id, a]));
/** 由已融小丑浮现的主流派：数每流派 keyJokers 命中数，取最高（平局取 ARCHETYPES 靠前）；无命中 → null。 */
export function detectArchetype(jokerIds: readonly string[]): ArchetypeSpec | null {
  let best: ArchetypeSpec | null = null;
  let bestN = 0;
  for (const a of ARCHETYPES) {
    const n = a.keyJokers.filter((k) => jokerIds.includes(k)).length;
    if (n > bestN) { bestN = n; best = a; }
  }
  return best;
}
/** 流派克制：a 对 b = 克制 / 被克 / 中立（双 3-环，无自克）。 */
export function archetypeMatchup(a: Archetype, b: Archetype): 'counter' | 'countered' | 'neutral' {
  if (ARCH_BY_ID.get(a)?.counters === b) return 'counter';
  if (ARCH_BY_ID.get(b)?.counters === a) return 'countered';
  return 'neutral';
}

// 从已融小丑算每路士气倍率（旗手全路、枭雄仅顶级主将路）→ 喂 resolveArmy。复用 `06` 士气、不新机制。
const TOP_RANKS = new Set(['JOKER', 'K']); // 顶级军衔（枭雄触发档）
export function jokerMoraleScale(army: ArmyCard[], jokerIds: readonly string[]): number[] {
  const scale = [1, 1, 1];
  for (const id of jokerIds) {
    const j = JOKER_BY_ID.get(id);
    if (!j || j.kind !== 'morale') continue;
    for (const lane of [0, 1, 2]) {
      if (j.id === 'warlord') {
        const gen = army.find((c) => c.lane === lane && c.general); // 枭雄：仅本路主将顶级时放大
        if (gen && TOP_RANKS.has(gen.rank)) scale[lane] *= j.moraleMul ?? 1;
      } else scale[lane] *= j.moraleMul ?? 1; // 旗手：全路
    }
  }
  return scale;
}

/**
 * 融小丑：揭晓前按已融小丑（持久）把军阵 favor 变换 → 返回新军，喂 applyInterventions/build。
 * outcome-first：只改掷命前输入；同军+同小丑集 → 同结果（确定性、可回放）。纯 build 时、零 rng、零新能力。
 */
export function applyJokers(army: ArmyCard[], jokerIds: readonly string[]): ArmyCard[] {
  let out = army.map((c) => ({ ...c }));
  for (const id of jokerIds) {
    const j = JOKER_BY_ID.get(id);
    if (!j) continue;
    const amt = j.amount ?? 0;
    if (j.kind === 'suit-synergy') {
      const src = out; // 同花色计数基于当前花色分布（花色不变，计数稳定）
      out = out.map((c) => ({ ...c, favor: clampFavor(c.favor + amt * src.filter((d) => d.lane === c.lane && d.suit === c.suit).length) }));
    } else if (j.kind === 'polarize') {
      out = out.map((c) => ({ ...c, favor: clampFavor(c.favor + (c.favor >= 50 ? amt : -amt)) }));
    } else if (j.kind === 'lane-pref') {
      const lane = j.lane ?? 0;
      out = out.map((c) => (c.lane === lane ? { ...c, favor: clampFavor(c.favor + amt) } : c));
    } else if (j.kind === 'diehard') {
      out = out.map((c) => (c.favor < amt ? { ...c, favor: amt } : c));
    }
  }
  return out;
}

/**
 * 揭晓前的**完整 build 时编排**（单一真相 · showMatch 与测试共用，杜绝两路漂移）：
 *   成军(布阵+deck偏置) → 融小丑(applyJokers) → 玩家干预(caster='a') → Boss 起手干预(caster='b') → 算士气倍率。
 * 全在揭晓前、不回灌 gameplay（outcome-first）；返回喂 buildGameGArmyMatch 的 {a,b,moraleA}。纯函数、可重放。
 */
export interface MatchSetup { formation: Formation; deckBias: number; jokers: readonly string[]; interventions: Intervention[]; enemyForm?: Formation; enemyBias: number; boss?: BossSpec | null }
export function prepareArmies(s: MatchSetup): { a: ArmyCard[]; b: ArmyCard[]; moraleA: number[]; linksA: LinkJokers } {
  const armyA = applyJokers(armyFromFormation('a', s.deckBias, s.formation), s.jokers); // 融小丑（持久 favor 变换）
  const armyB = armyFromFormation('b', s.enemyBias, s.enemyForm);
  let { a, b } = applyInterventions(armyA, armyB, s.interventions, s.deckBias); // 玩家干预
  if (s.boss && s.boss.openingLevers.length) ({ a, b } = applyInterventions(a, b, s.boss.openingLevers, s.enemyBias, 'b')); // Boss 起手（对称）
  return { a, b, moraleA: jokerMoraleScale(a, s.jokers), linksA: jokerLinks(s.jokers) }; // 士气倍率 + 结局联动（死士/连环）
}

/**
 * G2 一局军阵对决：armyA(我) vs armyB(敌)，自上而下逐级掷命(将领牵动) → 三路数存活 → best-of-3 定总胜负。
 * 装配顺序 A 全军 → B 全军（PRNG 序列确定、可回放）。胜负 build 时即定；3D 抛飞相撞为表现。
 * moraleA：我方各路士气倍率（旗手/枭雄小丑放大，缺省 [1,1,1]）；敌方无小丑。缩放不改掷命次数→确定性不变。
 * linksA：我方结局联动（死士/连环，缺省关）；前向单遍生效、只动未翻牌 → hash 稳。敌方无小丑。
 */
export function buildGameGArmyMatch(armyA: ArmyCard[], armyB: ArmyCard[], seed = 1, reward = MATCH_REWARD, moraleA: readonly number[] = [1, 1, 1], linksA: LinkJokers = { martyr: false, chain: false }): WorldBlueprint {
  const rng: RandomSeed = { type: 'RandomSeed', seed, sequence: 0 };
  const faceA = resolveArmy(armyA, rng, moraleA, linksA);
  const faceB = resolveArmy(armyB, rng);
  const entities: Record<string, EntityBlueprint> = {};

  const place = (army: ArmyCard[], team: number, front: number, genFront: number, face: Map<string, boolean>): void => {
    const isA = team === TEAM_A;
    for (const lane of [0, 1, 2]) {
      army.filter((c) => c.lane === lane).forEach((c, i) => {
        const fu = face.get(c.id)!;
        const { x, y } = laneSlot(lane, i, isA);
        const ent = flipCardEntity({
          faceUp: fu,
          x,
          y,
          side: isA ? 'a' : 'b',
          pairKey: lane * 100 + i, // 同 pairKey 的 A/B 互为对手 → 渲染器让两牌相撞（*100 容增援后路 >18 张）
          rank: c.rank === 'JOKER' ? '★' : c.rank,
          suit: c.suit,
          frontTint: c.general ? genFront : front, // 主将更亮，战场上一眼可辨
          backTint: CARD_BACK,
        });
        ent.Tag = { flags: team | LANE[lane] | (fu ? ALIVE : 0) }; // 队 + 路 + 存活位
        entities[c.id] = ent;
      });
    }
  };
  place(armyA, TEAM_A, A_FRONT, 0xfde68a, faceA);
  place(armyB, TEAM_B, B_FRONT, 0xbae6fd, faceB);

  // 三路数存活（含齐 队|路|ALIVE）
  for (const L of [0, 1, 2]) {
    entities[`gc_a${L}`] = { GroupCount: { countResource: `a_l${L}`, requiredTag: TEAM_A | LANE[L] | ALIVE } };
    entities[`gc_b${L}`] = { GroupCount: { countResource: `b_l${L}`, requiredTag: TEAM_B | LANE[L] | ALIVE } };
    entities[`res_a${L}`] = { Resource: { id: `a_l${L}`, current: 0, min: 0, max: 99 } };
    entities[`res_b${L}`] = { Resource: { id: `b_l${L}`, current: 0, min: 0, max: 99 } };
  }
  entities.res_alanes = { Resource: { id: 'a_lanes', current: 0, min: 0, max: 3 } };
  entities.res_blanes = { Resource: { id: 'b_lanes', current: 0, min: 0, max: 3 } };
  entities.res_mats = { Resource: { id: 'mats', current: 0, min: 0, max: 99999 } };
  entities.winner = { State: { fsmId: 'winner', current: 'pending' } };
  entities.clock = { Timer: { id: 'match_clock', elapsed: 0, duration: FLIP_DURATION + 6, loop: false } };

  // ① 翻牌演完(Timer 到 FLIP_DURATION)那拍，逐路比存活 → 累计各方"赢几路"。
  const tLane = { kind: 'timer', id: 'match_clock', cmp: 'gte', value: FLIP_DURATION };
  for (const L of [0, 1, 2]) {
    entities[`when_a_lane${L}`] = { EventWhen: { signal: `a_lane${L}`, when: { kind: 'and', of: [tLane, { kind: 'resource', id: `a_l${L}`, cmp: 'gt', value: 0, vsResource: `b_l${L}` }] }, mode: 'edge', armed: false } };
    entities[`fx_a_lane${L}`] = { Effect: { onSignal: `a_lane${L}`, kind: 'modify-resource', targetId: 'a_lanes', value: 1 } };
    entities[`when_b_lane${L}`] = { EventWhen: { signal: `b_lane${L}`, when: { kind: 'and', of: [tLane, { kind: 'resource', id: `a_l${L}`, cmp: 'lt', value: 0, vsResource: `b_l${L}` }] }, mode: 'edge', armed: false } };
    entities[`fx_b_lane${L}`] = { Effect: { onSignal: `b_lane${L}`, kind: 'modify-resource', targetId: 'b_lanes', value: 1 } };
  }
  // ② 路数累计稳定后(Timer 到 FLIP_DURATION+3)，best-of-3 定总胜负（胜 2 路即赢，互斥各一发）。
  const tWin = { kind: 'timer', id: 'match_clock', cmp: 'gte', value: FLIP_DURATION + 3 };
  const total = (sig: string, cond: Record<string, unknown>, winState: string, mats: number): void => {
    entities[`when_${sig}`] = { EventWhen: { signal: sig, when: { kind: 'and', of: [tWin, cond] }, mode: 'edge', armed: false } };
    entities[`fx_${sig}_st`] = { Effect: { onSignal: sig, kind: 'set-state', targetId: 'winner', value: winState } };
    if (mats > 0) entities[`fx_${sig}_mat`] = { Effect: { onSignal: sig, kind: 'modify-resource', targetId: 'mats', value: mats } };
  };
  total('m_a', { kind: 'resource', id: 'a_lanes', cmp: 'gte', value: 2 }, 'a', reward);
  total('m_b', { kind: 'resource', id: 'b_lanes', cmp: 'gte', value: 2 }, 'b', 0);
  total('m_d', { kind: 'and', of: [{ kind: 'resource', id: 'a_lanes', cmp: 'lt', value: 2 }, { kind: 'resource', id: 'b_lanes', cmp: 'lt', value: 2 }] }, 'draw', 0);

  return { capabilities: MATCH_CAPS, entities };
}
