#!/usr/bin/env node
// 游戏能力接入审计（owner 2026-07-02 立项：防 game-d 式绕引擎）
// 用法：node scripts/game-skill-audit.mjs [game-d game-g ...]（缺省=全部游戏）
// 体检不是闸门（v1 报告版）：输出每个游戏的引擎能力接入面 + 红旗（裸随机/手写DOM/零能力）。
// 红旗定义与 CLAUDE.md「游戏能力总览铁律」对应；后续可加 --strict 进门禁。

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
  const flags = { mathRandom: [], innerHTML: [], createElement: [], zeroCap: false };
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

// ── 汇总表 ──
const pad = (s, n) => String(s).padEnd(n);
console.log('\n══ 游戏能力接入审计 ══\n');
console.log(
  pad('game', 10) + pad('代码行', 8) + pad('测试文件', 9) + pad('能力导入源', 11) + pad('World/manifest', 15) + '红旗'
);
for (const r of rows) {
  const flagBits = [];
  if (r.flags.zeroCap) flagBits.push('零能力接入');
  if (r.flags.mathRandom.length) flagBits.push(`裸Math.random×${r.flags.mathRandom.length}`);
  if (r.flags.innerHTML.length) flagBits.push(`innerHTML×${r.flags.innerHTML.length}`);
  if (r.flags.createElement.length) flagBits.push(`createElement×${r.flags.createElement.length}`);
  if (r.tests === 0) flagBits.push('零测试');
  console.log(
    pad(r.game, 10) +
      pad(r.loc, 8) +
      pad(r.tests, 9) +
      pad(r.capImports.size, 11) +
      pad(r.usesWorldOrManifest, 15) +
      (flagBits.length ? '🚩 ' + flagBits.join('·') : '—')
  );
}

// ── 明细（仅有红旗的游戏） ──
for (const r of rows) {
  const { mathRandom, innerHTML, createElement } = r.flags;
  const details = [
    ['裸 Math.random（应用引擎种子 PRNG）', mathRandom],
    ['innerHTML（应走 LayoutNode/mountUI）', innerHTML],
    ['document.createElement', createElement],
  ].filter(([, v]) => v.length);
  if (!details.length && !r.flags.zeroCap) continue;
  console.log(`\n── ${r.game} 明细 ──`);
  if (r.flags.zeroCap) console.log('  · 零引擎能力接入（capabilities 体系被完全绕过）');
  for (const [label, hits] of details) {
    console.log(`  · ${label}:`);
    for (const h of hits.slice(0, 8)) console.log(`      ${h}`);
    if (hits.length > 8) console.log(`      …共 ${hits.length} 处`);
  }
  if (r.capImports.size) console.log('  · 能力导入源: ' + [...r.capImports].slice(0, 10).join(', '));
}
console.log();
