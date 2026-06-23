// simulate-balance.ts -- Game-G 数值平衡仿真台（回合制战斗·关1温泉关通关率）
// Run: npx vite-node src/games/game-g/simulate-balance.ts
//
// ⚠ Boss openingLevers 随旧 build-时 effect-apply 路（prepareArmies/applyInterventions）退役·已移除：
//   军队改用裸生成器 armyFromFormation 造（玩家侧零效果·行为不变；Boss 侧丢弃起手干预）。
//   sim 本就标「临时旧模型」，Boss 力量后续由 16 写死牌组 + 地煞 loader 表达，非本仿真台职责。
import {
  FORMATION_PRESETS, battleSpec, pickAiFormation, armyFromFormation,
  TIANGANG_BY_ID, bossFor, RUN_BATTLES, deployCost, type ArmyCard,
} from './index.js';
import {
  initTurnBattle, drawCard, deployUnit, castTengang, endTurn, aiTakeTurn,
  OPENING_HAND, DRAW_COST, CAST_COST, type TurnBattle, type PokerCard, type TengangHandCard,
} from './turn-combat.js';
import { NO_TENGANG, type TengangFx } from './combat-types.js';
import { cardPoints, P_MAX } from './clash-resolve.js';
import { loadLevel } from './level.js';

declare const process: { exit(code: number): never };

// ── Local helpers (pure functions from game-g.tsx, copied to avoid browser deps) ──

const FAVOR_LO = 5, FAVOR_HI = 95;
const favorToP = (favor: number): number =>
  ((Math.max(FAVOR_LO, Math.min(FAVOR_HI, favor)) - FAVOR_LO) / (FAVOR_HI - FAVOR_LO)) * P_MAX;
const cardRank = (c: ArmyCard): string => (c.rank === 'JOKER' ? '★' : c.rank);
// 放牌费由 rank 查表写在卡上（契约B·deployCost）——否则 sim 里双方 cost 缺省=0=免费铺场→必 100%（owner 2026-06-21 修：sim 必须喂 cost 才真实）。
const toPoker = (c: ArmyCard): PokerCard => ({
  kind: 'poker', id: c.id, rank: cardRank(c), suit: c.suit, general: c.general,
  buff: Math.round(favorToP(c.favor) - cardPoints(cardRank(c))),
  cost: deployCost(cardRank(c)),
});

// 地支附魔（养成）：给玩家最值得镶的几张牌叠 favor。新手基线≈5 张铜地支(+4/张·INLAY_MAX=3/牌)。
// 取最高 favor 的牌优先镶满（玩家就把地支镶在核心英雄上）；inlayFavorTotal=总加成点，按 ≤3 槽×档摊到顶尖牌。
function applyInlayFavor(cards: ArmyCard[], inlayFavorTotal: number, perCardCap = 3 * 14): ArmyCard[] {
  if (inlayFavorTotal <= 0) return cards;
  const idxByFavor = cards.map((c, i) => ({ i, f: c.favor })).sort((a, b) => b.f - a.f).map((x) => x.i);
  let left = inlayFavorTotal;
  const out = cards.map((c) => ({ ...c }));
  for (const i of idxByFavor) {
    if (left <= 0) break;
    const add = Math.min(left, perCardCap);
    out[i] = { ...out[i], favor: Math.max(5, Math.min(95, out[i].favor + add)) };
    left -= add;
  }
  return out;
}

function seededShuffleArr<T>(xs: T[], seed: number): T[] {
  const arr = [...xs]; let t = seed >>> 0;
  const rnd = (): number => {
    t += 0x6d2b79f5; let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

function tengangFxOf(cards: Iterable<{ kind: string; params?: Record<string, unknown> }>): TengangFx {
  const fx: TengangFx = { ...NO_TENGANG };
  for (const j of cards) {
    const p = j.params; if (!p) continue;
    const v = typeof p.value === 'number' ? p.value : 0;
    const bonus = typeof p.bonus === 'number' ? p.bonus : 0;
    if (j.kind === 'odds') {
      if (p.op === 'add') fx.pEffAdd += v;
      else if (p.op === 'winFloor') fx.winFloor += v / 100;
      else if (p.op === 'kHard') fx.kHard += v;
      else if (p.op === 'noUpset') fx.noUpset += 1;
    } else if (j.kind === 'power') {
      if (p.op === 'mul' && p.scope === 'highestRank') fx.powerMulHighest = Math.max(fx.powerMulHighest, v);
      else if (p.op === 'add') {
        if (p.filter === 'countLE3') fx.powerLE3 += v;
        else if (p.filter === 'sameSuit') fx.powerSameSuit += v;
        else if (p.scope === 'front') fx.powerFront += v;
        else fx.powerAll += v;
      }
    } else if (j.kind === 'combo') {
      if (p.op === 'pair') fx.comboPair += bonus;
      else if (p.op === 'trips') fx.comboTrips += bonus;
    } else if (j.kind === 'morale') {
      if (p.op === 'leaderBuff') fx.moraleLeader += v;
      else if (p.op === 'revenge') fx.revenge += v;
      else if (p.op === 'noRout') fx.noRout = 1;
    } else if (j.kind === 'stamina') {
      if (p.op === 'stamPlus') { if (p.filter === 'faces') fx.stamFaces += v; else fx.stamPlus += v; }
      else if (p.op === 'relay') fx.relay += v;
    } else if (j.kind === 'draw') {
      if (p.op === 'handMax') fx.handMaxAdd += v;
      else if (p.op === 'onPlay') fx.onPlay += v;
      else if (p.op === 'clashElixir') fx.clashElixir += v;
    } else if (j.kind === 'siege') {
      if (p.op === 'defend') fx.siegeDefend += v;
      else if (p.op === 'chipMore') fx.siegeChip += v;
    }
  }
  return fx;
}

function aggregateTengang(castIds: readonly string[]): TengangFx {
  const cards: { kind: string; params?: Record<string, unknown> }[] = [];
  for (const id of castIds) {
    const j = TIANGANG_BY_ID.get(id);
    if (j) cards.push({ kind: j.kind, params: j.params });
  }
  return tengangFxOf(cards);
}

// ── Player greedy agent ──
// Strategy: deploy all poker cards first (free); draw when hand is empty; always end turn.
// Lane selection: prioritize lane most threatened by enemy (highest enemy count − own count).

function playerTakeTurn(b: TurnBattle): void {
  if (b.winner !== 'pending' || b.active !== 'a') return;
  const sd = b.a;
  // ① 优先施天罡（开局铺 buff·持续整局·互斥 → 整回合只施法）。手有天罡 + 买得起 → 这回合就施。
  if ((b.actionTaken === null || b.actionTaken === 'cast') && sd.mana >= CAST_COST) {
    let guard = 0;
    while (guard++ < 6) {
      const tIdx = sd.hand.findIndex((c) => c.kind === 'tengang');
      if (tIdx === -1 || sd.mana < CAST_COST) break;
      if (!castTengang(b, 'a', tIdx)) break;
      sd.tengangA = aggregateTengang(sd.castIds);
      sd.castFx = sd.castIds.map((id) => ({ id, fx: aggregateTengang([id]) }));
    }
    if (b.actionTaken === 'cast') { endTurn(b); return; }
  }
  // ② 放牌（按 cost·优先最便宜买得起的兵铺场 → 凑曲线/连携）；手空或放不动则抽。
  let guard = 0;
  while (guard++ < 60) {
    if (b.actionTaken === null || b.actionTaken === 'deploy') {
      const affordable = sd.hand
        .map((c, i) => ({ c, i }))
        .filter((x) => x.c.kind === 'poker' && ((x.c as PokerCard).cost ?? 0) <= sd.mana)
        .sort((x, y) => ((x.c as PokerCard).cost ?? 0) - ((y.c as PokerCard).cost ?? 0));
      if (affordable.length) {
        const bestLane = [0, 1, 2].reduce((best, li) => {
          const score = b.lanes[li].b.length * 2 - b.lanes[li].a.length;
          const bscore = b.lanes[best].b.length * 2 - b.lanes[best].a.length;
          return score > bscore ? li : best;
        }, 0);
        if (deployUnit(b, 'a', affordable[0].i, bestLane)) continue;
      }
    }
    if (b.actionTaken === null && sd.mana >= DRAW_COST && sd.pokerDeck.length > 0) {
      if (drawCard(b, 'a', 'poker')) continue;
    }
    break;
  }
  endTurn(b);
}

// ── 玩家本关装备基线（owner 2026-06-21：sim 要考虑地支附魔 + 天罡加成）──
//  · tiangang：本关 loadout（≤loadoutCap 张·新手区只解锁关1的虎符/旗手/老兵/广纳）。
//  · inlayFavor：地支附魔总加成（新手基线≈5 张铜地支 = +20 favor·摊到核心英雄）。
//  · deckBias：扑克 52 整体养成偏置（favor 基线·新手3/进阶6/老手9）。
interface PlayerCfg { deckBias: number; tiangang: string[]; inlayFavor: number }

// 关1-5 新手解锁的天罡（unlockStageOf<=1 在关1只有 4 张）；按 loadoutCap 取前 N。
const STARTER_LOADOUT = ['tigertally', 'bannerman', 'veteran', 'widehand']; // 虎符全军+2 / 旗手主将光环 / 老兵续航 / 广纳手牌

// ── Single battle runner ──

interface BattleResult { winner: 'a' | 'b' | 'draw' | 'timeout'; turns: number; clashes: number; firstClashTurn: number; firstScoreTurn: number }

function runBattle(
  stage: number,
  battleIdx: number, // 0-based within run
  pcfg: PlayerCfg,
  seed: number,
  bossDelta = 0, // Boss/敌方 favorBias 调校量（标定 Boss 牌力的旋钮·design G 扫）
): BattleResult {
  const lvl = loadLevel(stage);
  const spec = battleSpec(battleIdx);

  let enemyBias: number;
  let enemyForm = pickAiFormation(stage, 0, [], false);

  if (spec.boss) {
    const boss = bossFor(0); // fixed boss index 0 for reproducibility
    enemyBias = boss.favorBias + bossDelta;
    enemyForm = boss.formation;
  } else {
    enemyBias = spec.enemyBias + bossDelta;
  }

  // 裸军队生成器（旧 build-时 effect-apply 路 prepareArmies 已退役）：
  //   玩家侧均衡布阵 + deckBias；Boss 侧用 boss/spec 的 enemyForm + enemyBias。
  // 玩家侧本就传 tiangangs:[]/interventions:[]/planets:{}（零效果）→ army 行为不变（等价旧路）。
  const a = armyFromFormation('a', pcfg.deckBias, FORMATION_PRESETS['均衡']);
  const b = armyFromFormation('b', enemyBias, enemyForm);

  // 地支附魔：把玩家整体养成的 inlayFavor 摊到最值得镶的核心英雄上（owner 要求 sim 计入地支加成）。
  const aInlaid = applyInlayFavor(a, pcfg.inlayFavor);

  const aTengang: TengangHandCard[] = pcfg.tiangang.map((id) => ({ kind: 'tengang', id }));
  const bTengang: TengangHandCard[] = lvl.boss.tiangang.map((id) => ({ kind: 'tengang', id }));

  const tb = initTurnBattle({
    seed,
    disha: lvl.boss.disha,
    aiProfile: lvl.boss.aiProfile,
    aiTier: lvl.boss.aiTier,
    a: { pokerDeck: seededShuffleArr(aInlaid.map(toPoker), seed ^ 0x9e37), tengangDeck: aTengang },
    b: { pokerDeck: seededShuffleArr(b.map(toPoker), seed ^ 0x51ed), tengangDeck: bTengang },
  });

  for (let i = 0; i < OPENING_HAND && tb.a.pokerDeck.length; i++) tb.a.hand.push(tb.a.pokerDeck.shift()!);
  for (let i = 0; i < OPENING_HAND && tb.b.pokerDeck.length; i++) tb.b.hand.push(tb.b.pokerDeck.shift()!);

  let firstClashTurn = -1, firstScoreTurn = -1, prevClash = 0, prevHA = tb.homeA, prevHB = tb.homeB;
  const MAX_TURNS = 300;
  while (tb.winner === 'pending' && tb.turn <= MAX_TURNS) {
    if (tb.active === 'a') playerTakeTurn(tb);
    else aiTakeTurn(tb, aggregateTengang);
    if (firstClashTurn === -1 && tb.clashSeq > prevClash) firstClashTurn = tb.turn;
    if (firstScoreTurn === -1 && (tb.homeA < prevHA || tb.homeB < prevHB)) firstScoreTurn = tb.turn;
    prevClash = tb.clashSeq; prevHA = tb.homeA; prevHB = tb.homeB;
  }

  return {
    winner: tb.winner === 'pending' ? 'timeout' : tb.winner,
    turns: tb.turn, clashes: tb.clashSeq,
    firstClashTurn: firstClashTurn < 0 ? tb.turn : firstClashTurn,
    firstScoreTurn: firstScoreTurn < 0 ? tb.turn : firstScoreTurn,
  };
}

// ── Multi-battle run simulator (all RUN_BATTLES in sequence) ──

interface RunResult { cleared: boolean; defeatedAt: number }

function runOnce(stage: number, pcfg: PlayerCfg, baseSeed: number, bossDelta = 0): RunResult {
  for (let bi = 0; bi < RUN_BATTLES; bi++) {
    const r = runBattle(stage, bi, pcfg, baseSeed + bi * 1337, bossDelta);
    if (r.winner !== 'a') return { cleared: false, defeatedAt: bi };
  }
  return { cleared: true, defeatedAt: -1 };
}

// ── Report printer ──

function runBattleSim(stage: number, battleIdx: number, pcfg: PlayerCfg, runs: number, label: string, bossDelta = 0): void {
  let wins = 0, losses = 0, timeouts = 0, totalTurns = 0, totalClashes = 0, totalFC = 0, totalFS = 0;
  const t0 = Date.now();
  for (let i = 0; i < runs; i++) {
    const r = runBattle(stage, battleIdx, pcfg, 100 + i * 7919, bossDelta);
    if (r.winner === 'a') wins++;
    else if (r.winner === 'timeout') timeouts++;
    else losses++;
    totalTurns += r.turns; totalClashes += r.clashes;
    totalFC += r.firstClashTurn; totalFS += r.firstScoreTurn;
  }
  const ms = Date.now() - t0;
  const wr = ((wins / runs) * 100).toFixed(1);
  const rounds = (totalTurns / runs / 2).toFixed(1); // tb.turn 双方合计，÷2 = 完整对局轮
  const fc = (totalFC / runs / 2).toFixed(1);
  const fs = (totalFS / runs / 2).toFixed(1);
  const cl = (totalClashes / runs).toFixed(1);
  console.log(`  ${label.padEnd(28)} 胜率 ${wr.padStart(5)}%  轮数 ${rounds.padStart(5)}轮  [首遭遇${fc}轮 首失血${fs}轮 遭遇${cl}次]  ${ms}ms`);
}

function clearRate(stage: number, pcfg: PlayerCfg, runs: number, bossDelta = 0): number {
  let cleared = 0;
  for (let i = 0; i < runs; i++) if (runOnce(stage, pcfg, 100 + i * 7919, bossDelta).cleared) cleared++;
  return cleared / runs;
}

function runStageSim(stage: number, pcfg: PlayerCfg, runs: number, label: string, bossDelta = 0): void {
  let cleared = 0; const defeatedAt: number[] = [0, 0, 0, 0, 0];
  const t0 = Date.now();
  for (let i = 0; i < runs; i++) {
    const r = runOnce(stage, pcfg, 100 + i * 7919, bossDelta);
    if (r.cleared) cleared++;
    else if (r.defeatedAt >= 0) defeatedAt[r.defeatedAt]++;
  }
  const ms = Date.now() - t0;
  const cr = ((cleared / runs) * 100).toFixed(1);
  const loseBreakdown = defeatedAt.map((n, i) => `第${i + 1}战:${n}`).join(' ');
  console.log(`  ${label.padEnd(28)} 通关率 ${cr.padStart(5)}%  通关${cleared}/总${runs}  [${loseBreakdown}]  ${ms}ms`);
}

// ── Main ──

const STAGE = 1;
const RUNS = 500;
const lvl1 = loadLevel(STAGE);
const LOADOUT = STARTER_LOADOUT.slice(0, lvl1.loadoutCap); // 关1 loadoutCap=2 → 虎符+旗手

// 三档玩家画像：新手(浅养成)/进阶/老手(深养成·满地支+满loadout)
const NEWBIE: PlayerCfg = { deckBias: 3, tiangang: LOADOUT, inlayFavor: 20 }; // 5 铜地支
const MID: PlayerCfg = { deckBias: 6, tiangang: LOADOUT, inlayFavor: 40 };    // ~铜银混
const VET: PlayerCfg = { deckBias: 9, tiangang: STARTER_LOADOUT.slice(0, Math.max(lvl1.loadoutCap, 3)), inlayFavor: 70 }; // 深养成

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  Game-G 平衡仿真  ·  第1关「温泉关」(列奥尼达) · N=500  ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');
console.log(`玩家装备基线：天罡 loadout=[${LOADOUT.join(',')}] (cap ${lvl1.loadoutCap}) · 放牌按点数收费 · 地支附魔已计入。`);
console.log(`Boss：16写死模型未接前·暂用旧 favorBias(${bossFor(0).favorBias})+开局干预+${lvl1.boss.tiangang.length}天罡+地煞 模型；bossDelta=Boss牌力旋钮。\n`);

console.log('【新手 deckBias=3 · 各战场单场胜率】  bossDelta=0（基准）');
for (let bi = 0; bi < RUN_BATTLES; bi++) {
  const spec = battleSpec(bi);
  runBattleSim(STAGE, bi, NEWBIE, RUNS, `第${bi + 1}战 ${spec.label.slice(0, 8)}`);
}

console.log('\n【完整一关通关率 · 5战全胜 · bossDelta=0】');
runStageSim(STAGE, NEWBIE, RUNS, 'deckBias=3 (新手·5铜地支·虎符旗手)');
runStageSim(STAGE, MID, RUNS, 'deckBias=6 (进阶)');
runStageSim(STAGE, VET, RUNS, 'deckBias=9 (老手·深养成)');

console.log('\n【地支/天罡 消融实验 · 新手 deckBias=3 · 通关率】');
runStageSim(STAGE, { deckBias: 3, tiangang: [], inlayFavor: 0 }, RUNS, '裸装(无天罡·无地支)');
runStageSim(STAGE, { deckBias: 3, tiangang: LOADOUT, inlayFavor: 0 }, RUNS, '+天罡 loadout');
runStageSim(STAGE, { deckBias: 3, tiangang: [], inlayFavor: 20 }, RUNS, '+地支附魔(5铜)');
runStageSim(STAGE, NEWBIE, RUNS, '+天罡+地支(完整新手)');

console.log('\n【Boss 牌力标定扫描 · 新手 deckBias=3 完整装备 · 通关率 vs bossDelta】');
for (const d of [-6, -3, 0, 3, 6, 9, 12]) {
  const cr = clearRate(STAGE, NEWBIE, 300, d) * 100;
  console.log(`  bossDelta ${String(d).padStart(3)}  →  新手通关率 ${cr.toFixed(1).padStart(5)}%`);
}

console.log('\n说明：玩家=贪心(先施天罡→按点数铺最便宜兵→手空抽)；Boss=utility AI 用天罡+地煞。');
console.log('地支附魔=核心英雄叠 favor；天罡 loadout 整局生效。轮数=tb.turn÷2。');
console.log('⚠ Boss 16 写死牌组 + dishaScale 尚未接入 loader（doc27 §六派甲）→ 本扫描用旧 favorBias 模型，标定为「临时」；接入后重扫定稿。\n');
