// scripts/game101-portrait-gen.mjs —— game101《海港绯闻》6 位顾客卡通立绘（半身头像·占位）。
// 风格锚：cozy 海港治愈·轻插画 2.5D·糖果感（art-manifest §域1）。参数化矢量脸：暖色渐变底 +
// 圆润半身 + 发型/配饰/表情差分，厚描边。透明底非必需（卡内圆角显示）·自产·零网络/许可依赖。
// 用法：node scripts/game101-portrait-gen.mjs —— 写 6 SVG 到 art/portraits/ + 回写本地 index.json。
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'public', 'games', 'game101', 'art');
const DIR = join(ART, 'portraits');
mkdirSync(DIR, { recursive: true });

// ── 参数化卡通半身脸（viewBox 256×320·卡内圆角缩放显示）─────────────────────────
// p: { skin, skinD, hair, hairD, bgTop, bgBot, style, accent, brow, mouth }
function portrait(p) {
  const W = 256, H = 320;
  const gid = 'bg' + p.key.replace(/[^a-z0-9]/gi, '');
  const parts = [];
  parts.push(
    `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${p.bgTop}"/><stop offset="1" stop-color="${p.bgBot}"/></linearGradient></defs>`,
  );
  // 底 + 柔光晕
  parts.push(`<rect width="${W}" height="${H}" fill="url(#${gid})"/>`);
  parts.push(`<ellipse cx="128" cy="118" rx="120" ry="120" fill="#fff" opacity="0.14"/>`);
  // 肩/身（半身圆润）
  parts.push(`<path d="M40 320 C40 250 78 214 128 214 C178 214 216 250 216 320 Z" fill="${p.shirtD}"/>`);
  parts.push(`<path d="M52 320 C52 258 86 226 128 226 C170 226 204 258 204 320 Z" fill="${p.shirt}"/>`);
  // 脖
  parts.push(`<rect x="112" y="188" width="32" height="34" rx="14" fill="${p.skinD}"/>`);
  parts.push(`<rect x="114" y="186" width="28" height="30" rx="13" fill="${p.skin}"/>`);
  // 后发（style 决定轮廓）
  if (p.style === 'long') parts.push(`<path d="M64 150 C60 232 76 268 96 280 L96 150 Z M192 150 C196 232 180 268 160 280 L160 150 Z" fill="${p.hairD}"/>`);
  if (p.style === 'twin') { parts.push(`<circle cx="60" cy="150" r="24" fill="${p.hairD}"/><circle cx="196" cy="150" r="24" fill="${p.hairD}"/>`); }
  // 头
  parts.push(`<ellipse cx="128" cy="128" rx="66" ry="70" fill="${p.skinD}"/>`);
  parts.push(`<ellipse cx="128" cy="126" rx="62" ry="66" fill="${p.skin}"/>`);
  // 耳
  parts.push(`<circle cx="66" cy="132" r="12" fill="${p.skinD}"/><circle cx="190" cy="132" r="12" fill="${p.skinD}"/>`);
  // 前发（style）
  if (p.style === 'short' || p.style === 'long')
    parts.push(`<path d="M66 108 C74 62 182 62 190 108 C190 92 176 70 128 70 C80 70 66 92 66 108 Z" fill="${p.hair}"/>` +
      `<path d="M66 110 C70 84 96 72 96 72 C88 92 88 104 90 112 Z M190 110 C186 84 160 72 160 72 C168 92 168 104 166 112 Z" fill="${p.hair}"/>`);
  if (p.style === 'twin') parts.push(`<path d="M68 106 C78 64 178 64 188 106 C182 84 160 72 128 72 C96 72 74 84 68 106 Z" fill="${p.hair}"/>`);
  if (p.style === 'bald') { /* 秃/短寸：仅顶发际淡影 */ parts.push(`<path d="M74 100 C86 74 170 74 182 100 C176 90 158 84 128 84 C98 84 80 90 74 100 Z" fill="${p.hair}" opacity="0.9"/>`); }
  if (p.cap) parts.push(`<path d="M60 96 C72 58 184 58 196 96 C196 90 176 72 128 72 C80 72 60 90 60 96 Z" fill="${p.cap}"/><rect x="120" y="52" width="16" height="16" rx="4" fill="${p.cap}"/>`);
  if (p.bandana) parts.push(`<path d="M64 96 C74 78 182 78 192 96 L192 84 C182 70 74 70 64 84 Z" fill="${p.bandana}"/><path d="M186 92 L214 104 L206 118 L182 104 Z" fill="${p.bandana}"/>`);
  // 眉
  parts.push(`<rect x="92" y="116" width="22" height="6" rx="3" fill="${p.brow}" transform="rotate(${p.browT} 103 119)"/>`);
  parts.push(`<rect x="142" y="116" width="22" height="6" rx="3" fill="${p.brow}" transform="rotate(${-p.browT} 153 119)"/>`);
  // 眼
  parts.push(`<ellipse cx="103" cy="134" rx="9" ry="11" fill="#fff"/><ellipse cx="153" cy="134" rx="9" ry="11" fill="#fff"/>`);
  parts.push(`<circle cx="104" cy="136" r="5.4" fill="#3a2a22"/><circle cx="152" cy="136" r="5.4" fill="#3a2a22"/>`);
  parts.push(`<circle cx="106" cy="134" r="1.7" fill="#fff"/><circle cx="154" cy="134" r="1.7" fill="#fff"/>`);
  // 眼镜（可选）
  if (p.glasses) parts.push(`<g fill="none" stroke="${p.glasses}" stroke-width="4"><circle cx="103" cy="135" r="16"/><circle cx="153" cy="135" r="16"/><path d="M119 133 H137"/></g>`);
  // 腮红
  parts.push(`<ellipse cx="90" cy="152" rx="11" ry="7" fill="#ff8f9c" opacity="0.5"/><ellipse cx="166" cy="152" rx="11" ry="7" fill="#ff8f9c" opacity="0.5"/>`);
  // 鼻 + 嘴（表情）
  parts.push(`<path d="M126 148 q4 6 -2 9" fill="none" stroke="${p.skinD}" stroke-width="3" stroke-linecap="round"/>`);
  if (p.mouth === 'smile') parts.push(`<path d="M112 166 Q128 182 144 166" fill="none" stroke="#9c4a3c" stroke-width="4" stroke-linecap="round"/>`);
  if (p.mouth === 'grin') parts.push(`<path d="M110 164 Q128 186 146 164 Q128 174 110 164 Z" fill="#9c4a3c"/><path d="M112 167 Q128 172 144 167" stroke="#fff" stroke-width="3" fill="none"/>`);
  if (p.mouth === 'calm') parts.push(`<path d="M116 168 Q128 176 140 168" fill="none" stroke="#9c4a3c" stroke-width="4" stroke-linecap="round"/>`);
  if (p.mouth === 'stern') parts.push(`<path d="M114 170 H142" stroke="#9c4a3c" stroke-width="4" stroke-linecap="round"/>`);
  // 胡须（老陈）
  if (p.beard) parts.push(`<path d="M92 158 C100 196 156 196 164 158 C150 176 106 176 92 158 Z" fill="${p.beard}" opacity="0.92"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>\n`;
}

// ── 6 位角色（art-manifest §域1·gdd 设定）──────────────────────────────────────
const CHARS = [
  { key: 'zhou', name: '周航', skin: '#f0c199', skinD: '#d9a273', hair: '#3a2c22', hairD: '#291f18', style: 'short',
    shirt: '#4fb0e0', shirtD: '#2f88bc', bandana: '#2f6fd0', brow: '#291f18', browT: 6, mouth: 'grin', bgTop: '#bfe9ff', bgBot: '#6fb9e6' },
  { key: 'chen', name: '老陈', skin: '#e8b78a', skinD: '#cf9564', hair: '#8a8378', hairD: '#6d675d', style: 'bald',
    shirt: '#c98a4a', shirtD: '#a76c30', cap: '#7a5a34', beard: '#9a9186', brow: '#6d675d', browT: 3, mouth: 'smile', bgTop: '#ffe0b8', bgBot: '#e6a765' },
  { key: 'su', name: '苏晴', skin: '#f6d3b0', skinD: '#e0b48c', hair: '#6b4a34', hairD: '#4f3626', style: 'long',
    shirt: '#ff8fae', shirtD: '#e06489', brow: '#4f3626', browT: 5, mouth: 'smile', bgTop: '#ffd9e6', bgBot: '#ff9ec2' },
  { key: 'linxia', name: '林夏', skin: '#f8d8ba', skinD: '#e6bd97', hair: '#4a3324', hairD: '#33231a', style: 'long',
    shirt: '#ffb347', shirtD: '#e08a1e', brow: '#33231a', browT: 5, mouth: 'calm', bgTop: '#fff0cf', bgBot: '#ffc36e' },
  { key: 'guodong', name: '林国栋', skin: '#e6bd97', skinD: '#cc9e73', hair: '#b7b0a5', hairD: '#958e83', style: 'short',
    shirt: '#5a6b8c', shirtD: '#3d4c69', glasses: '#3a2c22', brow: '#958e83', browT: -4, mouth: 'stern', bgTop: '#d9dced', bgBot: '#8f9bbf' },
  { key: 'aya', name: '阿雅', skin: '#fbdcc0', skinD: '#ecc19c', hair: '#ff9e3d', hairD: '#e07a1e', style: 'twin',
    shirt: '#8a5cf6', shirtD: '#6a3fd0', brow: '#e07a1e', browT: 8, mouth: 'grin', bgTop: '#ecd9ff', bgBot: '#b98cf0' },
];

const assets = [];
for (let i = 0; i < CHARS.length; i++) {
  const c = CHARS[i];
  const file = `${c.key}.svg`;
  writeFileSync(join(DIR, file), portrait(c));
  assets.push({
    id: `cust_portrait_${i + 1}`, type: 'texture', description: `${c.name}·卡通立绘占位（apollo-procedural）`,
    status: 'filled', path: `/games/game101/art/portraits/${file}`,
    spec: { usage: 'sprite', colorSpace: 'srgb', format: 'svg', width: 256, height: 320, transparent: false },
    category: 'portrait', tags: ['portrait', 'cartoon', 'cozy', 'placeholder', c.key], style: 'cozy-cartoon',
    license: 'apollo-procedural', source: 'scripts/game101-portrait-gen.mjs',
  });
}

// 回写本地 index.json：替换旧 cust_portrait_* 像素占位 + 保留其余资产。
const idxPath = join(ART, 'index.json');
const idx = existsSync(idxPath) ? JSON.parse(readFileSync(idxPath, 'utf8')) : { version: 1, assets: [] };
idx.assets = (idx.assets || []).filter((a) => !/^cust_portrait_/.test(a.id)).concat(assets);
writeFileSync(idxPath, JSON.stringify(idx, null, 2) + '\n');

// 回写 art-ledger.json：把 6 位立绘作为**台账行**并入（美术台账读此文件·owner 可走替换管线换图）。
// 按 skinKey 去重(重跑幂等)·no 编号接在既有 sprite 行之后。人工精调 prompt 供真出图。
const PROMPT = {
  zhou: 'cozy 2.5D cartoon half-body portrait of a sunny young fisherman, tan skin, dark hair with a blue bandana, friendly grin, warm harbor palette, soft lighting, transparent-ready',
  chen: 'cozy 2.5D cartoon half-body portrait of a kindly middle-aged handyman, tan skin, short greying hair under a work cap, short beard, warm smile, warm harbor palette',
  su: 'cozy 2.5D cartoon half-body portrait of a gentle young urban woman, fair skin, long wavy brown hair, soft smile, warm coral palette, soft lighting',
  linxia: 'cozy 2.5D cartoon half-body portrait of the heroine, a calm woman who moved back home, fair skin, long dark-brown hair, serene expression, warm amber palette',
  guodong: 'cozy 2.5D cartoon half-body portrait of a stern elderly father, greying hair, round glasses, reserved expression, muted blue palette',
  aya: 'cozy 2.5D cartoon half-body portrait of a lively young girl, fair skin, orange twin-tail hair, cheerful grin, playful violet palette',
};
const ledPath = join(ART, 'art-ledger.json');
if (existsSync(ledPath)) {
  const led = JSON.parse(readFileSync(ledPath, 'utf8'));
  led.rows = led.rows || [];
  const maxNo = led.rows.reduce((m, r) => Math.max(m, Number(String(r.no || '').replace(/\D/g, '')) || 0), 0);
  let n = maxNo;
  for (let i = 0; i < CHARS.length; i++) {
    const c = CHARS[i];
    const skinKey = `cust_portrait_${i + 1}`;
    const servedPath = `/games/game101/art/portraits/${c.key}.svg`;
    const gen = { source: 'apollo-procedural', script: 'scripts/game101-portrait-gen.mjs', style: 'cozy-cartoon portrait', servedPath };
    const existing = led.rows.find((r) => (r.skinKey || r.id) === skinKey);
    if (existing) { existing.status = 'filled'; existing.gen = gen; existing.kind = 'portrait'; existing.prompt = PROMPT[c.key]; existing.desc = `${c.name}·顾客卡通立绘`; continue; }
    led.rows.push({ no: `art-${String(++n).padStart(2, '0')}`, skinKey, kind: 'portrait', desc: `${c.name}·顾客卡通立绘`, prompt: PROMPT[c.key], status: 'filled', gen });
  }
  writeFileSync(ledPath, JSON.stringify(led, null, 2) + '\n');
}
console.error('[game101-portrait-gen] wrote', CHARS.length, 'portraits + index.json + 台账 6 行（cust_portrait_1..' + CHARS.length + '）');
