// scripts/scoped-gate.mjs —— 智能推送门禁（owner 2026-07-21 拍板·省"每改动都重跑全量"的干等）。
//
// 背景：推送前固定跑 tsc+全量 vitest+build≈2 分钟，多 session 抢推时 rebase 后还要整套重跑——
// 大量是"改动根本碰不到的测试"在空转（owner：不是每个改动都要重跑测试；自己游戏跑自己游戏测试就够）。
//
// 铁律·只在**可证明安全**时缩范围，任何不确定一律 full（缩错=放过真 breakage=比慢更糟）：
//   · full       —— 碰了引擎/共享面（src/{engine,skills,assembly,renderer,services,net,ui,runtime,launcher*}、
//                    scripts/、tools/、vite.config/package.json/tsconfig）→ 下游全可能坏 → tsc+全量vitest+build。
//   · game:<g>   —— 改动**全部**落在单个游戏自己的面（games/<g>/**、public/games/<g>/**、docs/design/<g>/**）
//                    → 只有该游戏可能坏（它依赖的引擎没动）→ tsc + `vitest run games/<g>` + build。
//   · docs-only  —— 只碰文档（docs/**、根 *.md），无任何编译产物变化 → 跳过 tsc/vitest/build，只跑文档守卫。
//   · none       —— 无改动。
// 多游戏同时改 / 游戏面+根文档混合但仍单游戏=game；只要掺进引擎/共享/多游戏=full（安全兜底）。
//
// 用法：
//   node scripts/scoped-gate.mjs               分类并打印计划 + 判词（不执行）
//   node scripts/scoped-gate.mjs --run         按计划真跑门禁（退出码=门禁结果）
//   node scripts/scoped-gate.mjs --base <ref>  改比较基线（默认 origin/claude/mainbranch）
// 判词 token：`SCOPED-GATE: FULL|GAME:<g>|DOCS-ONLY|NONE`（审计/日志可 grep）。
//
// audit 进推送门（8/4 大评审 Q1 消费路径批·2026-08-10）：改动面涉及 games/<g>/** 非文档文件时，
// 门禁附带 `node scripts/game-skill-audit.mjs <改动游戏…>`（红旗/棘轮红=拦推送）。只扫改动面涉及的
// 游戏，绝不把全库扫描塞进每次门禁（全库兜底=S5 流程门 + 主程每日巡检）。此前 audit 只挂 S5 门——
// 游戏带 audit 实况 FAIL 也能照常推（评审 E6 实证），本步收口。
//
// 面触发守卫（REQ-GUARDGATE 守卫接线批·2026-08-16）——按改动面点名跑、红=拦（无放行档）：
//   ① 引擎面非测试源文件（src/{engine,skills,assembly,net,services}）→ engine-random-guard
//      （深审 A1 探针2：引擎层插裸 Math.random 此前零守卫，被咬全靠碰巧的精确数值断言）；
//   ② src/**/*.test.ts → test-hygiene-check（三禁：墙钟/外部 IO/裸随机——HEAD 曾红着也拦不了推送）；
//   ③ 美术面（scripts/art-replace* / main_entry/art_*）→ art-replace-smoke.py
//      （ARTPAR 复查裁定：该冒烟不在门禁内曾让三处假红漏检一整天）。
//   守卫脚本自身被改也触发各自守卫（改守卫先自证仍能跑绿）。
import { execSync, spawnSync } from 'node:child_process';
import { SLOW_TARGETS } from './slow-lane-guard.mjs';

// ── 引擎/共享面前缀（碰到=full·与 CLAUDE.md 引擎域界一致）───────────────────────
const ENGINE_PREFIXES = [
  'src/engine/', 'src/skills/', 'src/assembly/', 'src/renderer/', 'src/services/',
  'src/net/', 'src/ui/', 'src/runtime/', 'src/studio/', 'src/assets/',
  'scripts/', 'tools/',
];
const ENGINE_FILES = new Set([
  'src/launcher.tsx', 'vite.config.ts', 'package.json', 'package-lock.json',
  'tsconfig.json', 'index.html',
]);
const gameOf = (f) => {
  const m = f.match(/^games\/([a-z0-9-]+)\//) || f.match(/^public\/games\/([a-z0-9-]+)\//) || f.match(/^docs\/design\/([a-z0-9-]+)\//);
  return m ? m[1] : null;
};
const isDoc = (f) => f.endsWith('.md') || f.startsWith('docs/');
const isEngineOrShared = (f) =>
  ENGINE_FILES.has(f) || (f.startsWith('src/launcher/')) || ENGINE_PREFIXES.some((p) => f.startsWith(p));

/**
 * 纯分类（可单测）：给定改动文件列表 → { scope, game?, reason }。
 * 优先级：none → 引擎/共享=full → 收敛单游戏=game → 纯文档=docs-only → 其余=full（兜底）。
 */
export function classify(files) {
  const list = files.filter(Boolean);
  if (list.length === 0) return { scope: 'none', reason: '无改动' };

  const engine = list.filter(isEngineOrShared);
  if (engine.length) return { scope: 'full', reason: `碰引擎/共享面（${engine.slice(0, 3).join(', ')}${engine.length > 3 ? '…' : ''}）` };

  // 非文档的编译/资产改动必须归属游戏；docs 可为游戏 doc 或通用 doc。
  const games = new Set();
  let hasNonDocGame = false;
  let hasGeneralDoc = false;
  for (const f of list) {
    const g = gameOf(f);
    if (g) { games.add(g); if (!isDoc(f)) hasNonDocGame = true; }
    else if (isDoc(f)) hasGeneralDoc = true;
    else return { scope: 'full', reason: `无法归类的非文档改动（${f}）→ 安全兜底 full` };
  }

  if (games.size === 0) return { scope: 'docs-only', reason: '仅通用文档' };
  if (games.size === 1) {
    const g = [...games][0];
    if (!hasNonDocGame) return { scope: 'docs-only', reason: `仅 ${g} 文档（无编译/资产变化）` };
    return { scope: 'game', game: g, reason: `改动收敛在单游戏 ${g}${hasGeneralDoc ? '（含通用文档·不影响）' : ''}` };
  }
  return { scope: 'full', reason: `多游戏同改（${[...games].join(', ')}）→ 安全兜底 full` };
}

/**
 * 纯提取（可单测）：改动文件列表 → 需跑 game-skill-audit 的游戏名（去重·字典序）。
 * 只认 games/<g>/** 下的非 .md 文件——audit 只读游戏源码（.ts/.tsx），纯文档改动不可能改变
 * audit 结果，不为它加门；public/games/**（资产）与 docs/design/**（设计档）同理不触发。
 */
export function auditGamesOf(files) {
  const set = new Set();
  for (const f of files.filter(Boolean)) {
    const m = f.match(/^games\/([a-z0-9-]+)\//);
    if (m && !f.endsWith('.md')) set.add(m[1]);
  }
  return [...set].sort();
}

/**
 * 纯提取（可单测·REQ-GUARDGATE）：改动文件列表 → 面触发守卫开关三旗。
 * · engineRandom：引擎面（五目录）非测试源文件被改，或 engine-random-guard 自身被改。
 *   测试文件不触发它——*.test.* 的三禁归 test-hygiene-check，不重叠不漏管。
 * · testHygiene：src/**\/*.test.ts 被改（hygiene 只扫这一面），或 hygiene 脚本自身被改。
 * · artSmoke：scripts/art-replace* 或 main_entry/art_* 被改（含冒烟脚本自身=scripts/art-replace-smoke.py）。
 */
export function facesOf(files) {
  const list = files.filter(Boolean);
  const ENGINE_SRC = /^src\/(engine|skills|assembly|net|services)\/.*\.(ts|tsx|js|mjs)$/;
  return {
    engineRandom: list.some((f) => (ENGINE_SRC.test(f) && !/\.test\./.test(f)) || f === 'scripts/engine-random-guard.mjs'),
    testHygiene: list.some((f) => /^src\/.*\.test\.ts$/.test(f) || f === 'scripts/test-hygiene-check.mjs'),
    artSmoke: list.some((f) => f.startsWith('scripts/art-replace') || /^main_entry\/art_/.test(f)),
    // syncSmoke：git 同步面（art_sync=一键提交推送 · artifacts=任务收工自动存档）。单列不并进 artSmoke——
    // art-replace-smoke 一条也没覆盖 git 侧；这两个模块动的是**提交/推送顺序**，错了就是「产物丢了」
    // 或「没过门禁的东西被推上去」，两头都不该靠人眼守。含冒烟脚本自身（改守卫先自证跑绿·同上三旗口径）。
    syncSmoke: list.some((f) => /^main_entry\/(art_sync|artifacts)\.py$/.test(f)
      || /^scripts\/(art-sync|auto-sync)-smoke\.py$/.test(f)),
    // dokiworld/** 的 node --test 没有别的门在验（DOKI-APPS 后续①·「写了测试没人跑」与 game108 恒石同形）：
    // 改动命中哪个 app 目录就跑哪个（.md 不算——纯文档改不了测试结果）。
    dokiApps: [...new Set(list.map((f) => { const m = f.match(/^dokiworld\/([a-z0-9-]+)\//); return m && !f.endsWith('.md') ? m[1] : null; }).filter(Boolean))].sort(),
    // 慢车道点名补跑（S18PANEL 交回件①·Lead 裁 B 案）：改动命中被快车道 exclude 的目标之被测物/测试本身
    // → 点名跑该目标（slow-lane-guard 警告态基线棘轮·存量红响亮放行不挡门·新红硬拦）。目标表住 guard 文件。
    slowLane: SLOW_TARGETS
      .filter((t) => list.some((f) => f === t.test || t.subjects.some((s) => f.startsWith(s)) || f === 'scripts/slow-lane-guard.mjs' || f === 'scripts/slow-lane-baseline.json'))
      .map((t) => t.id),
  };
}

function changedFiles(base) {
  const runs = [
    `git diff --name-only ${base}...HEAD`, // 本分支相对基线的提交
    'git diff --name-only HEAD', // 未暂存
    'git diff --name-only --cached', // 已暂存
    'git ls-files --others --exclude-standard', // 新增未跟踪（提交前也能分类）
  ];
  const set = new Set();
  for (const cmd of runs) {
    try { execSync(cmd, { encoding: 'utf8' }).split('\n').forEach((l) => l.trim() && set.add(l.trim())); }
    catch { /* base 不存在等 → 忽略该源 */ }
  }
  return [...set];
}

// 门禁计划（scope + 改动游戏 + 面触发旗 → 要跑哪些步）。每步 {name, cmd}。导出供行为契约测试。
export function planFor(c, auditGames = [], faces = {}) {
  // 常驻守卫（任何 scope 都跑·纯 fs 扫描+regex·秒级）：文档引用 + token 预算 + 引擎/内容边界
  // （decouple-check·REQ-SPLIT-引擎内容分离图纸②·跟双守卫并列，防 games/src 边界回潮）。
  const GUARDS = [
    { name: 'docs-ref', cmd: ['node', ['scripts/docs-ref-guard.mjs']] },
    { name: 'context-budget', cmd: ['node', ['scripts/context-budget-guard.mjs']] },
    { name: 'decouple-check', cmd: ['node', ['scripts/decouple-check.mjs']] },
    // REQ-ARTPIPE2 A1②：台账强制守卫。退出码 0=全净·1=棘轮违规（新黑户）硬拦·2=有存量挂账/死账/
    // 缺来源但无新增——警告态，allowExit 放行（已知债务开工单追，不该拦无关改动的推送）。
    { name: 'art-ledger-guard', cmd: ['node', ['scripts/art-ledger-guard.mjs']], allowExit: [0, 2] },
  ];
  const TSC = { name: 'tsc', cmd: ['npx', ['tsc', '--noEmit']] };
  const BUILD = { name: 'build', cmd: ['npm', ['run', 'build']] };
  // audit 进推送门（Q1·见文件头）：改动涉及 games/<g>/** 非文档 → 附带只扫这些游戏的 audit。
  // 放最前（秒级·红旗直接拦，省得先烧几分钟 tsc/vitest 才发现）。docs-only/none 时 auditGames
  // 必为空（非文档游戏文件会把 scope 推成 game/full），不额外加门。
  const AUDIT = auditGames.length
    ? [{ name: `audit:${auditGames.join('+')}`, cmd: ['node', ['scripts/game-skill-audit.mjs', ...auditGames]] }]
    : [];
  // 面触发守卫（REQ-GUARDGATE·见文件头）：按 facesOf 旗点名进计划、红=拦（无 allowExit 放行档）。
  // 放 AUDIT 后、TSC 前——①②是秒级静态扫描先咬省大头；③冒烟稍重但美术面改动本就该先过它
  //（漏检一整天的病根就是它不在门前）。docs-only/none 时面文件（scripts//src//main_entry/）
  // 必已把 scope 推成 full，三旗恒灭，不额外加门。
  const FACE_GUARDS = [
    ...(faces.engineRandom ? [{ name: 'engine-random', cmd: ['node', ['scripts/engine-random-guard.mjs']] }] : []),
    ...(faces.testHygiene ? [{ name: 'test-hygiene', cmd: ['node', ['scripts/test-hygiene-check.mjs']] }] : []),
    ...(faces.artSmoke ? [{ name: 'art-smoke', cmd: ['python3', ['scripts/art-replace-smoke.py']] }] : []),
    ...(faces.syncSmoke ? [
      { name: 'art-sync-smoke', cmd: ['python3', ['scripts/art-sync-smoke.py']] },
      { name: 'auto-sync-smoke', cmd: ['python3', ['scripts/auto-sync-smoke.py']] },
    ] : []),
    // dokiworld app 测试（各包自跑 node --test·缺依赖由 runner 先 npm ci——同出包 job 口径）。
    ...(faces.dokiApps || []).map((app) => ({ name: `doki-test:${app}`, cmd: ['node', ['scripts/doki-app-test.mjs', app]] })),
    // 慢车道点名补跑（交回件①·B 案）：命中目标一次点名跑一批（guard 内部对基线棘轮判红/警）。
    ...((faces.slowLane || []).length ? [{ name: `slow-lane:${(faces.slowLane || []).join('+')}`, cmd: ['node', ['scripts/slow-lane-guard.mjs', ...faces.slowLane]] }] : []),
  ];
  if (c.scope === 'none') return [];
  if (c.scope === 'docs-only') return GUARDS;
  if (c.scope === 'game') {
    return [...AUDIT, ...FACE_GUARDS, TSC, { name: `vitest:${c.game}`, cmd: ['npx', ['vitest', 'run', `games/${c.game}`]] }, BUILD, ...GUARDS];
  }
  // full
  return [...AUDIT, ...FACE_GUARDS, TSC, { name: 'vitest:full', cmd: ['npx', ['vitest', 'run']] }, BUILD, ...GUARDS];
}

function main() {
  const argv = process.argv.slice(2);
  const run = argv.includes('--run');
  const bi = argv.indexOf('--base');
  const base = bi >= 0 ? argv[bi + 1] : 'origin/claude/mainbranch';

  const files = changedFiles(base);
  const c = classify(files);
  const token = c.scope === 'game' ? `GAME:${c.game}`
    : c.scope === 'docs-only' ? 'DOCS-ONLY'
    : c.scope === 'none' ? 'NONE' : 'FULL';

  const auditGames = auditGamesOf(files);
  const faces = facesOf(files);
  // 数组面（如 dokiApps）空数组也是真值——按长度判，否则零触发也报「面触发守卫」（S18PANEL 复查带出）。
  const armed = Object.entries(faces).filter(([, v]) => (Array.isArray(v) ? v.length > 0 : Boolean(v))).map(([k]) => k);
  console.log(`[scoped-gate] 基线=${base} · 改动 ${files.length} 文件 · 判定=${c.scope}（${c.reason}）${auditGames.length ? ` · audit 改动游戏=${auditGames.join(',')}` : ''}${armed.length ? ` · 面触发守卫=${armed.join(',')}` : ''}`);
  const plan = planFor(c, auditGames, faces);
  console.log(`[scoped-gate] 计划：${plan.length ? plan.map((s) => s.name).join(' → ') : '（无·无改动）'}`);
  console.log(`SCOPED-GATE: ${token}`);

  if (!run) {
    if (c.scope === 'full') console.log('（未加 --run·如需缩范围执行请带 --run；full 时等价 tsc+全量vitest+build）');
    return;
  }
  for (const step of plan) {
    console.log(`\n── ${step.name} ──`);
    const r = spawnSync(step.cmd[0], step.cmd[1], { stdio: 'inherit' });
    const ok = step.allowExit ? step.allowExit.includes(r.status) : r.status === 0;
    if (!ok) { console.error(`\n❌ 门禁失败于 ${step.name}（退出码 ${r.status}）`); process.exit(r.status || 1); }
  }
  console.log(`\n✅ 门禁全绿（scope=${c.scope}${c.game ? ':' + c.game : ''}）`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
