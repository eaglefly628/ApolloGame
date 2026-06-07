import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import type { Resource, Status, SpawnRequest } from '@engine/protocol/components.js';
import { buildGameDBlueprint, STATUS_FROZEN } from './blueprint.js';

const hp = (e: Engine, id: string): number => e.world.getComponent<Resource>(id, 'Resource')!.current;
const frozen = (e: Engine, id: string): boolean =>
  ((e.world.getComponent<Status>(id, 'Status')?.flags ?? 0) & STATUS_FROZEN) !== 0;

// 释放技能 = 发一条 SpawnRequest（数据）。真实游戏由输入层/AI 产，这里测试直接注入。
function cast(e: Engine, templateId: string, x: number, y: number, holder: string): void {
  e.world.createEntity(holder);
  e.world.addComponent(holder, { type: 'SpawnRequest', templateId, x, y } as SpawnRequest);
}

describe('Game D — ARPG 涌现式系统叠加（冰冻 → 碎冰，纯数据装配）', () => {
  it('蓝图可加载且确定（同初值重跑 hash 一致）', () => {
    const run = (): string => {
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameDBlueprint());
      for (let i = 0; i < 5; i++) e.world.tick();
      return e.hash();
    };
    expect(run()).toBe(run());
  });

  it('冰霜新星冻住范围内敌人 → 碎冰重锤只对冰冻目标结算 20% maxHP 真伤并解冻', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameDBlueprint());
    // 布局：enemy_a@(0,0) 在 nova(60宽@0,0 → -30..30) 内；
    //       enemy_b@(40,0) 在 nova 外、但在 smash(120@0,0 → -60..60) 内。

    // —— 阶段一：释放冰霜新星 @ (0,0) ——
    cast(e, 'frost_nova', 0, 0, 'cast_nova');
    for (let i = 0; i < 3; i++) e.world.tick();
    expect(frozen(e, 'enemy_a')).toBe(true); // 范围内 → 冻结
    expect(frozen(e, 'enemy_b')).toBe(false); // 范围外 → 不冻
    expect(hp(e, 'enemy_a')).toBe(100); // 纯 CC，未直接扣血

    // 模拟新星生命周期结束（self-destruct 列为 follow-up；此处手动清场，停止持续冻结）。
    e.world.destroyEntity('frost_nova#0:area');

    // —— 阶段二：释放碎冰重锤 @ (0,0)（范围覆盖 a 和 b）——
    cast(e, 'shatter_smash', 0, 0, 'cast_smash');
    for (let i = 0; i < 3; i++) e.world.tick();

    // 涌现式叠加：只有被冰冻的 enemy_a 触发碎冰结算（条件涌现，非硬编码）。
    expect(hp(e, 'enemy_a')).toBe(80); // 100 - floor(100*0.2) 真伤
    expect(frozen(e, 'enemy_a')).toBe(false); // 碎冰后解冻
    expect(hp(e, 'enemy_b')).toBe(100); // 在范围内但未冰冻 → 碎冰不结算
  });
});
