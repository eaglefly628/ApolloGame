import type { AssetManifest } from '@assets/index.js';

// Game F 美术资产清单（R9 TBF）—— 纯数据（声明 key → 占位图）。sim 只引用 textureKey，像素活在资产层、不进 hash。
// 占位 = 内联 SVG 势力色棋子 token（无外部文件即可验证数据驱动管线 + 真穿皮）；真美术走 DCSS 换皮
// （见 docs/game-design/game-f-art-data.md：每个英雄 key → 一张 FreeArtLib DCSS sprite.character，逻辑零改穿皮）。
const svg = (body: string, w: number, h: number): string =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`)}`;

// 英雄皮 = 真 DCSS 角色图（assets/FreeArtLib/monster/<name>.png，32×32，CC0；同 game-e 路径加载）。
// 注：DCSS 是奇幻角色图、固定色；势力(蜀魏吴)由头顶名字颜色 + 棋盘半场体现（drawImage 不吃 tint，见 art-data.md §C）。
const dcss = (name: string): string => `assets/FreeArtLib/monster/${name}.png`;

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

// 一块六边形棋盘格（pointy-top 尖顶，描边镂空；尺寸 36×42 贴合格距 TILE=36/行距27，不重叠）。
const hexTile = (fill: string, stroke: string): string =>
  svg(`<polygon points="18,1 35,11 35,31 18,41 1,31 1,11" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`, 36, 42);

export const GAME_F_ASSETS: AssetManifest = [
  // 蜀（关羽 死亡骑士 / 赵云 深渊精灵骑士 / 诸葛 深渊精灵法师）
  { kind: 'texture', key: F_HERO.guan_yu, src: dcss('death_knight'), width: 32, height: 32 },
  { kind: 'texture', key: F_HERO.zhao_yun, src: dcss('deep_elf_knight_new'), width: 32, height: 32 },
  { kind: 'texture', key: F_HERO.zhuge_liang, src: dcss('deep_elf_mage'), width: 32, height: 32 },
  // 魏（张辽 地狱骑士 / 许褚 深渊精灵兵 / 司马 死灵法师）
  { kind: 'texture', key: F_HERO.zhang_liao, src: dcss('hell_knight_new'), width: 32, height: 32 },
  { kind: 'texture', key: F_HERO.xu_chu, src: dcss('deep_elf_soldier'), width: 32, height: 32 },
  { kind: 'texture', key: F_HERO.sima_yi, src: dcss('necromancer_new'), width: 32, height: 32 },
  // 吴（周瑜 娜迦法师 / 甘宁 娜迦武士）
  { kind: 'texture', key: F_HERO.zhou_yu, src: dcss('naga_mage'), width: 32, height: 32 },
  { kind: 'texture', key: F_HERO.gan_ning, src: dcss('naga_warrior'), width: 32, height: 32 },
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
  { kind: 'texture', key: F_HEX_WARM, src: hexTile('rgba(48,32,24,0.92)', 'rgb(128,74,58)'), width: 36, height: 42 },
  { kind: 'texture', key: F_HEX_COOL, src: hexTile('rgba(24,32,48,0.92)', 'rgb(64,92,140)'), width: 36, height: 42 },
];
