// scripts/game-k-art-requirements.mjs —— game-k《Zombie Slots》美术需求推导（美术替换管线）。
// game-k 现状=全程序化 canvas 符号（art.ts·迪士尼+次表面散射）。符号=视觉实体，各带皮肤槽 k/sym-<key>。
// 本脚本用「符号目录」合成 manifest 喂 deriveRequirements → 产 schema 一致的需求台账（编号 art-NN），
// 再按 skinKey 回填迪士尼亲和 × 次表面散射风格的完整英文提示词 → 落 public/games/game-k/art/art-ledger.json
// （美术平台 GET /api/art/ledger?slug=game-k 读此·一键全量生成真图后按 skinKey 登记 index.json 即换装）。
//
// 用法：npx vite-node scripts/game-k-art-requirements.mjs
import { SYMBOLS } from '../src/games/game-k/theme.ts';
import { deriveRequirements, mergeLedger } from './art-replace.mjs';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// 统一风格锚（注入每条 prompt 前）：迪士尼亲和 + 次表面散射柔光。
const STYLE =
  '2D game slot symbol icon, Disney-style character appeal, big expressive eyes, rounded friendly silhouette, ' +
  'subsurface scattering glow, soft translucent glowing undead flesh, warm inner light bleeding through, cool rim light, ' +
  'gooey highlights, centered, transparent background, high contrast, clean render,';
const NEG = 'text, watermark, signature, realistic gore, photorealistic, muted colors, cluttered, drop shadow, background scenery, extra limbs';
// 调色板：毒绿 #5ef08a · 腐紫 #b45ef0 · 骨白 #eafff0 · 琥珀 #ffd166 · 血 #ff6b6b · 生化 #b6f03a。

// 每符号提示词主体（按 skinKey）。
const PROMPT = {
  'k/sym-wild': 'a charming undead zombie king head, decayed toxic-green #5ef08a flesh with bright glowing green eyes, exposed pink brain on top, tiny bone crown, stitched jaw, cute but spooky, banner reading WILD',
  'k/sym-scat': 'a glowing biohazard toxin vial disc, radioactive green #b6f03a trefoil hazard symbol, translucent glass with inner glow, banner reading FREE SPINS, scatter symbol',
  'k/sym-dog': 'an adorable undead zombie puppy head, toxic-green #5ef08a flesh, stitched patch, lolling pink tongue, one little fang, big mismatched puppy-dog eyes, floppy ears',
  'k/sym-girl': 'an adorable undead bride girl, pale translucent purple #b45ef0 skin with subsurface glow, huge sparkling Disney eyes, flower crown, stitched sweet smile, rosy cheeks, veil',
  'k/sym-doc': 'a quirky zombie mad scientist, sallow amber-green #ffd166 face, wild frizzy white hair, cracked glowing goggles, manic toothy grin',
  'k/sym-a': "a carved glowing tombstone tile engraved with the letter 'A', necrotic red #ff6b6b inner glow, cracked mossy gravestone",
  'k/sym-k': "a carved glowing tombstone tile engraved with the letter 'K', necrotic amber #ffd166 inner glow, cracked mossy gravestone",
  'k/sym-q': "a carved glowing tombstone tile engraved with the letter 'Q', necrotic purple #b45ef0 inner glow, cracked mossy gravestone",
  'k/sym-j': "a carved glowing tombstone tile engraved with the letter 'J', necrotic blue #6aa8ff inner glow, cracked mossy gravestone",
  'k/sym-t': "a carved glowing tombstone tile engraved with '10', necrotic teal #5ef0d0 inner glow, cracked mossy gravestone",
};

// hue → 近似 tint（仅供占位描述文本·非关键）。
const hslHex = (h, s = 0.7, l = 0.58) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(c * 255); };
  return (f(0) << 16) | (f(8) << 8) | f(4);
};

// 「符号目录」合成 manifest：每符号一实体（Sprite 皮肤槽 + Shape 占位 + Color）。deriveRequirements 据此产台账。
const entities = {};
const ENT_NAME = {
  T: 'ten', J: 'jack', Q: 'queen', K: 'king', A: 'ace',
  DOG: 'zombie-hound', GIRL: 'undead-bride', DOC: 'mad-scientist', WILD: 'zombie-king-wild', SCAT: 'biohazard-scatter',
};
for (const s of SYMBOLS) {
  entities[ENT_NAME[s.key]] = {
    Sprite: { textureKey: s.skin, anchorX: 0.5, anchorY: 0.5, zOrder: 0 },
    Shape: { kind: 'box', width: 120, height: 120 },
    Color: { tint: hslHex(s.hue), alpha: 1 },
  };
}

const PREV_FILE = join(ROOT, 'public', 'games', 'game-k', 'art', 'art-ledger.json');
const prev = existsSync(PREV_FILE) ? JSON.parse(readFileSync(PREV_FILE, 'utf8')) : null;
const ledger = mergeLedger(prev, deriveRequirements({ entities }, { game: 'game-k' }));

// 按 skinKey 回填提示词 + 统一负向（同 game-q「手拼提示词回填台账行 prompt」）。
for (const row of ledger.rows) {
  const body = PROMPT[row.skinKey];
  if (body) { row.prompt = `${STYLE} ${body}`; row.negative = NEG; }
}

mkdirSync(dirname(PREV_FILE), { recursive: true });
writeFileSync(PREV_FILE, JSON.stringify(ledger, null, 2) + '\n');

const esc = (s) => String(s).replace(/\|/g, '\\|');
const lines = [];
lines.push(`# game-k《Zombie Slots》资产需求表（${ledger.rows.length} 项·管线自动推导）\n`);
lines.push('> 来源：美术替换管线 deriveRequirements 扫「符号目录」合成 manifest（symbols=视觉实体·各带皮肤槽 k/sym-<key>）。');
lines.push('> game-k 现状=全程序化 canvas 符号（迪士尼+次表面散射）→ 本表即「该配哪些真美术替换程序化占位」的完整清单。\n');
lines.push('| 编号 | 皮肤槽 | 当前占位 | 美术需求描述 | 规格 |');
lines.push('|---|---|---|---|---|');
for (const r of ledger.rows) lines.push(`| ${r.no} | ${esc(r.skinKey || '-')} | ${esc(r.placeholder.current)} | ${esc(r.context)} | ${r.spec.w}×${r.spec.h}·透明底 |`);
lines.push(`\n共 ${ledger.rows.length} 项。台账 JSON（平台读此路径）：public/games/game-k/art/art-ledger.json`);
console.log(lines.join('\n'));
