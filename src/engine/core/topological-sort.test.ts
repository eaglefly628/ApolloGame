import { describe, it, expect } from 'vitest';
import { topologicalSort } from './topological-sort.js';
import { SystemPhase } from './types.js';
import type { SystemDeclaration } from './types.js';

const noop = (): void => {};
function sys(id: string, reads: string[], writes: string[], phase?: number): SystemDeclaration {
  return { id, reads, writes, consumes: [], phase, execute: noop };
}

describe('topologicalSort — 组件依赖定序（缺省阶段，行为不变）', () => {
  it('writer 排在 reader 之前（输入乱序也对）', () => {
    const order = topologicalSort([sys('consumer', ['X'], []), sys('producer', [], ['X'])]).map((s) => s.id);
    expect(order).toEqual(['producer', 'consumer']);
  });

  it('同阶段两个系统都读写同一组件 → 判成环', () => {
    expect(() => topologicalSort([sys('a', ['X'], ['X']), sys('b', ['X'], ['X'])])).toThrow(/Circular/);
  });
});

describe('topologicalSort — phase 阶段', () => {
  it('跨阶段按阶段号定序，绕过纯组件拓扑会判成环的"读后改"管线', () => {
    // detect 读 Transform、resolve 写 Transform：同阶段会成环。
    // 把 resolve 排到更后阶段 → 不成环，且排在 detect 之后。
    const detect = sys('detect', ['Transform'], ['Overlap']); // Update
    const resolve = sys('resolve', ['Overlap'], ['Transform'], SystemPhase.Resolve);
    expect(topologicalSort([resolve, detect]).map((s) => s.id)).toEqual(['detect', 'resolve']);
  });

  it('同样的两系统不分阶段 → 确实会成环（证明阶段是解法）', () => {
    const detect = sys('detect', ['Transform'], ['Overlap']);
    const resolve = sys('resolve', ['Overlap'], ['Transform']); // 同 Update 阶段
    expect(() => topologicalSort([resolve, detect])).toThrow(/Circular/);
  });

  it('阶段内仍按组件拓扑排序', () => {
    const accel = sys('accel', ['Velocity'], ['Velocity']);
    const motion = sys('motion', ['Velocity'], ['Transform']);
    const order = topologicalSort([motion, accel]).map((s) => s.id);
    expect(order.indexOf('accel')).toBeLessThan(order.indexOf('motion'));
  });

  it('阶段内成环仍抛错（phase 不掩盖真正的环）', () => {
    const a = sys('a', ['X'], ['Y'], SystemPhase.Resolve);
    const b = sys('b', ['Y'], ['X'], SystemPhase.Resolve);
    expect(() => topologicalSort([a, b])).toThrow(/Circular/);
  });
});
