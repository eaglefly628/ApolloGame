// Game 102 · Pixel Pour —— S3 骨架关机器门：manifest 立起 + 引擎 load + 2tick 空跑（「能存必须能跑」）。
// 另证 tilemap 适配核对结论：棋盘=实体阵，group-count 能按色数出在板同色格（tilemap 做不到的事）。
import { describe, it, expect } from 'vitest';
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import type { Resource } from '@zerocraft/engine/engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { LEVEL_1 } from './levels.js';

const res = (e: Engine, entityId: string): number =>
  e.world.getComponent<Resource>(entityId, 'Resource')?.current ?? NaN;

// L1 位图逐色像素块统计（断言用·palette 通用·index 对齐 LEVEL_1.palette）。
function paintedByColor(): { byName: Record<string, number>; total: number } {
  const byName: Record<string, number> = {};
  for (const n of LEVEL_1.palette) byName[n] = 0;
  let total = 0;
  for (const row of LEVEL_1.bitmap) {
    for (const ch of row) {
      if (ch === '.') continue;
      const idx = Number(ch);
      if (Number.isNaN(idx) || !LEVEL_1.palette[idx]) continue;
      byName[LEVEL_1.palette[idx]]++; total++;
    }
  }
  return { byName, total };
}

describe('Game 102 · Pixel Pour（S3 骨架关）', () => {
  it('蓝图是纯数据：消费现有能力 + 关键单例齐全（零专属系统）', () => {
    const bp = buildBlueprint();
    // 纯数据可序列化（无函数/类实例走私）。
    expect(() => JSON.stringify(bp.entities)).not.toThrow();
    // 声明的能力全是引擎既有能力对象。
    expect(bp.capabilities.length).toBeGreaterThanOrEqual(10);
    for (const cap of bp.capabilities) expect(typeof cap.id).toBe('string');
    // 关键结构单例齐全（新模型：计数器 + 计量 + 流程 + 模板库）。
    const ids = Object.keys(bp.entities);
    for (const key of ['rng', 'flow', 'score', 'combo', 'moves', 'remain-total', 'conveyor-count', 'tray-count', 'prefabs', 'door-marker']) {
      expect(ids).toContain(key);
    }
    // 每色一个 group-count 计数器。
    for (const name of LEVEL_1.palette) expect(ids).toContain(`remain-${name}`);
  });

  it('棋盘=一格一实体（tilemap 适配核对结论）：位图 painted 格数 = BoardCell 实体数', () => {
    const bp = buildBlueprint();
    const cellIds = Object.keys(bp.entities).filter((k) => k.startsWith('cell-'));
    expect(cellIds.length).toBe(paintedByColor().total);
    // 满格像素画：无 '.' 空格 → 格数 = cols×rows。
    expect(cellIds.length).toBe(LEVEL_1.cols * LEVEL_1.rows);
  });

  it('真引擎 load + 2tick 空跑不崩（能存必须能跑）', () => {
    const e = new Engine();
    expect(() => e.load(buildBlueprint())).not.toThrow();
    expect(() => { e.world.tick(); e.world.tick(); }).not.toThrow();
  });

  it('group-count 按色数出在板同色格（实体路线的核心增益·tilemap 表达不了）', () => {
    const e = new Engine();
    e.load(buildBlueprint());
    e.world.tick(); e.world.tick();
    const { byName } = paintedByColor();
    for (const name of LEVEL_1.palette) {
      expect(res(e, `remain-${name}`)).toBe(byName[name]);
    }
  });

  it('确定性：同 seed 两次装载 tick 后 hash 一致（lockstep-safe）', () => {
    const a = new Engine(); a.load(buildBlueprint()); a.world.tick(); a.world.tick();
    const b = new Engine(); b.load(buildBlueprint()); b.world.tick(); b.world.tick();
    expect(a.hash()).toBe(b.hash());
  });
});
