import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import {
  transformCapability,
  velocityCapability,
  accelerationCapability,
  shapeCapability,
  colorCapability,
  overlapDetectCapability,
  destroyCapability,
} from '@atom-skills/index.js';
import { accelApplyCapability, motionApplyCapability, tweenCapability } from '@skills/tier1/index.js';
import {
  collisionResolveCapability,
  groundSenseCapability,
  jumpCapability,
  boundsClampCapability,
  cameraFollowCapability,
  zoneOccupancyCapability,
  eventWhenCapability,
  effectApplyCapability,
} from '@skills/tier2/index.js';
import type { Box, Level, Spawn } from './level.js';
import { ASSET_PLAYER_A, ASSET_PLAYER_B, ASSET_DOOR, ASSET_COIN } from './assets.js';

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
  eventWhenCapability, // flag → signal（开关/门控逻辑枢纽）
  effectApplyCapability, // signal → 物理改动（set-sensor 开门，REQ-008）
  destroyCapability, // DestroyRequest → 移除实体（收集物拾取后自毁）
];

function staticBox(b: Box, tint: number): EntityBlueprint {
  return {
    Transform: { x: b.x, y: b.y, rotation: 0, scaleX: 1, scaleY: 1 },
    Shape: { kind: 'box', width: b.width, height: b.height },
    Color: { tint, alpha: 1 },
  };
}

function player(spawn: Spawn, playerId: string, tint: number, texture: string, level: Level): EntityBlueprint {
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
    // 角色美术皮（REQ-005，渲染器优先 Sprite）：贴图就绪显角色、否则退化 Color 方块；Shape 只管碰撞。
    Sprite: { textureKey: texture, anchorX: 0.5, anchorY: 0.5, zOrder: 1 },
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
  entities[PLAYER_A_ENTITY] = player(level.spawnA, PLAYER_A, COLOR_A, ASSET_PLAYER_A, level);
  entities[PLAYER_B_ENTITY] = player(level.spawnB, PLAYER_B, COLOR_B, ASSET_PLAYER_B, level);
  // 移动平台（Tween 驱动，纯数据）：Shape 参与碰撞、无 Velocity=静态支撑、Tween 改位置 → 载人。
  (level.movers ?? []).forEach((m, i) => {
    const from = m.target === 'Transform.x' ? m.box.x : m.box.y;
    entities[`mover${i}`] = {
      Transform: { x: m.box.x, y: m.box.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: m.box.width, height: m.box.height },
      Color: { tint: 0x8b5cf6, alpha: 1 },
      Tween: { target: m.target, from, to: m.to, elapsed: 0, duration: m.duration, easing: m.easing ?? 'linear', done: false, loop: m.loop ?? 'none', ...(m.loops !== undefined ? { loops: m.loops } : {}) },
    };
  });
  // 实心门（默认实心；被开关 effect set-sensor 切成可穿过，REQ-008）。
  (level.doors ?? []).forEach((d) => {
    entities[d.id] = {
      Transform: { x: d.box.x, y: d.box.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: d.box.width, height: d.box.height },
      Color: { tint: 0x9ca3af, alpha: 1 },
      // 美术皮（textureKey 现成 → 渲染木门/铁门；缺图退化 Color 方块）。Shape 仍是碰撞真值。
      Sprite: { textureKey: ASSET_DOOR, anchorX: 0.5, anchorY: 0.5, zOrder: 1 },
    };
    // 组合开门条件（openWhen，多机关联动）：把任意布尔树直接喂给 event-when 的 when（引擎已支持 and/or/not）。
    // 真→开门信号、其否定→合门信号（level 持续：条件成立时门开、任一松开自动复原）。零新能力、零游戏系统。
    if (d.openWhen) {
      entities[`doorOpen:${d.id}`] = { EventWhen: { signal: `open:${d.id}`, when: d.openWhen, mode: 'level', armed: false } };
      entities[`doorClose:${d.id}`] = { EventWhen: { signal: `close:${d.id}`, when: { kind: 'not', of: d.openWhen }, mode: 'level', armed: false } };
      entities[`doorOpenFx:${d.id}`] = { Effect: { onSignal: `open:${d.id}`, kind: 'set-sensor', targetEntity: d.id, value: true } };
      entities[`doorCloseFx:${d.id}`] = { Effect: { onSignal: `close:${d.id}`, kind: 'set-sensor', targetEntity: d.id, value: false } };
    }
  });
  // 压力开关（纯能力链，零游戏系统）：占据(zone-occupancy)→flag → event-when(flag→signal) → effect set-sensor(开/合门)。
  (level.switches ?? []).forEach((s, i) => {
    const flagId = s.outFlag ?? `switch${i}`; // outFlag = 命名旗标供 Door.openWhen 组合；缺省直连用 switch{i}
    const p = s.plate;
    const reqEnts = (s.requires ?? [s.by]).map((rr) => (rr === 'A' ? PLAYER_A_ENTITY : PLAYER_B_ENTITY));
    // 视觉压力板（Sensor 非实心，玩家由地面支撑站其上）。
    entities[`plate${i}`] = {
      Transform: { x: p.x, y: p.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: p.width, height: p.height },
      Color: { tint: 0x22c55e, alpha: 0.5 },
      Sensor: {},
    };
    // 占据 → flag（无论直连还是组合，开关都先产出这个 flag）。
    entities[`switchZone${i}`] = {
      Flag: { id: flagId, active: false },
      Zone: { outFlag: flagId, minX: p.x - p.width / 2, minY: p.y - p.height / 2, maxX: p.x + p.width / 2, maxY: p.y + p.height / 2, requiredEntities: reqEnts },
    };
    // 直连门（opensDoor）：flag → 开/合信号（level 持续：踩着开、离开合）→ 门 Sensor 开/合（REQ-008）。
    // 组合门（仅 outFlag、无 opensDoor）则不在此连，由 Door.openWhen 统一在门侧组合多台。
    if (s.opensDoor) {
      const dn = s.opensDoor;
      entities[`swOpen${i}`] = { EventWhen: { signal: `open:${dn}`, when: { kind: 'flag', id: flagId, equals: true }, mode: 'level', armed: false } };
      entities[`swClose${i}`] = { EventWhen: { signal: `close:${dn}`, when: { kind: 'flag', id: flagId, equals: false }, mode: 'level', armed: false } };
      entities[`swOpenFx${i}`] = { Effect: { onSignal: `open:${dn}`, kind: 'set-sensor', targetEntity: dn, value: true } };
      entities[`swCloseFx${i}`] = { Effect: { onSignal: `close:${dn}`, kind: 'set-sensor', targetEntity: dn, value: false } };
    }
  });
  // 幻影台（纯能力链·机关，零游戏系统）：默认带 Sensor=虚可穿过；solidWhen 成立 → effect set-sensor(false)
  // 去掉 Sensor 变实可踩，不成立 → set-sensor(true) 复原。与门相反极性，复用 event-when + effect set-sensor。
  (level.phantoms ?? []).forEach((ph) => {
    entities[ph.id] = {
      Transform: { x: ph.box.x, y: ph.box.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: ph.box.width, height: ph.box.height },
      Color: { tint: 0x38bdf8, alpha: 0.55 }, // 半透明青：暗示"虚/可控"踏板
      Sensor: {}, // 默认可穿过（虚）
    };
    entities[`phSolid:${ph.id}`] = { EventWhen: { signal: `solid:${ph.id}`, when: ph.solidWhen, mode: 'level', armed: false } };
    entities[`phSoft:${ph.id}`] = { EventWhen: { signal: `soft:${ph.id}`, when: { kind: 'not', of: ph.solidWhen }, mode: 'level', armed: false } };
    entities[`phSolidFx:${ph.id}`] = { Effect: { onSignal: `solid:${ph.id}`, kind: 'set-sensor', targetEntity: ph.id, value: false } }; // 去 Sensor → 实
    entities[`phSoftFx:${ph.id}`] = { Effect: { onSignal: `soft:${ph.id}`, kind: 'set-sensor', targetEntity: ph.id, value: true } }; // 加 Sensor → 虚
  });
  // 拾取物（纯能力链，零游戏系统）：zone(任一玩家进 box, count:1)→flag → event-when(edge) → effect destroy + effect modify-resource(coins)。
  if ((level.collectibles ?? []).length > 0) {
    entities.score = { Resource: { id: 'coins', current: 0, min: 0, max: 999 } };
  }
  (level.collectibles ?? []).forEach((c) => {
    const r = c.box;
    entities[c.id] = {
      Transform: { x: r.x, y: r.y, rotation: 0, scaleX: 1, scaleY: 1 },
      Shape: { kind: 'box', width: r.width, height: r.height },
      Color: { tint: 0xfacc15, alpha: 1 },
      Sprite: { textureKey: ASSET_COIN, anchorX: 0.5, anchorY: 0.5, zOrder: 1 }, // 美术皮（金币/宝石）；缺图退化
      Sensor: {}, // 非实心：玩家穿过即拾
      Flag: { id: `gem:${c.id}`, active: false },
      Zone: { outFlag: `gem:${c.id}`, minX: r.x - r.width / 2, minY: r.y - r.height / 2, maxX: r.x + r.width / 2, maxY: r.y + r.height / 2, requiredEntities: [PLAYER_A_ENTITY, PLAYER_B_ENTITY], count: 1 },
    };
    entities[`gemGrab:${c.id}`] = { EventWhen: { signal: `grab:${c.id}`, when: { kind: 'flag', id: `gem:${c.id}`, equals: true }, mode: 'edge', armed: false } };
    entities[`gemKill:${c.id}`] = { Effect: { onSignal: `grab:${c.id}`, kind: 'destroy', targetEntity: c.id, value: true } };
    entities[`gemScore:${c.id}`] = { Effect: { onSignal: `grab:${c.id}`, kind: 'modify-resource', targetId: 'coins', value: c.amount ?? 1 } };
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
      requiredEntities: (level.goalRequires ?? ['A', 'B']).map((r) => (r === 'A' ? PLAYER_A_ENTITY : PLAYER_B_ENTITY)),
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
