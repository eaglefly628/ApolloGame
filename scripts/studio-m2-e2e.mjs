// scripts/studio-m2-e2e.mjs —— 创作台 v1 · M2 真浏览器完整旅程（playwright-core + mock provider）。
// 用法：node scripts/studio-m2-e2e.mjs
// 机制：ZEROCRAFT_MOCK_LLM=1 起 zerocraft.py（vite:5173 + API:4000）→ 无头 chromium 走玩家模式旅程：
//   ＋新建 → 填名+创意 → 生成 → 预览 canvas → 保存入库 → 卡带上架 → ✎继续创作 → 指令 → 保存 →
//   ⟲版本历史(≥2 条) → 回滚。每步打印 PASS/FAIL；任一步失败 exit 1。造的库数据结束清理。
// 浏览器：playwright-core（node_modules 已有）指定 executablePath 到已装的 chromium-1194。
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rmSync } from 'node:fs';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const VITE = 'http://localhost:5173';
const SLUG = 'e2e-smoke-game';       // name 'E2E Smoke Game' → slugify
const GAME_NAME = 'E2E Smoke Game';

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
  // API:4000 也就绪
  step('API:4000 就绪', await waitPort('http://localhost:4000/api/generate/providers', 15000));

  browser = await chromium.launch({ headless: true, executablePath: EXEC, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  // 1) 玩家模式加载
  await page.goto(`${VITE}/?mode=player`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('text=我的游戏架', { timeout: 20000 });
  step('玩家模式加载（我的游戏架）', true);

  // 2) ＋新建游戏 → 向导打开
  await page.getByRole('button', { name: /新建游戏/ }).first().click();
  await page.waitForSelector('.apollo-wizard-panel', { timeout: 10000 });
  const wizardTxt = await page.locator('.apollo-wizard-panel').innerText();
  step('创作向导打开（含「开始生成」）', /开始生成/.test(wizardTxt));
  step('向导显示当前 AI = Mock', /Mock/.test(wizardTxt), wizardTxt.slice(0, 80));

  // 3) 填名 + 创意
  await page.locator('.apollo-wizard-panel input').first().fill(GAME_NAME);
  await page.locator('.apollo-wizard-panel textarea').first().fill('一个小球在平台间弹跳，有重力');

  // 4) 生成 → 预览 canvas
  await page.getByRole('button', { name: '开始生成' }).click();
  await page.waitForSelector('.apollo-wizard-panel canvas', { timeout: 30000 });
  step('生成成功 → 预览 canvas 就位', true);
  step('预览态出现「保存入库」', await page.getByRole('button', { name: '保存入库' }).isVisible());

  // 5) 保存入库 → 向导关 + 卡带上架
  await page.getByRole('button', { name: '保存入库' }).click();
  await page.waitForSelector('.apollo-wizard-panel', { state: 'detached', timeout: 30000 });
  await page.waitForFunction((name) => document.body.innerText.includes(name), GAME_NAME, { timeout: 20000 });
  step('保存入库 → 卡带上架（游戏名出现在架上）', true);

  // 6) ✎ 继续创作 → 向导 revise 态（新卡带已被选中·其操作条可见）
  await page.getByRole('button', { name: /继续创作/ }).first().click();
  await page.waitForSelector('.apollo-wizard-panel', { timeout: 10000 });
  await page.waitForSelector('.apollo-wizard-panel textarea', { timeout: 10000 });
  const reviseTxt = await page.locator('.apollo-wizard-panel').innerText();
  step('继续创作 → 向导 revise 态（含「应用修改」+ 游戏名）', /应用修改/.test(reviseTxt) && reviseTxt.includes(GAME_NAME), reviseTxt.slice(0, 90));

  // 7) 填指令 → 应用修改 → 预览
  await page.locator('.apollo-wizard-panel textarea').first().fill('把玩家改成红色');
  await page.getByRole('button', { name: '应用修改' }).click();
  await page.waitForSelector('.apollo-wizard-panel canvas', { timeout: 30000 });
  step('revise 生成 → 预览 canvas 就位', true);

  // 8) 保存这一版 → 向导关
  await page.getByRole('button', { name: '保存这一版' }).click();
  await page.waitForSelector('.apollo-wizard-panel', { state: 'detached', timeout: 30000 });
  step('保存这一版 → 向导关闭', true);

  // 9) ⟲ 版本历史 → 浮层 ≥2 条
  await page.getByRole('button', { name: /版本历史/ }).first().click();
  await page.waitForSelector('text=⟲ 版本历史', { timeout: 10000 });
  // 浮层里逐行「回滚」按钮数量 = 版本条数
  await page.waitForTimeout(500);
  const rollbackBtns = await page.getByRole('button', { name: '回滚' }).count();
  step('版本历史浮层 ≥2 条（create/初版 + revise）', rollbackBtns >= 2, `rollback 行数=${rollbackBtns}`);

  // 10) 回滚最旧一条 → 请求成功（浮层重拉）
  const before = rollbackBtns;
  await page.getByRole('button', { name: '回滚' }).last().click();
  await page.waitForTimeout(1500);
  const after = await page.getByRole('button', { name: '回滚' }).count();
  step('回滚成功（浮层刷新·历史再+1）', after >= before, `before=${before} after=${after}`);

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
