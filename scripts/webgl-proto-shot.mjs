// scripts/webgl-proto-shot.mjs —— WebGL2 批渲原型的真浏览器目击 + PIXELQA（REQ-3D-RENDER-EFFICIENCY 增量②）
//  起 vite dev → 真 Chromium 开 /webgl-proto.html → 截两帧 → 解码像素三断言（非黑/对比度/帧活动）+ 读 HUD
//  的 draw/实例数。证批渲后端**真出画面**（shader 编译、instanced draw、方/圆遮罩都对）且 draws≪实体数。
//  用法：node scripts/webgl-proto-shot.mjs [out.png]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import process from 'node:process';
import { detectBrowserRuntime, startDevServer, stopDevServer, decodePNG } from './lib/render-harness.mjs';
import { assertPixelQA } from './lib/pixel-qa.mjs';

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

  const r = assertPixelQA({ frameA, frameB });
  const fmt = (a) => a ? `${a.pass ? '✓' : '✗'} ${a.value.toFixed(3)}(≥${a.threshold})` : 'skip';
  console.log('HUD:', hud);
  console.log(`[pixelqa] nonBlack=${fmt(r.assertions.nonBlack)} contrast=${fmt(r.assertions.contrast)} activity=${fmt(r.assertions.activity)}`);
  console.log('consoleErrors:', errs.length ? errs : 0);
  console.log('shot →', out);
  const pass = r.pass && errs.length === 0;
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
