// scripts/game-t-levels.gen.ts —— 《墨消》30 关关卡表「生成 + 定标」(GD 授权工具)。
//
// 意图(五章×6·= gdd §二点五) → 程序化摆盘 → 用 balance-sim 定标(= level-schema §二.3):
//   ① moves = 「bot 中位所需步 × 裕度」(裕度随章 1.4→1.1·GDD §四) → clamp[15,40];
//   ② 目标量级(分数目标 / 收集数 / 墨渍格数 / 冰纹瓷格数 / 混合缩放) 自动调至通关率落 GDD §四目标带
//      (常规取带中点·师父考验关取带下沿 spike·机制引入关取上沿);
//   ③ stars = 通关分布 (1★ 达标线 / 2★ P50 / 3★ P85)。
// 输出 docs/design/game-t/levels.jsonc。
//
// 用法: npx vite-node scripts/game-t-levels.gen.ts [--fast]

import { writeFileSync } from 'node:fs';
import { playLevel, runLevel, bandFor, LEVELS_PATH, type Level, type Goal } from './game-t-balance-sim.js';

const FAST = process.argv.includes('--fast');
const CAL_SEEDS = FAST ? 30 : 120;   // 校准 seeds (越大越贴近 200-seed 复核)
const STAR_SEEDS = FAST ? 40 : 150;
const HIGH_MOVES = 55;

// ── 摆盘助手 ────────────────────────────────────────────────────────────────
const blank = (cols: number, rows: number) => Array.from({ length: rows }, () => '.'.repeat(cols));
function layer(cols: number, rows: number, f: (c: number, r: number) => string): string[] {
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => f(c, r)).join(''));
}
function overlay(a: string[], b: string[]): string[] {
  return a.map((row, r) => row.split('').map((ch, c) => (b[r][c] !== '.' ? b[r][c] : ch)).join(''));
}
// 「一交换即成 N/LT」教学摆盘(无初始连线·定色·bot 首步会取): 交换 (r,c+2) 与相邻定色格即生特殊棋子。
// teach4: 破 4→卷轴; teachT: 破 T→朱印; teach5: 破 5→太极。col 用目标色时收益翻倍(bot 必取)。
function teach4(cols: number, rows: number, r: number, c: number, col: string): string[] {
  return layer(cols, rows, (cc, rr) => ((rr === r && [c, c + 1, c + 3].includes(cc)) || (rr === r + 1 && cc === c + 2)) ? col : '.');
}
function teachT(cols: number, rows: number, r: number, c: number, col: string): string[] {
  return layer(cols, rows, (cc, rr) => ((rr === r && [c, c + 1, c + 3].includes(cc)) || (cc === c + 2 && (rr === r - 1 || rr === r + 1))) ? col : '.');
}
function teach5(cols: number, rows: number, r: number, c: number, col: string): string[] {
  return layer(cols, rows, (cc, rr) => ((rr === r && [c, c + 1, c + 3, c + 4].includes(cc)) || (rr === r + 1 && cc === c + 2)) ? col : '.');
}
// 格排序: 中心向外(墨渍) / 自顶向下(冰纹瓷)。
function centerOutOrder(cols: number, rows: number): number[] {
  const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
  return [...Array(cols * rows).keys()].sort((a, b) => {
    const ax = Math.abs((a % cols) - cx), ay = Math.abs(Math.floor(a / cols) - cy);
    const bx = Math.abs((b % cols) - cx), by = Math.abs(Math.floor(b / cols) - cy);
    return (Math.max(ax, ay) - Math.max(bx, by)) || (ax + ay - bx - by) || (a - b);
  });
}
function topRowsOrder(cols: number, rows: number): number[] {
  const cx = (cols - 1) / 2;
  return [...Array(cols * rows).keys()].sort((a, b) => {
    const ra = Math.floor(a / cols), rb = Math.floor(b / cols);
    return (ra - rb) || (Math.abs((a % cols) - cx) - Math.abs((b % cols) - cx)) || (a - b);
  });
}
// 墨渍层: 中心向外取 count 格 '1'，内 doubleFrac 比例升 '2'; skip=已占格(冰纹瓷等)。
function jellyCells(cols: number, rows: number, count: number, doubleFrac: number, skip?: Set<number>, region?: (c: number, r: number) => boolean): string[] {
  const g = new Array(cols * rows).fill('.');
  const order = centerOutOrder(cols, rows).filter((i) => !skip?.has(i) && (!region || region(i % cols, Math.floor(i / cols))));
  const take = order.slice(0, count);
  for (const i of take) g[i] = '1';
  for (const i of take.slice(0, Math.round(count * doubleFrac))) g[i] = '2';
  return layer(cols, rows, (c, r) => g[r * cols + c]);
}
// 冰纹瓷层: 自顶向下取 count 格填 hp; skip; region。
function iceCells(cols: number, rows: number, count: number, hp: string, region?: (c: number, r: number) => boolean): string[] {
  const g = new Array(cols * rows).fill('.');
  const order = topRowsOrder(cols, rows).filter((i) => !region || region(i % cols, Math.floor(i / cols)));
  for (const i of order.slice(0, count)) g[i] = hp;
  return layer(cols, rows, (c, r) => g[r * cols + c]);
}
const idxSet = (rowsArr: string[], cols: number, pred: (ch: string) => boolean): Set<number> => {
  const s = new Set<number>();
  rowsArr.forEach((row, r) => row.split('').forEach((ch, c) => { if (pred(ch)) s.add(r * cols + c); }));
  return s;
};

// ── 意图表 (五章×6) ─────────────────────────────────────────────────────────
type MechType = Level['type'];
interface Intent {
  no: number; chapter: number; type: MechType;
  cols: number; rows: number; kinds: number;
  color?: number;          // collect 色
  hp?: string;             // blocker hp 字符
  stones?: string[];       // 砚石层(固定·不计目标)
  board?: string[];        // 教学摆盘
  d0: number;              // 名义难度量级(分数目标 / 收集数 / 墨渍格 / 冰纹瓷格 / mixed 千分比)
  mixed?: { collect: { color: number; base: number }[]; jellyBase: number; blockerBase: number; hp: string };
  note?: string;
}
const I: Intent[] = [];
// 虎 1-6 score
const tigerT = [4500, 5500, 6500, 7500, 8500, 10000];
for (let n = 1; n <= 6; n++) {
  const board = n === 3 ? teach4(7, 8, 3, 2, '0') : undefined; // 破 4→卷轴
  I.push({ no: n, chapter: 0, type: 'score', cols: 7, rows: 8, kinds: n <= 2 ? 4 : 5, d0: tigerT[n - 1], board, note: n === 3 ? '教学：4 连生成卷轴珠(摆盘破 4)' : n === 6 ? '虎师父考验' : undefined });
}
// 鹤 7-12 collect
for (let k = 0; k < 6; k++) {
  const no = 7 + k, kinds = no <= 9 ? 5 : 6, rows = no <= 9 ? 8 : 9;
  const col = no % kinds; // 收集目标色
  let board: string[] | undefined, note: string | undefined;
  if (no === 7) { board = teachT(7, 8, 3, 1, String(col)); note = '教学：L/T 交叉生成朱印珠'; }       // 破 T→朱印(目标色)
  if (no === 12) { board = teach5(7, 9, 4, 1, String(col)); note = '教学：5 连生成太极丸 + 鹤师父考验'; } // 破 5→太极(目标色)
  I.push({ no, chapter: 1, type: 'collect', cols: 7, rows, kinds, color: col, d0: 24, board, note });
}
// 蛇 13-18 jelly
const snakeDim: [number, number][] = [[7, 8], [7, 8], [7, 9], [7, 9], [7, 9], [8, 9]];
for (let k = 0; k < 6; k++) {
  const no = 13 + k, [cols, rows] = snakeDim[k];
  I.push({ no, chapter: 2, type: 'jelly', cols, rows, kinds: no <= 15 ? 5 : 6, d0: 16, note: no === 18 ? '蛇师父考验(双层墨渍)' : no === 13 ? '教学：洗墨(消除其上洗净一层)' : undefined });
}
// 豹 19-24 blocker(冰纹瓷)
const leoDim: [number, number][] = [[7, 9], [7, 9], [7, 9], [8, 9], [8, 9], [8, 9]];
for (let k = 0; k < 6; k++) {
  const no = 19 + k, [cols, rows] = leoDim[k];
  const hp = no <= 20 ? '1' : no <= 22 ? '2' : '3';
  const stones = no >= 23 ? layer(cols, rows, (c, r) => (r === rows - 1 && (c === 0 || c === cols - 1) ? 'S' : '.')) : undefined;
  I.push({ no, chapter: 3, type: 'blocker', cols, rows, kinds: 6, hp, stones, d0: 12, note: no === 24 ? '豹师父考验(3hp 冰纹瓷+砚石)' : no === 19 ? '教学：破瓷(邻接消除震裂)' : undefined });
}
// 龙 25-30 mixed
const dragon: Intent['mixed'][] = [
  { collect: [{ color: 0, base: 18 }], jellyBase: 10, blockerBase: 0, hp: '1' },
  { collect: [], jellyBase: 0, blockerBase: 10, hp: '2' },                        // + score 目标另加
  { collect: [{ color: 3, base: 18 }], jellyBase: 14, blockerBase: 0, hp: '1' },
  { collect: [{ color: 1, base: 16 }], jellyBase: 0, blockerBase: 10, hp: '2' },
  { collect: [{ color: 2, base: 20 }, { color: 4, base: 20 }], jellyBase: 0, blockerBase: 0, hp: '1' },
  { collect: [{ color: 0, base: 20 }], jellyBase: 12, blockerBase: 8, hp: '2' },  // 全机制
];
for (let k = 0; k < 6; k++) {
  const no = 25 + k, cols = 8, rows = no === 30 ? 10 : 9;
  const stones = (no === 30) ? layer(cols, rows, (c, r) => (r === rows - 1 && (c === 0 || c === cols - 1) ? 'S' : '.')) : undefined;
  I.push({ no, chapter: 4, type: 'mixed', cols, rows, kinds: 6, stones, d0: 100, mixed: dragon[k], note: no === 30 ? '龙师父·出师试炼(全机制汇演)' : no === 25 ? '教学：混合双目标' : undefined });
}

// ── materialize: 意图 + moves + 难度量级 d → Level ───────────────────────────
const SEED_OF = (no: number) => 10007 * no;
function chapterDoubleFrac(no: number): number { return no >= 16 ? 0.4 : 0; }

function materialize(it: Intent, moves: number, d: number): Level {
  const { cols, rows } = it;
  const goals: Goal[] = [];
  let board = it.board ?? blank(cols, rows);
  let jelly: string[] | undefined, blockers: string[] | undefined;
  const stoneSet = it.stones ? idxSet(it.stones, cols, (ch) => ch === 'S') : undefined;

  if (it.type === 'score') goals.push({ kind: 'score', n: d });
  else if (it.type === 'collect') goals.push({ kind: 'collect', color: it.color!, n: d });
  else if (it.type === 'jelly') { jelly = jellyCells(cols, rows, d, chapterDoubleFrac(it.no)); goals.push({ kind: 'jelly' }); }
  else if (it.type === 'blocker') {
    blockers = iceCells(cols, rows, d, it.hp!, (c, r) => r < rows - 1); // 底行留给砚石
    if (it.stones) blockers = overlay(blockers, it.stones);
    goals.push({ kind: 'blocker' });
  } else if (it.type === 'mixed') {
    const f = d / 100, m = it.mixed!;
    // 冰纹瓷置顶两行·墨渍居中下方·互不重叠。
    if (m.blockerBase > 0) blockers = iceCells(cols, rows, Math.round(m.blockerBase * f), m.hp, (c, r) => r <= 2);
    if (it.stones) blockers = overlay(blockers ?? blank(cols, rows), it.stones);
    if (m.jellyBase > 0) {
      const skip = new Set<number>([...(stoneSet ?? []), ...(blockers ? idxSet(blockers, cols, (ch) => ch !== '.') : [])]);
      jelly = jellyCells(cols, rows, Math.round(m.jellyBase * f), 0, skip, (c, r) => r >= 4);
    }
    if (blockers) goals.push({ kind: 'blocker' });
    if (m.jellyBase > 0) goals.push({ kind: 'jelly' });
    for (const cc of m.collect) goals.push({ kind: 'collect', color: cc.color, n: Math.round(cc.base * f) });
    if (it.no === 26) goals.push({ kind: 'score', n: Math.round(9000 * f) });
  }
  return {
    no: it.no, type: it.type, cols, rows, kinds: it.kinds, moves, goals,
    stars: [1, 2, 3], seed: SEED_OF(it.no),
    layout: { board, ...(jelly ? { jelly } : {}), ...(blockers ? { blockers } : {}) },
    ...(it.note ? { note: it.note } : {}),
  };
}

// ── 定标 ────────────────────────────────────────────────────────────────────
const MARGIN = [1.4, 1.3, 1.25, 1.15, 1.1];
function targetWR(no: number): number {
  const [lo, hi] = bandFor(no), w = hi - lo;
  if (no % 6 === 0) return lo + w * 0.30;              // 师父考验: 带内偏低(spike·留噪声余量)
  if ([7, 13, 19, 25].includes(no)) return lo + w * 0.70; // 机制引入: 带内偏高
  return (lo + hi) / 2;                                // 常规: 中点
}
// bot 平均所需步(= level-schema §二.3「bot 平均所需步」·仅统计在高步数上限内通关的 seed)。
function meanStepsAtNominal(it: Intent): number {
  const lv = materialize(it, HIGH_MOVES, it.d0);
  let sum = 0, n = 0;
  for (let i = 0; i < CAL_SEEDS; i++) { const r = playLevel(lv, SEED_OF(it.no) + i, HIGH_MOVES); if (r.win) { sum += r.stepsToWin; n++; } }
  return n ? sum / n : HIGH_MOVES;
}
function wrAtD(it: Intent, moves: number, d: number): number {
  return runLevel(materialize(it, moves, d), CAL_SEEDS, moves).winRate;
}
// 二分求量级 d 使通关率≈target(通关率随 d 单调减)。
function tuneMagnitude(it: Intent, moves: number, lo: number, hi: number, target: number): number {
  const cache = new Map<number, number>();
  const wr = (d: number) => { if (!cache.has(d)) cache.set(d, wrAtD(it, moves, d)); return cache.get(d)!; };
  let L = lo, H = hi;
  while (L < H) { const mid = (L + H + 1) >> 1; if (wr(mid) >= target) L = mid; else H = mid - 1; }
  let best = L, bd = Infinity;
  for (const d of [L - 1, L, L + 1]) { if (d < lo || d > hi) continue; const e = Math.abs(wr(d) - target); if (e < bd) { bd = e; best = d; } }
  return best;
}
function tuneScoreTarget(it: Intent, moves: number, target: number): number {
  const scores: number[] = [];
  const lv = materialize(it, moves, it.d0);
  for (let i = 0; i < STAR_SEEDS; i++) scores.push(playLevel(lv, SEED_OF(it.no) + i, moves).score);
  scores.sort((a, b) => a - b);
  const q = 1 - target;
  const raw = scores[Math.min(scores.length - 1, Math.floor(q * (scores.length - 1)))] || it.d0;
  return Math.max(1000, Math.round(raw / 500) * 500);
}
function stars(it: Intent, moves: number, d: number): [number, number, number] {
  const lv = materialize(it, moves, d);
  const won: number[] = [];
  for (let i = 0; i < STAR_SEEDS; i++) { const r = playLevel(lv, SEED_OF(it.no) + i, moves); if (r.win) won.push(r.score); }
  won.sort((a, b) => a - b);
  const pc = (qq: number) => (won.length ? won[Math.min(won.length - 1, Math.floor(qq * (won.length - 1)))] : 0);
  const rnd = (x: number) => Math.max(250, Math.round(x / 250) * 250);
  const scoreGoal = lv.goals.find((g) => g.kind === 'score');
  // 1★ 须 ≥ 达标线且「通关即得」(= level-schema §一): 分数关=目标分; 目标关=最低通关分下取整(保证任一通关者≥1★)。
  const minWin = won.length ? won[0] : 0;
  let s1 = it.type === 'score' && scoreGoal ? scoreGoal.n! : Math.max(250, Math.floor(minWin / 250) * 250);
  let s2 = rnd(pc(0.50)), s3 = rnd(pc(0.85));
  s2 = Math.max(s2, s1 + 250); s3 = Math.max(s3, s2 + 250);
  return [s1, s2, s3];
}

function dRange(it: Intent): [number, number] {
  const cells = it.cols * it.rows;
  if (it.type === 'collect') return [10, 55];
  if (it.type === 'jelly') return [8, Math.floor(cells * 0.6)];
  if (it.type === 'blocker') return [4, Math.floor(cells * 0.32)];
  return [55, 210]; // mixed 千分比
}

function main(): void {
  const t0 = Date.now();
  const levels: Level[] = [];
  for (const it of I) {
    const margin = MARGIN[it.chapter];
    const moves = Math.min(40, Math.max(15, Math.round(meanStepsAtNominal(it) * margin)));
    const tgt = targetWR(it.no);
    let d: number;
    if (it.type === 'score') d = tuneScoreTarget(it, moves, tgt);
    else { const [lo, hi] = dRange(it); d = tuneMagnitude(it, moves, lo, hi, tgt); }
    const st = stars(it, moves, d);
    const lv = materialize(it, moves, d);
    lv.stars = st;
    levels.push(lv);
    const wr = runLevel(lv, CAL_SEEDS, moves).winRate;
    const [blo, bhi] = bandFor(it.no);
    const ok = wr >= blo - 0.02 && wr <= bhi + 0.02;
    console.log(`关${String(it.no).padStart(2)} ${it.type.padEnd(7)} moves=${String(moves).padStart(2)} d=${String(d).padStart(5)} 通关率=${(wr * 100).toFixed(1)}% 带${(blo * 100) | 0}-${(bhi * 100) | 0}% ${ok ? '✅' : '⚠️'} stars=[${st}]`);
  }
  const header = [
    '// docs/design/game-t/levels.jsonc —— 《墨消》30 关关卡表 (schema=level-schema.md)。',
    '// 由 scripts/game-t-levels.gen.ts 生成: 意图(五章×6) → 程序化摆盘 → balance-sim 定标。',
    '// 勿手改数值——改意图后重跑 gen；改后必跑 balance-sim 复核(balance-report.md)。',
    '',
  ].join('\n');
  writeFileSync(LEVELS_PATH, header + JSON.stringify(levels, null, 2) + '\n');
  console.log(`\n写出 ${levels.length} 关 → ${LEVELS_PATH}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
main();
