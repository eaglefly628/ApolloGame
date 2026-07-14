// scripts/game-d-art-ledger.mjs —— 为「代码游戏」game-d 枚举它已交付的真美术（public/art/game-d/**·83 图）
// 成一本美术台账（art-ledger.json + index.json），落 public/games/game-d/art/。
// game-d 的美术在渲染代码 art.ts 里按 URL 引用（非 blueprint 组件），干净 derive 出不来 → 逐类枚举（owner 07-13 批）。
// 确定性·纯扫盘·零网络：每行 gen.servedPath 指真图 → 游戏美术库直接显示 game-d 真美术；status=replaced（真图在场）。
// 用法：node scripts/game-d-art-ledger.mjs
import { readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'public', 'art', 'game-d');
const OUT = join(ROOT, 'public', 'games', 'game-d', 'art');

const EL = { huo: '火焰', shui: '水波', mu: '木叶', lei: '闪电', feng: '风纹', an: '暗珠', wild: '百搭' };
const LAYER = { cuiting: '翠庭', gudian: '古殿', rongxin: '熔心', jinding: '晶顶' };
const FACE = { top: '顶面', side: '侧面', wall: '墙体' };
const CARD = {
  back: '卡背', baida: '百搭骰', zengfu: '增幅骰', zhuanhua: '转化骰', liansuo: '连锁骰',
  rongyan: '熔岩骰', shuangzi: '双子骰', shouhu: '守护骰', lengjing: '冷静骰',
  ability_shield: '技能·护盾', ability_bag: '技能·背包', ability_reroll: '技能·重投',
};
// 类 → (中文名, kind, 视角/尺寸提示, 透明)
const CAT = {
  elements:      { zh: '元素法阵图标', kind: 'sprite',  w: 256, h: 256, transparent: true },
  'element-runes': { zh: '元素法阵图标', kind: 'sprite', w: 256, h: 256, transparent: true },
  dice:          { zh: '骰面', kind: 'sprite', w: 256, h: 256, transparent: true },
  sky:           { zh: '天空背景', kind: 'bg', w: 512, h: 256, transparent: false },
  tiles:         { zh: '体素贴图', kind: 'texture', w: 256, h: 256, transparent: false },
  cards:         { zh: '战利品卡面', kind: 'sprite', w: 420, h: 588, transparent: true },
  fx:            { zh: '特效贴图', kind: 'texture', w: 256, h: 256, transparent: true },
};

// 文件名 → 语义描述（供美术需求 desc / prompt）。
function describe(cat, base) {
  if (cat === 'elements' || cat === 'element-runes') return `${EL[base] || base} 元素法阵图标（圆形符号·法阵环）`;
  if (cat === 'dice') { const [el, pip] = base.split('_'); return pip ? `${EL[el] || el} 元素骰面·点数 ${pip}` : `${EL[el] || el} 骰面`; }
  if (cat === 'sky') { const [layer, tone] = base.split('_'); return `${LAYER[layer] || layer} 层天空背景·${tone === 'warm' ? '暖调' : '暗调'}`; }
  if (cat === 'tiles') { const [layer, face] = base.split('_'); return `${LAYER[layer] || layer} 层体素贴图·${FACE[face] || face}`; }
  if (cat === 'cards') return `${CARD[base] || base} 卡面`;
  if (cat === 'fx') return base === 'glow' ? '加性辉光贴图（柔光）' : base;
  return base;
}

const rows = [];
const assets = [];
let n = 0;
const CATS = ['elements', 'element-runes', 'dice', 'sky', 'tiles', 'cards', 'fx'];
for (const cat of CATS) {
  const dir = join(ART, cat);
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  const meta = CAT[cat];
  for (const f of files) {
    const base = f.replace(/\.png$/, '');
    const servedPath = `/art/game-d/${cat}/${f}`;
    const id = `game-d/${cat}/${base}`;
    n += 1;
    const no = 'art-' + String(n).padStart(2, '0');
    const desc = describe(cat, base);
    rows.push({
      no, desc, kind: meta.kind,
      slot: { entity: `${cat}/${base}`, component: 'Sprite', field: 'textureKey' }, // 代码游戏·art.ts 按 URL 引用（伪槽=art key）
      query: `${meta.zh} ${base}`,
      placeholder: { current: `已交付真手绘图（${servedPath}）`, source: 'authored', count: 1, instances: [`${cat}/${base}`] },
      spec: { w: meta.w, h: meta.h, transparent: meta.transparent },
      context: `game-d《骰途》${meta.zh}·${desc}·art.ts 按 URL 引用（真图在场即用·程序化图元回退）`,
      status: 'replaced', // 真美术已在场
      gen: { provider: 'authored', model: 'Cloud Design（骰途委托）', prompt: null, servedPath, localId: id }, // servedPath → 美术库显示真图
      provenance: { generator: 'game-d-authored', prompt: null, model: 'Cloud Design', mock: false },
      prompt: `${desc}，骰途《Dice & Dungeons》水墨卡通风，${meta.transparent ? '透明背景' : '满幅'}`,
    });
    assets.push({
      id, type: meta.kind === 'bg' ? 'texture' : (meta.kind === 'texture' ? 'texture' : 'texture'),
      status: 'filled', path: servedPath, description: desc,
      category: cat, tags: ['game-d', cat, base], source: 'Cloud Design（骰途委托设计源）', license: 'proprietary',
      provenance: { generator: 'game-d-authored', model: 'Cloud Design', mock: false },
    });
  }
}

mkdirSync(OUT, { recursive: true });
const ledger = { version: 1, game: 'game-d', mode: 'authored-inventory', count: rows.length, instances: rows.length, rows, artStyle: '水墨卡通·骰途《Dice & Dungeons》' };
writeFileSync(join(OUT, 'art-ledger.json'), JSON.stringify(ledger, null, 2) + '\n');
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ version: 1, assets }, null, 2) + '\n');
console.log(`✓ game-d 美术台账：${rows.length} 行（真图在场·status=replaced）→ ${OUT}/art-ledger.json + index.json`);
