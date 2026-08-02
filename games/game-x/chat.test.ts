import { describe, it, expect } from 'vitest';
import { World } from '@zerocraft/engine/engine/core/world.js';
import type { State, Resource, Flag, InputQueue, RawInputData } from '@zerocraft/engine/engine/protocol/components.js';
import { DIALOGUE_ACTION_CHOOSE, optionAvailable } from '@zerocraft/engine/skills/tier3/index.js';
import { QIYUE } from './characters.js';
import { DEFAULT_RECORD } from './record.js';
import { buildChatBlueprint, chatGraph, R_BOND } from './chat.js';

function loadChat(stage = 0): World {
  const bp = buildChatBlueprint(QIYUE, { ...DEFAULT_RECORD }, stage);
  const w = new World();
  for (const cap of bp.capabilities) for (const sys of cap.systems) w.addSystem(sys);
  for (const [eid, comps] of Object.entries(bp.entities)) {
    w.createEntity(eid);
    for (const [type, data] of Object.entries(comps)) w.addComponent(eid, { ...data, type } as never);
  }
  return w;
}
function choose(w: World, index: number): void {
  const actions: RawInputData[] = [{ source: 'p1', key: DIALOGUE_ACTION_CHOOSE, x: index, phase: 'action' }];
  if (!w.hasComponent('global-input', 'InputQueue')) w.createEntity('global-input');
  w.addComponent('global-input', { type: 'InputQueue', actions } as InputQueue);
  w.tick();
}
const cur = (w: World): string => w.getComponent<State>('dialogue', 'State')!.current;
const bond = (w: World): number => w.getComponent<Resource>(`res-${R_BOND}`, 'Resource')!.current;
function flag(w: World, id: string): boolean {
  for (const [e] of w.query('Flag')) { const f = w.getComponent<Flag>(e, 'Flag'); if (f?.id === id) return f.active; }
  return false;
}

describe('Game X · 聊天：话题分流 + 记忆 + 羁绊（dialogue 能力数据驱动）', () => {
  it('起点是 hub 选择节点；初识可选 听今天/问她/说我的/告别（心事+callback 不可见）', () => {
    const w = loadChat(0); w.tick();
    expect(cur(w)).toBe('hub');
    const node = chatGraph(QIYUE).hub;
    const avail = node.kind === 'choice' ? node.options.filter((o) => optionAvailable(w, o)).map((o) => o.text) : [];
    expect(avail).toContain('听你说说今天');
    expect(avail).toContain('说说我的事');
    expect(avail).not.toContain('聊点心事'); // 需 stage≥1
    expect(avail).not.toContain('「我那个游戏……」'); // 需 making_game
  });

  it('「听你说说今天」(0) → 羁绊+3 + 标记 t_day + 回 hub；再看该选项已消', () => {
    const w = loadChat(0); w.tick();
    const b0 = bond(w);
    choose(w, 0);
    expect(bond(w)).toBe(b0 + 3);
    expect(flag(w, 't_day')).toBe(true);
    expect(cur(w)).toBe('r_day');
    w.addComponent('dialogue', { type: 'DialogueAdvance' } as never); w.tick(); // 继续回 hub
    expect(cur(w)).toBe('hub');
    const node = chatGraph(QIYUE).hub;
    const avail = node.kind === 'choice' ? node.options.filter((o) => optionAvailable(w, o)).map((o) => o.text) : [];
    expect(avail).not.toContain('听你说说今天'); // 今天已聊
  });

  it('说我的事 → 我在做游戏 → 记住 making_game；回 hub 后 callback 解锁', () => {
    const w = loadChat(0); w.tick();
    choose(w, 2); // 说说我的事 → mine
    expect(cur(w)).toBe('mine');
    choose(w, 1); // 我在做一个游戏
    expect(flag(w, 'making_game')).toBe(true);
    expect(cur(w)).toBe('r_game');
    w.addComponent('dialogue', { type: 'DialogueAdvance' } as never); w.tick(); // 回 hub
    expect(cur(w)).toBe('hub');
    const node = chatGraph(QIYUE).hub;
    const cb = node.kind === 'choice' ? node.options.find((o) => o.text.includes('我那个游戏')) : undefined;
    expect(cb && optionAvailable(w, cb)).toBe(true); // 记忆驱动 callback 出现
  });

  it('心事在 stage≥1 时可见（关系到了才聊得深）', () => {
    const w = loadChat(1); w.tick();
    const node = chatGraph(QIYUE).hub;
    const heart = node.kind === 'choice' ? node.options.find((o) => o.text === '聊点心事') : undefined;
    expect(heart && optionAvailable(w, heart)).toBe(true);
  });

  it('记忆从存档还原：已知 making_game → 起手 callback 即可见', () => {
    const bp = buildChatBlueprint(QIYUE, { ...DEFAULT_RECORD, memories: ['making_game'] }, 0);
    const w = new World();
    for (const cap of bp.capabilities) for (const sys of cap.systems) w.addSystem(sys);
    for (const [eid, comps] of Object.entries(bp.entities)) { w.createEntity(eid); for (const [t, d] of Object.entries(comps)) w.addComponent(eid, { ...d, type: t } as never); }
    w.tick();
    expect(flag(w, 'making_game')).toBe(true);
  });
});
