import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { OverTime, Status, Resource } from '@engine/protocol/components.js';
import { overTimeCapability } from './over-time.js';
import { resourceCapability } from '@atom-skills/index.js';

const FROZEN = 1 << 0;
const hp = (w: World, e: string): number => w.getComponent<Resource>(e, 'Resource')!.current;
const status = (w: World, e: string): number => w.getComponent<Status>(e, 'Status')?.flags ?? 0;

// over-time 产局部 ResourceModify → resource-apply 结算。两系统即可（无需空间层）。
function world(): World {
  const w = new World();
  for (const s of overTimeCapability.systems) w.addSystem(s);
  for (const s of resourceCapability.systems) w.addSystem(s);
  return w;
}
function mob(w: World, id: string, ot: Omit<OverTime, 'type'>, opts?: { hp?: number; statusFlags?: number }): void {
  w.createEntity(id);
  w.addComponent(id, { type: 'Resource', id: 'hp', current: opts?.hp ?? 100, min: 0, max: 100 } as Resource);
  if (opts?.statusFlags !== undefined) w.addComponent(id, { type: 'Status', flags: opts.statusFlags } as Status);
  w.addComponent(id, { type: 'OverTime', ...ot } as OverTime);
}

describe('over-time — 元数据 / 定序', () => {
  it('id 正确 + runsBefore resource-apply（本帧产的 ResourceModify 当帧结算）', () => {
    expect(overTimeCapability.id).toBe('t2-over-time');
    expect(overTimeCapability.systems[0].runsBefore).toContain('resource-apply');
  });
});

describe('over-time — DoT（中毒/燃烧）', () => {
  it('每 period tick 掉 amountPerTick，到 duration 结算最后一拍后自销毁组件', () => {
    const w = world();
    mob(w, 'm1', { resource: 'hp', amountPerTick: -5, period: 2, duration: 6, elapsed: 0 });
    // elapsed 命中 2/4/6 各掉 5 → 共 -15；tick6 同帧到期移除。
    for (let i = 0; i < 6; i++) w.tick();
    expect(hp(w, 'm1')).toBe(85);
    expect(w.getComponent('m1', 'OverTime')).toBeUndefined(); // 到期自销毁组件
    // 实体仍在（只是效果结束），再 tick 不再掉血。
    w.tick();
    expect(hp(w, 'm1')).toBe(85);
  });

  it('DoT 受 Resource 下限钳制（打不到负血）', () => {
    const w = world();
    mob(w, 'm1', { resource: 'hp', amountPerTick: -100, period: 1, duration: 3, elapsed: 0 }, { hp: 50 });
    for (let i = 0; i < 3; i++) w.tick();
    expect(hp(w, 'm1')).toBe(0); // 钳在 min
  });
});

describe('over-time — 定时状态（冻结到期自动解除）', () => {
  it('duration 到点清 clearStatusOnEnd 位（免手动清场）', () => {
    const w = world();
    mob(w, 'm1', { period: 1, duration: 3, elapsed: 0, clearStatusOnEnd: FROZEN }, { statusFlags: FROZEN });
    expect(status(w, 'm1') & FROZEN).toBe(FROZEN);
    w.tick();
    w.tick();
    expect(status(w, 'm1') & FROZEN).toBe(FROZEN); // 未到期，仍冻
    w.tick(); // elapsed=3>=3 到期
    expect(status(w, 'm1') & FROZEN).toBe(0); // 自动解冻
    expect(w.getComponent('m1', 'OverTime')).toBeUndefined();
  });
});

describe('over-time — regen（缓回血，永久）', () => {
  it('duration<=0 永久，每 period 回复并钳进上限，不自销毁', () => {
    const w = world();
    mob(w, 'm1', { resource: 'hp', amountPerTick: 10, period: 1, duration: 0, elapsed: 0 }, { hp: 50 });
    for (let i = 0; i < 6; i++) w.tick();
    expect(hp(w, 'm1')).toBe(100); // 50→100 钳在上限
    expect(w.getComponent('m1', 'OverTime')).toBeDefined(); // 永久不销毁
  });
});

describe('over-time — 确定性', () => {
  it('同初值重跑 → 完全一致', () => {
    const run = (): string => {
      const w = world();
      mob(w, 'm1', { resource: 'hp', amountPerTick: -3, period: 2, duration: 10, elapsed: 0 });
      mob(w, 'm2', { resource: 'hp', amountPerTick: 7, period: 3, duration: 0, elapsed: 0 }, { hp: 40 });
      for (let i = 0; i < 8; i++) w.tick();
      return JSON.stringify(w.snapshot());
    };
    expect(run()).toBe(run());
  });
});
