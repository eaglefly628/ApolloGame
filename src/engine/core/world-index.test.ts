import { describe, it, expect } from 'vitest';
import { World } from './world.js';
import type { Component, ComponentType, EntityId, SystemDeclaration } from './types.js';

// ═══════════════════════════════════════════════════════════════
//  World 倒排索引（query-perf-plan 方案 A）—— 对拍守护测试
//
//  铁律：优化后 query 返回序必须与旧实现（entities 插入序全表扫描）**逐字节一致**
//  （lockstep/录放依赖 query 序稳定）。本文件用「朴素参照模型」对拍：
//  对同一随机操作序列，索引版 World 与参照模型的 query 结果必须永远相同。
//  设计出处：docs/design/query-perf-plan.md §6（对拍测试长期守护索引一致性）。
// ═══════════════════════════════════════════════════════════════

// ── 朴素参照模型：复刻旧 World 语义（插入序 Map + 全扫描 every）──
class NaiveWorld {
  entities = new Map<EntityId, Map<ComponentType, Component>>();
  create(id: EntityId): void {
    if (!this.entities.has(id)) this.entities.set(id, new Map());
  }
  destroy(id: EntityId): void {
    this.entities.delete(id);
  }
  add(id: EntityId, c: Component): void {
    this.entities.get(id)?.set(c.type, c);
  }
  remove(id: EntityId, t: ComponentType): void {
    this.entities.get(id)?.delete(t);
  }
  query(...types: ComponentType[]): EntityId[] {
    const out: EntityId[] = [];
    for (const [id, comps] of this.entities) {
      if (types.every((t) => comps.has(t))) out.push(id);
    }
    return out;
  }
}

const ids = (w: World, ...types: ComponentType[]): EntityId[] => w.query(...types).map(([id]) => id);

function comp(type: string, n = 0): Component {
  return { type, n } as Component & { n: number };
}

// 确定性 PRNG（mulberry32，与引擎 random 原子同族）——对拍序列可复现。
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('World 倒排索引 —— 行为与旧全扫描逐字节等价', () => {
  it('基本剪枝：稀有 type 候选 + 其余过滤，序=创建序', () => {
    const w = new World();
    for (let i = 0; i < 10; i++) {
      w.createEntity(`e${i}`);
      w.addComponent(`e${i}`, comp('Common'));
    }
    w.addComponent('e3', comp('Rare'));
    w.addComponent('e7', comp('Rare'));
    expect(ids(w, 'Rare', 'Common')).toEqual(['e3', 'e7']);
    expect(ids(w, 'Common', 'Rare')).toEqual(['e3', 'e7']); // 参数序无关
    expect(ids(w, 'Nope')).toEqual([]); // 无人持有 → 空
  });

  it('零参数 query 退化为全量（旧 every([])≡true 行为）', () => {
    const w = new World();
    w.createEntity('a');
    w.createEntity('b');
    expect(ids(w)).toEqual(['a', 'b']);
  });

  it('组件 remove→re-add 后仍按创建序（Set 加入序≠创建序的关键回归）', () => {
    const w = new World();
    for (const e of ['a', 'b', 'c']) {
      w.createEntity(e);
      w.addComponent(e, comp('T'));
    }
    w.removeComponent('a', 'T');
    w.addComponent('a', comp('T')); // a 在索引 Set 里排到了集尾
    expect(ids(w, 'T')).toEqual(['a', 'b', 'c']); // 但 query 序必须仍是创建序
  });

  it('destroy 清索引；同 id 重建排到队尾（与旧插入序一致）', () => {
    const w = new World();
    for (const e of ['a', 'b', 'c']) {
      w.createEntity(e);
      w.addComponent(e, comp('T'));
    }
    w.destroyEntity('a');
    expect(ids(w, 'T')).toEqual(['b', 'c']);
    w.createEntity('a'); // 重建：旧 Map 语义里 a 插到末尾
    w.addComponent('a', comp('T'));
    expect(ids(w, 'T')).toEqual(['b', 'c', 'a']);
  });

  it('tick consume 经索引删除且索引保持一致', () => {
    const w = new World();
    const sys: SystemDeclaration = {
      id: 'noop',
      reads: [],
      writes: [],
      consumes: ['Evt'],
      execute() {},
    };
    w.addSystem(sys);
    w.createEntity('a');
    w.createEntity('b');
    w.addComponent('a', comp('Evt'));
    w.addComponent('b', comp('Evt'));
    w.addComponent('b', comp('Keep'));
    w.tick();
    expect(ids(w, 'Evt')).toEqual([]); // 已被 consume
    expect(ids(w, 'Keep')).toEqual(['b']);
    // consume 后再加同型组件 → 索引仍可用（owners.clear() 不破坏后续 add）
    w.addComponent('a', comp('Evt'));
    expect(ids(w, 'Evt')).toEqual(['a']);
  });

  it('snapshot→restore 重建索引与创建序；restore 后继续增删仍一致', () => {
    const w = new World();
    for (const e of ['x', 'y', 'z']) {
      w.createEntity(e);
      w.addComponent(e, comp('T', 1));
    }
    w.addComponent('y', comp('U'));
    const snap = w.snapshot();

    const w2 = new World();
    w2.restore(snap);
    expect(ids(w2, 'T')).toEqual(['x', 'y', 'z']);
    expect(ids(w2, 'U')).toEqual(['y']);

    // restore 后变更：destroy + 新建 + 增删组件，索引须同步。
    w2.destroyEntity('y');
    expect(ids(w2, 'T')).toEqual(['x', 'z']);
    expect(ids(w2, 'U')).toEqual([]);
    w2.createEntity('w');
    w2.addComponent('w', comp('T'));
    expect(ids(w2, 'T')).toEqual(['x', 'z', 'w']); // 新建实体获新 seq → 排队尾
  });

  it('对拍：随机操作序列下与朴素全扫描结果永远相同（seed 可复现）', () => {
    const rng = mulberry32(20260610);
    const w = new World();
    const ref = new NaiveWorld();
    const types = ['A', 'B', 'C', 'D', 'E'];
    const pool = Array.from({ length: 40 }, (_, i) => `e${i}`);
    const alive = new Set<EntityId>();

    const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

    for (let step = 0; step < 2000; step++) {
      const op = rng();
      const id = pick(pool);
      if (op < 0.25) {
        if (!alive.has(id)) {
          w.createEntity(id);
          ref.create(id);
          alive.add(id);
        }
      } else if (op < 0.35) {
        if (alive.has(id)) {
          w.destroyEntity(id);
          ref.destroy(id);
          alive.delete(id);
        }
      } else if (op < 0.75) {
        if (alive.has(id)) {
          const t = pick(types);
          w.addComponent(id, comp(t, step));
          ref.add(id, comp(t, step));
        }
      } else {
        if (alive.has(id)) {
          const t = pick(types);
          w.removeComponent(id, t);
          ref.remove(id, t);
        }
      }

      // 每 50 步全面对拍：单 type、双 type、三 type 组合的结果序逐字节一致。
      if (step % 50 === 0) {
        for (const t of types) {
          expect(ids(w, t)).toEqual(ref.query(t));
        }
        expect(ids(w, 'A', 'B')).toEqual(ref.query('A', 'B'));
        expect(ids(w, 'C', 'D', 'E')).toEqual(ref.query('C', 'D', 'E'));
        expect(ids(w)).toEqual(ref.query());
      }
    }
  });

  it('规模正确性：5000 实体中查 7 个稀有实体（剪枝路径）', () => {
    const w = new World();
    const rare: EntityId[] = [];
    for (let i = 0; i < 5000; i++) {
      const id = `e${i}`;
      w.createEntity(id);
      w.addComponent(id, comp('Common'));
      if (i % 700 === 0) {
        w.addComponent(id, comp('Rare'));
        rare.push(id);
      }
    }
    expect(ids(w, 'Rare', 'Common')).toEqual(rare);
    expect(ids(w, 'Common', 'Rare')).toEqual(rare);
  });
});
