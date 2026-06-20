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
// kind 'joker' = 流派钥匙（白嫖一张天罡 → 构筑分叉，design reply#10 StS/Balatro 式，T-G6 天罡就绪后接）。
export type BuffKind = 'deck-all' | 'deck-weak' | 'lives' | 'energy' | 'materials' | 'tiangang';
export interface RunBuff { id: string; name: string; desc: string; kind: BuffKind; amount: number; count?: number; tiangangId?: string }
// 被增益作用的存档子集（Save 的子结构；解耦 mount 的 Save 类型，便于 headless 测）。含 jokers（流派钥匙落点）。
export interface BuffTarget { deck: number[]; lives: number; leverEnergy: number; materials: number; tiangangs: string[] }
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
  else if (b.kind === 'tiangang') { if (b.tiangangId && !t.tiangangs.includes(b.tiangangId)) t.tiangangs.push(b.tiangangId); } // 流派钥匙：白嫖天罡（去重）
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

// 结局联动族天罡（design/12 §五.5）：在确定性单遍解析里**前向生效**（只改未翻牌 → 无二次解析、hash 稳）。
export interface LinkTiangangs { martyr: boolean; chain: boolean }
const SHI_REVENGE = 10; // 死士：本路首死后，余下未翻的兵 +favor（报仇·死战）

// 将领牵动：逐路自上而下掷命——先掷主将，按主将生死给本路下属 ±favor，再掷下属。返回 id→faceUp。
// PRNG 顺序固定（lane 0→1→2，路内主将先、其余按生成序）→ 可回放、确定性。
// moraleScale[lane]：本路士气倍率（旗手/枭雄放大 `06` 士气，仅放大士气不放大溃散；只改 favor 值、不改掷命次数→序列不变）。
// links：结局联动（死士首死→余部 +报仇；连环首活→牵下一张跳掷命置活）。均前向、只动未翻牌 → 单遍确定、hash 稳。
function resolveArmy(army: ArmyCard[], rng: RandomSeed, moraleScale: readonly number[] = [1, 1, 1], links: LinkTiangangs = { martyr: false, chain: false }): Map<string, boolean> {
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

/**
 * AI 暗布阵（纯函数·可测；游戏层 mount 调用）。低关均衡 / 中关随 stage+materials 变化 / 高关或**committed**(玩家集齐招牌流派)→
 * **反制：全程猛攻你最弱一路**(读 lastOfficers 最小路)。committed 让"亮出招牌的强玩家"面对更尖的 AI（U6 按克制反制布阵的一种落地）。
 * ⚠️ 注(待 design 校准)：克制网是 archetype↔archetype，而 AI 杠杆是 formation；formation 无法精确"克制某流派"(best-of-3 下攻弱路才是稳解)，
 *   故此处取"committed→AI 更尖(攻最弱路)"而非逐流派映 formation(后者数学上弱/糊)。若要 AI 真按流派差异化布阵，需给 AI 自己的 archetype/levers。
 */
export function pickAiFormation(stage: number, materials: number, lastOfficers: readonly number[], committed: boolean): Formation {
  if (committed || stage > 5) {
    const min = Math.min(...lastOfficers);
    const weak = lastOfficers.indexOf(min);
    const off: [number, number, number] = [6, 6, 6];
    off[weak >= 0 ? weak : 1] = 18;
    return { officers: off };
  }
  if (stage <= 2) return FORMATION_PRESETS['均衡'];
  return FORMATION_PRESETS[PRESET_NAMES[(stage + materials) % 4]];
}

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
// tierBonus（星球·型）：成型(非高牌)时整条阶梯全局 +bonus —— 放大牌型流的羁绊回报（design reply#15 全局形，零目标 UI）。
export function laneHandTier(cards: ArmyCard[], tierBonus = 0): { type: HandType; buff: number } {
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
  const base = TIER_BUFF[type] ?? 0;
  return { type, buff: base + (base > 0 ? tierBonus : 0) }; // 成型(非高牌)才吃星球·型加成
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
export function applyInterventions(armyA: ArmyCard[], armyB: ArmyCard[], list: Intervention[], bias = 0, caster: 'a' | 'b' = 'a', tierBonus = 0): { a: ArmyCard[]; b: ArmyCard[] } {
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
      // 牌型：评本路凑成的最高扑克牌型 → 逐级 +favor（对子→同花顺，复用 poker-hand 阶梯）；星球·型 全局抬整条阶梯。
      const cur = self();
      const { buff } = laneHandTier(cur.filter((c) => c.lane === iv.lane), tierBonus);
      if (buff > 0) setSelf(cur.map((c) => (c.lane === iv.lane ? { ...c, favor: clampFavor(c.favor + buff) } : c)));
    }
  }
  return { a, b };
}

const SHADOW_REVENGE = 12; // 影武者：本路主将被斩(favor≤8)→该路余部 +favor 复仇
/**
 * 影武者（design/12 §五.5 退路·零缺口）：敌斩首把我某路主将压到 favor≤8(=被斩) → 该路**余部** +复仇 favor（替身死战）。
 * 揭晓前 build-时变换（在 Boss 起手干预之后调用，故能侦测被斩主将）；只升余部 favor、主将仍被斩 → outcome-first、可重放。
 */
export function applyShadowRevenge(army: ArmyCard[]): ArmyCard[] {
  const hitLanes = new Set(army.filter((c) => c.general && c.favor <= DECAP_FAVOR).map((c) => c.lane));
  return army.map((c) => (!c.general && hitLanes.has(c.lane) ? { ...c, favor: clampFavor(c.favor + SHADOW_REVENGE) } : { ...c }));
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

// ── T-G6 · 天罡牌（融牌面的持久"改规则"被动 · design/12 §二）──
// 借 Game E 小丑的**声明式数据哲学**（每张 = 一条 {kind,params} 规则 + text 人话），但**域不同**：
//   Game E joker = 运行时计分(on_hand_scored→chips/mult)；Game G **outcome-first** → joker = **build 时军阵 favor 变换**（揭晓前定、不回灌）。
// 故复用"数据+解释器"范式、**不复用 Game E 运行时**（同 D0 §同花未复用 evaluateHand 之理）。applyJokers 在 resolveArmy 前跑、**零新能力**。
// 局外持久：融在玩家牌组上（save.jokers），跨 run 不清零——"牌组身份"养成核(owner 愿景)。
// 本批 4 张=纯 build 时 favor 变换(同袍/赌徒/先登/不屈)；士气放大族(旗手/枭雄)、结局联动族(死士/连环/督粮/影武者)待后续切片(需 resolve 时钩子)。
// contract③ 天罡牌稀有度（doc20 §一）普/稀/史/传
export type TiangangRarity = 'common' | 'rare' | 'epic' | 'legendary';
// 旧 build-时 favor 变换 kinds + 新 contract③ 10 维度 kinds（甲写解释器）
export type TiangangKind = 'suit-synergy' | 'polarize' | 'lane-pref' | 'diehard' | 'morale' | 'link' | 'economy' | 'revenge'
  | 'odds' | 'power' | 'combo' | 'tempo' | 'stamina' | 'draw' | 'lane' | 'siege' | 'arcane';
export type Archetype = 'decap' | 'cardtype' | 'general' | 'wide' | 'probability' | 'tianji'; // 6 流派 id（design/12 §四）
export interface TiangangCard {
  id: string; name: string; kind: TiangangKind; cost: number; archetype: Archetype; text: string;
  amount?: number; // favor 量（旧 build-时变换用）
  lane?: number; // lane-pref 偏好路
  moraleMul?: number; // morale：本路士气倍率（旗手 1.5 / 枭雄 2）
  // contract③ 天罡牌字段（一期 20 张）：
  rarity?: TiangangRarity; // 稀有度
  params?: Record<string, unknown>; // kind-specific params（甲写解释器读）
  power?: number; // 牌力 ⭐1–5
  phat?: number; // P̂ 0–10 设计估胜率影响（仿真台实测校准）
}
export const GAME_G_TIANGANGS: TiangangCard[] = [
  // ── 旧批（T-G6 · build-时 favor 变换 · 甲已有解释器）──
  { id: 'comrade', name: '同袍', kind: 'suit-synergy', cost: 18, archetype: 'cardtype', amount: 2, text: '本路每有 1 张同花色 → 该牌 +2 favor（牌型流：往一路堆同花越爽）' },
  { id: 'gambler', name: '赌徒', kind: 'polarize', cost: 16, archetype: 'probability', amount: 12, text: '全军 favor 两极化：≥50 的更高、<50 的更低（概率流：高风险高回报）' },
  { id: 'vanguard', name: '先登', kind: 'lane-pref', cost: 15, archetype: 'wide', amount: 8, lane: 0, text: '上路全员 +8 favor（铺场流：主攻上路）' },
  { id: 'diehard', name: '不屈', kind: 'diehard', cost: 22, archetype: 'probability', amount: 88, text: '全军 favor 不足 88 的拉到 88（近免死、稳翻正面）' },
  { id: 'bannerman', name: '旗手', kind: 'morale', cost: 17, archetype: 'general', moraleMul: 1.5, text: '全军主将士气加成 ×1.5（主将活则全路涌 · 将领流核心）' },
  { id: 'warlord', name: '枭雄', kind: 'morale', cost: 24, archetype: 'general', moraleMul: 2, text: '顶级主将(K/王)所在路，士气加成 ×2（堆高军衔主将碾压一路）' },
  { id: 'martyr', name: '死士', kind: 'link', cost: 16, archetype: 'wide', text: '本路首张兵阵亡 → 该路余下未翻的兵 +10 favor（报仇·死战 · 铺场流）' },
  { id: 'chain', name: '连环', kind: 'link', cost: 19, archetype: 'wide', text: '本路首张兵翻正 → 牵起下一张未翻的兵必活（连环索 · 铺场流）' },
  { id: 'quartermaster', name: '督粮', kind: 'economy', cost: 18, archetype: 'decap', text: '每胜一路 → 下场备战 +1◈ 干预能量（攒能秒将 · 斩首流）' },
  { id: 'shadow', name: '影武者', kind: 'revenge', cost: 20, archetype: 'decap', text: '我某路主将被斩首 → 该路余部 +12 favor 复仇（替身死战 · 斩首流）' },
  // ── 天罡牌一期（20张 · contract③ · doc20 §二 · 甲写解释器）──
  // A · 概率系 odds
  { id: 'qiaoshou', name: '巧手', kind: 'odds', rarity: 'common', cost: 12, archetype: 'probability', power: 1, phat: 2, params: { op: 'add', value: 1 }, text: '我方每次对决掷命 +1 点（微稳·地基）' },
  { id: 'wenshou', name: '稳手', kind: 'odds', rarity: 'rare', cost: 16, archetype: 'probability', power: 2, phat: 4, params: { op: 'winFloor', value: 5 }, text: '我方胜率下限 +5%（少翻车·进阶）' },
  { id: 'beishui', name: '背水', kind: 'odds', rarity: 'epic', cost: 22, archetype: 'probability', power: 3, phat: 6, params: { op: 'reroll', when: 'afterLoss', value: 1 }, text: '该路输一场 → 下场 +1 重摇（强力·死缠流）' },
  // B · 点数系 power
  { id: 'hufu', name: '虎符', kind: 'power', rarity: 'common', cost: 12, archetype: 'general', power: 1, phat: 2, params: { op: 'add', value: 2 }, text: '全军 +2 战力点数（全局微加·地基）' },
  { id: 'tonghuakui', name: '同花魁', kind: 'power', rarity: 'rare', cost: 18, archetype: 'cardtype', power: 2, phat: 4, params: { op: 'add', value: 3, filter: 'sameSuit' }, text: '同花色牌互 +3 战力（同花流核心）' },
  { id: 'guabing', name: '寡兵', kind: 'power', rarity: 'epic', cost: 22, archetype: 'tianji', power: 3, phat: 6, params: { op: 'add', value: 6, filter: 'countLE3' }, text: '本路 ≤3 张 → 每张 +6 战力（以少胜多）' },
  // C · 牌型系 combo
  { id: 'duizijue', name: '对子诀', kind: 'combo', rarity: 'common', cost: 14, archetype: 'cardtype', power: 1, phat: 3, params: { op: 'pair', bonus: 6 }, text: '本路含对子 → +6 战力（入门牌型流）' },
  { id: 'shunzizhen', name: '顺子阵', kind: 'combo', rarity: 'epic', cost: 22, archetype: 'cardtype', power: 3, phat: 6, params: { op: 'straight', bonus: 'tier1' }, text: '本路成顺子 → 牌型阶梯 +1 档（顺子流）' },
  // D · 将领系 morale
  { id: 'lingqi', name: '令旗', kind: 'morale', rarity: 'common', cost: 16, archetype: 'general', power: 1, phat: 3, params: { op: 'leaderBuff', value: 4 }, text: '主将在 → 下属士气 +8→+12（将领流地基）' },
  { id: 'qinwang', name: '擒王', kind: 'morale', rarity: 'rare', cost: 18, archetype: 'decap', power: 2, phat: 4, params: { op: 'decapCost', value: -1 }, text: '斩首令 −1◈ 成本（斩首流降门槛）' },
  // E · 行军系 tempo
  { id: 'jixing', name: '疾行', kind: 'tempo', rarity: 'rare', cost: 16, archetype: 'wide', power: 2, phat: 4, params: { op: 'speedUp', value: 50, target: 'self' }, text: '我一路行军 +50% 速（抢线先手）' },
  { id: 'chizhi', name: '迟滞', kind: 'tempo', rarity: 'rare', cost: 18, archetype: 'decap', power: 2, phat: 4, params: { op: 'slowEnemy', value: -40, target: 'enemy' }, text: '敌一路行军 −40% 速（拖延打时差）' },
  // F · 续航系 stamina
  { id: 'tiehan', name: '铁汉', kind: 'stamina', rarity: 'rare', cost: 16, archetype: 'wide', power: 2, phat: 4, params: { op: 'stamPlus', value: 1 }, text: '全军续航 +1（多凿一格·铺场流）' },
  // G · 抽牌系 draw
  { id: 'guangna', name: '广纳', kind: 'draw', rarity: 'common', cost: 14, archetype: 'general', power: 1, phat: 3, params: { op: 'handMax', value: 2 }, text: '手牌上限 +2（更多选择·地基）' },
  { id: 'zhanchao', name: '战潮', kind: 'draw', rarity: 'epic', cost: 22, archetype: 'wide', power: 3, phat: 6, params: { op: 'pulse', when: 'clash', value: 2 }, text: '遭遇翻牌涌牌 ×2（心流峰值·大心脏）' },
  // H · 三路系 lane
  { id: 'zengyuanlu', name: '增援路', kind: 'lane', rarity: 'rare', cost: 16, archetype: 'wide', power: 2, phat: 4, params: { op: 'reinforce', value: 2 }, text: '指定一路 +2 张兵（铺场补路）' },
  { id: 'qiyibaer', name: '弃一保二', kind: 'lane', rarity: 'epic', cost: 22, archetype: 'tianji', power: 3, phat: 6, params: { op: 'sacrifice', value: 10 }, text: '主动弃一路 → 另两路各 +10（田忌精髓）' },
  // I · 攻守系 siege
  { id: 'gongchengchui', name: '攻城锤', kind: 'siege', rarity: 'epic', cost: 24, archetype: 'decap', power: 3, phat: 7, params: { op: 'chipMore', value: 1 }, text: '突破方破老家多 chip 1 血（加速收口）' },
  // J · 流派印记 arcane（传说 · 集齐解锁质变）
  { id: 'zhanshouyin', name: '斩首印', kind: 'arcane', rarity: 'legendary', cost: 42, archetype: 'decap', power: 5, phat: 9, params: { mark: 'decap' }, text: '集齐斩首流印记 → 斩首额外−溃散·敌主将更脆（流派招牌质变）' },
  { id: 'tianjiyin', name: '田忌印', kind: 'arcane', rarity: 'legendary', cost: 42, archetype: 'tianji', power: 5, phat: 9, params: { mark: 'sacrifice' }, text: '集齐弃一保二流印记 → 弃路 favor 转移 ×1.5（流派招牌质变）' },
];
/** 从已融天罡取结局联动开关（死士/连环）→ 喂 resolveArmy 前向生效。 */
export function tiangangLinks(tiangangIds: readonly string[]): LinkTiangangs {
  return { martyr: tiangangIds.includes('martyr'), chain: tiangangIds.includes('chain') };
}
const QUARTERMASTER_PER_LANE = 1; // 督粮：每胜一路 +1◈（入下场 run 能量池，post-resolve）
/** 督粮：结算后按胜路数算给下场的 ◈ 增益（拥有才有；run 经济，不破本场揭晓前花能量的相位）。 */
export function quartermasterEnergy(tiangangIds: readonly string[], lanesWon: number): number {
  return tiangangIds.includes('quartermaster') ? QUARTERMASTER_PER_LANE * Math.max(0, lanesWon) : 0;
}

// ── T-G6 · 星球牌（第二养成轴 · design/12 §三 · 升档/可叠加）──
// 与天罡（一次性·改规则·身份）正交：星球 = **可叠加的升档**（买 N 级累加），改 run 参数 / 军阵底盘。持久存档、跨 run。
// 本批 3 张：命(run 命线上限)/能(干预能量上限+回能)/军(「兵」档 favor 底盘)——皆**与大厅 deck-favor 商店不重叠**的新轴
// （命/能=run 经济无现成；军=作用在 built 军阵的兵档结构，非 deck 均值偏置）。路(选路)/型(牌型档) 待 design 定目标 UI，见 finish。
export type PlanetKind = 'lives' | 'energy' | 'rank-favor' | 'tier';
export interface PlanetCard { id: string; name: string; kind: PlanetKind; cost: number; amount: number; text: string }
export const GAME_G_PLANETS: PlanetCard[] = [
  { id: 'saturn', name: '星球·命', kind: 'lives', cost: 24, amount: 1, text: '战役命线上限 +1/级（更长的 run）' },
  { id: 'jupiter', name: '星球·能', kind: 'energy', cost: 20, amount: 1, text: '干预能量上限 +1 且每胜回能 +1/级' },
  { id: 'mars', name: '星球·军', kind: 'rank-favor', cost: 14, amount: 3, text: '全军「兵」档(A–6) favor +3/级（夯实底盘）' },
  { id: 'mercury', name: '星球·型', kind: 'tier', cost: 16, amount: 4, text: '牌型羁绊（同花/顺子卡）整条阶梯 +4/级（牌型流升档）' },
];
export const PLANET_BY_ID: ReadonlyMap<string, PlanetCard> = new Map(GAME_G_PLANETS.map((p) => [p.id, p]));
const planetBump = (planets: Record<string, number> | undefined, id: string): number => (planets?.[id] ?? 0) * (PLANET_BY_ID.get(id)?.amount ?? 0);
/** 派生 run 参数（叠加星球级数；纯函数、可测）。星球持久 → run 重开读它。 */
export function effectiveLives(planets: Record<string, number>): number { return RUN_LIVES + planetBump(planets, 'saturn'); }
export function effectiveLeverCap(planets: Record<string, number>): number { return LEVER_CAP + planetBump(planets, 'jupiter'); }
export function effectiveLeverRegen(planets: Record<string, number>): number { return LEVER_REGEN + planetBump(planets, 'jupiter'); }
export function effectiveTierBonus(planets: Record<string, number>): number { return planetBump(planets, 'mercury'); } // 星球·型：牌型阶梯全局加成

// ── T-G6 · 闪艺 foil 收集皮肤（design reply#17 · 附魔回驳→纯表现收集）──
// ⛔ 纯表现 / 不进 hash / 零平衡影响：只是局外**收集欲**的牌组装饰，买下=解锁、零 gameplay 作用。最弱 LLM 能填 {id,name,cost}。
export interface FoilSkin { id: string; name: string; cost: number; desc: string }
export const GAME_G_FOILS: FoilSkin[] = [
  { id: 'gilt', name: '鎏金', cost: 30, desc: '金箔流光' },
  { id: 'azure', name: '碧霄', cost: 45, desc: '青碧全息' },
  { id: 'crimson', name: '赤焰', cost: 60, desc: '赤红炽芒' },
  { id: 'obsidian', name: '玄曜', cost: 90, desc: '玄黑曜辉' },
];
const PLANET_TROOP_RANKS = new Set(['A', '2', '3', '4', '5', '6']); // 「兵」档（星球·军作用域）
/** 星球·军：揭晓前给军阵「兵」档 +favor（叠加级数）。build-时变换、outcome-first；作用 built 军阵结构（非 deck 均值）。 */
export function applyPlanetArmy(army: ArmyCard[], planets: Record<string, number>): ArmyCard[] {
  const bump = planetBump(planets, 'mars');
  return army.map((c) => (bump > 0 && PLANET_TROOP_RANKS.has(c.rank) ? { ...c, favor: clampFavor(c.favor + bump) } : { ...c }));
}
export const TIANGANG_BY_ID: ReadonlyMap<string, TiangangCard> = new Map(GAME_G_TIANGANGS.map((j) => [j.id, j]));

/** 流派钥匙：把"未拥有的天罡牌"包成场间三选一可白嫖的 RunBuff（design reply#10：场间选择=构筑分叉）。已拥有的不再出。 */
export function tiangangKeyBuffs(ownedIds: readonly string[]): RunBuff[] {
  return GAME_G_TIANGANGS.filter((j) => !ownedIds.includes(j.id)).map((j) => ({
    id: `key_${j.id}`, name: `🃏钥匙·${j.name}`, desc: `融入天罡【${j.name}】：${j.text}`, kind: 'tiangang', amount: 0, tiangangId: j.id,
  }));
}

// ── T-G6 · 流派 + 克制网（design/12 §四 · 身份 + 石头剪刀布）──
// 流派 = 由已融天罡浮现的身份；克制网 = **双 3-环** rock-paper-scissors（无唯一最优 → 看对手临场调布阵/干预）。
// 纯数据：每流派 {keyJokers, counters} 最弱 LLM 能填；detectArchetype 数已融天罡归属、archetypeMatchup 查克制——零新能力。
export interface ArchetypeSpec { id: Archetype; name: string; desc: string; keyTiangangs: string[]; counters: Archetype }
export const ARCHETYPES: ArchetypeSpec[] = [
  // 核心 3-环（`12` §四明示）：斩首 克 将领 克 铺场 克 斩首。
  { id: 'decap', name: '斩首流', desc: '攒能量秒敌主将引溃散', keyTiangangs: ['quartermaster', 'shadow'], counters: 'general' },
  { id: 'general', name: '将领流', desc: '主将士气碾压一路', keyTiangangs: ['bannerman', 'warlord'], counters: 'wide' },
  { id: 'wide', name: '铺场流', desc: 'go-wide + 连锁必活', keyTiangangs: ['vanguard', 'martyr', 'chain'], counters: 'decap' },
  // 次 3-环（我的合理映射，待 design 校准）：牌型 克 概率 克 弃一保二 克 牌型。
  { id: 'cardtype', name: '牌型流', desc: '堆同花色/连号成高牌型', keyTiangangs: ['comrade'], counters: 'probability' },
  { id: 'probability', name: '概率流', desc: '改命堆高 favor 稳翻正', keyTiangangs: ['gambler', 'diehard'], counters: 'tianji' },
  { id: 'tianji', name: '弃一保二流', desc: '弃一路、经济滚两路', keyTiangangs: [], counters: 'cardtype' }, // 钥匙：田忌布阵/督粮(待)
];
const ARCH_BY_ID: ReadonlyMap<Archetype, ArchetypeSpec> = new Map(ARCHETYPES.map((a) => [a.id, a]));
/** 由已融天罡浮现的主流派：数每流派 keyTiangangs 命中数，取最高（平局取 ARCHETYPES 靠前）；无命中 → null。 */
export function detectArchetype(tiangangIds: readonly string[]): ArchetypeSpec | null {
  let best: ArchetypeSpec | null = null;
  let bestN = 0;
  for (const a of ARCHETYPES) {
    const n = a.keyTiangangs.filter((k) => tiangangIds.includes(k)).length;
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

// ── T-G6 · 流派激活质变（design/12 §四.5 · "钥匙解锁招牌强度" → 闭合"选择即流派"）──
// 触发：你的**主流派**(detectArchetype 多数决)且**集齐其 keyJokers**(全融承诺) → 施该流派**招牌增益**。只主流派激活(防混搭叠猛)。
// ⚠️ 与 design#16 的差异(已报 finish，待 design 核)：① 原阈值"≥3 keyJokers"与现 keyJoker 数(多为 2)不符 → 改"集齐主流派全 keyJokers"(6 流派皆可达)；
//    ② 原招式 概率(改 decideFaceUp 下限)/弃一保二(favor 转移)/斩首(−1◈+溃散−20) 需新机制/改核 → 取**等价 build-时近似**(各注)。全 build 时、outcome-first、零新能力。
const ACTIVATION_FAVOR = 8; // 弃一保二：两强路集中 +favor
export function activeArchetype(tiangangIds: readonly string[]): Archetype | null {
  const main = detectArchetype(tiangangIds); // 多数决主流派
  if (!main || main.keyTiangangs.length === 0) return null;
  return main.keyTiangangs.every((k) => tiangangIds.includes(k)) ? main.id : null; // 集齐主流派 keyJokers 才质变
}
/**
 * 施主流派招牌增益（揭晓前 build-时）。返回改后 a/b + 士气倍率/牌型阶梯加成（喂下游 moraleA / 干预 tierBonus）。
 * 纯函数、确定性：将领=士气×1.3 / 铺场=每路+2兵 / 牌型=阶梯+12(≈×2) / 概率=favor下限15 / 斩首=敌主将−12先怯 / 弃一保二=两强路+favor。
 */
export function applyArchetypeActivation(active: Archetype, armyA: ArmyCard[], armyB: ArmyCard[], biasA: number): { a: ArmyCard[]; b: ArmyCard[]; moraleMul: number; tierBonusAdd: number } {
  let a = armyA.map((c) => ({ ...c }));
  let b = armyB.map((c) => ({ ...c }));
  let moraleMul = 1;
  let tierBonusAdd = 0;
  if (active === 'general') moraleMul = 1.3; // 将领流：主将士气 ×1.3
  else if (active === 'wide') {
    for (const lane of [0, 1, 2]) a.push(
      { id: `a_l${lane}_act0`, rank: 'A', lane, favor: clampFavor(46 + biasA), general: false, suit: 'S' },
      { id: `a_l${lane}_act1`, rank: '2', lane, favor: clampFavor(46 + biasA), general: false, suit: 'H' },
    ); // 铺场流：每路 +2 兵
  } else if (active === 'cardtype') tierBonusAdd = 12; // 牌型流：阶梯近 ×2（近似 design 的 ×2）
  else if (active === 'probability') a = a.map((c) => (c.favor < 15 ? { ...c, favor: 15 } : c)); // 概率流：favor 下限 15（≈下限 5%→15%）
  else if (active === 'decap') b = b.map((c) => (c.general ? { ...c, favor: clampFavor(c.favor - 12) } : c)); // 斩首流：敌主将先怯 −12（近似 −1◈/溃散−20）
  else if (active === 'tianji') {
    const sums = [0, 1, 2].map((l) => a.filter((c) => c.lane === l).reduce((s, c) => s + c.favor, 0));
    const weakest = sums.indexOf(Math.min(...sums));
    a = a.map((c) => (c.lane !== weakest ? { ...c, favor: clampFavor(c.favor + ACTIVATION_FAVOR) } : c)); // 弃一保二：两强路集中
  }
  return { a, b, moraleMul, tierBonusAdd };
}

// 从已融天罡算每路士气倍率（旗手全路、枭雄仅顶级主将路）→ 喂 resolveArmy。复用 `06` 士气、不新机制。
const TOP_RANKS = new Set(['JOKER', 'K']); // 顶级军衔（枭雄触发档）
export function tiangangMoraleScale(army: ArmyCard[], tiangangIds: readonly string[]): number[] {
  const scale = [1, 1, 1];
  for (const id of tiangangIds) {
    const j = TIANGANG_BY_ID.get(id);
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
 * 融天罡：揭晓前按已融天罡（持久）把军阵 favor 变换 → 返回新军，喂 applyInterventions/build。
 * outcome-first：只改掷命前输入；同军+同天罡集 → 同结果（确定性、可回放）。纯 build 时、零 rng、零新能力。
 */
export function applyTiangangs(army: ArmyCard[], tiangangIds: readonly string[]): ArmyCard[] {
  let out = army.map((c) => ({ ...c }));
  for (const id of tiangangIds) {
    const j = TIANGANG_BY_ID.get(id);
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
 *   成军(布阵+deck偏置) → 融天罡(applyJokers) → 玩家干预(caster='a') → Boss 起手干预(caster='b') → 算士气倍率。
 * 全在揭晓前、不回灌 gameplay（outcome-first）；返回喂 buildGameGArmyMatch 的 {a,b,moraleA}。纯函数、可重放。
 */
export interface MatchSetup { formation: Formation; deckBias: number; tiangangs: readonly string[]; interventions: Intervention[]; enemyForm?: Formation; enemyBias: number; boss?: BossSpec | null; planets?: Record<string, number> }
export function prepareArmies(s: MatchSetup): { a: ArmyCard[]; b: ArmyCard[]; moraleA: number[]; linksA: LinkTiangangs } {
  const planets = s.planets ?? {};
  let a = applyTiangangs(applyPlanetArmy(armyFromFormation('a', s.deckBias, s.formation), planets), s.tiangangs); // 星球·军(兵档底盘) → 融天罡（持久 favor 变换）
  let b = armyFromFormation('b', s.enemyBias, s.enemyForm);
  // 流派激活质变：主流派集齐 keyJokers → 招牌增益（改 a/b + 士气倍率/牌型阶梯加成）。
  const active = activeArchetype(s.tiangangs);
  let moraleMul = 1;
  let tierAdd = 0;
  if (active) { const r = applyArchetypeActivation(active, a, b, s.deckBias); a = r.a; b = r.b; moraleMul = r.moraleMul; tierAdd = r.tierBonusAdd; }
  ({ a, b } = applyInterventions(a, b, s.interventions, s.deckBias, 'a', effectiveTierBonus(planets) + tierAdd)); // 玩家干预（flush 吃星球·型 + 牌型流激活）
  if (s.boss && s.boss.openingLevers.length) ({ a, b } = applyInterventions(a, b, s.boss.openingLevers, s.enemyBias, 'b')); // Boss 起手（对称）
  if (s.tiangangs.includes('shadow')) a = applyShadowRevenge(a); // 影武者：敌斩首命中我主将 → 该路余部复仇（在 Boss 干预后侦测）
  return { a, b, moraleA: tiangangMoraleScale(a, s.tiangangs).map((m) => m * moraleMul), linksA: tiangangLinks(s.tiangangs) }; // 士气倍率(×将领流激活) + 结局联动
}

// ── 行军·攻克大本营 调参（design/17 §二；owner 纠偏：实时三路行军取代瞬间翻牌；先破者胜）──
export const HOME_HP = 8;     // 大本营血量（被突破方 chip 到 0 = 攻克 = 负）
const MARCH_T0 = 12;          // 翻牌后 → 首拍破家前的行军延迟（拍；给"兵在路上走"的时间纵深）
const MARCH_PERIOD = 5;       // 每拍破家间隔（拍）
export const MARCH_DURATION = MARCH_T0 + HOME_HP * MARCH_PERIOD; // 行军/攻克相位时长；胜负在 FLIP_DURATION+MARCH_DURATION 那拍落定

/**
 * G2 一局军阵对决：armyA(我) vs armyB(敌)，自上而下逐级掷命(将领牵动) → 三路数存活 →
 *   **行军突破·攻克大本营**定胜负（design/17 §二）：每路幸存差=突破到敌老家的兵，净突破方逐拍 chip 敌
 *   `home_hp`→0=攻克=胜（取代旧 best-of-3）。掷命结果仍 build 时规则定(outcome-first)，行军是确定性时间结构。
 * 装配顺序 A 全军 → B 全军（PRNG 序列确定、可回放）。胜负 build 时即定；3D 行军/抛飞为表现。
 * moraleA：我方各路士气倍率（旗手/枭雄天罡放大，缺省 [1,1,1]）；敌方无天罡。缩放不改掷命次数→确定性不变。
 * linksA：我方结局联动（死士/连环，缺省关）；前向单遍生效、只动未翻牌 → hash 稳。敌方无天罡。
 */
export function buildGameGArmyMatch(armyA: ArmyCard[], armyB: ArmyCard[], seed = 1, reward = MATCH_REWARD, moraleA: readonly number[] = [1, 1, 1], linksA: LinkTiangangs = { martyr: false, chain: false }): WorldBlueprint {
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

  // 各路 build 时幸存数（= 下方 GroupCount 的 res_a{L}/res_b{L}，同源 faceA/faceB）→ 算行军突破。
  const aSurv = [0, 1, 2].map((L) => armyA.filter((c) => c.lane === L && faceA.get(c.id)).length);
  const bSurv = [0, 1, 2].map((L) => armyB.filter((c) => c.lane === L && faceB.get(c.id)).length);

  // 三路数存活（含齐 队|路|ALIVE）
  for (const L of [0, 1, 2]) {
    entities[`gc_a${L}`] = { GroupCount: { countResource: `a_l${L}`, requiredTag: TEAM_A | LANE[L] | ALIVE } };
    entities[`gc_b${L}`] = { GroupCount: { countResource: `b_l${L}`, requiredTag: TEAM_B | LANE[L] | ALIVE } };
    entities[`res_a${L}`] = { Resource: { id: `a_l${L}`, current: 0, min: 0, max: 99 } };
    entities[`res_b${L}`] = { Resource: { id: `b_l${L}`, current: 0, min: 0, max: 99 } };
  }
  entities.res_alanes = { Resource: { id: 'a_lanes', current: 0, min: 0, max: 3 } }; // 赢几路（督粮/战况显示用；不再决定总胜负）
  entities.res_blanes = { Resource: { id: 'b_lanes', current: 0, min: 0, max: 3 } };
  entities.res_ahome = { Resource: { id: 'a_home', current: HOME_HP, min: 0, max: HOME_HP } }; // 我方大本营血（被攻克=0=我负）
  entities.res_bhome = { Resource: { id: 'b_home', current: HOME_HP, min: 0, max: HOME_HP } }; // 敌方大本营血（被攻克=0=我胜）
  entities.res_mats = { Resource: { id: 'mats', current: 0, min: 0, max: 99999 } };
  entities.winner = { State: { fsmId: 'winner', current: 'pending' } };
  entities.clock = { Timer: { id: 'match_clock', elapsed: 0, duration: FLIP_DURATION + MARCH_DURATION + 6, loop: false } };

  // ① 翻牌演完(Timer 到 FLIP_DURATION)那拍，逐路比存活 → 累计各方"赢几路"。
  const tLane = { kind: 'timer', id: 'match_clock', cmp: 'gte', value: FLIP_DURATION };
  for (const L of [0, 1, 2]) {
    entities[`when_a_lane${L}`] = { EventWhen: { signal: `a_lane${L}`, when: { kind: 'and', of: [tLane, { kind: 'resource', id: `a_l${L}`, cmp: 'gt', value: 0, vsResource: `b_l${L}` }] }, mode: 'edge', armed: false } };
    entities[`fx_a_lane${L}`] = { Effect: { onSignal: `a_lane${L}`, kind: 'modify-resource', targetId: 'a_lanes', value: 1 } };
    entities[`when_b_lane${L}`] = { EventWhen: { signal: `b_lane${L}`, when: { kind: 'and', of: [tLane, { kind: 'resource', id: `a_l${L}`, cmp: 'lt', value: 0, vsResource: `b_l${L}` }] }, mode: 'edge', armed: false } };
    entities[`fx_b_lane${L}`] = { Effect: { onSignal: `b_lane${L}`, kind: 'modify-resource', targetId: 'b_lanes', value: 1 } };
  }
  // ② 行军·攻克大本营（design/17 §二，取代 best-of-3）：每路幸存差 = 突破到敌方老家的兵，
  //    净突破方逐拍 chip 敌老家血 → 打到 0 = 攻克 = 胜。掷命结果仍规则定(outcome-first)，行军是确定性时间结构。
  const dmgToB = aSurv.reduce((s, av, L) => s + Math.max(0, av - bSurv[L]), 0); // A 净突破 → 攻 B 老家
  const dmgToA = bSurv.reduce((s, bv, L) => s + Math.max(0, bv - aSurv[L]), 0); // B 净突破 → 攻 A 老家
  const w = dmgToB > dmgToA ? 'a' : dmgToA > dmgToB ? 'b' : 'draw';
  // 被攻克的老家逐拍 chip 到 0（行军时间纵深，可见"破家"过程）；赢家老家只受较少伤、不破。
  const chip = (home: string, steps: number, sig: string): void => {
    for (let k = 1; k <= steps; k++) {
      entities[`when_${sig}${k}`] = { EventWhen: { signal: `${sig}${k}`, when: { kind: 'timer', id: 'match_clock', cmp: 'gte', value: FLIP_DURATION + MARCH_T0 + k * MARCH_PERIOD }, mode: 'edge', armed: false } };
      entities[`fx_${sig}${k}`] = { Effect: { onSignal: `${sig}${k}`, kind: 'modify-resource', targetId: home, value: -1 } };
    }
  };
  chip('a_home', w === 'b' ? HOME_HP : Math.min(dmgToA, HOME_HP - 1), 'ca'); // 我被攻克(w=b)→破到0；否则只受 dmgToA 伤、不破
  chip('b_home', w === 'a' ? HOME_HP : Math.min(dmgToB, HOME_HP - 1), 'cb'); // 敌被攻克(w=a)→破到0；否则只受 dmgToB 伤、不破
  // 攻克那拍（被攻克老家恰 chip 完）定总胜负 + 我方(a)胜给材料。
  entities.when_decide = { EventWhen: { signal: 'decide', when: { kind: 'timer', id: 'match_clock', cmp: 'gte', value: FLIP_DURATION + MARCH_DURATION }, mode: 'edge', armed: false } };
  entities.fx_decide = { Effect: { onSignal: 'decide', kind: 'set-state', targetId: 'winner', value: w } };
  if (w === 'a' && reward > 0) entities.fx_decide_mat = { Effect: { onSignal: 'decide', kind: 'modify-resource', targetId: 'mats', value: reward } };

  return { capabilities: MATCH_CAPS, entities };
}

// === 英雄谱：52 位被诅咒的历史名将（doc22 世界观 + doc23 正典名册 · 每张牌一个英雄） ===
// 铁律（doc22 §四）：英雄层 = **纯叙事 / 皮肤**，不进对战强度（公平骨架）；列传逐期补、缺则优雅占位、0 篇也能跑。
// 映射（doc23 §三）：贡献度 #1→A♠ … #52→2♣（同档 ♠>♥>♦>♣）。rank=军衔基线（公平·双方同有），英雄身份只叙事。
export type HeroRar = 'white' | 'green' | 'blue' | 'purple' | 'orange';
export interface HeroCard {
  id: string; rank: string; suit: '♠'|'♥'|'♦'|'♣';
  name: string; title: string; era: string; contribRank: number; contrib: string; // 永远有（doc23 §三）
  rar: HeroRar; own: number; // 收藏 / 展示态
  // 可选 · 二阶列传文案（doc23 §二 schema · 逐期填 · 缺字段则该处优雅占位）
  curseIntro?: string; bio?: string; battleName?: string; battleResult?: string; quote?: string; titleOrigin?: string;
}
export const HERO_CARDS: HeroCard[] = [
  // 军衔 A（贡献度 #1–4 · ♠♥♦♣ · doc23 §三）
  { id:'AS',rank:'A',suit:'♠',name:'孙武',title:'兵圣',era:'春秋·齐/吴',contribRank:1,contrib:'《孙子兵法》东方兵学之祖，影响全球 2500 年',rar:'orange',own:1,
    curseIntro:'兵圣之魂，封于黑桃之尖。每一次掷命，都是吴宫教战的那一斩——令出如山，生死立判。',
    bio:'孙武，春秋齐国人，避乱奔吴。以兵法十三篇见吴王阖闾。王欲试其能，命以宫女演阵；宫女嬉笑不从，孙武三令五申而队伍再乱，遂斩王之爱姬二人以肃军令——于是众皆股栗、进退如一。阖闾由是知其善将，拜为将军。前 506 年，孙武与伍子胥率吴师伐楚，五战五捷，柏举一役长驱破郢，以三万之众破楚二十万，春秋第一远征。功成不居，孙武飘然归隐，唯留《孙子兵法》传世。',
    battleName:'柏举之战',battleResult:'三万吴师破楚二十万、攻入楚都郢',quote:'知己知彼，百战不殆。',
    titleOrigin:'兵学之祖，后世尊为「兵圣」；十三篇为古今中外兵家圭臬。' },
  { id:'AH',rank:'A',suit:'♥',name:'成吉思汗',title:'一代天骄',era:'13C·蒙古',contribRank:2,contrib:'史上最大陆地帝国，骑兵机动战革命',rar:'orange',own:1,
    curseIntro:'草原苍狼之魂，封于红心王座。掷命之时，铁蹄声起——如海洋般的大汗，重临人间。',
    bio:'铁木真，蒙古乞颜部人。少年丧父、部众离散，于苦寒中崛起。以「札撒」立法、以千户制建军，二十余年间统一蒙古诸部。前 1206 年于斡难河源称「成吉思汗」。其后挥师西征，灭花剌子模、踏中亚、饮马里海；南向攻金、围中都。铁骑所至，疆域横跨欧亚，为史上最大之陆地帝国。临终犹定下灭金之策，遗志由子孙承续。',
    battleName:'野狐岭之战',battleResult:'十万蒙古铁骑大破金军四十五万',
    titleOrigin:'「成吉思汗」意为「如海洋四方般拥有的大汗」——普世君主之号。' },
  { id:'AD',rank:'A',suit:'♦',name:'亚历山大大帝',title:'征服者',era:'BC4C·马其顿',contribRank:3,contrib:'十年无败绩，三十岁征服已知世界',rar:'orange',own:1,
    curseIntro:'征服者之魂，封于方块之尖。掷命之时，马其顿长枪如林——未尝一败的少年王，再度东征。',
    bio:'亚历山大，马其顿王腓力二世之子，师从亚里士多德。二十岁继位，旋即东征：格拉尼库斯、伊苏斯、高加米拉三战连破波斯大军，灭大流士三世之阿契美尼德帝国；又南下埃及、东抵印度河，沿途建亚历山大城数十座，播希腊文明于亚洲。十三年征战未尝一败，三十三岁病逝于巴比伦，庞大帝国旋即分裂于诸将之手。',
    battleName:'高加米拉之战',battleResult:'四万联军大破波斯数十万、灭阿契美尼德帝国',
    titleOrigin:'十年征服已知世界、未尝败绩，后世尊为「大帝」与「征服者」。' },
  { id:'AC',rank:'A',suit:'♣',name:'拿破仑',title:'战争之神',era:'18–19C·法国',contribRank:4,contrib:'重塑欧洲，奠定近代军制与战法',rar:'orange',own:1,
    curseIntro:'战争之神之魂，封于梅花之尖。掷命声起，如奥斯特里茨的炮火——欧洲在他的棋盘上重新洗牌。',
    bio:'拿破仑·波拿巴，科西嘉人，于法国大革命中崛起。土伦之役崭露头角，雾月政变掌权、自立为帝。奥斯特里茨以少胜多大破俄奥联军，耶拿、弗里德兰连战连捷，几乎征服全欧；颁《拿破仑法典》奠定近代法制。然远征俄国折戟莫斯科严冬，莱比锡兵败、滑铁卢终局，两度退位，囚死于圣赫勒拿孤岛。',
    battleName:'奥斯特里茨之战（三皇会战）',battleResult:'七万法军大破俄奥联军近九万',quote:'在我的字典里，没有「不可能」。',
    titleOrigin:'用兵如神、重塑欧洲军制战法，世人尊为「战争之神」。' },
  // 军衔 K（贡献度 #5–8 · ♠♥♦♣ · doc23 §三）
  { id:'KS',rank:'K',suit:'♠',name:'凯撒',title:'高卢征服者',era:'BC1C·罗马',contribRank:5,contrib:'《高卢战记》，罗马霸权奠基',rar:'purple',own:0,
    curseIntro:'高卢征服者之魂，封于黑桃之王。掷命之际，骰子已掷——渡过卢比孔河的脚步，永世回响。',
    bio:'盖乌斯·尤利乌斯·凯撒，罗马政治家、统帅。八年征服高卢全境，《高卢战记》传世；渡卢比孔河、击败庞培，结束共和内战，独揽大权为终身独裁官。改历法（儒略历）、推行新政。前 44 年三月十五日，于元老院被布鲁图斯等人围刺，二十三剑殒命。',
    battleName:'阿莱西亚之战',battleResult:'内外双壁、围点打援、全定高卢',quote:'我来，我见，我征服。',
    titleOrigin:'征服高卢、奠定罗马霸权，「凯撒」后成帝王尊号（Kaiser、Tsar 皆源于此）。' },
  { id:'KH',rank:'K',suit:'♥',name:'汉尼拔',title:'战略之父',era:'BC3C·迦太基',contribRank:6,contrib:'翻越阿尔卑斯，坎尼歼灭战千古典范',rar:'purple',own:0,
    curseIntro:'战略之父之魂，封于红心之王。掷命之时，战象踏雪而来——迦太基的复仇，缠绕罗马十六年。',
    bio:'汉尼拔·巴卡，迦太基统帅。第二次布匿战争中率军翻越阿尔卑斯山奇袭意大利；特拉西梅诺、坎尼连歼罗马大军，坎尼一役以钳形合围全歼罗马八万之众，为千古歼灭战之典范。纵横意大利十六载，终因本土无援、扎马会战败于西庇阿，晚年流亡，服毒自尽以免受俘。',
    battleName:'坎尼会战',battleResult:'钳形合围、全歼罗马军八万',quote:'我们要么找到一条路，要么自己开辟一条。',
    titleOrigin:'坎尼歼灭战为西方军事学奠基，后世尊为「战略之父」。' },
  { id:'KD',rank:'K',suit:'♦',name:'韩信',title:'兵仙',era:'BC3C·汉',contribRank:7,contrib:'背水一战、十面埋伏，助汉定天下',rar:'purple',own:1,
    curseIntro:'兵仙之魂，封于方块之王。胯下之辱与垓下之围，皆在这一张牌的命运里轮回。',
    bio:'韩信，淮阴人。少时贫困，受漂母一饭之恩，亦忍恶少胯下之辱。初事项羽不见用，转投刘邦，经萧何月下追还、登坛拜为大将。其用兵如神：明修栈道、暗度陈仓还定三秦；井陉一役背水列阵，置之死地而后生，以数万破赵二十万；继下齐、围楚，垓下十面埋伏、四面楚歌，逼项羽自刎乌江，为汉定鼎天下。然功高震主，终以谋反之名被诛于长乐宫钟室——「狡兔死，走狗烹」。',
    battleName:'井陉之战（背水一战）',battleResult:'背水列阵、以少胜多破赵',quote:'（韩信点兵）多多益善。',
    titleOrigin:'用兵出神入化，世称「兵仙」；萧何誉为「国士无双」。' },
  { id:'KC',rank:'K',suit:'♣',name:'白起',title:'杀神',era:'BC3C·秦',contribRank:8,contrib:'一生未尝败，长平定秦基',rar:'purple',own:0,
    curseIntro:'杀神之魂，封于梅花之王。掷命之时，长平的四十万冤魂同醒——一生未尝败绩，亦一生背负杀业。',
    bio:'白起，秦国郿人，号「人屠」。事秦昭王，伊阙之战斩韩魏联军二十四万；攻楚拔郢、水淹鄢城；长平之战诱赵括出击、断粮合围，坑杀降卒四十余万，赵国元气尽丧。一生大小七十余战未尝一败。后与范雎不和、称病拒征，被赐剑自尽于杜邮。',
    battleName:'长平之战',battleResult:'断粮合围、坑赵卒四十余万',
    titleOrigin:'战无不胜、杀伐果决，世称「战神」「人屠」。' },
  // 军衔 Q（贡献度 #9–12 · ♠♥♦♣ · doc23 §三）
  { id:'QS',rank:'Q',suit:'♠',name:'哈立德·伊本·瓦利德',title:'真主之剑',era:'7C·阿拉伯',contribRank:9,contrib:'百战不败，奠定伊斯兰扩张',rar:'purple',own:0,
    curseIntro:'真主之剑之魂，封于黑桃之后。掷命声起，沙漠的旋风骤至——百战不败的剑，再度出鞘。',
    bio:'哈立德·伊本·瓦利德，先知穆罕默德麾下名将。早年于伍侯德之战曾败穆斯林，后归信伊斯兰，被誉为「真主之剑」。里达战争中统一阿拉伯半岛；继而东破萨珊波斯、西败拜占庭，亚尔穆克会战大破拜占庭大军，奠定伊斯兰扩张之基。一生百余战未尝败绩，却于晚年被解职，病逝床榻。',
    battleName:'亚尔穆克会战',battleResult:'大破拜占庭十数万军、夺取叙利亚',
    titleOrigin:'百战百胜，先知亲赐尊号「安拉之剑（真主之剑）」。' },
  { id:'QH',rank:'Q',suit:'♥',name:'居鲁士大帝',title:'万王之王',era:'BC6C·波斯',contribRank:10,contrib:'首个横跨亚非的波斯帝国',rar:'purple',own:0,
    curseIntro:'万王之王之魂，封于红心之后。掷命之时，波斯的旗帜漫卷——宽仁的征服者，重临人世。',
    bio:'居鲁士二世，波斯阿契美尼德王朝缔造者。先并米底、灭吕底亚、再下新巴比伦，释放被囚的犹太人归乡，建立首个横跨亚非的庞大帝国。以宽容治国、尊重各族信仰，《居鲁士文书》被誉为最早的人权宣言。东征游牧之马萨格泰人时战死沙场。',
    battleName:'攻陷巴比伦',battleResult:'引水入城、兵不血刃下巴比伦',
    titleOrigin:'横扫诸国、四海归一，自称「万王之王（Shahanshah）」。' },
  { id:'QD',rank:'Q',suit:'♦',name:'帖木儿',title:'跛足征服者',era:'14C·中亚',contribRank:11,contrib:'重建蒙古式帝国，未尝败绩',rar:'purple',own:0,
    curseIntro:'跛足征服者之魂，封于方块之后。掷命之时，撒马尔罕的尸塔再起——未尝败绩的瘸狼，复行杀伐。',
    bio:'帖木儿，中亚突厥化蒙古贵族，自称成吉思汗之继业者。以撒马尔罕为都，东征西讨：败金帐汗国、破德里苏丹国、于安卡拉之战生擒奥斯曼苏丹巴耶塞特一世。所向披靡、未尝败绩，然杀戮极酷、筑京观尸塔以慑敌。东征明朝途中病逝于讹答剌。',
    battleName:'安卡拉之战',battleResult:'大破奥斯曼、生擒苏丹巴耶塞特一世',
    titleOrigin:'早年腿伤致跛、一生征服无败，世称「跛足帖木儿」。' },
  { id:'QC',rank:'Q',suit:'♣',name:'速不台',title:'常胜先锋',era:'13C·蒙古',contribRank:12,contrib:'横扫欧亚，征域史上最广',rar:'purple',own:0,
    curseIntro:'常胜先锋之魂，封于梅花之后。掷命之际，蒙古的箭雨遮天——横扫欧亚的先锋，再度疾驰。',
    bio:'速不台，蒙古兀良哈部人，成吉思汗「四獒」之一。一生统兵征战，西征于迦勒迦河大破罗斯-钦察联军；后随拔都西征，赛约河之战全歼匈牙利大军、莱格尼茨重创波德联军，兵锋直抵维也纳近郊。东征西讨数十国，史载其征服疆域之广为古今统帅之最。',
    battleName:'赛约河之战',battleResult:'全歼匈牙利军、震动欧洲',
    titleOrigin:'为蒙古西征常胜先锋、征域史上最广，世称「常胜将军」。' },
  // 军衔 J（贡献度 #13–16 · ♠♥♦♣ · doc23 §三）
  { id:'JS',rank:'J',suit:'♠',name:'腓特烈大帝',title:'军事天才',era:'18C·普鲁士',contribRank:13,contrib:'斜击战术，以弱立普鲁士',rar:'blue',own:0,
    curseIntro:'军事天才之魂，封于黑桃之先锋。掷命之时，普鲁士的鼓点骤响——以弱抗强的孤王，再赴险局。',
    bio:'腓特烈二世，普鲁士国王。即位即夺西里西亚，七年战争中独抗法奥俄三大强权之围攻：洛伊滕之战以斜击战术、以少胜多大破奥军；罗斯巴赫速破法军。屡濒亡国而力挽狂澜，终保普鲁士跻身列强。又重文治、兴法制，自称国家第一公仆。',
    battleName:'洛伊滕之战',battleResult:'斜击战术、三万破奥军八万',quote:'我是这个国家的第一公仆。',
    titleOrigin:'以弱国抗群雄而不亡、战术革新卓绝，后世尊为「大帝」。' },
  { id:'JH',rank:'J',suit:'♥',name:'西庇阿',title:'征非者',era:'BC3C·罗马',contribRank:14,contrib:'扎马会战击败汉尼拔',rar:'blue',own:0,
    curseIntro:'征非者之魂，封于红心之先锋。掷命之际，扎马的号角长鸣——击败汉尼拔的人，再立战场。',
    bio:'大西庇阿，罗马统帅。坎尼惨败后临危受命，远征西班牙、夜夺新迦太基；继而渡海攻迦太基本土，迫汉尼拔回援。扎马会战以骑兵决胜、击败汉尼拔，终结第二次布匿战争，获「阿非利加努斯（征非者）」之号。然晚年遭政敌攻讦，黯然退隐乡间。',
    battleName:'扎马会战',battleResult:'骑兵决胜、击败汉尼拔',
    titleOrigin:'远征非洲、击败汉尼拔，元老院授「阿非利加努斯（征非者）」尊号。' },
  { id:'JD',rank:'J',suit:'♦',name:'苏沃洛夫',title:'不败统帅',era:'18C·俄国',contribRank:15,contrib:'六十余战全胜',rar:'blue',own:0,
    curseIntro:'不败统帅之魂，封于方块之先锋。掷命之时，俄罗斯的刺刀闪寒——六十余战未败的老将，再度出征。',
    bio:'亚历山大·苏沃洛夫，俄国陆军元帅。一生历经六十余战、未尝一败。对土战争中里姆尼克、伊兹梅尔屡建奇功；意大利远征大破法军，又率军翻越阿尔卑斯山、绝境突围而归，举世惊叹。治军严而练兵精，著《制胜的科学》。功高遭忌，郁郁而终。',
    battleName:'伊兹梅尔攻城战',battleResult:'强攻奥斯曼坚城、一日而下',quote:'训练多流汗，战时少流血。',
    titleOrigin:'戎马一生、六十余战全胜，俄军尊为不败的「苏沃洛夫元帅」。' },
  { id:'JC',rank:'J',suit:'♣',name:'李靖',title:'大唐军神',era:'7C·唐',contribRank:16,contrib:'灭东突厥，《李卫公兵法》',rar:'blue',own:0,
    curseIntro:'大唐军神之魂，封于梅花之先锋。掷命之际，铁骑踏破阴山雪——灭国名将，再领唐师。',
    bio:'李靖，唐初名将。佐唐平萧铣、辅公祏，定江南；贞观三年统军北伐东突厥，三千骁骑夜袭阴山、生擒颉利可汗，灭东突厥汗国；又西破吐谷浑，拓土万里。著《李卫公兵法》，为唐代兵学宗师。功成知止、闭门谢客，得以善终。',
    battleName:'阴山之战',battleResult:'三千骑夜袭、生擒颉利、灭东突厥',
    titleOrigin:'灭国开疆、用兵入神，后世与白起、韩信并称，尊为「军神」。' },
  // 军衔 10（贡献度 #17–20 · ♠♥♦♣ · doc23 §三）
  { id:'10S',rank:'10',suit:'♠',name:'萨拉丁',title:'伊斯兰之盾',era:'12C·阿尤布',contribRank:17,contrib:'哈丁会战收复耶路撒冷',rar:'blue',own:0,
    curseIntro:'伊斯兰之盾之魂，封于黑桃之十。掷命之时，圣城的月光如水——宽仁的苏丹，再执长剑。',
    bio:'萨拉丁（萨拉赫丁），阿尤布王朝缔造者，库尔德人。统一埃及与叙利亚，哈丁会战诱敌于无水绝地、全歼十字军主力，旋即收复耶路撒冷，结束基督教近百年之占领。第三次十字军东征中与狮心王理查相持不下、议和善了。以宽厚仁义著称，敌我同敬。',
    battleName:'哈丁会战',battleResult:'绝地围歼十字军、收复耶路撒冷',
    titleOrigin:'收复圣城、护卫伊斯兰世界，被尊为「信仰的卫士（伊斯兰之盾）」。' },
  { id:'10H',rank:'10',suit:'♥',name:'古斯塔夫二世',title:'近代战争之父',era:'17C·瑞典',contribRank:18,contrib:'诸兵种协同革新',rar:'blue',own:0,
    curseIntro:'近代战争之父之魂，封于红心之十。掷命之际，瑞典的火炮列阵——北方雄狮，再临战场。',
    bio:'古斯塔夫二世·阿道夫，瑞典国王。三十年战争中率新教联军入德意志，革新军制：轻型火炮、线列齐射、诸兵种协同，开近代战争之先河。布莱登费尔德大破帝国军，威震欧陆。吕岑会战再胜，然亲冒矢石、阵亡于乱军之中，年仅三十七。',
    battleName:'布莱登费尔德之战',battleResult:'诸兵种协同、大破神圣罗马帝国军',
    titleOrigin:'军制革新影响深远，后世尊为「近代战争之父」「北方雄狮」。' },
  { id:'10D',rank:'10',suit:'♦',name:'霍去病',title:'冠军侯',era:'BC2C·汉',contribRank:19,contrib:'封狼居胥，闪击匈奴',rar:'blue',own:0,
    curseIntro:'冠军侯之魂，封于方块之十。掷命之时，漠北的狼烟又起——封狼居胥的少年，再度长驱。',
    bio:'霍去病，西汉名将，卫青之甥。十七岁率八百骁骑深入大漠、斩获冠绝全军，封冠军侯。两出河西、夺祁连，逼浑邪王降；漠北决战长驱二千里，封狼居胥山、禅于姑衍，匈奴远遁、漠南无王庭。用兵不拘古法、专以骑兵奔袭。二十四岁英年早逝。',
    battleName:'漠北之战',battleResult:'长驱二千里、封狼居胥、匈奴远遁',quote:'匈奴未灭，何以家为！',
    titleOrigin:'少年封侯、战功冠绝全军，汉武帝封「冠军侯」。' },
  { id:'10C',rank:'10',suit:'♣',name:'李世民',title:'天可汗',era:'7C·唐',contribRank:20,contrib:'虎牢关一战定中原',rar:'blue',own:0,
    curseIntro:'天可汗之魂，封于梅花之十。掷命之际，虎牢的尘烟未散——一战定天下的秦王，再跨战马。',
    bio:'李世民，唐高祖次子，秦王。隋末逐鹿，浅水原破薛仁杲、柏壁败宋金刚；虎牢关一役，以三千五百精骑大破窦建德十万众、同擒王世充，一战定中原。玄武门之变后继位为帝，开「贞观之治」，纳谏修文、威服四夷，被尊为「天可汗」。',
    battleName:'虎牢之战',battleResult:'三千五百骑破窦建德十万、一战定二雄',
    titleOrigin:'武定天下、文开盛世，四方君长共尊为「天可汗」。' },
  // 军衔 9（贡献度 #21–24 · ♠♥♦♣ · doc23 §三）
  { id:'9S',rank:'9',suit:'♠',name:'朱可夫',title:'胜利元帅',era:'20C·苏联',contribRank:21,contrib:'斯大林格勒、柏林',rar:'blue',own:0,
    curseIntro:'胜利元帅之魂，封于黑桃之九。掷命之时，钢铁洪流滚滚——救亡图存的元帅，再赴危城。',
    bio:'格奥尔吉·朱可夫，苏联元帅。诺门罕之战大败日军；卫国战争中临危受命、力守莫斯科，复指挥斯大林格勒、库尔斯克反攻，扭转东线战局；终率军强攻柏林、受降纳粹德国。战功卓著、威望极隆，战后却屡遭猜忌冷落。',
    battleName:'柏林战役',battleResult:'强攻柏林、迫纳粹德国投降',
    titleOrigin:'危难中屡挽战局、终克柏林，苏联尊为「胜利元帅」。' },
  { id:'9H',rank:'9',suit:'♥',name:'隆美尔',title:'沙漠之狐',era:'20C·德国',contribRank:22,contrib:'机动装甲战大师',rar:'blue',own:0,
    curseIntro:'沙漠之狐之魂，封于红心之九。掷命之际，北非的热浪翻涌——诡谲的狐狸，再驰瀚海。',
    bio:'埃尔温·隆美尔，德国陆军元帅。法国战役中率第7装甲师长驱直入；继领非洲军团，以寡敌众、机动奇袭，加查拉会战大破英军、夺托卜鲁克，纵横北非沙漠，敌手亦叹服其用兵，称「沙漠之狐」。后涉刺杀希特勒案，被迫服毒自尽。',
    battleName:'加查拉会战',battleResult:'机动奇袭、以少胜多破英军、夺托卜鲁克',
    titleOrigin:'北非沙漠机动战诡谲莫测，敌我共称「沙漠之狐」。' },
  { id:'9D',rank:'9',suit:'♦',name:'项羽',title:'西楚霸王',era:'BC3C·楚',contribRank:23,contrib:'巨鹿破釜沉舟，万人敌',rar:'blue',own:0,
    curseIntro:'西楚霸王之魂，封于方块之九。掷命之时，乌江的寒水呜咽——力拔山兮的霸王，再陷重围。',
    bio:'项羽，楚国名将之后，力能扛鼎。巨鹿之战破釜沉舟、九战九捷，全歼秦军主力，诸侯膝行而前；入关分封、自立西楚霸王。然刚愎自矜、失韩信范增，楚汉相争渐落下风。垓下被围、四面楚歌，霸王别姬、突围至乌江，自刎而亡，年三十一。',
    battleName:'巨鹿之战',battleResult:'破釜沉舟、九战九捷、全歼秦军主力',quote:'力拔山兮气盖世，时不利兮骓不逝。',
    titleOrigin:'勇冠三军、分封诸侯，自号「西楚霸王」。' },
  { id:'9C',rank:'9',suit:'♣',name:'贝利撒留',title:'最后的罗马人',era:'6C·拜占庭',contribRank:24,contrib:'以寡胜众，光复故土',rar:'blue',own:0,
    curseIntro:'最后的罗马人之魂，封于梅花之九。掷命之际，君士坦丁堡的钟声远传——忠而见弃的名将，再举罗马旗。',
    bio:'贝利撒留，东罗马（拜占庭）名将。查士丁尼皇帝麾下，平尼卡暴动、定东方边患；继而西征，以寡破众灭汪达尔王国、复北非，又攻意大利、克罗马与拉文纳，几复故土。屡以少胜多、忠勤王事，然功高遭疑、晚景凄凉。',
    battleName:'特里卡马隆之战',battleResult:'以寡破众、灭汪达尔王国',
    titleOrigin:'光复罗马故土、忠勇无双，后世称「最后的罗马人」。' },
  // 军衔 8（贡献度 #25–28 · ♠♥♦♣ · doc23 §三）
  { id:'8S',rank:'8',suit:'♠',name:'阿提拉',title:'上帝之鞭',era:'5C·匈人',contribRank:25,contrib:'震撼罗马帝国',rar:'green',own:0,
    curseIntro:'上帝之鞭之魂，封于黑桃之八。掷命之时，草原的马蹄震地——令罗马颤栗的鞭，再度挥落。',
    bio:'阿提拉，匈人帝国大单于。统一匈人诸部，建横跨中欧的庞大帝国。两度入侵东罗马、逼其纳贡；继而西征高卢，沙隆之战与罗马-西哥特联军血战；再入意大利、焚掠诸城，兵临罗马城下。所过残破，西欧人惊呼为「上帝之鞭」。新婚之夜暴毙，帝国旋即瓦解。',
    battleName:'沙隆会战',battleResult:'与罗马联军血战高卢、震动西欧',
    titleOrigin:'兵锋所至、生灵涂炭，西欧人惧称「上帝之鞭」。' },
  { id:'8H',rank:'8',suit:'♥',name:'穆罕默德二世',title:'征服者',era:'15C·奥斯曼',contribRank:26,contrib:'攻陷君士坦丁堡',rar:'green',own:0,
    curseIntro:'征服者之魂，封于红心之八。掷命之际，金角湾的巨炮轰鸣——千年帝都的终结者，再临城下。',
    bio:'穆罕默德二世，奥斯曼苏丹。二十一岁倾国之力围攻君士坦丁堡：铸乌尔班巨炮轰城、陆上拖船入金角湾，五十三日破千年都城，灭东罗马帝国，改名伊斯坦布尔、定为新都。其后东征西讨、拓土巴尔干与安纳托利亚，奠奥斯曼帝国之基。',
    battleName:'君士坦丁堡之围',battleResult:'巨炮破城、灭东罗马、千年帝都易主',
    titleOrigin:'攻陷君士坦丁堡、终结东罗马，获尊号「法提赫（征服者）」。' },
  { id:'8D',rank:'8',suit:'♦',name:'曼施坦因',title:'闪击战策划',era:'20C·德国',contribRank:27,contrib:'镰刀收割计划',rar:'green',own:0,
    curseIntro:'闪击战策划之魂，封于方块之八。掷命之时，阿登的密林无声——镰刀收割的谋者，再布奇局。',
    bio:'埃里希·冯·曼施坦因，德国陆军元帅。法国战役中提出「镰刀收割」计划：主力穿越阿登山区奇袭、绕过马奇诺防线，六周亡法。东线克里米亚、塞瓦斯托波尔攻坚；哈尔科夫反击战以少胜多、化险为夷，堪称机动防御之典范。后因战略分歧被希特勒解职。',
    battleName:'哈尔科夫反击战',battleResult:'机动反击、以少胜多、重创苏军',
    titleOrigin:'「镰刀收割」奇谋亡法、机动战术冠绝，被誉德军第一谋略家。' },
  { id:'8C',rank:'8',suit:'♣',name:'岳飞',title:'精忠武穆',era:'12C·南宋',contribRank:28,contrib:'撼山易，撼岳家军难',rar:'green',own:0,
    curseIntro:'精忠武穆之魂，封于梅花之八。掷命之际，朱仙镇的旌旗猎猎——壮志未酬的忠魂，再握银枪。',
    bio:'岳飞，南宋名将，相州汤阴人。组「岳家军」纪律严明，「冻死不拆屋，饿死不掳掠」。四次北伐，郾城、颖昌大破金军「铁浮屠」「拐子马」，直抵朱仙镇、望复中原。然宋高宗、秦桧议和，十二道金牌召还，以「莫须有」罪冤死风波亭，年三十九。',
    battleName:'郾城之战',battleResult:'大破金军铁浮屠、拐子马',quote:'文官不爱钱，武官不惜死，则天下太平。',
    titleOrigin:'精忠报国、武功彪炳，孝宗追谥「武穆」，后改谥「忠武」。' },
  // 军衔 7（贡献度 #29–32 · ♠♥♦♣ · doc23 §三）
  { id:'7S',rank:'7',suit:'♠',name:'威灵顿公爵',title:'铁公爵',era:'19C·英国',contribRank:29,contrib:'滑铁卢终结拿破仑',rar:'green',own:0,
    curseIntro:'铁公爵之魂，封于黑桃之七。掷命之时，滑铁卢的残阳如血——击碎战神的人，再列方阵。',
    bio:'阿瑟·韦尔斯利，第一代威灵顿公爵，英国统帅。印度建功，复于半岛战争中以坚守与机动屡败法军、逐其势力出西班牙。滑铁卢会战中以英荷联军死守阵地，待布吕歇尔普军赶到、内外夹击，终结拿破仑帝国。一生未尝大败，治军以稳健著称。',
    battleName:'滑铁卢会战',battleResult:'死守待援、与普军夹击、终结拿破仑',
    titleOrigin:'意志如铁、防守滴水不漏，世称「铁公爵」。' },
  { id:'7H',rank:'7',suit:'♥',name:'纳尔逊',title:'海上之王',era:'18–19C·英国',contribRank:30,contrib:'特拉法加海战',rar:'green',own:0,
    curseIntro:'海上之王之魂，封于红心之七。掷命之际，特拉法加的炮烟弥漫——独臂独眼的海魂，再升风帆。',
    bio:'霍雷肖·纳尔逊，英国海军中将。尼罗河口、哥本哈根连挫法丹舰队；特拉法加海战中以「纵队突破」战术大破法西联合舰队、俘获大半，奠定英国百年海上霸权。然亲立甲板督战、中弹身亡，临终闻捷而瞑目。一生失右臂右眼，仍勇冠三军。',
    battleName:'特拉法加海战',battleResult:'纵队突破、全歼法西联合舰队',quote:'英格兰期望每个人恪尽职守。',
    titleOrigin:'海战无双、奠定英国海权，举国尊为「海上之王」。' },
  { id:'7D',rank:'7',suit:'♦',name:'戚继光',title:'抗倭名将',era:'16C·明',contribRank:31,contrib:'鸳鸯阵，戚家军',rar:'green',own:0,
    curseIntro:'抗倭名将之魂，封于方块之七。掷命之时，台州的潮声拍岸——鸳鸯阵中的帅旗，再度扬起。',
    bio:'戚继光，明代抗倭名将。练「戚家军」，创「鸳鸯阵」长短兵协同，台州九战九捷、荡平浙闽倭患；又北镇蓟州、修边练兵、御蒙古。著《纪效新书》《练兵实纪》传世。晚年依附张居正，居正既倒，遭弹劾罢官，贫病而终。',
    battleName:'台州之战',battleResult:'鸳鸯阵九战九捷、荡平浙东倭寇',
    titleOrigin:'练兵荡倭、保境安民，世称「抗倭名将」、戚少保。' },
  { id:'7C',rank:'7',suit:'♣',name:'诸葛亮',title:'卧龙·智圣',era:'3C·蜀汉',contribRank:32,contrib:'隆中对，木牛流马',rar:'green',own:0,
    curseIntro:'卧龙·智圣之魂，封于梅花之七。掷命之际，五丈原的秋风萧瑟——鞠躬尽瘁的丞相，再展羽扇。',
    bio:'诸葛亮，蜀汉丞相。隆中对策、三分天下；佐刘备取荆益、联吴抗曹。刘备托孤后，治蜀严明、七擒孟获定南中，六出祁山以一州之力北伐强魏。木牛流马、八阵图皆出其手。终积劳成疾，星陨五丈原，年五十四，「出师未捷身先死」。',
    battleName:'南中之战',battleResult:'攻心为上、七擒孟获、定西南',quote:'鞠躬尽瘁，死而后已。',
    titleOrigin:'智谋如神、忠贞为国，后世尊为「智圣」，隐居时号「卧龙」。' },
  // 军衔 6（贡献度 #33–36 · ♠♥♦♣ · doc23 §三）
  { id:'6S',rank:'6',suit:'♠',name:'扬·杰士卡',title:'独眼不败',era:'15C·波希米亚',contribRank:33,contrib:'胡斯战争，车堡战术',rar:'green',own:0,
    curseIntro:'独眼不败之魂，封于黑桃之六。掷命之时，战车环堡列阵——盲眼的统帅，再听号角。',
    bio:'扬·杰士卡，波希米亚胡斯战争统帅。以农民起义军抗神圣罗马帝国之十字军，独创「车堡战术」：战车环列成垒、火炮弩手据守反击，屡破装甲骑士。维特科夫山、库特纳霍拉连战连捷。后双目失明仍指挥若定、未尝败绩，终病逝军中。',
    battleName:'库特纳霍拉之战',battleResult:'车堡战术、火器破十字军骑士',
    titleOrigin:'盲而善战、一生不败，胡斯军尊为独眼的「不败统帅」。' },
  { id:'6H',rank:'6',suit:'♥',name:'马尔伯勒公爵',title:'常胜公爵',era:'18C·英国',contribRank:34,contrib:'布伦海姆',rar:'green',own:0,
    curseIntro:'常胜公爵之魂，封于红心之六。掷命之际，布伦海姆的鼓乐齐鸣——算无遗策的公爵，再统联军。',
    bio:'约翰·丘吉尔，第一代马尔伯勒公爵，英国统帅。西班牙王位继承战争中统英荷联军，布伦海姆会战长途奔袭、大破法巴联军，解维也纳之围；拉米伊、奥德纳尔德、马尔普拉凯连战连捷，遏制法王路易十四之扩张。攻守兼备、未尝大败，然终因政争失势去职。',
    battleName:'布伦海姆会战',battleResult:'长途奔袭、大破法巴联军、解维也纳之围',
    titleOrigin:'统率联军、连战连捷、遏制法国霸权，世称常胜的「马尔伯勒公爵」。' },
  { id:'6D',rank:'6',suit:'♦',name:'织田信长',title:'第六天魔王',era:'16C·日本',contribRank:35,contrib:'桶狭间，铁炮革新',rar:'green',own:0,
    curseIntro:'第六天魔王之魂，封于方块之六。掷命之时，本能寺的火光冲天——天下布武的魔王，再举铁炮。',
    bio:'织田信长，日本战国大名。桶狭间之战奇袭、以寡击众斩今川义元，崛起尾张；长篠之战以三千铁炮三段击大破武田骑兵，开火器战之先。「天下布武」、放逐将军，几定天下。然天正十年本能寺为家臣明智光秀所叛，纵火自尽，功业未竟。',
    battleName:'长篠之战',battleResult:'铁炮三段击、大破武田骑兵',
    titleOrigin:'焚比叡山、自比与佛为敌，革新不羁，世称「第六天魔王」。' },
  { id:'6C',rank:'6',suit:'♣',name:'卫青',title:'长平侯',era:'BC2C·汉',contribRank:36,contrib:'反击匈奴，收复河套',rar:'green',own:0,
    curseIntro:'长平侯之魂，封于梅花之六。掷命之际，漠南的旌旗连云——出身骑奴的大将军，再度出塞。',
    bio:'卫青，西汉名将，本平阳骑奴。七击匈奴、未尝败绩：龙城之战首奏奇功，收复河南地（河套）、筑朔方；漠北决战与单于主力鏖战、大破之。官至大司马大将军，谦和退让、不养士自重。以外戚之身而功勋彪炳，得以善终。',
    battleName:'漠北之战',battleResult:'与单于主力决战、大破匈奴王庭',
    titleOrigin:'收复河套、七战七捷，封长平侯。' },
  // 军衔 5（贡献度 #37–40 · ♠♥♦♣ · doc23 §三）
  { id:'5S',rank:'5',suit:'♠',name:'查理曼',title:'欧洲之父',era:'8–9C·法兰克',contribRank:37,contrib:'统一西欧',rar:'green',own:0,
    curseIntro:'欧洲之父之魂，封于黑桃之五。掷命之时，亚琛的钟声悠扬——加冕的大帝，再握王权。',
    bio:'查理曼（查理大帝），法兰克国王。征撒克逊、并伦巴第、击阿瓦尔，统一西欧大部，建加洛林帝国。公元 800 年圣诞，于罗马受教皇加冕为「罗马人的皇帝」，复兴西方帝统。兴学术、奖文教，史称「加洛林文艺复兴」。后世法德两国皆奉其为开国之祖。',
    battleName:'征服伦巴第',battleResult:'并意大利北部、护教廷、奠帝国',
    titleOrigin:'统一西欧、复兴帝统、法德共祖，后世尊为「欧洲之父」。' },
  { id:'5H',rank:'5',suit:'♥',name:'图拉真',title:'最佳元首',era:'2C·罗马',contribRank:38,contrib:'罗马极盛之疆',rar:'green',own:0,
    curseIntro:'最佳元首之魂，封于红心之五。掷命之际，达契亚的金光耀眼——开疆至极的明君，再披战袍。',
    bio:'图拉真，罗马五贤帝之一，首位行省出身的皇帝。两次达契亚战争征服今罗马尼亚之地、掠其金矿充国库；东征帕提亚，下亚美尼亚、美索不达米亚，罗马疆域达于极盛、东抵波斯湾。内修政惠民、广建工程。元老院誉为「最佳元首」。',
    battleName:'达契亚战争',battleResult:'征服达契亚、罗马疆域臻于极盛',
    titleOrigin:'开疆极盛、仁政惠民，元老院尊为「最佳元首（Optimus Princeps）」。' },
  { id:'5D',rank:'5',suit:'♦',name:'苏莱曼大帝',title:'立法者',era:'16C·奥斯曼',contribRank:39,contrib:'奥斯曼极盛',rar:'green',own:0,
    curseIntro:'立法者之魂，封于方块之五。掷命之时，金角湾的旌旗如海——奥斯曼的盛世之主，再执权杖。',
    bio:'苏莱曼一世，奥斯曼帝国苏丹。在位四十六年，国势臻于鼎盛：陷贝尔格莱德、夺罗德岛、莫哈奇之战灭匈牙利、兵围维也纳，地中海称霸。内修法典、整饬政制，故西方称「立法者」、突厥人尊为「卡努尼（立法者）」。文治武功，奥斯曼黄金时代之象征。',
    battleName:'莫哈奇战役',battleResult:'大破匈牙利军、灭其王国',
    titleOrigin:'完善帝国法典、文治昭著，故称「立法者」「大帝」。' },
  { id:'5C',rank:'5',suit:'♣',name:'曹操',title:'魏武',era:'3C·汉/魏',contribRank:40,contrib:'官渡破袁，统一北方',rar:'green',own:0,
    curseIntro:'魏武之魂，封于梅花之五。掷命之际，官渡的火光映天——挟天子的枭雄，再点兵戈。',
    bio:'曹操，东汉末权臣、魏武帝。挟天子以令诸侯，官渡之战以少胜多、火烧乌巢大破袁绍，统一北方。虽赤壁折戟、三分天下，仍据中原之重。又屯田兴农、唯才是举，文采亦冠绝一时。终身不称帝，奠曹魏之基。',
    battleName:'官渡之战',battleResult:'火烧乌巢、以少胜多、破袁绍',quote:'老骥伏枥，志在千里；烈士暮年，壮心不已。',
    titleOrigin:'统一北方、奠魏国基业，子丕称帝后追尊为「魏武帝」。' },
  // 军衔 4（贡献度 #41–44 · ♠♥♦♣ · doc23 §三）
  { id:'4S',rank:'4',suit:'♠',name:'埃帕米农达斯',title:'斜阵之父',era:'BC4C·底比斯',contribRank:41,contrib:'留克特拉破斯巴达',rar:'white',own:0,
    curseIntro:'斜阵之父之魂，封于黑桃之四。掷命之时，留克特拉的长矛如墙——破不败神话的人，再列方阵。',
    bio:'埃帕米农达斯，底比斯统帅。留克特拉会战首创「斜行阵」：集左翼精锐为重锤、纵深五十列，一举击溃不可一世的斯巴达军、阵斩其王，终结斯巴达霸权。后解放美塞尼亚、重塑希腊格局。曼丁尼亚之战再胜，然身先士卒、中矛而亡。',
    battleName:'留克特拉会战',battleResult:'斜阵集中突破、击破斯巴达、阵斩其王',
    titleOrigin:'首创斜行阵、以战术革命破斯巴达神话，后世称「斜阵之父」。' },
  { id:'4H',rank:'4',suit:'♥',name:'皮洛士',title:'险胜之王',era:'BC3C·伊庇鲁斯',contribRank:42,contrib:'「皮洛士式胜利」',rar:'white',own:0,
    curseIntro:'险胜之王之魂，封于红心之四。掷命之际，战象的悲鸣远扬——惨胜的王者，再战疆场。',
    bio:'皮洛士，伊庇鲁斯国王，亚历山大之远亲。应塔兰托之邀战罗马，赫拉克利亚、阿斯库路姆两胜，然伤亡惨重，叹「再胜一场，吾军尽矣」——「皮洛士式胜利」由此得名。转战西西里抗迦太基，终无功而返。后死于阿尔戈斯巷战，一妇人自屋顶掷瓦中其首。',
    battleName:'阿斯库路姆之战',battleResult:'惨胜罗马、损兵折将（皮洛士式胜利）',quote:'再来一场这样的胜利，我们就全完了。',
    titleOrigin:'屡胜而损耗自毁，「皮洛士式胜利」成惨胜之代名词。' },
  { id:'4D',rank:'4',suit:'♦',name:'武田信玄',title:'甲斐之虎',era:'16C·日本',contribRank:43,contrib:'风林火山',rar:'white',own:0,
    curseIntro:'甲斐之虎之魂，封于方块之四。掷命之时，风林火山的军旗招展——上洛未竟的猛虎，再驱铁骑。',
    bio:'武田信玄，日本战国大名，甲斐之虎。军旗书「疾如风、徐如林、侵掠如火、不动如山」。五次川中岛与上杉谦信争锋；三方原之战大破德川家康、织田援军。骑兵雄冠天下、内政亦修。挥师上洛途中病逝，遗命秘不发丧三年，霸业戛然而止。',
    battleName:'三方原之战',battleResult:'大破德川家康、织田联军',
    titleOrigin:'勇猛善战、雄踞甲斐，世称「甲斐之虎」。' },
  { id:'4C',rank:'4',suit:'♣',name:'吴起',title:'兵家亚圣',era:'BC4C·魏/楚',contribRank:44,contrib:'《吴子》，魏武卒',rar:'white',own:0,
    curseIntro:'兵家亚圣之魂，封于梅花之四。掷命之际，西河的旌旗不倒——改革者的孤影，再立阵前。',
    bio:'吴起，战国军事家、改革家。事鲁破齐，入魏创「魏武卒」精锐、守西河，与诸侯大战七十六、全胜六十四；著《吴子》兵法。后奔楚为相、变法图强，南平百越、北却三晋。楚悼王一死，旧贵族作乱，吴起伏王尸而中乱箭，与变法同殁。',
    battleName:'阴晋之战',battleResult:'五万魏武卒大破秦军五十万',
    titleOrigin:'治军变法、著兵法传世，与孙武并称「孙吴」，尊为兵家亚圣。' },
  // 军衔 3（贡献度 #45–48 · ♠♥♦♣ · doc23 §三）
  { id:'3S',rank:'3',suit:'♠',name:'列奥尼达',title:'温泉关之王',era:'BC5C·斯巴达',contribRank:45,contrib:'三百勇士死战',rar:'white',own:0,
    curseIntro:'温泉关之王之魂，封于黑桃之三。掷命之时，温泉关的风萧萧——死战不退的王，再举长矛。',
    bio:'列奥尼达一世，斯巴达国王。波斯大军压境，率三百斯巴达勇士及少量联军扼守温泉关隘口，以寡敌众、血战数日，重创波斯大军。终遭叛徒引敌抄后路，乃遣联军退去，独率三百死士血战至最后一人，全数殉国，以死拖延、激励希腊。',
    battleName:'温泉关之战',battleResult:'三百死士扼隘、血战殉国、拖滞波斯大军',quote:'波斯人，来取吧！',
    titleOrigin:'死守温泉关、慷慨成仁，后世传颂为悲壮的「温泉关之王」。' },
  { id:'3H',rank:'3',suit:'♥',name:'罗伯特·李',title:'南军统帅',era:'19C·美国',contribRank:46,contrib:'钱斯勒斯维尔以少胜多',rar:'white',own:0,
    curseIntro:'南军统帅之魂，封于红心之三。掷命之际，弗吉尼亚的硝烟未散——以寡抗众的将军，再控缰绳。',
    bio:'罗伯特·爱德华·李，美国南北战争南军统帅。以北弗吉尼亚军屡以少胜多：第二次牛奔河、弗雷德里克斯堡连挫北军；钱斯勒斯维尔以分兵奇袭、以寡破众，为其用兵巅峰。然葛底斯堡受挫、终因南方物力不济，于阿波马托克斯投降。战后倡和解，受南北共敬。',
    battleName:'钱斯勒斯维尔战役',battleResult:'分兵奇袭、以少胜多、重创北军',
    titleOrigin:'以寡抗众、人格高洁，南方尊为统帅、敌我同敬。' },
  { id:'3D',rank:'3',suit:'♦',name:'孙膑',title:'智囊',era:'BC4C·齐',contribRank:47,contrib:'围魏救赵、马陵之战',rar:'white',own:0,
    curseIntro:'智囊之魂，封于方块之三。掷命之时，马陵道的伏弩齐发——刖足的兵家，再运奇谋。',
    bio:'孙膑，齐国军事家，孙武之后。同窗庞涓忌其才，诳至魏国施膑刑（去膝盖骨），孙膑佯狂得脱、奔齐为军师。桂陵之战「围魏救赵」；马陵之战减灶诱敌、伏弩道旁，大破魏军、逼庞涓自刎，「庞涓死于此树之下」。著《孙膑兵法》传世。',
    battleName:'马陵之战',battleResult:'减灶诱敌、设伏破魏、逼死庞涓',
    titleOrigin:'身残志坚、谋略冠世，齐军倚为「智囊」、兵家奇才。' },
  { id:'3C',rank:'3',suit:'♣',name:'巴布尔',title:'莫卧儿奠基者',era:'16C·莫卧儿',contribRank:48,contrib:'帕尼帕特',rar:'white',own:0,
    curseIntro:'莫卧儿奠基者之魂，封于梅花之三。掷命之际，帕尼帕特的火炮轰鸣——百折不挠的王，再下印度。',
    bio:'巴布尔，帖木儿与成吉思汗之后裔。早年失费尔干纳故土、辗转流亡，终据喀布尔。帕尼帕特之战以火炮战车之新法、以寡击众大破德里苏丹十万象军，开创莫卧儿帝国。又败拉杰普特联军，奠基北印度。文武兼备，留《巴布尔回忆录》。',
    battleName:'第一次帕尼帕特战役',battleResult:'火器战车、以寡破德里苏丹十万象军',
    titleOrigin:'百折不挠、开创王朝，为莫卧儿帝国奠基之君。' },
  // 军衔 2（贡献度 #49–52 · ♠♥♦♣ · doc23 §三）
  { id:'2S',rank:'2',suit:'♠',name:'斯巴达克斯',title:'角斗士之王',era:'BC1C·罗马',contribRank:49,contrib:'起义撼罗马',rar:'white',own:0,
    curseIntro:'角斗士之王之魂，封于黑桃之二。掷命之时，维苏威的怒火燃起——为自由而战的奴隶，再握利刃。',
    bio:'斯巴达克斯，色雷斯人，沦为罗马角斗士。于卡普亚率众暴动、据维苏威火山，奴隶蜂起从之、众至数万。屡败罗马军团、纵横意大利两载，震动罗马。终为克拉苏大军合围，决死血战、力竭阵亡，尸骨无存，然其名永为反抗压迫之象征。',
    battleName:'维苏威起义',battleResult:'奇袭破围、奴隶军大败罗马军团',
    titleOrigin:'率奴隶反抗罗马、虽败犹荣，后世称「角斗士之王」、自由的象征。' },
  { id:'2H',rank:'2',suit:'♥',name:'维钦托利',title:'高卢之王',era:'BC1C·高卢',contribRank:50,contrib:'阿莱西亚抗凯撒',rar:'white',own:0,
    curseIntro:'高卢之王之魂，封于红心之二。掷命之际，阿莱西亚的围墙合拢——抗罗马的孤王，再聚部族。',
    bio:'维钦托利，高卢阿维尔尼部首领。联合高卢诸部抗凯撒，行坚壁清野之策；热尔戈维亚之战曾挫凯撒。然终被围于阿莱西亚要塞，凯撒内外双重壁垒、围点打援，援军溃散、城中粮绝。维钦托利为存部众，单骑出降、解甲伏地。后被囚罗马六年，于凯撒凯旋式后处决。',
    battleName:'阿莱西亚之战',battleResult:'据城死守、援军溃散、力屈而降',
    titleOrigin:'联合高卢、力抗凯撒，被尊为高卢人最后的王。' },
  { id:'2D',rank:'2',suit:'♦',name:'沙卡·祖鲁',title:'非洲战王',era:'19C·祖鲁',contribRank:51,contrib:'牛角阵，建祖鲁王国',rar:'white',own:0,
    curseIntro:'非洲战王之魂，封于方块之二。掷命之时，「牛角阵」铺天盖地——铁血的祖鲁王，再举短矛。',
    bio:'沙卡·祖鲁，南非祖鲁王国缔造者。改革武备：以短柄刺矛「伊克瓦」近战、创「牛角阵」包抄合围，又严训战士、赤足疾行。以小部族崛起、征服周边诸族，建强盛之祖鲁王国，威震南部非洲。然晚年因母丧而行严酷暴政，终为异母弟所弑。',
    battleName:'姆赫拉图泽河之战',battleResult:'牛角阵包抄、大破恩德万德韦部',
    titleOrigin:'改革战法、缔造王国、威震南非，被尊为「祖鲁战王」。' },
  { id:'2C',rank:'2',suit:'♣',name:'狮心王理查',title:'狮心',era:'12C·英格兰',contribRank:52,contrib:'第三次十字军',rar:'white',own:0,
    curseIntro:'狮心之魂，封于梅花之二。掷命之际，阿卡的城头号角长鸣——勇冠十字军的王，再挥长剑。',
    bio:'理查一世，英格兰国王，「狮心王」。第三次十字军东征之统帅，渡海攻陷阿卡、阿苏夫之战大破萨拉丁，进逼耶路撒冷而未克，终与萨拉丁议和、保朝圣之权。归途为政敌所囚、以重金赎还。一生戎马、罕在英格兰，终中弩伤殁于围城。',
    battleName:'阿苏夫之战',battleResult:'严整反击、大破萨拉丁军',
    titleOrigin:'勇猛善战、临阵无畏，敌我皆称「狮心王」。' },
];
