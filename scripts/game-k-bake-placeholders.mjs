// scripts/game-k-bake-placeholders.mjs —— 把 game-k 程序化符号美术烘焙成 PNG「占位真图」。
//
// 为何：美术平台缩略图只认真图（ledger.gen.servedPath）；纯程序化占位没有图片文件 → 平台只能显示纯色块 swatch，
// 看不到「替换前现在长啥样」。工作流铁律「placeholder=库内真图」——占位也该是图片。本脚本用 headless 浏览器
// 渲染 art.ts 的 drawSymbol → 每符号一张 256² PNG，落 public/games/game-k/art/placeholder/，登记进 index.json（游戏
// 照常加载·观感不变）+ 回填台账 status=placeholder + gen.servedPath（平台即显示真实图标·仍标「占位」待替换）。
//
// 前置：vite dev 在跑（python3 apollo.py launcher 或 npx vite）。用法：node scripts/game-k-bake-placeholders.mjs [port]
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.argv[2] || '5173';
const ART_DIR = join(ROOT, 'public', 'games', 'game-k', 'art');
const PH_DIR = join(ART_DIR, 'placeholder');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: existsSync(EXE) ? EXE : undefined });
const page = await browser.newPage();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
// 浏览器内 import art.ts + theme.ts（vite dev 直供 TS 模块）→ 逐符号 drawSymbol 到 256² canvas → dataURL。
const baked = await page.evaluate(async () => {
  const art = await import('/src/games/game-k/art.ts');
  const theme = await import('/src/games/game-k/theme.ts');
  const out = {};
  for (const s of theme.SYMBOLS) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');
    art.drawSymbol(ctx, s.id, 0, 0, 256);
    out[s.skin] = { key: s.key.toLowerCase(), name: s.name, dataUrl: cv.toDataURL('image/png') };
  }
  return out;
});
await browser.close();

mkdirSync(PH_DIR, { recursive: true });
const assets = [];
const ledgerFile = join(ART_DIR, 'art-ledger.json');
const ledger = existsSync(ledgerFile) ? JSON.parse(readFileSync(ledgerFile, 'utf8')) : null;
for (const [skin, { key, name, dataUrl }] of Object.entries(baked)) {
  const rel = `placeholder/sym-${key}.png`;
  writeFileSync(join(ART_DIR, rel), Buffer.from(dataUrl.split(',')[1], 'base64'));
  const servedPath = `/games/game-k/art/${rel}`;
  assets.push({
    id: skin, type: 'texture', description: `${name} · 程序化占位（迪士尼×次表面·可换真图）`,
    status: 'placeholder', path: servedPath, category: 'placeholder',
    tags: ['placeholder', 'procedural', 'skin'], source: 'procedural',
    provenance: { generator: 'procedural-bake', prompt: null, model: 'game-k/art.ts', mock: false },
  });
  // 回填台账：该符号行 → status=placeholder + gen.servedPath（平台 thumbUrl 即显示真实图标）。
  if (ledger) { const row = ledger.rows.find((r) => r.skinKey === skin); if (row) { row.status = 'placeholder'; row.placeholder = { ...(row.placeholder || {}), source: 'procedural-bake', current: `程序化占位真图（${name}）` }; row.gen = { provider: 'procedural', model: 'game-k/art.ts', prompt: row.prompt || null, servedPath, localId: skin }; } }
}
// index.json（游戏 loader + hasLocalArt 读此）。合并既有非本次 skin 的条目。
const idxFile = join(ART_DIR, 'index.json');
const prevIdx = existsSync(idxFile) ? JSON.parse(readFileSync(idxFile, 'utf8')) : { version: 1, assets: [] };
const keep = (prevIdx.assets || []).filter((a) => !assets.some((n) => n.id === a.id));
writeFileSync(idxFile, JSON.stringify({ version: 1, assets: [...keep, ...assets].sort((a, b) => a.id.localeCompare(b.id)) }, null, 2) + '\n');
if (ledger) writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n');
console.log(`baked ${assets.length} symbol placeholders → ${PH_DIR}; index.json + ledger updated`);
