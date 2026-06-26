import { World } from '@engine/core/world.js';
import type {
  Transform, Velocity, Acceleration, Controllable, Shape, Color, Bounds,
  Sprite, Frame, AnimState, Camera, CameraTarget, Flag, Zone, ConditionExpr,
} from '@engine/protocol/components.js';
import { overlapDetectCapability } from '@atom-skills/index.js';
import { accelApplyCapability, motionApplyCapability } from '@skills/tier1/index.js';
import {
  collisionResolveCapability, groundSenseCapability, jumpCapability, boundsClampCapability,
  animStateCapability, cameraFollowCapability, zoneOccupancyCapability, eventWhenCapability, effectApplyCapability,
} from '@skills/tier2/index.js';
import { ASSET_P1_SHEET, ASSET_P2_SHEET, ANIM_CLIPS } from './assets.js';

// ═══════════════════════════════════════════════════════════════
//  「你造我塔」· 双人合作召唤二重奏（数据驱动 · lockstep 安全 · 零新引擎能力）
// ═══════════════════════════════════════════════════════════════
//  想象力核心（参考 Pico Park「用身体当机关」+ NS-SHAFT「平台有个性」）：
//   没人能爬自己的路 —— 你站定踩住开关，对方的「幻影踏脚」才实体化；于是必须交替二重奏：
//   我撑住开关给你召唤台阶 → 你上去再回头给我召唤 → 塔在配合中长出来。落脚平台(带开关)恒实，
//   连接台阶皆幻影(默认可穿过)，由「对方踩住对应开关」才变实（plate→flag→event-when→effect set-sensor）。
//  协作还可踩头借力(REQ-003)。相机取双人中点自适应缩放。两人都登顶→summit 过关。
//  lockstep：固定构建顺序(系统→恒实平台→开关→幻影台+连线→相机→目标→按 playerId 序玩家)→同哈希。
// ═══════════════════════════════════════════════════════════════

export const WORLD_W = 640;
export const WORLD_H = 1120;
const GROUND_TOP = 1050;
export const SUMMIT_FLAG = 'summit';

export interface Box { x: number; y: number; width: number; height: number }
export const playerEntity = (pid: string): string => `player:${pid}`;
const PLAYER_TINT = [0x3b82f6, 0xfb923c];
const PLAYER_SHEET = [ASSET_P1_SHEET, ASSET_P2_SHEET];
const SPAWN_X = [70, 570]; // 出生在首段幻影台的侧边空地（避免正下方起跳撞底面）

// 恒实平台。蓝走左→右上对角，橙走右→左上对角，两条斜梯各段都有横向缺口(从侧面落上、不撞底面)，
// 顶台居中、两落脚台在其 x 跨度之外 → 从侧面跳上顶台。
const NORMALS: Array<Box & { tint?: number }> = [
  { x: 320, y: GROUND_TOP + 24, width: 620, height: 48 }, // [0] ground
  { x: 440, y: 743, width: 150, height: 18 }, // [1] L1 蓝落脚台 [365,515] + b1
  { x: 200, y: 743, width: 150, height: 18 }, // [2] L2 橙落脚台 [125,275]
  { x: 320, y: 655, width: 170, height: 20, tint: 0xf5c542 }, // [3] TOP 顶台(金) [235,405]
];
// 压力开关：owner=哪个玩家(0蓝/1橙)踩 → 置 flag。二重奏只需两把：
//  og(橙踩地面)→撑起蓝的台让蓝爬到 L1；b1(蓝踩 L1)→撑起橙的台让橙爬到 L2。
const SWITCHES: Array<{ plate: Box; owner: number; flag: string }> = [
  { plate: { x: 570, y: 1030, width: 90, height: 40 }, owner: 1, flag: 'og' }, // 地面·橙开关（撑蓝）·橙出生即在此
  { plate: { x: 440, y: 726, width: 140, height: 36 }, owner: 0, flag: 'b1' }, // L1·蓝开关（撑橙）
];
// 幻影踏脚：gate=哪个 flag 为真时变实。蓝爬的台(左)由橙开关(og→A段, b? )驱动……
//  A 段：橙踩地面 og → 蓝的 bs1/bs2 实 → 蓝爬到 L1。
//  B 段：蓝踩 L1 b1 → 橙的 os1/os2 实 → 橙爬到 L2。
const PHANTOMS: Array<{ box: Box; gate: string }> = [
  { box: { x: 160, y: 955, width: 120, height: 16 }, gate: 'og' }, // ph0 蓝爬·橙撑 [120,200]（斜上→右·每跳~90）
  { box: { x: 255, y: 883, width: 120, height: 16 }, gate: 'og' }, // ph1 [215,295]
  { box: { x: 350, y: 811, width: 120, height: 16 }, gate: 'og' }, // ph2 [310,390] → L1
  { box: { x: 480, y: 955, width: 120, height: 16 }, gate: 'b1' }, // ph3 橙爬·蓝撑 [440,520]（斜上→左）
  { box: { x: 385, y: 883, width: 120, height: 16 }, gate: 'b1' }, // ph4 [345,425]
  { box: { x: 290, y: 811, width: 120, height: 16 }, gate: 'b1' }, // ph5 [250,330] → L2
];
const SUMMIT_BOX: Box = { x: 320, y: 625, width: 180, height: 110 }; // 顶部目标区（站上金顶台即在内）

function box(w: World, id: string, b: Box, tint: number, sensor = false): void {
  w.createEntity(id);
  w.addComponent(id, { type: 'Transform', x: b.x, y: b.y, rotation: 0, scaleX: 1, scaleY: 1 } as Transform);
  w.addComponent(id, { type: 'Shape', kind: 'box', width: b.width, height: b.height } as Shape);
  w.addComponent(id, { type: 'Color', tint, alpha: sensor ? 0.5 : 1 } as Color);
  if (sensor) w.addComponent(id, { type: 'Sensor' } as { type: 'Sensor' });
}

export function buildClimbWorld(playerIds: string[]): World {
  const w = new World();
  for (const cap of [
    accelApplyCapability, motionApplyCapability, overlapDetectCapability, groundSenseCapability,
    collisionResolveCapability, jumpCapability, boundsClampCapability,
    animStateCapability, cameraFollowCapability, zoneOccupancyCapability, eventWhenCapability, effectApplyCapability,
  ]) {
    for (const s of cap.systems) w.addSystem(s);
  }
  const ownerEnt = (i: number): string => (playerIds[i] ? playerEntity(playerIds[i]) : '__none__');

  // 恒实平台。
  NORMALS.forEach((b, i) => box(w, i === 0 ? 'ground' : `normal${i}`, b, b.tint ?? (i === 0 ? 0x4b5563 : 0x6b7280)));
  // 开关（zone→flag；owner 专属）。
  SWITCHES.forEach((s, i) => {
    const p = s.plate;
    box(w, `plate${i}`, p, s.owner === 0 ? 0x3b82f6 : 0xfb923c, true); // 视觉板（蓝/橙·Sensor 不挡路）
    w.createEntity(`sw${i}`);
    w.addComponent(`sw${i}`, { type: 'Flag', id: s.flag, active: false } as Flag);
    w.addComponent(`sw${i}`, {
      type: 'Zone', outFlag: s.flag,
      minX: p.x - p.width / 2, minY: p.y - p.height / 2, maxX: p.x + p.width / 2, maxY: p.y + p.height / 2,
      requiredEntities: [ownerEnt(s.owner)], count: 1,
    } as Zone);
  });
  // 幻影踏脚：默认 Sensor(虚)；gate 真→set-sensor(false) 变实，gate 假→set-sensor(true) 复原。
  PHANTOMS.forEach((ph, i) => {
    box(w, `ph${i}`, ph.box, 0x38bdf8, true);
    const when: ConditionExpr = { kind: 'flag', id: ph.gate, equals: true };
    w.createEntity(`phSolid${i}`); w.addComponent(`phSolid${i}`, { type: 'EventWhen', signal: `solid:ph${i}`, when, mode: 'level', armed: false } as unknown as { type: 'EventWhen' });
    w.createEntity(`phSoft${i}`); w.addComponent(`phSoft${i}`, { type: 'EventWhen', signal: `soft:ph${i}`, when: { kind: 'not', of: when }, mode: 'level', armed: false } as unknown as { type: 'EventWhen' });
    w.createEntity(`phSolidFx${i}`); w.addComponent(`phSolidFx${i}`, { type: 'Effect', onSignal: `solid:ph${i}`, kind: 'set-sensor', targetEntity: `ph${i}`, value: false } as unknown as { type: 'Effect' });
    w.createEntity(`phSoftFx${i}`); w.addComponent(`phSoftFx${i}`, { type: 'Effect', onSignal: `soft:ph${i}`, kind: 'set-sensor', targetEntity: `ph${i}`, value: true } as unknown as { type: 'Effect' });
  });

  // 相机（跟双人中点+自适应缩放）。
  w.createEntity('camera');
  w.addComponent('camera', { type: 'Camera', zoom: 1, offsetX: 320, offsetY: GROUND_TOP, rotation: 0, viewportW: 640, viewportH: 400 } as Camera);
  w.addComponent('camera', { type: 'Bounds', minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H } as Bounds);

  // 目标（两人都进顶部矩形→summit）。
  w.createEntity('goal');
  w.addComponent('goal', { type: 'Flag', id: SUMMIT_FLAG, active: false } as Flag);
  w.addComponent('goal', {
    type: 'Zone', outFlag: SUMMIT_FLAG,
    minX: SUMMIT_BOX.x - SUMMIT_BOX.width / 2, minY: SUMMIT_BOX.y - SUMMIT_BOX.height / 2,
    maxX: SUMMIT_BOX.x + SUMMIT_BOX.width / 2, maxY: SUMMIT_BOX.y + SUMMIT_BOX.height / 2,
    requiredEntities: playerIds.map(playerEntity), count: playerIds.length,
  } as Zone);

  // 玩家（按 playerId 序：0蓝1橙）。
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

// 供测试/渲染引用的关卡数据。
export { NORMALS, SWITCHES, PHANTOMS, SUMMIT_BOX, GROUND_TOP };
