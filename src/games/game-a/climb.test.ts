import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { Transform, Velocity, Flag } from '@engine/protocol/components.js';
import { applyCommands } from '@net/index.js';
import type { Command } from '@net/index.js';
import { buildGameABlueprint, PLAYER_A_ENTITY, PLAYER_B_ENTITY, COOP_ENTITY, COOP_CLEAR_FLAG } from './blueprint.js';
import { LEVEL_CLIMB } from './level.js';

// 关2「协力攀塔」协作机制验证（自动证明真能玩通，不靠盲拍）：
//  ① 机关：蓝A 踩 p3 压力板 → 幻影台 ph1 变实（去掉 Sensor）；离板 → 复原虚（带 Sensor）。
//  ② 互动：ph1 实时 B 能踩着它从 p3 跨到 p5；ph1 虚时 B 跨不过去（缺口太大 / 撞 p5 底面）。
//  ③ B 登顶 p6 → 通关（goalRequires:['B']）。
function load(): World {
  const w = new World();
  const bp = buildGameABlueprint(LEVEL_CLIMB);
  for (const cap of bp.capabilities) for (const s of cap.systems) w.addSystem(s);
  for (const [id, comps] of Object.entries(bp.entities)) {
    w.createEntity(id);
    for (const [type, data] of Object.entries(comps)) w.addComponent(id, { ...data, type } as Component);
  }
  return w;
}
const T = (w: World, id: string): Transform => w.getComponent<Transform>(id, 'Transform')!;
const setPos = (w: World, id: string, x: number, y: number): void => {
  const t = T(w, id); t.x = x; t.y = y;
  const v = w.getComponent<Velocity>(id, 'Velocity')!; v.vx = 0; v.vy = 0;
};
function step(w: World, cmds: Command[] = []): void { applyCommands(w, cmds); w.tick(); }
// 贪心攀爬驱动：朝目标 x 移动 + 每帧尝试跳（着地才会真起跳）。
const driveB = (tx: number): Command => ({ playerId: 'B', tick: 0, move: { dx: Math.sign(tx - 0) as number, dy: 0 }, jump: true });
const driveToward = (w: World, tx: number): Command => ({ playerId: 'B', tick: 0, move: { dx: Math.sign(tx - T(w, PLAYER_B_ENTITY).x), dy: 0 }, jump: true });

// p3 落点中心 ≈ 601-15=586；p5 落点中心 ≈ 431-15=416；ph1 顶 516。
// 真·站上 p5：着地(Grounded) + y 在落点 + x 落在 p5 横跨[185,315]内（排除中途穿过该高度的误判）。
const onP5 = (w: World): boolean => {
  const t = T(w, PLAYER_B_ENTITY);
  return w.hasComponent(PLAYER_B_ENTITY, 'Grounded') && Math.abs(t.y - 416) < 10 && t.x > 190 && t.x < 310;
};

describe('Game A 关2「协力攀塔」—— 幻影台协作机制验证', () => {
  it('机关：蓝A 踩 p3 压力板 → 幻影台 ph1 变实；离板 → 复原虚', () => {
    const w = load();
    // A 出生(230,560)落到 p3(顶601)上的压力板区域
    for (let i = 0; i < 60; i++) step(w);
    expect(w.hasComponent('ph1', 'Sensor')).toBe(false); // A 在板上 → ph1 实（无 Sensor=可踩）
    for (let i = 0; i < 60; i++) step(w, [{ playerId: 'A', tick: 0, move: { dx: 1, dy: 0 } }]); // A 走开
    expect(w.hasComponent('ph1', 'Sensor')).toBe(true); // 离板 → ph1 复原虚（带 Sensor=可穿过）
  });

  it('幻影台是刚需：ph1 虚时 B 跨不到 p5；A 踩板让 ph1 变实后 B 能踩着跨过去', () => {
    // 虚：A 不在板上（移开），B 从 p3 反复朝 p5 跳 → 跨不过去（ph1 可穿过，且 p3→p5 直跳撞底面）
    const wSoft = load();
    for (let i = 0; i < 30; i++) step(wSoft);
    setPos(wSoft, PLAYER_A_ENTITY, 600, 833); // A 移到别处（不踩板 → ph1 虚）
    setPos(wSoft, PLAYER_B_ENTITY, 250, 586); // B 放到 p3 上
    let reachedSoft = false;
    for (let i = 0; i < 120; i++) { step(wSoft, [driveToward(wSoft, 410)]); if (onP5(wSoft)) reachedSoft = true; }
    expect(reachedSoft).toBe(false); // ph1 虚 → 跨不到 p5

    // 实：A 踩住 p3 板（ph1 变实），B 踩着 ph1 跨到 p5
    const wSolid = load();
    for (let i = 0; i < 30; i++) step(wSolid);
    setPos(wSolid, PLAYER_A_ENTITY, 220, 586); // A 站 p3 板上 → ph1 实
    setPos(wSolid, PLAYER_B_ENTITY, 290, 586); // B 也在 p3 上（错开避免与 A 重叠被弹飞）
    for (let i = 0; i < 12; i++) step(wSolid); // 让 A 落定踩板 + ph1 变实生效
    expect(wSolid.hasComponent('ph1', 'Sensor')).toBe(false); // 确认 ph1 已实
    const onPh1 = (): boolean => {
      const t = T(wSolid, PLAYER_B_ENTITY);
      return wSolid.hasComponent(PLAYER_B_ENTITY, 'Grounded') && Math.abs(t.y - 501) < 10 && t.x > 360 && t.x < 460;
    };
    // 阶段1：B 朝右上跳 → 落到幻影台 ph1（向右蹦）
    let landedPh1 = false;
    for (let i = 0; i < 70 && !landedPh1; i++) { step(wSolid, [{ playerId: 'B', tick: 0, move: { dx: 1, dy: 0 }, jump: true }]); if (onPh1()) landedPh1 = true; }
    expect(landedPh1).toBe(true); // 踩上了变实的 ph1
    // 阶段2：B 朝左上跳 → 从 ph1 落到 p5（向左蹦）
    let reachedSolid = false;
    for (let i = 0; i < 70 && !reachedSolid; i++) { step(wSolid, [{ playerId: 'B', tick: 0, move: { dx: -1, dy: 0 }, jump: true }]); if (onP5(wSolid)) reachedSolid = true; }
    expect(reachedSolid).toBe(true); // ph1 实 → B 踩着它跨到 p5
  });

  it('B 登顶 p6 → 通关（goalRequires:[B]）', () => {
    const w = load();
    for (let i = 0; i < 30; i++) step(w);
    setPos(w, PLAYER_B_ENTITY, 390, 331); // 放到顶台 p6（目标区内）
    for (let i = 0; i < 10; i++) step(w);
    expect(w.getComponent<Flag>(COOP_ENTITY, 'Flag')?.active).toBe(true);
    expect(w.getComponent<Flag>(COOP_ENTITY, 'Flag')?.id).toBe(COOP_CLEAR_FLAG);
  });
});
