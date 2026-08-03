// Game D ·《骰途》骰子 + 六色元素 —— 复刻美术设计案（games/game-d/doc/「骰途 美术设计文案」§7）。
//
// 设计案锁定 **六色元素**（火 / 水 / 木 / 雷 / 风 / 暗）+ 万能（百搭）+ 无（朴）。每色给一套视觉语言（颜色 + cn + emoji）。
// 命运骰盅（屏③）的「骰库」是一份命名骰子 catalog：品种 / 大小 / 六面或八面 / 稀有度星级 / 功能标签 / flavor。
// ⚠️ 原型数据：骰面用于实际掷骰；标签/星级/尺寸驱动骰盅的展示与「骰型」评估。上线版迁数据驱动（M0+主程）。

// ── 六色元素 ───────────────────────────────────────────────────────────────
export type Elem = 'huo' | 'shui' | 'mu' | 'lei' | 'feng' | 'an' | 'none' | 'wild';

/** 元素视觉语言：cn 名 + emoji 圆点 + hex 主色（= 法阵环 / 骰面 / 主题令牌取色）。设计案 §7。 */
export const ELEM_INFO: Record<Elem, { emoji: string; cn: string; hex: string; glyph: string }> = {
  huo: { emoji: '🔴', cn: '火', hex: '#ff5b4d', glyph: '🔥' },
  shui: { emoji: '🔵', cn: '水', hex: '#3ba0ff', glyph: '🌊' },
  mu: { emoji: '🟢', cn: '木', hex: '#46c66a', glyph: '🌿' },
  lei: { emoji: '🟡', cn: '雷', hex: '#ffcf3f', glyph: '⚡' },
  feng: { emoji: '⚪', cn: '风', hex: '#e8edf3', glyph: '🌀' },
  an: { emoji: '🟣', cn: '暗', hex: '#9b6cff', glyph: '🌑' },
  none: { emoji: '⚫', cn: '无', hex: '#8a8298', glyph: '◻' },
  wild: { emoji: '🌈', cn: '万能', hex: '#b07bff', glyph: '✦' },
};
/** 六色元素顺序（= 左侧法阵环自上而下）。 */
export const ELEMS: Elem[] = ['huo', 'shui', 'mu', 'lei', 'feng', 'an'];

// ── 骰子基元 ───────────────────────────────────────────────────────────────
export interface Face { v: number; el: Elem; }
export interface Die { id: string; defId: string; name: string; faces: Face[]; }
export interface RolledDie { dieId: string; v: number; el: Elem; }

const faces = (vals: number[], el: Elem): Face[] => vals.map((v) => ({ v, el }));

export type DieSize = 'small' | 'mid' | 'large';
/** 骰库品种定义（命运骰盅展示 + 掷骰用）。 */
export interface DieDef {
  defId: string; name: string; el: Elem;       // 显示元素（= 卡片描边 / 圆点色）
  size: DieSize; sides: number; rarity: number; // 大小 / 面数 / 星级(1-5)
  tags: string[];                               // 功能标签（万能 / 增幅 / 转化 / 连锁 / 双子 / 守护…）
  group: 'element' | 'function';                // Tab 归类（元素骰 / 功能骰）
  faces: Face[]; ability: string; flavor: string;
}

const SIZE_CN: Record<DieSize, string> = { small: '小型', mid: '中型', large: '大型' };
export const sizeCn = (s: DieSize): string => SIZE_CN[s];

// ── 骰库 catalog（复刻屏③/③b 出现的全部品种）─────────────────────────────────
export const DICE_CATALOG: DieDef[] = [
  // 元素骰：六色，朴实 [1..6]（ability/flavor 复刻原型 DICE 表原文）
  { defId: 'lieyan', name: '烈焰骰', el: 'huo', size: 'mid', sides: 6, rarity: 2, tags: [], group: 'element', faces: faces([1, 2, 3, 4, 5, 6], 'huo'), ability: '最朴素的火元素骰', flavor: '塔底铁匠铺最常见的货色。' },
  { defId: 'hanquan', name: '寒泉骰', el: 'shui', size: 'mid', sides: 6, rarity: 2, tags: [], group: 'element', faces: faces([1, 2, 3, 4, 5, 6], 'shui'), ability: '稳定的水元素来源', flavor: '触手生凉，掷地有回声。' },
  { defId: 'tengman', name: '藤蔓骰', el: 'mu', size: 'mid', sides: 6, rarity: 2, tags: [], group: 'element', faces: faces([1, 2, 3, 4, 5, 6], 'mu'), ability: '稳定的木元素来源', flavor: '骰身缠着会生长的活藤。' },
  { defId: 'jinglei', name: '惊雷骰', el: 'lei', size: 'mid', sides: 6, rarity: 3, tags: [], group: 'element', faces: faces([1, 2, 3, 4, 5, 6], 'lei'), ability: '雷元素 · 偏高点数', flavor: '掷出时噼啪作响。' },
  { defId: 'qingfeng', name: '轻风骰', el: 'feng', size: 'small', sides: 6, rarity: 1, tags: ['小型'], group: 'element', faces: faces([1, 2, 3, 4, 5, 6], 'feng'), ability: '小型 · 消耗低、好凑数', flavor: '轻得几乎吹得走。' },
  { defId: 'youming', name: '幽冥骰', el: 'an', size: 'mid', sides: 6, rarity: 3, tags: [], group: 'element', faces: faces([1, 2, 3, 4, 5, 6], 'an'), ability: '暗元素 · 克制光辉守关者', flavor: '盯久了会盯回来。' },
  // 功能骰
  { defId: 'baida', name: '百搭骰', el: 'wild', size: 'mid', sides: 6, rarity: 5, tags: ['万能'], group: 'function', faces: faces([1, 2, 3, 4, 5, 6], 'wild'), ability: '可充当任意一种元素', flavor: '命运不挑食。凑色万金油。' },
  { defId: 'zengfu', name: '增幅骰', el: 'wild', size: 'large', sides: 6, rarity: 4, tags: ['增幅', '大型'], group: 'function', faces: faces([3, 4, 5, 6, 7, 8], 'wild'), ability: '本轮同色伤害 ×2', flavor: '越赌越大。' },
  { defId: 'zhuanhua', name: '转化骰', el: 'wild', size: 'mid', sides: 6, rarity: 4, tags: ['转化'], group: 'function', faces: faces([1, 2, 3, 4, 5, 6], 'wild'), ability: '掷出后改写一颗骰的元素', flavor: '把坏运气拧成好运气。' },
  { defId: 'liansuo', name: '连锁骰', el: 'lei', size: 'mid', sides: 8, rarity: 4, tags: ['连锁', '八面'], group: 'function', faces: faces([1, 2, 3, 4, 5, 6, 7, 8], 'lei'), ability: '命中后连锁相邻同色', flavor: '一发入魂，魂魂相连。' },
  { defId: 'rongyan', name: '熔岩重骰', el: 'huo', size: 'large', sides: 6, rarity: 4, tags: ['火', '大型'], group: 'function', faces: faces([4, 5, 6, 7, 8, 9], 'huo'), ability: '大型 · 点数翻倍，但占两格', flavor: '沉得能砸穿地台。' },
  { defId: 'shuangzi', name: '双子风骰', el: 'feng', size: 'small', sides: 6, rarity: 3, tags: ['双子'], group: 'function', faces: faces([1, 1, 2, 2, 3, 3], 'feng'), ability: '一次投出两颗', flavor: '形影不离的一对。' },
  { defId: 'shouhu', name: '守护骰', el: 'shui', size: 'mid', sides: 6, rarity: 3, tags: ['守护'], group: 'function', faces: faces([2, 3, 3, 4, 4, 5], 'shui'), ability: '掷出护盾，抵挡一次反击', flavor: '最好的进攻是不被打。' },
  { defId: 'lengjing', name: '棱晶骰', el: 'an', size: 'mid', sides: 8, rarity: 5, tags: ['暗', '八面'], group: 'function', faces: faces([1, 2, 3, 4, 5, 6, 7, 8], 'an'), ability: '八面 · 上限更高', flavor: '晶顶的馈赠，棱角分明。' },
];

export const DEF_BY_ID = new Map(DICE_CATALOG.map((d) => [d.defId, d]));

let dieSeq = 0;
/** 由 catalog 品种实例化一颗可掷骰子（带唯一 id）。 */
export function makeDie(defId: string): Die {
  const def = DEF_BY_ID.get(defId)!;
  return { id: `d${dieSeq++}`, defId, name: def.name, faces: def.faces };
}
export const dieDef = (d: Die): DieDef => DEF_BY_ID.get(d.defId)!;

export function rollPool(pool: Die[], rnd: () => number): RolledDie[] {
  return pool.map((d) => { const f = d.faces[Math.floor(rnd() * d.faces.length)]!; return { dieId: d.id, v: f.v, el: f.el }; });
}

/** 起手骰库（玩家拥有的全部骰子·命运骰盅里可选）。复刻屏③出现的品种。 */
export function startLibrary(): Die[] {
  return ['lieyan', 'hanquan', 'tengman', 'jinglei', 'qingfeng', 'youming', 'baida', 'zengfu', 'zhuanhua', 'liansuo', 'rongyan', 'shuangzi', 'shouhu', 'lengjing'].map(makeDie);
}
