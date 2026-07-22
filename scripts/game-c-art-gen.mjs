#!/usr/bin/env node
// game-c 程序化占位美术生成器（REQ-VECTOR-ART·夜金 SVG·art-bible §1 风格）。
// 目的：给 art-ledger 里 28 个"素坯"面（背幕/呢面/木栏/按钮/特效/图标）生成**真 SVG 文件**
//   → public/games/game-c/art/**（平台素材屏不再空白）+ upsert public/games/game-c/art/index.json。
// 牌面/筹码=vendor 现货（另 62 张·不在此）。真图到位前这些=可视占位；owner AI/平台出图同 id 热替换。
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ART = resolve(ROOT, 'public/games/game-c/art');
const S = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const made = []; // {rel,w,h,id,desc}
function emit(id, rel, w, h, desc, svg) { const p = join(ART, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, svg); made.push({ id, rel, w, h, desc }); }

// ── §1 调色板 ──
const GOLD = '#d8b878', GOLD2 = '#ecca8a', VIO = '#c9a9dd', RED = '#d0483e', RED2 = '#a01e3a', WOOD = '#6a4c38', WOOD2 = '#3e2c1e';

// 夜金按钮皮模板（圆角板 + 上高光 + rim）。
const btn = (w, h, a, b, rim, label, lc) => S(w, h,
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
  `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="13" fill="url(#g)" stroke="${rim}" stroke-width="2"/>` +
  `<rect x="5" y="5" width="${w - 10}" height="${(h - 10) / 2}" rx="10" fill="#ffffff" opacity="0.07"/>` +
  (label ? `<text x="${w / 2}" y="${h / 2 + 6}" font-family="sans-serif" font-weight="700" font-size="20" fill="${lc}" text-anchor="middle" opacity="0.85">${label}</text>` : ''));

// 径向辉光精灵（特效占位）。
const glow = (c, rays) => S(512, 512,
  `<defs><radialGradient id="r"><stop offset="0" stop-color="${c}" stop-opacity="0.9"/><stop offset="0.5" stop-color="${c}" stop-opacity="0.35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>` +
  `<circle cx="256" cy="256" r="240" fill="url(#r)"/>` +
  (rays ? `<g stroke="${c}" stroke-width="6" stroke-opacity="0.5">${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<line x1="${256 + 60 * Math.cos(a)}" y1="${256 + 60 * Math.sin(a)}" x2="${256 + 230 * Math.cos(a)}" y2="${256 + 230 * Math.sin(a)}"/>`; }).join('')}</g>` : ''));

// 衣柜件图标（金描边简形 + emoji 兜底字）。
const icon = (glyph) => S(128, 128,
  `<rect x="8" y="8" width="112" height="112" rx="16" fill="#2a1826" stroke="${GOLD}" stroke-width="2" stroke-opacity="0.6"/>` +
  `<text x="64" y="86" font-size="60" text-anchor="middle">${glyph}</text>`);

// ── ① 背幕（夜窗·复用 art-bible 背幕观感）──
emit('scene/backdrop', 'scene/backdrop.svg', 1280, 720, '夜景背幕', S(1280, 720,
  `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#241734"/><stop offset=".44" stop-color="#1a1226"/><stop offset="1" stop-color="#100a18"/></linearGradient>` +
  `<linearGradient id="win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2c50"/><stop offset=".58" stop-color="#241a34"/><stop offset="1" stop-color="#140d1e"/></linearGradient>` +
  `<radialGradient id="warm"><stop offset="0" stop-color="#ffc882" stop-opacity=".26"/><stop offset=".7" stop-color="#ffc882" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="cool"><stop offset="0" stop-color="#c39aee" stop-opacity=".24"/><stop offset=".7" stop-color="#c39aee" stop-opacity="0"/></radialGradient>` +
  `<pattern id="dw" width="15" height="21" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".95" fill="#ffce8c" opacity=".62"/></pattern></defs>` +
  `<rect width="1280" height="720" fill="url(#bg)"/><rect x="48" y="0" width="1184" height="358" rx="8" fill="url(#win)"/><rect x="48" y="0" width="1184" height="358" fill="url(#dw)"/>` +
  `<circle cx="270" cy="150" r="200" fill="url(#warm)"/><circle cx="1010" cy="120" r="220" fill="url(#cool)"/>` +
  `<g stroke="#0a060e" stroke-opacity=".85"><line x1="344" y1="0" x2="344" y2="358" stroke-width="6"/><line x1="640" y1="0" x2="640" y2="358" stroke-width="6"/><line x1="936" y1="0" x2="936" y2="358" stroke-width="6"/><line x1="48" y1="153" x2="1232" y2="153" stroke-width="5"/></g>`));

// ── ② 牌桌 ──
emit('table/felt-albedo', 'table/felt-albedo.svg', 1024, 1024, '呢面绒布', S(1024, 1024,
  `<defs><radialGradient id="f" cx=".5" cy=".44" r=".62"><stop offset="0" stop-color="#7d5570"/><stop offset=".46" stop-color="#5a3a52"/><stop offset=".78" stop-color="#38222f"/><stop offset="1" stop-color="#281620"/></radialGradient>` +
  `<radialGradient id="pool" cx=".5" cy=".42" r=".38"><stop offset="0" stop-color="#ffd2a0" stop-opacity=".16"/><stop offset="1" stop-color="#ffd2a0" stop-opacity="0"/></radialGradient>` +
  `<pattern id="wv" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 3H6M3 0V6" stroke="#000" stroke-opacity=".05" stroke-width=".6"/></pattern></defs>` +
  `<rect width="1024" height="1024" fill="url(#f)"/><rect width="1024" height="1024" fill="url(#wv)"/><rect width="1024" height="1024" fill="url(#pool)"/>`));
emit('table/felt-normal', 'table/felt-normal.svg', 1024, 1024, '呢面法线', S(1024, 1024, `<rect width="1024" height="1024" fill="#8080ff"/><rect width="1024" height="1024" fill="url(#n)" opacity=".08"/><defs><pattern id="n" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 3H6M3 0V6" stroke="#a0a0ff" stroke-width=".6"/></pattern></defs>`));
emit('table/rail-albedo', 'table/rail-albedo.svg', 1024, 256, '木栏', S(1024, 256,
  `<defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5842"/><stop offset=".5" stop-color="${WOOD}"/><stop offset="1" stop-color="${WOOD2}"/></linearGradient></defs>` +
  `<rect width="1024" height="256" fill="url(#w)"/>` +
  `<g stroke="#2a1c12" stroke-opacity=".28" stroke-width="1">${Array.from({ length: 16 }, (_, i) => `<path d="M0 ${16 * i + 6}H1024"/>`).join('')}</g>` +
  `<rect y="108" width="1024" height="40" rx="20" fill="#3a2a1e" opacity=".55"/>`));
emit('table/rail-normal', 'table/rail-normal.svg', 1024, 256, '木栏法线', S(1024, 256, `<rect width="1024" height="256" fill="#8080ff"/>`));
emit('table/betline', 'table/betline.svg', 1024, 512, '下注线贴花', S(1024, 512, `<path d="M112 300 Q512 220 912 300" fill="none" stroke="${GOLD}" stroke-width="3" stroke-opacity=".5" stroke-dasharray="2 10" stroke-linecap="round"/>`));

// ── ③ UI 按钮/框 ──
emit('ui/btn-fold', 'ui/btn-fold.svg', 280, 88, '弃牌按钮皮', btn(280, 88, '#2e1a26', '#180f16', 'rgba(216,184,120,.35)', '弃牌', '#e6d6cc'));
emit('ui/btn-call', 'ui/btn-call.svg', 280, 88, '跟注按钮皮', btn(280, 88, '#2e1a26', '#180f16', 'rgba(216,184,120,.5)', '跟注', '#eadfd4'));
emit('ui/btn-raise', 'ui/btn-raise.svg', 280, 88, '加注按钮皮', btn(280, 88, '#4a2f42', '#28182a', VIO, '加注', '#f3e9fb'));
emit('ui/btn-allin', 'ui/btn-allin.svg', 200, 72, 'All-in 按钮皮', btn(200, 72, RED, RED2, '#ffd0c8', 'All-in', '#fff'));
emit('ui/btn-hero', 'ui/btn-hero.svg', 560, 96, 'hero 主键皮', btn(560, 96, GOLD2, GOLD, '#fff2cc', '', '#2a1420'));
emit('ui/btn-ghost', 'ui/btn-ghost.svg', 560, 96, 'ghost 次键皮', btn(560, 96, '#1e1422', '#140d18', 'rgba(201,169,221,.4)', '', '#c9a9dd'));
emit('ui/step', 'ui/step.svg', 96, 96, '步进键皮', S(96, 96, `<circle cx="48" cy="48" r="42" fill="#241626" stroke="${VIO}" stroke-width="2" stroke-opacity=".5"/><path d="M30 48H66" stroke="#f3e9fb" stroke-width="5" stroke-linecap="round"/>`));
emit('ui/panel-frame', 'ui/panel-frame.svg', 320, 200, '面板/席卡框', S(320, 200, `<rect x="4" y="4" width="312" height="192" rx="14" fill="none" stroke="${GOLD}" stroke-width="2" stroke-opacity=".5"/><rect x="10" y="10" width="300" height="180" rx="10" fill="none" stroke="${VIO}" stroke-width="1" stroke-opacity=".3"/>`));
emit('ui/avatar-frame', 'ui/avatar-frame.svg', 128, 128, '头像金环框', S(128, 128, `<circle cx="64" cy="64" r="60" fill="none" stroke="${GOLD}" stroke-width="4"/><circle cx="64" cy="64" r="54" fill="none" stroke="${GOLD2}" stroke-width="1.5" stroke-opacity=".6"/>`));
emit('ui/dealer', 'ui/dealer.svg', 128, 128, '庄家钮 D', S(128, 128, `<circle cx="64" cy="64" r="56" fill="#efe6d8" stroke="${GOLD}" stroke-width="4"/><text x="64" y="86" font-family="serif" font-weight="900" font-size="60" fill="#3a2a1e" text-anchor="middle">D</text>`));

// ── ④ 特效 VFX 精灵 ──
emit('fx/win-burst', 'fx/win-burst.svg', 512, 512, '胜利爆花', glow('#ffce8c', true));
emit('fx/allin-flash', 'fx/allin-flash.svg', 512, 512, 'All-in 闪', S(512, 512, `<circle cx="256" cy="256" r="180" fill="none" stroke="${RED}" stroke-width="18" opacity=".6"/><circle cx="256" cy="256" r="230" fill="none" stroke="${RED}" stroke-width="6" opacity=".3"/>`));
emit('fx/chip-spark', 'fx/chip-spark.svg', 256, 256, '筹码火花', S(256, 256, `<g fill="#ffce8c">${Array.from({ length: 10 }, (_, i) => { const a = i * Math.PI / 5, r = 40 + (i % 3) * 30; return `<circle cx="${128 + r * Math.cos(a)}" cy="${128 + r * Math.sin(a)}" r="${3 - (i % 3)}"/>`; }).join('')}</g>`));
emit('fx/deal-glow', 'fx/deal-glow.svg', 512, 256, '发牌流光', S(512, 256, `<defs><linearGradient id="s"><stop offset="0" stop-color="${VIO}" stop-opacity="0"/><stop offset=".5" stop-color="${GOLD2}" stop-opacity=".7"/><stop offset="1" stop-color="${VIO}" stop-opacity="0"/></linearGradient></defs><rect y="118" width="512" height="20" fill="url(#s)"/>`));
emit('fx/winner-ring', 'fx/winner-ring.svg', 512, 512, '赢家光环', S(512, 512, `<circle cx="256" cy="256" r="200" fill="none" stroke="${GOLD}" stroke-width="10" stroke-opacity=".7"/><circle cx="256" cy="256" r="200" fill="none" stroke="${GOLD2}" stroke-width="3" stroke-dasharray="6 14"/>`));
emit('fx/pot-shine', 'fx/pot-shine.svg', 512, 256, '底池金光', S(512, 256, `<defs><radialGradient id="p" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${GOLD2}" stop-opacity=".5"/><stop offset="1" stop-color="${GOLD2}" stop-opacity="0"/></radialGradient></defs><ellipse cx="256" cy="128" rx="240" ry="90" fill="url(#p)"/>`));

// ── ⑤ 衣柜件图标 ──
for (const [id, g] of [['earrings', '💎'], ['gloves', '🧤'], ['socks', '🧦'], ['top', '👚'], ['skirt', '👗'], ['lingerie', '🎀']]) {
  emit(`icon/wear-${id}`, `icons/wear-${id}.svg`, 128, 128, `衣柜图标·${id}`, icon(g));
}

// ── upsert index.json（游戏本地资产索引·站点绝对路径·baseUrl ''）──
const idxPath = join(ART, 'index.json');
let idx = { version: 1, assets: [] };
if (existsSync(idxPath)) { try { idx = JSON.parse(readFileSync(idxPath, 'utf8')); } catch { /* fresh */ } }
if (!Array.isArray(idx.assets)) idx.assets = [];
const byId = new Map(idx.assets.map((a) => [a.id, a]));
for (const m of made) {
  const path = `/games/game-c/art/${m.rel}`;
  byId.set(m.id, {
    id: m.id, type: 'texture', description: `game-c 程序占位·${m.desc}`, status: 'filled', path,
    spec: { format: 'svg', usage: 'sprite', width: m.w, height: m.h },
    category: m.rel.split('/')[0], style: 'procedural-noir',
    provenance: { generator: 'scripts/game-c-art-gen.mjs', license: 'CC0', source: 'procedural', date: '2026-07-22', note: '夜金 SVG 程序占位·真图到位同 id 热替换' },
  });
}
idx.assets = [...byId.values()];
writeFileSync(idxPath, `${JSON.stringify(idx, null, 1)}\n`);
console.log(`game-c-art-gen: 写 ${made.length} 个夜金 SVG 占位 → public/games/game-c/art/**（+ index.json upsert·共 ${idx.assets.length} 条）`);
console.log('  ' + made.map((m) => m.rel).join(' · '));
