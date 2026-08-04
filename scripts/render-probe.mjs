#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/render-probe.mjs —— REQ-RENDERCHECK R1·渲染冒烟探针（S3 门机器证）
//
//  治的病：S3 现有门（parseManifest+真引擎 load+空跑 2tick）只证「逻辑跑得动」——
//  manifest 能解析、引擎能空转两 tick，跟「浏览器里这游戏画面到底画没画出来」毫无关系。
//  药方＝把渲染器自己当客观判定器：真起本仓 vite 开发服务 → 真 Chromium 装载该游戏（走跟玩家
//  一样的 `?game=<slug>` 深链）→ 机器读三件事（非空白像素 / 控制台零 error / 无未捕获异常或
//  错误浮层）→ 自动截图落盘=门证，人不用再上场肉眼看一遍「有没有画面」。
//
//  用法：
//    node scripts/render-probe.mjs --game <slug>
//  退出码：
//    0 = 三断言全过（画面非空白 · 控制台零 error · 无未捕获异常/错误浮层）
//    1 = 断言未过（渲染判红：空白/花屏太单调、控制台有 error、未捕获异常或 Vite 错误浮层）
//    2 = 用法错（缺 --game / 未知 slug）
//    3 = 环境无浏览器（本机找不到可执行的 Chromium）——探针跳过，不算失败，
//        权威判定以"有浏览器的环境"为准（本容器有）。
//
//  产物（覆盖式·一游戏一份）：
//    public/games/<slug>/probe/S3-render.png   真实截图
//    public/games/<slug>/probe/S3-render.json  判定 JSON（时间/gameHash/三断言/方差值）
//
//  机制笔记：
//   · 服务面选 `vite dev`（非 build+preview）——冷启动 <1s、天然反映当前源码，不必每次先 npm run build；
//     构建产物的完整性已由 S8（tsc+vitest+build 三绿）另行把关，S3 不必重复背。
//   · 真游戏走同一条 `#app` 深链（`?game=<slug>` / cart 形态 `?game=lib:<slug>`）——跟玩家点开
//     启动器看到的是同一份挂载代码，不是另起一条测试专用路径。
//   · 本地路由拦截（P1b/沉浸模式代理同款手法）：启动器壳层 mount 时无条件探 :4000 创作服务
//     两个引导态接口（/api/generate/providers、/api/library）——这与被测游戏内容无关，本机没
//     起 python 后端时会打两条 ERR_CONNECTION_REFUSED 控制台错误，误伤"控制台零 error"断言。
//     只精确拦这两条、原样放行其余请求（游戏自己的资源/API 一律走真网络——卡带游戏若真依赖
//     :4000 数据且后端没起，探针照实判红，不是我们要盖住的地方）。
//   · Chromium 走本仓真实固定路径（同 shoot-game.mjs / studio-design-draft-e2e.mjs 先例）：
//     本地 `playwright` 包解析到的 revision 与容器预置的浏览器版本不一定对得上（实测踩过——
//     package.json 声明 1.61.1 时 chromium.executablePath() 指向 1228，但 /opt/pw-browsers 只预置
//     了 1194），显式给 executablePath 绕开这层版本耦合。
// ═══════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import zlib from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
// ZEROCRAFT_PIPELINE_ROOT（旧名 APOLLO_PIPELINE_ROOT）与 game-pipeline.mjs 同名同义——生产不设，
// 探针天然要连「真运行中的 app」（vite 起服 + 浏览器装载 + 真游戏注册表），跟别的门那种
// 「随便指个空临时目录」式沙盒测试前提不兼容：指向的必须是一个真正 `npm install` 过的仓库检出。
export const ROOT = process.env.ZEROCRAFT_PIPELINE_ROOT || process.env.APOLLO_PIPELINE_ROOT || join(HERE, '..');

// ── 游戏识别（复用 game-pipeline 的形态判定·同一份真相）──────────────────────
import { detectForm, gameHash } from './game-pipeline.mjs';

// ── 浏览器可执行文件探测 ───────────────────────────────────────────────────
// 首选本容器已知的固定路径（见头注版本耦合坑）；找不到则退化到 PATH 上的常见浏览器名——
// 后一条路径存在的意义是给别的主机（没有 /opt/pw-browsers）留活路，顺带让「PATH 遮蔽模拟无浏览器」
// 这种测试手法有意义：把 RENDER_PROBE_CHROMIUM 指到不存在的路径、同时把 PATH 遮蔽掉，两条探测路
// 都会落空 → 判定「环境无浏览器」。
export const DEFAULT_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FALLBACK_BIN_NAMES = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];

export function detectBrowserRuntime(env = process.env) {
  const explicit = env.RENDER_PROBE_CHROMIUM || DEFAULT_CHROMIUM;
  if (existsSync(explicit)) return { ok: true, execPath: explicit, via: 'explicit' };
  for (const bin of FALLBACK_BIN_NAMES) {
    const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8', env });
    const p = (r.stdout || '').trim().split('\n')[0];
    if (r.status === 0 && p) return { ok: true, execPath: p, via: 'PATH' };
  }
  return {
    ok: false, code: 'NO_BROWSER',
    reason: `环境无浏览器·探针跳过（未找到 ${explicit}，PATH 上也没有 ${FALLBACK_BIN_NAMES.join('/')}）`,
  };
}

// ── PNG 解码 + 像素方差（纯函数·零依赖·不起浏览器）──────────────────────────
// Playwright screenshot() 产物固定 8-bit、非隔行——只需覆盖 colorType 0/2/4/6，够用。
export function decodePNG(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG（签名不符）');
  let off = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idatParts = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      interlace = data.readUInt8(12);
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 8 + len + 4;
  }
  if (interlace !== 0) throw new Error('不支持隔行 PNG');
  if (bitDepth !== 8) throw new Error(`不支持 bitDepth=${bitDepth}（只认 8）`);
  const channelsByColorType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByColorType[colorType];
  if (channels === undefined) throw new Error(`不支持 colorType=${colorType}`);
  const raw = zlib.inflateSync(Buffer.concat(idatParts));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let rOff = 0, oOff = 0;
  const prevRow = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[rOff]; rOff += 1;
    const row = out.subarray(oOff, oOff + stride);
    const src = raw.subarray(rOff, rOff + stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0;
      const b = prevRow[x];
      const c = x >= channels ? prevRow[x - channels] : 0;
      let val = src[x];
      switch (filter) {
        case 0: break;
        case 1: val = (val + a) & 0xff; break;
        case 2: val = (val + b) & 0xff; break;
        case 3: val = (val + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
          val = (val + pr) & 0xff;
          break;
        }
        default: throw new Error(`未知 PNG 滤波类型 ${filter}`);
      }
      row[x] = val;
    }
    prevRow.set(row);
    rOff += stride;
    oOff += stride;
  }
  return { width, height, channels, pixels: out };
}

/** 像素方差（灰度亮度 (R+G+B)/3 的总体方差）。纯色截图必得 0；真内容截图远高于阈值。 */
export function pixelVariance(pngBuf) {
  const { width, height, channels, pixels } = decodePNG(pngBuf);
  const n = width * height;
  if (n === 0) return { variance: 0, mean: 0, width, height };
  let sum = 0;
  const lum = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const base = i * channels;
    const l = (channels === 1 || channels === 2) ? pixels[base] : (pixels[base] + pixels[base + 1] + pixels[base + 2]) / 3;
    lum[i] = l;
    sum += l;
  }
  const mean = sum / n;
  let sq = 0;
  for (let i = 0; i < n; i++) { const d = lum[i] - mean; sq += d * d; }
  return { variance: sq / n, mean, width, height };
}

// 方差阈值：低于此值＝画面几乎同一种颜色（纯黑/纯白/单色）→ 判「空白」。
// 真实游戏截图实测方差都在几百到上千量级（game-i≈537 · game-103≈342），纯色恒为 0，
// 15 留了充分安全边际——既不会把「有一点点抗锯齿噪声的纯色图」误判成非空白，也远低于任何
// 有实际内容的画面。假信心自查见 render-probe.test.mjs（阈值置 0 应让纯色判红测试转红）。
export const DEFAULT_VARIANCE_THRESHOLD = 15;

/** 判「空白」＝方差严格小于阈值。阈值=0 时恒为 false（"一切都算非空白"——假信心自查用）。 */
export function isBlank(variance, threshold = DEFAULT_VARIANCE_THRESHOLD) {
  return variance < threshold;
}

// ── 深链构造（跟玩家点开启动器走同一条路由·非测试专用路径）──────────────────
export function deepLinkQuery(form, slug) {
  return form === 'cart' ? `game=lib:${slug}` : `game=${slug}`;
}

// ── vite dev 起服（非 build+preview——冷启动快、天然读当前源码）─────────────
const VITE_BASE_PORT = 5700;

function startDevServer(root) {
  return new Promise((resolve, reject) => {
    const bin = join(root, 'node_modules', '.bin', 'vite');
    const proc = spawn(bin, ['--port', String(VITE_BASE_PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let buf = '';
    let settled = false;
    const to = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`vite dev 20s 未就绪 · 输出尾：${buf.slice(-400)}`));
    }, 20000);
    const cleanup = () => clearTimeout(to);
    proc.stdout.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/Local:\s+https?:\/\/[^:]+:(\d+)\//);
      if (m && !settled) {
        settled = true;
        cleanup();
        resolve({ proc, port: Number(m[1]) });
      }
    });
    proc.stderr.on('data', (d) => { buf += d.toString(); });
    proc.on('exit', (code) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error(`vite dev 未起服就退出（code ${code}）· 输出尾：${buf.slice(-400)}`));
      }
    });
    proc.on('error', (e) => {
      if (!settled) { settled = true; cleanup(); reject(e); }
    });
  });
}

function stopDevServer(proc) {
  if (!proc) return;
  try { process.kill(-proc.pid, 'SIGTERM'); } catch { /* 已死或不归我们管 */ }
  setTimeout(() => { try { process.kill(-proc.pid, 'SIGKILL'); } catch { /* 收尸 */ } }, 1500);
}

// ── 探针主流程（真起服+真浏览器+真装载）────────────────────────────────────
async function runProbe(slug, { root = ROOT, viewport = { width: 1280, height: 800 } } = {}) {
  const form = detectForm(root, slug);
  if (!form) return { usageError: `未知游戏: ${slug}（library/public/games/games 三处均无）` };

  const rt = detectBrowserRuntime();
  if (!rt.ok) return { noBrowser: true, reason: rt.reason };

  let dev;
  try {
    dev = await startDevServer(root);
  } catch (e) {
    return { ok: false, reason: `vite dev 起服失败 · ${e.message}` };
  }

  const { chromium } = await import('playwright');
  let browser;
  const consoleErrors = [];
  const pageErrors = [];
  let overlay = false;
  let shot = null;
  let navError = null;

  try {
    browser = await chromium.launch({ headless: true, executablePath: rt.execPath, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport });
    // 本地路由拦截（P1b/沉浸模式代理同款手法）：只挡启动器壳层的两条引导态接口，
    // 其余请求原样放行（游戏自己的真实资源/API 一律走真网络）。
    await page.route('**/api/generate/providers', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/library', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
    page.on('pageerror', (e) => pageErrors.push(String(e.message || e).slice(0, 300)));

    const url = `http://localhost:${dev.port}/?${deepLinkQuery(form, slug)}`;
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('canvas, [data-action]', { timeout: 8000 }).catch(() => {});
      const has3d = await page.$('canvas');
      await page.waitForTimeout(has3d ? 2600 : 1500);
      overlay = await page.evaluate(() => !!document.querySelector('vite-error-overlay')).catch(() => false);
      shot = await page.screenshot();
    } catch (e) {
      navError = String(e.message || e).slice(0, 400);
    }
  } finally {
    try { await browser?.close(); } catch { /* noop */ }
    stopDevServer(dev.proc);
  }

  if (navError && !shot) return { ok: false, reason: `装载失败 · ${navError}` };

  const { variance, mean } = pixelVariance(shot);
  const nonBlank = { pass: !isBlank(variance), variance: Math.round(variance * 100) / 100, mean: Math.round(mean * 100) / 100, threshold: DEFAULT_VARIANCE_THRESHOLD };
  const consoleOk = { pass: consoleErrors.length === 0, count: consoleErrors.length, messages: consoleErrors.slice(0, 5) };
  const noUncaught = { pass: pageErrors.length === 0 && !overlay, pageErrors: pageErrors.length, overlay, messages: pageErrors.slice(0, 5) };
  const pass = nonBlank.pass && consoleOk.pass && noUncaught.pass;

  return {
    ok: pass, form, port: dev.port, browser: { execPath: rt.execPath, via: rt.via },
    assertions: { nonBlank, consoleErrors: consoleOk, noUncaught },
    screenshot: shot,
  };
}

// ── 落盘（覆盖式）────────────────────────────────────────────────────────
function writeArtifacts(root, slug, result) {
  const dir = join(root, 'public', 'games', slug, 'probe');
  mkdirSync(dir, { recursive: true });
  const pngPath = join(dir, 'S3-render.png');
  const jsonPath = join(dir, 'S3-render.json');
  if (result.screenshot) writeFileSync(pngPath, result.screenshot);
  const record = {
    slug, at: new Date().toISOString(), gameHash: gameHash(root, slug),
    ok: result.ok, form: result.form,
    assertions: result.assertions,
    screenshot: result.screenshot ? `public/games/${slug}/probe/S3-render.png` : null,
    browser: result.browser,
  };
  writeFileSync(jsonPath, JSON.stringify(record, null, 2) + '\n');
  return { pngPath, jsonPath, record };
}

// ── CLI ─────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const argv = process.argv.slice(2);
  const gi = argv.indexOf('--game');
  const slug = gi >= 0 ? argv[gi + 1] : null;
  if (!slug) {
    console.error('用法: node scripts/render-probe.mjs --game <slug>');
    process.exit(2);
  }
  if (!detectForm(ROOT, slug)) {
    console.error(`未知游戏: ${slug}（library/public/games/games 三处均无）`);
    process.exit(2);
  }

  const rtPre = detectBrowserRuntime();
  if (!rtPre.ok) {
    console.log(JSON.stringify({ ok: false, code: 'NO_BROWSER', slug, reason: rtPre.reason }));
    process.exit(3);
  }

  const result = await runProbe(slug, { root: ROOT });
  if (result.usageError) { console.error(result.usageError); process.exit(2); }
  if (result.noBrowser) { console.log(JSON.stringify({ ok: false, code: 'NO_BROWSER', slug, reason: result.reason })); process.exit(3); }
  if (result.ok === false && !result.assertions) {
    // 起服/装载层面的失败（非三断言判定）——同样落红，但没有像素/截图可写。
    console.error(`✗ 探针失败（未到断言阶段）· ${result.reason}`);
    process.exit(1);
  }

  const { jsonPath, pngPath, record } = writeArtifacts(ROOT, slug, result);
  console.log(JSON.stringify({ ...record, pngPath, jsonPath }));
  process.exit(result.ok ? 0 : 1);
}

export { runProbe, writeArtifacts };
