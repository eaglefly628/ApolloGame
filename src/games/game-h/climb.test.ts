import { describe, it, expect } from 'vitest';
import type { Transform, Velocity, AnimState, Frame, Sprite, Flag } from '@engine/protocol/components.js';
import { applyCommands, hashSnapshot } from '@net/index.js';
import type { Command } from '@net/index.js';
import { buildClimbWorld, CLIMB_PLATFORMS, playerEntity, SUMMIT_FLAG, GOAL_BOX } from './climb-world.js';
import type { World } from '@engine/core/world.js';
import type { Box } from './climb-world.js';

const T = (w: World, id: string): Transform => w.getComponent<Transform>(id, 'Transform')!;
const setPos = (w: World, id: string, x: number, y: number): void => {
  const t = T(w, id); t.x = x; t.y = y;
  const v = w.getComponent<Velocity>(id, 'Velocity')!; v.vx = 0; v.vy = 0;
};
function step(w: World, cmds: Command[] = []): void { applyCommands(w, cmds); w.tick(); }
const P1 = playerEntity('p1');
const P2 = playerEntity('p2');
const restY = (b: Box): number => b.y - b.height / 2 - 14; // 28 高玩家落在台顶的中心 y
const onPlatform = (w: World, id: string, b: Box): boolean => {
  const t = T(w, id);
  return w.hasComponent(id, 'Grounded') && Math.abs(t.y - restY(b)) < 12 && Math.abs(t.x - b.x) < b.width / 2 + 16;
};

describe('game-h 上100层 · 世界构建 + lockstep 确定性', () => {
  it('两份世界喂相同输入 → 每 tick 哈希逐位相同（lockstep 安全）', () => {
    const a = buildClimbWorld(['p1', 'p2']);
    const b = buildClimbWorld(['p1', 'p2']);
    // 给两名玩家不同的移动/跳跃序列，跑 150 tick，逐 tick 比对哈希。
    for (let t = 0; t < 150; t++) {
      const cmds: Command[] = [
        { playerId: 'p1', tick: t, move: { dx: t % 3 === 0 ? 1 : -1, dy: 0 }, jump: t % 7 === 0 },
        { playerId: 'p2', tick: t, move: { dx: t % 2 === 0 ? 1 : 0, dy: 0 }, jump: t % 5 === 0 },
      ];
      applyCommands(a, cmds); a.tick();
      applyCommands(b, cmds); b.tick();
      expect(hashSnapshot(a.snapshot())).toBe(hashSnapshot(b.snapshot()));
    }
  });
});

describe('game-h 上100层 · 攀爬可达性（证明跳得上去，非盲拍）', () => {
  // 贪心朝目标移动 + 起跳，在窗口内是否"曾经"落到目标台（容忍连跳途中的弹跳）。
  function climbTo(w: World, b: Box, ticks: number): boolean {
    let ok = false;
    for (let i = 0; i < ticks && !ok; i++) {
      step(w, [{ playerId: 'p1', tick: 0, move: { dx: Math.sign(b.x - T(w, P1).x), dy: 0 }, jump: true }]);
      if (onPlatform(w, P1, b)) ok = true;
    }
    return ok;
  }

  it('地面 → 第0层：从侧面起跳够得到', () => {
    const w = buildClimbWorld(['p1', 'p2']);
    setPos(w, P2, 60, 1410); // P2 挪开免干扰
    for (let i = 0; i < 20; i++) step(w); // P1 落到地面（出生在第0层侧边空地）
    expect(climbTo(w, CLIMB_PLATFORMS[0], 90)).toBe(true);
  });

  it('逐层锯齿可连续攀爬：从第0层连跳到第4层', () => {
    const w = buildClimbWorld(['p1', 'p2']);
    setPos(w, P2, 60, 1410);
    setPos(w, P1, CLIMB_PLATFORMS[0].x, restY(CLIMB_PLATFORMS[0])); // 从第0层起
    for (let i = 0; i < 20; i++) step(w); // 落稳
    let reached = 0;
    for (let target = 1; target <= 4; target++) {
      if (!climbTo(w, CLIMB_PLATFORMS[target], 100)) break;
      reached = target;
    }
    expect(reached).toBe(4); // 连续跳上 4 层，证明锯齿间距/偏移可达
  });

  it('双人登顶 → summit 旗标置真（goalRequires 双人）', () => {
    const w = buildClimbWorld(['p1', 'p2']);
    setPos(w, P1, GOAL_BOX.x - 30, GOAL_BOX.y);
    setPos(w, P2, GOAL_BOX.x + 30, GOAL_BOX.y);
    for (let i = 0; i < 8; i++) step(w);
    expect(w.getComponent<Flag>('goal', 'Flag')?.id).toBe(SUMMIT_FLAG);
    expect(w.getComponent<Flag>('goal', 'Flag')?.active).toBe(true);
  });
});

describe('game-h 上100层 · 精灵动画（按速度 idle/walk 切帧）', () => {
  it('走动 → walk clip 播放、Frame 推进；静止 → idle', () => {
    const w = buildClimbWorld(['p1', 'p2']);
    setPos(w, P2, 60, 1410);
    setPos(w, P1, CLIMB_PLATFORMS[0].x, restY(CLIMB_PLATFORMS[0]));
    for (let i = 0; i < 20; i++) step(w); // 落稳、idle
    expect(w.getComponent<AnimState>(P1, 'AnimState')?.current).toBe('idle');
    // 走动几帧 → 切到 walk + 帧号在 1..2 推进
    const seen = new Set<number>();
    for (let i = 0; i < 24; i++) { step(w, [{ playerId: 'p1', tick: 0, move: { dx: 1, dy: 0 } }]); seen.add(w.getComponent<Frame>(P1, 'Frame')!.index); }
    expect(w.getComponent<AnimState>(P1, 'AnimState')?.current).toBe('walk');
    expect(w.getComponent<Sprite>(P1, 'Sprite')?.textureKey).toContain('sheet');
    expect([...seen].some((f) => f >= 1)).toBe(true); // 走路帧（1/2）出现过
  });
});
