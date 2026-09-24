// ═══════════════════════════════════════════════════════════════
//  scripts/game112-playthrough.mjs —— S4 玩法关「真人能不能靠真按钮走完 Loop-0」试玩走查（self-check.md 仪式）
//
//  验收剧本驱动的是引擎（adapter 直接喂 world），DOM 那一半从不参与；S3 点击门只验最小项。
//  本脚本：真起 vite → 真 Chromium → **全程只点真按钮**（不碰世界、不注入）→
//  标题 → 主厅 → 陪坐攒星砂/心光 → 星砂铺买纸袋 → 玩具篮放到馆里 → 主厅目击新物件 →
//  回忆廊 → 读完一段回忆（含选择）→ **终局出口必点**（「回到回忆廊」是阅读屏唯一出口）→ 回主厅再陪一次。
//  每个节点截图 + 把 DOM 读回来断言（数字真的变了，不只是屏刷新了）。
//  尾段：① 全屏巡游（关于/晶球厅/星牌桌/设置——把每个屏上出现过的 data-action 全收集起来，
//  与 ui.ts UI_ACTIONS 词表求差集 = 八问第 7 问的机读部分；ui-inventory.mjs 只扫自走相位的游戏，菜单驱动的本作用这里）
//  ② 模拟离开 3 小时再回馆（拨页面的 Date.now——宿主墙钟输入；档有 checksum 不可拨·世界不碰）→
//  「你不在的时候」小事件展开 → 「看过了」回收 → 进度（星砂）随存档带回。
//
//  用法：node scripts/game112-playthrough.mjs
//  退出码：0 = 走完且断言全过 · 1 = 断言未过 · 3 = 本机无浏览器（跳过·同 R1 语义）
//  产物：docs/design/game112/self-check/shots/S4-play-*.png（自证截图序列·S4 门查 ≥5）+ S4-play.{log,json}
// ═══════════════════════════════════════════════════════════════
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectBrowserRuntime, startDevServer, stopDevServer } from './lib/render-harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'design', 'game112', 'self-check', 'shots');

const log = [];
const say = (l) => { log.push(l); console.log(l); };
const checks = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  say(`  ${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

/** 只读屏：数字从 DOM 文本读回来（不碰世界）。 */
const READ = `(() => {
  const txt = (id) => document.getElementById(id)?.textContent?.trim() ?? null;
  const num = (s) => { const m = String(s ?? '').match(/(\\d+)/); return m ? Number(m[1]) : null; };
  const has = (id) => !!document.getElementById(id);
  const actions = Array.from(document.querySelectorAll('[data-action]')).map((e) => e.getAttribute('data-action'));
  return {
    screen: document.querySelector('[data-ui-id]')?.getAttribute('data-ui-id') ?? null,
    stardust: num(txt('hall-stardust') ?? txt('shop-stardust')),
    mood: txt('hall-mood'), catLine: txt('hall-cat-line'), orbSub: txt('hot-orbs-sub'),
    hasHall: has('hall-cat'), hasShop: has('shop-grid'), hasToys: has('toys-title'), hasMemory: has('memory-list'),
    hasReading: has('reading-dialog'), hasReadingNext: has('reading-next'), hasReadingEnd: has('reading-end'),
    hasChoices: has('reading-choices'), placedFeather: has('hall-placed-paperbag'), offlineAck: has('hall-offline-ack'),
    hasNav: has('navbar'), hasStageShow: has('hall-stage-show'), hasOrbs: has('orbs-title'), hasTable: has('table-note'), hasSettings: has('settings-title'), hasAbout: has('about-title'),
    offlineText: txt('hall-offline-0'),
    ownedBadge: txt('shop-paperbag-own'), chapterState: txt('chap-xuetuan-1-state'),
    actions,
  };
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
  // 每次试玩从空档开始（存档在 localStorage·不清会带上次进度）。**只清一次**——initScript 每次导航都跑，
  // 尾段「回馆」要 reload 带档回来；用 sessionStorage 记号防第二次清（第 1b 轮实测：reload 后档被清成空档）。
  await page.addInitScript(() => {
    try { if (!sessionStorage.getItem('pw-cleared')) { localStorage.clear(); sessionStorage.setItem('pw-cleared', '1'); } } catch { /* 无 */ }
    // 「离开了多久」= 宿主墙钟（game112.ts mount 的 now()）——拨钟不拨档：存档信封的 checksum 盖住 savedAt，
    // 改档 = 坏档 → 空档（第 1b 轮实测·防篡改是对的）。故尾段回馆用 Date.now 加偏移模拟真过了 3 小时。
    try {
      const off = Number(sessionStorage.getItem('pw-clock-offset') ?? 0);
      if (off > 0) { const real = Date.now.bind(Date); Date.now = () => real() + off; }
    } catch { /* 无 */ }
  });

  mkdirSync(OUT, { recursive: true });
  // 词表真相 = ui.ts UI_ACTIONS 字面量（抽不出来就报错，绝不猜空表假绿）。
  const uiSrc = readFileSync(join(ROOT, 'games', 'game112', 'ui.ts'), 'utf8');
  const vocabM = uiSrc.match(/export const UI_ACTIONS = \[([\s\S]*?)\] as const;/);
  if (!vocabM) { console.error('抽不出 UI_ACTIONS 词表（ui.ts 形状变了）'); process.exit(1); }
  const vocab = [...vocabM[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const seen = new Set();
  let n = 0;
  const shot = async (t) => { n += 1; await page.screenshot({ path: join(OUT, `S4-play-${String(n).padStart(2, '0')}-${t}.png`) }); };
  const state = async () => { const st = await page.evaluate(READ); for (const a of st.actions) seen.add(a); return st; };
  const click = async (sel, wait = 320) => {
    const ok = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return false; el.click(); return true; }, sel);
    await page.waitForTimeout(wait);
    return ok;
  };
  /** 点某个 data-action 控件；第二参可以是 data-arg（字符串）或等待毫秒（数字）。 */
  const clickAction = (a, arg, wait) => {
    if (typeof arg === 'number') { wait = arg; arg = undefined; }
    return click(arg === undefined ? `[data-action="${a}"]` : `[data-action="${a}"][data-arg="${arg}"]`, wait);
  };

  try {
    await page.goto(`http://localhost:${dev.port}/?game=game112`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    say('══ game112 S4 试玩走查（真浏览器·全程只点真按钮·Loop-0）══\n');

    let s;
    await shot('title');
    s = await state();
    check('标题页：主 CTA「回到星尾馆」在', s.actions.includes('home.enter'));
    await clickAction('home.about');
    s = await state();
    check('关于页：情感红线文案在（不制造第二次失去）', s.hasAbout && (await page.evaluate(() => /第二次失去/.test(document.body.textContent ?? ''))));
    await clickAction('home.enter', 200);
    // 首次进入要等宿主异步读档（services/save）再渲主厅——等元素，不猜时间。
    await page.waitForSelector('#hall-cat', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);
    s = await state();
    check('进主厅：猫画面 + 星砂 0 + 情绪短语', s.hasHall && s.stardust === 0 && !!s.mood, `stardust=${s.stardust} mood=${s.mood} hasHall=${s.hasHall} screen=${s.screen} actions=${s.actions.length}`);
    await shot('hall-first');

    // 陪坐 ×10：星砂 +2×10=20 · 心光 +2×10=20（≥10 解锁章节）。每次点完等一拍以上。
    for (let i = 0; i < 10; i++) await clickAction('cat.sit', 260);
    await page.waitForTimeout(500);
    s = await state();
    check('陪坐 10 次：星砂 20（数字真的变了）', s.stardust === 20, `stardust=${s.stardust}`);
    check('陪坐有画面确认：猫台词换成「靠近」姿态 + 晶球卡显示心光 20（八问第 2 问·第 2 轮）', /靠/.test(s.catLine ?? '') && /心光 20/.test(s.orbSub ?? ''), `line=${s.catLine} orb=${s.orbSub}`);
    await shot('hall-after-care');

    await clickAction('shop.open');
    s = await state();
    check('星砂铺：物品网格 + 顶栏星砂 20', s.hasShop && s.stardust === 20, `stardust=${s.stardust}`);
    await shot('shop');
    check('纸袋（20）可买·羽毛杆（30）禁用', await page.evaluate(() => {
      const bag = document.querySelector('[data-action="shop.buy"][data-arg="paperbag"]');
      const fe = document.querySelector('[data-action="shop.buy"][data-arg="feather"]');
      return !!bag && !bag.disabled && !!fe && fe.disabled;
    }));
    await clickAction('shop.buy', 'paperbag');
    await page.waitForTimeout(300);
    s = await state();
    check('买纸袋：星砂 0 · 「已拥有 ×1」', s.stardust === 0 && /已拥有/.test(s.ownedBadge ?? ''), `stardust=${s.stardust} badge=${s.ownedBadge}`);
    await shot('shop-bought');

    await clickAction('hall.back');
    await clickAction('toys.open');
    s = await state();
    check('玩具篮：有「放到馆里」', s.hasToys && s.actions.includes('decor.place'));
    await shot('toys');
    await clickAction('decor.place', 'paperbag', 500);
    s = await state();
    check('放到馆里 → 回主厅 → 纸袋出现在馆里（购买回到共同空间）', s.hasHall && s.placedFeather, `placed=${s.placedFeather}`);
    await shot('hall-placed');

    await clickAction('memory.open');
    s = await state();
    check('回忆廊：章节「已发光」', s.hasMemory && /已发光/.test(s.chapterState ?? ''), `state=${s.chapterState}`);
    await shot('memory');
    await clickAction('memory.read', 'xuetuan-1', 500);
    s = await state();
    check('阅读：台词框 + 「继续」', s.hasReading && s.hasReadingNext);
    await shot('reading-1');
    await clickAction('memory.advance', 500);
    await clickAction('memory.advance', 500);
    s = await state();
    check('第三节是选择：choiceList 出现', s.hasChoices);
    await shot('reading-choice');
    await clickAction('memory.choose', '1', 500);
    s = await state();
    check('选后到终节点：显示「到这里」且「继续」消失', s.hasReadingEnd && !s.hasReadingNext);
    await shot('reading-end');
    // 终局出口必点（self-check.md）：阅读屏唯一出口 = 回到回忆廊，点完世界/屏要真变
    check('终局出口在：「回到回忆廊」', s.actions.includes('memory.back'));
    await clickAction('memory.back');
    s = await state();
    check('出口点得动：回到回忆廊', s.hasMemory && !s.hasReading);
    await clickAction('hall.back');
    await clickAction('cat.greet', 400);
    s = await state();
    check('新一轮还能接着陪：呼唤后星砂 1', s.hasHall && s.stardust === 1, `stardust=${s.stardust}`);
    await shot('hall-again');

    // ── 沉浸模式「只看它」（menu-flow §1.3 隐藏/显示 UI 钮·visibleWhen 重组）──
    await clickAction('ui.hide', 400);
    s = await state();
    check('只看它：界面收起（无导航/动作栏）· 猫画面还在 · 只剩「显示界面」', s.hasHall && !s.hasNav && !s.actions.includes('cat.sit') && s.hasStageShow);
    await shot('hall-stage-only');
    await clickAction('ui.show', 400);
    s = await state();
    check('显示界面：导航与动作栏回来', s.hasNav && s.actions.includes('cat.sit') && !s.hasStageShow);

    // ── 全屏巡游：词表里每个屏都真到一次（第 7 问机读）──
    await clickAction('orbs.open');
    s = await state();
    check('晶球厅：当前猫晶球 + 「接回自己的猫」空位', s.hasOrbs && s.actions.includes('later'));
    await shot('orbs');
    await clickAction('later');
    await clickAction('table.open');
    s = await state();
    check('星牌桌：接口位（牌规待定说明）', s.hasTable);
    await shot('table');
    await clickAction('hall.back');
    await clickAction('settings.open');
    s = await state();
    check('设置：可信优先文案', s.hasSettings);
    await clickAction('hall.back');

    // ── 回馆：模拟离开 3 小时（拨宿主墙钟 Date.now·不碰档不碰世界）→ 重载 → 小事件 → 看过了 ──
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('apollo-save:main');
      sessionStorage.setItem('pw-clock-offset', String(3 * 60 * 60 * 1000));
      return !!raw && !!JSON.parse(raw).checksum;
    });
    check('存档在（带 checksum 的信封·apollo-save:main）', saved);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await clickAction('home.enter', 200);
    await page.waitForSelector('#hall-cat', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    s = await state();
    check('回馆：「你不在的时候」小事件展开一条 + 「看过了」', s.hasHall && s.offlineAck && !!s.offlineText, `text=${s.offlineText}`);
    check('回馆：进度随存档带回（星砂 1·纸袋仍在馆里）', s.stardust === 1 && s.placedFeather, `stardust=${s.stardust} placed=${s.placedFeather}`);
    await shot('hall-return-offline');
    await clickAction('offline.ack', 500);
    s = await state();
    check('看过了：小事件收起、不再追弹', s.hasHall && !s.offlineAck);
    await shot('hall-return-acked');

    // ── 词表 vs 屏上真控件差集（八问第 7 问）──
    const HOST_ONLY = { 'home.exit': '仅嵌在游戏库壳层（canExit）时出现·独立页无此键（ui.test 已验 canExit 分支）' };
    const missing = vocab.filter((a) => !seen.has(a));
    const naked = missing.filter((a) => !(a in HOST_ONLY));
    check(`词表 ${vocab.length} 个动作：屏上都出现过（宿主条件键 ${Object.keys(HOST_ONLY).length} 个另注）`, naked.length === 0,
      naked.length ? '玩家够不着：' + naked.join(' / ') : `未见=${missing.join(',') || '无'}`);
    log.push('', '词表差集：' + JSON.stringify({ vocab: vocab.length, seen: seen.size, missing, hostOnly: HOST_ONLY }));

    check('全程零控制台 error / 未捕获异常', errors.length === 0, errors.slice(0, 2).join(' | '));
  } catch (e) {
    check('走查中断（异常）', false, String(e?.message ?? e));
  } finally {
    await browser.close().catch(() => {});
    stopDevServer(dev.proc ?? dev);
  }
  const failed = checks.filter((c) => !c.pass);
  say(`\n══ 结果：${checks.length - failed.length}/${checks.length} 过 · 截图 ${n} 张 → ${OUT}`);
  writeFileSync(join(OUT, '..', 'S4-play.log'), log.join('\n') + '\n');
  writeFileSync(join(OUT, '..', 'S4-play.json'), JSON.stringify({ at: new Date().toISOString(), checks, shots: n, consoleErrors: errors, actionsSeen: [...seen].sort() }, null, 2) + '\n');
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
