import type { AssetManifest } from '@assets/index.js';

// Game D 美术资产清单（R9）—— 纯数据（声明 key → 图源）。sim 只引用 textureKey，像素活在资产层、不进 hash。
// 这里用内联 SVG data-URI 当占位美术（无外部文件即可验证数据驱动管线 + 真实穿皮）；真美术（序列帧/3D 预渲染）
// 经资产管理器/provider 填进同样的 key，游戏数据/逻辑一行不改（asset-flow.md 的 ④ 填充）。
const svg = (body: string, w: number, h: number): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`,
  )}`;

export const ASSET_HERO = 'd.hero';
export const ASSET_ENEMY = 'd.enemy';
export const ASSET_LOOT = 'd.loot';
export const ASSET_NOVA = 'd.skill.nova';
export const ASSET_SMASH = 'd.skill.smash';
export const ASSET_FLAME = 'd.skill.flame';
// 图块集（tileset）：横向 4 格条带，每格 32px → tile 1 地板 / 2 墙 / 3 火把 / 4 地裂。
export const ASSET_TILES = 'd.tiles';

export const GAME_D_ASSETS: AssetManifest = [
  // 英雄：蓝甲骑士占位。
  {
    kind: 'texture',
    key: ASSET_HERO,
    src: svg(
      `<rect x="2" y="2" width="20" height="20" rx="6" fill="rgb(56,120,230)" stroke="rgb(180,210,255)" stroke-width="1.5"/>` +
        `<circle cx="9" cy="10" r="2.4" fill="white"/><circle cx="15" cy="10" r="2.4" fill="white"/>` +
        `<rect x="8" y="15" width="8" height="2.5" rx="1" fill="rgb(180,210,255)"/>`,
      24,
      24,
    ),
    width: 24,
    height: 24,
  },
  // 敌人：红魔占位（带角）。
  {
    kind: 'texture',
    key: ASSET_ENEMY,
    src: svg(
      `<path d="M4 6 L7 1 L9 6 Z" fill="rgb(120,20,20)"/><path d="M20 6 L17 1 L15 6 Z" fill="rgb(120,20,20)"/>` +
        `<rect x="3" y="4" width="18" height="18" rx="5" fill="rgb(210,55,55)" stroke="rgb(120,20,20)" stroke-width="1.5"/>` +
        `<circle cx="9" cy="11" r="2.2" fill="rgb(255,230,120)"/><circle cx="15" cy="11" r="2.2" fill="rgb(255,230,120)"/>` +
        `<path d="M8 16 Q12 19 16 16" stroke="rgb(90,10,10)" stroke-width="1.6" fill="none"/>`,
      24,
      24,
    ),
    width: 24,
    height: 24,
  },
  // 掉落：金币。
  {
    kind: 'texture',
    key: ASSET_LOOT,
    src: svg(
      `<circle cx="7" cy="7" r="6" fill="rgb(255,204,0)" stroke="rgb(180,130,0)" stroke-width="1.2"/>` +
        `<text x="7" y="10" font-size="8" text-anchor="middle" fill="rgb(150,100,0)" font-family="serif">$</text>`,
      14,
      14,
    ),
    width: 14,
    height: 14,
  },
  // 冰霜新星：青色冰环。
  {
    kind: 'texture',
    key: ASSET_NOVA,
    src: svg(
      `<circle cx="30" cy="30" r="28" fill="rgba(120,200,255,0.18)" stroke="rgba(150,220,255,0.85)" stroke-width="3"/>` +
        `<circle cx="30" cy="30" r="16" fill="none" stroke="rgba(200,240,255,0.6)" stroke-width="2"/>`,
      60,
      60,
    ),
    width: 60,
    height: 60,
  },
  // 碎冰重锤：白蓝冲击。
  {
    kind: 'texture',
    key: ASSET_SMASH,
    src: svg(
      `<circle cx="60" cy="60" r="56" fill="rgba(200,230,255,0.12)" stroke="rgba(180,220,255,0.5)" stroke-width="2"/>` +
        `<path d="M60 10 L70 55 L115 60 L70 65 L60 110 L50 65 L5 60 L50 55 Z" fill="rgba(220,245,255,0.55)"/>`,
      120,
      120,
    ),
    width: 120,
    height: 120,
  },
  // 烈焰：橙红火。
  {
    kind: 'texture',
    key: ASSET_FLAME,
    src: svg(
      `<circle cx="40" cy="40" r="38" fill="rgba(255,120,40,0.16)" stroke="rgba(255,160,60,0.7)" stroke-width="2"/>` +
        `<path d="M40 8 Q56 34 40 50 Q24 34 40 8 Z" fill="rgba(255,170,50,0.7)"/>` +
        `<path d="M40 22 Q50 40 40 52 Q30 40 40 22 Z" fill="rgba(255,230,120,0.8)"/>`,
      80,
      80,
    ),
    width: 80,
    height: 80,
  },
  // 图块集 128×32：tile1 地板(石) / tile2 墙(暗砖) / tile3 火把(墙+火) / tile4 地裂。
  {
    kind: 'texture',
    key: ASSET_TILES,
    src: svg(
      // tile1 地板 (0-32)
      `<rect x="0" y="0" width="32" height="32" fill="#34343e"/>` +
        `<path d="M0 16 H32 M16 0 V32" stroke="#2b2b34" stroke-width="1"/>` +
        // tile2 墙 (32-64)
        `<rect x="32" y="0" width="32" height="32" fill="#1f1f28"/>` +
        `<path d="M32 11 H64 M32 22 H64 M48 0 V11 M40 11 V22 M56 11 V22 M48 22 V32" stroke="#15151c" stroke-width="1.5"/>` +
        // tile3 火把 (64-96)：墙底 + 火把杆 + 火苗
        `<rect x="64" y="0" width="32" height="32" fill="#1f1f28"/>` +
        `<rect x="79" y="16" width="2" height="12" fill="#5a4326"/>` +
        `<path d="M80 6 Q87 15 80 20 Q73 15 80 6 Z" fill="#ff9a32"/><path d="M80 10 Q84 16 80 20 Q76 16 80 10 Z" fill="#ffe07a"/>` +
        // tile4 地裂 (96-128)
        `<rect x="96" y="0" width="32" height="32" fill="#34343e"/>` +
        `<path d="M100 4 L112 14 L108 20 L120 28" stroke="#22222a" stroke-width="1.5" fill="none"/>`,
      128,
      32,
    ),
    width: 128,
    height: 32,
  },
];
