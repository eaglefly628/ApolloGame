#!/usr/bin/env node
// scripts/zerocraft.mjs — 外部内容启动器（REQ-PKG-位置无关与正名·Lead 图纸②）
//
// 三命令：
//   node scripts/zerocraft.mjs run   <game-dir>   起 dev server 装载「居仓外」的游戏目录
//   node scripts/zerocraft.mjs test  <game-dir>   跑该目录自己的 vitest
//   node scripts/zerocraft.mjs build <game-dir>   tsc --noEmit + vite build 出产物
//
// 「外部游戏目录」契约（图纸②）：
//   · <game-dir>/package.json 声明 `"@zerocraft/engine": "file:<相对本仓路径>"`（真 npm 依赖——
//     本脚本用 Node 自身的 require.resolve 走该目录的 node_modules 解出引擎真实路径，不是猜的）。
//   · <game-dir>/tsconfig.json extends `@zerocraft/engine/tsconfig.game-base.json`（build 用；
//     run/test 走本脚本注入的 vite/vitest 别名配置，不依赖这份 tsconfig——两条路径独立，
//     同 CLAUDE.md「引擎自己 tsc paths + vite alias 双轨」的既有先例）。
//   · 游戏源码本身（.ts/.tsx）随便放，导出一个 `mount(container, host?)` 入口（本仓 games/**
//     现有约定，见 tools/export-game.mjs 的 findEntry 同款探测）。
//
// 三命令共享的引擎侧重资产（vite/vitest/tsc 本体、react/react-dom/three 等运行时依赖）一律
// 取自 **被依赖引擎 checkout 自己的 node_modules**（不是游戏目录的）——游戏目录只需带最小契约
// 文件，不必自己 `npm install` 一整套构建链（"游戏可居仓外"≠"游戏自己背整条工具链"）。
//
// 实现从仓库自身的 vite.config.ts / vite.config.cartridge.ts 提炼（见 scripts/engine-aliases.mjs
// 单一别名真相表），不另造第二套构建系统。
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, realpathSync, readdirSync } from 'node:fs';
import { join, resolve, dirname, basename, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';

import { engineAliases } from './engine-aliases.mjs';

const [, , cmd, gameDirArg, ...rest] = process.argv;

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!['run', 'test', 'build'].includes(cmd) || !gameDirArg) {
  console.error('用法: node scripts/zerocraft.mjs <run|test|build> <game-dir>');
  process.exit(1);
}

const gameDir = resolve(gameDirArg);
if (!existsSync(gameDir)) fail(`目录不存在: ${gameDir}`);

// ── 校验外部内容契约 + 解出真实引擎根（走 Node 自身的包解析，不是拼字符串猜路径）──────────
const pkgPath = join(gameDir, 'package.json');
if (!existsSync(pkgPath)) {
  fail(`${gameDir} 缺 package.json（外部内容契约：需声明 "@zerocraft/engine": "file:<相对引擎根>" 依赖）`);
}
let pkg;
try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')); }
catch (e) { fail(`${pkgPath} 不是合法 JSON：${e.message}`); }
const declaredDep = pkg.dependencies?.['@zerocraft/engine'] ?? pkg.devDependencies?.['@zerocraft/engine'];
if (!declaredDep) fail(`${pkgPath} 未声明 "@zerocraft/engine" 依赖`);

let engineRoot;
try {
  const req = createRequire(pkgPath + '/'); // 尾随 '/' 让 createRequire 把 gameDir 当解析基点
  const enginePkgJson = req.resolve('@zerocraft/engine/package.json');
  engineRoot = realpathSync(dirname(enginePkgJson));
} catch (e) {
  fail(`解析不到 ${gameDir} 的 "@zerocraft/engine" 依赖（先在该目录 npm install）：${e.message}`);
}
const enginePkg = JSON.parse(readFileSync(join(engineRoot, 'package.json'), 'utf8'));
if (enginePkg.name !== '@zerocraft/engine') fail(`${engineRoot} 不是 @zerocraft/engine（package.json name=${enginePkg.name}）`);

const bin = (name) => join(engineRoot, 'node_modules', '.bin', name);

// ── 别名表：引擎十子路径（图纸①）+ react/react-dom/three/cannon-es 取引擎自己的 node_modules ──
function resolveAliases() {
  const alias = engineAliases(engineRoot);
  for (const pkgName of ['react', 'react-dom', 'react-dom/client', 'three', 'cannon-es']) {
    const p = join(engineRoot, 'node_modules', pkgName);
    if (existsSync(p)) alias[pkgName] = p;
  }
  return alias;
}

// ── 入口探测（同 tools/export-game.mjs 的 findEntry，泛化到未知目录名）───────────────────────
function findEntry(dir) {
  const base = basename(dir);
  const candidates = [
    join(dir, 'index.ts'), join(dir, 'index.tsx'),
    join(dir, `${base}.ts`), join(dir, `${base}.tsx`),
  ];
  for (const c of candidates) {
    if (existsSync(c) && /export\s+(?:function\s+mount|\{[^}]*\bmount\b|const\s+mount)/.test(readFileSync(c, 'utf8'))) return c;
  }
  // 兜底：扫顶层非测试 .ts(x) 文件找 mount 导出
  for (const name of readdirSync(dir)) {
    if (!/\.(ts|tsx)$/.test(name) || /\.(test|spec)\.[tj]sx?$/.test(name)) continue;
    const p = join(dir, name);
    try {
      if (/export\s+(?:function\s+mount|\{[^}]*\bmount\b|const\s+mount)/.test(readFileSync(p, 'utf8'))) return p;
    } catch { /* skip */ }
  }
  return null;
}

function mountTakesHostOf(entryPath) {
  const code = readFileSync(entryPath, 'utf8');
  return /export\s+function\s+mount\s*\(\s*[^,)]+,[^)]/.test(code);
}

// ── run / build 共用的最小 harness（<game-dir>/.zerocraft/ 下·每次调用重生成·可随时删）──────
const HARNESS_DIR = '.zerocraft';
function writeHarness() {
  const entry = findEntry(gameDir);
  if (!entry) fail(`${gameDir} 里没找到导出 mount(container, host?) 的入口文件`);
  const hostArg = mountTakesHostOf(entry) ? ', { exit: () => {} }' : '';
  const harnessDir = join(gameDir, HARNESS_DIR);
  rmSync(harnessDir, { recursive: true, force: true });
  mkdirSync(harnessDir, { recursive: true });
  const entryImport = './' + relative(harnessDir, entry).split('\\').join('/');
  writeFileSync(join(harnessDir, 'index.html'),
    `<!doctype html>\n<html><head><meta charset="utf-8"/><title>${basename(gameDir)} · zerocraft run</title></head>\n` +
    `<body style="margin:0"><div id="root" style="position:fixed;inset:0;background:#000"></div>\n` +
    `<script type="module" src="./main.tsx"></script></body></html>\n`);
  writeFileSync(join(harnessDir, 'main.tsx'),
    `import { createRoot } from 'react-dom/client';\nimport { mount } from '${entryImport}';\n\n` +
    `const el = document.getElementById('root');\nif (!el) throw new Error('#root not found');\n` +
    `const cleanup = mount(el${hostArg});\n` +
    `if (import.meta.hot) import.meta.hot.dispose(() => cleanup?.());\n`);
  return harnessDir;
}

// 都走本脚本自身（活在引擎仓 scripts/ 下）的 ESM 包解析（import.meta.resolve 走「import」
// condition，不像 createRequire().resolve 那样落到 vite 的过时 CJS 兼容层触发弃用告警），
// 跟着引擎自身升级 vite/@vitejs/plugin-react/vitest 版本自动对齐，不用本文件跟着改。
const resolveModuleAbs = (specifier) => fileURLToPath(import.meta.resolve(specifier));
async function loadVite() { return import(resolveModuleAbs('vite')); }
async function loadReactPlugin() { return (await import(resolveModuleAbs('@vitejs/plugin-react'))).default; }
const resolveVitestConfigEntry = () => resolveModuleAbs('vitest/config');

async function cmdRun() {
  const harnessDir = writeHarness();
  const { createServer } = await loadVite();
  const react = await loadReactPlugin();
  const server = await createServer({
    root: harnessDir,
    configFile: false,
    plugins: [react()],
    resolve: { alias: resolveAliases() },
    server: {
      port: Number(process.env.ZEROCRAFT_RUN_PORT) || 5190,
      strictPort: false,
      fs: { allow: [gameDir, engineRoot] },
    },
  });
  await server.listen();
  server.printUrls();
  console.log(`▶ zerocraft run: ${gameDir}`);
  if (process.env.ZEROCRAFT_RUN_CHECK === '1') {
    // 自证模式（供本 CLI 自身冒烟/验收用）：起服务→打一次首页→关服务，退出码即结果。
    const url = server.resolvedUrls?.local?.[0] ?? `http://localhost:${server.config.server.port}/`;
    try {
      const res = await fetch(url);
      const html = await res.text();
      if (!res.ok || !html.includes('<div id="root"')) throw new Error(`unexpected response ${res.status}`);
      console.log(`✓ dev server 自证通过（${url}）`);
    } finally {
      await server.close();
      rmSync(harnessDir, { recursive: true, force: true });
    }
    return;
  }
  const shutdown = async () => {
    await server.close();
    rmSync(harnessDir, { recursive: true, force: true }); // 交互模式退出时把生成的 harness 收干净，游戏目录复位
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function cmdBuild() {
  // ① tsc --noEmit（走外部目录自己的 tsconfig.json，须 extends tsconfig.game-base.json）
  const tsconfigPath = join(gameDir, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
    fail(`${gameDir} 缺 tsconfig.json（外部内容契约：需 extends "@zerocraft/engine/tsconfig.game-base.json"）`);
  }
  const tsc = spawnSync(bin('tsc'), ['--noEmit', '-p', tsconfigPath], { stdio: 'inherit', cwd: gameDir });
  if (tsc.status !== 0) fail(`tsc --noEmit 失败（退出码 ${tsc.status}）`);
  console.log('✓ tsc --noEmit 通过');

  // ② vite build（同 run 的别名/harness，出到 <game-dir>/dist）
  const harnessDir = writeHarness();
  const { build } = await loadVite();
  const react = await loadReactPlugin();
  const outDir = join(gameDir, 'dist');
  rmSync(outDir, { recursive: true, force: true });
  await build({
    root: harnessDir,
    configFile: false,
    plugins: [react()],
    resolve: { alias: resolveAliases() },
    build: { outDir, emptyOutDir: true, rollupOptions: { input: join(harnessDir, 'index.html') } },
  });
  rmSync(harnessDir, { recursive: true, force: true }); // 产物已落 dist/，生成的 harness 用完即收，游戏目录复位
  console.log(`✓ vite build 通过 → ${relative(process.cwd(), outDir)}`);
}

async function cmdTest() {
  const tmp = mkdtempSync(join(tmpdir(), 'zerocraft-test-'));
  const configPath = join(tmp, 'vitest.config.mjs');
  const alias = resolveAliases();
  const configSrc =
    `import { defineConfig } from ${JSON.stringify(resolveVitestConfigEntry())};\n` +
    `import react from ${JSON.stringify(resolveModuleAbs('@vitejs/plugin-react'))};\n` +
    `export default defineConfig({\n` +
    `  plugins: [react()],\n` +
    `  resolve: { alias: ${JSON.stringify(alias)} },\n` +
    `  test: {\n` +
    `    root: ${JSON.stringify(gameDir)},\n` +
    `    include: ['**/*.{test,spec}.{ts,tsx}'],\n` +
    `    exclude: ['**/node_modules/**', '**/dist/**', '**/${HARNESS_DIR}/**'],\n` +
    `  },\n` +
    `});\n`;
  writeFileSync(configPath, configSrc);
  try {
    const r = spawnSync(bin('vitest'), ['run', '--config', configPath, ...rest], { stdio: 'inherit', cwd: gameDir });
    if (r.status !== 0) fail(`vitest 失败（退出码 ${r.status}）`);
    console.log('✓ vitest 通过');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const handlers = { run: cmdRun, test: cmdTest, build: cmdBuild };
handlers[cmd]().catch((e) => { console.error(e); process.exit(1); });
