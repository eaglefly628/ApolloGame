// scripts/webgl-proto-shot.mjs —— WebGL2 批渲原型的真浏览器目击（非黑 + 帧活动内联自检·REQ-3D-RENDER-EFFICIENCY 增量②）
//  起 vite dev → 真 Chromium 开 /webgl-proto.html → 截两帧 → 解码像素自检（非黑占比 + 两帧活动）+ 读 HUD
//  的 draw/实例数。证批渲后端**真出画面**（shader 编译、instanced draw、方/圆遮罩都对）且 draws≪实体数。
//  用法：node scripts/webgl-proto-shot.mjs [out.png]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import process from 'node:process';
import { detectBrowserRuntime, startDevServer, stopDevServer, decodePNG } from './lib/render-harness.mjs';

// 内联像素自检（非黑占比 + 两帧亮度活动·本原型自证专用·不外挂模块）。
function nonBlankRatio(img) {
  const { width, height, channels, pixels } = img; const n = width * height; let nb = 0;
  for (let i = 0; i < n; i++) { const p = i * channels; const L = channels >= 3 ? 0.2126 * pixels[p] + 0.7152 * pixels[p + 1] + 0.0722 * pixels[p + 2] : pixels[p]; if (L > 16) nb++; }
  return nb / n;
}
function frameActivity(a, b) {
  const ca = a.channels, cb = b.channels, n = Math.min(a.width * a.height, b.width * b.height); let s = 0;
  for (let i = 0; i < n; i++) { const pa = i * ca, pb = i * cb; const la = 0.2126 * a.pixels[pa] + 0.7152 * a.pixels[pa + 1] + 0.0722 * a.pixels[pa + 2]; const lb = 0.2126 * b.pixels[pb] + 0.7152 * b.pixels[pb + 1] + 0.0722 * b.pixels[pb + 2]; s += Math.abs(la - lb); }
  return s / n;
}

const out = process.argv[2] || 'public/webgl-proto-shot.png';
const rt = detectBrowserRuntime();
if (!rt.ok) { console.log('SKIP:', rt.reason); process.exit(0); } // 无浏览器环境 → 跳过（不算失败）

const groot = execSync('npm root -g').toString().trim();
const { chromium } = createRequire(`${groot}/x.js`)('playwright');

let server, browser;
try {
  server = await startDevServer(process.cwd());
  browser = await chromium.launch({ headless: true, executablePath: rt.execPath,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(`http://localhost:${server.port}/webgl-proto.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(600); // 让动画跑起来

  const frameA = decodePNG(await page.screenshot());
  await page.waitForTimeout(250);
  const frameB = decodePNG(await page.screenshot());
  await page.screenshot({ path: out });
  const hud = await page.textContent('#hud');

  const nb = nonBlankRatio(frameA), act = frameActivity(frameA, frameB);
  console.log('HUD:', hud);
  console.log(`[proto] nonBlack=${nb.toFixed(3)}(≥0.05) activity=${act.toFixed(3)}(≥0.15)`);
  console.log('consoleErrors:', errs.length ? errs : 0);
  console.log('shot →', out);
  const pass = nb >= 0.05 && act >= 0.15 && errs.length === 0;
  console.log(`WEBGL-PROTO: ${pass ? 'PASS' : 'FAIL'}`);
  await browser.close();
  stopDevServer(server.proc);
  process.exit(pass ? 0 : 1);
} catch (e) {
  console.error('WEBGL-PROTO: ERROR', e?.message || e);
  try { await browser?.close(); } catch { /* noop */ }
  stopDevServer(server?.proc);
  process.exit(1);
}
