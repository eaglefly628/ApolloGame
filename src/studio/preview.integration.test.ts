import { describe, it, expect } from 'vitest';
import { Engine } from '../runtime/engine.js';
import type { WorldBlueprint } from '../assembly/demo.assembly.js';
import { demoBlueprint } from '../assembly/demo.assembly.js';
import { buildGameABlueprint, LEVEL_SCROLL } from '../games/game-a/index.js';
import { buildGameBBlueprint } from '../games/game-b/index.js';
import { buildGameCBlueprint } from '../games/game-c/index.js';

// 透视器预览路径的集成保护：把每个真实游戏的蓝图喂进引擎、真的跑 tick、读快照。
// 这是项目里第一组"蓝图→引擎→运行"的集成测试（此前 SESSION-HANDOFF §4 自审：零集成、
// 所有游戏蓝图从未在真实 ECS 循环里被 load+tick 过）。透视器的实时预览正是依赖这条路径。
const cases: Array<[string, () => WorldBlueprint]> = [
  ['demo', () => demoBlueprint],
  ['game-a', () => buildGameABlueprint(LEVEL_SCROLL)],
  ['game-b', () => buildGameBBlueprint()],
  ['game-c', () => buildGameCBlueprint()],
];

describe('数据透视器 · 预览路径集成（每个游戏蓝图 load+tick）', () => {
  for (const [name, build] of cases) {
    it(`${name}: load → 30 ticks 无异常，快照非空，hash 确定`, () => {
      const engine = new Engine({ tickRate: 60 });
      engine.load(build());
      expect(engine.world.getAllEntities().length).toBeGreaterThan(0);

      for (let i = 0; i < 30; i++) engine.world.tick();

      const snap = engine.world.snapshot();
      expect(Object.keys(snap).length).toBeGreaterThan(0);
      // 同一蓝图独立两次跑到同 tick → hash 必须一致（确定性，透视器"重跑"可复现）。
      const engine2 = new Engine({ tickRate: 60 });
      engine2.load(build());
      for (let i = 0; i < 30; i++) engine2.world.tick();
      expect(engine.hash()).toBe(engine2.hash());
    });
  }
});

describe('数据透视器 · 编辑初始数据→重跑能改变涌现结果', () => {
  it('game-c: 把材料资源拉高 → 升级链 Condition→Event→Effect 点亮 flag', () => {
    // 原始数据：材料全 0 → 跑多 tick 后没有衣服解锁。
    const base = buildGameCBlueprint();
    const e0 = new Engine({ tickRate: 60 });
    e0.load(base);
    for (let i = 0; i < 10; i++) e0.world.tick();
    const snap0 = e0.world.snapshot();
    const flags0 = Object.values(snap0).filter(
      (c) => (c['Flag'] as unknown as { active?: boolean } | undefined)?.active,
    ).length;

    // 把所有材料资源初始值拉满（模拟透视器里改字段 + 重跑）。
    const edited = buildGameCBlueprint();
    for (const comps of Object.values(edited.entities)) {
      const res = comps['Resource'] as unknown as { current: number } | undefined;
      if (res) res.current = 9999;
    }
    const e1 = new Engine({ tickRate: 60 });
    e1.load(edited);
    for (let i = 0; i < 10; i++) e1.world.tick();
    const snap1 = e1.world.snapshot();
    const flags1 = Object.values(snap1).filter(
      (c) => (c['Flag'] as unknown as { active?: boolean } | undefined)?.active,
    ).length;

    expect(flags0).toBe(0);
    expect(flags1).toBeGreaterThan(0); // 改数据 → 涌现出解锁，证明"数据驱动"在预览里可见
  });
});
