import { describe, it, expect } from 'vitest';
import type { Transform, Velocity, AnimState, Frame, Sprite, Flag } from '@engine/protocol/components.js';
import { applyCommands, hashSnapshot } from '@net/index.js';
import type { Command } from '@net/index.js';
import { buildClimbWorld, NORMALS, PHANTOMS, SUMMIT_BOX, playerEntity, SUMMIT_FLAG } from './climb-world.js';
import type { Box } from './climb-world.js';
import type { World } from '@engine/core/world.js';

const T = (w: World, id: string): Transform => w.getComponent<Transform>(id, 'Transform')!;
const setPos = (w: World, id: string, x: number, y: number): void => {
  const t = T(w, id); t.x = x; t.y = y;
  const v = w.getComponent<Velocity>(id, 'Velocity')!; v.vx = 0; v.vy = 0;
};
function step(w: World, cmds: Command[] = []): void { applyCommands(w, cmds); w.tick(); }
const P1 = playerEntity('p1'); // 蓝
const P2 = playerEntity('p2'); // 橙
const restY = (b: Box): number => b.y - b.height / 2 - 14;
const onBox = (w: World, id: string, b: Box): boolean => {
  const t = T(w, id);
  return w.hasComponent(id, 'Grounded') && Math.abs(t.y - restY(b)) < 12 && Math.abs(t.x - b.x) < b.width / 2 + 16;
};
const cmd = (playerId: string, dx: number, jump = false): Command => ({ playerId, tick: 0, move: { dx, dy: 0 }, jump });

describe('game-h「你造我塔」· lockstep 确定性', () => {
  it('两份世界喂相同输入 → 每 tick 哈希逐位相同', () => {
    const a = buildClimbWorld(['p1', 'p2']);
    const b = buildClimbWorld(['p1', 'p2']);
    for (let t = 0; t < 150; t++) {
      const cmds: Command[] = [cmd('p1', t % 3 === 0 ? 1 : -1, t % 7 === 0), cmd('p2', t % 2 === 0 ? 1 : 0, t % 5 === 0)];
      applyCommands(a, cmds); a.tick();
      applyCommands(b, cmds); b.tick();
      expect(hashSnapshot(a.snapshot())).toBe(hashSnapshot(b.snapshot()));
    }
  });
});

describe('game-h「你造我塔」· 召唤二重奏核心机制（互相踩开关才实体化）', () => {
  it('幻影台 ph0 仅当橙踩住 og 开关才变实：实时蓝能踩上、虚时蓝穿过坠落', () => {
    // 橙出生即在 og 板上(x530) → ph0 实
    const w = buildClimbWorld(['p1', 'p2']);
    for (let i = 0; i < 40; i++) step(w);
    expect(w.hasComponent('ph0', 'Sensor')).toBe(false); // 橙踩住 og → ph0 实体（无 Sensor）
    // 蓝放到 ph0 上方 → 应落在 ph0 上（踩得住）
    setPos(w, P1, PHANTOMS[0].box.x, restY(PHANTOMS[0].box) - 20);
    for (let i = 0; i < 30; i++) step(w);
    expect(onBox(w, P1, PHANTOMS[0].box)).toBe(true);

    // 橙离开 og → ph0 复原虚 → 蓝穿过坠落
    const w2 = buildClimbWorld(['p1', 'p2']);
    for (let i = 0; i < 40; i++) step(w2);
    for (let i = 0; i < 40; i++) step(w2, [cmd('p2', -1)]); // 橙向左走下 og 板
    expect(w2.hasComponent('ph0', 'Sensor')).toBe(true); // 离板 → ph0 虚（带 Sensor=可穿过）
    setPos(w2, P1, PHANTOMS[0].box.x, restY(PHANTOMS[0].box) - 20);
    for (let i = 0; i < 30; i++) step(w2);
    expect(T(w2, P1).y).toBeGreaterThan(restY(PHANTOMS[0].box) + 40); // 穿过 ph0 往下坠（没踩住）
  });

  it('攀爬路径每段都在跳跃可达包络内（向上、不过远、非正上下叠→撞底面）', () => {
    // 物理包络：跳跃上升 ≈ JUMP_SPEED²/(2g)=14²/1.2≈163；保守取 ≤150 上升、≤130 横移、≥35 横移(非正上下)。
    const MAX_UP = 150, MAX_DX = 130, MIN_DX = 35;
    const ry = (b: Box): number => b.y - b.height / 2 - 14;
    const ground = NORMALS[0];
    const blue = [
      { x: 70, y: ry(ground) }, { x: PHANTOMS[0].box.x, y: ry(PHANTOMS[0].box) }, { x: PHANTOMS[1].box.x, y: ry(PHANTOMS[1].box) },
      { x: PHANTOMS[2].box.x, y: ry(PHANTOMS[2].box) }, { x: NORMALS[1].x, y: ry(NORMALS[1]) }, { x: NORMALS[3].x, y: ry(NORMALS[3]) },
    ];
    const orange = [
      { x: 570, y: ry(ground) }, { x: PHANTOMS[3].box.x, y: ry(PHANTOMS[3].box) }, { x: PHANTOMS[4].box.x, y: ry(PHANTOMS[4].box) },
      { x: PHANTOMS[5].box.x, y: ry(PHANTOMS[5].box) }, { x: NORMALS[2].x, y: ry(NORMALS[2]) }, { x: NORMALS[3].x, y: ry(NORMALS[3]) },
    ];
    for (const path of [blue, orange]) {
      for (let i = 1; i < path.length; i++) {
        const dx = Math.abs(path[i].x - path[i - 1].x);
        const up = path[i - 1].y - path[i].y; // 上升为正
        expect(up).toBeGreaterThan(0);
        expect(up).toBeLessThanOrEqual(MAX_UP);
        expect(dx).toBeGreaterThanOrEqual(MIN_DX);
        expect(dx).toBeLessThanOrEqual(MAX_DX);
      }
    }
  });

  it('召唤生效后蓝能站上幻影台、并从其起跳升高（踩着召唤的台往上）', () => {
    const w = buildClimbWorld(['p1', 'p2']);
    for (let i = 0; i < 30; i++) step(w); // 橙守 og → 蓝的幻影台已实
    setPos(w, P1, PHANTOMS[0].box.x, restY(PHANTOMS[0].box) - 16);
    for (let i = 0; i < 16; i++) step(w);
    expect(onBox(w, P1, PHANTOMS[0].box)).toBe(true); // 站上召唤台（实）
    let peak = T(w, P1).y;
    for (let i = 0; i < 30; i++) { step(w, [cmd('p1', 0, true)]); peak = Math.min(peak, T(w, P1).y); }
    expect(peak).toBeLessThan(restY(PHANTOMS[0].box) - 60); // 能从召唤台起跳升高
  });

  it('双人都进顶部 → summit 过关', () => {
    const w = buildClimbWorld(['p1', 'p2']);
    setPos(w, P1, SUMMIT_BOX.x - 30, SUMMIT_BOX.y);
    setPos(w, P2, SUMMIT_BOX.x + 30, SUMMIT_BOX.y);
    for (let i = 0; i < 8; i++) step(w);
    expect(w.getComponent<Flag>('goal', 'Flag')?.active).toBe(true);
    expect(w.getComponent<Flag>('goal', 'Flag')?.id).toBe(SUMMIT_FLAG);
  });
});

describe('game-h「你造我塔」· 精灵动画', () => {
  it('走动 → walk 帧推进；静止 → idle', () => {
    const w = buildClimbWorld(['p1', 'p2']);
    setPos(w, P1, 300, NORMALS[0].y - NORMALS[0].height / 2 - 14); // 站地面
    for (let i = 0; i < 20; i++) step(w);
    expect(w.getComponent<AnimState>(P1, 'AnimState')?.current).toBe('idle');
    const seen = new Set<number>();
    for (let i = 0; i < 24; i++) { step(w, [cmd('p1', 1)]); seen.add(w.getComponent<Frame>(P1, 'Frame')!.index); }
    expect(w.getComponent<AnimState>(P1, 'AnimState')?.current).toBe('walk');
    expect(w.getComponent<Sprite>(P1, 'Sprite')?.textureKey).toContain('sheet');
    expect([...seen].some((f) => f >= 1)).toBe(true);
  });
});
