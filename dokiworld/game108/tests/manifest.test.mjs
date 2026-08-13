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

test("manifest：extensions 声明与接线代码一致（声明 [] ⇔ createAppClient 不传 extensions）", async () => {
  const manifest = await load("manifest.json");
  assert.deepEqual(manifest.runtime.extensions, []);
  const main = await readFile(resolve(root, "src", "main.ts"), "utf8");
  assert.ok(!/createAppClient[^;]*extensions\s*:/s.test(main), "manifest 声明零 extension，接线层不得创建任何 extension");
});

test("manifest：坏输入被校验器拒绝（id 错 / 缺 promptHint 各红一次）", async () => {
  const manifest = await load("manifest.json");
  const pkg = await load("package.json");
  assert.throws(() => validateManifest({ ...manifest, id: "Game_108" }, pkg), /id/);
  const noHint = structuredClone(manifest);
  delete noHint.selection.promptHint["zh-cn"];
  assert.throws(() => validateManifest(noHint, pkg), /promptHint/);
});
