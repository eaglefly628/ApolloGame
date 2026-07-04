#!/usr/bin/env node
// 游戏能力接入审计（owner 2026-07-02 立项：防 game-d 式绕引擎）
// 用法：node scripts/game-skill-audit.mjs [game-d game-g ...]（缺省=全部游戏）
// 体检输出每个游戏的引擎能力接入面 + 分层旗标，末行判词 token + 退出码可接门禁。
//
// 分层（REQ-QA-测试审计强化三件 · 主程 spec 2026-07-04）：
//   🔴 红 = 已破不变量（游戏层红线，CLAUDE.md「游戏能力总览铁律」）：
//        裸 Math.random（须用引擎种子 PRNG）· innerHTML · document.createElement（手写 DOM，须走 LayoutNode）。
//   🟡 黄 = 缺失防线（未破线但少了护栏）：零能力接入（绕开 capabilities 体系）· 零测试。
//   ⚠ 建议 = 非红线的迁移提示（bg 裸色串→色库）：只提示、不进判词、不改退出码。
//   判词：任一红 → FAIL（退出码 1）；无红有黄 → WARNINGS（退出码 0）；全清 → PASS（退出码 0）。
//
// 「自写解释器 / 虚胖数据」（数据表 + 游戏层自写解释器）也属红类，但**无法可靠 regex 检测**
//   （合法的小枚举 switch 与真·绕引擎解释器难以机械区分，见 game-e/jokers.ts 的经济结算 switch）——
//   它是 capability-plan 评审的人审项（CORE RULE §2），本工具不臆造，故不列入自动红旗以免误报。

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const GAMES_DIR = 'src/games';
const wanted = process.argv.slice(2);

// 历史遗留：个别游戏入口在 src/ 根目录而非 src/games/<g>/，不补上会审出「假干净」
const EXTRA_FILES = { 'game-e': ['src/game-e.tsx'] };

/** 递归收集 .ts/.tsx 文件（跳过 doc/refcode 等非代码目录） */
function collect(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (['doc', 'docs', 'refcode', 'assets'].includes(name)) continue;
      collect(p, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

/** 单游戏审计 */
function audit(game) {
  const dir = join(GAMES_DIR, game);
  const files = collect(dir);
  for (const extra of EXTRA_FILES[game] ?? []) {
    try { statSync(extra); files.push(extra); } catch { /* 入口已迁走则忽略 */ }
  }
  const src = files.filter((f) => !/\.test\.ts$/.test(f));
  const tests = files.filter((f) => /\.test\.ts$/.test(f));

  let loc = 0;
  const capImports = new Set(); // 引擎能力/原子导入源
  const flags = { mathRandom: [], innerHTML: [], createElement: [], nakedFill: [], zeroCap: false };
  let usesWorldOrManifest = 0;

  for (const f of src) {
    const text = readFileSync(f, 'utf8');
    const lines = text.split('\n');
    loc += lines.length;

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      // 能力接入面：skills / atoms 的 import（含别名与相对路径）
      const im = ln.match(/from\s+['"]([^'"]*(?:@atom-skills|@skills|\/skills\/)[^'"]*)['"]/);
      if (im) capImports.add(im[1].replace(/^.*\/skills\//, 'skills/'));
      if (/\b(parseManifest|WorldBlueprint|createWorld|new World\b)/.test(ln)) usesWorldOrManifest++;
      // 红旗（游戏层禁区）
      if (/\bMath\.random\s*\(/.test(ln)) flags.mathRandom.push(`${f}:${i + 1}`);
      if (/\binnerHTML\b/.test(ln)) flags.innerHTML.push(`${f}:${i + 1}`);
      if (/document\.createElement/.test(ln)) flags.createElement.push(`${f}:${i + 1}`);
      // ⚠ 色库化建议（非红线·phase-1）：bg 裸 hex/gradient/url 串 → 应迁 SurfaceToken/FillPreset/{custom}（owner 2026-07-04）
      if (/\bbg:\s*['"](#[0-9a-fA-F]|linear-gradient|radial-gradient|url\()/.test(ln)) flags.nakedFill.push(`${f}:${i + 1}`);
    }
  }
  flags.zeroCap = capImports.size === 0;

  return { game, files: src.length, loc, tests: tests.length, capImports, usesWorldOrManifest, flags };
}

const games = readdirSync(GAMES_DIR).filter((g) => {
  try {
    return statSync(join(GAMES_DIR, g)).isDirectory() && (wanted.length === 0 || wanted.includes(g));
  } catch {
    return false;
  }
});

const rows = games.map(audit);

// ── 分层：每行按红/黄/建议归类 ──
/** 红旗（已破不变量·进判词）文字列表 */
function redBits(r) {
  const bits = [];
  if (r.flags.mathRandom.length) bits.push(`裸Math.random×${r.flags.mathRandom.length}`);
  if (r.flags.innerHTML.length) bits.push(`innerHTML×${r.flags.innerHTML.length}`);
  if (r.flags.createElement.length) bits.push(`createElement×${r.flags.createElement.length}`);
  return bits;
}
/** 黄旗（缺失防线·进判词）文字列表 */
function yellowBits(r) {
  const bits = [];
  if (r.flags.zeroCap) bits.push('零能力接入');
  if (r.tests === 0) bits.push('零测试');
  return bits;
}
/** ⚠ 建议（非红线·不进判词）文字列表 */
function adviceBits(r) {
  const bits = [];
  if (r.flags.nakedFill.length) bits.push(`裸bg色×${r.flags.nakedFill.length}`);
  return bits;
}
const anyRed = rows.some((r) => redBits(r).length);
const anyYellow = rows.some((r) => yellowBits(r).length);

// ── 汇总表 ──
const pad = (s, n) => String(s).padEnd(n);
console.log('\n══ 游戏能力接入审计 ══\n');
console.log(
  pad('game', 10) + pad('代码行', 8) + pad('测试文件', 9) + pad('能力导入源', 11) + pad('World/manifest', 15) + '旗标'
);
for (const r of rows) {
  const red = redBits(r);
  const yellow = yellowBits(r);
  const advice = adviceBits(r);
  const cells = [];
  if (red.length) cells.push('🔴 ' + red.join('·'));
  if (yellow.length) cells.push('🟡 ' + yellow.join('·'));
  if (advice.length) cells.push('⚠ ' + advice.join('·'));
  console.log(
    pad(r.game, 10) +
      pad(r.loc, 8) +
      pad(r.tests, 9) +
      pad(r.capImports.size, 11) +
      pad(r.usesWorldOrManifest, 15) +
      (cells.length ? cells.join('  ') : '—')
  );
}

// ── 明细（有任一旗标的游戏） ──
for (const r of rows) {
  const { mathRandom, innerHTML, createElement, nakedFill } = r.flags;
  const redDetails = [
    ['🔴 裸 Math.random（应用引擎种子 PRNG）', mathRandom],
    ['🔴 innerHTML（应走 LayoutNode/mountUI）', innerHTML],
    ['🔴 document.createElement（手写 DOM，应走 LayoutNode）', createElement],
  ].filter(([, v]) => v.length);
  const adviceDetails = [
    ['⚠ bg 裸色串（建议迁 SurfaceToken/FillPreset/{custom}·非红线）', nakedFill],
  ].filter(([, v]) => v.length);
  if (!redDetails.length && !adviceDetails.length && !yellowBits(r).length) continue;
  console.log(`\n── ${r.game} 明细 ──`);
  for (const [label, hits] of redDetails) {
    console.log(`  · ${label}:`);
    for (const h of hits.slice(0, 8)) console.log(`      ${h}`);
    if (hits.length > 8) console.log(`      …共 ${hits.length} 处`);
  }
  if (r.flags.zeroCap) console.log('  · 🟡 零引擎能力接入（capabilities 体系被完全绕过）');
  if (r.tests === 0) console.log('  · 🟡 零测试（该游戏无 *.test.ts 防线）');
  for (const [label, hits] of adviceDetails) {
    console.log(`  · ${label}:`);
    for (const h of hits.slice(0, 8)) console.log(`      ${h}`);
    if (hits.length > 8) console.log(`      …共 ${hits.length} 处`);
  }
  if (r.capImports.size) console.log('  · 能力导入源: ' + [...r.capImports].slice(0, 10).join(', '));
}

// ── 分层收口 ──
console.log('\n── 分层汇总 ──');
const redGames = rows.filter((r) => redBits(r).length);
const yellowGames = rows.filter((r) => !redBits(r).length && yellowBits(r).length);
if (redGames.length) {
  console.log('  🔴 已破不变量: ' + redGames.map((r) => `${r.game}(${redBits(r).join(',')})`).join('  '));
} else {
  console.log('  🔴 已破不变量: 无');
}
if (yellowGames.length) {
  console.log('  🟡 缺失防线: ' + yellowGames.map((r) => `${r.game}(${yellowBits(r).join(',')})`).join('  '));
} else {
  console.log('  🟡 缺失防线: 无');
}
const adviceGames = rows.filter((r) => adviceBits(r).length);
if (adviceGames.length) {
  console.log('  ⚠ 建议(非判词): ' + adviceGames.map((r) => `${r.game}(${adviceBits(r).join(',')})`).join('  '));
}

// ── 判词 token + 退出码（⚠ 建议不参与） ──
const verdict = anyRed ? 'FAIL' : anyYellow ? 'WARNINGS' : 'PASS';
console.log(`\nAUDIT: ${verdict}`);
process.exit(anyRed ? 1 : 0);
