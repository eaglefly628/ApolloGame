import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Velocity, Overlap } from '@engine/protocol/components.js';
import { groundSenseCapability } from './ground-sense.js';

function worldWithGroundSense(): World {
  const w = new World();
  for (const s of groundSenseCapability.systems) w.addSystem(s);
  return w;
}

// dyn 有 Velocity（动态），floor/wall 无 Velocity（静态）。
function addDyn(w: World, id: string): void {
  w.createEntity(id);
  w.addComponent(id, { type: 'Velocity', vx: 0, vy: 0, angular: 0 } as Velocity);
}
function addOverlap(w: World, a: string, b: string, normalY: number): void {
  const oid = `overlap:${a}:${b}`;
  w.createEntity(oid);
  w.addComponent(oid, { type: 'Overlap', entityA: a, entityB: b, normalX: 0, normalY, depth: 4 } as Overlap);
}

describe('T2 ground-sense — capability metadata', () => {
  it('id / 读 Overlap+Velocity / 写 Grounded / provide marker', () => {
    expect(groundSenseCapability.id).toBe('t2-ground-sense');
    // Sensor：非实心区不是支撑面（踩金币不算落地）——真读了就必须申报（根因①「申报漂移」）。
    expect(groundSenseCapability.components.reads).toEqual(['Overlap', 'Velocity', 'Grounded', 'Sensor']);
    expect(groundSenseCapability.components.writes).toEqual(['Grounded']);
    expect(groundSenseCapability.components.provides.Grounded.category).toBe('marker');
  });
});

describe('T2 ground-sense — behavior', () => {
  it('动态体脚下踩到静态体(法线朝下 ny>0.5) → 打 Grounded', () => {
    const w = worldWithGroundSense();
    addDyn(w, 'dyn');
    w.createEntity('floor'); // 无 Velocity → 静态
    addOverlap(w, 'dyn', 'floor', 1); // 法线 dyn→floor 朝下（floor 在脚下）
    w.tick();
    expect(w.hasComponent('dyn', 'Grounded')).toBe(true);
    expect(w.hasComponent('floor', 'Grounded')).toBe(false); // 静态体不标记
  });

  it('墙面接触(ny≈0) → 不算 Grounded', () => {
    const w = worldWithGroundSense();
    addDyn(w, 'dyn');
    w.createEntity('wall');
    addOverlap(w, 'dyn', 'wall', 0); // 水平法线 = 墙，不是地面
    w.tick();
    expect(w.hasComponent('dyn', 'Grounded')).toBe(false);
  });

  it('头顶撞天花板(对 A 而言 ny<0，被向下推) → 不算 Grounded', () => {
    const w = worldWithGroundSense();
    addDyn(w, 'dyn');
    w.createEntity('ceil');
    addOverlap(w, 'dyn', 'ceil', -1); // 法线 dyn→ceil 朝上 = 天花板在头顶
    w.tick();
    expect(w.hasComponent('dyn', 'Grounded')).toBe(false);
  });

  it('每帧重算：这帧无接触 → 清除上帧的 Grounded', () => {
    const w = worldWithGroundSense();
    addDyn(w, 'dyn');
    w.createEntity('floor');
    addOverlap(w, 'dyn', 'floor', 1);
    w.tick();
    expect(w.hasComponent('dyn', 'Grounded')).toBe(true);
    // 移除接触（模拟离地），再 tick → Grounded 应被清掉
    w.destroyEntity('overlap:dyn:floor');
    w.tick();
    expect(w.hasComponent('dyn', 'Grounded')).toBe(false);
  });
});

describe('T2 ground-sense — REQ-003 动态支撑链', () => {
  it('A 踩 B(动态)、B 踩地 → A 与 B 都 Grounded（链式不动点传播）', () => {
    const w = worldWithGroundSense();
    addDyn(w, 'box'); // 动态箱
    addDyn(w, 'player'); // 动态玩家
    w.createEntity('floor'); // 静态地面
    addOverlap(w, 'box', 'floor', 1); // box 踩在 floor 上（静态支撑）
    addOverlap(w, 'player', 'box', 1); // player 踩在 box（动态支撑）上
    w.tick();
    expect(w.hasComponent('box', 'Grounded')).toBe(true);
    expect(w.hasComponent('player', 'Grounded')).toBe(true); // 经支撑链拿到 Grounded → 可起跳
  });

  it('支撑的动态体本帧不 Grounded(悬空) → 骑乘者也不 Grounded', () => {
    const w = worldWithGroundSense();
    addDyn(w, 'box'); // 箱悬空（无 floor 接触）
    addDyn(w, 'player');
    addOverlap(w, 'player', 'box', 1);
    w.tick();
    expect(w.hasComponent('box', 'Grounded')).toBe(false);
    expect(w.hasComponent('player', 'Grounded')).toBe(false);
  });
});

// ── 回归（engine-review-2026-08-04 §3.3 · P1）─────────────────────────────
// 非实心 Sensor（金币/伤害区/触发区）不是支撑面。旧实现只看法线方向 + 骑乘者有无 Velocity，
// 于是**跳过一枚金币就被判着地、可在空中再跳一次 = 二段跳**。
// 正确口径在 collision-resolve（REQ-002：任一方是 Sensor 即跳过），此处与之对齐。
describe('T2 ground-sense — Sensor 不是支撑面（与 collision-resolve REQ-002 同口径）', () => {
  const sensor = (w: World, id: string) => {
    w.createEntity(id);
    w.addComponent(id, { type: 'Sensor', triggered: false } as never);
  };

  it('踩在 Sensor（金币）上 → 不算落地（防二段跳）', () => {
    const w = worldWithGroundSense();
    addDyn(w, 'player');
    sensor(w, 'coin');
    addOverlap(w, 'player', 'coin', 1); // 法线朝下 = player 骑在 coin 上
    w.tick();
    expect(w.hasComponent('player', 'Grounded')).toBe(false);
  });

  it('踩在实心地面上 → 照常落地（修 Sensor 不误伤正常路径）', () => {
    const w = worldWithGroundSense();
    addDyn(w, 'player');
    w.createEntity('floor');
    addOverlap(w, 'player', 'floor', 1);
    w.tick();
    expect(w.hasComponent('player', 'Grounded')).toBe(true);
  });

  it('同时压着金币与地面 → 仍算落地（Sensor 只被忽略、不否决实心支撑）', () => {
    const w = worldWithGroundSense();
    addDyn(w, 'player');
    sensor(w, 'coin');
    w.createEntity('floor');
    addOverlap(w, 'player', 'coin', 1);
    addOverlap(w, 'player', 'floor', 1);
    w.tick();
    expect(w.hasComponent('player', 'Grounded')).toBe(true);
  });
});

