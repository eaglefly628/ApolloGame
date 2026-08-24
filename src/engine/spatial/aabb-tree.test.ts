import { describe, it, expect } from 'vitest';
import { DynamicAabbTree } from './aabb-tree.js';
import type { Aabb } from './aabb-tree.js';

// 与树解耦的暴力参照：所有 AABB 相交的 (idA<idB) 对，排序输出。
function brutePairs(boxes: Array<{ id: string; box: Aabb }>): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.box.minX <= b.box.maxX && a.box.maxX >= b.box.minX && a.box.minY <= b.box.maxY && a.box.maxY >= b.box.minY) {
        const lo = a.id < b.id ? a.id : b.id;
        const hi = a.id < b.id ? b.id : a.id;
        out.push([lo, hi]);
      }
    }
  }
  out.sort((p, q) => (p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : p[1] < q[1] ? -1 : p[1] > q[1] ? 1 : 0));
  return out;
}
function buildTree(boxes: Array<{ id: string; box: Aabb }>): DynamicAabbTree {
  const tree = new DynamicAabbTree();
  for (const { id, box } of [...boxes].sort((a, b) => (a.id < b.id ? -1 : 1))) tree.insert(id, box);
  return tree;
}
// 确定性 LCG，给随机场景用。
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('DynamicAabbTree — 基本', () => {
  it('相交对/不相交对', () => {
    const tree = buildTree([
      { id: 'a', box: { minX: 0, minY: 0, maxX: 10, maxY: 10 } },
      { id: 'b', box: { minX: 5, minY: 5, maxX: 15, maxY: 15 } }, // 与 a 交
      { id: 'c', box: { minX: 100, minY: 100, maxX: 110, maxY: 110 } }, // 远离
    ]);
    expect(tree.queryPairs()).toEqual([['a', 'b']]);
    expect(tree.query({ minX: 4, minY: 4, maxX: 6, maxY: 6 }).sort()).toEqual(['a', 'b']);
    expect(tree.query({ minX: 200, minY: 200, maxX: 201, maxY: 201 })).toEqual([]);
  });

  it('空树 / 单叶', () => {
    expect(new DynamicAabbTree().queryPairs()).toEqual([]);
    const t = buildTree([{ id: 'x', box: { minX: 0, minY: 0, maxX: 1, maxY: 1 } }]);
    expect(t.queryPairs()).toEqual([]);
  });
});

// 与树解耦的暴力参照：与 box 相交的所有 id（升序）——query(box) 的对拍面。
function bruteQuery(boxes: Array<{ id: string; box: Aabb }>, q: Aabb): string[] {
  return boxes
    .filter(({ box }) => box.minX <= q.maxX && box.maxX >= q.minX && box.minY <= q.maxY && box.maxY >= q.minY)
    .map(({ id }) => id)
    .sort();
}

describe('DynamicAabbTree — golden：树 === 暴力（50 随机场景）', () => {
  it('随机盒子集，queryPairs 与暴力逐一致；每场景再对拍 3 个随机查询盒的 query(box)', () => {
    const rnd = lcg(12345);
    for (let scene = 0; scene < 50; scene++) {
      const n = 2 + Math.floor(rnd() * 30);
      const boxes: Array<{ id: string; box: Aabb }> = [];
      for (let i = 0; i < n; i++) {
        const x = rnd() * 100;
        const y = rnd() * 100;
        const w = 1 + rnd() * 20;
        const h = 1 + rnd() * 20;
        boxes.push({ id: `e${String(i).padStart(2, '0')}`, box: { minX: x, minY: y, maxX: x + w, maxY: y + h } });
      }
      const tree = buildTree(boxes);
      expect(tree.queryPairs()).toEqual(brutePairs(boxes));
      // query(box) 对拍：随机查询盒（含大盒/小盒·可落空可全包）vs 暴力过滤。
      for (let q = 0; q < 3; q++) {
        const qx = rnd() * 120 - 10; // 稍越界·覆盖「查询盒部分/全部在场景外」
        const qy = rnd() * 120 - 10;
        const qw = 1 + rnd() * 40;
        const qh = 1 + rnd() * 40;
        const qbox: Aabb = { minX: qx, minY: qy, maxX: qx + qw, maxY: qy + qh };
        expect(tree.query(qbox)).toEqual(bruteQuery(boxes, qbox));
      }
    }
  });
});

describe('DynamicAabbTree — clear()', () => {
  it('clear 后 query/queryPairs 全空，且同一实例可继续 insert 复用', () => {
    const tree = buildTree([
      { id: 'a', box: { minX: 0, minY: 0, maxX: 10, maxY: 10 } },
      { id: 'b', box: { minX: 5, minY: 5, maxX: 15, maxY: 15 } },
    ]);
    expect(tree.queryPairs()).toEqual([['a', 'b']]); // 清前确有内容（防「本来就空」假绿）
    tree.clear();
    expect(tree.queryPairs()).toEqual([]);
    expect(tree.query({ minX: -100, minY: -100, maxX: 100, maxY: 100 })).toEqual([]);
    // 复用：清后重插（含旧 id 'a'）行为与全新树一致，无残留旧叶
    tree.insert('a', { minX: 0, minY: 0, maxX: 4, maxY: 4 });
    tree.insert('c', { minX: 2, minY: 2, maxX: 6, maxY: 6 });
    tree.insert('z', { minX: 100, minY: 100, maxX: 101, maxY: 101 });
    expect(tree.queryPairs()).toEqual([['a', 'c']]);
    expect(tree.query({ minX: 3, minY: 3, maxX: 3.5, maxY: 3.5 })).toEqual(['a', 'c']);
    // 旧叶 'b'(5..15) 已清除：查它原来的区域只命中新 'c'（角点相触），不见任何残留
    expect(tree.query({ minX: 5, minY: 5, maxX: 15, maxY: 15 })).toEqual(['c']);
  });
});
