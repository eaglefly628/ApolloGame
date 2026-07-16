#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/context-budget-guard.mjs —— 上下文预算守卫（REQ-CTX·owner 2026-07-15 批①②）
//
//  owner 担忧：信息量越来越大，新 session 的上下文读不完 → 偏离。实测（2026-07-15）：
//  T0 必读集健康（~2 万字符），真炸弹=requests.md 曾胖到 23 万字符（done 回执不归档）。
//  本守卫把「读得完」变成机器保证的预算：
//    · 需求池 requests.md ≤ 封顶（超=红·逼「done 全文进 archive·池只留活跃」的归档纪律）
//    · T0 必读集（CLAUDE.md/宪法/llm-onboarding）各自封顶（想变厚=显式改基线·diff 可见）
//    · 每本线手册 ≤80 行（原为君子约定·从此机器卡）
//  判词 token：`CONTEXT-BUDGET: PASS|FAIL`（照 docs-ref-guard 模式·退出码进门禁）。
//  基线=scripts/context-budget-baseline.json；抬预算唯一合法姿势=同提交改基线（review 一眼可见）。
// ═══════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts', 'context-budget-baseline.json');

/** 纯检查核（导出供单测）：给定实测值与预算 → 问题列表（空=过）。 */
export function checkBudget(actual, budget) {
  const issues = [];
  if (actual.requestsChars > budget.requestsPoolMaxChars) {
    issues.push(`requests.md ${actual.requestsChars} 字符 > 封顶 ${budget.requestsPoolMaxChars}——done 条目全文迁 requests-archive.md（池只留活跃·归档纪律）`);
  }
  for (const [file, max] of Object.entries(budget.t0MaxChars)) {
    const got = actual.t0Chars[file];
    if (got === undefined) issues.push(`T0 必读缺文件: ${file}（改名/删除须同步基线）`);
    else if (got > max) issues.push(`${file} ${got} 字符 > 封顶 ${max}——T0 必读集变厚须显式改基线（scripts/context-budget-baseline.json）`);
  }
  for (const [file, lines] of Object.entries(actual.playbookLines)) {
    if (lines > budget.playbookMaxLines) {
      issues.push(`${file} ${lines} 行 > ${budget.playbookMaxLines} 行——手册铁律（≤80 行·弱模型也读得完）·瘦身或拆册`);
    }
  }
  return issues;
}

function measure() {
  const chars = (p) => readFileSync(join(ROOT, p), 'utf8').length;
  const linesOf = (p) => readFileSync(join(ROOT, p), 'utf8').split('\n').length;
  const t0Chars = {};
  const budget = JSON.parse(readFileSync(BASELINE, 'utf8'));
  for (const f of Object.keys(budget.t0MaxChars)) {
    try { t0Chars[f] = chars(f); } catch { /* 缺文件 → checkBudget 点名 */ }
  }
  const playbookLines = {};
  for (const f of readdirSync(join(ROOT, 'docs', 'playbooks'))) {
    if (f.endsWith('.md')) playbookLines[`docs/playbooks/${f}`] = linesOf(`docs/playbooks/${f}`);
  }
  return { budget, actual: { requestsChars: chars('docs/workflow/requests.md'), t0Chars, playbookLines } };
}

function main() {
  const { budget, actual } = measure();
  const issues = checkBudget(actual, budget);
  const out = [
    `[context-budget] requests.md ${actual.requestsChars}/${budget.requestsPoolMaxChars} 字符 · T0 ${Object.keys(budget.t0MaxChars).length} 文件 · 手册 ${Object.keys(actual.playbookLines).length} 本（≤${budget.playbookMaxLines} 行）`,
  ];
  for (const i of issues) out.push(`  ✗ ${i}`);
  if (!issues.length) out.push('  ✓ 全部在预算内（新 session 读得完）');
  out.push(`CONTEXT-BUDGET: ${issues.length ? 'FAIL' : 'PASS'}`);
  process.stdout.write(out.join('\n') + '\n');
  process.exit(issues.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
