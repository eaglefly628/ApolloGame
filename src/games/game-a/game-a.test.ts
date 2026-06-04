import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { Transform, Velocity } from '@engine/protocol/components.js';
import { applyCommands, hashSnapshot } from '@net/index.js';
import type { Command } from '@net/index.js';
import { JUMP_SPEED } from '@skills/tier2/index.js';
import { buildGameABlueprint, PLAYER_A, PLAYER_B } from './blueprint.js';
import { LEVEL_W1_1 } from './level.js';

function loadGameA(): World {
  const w = new World();
  const bp = buildGameABlueprint(LEVEL_W1_1);
  for (const cap of bp.capabilities) for (const s of cap.systems) w.addSystem(s);
  for (const [id, comps] of Object.entries(bp.entities)) {
    w.createEntity(id);
    for (const [type, data] of Object.entries(comps)) w.addComponent(id, { ...data, type } as Component);
  }
  return w;
}

const Y = (w: World, id: string): number => w.getComponent<Transform>(id, 'Transform')!.y;
const X = (w: World, id: string): number => w.getComponent<Transform>(id, 'Transform')!.x;
const VY = (w: World, id: string): number => w.getComponent<Velocity>(id, 'Velocity')!.vy;

function step(w: World, cmds: Command[]): void {
  applyCommands(w, cmds);
  w.tick();
}
const move = (playerId: string, dx: number): Command => ({ playerId, tick: 0, move: { dx, dy: 0 } });
const jump = (playerId: string): Command => ({ playerId, tick: 0, move: { dx: 0, dy: 0 }, jump: true });

describe('Game A v0.1 — 双人平台跳跃核心闭环', () => {
  it('两名玩家受重力落到地面静止（蓝 A / 橙 B）', () => {
    const w = loadGameA();
    for (let i = 0; i < 80; i++) step(w, []);
    // 地面顶边 372 - 24 = 348；玩家半高 15 → 静止 y ≈ 333（与引擎平台跳跃同算法）
    expect(Math.abs(Y(w, 'playerA') - 333)).toBeLessThan(1);
    expect(Math.abs(Y(w, 'playerB') - 333)).toBeLessThan(1);
  });

  it('落地后按跳跃键 → 向上冲量（jump 在 Commit 覆写 vy = -JUMP_SPEED）', () => {
    const w = loadGameA();
    for (let i = 0; i < 80; i++) step(w, []);
    step(w, [jump(PLAYER_A)]);
    expect(VY(w, 'playerA')).toBe(-JUMP_SPEED);
  });

  it('空中不能二段跳（离地后 ground-sense 不再标 Grounded → 再按跳无效）', () => {
    const w = loadGameA();
    for (let i = 0; i < 80; i++) step(w, []);
    step(w, [jump(PLAYER_A)]); // 起跳
    step(w, [jump(PLAYER_A)]); // 空中再按
    // 第二次无效：vy 只被重力改大（> -JUMP_SPEED），未被重置为 -14
    expect(VY(w, 'playerA')).toBeGreaterThan(-JUMP_SPEED);
  });

  it('命令按 playerId 路由：只给 A 命令（向左离开）时 B 水平不动', () => {
    const w = loadGameA();
    for (let i = 0; i < 80; i++) step(w, []);
    const bx = X(w, 'playerB');
    // A 向左离开 B（两人出生相邻，避免物理推挤干扰"路由"判定）：B 无命令 → vx 归零 → 水平不动
    for (let i = 0; i < 10; i++) step(w, [move(PLAYER_A, -1)]);
    expect(X(w, 'playerB')).toBe(bx);
  });

  it('确定性：同输入脚本两次运行 → 同最终哈希', () => {
    const run = (): string => {
      const w = loadGameA();
      const script: Command[][] = [
        [],
        [move(PLAYER_A, 1)],
        [jump(PLAYER_A), move(PLAYER_B, -1)],
        [],
        [move(PLAYER_B, 1), jump(PLAYER_B)],
        [move(PLAYER_A, -1)],
      ];
      for (let i = 0; i < 60; i++) step(w, script[i % script.length]);
      return hashSnapshot(w.snapshot());
    };
    expect(run()).toBe(run());
  });
});
