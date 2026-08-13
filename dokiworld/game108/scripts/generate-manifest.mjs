// dokiworld/game108 · manifest 生成器（规范 §5：读 package.json → 校验 → 回写源 manifest；
// build 再把同一份复制进 dist——**不手编 dist**）。
// 校验清单照规范 §5 逐条：id 规则/目录一致、semver 与版本同步、entry 在包内、
// 双语字段齐、runtime contract 齐、Game 双语 promptHint、extensions 与代码一致（tests 里核）。
import { readFile, writeFile, access } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
export function validateManifest(manifest, packageJson) {
  if (manifest.schemaVersion !== 2) fail("Game manifest 必须 schemaVersion 2");
  if (manifest.id !== APP_ID || !idPattern.test(manifest.id)) fail(`id 必须是 ${APP_ID}（小写/数字/连字符）`);
  if (basename(root) !== APP_ID) fail(`目录名 ${basename(root)} 必须与 id ${APP_ID} 一致`);
  if (manifest.kind !== "game") fail("kind 必须是 game");
  if (!["active", "deprecated", "disabled"].includes(manifest.status)) fail(`status 非法：${manifest.status}`);
  if (typeof manifest.capability !== "string" || manifest.capability.length === 0) fail("capability 必填");
  if (!semverPattern.test(packageJson.version)) fail("package.json version 必须是 semver");
  if (manifest.entry !== "index.html") fail("entry 必须是 index.html");
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
}

export async function generateManifest(output = manifestPath) {
  const [manifest, packageJson] = await Promise.all([
    readFile(manifestPath, "utf8").then(JSON.parse),
    readFile(packagePath, "utf8").then(JSON.parse),
  ]);
  validateManifest(manifest, packageJson);
  // entry 必须真的在包内（规范 §5：entry/资源位于 App 包内）。
  await access(resolve(root, "src", "index.html")).catch(() => fail("src/index.html 不存在（entry 无源）"));
  manifest.version = packageJson.version;   // package.json 是版本唯一事实来源
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return output;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const written = await generateManifest();
  console.log(`Generated ${written}`);
}
