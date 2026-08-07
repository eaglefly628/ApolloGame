#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/game108-playthrough.mjs —— S4 玩法关「真人能不能打完一局」试玩走查
//
//  为什么还要这一道（验收剧本不是已经 7/7 绿了吗）：
//  验收剧本驱动的是**引擎**（adapter 直接喂 world），DOM 那一半从不参与。S3 的点击门证的是
//  「点得动」，但它刻意只验最小项、不碰玩法。中间这段没人管：**真人在浏览器里，靠真按钮，
//  能不能从开局打到分出胜负**。本仓的 S4 门也明写要「附真浏览器试玩截图序列（非仅 CLI 绿）」。
//
//  做法：真起 vite → 真 Chromium → **全程只点真按钮**（不碰世界、不注入任何东西）
//  → 打满三回合把复读机打死 → 每个关键节点截图 + 把 DOM 读回来断言。
//
//  用法：node scripts/game108-playthrough.mjs
//  退出码：0 = 打完且赢了 · 1 = 断言未过 · 3 = 本机无浏览器（跳过·同 R1 语义）
//  产物：public/games/game108/probe/S4-play-*.png（截图序列）+ S4-play.{log,json}
// ═══════════════════════════════════════════════════════════════

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectBrowserRuntime, startDevServer, stopDevServer } from './lib/render-harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'games', 'game108', 'probe');

const log = [];
const say = (l) => { log.push(l); console.log(l); };
const checks = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  say(`  ${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const READ = `(() => {
  const txt = (id) => document.getElementById(id)?.textContent?.trim() ?? null;
  const key = (h) => { const el = document.getElementById('key-' + h);
    return el ? { disabled: !!el.disabled, action: el.getAttribute('data-action') } : null; };
  return { phase: txt('phase-t'),
    hp: { p1: txt('side-p1-hpv'), p2: txt('side-p2-hpv') },
    charge: { p1: txt('cb-p1-paper-v'), p2r: txt('cb-p2-rock-v') },
    keys: { rock: key('rock'), paper: key('paper'), scissors: key('scissors') } };
})()`;

async function main() {
  const rt = detectBrowserRuntime();
  if (!rt.ok) { console.error('本机无 Chromium，跳过'); process.exit(3); }
  const { chromium } = await import('playwright');
  const dev = await startDevServer(ROOT);
  const browser = await chromium.launch({ executablePath: rt.execPath });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`未捕获异常: ${e.message}`));
  await page.route('**/api/generate/providers', (r) => r.fulfill({ status: 200, body: '[]' }));
  await page.route('**/api/library', (r) => r.fulfill({ status: 200, body: '[]' }));

  mkdirSync(OUT, { recursive: true });
  const shot = (t) => page.screenshot({ path: join(OUT, `S4-play-${t}.png`) });
  const state = () => page.evaluate(READ);
  /** 等到相位变成 want（最多 wait 秒）——**不靠猜时间**，靠真读屏上的相位名。 */
  async function until(want, maxMs = 12000) {
    const t0 = Date.now();
    for (;;) {
      const s = await state();
      if (s.phase === want) return s;
      if (Date.now() - t0 > maxMs) return { ...s, timeout: true };
      await page.waitForTimeout(120);
    }
  }

  try {
    await page.goto(`http://localhost:${dev.port}/?game=game108`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);

    say('══ game108 S4 试玩走查（真浏览器·全程只点真按钮）══\n');
    const s0 = await state();
    say(`开局：${s0.phase} · 血 ${s0.hp.p1}/${s0.hp.p2}`);
    check('开局双方满血【R-108-15】', s0.hp.p1 === '100' && s0.hp.p2 === '100', `${s0.hp.p1}/${s0.hp.p2}`);
    await shot('1-start');

    // 战术：复读机永远出石 → 每回合满蓄「布」出布（布克石·40 伤）→ 三回合打死。
    const EXPECT = ['60', '20', '0'];
    for (let round = 1; round <= 3; round++) {
      say(`\n── 第 ${round} 回合 ──`);
      const c = await until('蓄力');
      check(`R${round} 进到蓄力时区`, c.phase === '蓄力' && !c.timeout, `实读 ${c.phase}`);

      for (let i = 0; i < 3; i++) { await page.click('#key-paper').catch(() => {}); await page.waitForTimeout(120); }
      const ch = await state();
      check(`R${round} 满蓄布 3/3【R-108-10】`, ch.charge.p1 === '3/3', `实读 ${ch.charge.p1}`);
      if (round === 1) await shot('2-charged');

      const t = await until('出招');
      check(`R${round} 进到出招时区【R-108-01】`, t.phase === '出招' && !t.timeout, `实读 ${t.phase}`);
      check(`R${round} 键已切成出招信号【R-108-70】`, t.keys.paper?.action === 'throw.paper', `实读 ${t.keys.paper?.action}`);

      // 【R-108-01】提交那一刻**不该**掉血——扣血在揭晓之后（REQ-108-ENG-06 结算门）
      await page.click('#key-paper').catch(() => {});
      await page.waitForTimeout(250);
      const justThrown = await state();
      check(`R${round} 出招当下不掉血（扣血在揭晓后）【R-108-01】`,
        justThrown.hp.p2 === (round === 1 ? '100' : EXPECT[round - 2]), `实读 ${justThrown.hp.p2}`);
      if (round === 1) await shot('3-thrown-hidden');

      const cl = await until('对决');
      check(`R${round} 进到对决时区（亮拳）`, cl.phase === '对决' && !cl.timeout, `实读 ${cl.phase}`);
      if (round === 1) await shot('4-clash-reveal');

      await page.waitForTimeout(700);
      const after = await state();
      say(`  → 对手血量 ${after.hp.p2}（打了 ${100 - Number(after.hp.p2) - (round > 1 ? 100 - Number(EXPECT[round - 2]) : 0)}）`);
      check(`R${round} 对手掉 40（10+3×10）【R-108-13】`, after.hp.p2 === EXPECT[round - 1], `实读 ${after.hp.p2} 期望 ${EXPECT[round - 1]}`);
      check(`R${round} 玩家没被打（复读机被克）【R-108-12】`, after.hp.p1 === '100', `实读 ${after.hp.p1}`);
      if (round === 2) await shot('5-round2-done');
    }

    // 终局
    const win = await until('你赢了');
    check('打完一局并分出胜负【R-108-15】', win.phase === '你赢了' && !win.timeout, `实读 ${win.phase}`);
    check('终局时对手血量归零', win.hp.p2 === '0', `实读 ${win.hp.p2}`);
    await shot('6-victory');
    say('');
    check('全程控制台零 error / 零未捕获异常', errors.length === 0, errors.join(' | ') || '干净');
  } finally {
    await browser.close();
    stopDevServer(dev.proc);
  }

  const bad = checks.filter((c) => !c.pass);
  const ok = bad.length === 0;
  say(`\n══ 结论：${ok ? `✅ 全部 ${checks.length} 条通过——真人靠真按钮打完了一整局` : `❌ ${bad.length}/${checks.length} 条未过`} ══`);
  writeFileSync(join(OUT, 'S4-play.log'), log.join('\n') + '\n');
  writeFileSync(join(OUT, 'S4-play.json'), JSON.stringify({ ok, checks, consoleErrors: errors }, null, 2) + '\n');
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
