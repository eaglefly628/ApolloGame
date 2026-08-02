// scripts/studio-m3m4-e2e.mjs —— 创作台 v1 · M3+M4 真浏览器旅程（playwright-core + mock provider）。
// 用法：node scripts/studio-m3m4-e2e.mjs
// 机制：ZEROCRAFT_MOCK_LLM=1 起 zerocraft.py（vite:5173 + API:4000）→ 无头 chromium 走玩家模式旅程：
//   点状态灯 → 设置面板开 → 千问排第一 → 填 mock key → 测试连接 ok → 关面板 →
//   选卡带（架上中心卡带）→ 🩺 体检 → 五轴浮层出分。每步打印 PASS/FAIL；任一步失败 exit 1。
// 浏览器：playwright-core（node_modules 已有）指定 executablePath 到已装 chromium-1194。
// 造的 .apollo-config.json + 临时 sample 库结束清理。
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rmSync, existsSync } from 'node:fs';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const VITE = 'http://localhost:5173';
const API = 'http://localhost:4000';
const CONFIG = new URL('../.apollo-config.json', import.meta.url);

let PASS = 0, FAIL = 0;
let createdSlug = null; // 若库空需临时装样例 → 结束清理
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

function cleanup() {
  try { if (existsSync(CONFIG)) rmSync(CONFIG, { force: true }); } catch { /* none */ }
  if (createdSlug) {
    try { rmSync(new URL(`../library/${createdSlug}`, import.meta.url), { recursive: true, force: true }); } catch { /* none */ }
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
try { if (existsSync(CONFIG)) rmSync(CONFIG, { force: true }); } catch { /* none */ }
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

  // 确保库里至少一盘卡带（用于选中 → 🩺 体检）。已有 sample-platformer 则直接用；否则临时装样例。
  const lib = await (await fetch(`${API}/api/library`)).json();
  if (!Array.isArray(lib) || lib.length === 0) {
    const r = await (await fetch(`${API}/api/library/install-sample`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preset: 'platformer' }),
    })).json();
    createdSlug = r.slug;
    step('库空 → 临时装样例卡带', !!createdSlug, JSON.stringify(r).slice(0, 100));
  } else {
    step('库已有卡带可选', true);
  }

  browser = await chromium.launch({ headless: true, executablePath: EXEC, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  // 1) 玩家模式加载
  await page.goto(`${VITE}/?mode=player`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('text=我的游戏架', { timeout: 20000 });
  step('玩家模式加载（我的游戏架）', true);

  // 2) 点状态灯 → 设置面板开
  await page.click('button[title*="点击设置 AI"]', { timeout: 10000 });
  await page.waitForSelector('.apollo-settings-panel', { timeout: 10000 });
  step('点状态灯 → 设置面板打开', true);

  // 3) 千问排第一
  const firstProvider = await page.locator('.apollo-settings-row').first().getAttribute('data-provider');
  step('provider 列表千问(qwen)排第一', firstProvider === 'qwen', `first=${firstProvider}`);

  // 4) mock 行填 key + 测试连接 → ok
  const mockRow = page.locator('.apollo-settings-row[data-provider="mock"]');
  step('设置面板含 mock provider 行（env 开）', await mockRow.count() === 1);
  await mockRow.locator('input[type="password"]').fill('mock-test-key-123456');
  await mockRow.getByRole('button', { name: /测试连接/ }).click();
  await page.waitForSelector('.apollo-settings-row[data-provider="mock"] >> text=连接成功', { timeout: 15000 });
  step('填 mock key → 测试连接 ok（连接成功）', true);

  // 5) 关面板
  await page.locator('.apollo-settings-panel').getByRole('button', { name: '关闭' }).click();
  await page.waitForSelector('.apollo-settings-panel', { state: 'detached', timeout: 10000 });
  step('关闭设置面板', true);

  // 6) 选卡带（架上中心卡带已默认选中 → 其操作条含 🩺 体检）→ 点体检
  await page.waitForSelector('button:has-text("🩺 体检")', { timeout: 15000 });
  step('架上中心卡带操作条含「🩺 体检」', true);
  await page.getByRole('button', { name: /体检/ }).first().click();

  // 7) 五轴浮层出分
  await page.waitForSelector('.zerocraft-bench-overlay', { timeout: 30000 });
  // 等体检跑完（loading → done）：出现「及格线」即出分完成
  await page.waitForSelector('.zerocraft-bench-overlay >> text=及格线', { timeout: 40000 });
  const benchTxt = await page.locator('.zerocraft-bench-overlay').innerText();
  step('体检浮层出五轴分（含 及格线 70）', /及格线\s*70/.test(benchTxt), benchTxt.slice(0, 120));
  const fiveAxes = ['结构', '装载', '确定性', '数值', '可见'].every((a) => benchTxt.includes(a));
  step('浮层列全五轴（结构/装载/确定性/数值/可见）', fiveAxes, benchTxt.slice(0, 200));
  // 总分数字存在（0..100）
  const scoreMatch = benchTxt.match(/(\d{1,3})\s*\/\s*100/);
  step('浮层显示总分 /100', !!scoreMatch && Number(scoreMatch[1]) >= 0 && Number(scoreMatch[1]) <= 100, `score=${scoreMatch?.[1]}`);

  step('全程零 console error / pageerror', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  await browser.close();
} catch (e) {
  FAIL++;
  console.log('  FAIL 旅程异常:', e.message);
  try { if (browser) await browser.close(); } catch { /* noop */ }
} finally {
  shutdown();
  cleanup();
}

console.log(`\n[e2e] PASS=${PASS}  FAIL=${FAIL}`);
process.exit(FAIL ? 1 : 0);
