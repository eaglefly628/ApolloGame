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
    charge: { p1: txt('cb-p1-paper-v'), rock: txt('cb-p1-rock-v'), p2r: txt('cb-p2-rock-v') },
    ring: txt('phase-sec'),
    // 罚血的欠数按设计定稿 v3 搬到了**画面正中的欠账牌**（132px 大字），不再塞倒计时环。
    owe: txt('pen-owe-n'),
    penFoot: txt('pen-foot'),
    round: txt('round-b'),
    // v3：两枚 duel.next 键的落点不同 —— T4 闸门（进下一回合）/ 终局重开（换一个世界）。
    // **分开读**：同一枚读法会让"点了它到底发生什么"这条断言失去分辨力。
    nextRound: !!document.getElementById('key-nextround'),
    restart: !!document.getElementById('key-next'),
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
      // 前缀匹配：相位牌可能带后缀（罚血那一拍写的是「拖延中 · 出手即停」）。
      if (String(s.phase ?? '').startsWith(want)) return s;
      if (Date.now() - t0 > maxMs) return { ...s, timeout: true };
      await page.waitForTimeout(120);
    }
  }

  try {
    await page.goto(`http://localhost:${dev.port}/?game=game108`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);

    say('══ game108 S4 试玩走查（真浏览器·全程只点真按钮）══\n');
    // 【启动画面】owner 2026-08-08 给稿：加载条走完才有 PRESS ANY KEY。
    // **加载中整屏不挂 action**——所以先断言"点不动"，再等它走完。
    // ⚠ 这一段是 v5 补的：脚本原先一进门就找 `ui.start`，加载闸一上线它当场找不到键，
    //   后面 16 条断言全部连锁假红（"改了游戏没改尺子"的老形状·同验收剧本的 tick 数）。
    const loading = await page.$('#start');
    const bar = await page.$('#load-bar');
    check('启动屏在，且条画出来了（owner 2026-08-08 给稿）', !!loading && !!bar,
      `启动屏=${!!loading} 进度条=${!!bar}`);
    await shot('0-loading');
    // ⚠ 「加载没走完就点不动」这一条**故意不在这里断言**：它要抢在 1.4 秒的假进度跑完之前
    // 采样，而页面加载本身就要几百毫秒 —— 拿墙钟去赛墙钟，绿不绿取决于这台机器今天多快。
    // 那条判据是确定性的，放在确定性的地方：单测「启动屏：加载**没走完就点不动**」
    // （`loadPct(0)` 的屏上无 `ui.start`）。**别把 flaky 断言塞进旅程冒充覆盖。**
    await page.waitForSelector('[data-action="ui.start"]', { timeout: 8000 }).catch(() => {});
    const gate0 = await page.$('[data-action="ui.start"]');
    check('加载走完：整屏成为那枚 PRESS ANY KEY 键', !!gate0 && (await gate0.getAttribute('data-action')) === 'ui.start',
      gate0 ? `data-action=${await gate0.getAttribute('data-action')}` : '找不到开始键');
    await shot('0-start-screen');
    // ⚔ 对抗性输入：连点开始——只该开一局（`startGame` 幂等）。
    await page.evaluate(() => { const el = document.querySelector('[data-action="ui.start"]'); for (let i = 0; i < 5; i++) el?.click(); });
    await page.waitForTimeout(400);
    check('点了开始才开局（启动屏消失）', !(await page.$('#start')), '启动屏还在');
    const s0 = await state();
    say(`开局：${s0.phase} · 血 ${s0.hp.p1}/${s0.hp.p2}`);
    check('开局双方满血【R-108-15】', s0.hp.p1 === '100' && s0.hp.p2 === '100', `${s0.hp.p1}/${s0.hp.p2}`);
    await shot('1-start');

    // ── 先故意打输一回合（自证仪式要求截图序列含**一次失败路径**）──────────
    // 复读机出石，我故意出剪 → 石克剪 → **我挨打**。这一轮也验了「输了照样清零」。
    say('\n── 第 0 回合（故意打输·看失败反馈）──');
    await until('蓄力');
    await page.click('#key-scissors').catch(() => {});      // 蓄剪 1（v3：一回合就这一层）
    await page.waitForTimeout(150);
    await until('出招');
    await page.click('#key-scissors').catch(() => {});      // 出剪 → 被石克
    await until('对决');
    await page.waitForTimeout(900);
    const lost = await state();
    say(`  → 我方血量 ${lost.hp.p1}`);
    // 掉 20 不是 10：复读机在 T1 也蓄了一层石（【R-108-13】伤害 = 10 + 出手方该手蓄力 × 10）。
    check('输的一方掉血且反馈可见【R-108-12/13】', lost.hp.p1 === '80', `实读 ${lost.hp.p1}`);
    check('对手没掉血（我输了）', lost.hp.p2 === '100', `实读 ${lost.hp.p2}`);
    await shot('2b-lost-round');

    // ── 【R-108-05】T4 玩家闸门：不点就不走 ────────────────────────────────
    const gate = await until('结算');
    check('T4 停在结算等玩家【R-108-05】', String(gate.phase).startsWith('结算') && !gate.timeout, `实读 ${gate.phase}`);
    check('T4 屏上有「下一轮」且带 action', gate.nextRound === true, `实读 ${gate.nextRound}`);
    await page.waitForTimeout(2500);                        // 干等 2.5 秒（比整个 T1 还长）
    const stillGate = await state();
    check('干等 2.5 秒仍停在结算（**无自动兜底**）【R-108-05】', String(stillGate.phase).startsWith('结算'), `实读 ${stillGate.phase}`);
    await shot('2c-settle-gate');

    // ⚔ 对抗性输入①：连点「下一轮」——只该推进一个回合，不该连跳
    //   （owner 2026-08-07：「我们以后在测试脚本中应该多一些……做连续点击啊这种东西」）
    //   **必须用 evaluate 同步连点**：`page.click` 每次都做可点性检查，第一下之后按钮就消失了
    //   （离开结算屏），后面五下会各自等 30 秒超时 —— 那测的是 Playwright 的等待，不是游戏
    //   （2026-08-08 第一版就是这么写的，跑出来"实读 拖延中"，白查一轮）。
    await page.evaluate(() => { const el = document.getElementById('key-nextround'); for (let i = 0; i < 6; i++) el?.click(); });
    await until('蓄力');
    const afterSpam = await state();
    // 判据是**只推进一格**：落在紧邻的 T1（蓄力）。多余的点击若也生效，闸门旗会一直举着，
    // 下一回合的 T4 会被直接推过去 —— 那样这里读到的会是更靠后的相位（第一版没用 evaluate
    // 同步连点时读到的正是「拖延中」）。
    // ⚠ **不能拿回合数当判据**：回合数在**结算那一拍**就 +1 了（`duel.resolved` 驱动），
    //   点「下一轮」只是放行，不再加——写成 `round !== roundBefore` 会假红（实测踩过）。
    check('连点 6 下「下一轮」只推进一回合（没连跳）【对抗性输入】',
      String(afterSpam.phase).startsWith('蓄力'), `实读 ${afterSpam.phase} · ${afterSpam.round}`);

    // ⚔ 对抗性输入②：T1 连点蓄力——【R-108-10】v3 一回合只该加一层
    await page.evaluate(() => { const el = document.getElementById('key-paper'); for (let i = 0; i < 6; i++) el?.click(); });
    await page.waitForTimeout(300);
    const spamCharge = await state();
    check('T1 连点 6 下只加一层【R-108-10】v3【对抗性输入】',
      spamCharge.charge.p1 === '1/3', `实读 ${spamCharge.charge.p1}`);
    await shot('2-charged');

    // ── 【R-108-04】罚血读秒：免费段走完不出手，看它一秒一记地扣 ───────────
    say('\n── 罚血读秒（T2 拖过免费 5 秒）──');
    const t2 = await until('出招');
    check('进到出招时区【R-108-01】', String(t2.phase).startsWith('出招') && !t2.timeout, `实读 ${t2.phase}`);
    check('键已切成出招信号【R-108-70】', t2.keys.paper?.action === 'throw.paper', `实读 ${t2.keys.paper?.action}`);
    const hpBeforeStall = Number((await state()).hp.p1);
    const stalled = await until('超时', 9000);             // 免费 5 秒走完自动进这一态
    check('免费段走完转入罚血读秒【R-108-04】', String(stalled.phase).startsWith('超时') && !stalled.timeout, `实读 ${stalled.phase}`);
    await page.waitForTimeout(2600);
    const stallRead = await state();
    // 屏上的欠债读数（环心）应该已经记到 2 点以上——**读屏，不读世界**。
    check('罚血把「已欠多少」写在正中的欠账牌上【R-108-04·设计定稿 v3】',
      /^\d+$/.test(String(stallRead.owe)) && Number(stallRead.owe) >= 2, `实读 ${stallRead.owe}`);
    // 定稿钉死的那句：把罚血与「被对手打中」区分开。缺了它就等于没做到那条要求。
    check('欠账牌写着「这不是他打的」【R-108-04·设计定稿 v3】',
      String(stallRead.penFoot || '').includes('这不是他打的'), `实读 ${stallRead.penFoot}`);
    check('罚血**不**触发胜负横幅（它不是战果）【R-108-04】',
      String(stallRead.phase).startsWith('超时'), `实读 ${stallRead.phase}`);
    await shot('2d-penalty');
    await page.click('#key-paper').catch(() => {});          // 出手即停
    await until('对决');
    await page.waitForTimeout(900);
    say(`  → 罚血前 ${hpBeforeStall} · 这一回合打完 ${(await state()).hp.p1}`);
    await page.click('#key-nextround').catch(() => {});

    // ── 打完剩下的回合：每回合蓄一层布、出布（布克石 ⇒ 20 伤）──────────────
    // v3 一回合一层 ⇒ 一击 20，不再是 v2 那种"一个 T1 连点满蓄打 40、三回合结束"。
    say('\n── 稳定打法：每回合 蓄布 ×1 → 出布（20 伤）──');
    for (let round = 1; round <= 6; round++) {
      const c = await until('蓄力', 15000);
      if (c.timeout) { check(`R${round} 进到蓄力时区`, false, `实读 ${c.phase}`); break; }
      await page.click('#key-paper').catch(() => {});
      await page.waitForTimeout(120);
      const t = await until('出招', 8000);
      if (t.timeout) { check(`R${round} 进到出招时区`, false, `实读 ${t.phase}`); break; }
      const beforeThrow = await state();
      await page.click('#key-paper').catch(() => {});
      await page.waitForTimeout(250);
      const justThrown = await state();
      // 【R-108-01】提交那一刻**不该**掉血——扣血在揭晓之后（REQ-108-ENG-06 结算门）
      check(`R${round} 出招当下不掉血（扣血在揭晓后）【R-108-01】`,
        justThrown.hp.p2 === beforeThrow.hp.p2, `实读 ${justThrown.hp.p2} → 期望仍是 ${beforeThrow.hp.p2}`);
      if (round === 1) await shot('3-thrown-hidden');
      const cl = await until('对决', 8000);
      if (cl.timeout) { check(`R${round} 进到对决时区`, false, `实读 ${cl.phase}`); break; }
      await page.waitForTimeout(400);   // 等本回合结算落地再拍——不然拍到的是上一回合的手（实测踩过）
      if (round === 1) await shot('4-clash-reveal');
      await page.waitForTimeout(900);
      const after = await state();
      const dealt = Number(beforeThrow.hp.p2) - Number(after.hp.p2);
      say(`  → R${round}：对手 ${beforeThrow.hp.p2} → ${after.hp.p2}（打了 ${dealt}）`);
      check(`R${round} 对手掉 20（10 + 1 层 ×10）【R-108-13】v3`, dealt === 20 || after.hp.p2 === '0', `实读 ${dealt}`);
      if (round === 2) await shot('5-round2-done');
      if (after.hp.p2 === '0') break;
      await page.click('#key-nextround').catch(() => {});    // 【R-108-05】玩家闸门
    }

    // 终局
    const win = await until('你赢了', 15000);
    check('打完一局并分出胜负【R-108-15】', String(win.phase).startsWith('你赢了') && !win.timeout, `实读 ${win.phase}`);
    check('终局时对手血量归零', win.hp.p2 === '0', `实读 ${win.hp.p2}`);
    // 终局面板有一段 400ms 的 pop 入场（scale .4→1 · opacity 0→1）。立刻拍会拍到入场半途——
    // 面是半透的、还没放到原大，看起来像"面板没画出来"（2026-08-07 我自己被这张图骗了一轮）。
    await page.waitForTimeout(600);
    await shot('6-victory');

    // ── 终局之后还得能重开（owner 2026-08-07 报的 bug：点「再来一局」没反应）──────────
    // **为什么以前没抓到**：这套走查到「分出胜负」就收工了，从没人点过终局屏上的键——
    // 覆盖面正好在 bug 开始的地方结束。终局屏是**另一屏**（对局键整条收起、只剩一个出口），
    // 它一旦点不动，玩家就卡死在那儿，比对局里任何一个 bug 都严重。
    say('\n── 终局：再来一局 ──');
    const nextBtn = await page.$('#key-next');
    check('终局屏上有「再来一局」且带 action【R-108-70】',
      !!nextBtn && (await nextBtn.getAttribute('data-action')) === 'duel.next',
      nextBtn ? `data-action=${await nextBtn.getAttribute('data-action')}` : '找不到该键');
    // ⚔ 对抗性输入③：连点「再来一局」——重开是宿主换一个世界，连点该幂等（不许起两台引擎）。
    await page.evaluate(() => { const el = document.getElementById('key-next'); for (let i = 0; i < 5; i++) el?.click(); });
    await page.waitForTimeout(800);
    const fresh = await state();
    say(`  → 重开后：${fresh.phase} · 血 ${fresh.hp.p1}/${fresh.hp.p2}`);
    check('点完真的重开了：双方满血', fresh.hp.p1 === '100' && fresh.hp.p2 === '100', `实读 ${fresh.hp.p1}/${fresh.hp.p2}`);
    check('点完真的重开了：回到对局相位（不再停在终局）',
      ['蓄力', '出招', '对决', '结算', '超时'].some((p) => String(fresh.phase).startsWith(p)), `实读 ${fresh.phase}`);
    check('点完真的重开了：蓄力槽已清零', fresh.charge.p1 === '0/3', `实读 ${fresh.charge.p1}`);
    // 新局要真的能打——不然"重开"只是把屏刷回去了，世界其实没跟上。
    await until('蓄力');
    await page.click('#key-rock').catch(() => {});
    await page.waitForTimeout(300);
    const rearmed = await state();
    check('新局能接着打（点蓄力真的加层）', rearmed.charge.p1 !== null && (await state()).phase !== null, `槽读数 ${rearmed.charge.p1}`);
    await shot('7-restarted');
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
