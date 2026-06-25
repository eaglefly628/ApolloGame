import { World } from '@engine/core/world.js';
import type {
  Transform, Velocity, Acceleration, Controllable, Shape, Color, Bounds,
  Sprite, Frame, AnimState, Camera, CameraTarget, Flag, Zone,
} from '@engine/protocol/components.js';
import { overlapDetectCapability } from '@atom-skills/index.js';
import { accelApplyCapability, motionApplyCapability } from '@skills/tier1/index.js';
import {
  collisionResolveCapability, groundSenseCapability, jumpCapability, boundsClampCapability,
  animStateCapability, cameraFollowCapability, zoneOccupancyCapability,
} from '@skills/tier2/index.js';
import { ASSET_P1_SHEET, ASSET_P2_SHEET, ANIM_CLIPS } from './assets.js';

// ═══════════════════════════════════════════════════════════════
//  是男人就上100层 · 双人合作版 —— 数据驱动的"垂直攀爬"世界（lockstep 安全）
// ═══════════════════════════════════════════════════════════════
//  纯能力组合，零新引擎能力：重力/碰撞/跳跃 + camera-follow(双人中点+自适应缩放) +
//  anim-state(按速度切 idle/walk 精灵帧) + facing(按速度翻面) + zone-occupancy(双人都登顶→summit)。
//  协作：踩头借力（REQ-003：站在已着地队友身上也算 Grounded → 能从队友头顶更高处起跳，够到高台）。
//  lockstep 铁律：所有对端**完全相同的构建顺序**（系统→静态平台→相机→目标→按 playerId 序的玩家）
//  → 相同实体迭代序 → 逐 tick 相同哈希。买路于 platformer-lockstep.ts 同款写法。
// ═══════════════════════════════════════════════════════════════

export const WORLD_W = 640;
export const WORLD_H = 1500;
const GROUND_TOP = 1452; // 地面顶边
const FLOORS = 14;
const GAP = 90; // 层间垂直距离（< 单跳高度163，跳得上）
const OFF = 55; // 锯齿水平偏移（中心 ±55 → 相邻不水平重叠，从侧面落上不撞底面）

// 升序锯齿平台（纯数据）：i 层中心 x 在 320±55 交替，y 自地面每层 -90。宽 90、不重叠。
export interface Box { x: number; y: number; width: number; height: number }
export const CLIMB_PLATFORMS: Box[] = Array.from({ length: FLOORS }, (_, i) => ({
  x: 320 + (i % 2 === 0 ? -OFF : OFF),
  y: GROUND_TOP - GAP * (i + 1),
  width: 90,
  height: 18,
}));
export const TOP_PLATFORM: Box = { x: 320, y: CLIMB_PLATFORMS[FLOORS - 1].y - 60, width: 220, height: 18 }; // 顶台（会合点）
export const GOAL_BOX: Box = { x: 320, y: TOP_PLATFORM.y - 35, width: 220, height: 110 }; // 顶部目标区
export const SUMMIT_FLAG = 'summit';

export const playerEntity = (pid: string): string => `player:${pid}`;
const PLAYER_TINT = [0x3b82f6, 0xfb923c]; // 蓝 / 橙（精灵未加载时的退化色）
const PLAYER_SHEET = [ASSET_P1_SHEET, ASSET_P2_SHEET];
// 出生在第0层(锯齿)两侧的空地（避开其 x 跨度 → 从侧面跳上去，不会撞平台底面）。
const SPAWN_X = [130, 510];

function staticBox(w: World, id: string, b: Box, tint: number): void {
  w.createEntity(id);
  w.addComponent(id, { type: 'Transform', x: b.x, y: b.y, rotation: 0, scaleX: 1, scaleY: 1 } as Transform);
  w.addComponent(id, { type: 'Shape', kind: 'box', width: b.width, height: b.height } as Shape);
  w.addComponent(id, { type: 'Color', tint, alpha: 1 } as Color);
}

export function buildClimbWorld(playerIds: string[]): World {
  const w = new World();
  for (const cap of [
    accelApplyCapability, motionApplyCapability, overlapDetectCapability, groundSenseCapability,
    collisionResolveCapability, jumpCapability, boundsClampCapability,
    animStateCapability, cameraFollowCapability, zoneOccupancyCapability,
  ]) {
    for (const s of cap.systems) w.addSystem(s);
  }

  // 静态几何：地面 → 锯齿平台 → 顶台（固定顺序）。
  staticBox(w, 'ground', { x: 320, y: GROUND_TOP + 24, width: 620, height: 48 }, 0x4b5563);
  CLIMB_PLATFORMS.forEach((p, i) => staticBox(w, `floor${i}`, p, 0x6b7280));
  staticBox(w, 'top', TOP_PLATFORM, 0x8b9099);

  // 相机：取所有 CameraTarget 的 AABB 中点 + 自适应缩放保证两人都在画面；Bounds=关卡矩形不露界外。
  w.createEntity('camera');
  w.addComponent('camera', { type: 'Camera', zoom: 1, offsetX: 320, offsetY: GROUND_TOP, rotation: 0, viewportW: 640, viewportH: 400 } as Camera);
  w.addComponent('camera', { type: 'Bounds', minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H } as Bounds);

  // 目标区（数据驱动通关）：两名玩家中心都进顶部矩形 → summit 旗标置真。
  w.createEntity('goal');
  w.addComponent('goal', { type: 'Flag', id: SUMMIT_FLAG, active: false } as Flag);
  w.addComponent('goal', {
    type: 'Zone', outFlag: SUMMIT_FLAG,
    minX: GOAL_BOX.x - GOAL_BOX.width / 2, minY: GOAL_BOX.y - GOAL_BOX.height / 2,
    maxX: GOAL_BOX.x + GOAL_BOX.width / 2, maxY: GOAL_BOX.y + GOAL_BOX.height / 2,
    requiredEntities: playerIds.map(playerEntity), count: playerIds.length,
  } as Zone);

  // 玩家（按 playerId 序）：动态方块 + 重力 + Controllable + 相机目标 + 精灵动画 + 翻面。
  playerIds.forEach((pid, i) => {
    const id = playerEntity(pid);
    const sheet = PLAYER_SHEET[i % PLAYER_SHEET.length];
    w.createEntity(id);
    w.addComponent(id, { type: 'Transform', x: SPAWN_X[i % SPAWN_X.length], y: GROUND_TOP - 40, rotation: 0, scaleX: 1, scaleY: 1 } as Transform);
    w.addComponent(id, { type: 'Velocity', vx: 0, vy: 0, angular: 0 } as Velocity);
    w.addComponent(id, { type: 'Acceleration', ax: 0, ay: 0.6 } as Acceleration);
    w.addComponent(id, { type: 'Controllable', playerId: pid, speed: 3 } as Controllable);
    w.addComponent(id, { type: 'Shape', kind: 'box', width: 28, height: 28 } as Shape);
    w.addComponent(id, { type: 'Color', tint: PLAYER_TINT[i % PLAYER_TINT.length], alpha: 1 } as Color);
    w.addComponent(id, { type: 'Bounds', minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H } as Bounds);
    w.addComponent(id, { type: 'CameraTarget' } as CameraTarget);
    w.addComponent(id, { type: 'Sprite', textureKey: sheet, anchorX: 0.5, anchorY: 0.5, zOrder: 1 } as Sprite);
    w.addComponent(id, { type: 'Frame', index: 0, total: 3 } as Frame);
    w.addComponent(id, { type: 'AnimState', clips: ANIM_CLIPS(sheet), moveClip: 'walk', idleClip: 'idle', current: 'idle', elapsed: 0 } as unknown as AnimState);
  });

  return w;
}
