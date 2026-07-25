import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { PathFollow, Transform, Velocity } from '@engine/protocol/components.js';
import { pathFollowCapability, pathFollowAt } from './path-follow.js';
import { motionApplyCapability } from '@skills/tier1/index.js';
import { steeringCapability, launchCapability } from '@skills/tier2/index.js';
import { aggroCapability } from '@skills/tier3/index.js';

// path-follow 固定航点轨道测试（REQ-PATHFOLLOW）。确定性·无随机/墙钟。
const xf = (x: number, y: number): Transform => ({ type: 'Transform', x, y, rotation: 0, scaleX: 1, scaleY: 1 });
const pos = (w: World, e: string): Transform => w.getComponent<Transform>(e, 'Transform')!;
const vel = (w: World, e: string): Velocity => w.getComponent<Velocity>(e, 'Velocity')!;
const pf = (w: World, e: string): PathFollow => w.getComponent<PathFollow>(e, 'PathFollow')!;

// path-follow(定速) + motion-apply(积分)。
function world(): World {
  const w = new World();
  for (const s of pathFollowCapability.systems) w.addSystem(s);
  for (const s of motionApplyCapability.systems) w.addSystem(s);
  return w;
}
function follower(w: World, id: string, x: number, y: number, comp: Omit<PathFollow, 'type'>): void {
  w.createEntity(id);
  w.addComponent(id, xf(x, y));
  w.addComponent(id, { type: 'PathFollow', ...comp } as PathFollow);
}

describe('path-follow — 元数据 / 定序', () => {
  it('id 正确 + runsBefore motion-apply', () => {
    expect(pathFollowCapability.id).toBe('t2-path-follow');
    expect(pathFollowCapability.systems[0].runsBefore).toContain('motion-apply');
  });
});

describe('path-follow — 航点推进', () => {
  it('两航点：从 wp0 朝 wp1 走，进 arriveRadius 内 index 前进', () => {
    const w = world();
    follower(w, 'm', 0, 0, pathFollowAt([{ x: 100, y: 0 }, { x: 100, y: 100 }], 2));
    w.tick();
    expect(vel(w, 'm').vx).toBeCloseTo(2, 9); // 首 tick 朝 wp0 方向
    expect(pf(w, 'm').index).toBe(0);
    // 跑到 wp0 附近（arriveRadius 缺省 4）。
    for (let i = 0; i < 60; i++) w.tick();
    expect(pos(w, 'm').x).toBeGreaterThanOrEqual(96);
    expect(pf(w, 'm').index).toBe(1); // 已到达 wp0 → 游标前进到 wp1
  });

  it('到达那一 tick 立即朝新航点走（不空转）', () => {
    const w = world();
    // 起点几乎贴着 wp0（在 arriveRadius 内），wp1 在别处。
    follower(w, 'm', 99, 0, pathFollowAt([{ x: 100, y: 0 }, { x: 100, y: 100 }], 2));
    w.tick();
    expect(pf(w, 'm').index).toBe(1); // 一 tick 内完成到达+推进
    expect(vel(w, 'm').vy).toBeGreaterThan(0); // 已朝 wp1（y 增）方向走
  });
});

describe('path-follow — loop / 非 loop 终点', () => {
  // 注：speed 须 <= arriveRadius 才保证「距离每 tick 精确减 speed、不越过到达窗再反弹」——
  // speed 远大于 arriveRadius 时，方向逐 tick 重瞄会在到达窗两侧来回越过（永不停、永不精确回 0），
  // 这是「定速直奔 + 离散逐 tick 判定」的固有约束（同 pathfind.ts NavAgent.waypointRange 注释所述取舍），
  // 非 bug——测试按此约束选参数以拿到确定的「已到达/已停」断言。
  it('loop 闭环：跑到末航点后回到 index 0', () => {
    const w = world();
    follower(w, 'm', 0, 0, pathFollowAt([{ x: 5, y: 0 }, { x: 5, y: 5 }], 1, { loop: true, arriveRadius: 1 }));
    // 闭环持续循环（1→0→1→…），不掐一个固定 tick 数断言瞬时值（脆），改记录轨迹：
    // 先推进到航点1、随后又回到航点0 = 证明「跑完末航点回到 index 0」成立。
    let sawIndex1 = false;
    let loopedBack = false;
    for (let i = 0; i < 12 && !loopedBack; i++) {
      w.tick();
      const idx = pf(w, 'm').index;
      if (idx === 1) sawIndex1 = true;
      if (sawIndex1 && idx === 0) loopedBack = true;
    }
    expect(sawIndex1).toBe(true); // 确实推进到了航点1
    expect(loopedBack).toBe(true); // 之后又循环回到航点0
  });

  it('非 loop：跑完停在末点，Velocity 归零', () => {
    const w = world();
    follower(w, 'm', 0, 0, pathFollowAt([{ x: 4, y: 0 }], 1));
    for (let i = 0; i < 6; i++) w.tick();
    expect(pf(w, 'm').index).toBe(0); // 唯一航点，钉死在末点（=0）
    expect(pos(w, 'm').x).toBeCloseTo(4, 9); // 精确停在航点上（d===0）
    expect(vel(w, 'm').vx).toBe(0);
    expect(vel(w, 'm').vy).toBe(0);
  });
});

describe('path-follow — 速度模长', () => {
  it('首 tick 方向正确、|v|≈speed', () => {
    const w = world();
    follower(w, 'm', 0, 0, pathFollowAt([{ x: 3, y: 4 }], 5)); // 3-4-5 三角
    w.tick();
    const v = vel(w, 'm');
    expect(v.vx).toBeCloseTo(3, 9);
    expect(v.vy).toBeCloseTo(4, 9);
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(5, 9);
  });
});

describe('path-follow — 边界', () => {
  it('空 waypoints → Velocity 置零', () => {
    const w = world();
    follower(w, 'm', 0, 0, { waypoints: [], speed: 3, index: 0 });
    w.tick();
    expect(vel(w, 'm').vx).toBe(0);
    expect(vel(w, 'm').vy).toBe(0);
  });
});

describe('path-follow — 确定性', () => {
  it('同布局跑两遍 → snapshot 相等', () => {
    const run = (): string => {
      const w = world();
      follower(w, 'a', 0, 0, pathFollowAt([{ x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }], 1.5, { loop: true }));
      follower(w, 'b', 10, 10, pathFollowAt([{ x: 20, y: 10 }], 2));
      for (let i = 0; i < 30; i++) w.tick();
      return JSON.stringify(w.snapshot());
    };
    expect(run()).toBe(run());
  });
});

describe('path-follow — 调度定序（撞环回归·同 orbit-motion「调度定序」先例）', () => {
  it('与 motion-apply/steering/aggro/launch 同装不成环·可 tick', () => {
    // 真撞环（不是假设）：path-follow 与 steering 都声明 reads+writes Velocity（对齐 steering 的既有口径、
    // 保留"存在性检查"语义），组件图给出互为前驱的两条边 → 判成 RMW 伪环（topological-sort.ts 报
    // "Circular dependency detected among systems: motion-apply, steering, path-follow"）。
    // 两者作用于不同实体集（PathFollow vs Steering 挂载对象不同）、顺序对结果无影响，
    // 已在 path-follow.ts 系统声明上补 `runsAfter: ['steering']` 打破（同 steering.ts 注释所述 RMW 破环手法）。
    // path-follow 不读 Relation/Status/Tag，与 aggro（写 Relation）/hitbox/over-time（写 Status）无耦合；
    // 与 launch 也无环（launch 未在 reads 里声明 Velocity，只有单向"launch 先写、path-follow 后读"的边）。
    const w = new World();
    for (const cap of [motionApplyCapability, steeringCapability, aggroCapability, launchCapability, pathFollowCapability]) {
      for (const s of cap.systems) w.addSystem(s);
    }
    w.createEntity('enemy');
    w.addComponent('enemy', xf(0, 0));
    w.addComponent('enemy', { type: 'Perception', targetTag: 0, sightRadius: -1 } as never); // 空索敌（无 Tag 目标）
    follower(w, 'patroller', 0, 0, pathFollowAt([{ x: 10, y: 0 }, { x: 10, y: 10 }], 1, { loop: true }));
    expect(() => {
      for (let i = 0; i < 5; i++) w.tick();
    }).not.toThrow();
    expect(pf(w, 'patroller').waypoints.length).toBe(2); // 仍在正常跑（未被拓扑排序破坏状态）
  });
});
