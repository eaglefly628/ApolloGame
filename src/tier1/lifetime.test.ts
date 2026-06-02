import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { DestroyRequest, TimerDone } from '@engine/protocol/components.js';
import { lifetimeCapability } from './lifetime.js';

function worldWithLifetime(): World {
  const w = new World();
  for (const sys of lifetimeCapability.systems) w.addSystem(sys);
  return w;
}

describe('T1 lifetime — capability metadata（契约钉死）', () => {
  it('id / version 正确', () => {
    expect(lifetimeCapability.id).toBe('t1-lifetime');
    expect(lifetimeCapability.version).toBe('1.0.0');
  });

  it('一个系统：写 DestroyRequest，consume TimerDone，不 provide/read', () => {
    expect(lifetimeCapability.systems).toHaveLength(1);
    expect(lifetimeCapability.components.provides).toEqual({});
    expect(lifetimeCapability.components.reads).toEqual([]);
    expect(lifetimeCapability.components.writes).toEqual(['DestroyRequest']);
    expect(lifetimeCapability.components.consumes).toEqual(['TimerDone']);
  });
});

describe('T1 lifetime — behavior', () => {
  it('名为 "life" 的计时结束 → 对该实体发 DestroyRequest，并 consume 掉 TimerDone', () => {
    const w = worldWithLifetime();
    w.createEntity('bullet');
    const done: TimerDone = { type: 'TimerDone', timerId: 'life' };
    w.addComponent('bullet', done);

    w.tick();

    const req = w.getComponent<DestroyRequest>('bullet', 'DestroyRequest');
    expect(req).toBeDefined();
    expect(req!.entityId).toBe('bullet'); // 销毁请求指向自己
    // 系统声明 consumes:['TimerDone'] → World 在 tick 末清除一次性事件
    expect(w.getComponent<TimerDone>('bullet', 'TimerDone')).toBeUndefined();
  });

  it('非 "life" 的计时不触发销毁', () => {
    const w = worldWithLifetime();
    w.createEntity('e');
    const done: TimerDone = { type: 'TimerDone', timerId: 'cooldown' };
    w.addComponent('e', done);

    w.tick();
    expect(w.getComponent('e', 'DestroyRequest')).toBeUndefined();
  });

  it('没有 TimerDone 的实体什么都不发生', () => {
    const w = worldWithLifetime();
    w.createEntity('idle');
    w.tick();
    expect(w.getComponent('idle', 'DestroyRequest')).toBeUndefined();
  });
});
