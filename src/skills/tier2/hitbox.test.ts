import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Hitbox, Tag, Status, Resource, Trigger, Transform, Shape, Sensor, OverTime } from '@engine/protocol/components.js';
import { hitboxCapability } from './hitbox.js';
import { triggerZoneCapability, ZONE_FLAG } from './trigger-zone.js';
import { resourceCapability } from '@atom-skills/index.js';
import { overlapDetectCapability } from '@skills/atoms/overlap-detect/index.js';

// 阵营/状态位（游戏数据自定义；测试里固定一套）。
const ENEMY = 1 << 1;
const PLAYER = 1 << 2;
const FROZEN = 1 << 0;

const hp = (w: World, e: string): number => w.getComponent<Resource>(e, 'Resource')!.current;
const status = (w: World, e: string): number => w.getComponent<Status>(e, 'Status')?.flags ?? 0;

// 语义测试：手工放 Trigger（跳过空间层），只加 hitbox + resource-apply 系统。
function combatWorld(): World {
  const w = new World();
  for (const s of hitboxCapability.systems) w.addSystem(s);
  for (const s of resourceCapability.systems) w.addSystem(s);
  return w;
}
function mob(w: World, id: string, tagFlags = ENEMY, statusFlags?: number): void {
  w.createEntity(id);
  w.addComponent(id, { type: 'Tag', flags: tagFlags } as Tag);
  w.addComponent(id, { type: 'Resource', id: 'hp', current: 100, min: 0, max: 100 } as Resource);
  if (statusFlags !== undefined) w.addComponent(id, { type: 'Status', flags: statusFlags } as Status);
}
function zone(w: World, id: string, hb: Omit<Hitbox, 'type'>): void {
  w.createEntity(id);
  w.addComponent(id, { type: 'Hitbox', ...hb } as Hitbox);
}
function trigger(w: World, zoneId: string, other: string): void {
  const tid = `trig:${zoneId}:${other}`;
  w.createEntity(tid);
  w.addComponent(tid, { type: 'Trigger', zone: zoneId, other } as Trigger);
}

describe('hitbox — 元数据 / 定序', () => {
  it('id / runsAfter trigger-zone / runsBefore resource-apply（定序正确）', () => {
    expect(hitboxCapability.id).toBe('t2-hitbox');
    const sys = hitboxCapability.systems[0];
    expect(sys.runsAfter).toContain('trigger-zone');
    expect(sys.runsBefore).toContain('resource-apply');
  });
});

describe('hitbox — 命中结算（接触→伤害 / 逐目标 / 状态）', () => {
  it('命中敌人：扣固定血 + 置 frozen（局部寻址，改目标自己的 hp）', () => {
    const w = combatWorld();
    zone(w, 'nova', { resource: 'hp', amount: 5, targetMask: ENEMY, setMask: FROZEN });
    mob(w, 'm1');
    trigger(w, 'nova', 'm1');
    w.tick();
    expect(hp(w, 'm1')).toBe(95);
    expect(status(w, 'm1') & FROZEN).toBe(FROZEN);
  });

  it('阵营过滤：targetMask=ENEMY 不伤 PLAYER', () => {
    const w = combatWorld();
    zone(w, 'nova', { resource: 'hp', amount: 5, targetMask: ENEMY });
    mob(w, 'p1', PLAYER);
    trigger(w, 'nova', 'p1');
    w.tick();
    expect(hp(w, 'p1')).toBe(100); // 未受伤
  });
});

describe('hitbox — 计算伤害 / 状态门（碎冰重锤）', () => {
  it('碎冰：只对 frozen 目标结算 20% maxHP 真伤并解冻', () => {
    const w = combatWorld();
    zone(w, 'smash', { resource: 'hp', fracOfMax: 0.2, targetMask: ENEMY, requireMask: FROZEN, clearMask: FROZEN });
    mob(w, 'm1', ENEMY, FROZEN); // 已冰冻
    trigger(w, 'smash', 'm1');
    w.tick();
    expect(hp(w, 'm1')).toBe(80); // 100 - floor(100*0.2)
    expect(status(w, 'm1') & FROZEN).toBe(0); // 解冻
  });

  it('碎冰对未冰冻目标无效（requireMask 不满足）', () => {
    const w = combatWorld();
    zone(w, 'smash', { resource: 'hp', fracOfMax: 0.2, targetMask: ENEMY, requireMask: FROZEN });
    mob(w, 'm1', ENEMY, 0); // 无 frozen
    trigger(w, 'smash', 'm1');
    w.tick();
    expect(hp(w, 'm1')).toBe(100);
  });
});

describe('hitbox — 时间维度（命中挂 OverTime，D-003 集成）', () => {
  const ot = (w: World, e: string): OverTime | undefined => w.getComponent<OverTime>(e, 'OverTime');

  it('statusDuration：命中置 frozen + 挂"定时清除"OverTime（到期自动解冻，免手动清场）', () => {
    const w = combatWorld();
    zone(w, 'nova', { resource: 'hp', amount: 5, targetMask: ENEMY, setMask: FROZEN, statusDuration: 120 });
    mob(w, 'm1');
    trigger(w, 'nova', 'm1');
    w.tick();
    expect(status(w, 'm1') & FROZEN).toBe(FROZEN);
    expect(ot(w, 'm1')).toMatchObject({ duration: 120, clearStatusOnEnd: FROZEN });
  });

  it('dotPerTick：命中挂燃烧 DoT OverTime', () => {
    const w = combatWorld();
    zone(w, 'fire', { resource: 'hp', amount: 0, targetMask: ENEMY, dotPerTick: 5, dotPeriod: 30, dotDuration: 180 });
    mob(w, 'm1');
    trigger(w, 'fire', 'm1');
    w.tick();
    expect(ot(w, 'm1')).toMatchObject({ resource: 'hp', amountPerTick: -5, period: 30, duration: 180 });
  });
});

describe('hitbox — AOE fan-out', () => {
  it('一个伤害区 N 目标 → 各自结算', () => {
    const w = combatWorld();
    zone(w, 'nova', { resource: 'hp', amount: 10, targetMask: ENEMY, setMask: FROZEN });
    mob(w, 'm1');
    mob(w, 'm2');
    trigger(w, 'nova', 'm1');
    trigger(w, 'nova', 'm2');
    w.tick();
    expect(hp(w, 'm1')).toBe(90);
    expect(hp(w, 'm2')).toBe(90);
    expect(status(w, 'm2') & FROZEN).toBe(FROZEN);
  });
});

describe('hitbox — 全链路集成（overlap-detect→trigger-zone→hitbox→resource-apply）', () => {
  it('nova 伤害区与敌人重叠 → 真扣血 + 冻结（纯数据，零游戏代码）', () => {
    const w = new World();
    for (const s of overlapDetectCapability.systems) w.addSystem(s);
    for (const s of triggerZoneCapability.systems) w.addSystem(s);
    for (const s of hitboxCapability.systems) w.addSystem(s);
    for (const s of resourceCapability.systems) w.addSystem(s);

    // 伤害区：圆心原点的大 box，标 ZONE_FLAG + Sensor（感知不推开）+ Hitbox。
    w.createEntity('nova');
    w.addComponent('nova', { type: 'Transform', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } as Transform);
    w.addComponent('nova', { type: 'Shape', kind: 'box', width: 100, height: 100 } as Shape);
    w.addComponent('nova', { type: 'Sensor' } as Sensor);
    w.addComponent('nova', { type: 'Tag', flags: ZONE_FLAG } as Tag);
    w.addComponent('nova', { type: 'Hitbox', resource: 'hp', amount: 7, targetMask: ENEMY, setMask: FROZEN } as Hitbox);

    // 敌人：落在伤害区内。
    w.createEntity('enemy');
    w.addComponent('enemy', { type: 'Transform', x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } as Transform);
    w.addComponent('enemy', { type: 'Shape', kind: 'box', width: 20, height: 20 } as Shape);
    w.addComponent('enemy', { type: 'Tag', flags: ENEMY } as Tag);
    w.addComponent('enemy', { type: 'Resource', id: 'hp', current: 100, min: 0, max: 100 } as Resource);

    w.tick();
    expect(hp(w, 'enemy')).toBe(93);
    expect(status(w, 'enemy') & FROZEN).toBe(FROZEN);
  });
});
