// scripts/studio-lowmodel-e2e.mjs —— 创作台 · 低模「从模板改」真浏览器旅程（playwright-core + mock provider）。
// 用法：node scripts/studio-lowmodel-e2e.mjs
// 机制：ZEROCRAFT_MOCK_LLM=1 起 zerocraft.py（vite:5173 + API:4000）→ 无头 chromium 走玩家模式快速生成旅程：
//   ＋新建 → 入口双选卡「⚡ 快速生成」→ 创作向导默认「从模板改」→ 填名+骰子创意 → 开始生成 →
//   预览 canvas + 「基于模板修改」标注 → 保存入库 → 卡带上架。切「自由生成」→ 仍能生成（从零）。
//   每步 PASS/FAIL；任一步失败 exit 1。造的库数据结束清理。
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rmSync } from 'node:fs';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const VITE = 'http://localhost:5173';
const API = 'http://localhost:4000';
const GAME_NAME = 'E2E LowModel Dice';
const SLUG = 'e2e-lowmodel-dice';   // slugify(GAME_NAME)

let PASS = 0, FAIL = 0;
function step(label, cond, detail = '') {
  if (cond) { PASS++; console.log(`  ok   ${label}`); }
  else { FAIL++; console.log(`  FAIL ${label}  ${detail}`); }
}

function killPorts() {
  for (const p of [5173, 4000]) {
    try { execSync(`fuser -k ${p}/tcp`, { stdio: 'ignore' }); } catch { /* none */ }
  }
  try { execSync('pkill -f "zerocraft.py" || true', { stdio: 'ignore' }); } catch { /* none */ }
}
function cleanupLibrary() {
  for (const s of [SLUG, `${SLUG}-2`, `${SLUG}-3`]) {
    try { rmSync(new URL(`../library/${s}`, import.meta.url), { recursive: true, force: true }); } catch { /* none */ }
  }
}
async function waitPort(url, timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(url); if (r) return true; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

killPorts();
cleanupLibrary();
await new Promise((r) => setTimeout(r, 800));

const server = spawn('python3', ['zerocraft.py'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, ZEROCRAFT_MOCK_LLM: '1' },
  stdio: 'inherit',
  detached: true,
});
const shutdown = () => {
  try { process.kill(-server.pid, 'SIGTERM'); } catch { /* gone */ }
  killPorts();
};
process.on('exit', shutdown);

let browser;
try {
  const up = await waitPort(VITE, 45000);
  step('zerocraft.py 起服务（vite:5173）', up, 'vite 未就绪');
  if (!up) throw new Error('vite not ready');
  step('API:4000 就绪', await waitPort(`${API}/api/generate/providers`, 15000));

  browser = await chromium.launch({ headless: true, executablePath: EXEC, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  // 1) 玩家模式
  await page.goto(`${VITE}/?mode=player`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('text=我的游戏架', { timeout: 20000 });
  step('玩家模式加载（我的游戏架）', true);

  // 2) ＋新建 → 入口双选卡 → ⚡ 快速生成
  await page.getByRole('button', { name: /新建游戏/ }).first().click();
  await page.waitForSelector('text=选一种创作方式', { timeout: 10000 });
  await page.getByRole('button', { name: /快速生成/ }).click();
  await page.waitForSelector('.apollo-wizard-panel', { timeout: 10000 });
  step('创作向导打开（快速生成）', true);

  // 3) 默认「从模板改」+ 双选生成方式 + Mock 角标
  const panelTxt = await page.locator('.apollo-wizard-panel').innerText();
  step('生成方式双选出现（从模板改 / 自由生成）', /从模板改/.test(panelTxt) && /自由生成/.test(panelTxt), panelTxt.slice(0, 120));
  step('当前 AI = Mock', /Mock/.test(panelTxt));
  const chips = page.locator('.apollo-wizard-panel [role="radio"]');
  const tmplChip = chips.filter({ hasText: '从模板改' });
  step('「从模板改」默认选中（aria-checked=true）',
    (await chips.count()) === 2 && (await tmplChip.first().getAttribute('aria-checked')) === 'true');

  // 4) 填名 + 骰子创意
  await page.locator('.apollo-wizard-panel input').first().fill(GAME_NAME);
  await page.locator('.apollo-wizard-panel textarea').first().fill('两人投骰子比大小，先赢两局者胜');

  // 5) 开始生成 → 预览 canvas
  await page.getByRole('button', { name: /开始生成/ }).click();
  await page.waitForSelector('.apollo-wizard-panel canvas', { timeout: 30000 });
  step('从模板改 → 生成 → 预览 canvas 就位', true);
  const previewTxt = await page.locator('.apollo-wizard-panel').innerText();
  step('预览标注「基于模板修改」（模板起步路径可见）', /模板修改/.test(previewTxt), previewTxt.slice(0, 160));

  // 6) 保存入库 → 向导关 + 卡带上架
  await page.getByRole('button', { name: '保存入库' }).click();
  await page.waitForSelector('.apollo-wizard-panel', { state: 'detached', timeout: 30000 });
  await page.waitForFunction((name) => document.body.innerText.includes(name), GAME_NAME, { timeout: 20000 });
  step('保存入库 → 向导关闭 + 卡带上架（游戏名在架上）', true);

  // 7) 「自由生成」路径仍可用（从零·不走模板）
  await page.getByRole('button', { name: /新建游戏/ }).first().click();
  await page.waitForSelector('text=选一种创作方式', { timeout: 10000 });
  await page.getByRole('button', { name: /快速生成/ }).click();
  await page.waitForSelector('.apollo-wizard-panel', { timeout: 10000 });
  await page.locator('.apollo-wizard-panel [role="radio"]').filter({ hasText: '自由生成' }).click();
  await page.locator('.apollo-wizard-panel input').first().fill(`${GAME_NAME} 2`);
  await page.locator('.apollo-wizard-panel textarea').first().fill('一个小球弹跳');
  await page.getByRole('button', { name: /开始生成/ }).click();
  await page.waitForSelector('.apollo-wizard-panel canvas', { timeout: 30000 });
  const freeTxt = await page.locator('.apollo-wizard-panel').innerText();
  step('自由生成路径仍能生成（从零·预览无模板标注）', !/模板修改/.test(freeTxt));

  step('全程零 console error / pageerror', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  await browser.close();
} catch (e) {
  FAIL++;
  console.log('  FAIL 旅程异常:', e.message);
  try { if (browser) await browser.close(); } catch { /* noop */ }
} finally {
  shutdown();
  cleanupLibrary();
}

console.log(`\n[e2e] PASS=${PASS}  FAIL=${FAIL}`);
process.exit(FAIL ? 1 : 0);
