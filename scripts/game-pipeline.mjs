#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/game-pipeline.mjs —— 逐游戏生产流程板（owner 2026-07-10：
//  「不能靠一个手册让 LLM 一口气跑完整条流程——要 N 步拆分·每步做完对手册 review·反复迭代」）
//
//  治的病：LLM 长流程上下文丢失/漂移（game-k RCA=会话早于手册·plan 门没接住）。
//  药方＝把「流程走到哪了」放到 LLM 之外：
//    · 状态**从工件推导**（manifest/测试/台账/审计真跑），不信模型的口头汇报；
//    · 跑过的机器门记**证据**（退出码+游戏内容指纹）——游戏文件一动，证据自动标过期，绿不是永久绿；
//    · 每步双验（double verify）：机器门（本脚本 gate 真跑）+ 人门（signoff 落账·带 note）；
//    · 台账=public/games/<slug>/pipeline.json——新 session 先 board 再干活，只做第一个非绿阶段。
//
//  八阶段（每阶段一本手册·≤80 行·弱模型也读得完）：
//    S1 立项卡 → S2 能力计划 → S3 骨架关 → S4 玩法关 → S5 UI 关 → S6 美术关 → S7 品质关 → S8 终检关
//
//  用法：
//    node scripts/game-pipeline.mjs board <slug> [--json]      看板（推导态·不跑重活）
//    node scripts/game-pipeline.mjs gate <slug> <S3|S4|S5|S8>  跑该阶段机器门→记证据
//    node scripts/game-pipeline.mjs signoff <slug> <SN> --note "…" [--by 名]   人门落账
//    node scripts/game-pipeline.mjs concept <slug> --name "…" --pitch "…" [--refs …] [--style …] [--plan-waiver 理由]
//  线手册：docs/playbooks/game-production.md。
// ═══════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const readJson = (f, fb) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return fb; } };
const writeJson = (f, v) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(v, null, 2) + '\n'); };

export const pipelineFile = (root, slug) => join(root, 'public', 'games', slug, 'pipeline.json');

// 游戏形态：cart=创作台卡带（library/）· builtin=内置纯数据（public/games/<slug>/manifest.json tracked）· compiled=编译期（src/games/）。
export function detectForm(root, slug) {
  if (existsSync(join(root, 'library', slug, 'manifest.json'))) return 'cart';
  if (existsSync(join(root, 'public', 'games', slug, 'manifest.json'))) return 'builtin';
  if (existsSync(join(root, 'src', 'games', slug))) return 'compiled';
  return null;
}

const manifestPath = (root, slug, form) =>
  form === 'cart' ? join(root, 'library', slug, 'manifest.json')
    : form === 'builtin' ? join(root, 'public', 'games', slug, 'manifest.json')
      : null;

/** 游戏内容指纹：只哈希**这款游戏自己的**输入（manifest/源码/美术/设计档），引擎全局变化由 S8 的 git HEAD 兜。
 *  排除 pipeline.json 自身（记证据不得自我过期）与 gen/mock/（mock 预览物不影响出货内容）。 */
export function gameHash(root, slug) {
  const roots = [
    join(root, 'library', slug),
    join(root, 'public', 'games', slug),
    join(root, 'src', 'games', slug),
    join(root, 'docs', 'design', slug),
  ];
  const files = [];
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) { if (name !== 'mock') walk(p); continue; } // gen/mock/ 预览物不入指纹
      if (name === 'pipeline.json') continue;
      files.push(p);
    }
  };
  for (const r of roots) walk(r);
  const h = createHash('sha256');
  for (const f of files) { h.update(relative(root, f)); h.update('\0'); h.update(readFileSync(f)); h.update('\0'); }
  return h.digest('hex').slice(0, 16);
}

// ── 阶段表（id·名·手册·机器门语义）。手册列=该步开工前唯一必读（每本 ≤80 行）。──
export const STAGES = [
  { id: 'S1', title: '立项卡', handbook: 'docs/llm-onboarding.md', gate: null },
  { id: 'S2', title: '能力计划', handbook: 'docs/design/capability-plan-template.md', gate: null },
  { id: 'S3', title: '骨架关', handbook: 'docs/playbooks/index.md', gate: 'manifest-check' },
  { id: 'S4', title: '玩法关', handbook: 'docs/playbooks/testing.md', gate: 'walkthrough' },
  { id: 'S5', title: 'UI 关', handbook: 'docs/playbooks/ui.md', gate: 'audit' },
  { id: 'S6', title: '美术关', handbook: 'docs/playbooks/art-pipeline.md', gate: null },
  { id: 'S7', title: '品质关', handbook: 'docs/playbooks/visual-scorecard.md', gate: null },
  { id: 'S8', title: '终检关', handbook: 'docs/playbooks/testing.md', gate: 'full-suite' },
];
export const GATE_STAGES = STAGES.filter((s) => s.gate).map((s) => s.id);

const led = (root, slug) => readJson(join(root, 'public', 'games', slug, 'art', 'art-ledger.json'), null);

/** mock 债：live 行（非 retired）里 gen.mock 的计数——「mock 永不上画面」在终检关的机器化表达。无台账=0（纯免费库 placeholder 也算清账）。 */
export function mockDebt(root, slug) {
  const l = led(root, slug);
  if (!l || !Array.isArray(l.rows)) return 0;
  return l.rows.filter((r) => r.status !== 'retired' && r.gen?.mock).length;
}

/** 立项卡写入（字段级合并·只覆盖出现的字段）。CLI concept 与 /api/pipeline/concept 共用。 */
export function writeConcept(root, slug, fields) {
  const pf = readJson(pipelineFile(root, slug), { version: 1, slug, concept: {}, signoffs: {}, evidence: {} });
  for (const k of ['name', 'pitch', 'refs', 'style', 'planWaiver']) {
    if (fields[k] !== undefined) pf.concept[k] = fields[k];
  }
  (pf.history ||= []).push({ action: 'concept', at: new Date().toISOString() });
  writeJson(pipelineFile(root, slug), pf);
  return pf.concept;
}

/** 美术关子状态（复用美术平台五步条口径·纯推导）：MOCK 行不算完成——mock 永不上画面（owner 07-10）。 */
export function artSubState(root, slug) {
  const l = led(root, slug);
  if (!l || !Array.isArray(l.rows) || !l.rows.length) return { state: 'dim', detail: '无台账（美术平台进游戏自动初始化 / POST /api/art/derive）' };
  const live = l.rows.filter((r) => r.status !== 'retired');
  const mockN = live.filter((r) => r.gen?.mock).length;
  const wrote = live.filter((r) => ['replaced', 'filled', 'approved'].includes(r.status)).length;
  const ok = live.filter((r) => r.status === 'approved').length;
  const anchor = !!(l.artStyle && (l.artStyle.stylePrompt || l.artStyle.packId));
  const detail = `台账 ${live.length} 行 · 锚${anchor ? '✓' : '✗'} · 写回 ${wrote} · 复核 ${ok}${mockN ? ` · MOCK ${mockN}（不算完成）` : ''}`;
  if (ok === live.length && live.length > 0 && mockN === 0) return { state: 'ok', detail };
  if (wrote > 0 || anchor || live.some((r) => r.status !== 'placeholder' && r.status !== 'needs-art')) return { state: 'warn', detail };
  return { state: 'warn', detail }; // 有台账即已开工（placeholder 版也是流程一步）
}

/** 机器门证据评估：无证据=dim；exit≠0=fail；指纹过期=stale；否则 ok。 */
function evalEvidence(ev, freshHash, headNow) {
  if (!ev) return { state: 'dim', detail: '未跑（gate 跑一次落证据）' };
  const when = (ev.at || '').slice(0, 16).replace('T', ' ');
  if (ev.exit !== 0) return { state: 'fail', detail: `✗ 未过（exit ${ev.exit} @ ${when}）${ev.summary ? ' · ' + ev.summary : ''}` };
  if (ev.gameHash && ev.gameHash !== freshHash) return { state: 'stale', detail: `⚠ 证据过期（游戏文件已变动·须重跑）· 上次绿 @ ${when}` };
  if (ev.head && (ev.head !== headNow || ev.dirty)) return { state: 'stale', detail: `⚠ 证据过期（${ev.dirty ? '跑时工作树不净' : '仓库已前进'}）· 上次绿 @ ${when}` };
  return { state: 'ok', detail: `✓ 过（@ ${when}）${ev.summary ? ' · ' + ev.summary : ''}` };
}

/** 看板推导（读盘+轻推导·不跑重活）。绿=机器 ok/免 + 人门 ok；任何一边欠=黄；机器 fail=红。 */
export function boardFor(root, slug) {
  const form = detectForm(root, slug);
  if (!form) return { ok: false, error: `未知游戏: ${slug}（library/public/src 三处均无）` };
  const pf = readJson(pipelineFile(root, slug), { version: 1, slug, concept: {}, signoffs: {}, evidence: {} });
  const hashNow = gameHash(root, slug);
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout?.trim() || '';
  const c = pf.concept || {};
  const hasTests = form !== 'cart' && existsSync(join(root, 'src', 'games', slug))
    && readdirSync(join(root, 'src', 'games', slug)).some((f) => f.endsWith('.test.ts'));
  const planFile = join(root, 'docs', 'design', slug, 'capability-plan.md');

  const stages = STAGES.map((st) => {
    let machine;
    switch (st.id) {
      case 'S1':
        machine = c.name && c.pitch
          ? { state: 'ok', detail: `${c.name} —— ${String(c.pitch).slice(0, 40)}` }
          : { state: 'dim', detail: '立项卡未填（concept 子命令：--name --pitch）' };
        break;
      case 'S2':
        machine = existsSync(planFile)
          ? { state: 'ok', detail: 'capability-plan.md 在档' }
          : c.planWaiver
            ? { state: 'ok', detail: `纯数据卡带免正式 plan（裁决在案：${String(c.planWaiver).slice(0, 40)}）` }
            : { state: 'dim', detail: '无能力计划也无免 plan 裁决（模板见手册列）' };
        break;
      case 'S3':
        machine = manifestPath(root, slug, form)
          ? evalEvidence(pf.evidence?.S3, hashNow, head)
          : { state: 'ok', detail: '编译期游戏无 manifest（本关免·玩法关直接接管）' };
        break;
      case 'S4':
        machine = evalEvidence(pf.evidence?.S4, hashNow, head);
        if (machine.state === 'dim') machine.detail = form === 'cart' ? '未跑（gate=bench 五轴体检）' : hasTests ? '未跑（gate=该游戏 vitest）' : '✗ 无 walkthrough 测试（testing.md：先补测试再谈玩法完成）';
        if (machine.state === 'dim' && form !== 'cart' && !hasTests) machine.state = 'fail';
        break;
      case 'S5':
        machine = form === 'cart'
          ? { state: 'ok', detail: '纯数据卡带无游戏层代码（LayoutNode 纪律天然满足）' }
          : evalEvidence(pf.evidence?.S5, hashNow, head);
        break;
      case 'S6':
        machine = artSubState(root, slug);
        break;
      case 'S7':
        machine = { state: 'ok', detail: '本关以人门为主（评分卡得分记进 signoff note）' };
        break;
      case 'S8':
        machine = evalEvidence(pf.evidence?.S8, hashNow, head);
        if (machine.state === 'dim') machine.detail = form === 'cart' ? '未跑（gate=manifest-check+bench+MOCK 清账·卡带轻量终检）' : '未跑（gate=tsc+vitest+build 三绿）';
        break;
      default:
        machine = { state: 'dim', detail: '' };
    }
    const so = pf.signoffs?.[st.id];
    // S6 人门已内嵌美术平台逐行 approve（不设重复签核）；其余阶段一律要 signoff。
    const human = st.id === 'S6'
      ? { state: machine.state === 'ok' ? 'ok' : 'dim', detail: '人门=平台逐行 ☑ 复核（已内嵌·不另签）' }
      : so
        ? { state: 'ok', detail: `✓ ${so.by || '人审'} @ ${(so.at || '').slice(0, 10)}${so.note ? ' · ' + String(so.note).slice(0, 60) : ''}` }
        : { state: 'dim', detail: '待人审（signoff 落账）' };
    const status = machine.state === 'fail' ? 'fail'
      : machine.state === 'ok' && human.state === 'ok' ? 'ok'
        : machine.state === 'dim' && human.state === 'dim' ? 'dim' : 'warn';
    return { id: st.id, title: st.title, handbook: st.handbook, gate: st.gate, machine, human, status };
  });
  const next = stages.find((s) => s.status !== 'ok');
  return { ok: true, slug, form, gameHash: hashNow, concept: c, stages, next: next ? next.id : null };
}

// ── 机器门执行（gate 子命令·真跑·记证据）──────────────────────────────
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', timeout: 900_000, ...opts });

function gateRun(slug, stage, form) {
  if (stage === 'S3') {
    const mf = manifestPath(ROOT, slug, form);
    if (!mf) return { exit: 0, summary: '编译期游戏免 manifest 校验' };
    const r = run('npx', ['vite-node', 'scripts/manifest-check.mjs'], { input: readFileSync(mf, 'utf8') });
    return { exit: r.status ?? 1, summary: r.status === 0 ? 'parse+引擎装载（load+2tick）零 error' : (r.stderr || r.stdout || '').trim().slice(0, 300) };
  }
  if (stage === 'S4') {
    if (form === 'cart') {
      const mf = manifestPath(ROOT, slug, form);
      const r = run('npx', ['vite-node', 'scripts/bench-manifest.mjs'], { input: readFileSync(mf, 'utf8') });
      let pass = false, score = '?';
      try { const j = JSON.parse((r.stdout || '').trim().split('\n').pop()); pass = !!j.pass; score = j.score; } catch { /* 输出非 JSON 即失败 */ }
      return { exit: pass ? 0 : 1, summary: `bench 五轴 score=${score}` };
    }
    const r = run('npx', ['vitest', 'run', `src/games/${slug}/`]);
    const tail = (r.stdout || '').trim().split('\n').filter((l) => /Tests|Test Files/.test(l)).join(' · ');
    return { exit: r.status ?? 1, summary: tail.slice(0, 200) || (r.stderr || '').slice(0, 200) };
  }
  if (stage === 'S5') {
    if (form === 'cart') return { exit: 0, summary: '纯数据卡带免审计' };
    const r = run('node', ['scripts/game-skill-audit.mjs', slug]);
    const verdict = (r.stdout || '').split('\n').filter((l) => /^(AUDIT|RATCHET):/.test(l)).join(' · ');
    return { exit: r.status ?? 1, summary: verdict || (r.stderr || '').slice(0, 200) };
  }
  if (stage === 'S8') {
    if (form === 'cart') {
      // 卡带轻量终检（REQ-WORKSHOP C2·Lead 裁决）：纯数据卡带不背全仓门——
      // mock 债清零（「mock 永不上画面」的终检表达）∧ 完整性（manifest-check）∧ 可玩健康（bench 五轴）。
      // 债最便宜先查（不给 mock 未清的卡带白跑重门）。
      const debt = mockDebt(ROOT, slug);
      if (debt > 0) return { exit: 1, summary: `✗ MOCK 债 ${debt} 行未清（mock 不算真图·重生成或清账后再终检）` };
      const mf = manifestPath(ROOT, slug, form);
      const chk = run('npx', ['vite-node', 'scripts/manifest-check.mjs'], { input: readFileSync(mf, 'utf8') });
      if ((chk.status ?? 1) !== 0) return { exit: chk.status ?? 1, summary: `✗ manifest-check · ${(chk.stderr || chk.stdout || '').trim().slice(0, 200)}` };
      const b = run('npx', ['vite-node', 'scripts/bench-manifest.mjs'], { input: readFileSync(mf, 'utf8') });
      let pass = false, score = '?';
      try { const j = JSON.parse((b.stdout || '').trim().split('\n').pop()); pass = !!j.pass; score = j.score; } catch { /* 输出非 JSON 即失败 */ }
      if (!pass) return { exit: 1, summary: `✗ bench 五轴 score=${score}` };
      return { exit: 0, summary: `cart 终检：MOCK 0 · manifest-check=0 · bench score=${score}` };
    }
    const steps = [
      ['npx', ['tsc', '--noEmit']],
      ['npx', ['vitest', 'run', '--silent']],
      ['npm', ['run', 'build']],
    ];
    const parts = [];
    for (const [cmd, args] of steps) {
      const r = run(cmd, args);
      parts.push(`${args[0]}=${r.status ?? 1}`);
      if ((r.status ?? 1) !== 0) return { exit: r.status ?? 1, summary: `✗ ${parts.join(' ')} · ${(r.stderr || r.stdout || '').trim().slice(0, 200)}` };
    }
    return { exit: 0, summary: `tsc+vitest+build 三绿（${parts.join(' ')}）` };
  }
  return { exit: 1, summary: `阶段 ${stage} 无机器门` };
}

// ── CLI ─────────────────────────────────────────────────────────
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const [cmd, slug, a3] = process.argv.slice(2);
  const argv = process.argv.slice(2);
  const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  if (!cmd || !slug) { console.error('用法: game-pipeline.mjs <board|gate|signoff|concept> <slug> …（头注有全表）'); process.exit(1); }
  const form = detectForm(ROOT, slug);
  if (!form) { console.error(`未知游戏: ${slug}`); process.exit(1); }

  if (cmd === 'board') {
    const b = boardFor(ROOT, slug);
    if (argv.includes('--json')) { console.log(JSON.stringify(b)); process.exit(b.ok ? 0 : 1); }
    console.log(`══ 生产流程板 · ${slug}（${form}）══`);
    const dot = { ok: '\x1b[32m●\x1b[0m', warn: '\x1b[33m●\x1b[0m', fail: '\x1b[31m●\x1b[0m', dim: '\x1b[90m○\x1b[0m' };
    for (const s of b.stages) {
      console.log(`${dot[s.status]} ${s.id} ${s.title}  〔手册: ${s.handbook}〕`);
      console.log(`   机器门: ${s.machine.detail}`);
      console.log(`   人  门: ${s.human.detail}`);
    }
    console.log(b.next ? `\n→ 下一步：${b.next}（只做这一步·做完 gate/signoff 再看板）` : '\n✔ 全绿——可推进发布/换皮量产');
    process.exit(0);
  }
  if (cmd === 'gate') {
    const stage = a3;
    if (!GATE_STAGES.includes(stage)) { console.error(`gate 只认 ${GATE_STAGES.join('/')}（其余阶段是纯推导或纯人门）`); process.exit(1); }
    const res = gateRun(slug, stage, form);
    const pf = readJson(pipelineFile(ROOT, slug), { version: 1, slug, concept: {}, signoffs: {}, evidence: {} });
    const ev = { exit: res.exit, summary: res.summary, at: new Date().toISOString() };
    if (stage === 'S8' && form !== 'cart') {
      // 全仓门证据绑仓库位置（引擎一动即过期）；cart 轻量门只看游戏自身内容 → 绑 gameHash（C2）
      ev.head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout?.trim() || '';
      ev.dirty = (spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).stdout || '').trim().length > 0;
    } else {
      ev.gameHash = gameHash(ROOT, slug);
    }
    pf.evidence = { ...(pf.evidence || {}), [stage]: ev };
    (pf.history ||= []).push({ action: 'gate', stage, exit: res.exit, at: ev.at });
    writeJson(pipelineFile(ROOT, slug), pf);
    console.log(JSON.stringify({ ok: res.exit === 0, slug, stage, ...ev }));
    process.exit(res.exit === 0 ? 0 : 1);
  }
  if (cmd === 'signoff') {
    const stage = a3;
    const note = opt('--note');
    if (!STAGES.some((s) => s.id === stage) || stage === 'S6') { console.error('signoff 阶段非法（S6 人门=美术平台逐行复核·不另签）'); process.exit(1); }
    if (!note || !note.trim()) { console.error('人门必须带 --note（review 内容落账·不许空签）'); process.exit(1); }
    const pf = readJson(pipelineFile(ROOT, slug), { version: 1, slug, concept: {}, signoffs: {}, evidence: {} });
    const so = { by: opt('--by') || 'owner', note: note.trim().slice(0, 500), at: new Date().toISOString() };
    pf.signoffs = { ...(pf.signoffs || {}), [stage]: so };
    (pf.history ||= []).push({ action: 'signoff', stage, at: so.at });
    writeJson(pipelineFile(ROOT, slug), pf);
    console.log(JSON.stringify({ ok: true, slug, stage, ...so }));
    process.exit(0);
  }
  if (cmd === 'concept') {
    const fields = {};
    for (const [k, flag] of [['name', '--name'], ['pitch', '--pitch'], ['refs', '--refs'], ['style', '--style'], ['planWaiver', '--plan-waiver']]) {
      const v = opt(flag);
      if (v !== undefined) fields[k] = v;
    }
    const concept = writeConcept(ROOT, slug, fields);
    console.log(JSON.stringify({ ok: true, slug, concept }));
    process.exit(0);
  }
  console.error(`未知子命令: ${cmd}`);
  process.exit(1);
}
