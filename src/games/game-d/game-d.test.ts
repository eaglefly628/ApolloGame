import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import type { Resource, Status, Velocity, Transform, SpawnRequest, Signal, ResourceModify } from '@engine/protocol/components.js';
import { buildGameDBlueprint, STATUS_FROZEN, LOOT_FLAG } from './blueprint.js';

const hp = (e: Engine, id: string): number => e.world.getComponent<Resource>(id, 'Resource')!.current;
const frozen = (e: Engine, id: string): boolean =>
  ((e.world.getComponent<Status>(id, 'Status')?.flags ?? 0) & STATUS_FROZEN) !== 0;
const vx = (e: Engine, id: string): number => e.world.getComponent<Velocity>(id, 'Velocity')?.vx ?? 0;
const tx = (e: Engine, id: string): number => e.world.getComponent<Transform>(id, 'Transform')!.x;
const alive = (e: Engine, id: string): boolean => e.world.getAllEntities().includes(id);

// 释放技能 = 注入一条 SpawnRequest（数据）。真实游戏由输入层经 caster 产；定点 AoE 直接注入到指定坐标。
function castAt(e: Engine, templateId: string, x: number, y: number, holder: string): void {
  e.world.createEntity(holder);
  e.world.addComponent(holder, { type: 'SpawnRequest', templateId, x, y } as SpawnRequest);
}
// 注入一个具名信号（模拟"输入绑定触发"），用于驱动 caster。
function fireSignal(e: Engine, name: string, holder: string): void {
  e.world.createEntity(holder);
  e.world.addComponent(holder, { type: 'Signal', name, source: holder } as Signal);
}

describe('Game D — ARPG 完整切片（纯数据装配，零 ARPG 代码）', () => {
  it('蓝图可加载且确定（同初值重跑 hash 一致）', () => {
    const run = (): string => {
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameDBlueprint());
      for (let i = 0; i < 10; i++) e.world.tick();
      return e.hash();
    };
    expect(run()).toBe(run());
  });

  it('AI：怪自动锁定并追逐英雄（aggro+steering=ai-chase，纯数据）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameDBlueprint());
    const x0 = tx(e, 'enemy_a'); // 120
    for (let i = 0; i < 30; i++) e.world.tick();
    const x1 = tx(e, 'enemy_a');
    expect(x1).toBeLessThan(x0); // 朝英雄(0,0)方向靠近
    expect(x1).toBeGreaterThan(0); // 还没穿过英雄
  });

  it('D-002 caster：信号 → 英雄 at:"target" 自动索敌放烈焰（复用 aggro 的 Relation）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameDBlueprint());
    for (let i = 0; i < 5; i++) e.world.tick(); // aggro 给英雄写 Relation(最近敌人)
    fireSignal(e, 'cast_flame', 'sig_flame');
    e.world.tick(); // caster 读英雄 Relation → 在最近敌人处展开 flame
    e.world.destroyEntity('sig_flame'); // 停掉信号，避免每帧重放
    // flame 伤害区已展开（at:'target' 走通）。
    const flameSpawned = e.world.getAllEntities().some((id) => id.startsWith('flame#'));
    expect(flameSpawned).toBe(true);
  });

  it('D-003 over-time：冰冻=定身 + 90 tick 后自动解冻（修掉"手动清场"hack）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameDBlueprint());
    for (let i = 0; i < 10; i++) e.world.tick();
    // 在 enemy_a 当前位置放冰霜新星。
    castAt(e, 'frost_nova', tx(e, 'enemy_a'), e.world.getComponent<Transform>('enemy_a', 'Transform')!.y, 'cast_nova');
    for (let i = 0; i < 4; i++) e.world.tick();
    expect(frozen(e, 'enemy_a')).toBe(true); // 冻住
    expect(vx(e, 'enemy_a')).toBe(0); // 冻=定身（steering.haltStatusMask）→ 停止追逐
    // 持续 tick 越过 statusDuration(90) → 自动解冻（无人手动 destroy）。
    for (let i = 0; i < 110; i++) e.world.tick();
    expect(frozen(e, 'enemy_a')).toBe(false); // 自动解冻
    expect(vx(e, 'enemy_a')).not.toBe(0); // 解冻后恢复追逐
  });

  it('涌现叠加：冰冻 → 碎冰只对冰冻目标结算 20% 真伤并解冻（条件涌现自数据）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameDBlueprint());
    const ay = e.world.getComponent<Transform>('enemy_a', 'Transform')!.y;
    const ax = tx(e, 'enemy_a');
    // 冻住 enemy_a。
    castAt(e, 'frost_nova', ax, ay, 'cast_nova');
    for (let i = 0; i < 3; i++) e.world.tick();
    expect(frozen(e, 'enemy_a')).toBe(true);
    expect(hp(e, 'enemy_a')).toBe(100); // 纯 CC 未掉血
    e.world.destroyEntity('frost_nova#0:area'); // 清掉新星区（其实 lifetime 已自毁，这里幂等保险）

    // 在 enemy_a 当前位置放碎冰重锤。
    castAt(e, 'shatter_smash', tx(e, 'enemy_a'), ay, 'cast_smash');
    for (let i = 0; i < 3; i++) e.world.tick();
    expect(hp(e, 'enemy_a')).toBe(80); // 100 - floor(100*0.2) 真伤（只因它被冰冻）
    expect(frozen(e, 'enemy_a')).toBe(false); // 碎冰后解冻
  });

  it('D-001 死亡掉落：怪 hp 归零 → 销毁 + 原地掉落 loot（mortal.dropTemplate）', () => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameDBlueprint());
    const cy = e.world.getComponent<Transform>('enemy_c', 'Transform')!.y;
    const cx = tx(e, 'enemy_c');
    // 直接给 enemy_c 致命局部伤害（模拟被打死）。
    e.world.addComponent('enemy_c', { type: 'ResourceModify', resourceId: 'hp', amount: -100, scope: 'local' } as ResourceModify);
    e.world.tick();
    expect(alive(e, 'enemy_c')).toBe(false); // 死亡销毁
    // 原地掉落物展开（loot 模板，Tag=LOOT_FLAG）。
    const loot = e.world.getAllEntities().find((id) => id.startsWith('loot#'));
    expect(loot).toBeDefined();
    const lt = e.world.getComponent<Transform>(loot!, 'Transform')!;
    // 掉落在怪的死亡位置（容忍死亡那帧 ai 的 1px 位移）。
    expect(Math.abs(lt.x - cx)).toBeLessThan(3);
    expect(Math.abs(lt.y - cy)).toBeLessThan(3);
  });
});
