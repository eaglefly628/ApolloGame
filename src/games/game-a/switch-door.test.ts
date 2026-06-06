import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { Transform, Flag } from '@engine/protocol/components.js';
import { applyCommands } from '@net/index.js';
import type { Command } from '@net/index.js';
import { buildGameABlueprint, PLAYER_A, PLAYER_B, COOP_ENTITY } from './blueprint.js';
import { LEVEL_SWITCH } from './level.js';

// 验证"踩开关→开门"是纯数据涌现（零游戏系统）：
// zone-occupancy（A 踩板→flag）→ event-when（flag→开/合信号）→ effect set-sensor（门 Sensor 开/合，REQ-008）。
function load(): World {
  const w = new World();
  const bp = buildGameABlueprint(LEVEL_SWITCH);
  for (const cap of bp.capabilities) for (const s of cap.systems) w.addSystem(s);
  for (const [id, comps] of Object.entries(bp.entities)) {
    w.createEntity(id);
    for (const [type, data] of Object.entries(comps)) w.addComponent(id, { ...data, type } as Component);
  }
  return w;
}
const X = (w: World, id: string): number => w.getComponent<Transform>(id, 'Transform')!.x;
function step(w: World, cmds: Command[]): void {
  applyCommands(w, cmds);
  w.tick();
}
const move = (playerId: string, dx: number): Command => ({ playerId, tick: 0, move: { dx, dy: 0 } });
const cleared = (w: World): boolean => !!w.getComponent<Flag>(COOP_ENTITY, 'Flag')?.active;

describe('Game A — 踩开关→开门（纯数据：zone-occupancy→event-when→effect set-sensor）', () => {
  it('A 站开关板 → 门变可穿过（Sensor 加上）；A 离开 → 门复原', () => {
    const w = load();
    for (let i = 0; i < 60; i++) step(w, []); // A 落到板上、B 落地
    expect(w.hasComponent('door1', 'Sensor')).toBe(true); // A 在板上 → 门开（可穿过）
    for (let i = 0; i < 50; i++) step(w, [move(PLAYER_A, -1)]); // A 向左离开板
    expect(w.hasComponent('door1', 'Sensor')).toBe(false); // A 离开 → 门合（复原实心）
  });

  it('门开时 B 穿过门到目标→通关；门合时 B 被挡、过不去', () => {
    // 门开：A 留板上（无指令），B 一路向右 → 越过门到右侧目标
    const wOpen = load();
    for (let i = 0; i < 60; i++) step(wOpen, []);
    for (let i = 0; i < 220; i++) step(wOpen, [move(PLAYER_B, 1)]);
    expect(X(wOpen, 'playerB')).toBeGreaterThan(440); // 穿过门(x~380)到了右侧
    expect(cleared(wOpen)).toBe(true); // B 到目标（goalRequires:['B']）→ 通关

    // 门合：A 向左离板（门复原），B 向右 → 卡在门左沿(368)前
    const wShut = load();
    for (let i = 0; i < 60; i++) step(wShut, []);
    for (let i = 0; i < 220; i++) step(wShut, [move(PLAYER_A, -1), move(PLAYER_B, 1)]);
    expect(X(wShut, 'playerB')).toBeLessThan(360); // 被门挡住
    expect(cleared(wShut)).toBe(false); // 过不去 → 未通关
  });
});
