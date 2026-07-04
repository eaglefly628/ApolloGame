#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  测试代码体检（REQ-QA-测试审计强化三件 · 主程 spec 2026-07-04）
//
//  准则出处：docs/playbooks/testing.md 红线「测试代码三禁」——
//    ① 真时间等待（墙钟 setTimeout/setInterval/sleep/Date.now/performance.now）
//    ② 外部 IO 直连（真 fetch/http/https/net/WebSocket/createServer）
//    ③ 裸 Math.random（无种子随机）
//  合法替代：fake timers（vi.useFakeTimers）、mock（stub 掉 fetch）、注入种子 PRNG。
//
//  用法：node scripts/test-hygiene-check.mjs [--list]
//  收口：末行判词 `HYGIENE: PASS|WARNINGS|FAIL`；退出码 硬违规=1、其余=0。
//    FAIL     = 有「未白名单、未自动豁免」的硬违规（新引入的三禁）。
//    WARNINGS = 只剩「白名单放行」的有意例外（如故意非确定的 flaky capability 测试）——surfaced 供周期复审。
//    PASS     = 零命中。
//
//  自动豁免（合法用例，不算违规）：
//    · 文件含 `vi.useFakeTimers` → 该文件的时间等待类命中放行（假时钟受控）。
//    · 文件 stub/mock 掉 fetch（stubGlobal('fetch' / fetch= / vi.mock）→ 该文件 fetch 命中放行。
// ═══════════════════════════════════════════════════════════════

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';

// ── 白名单（有意的合法例外，注明理由）──────────────────────────────
// 每条 = { file: 路径子串, rule: 规则 id, reason: 为何放行 }。命中→WARNINGS（不阻断），不算硬违规。
const WHITELIST = [
  {
    file: 'src/debug/debug.test.ts',
    rule: 'naked-random',
    reason: '故意非确定的 test-flaky capability——被测对象本身就是「用 Math.random 制造非确定」，' +
      '用来验证 Recorder 能抓到非确定性回放。换种子=去掉被测特性，故有意保留。',
  },
];

// ── 三禁规则 ────────────────────────────────────────────────────
const RULES = [
  {
    id: 'time-wait',
    label: '真时间等待（墙钟 setTimeout/setInterval/sleep/Date.now/performance.now）',
    patterns: [
      /\bsetTimeout\s*\(/,
      /\bsetInterval\s*\(/,
      /\bsleep\s*\(/,
      /\bDate\.now\s*\(/,
      /\bperformance\.now\s*\(/,
    ],
    // 文件用 fake timers → 时间等待受控，放行整文件。
    fileExempt: (text) => /vi\.useFakeTimers/.test(text),
  },
  {
    id: 'external-io',
    label: '外部 IO 直连（真 fetch/http/https/net/WebSocket/createServer）',
    patterns: [
      /\bfetch\s*\(/,
      /\bXMLHttpRequest\b/,
      /\bnew\s+WebSocket\b/,
      /\bcreateServer\s*\(/,
      /\.listen\s*\(/,
      /from\s+['"](?:node:)?(?:http|https|net|dgram|tls)['"]/,
      /require\(\s*['"](?:node:)?(?:http|https|net|dgram|tls)['"]\s*\)/,
    ],
    // 文件 stub/mock 掉 fetch → fetch 受控，放行整文件的 fetch 命中。
    fileExempt: (text) =>
      /fetch\s*=|stubGlobal\(\s*['"]fetch|vi\.mock\s*\(|createFetchMock|mockFetch|fakeFetch/i.test(text),
  },
  {
    id: 'naked-random',
    label: '裸 Math.random（无种子随机，应注入引擎种子 PRNG）',
    patterns: [/\bMath\.random\s*\(/],
    fileExempt: () => false,
  },
];

/** 递归收集 src 下所有 *.test.ts。 */
function collectTests(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      if (['node_modules', 'doc', 'docs', 'refcode', 'assets'].includes(name)) continue;
      collectTests(p, out);
    } else if (/\.test\.ts$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

/** 该行的匹配是否落在 `//` 行注释里（排除注释误报，如「原为 Math.random」解释文字）。 */
function inLineComment(line, matchIdx) {
  const c = line.indexOf('//');
  return c !== -1 && c < matchIdx;
}

function isWhitelisted(file, ruleId) {
  return WHITELIST.find((w) => file.includes(w.file) && w.rule === ruleId);
}

const files = collectTests(ROOT).sort();
const hard = []; // 硬违规 { file, line, ruleId, code }
const waived = []; // 白名单放行 { file, line, ruleId, code, reason }
const exempted = []; // 自动豁免（fake timers / mock）——仅统计，不输出为问题

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  for (const rule of RULES) {
    const fileExempt = rule.fileExempt(text);
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      for (const re of rule.patterns) {
        const m = ln.match(re);
        if (!m) continue;
        if (inLineComment(ln, m.index ?? 0)) continue;
        const hit = { file, line: i + 1, ruleId: rule.id, code: ln.trim().slice(0, 120) };
        if (fileExempt) {
          exempted.push(hit);
        } else {
          const w = isWhitelisted(file, rule.id);
          if (w) waived.push({ ...hit, reason: w.reason });
          else hard.push(hit);
        }
        break; // 一行一规则计一次
      }
    }
  }
}

// ── 报告 ────────────────────────────────────────────────────────
const labelOf = (id) => RULES.find((r) => r.id === id)?.label ?? id;
console.log('\n══ 测试代码体检（三禁：真时间等待 / 外部 IO / 裸随机）══\n');
console.log(`扫描 ${files.length} 个 *.test.ts`);

if (hard.length) {
  console.log(`\n🔴 硬违规 ${hard.length} 处（未白名单·未豁免 → 修或白名单）：`);
  for (const h of hard) console.log(`  ${h.file}:${h.line}  [${h.ruleId}] ${h.code}`);
  console.log('\n  规则说明：');
  for (const id of [...new Set(hard.map((h) => h.ruleId))]) console.log(`   · ${id} = ${labelOf(id)}`);
} else {
  console.log('\n🔴 硬违规: 无');
}

if (waived.length) {
  console.log(`\n🟡 白名单放行 ${waived.length} 处（有意例外·供周期复审）：`);
  for (const w of waived) console.log(`  ${w.file}:${w.line}  [${w.ruleId}]\n      理由: ${w.reason}`);
}

if (exempted.length) {
  console.log(`\n✔ 自动豁免 ${exempted.length} 处（fake timers / mock 受控·合法）`);
}

const verdict = hard.length ? 'FAIL' : waived.length ? 'WARNINGS' : 'PASS';
console.log(`\nHYGIENE: ${verdict}`);
process.exit(hard.length ? 1 : 0);
