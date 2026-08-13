#!/usr/bin/env node
// dokiworld/game108 · cover 真图生成（规范 §3 `cover: "assets/cover.webp"`·美术线红线=禁灰块占位）。
//
// 做法：假宿主（同 witness 的 createAppHost 整链握手）装载**构建好的 dist** → 点开始 →
// 等对局进 T1 中段（六条槽/血条/手牌全上屏）→ 1280×720 截对局屏 → 页内 canvas 转 WebP →
// 写回 src/assets/cover.webp（源资产·build 复制进 dist）。截的是真画面，不是摆拍素材。
//
// 用法：npm run build && npm run cover（cover 变了要再 build 一次让它进 dist）。
// 注意先有鸡后有蛋：首次生成时 src/assets/cover.webp 可能还不存在而 build 又校验它——
// 先放任意占位文件跑 build、跑本脚本出真图、再 build 一次即收敛（此后仓里始终有真图）。
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startHarnessServer, chromiumPath, until } from "./lib/host-harness.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(appRoot, "src", "assets", "cover.webp");
const COVER = { width: 1280, height: 720 };   // cover 规格：16:9（规范未定尺寸·取通用卡面比例）

const execPath = chromiumPath();
if (!execPath) { console.error("[cover] 本机无 Chromium，无法生成"); process.exit(3); }

const server = await startHarnessServer({ appRoot });
const browser = await chromium.launch({ executablePath: execPath });
try {
  const page = await browser.newPage({ viewport: COVER });
  await page.goto(`${server.url}/harness.html`);
  // 宿主带 storage/character（都返回空）——capability 即答，免等超时；零授权同款画面。
  await page.evaluate((c) => window.__setup(c), { grantedScopes: [], hostExtensions: ["storage", "character"], input: {} });
  const frame = () => page.frames().find((f) => f.url().includes("/app/"));
  await until(async () => page.evaluate(() => window.__state.initialized), { label: "init 完成", timeoutMs: 15_000 });
  // 点开始（1.4s 假加载走完才挂 action）→ 等对局屏 → 等 T1 中段画面铺满
  await until(async () => {
    const el = frame().locator("[data-action='ui.start']");
    if ((await el.count()) === 0) return false;
    await el.first().click();
    return true;
  }, { label: "开始键可点", timeoutMs: 8_000, stepMs: 250 });
  await until(async () => (await frame().locator("#phase-t").count()) > 0, { label: "对局屏挂载" });
  await page.waitForTimeout(1_200);            // T1 中段：倒计时环在走、手牌浮起
  const png = await page.screenshot({ type: "png" });
  // 页内 canvas 转 WebP（质量 0.9）——Chromium 自己就是最顺手的编码器，零新依赖
  const dataUrl = await page.evaluate(async ([b64, w, h]) => {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = `data:image/png;base64,${b64}`; });
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/webp", 0.9);
  }, [png.toString("base64"), COVER.width, COVER.height]);
  if (!dataUrl.startsWith("data:image/webp;base64,")) throw new Error("WebP 编码失败（拿到的不是 image/webp）");
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, Buffer.from(dataUrl.slice("data:image/webp;base64,".length), "base64"));
  console.log(`[cover] 写入 ${OUT}（${COVER.width}×${COVER.height} WebP·真对局屏）`);
} finally {
  await browser.close();
  await server.close();
}
