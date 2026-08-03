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
  ability_shield: '技能·护盾', ability_bag: '技能·背包', ability_reroll: '技能·重投', ability_fire: '技能·火焰',
};

// ── 生成描述词（owner 07-15「按 game-g 标准统一重写」）：完整英文提示词 + 全账统一风格锚写死尾部
// （成套出图不跑风格）。中文 desc 管「需求是什么」，英文 query 管「怎么让文生图画对」。
const STYLE = 'chinese ink-wash cartoon game art, Dice & Dungeons dungeon crawler, clean bold shapes, soft watercolor shading, unified game art set style';
const EL_EN = {
  huo: 'blazing fire flame', shui: 'rippling blue water wave', mu: 'verdant green leaf sprout',
  lei: 'crackling violet lightning bolt', feng: 'swirling teal wind current', an: 'dark violet shadow orb',
  wild: 'rainbow prismatic wild energy',
};
const EL_TONE = {
  huo: 'warm red-orange palette', shui: 'cool azure palette', mu: 'fresh green palette',
  lei: 'electric violet palette', feng: 'airy teal palette', an: 'deep violet-black palette',
  wild: 'iridescent rainbow palette',
};
const LAYER_EN = {
  cuiting: 'verdant jade garden court with mossy stone and bamboo',
  gudian: 'ancient temple hall with weathered stone pillars and bronze fittings',
  jinding: 'crystal summit with translucent prism crystals and cold ice light',
  rongxin: 'molten core cavern with glowing lava veins and obsidian rock',
};
const CARD_EN = {
  back: 'card back with symmetrical dice-and-rune motif, deep lacquer red and gold ornament',
  baida: 'rainbow wild die radiating prismatic light',
  zengfu: 'die wrapped in an amplifying power aura with rising energy arrows',
  zhuanhua: 'die mid-transmutation with elements morphing around it',
  liansuo: 'two dice linked by a glowing arcane chain',
  rongyan: 'die of cracked obsidian leaking molten lava light',
  shuangzi: 'twin mirrored dice standing side by side',
  shouhu: 'die sheltered behind a radiant guardian shield',
  lengjing: 'die encased in calm frost rime, serene cool light',
  ability_shield: 'radiant protective barrier shield emblem',
  ability_bag: 'adventurer satchel bag overflowing with dice',
  ability_reroll: 'circular reroll arrows spinning around a floating die',
  ability_fire: 'burst of arcane fire erupting from an open palm',
};
function queryOf(cat, base) {
  if (cat === 'element-runes') {
    return `circular arcane rune ring emblem of ${EL_EN[base] || base}, glowing magic circle frame with inscribed glyphs, ${EL_TONE[base] || ''}, centered, transparent background, ${STYLE}`;
  }
  if (cat === 'elements') {
    return `round element orb icon of ${EL_EN[base] || base}, glossy bead with soft inner glow, ${EL_TONE[base] || ''}, centered, transparent background, ${STYLE}`;
  }
  if (cat === 'dice') {
    const [el, pip] = base.split('_');
    if (el === 'wild' || !pip) return `rounded square dice face tile with one large rainbow wild star emblem, iridescent sheen, transparent background, ${STYLE}`;
    return `rounded square dice face tile showing exactly ${pip} pip${pip === '1' ? '' : 's'} in standard die arrangement, each pip drawn as a small ${EL_EN[el] || el} emblem, ${EL_TONE[el] || ''}, transparent background, ${STYLE}`;
  }
  if (cat === 'sky') {
    const [layer, tone] = base.split('_');
    const mood = tone === 'warm' ? 'warm golden ambient light, inviting haze' : 'dim moody twilight, mysterious depth';
    return `wide panoramic dungeon backdrop of ${LAYER_EN[layer] || layer}, ${mood}, distant layered silhouettes, 2:1 wide composition, ${STYLE}`;
  }
  if (cat === 'tiles') {
    const [layer, face] = base.split('_');
    const view = face === 'top' ? 'flat orthographic top-down floor tile'
      : face === 'side' ? 'block side face, straight-on orthographic view'
      : 'dungeon wall surface, straight-on orthographic view';
    return `seamless tileable game texture, ${view}, materials of ${LAYER_EN[layer] || layer}, crisp readable detail, edges tile perfectly, ${STYLE}`;
  }
  if (cat === 'cards') {
    return `loot card face illustration, ${CARD_EN[base] || base}, ornate ink-brush card frame, portrait 5:7 composition, transparent background, ${STYLE}`;
  }
  if (cat === 'fx') {
    return 'soft white radial glow orb, feathered edges fading to full transparency, pure luminance light sprite for additive blending, no outline, no background';
  }
  return `${base}, ${STYLE}`;
}
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
  if (cat === 'element-runes') return `${EL[base] || base} 元素法阵图标（法阵环·UI 在用）`;
  if (cat === 'elements') return `${EL[base] || base} 元素圆珠图标（备用·当前代码未引用）`;
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
      query: queryOf(cat, base), // 完整英文生成词+统一风格锚（owner 07-15 按 game-g 标准重写·文生图直接可用）
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
