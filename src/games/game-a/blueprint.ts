import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import {
  transformCapability,
  velocityCapability,
  accelerationCapability,
  shapeCapability,
  colorCapability,
  overlapDetectCapability,
} from '@atom-skills/index.js';
import { accelApplyCapability, motionApplyCapability } from '@skills/tier1/index.js';
import {
  collisionResolveCapability,
  groundSenseCapability,
  jumpCapability,
  boundsClampCapability,
} from '@skills/tier2/index.js';
import type { Box, Level, Spawn } from './level.js';
import { makeCoopGoalCapability, COOP_ENTITY, COOP_CLEAR_FLAG } from './coop-goal.js';

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
    // v0.1：把玩家钳在关卡世界内（== 视口）。卷轴上线后 bounds = 关卡尺寸，相机管可见区。
    Bounds: { minX: 0, minY: 0, maxX: level.bounds.width, maxY: level.bounds.height },
  };
}

// 玩家实体 id（游戏层规则 / 测试引用；区别于 Controllable.playerId 'A'/'B'）。
export const PLAYER_A_ENTITY = 'playerA';
export const PLAYER_B_ENTITY = 'playerB';

// 构建顺序固定（地面 → 平台 → 玩家 → 协作状态）→ 相同实体迭代序 → 确定性哈希一致（lockstep 安全）。
export function buildGameABlueprint(level: Level): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {};
  entities.ground = staticBox(level.ground, GROUND_TINT);
  level.platforms.forEach((p, i) => {
    entities[`platform${i}`] = staticBox(p, PLATFORM_TINT);
  });
  entities[PLAYER_A_ENTITY] = player(level.spawnA, PLAYER_A, COLOR_A, level);
  entities[PLAYER_B_ENTITY] = player(level.spawnB, PLAYER_B, COLOR_B, level);
  // 协作通关状态实体（coop-goal 规则写它的 Flag）。
  entities[COOP_ENTITY] = { Flag: { id: COOP_CLEAR_FLAG, active: false } };
  return {
    capabilities: [...GAME_A_CAPABILITIES, makeCoopGoalCapability(level.goal, [PLAYER_A_ENTITY, PLAYER_B_ENTITY])],
    entities,
  };
}
