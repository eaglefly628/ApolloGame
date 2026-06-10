import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { HexBoard, HexPos, GridMover, Relation, Transform } from '@engine/protocol/components.js';
import { gridMoveCapability } from './grid-move.js';
import { hexDistance } from './hex.js';

function board(w: World, cols = 8, rows = 8, tileSize = 10): void {
  w.createEntity('board');
  w.addComponent('board', { type: 'HexBoard', cols, rows, tileSize, originX: 0, originY: 0 } as HexBoard);
}
function unit(w: World, id: string, q: number, r: number, opts: { period?: number; target?: string; transform?: boolean } = {}): void {
  w.createEntity(id);
  w.addComponent(id, { type: 'HexPos', q, r } as HexPos);
  if (opts.period !== undefined) w.addComponent(id, { type: 'GridMover', period: opts.period } as GridMover);
  if (opts.target) w.addComponent(id, { type: 'Relation', kind: 'target', targetId: opts.target } as Relation);
  if (opts.transform) w.addComponent(id, { type: 'Transform', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } as Transform);
}
function mk(): World {
  const w = new World();
  for (const s of gridMoveCapability.systems) w.addSystem(s);
  return w;
}
const pos = (w: World, id: string) => w.getComponent<HexPos>(id, 'HexPos')!;

describe('grid-move · 逐格寻路移动', () => {
  it('每 period tick 走一格，逐步逼近目标', () => {
    const w = mk(); board(w);
    unit(w, 'hero', 0, 0, { period: 2, target: 'enemy' });
    unit(w, 'enemy', 5, 0); // 静止目标（无 GridMover）
    const d0 = hexDistance(pos(w, 'hero'), pos(w, 'enemy'));
    w.tick(); // elapsed 1 < 2 → 不动
    expect(hexDistance(pos(w, 'hero'), pos(w, 'enemy'))).toBe(d0);
    w.tick(); // elapsed 2 → 走一格
    expect(hexDistance(pos(w, 'hero'), pos(w, 'enemy'))).toBe(d0 - 1);
  });

  it('到目标相邻格即停（不踏上目标格，攻击距离）', () => {
    const w = mk(); board(w);
    unit(w, 'hero', 0, 0, { period: 1, target: 'enemy' });
    unit(w, 'enemy', 4, 0);
    for (let i = 0; i < 20; i++) w.tick();
    expect(hexDistance(pos(w, 'hero'), pos(w, 'enemy'))).toBe(1); // 停在相邻
    expect(pos(w, 'hero')).not.toEqual(pos(w, 'enemy'));         // 不重叠
  });

  it('占位：不踏上其它单位占的格（绕行）', () => {
    const w = mk(); board(w);
    unit(w, 'hero', 0, 0, { period: 1, target: 'enemy' });
    unit(w, 'enemy', 4, 0);
    // 直线上塞静止友军/敌占格
    unit(w, 'block1', 2, 0); unit(w, 'block2', 2, -1); unit(w, 'block3', 2, 1);
    const occupiedKeys = new Set<string>();
    for (let i = 0; i < 25; i++) {
      w.tick();
      const p = pos(w, 'hero');
      occupiedKeys.add(`${p.q},${p.r}`);
      // hero 永不踏占格
      expect([[2, 0], [2, -1], [2, 1], [4, 0]].some(([q, r]) => q === p.q && r === p.r)).toBe(false);
    }
    expect(hexDistance(pos(w, 'hero'), pos(w, 'enemy'))).toBe(1); // 绕过仍到相邻
  });

  it('Transform 由 HexPos 投影同步（供渲染/战斗距离）', () => {
    const w = mk(); board(w, 8, 8, 10);
    unit(w, 'hero', 3, 2, { period: 1, transform: true }); // 无目标 → 不动，仅同步 Transform
    w.tick();
    const t = w.getComponent<Transform>('hero', 'Transform')!;
    expect(t.x).toBe(3 * 10 + 2 * 5);   // q*tile + r*tile/2 = 40
    expect(t.y).toBe(2 * 7.5);          // r*tile*0.75 = 15
  });

  it('无棋盘 / 无目标 → 不动、不报错', () => {
    const w = mk();
    unit(w, 'hero', 0, 0, { period: 1, target: 'enemy' });
    expect(() => w.tick()).not.toThrow(); // 无 HexBoard → return
    board(w);
    unit(w, 'lonely', 1, 1, { period: 1 }); // 无 Relation
    expect(() => w.tick()).not.toThrow();
    expect(pos(w, 'lonely')).toEqual({ q: 1, r: 1, type: 'HexPos' } as never); // 不动
  });
});

describe('grid-move · 确定性', () => {
  it('同布局同输入多次跑 → 同终局（lockstep 安全）', () => {
    const run = () => {
      const w = mk(); board(w);
      unit(w, 'hero', 0, 0, { period: 1, target: 'enemy' });
      unit(w, 'enemy', 5, 3);
      unit(w, 'b1', 2, 1); unit(w, 'b2', 3, 1);
      for (let i = 0; i < 15; i++) w.tick();
      const p = pos(w, 'hero');
      return `${p.q},${p.r}`;
    };
    expect(run()).toBe(run());
  });
});
