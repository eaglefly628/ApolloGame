import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import {
  transformCapability,
  velocityCapability,
  accelerationCapability,
  shapeCapability,
  colorCapability,
  overlapDetectCapability,
} from '@atom-skills/index.js';
import { accelApplyCapability, motionApplyCapability, tweenCapability } from '@skills/tier1/index.js';
import {
  collisionResolveCapability,
  groundSenseCapability,
  jumpCapability,
  boundsClampCapability,
  cameraFollowCapability,
  zoneOccupancyCapability,
} from '@skills/tier2/index.js';
import type { Box, Level, Spawn } from './level.js';

// 协作通关状态：挂 Flag/Zone 的实体 id 与旗标名。
// 原 coop-goal.ts（手写胜负系统）已下沉为通用 zone-occupancy capability（REQ-006）——通关条件现在是纯数据。
export const COOP_ENTITY = 'coop';
export const COOP_CLEAR_FLAG = 'coop-clear';

// ═══════════════════════════════════════════════════════════════
//  Game A v0.1 蓝图 —— 双人协作平台跳跃（核心闭环验证）
//  全部用现成引擎能力拼装，未碰引擎/共享层（符合 Game Creator 边界）。
//  v0.1 不需要任何引擎新能力；从 v0.2 起的需求见 DESIGN.md / requests.md。
// ═══════════════════════════════════════════════════════════════

// 设计配色：角色 A 蓝、B 橙、环境灰。
export const COLOR_A = 0x3b82f6;
export const COLOR_B = 0xfb923c;
const GROUND_TINT = 0x4b5563;
const PLATFORM_TINT = 0x6b7280;

const GRAVITY = 0.6; // 每 tick 垂直加速度（Acceleration.ay；定步长无 dt）
const PLAYER_SIZE = 30;
const PLAYER_SPEED = 3;

// 玩家路由 id：输入源按此把键位映射到对应实体（见 keymaps.ts）。
export const PLAYER_A = 'A';
export const PLAYER_B = 'B';

// Game A v0.1 用到的引擎能力（全部现成）。
const GAME_A_CAPABILITIES = [
  transformCapability,
  velocityCapability,
  accelerationCapability,
  shapeCapability,
  colorCapability,
  overlapDetectCapability,
  accelApplyCapability,
  motionApplyCapability,
  groundSenseCapability,
  collisionResolveCapability,
  jumpCapability,
  boundsClampCapability,
  cameraFollowCapability,
  tweenCapability,
  zoneOccupancyCapability, // 协作通关条件 = 纯数据 Zone（REQ-006，原 coop-goal.ts 下沉）
];

function staticBox(b: Box, tint: number): EntityBlueprint {
  return {
    Transform: { x: b.x, y: b.y, rotation: 0, scaleX: 1, scaleY: 1 },
    Shape: { kind: 'box', width: b.width, height: b.height },
    Color: { tint, alpha: 1 },
  };
}

function player(spawn: Spawn, playerId: string, tint: number, level: Level): EntityBlueprint {
  return {
    Transform: { x: spawn.x, y: spawn.y, rotation: 0, scaleX: 1, scaleY: 1 },
    Velocity: { vx: 0, vy: 0, angular: 0 },
    Acceleration: { ax: 0, ay: GRAVITY },
    Controllable: { playerId, speed: PLAYER_SPEED },
    Shape: { kind: 'box', width: PLAYER_SIZE, height: PLAYER_SIZE },
    Color: { tint, alpha: 1 },
    // 把玩家钳在关卡世界内（卷轴关卡 bounds = 大关卡尺寸；相机管可见区/卷动）。
    Bounds: { minX: 0, minY: 0, maxX: level.bounds.width, maxY: level.bounds.height },
    // 相机跟随目标：camera-follow 取所有 CameraTarget 的 AABB 中点 + 贴合缩放。
    CameraTarget: {},
  };
}

// 玩家实体 id（游戏层规则 / 测试引用；区别于 Controllable.playerId 'A'/'B'）。
export const PLAYER_A_ENTITY = 'playerA';
export const PLAYER_B_ENTITY = 'playerB';
export const CAMERA_ENTITY = 'camera';

// 视口尺寸（画布像素）。相机看进世界的窗口；关卡可远大于它 → 卷轴。
export const VIEWPORT_W = 640;
export const VIEWPORT_H = 400;

// 构建顺序固定（地面 → 平台 → 玩家 → 协作状态 → 相机）→ 相同实体迭代序 → 确定性哈希一致（lockstep 安全）。
export function buildGameABlueprint(level: Level): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {};
  entities.ground = staticBox(level.ground, GROUND_TINT);
  level.platforms.forEach((p, i) => {
    entities[`platform${i}`] = staticBox(p, PLATFORM_TINT);
  });
  entities[PLAYER_A_ENTITY] = player(level.spawnA, PLAYER_A, COLOR_A, level);
  entities[PLAYER_B_ENTITY] = player(level.spawnB, PLAYER_B, COLOR_B, level);
  // 移动平台（Tween 驱动，纯数据）：Shape 参与碰撞、无 Velocity=静态支撑、Tween 改位置 → 载人。
  (level.movers ?? []).forEach((m, i) => {
    const from = m.target === 'Transform.x' ? m.box.x : m.box.y;
    entities[`mover${i}`] = {
      Transform: { x: m.box.x, y: m.box.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: m.box.width, height: m.box.height },
      Color: { tint: 0x8b5cf6, alpha: 1 },
      Tween: { target: m.target, from, to: m.to, elapsed: 0, duration: m.duration, easing: m.easing ?? 'linear', done: false },
    };
  });
  // 美术（纯数据，Sprite-only 无碰撞 → 渲染器画贴图）：背景最底层、目标旗前景。
  if (level.background) {
    entities.background = {
      Transform: { x: level.bounds.width / 2, y: level.bounds.height / 2, rotation: 0, scaleX: 1, scaleY: 1 },
      Sprite: { textureKey: level.background, anchorX: 0.5, anchorY: 0.5, zOrder: -100 },
    };
  }
  if (level.goalArt) {
    entities.goalFlag = {
      Transform: { x: level.goal.x, y: level.goal.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Sprite: { textureKey: level.goalArt, anchorX: 0.5, anchorY: 0.5, zOrder: 5 },
    };
  }
  // 协作通关条件 = 纯数据 Zone（两名玩家中心都落入目标区矩形 → zone-occupancy 置 coop-clear 旗标）。
  // 目标 Box（中心+尺寸）转矩形（含边界），语义与原 coop-goal 的"中心在框内"一致。game-a 不再有手写胜负系统。
  entities[COOP_ENTITY] = {
    Flag: { id: COOP_CLEAR_FLAG, active: false },
    Zone: {
      outFlag: COOP_CLEAR_FLAG,
      minX: level.goal.x - level.goal.width / 2,
      minY: level.goal.y - level.goal.height / 2,
      maxX: level.goal.x + level.goal.width / 2,
      maxY: level.goal.y + level.goal.height / 2,
      requiredEntities: [PLAYER_A_ENTITY, PLAYER_B_ENTITY],
    },
  };
  // 相机实体：camera-follow 写它的 offset/zoom（取两人中点、贴合缩放）；Bounds=关卡矩形 → 不露界外。
  // 纯数据实体（无 Transform/Shape）→ 不参与物理；渲染器读 Camera 做世界→屏幕投影（= 卷轴）。
  entities[CAMERA_ENTITY] = {
    Camera: { zoom: 1, offsetX: 0, offsetY: 0, rotation: 0, viewportW: VIEWPORT_W, viewportH: VIEWPORT_H },
    Bounds: { minX: 0, minY: 0, maxX: level.bounds.width, maxY: level.bounds.height },
  };
  return {
    capabilities: GAME_A_CAPABILITIES,
    entities,
  };
}
