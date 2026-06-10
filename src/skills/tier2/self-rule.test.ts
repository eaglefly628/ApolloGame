import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { SelfRule, Resource, Flag } from '@engine/protocol/components.js';
import { selfRuleCapability, evaluateSelfCondition } from './self-rule.js';

function mk(): World {
  const w = new World();
  for (const s of selfRuleCapability.systems) w.addSystem(s);
  return w;
}
const unit = (w: World, id: string, rule: Omit<SelfRule, 'type'>, comps: Record<string, unknown>[] = []) => {
  w.createEntity(id);
  w.addComponent(id, { type: 'SelfRule', ...rule } as SelfRule);
  for (const c of comps) w.addComponent(id, c as never);
};
const res = (id: string, current: number, min = 0, max = 1000) => ({ type: 'Resource', id, current, min, max });
const flag = (id: string, active = false) => ({ type: 'Flag', id, active });
const R = (w: World, e: string) => w.getComponent<Resource>(e, 'Resource')!;
const F = (w: World, e: string) => w.getComponent<Flag>(e, 'Flag')!;

describe('self-rule · 实体本地条件求值（读自身组件，非全局）', () => {
  it('resource/flag 读自身那一份；id 给了则校验', () => {
    const w = mk();
    w.createEntity('u'); w.addComponent('u', res('hp', 5) as never); w.addComponent('u', flag('berserk', true) as never);
    expect(evaluateSelfCondition(w, 'u', { kind: 'resource', id: 'hp', cmp: 'lte', value: 5 })).toBe(true);
    expect(evaluateSelfCondition(w, 'u', { kind: 'resource', id: 'hp', cmp: 'lte', value: 5 })).toBe(true);
    expect(evaluateSelfCondition(w, 'u', { kind: 'resource', id: 'mana', cmp: 'lte', value: 5 })).toBe(false); // id 不符
    expect(evaluateSelfCondition(w, 'u', { kind: 'flag', id: 'berserk' })).toBe(true);
    expect(evaluateSelfCondition(w, 'u', { kind: 'and', of: [{ kind: 'resource', id: 'hp', cmp: 'gt', value: 0 }, { kind: 'flag', id: 'berserk' }] })).toBe(true);
  });
});

describe('self-rule · level：通用化 mortal（自身 HP≤0 → destroy 自身）', () => {
  it('多单位各自治：HP≤0 的死、其余活（每实体只判/写自身）', () => {
    const w = mk();
    const deathRule = { when: { kind: 'resource' as const, id: 'hp', cmp: 'lte' as const, value: 0 }, do: [{ kind: 'destroy' as const }] };
    unit(w, 'A', deathRule, [res('hp', 0)]);
    unit(w, 'B', deathRule, [res('hp', 5)]);
    w.tick();
    expect(w.hasComponent('A', 'DestroyRequest')).toBe(true);  // A 死
    expect(w.hasComponent('B', 'DestroyRequest')).toBe(false); // B 活
  });
});

describe('self-rule · once：上升沿只施一次（迟滞）', () => {
  it('血<30 → 置 berserk 一次；持续<30 不重复；回血>30 复位、再掉血再触发', () => {
    const w = mk();
    unit(w, 'u', {
      when: { kind: 'resource', id: 'hp', cmp: 'lt', value: 30 },
      do: [{ kind: 'set-flag', value: true }],
      once: true,
    }, [res('hp', 20), flag('x', false)]);
    w.tick();
    expect(F(w, 'u').active).toBe(true); // 首次触发
    F(w, 'u').active = false; // 手动清，验证不重复施
    w.tick();
    expect(F(w, 'u').active).toBe(false); // 仍 <30 但 armed → 不重复
    R(w, 'u').current = 50; w.tick(); // 回血 >30 → 复位 armed
    R(w, 'u').current = 10; w.tick(); // 再掉 <30 → 再次触发
    expect(F(w, 'u').active).toBe(true);
  });
});

describe('self-rule · level modify-resource：满怒清零（每拍检）', () => {
  it('rage≥100 → set 0（对自身）', () => {
    const w = mk();
    unit(w, 'u', {
      when: { kind: 'resource', id: 'rage', cmp: 'gte', value: 100 },
      do: [{ kind: 'modify-resource', op: 'set', value: 0 }],
    }, [res('rage', 120, 0, 200)]);
    w.tick();
    expect(R(w, 'u').current).toBe(0);
  });
});

describe('self-rule · spawn 动作（self 轴的 caster 对偶，REQ-021 扩展）', () => {
  const xf = (x: number, y: number) => ({ type: 'Transform', x, y, rotation: 0, scaleX: 1, scaleY: 1 });
  const target = (id: string) => ({ type: 'Relation', kind: 'target', targetId: id });
  const spawnReq = (w: World, e: string) =>
    w.getComponent(e, 'SpawnRequest') as unknown as { templateId: string; x: number; y: number } | undefined;

  it('at:self → 在自身位置发 SpawnRequest', () => {
    const w = mk();
    unit(w, 'u', { when: { kind: 'always' }, do: [{ kind: 'spawn', template: 'bolt', at: 'self' }] }, [xf(10, 20)]);
    w.tick();
    expect(spawnReq(w, 'u')).toMatchObject({ templateId: 'bolt', x: 10, y: 20 });
  });

  it('at:target → 在自身 Relation(target) 的位置发 SpawnRequest', () => {
    const w = mk();
    w.createEntity('enemy'); w.addComponent('enemy', xf(99, 77) as never);
    unit(w, 'u', { when: { kind: 'always' }, do: [{ kind: 'spawn', template: 'strike', at: 'target' }] }, [xf(0, 0), target('enemy')]);
    w.tick();
    expect(spawnReq(w, 'u')).toMatchObject({ templateId: 'strike', x: 99, y: 77 });
  });

  it('at:target 无目标 → 不生成（目标存在性即战斗门，免全局 in_combat 旗标）', () => {
    const w = mk();
    unit(w, 'u', { when: { kind: 'always' }, do: [{ kind: 'spawn', template: 'strike', at: 'target' }] }, [xf(0, 0)]); // 无 Relation
    w.tick();
    expect(spawnReq(w, 'u')).toBeUndefined();
  });

  it('★ 同模板多实例各自按自身节拍生成（三星合体命门：唯一 id 脚手架表达不了，self-rule 可）', () => {
    const w = mk();
    w.createEntity('foe'); w.addComponent('foe', xf(100, 100) as never);
    // 三个"同一份数据"的单位（模拟 prefab 同模板展开）：完全相同的 SelfRule + 相同 template，区别只在位置/计时。
    const sameRule: Omit<SelfRule, 'type'> = { when: { kind: 'timer', id: 'atk', cmp: 'gte', value: 30 }, do: [{ kind: 'spawn', template: 'strike', at: 'target' }] };
    unit(w, 'guan#1', sameRule, [xf(0, 0), target('foe'), { type: 'Timer', id: 'atk', elapsed: 30, duration: 30, loop: true }]);
    unit(w, 'guan#2', sameRule, [xf(10, 0), target('foe'), { type: 'Timer', id: 'atk', elapsed: 5, duration: 30, loop: true }]); // 未到点
    unit(w, 'guan#3', sameRule, [xf(20, 0), target('foe'), { type: 'Timer', id: 'atk', elapsed: 30, duration: 30, loop: true }]);
    w.tick();
    // #1/#3 各自到点发了一发（不串台、不齐射）；#2 未到点不发。全局 caster+signal 做不到这种"各自节拍"。
    expect(spawnReq(w, 'guan#1')).toMatchObject({ templateId: 'strike' });
    expect(spawnReq(w, 'guan#2')).toBeUndefined();
    expect(spawnReq(w, 'guan#3')).toMatchObject({ templateId: 'strike' });
  });
});

describe('self-rule · 确定性（跨实体无干扰）', () => {
  it('两单位同规则同输入 → 同结果，与创建/遍历序无关', () => {
    const build = (order: string[]) => {
      const w = mk();
      const rule = { when: { kind: 'resource' as const, id: 'hp', cmp: 'lte' as const, value: 0 }, do: [{ kind: 'destroy' as const }] };
      for (const id of order) unit(w, id, rule, [res('hp', id === 'dead' ? 0 : 9)]);
      w.tick();
      return w;
    };
    const a = build(['dead', 'alive']);
    const b = build(['alive', 'dead']); // 反序创建
    expect(a.hasComponent('dead', 'DestroyRequest')).toBe(b.hasComponent('dead', 'DestroyRequest'));
    expect(a.hasComponent('alive', 'DestroyRequest')).toBe(false);
    expect(b.hasComponent('alive', 'DestroyRequest')).toBe(false);
  });
});
