// dokiworld/game108 · 构建（规范 §9 顺序：manifest 生成校验 → 清 dist → 引擎+游戏+SDK
// 打成自包含浏览器 bundle → 复制 manifest → 校验 entry 存在）。
// 打包器 = 仓根的 vite + engine-aliases（借 vite.config.cartridge.ts 先例的别名单一真相，
// `@zerocraft/engine/*` → 仓内 src/*；SDK 从本 App 的 node_modules 解析并打进 bundle）。
import { access, copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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
  resolve: { alias: engineAliases(repoRoot) },
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

// 规范 §9 收尾校验：dist/manifest.json.entry 必须真实存在。
const { entry } = JSON.parse(await readFile(resolve(dist, "manifest.json"), "utf8"));
await access(resolve(dist, entry));
console.log(`Built game108 DokiWorld app to ${dist}`);
