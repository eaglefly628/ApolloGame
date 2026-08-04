#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/pipeline-orchestrator.mjs —— 八阶段**编排器核**（REQ-PIPESOFT P1a·
//  图纸 docs/design/pipeline-orchestrator-spec-2026-08.md §P1a·上位案 pipeline-software-plan-2026-08.md §三②）
//
//  治的病：阶段之间靠人肉开会话，没有编排器——「每步小上下文」只是口头约定，没有软件保证。
//  药方＝把防漂移三律**软件化**：
//    · 状态在会话外   —— 喂料只有三样（本阶段手册 + board 实时输出 + 游戏目录），别的一律不喂；
//    · 每步小上下文   —— 一次只派一个阶段，固定尾注禁跨阶段抢跑；档位按阶段封顶（effort + max-turns）；
//    · 绿靠门不靠嘴   —— 会话退出后编排器**自己 spawn 该阶段门**、以自己量到的退出码落判定。
//                        会话 stdout 说什么一律不采信（见 decideStatus：判定只读 verify.exit）。
//
//  本脚本是 game-pipeline.mjs 的**薄封装**：板/门/证据的唯一真相仍是 pipeline.json + game-pipeline.mjs，
//  这里不复制任何门逻辑，只负责「起会话 / 看门狗 / 串行锁 / 独立重验」。
//
//  用法：
//    node scripts/pipeline-orchestrator.mjs dispatch <slug> <SN>   为该游戏该阶段派一个匿名无头会话
//    node scripts/pipeline-orchestrator.mjs status [slug] [--json] 在跑/最近一次会话：阶段·起始·心跳·状态
//    node scripts/pipeline-orchestrator.mjs abort <slug>           终止在跑会话并标「中止·需人工」
//
//  退出码（P1b 壳按码分流·别只看 0/非 0）：
//    0=done · 1=failed（会话跑完但门没绿／看门狗二次停滞） · 2=用法/未知游戏/阶段无会话
//    3=本机无编排运行时（优雅拒绝·板照常手动用） · 4=已有会话在跑（串行锁占用）
//
//  环境旗标（本机运行态·不入图纸语义）：
//    ZEROCRAFT_ORCH_CLAUDE  会话 CLI 路径（默认 `claude`）——测试注入替身进程用，生产别设。
//    ZEROCRAFT_ORCH_IDLE_MS 看门狗空闲阈（默认 600000）——测试注入毫秒级用，生产别设。
//    ZEROCRAFT_ORCH_FLAGS   透传给会话 CLI 的额外旗标（空格分隔）。**图纸未定义会话的权限模式**，
//                           本单不自行拍板 `--dangerously-skip-permissions` 之类；本机要放权由操作者
//                           显式设此变量，长期口径待 Lead 裁（见回报「与图纸偏差」）。
//
//  红线：无特权通道（编排会话与手动会话同门同板）；人门不可代签不可 API 绕过；
//        锁与运行台账属 .zerocraft/ 运行时域（gitignore·不进库）；编排器不代提交（会话自己走推送门禁）。
// ═══════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, openSync, writeSync, closeSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { STAGES, GATE_STAGES, detectForm } from './game-pipeline.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** 仓库根。ZEROCRAFT_PIPELINE_ROOT 与 game-pipeline.mjs 同名同义（仅测试注入临时根用·生产不设）。 */
export const REPO_ROOT = process.env.ZEROCRAFT_PIPELINE_ROOT || process.env.APOLLO_PIPELINE_ROOT || join(HERE, '..');
const PIPELINE_CLI = join(HERE, 'game-pipeline.mjs');

// ── 运行时域路径（.zerocraft/·不进库）─────────────────────────────────────
export const lockPath = (root) => join(root, '.zerocraft', 'orchestrator.lock');
export const runsPath = (root) => join(root, '.zerocraft', 'orchestrator-runs.json');
export const logDir = (root) => join(root, '.zerocraft', 'orchestrator-logs');

// ── 看门狗与重派（图纸 §会话契约 4）────────────────────────────────────────
/** 600s 无任何输出 = stalled（心跳判据·非闹钟：只要还在吐流就不杀）。 */
export const IDLE_TIMEOUT_MS = 600_000;
/** 首派 + 自动重派**一次** = 2 次尝试封顶；再停 = failed「需人工」。 */
export const MAX_ATTEMPTS = 2;
/** SIGTERM 后给的收尸宽限，到点 SIGKILL。 */
export const KILL_GRACE_MS = 2_000;

// ── 阶段档位与预算（图纸 §会话契约 3·CLAUDE.md effort 阶梯）───────────────
//  S1/S8=low · S2/S3=medium · S4/S5=high。maxTurns=该阶段活儿的轮次封顶（预算硬顶，防跑飞烧 token）。
export const STAGE_BUDGET = {
  S1: { effort: 'low', maxTurns: 25 },
  S2: { effort: 'medium', maxTurns: 60 },
  S3: { effort: 'medium', maxTurns: 60 },
  S4: { effort: 'high', maxTurns: 120 },
  S5: { effort: 'high', maxTurns: 120 },
  S8: { effort: 'low', maxTurns: 40 },
};
/** 不派会话的两个阶段（拒绝 dispatch 并说明去哪儿办·图纸 §会话契约 3）。 */
export const NO_SESSION_STAGES = {
  S6: 'S6 美术关走**美术平台**（非 LLM 会话·逐行复核台账）——编排器不派会话；手册 docs/playbooks/art-pipeline.md',
  S7: 'S7 品质关是**人门**（评分卡由复查人打分·不可代签）——无会话可派；跑 `node scripts/game-pipeline.mjs checklist <slug> S7`',
};

/** 阶段 → 档位预算。S6/S7 与未知阶段一律拒（带去处说明）。 */
export function budgetFor(stage) {
  if (NO_SESSION_STAGES[stage]) return { ok: false, code: 'NO_SESSION_STAGE', reason: NO_SESSION_STAGES[stage] };
  const b = STAGE_BUDGET[stage];
  if (!b) {
    return { ok: false, code: 'UNKNOWN_STAGE',
      reason: `未知阶段 ${stage}（可派会话的闭集：${Object.keys(STAGE_BUDGET).join('/')}；S6/S7 见 --help）` };
  }
  return { ok: true, ...b };
}

// ── 编排运行时探测（图纸 §会话契约 2·编排器是加速器不是依赖）──────────────
export const NO_RUNTIME_MSG = (bin) =>
  `本机无编排运行时（未找到 \`${bin}\` CLI 或不可执行）·板照常手动用——` +
  `编排器是加速器不是依赖，远程/CI 无 CLI 属预期。手动走：` +
  `node scripts/game-pipeline.mjs board <slug> 看板 → 只做第一个非绿阶段 → gate 落证据。`;

/** which 探测（绝对路径亦可探）。返回 {ok,bin,path} 或 {ok:false,code:'NO_RUNTIME',reason}。 */
export function detectRuntime({ bin = process.env.ZEROCRAFT_ORCH_CLAUDE || 'claude' } = {}) {
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' });
  const path = (probe.stdout || '').trim().split('\n')[0] || '';
  if (probe.status === 0 && path) return { ok: true, bin, path };
  return { ok: false, code: 'NO_RUNTIME', bin, reason: NO_RUNTIME_MSG(bin) };
}

// ── 串行锁（图纸 §会话契约 6·M1 撞车事故律）────────────────────────────────
/** pid 存活判据。EPERM=进程在、只是不归我们管 → 仍算活。 */
export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/** 读锁。**死 pid 自动清锁**（图纸：锁进程死亡=自动清）；锁文件损坏同样按无锁清掉。 */
export function readLock(root) {
  const p = lockPath(root);
  if (!existsSync(p)) return null;
  let rec = null;
  try { rec = JSON.parse(readFileSync(p, 'utf8')); } catch { rec = null; }
  if (!rec || typeof rec !== 'object' || !pidAlive(rec.pid)) { rmSync(p, { force: true }); return null; }
  return rec;
}

/** 原子占锁（O_EXCL）。已有活锁 → {ok:false,holder}；死锁自动清后重试一次。 */
export function acquireLock(root, { slug, stage, pid = process.pid, at = new Date() }, _depth = 0) {
  const held = readLock(root);
  if (held) return { ok: false, code: 'LOCKED', holder: held };
  const rec = { slug, stage, pid, startedAt: at.toISOString(), lastOutputAt: null, attempt: 1 };
  mkdirSync(dirname(lockPath(root)), { recursive: true });
  try {
    const fd = openSync(lockPath(root), 'wx');
    writeSync(fd, JSON.stringify(rec, null, 2) + '\n');
    closeSync(fd);
  } catch (e) {
    if (e.code !== 'EEXIST' || _depth > 0) throw e;
    const h = readLock(root);              // 抢跑：别人刚写进去
    if (h) return { ok: false, code: 'LOCKED', holder: h };
    return acquireLock(root, { slug, stage, pid, at }, _depth + 1); // 那是把死锁，清掉再来
  }
  return { ok: true, lock: rec };
}

/** 心跳/进度写回（只改自己那把锁·别人的一律不动）。节流：默认 1s 内不重复落盘。 */
export function touchLock(root, patch = {}, { pid = process.pid, throttleMs = 1000, now = Date.now() } = {}) {
  const rec = readLock(root);
  if (!rec || rec.pid !== pid) return null;
  const last = Date.parse(rec.lastOutputAt || 0) || 0;
  if (patch.lastOutputAt && !patch.attempt && now - last < throttleMs) return rec; // 流式输出不刷爆磁盘
  const next = { ...rec, ...patch };
  writeFileSync(lockPath(root), JSON.stringify(next, null, 2) + '\n');
  return next;
}

/** 释放锁（只释放自己那把）。 */
export function releaseLock(root, { pid = process.pid } = {}) {
  const p = lockPath(root);
  if (!existsSync(p)) return false;
  let rec = null;
  try { rec = JSON.parse(readFileSync(p, 'utf8')); } catch { rec = null; }
  if (rec && rec.pid !== pid) return false;
  rmSync(p, { force: true });
  return true;
}

// ── 运行台账（status/abort 的终态来源·板 P1b 读这里显 running/stalled/failed）──
export function readRuns(root) {
  try { return JSON.parse(readFileSync(runsPath(root), 'utf8')) || {}; } catch { return {}; }
}
export function writeRun(root, slug, entry) {
  const all = readRuns(root);
  all[slug] = { ...entry, slug };
  mkdirSync(dirname(runsPath(root)), { recursive: true });
  writeFileSync(runsPath(root), JSON.stringify(all, null, 2) + '\n');
  return all[slug];
}

// ── 会话契约·喂料三样 + 固定尾注（图纸 §会话契约 1）────────────────────────
/** 游戏目录（按形态·喂料三之「游戏目录路径」）。 */
export function gameDirFor(root, slug, form = detectForm(root, slug)) {
  return form === 'cart' ? `library/${slug}`
    : form === 'builtin' ? `public/games/${slug}`
      : form === 'compiled' ? `games/${slug}`
        : null;
}

/** 该阶段的「完成动作」命令（gate 阶段跑门；S1/S2 无机器门 → 以板上机器态转绿为准）。 */
export const finishCmdFor = (slug, stage) => GATE_STAGES.includes(stage)
  ? `node scripts/game-pipeline.mjs gate ${slug} ${stage}`
  : `node scripts/game-pipeline.mjs board ${slug}`;

/** 固定尾注（措辞照图纸·**不可协商**·每次 dispatch 逐字相同）。 */
export function sessionFooter(slug, stage) {
  const gated = GATE_STAGES.includes(stage);
  return [
    '【固定尾注·不可协商】',
    `完成动作 = 跑该阶段机器门（\`${finishCmdFor(slug, stage)}\`·退出码直接量·不许经管道）→ 停。`
      + (gated ? '' : `（${stage} 无机器门命令：把该阶段板上「机器门」一栏做成绿，然后停。）`),
    `禁跨阶段抢跑：只做 ${stage} 这一步，做完就停——下一阶段由编排器另派。`,
    '禁碰他人文件：只碰本游戏目录与本阶段产物，引擎/别的游戏/别人的在途改动一律不动。',
    '禁代签人门：signoff / review 永远真人点，编排会话**无特权通道**，与手动会话同门同板。',
    '注：你退出后编排器会**独立重跑一次该阶段门**，以它自己量到的退出码落证据——你自称完成不算数。',
  ].join('\n');
}

/** 喂料只有三样 + 固定尾注。boardText = `board <slug>` 的实时输出（调用方现取现喂）。 */
export function buildSessionPrompt({ root = REPO_ROOT, slug, stage, boardText = '' }) {
  const st = STAGES.find((s) => s.id === stage);
  if (!st) throw new Error(`未知阶段 ${stage}`);
  const dir = gameDirFor(root, slug);
  return [
    `【喂料一·本阶段手册（只读这一本·别翻别的）】${st.handbook}`,
    '',
    `【喂料二·生产流程板实时输出（node scripts/game-pipeline.mjs board ${slug}）】`,
    boardText.trim() || '（板输出为空——按 board 命令自查）',
    '',
    `【喂料三·游戏目录】${dir || `（未知形态：${slug}）`}`,
    '',
    sessionFooter(slug, stage),
  ].join('\n');
}

// ── 薄封装：调 game-pipeline.mjs（不复制其逻辑）──────────────────────────────
const pipelineEnv = (root) => ({ ...process.env, ZEROCRAFT_PIPELINE_ROOT: root });

/** 现取 board 文本（喂料二）。 */
export function boardText(root, slug) {
  const r = spawnSync('node', [PIPELINE_CLI, 'board', slug],
    { cwd: root, encoding: 'utf8', env: pipelineEnv(root), timeout: 120_000 });
  return (r.stdout || '').trim() || (r.stderr || '').trim();
}

/**
 * **独立重验**（图纸 §会话契约 5「绿不靠嘴」）：会话退出后编排器自己 spawn 阶段门，
 * 以**自己量到的退出码**为唯一判据。会话 stdout 声称什么，本函数一个字都不读。
 *  · S3/S4/S5/S8（GATE_STAGES）→ `game-pipeline.mjs gate <slug> <SN>` 退出码直接量；
 *  · S1/S2（无机器门命令）      → `board --json` 重新推导，读该阶段 machine.state（board 自身退出码是
 *                                 「整板是否全绿」，不是本阶段的判据，故只认解析出来的 state）。
 */
export function verifyStage(root, slug, stage, { cmd } = {}) {
  if (cmd) { // 测试注入口（替身门）。生产永远走下面的真门。
    const r = spawnSync(cmd[0], cmd[1], { cwd: root, encoding: 'utf8', env: pipelineEnv(root), timeout: 900_000 });
    return { kind: 'injected', exit: r.status === null ? 1 : r.status, summary: tail(r.stdout || r.stderr || '') };
  }
  if (GATE_STAGES.includes(stage)) {
    const r = spawnSync('node', [PIPELINE_CLI, 'gate', slug, stage],
      { cwd: root, encoding: 'utf8', env: pipelineEnv(root), timeout: 900_000 });
    return { kind: 'gate', exit: r.status === null ? 1 : r.status, summary: tail(r.stdout || r.stderr || '') };
  }
  const r = spawnSync('node', [PIPELINE_CLI, 'board', slug, '--json'],
    { cwd: root, encoding: 'utf8', env: pipelineEnv(root), timeout: 300_000 });
  let state = null;
  try { state = (JSON.parse(r.stdout || '{}').stages || []).find((s) => s.id === stage)?.machine?.state ?? null; }
  catch { state = null; }
  return { kind: 'board', exit: state === 'ok' ? 0 : 1, summary: `板推导 ${stage} 机器门=${state ?? '解析失败'}` };
}

const tail = (s, n = 240) => (s || '').trim().split('\n').slice(-3).join(' / ').slice(-n);

/** 同步小睡（abort 收尸宽限用·不起子进程）。 */
const sleepSync = (ms) => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); };

/**
 * 判定归口（**假信心自查的短路点**）：状态只由**独立重验的退出码**决定。
 * 会话退出码/会话 stdout 一律不参与——把这里改成读会话自述，「谎报完成」测试必须立刻转红。
 */
export function decideStatus(verify) {
  return verify && verify.exit === 0 ? 'done' : 'failed';
}

// ── 会话进程 + 看门狗 ───────────────────────────────────────────────────────
/**
 * 起一个会话进程，600s（可注入）无任何输出即 stalled → SIGTERM → 宽限后 SIGKILL。
 * 心跳=输出（非闹钟）：只要还在吐流就不杀。resolve 永不 reject（起不来也落结构化结果）。
 */
export function runSession({ bin, args, prompt, cwd, idleTimeoutMs, killGraceMs = KILL_GRACE_MS, logFile, onOutput }) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(bin, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      resolve({ outcome: 'spawn-error', code: null, signal: null, bytes: 0, error: String(e && e.message || e) });
      return;
    }
    let bytes = 0, settled = false, idleTimer = null, killTimer = null, outcome = 'exited', error = null;
    const done = (res) => { if (settled) return; settled = true; clearTimeout(idleTimer); clearTimeout(killTimer); resolve(res); };
    const armIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        outcome = 'stalled';
        try { child.kill('SIGTERM'); } catch { /* 已死 */ }
        killTimer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* 已死 */ } }, killGraceMs);
      }, idleTimeoutMs);
    };
    const feed = (buf) => {
      bytes += buf.length;
      if (logFile) { try { appendFileSync(logFile, buf); } catch { /* 日志尽力而为 */ } }
      if (onOutput) onOutput(buf);
      if (outcome !== 'stalled') armIdle(); // 已判停滞就别再续命
    };
    child.stdout.on('data', feed);
    child.stderr.on('data', feed);
    child.on('error', (e) => { error = String(e && e.message || e); done({ outcome: 'spawn-error', code: null, signal: null, bytes, error }); });
    child.on('close', (code, signal) => done({ outcome, code, signal, bytes, error, pid: child.pid }));
    child.stdin.on('error', () => { /* 会话不读 stdin（EPIPE）不是错 */ });
    try { child.stdin.end(prompt ?? ''); } catch { /* 同上 */ }
    armIdle();
  });
}

/** claude CLI 参数（house 约定见 main_entry/claude_code.py：-p 无头·prompt 走 stdin·stream-json 出流）。 */
export function sessionArgs({ effort, maxTurns, extraFlags = [] }) {
  return ['-p', '--output-format', 'stream-json', '--include-partial-messages', '--verbose',
    '--effort', effort, '--max-turns', String(maxTurns), ...extraFlags];
}

// ── dispatch ───────────────────────────────────────────────────────────────
/**
 * 为 <slug> 的 <SN> 阶段派一个匿名无头会话。返回结构化结果（永不抛）。
 * 顺序：形态 → 阶段档位 → 运行时探测 → 占锁 → 喂料 → 会话(+看门狗+重派一次) → **独立重验** → 落台账 → 放锁。
 */
export async function dispatch(opts = {}) {
  const {
    root = REPO_ROOT, slug, stage,
    idleTimeoutMs = Number(process.env.ZEROCRAFT_ORCH_IDLE_MS) || IDLE_TIMEOUT_MS,
    maxAttempts = MAX_ATTEMPTS,
    killGraceMs = KILL_GRACE_MS,
    claudeBin = process.env.ZEROCRAFT_ORCH_CLAUDE || 'claude',
    extraFlags = (process.env.ZEROCRAFT_ORCH_FLAGS || '').split(/\s+/).filter(Boolean),
    verifyCmd = null,   // 测试注入替身门；生产恒 null → 走 verifyStage 真门
    pid = process.pid,
  } = opts;

  const attemptCap = Math.max(1, Number(maxAttempts) || MAX_ATTEMPTS);          // 至少派一次
  const idleMs = Math.max(1, Number(idleTimeoutMs) || IDLE_TIMEOUT_MS);         // 0/NaN 不当秒杀用

  if (!slug || !stage) return { ok: false, code: 'USAGE', reason: '用法：dispatch <slug> <SN>' };
  const form = detectForm(root, slug);
  if (!form) return { ok: false, code: 'UNKNOWN_GAME', slug, reason: `未知游戏: ${slug}（library/ · public/games/ · games/ 均无）` };

  const budget = budgetFor(stage);
  if (!budget.ok) return { ok: false, code: budget.code, slug, stage, reason: budget.reason };

  const rt = detectRuntime({ bin: claudeBin });
  if (!rt.ok) return { ok: false, code: 'NO_RUNTIME', slug, stage, reason: rt.reason };

  const startedAt = new Date();
  const got = acquireLock(root, { slug, stage, pid, at: startedAt });
  if (!got.ok) {
    const h = got.holder;
    return { ok: false, code: 'LOCKED', slug, stage, holder: h,
      reason: `已有会话在跑：${h.slug} ${h.stage}（pid ${h.pid}·起于 ${(h.startedAt || '').slice(0, 19).replace('T', ' ')}）。`
        + '同库同刻只许一个（M1 撞车事故律：双头施工=浪费+冲突）。要抢占先 `abort ' + h.slug + '`。' };
  }

  const prompt = buildSessionPrompt({ root, slug, stage, boardText: boardText(root, slug) });
  const args = sessionArgs({ effort: budget.effort, maxTurns: budget.maxTurns, extraFlags });
  mkdirSync(logDir(root), { recursive: true });
  const logFile = join(logDir(root), `${slug}-${stage}-${startedAt.toISOString().replace(/[:.]/g, '-')}.log`);

  let session = null, attempts = 0, lastBeat = 0;
  try {
    for (let attempt = 1; attempt <= attemptCap; attempt += 1) {
      attempts = attempt;
      touchLock(root, { attempt, lastOutputAt: new Date().toISOString() }, { pid, throttleMs: 0 });
      session = await runSession({
        bin: rt.bin, args, prompt, cwd: root, idleTimeoutMs: idleMs, killGraceMs, logFile,
        // 心跳落锁（P1b 横幅/status 读它判 running vs stalled）。内存节流：1s 一次，流式输出不刷爆 fs。
        onOutput: () => {
          const t = Date.now();
          if (t - lastBeat < 1000) return;
          lastBeat = t;
          touchLock(root, { lastOutputAt: new Date(t).toISOString() }, { pid, throttleMs: 0 });
        },
      });
      if (session.outcome !== 'stalled') break;   // 正常退出（含非零码）→ 交给独立重验裁
      if (attempt < attemptCap) {                 // 停滞 → 杀完自动**重派一次**
        try { appendFileSync(logFile, `\n[orchestrator] ${stage} 会话 ${idleMs}ms 无输出=停滞·已杀·自动重派（第 ${attempt + 1} 次）\n`); } catch { /* 尽力 */ }
      }
    }

    const endedAt = new Date();
    if (session.outcome === 'stalled') {          // 再停 = failed「需人工」（不再重验：会话根本没跑完）
      const entry = { stage, startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), state: 'failed',
        attempts, needsHuman: true, reason: `看门狗：连续 ${attempts} 次 ${idleMs}ms 无输出（停滞）→ 已杀·需人工接手`,
        session: { outcome: session.outcome, code: session.code, signal: session.signal, bytes: session.bytes }, logFile };
      writeRun(root, slug, entry);
      return { ok: false, code: 'STALLED', slug, stage, attempts, session, verify: null, entry, reason: entry.reason };
    }
    if (session.outcome === 'spawn-error') {
      const entry = { stage, startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), state: 'failed',
        attempts, needsHuman: true, reason: `会话起不来：${session.error}`, session, logFile };
      writeRun(root, slug, entry);
      return { ok: false, code: 'NO_RUNTIME', slug, stage, attempts, session, entry, reason: NO_RUNTIME_MSG(claudeBin) };
    }

    // ── 绿不靠嘴：会话说什么不看，编排器自己量 ──
    const verify = verifyStage(root, slug, stage, { cmd: verifyCmd });
    const state = decideStatus(verify);
    const entry = { stage, startedAt: startedAt.toISOString(), endedAt: new Date().toISOString(), state, attempts,
      needsHuman: state !== 'done', verify, logFile,
      session: { outcome: session.outcome, code: session.code, signal: session.signal, bytes: session.bytes },
      reason: state === 'done'
        ? `独立重验 ${verify.kind} 退出码 0 —— 该阶段落绿`
        : `独立重验 ${verify.kind} 退出码 ${verify.exit} —— 会话${session.code === 0 ? '自称完成但' : ''}没把门跑绿·需人工（${verify.summary}）` };
    writeRun(root, slug, entry);
    return { ok: state === 'done', code: state === 'done' ? 'DONE' : 'GATE_FAIL',
      slug, stage, attempts, session, verify, entry, reason: entry.reason };
  } finally {
    releaseLock(root, { pid });
  }
}

// ── status ─────────────────────────────────────────────────────────────────
/** 在跑（锁）+ 最近一次（台账）。状态闭集：running · stalled · done · failed。 */
export function statusFor(root, slug = null, { idleTimeoutMs = Number(process.env.ZEROCRAFT_ORCH_IDLE_MS) || IDLE_TIMEOUT_MS, now = Date.now() } = {}) {
  const rows = [];
  const lock = readLock(root);
  if (lock && (!slug || lock.slug === slug)) {
    const beat = Date.parse(lock.lastOutputAt || lock.startedAt) || now;
    const idleMs = now - beat;
    rows.push({ slug: lock.slug, stage: lock.stage, pid: lock.pid, attempts: lock.attempt || 1,
      startedAt: lock.startedAt, lastOutputAt: lock.lastOutputAt, idleSec: Math.max(0, Math.round(idleMs / 1000)),
      state: idleMs > idleTimeoutMs ? 'stalled' : 'running', live: true });
  }
  for (const [s, e] of Object.entries(readRuns(root))) {
    if (slug && s !== slug) continue;
    if (lock && lock.slug === s) continue;        // 在跑的以锁为准（台账是上一轮的）
    rows.push({ ...e, slug: s, live: false });
  }
  return rows.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

// ── abort ──────────────────────────────────────────────────────────────────
/** 终止该游戏的在跑会话并把该阶段标「中止·需人工」（状态归 failed·aborted 旗标留痕）。 */
export function abort(root, slug, { killGraceMs = KILL_GRACE_MS } = {}) {
  const lock = readLock(root);
  if (!lock) return { ok: false, code: 'NO_SESSION', slug, reason: '当前无在跑会话（锁为空或持锁进程已死·已自动清锁）' };
  if (lock.slug !== slug) {
    return { ok: false, code: 'OTHER_SLUG', slug, holder: lock,
      reason: `在跑的是 ${lock.slug} ${lock.stage}（pid ${lock.pid}），不是 ${slug}——abort 只终止指定游戏，别误杀他人施工` };
  }
  let killed = false;
  try { process.kill(lock.pid, 'SIGTERM'); killed = true; } catch { /* 已死 */ }
  if (killed) {
    const deadline = Date.now() + killGraceMs;
    while (pidAlive(lock.pid) && Date.now() < deadline) sleepSync(50);
    if (pidAlive(lock.pid)) { try { process.kill(lock.pid, 'SIGKILL'); } catch { /* 已死 */ } }
  }
  rmSync(lockPath(root), { force: true });
  const entry = writeRun(root, slug, { stage: lock.stage, startedAt: lock.startedAt, endedAt: new Date().toISOString(),
    state: 'failed', aborted: true, needsHuman: true, attempts: lock.attempt || 1,
    reason: `中止·需人工（人工 abort 终止 pid ${lock.pid}·该阶段未完成，接手前先看板）` });
  return { ok: true, code: 'ABORTED', slug, stage: lock.stage, killedPid: lock.pid, entry, reason: entry.reason };
}

// ── CLI ────────────────────────────────────────────────────────────────────
const EXIT = { DONE: 0, FAILED: 1, USAGE: 2, NO_RUNTIME: 3, LOCKED: 4 };
const exitCodeFor = (code) => code === 'DONE' ? EXIT.DONE
  : code === 'NO_RUNTIME' ? EXIT.NO_RUNTIME
    : code === 'LOCKED' ? EXIT.LOCKED
      : ['USAGE', 'UNKNOWN_GAME', 'UNKNOWN_STAGE', 'NO_SESSION_STAGE'].includes(code) ? EXIT.USAGE
        : EXIT.FAILED;

const USAGE = `用法：
  node scripts/pipeline-orchestrator.mjs dispatch <slug> <SN> [--idle-ms N] [--max-attempts N] [--json]
  node scripts/pipeline-orchestrator.mjs status [slug] [--json]
  node scripts/pipeline-orchestrator.mjs abort <slug> [--json]
退出码：0=done · 1=failed · 2=用法/未知游戏/该阶段无会话 · 3=本机无编排运行时 · 4=已有会话在跑
可派会话阶段：${Object.keys(STAGE_BUDGET).map((s) => `${s}(${STAGE_BUDGET[s].effort})`).join(' · ')}
  ${Object.entries(NO_SESSION_STAGES).map(([k, v]) => `${k}: ${v}`).join('\n  ')}`;

async function main() {
  const argv = process.argv.slice(2);
  const [cmd, a2, a3] = argv;
  const json = argv.includes('--json');
  const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const out = (obj, exit) => { console.log(json ? JSON.stringify(obj) : (obj.reason || obj.message || '')); process.exit(exit); };

  if (cmd === 'dispatch') {
    const o = { root: REPO_ROOT, slug: a2, stage: a3 };
    if (opt('--idle-ms')) o.idleTimeoutMs = Number(opt('--idle-ms'));
    if (opt('--max-attempts')) o.maxAttempts = Number(opt('--max-attempts'));
    if (!a2 || !a3) { console.error(USAGE); process.exit(EXIT.USAGE); }
    const r = await dispatch(o);
    if (json) console.log(JSON.stringify(r));
    else {
      console.log(`${r.ok ? '✅' : '❌'} dispatch ${r.slug} ${r.stage}：${r.reason}`);
      if (r.verify) console.log(`   独立重验（${r.verify.kind}）退出码 ${r.verify.exit} · ${r.verify.summary}`);
      if (r.entry?.logFile) console.log(`   会话日志：${r.entry.logFile}`);
    }
    process.exit(exitCodeFor(r.code));
  }

  if (cmd === 'status') {
    const slug = a2 && !a2.startsWith('--') ? a2 : null;
    const rows = statusFor(REPO_ROOT, slug);
    if (json) { console.log(JSON.stringify({ ok: true, rows })); process.exit(0); }
    if (!rows.length) { console.log('（无在跑会话·无历史记录）'); process.exit(0); }
    const dot = { running: '\x1b[36m◐\x1b[0m', stalled: '\x1b[33m◑\x1b[0m', done: '\x1b[32m●\x1b[0m', failed: '\x1b[31m●\x1b[0m' };
    for (const r of rows) {
      console.log(`${dot[r.state] || '○'} ${r.slug} ${r.stage} · ${r.state}${r.live ? `（pid ${r.pid}·静默 ${r.idleSec}s）` : ''}`);
      console.log(`   起于 ${(r.startedAt || '').slice(0, 19).replace('T', ' ')}${r.lastOutputAt ? ` · 最近心跳 ${r.lastOutputAt.slice(11, 19)}` : ''}${r.attempts ? ` · 第 ${r.attempts} 次尝试` : ''}`);
      if (r.reason) console.log(`   ${r.reason}`);
    }
    process.exit(0);
  }

  if (cmd === 'abort') {
    if (!a2) { console.error(USAGE); process.exit(EXIT.USAGE); }
    const r = abort(REPO_ROOT, a2);
    out(r, r.ok ? 0 : EXIT.USAGE);
  }

  console.error(USAGE);
  process.exit(EXIT.USAGE);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
