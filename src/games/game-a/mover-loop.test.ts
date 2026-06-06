import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { Transform } from '@engine/protocol/components.js';
import { buildGameABlueprint } from './blueprint.js';
import { LEVEL_SCROLL } from './level.js';

// 验证 REQ-004 端到端：关卡数据里一个 Mover 标 loop:'pingpong'（纯数据）→ 平台持续往复，
// 没有任何游戏专属代码（Tween 引擎能力驱动）。
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
const moverY = (w: World): number => w.getComponent<Transform>('mover0', 'Transform')!.y;

describe('Game A — 连续巡逻平台（Tween pingpong，REQ-004 端到端，纯数据）', () => {
  it('升降电梯持续往复：到顶折返、不停在终点', () => {
    const w = load();
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < 500; i++) {
      w.tick();
      const y = moverY(w);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    expect(minY).toBeLessThan(165); // 到过顶端附近（to=160）
    expect(maxY).toBeGreaterThan(295); // 又折返回底端附近（from=300）→ 持续往复
  });
});
