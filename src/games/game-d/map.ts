import type { Tilemap } from '@engine/protocol/components.js';
import { ASSET_TILES } from './assets.js';

// 第一张地牢房（一份 Tilemap = 一个房间 = Hades 拼接的积木）。纯数据：二维数组 + tileset assetKey。
// 真制作走 Tiled/LDtk 导出 JSON（纯数据）；此处用小 builder 生成房间数据（输出仍是纯数据 Tilemap）。
export const MAP_COLS = 30;
export const MAP_ROWS = 20;
export const MAP_TILE = 32;

const TILE_FLOOR = 1;
const TILE_WALL = 2;
const TILE_TORCH = 3;
const TILE_CRACK = 4;

// 居中放在世界原点（hero 在房中央）。瓦片 (c,r) 左上角 = (originX + c*tile, originY + r*tile)。
export function buildDungeonRoom(): Omit<Tilemap, 'type'> {
  const n = MAP_COLS * MAP_ROWS;
  const floor = new Array<number>(n).fill(TILE_FLOOR);
  const walls = new Array<number>(n).fill(0);
  const deco = new Array<number>(n).fill(0);

  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (c === 0 || c === MAP_COLS - 1 || r === 0 || r === MAP_ROWS - 1) walls[r * MAP_COLS + c] = TILE_WALL;
    }
  }
  // 上墙内侧每隔几格一支火把（氛围）。
  for (let c = 3; c < MAP_COLS - 1; c += 6) deco[1 * MAP_COLS + c] = TILE_TORCH;
  // 地面几道固定裂缝（确定性，不随机）。
  for (const [c, r] of [
    [6, 5],
    [22, 7],
    [12, 14],
    [18, 4],
    [9, 16],
  ] as const) {
    deco[r * MAP_COLS + c] = TILE_CRACK;
  }

  return {
    cols: MAP_COLS,
    rows: MAP_ROWS,
    tileSize: MAP_TILE,
    originX: -(MAP_COLS * MAP_TILE) / 2,
    originY: -(MAP_ROWS * MAP_TILE) / 2,
    layers: [
      { name: 'floor', data: floor, collides: false, tileset: ASSET_TILES },
      { name: 'walls', data: walls, collides: true, tileset: ASSET_TILES },
      { name: 'decoration', data: deco, collides: false, tileset: ASSET_TILES },
    ],
  };
}
