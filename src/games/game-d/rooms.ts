// Game D ·《骰途》场景骨架 —— 一关一关往前推的 3D 房间走廊（纯数据·零专属 system）。
//
// owner 2026-06-29「先搭场景骨架·战斗先别管·一关一关往前流程·3D 要有点美术艺术感」。
// 每个房间 = 一组贴色体素（Mesh3D box·顶/侧分色）沿 +Z 排开，房间间以拱门 + 窄走廊相连，读作一条
// 「向深处推进」的地牢走廊。一个 ortho 45° 等距相机沿 +Z 前推取景（game-d.ts 输入胶水推 pivotZ·render-only）。
// 美术不走「裸方块」：复用现有精装管线——暖白主光 + 冷蓝补光（Light3D）、移轴景深 + 泛光（Post3D·微缩模型
// 感 + 让 accent 自发光）、程序化天空盒（Sky3D）、柔和接触软影。换一组色板/摆位即换一个房间，零手写 Three.js。
//
// ⚠️ 全 render-only（Transform3D/Mesh3D/Camera3D/Light3D/Post3D/Sky3D/Model3D·出 hash）；静态场景无 capability。
// 战斗/骰子/敌人 = 后续接入（见 docs/design/game-d-combat-design.md）。

import type { WorldBlueprint } from '../../assembly/demo.assembly.js';
import { MODEL_DUCK } from './assets.js';

type Ent = WorldBlueprint['entities'][string];

/** 房间沿 +Z 的间距（房间地台 depth 30 + 走廊 ~6）。 */
export const ROOM_SPACING = 36;

export interface RoomDef {
  id: string;
  name: string;
  floorTop: number; // 地台顶面色
  floorSide: number; // 地台侧/暗面色
  wall: number; // 柱/拱/装饰主色
  accent: number; // 中心宝物/拱顶高光色（亮色·被 bloom 自发光）
}

/** 四个色板各异的房间（先 4 关·后续数据加房间即扩关）。 */
export const ROOMS: RoomDef[] = [
  { id: 'grass', name: '草庭', floorTop: 0x8bc34a, floorSide: 0x5d4037, wall: 0x9ccc65, accent: 0xffd54f },
  { id: 'stone', name: '石殿', floorTop: 0xb0bec5, floorSide: 0x546e7a, wall: 0x90a4ae, accent: 0x4dd0e1 },
  { id: 'ember', name: '熔岩窟', floorTop: 0x6d4c41, floorSide: 0x3e2723, wall: 0x8d6e63, accent: 0xff7043 },
  { id: 'crystal', name: '水晶厅', floorTop: 0x4dd0e1, floorSide: 0x00838f, wall: 0x26c6da, accent: 0xb39ddb },
];

/** 一个体块：中心位姿 + 尺寸 + 顶/侧色。rotY 可选（斜摆宝物）。盒中心 y=高度/2 时下沿坐地（地台顶在 y=0）。 */
function block(x: number, y: number, z: number, w: number, h: number, d: number, top: number, side: number, rotY?: number): Ent {
  return {
    Transform3D: { x, y, z, ...(rotY !== undefined ? { rotY } : {}) },
    Mesh3D: { shape: 'box', width: w, height: h, depth: d, frontTint: side, backTint: side, edgeTint: top },
  };
}

/** 把一个房间的体素摆进记录（id 以房间 id 为前缀·跨房间唯一）。baseZ = 房间中心的 Z。 */
function buildRoom(r: RoomDef, baseZ: number): Record<string, Ent> {
  const P = r.id;
  return {
    // 地台（顶在 y=0·26×30 的厚板）
    [`${P}-floor`]: block(0, -2, baseZ, 26, 4, 30, r.floorTop, r.floorSide),
    // 后排两根高柱（剪影骨架）
    [`${P}-pillar-l`]: block(-10, 5, baseZ - 11, 3, 14, 3, r.wall, r.floorSide),
    [`${P}-pillar-r`]: block(10, 5, baseZ - 11, 3, 14, 3, r.wall, r.floorSide),
    // 通往下一房间的拱门（两柱 + 横梁·在 +Z 端·把走廊读成"门接门"）
    [`${P}-arch-l`]: block(-7, 4, baseZ + 14, 2.5, 12, 2.5, r.wall, r.floorSide),
    [`${P}-arch-r`]: block(7, 4, baseZ + 14, 2.5, 12, 2.5, r.wall, r.floorSide),
    [`${P}-arch-top`]: block(0, 11, baseZ + 14, 19, 3, 2.5, r.accent, r.wall),
    // 中央台座 + 斜摆发光宝物（bloom 让 accent 自发光·房间焦点）
    [`${P}-dais`]: block(0, 0.5, baseZ, 8, 1, 8, r.wall, r.floorSide),
    [`${P}-gem`]: block(0, 3, baseZ, 3, 3, 3, r.accent, r.accent, 0.6),
    // 高低错落的侧边装饰（破直线·加层次）
    [`${P}-deco-1`]: block(-9, 1, baseZ + 5, 3, 2, 3, r.wall, r.floorSide),
    [`${P}-deco-2`]: block(9, 2, baseZ - 4, 3, 4, 3, r.wall, r.floorSide),
  };
}

/** 骰途地牢场景骨架蓝图：N 个房间沿 +Z 串成走廊 + ortho 45° 前推相机 + 精装光照/后处理/天空盒。 */
export function dungeonBlueprint(): WorldBlueprint {
  const entities: Record<string, Ent> = {};

  ROOMS.forEach((r, i) => {
    Object.assign(entities, buildRoom(r, i * ROOM_SPACING));
    // 房间之间的窄走廊（连出"一条路通到底"的连续感）
    if (i < ROOMS.length - 1) {
      entities[`corridor-${i}`] = block(0, -2, i * ROOM_SPACING + ROOM_SPACING / 2, 8, 4, ROOM_SPACING - 30, r.floorTop, r.floorSide);
    }
  });

  // showcase 模型（证明导入能力·非体素）：草庭里站一只小黄鸭。
  entities['duck'] = { Transform3D: { x: 7, y: 0.5, z: 4, rotY: -2.2, scale: 3.0 }, Model3D: { modelKey: MODEL_DUCK } };

  // 相机：固定 45° 等距（ortho）·沿走廊前推（pivotZ 由 game-d.ts 平滑推进·render-only·不进 hash）。
  entities['cam'] = {
    Camera3D: { yaw: 0.785, pitch: 0.62, projection: 'ortho', orthoSize: 17, distance: 150, near: 1, far: 600, pivotX: 0, pivotY: 4, pivotZ: 0 },
  };

  // 数据化光照（暖白主光投软影 + 冷蓝环境补光）。
  entities['sun'] = { Light3D: { kind: 'directional', color: 0xfff1d6, intensity: 1.7, dirX: -0.5, dirY: -1, dirZ: -0.35, castShadow: true } };
  entities['fill'] = { Light3D: { kind: 'ambient', color: 0xbcd2ff, intensity: 0.5 } };

  // 后处理：移轴景深（微缩模型感）+ 泛光（让 accent 宝物/拱顶自发光）。
  entities['post'] = { Post3D: { tiltShift: { focus: 0.56, intensity: 2.6 }, bloom: { strength: 0.5, radius: 0.6, threshold: 0.75 } } };

  // 天空盒：暮色蓝渐变 + 缓飘云（给走廊一个氛围底）。
  entities['sky'] = { Sky3D: { top: 0x22305e, bottom: 0x6f83b4, clouds: true, cloudTint: 0xc7d4f0, scroll: 0.6 } };

  return { capabilities: [], entities };
}
