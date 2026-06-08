import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { Resource } from '@engine/protocol/components.js';
import { applyCommands } from '@net/index.js';
import type { Command } from '@net/index.js';
import { buildGameABlueprint, PLAYER_A, PLAYER_B } from './blueprint.js';
import { LEVEL_W1_3 } from './level.js';

// 两类"纯数据组合"出的新玩法（零游戏系统、未提新需求）：
//  ① 重量台：Switch.requires:['A','B'] → zone-occupancy 阈值=2 → 两人同站才开门。
//  ② 收集：gem = zone(任一玩家)→flag → event-when(edge) → effect destroy + effect modify-resource(coins)。
function load(): World {
  const w = new World();
  const bp = buildGameABlueprint(LEVEL_W1_3);
  for (const cap of bp.capabilities) for (const s of cap.systems) w.addSystem(s);
  for (const [id, comps] of Object.entries(bp.entities)) {
    w.createEntity(id);
    for (const [type, data] of Object.entries(comps)) w.addComponent(id, { ...data, type } as Component);
  }
  return w;
}
function step(w: World, cmds: Command[]): void {
  applyCommands(w, cmds);
  w.tick();
}
const move = (playerId: string, dx: number): Command => ({ playerId, tick: 0, move: { dx, dy: 0 } });
const coins = (w: World): number => w.getComponent<Resource>('score', 'Resource')?.current ?? -1;

describe('Game A — 纯数据组合的新玩法（零游戏系统）', () => {
  it('重量台：A、B 同时站上 → 门开；一人离开 → 门合（requires 双人）', () => {
    const w = load();
    for (let i = 0; i < 60; i++) step(w, []); // 两人落到台上
    expect(w.hasComponent('door1', 'Sensor')).toBe(true); // 两人都在 → 阈值 2 满足 → 门开
    for (let i = 0; i < 40; i++) step(w, [move(PLAYER_B, 1)]); // B 走出台
    expect(w.hasComponent('door1', 'Sensor')).toBe(false); // 缺一 → 门合（复原实心）
  });

  it('收集：玩家碰到金币 → 金币自毁 + coins++', () => {
    const w = load();
    for (let i = 0; i < 60; i++) step(w, []); // 落地
    expect(coins(w)).toBe(0);
    expect(w.getAllEntities()).toContain('gem1');
    expect(w.getAllEntities()).toContain('gem2');
    for (let i = 0; i < 140; i++) step(w, [move(PLAYER_A, 1)]); // 向右走过两枚金币
    expect(coins(w)).toBe(2); // 各加 1
    expect(w.getAllEntities()).not.toContain('gem1'); // 拾取后自毁
    expect(w.getAllEntities()).not.toContain('gem2');
  });
});
