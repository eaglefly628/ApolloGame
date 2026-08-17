// manifest 生成器点名测试（规范 §5 校验逐条 + 出包手册「打包脚本/manifest 生成器带点名测试」）。
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateManifest, validateManifest } from "../scripts/generate-manifest.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const load = async (rel) => JSON.parse(await readFile(resolve(root, rel), "utf8"));

test("manifest：id 规则 / 目录一致 / kind=game / status 合法", async () => {
  const manifest = await load("manifest.json");
  assert.equal(manifest.id, "game108");
  assert.match(manifest.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(manifest.kind, "game");
  assert.equal(manifest.schemaVersion, 2);
  assert.ok(["active", "deprecated", "disabled"].includes(manifest.status));
});

test("manifest：双语齐备（name/description/aliases/promptHint/avoidHint 中英都有）", async () => {
  const manifest = await load("manifest.json");
  for (const locale of ["en", "zh-cn"]) {
    assert.ok(manifest.locales[locale].name, `locales.${locale}.name`);
    assert.ok(manifest.locales[locale].description, `locales.${locale}.description`);
    assert.ok(manifest.locales[locale].aliases.length > 0, `locales.${locale}.aliases`);
    assert.ok(manifest.selection.promptHint[locale], `promptHint.${locale}`);
    assert.ok(manifest.selection.avoidHint[locale], `avoidHint.${locale}`);
  }
  assert.equal(manifest.locales["zh-cn"].name, "拳律");
  assert.equal(manifest.locales.en.name, "Rule of Three");
});

test("manifest：生成器把 package.json 版本写入（版本唯一事实来源）且为 semver", async () => {
  const out = resolve(root, "tests", ".manifest.generated.json");
  await generateManifest(out);
  try {
    const [generated, pkg] = await Promise.all([load("tests/.manifest.generated.json"), load("package.json")]);
    assert.equal(generated.version, pkg.version);
    assert.match(generated.version, /^\d+\.\d+\.\d+$/);
  } finally {
    await unlink(out).catch(() => {});
  }
});

test("manifest：runtime contract 完整（input game108-input/1 · outputs doki.game.result/1）", async () => {
  const manifest = await load("manifest.json");
  assert.equal(manifest.runtime.protocol, "dokiworld.app");
  assert.equal(manifest.runtime.protocolVersion, 2);
  assert.deepEqual(manifest.runtime.input, { contract: "doki.game.game108-input", version: 1 });
  assert.deepEqual(manifest.runtime.outputs, [{ contract: "doki.game.result", version: 1 }]);
});

test("manifest：entry 有源（src/index.html 存在）", async () => {
  await readFile(resolve(root, "src", "index.html"), "utf8");
});

test("manifest：extensions 声明与接线代码一致（apps+character+storage 三处齐·规范 §7 五步的前两步）", async () => {
  const manifest = await load("manifest.json");
  assert.deepEqual([...manifest.runtime.extensions].sort(), ["apps", "character", "storage"]);
  const main = await readFile(resolve(root, "src", "main.ts"), "utf8");
  // 锚点①：createAppClient 声明同一组名字
  assert.ok(/createAppClient[^;]*extensions:\s*\['apps',\s*'character',\s*'storage'\]/s.test(main),
    "createAppClient 必须声明 extensions: ['apps', 'character', 'storage']（与 manifest 一致）");
  // 锚点②：三个模块各真建了一条通道（§7 第 3 步）。`apps` 走共享层的薄适配（createAppsGateway
  // 内部才 createAppsClientExtension）——**声明了就必须真有消费方**，否则是多声明（会被宿主拒）。
  assert.ok(main.includes("createStorageClientExtension(app"), "须真建 storage Client extension");
  assert.ok(main.includes("createCharacterClientExtension(app"), "须真建 character Client extension");
  assert.ok(/createAppsGateway\(app,/.test(main), "须真建 apps 通道（共享层 createAppsGateway）");
  assert.ok(/declared:\s*true/.test(main), "apps 网关须 declared:true（与 manifest 声明同真同假·纪律①）");
  // 锚点③：没建声明之外的模块（dialogue/media/speech/persona/episode 都判了不适用）
  for (const absent of ["Dialogue", "Media", "Speech", "Persona", "Episode"]) {
    assert.ok(!main.includes(`create${absent}ClientExtension`), `未声明的 ${absent} 模块不得创建 extension`);
  }
  // 锚点④：§7 第 5 步——退出决定里三个全释放（少一个 = 泄一条订阅）
  assert.ok(/storage\.dispose\(\)/.test(main) && /character\.dispose\(\)/.test(main) && /apps\.dispose\(\)/.test(main),
    "onExitDecision 须释放 storage/character/apps 三个 extension（§7 第 5 步）");
});

test("manifest：cover 必填、包内相对路径、真图在源里（§3/§5·禁灰块占位）", async () => {
  const manifest = await load("manifest.json");
  assert.equal(manifest.cover, "assets/cover.webp");
  const cover = await readFile(resolve(root, "src", manifest.cover));
  // 锚点：RIFF....WEBP 魔数——防「改了后缀的灰块 PNG」这类占位混包
  assert.equal(cover.subarray(0, 4).toString("ascii"), "RIFF", "cover 必须是真 WebP（RIFF 头）");
  assert.equal(cover.subarray(8, 12).toString("ascii"), "WEBP", "cover 必须是真 WebP（WEBP 标）");
  assert.ok(cover.length > 4096, `cover 疑似占位图（${cover.length} 字节太小——真对局屏截图不可能这么小）`);
});

test("manifest：缺 cover / cover 逃包被校验器拒绝（§5 点名校验·各红一次）", async () => {
  const manifest = await load("manifest.json");
  const pkg = await load("package.json");
  const noCover = { ...manifest };
  delete noCover.cover;
  assert.throws(() => validateManifest(noCover, pkg), /cover/);
  assert.throws(() => validateManifest({ ...manifest, cover: "/etc/cover.webp" }, pkg), /cover/);
  assert.throws(() => validateManifest({ ...manifest, cover: "../cover.webp" }, pkg), /cover/);
});

test("manifest：extensions 声明漂移被校验器拒绝（声明≠真实创建是规范红线）", async () => {
  const manifest = await load("manifest.json");
  const pkg = await load("package.json");
  const drifted = structuredClone(manifest);
  drifted.runtime.extensions = ["character", "storage", "progress"];   // 多声明（match3 踩过的坑）
  assert.throws(() => validateManifest(drifted, pkg), /extensions/);
  drifted.runtime.extensions = ["storage"];                            // 少声明
  assert.throws(() => validateManifest(drifted, pkg), /extensions/);
});

test("manifest：坏输入被校验器拒绝（id 错 / 缺 promptHint 各红一次）", async () => {
  const manifest = await load("manifest.json");
  const pkg = await load("package.json");
  assert.throws(() => validateManifest({ ...manifest, id: "Game_108" }, pkg), /id/);
  const noHint = structuredClone(manifest);
  delete noHint.selection.promptHint["zh-cn"];
  assert.throws(() => validateManifest(noHint, pkg), /promptHint/);
});
