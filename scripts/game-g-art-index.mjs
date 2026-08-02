// scripts/game-g-art-index.mjs —— 把 game-g 的程序化/矢量美术登记进它的美术库（owner 07-13 步1·非破坏）。
// game-g 的美术=纯程序化：52 名将立绘（portraits.ts·SVG 剪影）+ 绿呢底纹（art-textures.ts）。
// 「矢量图也是美术资源」——把这些矢量图落成真 .svg 文件 + 美术台账索引，每条 source=procedural·style=vector·
// 可后续被文生图真图热替换（步2 渲染指向索引·步3 引擎统一 resolver）。此脚本只写台账/矢量文件，绝不改游戏渲染。
// 用法：npx vite-node scripts/game-g-art-index.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HERO_CARDS } from '../games/game-g/hero-codex.ts';
import { heroPortrait } from '../games/game-g/portraits.ts';
import { coinLatticeTile } from '../games/game-g/art-textures.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'games', 'game-g', 'art');
const PORT = join(OUT, 'portraits');
const TEX = join(OUT, 'textures');
mkdirSync(PORT, { recursive: true });
mkdirSync(TEX, { recursive: true });

// 花色→主题色名（文生图 prompt 提示·与 portraits.ts SUIT_HEX 一致）
const SUIT_TONE = { '♠': '冷钢蓝', '♥': '赤焰红', '♦': '琥珀金', '♣': '苍翠绿' };
const SUIT_LETTER = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };

const rows = [];
const assets = [];
let n = 0;

// 1) 52 名将立绘（矢量·portraits.ts 程序生成 → 落真 .svg 文件）
for (const h of HERO_CARDS) {
  const svg = heroPortrait(h.suit, h.era, h.rank, h.rar);
  const file = `${h.id}.svg`;
  writeFileSync(join(PORT, file), svg);
  const served = `/games/game-g/art/portraits/${file}`;
  const id = `game-g/hero/${SUIT_LETTER[h.suit]}${h.rank}`;
  n += 1;
  const no = 'art-' + String(n).padStart(2, '0');
  const desc = `${h.name}（${h.title}·${h.era}）名将立绘`;
  rows.push({
    no, desc, kind: 'sprite',
    slot: { entity: `hero/${h.id}`, component: 'PlayingCard', field: 'art' }, // 代码游戏·牌面立绘槽（heroPortraitUri 供 PlayingCard.art）
    query: `${h.name} ${h.title}`,
    placeholder: { current: '程序化矢量立绘（SVG 剪影·portraits.ts 按 时代/花色/军衔 拼盔甲半身像）', source: 'procedural', count: 1, instances: [`hero/${h.id}`] },
    spec: { w: 120, h: 150, transparent: true },
    context: `game-g《翻命扑克》${h.rank}${h.suit} 名将立绘·${desc}·当前=程序矢量·可替换真图（矢量也是美术资源）`,
    status: 'replaced', // 矢量真图在场 → 美术库显示
    gen: { provider: 'procedural', model: 'portraits.ts', prompt: null, servedPath: served, localId: id },
    provenance: { generator: 'procedural-vector', source: 'portraits.ts', mock: false },
    prompt: `${h.name}（${h.title}），${h.era} 历史名将半身立绘，古风拟人厚涂，${SUIT_TONE[h.suit]}主色调，盔甲+背后兵器，透明背景，卡牌立绘`,
  });
  assets.push({ id, type: 'texture', status: 'filled', path: served, description: desc,
    category: 'sprite.hero', tags: ['game-g', 'hero', 'portrait', 'vector', SUIT_LETTER[h.suit] + h.rank],
    source: 'procedural(portraits.ts)', license: 'proprietary', style: 'vector.ink',
    provenance: { generator: 'procedural-vector', source: 'portraits.ts', mock: false } });
}

// 2) 绿呢牌桌底纹（矢量·coinLatticeTile SVG·从 data-URI 解回原始 SVG 落文件）
{
  const uri = coinLatticeTile('#e8cd82', 0.09, 64); // data:image/svg+xml;base64,...
  const b64 = uri.split(',')[1] || '';
  const svg = Buffer.from(b64, 'base64').toString('utf8');
  writeFileSync(join(TEX, 'felt-brocade.svg'), svg);
  const served = '/games/game-g/art/textures/felt-brocade.svg';
  n += 1;
  rows.push({
    no: 'art-' + String(n).padStart(2, '0'), desc: '绿呢牌桌底纹·玄铁金钱币锁子纹（无缝平铺）', kind: 'texture',
    slot: { entity: 'table/felt', component: 'Panel', field: 'bgTexture' }, query: '绿呢牌桌底纹',
    placeholder: { current: '程序化矢量底纹（art-textures.ts coinLatticeTile·古钱币锁子纹）', source: 'procedural', count: 1, instances: ['table/felt'] },
    spec: { w: 64, h: 64, transparent: true },
    context: 'game-g 主页/战场绿呢牌桌底纹·当前=程序矢量·双皮(玄铁金/锦霞)走参数·可替换真贴图',
    status: 'replaced',
    gen: { provider: 'procedural', model: 'art-textures.ts', prompt: null, servedPath: served, localId: 'game-g/tex/felt-brocade' },
    provenance: { generator: 'procedural-vector', source: 'art-textures.ts', mock: false },
    prompt: '古钱币锁子纹无缝平铺底纹，玄铁金线，暗绿呢牌桌质感，低对比 subtle，可平铺',
  });
  assets.push({ id: 'game-g/tex/felt-brocade', type: 'texture', status: 'filled', path: served,
    description: '绿呢牌桌底纹·钱币锁子纹', category: 'texture.background', tags: ['game-g', 'texture', 'felt', 'vector'],
    source: 'procedural(art-textures.ts)', license: 'proprietary', style: 'vector.ink',
    provenance: { generator: 'procedural-vector', source: 'art-textures.ts', mock: false } });
}

writeFileSync(join(OUT, 'art-ledger.json'), JSON.stringify({ version: 1, game: 'game-g', mode: 'procedural-index',
  count: rows.length, instances: rows.length, rows, artStyle: '古风拟人矢量·翻命扑克' }, null, 2) + '\n');
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ version: 1, assets }, null, 2) + '\n');
console.log(`✓ game-g 程序化美术索引化：${rows.length} 行（52 名将立绘 + 绿呢底纹·矢量真 .svg 在场·非破坏）→ ${OUT}`);
