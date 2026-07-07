import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { applyCommands, QueuedInputSource } from '@net/index.js';
import type { Resource, Tag } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { ENEMY, TOWER, START_GOLD, TOWERS } from './theme.js';

function res(e: Engine, eid: string): number {
  return e.world.getComponent<Resource>(eid, 'Resource')?.current ?? 0;
}
function countTag(e: Engine, bit: number): number {
  let n = 0;
  for (const [id] of e.world.query('Tag')) {
    const t = e.world.getComponent<Tag>(id, 'Tag');
    if (t && (t.flags & bit) !== 0) n++;
  }
  return n;
}
function tickN(e: Engine, n: number): void {
  for (let i = 0; i < n; i++) e.world.tick();
}

describe('Game Q · Neon Siege（数据驱动塔防）', () => {
  it('蓝图是纯数据：消费现有能力 + 关键单例齐全（零专属系统）', () => {
    const bp = buildBlueprint();
    expect(bp.capabilities.length).toBeGreaterThan(20);
    const ids = Object.keys(bp.entities);
    for (const key of ['gold', 'base', 'lane', 'library', 'flow', 'ticketcount', 'killzone', 'field-pulse', 'spawn-0']) {
      expect(ids).toContain(key);
    }
    // 实体侧无函数（纯数据·可序列化为 manifest）
    expect(() => JSON.stringify(bp.entities)).not.toThrow();
  });

  it('波次自动开播：tick 一阵后敌人被 timeline→prefab 生出来', () => {
    const e = new Engine();
    e.load(buildBlueprint());
    expect(countTag(e, ENEMY)).toBe(0);
    tickN(e, 160);
    expect(countTag(e, ENEMY)).toBeGreaterThan(0);
    expect(res(e, 'livecount')).toBeGreaterThan(0);
  });

  it('确定性：两把独立跑同 tick 数 → 同 hash（可回放/lockstep 底线）', () => {
    const a = new Engine(); a.load(buildBlueprint());
    const b = new Engine(); b.load(buildBlueprint());
    tickN(a, 260);
    tickN(b, 260);
    expect(a.hash()).toBe(b.hash());
  });

  it('经济+放置：买 PULSE(扣金·置 pending) → 点场 → caster 生成一座塔', () => {
    const input = new QueuedInputSource('q');
    const e = new Engine({ input });
    e.load(buildBlueprint());
    let tk = 0;
    const step = (): void => { applyCommands(e.world, input.commandsForTick(++tk)); e.world.tick(); };

    expect(countTag(e, TOWER)).toBe(0);
    const gold0 = res(e, 'gold');

    input.enqueueAction('buy_pulse'); // → keybind → craft-recipe 扣金 + 置 pending_pulse
    step();
    expect(res(e, 'gold')).toBe(gold0 - TOWERS.pulse.cost);

    input.enqueue({ source: 'q', x: 460, y: 300, phase: 'down' }); // 点场（pending 门开）→ caster at:pointer
    step();
    step(); // prefab 展开
    expect(countTag(e, TOWER)).toBeGreaterThanOrEqual(1);
  });

  it('漏怪扣命：无塔时敌人抵达大本营 → lives 下降（leak 探针命中）', () => {
    const e = new Engine();
    e.load(buildBlueprint());
    const lives0 = res(e, 'base');
    tickN(e, 2100); // 首只怪走完全程抵达大本营
    expect(res(e, 'base')).toBeLessThan(lives0);
  });

  it('起始经济/生命符合配置', () => {
    const e = new Engine();
    e.load(buildBlueprint());
    expect(res(e, 'gold')).toBe(START_GOLD);
    expect(res(e, 'base')).toBeGreaterThan(0);
  });
});
