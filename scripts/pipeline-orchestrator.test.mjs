// 编排器核自检（REQ-PIPESOFT P1a·图纸 docs/design/pipeline-orchestrator-spec-2026-08.md §P1a「测试·点名」）：
//   ① 锁互斥（双 dispatch 第二个必拒）② 看门狗（stub 慢进程→stalled→重派一次→failed）
//   ③ gate 独立重验（会话谎报完成 → 编排器落 FAIL 证据）④ CLI 缺失优雅拒绝
//
// **零 token 铁律**：全部用替身进程（临时目录里 chmod 755 的 node 小脚本冒充 claude CLI），
// 任何一条测试都不许起真 LLM 会话——所有 dispatch 调用必须显式注入 claudeBin（本容器真有 claude，
// 漏注入=真烧 token）。看门狗超时参数化注入（毫秒级），不真等 600s。
//
// ③ 是**假信心自查点**：把 decideStatus 短路成读会话自述 → 本组必须转红（验证记录见提交说明）。
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  lockPath, runsPath, pidAlive, readLock, acquireLock, releaseLock, touchLock, readRuns,
  budgetFor, STAGE_BUDGET, NO_SESSION_STAGES, detectRuntime, NO_RUNTIME_MSG,
  buildSessionPrompt, sessionFooter, sessionArgs, gameDirFor, decideStatus, verifyStage,
  dispatch, statusFor, abort, IDLE_TIMEOUT_MS, MAX_ATTEMPTS,
} from './pipeline-orchestrator.mjs';

const ORCH_CLI = join(dirname(fileURLToPath(import.meta.url)), 'pipeline-orchestrator.mjs');
const MANIFEST = { name: 'GX', capabilities: [], entities: { hero: { Sprite: { textureKey: 'art:knight' } } } };

const withRoot = async (fn) => {
  const r = mkdtempSync(join(tmpdir(), 'orch-'));
  try { return await fn(r); } finally { rmSync(r, { recursive: true, force: true }); }
};
const put = (root, rel, content) => {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  return p;
};
/** 一个 builtin 形态的假游戏（detectForm→builtin·让 board/gate 认得它）。 */
const fakeGame = (root, slug = 'gx') => { put(root, `public/games/${slug}/manifest.json`, MANIFEST); return slug; };

/** 替身「claude CLI」：chmod 755 的 node 脚本。body 是脚本正文（可读 STUB_* 常量）。 */
const stub = (root, name, body) => {
  const p = put(root, `stubs/${name}`, `#!/usr/bin/env node\n${body}\n`);
  chmodSync(p, 0o755);
  return p;
};
const waitFor = async (fn, ms = 4000, step = 15) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, step)); }
  return false;
};
const lines = (f) => (existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean) : []);

// ═══ ① 锁互斥（图纸 §会话契约 6·M1 撞车事故律：同库双头施工=浪费+冲突）═══════════
describe('① 串行锁互斥', () => {
  it('活 pid 持锁 → 第二个 dispatch 必拒并显示占用方（且一步都不往下走）', () => withRoot(async (root) => {
    const slug = fakeGame(root);
    put(root, '.zerocraft/orchestrator.lock',
      { slug: 'other-game', stage: 'S4', pid: process.pid, startedAt: new Date().toISOString() });
    const marker = join(root, 'spawned.txt');
    const bin = stub(root, 'never', `require('fs').appendFileSync(${JSON.stringify(marker)}, 'x\\n');`);

    const r = await dispatch({ root, slug, stage: 'S3', claudeBin: bin });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('LOCKED');
    expect(r.holder.slug).toBe('other-game');
    expect(r.holder.stage).toBe('S4');
    expect(r.reason).toContain('other-game');
    expect(r.reason).toContain('S4');
    expect(lines(marker)).toHaveLength(0);              // 被拒 = 替身会话一次都没起
    expect(readLock(root).slug).toBe('other-game');     // 别人的锁没被踩
  }));

  it('真·双 dispatch 并发：第二个在第一个跑着的时候被拒（只起了一个会话）', () => withRoot(async (root) => {
    const slug = fakeGame(root);
    const marker = join(root, 'spawned.txt');
    const bin = stub(root, 'slow-ok', [
      `require('fs').appendFileSync(${JSON.stringify(marker)}, 'x\\n');`,
      `console.log('{"type":"stream","text":"working"}');`,
      `setTimeout(() => process.exit(0), 300);`,
    ].join('\n'));

    const first = dispatch({ root, slug, stage: 'S3', claudeBin: bin, idleTimeoutMs: 5000 });
    expect(await waitFor(() => existsSync(lockPath(root)))).toBe(true);   // 一号已占锁

    const second = await dispatch({ root, slug, stage: 'S3', claudeBin: bin, idleTimeoutMs: 5000 });
    expect(second.code).toBe('LOCKED');
    expect(second.holder.slug).toBe(slug);
    expect(second.holder.stage).toBe('S3');

    await first;
    expect(lines(marker)).toHaveLength(1);              // 全程只起过一个会话
    expect(existsSync(lockPath(root))).toBe(false);     // 一号跑完自己放锁
  }));

  it('死 pid 的锁自动清（图纸：锁进程死亡=自动清锁）· 坏 JSON 同样按无锁处理', () => withRoot(async (root) => {
    const dead = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
    expect(dead.status).toBe(0);
    const deadPid = 2147480000;                          // 稳定不存在的 pid（> pid_max）
    expect(pidAlive(deadPid)).toBe(false);

    put(root, '.zerocraft/orchestrator.lock', { slug: 'zombie', stage: 'S4', pid: deadPid, startedAt: '2020-01-01T00:00:00Z' });
    expect(readLock(root)).toBeNull();                   // 读到即清
    expect(existsSync(lockPath(root))).toBe(false);

    put(root, '.zerocraft/orchestrator.lock', 'not json at all');
    expect(readLock(root)).toBeNull();
    const got = acquireLock(root, { slug: 'fresh', stage: 'S3' });
    expect(got.ok).toBe(true);
    expect(readLock(root).slug).toBe('fresh');
  }));

  it('占锁/心跳/放锁：只动自己那把（别人的锁不踩不删）', () => withRoot(async (root) => {
    expect(acquireLock(root, { slug: 'a', stage: 'S3' }).ok).toBe(true);
    expect(acquireLock(root, { slug: 'b', stage: 'S3' }).ok).toBe(false);   // 已被占

    expect(touchLock(root, { lastOutputAt: '2030-01-01T00:00:00.000Z' }, { pid: 999999, throttleMs: 0 })).toBeNull();
    const beat = touchLock(root, { lastOutputAt: '2030-01-01T00:00:00.000Z' }, { throttleMs: 0 });
    expect(beat.lastOutputAt).toBe('2030-01-01T00:00:00.000Z');

    expect(releaseLock(root, { pid: 999999 })).toBe(false);                 // 不是我的，不释放
    expect(existsSync(lockPath(root))).toBe(true);
    expect(releaseLock(root)).toBe(true);
    expect(existsSync(lockPath(root))).toBe(false);
  }));
});

// ═══ ② 看门狗（图纸 §会话契约 4：600s 无输出=stalled → 杀 → 重派一次 → 再停=failed）═══
describe('② 看门狗：停滞→杀→重派一次→failed', () => {
  it('全程静默的慢会话：杀两次（首派+重派一次·不多不少）→ failed「需人工」', () => withRoot(async (root) => {
    const slug = fakeGame(root);
    const marker = join(root, 'spawned.txt');
    const bin = stub(root, 'silent-slow', [
      `require('fs').appendFileSync(${JSON.stringify(marker)}, 'x\\n');`,
      `setTimeout(() => process.exit(0), 30000);`,       // 一个字都不吐（心跳=输出 → 判停滞）
    ].join('\n'));

    const t0 = Date.now();
    const r = await dispatch({ root, slug, stage: 'S3', claudeBin: bin, idleTimeoutMs: 200, killGraceMs: 150 });
    const elapsed = Date.now() - t0;

    expect(r.ok).toBe(false);
    expect(r.code).toBe('STALLED');
    expect(r.attempts).toBe(2);                          // 首派 + 自动重派**一次**
    expect(lines(marker)).toHaveLength(2);               // 真起了两次替身进程，不是三次
    expect(r.session.outcome).toBe('stalled');
    expect(r.entry.state).toBe('failed');
    expect(r.entry.needsHuman).toBe(true);
    expect(r.reason).toContain('停滞');
    expect(elapsed).toBeLessThan(30000);                 // 是被看门狗杀的，不是等它自己跑完
    expect(readRuns(root)[slug].state).toBe('failed');   // 台账落红（status/板读得到）
    expect(existsSync(lockPath(root))).toBe(false);      // 失败也放锁（不留死锁堵后续）
  }), 20000);

  it('有心跳就不杀：慢但持续吐流的会话跑到自然退出（心跳判据非闹钟）', () => withRoot(async (root) => {
    const slug = fakeGame(root);
    const bin = stub(root, 'chatty-slow', [
      `let n = 0;`,
      `const t = setInterval(() => { console.log('{"type":"stream","n":' + (++n) + '}'); if (n >= 6) { clearInterval(t); process.exit(0); } }, 50);`,
    ].join('\n'));
    const r = await dispatch({ root, slug, stage: 'S3', claudeBin: bin, idleTimeoutMs: 200, killGraceMs: 150 });
    expect(r.attempts).toBe(1);                          // 没重派
    expect(r.session.outcome).toBe('exited');            // 自然退出（总时长 300ms > 200ms 空闲阈，但一直有心跳）
    expect(r.session.code).toBe(0);
    expect(r.code).toBe('GATE_FAIL');                    // 会话正常退出 ≠ 阶段绿：还得过独立重验（见 ③）
  }), 20000);

  it('看门狗默认值照图纸：600s / 首派+重派一次', () => {
    expect(IDLE_TIMEOUT_MS).toBe(600_000);
    expect(MAX_ATTEMPTS).toBe(2);
  });
});

// ═══ ③ 独立重验（图纸 §会话契约 5「绿不靠嘴」）· 假信心自查点 ═════════════════
describe('③ 绿不靠嘴：会话谎报完成 → 编排器自己量退出码落 FAIL', () => {
  it('会话高喊「门禁全绿」且退出码 0 —— 编排器真跑 game-pipeline gate 量到 1 → failed', () => withRoot(async (root) => {
    const slug = fakeGame(root);
    const bin = stub(root, 'liar', [
      `console.log('{"type":"result","result":"✅ 全部完成，门禁全绿，S3 已通过，可以推送了"}');`,
      `process.exit(0);`,
    ].join('\n'));

    // 注意：**不注入 verifyCmd** —— 编排器必须自己 spawn 真的 scripts/game-pipeline.mjs gate。
    const r = await dispatch({ root, slug, stage: 'S3', claudeBin: bin, idleTimeoutMs: 5000 });

    expect(r.session.code).toBe(0);                      // 会话自称成功、退出码也是 0
    expect(r.session.outcome).toBe('exited');
    expect(r.verify.kind).toBe('gate');                  // 独立重验走的是真 gate 命令
    expect(r.verify.exit).not.toBe(0);                   // 编排器自己量到的退出码 = 非 0
    expect(r.ok).toBe(false);                            // ← 判定跟着门走，不跟着嘴走
    expect(r.code).toBe('GATE_FAIL');
    expect(r.entry.state).toBe('failed');
    expect(r.entry.needsHuman).toBe(true);
    expect(JSON.parse(readFileSync(runsPath(root), 'utf8'))[slug].state).toBe('failed'); // 证据落盘
  }), 30000);

  it('反向对照：会话退出码 1「自称失败」，但重验绿 → done（判定 100% 由重验决定）', () => withRoot(async (root) => {
    const slug = fakeGame(root);
    const bin = stub(root, 'gloomy', [`console.error('失败了，我放弃');`, `process.exit(1);`].join('\n'));
    const r = await dispatch({
      root, slug, stage: 'S3', claudeBin: bin, idleTimeoutMs: 5000,
      verifyCmd: ['node', ['-e', 'process.exit(0)']],    // 替身门：绿
    });
    expect(r.session.code).toBe(1);
    expect(r.verify.exit).toBe(0);
    expect(r.ok).toBe(true);
    expect(r.entry.state).toBe('done');
  }), 20000);

  it('decideStatus 只读重验退出码（短路它 → 上面两条必转红）', () => {
    expect(decideStatus({ exit: 0 })).toBe('done');
    expect(decideStatus({ exit: 1 })).toBe('failed');
    expect(decideStatus({ exit: 137 })).toBe('failed');
    expect(decideStatus(null)).toBe('failed');
  });

  it('S1/S2 无 gate 命令 → 重验改用 board --json 重新推导该阶段机器态（board 自身退出码不作数）', () => withRoot(async (root) => {
    const slug = fakeGame(root);
    const v = verifyStage(root, slug, 'S1');
    expect(v.kind).toBe('board');
    expect(v.exit).toBe(1);                              // 空立项卡 → 机器态非 ok
    expect(v.summary).toContain('S1');
  }), 20000);
});

// ═══ ④ CLI 缺失优雅拒绝（图纸 §会话契约 2：编排器是加速器不是依赖）═════════════
describe('④ 无编排运行时 → 优雅拒绝', () => {
  it('探测不到 CLI：dispatch 拒绝并说「板照常手动用」·不占锁·不落红账', () => withRoot(async (root) => {
    const slug = fakeGame(root);
    const missing = join(root, 'stubs', 'no-such-claude-binary');
    expect(existsSync(missing)).toBe(false);

    const r = await dispatch({ root, slug, stage: 'S3', claudeBin: missing });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('NO_RUNTIME');
    expect(r.reason).toContain('本机无编排运行时');
    expect(r.reason).toContain('板照常手动用');
    expect(r.reason).toContain('game-pipeline.mjs board');
    expect(existsSync(lockPath(root))).toBe(false);      // 拒绝不占锁
    expect(readRuns(root)).toEqual({});                  // 拒绝 ≠ 该阶段失败：不脏台账
  }));

  it('detectRuntime：缺失→{ok:false}·存在（含绝对路径替身）→{ok:true}', () => withRoot(async (root) => {
    expect(detectRuntime({ bin: join(root, 'nope') }).ok).toBe(false);
    expect(detectRuntime({ bin: join(root, 'nope') }).reason).toBe(NO_RUNTIME_MSG(join(root, 'nope')));
    const bin = stub(root, 'present', 'process.exit(0);');
    const ok = detectRuntime({ bin });
    expect(ok.ok).toBe(true);
    expect(ok.path).toBe(bin);
  }));

  it('CLI 端到端：真跑 pipeline-orchestrator.mjs dispatch → 退出码 3（P1b 靠这码回落手动）', () => withRoot(async (root) => {
    fakeGame(root);
    const r = spawnSync(process.execPath, [ORCH_CLI, 'dispatch', 'gx', 'S3', '--json'], {
      cwd: root, encoding: 'utf8', timeout: 60_000,
      env: { ...process.env, ZEROCRAFT_PIPELINE_ROOT: root, ZEROCRAFT_ORCH_CLAUDE: join(root, 'no-such-claude') },
    });
    expect(r.status).toBe(3);                            // 3=本机无编排运行时（≠1 失败·壳要分得开）
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    expect(out.code).toBe('NO_RUNTIME');
    expect(out.reason).toContain('本机无编排运行时');
  }), 60000);
});

// ═══ 阶段档位映射（图纸 §会话契约 3）═════════════════════════════════════════
describe('阶段档位与预算', () => {
  it('S1/S8=low · S2/S3=medium · S4/S5=high', () => {
    expect(budgetFor('S1')).toMatchObject({ ok: true, effort: 'low' });
    expect(budgetFor('S8')).toMatchObject({ ok: true, effort: 'low' });
    expect(budgetFor('S2')).toMatchObject({ ok: true, effort: 'medium' });
    expect(budgetFor('S3')).toMatchObject({ ok: true, effort: 'medium' });
    expect(budgetFor('S4')).toMatchObject({ ok: true, effort: 'high' });
    expect(budgetFor('S5')).toMatchObject({ ok: true, effort: 'high' });
    for (const b of Object.values(STAGE_BUDGET)) expect(b.maxTurns).toBeGreaterThan(0); // 预算永远封顶
  });

  it('S6/S7 拒绝 dispatch 并说明去哪儿办（美术平台 / 人门）', () => withRoot(async (root) => {
    const slug = fakeGame(root);
    for (const s of ['S6', 'S7']) {
      expect(budgetFor(s)).toMatchObject({ ok: false, code: 'NO_SESSION_STAGE' });
      const r = await dispatch({ root, slug, stage: s, claudeBin: '/definitely/not/here' });
      expect(r.code).toBe('NO_SESSION_STAGE');
      expect(r.reason).toBe(NO_SESSION_STAGES[s]);
      expect(existsSync(lockPath(root))).toBe(false);
    }
    expect(NO_SESSION_STAGES.S6).toContain('美术平台');
    expect(NO_SESSION_STAGES.S7).toContain('人门');
    expect((await dispatch({ root, slug, stage: 'S9', claudeBin: '/nope' })).code).toBe('UNKNOWN_STAGE');
    expect((await dispatch({ root, slug: 'no-such-game', stage: 'S3', claudeBin: '/nope' })).code).toBe('UNKNOWN_GAME');
  }));

  it('CLI 参数带 --effort/--max-turns 封顶（house 约定：-p 无头 + stream-json）', () => {
    const a = sessionArgs({ effort: 'high', maxTurns: 120 });
    expect(a).toContain('-p');
    expect(a[a.indexOf('--effort') + 1]).toBe('high');
    expect(a[a.indexOf('--max-turns') + 1]).toBe('120');
    expect(a).toContain('stream-json');
  });
});

// ═══ 会话契约·喂料三样 + 固定尾注（图纸 §会话契约 1）═══════════════════════════
describe('喂料只有三样 + 固定尾注', () => {
  it('恰好三样：本阶段手册 + board 实时输出 + 游戏目录（不多喂一样）', () => withRoot(async (root) => {
    const slug = fakeGame(root);
    const p = buildSessionPrompt({ root, slug, stage: 'S4', boardText: '●S3 骨架关 OK\n○S4 玩法关 待做' });
    expect(p.match(/【喂料/g)).toHaveLength(3);          // 三样，一样不多
    expect(p).toContain('docs/playbooks/testing.md');    // 一·S4 手册（取自 STAGES 手册列·不另抄一张表）
    expect(p).toContain('○S4 玩法关 待做');               // 二·board 实时输出原样
    expect(p).toContain(`public/games/${slug}`);         // 三·游戏目录（按形态）
    expect(gameDirFor(root, slug)).toBe(`public/games/${slug}`);
  }));

  it('固定尾注逐条到位：完成动作=跑门量退出码 · 禁跨阶段 · 禁碰他人文件 · 禁代签人门', () => {
    const f = sessionFooter('gx', 'S4');
    expect(f).toContain('game-pipeline.mjs gate gx S4');
    expect(f).toContain('退出码直接量');
    expect(f).toContain('禁跨阶段抢跑');
    expect(f).toContain('禁碰他人文件');
    expect(f).toContain('禁代签人门');
    expect(f).toContain('无特权通道');
    expect(f).toContain('你自称完成不算数');              // 尾注里就把「绿不靠嘴」说死
    expect(sessionFooter('gx', 'S1')).toContain('board gx'); // S1 无 gate 命令 → 完成动作改口径
  });
});

// ═══ status / abort ════════════════════════════════════════════════════════
describe('status（running·stalled·done·failed）', () => {
  it('活锁按心跳分 running / stalled；无锁时读台账终态', () => withRoot(async (root) => {
    const now = Date.now();
    put(root, '.zerocraft/orchestrator.lock',
      { slug: 'gx', stage: 'S4', pid: process.pid, startedAt: new Date(now - 5000).toISOString(), lastOutputAt: new Date(now - 1000).toISOString(), attempt: 1 });
    const running = statusFor(root, null, { idleTimeoutMs: 600_000, now });
    expect(running).toHaveLength(1);
    expect(running[0]).toMatchObject({ slug: 'gx', stage: 'S4', state: 'running', live: true });

    const stalled = statusFor(root, null, { idleTimeoutMs: 500, now });
    expect(stalled[0].state).toBe('stalled');
    expect(stalled[0].idleSec).toBe(1);

    rmSync(lockPath(root), { force: true });
    put(root, '.zerocraft/orchestrator-runs.json', {
      gx: { stage: 'S4', state: 'done', startedAt: '2026-08-04T01:00:00.000Z' },
      gy: { stage: 'S3', state: 'failed', startedAt: '2026-08-04T02:00:00.000Z', needsHuman: true },
    });
    const hist = statusFor(root, null, { now });
    expect(hist.map((r) => r.state)).toEqual(['failed', 'done']);   // 新的在前
    expect(statusFor(root, 'gx', { now })).toHaveLength(1);         // 按 slug 过滤
    expect(statusFor(root, 'nobody', { now })).toHaveLength(0);
  }));
});

describe('abort（终止在跑会话 → 标「中止·需人工」）', () => {
  it('杀掉持锁进程·清锁·台账标 aborted+needsHuman', () => withRoot(async (root) => {
    const victim = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' });
    await waitFor(() => pidAlive(victim.pid));
    put(root, '.zerocraft/orchestrator.lock', { slug: 'gx', stage: 'S5', pid: victim.pid, startedAt: new Date().toISOString() });

    const r = abort(root, 'gx', { killGraceMs: 400 });
    expect(r.ok).toBe(true);
    expect(r.code).toBe('ABORTED');
    expect(r.stage).toBe('S5');
    expect(r.killedPid).toBe(victim.pid);
    expect(r.reason).toContain('中止·需人工');
    expect(existsSync(lockPath(root))).toBe(false);
    const entry = readRuns(root).gx;
    expect(entry).toMatchObject({ stage: 'S5', state: 'failed', aborted: true, needsHuman: true });
    expect(await waitFor(() => !pidAlive(victim.pid), 3000)).toBe(true);
    expect(statusFor(root, 'gx')[0].state).toBe('failed');
  }), 20000);

  it('无会话 / 别的游戏在跑 → 拒绝（不误杀他人施工）', () => withRoot(async (root) => {
    expect(abort(root, 'gx')).toMatchObject({ ok: false, code: 'NO_SESSION' });
    put(root, '.zerocraft/orchestrator.lock', { slug: 'other', stage: 'S3', pid: process.pid, startedAt: new Date().toISOString() });
    const r = abort(root, 'gx');
    expect(r).toMatchObject({ ok: false, code: 'OTHER_SLUG' });
    expect(r.reason).toContain('other');
    expect(existsSync(lockPath(root))).toBe(true);        // 别人的锁原封不动
  }));
});
