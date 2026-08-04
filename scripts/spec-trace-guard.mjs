#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/spec-trace-guard.mjs —— 条款追踪守卫（REQ-SPECTRACE V1·图纸 docs/design/spec-trace-blueprint-2026-08.md）
//
//  背景：复查不靠人看——GD 在 GDD 里给每条可验收细则挂稳定编号 `【R-<游戏>-<序号>】`，
//  `docs/design/<game>/spec-trace.json` 记它到验收物（scenario/test/audit/probe/human）的映射。
//  本守卫是那份映射的**通用解释器**（矩阵是数据·不是代码），每跑一次判四类：
//    · 未覆盖 —— 文档有编号、矩阵无条目
//    · 死引用 —— 矩阵指向不存在的剧本/测试文件/未知 audit rule/缺字段
//    · 过期   —— 细则文本哈希 ≠ blessedHash（含从未 bless 过=哈希缺失）
//    · 孤儿   —— 矩阵条目指向文档里已不存在的编号
//  另：编号复用（同一编号在文档内出现 ≥2 次）是图纸「红线」，一并判红（duplicate 桶，不算入四判计数但计入退出码）。
//
//  `--bless <clause>[,<clause>…]`：把指定条款的 checks **真跑一遍**（scenario=真跑该剧本 conformance·
//  test=真跑该测试文件·audit/probe/human=存在性）全绿后，把矩阵条目的 blessedHash 更新为细则当前文本的哈希
//  （持久化到 spec-trace.json）。任何一个 check 没过 → 拒绝 bless（不写盘）。
//
//  用法：
//    node scripts/spec-trace-guard.mjs                  全部含 spec-trace.json 的游戏
//    node scripts/spec-trace-guard.mjs --game game-c     只判一个游戏
//    node scripts/spec-trace-guard.mjs --bless R-C-001               单条 bless
//    node scripts/spec-trace-guard.mjs --bless R-C-001,R-C-002       批量 bless（每条独立验证）
//    node scripts/spec-trace-guard.mjs --game game-c --bless R-C-001 限定搜索范围（消歧·非必须）
//  退出码：0 全绿 / 1 有红（判红或 bless 被拒） / 2 用法错（缺参数/未知 flag/指名游戏或条款不存在）。
//
//  **V1 独立跑·不接现有门禁/scoped-gate**（试点期图纸明令）——本脚本不出现在 scoped-gate.mjs 的
//  任何 stage 里，也不参与 scripts/game-pipeline.mjs 的机器门；由施工/复查 session 手动跑。
//
//  纯 node/fs + node:crypto + node:child_process（spawnSync 起子进程真跑剧本/测试）。
// ═══════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// ROOT 可用 ZEROCRAFT_SPECTRACE_ROOT 覆盖（同 acceptance-run.mjs 的 ZEROCRAFT_ACCEPTANCE_ROOT 手法）——
// 供行为契约测试指向临时 fixture 根真跑 CLI（spawn 真进程测退出码），不碰真 game-c 文件。
const ROOT = process.env.ZEROCRAFT_SPECTRACE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── 哈希 / 条款抽取（纯函数·可单测）──────────────────────────────────────
/** sha256 十六进制摘要（与 art-replace.mjs/game-pipeline.mjs 同款约定）。 */
export function hashText(text) {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * 从文档全文抽出某游戏前缀的全部条款标记 `【R-<prefix>-<序号>】`。
 * 「细则文本」= 从本条标记起、到下一条标记（同文档内，任意前缀——防漏判邻近别游戏标记）为止的原文切片；
 * 这样不依赖 Markdown 结构（表格/列表/换行都行），编辑该条款覆盖的任意字符都会改哈希。
 * 代价（V1 已知简化）：切片会把「下一条款之前」的表格备注列/收尾标点一并计入——多疑不漏检，方向安全。
 * 返回顺序=文档出现顺序；同编号出现 ≥2 次（编号复用违红线）→ 每条都标 dup:true。
 */
export function extractClauses(text, prefix) {
  const anyMarker = /【R-([A-Za-z0-9]+)-(\d+)】/g;
  const all = [...text.matchAll(anyMarker)].map((m) => ({ full: `R-${m[1]}-${m[2]}`, prefix: m[1], index: m.index }));
  const mine = all.filter((m) => m.prefix === prefix);
  const seen = new Map();
  const out = [];
  for (let i = 0; i < mine.length; i++) {
    const cur = mine[i];
    // 下一条边界：文档里紧随其后的**任意**条款标记（不限前缀）——防止别游戏的标记被并进本条切片。
    const nextAny = all.find((m) => m.index > cur.index);
    const end = nextAny ? nextAny.index : text.length;
    const slice = text.slice(cur.index, end);
    const deprecated = /\[废\]/.test(slice);
    const count = (seen.get(cur.full) ?? 0) + 1;
    seen.set(cur.full, count);
    out.push({ clause: cur.full, index: cur.index, deprecated, hash: hashText(slice), snippet: slice.slice(0, 80) });
  }
  // 二次标记：出现次数 >1 的条款，全部实例回填 dup:true。
  for (const e of out) e.dup = (seen.get(e.clause) ?? 0) > 1;
  return out;
}

/** 条款数组 → {map(clause→entry,后出现者覆盖) , duplicates(去重编号列表)}。 */
export function buildClauseIndex(entries) {
  const map = new Map();
  const dup = new Set();
  for (const e of entries) {
    if (map.has(e.clause)) dup.add(e.clause);
    map.set(e.clause, e);
  }
  return { map, duplicates: [...dup].sort() };
}

// ── 矩阵装载 / 形状校验 ───────────────────────────────────────────────
export function matrixPath(root, gameSlug) {
  return path.join(root, 'docs', 'design', gameSlug, 'spec-trace.json');
}

/** 有 spec-trace.json 的游戏 slug 列表（升序）。 */
export function discoverGamesWithMatrix(root) {
  const base = path.join(root, 'docs', 'design');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(matrixPath(root, d.name)))
    .map((d) => d.name)
    .sort();
}

/** 读矩阵 JSON（不存在→null；解析失败→抛错，调用方归红）。 */
export function loadMatrix(root, gameSlug) {
  const p = matrixPath(root, gameSlug);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

/** 矩阵顶层形状校验（闭集必填字段）→ 错误字符串数组（空=合法）。 */
export function validateMatrixShape(matrix) {
  const errs = [];
  if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) return ['矩阵根须为对象'];
  if (typeof matrix.game !== 'string' || !matrix.game) errs.push('game 须为非空字符串');
  if (typeof matrix.clausePrefix !== 'string' || !matrix.clausePrefix) errs.push('clausePrefix 须为非空字符串（对应文档里 【R-<prefix>-nnn】 的 prefix）');
  if (!Array.isArray(matrix.docs) || matrix.docs.length === 0) errs.push('docs 须为非空字符串数组（相对 docs/design/<game>/ 的文档路径）');
  if (!Array.isArray(matrix.clauses)) errs.push('clauses 须为数组（可为空）');
  return errs;
}

// ── 验收物存在性（死引用判定·纯 fs·零执行）─────────────────────────────
let _auditRuleCache = null;
/** 从 game-skill-audit.mjs 内省已知红旗/体检 flag key（单一真相·不复制维护）。 */
function knownAuditRules(root) {
  if (_auditRuleCache) return _auditRuleCache;
  const p = path.join(root, 'scripts', 'game-skill-audit.mjs');
  const rules = new Set();
  if (fs.existsSync(p)) {
    const src = fs.readFileSync(p, 'utf8');
    const m = src.match(/const\s+flags\s*=\s*\{([^}]*)\}/);
    if (m) {
      for (const km of m[1].matchAll(/(\w+)\s*:/g)) rules.add(km[1]);
    }
  }
  _auditRuleCache = rules;
  return rules;
}

const TEST_FILE_RE = /\.test\.(ts|tsx|mjs|js)$/;

/** 单个 check 的存在性（死引用判定用·不执行任何东西）。→ {ok, detail?}。 */
export function checkExistence(root, gameSlug, check) {
  if (!check || typeof check !== 'object' || Array.isArray(check)) return { ok: false, detail: 'check 须为对象' };
  switch (check.type) {
    case 'scenario': {
      if (typeof check.id !== 'string' || !check.id) return { ok: false, detail: 'scenario 缺 id' };
      const p = path.join(root, 'docs', 'design', gameSlug, 'acceptance', `${check.id}.scenario.jsonc`);
      return fs.existsSync(p)
        ? { ok: true, path: p }
        : { ok: false, detail: `剧本文件不存在: docs/design/${gameSlug}/acceptance/${check.id}.scenario.jsonc` };
    }
    case 'test': {
      if (typeof check.name !== 'string' || !check.name) return { ok: false, detail: 'test 缺 name' };
      if (!TEST_FILE_RE.test(check.name)) return { ok: false, detail: `test.name 须指向 *.test.{ts,tsx,mjs,js} 文件（现: ${check.name}）` };
      const p = path.join(root, check.name);
      return fs.existsSync(p) ? { ok: true, path: p } : { ok: false, detail: `测试文件不存在: ${check.name}` };
    }
    case 'audit': {
      if (typeof check.rule !== 'string' || !check.rule) return { ok: false, detail: 'audit 缺 rule' };
      const known = knownAuditRules(root);
      return known.has(check.rule)
        ? { ok: true }
        : { ok: false, detail: `未知 audit rule（scripts/game-skill-audit.mjs 无此 flag 键): ${check.rule}` };
    }
    case 'probe': {
      // REQ-RENDERCHECK 渲染探针注册表尚未落地（两案汇流处·blueprint §三）——存在性=结构齐全，无可核对的真注册表。
      if (typeof check.id !== 'string' || !check.id) return { ok: false, detail: 'probe 缺 id' };
      return { ok: true };
    }
    case 'human': {
      if (typeof check.note !== 'string' || !check.note) return { ok: false, detail: 'human 缺 note' };
      return { ok: true };
    }
    default:
      return { ok: false, detail: `未知 check.type: ${JSON.stringify(check?.type)}` };
  }
}

// ── 四判：单游戏 ───────────────────────────────────────────────────────
/**
 * 判一个游戏（matrix 已装载 + 形状合法）。→
 *   { ok, uncovered:[clause], orphan:[clause], deadRef:[{clause,check,reason}], stale:[clause], duplicate:[clause],
 *     totalChecks, humanChecks, docMap, matrixMap }
 */
export function judgeGame(root, gameSlug, matrix) {
  let clauseEntries = [];
  for (const docRel of matrix.docs) {
    const docPath = path.join(root, 'docs', 'design', gameSlug, docRel);
    if (!fs.existsSync(docPath)) throw new Error(`矩阵引用的文档不存在: docs/design/${gameSlug}/${docRel}`);
    const text = fs.readFileSync(docPath, 'utf8');
    for (const e of extractClauses(text, matrix.clausePrefix)) clauseEntries.push({ ...e, doc: docRel });
  }
  const { map: docMap, duplicates } = buildClauseIndex(clauseEntries);
  const matrixMap = new Map((matrix.clauses || []).map((c) => [c.clause, c]));

  const uncovered = [];
  for (const [id, entry] of docMap) {
    if (!entry.deprecated && !matrixMap.has(id)) uncovered.push(id);
  }
  const orphan = [];
  for (const id of matrixMap.keys()) {
    if (!docMap.has(id)) orphan.push(id);
  }
  const deadRef = [];
  const stale = [];
  let totalChecks = 0, humanChecks = 0;
  for (const [id, entry] of matrixMap) {
    for (const check of entry.checks || []) {
      totalChecks++;
      if (check.type === 'human') humanChecks++;
      const r = checkExistence(root, gameSlug, check);
      if (!r.ok) deadRef.push({ clause: id, check, reason: r.detail });
    }
    const docEntry = docMap.get(id);
    if (docEntry && !docEntry.deprecated) {
      if (!entry.blessedHash || entry.blessedHash !== docEntry.hash) stale.push(id);
    }
  }
  const ok = uncovered.length === 0 && orphan.length === 0 && deadRef.length === 0 && stale.length === 0 && duplicates.length === 0;
  return { ok, uncovered: uncovered.sort(), orphan: orphan.sort(), deadRef, stale: stale.sort(), duplicate: duplicates, totalChecks, humanChecks, docMap, matrixMap };
}

// ── bless：真跑验证 + 落盘 ────────────────────────────────────────────
/** 默认（真）runner：spawn 子进程真跑。缓存在 cache 内（同一 CLI 调用内的多条 bless 复用）。 */
export function makeRealRunners(root) {
  const scenarioCache = new Map(); // gameSlug -> {status, stdout}
  const testCache = new Map(); // testRelPath -> {status, stdout}
  return {
    runScenario(root_, gameSlug, scenarioId) {
      let run = scenarioCache.get(gameSlug);
      if (!run) {
        const script = path.join(root_, 'scripts', 'acceptance-run.mjs');
        const r = spawnSync('npx', ['vite-node', script, '--game', gameSlug], {
          cwd: root_, encoding: 'utf8', timeout: 120_000,
          env: { ...process.env, ZEROCRAFT_ACCEPTANCE_ROOT: root_, ZEROCRAFT_ACCEPTANCE_CLI: '1' },
        });
        run = { status: r.status, stdout: (r.stdout || '') + (r.stderr || '') };
        scenarioCache.set(gameSlug, run);
      }
      const absScenario = path.join(root_, 'docs', 'design', gameSlug, 'acceptance', `${scenarioId}.scenario.jsonc`);
      const line = run.stdout.split('\n').find((l) => l.includes(`[${absScenario}]`));
      if (!line) return { ok: false, detail: `conformance 输出里找不到该剧本结果（可能 schema 错误/未跑到）：${absScenario}` };
      if (!line.trimStart().startsWith('PASS')) return { ok: false, detail: `剧本 conformance 未过：${line.trim()}` };
      return { ok: true, detail: line.trim() };
    },
    runTestFile(root_, testRelPath) {
      let run = testCache.get(testRelPath);
      if (!run) {
        const r = spawnSync('npx', ['vitest', 'run', testRelPath], { cwd: root_, encoding: 'utf8', timeout: 120_000 });
        run = { status: r.status, stdout: (r.stdout || '') + (r.stderr || '') };
        testCache.set(testRelPath, run);
      }
      return run.status === 0 ? { ok: true } : { ok: false, detail: `vitest run ${testRelPath} 未过（exit ${run.status}）` };
    },
  };
}

/** 单 check 的 bless 前真验证（先存在性、后按类型真跑/存在性判定）。→ {ok, detail}。 */
export function verifyCheckForBless(root, gameSlug, check, runners) {
  const exist = checkExistence(root, gameSlug, check);
  if (!exist.ok) return exist;
  switch (check.type) {
    case 'scenario': return runners.runScenario(root, gameSlug, check.id);
    case 'test': return runners.runTestFile(root, check.name);
    case 'audit':
    case 'probe':
    case 'human':
      return { ok: true, detail: '存在性通过（该类型 bless 不要求真跑）' };
    default:
      return { ok: false, detail: `未知 check.type: ${JSON.stringify(check?.type)}` };
  }
}

/**
 * bless 一个条款：条款须在文档中存在（非孤儿）且全部 checks 真验证通过，才更新 blessedHash（原地改 matrix 对象）。
 * 不落盘（调用方决定何时写文件——CLI 里全部条款处理完再统一写，避免半途失败留半吊子改动）。
 * → { ok, detail, clause }；ok=false 时 matrix 未被改动。
 */
export function blessOne(root, gameSlug, matrix, clauseId, docMap, runners) {
  const entry = (matrix.clauses || []).find((c) => c.clause === clauseId);
  if (!entry) return { ok: false, clause: clauseId, detail: `矩阵里无此条款条目: ${clauseId}（先在 spec-trace.json 登记再 bless）` };
  const docEntry = docMap.get(clauseId);
  if (!docEntry) return { ok: false, clause: clauseId, detail: `条款在文档里不存在（孤儿）: ${clauseId}` };
  if (docEntry.deprecated) return { ok: false, clause: clauseId, detail: `条款已标 [废]，无需（也不应）bless: ${clauseId}` };
  const checks = entry.checks || [];
  if (checks.length === 0) return { ok: false, clause: clauseId, detail: `条款无 checks，无法 bless: ${clauseId}` };
  const failures = [];
  for (const check of checks) {
    const r = verifyCheckForBless(root, gameSlug, check, runners);
    if (!r.ok) failures.push({ check, reason: r.detail });
  }
  if (failures.length > 0) {
    return { ok: false, clause: clauseId, detail: failures.map((f) => `  ✗ [${f.check.type}] ${JSON.stringify(f.check)} → ${f.reason}`).join('\n') };
  }
  entry.blessedHash = docEntry.hash;
  return { ok: true, clause: clauseId, detail: `bless 成功（${checks.length} 项 checks 全真跑绿）` };
}

// ── 报告格式化 ───────────────────────────────────────────────────────
function formatGameReport(gameSlug, res) {
  const lines = [];
  lines.push(`── ${gameSlug} ──`);
  if (res.shapeError) {
    lines.push(`  ✗ 矩阵结构非法: ${res.shapeError}`);
    return lines.join('\n');
  }
  if (res.ok) {
    lines.push(`  PASS（${res.matrixMap.size} 条款 · ${res.totalChecks} checks · human ${res.humanChecks}）`);
    return lines.join('\n');
  }
  if (res.duplicate.length) lines.push(`  ✗ 编号复用（红线）：${res.duplicate.join(', ')}`);
  if (res.uncovered.length) lines.push(`  ✗ 未覆盖（文档有编号·矩阵无条目）：${res.uncovered.join(', ')}`);
  if (res.orphan.length) lines.push(`  ✗ 孤儿（矩阵条目·文档里编号已不存在）：${res.orphan.join(', ')}`);
  if (res.deadRef.length) {
    lines.push(`  ✗ 死引用（${res.deadRef.length} 处）：`);
    for (const d of res.deadRef) lines.push(`      ${d.clause} · [${d.check?.type}] → ${d.reason}`);
  }
  if (res.stale.length) lines.push(`  ✗ 过期（细则文本哈希≠blessedHash，需重新走查后 --bless）：${res.stale.join(', ')}`);
  return lines.join('\n');
}

// ── CLI ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { game: undefined, bless: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--game') {
      if (i + 1 >= argv.length) return { error: '--game 须带值' };
      out.game = argv[++i];
    } else if (a === '--bless') {
      if (i + 1 >= argv.length) return { error: '--bless 须带值（clause 或逗号分隔的 clause 列表）' };
      out.bless = argv[++i];
    } else {
      return { error: `未知参数: ${a}` };
    }
  }
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (args.error) {
    console.error(`用法错: ${args.error}`);
    console.error('用法: node scripts/spec-trace-guard.mjs [--game <slug>] [--bless <clause>[,<clause>…]]');
    process.exit(2);
  }

  if (args.bless) {
    const clauseIds = args.bless.split(',').map((s) => s.trim()).filter(Boolean);
    if (clauseIds.length === 0) { console.error('用法错: --bless 值为空'); process.exit(2); }

    // 定位每条 clause 所属游戏（--game 给定则限定；否则全库搜）。
    const candidateGames = args.game ? [args.game] : discoverGamesWithMatrix(ROOT);
    if (args.game && !fs.existsSync(matrixPath(ROOT, args.game))) {
      console.error(`用法错: --game ${args.game} 无 docs/design/${args.game}/spec-trace.json`);
      process.exit(2);
    }

    const runners = makeRealRunners(ROOT);
    let anyUsageError = false;
    let anyRed = false;
    const dirty = new Map(); // gameSlug -> {matrix, changed}

    for (const clauseId of clauseIds) {
      // 找归属游戏：矩阵 clauses 数组里含该 clause 的第一个游戏。
      let owner = null, matrix = null;
      for (const g of candidateGames) {
        const m = dirty.has(g) ? dirty.get(g).matrix : loadMatrix(ROOT, g);
        if (!m) continue;
        const shapeErrs = validateMatrixShape(m);
        if (shapeErrs.length) continue; // 结构非法的矩阵不参与 bless 搜索（判词已在 judge 模式报过）
        if ((m.clauses || []).some((c) => c.clause === clauseId)) { owner = g; matrix = m; break; }
      }
      if (!owner) {
        console.error(`用法错: 未知 clause（任何矩阵都无此条目，先登记再 bless）: ${clauseId}`);
        anyUsageError = true;
        continue;
      }
      if (!dirty.has(owner)) dirty.set(owner, { matrix, changed: false });

      // 文档 clause map（同一 owner 内多条 bless 共用一次扫描）。
      const docMapKey = `__docMap_${owner}`;
      if (!dirty.get(owner)[docMapKey]) {
        let clauseEntries = [];
        for (const docRel of matrix.docs) {
          const docPath = path.join(ROOT, 'docs', 'design', owner, docRel);
          const text = fs.readFileSync(docPath, 'utf8');
          for (const e of extractClauses(text, matrix.clausePrefix)) clauseEntries.push(e);
        }
        dirty.get(owner)[docMapKey] = buildClauseIndex(clauseEntries).map;
      }
      const docMap = dirty.get(owner)[docMapKey];

      const r = blessOne(ROOT, owner, matrix, clauseId, docMap, runners);
      if (r.ok) {
        console.log(`✓ bless ${clauseId}（${owner}）：${r.detail}`);
        dirty.get(owner).changed = true;
      } else {
        console.error(`✗ bless 拒绝 ${clauseId}（${owner}）：\n${r.detail}`);
        anyRed = true;
      }
    }

    // 落盘：只写真被改过的矩阵（半途失败的条款不写·已成功的条款即使同批次里别条失败也保留其改动——各条独立）。
    for (const [g, d] of dirty) {
      if (d.changed) fs.writeFileSync(matrixPath(ROOT, g), JSON.stringify(d.matrix, null, 2) + '\n', 'utf8');
    }

    if (anyUsageError) process.exit(2);
    process.exit(anyRed ? 1 : 0);
  }

  // ── 判词模式 ──
  let games;
  if (args.game) {
    if (!fs.existsSync(matrixPath(ROOT, args.game))) {
      console.error(`用法错: --game ${args.game} 无 docs/design/${args.game}/spec-trace.json`);
      process.exit(2);
    }
    games = [args.game];
  } else {
    games = discoverGamesWithMatrix(ROOT);
  }

  if (games.length === 0) {
    console.log('无任何游戏含 docs/design/<game>/spec-trace.json（V1 试点期正常·各游戏随接入落）');
    console.log('SPEC-TRACE: PASS');
    process.exit(0);
  }

  let anyRed = false;
  let totalChecksAll = 0, humanChecksAll = 0;
  const perGameHuman = [];
  for (const g of games) {
    const matrix = loadMatrix(ROOT, g);
    const shapeErrs = validateMatrixShape(matrix);
    if (shapeErrs.length) {
      console.log(formatGameReport(g, { shapeError: shapeErrs.join('; ') }));
      anyRed = true;
      continue;
    }
    const res = judgeGame(ROOT, g, matrix);
    console.log(formatGameReport(g, res));
    if (!res.ok) anyRed = true;
    totalChecksAll += res.totalChecks;
    humanChecksAll += res.humanChecks;
    perGameHuman.push(`${g}: ${res.humanChecks}/${res.totalChecks}`);
  }

  const pct = totalChecksAll > 0 ? ((humanChecksAll / totalChecksAll) * 100).toFixed(1) : '0.0';
  console.log('');
  console.log(`human 型占比：${humanChecksAll}/${totalChecksAll}（${pct}%）［${perGameHuman.join(' · ') || '（无）'}］`);
  console.log(`SPEC-TRACE: ${anyRed ? 'FAIL' : 'PASS'}`);
  process.exit(anyRed ? 1 : 0);
}

// 走 vite-node/node 直跑时执行 main；被 vitest import 时不跑（同 acceptance-run.mjs 的 underVitest 手法）。
const forceCli = process.env.ZEROCRAFT_SPECTRACE_CLI === '1';
const underVitest = !forceCli && (!!process.env.VITEST || !!process.env.VITEST_WORKER_ID);
if (!underVitest) {
  main();
}
