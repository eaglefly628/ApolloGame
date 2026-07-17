// scripts/game-t-balance-sim.ts —— 《墨消》(game-t) 关卡表平衡模拟器 / 确定性 bot。
//
// 配套 docs/design/game-t/level-schema.md §二「验证环」。**零自写规则副本**：换/连/消/重力/补块/连锁/
// 特殊棋子全部复用引擎导出的纯函数（findMatches / resolveClear / applyGravity / refillEmpty /
// classifySpawns / computeSwapComboClear / isSwapCombo），本文件只做「回合编排 + 格层记账 + 得分口径 +
// 贪心 bot + 统计」——即 match-resolve 系统的 authoring-time 复刻。与引擎口径一致性由
// scripts/game-t-balance-sim.conformance.test.ts 驱动真 capability(World) 断言（防漂移）。
//
// 用法:
//   npx vite-node scripts/game-t-balance-sim.ts                 # 跑全部关 × 200 seeds，打印汇总
//   npx vite-node scripts/game-t-balance-sim.ts --seeds=200     # 指定 seeds/关
//   npx vite-node scripts/game-t-balance-sim.ts --level=10      # 只跑单关(调试)
//   npx vite-node scripts/game-t-balance-sim.ts --report        # 同时写 docs/design/game-t/balance-report.md
//
// 计分口径 (= GDD §四): 单格 60·连锁每级 ×1.5·特殊棋子按波及格计·收笔=剩步×1000(仅通关)。

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  findMatches,
  applyGravity,
  refillEmpty,
  resolveClear,
  classifySpawns,
  computeSwapComboClear,
  isSwapCombo,
  makeCell,
  cellColor,
  adjacent,
  EMPTY,
  COLORLESS,
  DEFAULT_COMBO_TABLE,
  STRIPED_H,
  STRIPED_V,
  WRAPPED,
  COLORBOMB,
} from '../src/skills/tier3/match3-board.js';
import { randomInt } from '../src/skills/atoms/random/index.js';
import type { RandomSeed } from '../src/engine/protocol/components.js';

// ── 关卡数据类型 (= level-schema.md) ────────────────────────────────────────
export type GoalKind = 'score' | 'collect' | 'jelly' | 'blocker';
export interface Goal { kind: GoalKind; color?: number; n?: number }
export interface Level {
  no: number;
  type: 'score' | 'collect' | 'jelly' | 'blocker' | 'mixed';
  cols: number;
  rows: number;
  kinds: number;
  moves: number;
  goals: Goal[];
  stars: [number, number, number];
  seed: number;
  layout: { board: string[]; jelly?: string[]; blockers?: string[] };
  note?: string;
}

// ── 计分/模型常量 —— **口径与 runtime 严格对齐** (src/games/game-t/theme.ts) ──────
//   SCORE_PER_TILE=60 (coinResource='score'·coinPerTile=60·平铺)；BRUSH_PER_MOVE=1000 (收笔剩步×1000)。
//   ⚠ CASCADE_MULT=1.0：引擎当前**平铺 60/珠·无连锁倍率**(GDD §四 的连锁×1.5 = 引擎 config 缺口·主池
//   REQ-M3-计分倍率 未落地)。故 sim 按平铺定标以杜绝「sim↔runtime 口径漂移」(run1 教训·requests T-103)；
//   待 REQ-M3-计分倍率 落地后改回 1.5 并重跑定标。
export const PTS_PER_TILE = 60;    // = theme.SCORE_PER_TILE
export const CASCADE_MULT = 1.0;   // 平铺(见上)·待 REQ-M3-计分倍率
export const FINISH_PER_MOVE = 1000; // = theme.BRUSH_PER_MOVE (收笔)
const STRIPE_ORIENT = 'perpendicular';
const MAX_RESHUFFLE = 20;

// ── 棋盘运行态 ──────────────────────────────────────────────────────────────
interface BoardState {
  cells: number[];
  jelly: number[];
  blockers: number[];
  seed: RandomSeed;
  cols: number;
  rows: number;
  kinds: number;
}

function neighbors4(i: number, cols: number, rows: number): number[] {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  if (r > 0) out.push(i - cols);
  if (r < rows - 1) out.push(i + cols);
  if (c > 0) out.push(i - 1);
  if (c < cols - 1) out.push(i + 1);
  return out;
}

// 字符画一行串 → 每格值。board: '.'=随机补, '0'..'5'=定色; jelly: '.'=0, '1'/'2'=层; blockers: '.'=0, '1'..'3'=hp, 'S'=-1 石块。
function parseLayer(rows: string[] | undefined, cols: number, rowN: number, kind: 'jelly' | 'blockers'): number[] {
  const out = new Array(cols * rowN).fill(0);
  if (!rows) return out;
  for (let r = 0; r < rowN; r++) {
    const line = rows[r] ?? '';
    for (let c = 0; c < cols; c++) {
      const ch = line[c] ?? '.';
      if (ch === '.' ) continue;
      if (kind === 'blockers' && (ch === 'S' || ch === 's')) out[r * cols + c] = -1;
      else out[r * cols + c] = Number(ch) || 0;
    }
  }
  return out;
}

// 建初盘 (给定 seed)：定色格照摆，'.' 随机补；然后消去所有初始连线(石块/锁格不参与)——
// 复刻真机「开局无待消连线」的稳定盘（不产分不计目标·仅推进 seed）。
export function buildBoard(level: Level, seedNum: number): BoardState {
  const { cols, rows, kinds } = level;
  const seed: RandomSeed = { type: 'RandomSeed', seed: seedNum >>> 0, sequence: 0 } as RandomSeed;
  const blockers = parseLayer(level.layout.blockers, cols, rows, 'blockers');
  const jelly = parseLayer(level.layout.jelly, cols, rows, 'jelly');
  const cells = new Array(cols * rows).fill(EMPTY);
  const fixed = new Array(cols * rows).fill(false);
  for (let i = 0; i < cells.length; i++) {
    if (blockers[i] !== 0) { cells[i] = 0; continue; } // 石块/障碍位: 占位色(锁·不参与)
    const r = Math.floor(i / cols);
    const c = i % cols;
    const ch = level.layout.board[r]?.[c] ?? '.';
    if (ch >= '0' && ch <= '5') { cells[i] = Number(ch); fixed[i] = true; }
    else cells[i] = randomInt(seed, 0, kinds);
  }
  // 稳定化: 反复把落在连线里的「非定色」格重掷，直到无连线(有界)。
  for (let guard = 0; guard < 200; guard++) {
    const m = findMatches(cells, cols, rows, blockers);
    if (m.size === 0) break;
    let changed = false;
    for (const i of m) {
      if (fixed[i] || blockers[i] !== 0) continue;
      cells[i] = randomInt(seed, 0, kinds);
      changed = true;
    }
    if (!changed) break; // 全是定色连线(设计失误)——留给校验器报
  }
  return { cells, jelly, blockers, seed, cols, rows, kinds };
}

// ── 单回合结算 (复刻 match-resolve: swapped→clear→fall→refill→match 连锁) ──────
export interface MoveResult {
  legal: boolean;
  score: number;
  collected: Map<number, number>; // 色 → 消除颗数
  jellyHits: number;
  blockerHits: number;
  spawned: number[];              // 本步生成的特殊棋子 flag(供教学关必现核验)
}
export function resolveMove(S: BoardState, a: number, b: number): MoveResult {
  const { cols, rows, kinds } = S;
  // 发起交换
  const t = S.cells[a]; S.cells[a] = S.cells[b]; S.cells[b] = t;
  const comboSwap = isSwapCombo(S.cells, a, b);
  if (!comboSwap && findMatches(S.cells, cols, rows, S.blockers).size === 0) {
    S.cells[b] = S.cells[a]; S.cells[a] = t; // 非法步: 撤回
    return { legal: false, score: 0, collected: new Map(), jellyHits: 0, blockerHits: 0, spawned: [] };
  }
  let score = 0, jellyHits = 0, blockerHits = 0;
  const collected = new Map<number, number>();
  const spawned: number[] = [];
  let swapA = a, swapB = b, cascade = 0;
  for (;;) {
    const swapCombo = swapA >= 0 && swapB >= 0 && isSwapCombo(S.cells, swapA, swapB);
    let seedSet: Set<number> | Iterable<number>;
    let preDet: number[] = [];
    let spawns: { index: number; special: number; color: number }[] = [];
    if (swapCombo) {
      seedSet = computeSwapComboClear(S.cells, cols, rows, swapA, swapB, DEFAULT_COMBO_TABLE);
      preDet = [swapA, swapB];
    } else {
      seedSet = findMatches(S.cells, cols, rows, S.blockers);
      spawns = classifySpawns(S.cells, cols, rows, swapA, swapB, STRIPE_ORIENT, S.blockers);
    }
    const toClear = resolveClear(S.cells, cols, rows, seedSet, S.blockers, preDet);
    // 格层记账 (= applyLayerEffects)：消除格产料(按色)/果冻减层；邻接障碍 -1 hp(每障碍每次至多一次)。
    for (const i of toClear) {
      const col = cellColor(S.cells[i]);
      if (col >= 0 && col !== COLORLESS) collected.set(col, (collected.get(col) ?? 0) + 1);
      if (S.jelly[i] > 0) { S.jelly[i] -= 1; jellyHits += 1; }
    }
    const hit = new Set<number>();
    for (const i of toClear) for (const n of neighbors4(i, cols, rows)) if ((S.blockers[n] ?? 0) > 0) hit.add(n);
    for (const n of hit) { S.blockers[n] -= 1; blockerHits += 1; if (S.blockers[n] === 0) S.cells[n] = EMPTY; }
    for (const i of toClear) S.cells[i] = EMPTY;
    score += toClear.size * PTS_PER_TILE * Math.pow(CASCADE_MULT, cascade);
    for (const s of spawns) if (toClear.has(s.index)) { S.cells[s.index] = makeCell(s.color, s.special); spawned.push(s.special); }
    swapA = -1; swapB = -1;
    // 落 + 补
    applyGravity(S.cells, cols, rows, S.blockers);
    refillEmpty(S.cells, kinds, S.seed, S.blockers);
    cascade += 1;
    if (findMatches(S.cells, cols, rows, S.blockers).size === 0) break;
  }
  return { legal: true, score, collected, jellyHits, blockerHits, spawned };
}

// ── 目标进度 ────────────────────────────────────────────────────────────────
interface Progress { score: number; collected: Map<number, number> }
function goalMet(g: Goal, S: BoardState, p: Progress): boolean {
  switch (g.kind) {
    case 'score': return p.score >= (g.n ?? 0);
    case 'collect': return (p.collected.get(g.color ?? 0) ?? 0) >= (g.n ?? 0);
    case 'jelly': return S.jelly.every((v) => v <= 0);
    case 'blocker': return S.blockers.every((v) => v <= 0); // 石块=-1 视为已满足(不计)
  }
}
function allGoalsMet(level: Level, S: BoardState, p: Progress): boolean {
  return level.goals.every((g) => goalMet(g, S, p));
}

// ── 贪心 bot: 枚举合法交换，按「未达成目标的即时增量」最大取；平手取更大即时消除、再取 index 序。────
function legalSwaps(S: BoardState): [number, number][] {
  const { cols, rows } = S;
  const out: [number, number][] = [];
  for (let i = 0; i < S.cells.length; i++) {
    if ((S.blockers[i] ?? 0) !== 0) continue;
    for (const j of [i + 1, i + cols]) { // 只看右/下相邻，避免重复
      if (j >= S.cells.length) continue;
      if (!adjacent(i, j, cols)) continue;
      if ((S.blockers[j] ?? 0) !== 0) continue;
      out.push([i, j]);
    }
  }
  return out;
}
// 某交换对「未达成目标」的即时增量(即时消除集·玩家可见的确定部分·不含补块随机连锁)。null=非法步。
function evalSwap(level: Level, S: BoardState, p: Progress, a: number, b: number): number | null {
  const { cols, rows } = S;
  const cells = S.cells.slice();
  const t = cells[a]; cells[a] = cells[b]; cells[b] = t;
  const comboSwap = isSwapCombo(cells, a, b);
  let seedSet: Iterable<number>;
  let preDet: number[] = [];
  if (comboSwap) { seedSet = computeSwapComboClear(cells, cols, rows, a, b, DEFAULT_COMBO_TABLE); preDet = [a, b]; }
  else { const m = findMatches(cells, cols, rows, S.blockers); if (m.size === 0) return null; seedSet = m; }
  const toClear = resolveClear(cells, cols, rows, seedSet, S.blockers, preDet);
  let obj = 0;
  for (const g of level.goals) {
    if (goalMet(g, S, p)) continue; // 已达成的目标不再计增量
    if (g.kind === 'score') obj += toClear.size; // 分数关: 即时消除量
    else if (g.kind === 'collect') { for (const i of toClear) if (cellColor(cells[i]) === g.color) obj += 1; }
    else if (g.kind === 'jelly') { for (const i of toClear) if (S.jelly[i] > 0) obj += 1; }
    else if (g.kind === 'blocker') {
      const hit = new Set<number>();
      for (const i of toClear) for (const n of neighbors4(i, cols, rows)) if ((S.blockers[n] ?? 0) > 0) hit.add(n);
      obj += hit.size;
    }
  }
  return obj;
}
// = level-schema §二.1: 优先「达成目标增量最大」，平手取 index 序(a*N+b 最小)。不追求最优·模拟中位玩家。
export function chooseSwap(level: Level, S: BoardState, p: Progress): [number, number] | null {
  let best: [number, number] | null = null;
  let bestObj = -1, bestKey = Infinity;
  for (const [a, b] of legalSwaps(S)) {
    const obj = evalSwap(level, S, p, a, b);
    if (obj === null) continue;
    const key = a * S.cells.length + b;
    if (obj > bestObj || (obj === bestObj && key < bestKey)) { best = [a, b]; bestObj = obj; bestKey = key; }
  }
  return best;
}

// 死局重排(免费·Candy-Crush 式)：打乱可动格直到无连线且有合法步(有界)。
function reshuffle(S: BoardState): boolean {
  const { cols, rows } = S;
  const idx: number[] = [];
  for (let i = 0; i < S.cells.length; i++) if ((S.blockers[i] ?? 0) === 0) idx.push(i);
  for (let attempt = 0; attempt < MAX_RESHUFFLE; attempt++) {
    for (let k = idx.length - 1; k > 0; k--) {
      const j = randomInt(S.seed, 0, k + 1);
      const ti = idx[k]; const a = S.cells[ti], bcell = S.cells[idx[j]];
      S.cells[ti] = bcell; S.cells[idx[j]] = a;
    }
    if (findMatches(S.cells, cols, rows, S.blockers).size === 0 && hasLegalMove(S)) return true;
  }
  return false;
}
function hasLegalMove(S: BoardState): boolean {
  const { cols, rows } = S;
  for (const [a, b] of legalSwaps(S)) {
    const cells = S.cells.slice();
    const t = cells[a]; cells[a] = cells[b]; cells[b] = t;
    if (isSwapCombo(cells, a, b)) return true;
    if (findMatches(cells, cols, rows, S.blockers).size > 0) return true;
  }
  return false;
}

// ── 打单关(单 seed) ─────────────────────────────────────────────────────────
export interface PlayResult { win: boolean; movesUsed: number; remaining: number; score: number; stepsToWin: number }
export function playLevel(level: Level, seedNum: number, movesOverride?: number, trace?: (r: MoveResult, moveNo: number) => void): PlayResult {
  const S = buildBoard(level, seedNum);
  const moves = movesOverride ?? level.moves;
  const p: Progress = { score: 0, collected: new Map() };
  const isScoreLevel = level.type === 'score';
  let used = 0, stepsToWin = -1;
  for (let m = 0; m < moves; m++) {
    if (!isScoreLevel && allGoalsMet(level, S, p)) break; // 目标关: 达标即收
    if (!hasLegalMove(S)) { if (!reshuffle(S)) break; }
    const sw = chooseSwap(level, S, p);
    if (!sw) { if (!reshuffle(S)) break; continue; }
    const res = resolveMove(S, sw[0], sw[1]);
    if (!res.legal) continue; // 理论不发生(chooseSwap 只回合法步)
    used += 1;
    trace?.(res, used);
    p.score += res.score;
    for (const [c, n] of res.collected) p.collected.set(c, (p.collected.get(c) ?? 0) + n);
    if (stepsToWin < 0 && allGoalsMet(level, S, p)) stepsToWin = used;
  }
  const win = allGoalsMet(level, S, p);
  const remaining = Math.max(0, moves - used);
  let score = p.score;
  if (win) score += remaining * FINISH_PER_MOVE; // 收笔
  return { win, movesUsed: used, remaining, score, stepsToWin: stepsToWin < 0 ? used : stepsToWin };
}

// ── 跑一关 × N seeds → 统计 ─────────────────────────────────────────────────
export interface LevelStat {
  no: number; winRate: number; avgRemaining: number; avgStepsToWin: number;
  scoreP50: number; scoreP85: number; stepsP50: number;
  comp: [number, number, number]; // 目标达成曲线: 通关比例 @ ½/¾/满步
}
function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[idx];
}
export function runLevel(level: Level, nSeeds: number, movesOverride?: number): LevelStat {
  const moves = movesOverride ?? level.moves;
  let wins = 0, remSum = 0, stepSum = 0;
  const scores: number[] = [], winScores: number[] = [], stepsWon: number[] = [];
  const winSteps: number[] = []; // 每个通关 seed 的达成步(供目标达成曲线)
  for (let i = 0; i < nSeeds; i++) {
    const r = playLevel(level, level.seed + i, movesOverride);
    if (r.win) { wins += 1; remSum += r.remaining; winScores.push(r.score); stepsWon.push(r.stepsToWin); winSteps.push(r.stepsToWin); }
    scores.push(r.score);
    stepSum += r.stepsToWin;
  }
  scores.sort((a, b) => a - b);
  winScores.sort((a, b) => a - b);
  stepsWon.sort((a, b) => a - b);
  const compAt = (frac: number) => winSteps.filter((s) => s <= Math.round(frac * moves)).length / nSeeds;
  return {
    no: level.no,
    winRate: wins / nSeeds,
    avgRemaining: wins ? remSum / wins : 0,
    avgStepsToWin: stepSum / nSeeds,
    scoreP50: percentile(winScores.length ? winScores : scores, 0.50),
    scoreP85: percentile(winScores.length ? winScores : scores, 0.85),
    stepsP50: percentile(stepsWon.length ? stepsWon : [level.moves], 0.50),
    comp: [compAt(0.5), compAt(0.75), compAt(1.0)],
  };
}

// 教学关特殊棋子必现核验(= level-schema §三): 前 kMoves 步内是否生成期望特殊棋子。返回命中比例。
export function verifyTeaching(level: Level, expected: number[], nSeeds: number, kMoves: number): number {
  let hit = 0;
  for (let i = 0; i < nSeeds; i++) {
    let seen = false;
    playLevel(level, level.seed + i, level.moves, (r, moveNo) => {
      if (!seen && moveNo <= kMoves && r.spawned.some((s) => expected.includes(s))) seen = true;
    });
    if (seen) hit++;
  }
  return hit / nSeeds;
}

// ── I/O ─────────────────────────────────────────────────────────────────────
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
export const LEVELS_PATH = resolve(ROOT, 'docs/design/game-t/levels.jsonc');
export const REPORT_PATH = resolve(ROOT, 'docs/design/game-t/balance-report.md');

export function loadLevels(path = LEVELS_PATH): Level[] {
  const raw = readFileSync(path, 'utf8');
  const noComments = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return JSON.parse(noComments) as Level[];
}

// ── 目标带 (= GDD §四) ──────────────────────────────────────────────────────
export function bandFor(no: number): [number, number, string] {
  // = GDD §四通关率目标带: 教学段 ≥90%(floor·无上限) / 中段 70-85% / 后段 55-70%。
  if (no <= 6) return [0.90, 1.00, '虎·教学 ≥90%'];    // 虎章(基础)
  if (no <= 18) return [0.70, 0.85, '鹤蛇·中段 70-85%']; // 鹤(收集)+蛇(洗墨)
  return [0.55, 0.70, '豹龙·后段 55-70%'];              // 豹(破瓷)+龙(混合)
}

function fmtPct(x: number): string { return (x * 100).toFixed(1) + '%'; }

// 教学关 → 期望生成的特殊棋子 (= gdd §三): 关3 四连=卷轴(条纹)·关7 L/T=朱印(包装)·关12 五连=太极(彩球)。
const TEACHING: { no: number; expect: number[]; label: string }[] = [
  { no: 3, expect: [STRIPED_H, STRIPED_V], label: '卷轴珠(4 连)' },
  { no: 7, expect: [WRAPPED], label: '朱印珠(L/T)' },
  { no: 12, expect: [COLORBOMB], label: '太极丸(5 连)' },
];
const TEACH_SEEDS = 100, TEACH_KMOVES = 6;

function writeReport(levels: Level[], stats: LevelStat[], nSeeds: number): void {
  const L: string[] = [];
  L.push('# game-t《墨消》· Balance-Sim 平衡校验报告');
  L.push('');
  L.push(`> 数据源 \`docs/design/game-t/levels.jsonc\`(${levels.length} 关) · 确定性 bot × ${nSeeds} seeds/关 · 引擎纯函数复用(零漂移·见 conformance.test)。`);
  L.push('> 计分 = GDD §四(单格60·连锁×1.5·收笔剩步×1000)。目标带 = GDD §四。');
  L.push('');
  const chapters = ['虎(基础)', '鹤(收集)', '蛇(洗墨)', '豹(破瓷)', '龙(混合)'];
  L.push('## 1. 逐关校验表');
  L.push('');
  L.push('| # | 章 | 型 | 步 | 目标 | 通关率 | 目标带 | 带内 | 平均剩步 | 中位步 | 分P50 | 分P85(→3★) |');
  L.push('|--:|:--:|:--:|--:|------|:--:|:--:|:--:|:--:|:--:|--:|--:|');
  let inBand = 0;
  for (const lv of levels) {
    const st = stats.find((s) => s.no === lv.no)!;
    const [lo, hi, label] = bandFor(lv.no);
    const ok = st.winRate >= lo - 0.001 && st.winRate <= hi + 0.001;
    if (ok) inBand += 1;
    const ch = chapters[Math.floor((lv.no - 1) / 6)];
    const goal = lv.goals.map((g) => g.kind === 'collect' ? `collect#${g.color}×${g.n}` : g.kind === 'score' ? `score${g.n}` : g.kind).join('+');
    L.push(`| ${lv.no} | ${ch} | ${lv.type} | ${lv.moves} | ${goal} | ${fmtPct(st.winRate)} | ${(lo*100)|0}-${(hi*100)|0}% | ${ok ? '✅' : '⚠️'} | ${st.avgRemaining.toFixed(1)} | ${st.stepsP50} | ${Math.round(st.scoreP50)} | ${Math.round(st.scoreP85)} |`);
  }
  L.push('');
  L.push(`**带内 ${inBand}/${levels.length} 关。**`);
  L.push('');
  L.push('## 2. 难度曲线 (实测通关率)');
  L.push('');
  L.push('```');
  for (const lv of levels) {
    const st = stats.find((s) => s.no === lv.no)!;
    const n = Math.round(st.winRate * 20);
    const gate = (lv.no % 6 === 0) ? ' ◄ 师父考验' : '';
    L.push(`${String(lv.no).padStart(2)} ${'█'.repeat(n)}${'·'.repeat(20 - n)} ${fmtPct(st.winRate).padStart(6)}${gate}`);
  }
  L.push('```');
  L.push('');
  L.push('## 3. 新手漏斗 (含重试·每失败流失 8%)');
  L.push('');
  L.push('```');
  let surv = 1.0;
  const c = 0.08;
  for (const lv of levels) {
    const st = stats.find((s) => s.no === lv.no)!;
    const w = st.winRate;
    const pass = w / (1 - (1 - w) * (1 - c));
    const attempts = 1 / (1 - (1 - w) * (1 - c));
    const n = Math.round(surv * 20);
    L.push(`${String(lv.no).padStart(2)} ${'█'.repeat(n)}${'·'.repeat(20 - n)} ${fmtPct(surv).padStart(6)}  尝试${attempts.toFixed(1)}x`);
    surv *= pass;
  }
  L.push('```');
  L.push(`> World 1 通关留存(重试模型): **${fmtPct(surv)}**`);
  L.push('');

  L.push('## 4. 目标达成曲线 (通关比例 @ ½ / ¾ / 满步)');
  L.push('');
  L.push('```');
  for (const lv of levels) {
    const st = stats.find((s) => s.no === lv.no)!;
    L.push(`${String(lv.no).padStart(2)} ½${fmtPct(st.comp[0]).padStart(6)}  ¾${fmtPct(st.comp[1]).padStart(6)}  满${fmtPct(st.comp[2]).padStart(6)}`);
  }
  L.push('```');
  L.push('> 曲线陡=玩家集中在末几步惊险通关; 平=前段即达标(可收紧 moves/加量)。');
  L.push('');

  L.push('## 5. 教学关特殊棋子必现核验 (前 ' + TEACH_KMOVES + ' 步内·bot× ' + TEACH_SEEDS + ' seeds)');
  L.push('');
  L.push('| 关 | 教学目标 | 必现率 | 判定 |');
  L.push('|--:|------|:--:|:--:|');
  for (const tc of TEACHING) {
    const lv = levels.find((l) => l.no === tc.no);
    if (!lv) continue;
    const rate = verifyTeaching(lv, tc.expect, TEACH_SEEDS, TEACH_KMOVES);
    L.push(`| ${tc.no} | ${tc.label} | ${fmtPct(rate)} | ${rate >= 0.85 ? '✅' : '⚠️ 需人工核验摆盘'} |`);
  }
  L.push('> 摆盘「破 N」定色格保证前几步一次交换即成对应特殊棋子(bot 中位玩家多数首步即取·余数稍后凑出); <85% 提示需强化摆盘。');
  L.push('');
  L.push(`_报告由 \`scripts/game-t-balance-sim.run.ts --report\` 生成 · N=${nSeeds}/关 · 关卡表变更须重跑。_`);
  writeFileSync(REPORT_PATH, L.join('\n') + '\n');
}

// ── CLI ─────────────────────────────────────────────────────────────────────
function argNum(name: string, def: number): number {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.split('=')[1]) : def;
}
export function runCLI(): void {
  const nSeeds = argNum('seeds', 200);
  const only = argNum('level', 0);
  const doReport = process.argv.includes('--report');
  const levels = loadLevels().filter((lv) => !only || lv.no === only);
  console.log(`\n=== 《墨消》balance-sim ===  关=${levels.length}  seeds/关=${nSeeds}\n`);
  console.log(' #  型          步  通关率   带      平均剩步  分P50   分P85');
  const stats: LevelStat[] = [];
  let inBand = 0, total = 0;
  for (const lv of levels) {
    const st = runLevel(lv, nSeeds);
    stats.push(st);
    const [lo, hi] = bandFor(lv.no);
    const ok = st.winRate >= lo - 0.001 && st.winRate <= hi + 0.001;
    total += 1; if (ok) inBand += 1;
    console.log(
      `${String(lv.no).padStart(2)}  ${lv.type.padEnd(10)}  ${String(lv.moves).padStart(2)}  ` +
      `${fmtPct(st.winRate).padStart(6)}  ${(lo*100)|0}-${(hi*100)|0}%  ${ok ? '✅' : '⚠️'}   ` +
      `${st.avgRemaining.toFixed(1).padStart(4)}    ${String(Math.round(st.scoreP50)).padStart(6)}  ${String(Math.round(st.scoreP85)).padStart(6)}`,
    );
  }
  console.log(`\n带内 ${inBand}/${total} 关。`);
  if (doReport && !only) { writeReport(levels, stats, nSeeds); console.log(`报告 → ${REPORT_PATH}`); }
}

// 入口在 scripts/game-t-balance-sim.run.ts（vite-node 会吃掉脚本路径参数，故用独立 .run 入口·= 仓库 demo.run.ts 约定）。
