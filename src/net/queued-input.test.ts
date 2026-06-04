import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { RawInput } from '@engine/protocol/components.js';
import { QueuedInputSource, applyCommands } from './index.js';

describe('QueuedInputSource — 异步事件按 tick 确定性释放', () => {
  it('enqueue 的事件在下一 commandsForTick 释放后清空', () => {
    const src = new QueuedInputSource('p1');
    expect(src.commandsForTick(1)).toEqual([]); // 空队列 → 无命令

    src.enqueueAction('choice:2', { x: 100, y: 50 });
    const cmds = src.commandsForTick(2);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].actions?.[0]).toMatchObject({ source: 'p1', key: 'choice:2', x: 100, y: 50, phase: 'action' });

    expect(src.commandsForTick(3)).toEqual([]); // 已清空
  });
});

describe('applyCommands — actions 落成 RawInput（每 tick 先清后标）', () => {
  it('命令的 actions → RawInput 实体；下一 tick 无 actions 则清掉', () => {
    const w = new World();
    const src = new QueuedInputSource('p1');
    src.enqueueAction('choice:1', { x: 10, y: 20 });

    applyCommands(w, src.commandsForTick(1));
    const raw = w.query('RawInput').map(([id]) => w.getComponent<RawInput>(id, 'RawInput'));
    expect(raw).toHaveLength(1);
    expect(raw[0]).toMatchObject({ key: 'choice:1', x: 10, y: 20, source: 'p1' });

    // 下一 tick 无输入 → RawInput 被清
    applyCommands(w, src.commandsForTick(2));
    expect(w.query('RawInput')).toHaveLength(0);
  });
});
