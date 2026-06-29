// Game D ·《骰途》场景骨架 —— 无限程序化房间流（弓箭传说/哈迪斯式·一屏一间·往上推进）。
//
// owner 2026-06-29「先搭场景骨架·战斗先别管·一关一关往前流程·近俯视·一屏一战场·把 Streaming 做扎实」。
// 每个房间 = 一座独立竞技场（贴色体素 Mesh3D box·四面围墙 + 前墙留门洞通向上一间）。按 index 即时生成
//（genRoom）——分层（ACTS 循环）、每层 2 战斗 + 1 BOSS。房间**全 render-only**（Transform3D/Mesh3D·出 hash），
// 故可由 game-d.ts 在运行时按需 createEntity/destroyEntity 做**流式生成/卸载**（只保留当前房间附近窗口），
// 无需任何 sim/装配层改动。美术先用"类型颜色"占位（贴图能力后续做），靠现成精装管线（光/景深/泛光/天空）出质感。
// 战斗/骰子/敌人 = 后续接入（见 docs/design/game-d-combat-design.md）。

import type { WorldBlueprint } from '../../assembly/demo.assembly.js';
import { MODEL_DUCK } from './assets.js';

type Ent = WorldBlueprint['entities'][string];

/** 房间沿 +Z 的间距。 */
export const ROOM_SPACING = 36;
/** 普通竞技场半尺寸（BOSS 间更大）。 */
const HW = 13;
const HD = 14;

export interface ActDef {
  name: string;
  floorTop: number; // 地台顶面色
  floorSide: number; // 地台侧/暗面色
  wall: number; // 围墙/装饰主色
  accent: number; // 焦点/门楣高光色（亮色·被 bloom 自发光）
}

/** 层主题（循环复用·index 增长即换层）。 */
export const ACTS: ActDef[] = [
  { name: '草庭', floorTop: 0x8bc34a, floorSide: 0x5d4037, wall: 0x9ccc65, accent: 0xffd54f },
  { name: '石殿', floorTop: 0xb0bec5, floorSide: 0x546e7a, wall: 0x90a4ae, accent: 0x4dd0e1 },
  { name: '熔岩窟', floorTop: 0x6d4c41, floorSide: 0x3e2723, wall: 0x8d6e63, accent: 0xff7043 },
  { name: '水晶厅', floorTop: 0x4dd0e1, floorSide: 0x00838f, wall: 0x26c6da, accent: 0xb39ddb },
];

export interface RoomMeta {
  index: number;
  act: number; // 第几层（0 起）
  roomInAct: number; // 层内第几间（0 起）
  type: 'normal' | 'boss'; // 每层 2 战斗 + 1 BOSS
  theme: ActDef;
}

/** 由房间序号派生「第几层 / 层内第几间 / 类型 / 主题」——纯函数·决定式（无 RNG·骰子随机以后接 sim）。 */
export function roomMeta(index: number): RoomMeta {
  const act = Math.floor(index / 3);
  const roomInAct = index % 3;
  return { index, act, roomInAct, type: roomInAct === 2 ? 'boss' : 'normal', theme: ACTS[act % ACTS.length]! };
}

/** 一个体块：中心位姿 + 尺寸 + 顶/侧色。rotY 可选。盒中心 y=高度/2 时下沿坐地（地台顶在 y=0）。 */
function block(x: number, y: number, z: number, w: number, h: number, d: number, top: number, side: number, rotY?: number): Ent {
  return {
    Transform3D: { x, y, z, ...(rotY !== undefined ? { rotY } : {}) },
    Mesh3D: { shape: 'box', width: w, height: h, depth: d, frontTint: side, backTint: side, edgeTint: top },
  };
}

/**
 * 即时生成第 index 间竞技场的全部实体（id 以 `r{index}-` 前缀·跨房间唯一·便于流式卸载）。
 * 低矮围墙框住地台、前墙（+Z 端）留中央门洞通向上一间、中心焦点 + 散落"类型色块"占位美术。
 * BOSS 间更大、中心立一座发光巨块。index 0 额外放一只 showcase 小黄鸭（证明模型导入能力）。
 */
export function genRoom(index: number): Record<string, Ent> {
  const m = roomMeta(index);
  const t = m.theme;
  const boss = m.type === 'boss';
  const hw = boss ? 16 : HW;
  const hd = boss ? 16 : HD;
  const baseZ = index * ROOM_SPACING;
  const P = `r${index}`;
  const segW = hw - 4.5; // 前墙门洞两侧段宽（中央留 9 宽门）
  const segCx = (hw + 4.5) / 2;

  const out: Record<string, Ent> = {
    // 竞技场地台（顶在 y=0）
    [`${P}-floor`]: block(0, -2, baseZ, hw * 2, 4, hd * 2, t.floorTop, t.floorSide),
    // 三面围墙（左/右/后=入口侧）
    [`${P}-wall-l`]: block(-hw, 1.5, baseZ, 1.5, 5, hd * 2, t.wall, t.floorSide),
    [`${P}-wall-r`]: block(hw, 1.5, baseZ, 1.5, 5, hd * 2, t.wall, t.floorSide),
    [`${P}-wall-back`]: block(0, 1.5, baseZ - hd, hw * 2, 5, 1.5, t.wall, t.floorSide),
    // 前墙留中央门洞（+Z 端·通向上一间·发光门楣）
    [`${P}-wall-fl`]: block(-segCx, 1.5, baseZ + hd, segW, 5, 1.5, t.wall, t.floorSide),
    [`${P}-wall-fr`]: block(segCx, 1.5, baseZ + hd, segW, 5, 1.5, t.wall, t.floorSide),
    [`${P}-door-top`]: block(0, 5.5, baseZ + hd, 9, 2, 1.5, t.accent, t.wall),
    // 通向上一间的短走廊（穿过门洞·暗示"还有更上面"）
    [`${P}-corridor`]: block(0, -2, baseZ + ROOM_SPACING / 2, 9, 4, ROOM_SPACING - hd - HD, t.floorTop, t.floorSide),
    // 散落"类型色块"占位美术素材（未来换贴图·先靠颜色区分类型）
    [`${P}-t1`]: block(-7, 0.5, baseZ - 6, 2.4, 1, 2.4, t.accent, t.floorSide),
    [`${P}-t2`]: block(7.5, 0.5, baseZ + 5, 2.4, 1, 2.4, t.wall, t.floorSide),
  };

  if (boss) {
    // BOSS 间：中心一座发光巨块（占位"Boss"）
    out[`${P}-boss`] = block(0, 4, baseZ, 7, 8, 7, t.accent, t.wall, 0.4);
  } else {
    // 战斗间：中心台座 + 斜摆发光宝物
    out[`${P}-dais`] = block(0, 0.5, baseZ, 7, 1, 7, t.wall, t.floorSide);
    out[`${P}-gem`] = block(0, 2.8, baseZ, 2.6, 2.6, 2.6, t.accent, t.accent, 0.6);
  }

  // 起手间放 showcase 小黄鸭（证明 glTF 模型导入·非体素）
  if (index === 0) {
    out['duck'] = { Transform3D: { x: 7, y: 0.5, z: 4, rotY: -2.2, scale: 3.0 }, Model3D: { modelKey: MODEL_DUCK } };
  }

  return out;
}

/**
 * 场景**静态单例**蓝图（相机 + 光 + 后处理 + 天空盒）——房间不在这里，由 game-d.ts 运行时流式生成。
 * 相机：近俯视（垂直向下偏 ~30°·pitch≈58°·yaw=π 让出口门/上一间在屏幕上方·前进往上推）·ortho 一屏框一间·两侧留 UI。
 */
export function baseBlueprint(): WorldBlueprint {
  return {
    capabilities: [],
    entities: {
      cam: { Camera3D: { yaw: Math.PI, pitch: 1.02, projection: 'ortho', orthoSize: 17, distance: 240, near: 1, far: 900, pivotX: 0, pivotY: 1.5, pivotZ: 0 } },
      sun: { Light3D: { kind: 'directional', color: 0xfff1d6, intensity: 1.7, dirX: -0.5, dirY: -1, dirZ: -0.35, castShadow: true } },
      fill: { Light3D: { kind: 'ambient', color: 0xbcd2ff, intensity: 0.5 } },
      post: { Post3D: { tiltShift: { focus: 0.56, intensity: 2.6 }, bloom: { strength: 0.5, radius: 0.6, threshold: 0.75 } } },
      sky: { Sky3D: { top: 0x22305e, bottom: 0x6f83b4, clouds: true, cloudTint: 0xc7d4f0, scroll: 0.6 } },
    },
  };
}
