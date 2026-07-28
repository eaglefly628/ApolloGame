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
    `<rect x="1.5" y="1.5" width="61" height="61" rx="${round + 2}" fill="${hex(...darker(CHAIN_TINT._cur || [40, 26, 18], 0.5))}"/>` +
    `<rect x="3.5" y="3.5" width="57" height="57" rx="${round}" fill="url(#${gid})"/>` +
    gloss(24, 20, 15, 8, 0.34) +
    `<text x="32" y="35" font-size="46" text-anchor="middle" dominant-baseline="central">${emoji}</text>`,
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

// 生成器 → 产出链（底色应与产出物同色·owner：四台机子别都咖啡色）。
const GEN_CHAIN = { gen_fridge: 'food', gen_coffee: 'coffee', gen_fishbox: 'fish', gen_toolbox: 'tool' };
// 特例：生成器（底色 = 产出链色·器械 emoji）·泡泡锁·板格底。
function specialFor(key) {
  if (GEN_EMOJI[key]) {
    const ch = GEN_CHAIN[key];
    const c = CHAIN_TINT[ch] || [0xc8, 0x87, 0x1e];
    CHAIN_TINT._cur = c;
    // 生成器 = 该链**满饱和**深色底（比物品更浓·一眼辨「这是产 X 的机子」）+ 器械 emoji。
    return tile(key, hex(...c), hex(...mixWhite(c, 0.32)), GEN_EMOJI[key], 13);
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
// ── HUD 顶栏图标（owner 参考图·5 数据·可替换美术资源）：圆牌 + emoji·各自主题色──────
// hud_avatar 用女主立绘(林夏)为默认·其余 4 个自产圆牌图标。台账追加 art-49+（按 skinKey 去重·幂等）。
function hudChip(emoji, c) {
  const g = 'h' + emoji.codePointAt(0).toString(16);
  return S(
    `<defs><radialGradient id="${g}" cx="38%" cy="32%" r="72%">` +
    `<stop offset="0" stop-color="${hex(...mixWhite(c, 0.5))}"/><stop offset="1" stop-color="${hex(...c)}"/></radialGradient></defs>` +
    `<circle cx="32" cy="32" r="29" fill="${hex(...darker(c, 0.5))}"/>` +
    `<circle cx="32" cy="32" r="26" fill="url(#${g})"/>` +
    gloss(24, 22, 9, 5, 0.5) +
    `<text x="32" y="35" font-size="34" text-anchor="middle" dominant-baseline="central">${emoji}</text>`,
  );
}
const HUD = [
  { key: 'hud_energy', emoji: '⚡', c: [0xff, 0xc4, 0x3d], desc: '体力图标' },
  { key: 'hud_coins', emoji: '🪙', c: [0xf4, 0xb7, 0x40], desc: '金币图标' },
  { key: 'hud_gems', emoji: '💎', c: [0xff, 0x6f, 0x91], desc: '宝石图标' },
  { key: 'hud_cart', emoji: '🛒', c: [0x8f, 0xd0, 0x9a], desc: '商店车图标' },
];
{
  let n = ledger.rows.reduce((m, r) => Math.max(m, Number(String(r.no || '').replace(/\D/g, '')) || 0), 0);
  const upsert = (skinKey, kind, desc, prompt, servedPath, writeSvg) => {
    if (writeSvg) writeFileSync(join(ART, skinKey + '.svg'), writeSvg);
    const gen = { source: 'apollo-procedural', script: 'scripts/game101-art-gen.mjs', style: STYLE, servedPath };
    const ex = ledger.rows.find((r) => (r.skinKey || r.id) === skinKey);
    if (ex) { ex.status = 'filled'; ex.gen = gen; ex.kind = kind; ex.desc = desc; ex.prompt = prompt; return; }
    ledger.rows.push({ no: `art-${String(++n).padStart(2, '0')}`, skinKey, kind, desc, prompt, status: 'filled', gen });
  };
  for (const h of HUD) {
    upsert(h.key, 'hud-icon', `HUD·${h.desc}`, `a cute glossy cartoon ${h.desc} icon, cozy candy style, round badge, transparent-ready`, `/games/game101/art/${h.key}.svg`, hudChip(h.emoji, h.c));
  }
  // 玩家头像（女主·默认复用立绘 林夏·owner 可替换）
  upsert('hud_avatar', 'portrait', 'HUD·玩家头像(女主 林夏)', 'cozy 2.5D cartoon portrait of the heroine player avatar, warm palette', '/games/game101/art/portraits/linxia.svg', null);
}

ledger.updatedAt = ledger.updatedAt || undefined; // 保留原字段·不注入时间戳（脚本确定性）
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
console.error('[game101-art-gen] wrote', made.length, 'svg + 4 HUD 图标 + 台账回写');
