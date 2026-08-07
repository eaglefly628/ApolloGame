// scripts/shoot-game.mjs —— 无头 Chromium（SwiftShader WebGL）给某个游戏截图（含真 3D / WebGL 场景）。
// 用法：npm run build && node scripts/shoot-game.mjs game-z /abs/out.png
// 机制：vite preview 服 dist → 深链 ?game=<id> 自动挂载该游戏 → 等 canvas + 几帧 → page.screenshot。
// 浏览器走 PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers；SwiftShader 软件 GL 让无头也能渲 WebGL。
// QA 模式（env PIXELQA=1·REQ-3D-像素断言）：截图后解码像素做三机器断言（非黑/对比度/帧活动）→ 打
//   `PIXELQA: PASS|FAIL` + 退出码（照 docs-ref-guard 模式）。缺省关闭·不动既有美术管线截图行为。
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';
import { decodePNG } from './lib/render-harness.mjs';
import { assertPixelQA, DRAFT_THRESHOLDS } from './lib/pixel-qa.mjs';

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
  // 可选深链附加参数（env SHOOT_QUERY，如 `&renderer=webgl2` 验 WebGL2 批渲后端·REQ-3D-RENDER-EFFICIENCY 增量②）。
  const extraQuery = process.env.SHOOT_QUERY || '';
  await page.goto(`http://localhost:${PORT}/?game=${gameId}${extraQuery}`, { waitUntil: 'load', timeout: 30000 });
  // 就绪信号：3D 游戏等 WebGL `canvas`；纯 LayoutNode/DOM UI 游戏（game-a/i·无 canvas）等 mountUI 渲出的
  // `[data-action]` 交互节点——两类游戏统一可截（此前死等 canvas·DOM UI 游戏必超时·owner 2026-07-18 报 game-a 截不了）。
  await page.waitForSelector('canvas, [data-action]', { timeout: 20000 });
  const has3d = await page.$('canvas');
  await page.waitForTimeout(has3d ? 3000 : 800); // 3D 等 WebGL 初始化几帧（云/角色/阴影）；DOM UI 等布局稳定
  // 可选点击穿透（arg 4·逗号分隔按钮文案，依次点·每次等 1.6s）：深链只能到首屏，要截后续屏（如战场/结算屏）→ 点按钮进屏。
  const clicks = (process.argv[4] || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const label of clicks) {
    try { await page.getByText(label, { exact: false }).first().click({ timeout: 6000 }); await page.waitForTimeout(Number(process.env.SHOOT_WAIT) || 1600); }
    catch (e) { console.log('[click miss]', label, e.message); }
  }
  await page.screenshot({ path: out });
  console.log('shot →', out);

  // ── 像素级机器断言（REQ-3D-像素断言·PIXELQA=1 开启）──────────────────────────
  //   捕两帧（相隔一小段·供帧活动/防冻结断言）→ 解码 → 三断言。有 canvas（真渲染）才判帧活动；
  //   纯 DOM UI 屏静态无逐帧动画，跳活动断言（只判非黑 + 对比度）。
  if (process.env.PIXELQA === '1') {
    const frameA = decodePNG(await page.screenshot());
    await page.waitForTimeout(250);                       // 隔几帧·让动画/粒子/相机推进
    const frameB = has3d ? decodePNG(await page.screenshot()) : undefined;
    const r = assertPixelQA({ frameA, frameB });
    const fmt = (a) => a ? `${a.pass ? '✓' : '✗'} ${a.value.toFixed(3)}(≥${a.threshold})` : 'skip';
    console.log(`[pixelqa] nonBlack=${fmt(r.assertions.nonBlack)} contrast=${fmt(r.assertions.contrast)} activity=${fmt(r.assertions.activity)}`);
    console.log(`PIXELQA: ${r.pass ? 'PASS' : 'FAIL'}${r.pass ? '' : ' —— ' + Object.entries(r.assertions).filter(([, a]) => !a.pass).map(([k]) => k).join('/') + ' 未达标（阈值草案·标定见 REQ-3D-像素断言 回执）'}`);
    console.log(`[pixelqa] 阈值草案：${JSON.stringify(DRAFT_THRESHOLDS)}`);
    await browser.close();
    cleanup();
    process.exit(r.pass ? 0 : 1);
  }
  await browser.close();
} finally {
  cleanup();
}
process.exit(0);
