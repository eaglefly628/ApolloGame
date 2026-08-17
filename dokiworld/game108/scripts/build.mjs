// dokiworld/game108 · 构建（规范 §9 顺序：manifest 生成校验 → 清 dist → 引擎+游戏+SDK
// 打成自包含浏览器 bundle → 复制 manifest → 校验 entry 存在）。
// 打包器 = 仓根的 vite + engine-aliases（借 vite.config.cartridge.ts 先例的别名单一真相，
// `@zerocraft/engine/*` → 仓内 src/*；SDK 从本 App 的 node_modules 解析并打进 bundle）。
import { access, copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { engineAliases } from "../../../scripts/engine-aliases.mjs";
import { generateManifest } from "./generate-manifest.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(appRoot, "..", "..");
const dist = resolve(appRoot, "dist");

await generateManifest();
await rm(dist, { recursive: true, force: true });

await build({
  configFile: false,
  root: resolve(appRoot, "src"),
  base: "./",                       // 规范 §9：资源相对路径，包自包含
  logLevel: "warn",
  resolve: {
    alias: [
      // 引擎子路径（仓内 src·单一真相 engine-aliases.mjs）
      ...Object.entries(engineAliases(repoRoot)).map(([find, replacement]) => ({ find, replacement })),
      // ── 共享层（`dokiworld/shared/**`）的 SDK 解析 ─────────────────────────────
      // 它 `import ... from "@dokiworld/app-sdk/apps"`，而 node 从**引用文件所在目录**往上找
      // node_modules：`dokiworld/shared/` 下没有（也不该有——那会把第二份 SDK 打进同一个 bundle，
      // 两个实例各带一套协议常量）。故在打包层把 SDK 指到**本 App 自己那份**：
      // 「App owns the SDK」与手册「SDK 打进 bundle·版本四维不联动」同口径，假宿主 harness
      // serve 的 /sdk/* 也是这一份，两边永远同一个实例。
      { find: /^@dokiworld\/app-sdk$/, replacement: resolve(appRoot, "node_modules/@dokiworld/app-sdk/src/index.js") },
      { find: /^@dokiworld\/app-sdk\/(.+)$/, replacement: resolve(appRoot, "node_modules/@dokiworld/app-sdk/src") + "/$1.js" },
    ],
  },
  esbuild: { jsx: "automatic" },    // 引擎 UI 的 .tsx 走 React 17+ 自动运行时（同仓根 tsconfig "react-jsx"）
  build: {
    outDir: dist,
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,               // 红线：dist 不装源码引用/绝对本机路径
  },
});

await copyFile(resolve(appRoot, "manifest.json"), resolve(dist, "manifest.json"));

// ── 运行期公有资产进包 + 绝对路径 → 相对（规范 §9：包自包含·资源相对路径·字体不漏）─────
// 引擎两条运行期取数约定是**站点绝对路径**（`/games/<slug>/art/…`、`/ui-fonts/…`），
// 在「App 挂在任意子路径」的 iframe 部署下会打到宿主根、逃出包外。此处在**打包层**收编：
// ① 把真被消费的公有资产复制进 dist（美术索引 + 三枚手势图·CJK 字体含 OFL 许可证）；
// ② 把 bundle 与索引里的绝对前缀改写为相对（相对文档基准 = 包根·任意挂载点都成立）。
// 引擎源码一行不动（更深的「资产 URL 基准可配置」属引擎缺口，另走 requests.md 裁决）。
const artSrc = resolve(repoRoot, "public", "games", "game108", "art");
const artDst = resolve(dist, "games", "game108", "art");
await mkdir(artDst, { recursive: true });
for (const f of ["icon_rock.png", "icon_paper.png", "icon_scissors.png"]) {
  await copyFile(resolve(artSrc, f), resolve(artDst, f));
}
// 台账/preview 是创作台侧文件，不进对外包；索引只带运行期消费的条目原文，路径改相对。
const artIndex = (await readFile(resolve(artSrc, "index.json"), "utf8"))
  .replaceAll('"/games/game108/art/', '"games/game108/art/');
await writeFile(resolve(artDst, "index.json"), artIndex);
await cp(resolve(repoRoot, "public", "ui-fonts", "cjk"), resolve(dist, "ui-fonts", "cjk"), { recursive: true });

/** 锚点改写（每条必须真命中，否则硬抛——防「没改到文件」的假绿）。 */
const rewrites = [
  ["url(/ui-fonts/", "url(ui-fonts/"],              // 惰性 CJK 字体 @font-face
  ['"/games/game108/art/', '"games/game108/art/'],  // 手势图 filledSrc 字面量
  ["`/games/${", "`games/${"],                      // gameArtIndexUrl 模板字面量
];
for (const file of await readdir(resolve(dist, "assets"))) {
  if (!file.endsWith(".js")) continue;
  const path = resolve(dist, "assets", file);
  let code = await readFile(path, "utf8");
  for (const [from, to] of rewrites) {
    if (!code.includes(from)) throw new Error(`打包改写锚点未命中：${from}（引擎侧路径约定变了？先核对再放行）`);
    code = code.replaceAll(from, to);
  }
  if (/url\(\/|["`]\/games\//.test(code)) throw new Error("bundle 仍残留站点绝对资源路径（包不自包含）");
  await writeFile(path, code);
}

// ── cover 进包（规范 §3/§5：cover 是运行资源，必须位于 App 包内）─────────────────
// cover 是**未被代码引用的静态资源**——vite 只带被 import/引用的资产，不显式复制它就会
// 「manifest 指着 assets/cover.webp、包里却没有」（§5 校验点名的那类洞）。
const { cover } = JSON.parse(await readFile(resolve(appRoot, "manifest.json"), "utf8"));
await mkdir(dirname(resolve(dist, cover)), { recursive: true });
await copyFile(resolve(appRoot, "src", cover), resolve(dist, cover));

// 规范 §9 收尾校验：dist/manifest.json 的 entry 与 cover 必须真实存在。
const distManifest = JSON.parse(await readFile(resolve(dist, "manifest.json"), "utf8"));
await access(resolve(dist, distManifest.entry));
await access(resolve(dist, distManifest.cover));

// ── SHA256SUMS.txt（match3 同款完整性清单·大写十六进制 + 两空格 + 包内相对路径）────
// 收尾最后一步生成：覆盖 dist 里**除它自己外的全部文件**，消费方逐行核对即可发现缺件/被改。
const listFiles = async (dir) => {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) out.push(...await listFiles(p));
    else out.push(p);
  }
  return out;
};
const sums = [];
for (const file of (await listFiles(dist)).sort()) {
  const rel = relative(dist, file).replaceAll("\\", "/");
  if (rel === "SHA256SUMS.txt") continue;
  const digest = createHash("sha256").update(await readFile(file)).digest("hex").toUpperCase();
  sums.push(`${digest}  ${rel}`);
}
await writeFile(resolve(dist, "SHA256SUMS.txt"), `${sums.join("\n")}\n`, "utf8");
console.log(`Built game108 DokiWorld app to ${dist}`);
