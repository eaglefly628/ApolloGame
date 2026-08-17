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

/**
 * 蓄一层（**不假设点的时候正好在 T1**）：T1 里蓄力键才在；错过窗口就要等下一回合，
 * 而 T4 是**玩家闸门**（没人点「下一轮」就永远停在那儿）——直接 `locator.click()` 撞上这两种
 * 情形会一直等到超时（2026-08-16 实测：leg④ 卡满 30 秒）。故按当前屏上**有什么键点什么**：
 * 有蓄力键就蓄、停在结算闸门就先推下一轮，直到真蓄上。
 */
async function chargeOnce(h, hand = "rock") {
  await until(async () => {
    const charge = h.frame().locator(`[data-action='charge.${hand}']`);
    if ((await charge.count()) > 0) { await charge.first().click(); return true; }
    const next = h.frame().locator("[data-action='duel.next']");
    if ((await next.count()) > 0) await next.first().click();   // T4 闸门：推进到下一回合再试
    return false;
  }, { label: `蓄力窗口出现并点上（${hand}）`, timeoutMs: 30_000, stepMs: 200 });
}

/**
 * 点开始 → **真进得去对局**。
 *
 * ⚠ 收工判据是「蓄力键真的可点」，**不是 `#phase-t` 在不在**（2026-08-16 实测踩到）：
 * 2026-08-13 加的「首次进入先弹玩法说明」屏是**盖在对局屏之上的一层**，`#phase-t` 在它底下
 * 照样存在 ⇒ 旧判据「`#phase-t` 出现即算进对局」在那次改动之后**恒真**，clickStart 只点一下
 * （说明屏那一下）就返回，世界根本没开跑；于是任何需要真交互的腿（leg④ 蓄力）永远等不到键，
 * 一路等到超时。**同一形状的病 REQ-S3CLICK 复查里刚记过一笔**（「画出来了」≠「点得动」）。
 * 故这里改成：反复点 `ui.start`（说明屏那下 + 开始那下），直到**世界动作**真出现在屏上。
 */
async function clickStart(h) {
  await until(async () => (await h.frame().locator("#start[data-action='ui.start'], #start button, #start").count()) > 0, { label: "启动屏出现" });
  await until(async () => {
    // **说明屏是盖在上面的一层**：底下那颗同名 `ui.start` 会被它拦住（Playwright 实测报
    // 「#help intercepts pointer events」）。故优先点**说明屏里那颗**，没有说明屏才点底下的。
    // 每次 click 单独设短超时并吞掉失败：被盖住时立刻回到轮询，而不是一路等到 30 秒默认超时。
    const inHelp = h.frame().locator("#help [data-action='ui.start']");
    const el = (await inHelp.count()) > 0 ? inHelp : h.frame().locator("[data-action='ui.start']");
    if ((await el.count()) > 0) await el.first().click({ timeout: 1_500 }).catch(() => { /* 被盖住/正在动画 → 下一轮再点 */ });
    return (await h.frame().locator("[data-action^='charge.'], [data-action='duel.next']").count()) > 0;
  }, { label: "真进对局（世界动作可点·非仅画出对局屏）", timeoutMs: 20_000, stepMs: 250 });
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
    // 首次进入那一屏说明是**发布形态的一部分**（owner 2026-08-15 要的），不是"顺手点掉的东西"：
    // clickStart 的收工判据是"世界动作可点"，它保证了说明屏**被跳过**，但没说它**不残留**
    // ——两层都在、只是按钮恰好可点，也满足那条判据。这里把"跳完就该消失"单独钉一次。
    check("① 零授权：首次进入的玩法说明已跳过、屏上不残留", !(await h.has("#help")) && !(await h.has("#start")));
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
    await chargeOnce(h, "rock");
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
    // 续局同样不该弹说明——玩家早就在打这一局了，中途糊一屏说明是打断不是引导
    // （宿主侧 `firstRunHelp = !resume && !loadHelpSeen()` 的那个 `!resume`）。
    check("④ 恢复：不弹玩法说明（续局不是首次进入）", !(await r.has("#help")));
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
  // ── ⑥ 「获取卡带」推荐位（REQ-DOKI-APPS·owner 2026-08-16 判 game108 当第一个消费者）──────
  // 走**真 SDK 的 host extension**（假宿主那头是 createAppsHostExtension·不是打桩）：
  // 证 ① 声明→client→host 真握了手（宿主那侧真收到 list 请求）
  //     ② 拿不到 runtime.input.contract 的条目被挡在推荐位外（拉不起来的键不画·留痕）
  //     ③ 整条链路不打扰对局（零致命错·对局屏照常）。
  // 「点一格 → 真发 launch」由共享层 apps-gateway 的 9 条真宿主用例覆盖（同一条 wire）。
  {
    const APPS = [
      { id: "match3", name: "三消", protocolVersion: 2, coverUrl: DOT, runtime: { input: { contract: "doki.game.match3-input", version: 1 } } },
      { id: "storyteller", name: "说书人", protocolVersion: 2, runtime: { input: { contract: "doki.world.story-input", version: 1 } } },
      { id: "no-contract", name: "拉不起来的", protocolVersion: 2 },          // 无 runtime.input → 该被挡
      { id: "game108", name: "自己", protocolVersion: 2, runtime: { input: { contract: "doki.game.game108-input", version: 1 } } },
    ];
    const h = await boot({ grantedScopes: [], hostExtensions: ["apps"], apps: APPS, input: {} });
    const logs = [];
    h.page.on("console", (m) => logs.push(m.text()));
    await until(h.initialized, { label: "⑥ init 完成", timeoutMs: 15_000 });
    await clickStart(h);
    await until(async () => ((await h.state()).listed ?? 0) > 0, { label: "⑥ 宿主真收到 apps.list 请求", timeoutMs: 10_000 });
    check("⑥ 推荐位：声明→client→host 真握手（宿主侧收到 list 请求）", ((await h.state()).listed ?? 0) > 0);
    check("⑥ 推荐位：无 runtime.input.contract 的条目被挡（拉不起来的键不画）",
      logs.some((l) => l.includes("拿不到 runtime.input.contract") && l.includes("1 个")),
      logs.filter((l) => l.includes("[game108]")).join(" | ") || "（无 [game108] 日志）");
    check("⑥ 推荐位：对局屏照常（推荐位是可选增强·不打扰对局）", await h.has("#phase-t"));
    check("⑥ 推荐位：零致命错", h.fatals.length === 0, h.fatals.join("; "));
    await h.close();
  }

  // ── ⑦ SDK 演示台：**九行逐个按一遍**（owner 2026-08-17「测试它所有的功能」）──────────
  // 整套目击里唯一「把 SDK 的每个模块都真叫一次」的地方：假宿主把八个 host extension 全挂上，
  // 页面里从设置菜单进演示台、逐行点「试一下」，然后**读宿主侧 state 核对真收到了请求**
  //（不采信页面上那行绿字——那是页面自陈）。
  {
    const h = await boot({
      grantedScopes: ["character.identity"],
      hostExtensions: ["storage", "character", "apps", "speech", "persona", "dialogue", "media", "episode"],
      character: PROFILE,
      persona: { id: "me-1", name: "阿岚", age: 24, likes: "吃辣" },
      personas: [{ id: "me-1", name: "阿岚" }],
      apps: [{ id: "game101", name: "海港绯闻", protocolVersion: 2, runtime: { input: { contract: "doki.app.input", version: 1 } } }],
      input: { card: CARD_INPUT },
    });
    await until(h.initialized, { label: "⑦ init 完成", timeoutMs: 15_000 });
    await clickStart(h);

    // 菜单 → 演示台（**走真按钮**，与玩家同一条路）
    await h.frame().locator("[data-action='ui.menu']").first().click();
    await until(async () => (await h.frame().locator("[data-action='ui.sdk']").count()) > 0, { label: "⑦ 菜单里有 SDK 那一行" });
    await h.frame().locator("[data-action='ui.sdk']").first().click();
    await until(async () => (await h.frame().locator("#sdk").count()) > 0, { label: "⑦ 演示台开了" });

    const KEYS = ["character", "storage", "apps", "speech", "persona", "dialogue", "media", "episode", "game-result"];
    const shown = await h.frame().locator("#sdk [id^='sdk-row-']").count();
    check("⑦ 演示台九行齐（= SDK 的九个能力·一个都不少）", shown === KEYS.length, `实为 ${shown} 行`);

    for (const key of KEYS) {
      await h.frame().locator(`#key-sdk-${key}`).first().click();
      // 等这一行不再是「正在问宿主…」（media 那行要走两拍轮询，给宽一点）
      await until(async () => {
        const txt = await h.text(`#sdk-d-${key}`);
        return typeof txt === "string" && !txt.includes("正在问");
      }, { label: `⑦ ${key} 有结果了`, timeoutMs: 25_000, stepMs: 250 });
    }

    // **判据读宿主侧 state**：每个模块真收到过请求（页面那行字只是给人看的）
    const st = await h.state();
    check("⑦ speech：宿主真收到 synthesize（带台词与角色 id）",
      typeof st.spoke?.text === "string" && st.spoke.text.length > 0 && !!st.spoke.characterId, `state=${JSON.stringify(st.spoke ?? null)} · 屏上=${await h.text("#sdk-d-speech")}`);
    check("⑦ persona：宿主真收到 getSelected", !!st.personaAsked?.characterId, JSON.stringify(st.personaAsked ?? null));
    check("⑦ dialogue：宿主真收到 generateOpening", !!st.opening?.characterId, `state=${JSON.stringify(st.opening ?? null)} · 屏上=${await h.text("#sdk-d-dialogue")}`);
    check("⑦ media：宿主真收到 generateImage（prompt 非空·且轮询走到 done）",
      typeof st.imagePrompt === "string" && st.imagePrompt.length > 0, String(st.imagePrompt ?? null));
    check("⑦ apps：宿主真收到 list", (st.listed ?? 0) > 0, `listed=${st.listed}`);
    check("⑦ episode：宿主真收到 gameCompleted（战果往剧情那条出口）",
      (st.episode ?? []).some((e) => e.type === "episode.gameCompleted"),
      JSON.stringify((st.episode ?? []).map((e) => e.type)));
    const storageDetail = await h.text("#sdk-d-storage");
    check("⑦ storage：存 → 读 → 清 三步通了", String(storageDetail).includes("三步都通了"), String(storageDetail));
    // game-result 那一行**不许真发 complete**（发了这一局就结束了·演示台不该替玩家交卷）
    check("⑦ game-result：只报「发出去会是什么」，没真 complete", !st.completed, JSON.stringify(st.completed ?? null));

    // 九行**全通**：八个 extension 全挂上时，任何一行报降级都说明那条链没接通
    const downs = [];
    for (const key of KEYS) {
      const d = String(await h.text(`#sdk-d-${key}`) ?? "");
      if (d.includes("没实现") || d.includes("未声明") || d.includes("没给") || d.includes("没接") || d.includes("没生成") || d.includes("没合成")) downs.push(`${key}: ${d}`);
    }
    check("⑦ 九行没有一行降级（八个 extension 全挂上时该全通）", downs.length === 0, downs.join(" | "));
    // ⚠ **防空转**：上面那条只查"有没有降级词"，而**没点上**的行停在初始 detail「已声明 · 待试」
    // ——它一个降级词都不含，于是"全绿"可能只是根本没按到（第一版实测正是这么假绿的）。
    const untouched = [];
    for (const key of KEYS) {
      const d = String(await h.text(`#sdk-d-${key}`) ?? "");
      if (d.includes("待试") || d.includes("正在问")) untouched.push(`${key}: ${d}`);
    }
    check("⑦ 九行**每一行都真按下去过**（没有停在「待试」的）", untouched.length === 0, untouched.join(" | "));
    await h.page.screenshot({ path: resolve(SHOTS, "hosted-sdk-panel.png") });
    check("⑦ 演示台：零致命错", h.fatals.length === 0, h.fatals.join("; "));
    await h.close();
  }
} finally {
  await browser.close();
  await server.close();
}

const failed = checks.filter((c) => !c.pass);
console.log(`\n[witness] PASS=${checks.length - failed.length} FAIL=${failed.length}`);
process.exit(failed.length ? 1 : 0);
