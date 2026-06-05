import type { AssetManifest } from '@assets/index.js';

// Game A 美术资产清单 —— 纯数据（声明 key → 图源）。sim 只引用 textureKey，像素活在资产层。
// 这里用内联 SVG data-URI 当占位美术（无外部文件即可验证数据驱动管线）；真美术经资产管理器/
// provider（docs/design/asset-manifest-and-manager.md）填进同样的 key，游戏数据/逻辑一行不改。
const svg = (body: string, w: number, h: number): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`,
  )}`;

export const ASSET_BG = 'bg.sky';
export const ASSET_GOAL = 'goal.flag';
export const ASSET_PLAYER_A = 'player.a';
export const ASSET_PLAYER_B = 'player.b';

export const GAME_A_ASSETS: AssetManifest = [
  {
    kind: 'texture',
    key: ASSET_BG,
    src: svg(
      `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="rgb(30,41,75)"/><stop offset="1" stop-color="rgb(56,72,108)"/></linearGradient></defs>` +
        `<rect width="1920" height="400" fill="url(#s)"/>` +
        `<circle cx="300" cy="90" r="38" fill="rgb(248,250,180)" opacity="0.45"/>` +
        `<path d="M0 360 Q 480 285 960 350 T 1920 342 V400 H0 Z" fill="rgb(40,54,86)" opacity="0.6"/>`,
      1920,
      400,
    ),
    width: 1920,
    height: 400,
  },
  {
    kind: 'texture',
    key: ASSET_GOAL,
    src: svg(
      `<rect x="9" y="0" width="6" height="120" fill="rgb(203,213,225)"/>` +
        `<path d="M15 6 L72 24 L15 42 Z" fill="rgb(74,222,128)"/>`,
      80,
      120,
    ),
    width: 80,
    height: 120,
  },
  {
    kind: 'texture',
    key: ASSET_PLAYER_A,
    src: svg(
      `<rect x="1" y="1" width="28" height="28" rx="8" fill="rgb(59,130,246)"/>` +
        `<circle cx="10" cy="12" r="4" fill="white"/><circle cx="20" cy="12" r="4" fill="white"/>` +
        `<circle cx="11" cy="13" r="2" fill="rgb(20,30,60)"/><circle cx="21" cy="13" r="2" fill="rgb(20,30,60)"/>`,
      30,
      30,
    ),
    width: 30,
    height: 30,
  },
  {
    kind: 'texture',
    key: ASSET_PLAYER_B,
    src: svg(
      `<rect x="1" y="1" width="28" height="28" rx="8" fill="rgb(251,146,60)"/>` +
        `<circle cx="10" cy="12" r="4" fill="white"/><circle cx="20" cy="12" r="4" fill="white"/>` +
        `<circle cx="11" cy="13" r="2" fill="rgb(80,40,10)"/><circle cx="21" cy="13" r="2" fill="rgb(80,40,10)"/>`,
      30,
      30,
    ),
    width: 30,
    height: 30,
  },
];
