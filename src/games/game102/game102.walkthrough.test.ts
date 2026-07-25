// Game 102 · Pixel Pour —— **环形轨道 v2** 核心机制自验（core-experience-v2.md + 实机三图为准）。
// 机制（v2·覆盖 v1 单传送带）：部署色炮 → PathFollow 驾其**绕像素画一周** → 绕行中只打**当前所经边
// sightRadius 内暴露的同色**（过位剥离·从外向里啃）→ 巡逻预算尽入待命槽。选错色/该边无暴露同色 → 空转一圈零消除。
// ⚠ 精确逐格数 = GD 更新后的验收剧本（acceptance/*）为准；本处自验**机制不变式**（绕圈/过位剥离/空转/入槽/确定性）。
import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { applyCommands, QueuedInputSource } from '@net/index.js';
import type { Resource, Transform, GameFlow, Caster } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import type { Level } from './levels.js';

const base = { conveyorCap: 6, burstCap: 10, slots: 5, beltSpeed: 95, stars: [0, 0, 0] as [number, number, number] };
// 同心 8×8：蓝(外·可达) 包 红(2×2 心·深内层·一圈内轨道 sightRadius 够不到) —— 对照「正确色剥外层」vs「深内层一圈剥不到」。
const RING: Level = { no: 201, name: 'ring', cols: 8, rows: 8, palette: ['blue', 'red'], ammo: 20, ...base, limit: { kind: 'moves', n: 99 }, goals: [{ kind: 'clear' }], seed: 20201,
  bitmap: ['00000000', '00000000', '00000000', '00011000', '00011000', '00000000', '00000000', '00000000'] };
const LOOP = 200; // 约一圈绕行 tick（moveSpeed 13 × 巡逻预算）

function driven(level: Level) {
  const input = new QueuedInputSource('g102');
  const e = new Engine({ input });
  e.load(buildBlueprint(level));
  let tk = 0;
  const step = (n = 1): void => { for (let i = 0; i < n; i++) { applyCommands(e.world, input.commandsForTick(++tk)); e.world.tick(); } };
  const res = (id: string): number => e.world.getComponent<Resource>(id, 'Resource')?.current ?? NaN;
  const flow = (): string => e.world.getComponent<GameFlow>('flow', 'GameFlow')?.current ?? '?';
  // 点待发弹库中**首个该色**炮（递进队列·pool-<i>·Caster.template=cannon_<color>）。
  const tapSupply = (color: string): void => {
    for (const [id] of e.world.query('Caster', 'Transform')) {
      if (!id.startsWith('pool-')) continue;
      const c = e.world.getComponent<Caster>(id, 'Caster');
      if (c?.template === `cannon_${color}`) { const t = e.world.getComponent<Transform>(id, 'Transform')!; input.enqueue({ source: 'g102', x: t.x, y: t.y, phase: 'down' }); return; }
    }
  };
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
    expect(maxX - minX).toBeGreaterThan(200);
    expect(maxY - minY).toBeGreaterThan(200);
  });

  it('过位剥离 + per-shot 扣弹：部署蓝（外圈可达）→ 沿边逐格一一命中·每命中扣一发 → 打光(ammo=0)消失', () => {
    const g = driven(RING);
    g.step(2);
    const before = g.res('remain-blue');
    g.tapSupply('blue');
    g.step(560);                               // 够炮沿轨绕行把 ammo 打光（moveSpeed 5·慢）
    const after = g.res('remain-blue');
    expect(before).toBe(60);                   // 8×8 外蓝 60 格
    expect(after).toBeLessThan(before);        // 过位逐格剥掉外沿暴露蓝
    // per-shot：净消除 == 该炮 ammo（20）——每命中才扣一发·打满即消失（守恒·非巡逻时长）。
    expect(before - after).toBe(20);
    expect(g.cannonPos()).toBe(null);          // 打光→物理退场（消失·不占轨道）
    expect(g.flow()).toBe('playing');
  });

  it('深内层剥不到（次序依赖·选错色不减弹）：部署红炮（红=2×2 深内层·轨道够不到）→ 零消除·红不减·满弹不误伤', () => {
    const g = driven(RING);
    g.step(2);
    const blue0 = g.res('remain-blue');
    g.tapSupply('red');                        // 红在深内层·外圈蓝未清前暴露不到 → 一圈打不到
    g.step(LOOP);
    expect(g.res('remain-red')).toBe(4);       // 红一格未动（内层未暴露/够不到）
    expect(g.res('remain-blue')).toBe(blue0);  // 也没误伤蓝
    expect(g.cannonPos()).not.toBe(null);       // 选错色不开火→不扣弹→满弹·仍在带上绕（待接自动入槽）
    expect(g.flow()).toBe('playing');
  });

  it('部署即从弹库消费（递进队列·pool 减一门）', () => {
    const g = driven(RING);
    g.step(2);
    const poolCount = (): number => [...g.e.world.query('Caster', 'Transform')].filter(([id]) => id.startsWith('pool-')).length;
    const p0 = poolCount();
    g.tapSupply('blue');
    g.step(3);
    expect(poolCount()).toBe(p0 - 1);          // 取走一门·弹库减一
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
