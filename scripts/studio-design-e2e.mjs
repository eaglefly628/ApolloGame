// scripts/studio-design-e2e.mjs —— 创作台 · 设计先行流真浏览器完整旅程（playwright-core + mock provider）。
// 用法：node scripts/studio-design-e2e.mjs
// 机制：APOLLO_MOCK_LLM=1 起 apollo.py（vite:5173 + API:4000）→ 无头 chromium 走玩家模式设计旅程：
//   ＋新建 → 入口双选卡「设计一个游戏」→ 填名 → 讨论两轮(ready) → 分解 → 左树 4 文件 →
//   改一处对齐(内容变化 + commit 数增) → 设计定稿生成原型(canvas) → 保存入库 → 卡带上架 →
//   history 含设计类 commit。每步 PASS/FAIL；任一步失败 exit 1。造的库数据结束清理。
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rmSync } from 'node:fs';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const VITE = 'http://localhost:5173';
const API = 'http://localhost:4000';
const GAME_NAME = 'E2E Design Game';
const SLUG = 'e2e-design-game';   // slugify(GAME_NAME)

let PASS = 0, FAIL = 0;
function step(label, cond, detail = '') {
  if (cond) { PASS++; console.log(`  ok   ${label}`); }
  else { FAIL++; console.log(`  FAIL ${label}  ${detail}`); }
}

function killPorts() {
  for (const p of [5173, 4000]) {
    try { execSync(`fuser -k ${p}/tcp`, { stdio: 'ignore' }); } catch { /* none */ }
  }
  try { execSync('pkill -f "apollo.py" || true', { stdio: 'ignore' }); } catch { /* none */ }
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
async function historyCount() {
  try { const r = await fetch(`${API}/api/library/${SLUG}/history`); const d = await r.json(); return Array.isArray(d?.entries) ? d.entries : []; }
  catch { return []; }
}

killPorts();
cleanupLibrary();
await new Promise((r) => setTimeout(r, 800));

const server = spawn('python3', ['apollo.py'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, APOLLO_MOCK_LLM: '1' },
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
  step('apollo.py 起服务（vite:5173）', up, 'vite 未就绪');
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

  // 2) ＋新建 → 入口双选卡
  await page.getByRole('button', { name: /新建游戏/ }).first().click();
  await page.waitForSelector('text=选一种创作方式', { timeout: 10000 });
  const choiceTxt = await page.locator('body').innerText();
  step('入口双选卡（🗣 设计一个游戏 / ⚡ 快速生成）', /设计一个游戏/.test(choiceTxt) && /快速生成/.test(choiceTxt));

  // 3) 选「设计一个游戏」→ 设计工作台
  await page.getByRole('button', { name: /设计一个游戏/ }).click();
  await page.waitForSelector('text=设计工作台', { timeout: 10000 });
  step('设计工作台打开', true);
  step('工作台显示当前 AI = Mock', /Mock/.test(await page.locator('.apollo-design-studio').innerText()));

  // 4) 填名
  await page.locator('.apollo-design-studio input').first().fill(GAME_NAME);

  // 5) 讨论第一轮
  await page.locator('.apollo-design-studio textarea').first().fill('我想做个两人骰子比大小的游戏');
  await page.getByRole('button', { name: '发送' }).click();
  await page.waitForTimeout(600);
  const breakdownBtn = page.getByRole('button', { name: /分解成设计稿/ });
  step('第一轮后「分解」仍禁用（未 ready）', await breakdownBtn.isDisabled());

  // 6) 讨论第二轮 → ready
  await page.locator('.apollo-design-studio textarea').first().fill('先赢两局者胜，一局定 AI');
  await page.getByRole('button', { name: '发送' }).click();
  await page.waitForSelector('text=可以分解成设计稿了', { timeout: 10000 });
  step('第二轮后 ready（可以分解了）', true);
  step('「分解成设计稿」按钮亮起', !(await breakdownBtn.isDisabled()));

  // 7) 分解 → 目录 4 文件
  await breakdownBtn.click();
  await page.waitForSelector('text=capability-plan.md', { timeout: 20000 });
  const treeFiles = await page.locator('.apollo-design-studio button').evaluateAll(
    (btns) => btns.map((b) => b.textContent?.trim() || '').filter((t) => /^[\w./-]+\.md$/.test(t)));
  step('左树 4 份设计稿', treeFiles.length === 4, `files=${JSON.stringify(treeFiles)}`);
  step('含 pitch/systems/content/capability-plan',
    treeFiles.includes('pitch.md') && treeFiles.some((f) => f.startsWith('systems/'))
    && treeFiles.includes('content.md') && treeFiles.includes('capability-plan.md'), JSON.stringify(treeFiles));

  const beforeRevise = (await historyCount()).length;

  // 8) 改一处对齐：选中 pitch.md → 改这里 → 应用修订（内容变化 + commit 数增）
  await page.getByRole('button', { name: 'pitch.md', exact: true }).click();
  const pitchBefore = await page.locator('.apollo-design-studio pre').first().innerText();
  await page.locator('.apollo-design-studio textarea').first().fill('把目标分数改成 3');
  await page.getByRole('button', { name: '应用修订' }).click();
  await page.waitForFunction(
    (prev) => { const el = document.querySelector('.apollo-design-studio pre'); return el && el.textContent !== prev; },
    pitchBefore, { timeout: 15000 });
  const pitchAfter = await page.locator('.apollo-design-studio pre').first().innerText();
  step('对齐改一处 → 内容变化（design-revise 回全文）', pitchAfter !== pitchBefore && /修订/.test(pitchAfter), pitchAfter.slice(0, 80));
  await page.waitForTimeout(600);
  const afterRevise = (await historyCount()).length;
  step('对齐落盘 → commit 数增（design PUT 版本化）', afterRevise > beforeRevise, `before=${beforeRevise} after=${afterRevise}`);

  // 9) 设计定稿 → 生成原型 → 预览 canvas
  await page.getByRole('button', { name: /生成原型/ }).click();
  await page.waitForSelector('.apollo-design-studio canvas', { timeout: 30000 });
  step('设计定稿 → 生成原型 → 预览 canvas 就位', true);
  step('预览态出现「保存入库」', await page.getByRole('button', { name: '保存入库' }).isVisible());

  // 10) 保存入库 → 工作台关 + 卡带上架
  await page.getByRole('button', { name: '保存入库' }).click();
  await page.waitForSelector('.apollo-design-studio', { state: 'detached', timeout: 30000 });
  await page.waitForFunction((name) => document.body.innerText.includes(name), GAME_NAME, { timeout: 20000 });
  step('保存入库 → 工作台关闭 + 卡带上架（游戏名在架上）', true);

  // 11) history 含设计类 commit（design breakdown / design: …）
  const hist = await historyCount();
  const subjects = hist.map((e) => e.subject || '');
  step('history 含设计类 commit（design …）', subjects.some((s) => /design/i.test(s)), JSON.stringify(subjects));
  step('history 含原型保存 commit（原型生成 v1）', subjects.some((s) => s.includes('原型生成')), JSON.stringify(subjects));

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
