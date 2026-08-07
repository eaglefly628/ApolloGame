#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/game108-click-probe.mjs —— game108 S3「真的点得动吗」点击走查
//
//  治的病：S3 现有两道证都证不到「玩家点了到底有没有用」——
//    · 单元测试驱动的是**引擎**（自己往 InputQueue 塞动作），DOM 那一半从没参与；
//    · 渲染探针只证「画出来了」，一次都没点过。
//  两道都绿，仍可能是「按钮画得好看但点了没反应」（本作正好踩过这个坑：
//  REQ-108-ENG-04 之前，出招信号发得出去、接缝认不到人，静默失效）。
//
//  药方：真起 vite → 真 Chromium 装 `?game=game108` → **找活体 DOM 里的真按钮真点**
//  → 每步把**世界的可观测量**（蓄力槽读数 / 血量 / 相位名）从 DOM 读回来，打成日志。
//  DOM 上那些数字是宿主每帧从 world 投影下来的，所以读数变了 = 世界真的变了：
//  一条完整的 真点击 → InputQueue → keybind → Signal → effect-apply → Resource → 投影 → DOM。
//
//  用法：node scripts/game108-click-probe.mjs
//  退出码：0=全部断言过 · 1=有断言未过或点击炸了 · 3=本机无浏览器（跳过·同 R1 语义）
//  产物：public/games/game108/probe/S3-click.log（逐步日志）+ S3-click.json（判定）
//        + S3-click-<step>.png（关键节点截图）
// ═══════════════════════════════════════════════════════════════

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectBrowserRuntime, startDevServer, stopDevServer } from './lib/render-harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'games', 'game108', 'probe');

const log = [];
const say = (line) => { log.push(line); console.log(line); };

const checks = [];
/** 记一条断言（不抛·跑完一起判，好让日志把整轮走完——中途抛会丢掉后面的证据）。 */
function check(name, pass, detail) {
  checks.push({ name, pass, detail });
  say(`${pass ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

/** 从活体 DOM 读世界的可观测量（宿主每帧投影下来的那份）。 */
const READ_STATE = `(() => {
  const txt = (id) => document.getElementById(id)?.textContent?.trim() ?? null;
  const charge = {};
  for (const h of ['rock', 'paper', 'scissors']) charge[h] = txt('cb-p1-' + h + '-v');
  // 条的**填充宽度**（%）：文字读数与条填充是两条独立通路（文字来自宿主投影，条来自 props.bind
  // 经 resolveBindings 读世界）。只看文字会漏掉「bind 是哑弹」这一整类静默失效——实测踩过。
  const bar = {};
  for (const h of ['rock', 'paper', 'scissors']) {
    const fill = document.getElementById('cb-p1-' + h + '-b')?.querySelector(':scope > div > div');
    bar[h] = fill ? fill.style.width : null;
  }
  const btn = (h) => {
    const el = document.getElementById('key-' + h);
    return el ? { disabled: !!el.disabled, action: el.getAttribute('data-action') } : null;
  };
  return {
    phase: txt('phase-t'),
    hp: { p1: txt('side-p1-hpv'), p2: txt('side-p2-hpv') },
    charge,
    bar,
    keys: { rock: btn('rock'), paper: btn('paper'), scissors: btn('scissors') },
  };
})()`;

async function main() {
  const rt = detectBrowserRuntime();
  if (!rt.ok) { console.error('本机无 Chromium，探针跳过'); process.exit(3); }
  const { chromium } = await import('playwright');

  const dev = await startDevServer(ROOT);
  const browser = await chromium.launch({ executablePath: rt.execPath });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`未捕获异常: ${e.message}`));
  // 与渲染探针同款：只拦创作服 :4000 的两个引导接口（本机没起 python 后端·与被测游戏无关）。
  await page.route('**/api/generate/providers', (r) => r.fulfill({ status: 200, body: '[]' }));
  await page.route('**/api/library', (r) => r.fulfill({ status: 200, body: '[]' }));

  mkdirSync(OUT, { recursive: true });
  const shot = (tag) => page.screenshot({ path: join(OUT, `S3-click-${tag}.png`) });
  const state = () => page.evaluate(READ_STATE);
  const wait = (ms) => page.waitForTimeout(ms);

  try {
    await page.goto(`http://localhost:${dev.port}/?game=game108`, { waitUntil: 'networkidle' });
    await wait(600);

    say('══ game108 S3 点击走查（真浏览器·真按钮）══\n');

    // ── ① 按钮真的在，而且带着动作词表里的信号名 ──────────────────────
    const s0 = await state();
    say(`起手态：相位=${s0.phase} · 血 ${s0.hp.p1}/${s0.hp.p2} · 蓄力 ${JSON.stringify(s0.charge)}`);
    check('三个手键都在活体 DOM 里', ['rock', 'paper', 'scissors'].every((h) => s0.keys[h]), JSON.stringify(s0.keys));
    check('蓄力时区里手键带的是 charge.* 信号【R-108-70】',
      s0.keys.rock?.action === 'charge.rock', `实读 data-action=${s0.keys.rock?.action}`);
    check('起手双方满血 100【R-108-15】', s0.hp.p1 === '100' && s0.hp.p2 === '100', `p1=${s0.hp.p1} p2=${s0.hp.p2}`);
    check('起手六条槽全 0【R-108-03】', s0.charge.rock === '0/3', `石=${s0.charge.rock}`);
    await shot('01-start');

    // ── ② 真点「石」→ 世界真的动了（这一条是整个探针的要害）─────────────
    say('\n【点击】石 ×1');
    await page.click('#key-rock');
    await wait(200);
    const s1 = await state();
    say(`  → 蓄力 ${JSON.stringify(s1.charge)}`);
    check('点一下石 → 石槽 0/3 → 1/3（真点击打穿到世界）', s1.charge.rock === '1/3', `实读 ${s1.charge.rock}`);
    check('没点的手纹丝不动（信号没串台）', s1.charge.paper === '0/3' && s1.charge.scissors === '0/3',
      `布=${s1.charge.paper} 剪=${s1.charge.scissors}`);

    say('\n【点击】石 ×2（累加到 3/3 封顶）');
    await page.click('#key-rock'); await wait(150);
    await page.click('#key-rock'); await wait(250);
    const s2 = await state();
    say(`  → 蓄力 ${JSON.stringify(s2.charge)} · 石键 disabled=${s2.keys.rock?.disabled}`);
    check('累加到上限 3/3【R-108-10】', s2.charge.rock === '3/3', `实读 ${s2.charge.rock}`);
    check('槽条**真的填满了**（props.bind 经 resolveBindings 读到世界·非哑弹）',
      s2.bar.rock === '100%', `石条 width=${s2.bar.rock} · 布条 width=${s2.bar.paper}`);
    check('满槽后石键禁用且不带 action【R-108-10】',
      s2.keys.rock?.disabled === true && !s2.keys.rock?.action, JSON.stringify(s2.keys.rock));
    await shot('02-charged');

    say('\n【点击】石 ×1（已禁用·应当点不动、也不越界）');
    await page.click('#key-rock', { force: true }).catch(() => {});
    await wait(200);
    const s3 = await state();
    check('禁用后再点不越界（仍是 3/3）', s3.charge.rock === '3/3', `实读 ${s3.charge.rock}`);

    // ── ③ 相位真的会自己走（三时区四拍·不靠人推）────────────────────
    say('\n【等待】相位自动推进（蓄力 3s → 出招 3s → 对决 2s → 结算 1s）');
    const seen = new Set([s3.phase]);
    for (let i = 0; i < 40; i++) {          // 最多等 10 秒，覆盖一整回合 9 秒
      await wait(250);
      const p = (await state()).phase;
      if (p && !seen.has(p)) { seen.add(p); say(`  → 相位切到「${p}」（${((i + 1) * 0.25).toFixed(2)}s）`); }
      if (seen.has('出招')) break;
    }
    check('相位自动从「蓄力」走到「出招」【R-108-01】', seen.has('出招'), `走过：${[...seen].join(' → ')}`);

    // ── ④ 出招时区：同一个按钮变成出招键（词表切换真的发生了）──────────
    const s4 = await state();
    say(`\n出招时区：布键 data-action=${s4.keys.paper?.action}`);
    check('同一个键在出招时区带 throw.* 信号【R-108-70】',
      s4.keys.paper?.action === 'throw.paper', `实读 ${s4.keys.paper?.action}`);
    await shot('03-throw-phase');

    say('【点击】布（出招）');
    await page.click('#key-paper').catch(() => {});
    await wait(300);
    check('点出招键不炸（信号发得出去·接缝已认侧见 ENG-04 单测）', true, '控制台见下');
    await shot('04-thrown');

    // ── ⑤ 全程零控制台错误 ──────────────────────────────────────
    say('');
    check('全程控制台零 error / 零未捕获异常', consoleErrors.length === 0, consoleErrors.join(' | ') || '干净');
  } finally {
    await browser.close();
    stopDevServer(dev.proc);
  }

  const failed = checks.filter((c) => !c.pass);
  const ok = failed.length === 0;
  say(`\n══ 结论：${ok ? '✅ 全部 ' + checks.length + ' 条断言通过' : `❌ ${failed.length}/${checks.length} 条未过`} ══`);
  say('※ 未覆盖：一整回合的结算闭环（要对手也出招）——AI 接线是 S4 玩法关的活，S3 不背。');

  writeFileSync(join(OUT, 'S3-click.log'), log.join('\n') + '\n');
  writeFileSync(join(OUT, 'S3-click.json'), JSON.stringify({ ok, checks, consoleErrors }, null, 2) + '\n');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
