import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { Camera } from '@engine/protocol/components.js';
import { applyCommands } from '@net/index.js';
import type { Command } from '@net/index.js';
import { buildGameABlueprint, PLAYER_A, PLAYER_B, CAMERA_ENTITY } from './blueprint.js';
import { LEVEL_SCROLL } from './level.js';

function load(): World {
  const w = new World();
  const bp = buildGameABlueprint(LEVEL_SCROLL);
  for (const cap of bp.capabilities) for (const s of cap.systems) w.addSystem(s);
  for (const [id, comps] of Object.entries(bp.entities)) {
    w.createEntity(id);
    for (const [type, data] of Object.entries(comps)) w.addComponent(id, { ...data, type } as Component);
  }
  return w;
}
const cam = (w: World): Camera => w.getComponent<Camera>(CAMERA_ENTITY, 'Camera')!;
function step(w: World, cmds: Command[]): void {
  applyCommands(w, cmds);
  w.tick();
}
const move = (playerId: string, dx: number): Command => ({ playerId, tick: 0, move: { dx, dy: 0 } });

describe('Game A 卷轴 demo — 合作相机（camera-follow，headless 验证相机逻辑）', () => {
  it('相机跟双人中点向右卷动，且钳在关卡内（不露界外）', () => {
    const w = load();
    for (let i = 0; i < 60; i++) step(w, []); // 落地，两人在左端
    const xStart = cam(w).offsetX;
    // 关卡 1920 宽、视口 640、zoom≈1（两人相邻）→ 左端钳到 halfW=320
    expect(xStart).toBeGreaterThanOrEqual(319);
    expect(xStart).toBeLessThan(360);

    for (let i = 0; i < 700; i++) step(w, [move(PLAYER_A, 1), move(PLAYER_B, 1)]); // 携手向右到右端
    const xEnd = cam(w).offsetX;
    expect(xEnd).toBeGreaterThan(xStart + 800); // 相机确实卷动了一大段
    expect(xEnd).toBeLessThanOrEqual(1920 - 320 + 1); // 右端钳到 maxX-halfW，不露界外
  });

  it('两人拉开距离 → 相机缩小（zoom 下降）以容纳两人', () => {
    const w = load();
    for (let i = 0; i < 60; i++) step(w, []);
    const zClose = cam(w).zoom; // 两人相邻 → 贴合缩放达上限 1
    expect(zClose).toBe(1);
    // 只 B 向右远离（A 留在最左端）→ 拉开 > 视口宽。注意：若移左侧的 A 反而会把 B 往右推、拉不开。
    for (let i = 0; i < 400; i++) step(w, [move(PLAYER_B, 1)]);
    expect(cam(w).zoom).toBeLessThan(0.9); // 包围盒超出视口 → 缩小
  });
});
