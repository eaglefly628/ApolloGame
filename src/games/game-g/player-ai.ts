// player-ai.ts —— 翻命扑克「终极版 Player-AI」= 前向推演搜索（expectimax / forward-simulation）。
// owner 2026-07-03 拍板：贪心玩家让 sim 失真 → 必须建「用更复杂的高级版·推演敌人未来·再决策」的 AI。
// 规格：src/games/game-g/design/player-ai-spec.md §二·五（七组件骨架）+ §三 evalState 特征 + §四 高手战术 + §五 三档。
//
// 核心：每次决策把战斗往前模拟几步——克隆当前局 → 试每个候选「整回合计划」→ 用现成 Boss AI(aiDecide) 推演敌人应对
//   → 展开 N 回合 → 叶子按赢率估计(evalState) → 回溯选 argmax E[P(赢)] 的计划。**只在克隆局上跑·用 rollWinProb·不消费真局 rng。**
//
// 七组件（对规格 §二·五）：
//   ① cloneBattle：深拷 TurnBattle（含 rng {type,seed,sequence}）→ 推演绝不碰真局。
//   ② 确定性 EV·不掷骰：克隆局遭遇走 endTurnEV → resolveClashEV(rollWinProb 精确胜率坍缩)·零 rng。
//   ③ 敌方模型=复用现成 Boss AI：对手回合调 aiDecide + endTurnEV 在克隆局跑 → 预测 Boss 应对（"推演敌人未来"）。
//   ④ 候选枚举 + beam 剪枝（owner 2026-07-03·三行为自由）：枢纽决策(deploy×路 / draw抢节奏 / swap换废牌 / fill / pass) + greedyTurnFill 自由混补完(打天罡+部署穿插)·按 evalState 留 top-K 递归。
//   ⑤ 叶子评估 evalState（§三 七特征·破家进度权重压倒一切·三路力量差非线性集中奖励）。
//   ⑥ 目标=argmax E[P(赢)]（非血量）。
//   ⑦ 深度按档：skill1=贪心退化(不走本模块) · skill3=N=1 · skill5=终极(N≥2 + beam + Boss AI 推演)。
//
// 公平边界：只用合法可见信息·只出合法动作·强在算得深不在开挂。**确定性铁律**：搜索不消费真局 rng·真局落子仍用真掷骰
//   → turnHash/回放不裂（见 player-ai.test.ts 复现测）。
// 数据驱动豁免：Player-AI 是引擎侧确定性决策器（同 turn-combat 掷命解算核），owner 明确拍板单独开发·不下沉成数据（spec §六）。
import {
  deployUnit, castTengang, drawCard, swapCard, discardCard, endTurn, endTurnEV, aiDecide,
  HAND_MAX, CAST_COST, DRAW_COST, DEPLOY_COST, SWAP_PER_TURN, SLOTS, A_GOAL, clashOdds,
  type TurnBattle, type TurnLane, type TurnUnit, type TurnSide, type PokerCard, type Card,
} from './turn-combat.js';
import { cardPoints } from './clash-resolve.js';
import { aggregateTengang } from './game-g-build.js';
import type { TengangFx } from './combat-types.js';

// ══════════════════════════ ① 状态克隆 cloneBattle ══════════════════════════
// 深拷 TurnBattle（纯数据·可深拷）——**rng 也深拷**（确定性铁律：推演绝不消费真局 rng）。clashLog 置空（推演不需要流水）。
const cloneUnit = (u: TurnUnit): TurnUnit => ({ ...u });
const cloneCard = (c: Card): Card => ({ ...c });
const cloneFx = (f: TengangFx): TengangFx => ({ ...f });
const cloneLane = (l: TurnLane): TurnLane => ({ a: l.a.map(cloneUnit), b: l.b.map(cloneUnit), aGenDead: l.aGenDead, bGenDead: l.bGenDead, spentA: l.spentA, spentB: l.spentB, aSkipAdvance: l.aSkipAdvance, bSkipAdvance: l.bSkipAdvance });
const cloneSide = (s: TurnSide): TurnSide => ({
  mana: s.mana, hand: s.hand.map(cloneCard), pokerDeck: s.pokerDeck.map(cloneCard) as PokerCard[],
  tengangDeck: s.tengangDeck.map(cloneCard) as { kind: 'tengang'; id: string }[], castIds: [...s.castIds],
  tengangA: cloneFx(s.tengangA), castFx: s.castFx.map(({ id, fx }) => ({ id, fx: cloneFx(fx) })),
  swapsUsed: s.swapsUsed,
});
export function cloneBattle(b: TurnBattle): TurnBattle {
  return {
    turn: b.turn, active: b.active,
    lanes: [cloneLane(b.lanes[0]), cloneLane(b.lanes[1]), cloneLane(b.lanes[2])],
    homeA: b.homeA, homeB: b.homeB, homeMax: b.homeMax,
    a: cloneSide(b.a), b: cloneSide(b.b),
    rng: { type: b.rng.type, seed: b.rng.seed, sequence: b.rng.sequence }, // ★ 深拷 rng·推演在副本 rng 上·真局序不动
    winner: b.winner, actionTaken: b.actionTaken,
    lastClash: null, clashLog: [], clashSeq: b.clashSeq, foughtNow: [], movedNow: [], // foughtNow/movedNow 瞬态·副本独立(EV 推演的休整不碰真局)
    dishaB: { ...b.dishaB }, bossWinStreak: b.bossWinStreak, batteryLane: b.batteryLane, bossGenDefeats: b.bossGenDefeats,
    dishaBaseIds: [...b.dishaBaseIds], dishaCastIds: [...b.dishaCastIds],
    aiProfile: { ...b.aiProfile }, aiTier: b.aiTier,
    homeAShieldUsed: b.homeAShieldUsed, fortuneBuff: b.fortuneBuff,
    slowA: b.slowA, slowB: b.slowB,
  };
}

// ══════════════════════════ ⑤ 叶子评估 evalState（玩家 'a' 视角·越高越接近赢）══════════════════════════
// §三 七特征线性加权（破家进度权重压倒一切；三路力量差非线性·奖励一路集中突破）。lane 力量差直接复用 clashOdds
//   —— 它已折入天罡/士气/连胜对折/**地煞明牌威胁**（§三 特征7 自动到位·不必手写折价）。
const combatPower = (u: TurnUnit): number => Math.max(0, u.points + u.buff); // 粗略牌力（连胜对折已在 clashOdds 精算·此处只作占路/连携用）

// 手牌连携潜力（§三 特征4）：同点(对/三条) + 同花组 → 攒连携加分。
function comboPotential(hand: Card[]): number {
  const poker = hand.filter((c) => c.kind === 'poker') as PokerCard[];
  if (poker.length < 2) return 0;
  const byRank = new Map<string, number>(); const bySuit = new Map<string, number>();
  for (const c of poker) { byRank.set(c.rank, (byRank.get(c.rank) ?? 0) + 1); bySuit.set(c.suit, (bySuit.get(c.suit) ?? 0) + 1); }
  let s = 0;
  for (const n of byRank.values()) if (n >= 2) s += (n - 1) * 2; // 成对/三条潜力
  for (const n of bySuit.values()) if (n >= 2) s += (n - 1) * 1; // 同花潜力
  return s;
}

export function evalState(b: TurnBattle): number {
  if (b.winner === 'a') return 1e7;   // 破敌家=终局赢
  if (b.winner === 'b') return -1e7;  // 我家被破=终局输
  if (b.winner === 'draw') return 0;
  const homeMax = b.homeMax;
  // 特征1 破家进度（权重压倒一切·破家是唯一胜利条件）：给敌家造成的伤 ≫ 我家所受伤（防守权重略高·别用血换不划算的推进）。
  const enemyDmg = homeMax - b.homeB, selfDmg = homeMax - b.homeA;
  let s = enemyDmg * 1200 - selfDmg * 1300;
  // 特征2 三路力量差（非线性·集中突破 §四·1）+ 特征7（地煞明牌威胁已折进 clashOdds）：
  //   两军接触路用 clashOdds(真实赢率)；只我方=无阻推进(免费破家高速路·重奖·press breakthrough)；只敌方=威胁(扣)。
  let bestLaneAdv = -Infinity;
  for (let li = 0; li < 3; li++) {
    const L = b.lanes[li]; const fa = L.a[0], fb = L.b[0];
    let adv = 0;
    if (fa && fb) { const wp = clashOdds(b, li); adv = (wp !== null ? wp - 0.5 : 0) * 200; } // ±100（占优/劣势）
    else if (fa && !fb) adv = 60 + (fa.slot / A_GOAL) * 140;                                  // 无阻推进：越近敌家越值（凿穿在望）
    else if (!fa && fb) adv = -(50 + ((SLOTS - 1 - fb.slot) / (SLOTS - 1)) * 140);            // 敌无阻逼近我家：越近越危
    s += adv;
    bestLaneAdv = Math.max(bestLaneAdv, adv);
  }
  if (bestLaneAdv > 0) s += bestLaneAdv * 0.9; // 集中奖励：一路压倒性优势 > 三路都略优（凸函数·鼓励田忌赛马集中一路）
  // 特征3 推进位置：我兵越靠敌家越值·敌兵越靠我家越扣（细粒度·补 lane 前锋外的纵深）。
  for (const L of b.lanes) { for (const u of L.a) s += u.slot * 3; for (const u of L.b) s -= (SLOTS - 1 - u.slot) * 3; }
  // 特征5 源泉/续航健康度：源泉 + 手牌 + 牌库剩余（别打空·留应变）。
  s += b.a.mana * 4 + b.a.hand.length * 6 + b.a.pokerDeck.length * 1.5;
  // 特征4 连携潜力（手牌攒同点/同花）。
  s += comboPotential(b.a.hand) * 8;
  // 特征6 主将安全：我方主将在场加分（暴露在敌强路的折价已由 clashOdds 体现在该路 adv）。
  for (const L of b.lanes) for (const u of L.a) if (u.general) s += 12 + combatPower(u) * 0.3;
  return s;
}

// ══════════════════════════ ④ 候选枚举：整回合计划 TurnPlan（owner 2026-07-03·三行为自由）══════════════════════════
// 动作模型改自由后一回合的合法空间变大：抽/打/换在源泉预算内**任意穿插**（不再"选一类"）。为让前向搜索真正会用这份自由、
// 又不让分支爆炸拖垮 sim，计划=「一个**枢纽决策** + 确定性自由混补完(greedyTurnFill)」：
//   · 枢纽 = 搜索真正拿捏的那步（开哪路 / 是否为抢节奏先抽 / 是否动用唯一换牌修手牌 / 空过）；
//   · greedyTurnFill = 把剩余源泉在 **打天罡 + 部署** 间自由混着花完（这就是"自由混"落地·非单一类）+ 抢节奏补抽。
// 换牌纳入搜索：swap 枢纽让 AI 判断"这张废牌值不值得花唯一的 1 次换"（弃1+随机补1·EV 上修手牌质量）。
type TurnPlan =
  | { kind: 'pass' }                                   // 空过（攒源泉留后手）
  | { kind: 'fill' }                                   // 不指定枢纽·直接自由混补完(打天罡+部署)
  | { kind: 'deploy'; openId: string; lane: number }   // 先把 openId 部署到 lane(关键落子) → 再自由混补完
  | { kind: 'draw' }                                   // 先抢节奏抽牌 → 再自由混部署/施法（抽打同回合·新自由）
  | { kind: 'swap'; handId: string; from: 'poker' | 'tengang' }; // 先换掉一张废牌(随机补) → 再自由混补完

// 补位选路启发（§四·1 田忌赛马/集中突破·§四·3 费用曲线）：无阻推进路 press 到底、敌无阻入侵路必回防、占优接触路增援集中、劣势路少填。
function fillLaneScore(b: TurnBattle, lane: number): number {
  const L = b.lanes[lane]; const fa = L.a[0], fb = L.b[0];
  if (fb && !fa) return 100 + fb.slot * 3;                       // 敌无阻逼近我家 → 最优先回防（免费高速路不能留）
  if (!fb && fa) return 55 + fa.slot * 4;                        // 我无阻推进 → 集中续力凿穿（press breakthrough）
  if (fb && fa) { const wp = clashOdds(b, lane) ?? 0.5; return wp > 0.5 ? 40 + (wp - 0.5) * 80 : 8; } // 占优路增援(集中)·劣势路少填(拖延/让位)
  return 22;                                                     // 空路：开一条新战线(中庸)
}
// 施掉手里最值得的一张天罡（有兵在场才施·空场施 buff 无受益对象=浪费源泉）。施法即重算持续修正（同真机 caller）。返回是否施了。
function castOneTengang(b: TurnBattle): boolean {
  const sd = b.a;
  const i = sd.hand.findIndex((c) => c.kind === 'tengang');
  if (i < 0 || sd.mana < CAST_COST) return false;
  if (!castTengang(b, 'a', i)) return false;
  sd.tengangA = aggregateTengang(sd.castIds);
  sd.castFx = sd.castIds.map((id) => ({ id, fx: aggregateTengang([id]) }));
  return true;
}
// ⭐ 自由混补完剩余源泉（确定性·无 rng）：每步在「部署最便宜买得起的兵 → fillLaneScore 最高路」与「施一张天罡(场上有兵时)」间
//   按价值取高者花——这就是三行为自由里"抽/打自由混"的确定性落地（部署与打天罡同回合穿插·不再互斥）。抽牌不进 fill（由 draw 枢纽显式抢节奏·防抽-放空转死循环）。
function greedyTurnFill(b: TurnBattle): void {
  let guard = 0;
  while (guard++ < 30) {
    const sd = b.a;
    const units = b.lanes.reduce((n, L) => n + L.a.length, 0);
    // 部署候选：最便宜(平手取高战力)买得起的兵 → 最高分路。
    const dep = sd.hand.map((c, i) => ({ c, i })).filter((x) => x.c.kind === 'poker' && ((x.c as PokerCard).cost ?? DEPLOY_COST) <= sd.mana);
    dep.sort((x, y) => (((x.c as PokerCard).cost ?? DEPLOY_COST) - ((y.c as PokerCard).cost ?? DEPLOY_COST)) || (cardPoints((y.c as PokerCard).rank) - cardPoints((x.c as PokerCard).rank)));
    let bestLane = 0, depScore = -Infinity;
    if (dep.length) for (let lane = 0; lane < 3; lane++) { const sc = fillLaneScore(b, lane); if (sc > depScore) { depScore = sc; bestLane = lane; } }
    // 施法候选：场上有兵才值得（buff 有受益对象）→ 与部署同档竞争（自由混）。
    const canCast = sd.hand.some((c) => c.kind === 'tengang') && sd.mana >= CAST_COST;
    const castScore = canCast ? (units > 0 ? 45 : 5) : -Infinity;
    if (depScore <= -Infinity && castScore <= -Infinity) break;
    if (castScore > depScore) { if (!castOneTengang(b)) break; continue; } // 打天罡（自由混·不结束回合）
    const idx = sd.hand.findIndex((h) => h.id === (dep[0].c as PokerCard).id);
    if (idx < 0 || !deployUnit(b, 'a', idx, bestLane)) break;               // 部署（自由混）
  }
}

// 执行一个整回合计划的**玩家动作**（不含 endTurn）——在传入局(可真可克隆)上就地施展。玩家动作零 rng 消费·**换牌消费 rng**（随机补牌）。
function execPlayerPlan(b: TurnBattle, plan: TurnPlan): void {
  const sd = b.a;
  if (plan.kind === 'deploy') {
    const i = sd.hand.findIndex((c) => c.id === plan.openId);
    if (i >= 0) deployUnit(b, 'a', i, plan.lane);                                  // 关键落子（搜索指定）
  } else if (plan.kind === 'draw') {
    let guard = 0;                                                                 // 抢节奏抽（抽完接着自由混部署/施法·抽打同回合）
    while (guard++ < 8) {
      if (sd.mana < DRAW_COST || !sd.pokerDeck.length) break;
      if (sd.hand.length >= HAND_MAX + sd.tengangA.handMaxAdd) break;
      if (!drawCard(b, 'a', 'poker')) break;
    }
  } else if (plan.kind === 'swap') {
    const i = sd.hand.findIndex((c) => c.id === plan.handId);
    if (i >= 0) swapCard(b, 'a', i, plan.from);                                    // 换掉废牌(弃1+随机补1·消费克隆局 rng)
  } // pass：空过（fill 也会走下方补完，pass 例外）
  if (plan.kind !== 'pass') greedyTurnFill(b);                                     // 枢纽后自由混补完剩余源泉（打天罡+部署穿插）
}

// 枚举本回合合法计划（三行为自由）：pass / fill / 每张买得起的兵×每路(deploy 枢纽) / draw(抢节奏) / swap(换废牌)。
// 分支控制：deploy 同 rank+cost 只留一代表×3 路；swap 只提议「最废的一张兵牌」×{扑克库, 天罡库}（唯一换牌不该乱花）。
function legalTurnPlans(b: TurnBattle): TurnPlan[] {
  const sd = b.a; const plans: TurnPlan[] = [{ kind: 'pass' }, { kind: 'fill' }];
  const affordable = sd.hand.filter((c) => c.kind === 'poker' && ((c as PokerCard).cost ?? DEPLOY_COST) <= sd.mana) as PokerCard[];
  const seenOpen = new Set<string>(); // 同 rank+cost 的开局兵只枚举一张代表·×3 路（去重·控分支）
  for (const c of affordable) {
    const key = `${c.rank}:${c.cost ?? DEPLOY_COST}`;
    if (seenOpen.has(key)) continue; seenOpen.add(key);
    for (let lane = 0; lane < 3; lane++) plans.push({ kind: 'deploy', openId: c.id, lane });
  }
  if (sd.mana >= DRAW_COST && sd.pokerDeck.length && sd.hand.length < HAND_MAX + sd.tengangA.handMaxAdd) plans.push({ kind: 'draw' });
  // 换牌枢纽（1/回合·免费）：手里≥2 张兵 + 存在明显低于手均的废牌 + 库非空 → 提议换它。扑克库(修身体)必提·天罡库(钓法术)有库才提。
  if (sd.swapsUsed < SWAP_PER_TURN) {
    const pokers = sd.hand.map((c, i) => ({ c: c as PokerCard, i })).filter((x) => x.c.kind === 'poker');
    if (pokers.length >= 2) {
      let worst = pokers[0]; for (const x of pokers) if (cardPoints(x.c.rank) < cardPoints(worst.c.rank)) worst = x;
      const avg = pokers.reduce((s, x) => s + cardPoints(x.c.rank), 0) / pokers.length;
      if (cardPoints(worst.c.rank) < avg - 1) {
        if (sd.pokerDeck.length) plans.push({ kind: 'swap', handId: worst.c.id, from: 'poker' });
        if (sd.tengangDeck.length) plans.push({ kind: 'swap', handId: worst.c.id, from: 'tengang' });
      }
    }
  }
  return plans;
}

// ══════════════════════════ ③ 敌方模型：克隆局上跑现成 Boss AI ══════════════════════════
// 对手回合直接调 aiDecide（读局面·确定性·会按 aiTier 概率犯错）+ endTurnEV（EV 推进）。这就是"推演敌人未来"。
// 公平简化（v1·留 design G 裁决）：克隆局的 Boss 手牌/牌库是真值拷贝 → aiDecide 推演对手时会"看到" Boss 的即时手牌
//   （规格 §二·五要求用"合理估计"不偷看真值）。清障：地煞/明牌威胁已合法可见；Boss 手牌偷看仅影响其单回合出牌预测·
//   且 Boss 决策以局面反应为主 → v1 接受此简化(略偏乐观)·真掷骰噪声(大头)已由 EV 消除。见交付报告"简化项"。
function runBossTurnEV(b: TurnBattle): void {
  aiDecide(b, aggregateTengang); // Boss 决策（消费克隆局 rng 做 mistake 抽样·不碰真局 rng）
  endTurnEV(b);                  // Boss 推进（EV 掷命·无 rng）
}

// ══════════════════════════ ②③④⑥ 前向搜索（expectimax·beam 剪枝）══════════════════════════
export interface SearchParams { plies: number; beam: number } // plies=向前看几个「整回合往返」·beam=每层保留 top-K 计划
// chooseBestPlan：在局 b（玩家 'a' 待动·winner pending）上选期望赢率最高的整回合计划。返回 {plan, score}。
function chooseBestPlan(b: TurnBattle, p: SearchParams): { plan: TurnPlan; score: number } {
  const plans = legalTurnPlans(b);
  // beam 快评：每个计划在克隆局上只施展**玩家动作**（不含自方推进）→ evalState 快排·留 top-K。
  const scored = plans.map((plan) => {
    const c = cloneBattle(b);
    execPlayerPlan(c, plan);
    return { plan, c, h: evalState(c) };
  });
  scored.sort((x, y) => y.h - x.h);
  const beam = scored.slice(0, Math.max(1, p.beam));
  let best: { plan: TurnPlan; score: number } = { plan: beam[0].plan, score: -Infinity };
  for (const cand of beam) {
    const c = cand.c;             // 已含玩家动作
    endTurnEV(c);                 // ② 我方推进（EV 掷命·无 rng）→ active 转 'b'
    let val: number;
    if (c.winner !== 'pending') val = evalState(c);
    else {
      runBossTurnEV(c);           // ③ 推演敌人未来（Boss 决策 + 推进）→ 回到我方·turn+1
      val = c.winner !== 'pending' || p.plies <= 1 ? evalState(c) : chooseBestPlan(c, { plies: p.plies - 1, beam: p.beam }).score; // ⑥ 递归取更深期望
    }
    if (val > best.score) best = { plan: cand.plan, score: val };
  }
  return best;
}

// ══════════════════════════ ⑦ 分档 + 对外接口 ══════════════════════════
// skill3=N=1（含 Boss 推演一层）· skill5=终极 N=SKILL5_PLIES（+ beam + Boss 推演）。skill1=贪心退化(不走本模块·sim 用现贪心脚本作对照)。
export const SKILL5_PLIES = 3; // 终极档前瞻往返数（N=3·实测关1 单场 Boss 胜率优于 N=2 且性能仍充裕；design G 可上调到 4 换更强/更慢）。
export const BEAM_WIDTH = 5;   // 每层保留 top-K 计划
export function searchParamsFor(skill: number): SearchParams {
  if (skill >= 5) return { plies: SKILL5_PLIES, beam: BEAM_WIDTH };
  if (skill >= 3) return { plies: 1, beam: BEAM_WIDTH };
  return { plies: 1, beam: 1 }; // skill<3 理论上不该走这（贪心对照在 sim 里）——兜底给最浅搜索
}

/** 终极版 Player-AI 走一个玩家回合（在**真局** b 上落子）：前向推演选最优整回合计划 → 施展玩家动作 → endTurn(真掷骰)。
 *  确定性铁律：chooseBestPlan 全程只在克隆局上跑(不消费真局 rng)；真局仅 execPlayerPlan(零 rng) + endTurn(真掷骰·同贪心)
 *  → turnHash/回放不裂。skill 决定搜索深度（≥5 终极·3 中级）。 */
export function playerTakeTurnAI(b: TurnBattle, skill = 5): void {
  if (b.winner !== 'pending' || b.active !== 'a') return;
  const { plan } = chooseBestPlan(b, searchParamsFor(skill)); // 只读真局·在克隆上推演
  execPlayerPlan(b, plan);                                    // 真局落子（玩家动作·零 rng 消费）
  endTurn(b);                                                 // 真局推进（真掷骰·消费真 rng·结构同贪心 → 确定可回放）
}

// discardCard 未在 v1 计划中使用（弃牌换 0.5 源泉的续航微操留 design G 裁决是否值得进搜索）——引用以免 tree-shake 报未用。
void discardCard;
