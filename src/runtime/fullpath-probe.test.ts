import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import { Engine } from './engine.js';
import { scanNonFinite, fullPathProbe } from './fullpath-probe.js';
import type { Resource } from '@engine/protocol/components.js';

describe('fullpath-probe · scanNonFinite（非有限数不变量）', () => {
  it('干净世界 → []', () => {
    const w = new World();
    w.createEntity('a');
    w.addComponent('a', { type: 'Resource', id: 'hp', current: 100, min: 0, max: 100 } as Resource);
    expect(scanNonFinite(w)).toEqual([]);
  });

  it('NaN / Infinity → 抓到并报路径', () => {
    const w = new World();
    w.createEntity('a');
    w.addComponent('a', { type: 'Resource', id: 'hp', current: NaN, min: 0, max: Infinity } as Resource);
    const nf = scanNonFinite(w);
    expect(nf.length).toBeGreaterThanOrEqual(2); // current=NaN + max=Infinity
    expect(nf.join('|')).toContain('a.Resource');
  });
});

describe('fullpath-probe · fullPathProbe（错误捕获 + 确定性）', () => {
  const makeEngine = () => {
    const e = new Engine();
    e.load({ capabilities: [], entities: {} });
    return e;
  };

  it('fire 抛错 → 该信号 not-ok + 捕获 error；不污染其它信号', () => {
    const fire = (_e: Engine, signal: string) => {
      if (signal === 'boom') throw new Error('kaboom');
    };
    const report = fullPathProbe(makeEngine, fire, ['ok1', 'boom', 'ok2'], { ticksPerAction: 1 });
    const boom = report.perSignal.find((r) => r.signal === 'boom')!;
    expect(boom.ok).toBe(false);
    expect(boom.error).toContain('kaboom');
    expect(report.perSignal.find((r) => r.signal === 'ok1')!.ok).toBe(true);
    expect(report.ok).toBe(false);
  });

  it('全部正常 → ok + deterministic + finalHash 稳定', () => {
    const report = fullPathProbe(makeEngine, () => {}, ['a', 'b'], { ticksPerAction: 1 });
    expect(report.ok).toBe(true);
    expect(report.deterministic).toBe(true);
    expect(typeof report.finalHash).toBe('string');
  });
});
