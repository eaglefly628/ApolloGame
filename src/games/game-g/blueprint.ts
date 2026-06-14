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
//    3D 渲染 = ThreeRenderer 读 Card3D+Transform 画 3D 翻转（Transform.rotation = 绕 X 轴翻面角）。
//
//  零游戏专属系统、零新 capability：复用现成 tween + Transform + random(PRNG)；3D 只在渲染后端 + render-only Card3D。
//  红线：翻牌是表现，不决定胜负 → 跨端浮点不影响 gameplay → 实时多人/多人干预可行（权威=整数胜负）。
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

// 一张牌的 3D 翻牌实体：Transform(位姿) + Card3D(正反面，render-only) + Tween(翻到既定面)。
function flipCardEntity(faceUp: boolean, x: number, y: number, spins: number, frontTint: number, backTint: number): EntityBlueprint {
  return {
    Transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 },
    Card3D: { frontTint, backTint, width: CARD_W, height: CARD_H },
    Tween: { target: 'Transform.rotation', from: 0, to: flipTarget(faceUp, spins), elapsed: 0, duration: FLIP_DURATION, easing: 'easeOut', done: false },
  };
}

/**
 * 单张 3D 翻牌（既定胜负作入参）：胜负先定（faceUp）、tween 翻到该面。
 * 用于浏览器骨架 demo（按钮直接给定结果）与最小验证。
 */
export function buildGameG3DFlip(faceUp: boolean, spins: number = FLIP_SPINS): WorldBlueprint {
  return {
    capabilities: [transformCapability, tweenCapability],
    entities: { card: flipCardEntity(faceUp, 0, 0, spins, 0xeab308, 0x334155) },
  };
}

// 一张参战牌（最弱 LLM 能填）：id + 属性 favor（升级偏置，越高越易活）+ 可选位置/外观。
export interface FateCard {
  id: string;
  favor: number; // 0..100：属性/局外升级偏置 → P(正面=活)
  x?: number;
  y?: number;
  spins?: number;
  frontTint?: number;
  backTint?: number;
}

/**
 * 一局掷命（v2 主线）：对每张牌按其 favor 跑**属性加权种子硬币**先定胜负，再 3D 翻到既定面。
 * seed 决定整局结果（同 seed+同牌 → 同结果，确定性/可重放/多人一致）。胜负=数据决策，翻牌=表现。
 */
export function buildGameGDuel3D(cards: FateCard[], seed: number = 1): WorldBlueprint {
  const rng: RandomSeed = { type: 'RandomSeed', seed, sequence: 0 };
  const entities: Record<string, EntityBlueprint> = {};
  const n = cards.length;
  cards.forEach((c, i) => {
    const faceUp = decideFaceUp(c.favor, rng); // 胜负先定（属性加权种子）
    const x = c.x ?? (i - (n - 1) / 2) * (CARD_W + 40); // 缺省横向排开
    entities[c.id] = flipCardEntity(faceUp, x, c.y ?? 0, c.spins ?? FLIP_SPINS, c.frontTint ?? 0xeab308, c.backTint ?? 0x334155);
  });
  return { capabilities: [transformCapability, tweenCapability], entities };
}

// ═══════════════════════════════════════════════════════════════
//  MVP-1：收口"一局"（outcome-first）。两队牌各自掷命（规则先定正/反）→ 3D 翻牌表现 →
//  数存活（group-count 按队 Tag）→ 翻牌动画结束那拍比存活数定胜负 → 结算掉材。
//  全是 gameF 重组、零新 capability：胜负=数据(decideFaceUp)，存活=Tag 含 ALIVE 位，
//  判胜负=group-count→event-when(vsResource 比两队存活,edge)→effect(set-state 胜者 + 给材料)。
//  门=Timer(翻牌时长)：动画演完再结算（戏剧性）；胜负其实从装配即定（确定性/可重放/多人一致）。
// ═══════════════════════════════════════════════════════════════
export const TEAM_A = 1 << 1; // 我方
export const TEAM_B = 1 << 2; // 敌方
export const ALIVE = 1 << 3; // 落定正面=活（Tag 含此位才计入存活）
const MATCH_REWARD = 10; // 我方(A)胜 → 材料 +N

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
 * 一局 NvN 掷命（MVP-1）：teamA(我) vs teamB(敌)，每张牌按 favor 跑确定性种子硬币先定生死，
 * 再 3D 翻到既定面。group-count 数两队存活 → Timer 到点(翻牌演完)→ 比存活数 → 写 winner 状态 + 我方胜给材料。
 * 入参 seed 决定整局（同 seed+同牌 → 同结果）。装配顺序 teamA→teamB 固定 → PRNG 序列确定。
 */
export function buildGameGMatch(teamA: FateCard[], teamB: FateCard[], seed: number = 1, reward: number = MATCH_REWARD): WorldBlueprint {
  const rng: RandomSeed = { type: 'RandomSeed', seed, sequence: 0 };
  const entities: Record<string, EntityBlueprint> = {};
  const lay = (cards: FateCard[], team: number, rowY: number): void => {
    const n = cards.length;
    cards.forEach((c, i) => {
      const faceUp = decideFaceUp(c.favor, rng); // 胜负先定
      const x = c.x ?? (i - (n - 1) / 2) * (CARD_W + 40);
      const ent = flipCardEntity(faceUp, x, c.y ?? rowY, c.spins ?? FLIP_SPINS, c.frontTint ?? 0xeab308, c.backTint ?? 0x334155);
      ent.Tag = { flags: team | (faceUp ? ALIVE : 0) }; // 正面=活 → 计入该队存活
      entities[c.id] = ent;
    });
  };
  lay(teamA, TEAM_A, 220); // 我方下排
  lay(teamB, TEAM_B, -220); // 敌方上排

  // 数存活（含齐 队位|ALIVE）→ 两个数值事实
  entities.gc_a = { GroupCount: { countResource: 'a_alive', requiredTag: TEAM_A | ALIVE } };
  entities.gc_b = { GroupCount: { countResource: 'b_alive', requiredTag: TEAM_B | ALIVE } };
  entities.res_a = { Resource: { id: 'a_alive', current: 0, min: 0, max: 999 } };
  entities.res_b = { Resource: { id: 'b_alive', current: 0, min: 0, max: 999 } };
  entities.res_mats = { Resource: { id: 'mats', current: 0, min: 0, max: 99999 } };
  entities.winner = { State: { fsmId: 'winner', current: 'pending' } };
  entities.clock = { Timer: { id: 'match_clock', elapsed: 0, duration: FLIP_DURATION, loop: false } };

  // 结算门：Timer 到点(翻牌演完)那拍，按存活数 vsResource 比 → 三选一定胜负（edge，互斥各一发）。
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
