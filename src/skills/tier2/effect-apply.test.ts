import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Effect, Signal, Flag, Resource, State, EventWhen } from '@engine/protocol/components.js';
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
    expect(effectApplyCapability.components.writes).toEqual(['Flag', 'Resource', 'State']);
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
