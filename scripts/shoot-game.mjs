// scripts/shoot-game.mjs —— 无头 Chromium（SwiftShader WebGL）给某个游戏截图（含真 3D / WebGL 场景）。
// 用法：npm run build && node scripts/shoot-game.mjs game-z /abs/out.png
// 机制：vite preview 服 dist → 深链 ?game=<id> 自动挂载该游戏 → 等 canvas + 几帧 → page.screenshot。
// 浏览器走 PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers；SwiftShader 软件 GL 让无头也能渲 WebGL。
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';

// playwright 装在全局 node_modules（非本地）；ESM 裸 import 看不到 → 经全局根用 require 绝对加载。
const groot = execSync('npm root -g').toString().trim();
const { chromium } = createRequire(`${groot}/x.js`)('playwright');

const gameId = process.argv[2] || 'game-z';
const out = process.argv[3] || `/tmp/${gameId}.png`;
const PORT = 5599;

const server = spawn('./node_modules/.bin/vite', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'inherit' });
const cleanup = () => { try { server.kill('SIGKILL'); } catch { /* noop */ } };
process.on('exit', cleanup);

try {
  await new Promise((r) => setTimeout(r, 4000)); // 等 preview 起来
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const [vpW, vpH] = (process.env.SHOOT_VP || '1000x640').split('x').map(Number); // 可选视窗尺寸（env SHOOT_VP=1400x720·验响应式）
  const page = await browser.newPage({ viewport: { width: vpW || 1000, height: vpH || 640 } });
  page.on('console', (m) => console.log('[page]', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${PORT}/?game=${gameId}`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForTimeout(3000); // 等 WebGL 初始化 + 几帧（云/角色/阴影渲出）
  // 可选点击穿透（arg 4·逗号分隔按钮文案，依次点·每次等 1.6s）：深链只能到首屏，要截后续屏（如 game-d 战场/骰盅）→ 点按钮进屏。
  const clicks = (process.argv[4] || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const label of clicks) {
    try { await page.getByText(label, { exact: false }).first().click({ timeout: 6000 }); await page.waitForTimeout(1600); }
    catch (e) { console.log('[click miss]', label, e.message); }
  }
  await page.screenshot({ path: out });
  console.log('shot →', out);
  await browser.close();
} finally {
  cleanup();
}
process.exit(0);
