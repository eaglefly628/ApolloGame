import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { State, StateChanged, Text, Resource, Flag } from '@engine/protocol/components.js';
import { buildGameBBlueprint } from './blueprint.js';

// 端到端：用真实 World.tick() 跑 Game B 蓝图，验证 state/resource/flag/text + dialogue-runner
// 经拓扑排序在一个循环里协作，涌现出 VN 核心闭环。证明"现成原子可组合出 VN"。
function loadGameB(): World {
  const w = new World();
  const bp = buildGameBBlueprint();
  for (const cap of bp.capabilities) for (const s of cap.systems) w.addSystem(s);
  for (const [id, comps] of Object.entries(bp.entities)) {
    w.createEntity(id);
    for (const [type, data] of Object.entries(comps)) w.addComponent(id, { ...data, type } as Component);
  }
  return w;
}

const cur = (w: World): string => w.getComponent<State>('dialogue', 'State')!.current;
const txt = (w: World): string => w.getComponent<Text>('dialogue', 'Text')!.content;
const aff = (w: World): number => w.getComponent<Resource>('affection_S', 'Resource')!.current;

function advance(w: World): void {
  w.addComponent('dialogue', { type: 'DialogueAdvance' } as Component);
  w.tick();
}
function choose(w: World, index: number): void {
  w.addComponent('dialogue', { type: 'DialogueChoose', index } as Component);
  w.tick();
}

describe('Game B v0.1 — 对话/选择/好感核心闭环（现成原子组合出 VN）', () => {
  it('拓扑：runner 先于 state-sync 与 resource-apply（生产者先于消费者，无环）', () => {
    const w = loadGameB();
    w.tick();
    const ids = w.getSortedSystems().map((s) => s.id);
    expect(ids).toContain('dialogue-runner');
    expect(ids).toContain('state-sync');
    expect(ids).toContain('resource-apply');
    expect(ids.indexOf('dialogue-runner')).toBeLessThan(ids.indexOf('state-sync'));
    expect(ids.indexOf('dialogue-runner')).toBeLessThan(ids.indexOf('resource-apply'));
  });

  it('首 tick：runner 按 State 把首行写进 Text（state ⊕ text）', () => {
    const w = loadGameB();
    w.tick();
    expect(cur(w)).toBe('s1_l0');
    expect(txt(w)).toContain('你就是新来的制作人');
  });

  it('推进：DialogueAdvance → State.current 前进 → state-sync 发 StateChanged', () => {
    const w = loadGameB();
    w.tick(); // 渲染 l0
    advance(w); // l0 → l1
    expect(cur(w)).toBe('s1_l1');
    expect(txt(w)).toContain('不抱期待');
    const sc = w.getComponent<StateChanged>('dialogue', 'StateChanged');
    expect(sc?.to).toBe('s1_l1'); // state 原子确实在参与：发出了切换事件
    advance(w); // l1 → choice
    expect(cur(w)).toBe('s1_choice');
  });

  it('选择 A：DialogueChoose → ResourceModify 链改好感 +5 + 置 Flag + 跳 impressed', () => {
    const w = loadGameB();
    w.tick();
    advance(w);
    advance(w); // 到 s1_choice
    expect(cur(w)).toBe('s1_choice');
    expect(aff(w)).toBe(0);

    choose(w, 0); // 「我会证明自己的」+5 → s1_impressed
    expect(aff(w)).toBe(5); // resource 事件链结算
    expect(w.getComponent<Flag>('met_S', 'Flag')!.active).toBe(true); // flag 置位
    expect(cur(w)).toBe('s1_impressed'); // 分支跳转
    expect(txt(w)).toContain('有点意思');
  });

  it('选择 B：不同选择走不同故事（好感 +2 → 跳 polite）', () => {
    const w = loadGameB();
    w.tick();
    advance(w);
    advance(w);
    choose(w, 1); // 「请多指教」+2 → s1_polite
    expect(aff(w)).toBe(2);
    expect(cur(w)).toBe('s1_polite');
  });

  it('好感 clamp：不超过 max（resource 原子保证上界）', () => {
    const w = loadGameB();
    const r = w.getComponent<Resource>('affection_S', 'Resource')!;
    r.current = 98;
    w.tick();
    advance(w);
    advance(w);
    choose(w, 0); // +5 但 max=100
    expect(aff(w)).toBe(100);
  });

  it('确定性：同一选择序列两次跑出完全相同的世界快照（存档/重放基石）', () => {
    const run = (): string => {
      const w = loadGameB();
      w.tick();
      advance(w);
      advance(w);
      choose(w, 0);
      return JSON.stringify(w.snapshot());
    };
    expect(run()).toBe(run());
  });
});
