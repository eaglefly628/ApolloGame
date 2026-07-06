// scripts/studio-m25-review-e2e.mjs —— AI 生成人审门（M2.5·REQ-ART）真浏览器旅程（playwright-core）。
// 用法：node scripts/studio-m25-review-e2e.mjs
// 机制：起 apollo.py（vite:5173 + API:4000）→ 无头 chromium 走资源库 → ✨AI 生成 → 待审 → 审：
//   ① 资源库工具栏含「✨ AI 生成」+「🕒 待审区」入口
//   ② 生成 → **待审态**（预览 + ✓入库/✕弃置·**无**「已生成并登记」直落文案）
//   ③ ✕ 弃置 → 已弃置（reject·不入库·零仓库污染）
//   ④ 再生成 → ✓ 入库 → 已入库（approve·登记）
//   ⑤ 全程零 console error。每步 PASS/FAIL；任一失败 exit 1。截图存 scratchpad 供人核验。
// 造进真 index 的 approve 测试资产结束清理（快照恢复 assets/index.json + 删 ai/pending）。
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const VITE = 'http://localhost:5173';
const API = 'http://localhost:4000';
const ROOT = new URL('..', import.meta.url);
const INDEX = new URL('../assets/index.json', import.meta.url);
const AI_DIR = new URL('../assets/ai/', import.meta.url);
const SHOTS = '/tmp/claude-0/-home-user-ApolloGame/1cb39fc5-2d60-52ac-a8e2-86f03f5ab075/scratchpad';

let PASS = 0, FAIL = 0;
function step(label, cond, detail = '') {
  if (cond) { PASS++; console.log(`  ok   ${label}`); }
  else { FAIL++; console.log(`  FAIL ${label}  ${detail}`); }
}

function killPorts() {
  for (const p of [5173, 4000]) { try { execSync(`fuser -k ${p}/tcp`, { stdio: 'ignore' }); } catch { /* none */ } }
  try { execSync('pkill -f "apollo.py" || true', { stdio: 'ignore' }); } catch { /* none */ }
}

async function waitPort(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(url); if (r) return true; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

// 快照，finally 恢复（approve 会真写 assets/index.json + assets/ai/）。
const INDEX_SNAPSHOT = existsSync(INDEX) ? readFileSync(INDEX) : null;
const AI_EXISTED = existsSync(AI_DIR);
function restoreRepo() {
  try { rmSync(new URL('pending', AI_DIR), { recursive: true, force: true }); } catch { /* none */ }
  try { rmSync(new URL('pending.json', AI_DIR), { force: true }); } catch { /* none */ }
  try { rmSync(new URL('qwen/m25-e2e-approve-journey.png', AI_DIR), { force: true }); } catch { /* none */ }
  if (INDEX_SNAPSHOT) { try { writeFileSync(INDEX, INDEX_SNAPSHOT); } catch { /* none */ } }
  if (!AI_EXISTED) { try { rmSync(AI_DIR, { recursive: true, force: true }); } catch { /* none */ } }
}

try { mkdirSync(SHOTS, { recursive: true }); } catch { /* none */ }
killPorts();
await new Promise((r) => setTimeout(r, 800));

const server = spawn('python3', ['apollo.py'], {
  cwd: ROOT, env: { ...process.env, APOLLO_MOCK_LLM: '1' }, stdio: 'inherit', detached: true,
});
const shutdown = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* gone */ } killPorts(); };
process.on('exit', shutdown);

let browser;
try {
  step('apollo.py 起 vite:5173', await waitPort(VITE, 45000));
  step('API:4000 就绪', await waitPort(`${API}/api/assets/pending`, 15000));

  browser = await chromium.launch({ headless: true, executablePath: EXEC, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  // 1) dev 模式加载 → 进资源库
  await page.goto(`${VITE}/`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('text=🗃 资源库', { timeout: 20000 });
  await page.click('text=🗃 资源库');
  await page.waitForSelector('button:has-text("导入资产")', { timeout: 15000 });
  step('进入资源库（工具栏就绪）', true);

  // 2) 工具栏含 AI 生成 + 待审区 入口
  step('工具栏含「✨ AI 生成」', await page.locator('button:has-text("AI 生成")').count() >= 1);
  step('工具栏含「🕒 待审区」入口', await page.locator('button:has-text("待审区")').count() >= 1);

  // 3) 开 AI 生成面板
  await page.click('button:has-text("AI 生成")');
  await page.waitForSelector('text=AI 生成资产', { timeout: 10000 });
  step('AI 生成面板打开（含「生成到待审区」按钮）', await page.locator('button:has-text("生成到待审区")').count() === 1);

  // 4) 生成一个 → 待审态（预览 + ✓入库/✕弃置·无「已生成并登记」）
  await page.locator('textarea').first().fill('m25 e2e reject journey');
  await page.click('button:has-text("生成到待审区")');
  await page.waitForSelector('text=已生成·待审', { timeout: 30000 });
  await page.screenshot({ path: `${SHOTS}/m25-e2e-01-pending.png` });
  step('生成 → 待审态出现（🕒 已生成·待审）', true);
  step('待审态含「✓ 入库」按钮', await page.locator('button:has-text("入库")').count() >= 1);
  step('待审态含「✕ 弃置」按钮', await page.locator('button:has-text("弃置")').count() >= 1);
  step('**无**「已生成并登记」直落文案（人审门·非自动入库）', await page.locator('text=已生成并登记').count() === 0);

  // 5) ✕ 弃置 → 已弃置（reject·不入库）
  await page.click('button:has-text("弃置")');
  await page.waitForSelector('text=已弃置', { timeout: 15000 });
  step('✕ 弃置 → 已弃置（reject 成功）', true);

  // 6) 再生成 → ✓ 入库 → 已入库（approve·登记）
  await page.click('button:has-text("再生成一个")');
  await page.locator('textarea').first().fill('m25 e2e approve journey');
  await page.click('button:has-text("生成到待审区")');
  await page.waitForSelector('text=已生成·待审', { timeout: 30000 });
  await page.click('button:has-text("入库")');
  await page.waitForSelector('text=已入库', { timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/m25-e2e-02-approved.png` });
  step('✓ 入库 → 已入库（approve 成功·已登记）', true);

  // 7) 后端核对：approve 物进 index，pending 已空
  const idx = await (await fetch(`${API}/api/assets/pending`)).json();
  step('approve 后待审区清空（count=0）', Number(idx?.count ?? 0) === 0, JSON.stringify(idx).slice(0, 120));
  const assetsIdx = JSON.parse(readFileSync(INDEX, 'utf8'));
  step('approve 物已登记进 assets/index.json', assetsIdx.assets.some((a) => a.id === 'ai/qwen/m25-e2e-approve-journey'));
  step('reject 物**未**登记进 index', !assetsIdx.assets.some((a) => a.id === 'ai/qwen/m25-e2e-reject-journey'));

  step('全程零 console error / pageerror', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  await browser.close();
} catch (e) {
  FAIL++;
  console.log('  FAIL 旅程异常:', e.message);
  try { if (browser) await browser.close(); } catch { /* noop */ }
} finally {
  shutdown();
  restoreRepo();
}

console.log(`\n[e2e] PASS=${PASS}  FAIL=${FAIL}  截图: ${SHOTS}/m25-e2e-*.png`);
process.exit(FAIL ? 1 : 0);
