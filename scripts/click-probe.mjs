#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/click-probe.mjs —— S3 骨架关「点击打穿」门（REQ-S3CLICK·owner 2026-08-07 判 A）
//
//  治的病：S3 现有三道证**全程一次都不点**——manifest 解析 / 引擎装载 + 空跑 2 拍 / 渲染探针
//  （只证画出来了）。于是「按钮画得好看但点了没反应」能一路绿着过 S3。game108 实测踩到两发，
//  两发都**不报错**：
//    ① 宿主自搓 rAF 圈直接 `world.tick()`，绕过 `Engine.step()` 里注入输入那一句
//       ⇒ UI 动作一直往队列里填、永远没人取；
//    ② `props.bind` 没跑 `resolveBindings` ⇒ 进度条永远画在 0，而文字读数是对的。
//  单测绿（测试自己往 InputQueue 塞动作，DOM 那一半从不参与）+ 渲染探针绿（它只画图）。
//  同病史：owner 2026-07-17「绿门不可玩」复盘的药方是给 S4 加验收剧本，**S3 这层的洞没补**。
//
//  界（owner 2026-08-07 立）：
//    · **S3 问「信号打得穿吗」**——点一下，世界动了没。本探针只管这个。
//    · **S4 问「规则对吗」**——打穿之后赢的是不是该赢的那个。那是验收剧本的活，本探针不碰。
//  所以断言刻意只有两条最小项，**不验玩法、不需要 AI、不需要结算闭环**。
//
//  用法：node scripts/click-probe.mjs --game <slug>
//  退出码：0=过（或豁免/无浏览器）· 1=未过 · 2=用法错 · 3=环境无浏览器（跳过·同 R1/R3 语义）
//  产物：public/games/<slug>/probe/S3-click-gate.json（判定 + 逐个控件的点击结果）
// ═══════════════════════════════════════════════════════════════

import { writeFileSync, mkdirSync, readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectBrowserRuntime, startDevServer, stopDevServer, deepLinkQuery } from './lib/render-harness.mjs';
import { detectForm } from './game-pipeline.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 存量豁免名单（**owner 2026-08-07 明示不回溯**：「先把它落到当前的就可以了，
 * 新游戏的时候再去检验 S3 的情况」）。
 *
 * 照 `pipeline-registry-guard.mjs` 的 `LEGACY_NO_BOARD` 先例：名单**可见、带理由**，
 * 不是静默跳过——豁免的游戏照样跑探针、照样把结果落进 JSON 当参考，只是不判红。
 * **新游戏不在名单里 = 受检。** 想给某个存量游戏转正，把它从名单里删掉再修即可（只减不增）。
 */
export const LEGACY_WAIVED = {
  'game-d': 'owner 2026-08-07 不回溯', 'game-e': 'owner 2026-08-07 不回溯',
  'game-f': 'owner 2026-08-07 不回溯（且已冻结）', 'game-g': 'owner 2026-08-07 不回溯',
  'game-i': 'owner 2026-08-07 不回溯（展示台·非对局游戏）', 'game-z': 'owner 2026-08-07 不回溯（3D·P3D 域）',
  'game-a': 'owner 2026-08-07 不回溯', 'game-b': 'owner 2026-08-07 不回溯',
  'game-c': 'owner 2026-08-07 不回溯', 'game-103': 'owner 2026-08-07 不回溯',
  'game101': 'owner 2026-08-07 不回溯', 'game102': 'owner 2026-08-07 不回溯',
};

/**
 * 静态检查：屏上用了 `props.bind`，游戏却从没调过 `resolveBindings` ⇒ **bind 必然是哑弹**。
 *
 * 为什么单靠点击门抓不到：bind 哑弹时**点击这条线是通的**（数字照变——那来自宿主投影），
 * 只有「条/图形」那条读世界的线断了，点击门看不出区别（2026-08-07 实测撤修，门照绿）。
 * 而这是个**纯静态的必然错**：`mountUI` 没有数据源入口，不自己跑一遍 `resolveBindings(tree, ds)`
 * 就绝无可能生效。所以用静态检查堵，比让浏览器猜可靠。
 *
 * 纯函数（吃文件内容数组·不碰盘）——导出供单测直接灌。
 */
export function checkBindWiring(files) {
  // **先剥注释再判**：注释里提一句 `resolveBindings(...)` 不是调用。
  // （2026-08-07 实测：撤修时只删了 import 与调用、留着解释性注释，检查就被骗过去了。）
  const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const src = files.map((f) => ({ path: f.path, text: code(f.text) }));
  const usesBind = src.filter((f) => /\bbind:\s*[^,}\s]/.test(f.text)).map((f) => f.path);
  if (usesBind.length === 0) return { ok: true, detail: '未用 props.bind' };
  const resolves = src.some((f) => /resolveBindings\s*\(/.test(f.text));
  if (resolves) return { ok: true, detail: `${usesBind.length} 处 bind · 已调 resolveBindings` };
  return {
    ok: false,
    detail: `${usesBind.length} 处 props.bind（${usesBind[0]}…）但全游戏没有一处调 resolveBindings`
      + ' ⇒ bind 是哑弹：条/图形永远画在 0，而文字读数可能照常对（静默）。'
      + '修法：宿主交树前跑 `resolveBindings(tree, dataSource)`。',
  };
}

/**
 * 门读码（**纯函数**·不碰盘不 spawn——导出供单测直接灌各种结果，不必真起浏览器
 * 就能验「门怎么判」这条逻辑本身对不对；同 `interpretRenderProbe` 的先例）。
 */
export function interpretClickProbe({ slug, controls, changed, consoleErrors, waived, bindWiring }) {
  if (!waived && bindWiring && !bindWiring.ok) {
    return { exit: 1, summary: `✗ bind 接线：${bindWiring.detail}` };
  }
  if (waived) {
    return { exit: 0, summary: `⚠ 点击门豁免（${waived}）· 实测 ${controls} 个控件 / ${changed} 个点后 DOM 有变化`, waived: true };
  }
  if (controls === 0) {
    return { exit: 1, summary: '✗ 活体 DOM 里一个 [data-action] 控件都没有——UI 完全不可驱动（纯 canvas 玩法请申请豁免）' };
  }
  if (consoleErrors.length > 0) {
    return { exit: 1, summary: `✗ 点击过程有 ${consoleErrors.length} 条控制台 error：${consoleErrors.slice(0, 2).join(' | ')}` };
  }
  if (changed === 0) {
    return {
      exit: 1,
      summary: `✗ ${controls} 个控件全点了一遍，DOM 一处都没变——输入接线大概率整条断了`
        + '（查：宿主是不是自搓循环绕过了 Engine.step 的输入注入 / action 有没有接进 ActionSink）',
    };
  }
  return { exit: 0, summary: `✓ 点击打穿（${controls} 个控件 · ${changed} 个点后 DOM 真的变了 · 零控制台 error）` };
}

/** 读该游戏目录下所有 .ts（不含测试）——供静态检查用。 */
function readGameSources(slug) {
  const dir = join(ROOT, 'games', slug);
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!name.endsWith('.ts') || name.includes('.test.')) continue;
      out.push({ path: `games/${slug}/${name}`, text: readFileSync(full, 'utf8') });
    }
  };
  walk(dir);
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const gi = argv.indexOf('--game');
  const slug = gi >= 0 ? argv[gi + 1] : undefined;
  if (!slug) { console.error('用法: node scripts/click-probe.mjs --game <slug>'); process.exit(2); }

  const rt = detectBrowserRuntime();
  if (!rt.ok) { console.error(`[click-probe] ${slug}：本机无 Chromium，跳过（权威判定以有浏览器环境为准）`); process.exit(3); }

  const form = detectForm(ROOT, slug);
  const { chromium } = await import('playwright');
  const dev = await startDevServer(ROOT);
  const browser = await chromium.launch({ executablePath: rt.execPath });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`未捕获异常: ${e.message}`));
  // 同渲染探针：只精确拦创作服 :4000 那两个引导接口（本机没起 python 后端·与被测游戏无关）。
  await page.route('**/api/generate/providers', (r) => r.fulfill({ status: 200, body: '[]' }));
  await page.route('**/api/library', (r) => r.fulfill({ status: 200, body: '[]' }));

  const hits = [];
  try {
    await page.goto(`http://localhost:${dev.port}/?${deepLinkQuery(form, slug)}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // ── 判据：「**不碰它会怎样** vs 碰了会怎样」的对照实验 ────────────────────
    // 两处坑都实测踩过，写在这里免得下一个人重踩：
    //  ① **别用整页快照**（`document.body.innerHTML`）——倒计时环/粒子每帧都在动，
    //     整页永远"在变"，于是「输入接线整条断了」的撤修**照样判绿**（第一版就这样）。
    //  ② **别用 `textContent`**——它含所有后代，叶子一变，`app`/根屏/中区**全部**跟着变，
    //     噪声顺着祖先链爬满全树（第二版就这样：相位标签一跳，五个祖先集体误报）。
    // 现在：只取**自身直接文本**（不含后代）+ 内联宽 + 禁用态；再跑一趟**全程不点**的
    // 同节拍对照，把"世界自己在跑"产生的变化整批扣掉。剩下的才算这一点真打穿了。
    const SNAP = `(() => { const m = {};
      for (const el of document.querySelectorAll('[id]')) {
        const own = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
        m[el.id] = own + '§' + (el.style.width || '') + '§' + (el.disabled ? 'D' : '');
      } return m; })()`;
    const snap = () => page.evaluate(SNAP);
    const diff = (a, b) => Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]);
    const listControls = () => page.evaluate(`Array.from(document.querySelectorAll('[data-action]'))
      .filter(el => !el.disabled && el.offsetParent !== null).map(el => el.id).filter(Boolean)`);

    // ① 对照趟：**一下都不点**，按与正式趟完全相同的节拍走一遍，收集「自己会变」的 id。
    //    节拍相同是要害——相位推进这类只在特定时刻发生的变化，节拍不同就扣不干净。
    const STEPS = 12, GAP = 250;
    const noisy = new Set();
    {
      let prev = await snap();
      for (let i = 0; i < STEPS; i++) {
        await page.waitForTimeout(GAP);
        const now = await snap();
        for (const k of diff(prev, now)) noisy.add(k);
        prev = now;
      }
    }

    // ② 正式趟：重载回到同一起点，同节拍逐个点，只认噪声集以外的变化。
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const seen = new Set();
    for (let i = 0; i < STEPS; i++) {
      const ids = await listControls();
      const next = ids.find((id) => !seen.has(id));
      if (!next) break;
      seen.add(next);

      const before = await snap();
      await page.click(`[id="${next}"]`, { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(GAP);
      const after = await snap();
      const real = diff(before, after).filter((k) => !noisy.has(k));
      hits.push({ id: next, changed: real.length > 0, changedIds: real.slice(0, 6) });
    }
  } finally {
    await browser.close();
    stopDevServer(dev.proc);
  }

  const controls = hits.length;
  const changed = hits.filter((h) => h.changed).length;
  const waived = LEGACY_WAIVED[slug];
  const bindWiring = checkBindWiring(readGameSources(slug));
  const verdict = interpretClickProbe({ slug, controls, changed, consoleErrors, waived, bindWiring });

  const out = join(ROOT, 'public', 'games', slug, 'probe');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'S3-click-gate.json'),
    JSON.stringify({ slug, ...verdict, controls, changed, hits, bindWiring, consoleErrors }, null, 2) + '\n');

  console.log(`[click-probe] ${slug} ${verdict.summary}`);
  process.exit(verdict.exit);
}

// 被 import 时（单测灌 interpretClickProbe）不跑主流程。
if (process.argv[1] && process.argv[1].endsWith('click-probe.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
