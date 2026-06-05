import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { State, Text, Flag, Resource, ResourceModify } from '@engine/protocol/components.js';
import { dialogueCapability, type DialogueGraph, type DialogueScript, type DialogueAdvance, type DialogueChoose } from './dialogue.js';

// 独立单测：脱离 Game B 数据，用一棵最小合成脚本验证「叙事解释器」本身（推进/渲染/选择/条件门控）。
const SCRIPT: DialogueGraph = {
  start: { kind: 'line', speaker: 'A', text: 'hi', next: 'pick' },
  pick: {
    kind: 'choice',
    prompt: 'choose',
    options: [
      { text: 'warm', effects: [{ resource: 'aff', amount: 5 }], setFlag: 'met', next: 'end' },
      { text: 'locked', requires: { kind: 'flag', id: 'gate' }, next: 'secret' },
    ],
  },
  end: { kind: 'line', speaker: 'A', text: 'bye', next: null },
  secret: { kind: 'line', speaker: 'A', text: 'secret', next: null },
};

function loadDialogue(current = 'start'): World {
  const w = new World();
  for (const s of dialogueCapability.systems) w.addSystem(s);
  w.createEntity('dlg');
  w.addComponent('dlg', { type: 'DialogueScript', fsmId: 'dialogue', nodes: SCRIPT } as DialogueScript);
  w.addComponent('dlg', { type: 'State', fsmId: 'dialogue', current, previous: '' } as State);
  w.addComponent('dlg', { type: 'Text', content: '', fontSize: 20, fontFamily: 'serif', anchor: 'left', lineSpacing: 4 } as Text);
  w.createEntity('aff');
  w.addComponent('aff', { type: 'Resource', id: 'aff', current: 0, min: 0, max: 100 } as Resource);
  w.createEntity('met');
  w.addComponent('met', { type: 'Flag', id: 'met', active: false } as Flag);
  w.createEntity('gate');
  w.addComponent('gate', { type: 'Flag', id: 'gate', active: false } as Flag);
  return w;
}
const cur = (w: World): string => w.getComponent<State>('dlg', 'State')!.current;
const txt = (w: World): string => w.getComponent<Text>('dlg', 'Text')!.content;

describe('T3 dialogue — metadata', () => {
  it('id / 系统名 / runsBefore 打破 RMW 伪环 / 脚本来自数据组件', () => {
    expect(dialogueCapability.id).toBe('t3-dialogue');
    expect(dialogueCapability.systems[0].id).toBe('dialogue');
    expect(dialogueCapability.systems[0].runsBefore).toEqual(['resource-apply', 'state-sync']);
    expect(dialogueCapability.components.reads).toContain('DialogueScript');
  });
});

describe('T3 dialogue — 推进 / 渲染', () => {
  it('每 tick 按 State.current 渲染当前节点文本', () => {
    const w = loadDialogue();
    w.tick();
    expect(txt(w)).toBe('A：hi');
  });

  it('line 节点 + DialogueAdvance → 跳到 next 并渲染新行', () => {
    const w = loadDialogue();
    w.tick();
    w.addComponent('dlg', { type: 'DialogueAdvance' } as DialogueAdvance);
    w.tick();
    expect(cur(w)).toBe('pick');
    expect(txt(w)).toBe('choose'); // choice 节点：speaker(空) + prompt
  });
});

describe('T3 dialogue — 选择结算 / 条件门控', () => {
  it('选可用选项 → 发 ResourceModify(按 id) + 置 Flag + 跳转', () => {
    const w = loadDialogue('pick');
    w.addComponent('dlg', { type: 'DialogueChoose', index: 0 } as DialogueChoose);
    w.tick();
    expect(cur(w)).toBe('end');
    expect(w.getComponent<Flag>('met', 'Flag')!.active).toBe(true);
    const mod = w.getComponent<ResourceModify>('aff', 'ResourceModify');
    expect(mod).toBeTruthy();
    expect(mod!.amount).toBe(5);
  });

  it('选不满足 requires 的选项 → 拒绝（不跳转）', () => {
    const w = loadDialogue('pick'); // gate=false → 选项1 不可用
    w.addComponent('dlg', { type: 'DialogueChoose', index: 1 } as DialogueChoose);
    w.tick();
    expect(cur(w)).toBe('pick'); // 仍停在 pick
  });

  it('门开后同一选项可选 → 跳到 secret', () => {
    const w = loadDialogue('pick');
    w.getComponent<Flag>('gate', 'Flag')!.active = true;
    w.addComponent('dlg', { type: 'DialogueChoose', index: 1 } as DialogueChoose);
    w.tick();
    expect(cur(w)).toBe('secret');
  });
});
