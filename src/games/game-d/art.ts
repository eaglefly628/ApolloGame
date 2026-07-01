// Game D ·《骰途》手绘美术资产索引 —— Cloud Design 上传（public/art/game-d/·vite 服 public·root 绝对 URL）。
// 程序化贴图（dieFaceTex/topTex/glowSprite）作**回退**；这些真手绘图在场即换皮（数据驱动·零改解释器）。
import type { Elem } from './dice.js';

// 元素 → 资产 key（none/wild 无专属图 → 借色近似：none→火、wild→暗紫）。
const ELEM_KEY: Record<Elem, string> = { huo: 'huo', shui: 'shui', mu: 'mu', lei: 'lei', feng: 'feng', an: 'an', none: 'huo', wild: 'an' };
const LAYER_KEY = ['cuiting', 'gudian', 'rongxin', 'jinding']; // 翠庭/古殿/熔心/晶顶

/** 元素徽章（法阵环 · 圆形符文）。 */
export const elementBadge = (el: Elem): string => `/art/game-d/elements/${ELEM_KEY[el]}.png`;
/** 骰面图（元素色 + 点数 pip·256²·骰库/骰组/3D 骰面共用）。 */
export const diceFaceArt = (el: Elem, pip: number): string => `/art/game-d/dice/${ELEM_KEY[el]}_${Math.max(1, Math.min(6, Math.round(pip)))}.png`;
/** 体素贴图（层主题 × 顶面/侧面/墙体·256² 无缝）。 */
export const tileArt = (act: number, face: 'top' | 'side' | 'wall'): string => `/art/game-d/tiles/${LAYER_KEY[act % 4]}_${face}.png`;
/** 战利品卡面（420×588·仅特制骰/能力有图）。 */
export const lootCardArt = (key: string): string => `/art/game-d/cards/${key}.png`;
export const CARD_BACK = '/art/game-d/cards/back.png';
/** 有卡面的战利品 defId（无卡面的基础元素骰不进战利品池）。 */
export const CARDED_DEFIDS = ['baida', 'zengfu', 'zhuanhua', 'liansuo', 'rongyan', 'shuangzi', 'shouhu', 'lengjing'];
