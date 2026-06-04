import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { Flag } from '@engine/protocol/components.js';
import { applyCommands } from '@net/index.js';
import type { Command } from '@net/index.js';
import { buildGameABlueprint, PLAYER_A, PLAYER_B } from './blueprint.js';
import { LEVEL_W1_1 } from './level.js';
import { COOP_ENTITY, COOP_CLEAR_FLAG } from './coop-goal.js';

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

const cleared = (w: World): boolean => {
  const f = w.getComponent<Flag>(COOP_ENTITY, 'Flag');
  return !!f && f.id === COOP_CLEAR_FLAG && f.active;
};
function step(w: World, cmds: Command[]): void {
  applyCommands(w, cmds);
  w.tick();
}
const move = (playerId: string, dx: number): Command => ({ playerId, tick: 0, move: { dx, dy: 0 } });

describe('Game A v0.2-proto — 协作通关目标（双人缺一不可）', () => {
  it('初始两人都在左侧出生 → 未通关', () => {
    const w = loadGameA();
    for (let i = 0; i < 80; i++) step(w, []); // 落地，都在左侧
    expect(cleared(w)).toBe(false);
  });

  it('只有一人到达目标区 → 仍未通关（协作约束）', () => {
    const w = loadGameA();
    for (let i = 0; i < 80; i++) step(w, []);
    for (let i = 0; i < 240; i++) step(w, [move(PLAYER_A, 1)]); // 只 A 走到右侧目标
    expect(cleared(w)).toBe(false); // B 还在左侧 → 不算通关
  });

  it('两人都到达目标区 → 通关', () => {
    const w = loadGameA();
    for (let i = 0; i < 80; i++) step(w, []);
    for (let i = 0; i < 240; i++) step(w, [move(PLAYER_A, 1), move(PLAYER_B, 1)]); // 两人一起走到右侧
    expect(cleared(w)).toBe(true);
  });
});
