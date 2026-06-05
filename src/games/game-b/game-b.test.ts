import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { State, StateChanged, Text, Resource, Flag } from '@engine/protocol/components.js';
import { buildGameBBlueprint } from './blueprint.js';
import { optionAvailable } from '@skills/tier3/index.js';
import { SCENE_01 } from './data/dialogue.js';

// 端到端：真实 World.tick() 跑 Game B v0.2，验证 state/resource/flag/text + event-when/effect-apply
// + 通用 dialogue 运行器（R15 下沉，脚本=世界里的 DialogueScript 数据组件）协作，
// 涌现 VN 循环 + 阈值事件链 + 条件门控选项。Game B = 纯数据（manifest + scene_01.json + 资产 + 主题）。
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
const res = (w: World, id: string): number => w.getComponent<Resource>(id, 'Resource')!.current;
const flag = (w: World, id: string): boolean => w.getComponent<Flag>(id, 'Flag')!.active;

function advance(w: World): void {
  w.addComponent('dialogue', { type: 'DialogueAdvance' } as Component);
  w.tick();
}
function choose(w: World, index: number): void {
  w.addComponent('dialogue', { type: 'DialogueChoose', index } as Component);
  w.tick();
}

describe('Game B v0.2 — 对话/属性/条件门控/阈值事件链', () => {
  it('拓扑无环：runner(runsBefore) 排在 resource-apply / state-sync 之前', () => {
    const w = loadGameB();
    w.tick();
    const ids = w.getSortedSystems().map((s) => s.id);
    expect(ids.indexOf('dialogue')).toBeLessThan(ids.indexOf('resource-apply'));
    expect(ids.indexOf('dialogue')).toBeLessThan(ids.indexOf('state-sync'));
    // 阈值链系统都在
    expect(ids).toContain('event-when');
    expect(ids).toContain('effect-apply');
  });

  it('7 属性齐备 + 首行渲染', () => {
    const w = loadGameB();
    w.tick();
    for (const id of ['charm', 'wisdom', 'stamina', 'career', 'affection_S', 'affection_T', 'affection_U']) {
      expect(w.getComponent<Resource>(id, 'Resource')).toBeTruthy();
    }
    expect(txt(w)).toContain('你就是新来的制作人');
  });

  it('选择改好感（按 id 全局路由，无 entityId===resourceId 假设）+ 置 flag + 分支', () => {
    const w = loadGameB();
    w.tick();
    advance(w);
    advance(w); // 到 s1_choice
    expect(cur(w)).toBe('s1_choice');
    choose(w, 0); // +5 → s1_impressed
    expect(res(w, 'affection_S')).toBe(5);
    expect(flag(w, 'met_S')).toBe(true);
    expect(cur(w)).toBe('s1_impressed');
  });

  it('阈值事件链：好感_S 越过 5（edge）→ 信号 → effect 置 S_warmed_flag（纯配置、零游戏代码）', () => {
    const w = loadGameB();
    w.tick();
    advance(w);
    advance(w);
    expect(flag(w, 'S_warmed_flag')).toBe(false);
    choose(w, 0); // +5：本 tick resource-apply 应用→event-when 越线发信号→effect-apply(Commit) 置 flag
    expect(res(w, 'affection_S')).toBe(5);
    expect(flag(w, 'S_warmed_flag')).toBe(true); // 链合龙
  });

  it('阈值未达不触发：选 +2 → 好感 2 < 5 → S_warmed_flag 仍 false', () => {
    const w = loadGameB();
    w.tick();
    advance(w);
    advance(w);
    choose(w, 1); // +2
    expect(res(w, 'affection_S')).toBe(2);
    expect(flag(w, 'S_warmed_flag')).toBe(false);
  });

  it('条件门控选项：阈值解锁门——选 +5 路线后，s1_probe 的"顺势靠近"(requires S_warmed_flag) 才可选', () => {
    const w = loadGameB();
    w.tick();
    advance(w);
    advance(w);
    choose(w, 0); // +5 → 触发 S_warmed_flag
    advance(w); // s1_impressed → s1_probe
    expect(cur(w)).toBe('s1_probe');
    const probe = SCENE_01.s1_probe;
    if (probe.kind !== 'choice') throw new Error('probe should be choice');
    // 属性门 charm>=12（charm=10）→ 隐藏；阈值门 S_warmed_flag → 解锁
    expect(optionAvailable(w, probe.options[0])).toBe(false); // 检定差一点
    expect(optionAvailable(w, probe.options[1])).toBe(true); // 保底
    expect(optionAvailable(w, probe.options[2])).toBe(true); // 阈值已解锁
    choose(w, 2); // 选解锁的特殊选项 → s1_special
    expect(cur(w)).toBe('s1_special');
    expect(res(w, 'affection_S')).toBe(10); // 5 + 5
  });

  it('条件门控：未走 +5 路线 → "顺势靠近"不可选，且 runner 拒绝选它', () => {
    const w = loadGameB();
    w.tick();
    advance(w);
    advance(w);
    choose(w, 1); // +2，不触发阈值
    advance(w); // s1_polite → s1_probe
    expect(cur(w)).toBe('s1_probe');
    const probe = SCENE_01.s1_probe;
    if (probe.kind !== 'choice') throw new Error('probe should be choice');
    expect(optionAvailable(w, probe.options[2])).toBe(false);
    choose(w, 2); // 试图选不可用选项 → runner 应拒绝（不跳转）
    expect(cur(w)).toBe('s1_probe'); // 仍停在 probe
  });

  it('确定性：同一选择序列两次跑出完全相同的世界快照', () => {
    const run = (): string => {
      const w = loadGameB();
      w.tick();
      advance(w);
      advance(w);
      choose(w, 0);
      advance(w);
      choose(w, 2);
      return JSON.stringify(w.snapshot());
    };
    expect(run()).toBe(run());
  });
});
