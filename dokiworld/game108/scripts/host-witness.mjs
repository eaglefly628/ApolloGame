#!/usr/bin/env node
// dokiworld/game108 · 假宿主三形态目击（规范 §12「required/optional scope 缺失场景有测试和
// 降级行为」+ §6 挂起/恢复的整链复核）。**真 dist + SDK 真 createAppHost**，不 mock 协议。
//
// 形态（差距清单第 6 条钉死的三档 + 挂起/恢复 + resize 实测）：
//   ⓪ 无宿主：直接开 dist —— 等待屏不白屏、零致命错（规范 §6：connect 挂起属预期）
//   ① 零授权（grantedScopes=[]·宿主零 capability）→ 降级链末位：内置兜底卡「复读机」
//   ② 只 input 卡（零 scope + input.data.card）→ 降级链中位：input 卡上屏
//   ③ 带 character 资料（授权 identity/avatar + 宿主 character extension·input 卡同在）
//      → 降级链首位：授权资料**压过** input 卡上屏
//   ④ 挂起/恢复：真打一手 → prepareExit 报 canSuspend:true 且 checkpoint 真落宿主 →
//      decideExit(suspend) → 新实例带 checkpoint 重进 → 跳过开始闸门、蓄力/血量原样续
//   ⑤ resize：1280×720 与 800×1200 两档视口下页面都不得横向溢出（「无需宿主 resize 协商」的实测腿）
//
// 用法：npm run witness（先 npm run build）。退出码 0=全过 1=有红 3=本机无浏览器。
// 截图落 ../../docs/design/dokiworld/game108-fullspec/。
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startHarnessServer, chromiumPath, until } from "./lib/host-harness.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = resolve(appRoot, "..", "..", "docs", "design", "dokiworld", "game108-fullspec");
mkdirSync(SHOTS, { recursive: true });

const execPath = chromiumPath();
if (!execPath) { console.error("[witness] 本机无 Chromium，跳过（同渲染探针 R1 语义）"); process.exit(3); }

const checks = [];
function check(name, pass, detail = "") {
  checks.push({ name, pass });
  console.log(`${pass ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// 1×1 红点 PNG（data: URL·角色画像用——不出外网，页面零外部请求）
const DOT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const CARD_INPUT = { id: "card:tea", name: "茶茶", avatarUrl: DOT };
const PROFILE = { id: "char:sherry", name: "雪莉", description: "冷面甜心", avatarUrl: DOT };

const server = await startHarnessServer({ appRoot });
const browser = await chromium.launch({ executablePath: execPath });

/** 起一个隔离 context + 假宿主形态；返回操作句柄。 */
async function boot(config, { viewport = { width: 1280, height: 720 } } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const fatals = [];
  page.on("pageerror", (e) => fatals.push(String(e)));
  await page.goto(`${server.url}/harness.html`);
  await page.evaluate((c) => window.__setup(c), config);
  const frame = () => page.frames().find((f) => f.url().includes("/app/"));
  return {
    page, fatals,
    frame,
    text: async (sel) => frame().locator(sel).first().textContent({ timeout: 5_000 }),
    has: async (sel) => (await frame().locator(sel).count()) > 0,
    initialized: () => page.evaluate(() => window.__state.initialized),
    state: () => page.evaluate(() => window.__state),
    prepareExit: (reason) => page.evaluate((r) => window.__prepareExit(r), reason ?? "navigation"),
    decideExit: (d) => page.evaluate((dd) => window.__decideExit(dd), d),
    close: () => ctx.close(),
  };
}

/** 点开始（等 1.4s 假加载走完挂上 action）→ 等对局屏。 */
async function clickStart(h) {
  await until(async () => (await h.frame().locator("#start[data-action='ui.start'], #start button, #start").count()) > 0, { label: "启动屏出现" });
  await until(async () => {
    const el = h.frame().locator("[data-action='ui.start']");
    if ((await el.count()) === 0) return false;
    await el.first().click();
    return true;
  }, { label: "加载走完·开始键可点", timeoutMs: 8_000, stepMs: 250 });
  await until(async () => (await h.frame().locator("#phase-t").count()) > 0, { label: "对局屏挂载" });
}

try {
  // ── ⓪ 无宿主 ─────────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const fatals = [];
    page.on("pageerror", (e) => fatals.push(String(e)));
    await page.goto(`${server.url}/app/index.html`);
    await page.waitForTimeout(1_500);
    check("⓪ 无宿主：等待屏在（#standby 可见·不白屏）", await page.locator("#standby").isVisible());
    check("⓪ 无宿主：零致命错", fatals.length === 0, fatals.join("; "));
    await page.screenshot({ path: resolve(SHOTS, "hostless-standby.png") });
    await ctx.close();
  }

  // ── ① 零授权 ─────────────────────────────────────────────────────────────
  {
    const h = await boot({ grantedScopes: [], hostExtensions: [], input: {} });
    await until(h.initialized, { label: "① init 完成（capability 全超时后仍须初始化成功）", timeoutMs: 15_000 });
    check("① 零授权：initialized（capability 缺席不阻塞开局）", true);
    check("① 零授权：等待屏已撤、启动闸门屏在", !(await h.has("#standby")) && (await h.has("#start")));
    await clickStart(h);
    check("① 零授权：对手=内置兜底卡「复读机」（降级链末位）", (await h.text("#side-p2-nt")) === "复读机",
      `实为 ${await h.text("#side-p2-nt")}`);
    check("① 零授权：零致命错", h.fatals.length === 0, h.fatals.join("; "));
    await h.close();
  }

  // ── ② 只 input 卡 ────────────────────────────────────────────────────────
  {
    const h = await boot({ grantedScopes: [], hostExtensions: ["storage"], input: { card: CARD_INPUT, mood: "sharp" } });
    await until(h.initialized, { label: "② init 完成", timeoutMs: 15_000 });
    await clickStart(h);
    check("② 只 input 卡：对手=茶茶（降级链中位）", (await h.text("#side-p2-nt")) === "茶茶",
      `实为 ${await h.text("#side-p2-nt")}`);
    check("② 只 input 卡：mood 投影上屏（sharp→精明）", (await h.text("#side-p2-mood-t")) === "精明",
      `实为 ${await h.text("#side-p2-mood-t")}`);
    // ── ⑤ resize 实测（借本形态活体·纯 CSS 自适应的证据腿）────────────────
    for (const vp of [{ width: 1280, height: 720 }, { width: 800, height: 1200 }]) {
      await h.page.setViewportSize(vp);
      await h.page.waitForTimeout(400);
      const overflow = await h.frame().evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`⑤ resize ${vp.width}×${vp.height}：无横向溢出（scrollW−clientW=${overflow}）`, overflow <= 1);
    }
    await h.page.setViewportSize({ width: 1280, height: 720 });
    check("② 只 input 卡：零致命错", h.fatals.length === 0, h.fatals.join("; "));
    await h.close();
  }

  // ── ③ 带 character 资料 ──────────────────────────────────────────────────
  {
    const h = await boot({
      grantedScopes: ["character.identity", "character.avatar"],
      hostExtensions: ["character", "storage"],
      character: PROFILE,
      input: { card: CARD_INPUT, mood: "sharp" },
    });
    await until(h.initialized, { label: "③ init 完成", timeoutMs: 15_000 });
    await clickStart(h);
    check("③ character 资料：对手=雪莉（授权资料**压过** input 卡·降级链首位）",
      (await h.text("#side-p2-nt")) === "雪莉", `实为 ${await h.text("#side-p2-nt")}`);
    await h.page.screenshot({ path: resolve(SHOTS, "hosted-mounted.png") });
    check("③ character 资料：零致命错", h.fatals.length === 0, h.fatals.join("; "));
    await h.close();
  }

  // ── ④ 挂起/恢复 ──────────────────────────────────────────────────────────
  {
    const RUN_ID = "run-suspend-1";
    const h = await boot({ runId: RUN_ID, grantedScopes: [], hostExtensions: ["storage"], input: { card: CARD_INPUT } });
    await until(h.initialized, { label: "④ init 完成", timeoutMs: 15_000 });
    await clickStart(h);
    // 真打一手：蓄石头一层（世界真变了才有「恢复回来还在」可断言）。读数格式=「层/上限」。
    await h.frame().locator("[data-action='charge.rock']").first().click();
    await until(async () => (await h.text("#cb-p1-rock-v")) === "1/3", { label: "④ 蓄力落地（rock=1/3）" });
    const before = { rock: await h.text("#cb-p1-rock-v"), hp: await h.text("#side-p1-hpv"), foe: await h.text("#side-p2-nt") };
    const exitState = await h.prepareExit("navigation");
    check("④ 挂起：canSuspend=true（checkpoint 真存上才敢报）", exitState.canSuspend === true, JSON.stringify(exitState));
    check("④ 挂起：中途分 output 同报（exited·宿主判 discard 时用）",
      exitState.output?.contract === "doki.game.result" && exitState.output?.data?.outcome === "exited",
      JSON.stringify(exitState.output ?? null));
    const saved = (await h.state()).saved;
    check("④ 挂起：checkpoint 落进宿主 storage（contract game108-checkpoint/1）",
      saved?.contract === "doki.game.game108-checkpoint" && saved?.version === 1 && typeof saved?.data?.world === "string",
      JSON.stringify(saved && { contract: saved.contract, version: saved.version, bytes: saved.data?.world?.length }));
    check("④ 挂起：checkpoint 压缩包在 capability 64KB 硬门内", (saved?.data?.world?.length ?? Infinity) < 64 * 1024,
      `bytes=${saved?.data?.world?.length}`);
    await h.decideExit("suspend");
    await h.close();

    // 恢复：同 runId·新实例（新页面=新 instanceId），宿主把存下的 checkpoint 递回去
    const r = await boot({ runId: RUN_ID, grantedScopes: [], hostExtensions: ["storage"], checkpoint: saved, input: { card: CARD_INPUT } });
    await until(r.initialized, { label: "④ 恢复 init 完成", timeoutMs: 15_000 });
    await until(async () => (await r.has("#phase-t")), { label: "④ 恢复后对局屏挂载" });
    check("④ 恢复：跳过开始闸门（无 #start 启动屏·直接续局）", !(await r.has("#start")));
    check("④ 恢复：蓄力原样（rock=1）", (await r.text("#cb-p1-rock-v")) === before.rock,
      `前=${before.rock} 后=${await r.text("#cb-p1-rock-v")}`);
    check("④ 恢复：血量原样", (await r.text("#side-p1-hpv")) === before.hp,
      `前=${before.hp} 后=${await r.text("#side-p1-hpv")}`);
    check("④ 恢复：对手名原样（input 卡链路照走）", (await r.text("#side-p2-nt")) === before.foe);
    // 活性：恢复的不是一张静态截图——相位时钟必须继续走（T1 余量 <4.5s 内必翻到 T2）
    const phaseAt = await r.text("#phase-t");
    await until(async () => (await r.text("#phase-t")) !== phaseAt, { label: "④ 恢复后相位继续推进", timeoutMs: 8_000, stepMs: 300 });
    check("④ 恢复：世界活着（相位从「" + phaseAt + "」继续推进）", true);
    await r.page.screenshot({ path: resolve(SHOTS, "hosted-resumed.png") });
    check("④ 恢复：零致命错", r.fatals.length === 0, r.fatals.join("; "));
    await r.close();
  }
} finally {
  await browser.close();
  await server.close();
}

const failed = checks.filter((c) => !c.pass);
console.log(`\n[witness] PASS=${checks.length - failed.length} FAIL=${failed.length}`);
process.exit(failed.length ? 1 : 0);
