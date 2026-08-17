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

test("manifest：extensions 声明与接线代码一致（规范 §7 五步·**判据从 main.ts 现推**）", async () => {
  const manifest = await load("manifest.json");
  const main = await readFile(resolve(root, "src", "main.ts"), "utf8");

  // ⚠ **不在这里抄一份名单**（旧版抄了 `['apps','character','storage']` 三个字面量，
  // 2026-08-17 加到八个时它红了——红得对，但它拦的是"名单变了"，不是"两处不一致"）。
  // 判据改成现推：main.ts 里那张 `EXTENSIONS` 常量是第 2 步的唯一真相，manifest 必须与它逐字相等。
  const decl = /const EXTENSIONS = \[([^\]]*)\] as const;/.exec(main);
  assert.ok(decl, "main.ts 须有 `const EXTENSIONS = [...] as const`（§7 第 2 步的唯一真相）");
  const wired = decl[1].split(",").map((x) => x.trim().replace(/^'|'$/g, "")).filter(Boolean);
  assert.deepEqual([...manifest.runtime.extensions].sort(), [...wired].sort(),
    "manifest.runtime.extensions 必须与 main.ts 的 EXTENSIONS 逐字一致（多声明会被宿主拒·少声明消息被拒）");

  // 锚点②：**声明几个就真建几条通道**（§7 第 3 步）。逐个点名——漏建一条的表症是
  // "宿主答了但我方没人听"，零报错。
  const BUILDERS = {
    storage: /createStorageClientExtension\(app/, character: /createCharacterClientExtension\(app/,
    apps: /createAppsGateway\(app,/, speech: /createSpeechGateway\(app,/, persona: /createPersonaGateway\(app,/,
    dialogue: /createDialogueGateway\(app,/, media: /createMediaGateway\(app,/, episode: /createEpisodeBridge\(app,/,
  };
  for (const name of wired) {
    assert.ok(BUILDERS[name], `声明了 ${name} 但本测试不认识它——加通道时同步加锚点，别让新模块裸奔`);
    assert.ok(BUILDERS[name].test(main), `声明了 ${name} 就必须真建那条通道（§7 第 3 步）`);
  }
  // 锚点③：**没声明的一个都不许建**（多声明/多建都会被宿主拒）。
  for (const [name, re] of Object.entries(BUILDERS)) {
    if (!wired.includes(name)) assert.ok(!re.test(main), `未声明的 ${name} 不得建通道`);
  }
  // 锚点④：`declared` 一律从 EXTENSIONS 现推，**不许写死 true**
  //（写死 = 给自己留一个"改了名单忘了改这里"的口子，那种错的表症是静默等到超时）。
  assert.ok(/const declared = \(name: string\): boolean => \(EXTENSIONS as readonly string\[\]\)\.includes\(name\);/.test(main),
    "declared() 必须从 EXTENSIONS 现推");
  // ⚠ 判据只看**代码**：把注释剥掉再匹配。第一版直接搜 `declared: true` 把上面那句
  // "写死 declared:true 就是给自己留口子"的**注释**也算成了违规——尺子量到自己身上了。
  const code = main.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/declared:\s*true/.test(code), "网关的 declared 不许写死 true——必须 declared('<name>')");
  // 锚点⑤：§7 第 5 步——退出决定里**逐个释放**（少一个 = 泄一条订阅·跨实例串台）
  for (const name of wired) {
    const v = name === "episode" ? "episode" : name;
    assert.ok(new RegExp(`${v}\\.dispose\\(\\)`).test(main), `onExitDecision 须释放 ${name}（§7 第 5 步）`);
  }
});

test("manifest：result.metrics 与 toGameResult 真发出去的那些**逐字一致**", async () => {
  // 为什么要有这一条：`result.metrics` 是给 **Episode 编辑器**列 `{{app.metrics.*}}` 变量用的
  //（README §5）。声明多了 → 编辑器列出我们从不发的变量，剧情按它分支永远不命中；
  // 声明少了 → 我们发了但剧情选不到。**两处真相**的老形状。
  // 判据**从 `toGameResult` 现推**，不在这里抄第二份名单。
  const manifest = await load("manifest.json");
  const { toGameResult } = await import("../src/to-game-result.mjs");
  const world = {
    getComponent: (id, type) => ({
      "flow:GameFlow": { current: "p1win" },
      "p1:Resource": { id: "hp", current: 40, min: 0, max: 100 },
      "p2:Resource": { id: "hp", current: 0, min: 0, max: 100 },
      "round:Resource": { id: "round", current: 3 },
      "style:p1:Resource": { id: "p1.style", current: 9, min: 0, max: 20 },
      "read:p2:Resource": { id: "p2.read", current: 5, min: 0, max: 10 },
    })[`${id}:${type}`],
  };
  const sent = Object.keys(toGameResult(world).metrics).sort();
  assert.deepEqual([...(manifest.result?.metrics ?? [])].sort(), sent,
    `manifest.result.metrics 必须与 toGameResult 真发的字段一致（实发 ${JSON.stringify(sent)}）`);
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
  // 校验器的这一条要**调用方把真名单递进来**（§7 第 2 步的真相在 main.ts，不在校验器里）。
  // 这里把 manifest 现有的那份当"真名单"，再造两种漂移。
  const truth = { extensions: [...manifest.runtime.extensions] };
  const drifted = structuredClone(manifest);
  drifted.runtime.extensions = [...truth.extensions, "progress"];      // 多声明（match3 踩过的坑）
  assert.throws(() => validateManifest(drifted, pkg, truth), /extensions/);
  drifted.runtime.extensions = ["storage"];                            // 少声明
  assert.throws(() => validateManifest(drifted, pkg, truth), /extensions/);
  // ⚠ 防空转：名单**对得上**时必须放行（否则上面两条可能只是因为"永远抛"而绿）
  drifted.runtime.extensions = [...truth.extensions].reverse();        // 顺序不同也算一致
  validateManifest(drifted, pkg, truth);
});

test("manifest：坏输入被校验器拒绝（id 错 / 缺 promptHint 各红一次）", async () => {
  const manifest = await load("manifest.json");
  const pkg = await load("package.json");
  assert.throws(() => validateManifest({ ...manifest, id: "Game_108" }, pkg), /id/);
  const noHint = structuredClone(manifest);
  delete noHint.selection.promptHint["zh-cn"];
  assert.throws(() => validateManifest(noHint, pkg), /promptHint/);
});
