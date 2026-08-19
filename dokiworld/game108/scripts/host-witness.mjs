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
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startHarnessServer, chromiumPath, until } from "./lib/host-harness.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = resolve(appRoot, "..", "..", "docs", "design", "dokiworld", "game108-fullspec");
// 版本号判据的**唯一真相**：package.json。屏上那两处（启动屏角标 / 演示台标题旁）都对它核，
// 而不是互相核——`__APP_VERSION__` 是构建期注入的，漏注入时两处会一起变成同一个错值。
const PKG_VERSION = JSON.parse(readFileSync(resolve(appRoot, "package.json"), "utf8")).version;
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
    // 「可能压根没画出来」的元素专用：**不抛**，缺件即空串。
    // 判据本身要的就是"在不在"，用会抛的读法会让一条红把后面几十条一起掀掉（版本号腿实测）。
    softText: async (sel) => ((await frame().locator(sel).count()) > 0
      ? (await frame().locator(sel).first().textContent({ timeout: 5_000 })) ?? ""
      : ""),
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
    // owner 2026-08-18「我能知道这个游戏的版本号，在游戏中能看到是不是我最新的」：
    // 启动屏一进来就得看见版本号，**且等于 package.json**（构建漏注入 __APP_VERSION__ 时这里红）。
    const startVer = await h.softText("#start-ver");
    check("① 启动屏角标显示版本号 = package.json 的版本", startVer.includes(PKG_VERSION),
      `屏上=${startVer} · 包=${PKG_VERSION}`);
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
  // ── ⑥ `apps` 未声明：**一个字节都不发**（2026-08-18 按 SDK 3.0 Host profile 表改写）─────
  //
  // 原本这一腿证的是「获取卡带」推荐位真握手。SDK 3.0 样例仓 README 给出 Host capability
  // profile 表后，`apps` 被定死为 **World Page Host 专属**——Game 被 Chat Game Host 或
  // World Nested App Host 拉起，两台都没有它。声明了也拿不到，故本包已从 EXTENSIONS 摘掉。
  //
  // 那这一腿现在证什么？证**纪律①（未声明就一个字节都别发）真的生效**：
  // 假宿主这头把 apps host extension 挂上并**记账**，我方却不该产生任何一次 list 请求。
  // 这不是"删掉一条腿"，是把它翻面——原来量"发出去了"，现在量"确实没发"。
  // 为什么值得量：未声明还发消息的表症是**静默等到超时**（最难查的那一类），
  // 而它在代码里只是一个 `declared('apps')` 布尔——最容易被人"顺手改回 true"。
  {
    const APPS = [
      { id: "match3", name: "三消", protocolVersion: 2, coverUrl: DOT, runtime: { input: { contract: "doki.game.match3-input", version: 1 } } },
      { id: "storyteller", name: "说书人", protocolVersion: 2, runtime: { input: { contract: "doki.world.story-input", version: 1 } } },
      { id: "no-contract", name: "拉不起来的", protocolVersion: 2 },          // 无 runtime.input → 该被挡
      { id: "game108", name: "自己", protocolVersion: 2, runtime: { input: { contract: "doki.game.game108-input", version: 1 } } },
    ];
    // 假宿主**故意比真 Chat Game Host 宽**：把 apps 挂上并记账。宽在这里是对的——
    // 我们要量的是"我方发没发"，宿主那头开着门反而让"偷偷发了"无处可藏。
    const h = await boot({ grantedScopes: [], hostExtensions: ["apps"], apps: APPS, input: {} });
    const logs = [];
    h.page.on("console", (m) => logs.push(m.text()));
    await until(h.initialized, { label: "⑥ init 完成", timeoutMs: 15_000 });
    await clickStart(h);
    // 打满一个回合再看账：`resolveAppPicks` 挂在挂载之后异步跑，立刻读会读到"还没来得及发"，
    // 那样这条判据对"真发了"也是绿的（假绿）。等到对局真跑起来再读。
    await chargeOnce(h);
    await h.page.waitForTimeout(2_500);
    const st6 = await h.state();
    check("⑥ apps 未声明 ⇒ 宿主一次 list 请求都没收到（纪律①：未声明就别发）",
      (st6.listed ?? 0) === 0, `listed=${st6.listed ?? 0}`);
    check("⑥ 降级留痕（不是静默消失·日志能说清为什么没有推荐位）",
      logs.some((l) => l.includes("[game108]") && l.includes("apps.") && l.includes("not-declared")),
      logs.filter((l) => l.includes("apps.")).join(" | ") || "（无 apps 日志）");
    // ⚠ 不在这里断言"推荐位没画出来"：那条推荐位只在**终局屏**出现（`endPanel` 里 picks.length
    //   才画），对局中本来就不在 ⇒ 那条判据对"真拿到了列表"也是绿的，是一条空转判据。
    //   真正的判据是上面那两条（宿主零请求 + 降级留痕），它们不依赖走到终局。
    check("⑥ 对局屏照常（可选增强缺席不打扰对局）", await h.has("#phase-t"));
    check("⑥ 零致命错", h.fatals.length === 0, h.fatals.join("; "));
    await h.close();
  }

  // ── ⑧ 无感三条：persona / speech / dialogue **不用玩家做任何事就该生效**───────────
  // owner 2026-08-17：「把这 9 个功能无感地实现到游戏中」。所以这一腿**一个演示台的键都不按**，
  // 只是正常开局，然后看屏上/宿主侧有没有自己发生变化——那才叫无感。
  {
    const h = await boot({
      grantedScopes: ["character.identity"],
      hostExtensions: ["storage", "character", "speech", "persona", "dialogue"],
      character: PROFILE,
      persona: { id: "me-1", name: "阿岚", age: 24, gender: "female", likes: "吃辣" },
      input: { card: CARD_INPUT },
    });
    await until(h.initialized, { label: "⑧ init 完成", timeoutMs: 15_000 });
    // ⚠ **在她开口之前**装一个 Audio 探子：预取（main.ts 那一半）与播放（游戏那一半）是两件事，
    // 只断言"宿主收到了 synthesize"证不了游戏真去播了宿主给的那段——撤掉整条播放路径也照样绿
    // （2026-08-17 撤修实测：把 `voiceClips[ev]` 改成 undefined，这一腿一条都没红）。
    await h.frame().evaluate(() => {
      window.__played = [];
      const orig = window.Audio;
      window.Audio = function (src) { window.__played.push(String(src ?? "")); return new orig(src); };
      window.Audio.prototype = orig.prototype;
    });
    await clickStart(h);

    // 【persona】我方那一侧的名字**自己**变成了玩家的名字（此前写死「你」）
    await until(async () => (await h.text("#side-p1-nt")) === "阿岚", { label: "⑧ 我方名字换成 persona 给的", timeoutMs: 10_000 });
    check("⑧ persona：我方身份牌显示玩家名字（不再是写死的「你」）", (await h.text("#side-p1-nt")) === "阿岚",
      `实为 ${await h.text("#side-p1-nt")}`);

    // 【dialogue】开场白：宿主生成的那句**自己**取代了本地写死的七句之一
    await until(async () => !!(await h.state()).opening, { label: "⑧ 宿主收到 generateOpening", timeoutMs: 15_000 });
    check("⑧ dialogue：开局自己去要了开场白（玩家没点任何东西）", !!(await h.state()).opening,
      JSON.stringify((await h.state()).opening ?? null));

    // 【speech】七句台词在加载/开局那段被**批量**预取（对局中播放才是零等待）
    await until(async () => ((await h.state()).spokeCount ?? 0) >= 7, { label: "⑧ 七句台词都合成过一遍", timeoutMs: 20_000 });
    const st8 = await h.state();
    check("⑧ speech：七句台词开局就预取完（对局中零等待的前提）", (st8.spokeCount ?? 0) >= 7, `合成了 ${st8.spokeCount} 句`);
    // 预取用的是**这一局真要说的那句**：开场白已经到手，合成的就该是它而不是本地兜底词
    check("⑧ speech×dialogue 串起来了：合成的是宿主生成的开场白，不是本地兜底词",
      (st8.spokenTexts ?? []).includes("就你也配跟我猜拳？"),
      JSON.stringify((st8.spokenTexts ?? []).slice(0, 3)));

    // 【消费那一半】——**必须真打一个回合**：她只在「亮拳 / 新回合 / 满蓄 / 分胜负」这几拍开口，
    // 光进对局屏是听不到任何一句的（第一版就这么写的，探子装了她没开口，等满超时）。
    await chargeOnce(h, "rock");
    await h.frame().locator("[data-action='throw.rock']").first().click();
    await until(async () => ((await h.frame().evaluate(() => window.__played ?? [])).length > 0),
      { label: "⑧ 亮拳那一拍她开口了（游戏真去播宿主给的音频）", timeoutMs: 25_000, stepMs: 300 });
    const played = await h.frame().evaluate(() => window.__played ?? []);
    check("⑧ speech 消费端：游戏播的是**宿主给的那段**（不是浏览器 TTS）",
      played.some((u) => u.startsWith("data:audio/")), JSON.stringify(played.slice(0, 2)));
    // 【dialogue 消费那一半】被覆盖的是 `roundStart` 那句（开场白），所以要**走到下一回合**。
    // ⚠ 同一张嘴有 8 秒冷却（`SAY_COOLDOWN`·owner 2026-08-08「有点太聒噪了」）——
    // 刚在亮拳那拍说过，立刻推下一轮的话新回合那句会被冷却吞掉。故这里**故意等过冷却**。
    await h.page.waitForTimeout(9_000);
    await until(async () => {
      const next = h.frame().locator("[data-action='duel.next']");
      if ((await next.count()) > 0) { await next.first().click(); return true; }
      return false;
    }, { label: "⑧ 推进到下一回合", timeoutMs: 20_000, stepMs: 300 });
    // ⚠ 判据在假宿主补上 `generateDialogue` 之后**变了**（2026-08-17）：此前宿主只实现 generateOpening，
    // 新回合那句仍是开场白；现在「提前一回合」那条链真的生效了 —— 上一回合打完就为这一回合
    // 生成了一句挑衅，于是新回合她说的是**那句**。这比断言开场白更强：它证的是整条预生成链。
    await until(async () => String(await h.text("#subtitle-t").catch(() => "")).includes("辣得说不出话"),
      { label: "⑧ 新回合那句 = 上一回合结算时预生成的挑衅（提前一回合链）", timeoutMs: 25_000, stepMs: 300 });
    const sub = await h.text("#subtitle-t").catch(() => null);
    check("⑧ dialogue 消费端：新回合字幕 = 上一回合预生成的那句（本地七句里没有这句）",
      typeof sub === "string" && sub.includes("辣得说不出话"), String(sub));

    // 【dialogue×persona】她凭什么"知道你的喜好"——**必须真的把喜好递过去**。
    // 只把 persona 塞进 `playerPersona` 指望 LLM 自己想起来用是句没依据的话（2026-08-17 自查），
    // 故判据有两条：提示词里写了喜好 · playerPersona 是**真身份**（不是编的 0 岁无性别）。
    await until(async () => !!(await h.state()).taunt, { label: "⑧ 回合切换时为下一回合要了一句", timeoutMs: 25_000, stepMs: 300 });
    const taunt = (await h.state()).taunt;
    check("⑧ dialogue×persona：喜好写进了提示词（不是只塞 playerPersona 碰运气）",
      typeof taunt?.playerInput === "string" && taunt.playerInput.includes("吃辣"), String(taunt?.playerInput ?? null));
    check("⑧ dialogue×persona：playerPersona 是**宿主给的真身份**（age/gender 不许编）",
      taunt?.playerPersona?.name === "阿岚" && taunt.playerPersona.age === 24, JSON.stringify(taunt?.playerPersona ?? null));

    check("⑧ 无感三条：零致命错", h.fatals.length === 0, h.fatals.join("; "));
    await h.page.screenshot({ path: resolve(SHOTS, "hosted-seamless.png") });
    await h.close();
  }

  // ── ⑦ SDK 演示台：**逐行按一遍**（owner 2026-08-17「测试它所有的功能」）─────────────
  // 整套目击里唯一「把 SDK 的每个模块都真叫一次」的地方：页面里从设置菜单进演示台、
  // 逐行点「试一下」，然后**读宿主侧 state 核对真收到了请求**（不采信页面那行绿字——那是自陈）。
  //
  // ⚠ 2026-08-18 关键改动：假宿主从「把八个全挂上」改成 **`profile: "chat-game"`**。
  //   上一版那种挂法让本地 48/48 全绿而真宿主里五个红——**尺子比被测环境宽，量出来的绿是假的**。
  //   Chat Game Host 是 Game 的真实落点，它**没有 apps / episode**；于是这一腿现在
  //   同时量两件事：profile 里**有**的那些真通，profile 里**没**的那两行**说得清为什么**。
  {
    const h = await boot({
      grantedScopes: ["character.identity"],
      profile: "chat-game",
      character: PROFILE,
      persona: { id: "me-1", name: "阿岚", age: 24, gender: "female", likes: "吃辣" },
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

    // 台上的行 = `SDK_MODULES`（含两条 World 专属的·留着正是为了让"拿不到"看得见）
    const KEYS = ["character", "storage", "speech", "persona", "dialogue", "media", "progress", "apps", "episode", "game-result"];
    // 这台 profile **不提供**的：按下去该给出"本宿主不提供"的说法，而不是假装在等宿主
    const OFF_PROFILE = ["apps", "episode"];
    const shown = await h.frame().locator("#sdk [id^='sdk-row-']").count();
    check("⑦ 演示台的行齐（= SDK_MODULES·一个都不少）", shown === KEYS.length, `实为 ${shown} 行`);

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
    // apps / episode 这台 profile 没有 ⇒ 判据**换向**：不是"宿主收到了"，是"宿主一条都没收到"，
    // 且屏上那行**说得出为什么**（"本宿主不提供"而不是干巴巴一句"未声明"——后者会把人引去
    // 加声明，而加了也没用，2026-08-17 正是这么错的）。
    check("⑦ apps：这台 profile 没有 ⇒ 宿主零请求", (st.listed ?? 0) === 0, `listed=${st.listed ?? 0}`);
    check("⑦ episode：这台 profile 没有 ⇒ 宿主零事件", (st.episode ?? []).length === 0,
      JSON.stringify((st.episode ?? []).map((e) => e.type)));
    for (const key of OFF_PROFILE) {
      const d = String(await h.softText(`#sdk-d-${key}`) ?? "");
      check(`⑦ ${key} 那行说得出"为什么拿不到"（且是**按下之后**那句·初始文案不含"拿不到"）`,
        d.includes("拿不到") && d.includes("World Page Host"), d || "(空)");
    }
    // 【progress】单向消息没有回执，但**宿主那头收得到**——判据必须读宿主侧账本，不读页面自陈。
    // （第一版就读了页面那行"已发…"：撤掉 app.send 整句后那行字一模一样，60/60 照样全绿。）
    const dProgress = String(await h.softText("#sdk-d-progress") ?? "");
    check("⑦ progress：**宿主真收到** dokiworld-app-progress（不是页面自陈）",
      (st.progress ?? []).some((p) => Number.isFinite(p?.score) && p?.maxScore === 100),
      `state.progress=${JSON.stringify(st.progress ?? null)} · 屏上=${dProgress}`);
    // resize 同理：leg ⑤ 只量了"页面不横向溢出"（那是 CSS 的功劳），没量"高度建议真发出去了"。
    check("⑦ resize：**宿主真收到**高度建议", Number.isFinite(st.resize?.height), JSON.stringify(st.resize ?? null));
    const storageDetail = await h.text("#sdk-d-storage");
    check("⑦ storage：存 → 读 → 清 三步通了", String(storageDetail).includes("三步都通了"), String(storageDetail));
    // game-result 那一行**不许真发 complete**（发了这一局就结束了·演示台不该替玩家交卷）
    check("⑦ game-result：只报「发出去会是什么」，没真 complete", !st.completed, JSON.stringify(st.completed ?? null));

    // 九行**全通**：八个 extension 全挂上时，任何一行报降级都说明那条链没接通
    const downs = [];
    for (const key of KEYS.filter((k) => !OFF_PROFILE.includes(k))) {
      const d = String(await h.text(`#sdk-d-${key}`) ?? "");
      if (d.includes("没实现") || d.includes("未声明") || d.includes("没给") || d.includes("没接") || d.includes("没生成") || d.includes("没合成")) downs.push(`${key}: ${d}`);
    }
    check("⑦ 本 profile 提供的那些行没有一行降级（该给的都给了时应全通）", downs.length === 0, downs.join(" | "));
    // ⚠ **防空转**：上面那条只查"有没有降级词"，而**没点上**的行停在初始 detail「已声明 · 待试」
    // ——它一个降级词都不含，于是"全绿"可能只是根本没按到（第一版实测正是这么假绿的）。
    const untouched = [];
    for (const key of KEYS) {
      const d = String(await h.text(`#sdk-d-${key}`) ?? "");
      if (d.includes("待试") || d.includes("正在问")) untouched.push(`${key}: ${d}`);
    }
    check("⑦ **每一行都真按下去过**（没有停在「待试」的）", untouched.length === 0, untouched.join(" | "));

    // ── 运行日志：iframe 里没有 console，owner「我在这个应用中无法看到日志」──────────
    // 判据不是"日志区画出来了"（那是 vitest 的活），是**真按了九行之后屏上有对应的调用记录**：
    // 接线断了（onCall 没接 / 只在 warn 时才推）时日志区会是空的或只有开场那一行，这里就该红。
    // ⚠ 日志区只画最近 8 条，而上面按了 10 行（media 一行就产 3 条）⇒ **先按的会被挤出可视区**。
    //   直接读那 8 行来判"两条进料口都记上了"是**顺序依赖**的（实测：加了两条"未发送"之后
    //   storage 就被挤没了，判据当场红——红得没道理，它量的是窗口大小不是接线）。
    //   故：读之前把**两条进料口各一个代表**再按一次（speech=网关口·storage=traced 口），
    //   让它们必然落在窗口内。这不是放水——被测的仍是"按一次会不会在屏上留下记录"，
    //   只是不再受窗口位置左右；判据也相应只声称"各有一个代表记上了"，不吹成"全都记上了"。
    for (const rep of ["speech", "storage"]) {
      await h.frame().locator(`#key-sdk-${rep}`).first().click();
      await until(async () => {
        const t = await h.softText(`#sdk-d-${rep}`);
        return typeof t === "string" && t.length > 0 && !t.includes("正在问");
      }, { label: `⑦ ${rep} 复按有结果了`, timeoutMs: 15_000, stepMs: 200 });
    }
    const logLines = [];
    for (let i = 0; i < 8; i++) {
      const t = await h.softText(`#sdk-log-${i}`);
      if (typeof t === "string" && t.length > 0) logLines.push(t);
    }
    check("⑦ 屏上运行日志有货（不是空面板）", logLines.length > 0, `${logLines.length} 行`);
    // 时间戳前缀 = 每条都是**一次真调用**留下的，不是写死的说明文案
    check("⑦ 日志每行带时间戳（是调用记录不是说明文案）",
      logLines.length > 0 && logLines.every((l) => /^\d\d:\d\d:\d\d /.test(l)), logLines[0] ?? "(空)");
    // 最上面是最新一条：九行按完，最新的必然是某个 capability 的调用，而不是 init 那句开场
    check("⑦ 日志是**新的在上**（按完九行后最新一条不是开场那句）",
      logLines.length > 0 && !logLines[0].includes("声明扩展"), logLines[0] ?? "(空)");
    // 点名核对：按下去的那几个 capability 名字要在日志里出现（否则日志与按钮是两条不相干的线）
    // ⚠ **日志有两条进料口，要分别钉**（2026-08-18 撤修验红实测）：
    //   · 五个 capability 网关走 `onCall` 钩子（speech/persona/dialogue/media/episode）
    //   · character/storage/apps 走 `traced()` 包装
    // 拆掉其中一条，另一条照样把面板填满 ⇒ 只查"有没有货"是**假绿**（实测：砍掉 onCall 那条，
    // 面板还有 7 行 traced 的记录，「有货 / 带时间戳 / 新的在上」三条全绿）。故两条各点名一次。
    const logBlob = logLines.join(" | ");
    check("⑦ 日志覆盖**网关口**（代表：speech）", logBlob.includes("speech."), `日志=${logBlob}`);
    check("⑦ 日志覆盖**traced 口**（代表：storage）", logBlob.includes("storage."), `日志=${logBlob}`);

    // ── 版本号：owner「我能知道这个游戏的版本号，在游戏中能看到是不是我最新的」──────
    // 判据对 package.json **实读**，不是对页面自陈——构建没把 __APP_VERSION__ 打进去时会红。
    const sdkVer = await h.softText("#sdk-ver");
    check("⑦ 演示台标题旁的版本号 = package.json 的版本", sdkVer.includes(PKG_VERSION), `屏上=${sdkVer} · 包=${PKG_VERSION}`);
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
