#!/usr/bin/env node
// One browser-side ruler for design references and rendered UI. No visual verdict is inferred.
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { detectBrowserRuntime } from './lib/render-harness.mjs';
import { inside, slugName } from './lib/aiflow-paths.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY_STATES = ['T1 蓄力', 'T2 出招', 'T3 对决', 'T4 结算', '终局'].map(label => ({ id: label.split(' ')[0], label }));

/** Self-contained: serializable by Playwright and runnable with a DOM fixture in a VM. */
export function measureDocument(opts = {}) {
  const { width = 1920, height = 1080, stageSelector, items } = opts;
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) throw new Error('画布尺寸必须为正数');
  const all = [...document.querySelectorAll('div,button,span,svg')];
  const stages = stageSelector ? [...document.querySelectorAll(stageSelector)] : all.filter(el => el.style && el.style.width === `${width}px` && el.style.height === `${height}px`);
  if (!stages.length) throw new Error(`找不到 ${width}×${height} 舞台盒`);
  if (stageSelector && stages.length !== 1) throw new Error(`舞台 selector 命中 ${stages.length} 件，需要 1 件`);
  const stage = stages[0], sr = stage.getBoundingClientRect();
  const kx = sr.width / width, ky = sr.height / height;
  if (!(kx > 0 && ky > 0)) throw new Error('舞台盒不可见或缩放为零');
  const txt = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join('').trim().slice(0, 40);
  let entries;
  if (items !== undefined) {
    if (!Array.isArray(items) || !items.length) throw new Error('items 必须为非空数组');
    const ids = new Set();
    entries = items.map(item => {
      if (!item || typeof item.id !== 'string' || !item.id.trim() || typeof item.selector !== 'string' || !item.selector.trim() || ids.has(item.id)) throw new Error('items 需要唯一 id 和非空 selector');
      ids.add(item.id);
      const matches = [...stage.querySelectorAll(item.selector)];
      if (matches.length !== 1) throw new Error(`元素 ${item.id} selector 命中 ${matches.length} 件，需要 1 件`);
      return { el: matches[0], id: item.id };
    });
  } else entries = [...stage.querySelectorAll('*')].map(el => ({ el }));
  const boxes = [];
  for (const { el, id } of entries) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) {
      if (items !== undefined) throw new Error(`元素 ${id} 不可见或尺寸小于 2px`);
      continue;
    }
    const cs = getComputedStyle(el);
    boxes.push({
      ...(id === undefined ? {} : { id }), tag: el.tagName.toLowerCase(), text: txt(el),
      x: Math.round((r.left - sr.left) / kx), y: Math.round((r.top - sr.top) / ky),
      w: Math.round(r.width / kx), h: Math.round(r.height / ky),
      bg: cs.backgroundImage !== 'none' ? cs.backgroundImage.slice(0, 60) : cs.backgroundColor,
      color: cs.color, font: `${cs.fontSize}/${cs.fontWeight} ${cs.fontFamily.split(',')[0]}`,
      border: cs.borderTopWidth === '0px' ? '' : `${cs.borderTopWidth} ${cs.borderTopColor}`, radius: cs.borderTopLeftRadius,
    });
  }
  return { scale: kx, count: boxes.length, boxes };
}

export async function measurePage(page, opts = {}) {
  try {
    const measured = await page.evaluate(measureDocument, opts);
    if (!measured.count) console.warn('[design-measure] 无可见元素，量稿为空');
    return measured;
  }
  catch (error) { console.error(`[design-measure] 拒收量稿: ${error.message}`); throw error; }
}

export function loadDesignMeasureConfig(slug, options = {}) {
  slugName(slug);
  const root = resolve(options.root ?? ROOT), designDir = inside(root, `docs/design/${slug}`);
  const configPath = inside(designDir, 'design-measure.json');
  const legacy = slug === 'game108' && !existsSync(configPath);
  const raw = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('design-measure.json 必须为对象');
  const source = inside(root, raw.source ?? (legacy ? 'games/game108/design_handoff_rule_of_three_battle' : `docs/design/${slug}/ui-refs`));
  const entry = raw.entry ?? (legacy ? 'design/battle-screen.dc.html' : 'index.html');
  const entryPath = inside(source, entry);
  if (!/\.html?$/i.test(entry)) throw new Error('entry 必须为 HTML 路径');
  const canvas = raw.canvas ?? { width: 1920, height: 1080 };
  if (!canvas || !Number.isInteger(canvas.width) || !Number.isInteger(canvas.height) || canvas.width <= 0 || canvas.height <= 0 || (canvas.selector !== undefined && (typeof canvas.selector !== 'string' || !canvas.selector.trim()))) throw new Error('canvas 需要正整数 width/height 和有效 selector');
  const states = raw.states ?? (legacy ? LEGACY_STATES : [{ id: 'default' }]);
  if (!Array.isArray(states) || !states.length) throw new Error('states 必须为非空数组');
  const ids = new Set(), labels = new Set();
  for (const state of states) {
    if (!state || typeof state.id !== 'string' || !/^[\p{L}\p{N}_-]+$/u.test(state.id) || ids.has(state.id)) throw new Error('states 需要唯一且安全的 id');
    if (state.label !== undefined && (typeof state.label !== 'string' || !state.label.trim())) throw new Error('state label 必须为非空文本');
    const label = state.label ?? state.id;
    if (labels.has(label)) throw new Error('state label 不可重复');
    ids.add(state.id); labels.add(label);
  }
  if (raw.items !== undefined) {
    if (!Array.isArray(raw.items) || !raw.items.length) throw new Error('items 必须为非空数组');
    const itemIds = new Set();
    for (const item of raw.items) {
      if (!item || typeof item.id !== 'string' || !item.id.trim() || typeof item.selector !== 'string' || !item.selector.trim() || itemIds.has(item.id)) throw new Error('items 需要唯一 id 和非空 selector');
      itemIds.add(item.id);
    }
  }
  return { root, source, entry, entryPath, legacy, canvas, states, items: raw.items, out: inside(designDir, options.mock ? 'design-ref/mock' : 'design-ref') };
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
export function createDesignRequestHandler(source, vendor = '') {
  return (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') { console.warn('[design-measure] 拒收非只读请求'); res.writeHead(405); res.end(); return; }
      const pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);
      if (!pathname.startsWith('/')) throw new Error('需要绝对 URL 路径');
      const isVendor = pathname.startsWith('/__vendor/');
      if (isVendor && !vendor) { console.warn('[design-measure] 本地 vendor 未配置，跳过'); res.writeHead(404); res.end(); return; }
      const file = inside(isVendor ? vendor : source, (isVendor ? pathname.slice('/__vendor/'.length) : pathname.slice(1)) || 'index.html');
      if (!existsSync(file) || !statSync(file).isFile()) { console.warn(`[design-measure] 文件不存在，跳过: ${pathname}`); res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
    } catch (error) { console.warn(`[design-measure] 拒收路径: ${error.message}`); res.writeHead(403); res.end(); }
  };
}
export async function serveDesignDirectory(source, vendor = '') {
  const server = createServer(createDesignRequestHandler(source, vendor));
  await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen); });
  return { server, port: server.address().port };
}

export async function runDesignMeasure(slug, options = {}) {
  const config = loadDesignMeasureConfig(slug, options);
  if (options.mock) {
    mkdirSync(config.out, { recursive: true });
    const output = { mock: true, reason: '离线 mock，未启动浏览器、未测量真实元素', states: Object.fromEntries(config.states.map(s => [s.label ?? s.id, []])) };
    writeFileSync(join(config.out, 'measure.json'), JSON.stringify(output, null, 1) + '\n');
    console.warn(`[design-measure] mock 降级，无真实测量: ${config.out}`);
    return { ...output, out: config.out };
  }
  if (!existsSync(config.entryPath)) throw new Error(`设计入口不存在: ${config.entryPath}`);
  const runtime = detectBrowserRuntime(options.env ?? process.env);
  if (!runtime.ok) { console.warn(`[design-measure] ${runtime.reason}`); const error = new Error(runtime.reason); error.exitCode = 3; throw error; }
  const { chromium } = await import('playwright');
  const { server, port } = await serveDesignDirectory(config.source, options.vendor ?? process.env.DC_VENDOR ?? '');
  let browser;
  const fontErrors = [];
  const result = {};
  try {
    browser = await chromium.launch({ executablePath: runtime.execPath });
    const page = await browser.newPage({ viewport: { width: config.canvas.width + 40, height: config.canvas.height + 320 }, deviceScaleFactor: 1 });
    await page.addInitScript(base => {
      window.__resources = {
        'https://unpkg.com/react@18.3.1/umd/react.production.min.js': base + '/react.js',
        'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': base + '/react-dom.js',
        'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js': base + '/babel.js',
      };
    }, `http://127.0.0.1:${port}/__vendor`);
    page.on('requestfailed', request => { if (request.url().includes('fonts.g')) fontErrors.push(request.url()); });
    await page.goto(`http://127.0.0.1:${port}/${config.entry.split('/').map(encodeURIComponent).join('/')}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    mkdirSync(config.out, { recursive: true });
    for (const state of config.states) {
      if (state.label !== undefined) {
        const matches = [];
        for (const button of await page.$$('button')) if ((await button.textContent()).trim() === state.label) matches.push(button);
        if (matches.length !== 1) {
          if (config.legacy && !matches.length) { console.warn(`[design-measure] 找不到页签 ${state.label}，跳过`); continue; }
          throw new Error(`页签 ${state.label} 命中 ${matches.length} 件，需要 1 件`);
        }
        await matches[0].click();
        await page.waitForTimeout(500);
      }
      const measured = await measurePage(page, { width: config.canvas.width, height: config.canvas.height, stageSelector: config.canvas.selector, items: config.items });
      result[state.label ?? state.id] = measured.boxes;
      if (config.canvas.selector) await page.locator(config.canvas.selector).screenshot({ path: join(config.out, `dc-${state.id}.png`) });
      else {
        const handle = await page.evaluateHandle(({ width, height }) => [...document.querySelectorAll('div,button,span,svg')].find(el => el.style && el.style.width === `${width}px` && el.style.height === `${height}px`), config.canvas);
        try { await handle.asElement().screenshot({ path: join(config.out, `dc-${state.id}.png`) }); } finally { await handle.dispose(); }
      }
      console.log(`[design-measure] ${state.label ?? state.id}: ${measured.count} 盒（缩放 ${measured.scale.toFixed(3)}）`);
    }
    writeFileSync(join(config.out, 'measure.json'), JSON.stringify(result, null, 1) + '\n');
  } finally {
    try { if (browser) await browser.close(); }
    finally { await new Promise(resolveClose => server.close(resolveClose)); }
  }
  if (fontErrors.length) console.warn(`[design-measure] Google Fonts 未加载（${fontErrors.length} 请求失败），字形需真截图核实`);
  console.log(`[design-measure] 基准落盘: ${join(config.out, 'measure.json')}`);
  return { result, out: config.out };
}

export async function designMeasureCLI(argv = process.argv.slice(2), fallbackSlug) {
  let slug = fallbackSlug, root, mock = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') { root = argv[++i]; if (!root) throw new Error('--root 缺少路径'); }
    else if (argv[i] === '--mock') mock = true;
    else if (!slug && !argv[i].startsWith('-')) slug = argv[i];
    else throw new Error(`未知参数: ${argv[i]}`);
  }
  if (!slug) throw new Error('用法: node scripts/design-measure.mjs <slug> [--root <repo>] [--mock]');
  return runDesignMeasure(slug, { root, mock });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  designMeasureCLI().catch(error => { console.error(`[design-measure] 拒收: ${error.message}`); process.exitCode = error.exitCode ?? 1; });
}
