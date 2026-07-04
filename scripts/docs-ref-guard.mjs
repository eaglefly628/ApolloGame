#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/docs-ref-guard.mjs —— 文档指针守护闸门（防口径漂移）
//
//  源起 REQ-DOCS-指针守护脚本（requests.md）：角色卡/手册/QA 里对
//  路径·脚本名·agent/技能名的引用，此前靠人肉核（58 处）——固化成机器活。
//  思想承接 CCGS Skill Testing Framework「工作流零件也要可测」+ 引擎层
//  已有的 `src/assembly/registry-guard.test.ts`（capability 层同款守护）。
//
//  扫什么：docs/roles/**、docs/playbooks/**、docs/qa/** 里所有 .md 的
//          反引号（`...`）包裹引用。
//  查什么：
//    ① 路径引用——以 docs/ · src/ · scripts/ · wiki/ · .claude/ 开头的
//       token，做存在性检查。允许修饰：`path:line`、`path §x`（空格分隔）、
//       `path/**`·`scripts/foo-*.mjs` 等 glob、`src/{a,b}` 花括号、`a·b`
//       中点连写——剥掉/展开修饰再查。
//    ② agent/技能名——对照 .claude/agents/*.md（去 .md）与 .claude/skills/*/
//       目录名。裸名歧义大（`turn-combat` 等 kebab 词满地都是），故只对
//       「与某已知 agent/技能名编辑距离=1」的近似拼写报错（抓错字/改名残留），
//       精确命中静默放行；权威存在性由 ① 的 .claude/ 路径形式兜底。
//
//  白名单：模板占位符（含 < > YYYY xxx [category] 等）自动放行；另有下方
//          显式 WHITELIST 数组容纳「有意的示例/别处真相源」——每条附理由。
//
//  判词：DOCS-REF: PASS（退出码 0）/ DOCS-REF: FAIL（退出码 1）。
//        红行格式：`<file>:<line>  <ref>  → <reason>`。
//
//  纯 node/fs，无 TS import → 直接 `node scripts/docs-ref-guard.mjs` 跑。
// ═══════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 扫描根（相对 ROOT）——角色卡 / 生产线手册 / 工作流零件 QA。
// 可用 CLI 位置参数覆盖扫描目录（绝对或相对 cwd 路径）——供行为契约测试指向
// fixture 走失败路径；存在性判定与 agent/技能名仍以仓库 ROOT 为真相源。
const DEFAULT_SCAN_DIRS = ['docs/roles', 'docs/playbooks', 'docs/qa'].map((d) => path.join(ROOT, d));
const SCAN_DIRS = process.argv.slice(2).length > 0
  ? process.argv.slice(2).map((d) => path.resolve(d))
  : DEFAULT_SCAN_DIRS;

// 被判为「路径引用」的前缀（token 剥修饰后须以其一开头）。
const PATH_PREFIXES = ['docs/', 'src/', 'scripts/', 'wiki/', '.claude/'];

// ── 显式白名单：有意的示例路径 / 别处真相源，不参与存在性判定。──────────
// 每条 { ref, reason }。ref 是「剥修饰、展开后」用于比对的字符串；也可写原样
// token（两者都会被匹配）。占位符（含 < > YYYY xxx [..]）已自动放行，无需登记。
// 现状：空——当前 3 树内所有真路径引用都实指存在文件，占位符走自动规则，
// 不含格式规范外的「有意示例路径」。将来若出现（如举例引用别 repo 脚本名），
// 在此登记并注明理由。
const WHITELIST = [];
const WHITELIST_SET = new Set(WHITELIST.map((w) => w.ref));

// ── 已知 agent / 技能名（存在性真相）──────────────────────────────────
function listAgents() {
  const dir = path.join(ROOT, '.claude/agents');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
}
function listSkills() {
  const dir = path.join(ROOT, '.claude/skills');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
}
const KNOWN_NAMES = [...new Set([...listAgents(), ...listSkills()])];

// ── 工具函数 ─────────────────────────────────────────────────────────
function isPlaceholder(s) {
  // 模板占位符：尖括号、YYYY 日期占位、xxx、[方括号段]。
  return /[<>]/.test(s) || /YYYY/.test(s) || /xxx/i.test(s) || /\[[^\]]*\]/.test(s);
}

function walkMarkdown(target, out) {
  if (!fs.existsSync(target)) return;
  const st = fs.statSync(target);
  if (st.isFile()) {
    if (target.endsWith('.md')) out.push(target);
    return;
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const p = path.join(target, entry.name);
    if (entry.isDirectory()) walkMarkdown(p, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(p);
  }
}

// 花括号展开：src/{a,b}.ts → [src/a.ts, src/b.ts]（仅支持单层、逗号列表）。
function expandBraces(s) {
  const m = s.match(/^([^{]*)\{([^{}]*)\}(.*)$/);
  if (!m) return [s];
  const [, pre, body, post] = m;
  const parts = body.split(',').map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const part of parts) for (const tail of expandBraces(pre + part + post)) out.push(tail);
  return out;
}

// 剥掉修饰，得到「待查路径」。返回 null=不是路径 token。
function toPathCandidate(token) {
  let t = token.trim();
  // 去成对包裹的引号/括号残留
  t = t.replace(/^[('"`]+/, '').replace(/[)'"`]+$/, '');
  // 去尾部标点（中英文），但保留 * / 等 glob/路径字符
  t = t.replace(/[·,;、，。：]+$/, '');
  // 去 path:line 或 path:line:col
  t = t.replace(/:\d+(:\d+)?$/, '');
  if (!PATH_PREFIXES.some((p) => t.startsWith(p))) return null;
  // 去尾部斜杠（目录写法）
  if (t.length > 1) t = t.replace(/\/+$/, '');
  return t;
}

function hasGlob(s) {
  return /[*?]/.test(s);
}

// glob 存在性：任一匹配即通过；globSync 不可用时回退到「最长字面祖先目录存在」。
function globExists(pattern) {
  try {
    const matches = fs.globSync(pattern, { cwd: ROOT });
    if (matches && matches.length > 0) return true;
  } catch {
    // 回退
  }
  // 回退：取第一个含通配的段之前的字面祖先目录。
  const segs = pattern.split('/');
  const literal = [];
  for (const seg of segs) {
    if (/[*?]/.test(seg)) break;
    literal.push(seg);
  }
  const ancestor = literal.join('/');
  return ancestor.length > 0 && fs.existsSync(path.join(ROOT, ancestor));
}

function pathExists(candidate) {
  if (hasGlob(candidate)) return globExists(candidate);
  return fs.existsSync(path.join(ROOT, candidate));
}

// Levenshtein 距离（用于 agent/技能名近似拼写检测）。
function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// 裸 kebab 名（无斜杠/点/空格·≥2 段）→ 若与某已知 agent/技能名编辑距离=1，
// 判为疑似断链（错字/改名残留）。精确命中或距离≥2 均放行。
const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;
function nearMissName(token) {
  const t = token.trim();
  if (!KEBAB.test(t) || t.length < 5) return null;
  if (KNOWN_NAMES.includes(t)) return null; // 精确存在
  for (const known of KNOWN_NAMES) {
    if (Math.abs(known.length - t.length) <= 1 && editDistance(t, known) === 1) return known;
  }
  return null;
}

// ── 主流程 ───────────────────────────────────────────────────────────
const files = [];
for (const d of SCAN_DIRS) walkMarkdown(d, files);
files.sort();

const failures = [];
let checkedPaths = 0;
let checkedNames = 0;

const BACKTICK = /`([^`]+)`/g;

for (const abs of files) {
  const rel = path.relative(ROOT, abs);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    let m;
    BACKTICK.lastIndex = 0;
    while ((m = BACKTICK.exec(line)) !== null) {
      const span = m[1];
      if (isPlaceholder(span)) continue;
      // 一个反引号 span 可含多个 token（空格 / 中点分隔）。
      const subTokens = span.split(/[\s·]+/).filter(Boolean);
      for (const raw of subTokens) {
        if (isPlaceholder(raw)) continue;

        // ① 路径引用
        const cand = toPathCandidate(raw);
        if (cand !== null) {
          if (isPlaceholder(cand)) continue;
          if (WHITELIST_SET.has(cand) || WHITELIST_SET.has(raw)) continue;
          const expanded = expandBraces(cand);
          for (const e of expanded) {
            if (isPlaceholder(e) || WHITELIST_SET.has(e)) continue;
            // 花括号未闭合（多为散文里的「src/{engine 非 xxx}」注解）→ 非真路径，略过。
            if (/[{}]/.test(e)) continue;
            checkedPaths++;
            if (!pathExists(e)) {
              failures.push({ rel, lineNo, ref: e, reason: '路径不存在' });
            }
          }
          continue;
        }

        // ② agent / 技能名近似拼写
        if (WHITELIST_SET.has(raw)) continue;
        const near = nearMissName(raw);
        if (near !== null) {
          checkedNames++;
          failures.push({
            rel, lineNo, ref: raw,
            reason: `疑似 agent/技能名断链（最近似已知名: ${near}）`,
          });
        }
      }
    }
  });
}

// ── 报告 ─────────────────────────────────────────────────────────────
console.log(`docs-ref-guard: 扫 ${files.length} 个 .md，检 ${checkedPaths} 路径 + ${checkedNames} 近似名`);
console.log(`已知 agent/技能名: ${KNOWN_NAMES.join(', ') || '(无)'}`);
console.log(`白名单条目: ${WHITELIST.length}`);

if (failures.length === 0) {
  console.log('DOCS-REF: PASS');
  process.exit(0);
}

console.error('');
for (const f of failures) {
  console.error(`${f.rel}:${f.lineNo}  \`${f.ref}\`  → ${f.reason}`);
}
console.error('');
console.error(`DOCS-REF: FAIL (${failures.length} 处断链)`);
process.exit(1);
