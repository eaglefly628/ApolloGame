import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/core/world.js';
import type { FlowField, FlowAgent, Transform, Velocity, Status } from '@engine/protocol/components.js';
import { motionApplyCapability } from '@skills/tier1/index.js';
import {
  flowFieldCapability, bakeFlowField, buildCostField, buildIntegration, buildFlow,
  cellIndex, cellOf, fieldDigest, getBakedField, clearFlowFieldCache, flowFieldBakes,
  STRAIGHT, DIAGONAL, UNREACHABLE,
} from './flow-field.js';

const FROZEN = 1 << 0;
const xf = (x: number, y: number): Transform => ({ type: 'Transform', x, y, rotation: 0, scaleX: 1, scaleY: 1 });
const vel = (w: World, e: string): Velocity => w.getComponent<Velocity>(e, 'Velocity')!;
const pos = (w: World, e: string): Transform => w.getComponent<Transform>(e, 'Transform')!;

/** 一张 cols×rows 的场（格边长 1·原点 0,0），goals 用**格中心**坐标给。 */
function field(over: Partial<FlowField> = {}): FlowField {
  return {
    type: 'FlowField', id: 'f1', cellSize: 1, originX: 0, originY: 0,
    cols: 5, rows: 5, goals: [{ x: 4.5, y: 4.5 }], ...over,
  } as FlowField;
}
/** 行主序 blocked：传 [[col,row]…] 更好读。 */
function blockedOf(cols: number, rows: number, cells: Array<[number, number]>): number[] {
  const b = new Array(cols * rows).fill(0);
  for (const [c, r] of cells) b[r * cols + c] = 1;
  return b;
}

function world(f: FlowField, withMotion = true): World {
  const w = new World();
  for (const s of flowFieldCapability.systems) w.addSystem(s);
  if (withMotion) for (const s of motionApplyCapability.systems) w.addSystem(s);
  w.createEntity('field');
  w.addComponent('field', f);
  return w;
}
function agent(w: World, id: string, x: number, y: number, a: Partial<Omit<FlowAgent, 'type'>> = {}): void {
  w.createEntity(id);
  w.addComponent(id, xf(x, y));
  w.addComponent(id, { type: 'FlowAgent', fieldId: 'f1', speed: 1, ...a } as FlowAgent);
}

beforeEach(() => { clearFlowFieldCache(); });

describe('flow-field — 元数据 / 定序 / 申报诚实', () => {
  it('id 与系统名正确 · runsBefore motion-apply（破「读 Transform 写 Velocity」与 motion 的环）', () => {
    expect(flowFieldCapability.id).toBe('t2-flow-field');
    expect(flowFieldCapability.systems[0].id).toBe('flow-field');
    expect(flowFieldCapability.systems[0].runsBefore).toContain('motion-apply');
  });

  it('申报 = 真实访问（reads 含 Velocity——本系统缺省时会 addComponent 再改它）', () => {
    const sys = flowFieldCapability.systems[0];
    expect([...sys.reads].sort()).toEqual(['FlowAgent', 'FlowField', 'Status', 'Transform', 'Velocity']);
    expect(sys.writes).toEqual(['Velocity']);
    expect(flowFieldCapability.components.provides).toHaveProperty('FlowField');
    expect(flowFieldCapability.components.provides).toHaveProperty('FlowAgent');
  });
});

describe('flow-field — ① cost field', () => {
  it('blocked=1 → 0（不可走）· cost 缺省 1 · 非整数向上取整 · <1 钳到 1', () => {
    const f = field({ cols: 2, rows: 2, blocked: [0, 1, 0, 0], cost: [1, 9, 2.3, 0.4] });
    expect([...buildCostField(f)]).toEqual([1, 0, 3, 1]); // 墙压过 cost；2.3→3；0.4→1
    expect([...buildCostField(field({ cols: 2, rows: 2 }))]).toEqual([1, 1, 1, 1]); // 全缺省
  });
});

describe('flow-field — ② 积分场（多源 Dijkstra·整数）', () => {
  it('单源：直走 10 / 斜走 14 · 目标格 0', () => {
    const f = field({ cols: 3, rows: 3, goals: [{ x: 0.5, y: 0.5 }] }); // 左下角格
    const integ = buildIntegration(f, buildCostField(f));
    expect(integ[cellIndex(f, 0, 0)]).toBe(0);
    expect(integ[cellIndex(f, 1, 0)]).toBe(STRAIGHT);
    expect(integ[cellIndex(f, 1, 1)]).toBe(DIAGONAL);
    expect(integ[cellIndex(f, 2, 2)]).toBe(DIAGONAL * 2);
    expect(Number.isInteger(integ[cellIndex(f, 2, 2)])).toBe(true); // 全程整数=逐位可复现的根据
  });

  it('多源：每格取到**最近**那个源的代价（两个 goal 一次铺完）', () => {
    const f = field({ cols: 5, rows: 1, goals: [{ x: 0.5, y: 0.5 }, { x: 4.5, y: 0.5 }] });
    const integ = buildIntegration(f, buildCostField(f));
    expect([...integ]).toEqual([0, STRAIGHT, STRAIGHT * 2, STRAIGHT, 0]); // 中间那格离两边一样远
  });

  it('地形代价真影响积分（沼泽 3 倍 → 绕开）', () => {
    // 3×1：左端 goal，中间沼泽 cost=5 → 右端积分 = 10*5 + 10*1
    const f = field({ cols: 3, rows: 1, goals: [{ x: 0.5, y: 0.5 }], cost: [1, 5, 1] });
    const integ = buildIntegration(f, buildCostField(f));
    expect(integ[1]).toBe(STRAIGHT * 5);
    expect(integ[2]).toBe(STRAIGHT * 5 + STRAIGHT * 1);
  });

  it('墙后的孤岛 = UNREACHABLE（不是 0·不会把单位吸进墙里）', () => {
    // 3×1，中间是墙 → 右端到不了左端的 goal
    const f = field({ cols: 3, rows: 1, goals: [{ x: 0.5, y: 0.5 }], blocked: [0, 1, 0] });
    const integ = buildIntegration(f, buildCostField(f));
    expect(integ[2]).toBe(UNREACHABLE);
  });

  it('斜走不切墙角（两堵墙的对角缝不许穿过去）', () => {
    // 2×2：goal 在 (0,0)；(1,0) 与 (0,1) 都是墙 → (1,1) 只能走对角，但对角被墙角封死 ⇒ 到不了
    const f = field({ cols: 2, rows: 2, goals: [{ x: 0.5, y: 0.5 }], blocked: blockedOf(2, 2, [[1, 0], [0, 1]]) });
    const integ = buildIntegration(f, buildCostField(f));
    expect(integ[cellIndex(f, 1, 1)]).toBe(UNREACHABLE); // 撤「斜走不切墙角」→ 这里会变成 14
  });

  it('goal 落在图外 / 落在墙里 → 该源无效，其余源照常铺', () => {
    const f = field({ cols: 3, rows: 1, goals: [{ x: 99, y: 99 }, { x: 2.5, y: 0.5 }] });
    const integ = buildIntegration(f, buildCostField(f));
    expect(integ[2]).toBe(0);
    expect(integ[0]).toBe(STRAIGHT * 2);
    const walled = field({ cols: 3, rows: 1, goals: [{ x: 0.5, y: 0.5 }], blocked: [1, 0, 0] });
    expect([...buildIntegration(walled, buildCostField(walled))]).toEqual([UNREACHABLE, UNREACHABLE, UNREACHABLE]);
  });
});

describe('flow-field — ③ 方向场', () => {
  it('每格指向积分最小的邻格；目标格与墙格 = (0,0) 停', () => {
    const f = field({ cols: 3, rows: 1, goals: [{ x: 0.5, y: 0.5 }] });
    const b = bakeFlowField(f);
    expect([b.dir[0 * 2], b.dir[0 * 2 + 1]]).toEqual([0, 0]);   // 目标格
    expect([b.dir[1 * 2], b.dir[1 * 2 + 1]]).toEqual([-1, 0]);  // 朝左
    expect([b.dir[2 * 2], b.dir[2 * 2 + 1]]).toEqual([-1, 0]);
  });

  it('孤岛格 = (0,0)（到不了就别乱指一个方向）', () => {
    const f = field({ cols: 3, rows: 1, goals: [{ x: 0.5, y: 0.5 }], blocked: [0, 1, 0] });
    const b = bakeFlowField(f);
    expect([b.dir[2 * 2], b.dir[2 * 2 + 1]]).toEqual([0, 0]);
  });
});

describe('flow-field — 🔴 确定性', () => {
  it('同输入逐位相同（连铺两次·三个数组全等）', () => {
    const f = field({ cols: 24, rows: 24, goals: [{ x: 3.5, y: 20.5 }, { x: 20.5, y: 2.5 }], blocked: blockedOf(24, 24, [[10, 10], [10, 11], [10, 12], [11, 12]]) });
    const a = bakeFlowField(f);
    const b = bakeFlowField(f);
    expect([...a.integration]).toEqual([...b.integration]);
    expect([...a.dir]).toEqual([...b.dir]);
    expect([...a.cost]).toEqual([...b.cost]);
  });

  it('**缓存不是状态通道**：清空缓存后重铺，结果逐位相同（清缓存只影响耗时）', () => {
    const f = field({ cols: 16, rows: 16, goals: [{ x: 15.5, y: 15.5 }], cost: Array.from({ length: 256 }, (_, i) => (i % 7 === 0 ? 3 : 1)) });
    const warm = getBakedField(f);
    const snapshot = { integ: [...warm.integration], dir: [...warm.dir] };
    clearFlowFieldCache();
    const cold = getBakedField(f);
    expect([...cold.integration]).toEqual(snapshot.integ);
    expect([...cold.dir]).toEqual(snapshot.dir);
  });

  it('输入摘要驱动重建：改 goals / blocked / cost / 几何 任一 → 摘要必变（= 下一 tick 重铺）', () => {
    const base = field({ cols: 4, rows: 4, blocked: new Array(16).fill(0), cost: new Array(16).fill(1) });
    const d0 = fieldDigest(base);
    expect(fieldDigest(field({ cols: 4, rows: 4, blocked: new Array(16).fill(0), cost: new Array(16).fill(1) }))).toBe(d0); // 同输入同摘要
    expect(fieldDigest({ ...base, goals: [{ x: 1.5, y: 1.5 }] } as FlowField)).not.toBe(d0);
    expect(fieldDigest({ ...base, blocked: blockedOf(4, 4, [[2, 2]]) } as FlowField)).not.toBe(d0);
    expect(fieldDigest({ ...base, cost: [...new Array(15).fill(1), 3] } as FlowField)).not.toBe(d0);
    expect(fieldDigest({ ...base, cellSize: 2 } as FlowField)).not.toBe(d0);
    expect(fieldDigest({ ...base, originX: 5 } as FlowField)).not.toBe(d0);
  });

  it('无墙钟无随机（源码级：本文件零 Date.now/performance.now/Math.random）', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('./flow-field.ts', import.meta.url), 'utf8'));
    const body = src.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ''); // 剥注释再判（注释里提一句不算调用）
    expect(body).not.toMatch(/Date\.now|performance\.now|Math\.random/);
  });

  it('世界层：同一份世界跑两遍，逐 tick hash 相同（lockstep/录放安全）', () => {
    const run = (): string[] => {
      clearFlowFieldCache();
      const f = field({ cols: 12, rows: 12, goals: [{ x: 11.5, y: 11.5 }], blocked: blockedOf(12, 12, [[5, 5], [5, 6], [6, 5]]) });
      const w = world(f);
      for (let i = 0; i < 20; i++) agent(w, `a${i}`, 0.5 + (i % 4), 0.5 + Math.floor(i / 4), { speed: 0.3 });
      const out: string[] = [];
      for (let t = 0; t < 30; t++) { w.tick(); out.push(JSON.stringify(w.snapshot())); }
      return out;
    };
    expect(run()).toEqual(run());
  });
});

describe('flow-field — 单位行为（M1 验收）', () => {
  it('单位朝目标走并真的到达（8 邻域·斜穿）', () => {
    const f = field({ cols: 10, rows: 10, goals: [{ x: 9.5, y: 9.5 }] });
    const w = world(f);
    agent(w, 'u', 0.5, 0.5, { speed: 0.5, arriveRange: 0.6 });
    for (let i = 0; i < 200; i++) w.tick();
    const p = pos(w, 'u');
    expect(Math.hypot(p.x - 9.5, p.y - 9.5)).toBeLessThanOrEqual(0.6);
    expect(vel(w, 'u')).toMatchObject({ vx: 0, vy: 0 }); // 到了就停
  });

  it('**凹形障碍不卡死**（开口**背对**目标的 U——势场法必死在这里·Dijkstra 沿开口绕出去）', () => {
    // ⚠ 夹具是被"撤修验红"逼出来的：第一版的 U 开口朝上、目标也在上方——贪心朝目标走就直接出来了，
    // 于是把方向场换成势场法（朝目标直线最近的邻格）时这条**照样绿**。真陷阱必须让单位**先背离目标**：
    //   15×15 · 目标在右边中间 · U 的开口朝**左**（背对目标）· 单位关在 U 里。
    //   墙 = 右壁 col 8 (row 5..9) + 上盖 row 9 (col 4..8) + 下底 row 5 (col 4..8)。
    //   势场法：一路顶在 col 8 那堵右壁上（离目标最近的方向）→ 永远出不来。
    //   Dijkstra 积分场：铺满全图后 U 内的积分沿开口方向单调下降 → 先向左、绕出去、再向右。
    const cells: Array<[number, number]> = [];
    for (let r = 5; r <= 9; r++) cells.push([8, r]);
    for (let c = 4; c <= 8; c++) { cells.push([c, 9]); cells.push([c, 5]); }
    const f = field({ cols: 15, rows: 15, goals: [{ x: 14.5, y: 7.5 }], blocked: blockedOf(15, 15, cells) });
    const w = world(f);
    agent(w, 'u', 6.5, 7.5, { speed: 0.4, arriveRange: 0.8 });   // U 腔正中
    let leftmost = 6.5;
    for (let i = 0; i < 600; i++) { w.tick(); leftmost = Math.min(leftmost, pos(w, 'u').x); }
    const p = pos(w, 'u');
    expect(leftmost).toBeLessThan(4);                                     // 真的先往**反方向**走了（绕出开口）
    expect(Math.hypot(p.x - 14.5, p.y - 7.5)).toBeLessThanOrEqual(0.8);   // 最终到达
  });

  it('多源：两个单位各走向离自己最近的那个 goal', () => {
    const f = field({ cols: 9, rows: 1, goals: [{ x: 0.5, y: 0.5 }, { x: 8.5, y: 0.5 }] });
    const w = world(f);
    agent(w, 'left', 2.5, 0.5, { speed: 0.5 });
    agent(w, 'right', 6.5, 0.5, { speed: 0.5 });
    w.tick();
    expect(vel(w, 'left').vx).toBeLessThan(0);
    expect(vel(w, 'right').vx).toBeGreaterThan(0);
  });

  it('停的四种情形各自成立：CC 定身 / 场不在 / 网格外 / 站在墙里', () => {
    const f = field({ cols: 5, rows: 5, goals: [{ x: 4.5, y: 4.5 }], blocked: blockedOf(5, 5, [[2, 2]]) });
    const w = world(f, false);
    agent(w, 'frozen', 0.5, 0.5, { speed: 1, haltStatusMask: FROZEN });
    w.addComponent('frozen', { type: 'Status', flags: FROZEN } as Status);
    agent(w, 'nofield', 0.5, 1.5, { speed: 1, fieldId: '不存在的场' });
    agent(w, 'outside', -99, -99, { speed: 1 });
    agent(w, 'inwall', 2.5, 2.5, { speed: 1 });
    agent(w, 'ok', 0.5, 2.5, { speed: 1 });
    w.tick();
    for (const id of ['frozen', 'nofield', 'outside', 'inwall']) {
      expect({ id, ...vel(w, id) }).toMatchObject({ vx: 0, vy: 0 });
    }
    expect(Math.hypot(vel(w, 'ok').vx, vel(w, 'ok').vy)).toBeCloseTo(1, 6); // 正常单位照走
  });

  it('速度写成 speed 模长（斜走也是 speed·不是 speed×√2）', () => {
    const f = field({ cols: 4, rows: 4, goals: [{ x: 3.5, y: 3.5 }] });
    const w = world(f, false);
    agent(w, 'u', 0.5, 0.5, { speed: 2 });
    w.tick();
    const v = vel(w, 'u');
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(2, 6);
  });

  it('没挂 Velocity 的单位会被补上（不因缺组件静默不动）', () => {
    const f = field({ cols: 3, rows: 3, goals: [{ x: 2.5, y: 2.5 }] });
    const w = world(f, false);
    w.createEntity('u');
    w.addComponent('u', xf(0.5, 0.5));
    w.addComponent('u', { type: 'FlowAgent', fieldId: 'f1', speed: 1 } as FlowAgent);
    expect(w.getComponent('u', 'Velocity')).toBeUndefined();
    w.tick();
    expect(Math.hypot(vel(w, 'u').vx, vel(w, 'u').vy)).toBeCloseTo(1, 6);
  });

  it('零单位世界 = 零工作（没有 FlowAgent 时不铺场·不写任何东西）', () => {
    const f = field();
    const w = world(f, false);
    const before = JSON.stringify(w.snapshot());
    w.tick();
    expect(JSON.stringify(w.snapshot())).toBe(before);
  });
});

describe('flow-field — M1 判据（**语义版**·零墙钟）', () => {
  // ⚠ 计时判据不放这儿：`src/**/*.test.ts` 禁墙钟（test-hygiene 守卫会拦·墙钟断言天生 flaky）。
  // 真实耗时的量化在 `games/game211/pathfind-scale.bench.test.ts`（那里本来就是量成本的地方，
  // 且与工单援引的对照数字同文件同机可比）。这里只留**不靠计时也能咬住**的两条语义判据。
  it('**成本与单位数无关**（这条卖点直接用铺场次数咬住·不靠计时）：1000 与 4000 单位跑 30 拍，都只铺 1 次', () => {
    const run = (units: number): number => {
      clearFlowFieldCache();
      const f = field({ cols: 64, rows: 64, cellSize: 1, goals: [{ x: 63.5, y: 63.5 }] });
      const w = world(f, false);
      for (let i = 0; i < units; i++) agent(w, `a${i}`, (i % 64) + 0.5, (Math.floor(i / 64) % 64) + 0.5, { speed: 1 });
      for (let i = 0; i < 30; i++) w.tick();
      return flowFieldBakes();
    };
    expect(run(1000)).toBe(1);   // 撤「取场提到单位循环外」→ 这里会变成 30000
    expect(run(4000)).toBe(1);   // 单位翻四倍，铺场次数纹丝不动 = 成本与单位数无关
  }, 120_000);

  it('重建时机确定：输入不变永不重铺 · goals/blocked 一变下一 tick 就重铺（无墙钟无空闲调度）', () => {
    clearFlowFieldCache();
    const f = field({ cols: 16, rows: 16, goals: [{ x: 15.5, y: 15.5 }] });
    const w = world(f, false);
    agent(w, 'u', 0.5, 0.5, { speed: 1 });
    for (let i = 0; i < 10; i++) w.tick();
    expect(flowFieldBakes()).toBe(1);
    // 目标搬家 → 下一拍必重铺（作者改数据，引擎跟上）
    const live = w.getComponent<FlowField>('field', 'FlowField')!;
    (live.goals as Array<{ x: number; y: number }>)[0] = { x: 0.5, y: 15.5 };
    w.tick();
    expect(flowFieldBakes()).toBe(2);
    for (let i = 0; i < 10; i++) w.tick();
    expect(flowFieldBakes()).toBe(2);   // 又不动了 → 不再重铺
  }, 60_000);
});