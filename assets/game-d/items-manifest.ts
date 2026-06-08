import type { AssetManifest } from '../../src/assets/asset-types.js';

// ─────────────────────────────────────────────
//  Game D 物品精灵表 manifest
//  图像放置路径：assets/game-d/items.png
//  每帧 32×32，20 列；帧号 = row*20 + col（0-based）。
//  完整帧索引目录见同目录 items-catalog.json。
// ─────────────────────────────────────────────
export const GAME_D_ITEMS_MANIFEST: AssetManifest = [
  {
    kind: 'sprite-sheet',
    key: 'gd.items',
    src: 'game-d/items.png',
    frameWidth: 32,
    frameHeight: 32,
    columns: 20,
    count: 1040,
  },
] as const;

// 语义快查表：item key → frame index（常用条目）。
// 完整列表见 items-catalog.json → items[*].frame。
export const ITEM_FRAMES: Record<string, number> = {
  // 技能 / 特效图标
  'crystal.ice':    130,
  'orb.ice':        943,
  'wand.ice':       670,
  'hammer.war':     500,
  'axe.great':      450,

  // 药水
  'potion.hp.red':  0,
  'potion.hp.large':1,
  'potion.mp.blue': 5,
  'potion.green':   10,

  // 宝石
  'gem.ruby':       120,
  'gem.sapphire':   122,
  'gem.emerald':    124,
  'gem.diamond':    128,

  // 货币
  'coin.gold':      240,
  'coin.silver':    241,

  // 掉落容器
  'chest.wood':     980,
  'bag.loot':       986,
};
