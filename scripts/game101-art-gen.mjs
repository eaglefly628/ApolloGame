// scripts/game101-art-gen.mjs —— game101《海港绯闻》48 个 sprite 皮肤槽的程序化卡通占位美术。
// 风格锚：cozy gossip-harbor candy cartoon —— 温暖、圆润、厚描边、glossy 高光的糖果贴片，
// 每片=链色渐变底（越高级越亮）+ 该物件 emoji 主体。俯视 2D·透明底·矢量 SVG。
// 自产美术·无许可/网络依赖（source: apollo-procedural·与 game-103 同路）。占位性质：owner 真出图管线就绪即逐行替换。
// 用法：node scripts/game101-art-gen.mjs —— 写 SVG + 回写 art-ledger.json（status→filled·gen.servedPath）。
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'public', 'games', 'game101', 'art');
mkdirSync(ART, { recursive: true });

// ── 物件占位 emoji（镜像 theme.ts ITEM_EMOJI·自足不引依赖）──────────────────────
const EMOJI = {
  food_1: '🌾', food_2: '🍚', food_3: '🍞', food_4: '🥐', food_5: '🍰', food_6: '🎂', food_7: '🥧', food_8: '🍨', food_9: '🍽️',
  fish_1: '🐟', fish_2: '🐠', fish_3: '🦐', fish_4: '🍣', fish_5: '🍥', fish_6: '🍱', fish_7: '🍤', fish_8: '🍢', fish_9: '🫕',
  fries_1: '🥔', fries_2: '🥕', fries_3: '🥗', fries_4: '🥘', fries_5: '🌽', fries_6: '🍲', fries_7: '🍛',
  coffee_1: '🫘', coffee_2: '☕', coffee_3: '🥛', coffee_4: '🥤', coffee_5: '🧋', coffee_6: '🧃', coffee_7: '🍵', coffee_8: '🍹',
  tool_1: '🍫', tool_2: '🍬', tool_3: '🍩', tool_4: '🧁', tool_5: '🧇', tool_6: '🍭', tool_7: '🍪', tool_8: '🍯',
  timed_fresh: '🦀',
};
const GEN_EMOJI = { gen_fridge: '🌾', gen_coffee: '☕', gen_fishbox: '🎣', gen_toolbox: '🧁' };
// 链底色（镜像 theme.ts CHAIN_TINT）+ 每链级数（levelTint 越高越亮）。
const CHAIN_TINT = { food: [0xff, 0x6b, 0x6b], fish: [0x4d, 0xa6, 0xff], fries: [0xf4, 0xc0, 0x4d], coffee: [0xa9, 0x74, 0x4f], tool: [0x9b, 0x8c, 0xff] };
const CHAIN_MAX = { food: 9, fish: 9, fries: 7, coffee: 8, tool: 5 }; // 台账里 tool 到 8 但基链 5 起——按 max=8 处理更亮
CHAIN_MAX.tool = 8;

const hex = (r, g, b) => '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
const mixWhite = ([r, g, b], t) => [r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t];
const darker = ([r, g, b], k = 0.42) => [r * k, g * k, b * k];

const S = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${body}</svg>\n`;
const gloss = (cx, cy, rx, ry, op = 0.5) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${op}"/>`;
// 糖果贴片：厚描边圆角方 + 上亮下深链色渐变 + 顶部 glossy 高光 + 居中 emoji 主体。
function tile(id, base, top, emoji, round = 15) {
  const gid = 't' + id.replace(/[^a-z0-9]/gi, '');
  return S(
    `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${base}"/></linearGradient></defs>` +
    `<rect x="4" y="4" width="56" height="56" rx="${round + 2}" fill="${hex(...darker(CHAIN_TINT._cur || [40, 26, 18], 0.5))}"/>` +
    `<rect x="6" y="6" width="52" height="52" rx="${round}" fill="url(#${gid})"/>` +
    gloss(24, 20, 13, 7, 0.34) +
    `<text x="32" y="33" font-size="30" text-anchor="middle" dominant-baseline="central">${emoji}</text>`,
  );
}

const made = [];
function chainOf(key) {
  const m = /^item_([a-z]+)_(\d+)$/.exec(key);
  if (!m) return null;
  return { chain: m[1], lvl: Number(m[2]) };
}
function tileFor(key) {
  if (key === 'timed_fresh' || key === 'item_timed_fresh') {
    return tile(key, '#e0472e', '#ff9a6a', '🦀', 15);
  }
  const c = chainOf(key);
  if (c && CHAIN_TINT[c.chain]) {
    const t = Math.min(1, (c.lvl - 1) / Math.max(1, (CHAIN_MAX[c.chain] || 8) - 1)) * 0.55;
    const emojiKey = `${c.chain}_${c.lvl}`;
    CHAIN_TINT._cur = CHAIN_TINT[c.chain];
    const base = mixWhite(CHAIN_TINT[c.chain], t);
    const top = mixWhite(CHAIN_TINT[c.chain], Math.min(1, t + 0.28));
    return tile(key, hex(...base), hex(...top), EMOJI[emojiKey] || '❓');
  }
  return null;
}

// 特例：生成器（暖木色底 + 器械 emoji）·泡泡锁·板格底。
function specialFor(key) {
  if (GEN_EMOJI[key]) {
    CHAIN_TINT._cur = [0xc8, 0x87, 0x1e];
    return tile(key, '#b06a1a', '#e6a94a', GEN_EMOJI[key], 13); // 暖木金·生成器
  }
  if (key === 'bubble') {
    return S(
      `<defs><radialGradient id="bub" cx="38%" cy="32%" r="72%">` +
      `<stop offset="0" stop-color="#eaffff" stop-opacity=".95"/><stop offset="55%" stop-color="#9fe3ff" stop-opacity=".72"/>` +
      `<stop offset="1" stop-color="#4aa0d8" stop-opacity=".82"/></radialGradient></defs>` +
      `<circle cx="32" cy="32" r="26" fill="#1f5f88" opacity=".45"/>` +
      `<circle cx="32" cy="32" r="23" fill="url(#bub)"/>` +
      gloss(24, 22, 7, 4.5, 0.85) + `<circle cx="40" cy="40" r="2.6" fill="#fff" opacity=".6"/>`,
    );
  }
  if (key === 'board_cell') {
    return S(
      `<rect x="3" y="3" width="58" height="58" rx="14" fill="#caa46e"/>` +
      `<rect x="6" y="6" width="52" height="52" rx="12" fill="#f3e3c2"/>` +
      `<rect x="10" y="10" width="44" height="44" rx="9" fill="#fbf1da"/>` +
      gloss(24, 20, 12, 7, 0.4),
    );
  }
  return null;
}

// ── 回写台账：每行 status→filled·gen 记 apollo-procedural + servedPath──────────
const ledgerPath = join(ART, 'art-ledger.json');
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
const STYLE = 'gossip-harbor cozy candy cartoon (glossy)';

for (const row of ledger.rows) {
  const key = row.skinKey || row.id; // 台账 skinKey = sprite textureKey（item_coffee_1 / gen_coffee / bubble / board_cell）
  const svg = specialFor(key) ?? tileFor(key) ?? tileFor('item_' + key);
  if (!svg) { console.error('[game101-art-gen] 跳过（无匹配 emoji/规则）:', key); continue; }
  const file = key + '.svg';
  writeFileSync(join(ART, file), svg);
  const servedPath = `/games/game101/art/${file}`;
  row.status = 'filled';
  row.gen = { source: 'apollo-procedural', script: 'scripts/game101-art-gen.mjs', style: STYLE, servedPath };
  made.push(file);
}
ledger.updatedAt = ledger.updatedAt || undefined; // 保留原字段·不注入时间戳（脚本确定性）
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
console.error('[game101-art-gen] wrote', made.length, 'svg + 回写台账', made.length, '行 filled');
