// Game 102 · Pixel Pour —— S3 骨架关机器门：manifest 立起 + 引擎 load + 2tick 空跑（「能存必须能跑」）。
// 另证 tilemap 适配核对结论：棋盘=实体阵，group-count 能按色数出在板同色格（tilemap 做不到的事）。
import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import type { Resource } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { LEVEL_1 } from './levels.js';

const res = (e: Engine, entityId: string): number =>
  e.world.getComponent<Resource>(entityId, 'Resource')?.current ?? NaN;

// L1 位图逐色像素块统计（断言用·手数）。
function paintedByColor(): { green: number; orange: number; red: number; total: number } {
  const acc = { green: 0, orange: 0, red: 0, total: 0 };
  const names = ['green', 'orange', 'red'] as const;
  for (const row of LEVEL_1.bitmap) {
    for (const ch of row) {
      if (ch === '.') continue;
      const idx = Number(ch);
      if (Number.isNaN(idx)) continue;
      acc[names[idx]]++; acc.total++;
    }
  }
  return acc;
}

describe('Game 102 · Pixel Pour（S3 骨架关）', () => {
  it('蓝图是纯数据：消费现有能力 + 关键单例齐全（零专属系统）', () => {
    const bp = buildBlueprint();
    // 纯数据可序列化（无函数/类实例走私）。
    expect(() => JSON.stringify(bp.entities)).not.toThrow();
    // 声明的能力全是引擎既有能力对象。
    expect(bp.capabilities.length).toBeGreaterThanOrEqual(10);
    for (const cap of bp.capabilities) expect(typeof cap.id).toBe('string');
    // 关键结构单例齐全。
    const ids = Object.keys(bp.entities);
    for (const key of ['rng', 'conveyor', 'tray', 'flow', 'score', 'combo', 'keys', 'door', 'door-marker']) {
      expect(ids).toContain(key);
    }
    // 每色一个 group-count 计数器。
    for (const name of LEVEL_1.palette) expect(ids).toContain(`remain-${name}`);
  });

  it('棋盘=一格一实体（tilemap 适配核对结论）：位图 painted 格数 = BoardCell 实体数', () => {
    const bp = buildBlueprint();
    const cellIds = Object.keys(bp.entities).filter((k) => k.startsWith('cell-'));
    expect(cellIds.length).toBe(paintedByColor().total);
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
    const p = paintedByColor();
    expect(res(e, 'remain-green')).toBe(p.green);
    expect(res(e, 'remain-orange')).toBe(p.orange);
    expect(res(e, 'remain-red')).toBe(p.red);
  });

  it('确定性：同 seed 两次装载 tick 后 hash 一致（lockstep-safe）', () => {
    const a = new Engine(); a.load(buildBlueprint()); a.world.tick(); a.world.tick();
    const b = new Engine(); b.load(buildBlueprint()); b.world.tick(); b.world.tick();
    expect(a.hash()).toBe(b.hash());
  });
});
