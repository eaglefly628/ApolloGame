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

/** 竞技场半尺寸（一间战场的地台 = 2*HW 宽 × 2*HD 深；近俯视下一屏框住一间·两侧留 UI）。 */
const HW = 13; // 半宽
const HD = 14; // 半深

/**
 * 把一个房间摆成一座**独立竞技场**（参照《弓箭传说》/《哈迪斯》·一屏一间）：低矮围墙框住地台、
 * 前墙留中央门洞通向下一间（往上走）、中心发光焦点 + 散落的"类型色块"占位美术素材（未来换贴图）。
 * id 以房间 id 为前缀·跨房间唯一。baseZ = 房间中心 Z。
 */
function buildRoom(r: RoomDef, baseZ: number): Record<string, Ent> {
  const P = r.id;
  return {
    // 竞技场地台（顶在 y=0）
    [`${P}-floor`]: block(0, -2, baseZ, HW * 2, 4, HD * 2, r.floorTop, r.floorSide),
    // 低矮围墙框住竞技场（俯视读作"一间房"）：左 / 右 / 后（入口侧）三面
    [`${P}-wall-l`]: block(-HW, 1.5, baseZ, 1.5, 5, HD * 2, r.wall, r.floorSide),
    [`${P}-wall-r`]: block(HW, 1.5, baseZ, 1.5, 5, HD * 2, r.wall, r.floorSide),
    [`${P}-wall-back`]: block(0, 1.5, baseZ - HD, HW * 2, 5, 1.5, r.wall, r.floorSide),
    // 前墙（+Z 端）留中央门洞——通向下一间（发光门楣）
    [`${P}-wall-fl`]: block(-8.5, 1.5, baseZ + HD, 8, 5, 1.5, r.wall, r.floorSide),
    [`${P}-wall-fr`]: block(8.5, 1.5, baseZ + HD, 8, 5, 1.5, r.wall, r.floorSide),
    [`${P}-door-top`]: block(0, 5.5, baseZ + HD, 9, 2, 1.5, r.accent, r.wall),
    // 中心焦点：台座 + 斜摆发光宝物（bloom 让 accent 自发光）
    [`${P}-dais`]: block(0, 0.5, baseZ, 7, 1, 7, r.wall, r.floorSide),
    [`${P}-gem`]: block(0, 2.8, baseZ, 2.6, 2.6, 2.6, r.accent, r.accent, 0.6),
    // "类型色块"占位美术素材（未来换精美贴图）：几块低矮色块散在场上，靠颜色区分类型。
    [`${P}-t1`]: block(-7, 0.5, baseZ - 6, 2.4, 1, 2.4, r.accent, r.floorSide),
    [`${P}-t2`]: block(7.5, 0.5, baseZ + 5, 2.4, 1, 2.4, r.wall, r.floorSide),
    [`${P}-t3`]: block(-6, 0.5, baseZ + 7, 2, 1, 2, r.accent, r.floorSide),
  };
}

/** 骰途地牢场景骨架蓝图：N 个房间沿 +Z 串成走廊 + ortho 45° 前推相机 + 精装光照/后处理/天空盒。 */
export function dungeonBlueprint(): WorldBlueprint {
  const entities: Record<string, Ent> = {};

  ROOMS.forEach((r, i) => {
    Object.assign(entities, buildRoom(r, i * ROOM_SPACING));
    // 房间之间的短走廊（穿过门洞连到下一间·一屏一间时基本在画面外）
    if (i < ROOMS.length - 1) {
      entities[`corridor-${i}`] = block(0, -2, i * ROOM_SPACING + ROOM_SPACING / 2, 9, 4, ROOM_SPACING - HD * 2, r.floorTop, r.floorSide);
    }
  });

  // showcase 模型（证明导入能力·非体素）：草庭里站一只小黄鸭。
  entities['duck'] = { Transform3D: { x: 7, y: 0.5, z: 4, rotY: -2.2, scale: 3.0 }, Model3D: { modelKey: MODEL_DUCK } };

  // 相机：固定**近俯视**角（垂直向下偏 ~30°·pitch≈58°·yaw 正前不斜·参照弓箭传说/哈迪斯）·ortho 等距。
  // orthoSize 17 → 一屏正好框住一间竞技场（深 28）、左右大幅留白给 UI；沿 +Z 往上推进（pivotZ 由 game-d.ts
  // 平滑推到当前房间中心·一屏一间·render-only 不进 hash）。
  entities['cam'] = {
    Camera3D: { yaw: Math.PI, pitch: 1.02, projection: 'ortho', orthoSize: 17, distance: 240, near: 1, far: 900, pivotX: 0, pivotY: 1.5, pivotZ: 0 },
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
