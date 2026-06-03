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
    expect(groundSenseCapability.components.reads).toEqual(['Overlap', 'Velocity']);
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
