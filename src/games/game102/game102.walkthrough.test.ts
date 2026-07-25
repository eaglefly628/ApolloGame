// Game 102 · Pixel Pour —— **环形轨道 v2** 核心机制自验（core-experience-v2.md + 实机三图为准）。
// 机制（v2·覆盖 v1 单传送带）：部署色炮 → PathFollow 驾其**绕像素画一周** → 绕行中只打**当前所经边
// sightRadius 内暴露的同色**（过位剥离·从外向里啃）→ 巡逻预算尽入待命槽。选错色/该边无暴露同色 → 空转一圈零消除。
// ⚠ 精确逐格数 = GD 更新后的验收剧本（acceptance/*）为准；本处自验**机制不变式**（绕圈/过位剥离/空转/入槽/确定性）。
import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { applyCommands, QueuedInputSource } from '@net/index.js';
import type { Resource, Transform, GameFlow } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import type { Level } from './levels.js';

const base = { conveyorCap: 5, burstCap: 10, slots: 5, beltSpeed: 95, stars: [0, 0, 0] as [number, number, number] };
// 2D 板：满板蓝（36 格）· 零红格 —— 用于「正确色剥离」vs「选错色（红=板上零格）空转」对照。
const RING: Level = { no: 201, name: 'ring', cols: 6, rows: 6, palette: ['blue', 'red'], ammo: 20, ...base, limit: { kind: 'moves', n: 9 }, goals: [{ kind: 'clear' }], seed: 20201, bitmap: ['000000', '000000', '000000', '000000', '000000', '000000'] };
const LOOP = 200; // 约一圈绕行 tick（moveSpeed 13 × 巡逻预算）

function driven(level: Level) {
  const input = new QueuedInputSource('g102');
  const e = new Engine({ input });
  e.load(buildBlueprint(level));
  let tk = 0;
  const step = (n = 1): void => { for (let i = 0; i < n; i++) { applyCommands(e.world, input.commandsForTick(++tk)); e.world.tick(); } };
  const res = (id: string): number => e.world.getComponent<Resource>(id, 'Resource')?.current ?? NaN;
  const flow = (): string => e.world.getComponent<GameFlow>('flow', 'GameFlow')?.current ?? '?';
  const tapSupply = (color: string): void => { const t = e.world.getComponent<Transform>(`supply-${color}`, 'Transform')!; input.enqueue({ source: 'g102', x: t.x, y: t.y, phase: 'down' }); };
  // 绕行中色炮（挂 PathFollow）的当前位置（退役后返回 null）。
  const cannonPos = (): { x: number; y: number } | null => {
    for (const [id] of e.world.query('PathFollow', 'Transform')) { const t = e.world.getComponent<Transform>(id, 'Transform')!; return { x: t.x, y: t.y }; }
    return null;
  };
  return { e, step, res, flow, tapSupply, cannonPos };
}

describe('Game 102 · Pixel Pour（环形轨道 v2 · 机制不变式自验）', () => {
  it('绕圈：部署色炮 → PathFollow 驾其沿轨道绕行（位置遍历轨道包围盒·非原地）', () => {
    const g = driven(RING);
    g.step(2);
    g.tapSupply('blue');
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, sawCannon = false;
    for (let s = 0; s < 34; s++) { g.step(6); const p = g.cannonPos(); if (p) { sawCannon = true; minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); } }
    expect(sawCannon).toBe(true);
    // 轨道矩形宽 ≈ PICTURE.w + 2*margin ≈ 535；一圈应横扫过半、纵向也大幅移动（证明真在绕圈非原地/直线）。
    expect(maxX - minX).toBeGreaterThan(260);
    expect(maxY - minY).toBeGreaterThan(260);
  });

  it('过位剥离：部署正确色（蓝）→ 绕一圈啃下外沿暴露蓝格（cleared>0）→ 巡逻尽入待命槽', () => {
    const g = driven(RING);
    g.step(2);
    const before = g.res('remain-blue');
    g.tapSupply('blue');
    g.step(LOOP);
    const after = g.res('remain-blue');
    expect(before).toBe(36);
    expect(after).toBeLessThan(before);       // 过位剥掉了外沿暴露的蓝
    expect(after).toBeGreaterThanOrEqual(0);
    expect(g.res('tray-count')).toBe(1);       // 巡逻预算尽 → 退役入待命槽
    expect(g.flow()).toBe('playing');
  });

  it('选错色空转（核心风险）：部署红炮（板上零红格）→ 绕一整圈啥也没打下来（remain.blue 不变·零消除）', () => {
    const g = driven(RING);
    g.step(2);
    const blue0 = g.res('remain-blue');
    g.tapSupply('red');                        // 红=板上零格 → sightRadius 内永无红目标 → 从不开火
    g.step(LOOP);
    expect(g.res('remain-blue')).toBe(blue0);  // 蓝一格未动（选错色不误伤别色）
    expect(g.res('remain-red')).toBe(0);       // 本就零红
    expect(g.res('tray-count')).toBe(1);       // 仍绕完退役入槽（空转一圈）
    expect(g.flow()).toBe('playing');
  });

  it('取炮 = 1 move（部署即扣一步·gdd）', () => {
    const g = driven(RING);
    g.step(2);
    const m0 = g.res('moves');
    g.tapSupply('blue');
    g.step(2);
    expect(g.res('moves')).toBe(m0 - 1);
  });

  it('不部署 → 零消除（假信心自查：无输入无世界改动）', () => {
    const g = driven(RING);
    g.step(2);
    const b0 = g.res('remain-blue');
    g.step(LOOP);
    expect(g.res('remain-blue')).toBe(b0);
    expect(g.cannonPos()).toBe(null);          // 没部署 → 轨道上无炮
  });

  it('确定性：同操作两次同 hash（lockstep-safe）', () => {
    const a = driven(RING); a.step(2); a.tapSupply('blue'); a.step(80);
    const b = driven(RING); b.step(2); b.tapSupply('blue'); b.step(80);
    expect(a.e.hash()).toBe(b.e.hash());
  });
});
