#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/game108-design-measure.mjs —— 设计稿**真渲染目击 + 量盒子**
//
//  为什么要这一道（CLAUDE.md：「有 .dc.html 设计稿在档 = 1:1 复刻基准：开工前真渲染目击
//  （附截图）、视觉规格全消费」）：README 给了一堆 px 数字，但**数字会和稿子对不上**——
//  照抄数字复刻，错了也不知道错在哪。这里改成：真起 Chromium 渲设计稿 → 逐元素量
//  `getBoundingClientRect` → 换算回 1920×1080 画布坐标 → 落成机读基准 JSON。
//  之后我们自己的屏渲出来，可以拿同一把尺子逐件对差值，「一模一样」就成了一个数字。
//
//  用法：node scripts/game108-design-measure.mjs
//  产物：docs/design/game108/design-ref/{measure.json, dc-T1..T4,end.png}
//  退出码：0 = 量到了 · 1 = 失败 · 3 = 本机无浏览器
// ═══════════════════════════════════════════════════════════════

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname } from 'node:path';
import { detectBrowserRuntime } from './lib/render-harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'games', 'game108', 'design_handoff_rule_of_three_battle');
// dc-runtime 从 unpkg 拉 React/ReactDOM/Babel，本机代理拦 unpkg（403）→ 走它自己的官方逃生口
// `window.__resources[url] = 本地 url`（`support.js::cdnScriptFor`：命中就不带 integrity 直接用本地）。
// 本地包是用仓里 node_modules 的 react@18.3.1 现 bundle 的，版本与稿子要求一致。
const VENDOR = process.env['DC_VENDOR'] ?? '';
const OUT = join(ROOT, 'docs', 'design', 'game108', 'design-ref');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.md': 'text/markdown' };

/** 起一个只读静态服（file:// 下 support.js 的相对加载与字体 CORS 都不稳）。 */
function serve(dir) {
  return new Promise((resolve) => {
    const srv = createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const p = url.startsWith('/__vendor/') && VENDOR
        ? join(VENDOR, url.slice('/__vendor/'.length))
        : join(dir, url);
      if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
      res.end(readFileSync(p));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

/**
 * 在页面里跑：找到 1920×1080 那个舞台盒，把它**每一个后代元素**的盒子换算回画布坐标。
 * 舞台被 `transform:scale()` 缩过 → 必须除以实际缩放比，否则量到的是屏幕像素不是画布像素。
 */
const MEASURE = `(() => {
  const all = [...document.querySelectorAll('div,button,span,svg')];
  const stage = all.find((el) => el.style && el.style.width === '1920px' && el.style.height === '1080px');
  if (!stage) return { error: '找不到 1920×1080 舞台盒' };
  const sr = stage.getBoundingClientRect();
  const k = sr.width / 1920;                       // 实际缩放比
  const txt = (el) => {
    let s = '';
    for (const n of el.childNodes) if (n.nodeType === 3) s += n.nodeValue;
    return s.trim().slice(0, 40);
  };
  const out = [];
  for (const el of stage.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    out.push({
      tag: el.tagName.toLowerCase(),
      text: txt(el),
      x: Math.round((r.left - sr.left) / k), y: Math.round((r.top - sr.top) / k),
      w: Math.round(r.width / k), h: Math.round(r.height / k),
      bg: cs.backgroundImage !== 'none' ? cs.backgroundImage.slice(0, 60) : cs.backgroundColor,
      color: cs.color, font: \`\${cs.fontSize}/\${cs.fontWeight} \${cs.fontFamily.split(',')[0]}\`,
      border: cs.borderTopWidth === '0px' ? '' : \`\${cs.borderTopWidth} \${cs.borderTopColor}\`,
      radius: cs.borderTopLeftRadius,
    });
  }
  return { scale: k, count: out.length, boxes: out };
})()`;

async function main() {
  const rt = detectBrowserRuntime();
  if (!rt.ok) { console.error('本机无 Chromium，跳过'); process.exit(3); }
  const { chromium } = await import('playwright');
  const { srv, port } = await serve(SRC);
  const browser = await chromium.launch({ executablePath: rt.execPath });
  const page = await browser.newPage({ viewport: { width: 1960, height: 1400 }, deviceScaleFactor: 1 });
  await page.addInitScript((base) => {
    window.__resources = {
      'https://unpkg.com/react@18.3.1/umd/react.production.min.js': base + '/react.js',
      'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': base + '/react-dom.js',
      'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js': base + '/babel.js',
    };
  }, `http://127.0.0.1:${port}/__vendor`);
  const fontErrs = [];
  page.on('requestfailed', (r) => { if (r.url().includes('fonts.g')) fontErrs.push(r.url()); });

  mkdirSync(OUT, { recursive: true });
  const result = {};
  try {
    await page.goto(`http://127.0.0.1:${port}/design/battle-screen.dc.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // 工具条上的相位页签（评审脚手架·不是游戏屏的一部分）——逐个点，逐态量 + 截图。
    const tabs = await page.$$eval('button', (bs) => bs.map((b) => b.textContent.trim()));
    console.log(`工具条按钮：${tabs.join(' / ')}`);
    for (const label of ['T1 蓄力', 'T2 出招', 'T3 对决', 'T4 结算', '终局']) {
      const btn = (await page.$$('button')).find(async () => true);
      const handles = await page.$$('button');
      let target = null;
      for (const h of handles) if ((await h.textContent()).trim() === label) target = h;
      if (!target) { console.log(`  ⚠ 找不到页签 ${label}`); continue; }
      await target.click();
      await page.waitForTimeout(500);
      const m = await page.evaluate(MEASURE);
      if (m.error) throw new Error(m.error);
      result[label] = m.boxes;
      const stage = await page.$('div[style*="1920px"]');
      await stage.screenshot({ path: join(OUT, `dc-${label.split(' ')[0]}.png`) });
      console.log(`  ✓ ${label}：量到 ${m.count} 个盒子（缩放 ${m.scale.toFixed(3)}）`);
      void btn;
    }
  } finally {
    await browser.close();
    srv.close();
  }
  writeFileSync(join(OUT, 'measure.json'), JSON.stringify(result, null, 1) + '\n');
  if (fontErrs.length) console.log(`\n⚠ Google Fonts 未加载（${fontErrs.length} 个请求失败）——量到的字号仍准确，字形以 screens/*.png 为准。`);
  console.log(`\n✅ 基准落盘：${join(OUT, 'measure.json')}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
