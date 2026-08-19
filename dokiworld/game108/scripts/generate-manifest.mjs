// dokiworld/game108 · manifest 生成器（规范 §5：读 package.json → 校验 → 回写源 manifest；
// build 再把同一份复制进 dist——**不手编 dist**）。
// 校验清单照规范 §5 逐条：id 规则/目录一致、semver 与版本同步、entry/cover 在包内、
// 双语字段齐、runtime contract 齐、Game 双语 promptHint、extensions 与代码一致（tests 里核）。
import { readFile, writeFile, access } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
// SDK 3.0 起 **机读** 的已知扩展注册表——以前手册抄一份字面量，抄的那份会过期（SDK 2.x→3.0
// 就新增了 footprint/memory/progress/resume 等）。对它核，不对我们自己的记忆核。
import { RUNTIME_EXTENSIONS } from "@dokiworld/app-sdk/runtime-extensions";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "manifest.json");
const packagePath = resolve(root, "package.json");
const APP_ID = "game108";
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const semverPattern = /^\d+\.\d+\.\d+$/;
const LOCALES = ["en", "zh-cn"];

function fail(message) {
  throw new Error(`manifest: ${message}`);
}

/** 纯校验（生成与测试共用·不写盘）。 */
/**
 * 纯校验（生成与测试共用·不写盘）。
 * @param opts.extensions 由调用方从 main.ts 现推的 `EXTENSIONS`（§7 第 2 步的唯一真相）。
 *        **生成器一定会传**（它是真闸）；点名测试造坏输入时可以不传，那一条跳过——
 *        `runtime.extensions` 与接线的一致性另有一条专测（tests/manifest.test.mjs 现推同一张表）。
 */
export function validateManifest(manifest, packageJson, opts = {}) {
  if (manifest.schemaVersion !== 2) fail("Game manifest 必须 schemaVersion 2");
  if (manifest.id !== APP_ID || !idPattern.test(manifest.id)) fail(`id 必须是 ${APP_ID}（小写/数字/连字符）`);
  if (basename(root) !== APP_ID) fail(`目录名 ${basename(root)} 必须与 id ${APP_ID} 一致`);
  if (manifest.kind !== "game") fail("kind 必须是 game");
  if (!["active", "deprecated", "disabled"].includes(manifest.status)) fail(`status 非法：${manifest.status}`);
  if (typeof manifest.capability !== "string" || manifest.capability.length === 0) fail("capability 必填");
  if (!semverPattern.test(packageJson.version)) fail("package.json version 必须是 semver");
  if (manifest.entry !== "index.html") fail("entry 必须是 index.html");
  // 规范 §3/§5：cover 必填且必须是包内相对路径（真图存在性在 generateManifest 里查盘）。
  if (typeof manifest.cover !== "string" || manifest.cover.length === 0) fail("cover 必填（规范 §3）");
  if (manifest.cover.startsWith("/") || manifest.cover.includes("..")) fail("cover 必须是包内相对路径（不得逃出 App 包）");
  if (!Number.isInteger(manifest.launchRequirements?.minPlayers) || manifest.launchRequirements.minPlayers < 1) {
    fail("launchRequirements.minPlayers 必须是 >=1 的整数");
  }
  for (const locale of LOCALES) {
    const entry = manifest.locales?.[locale];
    if (!entry?.name || !entry?.description) fail(`locales.${locale} 的 name/description 必填`);
    if (!Array.isArray(entry.aliases) || entry.aliases.length === 0) fail(`locales.${locale}.aliases 必须非空`);
  }
  const sel = manifest.selection;
  if (!["explicit", "explicit-or-contextual"].includes(sel?.activationPolicy)) fail("selection.activationPolicy 非法");
  for (const locale of LOCALES) {
    if (!sel?.promptHint?.[locale]) fail(`selection.promptHint.${locale} 必填（规范 §3 硬性）`);
    if (!sel?.avoidHint?.[locale]) fail(`selection.avoidHint.${locale} 必填（防误拉起·本包口径）`);
  }
  const rt = manifest.runtime;
  if (rt?.protocol !== "dokiworld.app" || rt?.protocolVersion !== 2) fail("runtime 必须是 dokiworld.app/2");
  if (rt?.input?.contract !== "doki.game.game108-input" || !Number.isInteger(rt?.input?.version)) fail("runtime.input contract/version 必填");
  const outputs = rt?.outputs;
  if (!Array.isArray(outputs) || !outputs.some((o) => o?.contract === "doki.game.result" && o?.version === 1)) {
    fail("runtime.outputs 必须声明 doki.game.result/1");
  }
  if (!Array.isArray(rt?.extensions)) fail("runtime.extensions 必须是数组（只声明真用到的）");
  // ── 闸①：名字必须是 SDK **认得**的扩展 ──────────────────────────────────────
  // SDK 3.0 起把已知扩展注册表导出成 `@dokiworld/app-sdk/runtime-extensions`（16 个名字）。
  // 样例仓 README：「Catalog 只拒绝**未知**扩展」——即拼错一个名字的表症**不是启动时超时，
  // 而是整个 App 进不了 catalog**。这条以前是靠人眼比对手册文字，现在对机读常量核。
  for (const name of rt.extensions) {
    if (!RUNTIME_EXTENSIONS.includes(name)) {
      fail(`runtime.extensions 里的 "${name}" 不在 SDK 已知扩展注册表内（catalog 会拒收整个 App）·合法值：${RUNTIME_EXTENSIONS.join(", ")}`);
    }
  }
  // ── 闸②：与 main.ts 的 EXTENSIONS 逐字一致（规范 §7 第 1↔2 步）────────────────
  // **名单从 main.ts 现推**（那张 `EXTENSIONS` 常量是 §7 第 2 步的唯一真相）——
  // 在这里再抄一份字面量，就是"改了接线忘了改生成器"的第二处真相（2026-08-17 加到八个时实测踩到）。
  //
  // ⚠ 这两道闸都**管不到**「宿主到底给不给」：能不能拿到某扩展由 Host capability profile 决定
  //（Chat Game Host / World Page Host / World Nested App Host 各给一套·表见 main.ts 文件头），
  //   声明合法 ≠ 拿得到。那一层没有静态判据，只有目击（host-witness 按 profile 挂扩展）。
  const wired = Array.isArray(opts.extensions) ? [...opts.extensions].sort() : null;
  if (wired && JSON.stringify([...rt.extensions].sort()) !== JSON.stringify(wired)) {
    fail(`runtime.extensions 必须与 main.ts 的 EXTENSIONS 一致（应为 ${JSON.stringify(wired)}），实为 ${JSON.stringify(rt.extensions)}`);
  }
}

export async function generateManifest(output = manifestPath) {
  const [manifest, packageJson, mainSrc] = await Promise.all([
    readFile(manifestPath, "utf8").then(JSON.parse),
    readFile(packagePath, "utf8").then(JSON.parse),
    readFile(resolve(root, "src", "main.ts"), "utf8"),
  ]);
  // §7 第 2 步的唯一真相在 main.ts 那张 `EXTENSIONS` 常量里——**现推，不在这里抄第二份**
  //（抄了就是"改了接线忘了改生成器"的第二处真相·2026-08-17 加到八个模块时实测踩到）。
  const extensions = [...(/const EXTENSIONS = \[([^\]]*)\] as const;/.exec(mainSrc)?.[1] ?? "")
    .split(",").map((x) => x.trim().replace(/^'|'$/g, "")).filter(Boolean)];
  if (extensions.length === 0) fail("main.ts 里找不到 `const EXTENSIONS = [...] as const`（§7 第 2 步的唯一真相）");
  validateManifest(manifest, packageJson, { extensions });
  // entry/cover 必须真的在包内（规范 §5：entry、cover 和所有运行资源位于 App 包内）。
  await access(resolve(root, "src", "index.html")).catch(() => fail("src/index.html 不存在（entry 无源）"));
  await access(resolve(root, "src", manifest.cover)).catch(() =>
    fail(`src/${manifest.cover} 不存在（cover 无真图——灰块占位是美术线红线，用 scripts/capture-cover.mjs 截真对局屏生成）`));
  manifest.version = packageJson.version;   // package.json 是版本唯一事实来源
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return output;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const written = await generateManifest();
  console.log(`Generated ${written}`);
}
