import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import { transformCapability, nextRandom, tagCapability, resourceCapability, stateCapability, timerCapability } from '@atom-skills/index.js';
import { tweenCapability } from '@skills/tier1/index.js';
import { groupCountCapability, eventWhenCapability, effectApplyCapability } from '@skills/tier2/index.js';
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
    army.push({ id: `${prefix}_l${lane}_${idx}`, rank: o.r, lane, favor: clampFavor(rankFavor(o.r) + favorBias), general: idx === 0 });
  });
  return army;
}

// 将领牵动：逐路自上而下掷命——先掷主将，按主将生死给本路下属 ±favor，再掷下属。返回 id→faceUp。
// PRNG 顺序固定（lane 0→1→2，路内主将先、其余按生成序）→ 可回放、确定性。
function resolveArmy(army: ArmyCard[], rng: RandomSeed): Map<string, boolean> {
  const face = new Map<string, boolean>();
  for (const lane of [0, 1, 2]) {
    const laneCards = army.filter((c) => c.lane === lane);
    const gen = laneCards.find((c) => c.general)!;
    const fg = decideFaceUp(gen.favor, rng); // 先掷主将
    face.set(gen.id, fg);
    const shift = fg ? MORALE : -ROUT; // 主将活=士气，亡=溃散
    for (const c of laneCards) {
      if (c.general) continue;
      face.set(c.id, decideFaceUp(clampFavor(c.favor + shift), rng));
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

/**
 * G2 一局军阵对决：armyA(我) vs armyB(敌)，自上而下逐级掷命(将领牵动) → 三路数存活 → best-of-3 定总胜负。
 * 装配顺序 A 全军 → B 全军（PRNG 序列确定、可回放）。胜负 build 时即定；3D 抛飞相撞为表现。
 */
export function buildGameGArmyMatch(armyA: ArmyCard[], armyB: ArmyCard[], seed = 1, reward = MATCH_REWARD): WorldBlueprint {
  const rng: RandomSeed = { type: 'RandomSeed', seed, sequence: 0 };
  const faceA = resolveArmy(armyA, rng);
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
          pairKey: lane * 18 + i, // 同 pairKey 的 A/B 互为对手 → 渲染器让两牌相撞
          rank: c.rank === 'JOKER' ? '★' : c.rank,
          suit: SUITS[(lane * 18 + i) % 4],
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
