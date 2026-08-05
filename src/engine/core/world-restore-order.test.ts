import { describe, it, expect } from 'vitest';
import { World } from './world.js';
import type { Component } from './types.js';

// ═══════════════════════════════════════════════════════════════
//  restore() 的实体创建序（= query 序）必须跨快照往返保持
//  —— engine-review-2026-08-04 §3.3 · P1 · owner 2026-08-05 拍板修
//
//  根因：`snapshot()` 返回**普通对象**，而 JS 对「数字样 id」强制按**数值升序**枚举、
//  且排在字符串键之前 → 快照键序 **≠** 创建序。实测 `10,2,hero,1` → 枚举 `1,2,10,hero`。
//  旧 restore 拿键序当创建序重建 → 读档/回滚/回放后 query 序静默改变（谁先动、谁先被打中全变）。
//  最阴的是**读档瞬间 hash 校验通过**（组件内容一样），之后才逐步偏离 → 联机莫名 desync、
//  回放对不上，极难定位。修法=快照显式带 `snapshotOrder()`，restore 按它重建。
// ═══════════════════════════════════════════════════════════════

const mark = (): Component => ({ type: 'Flag', id: 'm', value: true } as unknown as Component);

/** 按「数字样 id 混字符串 id」建世界；创建序刻意与数值升序不一致。 */
function worldWithNumericIds(): World {
  const w = new World();
  for (const id of ['10', '2', 'hero', '1']) {
    w.createEntity(id);
    w.addComponent(id, mark());
  }
  return w;
}

const queryOrder = (w: World): string[] => w.query('Flag').map(([id]) => id);

describe('World.restore —— 创建序（query 序）跨快照往返', () => {
  it('前提：JS 键序确实 ≠ 创建序（数字样 id 被强制数值升序并提前）', () => {
    const w = worldWithNumericIds();
    expect(w.snapshotOrder()).toEqual(['10', '2', 'hero', '1']); // 真创建序
    expect(Object.keys(w.snapshot())).toEqual(['1', '2', '10', 'hero']); // 枚举序被 JS 重排
  });

  it('带 order 还原 → query 序与原世界逐项一致（核心）', () => {
    const src = worldWithNumericIds();
    const before = queryOrder(src);
    expect(before).toEqual(['10', '2', 'hero', '1']);

    const target = new World();
    target.restore(src.snapshot(), src.snapshotOrder());
    expect(queryOrder(target)).toEqual(before);
  });

  it('不带 order（旧存档/旧录像）→ 仍能完整还原实体，只是顺序退化成键序（不丢数据）', () => {
    const src = worldWithNumericIds();
    const target = new World();
    target.restore(src.snapshot()); // 兼容路径
    expect(queryOrder(target).sort()).toEqual(['1', '10', '2', 'hero']); // 全在
    expect(queryOrder(target)).toEqual(['1', '2', '10', 'hero']); // 顺序=键序（旧行为）
  });

  it('order 残缺/过期 → 缺的补在后面，绝不丢实体（宁可顺序退化不可丢数据）', () => {
    const src = worldWithNumericIds();
    const target = new World();
    target.restore(src.snapshot(), ['hero', '2']); // 只给一半
    const got = queryOrder(target);
    expect(got.slice(0, 2)).toEqual(['hero', '2']); // 给到的按给的排
    expect([...got].sort()).toEqual(['1', '10', '2', 'hero']); // 4 个都还在
  });

  it('order 含快照里已不存在的 id（销毁后存档）→ 安全忽略，不造幽灵实体', () => {
    const src = worldWithNumericIds();
    const target = new World();
    target.restore(src.snapshot(), ['ghost', '10', '2', 'hero', '1']);
    expect(queryOrder(target)).toEqual(['10', '2', 'hero', '1']);
    expect(target.hasComponent('ghost', 'Flag')).toBe(false);
  });

  it('全字符串 id 的世界：带不带 order 完全等价（绝大多数游戏零影响）', () => {
    const w = new World();
    for (const id of ['player', 'enemy-3', 'coin']) {
      w.createEntity(id);
      w.addComponent(id, mark());
    }
    const a = new World();
    a.restore(w.snapshot(), w.snapshotOrder());
    const b = new World();
    b.restore(w.snapshot());
    expect(queryOrder(a)).toEqual(queryOrder(b));
    expect(queryOrder(a)).toEqual(['player', 'enemy-3', 'coin']);
  });
});
