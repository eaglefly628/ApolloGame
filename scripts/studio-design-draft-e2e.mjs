// scripts/studio-design-draft-e2e.mjs —— BUG-STUDIO-设计中间态丢失 真浏览器验收（playwright-core + mock）。
// 用法：node scripts/studio-design-draft-e2e.mjs
// 机制：ZEROCRAFT_MOCK_LLM=1 起 zerocraft.py（vite:5173 + API:4000）→ 无头 chromium 走三例：
//   A) 两轮讨论(mock) → 刷新页面 → 未完成草稿列表 → 一键恢复 → 线程完整回来（刷新永不丢）。
//   B) 聊天框裸 Enter 不发送/不触发相变（只换行）；Ctrl+Enter 才发送。
//   C) provider 失败（route 注入错误）→ 红条报错 + 线程原样保留（失败不降级）。
// 每步 PASS/FAIL；任一失败 exit 1。造的库/草稿数据结束清理。
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rmSync } from 'node:fs';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const VITE = 'http://localhost:5173';
const API = 'http://localhost:4000';
const DRAFTS_DIR = new URL('../.zerocraft/design-drafts/', import.meta.url);

let PASS = 0, FAIL = 0;
function step(label, cond, detail = '') {
  if (cond) { PASS++; console.log(`  ok   ${label}`); }
  else { FAIL++; console.log(`  FAIL ${label}  ${detail}`); }
}
function killPorts() {
  for (const p of [5173, 4000]) { try { execSync(`fuser -k ${p}/tcp`, { stdio: 'ignore' }); } catch { /* none */ } }
  try { execSync('pkill -f "zerocraft.py" || true', { stdio: 'ignore' }); } catch { /* none */ }
}
function cleanDrafts() { try { rmSync(DRAFTS_DIR, { recursive: true, force: true }); } catch { /* none */ } }
function cleanLibrary() {
  // 本 e2e 不做分解，一般不建库；防御性清理测试用名的 slug。
  for (const s of ['e2e-draft-game', 'e2e-draft-game-2']) {
    try { rmSync(new URL(`../library/${s}`, import.meta.url), { recursive: true, force: true }); } catch { /* none */ }
  }
}
async function waitPort(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(url); if (r) return true; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}
// 打开设计工作台（玩家模式 → +新建 → 设计一个游戏）。
async function openStudio(page) {
  await page.goto(`${VITE}/?mode=player`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('text=我的游戏架', { timeout: 20000 });
  await page.getByRole('button', { name: /新建游戏/ }).first().click();
  await page.waitForSelector('text=选一种创作方式', { timeout: 10000 });
  await page.getByRole('button', { name: /设计一个游戏/ }).click();
  await page.waitForSelector('text=设计工作台', { timeout: 10000 });
}

killPorts();
cleanDrafts();
cleanLibrary();
await new Promise((r) => setTimeout(r, 800));

const server = spawn('python3', ['zerocraft.py'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, ZEROCRAFT_MOCK_LLM: '1' },
  stdio: 'inherit',
  detached: true,
});
const shutdown = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* gone */ } killPorts(); };
process.on('exit', shutdown);

let browser;
try {
  const up = await waitPort(VITE, 45000);
  step('zerocraft.py 起服务（vite:5173）', up, 'vite 未就绪');
  if (!up) throw new Error('vite not ready');
  step('API:4000 就绪', await waitPort(`${API}/api/generate/providers`, 15000));

  browser = await chromium.launch({ headless: true, executablePath: EXEC, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });
  // 二次确认弹窗一律接受（弃置草稿用）。
  page.on('dialog', (d) => d.accept().catch(() => {}));

  // ══════════ B) 裸 Enter 不发送、不触发相变 ══════════
  cleanDrafts();
  await openStudio(page);
  {
    const chat = page.locator('.apollo-design-studio textarea').first();
    await chat.fill('这句话按裸回车不该发送');
    await chat.focus();
    await page.keyboard.press('Enter');           // 裸 Enter
    await page.waitForTimeout(500);
    const afterBare = await page.locator('.apollo-design-studio').innerText();
    // 仍在讨论态（有「分解成设计稿」按钮）+ 未冒出 assistant 回复气泡
    step('B: 裸 Enter 不触发相变（仍在讨论态）', /分解成设计稿/.test(afterBare));
    step('B: 裸 Enter 未发送（无 AI 回复气泡）', !/回复\d|想法够清楚/.test(afterBare), afterBare.slice(0, 100));
    // 发送路径可用（点「发送」= sendChat·与 Ctrl+Enter 同一路径；Ctrl+Enter 键位由 vitest 单测锁定）。
    await chat.fill('点发送按钮这条要发出去');
    await page.getByRole('button', { name: '发送' }).click();
    await page.waitForTimeout(1000);
    const afterSend = await page.locator('.apollo-design-studio').innerText();
    step('B: 点「发送」→ 出现 AI 回复（发送路径可用）', /明白了|核心循环/.test(afterSend), afterSend.slice(-160));
  }
  await page.getByRole('button', { name: '关闭' }).first().click().catch(() => {});
  await page.waitForTimeout(300);

  // ══════════ C) provider 失败 → 红条 + 线程保留 ══════════
  cleanDrafts();
  await openStudio(page);
  {
    // 注入 design-chat 失败（透传其它 /api/generate）。
    await page.route('**/api/generate', async (route) => {
      const body = route.request().postDataJSON?.() ?? {};
      if (body?.mode === 'design-chat') {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: false, error: '注入故障：deepseek 返回 502 Bad Gateway' }) });
      } else { await route.continue(); }
    });
    const chat = page.locator('.apollo-design-studio textarea').first();
    await chat.fill('我要做一个塔防游戏保留这条');
    await page.getByRole('button', { name: '发送' }).click();
    await page.waitForTimeout(800);
    const txt = await page.locator('.apollo-design-studio').innerText();
    step('C: provider 失败 → 红条「出错了」', /出错了/.test(txt), txt.slice(0, 120));
    step('C: 红条含原始错误（502）', /502 Bad Gateway/.test(txt));
    step('C: 失败不降级——无「怪 sample」顶替（无原型/canvas 蹦出）',
      (await page.locator('.apollo-design-studio canvas').count()) === 0);
    step('C: 线程原样保留（用户那条消息还在）', /我要做一个塔防游戏保留这条/.test(txt));
    await page.unroute('**/api/generate');
  }
  await page.getByRole('button', { name: '关闭' }).first().click().catch(() => {});
  await page.waitForTimeout(300);

  // ══════════ A) 两轮讨论 → 刷新 → 一键恢复 → 线程完整 ══════════
  cleanDrafts();
  await openStudio(page);
  {
    await page.locator('.apollo-design-studio input').first().fill('E2E 草稿游戏');
    const chat = page.locator('.apollo-design-studio textarea').first();
    await chat.fill('ROUND1 两人骰子比大小');
    await page.getByRole('button', { name: '发送' }).click();
    await page.waitForTimeout(700);
    await page.locator('.apollo-design-studio textarea').first().fill('ROUND2 先赢两局者胜');
    await page.getByRole('button', { name: '发送' }).click();
    await page.waitForTimeout(900);   // 等防抖落盘完成
    // 服务端确有草稿
    const listBefore = await (await fetch(`${API}/api/design-drafts`)).json();
    step('A: 两轮讨论后服务端有草稿', Array.isArray(listBefore?.drafts) && listBefore.drafts.length >= 1,
      JSON.stringify(listBefore).slice(0, 120));

    // 刷新页面（模拟 owner 刷新/换页）
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('text=我的游戏架', { timeout: 20000 });
    await openStudio(page);
    await page.waitForTimeout(600);
    const resumeTxt = await page.locator('.apollo-design-studio').innerText();
    step('A: 刷新后设计台列出未完成草稿', /未完成的草稿/.test(resumeTxt), resumeTxt.slice(0, 120));
    step('A: 草稿条目显示游戏名', /E2E 草稿游戏/.test(resumeTxt));
    // 一键恢复
    await page.getByRole('button', { name: '恢复' }).first().click();
    await page.waitForTimeout(700);
    const restored = await page.locator('.apollo-design-studio').innerText();
    step('A: 恢复后第一轮消息回来', /ROUND1 两人骰子比大小/.test(restored), restored.slice(0, 160));
    step('A: 恢复后第二轮消息回来', /ROUND2 先赢两局者胜/.test(restored));
  }

  await browser.close();
} catch (e) {
  FAIL++;
  console.log('  FAIL 旅程异常:', e.message);
  try { if (browser) await browser.close(); } catch { /* noop */ }
} finally {
  shutdown();
  cleanDrafts();
  cleanLibrary();
}

console.log(`\n[e2e] PASS=${PASS}  FAIL=${FAIL}`);
process.exit(FAIL ? 1 : 0);
