import type { AssetManifest } from '@assets/index.js';

// Game F 美术资产清单（R9 TBF）—— 纯数据（声明 key → 占位图）。sim 只引用 textureKey，像素活在资产层、不进 hash。
// 占位 = 内联 SVG 势力色棋子 token（无外部文件即可验证数据驱动管线 + 真穿皮）；真美术走 DCSS 换皮
// （见 docs/game-design/game-f-art-data.md：每个英雄 key → 一张 FreeArtLib DCSS sprite.character，逻辑零改穿皮）。
const svg = (body: string, w: number, h: number): string =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`)}`;

// 一个棋子 token：势力色圆角身 + 眼 + 职业字形 + 右侧朝向亮条（facing 翻转可读）。
const svgUnit = (fill: string, stroke: string, glyph: string): string =>
  svg(
    `<rect x="3" y="3" width="18" height="18" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>` +
      `<circle cx="9" cy="10" r="1.8" fill="#fff"/><circle cx="15" cy="10" r="1.8" fill="#fff"/>` +
      glyph +
      `<rect x="19" y="9" width="2.2" height="6" rx="1" fill="${stroke}"/>`,
    24,
    24,
  );

const GLYPH_WARRIOR = `<rect x="11" y="14" width="2" height="5" fill="#fbbf24"/>`; // 武将=剑条
const GLYPH_TACTICIAN = `<circle cx="12" cy="16" r="2" fill="#c4b5fd"/>`; // 谋士=法球
const GLYPH_ASSASSIN = `<path d="M10 14 L14 14 L12 19 Z" fill="#fca5a5"/>`; // 刺客=匕首

// 势力色（占位）。
const SHU = { fill: 'rgb(176,42,40)', stroke: 'rgb(255,150,130)' }; // 蜀·红
const WEI = { fill: 'rgb(41,98,200)', stroke: 'rgb(150,190,255)' }; // 魏·蓝
const WU = { fill: 'rgb(30,140,90)', stroke: 'rgb(130,235,180)' }; // 吴·绿

// 英雄 textureKey（每英雄唯一 → 后期 1:1 换 DCSS 皮，见 art-data.md）。
export const F_HERO = {
  guan_yu: 'f.hero.guan_yu',
  zhao_yun: 'f.hero.zhao_yun',
  zhuge_liang: 'f.hero.zhuge_liang',
  zhang_liao: 'f.hero.zhang_liao',
  xu_chu: 'f.hero.xu_chu',
  sima_yi: 'f.hero.sima_yi',
  zhou_yu: 'f.hero.zhou_yu',
  gan_ning: 'f.hero.gan_ning',
} as const;
export const F_FX_STRIKE = 'f.fx.strike';
export const F_HEX_WARM = 'f.hex.warm'; // 蜀半场暖色六边形格
export const F_HEX_COOL = 'f.hex.cool'; // 魏半场冷色六边形格

// 一块六边形棋盘格（pointy-top 尖顶，描边镂空；落在格中心、zOrder 最低=棋子之下）。
const hexTile = (fill: string, stroke: string): string =>
  svg(`<polygon points="25,3 47,16 47,42 25,55 3,42 3,16" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`, 50, 58);

export const GAME_F_ASSETS: AssetManifest = [
  { kind: 'texture', key: F_HERO.guan_yu, src: svgUnit(SHU.fill, SHU.stroke, GLYPH_WARRIOR), width: 24, height: 24 },
  { kind: 'texture', key: F_HERO.zhao_yun, src: svgUnit(SHU.fill, SHU.stroke, GLYPH_WARRIOR), width: 24, height: 24 },
  { kind: 'texture', key: F_HERO.zhuge_liang, src: svgUnit(SHU.fill, SHU.stroke, GLYPH_TACTICIAN), width: 24, height: 24 },
  { kind: 'texture', key: F_HERO.zhang_liao, src: svgUnit(WEI.fill, WEI.stroke, GLYPH_WARRIOR), width: 24, height: 24 },
  { kind: 'texture', key: F_HERO.xu_chu, src: svgUnit(WEI.fill, WEI.stroke, GLYPH_WARRIOR), width: 24, height: 24 },
  { kind: 'texture', key: F_HERO.sima_yi, src: svgUnit(WEI.fill, WEI.stroke, GLYPH_TACTICIAN), width: 24, height: 24 },
  { kind: 'texture', key: F_HERO.zhou_yu, src: svgUnit(WU.fill, WU.stroke, GLYPH_TACTICIAN), width: 24, height: 24 },
  { kind: 'texture', key: F_HERO.gan_ning, src: svgUnit(WU.fill, WU.stroke, GLYPH_ASSASSIN), width: 24, height: 24 },
  // 普攻打击特效：黄白斩光。
  {
    kind: 'texture',
    key: F_FX_STRIKE,
    src: svg(
      `<path d="M4 19 L20 5" stroke="rgba(255,240,180,0.95)" stroke-width="3" fill="none" stroke-linecap="round"/>` +
        `<path d="M8 20 L21 9" stroke="rgba(255,200,90,0.65)" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      24,
      24,
    ),
    width: 24,
    height: 24,
  },
  // 六边形棋盘格（蜀半场暖 / 魏半场冷）。
  { kind: 'texture', key: F_HEX_WARM, src: hexTile('rgba(48,32,24,0.92)', 'rgb(128,74,58)'), width: 50, height: 58 },
  { kind: 'texture', key: F_HEX_COOL, src: hexTile('rgba(24,32,48,0.92)', 'rgb(64,92,140)'), width: 50, height: 58 },
];
