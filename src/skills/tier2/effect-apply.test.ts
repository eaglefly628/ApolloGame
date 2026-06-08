import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Effect, Signal, Flag, Resource, State, EventWhen, Sensor, Visibility, DestroyRequest } from '@engine/protocol/components.js';
import { effectApplyCapability } from './effect-apply.js';
import { eventWhenCapability } from './event-when.js';

function worldWithEffect(): World {
  const w = new World();
  for (const s of effectApplyCapability.systems) w.addSystem(s);
  return w;
}
function signal(w: World, name: string): void {
  const e = `sig:${name}`;
  w.createEntity(e);
  w.addComponent(e, { type: 'Signal', name, source: 'test' } as Signal);
}
function effect(w: World, eid: string, ef: Omit<Effect, 'type'>): void {
  w.createEntity(eid);
  w.addComponent(eid, { type: 'Effect', ...ef } as Effect);
}

describe('T2 effect-apply — metadata', () => {
  it('id / 读 Effect+Signal / 写 Flag+Resource+State', () => {
    expect(effectApplyCapability.id).toBe('t2-effect-apply');
    expect(effectApplyCapability.components.reads).toEqual(['Effect', 'Signal']);
    expect(effectApplyCapability.components.writes).toEqual(['Flag', 'Resource', 'State', 'Sensor', 'Visibility', 'DestroyRequest']);
  });
});

describe('T2 effect-apply — 三种效果（信号在场才施加，按 id 全局定位）', () => {
  it('set-flag：把目标 Flag.active 设为布尔值', () => {
    const w = worldWithEffect();
    w.createEntity('gs');
    w.addComponent('gs', { type: 'Flag', id: 'confess', active: false } as Flag);
    effect(w, 'ef', { onSignal: 'love60', kind: 'set-flag', targetId: 'confess', value: true });
    signal(w, 'love60');
    w.tick();
    expect(w.getComponent<Flag>('gs', 'Flag')!.active).toBe(true);
  });

  it('modify-resource：按 id 全局加值并钳上下限', () => {
    const w = worldWithEffect();
    w.createEntity('gs');
    w.addComponent('gs', { type: 'Resource', id: 'hp', current: 5, min: 0, max: 100 } as Resource);
    effect(w, 'ef', { onSignal: 'trap', kind: 'modify-resource', targetId: 'hp', value: -10 });
    signal(w, 'trap');
    w.tick();
    expect(w.getComponent<Resource>('gs', 'Resource')!.current).toBe(0); // 5-10 钳到 min
  });

  it('set-state：设目标状态机 current', () => {
    const w = worldWithEffect();
    w.createEntity('gs');
    w.addComponent('gs', { type: 'State', fsmId: 'story', current: 'daily', previous: '' } as State);
    effect(w, 'ef', { onSignal: 'both_switches', kind: 'set-state', targetId: 'story', value: 'door_open' });
    signal(w, 'both_switches');
    w.tick();
    expect(w.getComponent<State>('gs', 'State')!.current).toBe('door_open');
  });

  it('set-flag 值为字符串 "false" → 关掉(防 Boolean("false")===true 陷阱, Reviewer Bug1)', () => {
    const w = worldWithEffect();
    w.createEntity('gs');
    w.addComponent('gs', { type: 'Flag', id: 'door', active: true } as Flag);
    effect(w, 'ef', { onSignal: 'close', kind: 'set-flag', targetId: 'door', value: 'false' });
    signal(w, 'close');
    w.tick();
    expect(w.getComponent<Flag>('gs', 'Flag')!.active).toBe(false);
  });

  it('信号不在场 → 不施加', () => {
    const w = worldWithEffect();
    w.createEntity('gs');
    w.addComponent('gs', { type: 'Flag', id: 'confess', active: false } as Flag);
    effect(w, 'ef', { onSignal: 'love60', kind: 'set-flag', targetId: 'confess', value: true });
    w.tick(); // 无信号
    expect(w.getComponent<Flag>('gs', 'Flag')!.active).toBe(false);
  });
});

describe('T2 effect-apply — 与 event-when 合链（Condition→Event→Effect 同 tick）', () => {
  it('好感越 60 → 信号 → 同 tick 置 flag（event-when=Update 先于 effect-apply=Commit）', () => {
    const w = new World();
    for (const s of eventWhenCapability.systems) w.addSystem(s);
    for (const s of effectApplyCapability.systems) w.addSystem(s);

    w.createEntity('gs');
    w.addComponent('gs', { type: 'Resource', id: 'affection_S', current: 65, min: 0, max: 100 } as Resource);
    w.addComponent('gs', { type: 'Flag', id: 'S_confess', active: false } as Flag);
    w.createEntity('ew');
    w.addComponent('ew', { type: 'EventWhen', signal: 'S_love_60', when: { kind: 'resource', id: 'affection_S', cmp: 'gte', value: 60 }, mode: 'edge', armed: false } as EventWhen);
    effect(w, 'ef', { onSignal: 'S_love_60', kind: 'set-flag', targetId: 'S_confess', value: true });

    w.tick();
    expect(w.getComponent<Flag>('gs', 'Flag')!.active).toBe(true);
  });
});

describe('T2 effect-apply — modify-resource 运算 op + 结算顺序 order（REQ-012）', () => {
  function worldWithRes(id: string, current: number, max = 1000): World {
    const w = worldWithEffect();
    w.createEntity('gs');
    w.addComponent('gs', { type: 'Resource', id, current, min: 0, max } as Resource);
    return w;
  }
  const res = (w: World, id = 'r') => w.getComponent<Resource>('gs', 'Resource')!.current;

  it("op:'mul' → current × value（×倍率，Balatro mult）", () => {
    const w = worldWithRes('mult', 4);
    effect(w, 'ef', { onSignal: 'score', kind: 'modify-resource', targetId: 'mult', op: 'mul', value: 1.5 });
    signal(w, 'score');
    w.tick();
    expect(res(w)).toBe(6); // 4 × 1.5
  });

  it("op:'set' → current = value（无视原值）", () => {
    const w = worldWithRes('chips', 5);
    effect(w, 'ef', { onSignal: 'reset', kind: 'modify-resource', targetId: 'chips', op: 'set', value: 20 });
    signal(w, 'reset');
    w.tick();
    expect(res(w)).toBe(20);
  });

  it("op:'add' 显式 → 与缺省一致（current + value）", () => {
    const w = worldWithRes('chips', 5);
    effect(w, 'ef', { onSignal: 'gain', kind: 'modify-resource', targetId: 'chips', op: 'add', value: 7 });
    signal(w, 'gain');
    w.tick();
    expect(res(w)).toBe(12);
  });

  it('order 升序结算：先 + 后 ×（order 1 加、order 2 乘）→ (10+5)×2 = 30', () => {
    const w = worldWithRes('score', 10);
    effect(w, 'ef_add', { onSignal: 'score', kind: 'modify-resource', targetId: 'score', op: 'add', value: 5, order: 1 });
    effect(w, 'ef_mul', { onSignal: 'score', kind: 'modify-resource', targetId: 'score', op: 'mul', value: 2, order: 2 });
    signal(w, 'score');
    w.tick();
    expect(res(w)).toBe(30); // (10+5)*2
  });

  it('order 升序结算：先 × 后 +（order 1 乘、order 2 加）→ (10×2)+5 = 25 ≠ 30（顺序敏感）', () => {
    const w = worldWithRes('score', 10);
    effect(w, 'ef_mul', { onSignal: 'score', kind: 'modify-resource', targetId: 'score', op: 'mul', value: 2, order: 1 });
    effect(w, 'ef_add', { onSignal: 'score', kind: 'modify-resource', targetId: 'score', op: 'add', value: 5, order: 2 });
    signal(w, 'score');
    w.tick();
    expect(res(w)).toBe(25); // (10*2)+5 —— 与「先+后×」的 30 不同，证明 order 决定结果
  });

  it('order 并列 → 按 eid 字典序 tie-break（确定性，无关插入/查询顺序）', () => {
    // 两个 add 同 order，结果与顺序无关（加法可交换）；此测确认不抛错且确定结算两者。
    const w = worldWithRes('score', 0);
    effect(w, 'ef_b', { onSignal: 'score', kind: 'modify-resource', targetId: 'score', op: 'add', value: 3, order: 0 });
    effect(w, 'ef_a', { onSignal: 'score', kind: 'modify-resource', targetId: 'score', op: 'add', value: 4, order: 0 });
    signal(w, 'score');
    w.tick();
    expect(res(w)).toBe(7); // 3+4，两者都结算
  });

  it('mul 结果照样钳上下限（current × value 超 max → 钳到 max）', () => {
    const w = worldWithRes('mult', 60, /*max*/ 100);
    effect(w, 'ef', { onSignal: 'score', kind: 'modify-resource', targetId: 'mult', op: 'mul', value: 3, order: 0 });
    signal(w, 'score');
    w.tick();
    expect(res(w)).toBe(100); // 60*3=180 钳到 max
  });

  it('回归：老数据（无 op/order）行为不变 —— 仍按 add 结算', () => {
    const w = worldWithRes('hp', 5, /*max*/ 100);
    effect(w, 'ef', { onSignal: 'heal', kind: 'modify-resource', targetId: 'hp', value: 10 });
    signal(w, 'heal');
    w.tick();
    expect(res(w)).toBe(15); // 5+10，无 op 即 add
  });
});

describe('T2 effect-apply — 物理 kind（REQ-008：信号→物理改动，按 targetEntity）', () => {
  it('set-sensor true → 目标实体加 Sensor（踩开关 → 墙变可穿过）', () => {
    const w = worldWithEffect();
    w.createEntity('wall');
    effect(w, 'ef', { onSignal: 'plate_on', kind: 'set-sensor', targetId: '', targetEntity: 'wall', value: true });
    signal(w, 'plate_on');
    w.tick();
    expect(w.hasComponent('wall', 'Sensor')).toBe(true);
  });

  it('set-sensor false → 去掉 Sensor（墙恢复实心）', () => {
    const w = worldWithEffect();
    w.createEntity('wall');
    w.addComponent('wall', { type: 'Sensor' } as Sensor);
    effect(w, 'ef', { onSignal: 'plate_off', kind: 'set-sensor', targetId: '', targetEntity: 'wall', value: false });
    signal(w, 'plate_off');
    w.tick();
    expect(w.hasComponent('wall', 'Sensor')).toBe(false);
  });

  it('set-visible false → 切目标 Visibility.visible（门消失）', () => {
    const w = worldWithEffect();
    w.createEntity('door');
    w.addComponent('door', { type: 'Visibility', visible: true, active: true } as Visibility);
    effect(w, 'ef', { onSignal: 'open', kind: 'set-visible', targetId: '', targetEntity: 'door', value: false });
    signal(w, 'open');
    w.tick();
    expect(w.getComponent<Visibility>('door', 'Visibility')!.visible).toBe(false);
  });

  it('destroy → 在目标实体发 DestroyRequest（清障碍，destroy-apply 随后移除）', () => {
    const w = worldWithEffect();
    w.createEntity('rock');
    effect(w, 'ef', { onSignal: 'boom', kind: 'destroy', targetId: '', targetEntity: 'rock', value: true });
    signal(w, 'boom');
    w.tick();
    expect(w.getComponent<DestroyRequest>('rock', 'DestroyRequest')?.entityId).toBe('rock');
  });

  it('信号不在场 → 物理改动也不施加', () => {
    const w = worldWithEffect();
    w.createEntity('wall');
    effect(w, 'ef', { onSignal: 'plate_on', kind: 'set-sensor', targetId: '', targetEntity: 'wall', value: true });
    w.tick(); // 无信号
    expect(w.hasComponent('wall', 'Sensor')).toBe(false);
  });
});
