// dokiworld/game108 · 假宿主 harness 公共件（host-witness.mjs / capture-cover.mjs 共用）。
//
// 做的事：起一个同源静态服务（/harness.html 假宿主页 + /sdk/* = 包内 @dokiworld/app-sdk 源 +
// /app/* = 构建好的 dist），假宿主页里用 **SDK 自己的 createAppHost** 与 iframe 里的真 App
// 完整握手（ready → init → initialized → capability → complete/exit）——与真宿主同一条协议路，
// 不 mock postMessage。宿主形态（授权 scope / 角色资料 / checkpoint / host extension 集）
// 由每个场景传入，这正是规范 §12「scope 缺失场景」三形态测试的腿。
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, normalize } from "node:path";
import { existsSync } from "node:fs";

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".webp": "image/webp",
  ".woff2": "font/woff2", ".woff": "font/woff", ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
};

/** 假宿主页：iframe 装真 App，`window.__setup(config)` 起 createAppHost + 按需挂 host extension。 */
const HARNESS_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>game108 host harness</title>
<style>html,body{margin:0;padding:0;width:100%;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style>
</head><body>
<iframe id="app"></iframe>
<script type="module">
import { createAppHost } from "./sdk/index.js";
import { createStorageHostExtension } from "./sdk/storage.js";
import { createCharacterHostExtension } from "./sdk/character.js";
import { createAppsHostExtension } from "./sdk/apps.js";
import { createSpeechHostExtension } from "./sdk/speech.js";
import { createPersonaHostExtension } from "./sdk/persona.js";
import { createDialogueHostExtension } from "./sdk/dialogue.js";
import { createMediaHostExtension } from "./sdk/media.js";
import { createEpisodeHostExtension } from "./sdk/episode.js";

window.__setup = (config) => new Promise((ready) => {
  const iframe = document.getElementById("app");
  const state = { initialized: false, completed: null, saved: config.checkpoint ?? null, exitState: null, launched: null, listed: 0 };
  window.__state = state;
  iframe.addEventListener("load", () => {
    const host = createAppHost({
      appId: "game108",
      runId: config.runId ?? "run-witness-1",
      target: iframe.contentWindow,
      targetOrigin: location.origin,
      expectedOrigin: location.origin,
      init: {
        locale: config.locale ?? "zh-cn",
        grantedScopes: config.grantedScopes ?? [],
        context: {},
        input: { contract: "doki.game.game108-input", version: 1, data: config.input ?? {} },
      },
      outputs: [{ contract: "doki.game.result", version: 1 }],
      extensions: config.hostExtensions ?? [],
    });
    window.__host = host;
    if ((config.hostExtensions ?? []).includes("storage")) {
      createStorageHostExtension(host, {
        loadCheckpoint: () => ({ checkpoint: state.saved }),
        saveCheckpoint: ({ checkpoint }) => { state.saved = checkpoint; return { saved: true }; },
        clearCheckpoint: () => { state.saved = null; return { cleared: true }; },
      });
    }
    if ((config.hostExtensions ?? []).includes("character")) {
      createCharacterHostExtension(host, {
        getCurrent: () => ({ character: config.character ?? null }),
      });
    }
    // 「获取卡带」腿（REQ-DOKI-APPS）：宿主端把可拉起的 App 列表交出去，并记下真被拉起的那次
    //（launch 的落点记在 state.launched——目击断言读它，不采信页面自陈）。
    if ((config.hostExtensions ?? []).includes("apps")) {
      createAppsHostExtension(host, {
        list: () => { state.listed = (state.listed ?? 0) + 1; return { apps: config.apps ?? [] }; },
        launch: (req) => { state.launched = req; return { status: "cancelled" }; },
      });
    }
    // ── SDK 演示台那五个模块的假宿主（owner 2026-08-17「测试它所有的功能」）──────
    // 每个都**记一笔到 state**：目击断言读 state（真收到请求了没有），不采信页面自陈。
    const ext = config.hostExtensions ?? [];
    if (ext.includes("speech")) {
      createSpeechHostExtension(host, {
        synthesize: (input) => { state.spoke = input; return { audioUrl: "data:audio/wav;base64,UklGRgAAAABXQVZF", cached: true }; },
      });
    }
    if (ext.includes("persona")) {
      createPersonaHostExtension(host, {
        list: () => ({ personas: config.personas ?? [] }),
        getSelected: (input) => { state.personaAsked = input; return { persona: config.persona ?? null }; },
        requestSelection: () => ({ persona: config.persona ?? null }),
      });
    }
    if (ext.includes("dialogue")) {
      createDialogueHostExtension(host, {
        generateOpening: (input) => { state.opening = input; return { openingLine: "就你也配跟我猜拳？", segments: [] }; },
        generateSuggestions: () => ({ suggestions: ["出石头", "诈他一手"] }),
        generateTagline: () => ({ tagline: "三拳定生死" }),
      });
    }
    if (ext.includes("media")) {
      // 两拍出图：第一次 getJob 还在跑、第二次 done —— 让轮询那条路真的被走到。
      let polls = 0;
      createMediaHostExtension(host, {
        generateImage: (input) => { state.imagePrompt = input?.prompt ?? null; return { id: "job-w", mediaType: "image", status: "pending" }; },
        getJob: () => {
          polls += 1;
          return polls < 2
            ? { id: "job-w", mediaType: "image", status: "processing" }
            : { id: "job-w", mediaType: "image", status: "done", urls: ["https://cdn.example/win.png"] };
        },
      });
    }
    if (ext.includes("episode")) {
      const epi = createEpisodeHostExtension(host);
      host.onMessage((m) => { const ev = epi.receive(m); if (ev) (state.episode ??= []).push(ev); });
    }
    host.connect({
      onInitialized: () => { state.initialized = true; },
      onComplete: (output) => { state.completed = output; return { status: "accepted" }; },
    });
    ready(true);
  }, { once: true });
  iframe.src = "./app/index.html";
});
window.__prepareExit = async (reason) => {
  window.__state.exitState = await window.__host.prepareExit(reason ?? "navigation");
  return window.__state.exitState;
};
window.__decideExit = (decision) => { window.__host.decideExit(decision); return true; };
</script>
</body></html>`;

/** 起同源静态服务；返回 { url, close }。 */
export async function startHarnessServer({ appRoot }) {
  const dist = resolve(appRoot, "dist");
  const sdkSrc = resolve(appRoot, "node_modules", "@dokiworld", "app-sdk", "src");
  if (!existsSync(resolve(dist, "index.html"))) throw new Error(`dist 未构建（${dist}）——先 npm run build`);
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    try {
      let file;
      if (path === "/" || path === "/harness.html") {
        res.writeHead(200, { "content-type": MIME[".html"] });
        res.end(HARNESS_HTML);
        return;
      } else if (path.startsWith("/sdk/")) {
        file = resolve(sdkSrc, normalize(path.slice(5)));
        if (!file.startsWith(sdkSrc)) throw new Error("path escape");
      } else if (path.startsWith("/app/")) {
        file = resolve(dist, normalize(path.slice(5)));
        if (!file.startsWith(dist)) throw new Error("path escape");
      } else {
        res.writeHead(404).end();
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

/** 容器已知的固定 Chromium 路径（同 scripts/lib/render-harness.mjs 的探测口径·环境变量同名可覆盖）。 */
export function chromiumPath(env = process.env) {
  const candidate = env.RENDER_PROBE_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  return existsSync(candidate) ? candidate : null;
}

/** 轮询直到条件为真（默认 10s 超时·帧级步进）。 */
export async function until(fn, { timeoutMs = 10_000, stepMs = 100, label = "condition" } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > deadline) throw new Error(`等待超时：${label}`);
    await new Promise((r) => setTimeout(r, stepMs));
  }
}
