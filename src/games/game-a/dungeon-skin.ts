import type { AssetManifest } from '@assets/index.js';
import { ASSET_BG, ASSET_GOAL, ASSET_PLAYER_A, ASSET_PLAYER_B, ASSET_DOOR, ASSET_COIN } from './assets.js';

// ═══════════════════════════════════════════════════════════════
//  Game A · 「地牢皮」—— 把同一份游戏数据换成 DCSS 像素美术（美术整合/替换演示）
// ═══════════════════════════════════════════════════════════════
//
//  宣言落地：sim 只认 textureKey；「换美术」= 注册另一份清单把同样的 key 指到另一组图。
//  本清单复用 assets.ts 里既有的 key（player.a/player.b/goal.flag/bg.sky）→ 蓝图一行不改，
//  注册它即把蓝橙方块人换成精灵/矮人、旗帜换成楼梯（GAME_A_ASSETS = SVG 占位皮，本文件 = DCSS 皮）。
//  另加环境 key（门/金币），蓝图给门和拾取物挂上同名 Sprite，两套皮各自提供其图。
//
//  素材来源：assets/FreeArtLib（Dungeon Crawl Stone Soup 32×32，CC0）。
//  浏览器按 /assets/FreeArtLib/<路径> 静态取图；headless/测试不加载真图（退化占位，逻辑不依赖像素）。
// ═══════════════════════════════════════════════════════════════

const DCSS = '/assets/FreeArtLib/';

// 地牢暗色背景（内联 SVG；DCSS 货架无整幅大背景，故背景仍用矢量数据，与天空皮同 key 不同图）。
const dungeonBg = (): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="400">` +
      `<defs><linearGradient id="d" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="rgb(18,16,24)"/><stop offset="1" stop-color="rgb(34,30,44)"/></linearGradient></defs>` +
      `<rect width="1920" height="400" fill="url(#d)"/>` +
      `<circle cx="300" cy="86" r="30" fill="rgb(120,150,210)" opacity="0.12"/>` +
      `<rect y="330" width="1920" height="70" fill="rgb(12,10,16)" opacity="0.5"/>` +
      `</svg>`,
  )}`;

const tex = (key: string, file: string, w = 32, h = 32) => ({ kind: 'texture' as const, key, src: DCSS + file, width: w, height: h });

// DCSS 皮：同 key 指向像素图（玩家=精灵/矮人，目标=楼梯，门=木门，金币=金堆，背景=地牢）。
export const DUNGEON_SKIN: AssetManifest = [
  tex(ASSET_PLAYER_A, 'player/base/deep_elf_male.png'),
  tex(ASSET_PLAYER_B, 'player/base/deep_dwarf_male.png'),
  tex(ASSET_GOAL, 'dungeon/gateways/branch_stairs.png'),
  tex(ASSET_DOOR, 'dungeon/doors/closed_door.png'),
  tex(ASSET_COIN, 'item/gold/gold_pile.png'),
  { kind: 'texture', key: ASSET_BG, src: dungeonBg(), width: 1920, height: 400 },
];
