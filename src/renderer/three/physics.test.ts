// 真物理刚体（cannon-es·render-only 表现·非同步）：重力下落 + 落地不穿地 + render-only 不进 hash。
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { PhysicsSystem, preloadPhysics } from './physics.js';
import { World } from '@engine/core/world.js';
import { hashSnapshot } from '@net/index.js';
import type { RigidBody3D, Transform3D, Mesh3D, Impulse3D, Joint3D } from '@engine/protocol/components.js';

describe('PhysicsSystem：真物理刚体（cannon-es·render-only 表现）', () => {
  beforeAll(async () => { await preloadPhysics(); }); // cannon-es 懒加载 → 测试先预载，首帧即可步进
  it('刚体在重力下下落 → 落地停在地面之上（不穿地）+ 写四元数', () => {
    const w = new World();
    w.createEntity('d');
    w.addComponent('d', { type: 'Transform3D', x: 0, y: 20, z: 0 } as Transform3D);
    w.addComponent('d', { type: 'Mesh3D', shape: 'box', width: 4, height: 4, depth: 4, frontTint: 0xffffff } as Mesh3D);
    w.addComponent('d', { type: 'RigidBody3D', shape: 'box', mass: 1 } as RigidBody3D);
    const phys = new PhysicsSystem();
    const t = (): Transform3D => w.getComponent<Transform3D>('d', 'Transform3D')!;
    const y0 = t().y;
    for (let i = 1; i <= 10; i++) phys.sync(w, i * 16.7);
    expect(t().y).toBeLessThan(y0); // 下落了
    for (let i = 11; i <= 240; i++) phys.sync(w, i * 16.7);
    expect(t().y).toBeGreaterThan(1.0); // 盒半高 2·没穿地
    expect(t().y).toBeLessThan(3.5); // 停在地面附近
    expect(t().quat).toBeTruthy(); // 写了四元数
    phys.dispose();
  });

  it('cylinder 碰撞形（桶/冰球）：下落落地不穿地', () => {
    const w = new World();
    w.createEntity('cyl');
    w.addComponent('cyl', { type: 'Transform3D', x: 0, y: 18, z: 0 } as Transform3D);
    w.addComponent('cyl', { type: 'Mesh3D', shape: 'cylinder', width: 4, height: 3, frontTint: 0xffffff } as Mesh3D);
    w.addComponent('cyl', { type: 'RigidBody3D', shape: 'cylinder', mass: 1 } as RigidBody3D);
    const phys = new PhysicsSystem();
    const t = (): Transform3D => w.getComponent<Transform3D>('cyl', 'Transform3D')!;
    for (let i = 1; i <= 240; i++) phys.sync(w, i * 16.7);
    expect(t().y).toBeGreaterThan(0.3); // 落地·没穿地（高 3·半高 1.5 左右稳住）
    expect(t().y).toBeLessThan(6);
    phys.dispose();
  });

  it('angularFactor 锁转轴（[0,1,0]）：薄圆盘带 X 翻滚初速也永不立边（只准平旋）', () => {
    const w = new World();
    w.createEntity('disc');
    w.addComponent('disc', { type: 'Transform3D', x: 0, y: 10, z: 0 } as Transform3D);
    w.addComponent('disc', { type: 'Mesh3D', shape: 'cylinder', width: 6, height: 0.6, frontTint: 0xffffff } as Mesh3D); // 薄圆盘（筹码）
    // 给 X 翻滚初速（本会立起/翻倒）+ angularFactor 锁 X/Z → 只准绕 Y 平旋
    w.addComponent('disc', { type: 'RigidBody3D', shape: 'cylinder', mass: 1, avx: 8, avy: 3, angularFactor: [0, 1, 0] } as RigidBody3D);
    const phys = new PhysicsSystem();
    const t = (): Transform3D => w.getComponent<Transform3D>('disc', 'Transform3D')!;
    for (let i = 1; i <= 240; i++) phys.sync(w, i * 16.7);
    const q = t().quat!; // [x,y,z,w]·orientation
    // 锁 X/Z → 姿态只含 Y 轴旋转 → quat 的 x、z 分量恒 ≈0（永远平躺·不立边）
    expect(Math.abs(q[0])).toBeLessThan(0.02); // 无 X 翻
    expect(Math.abs(q[2])).toBeLessThan(0.02); // 无 Z 翻
    // 上向量 up=q·(0,1,0) 的 y 分量 ≈1（盘面朝上·彻底平）
    const upY = 1 - 2 * (q[0] * q[0] + q[2] * q[2]);
    expect(upY).toBeGreaterThan(0.999);
    phys.dispose();
  });

  it('capsule 碰撞形（角色）：下落立地不穿地', () => {
    const w = new World();
    w.createEntity('cap');
    w.addComponent('cap', { type: 'Transform3D', x: 0, y: 20, z: 0 } as Transform3D);
    w.addComponent('cap', { type: 'Mesh3D', shape: 'capsule', width: 2, height: 5, frontTint: 0xffffff } as Mesh3D);
    w.addComponent('cap', { type: 'RigidBody3D', shape: 'capsule', mass: 1 } as RigidBody3D);
    const phys = new PhysicsSystem();
    const t = (): Transform3D => w.getComponent<Transform3D>('cap', 'Transform3D')!;
    for (let i = 1; i <= 240; i++) phys.sync(w, i * 16.7);
    expect(t().y).toBeGreaterThan(0.8); // 底半球坐地·没穿地（半径 1）
    expect(t().y).toBeLessThan(4);
    phys.dispose();
  });

  it('heightfield 地形（静态·恒 mass0）：球落在抬高的地形上·高于基础地面', () => {
    const w = new World();
    w.createEntity('terrain');
    w.addComponent('terrain', { type: 'Transform3D', x: 0, y: 0, z: 0 } as Transform3D);
    const heights = [[5, 5, 5, 5], [5, 5, 5, 5], [5, 5, 5, 5], [5, 5, 5, 5]]; // 平抬高台 y=5
    w.addComponent('terrain', { type: 'RigidBody3D', shape: 'heightfield', mass: 3, heights, elementSize: 4 } as RigidBody3D); // mass 给了也强制静态
    w.createEntity('ball');
    w.addComponent('ball', { type: 'Transform3D', x: 6, y: 20, z: -6 } as Transform3D); // 落在地形网格足迹内（世界 x∈[0,12]·z∈[0,-12]）
    w.addComponent('ball', { type: 'Mesh3D', shape: 'sphere', width: 2, height: 2, frontTint: 0xffffff } as Mesh3D);
    w.addComponent('ball', { type: 'RigidBody3D', shape: 'sphere', mass: 1 } as RigidBody3D);
    const phys = new PhysicsSystem();
    const tb = (): Transform3D => w.getComponent<Transform3D>('ball', 'Transform3D')!;
    for (let i = 1; i <= 300; i++) phys.sync(w, i * 16.7);
    expect(tb().y).toBeGreaterThan(4); // 停在抬高地形(5)之上·而非落到基础地面(y≈1)
    phys.dispose();
  });

  it('convex 凸包（不规则道具）：由 hull 顶点算凸面·下落立地不穿地', () => {
    const w = new World();
    w.createEntity('rock');
    w.addComponent('rock', { type: 'Transform3D', x: 0, y: 20, z: 0 } as Transform3D);
    // 立方体 8 角 → 凸包 = 2×2×2 盒
    const hull: Array<[number, number, number]> = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
    ];
    w.addComponent('rock', { type: 'RigidBody3D', shape: 'convex', mass: 1, hull } as RigidBody3D);
    const phys = new PhysicsSystem();
    const t = (): Transform3D => w.getComponent<Transform3D>('rock', 'Transform3D')!;
    for (let i = 1; i <= 240; i++) phys.sync(w, i * 16.7);
    expect(t().y).toBeGreaterThan(0.5); // 凸包坐地·没穿地（半高 1）
    expect(t().y).toBeLessThan(3);
    phys.dispose();
  });

  it('无刚体时 sync 返回 0（不建物理世界）；有则返回刚体数', () => {
    const w = new World();
    const phys = new PhysicsSystem();
    expect(phys.sync(w, 16)).toBe(0);
    w.createEntity('d');
    w.addComponent('d', { type: 'Transform3D', x: 0, y: 10, z: 0 } as Transform3D);
    w.addComponent('d', { type: 'RigidBody3D', shape: 'box', mass: 1 } as RigidBody3D);
    expect(phys.sync(w, 32)).toBe(1);
    phys.dispose();
  });

  it('Impulse3D 数据触发施力：bump trigger → 施一次冲量（水平速度起来）·同 trigger 不重复施', () => {
    const w = new World();
    w.createEntity('ball');
    w.addComponent('ball', { type: 'Transform3D', x: 0, y: 3, z: 0 } as Transform3D);
    w.addComponent('ball', { type: 'Mesh3D', shape: 'sphere', width: 2, height: 2, frontTint: 0xffffff } as Mesh3D);
    w.addComponent('ball', { type: 'RigidBody3D', shape: 'sphere', mass: 1 } as RigidBody3D);
    w.addComponent('ball', { type: 'Impulse3D', trigger: 0, x: 0, y: 0, z: 0 } as Impulse3D);
    const phys = new PhysicsSystem();
    const t = (): Transform3D => w.getComponent<Transform3D>('ball', 'Transform3D')!;
    for (let i = 1; i <= 5; i++) phys.sync(w, i * 16.7); // 落到地面稳住
    const xBefore = t().x;
    // bump trigger + 水平冲量 → 球被弹向 +X
    const imp = w.getComponent<Impulse3D>('ball', 'Impulse3D')!;
    (imp as { trigger: number; x: number }).trigger = 1;
    (imp as { trigger: number; x: number }).x = 12;
    for (let i = 6; i <= 30; i++) phys.sync(w, i * 16.7);
    const xAfter = t().x;
    expect(xAfter).toBeGreaterThan(xBefore + 1); // 冲量把球推向 +X
    // 同 trigger 不再施力：记录位移趋势后再跑若干帧不应有新的突跃（仅惯性/摩擦）
    const xMid = t().x;
    for (let i = 31; i <= 45; i++) phys.sync(w, i * 16.7);
    expect(t().x).toBeGreaterThanOrEqual(xMid - 0.01); // 未反向突变（没被重复反复施力乱套）
    phys.dispose();
  });

  it('Impulse3D 首见基线：静态带 trigger 的场景装载不自射（出生初速用 vx）', () => {
    const w = new World();
    w.createEntity('ball');
    w.addComponent('ball', { type: 'Transform3D', x: 0, y: 3, z: 0 } as Transform3D);
    w.addComponent('ball', { type: 'Mesh3D', shape: 'sphere', width: 2, height: 2, frontTint: 0xffffff } as Mesh3D);
    w.addComponent('ball', { type: 'RigidBody3D', shape: 'sphere', mass: 1 } as RigidBody3D);
    w.addComponent('ball', { type: 'Impulse3D', trigger: 5, x: 20, y: 0, z: 0 } as Impulse3D); // 静态非零冲量·trigger 从未 bump
    const phys = new PhysicsSystem();
    const t = (): Transform3D => w.getComponent<Transform3D>('ball', 'Transform3D')!;
    for (let i = 1; i <= 30; i++) phys.sync(w, i * 16.7);
    expect(Math.abs(t().x)).toBeLessThan(0.5); // 没被水平弹出（首见=基线·不施力）
    phys.dispose();
  });

  it('applyImpulse 命令式接口（输入胶水甩球）：直接对刚体施冲量', () => {
    const w = new World();
    w.createEntity('b');
    w.addComponent('b', { type: 'Transform3D', x: 0, y: 3, z: 0 } as Transform3D);
    w.addComponent('b', { type: 'Mesh3D', shape: 'sphere', width: 2, height: 2, frontTint: 0xffffff } as Mesh3D);
    w.addComponent('b', { type: 'RigidBody3D', shape: 'sphere', mass: 1 } as RigidBody3D);
    const phys = new PhysicsSystem();
    const t = (): Transform3D => w.getComponent<Transform3D>('b', 'Transform3D')!;
    for (let i = 1; i <= 5; i++) phys.sync(w, i * 16.7);
    const zBefore = t().z;
    phys.applyImpulse('b', 0, 0, 14); // 命令式：沿 +Z 弹
    for (let i = 6; i <= 30; i++) phys.sync(w, i * 16.7);
    expect(t().z).toBeGreaterThan(zBefore + 1);
    phys.dispose();
  });

  it('Joint3D point 约束：本体连接点锁定在世界锚（球铰·抗重力不掉落）', () => {
    const w = new World();
    w.createEntity('bob');
    w.addComponent('bob', { type: 'Transform3D', x: 0, y: 12, z: 0 } as Transform3D);
    w.addComponent('bob', { type: 'Mesh3D', shape: 'sphere', width: 2, height: 2, frontTint: 0xffffff } as Mesh3D);
    w.addComponent('bob', { type: 'RigidBody3D', shape: 'sphere', mass: 1 } as RigidBody3D);
    w.addComponent('bob', { type: 'Joint3D', kind: 'point', anchor: [0, 12, 0] } as Joint3D); // 中心 pivot 钉到 (0,12,0)
    const phys = new PhysicsSystem();
    const t = (): Transform3D => w.getComponent<Transform3D>('bob', 'Transform3D')!;
    for (let i = 1; i <= 120; i++) phys.sync(w, i * 16.7);
    // point 约束把连接点(球心)锁在锚 → 抗重力·不掉落（球心始终 ≈ 锚·可自由转）
    expect(Math.hypot(t().x - 0, t().y - 12, t().z - 0)).toBeLessThan(1);
    phys.dispose();
  });

  it('Joint3D distance 约束（连杆）：两刚体保持定距', () => {
    const w = new World();
    w.createEntity('a'); w.createEntity('b');
    w.addComponent('a', { type: 'Transform3D', x: 0, y: 15, z: 0 } as Transform3D);
    w.addComponent('a', { type: 'Mesh3D', shape: 'sphere', width: 2, height: 2, frontTint: 0xffffff } as Mesh3D);
    w.addComponent('a', { type: 'RigidBody3D', shape: 'sphere', mass: 0 } as RigidBody3D); // 静态锚（mass0）
    w.addComponent('b', { type: 'Transform3D', x: 5, y: 15, z: 0 } as Transform3D);
    w.addComponent('b', { type: 'Mesh3D', shape: 'sphere', width: 2, height: 2, frontTint: 0xffffff } as Mesh3D);
    w.addComponent('b', { type: 'RigidBody3D', shape: 'sphere', mass: 1 } as RigidBody3D);
    w.addComponent('b', { type: 'Joint3D', kind: 'distance', bodyB: 'a', distance: 5 } as Joint3D);
    const phys = new PhysicsSystem();
    const tb = (): Transform3D => w.getComponent<Transform3D>('b', 'Transform3D')!;
    for (let i = 1; i <= 120; i++) phys.sync(w, i * 16.7);
    const ta = w.getComponent<Transform3D>('a', 'Transform3D')!;
    const d = Math.hypot(tb().x - ta.x, tb().y - ta.y, tb().z - ta.z);
    expect(d).toBeGreaterThan(4); expect(d).toBeLessThan(6.5); // 保持定距 ~5（连杆·b 绕 a 摆但距离锁定）
    phys.dispose();
  });

  it('Joint3D 端点实体消失 → 拆约束不崩（悬垂引用防护）', () => {
    const w = new World();
    w.createEntity('a'); w.createEntity('b');
    for (const id of ['a', 'b']) {
      w.addComponent(id, { type: 'Transform3D', x: id === 'a' ? 0 : 4, y: 12, z: 0 } as Transform3D);
      w.addComponent(id, { type: 'Mesh3D', shape: 'sphere', width: 2, height: 2, frontTint: 0xffffff } as Mesh3D);
      w.addComponent(id, { type: 'RigidBody3D', shape: 'sphere', mass: id === 'a' ? 0 : 1 } as RigidBody3D);
    }
    w.addComponent('b', { type: 'Joint3D', kind: 'point', bodyB: 'a' } as Joint3D);
    const phys = new PhysicsSystem();
    phys.sync(w, 16.7);
    w.destroyEntity('a'); // 锚实体消失 → 约束须拆
    expect(() => { for (let i = 2; i <= 10; i++) phys.sync(w, i * 16.7); }).not.toThrow();
    phys.dispose();
  });

  it('roll 重落：静态体（mass0 围栏/地台）不被甩飞·动态体才重落', () => {
    const w = new World();
    // 静态围栏（mass0·坐地 y=3）
    w.createEntity('wall');
    w.addComponent('wall', { type: 'Transform3D', x: 10, y: 3, z: 0 } as Transform3D);
    w.addComponent('wall', { type: 'Mesh3D', shape: 'box', width: 2, height: 6, depth: 20, frontTint: 0xffffff } as Mesh3D);
    w.addComponent('wall', { type: 'RigidBody3D', shape: 'box', mass: 0 } as RigidBody3D);
    // 动态方块（mass1·已落地）
    w.createEntity('blk');
    w.addComponent('blk', { type: 'Transform3D', x: 0, y: 8, z: 0 } as Transform3D);
    w.addComponent('blk', { type: 'Mesh3D', shape: 'box', width: 4, height: 4, depth: 4, frontTint: 0xffffff } as Mesh3D);
    w.addComponent('blk', { type: 'RigidBody3D', shape: 'box', mass: 1 } as RigidBody3D);
    const phys = new PhysicsSystem();
    const wallT = (): Transform3D => w.getComponent<Transform3D>('wall', 'Transform3D')!;
    const blkT = (): Transform3D => w.getComponent<Transform3D>('blk', 'Transform3D')!;
    for (let i = 1; i <= 180; i++) phys.sync(w, i * 16.7); // 落定
    const wallY = wallT().y, blkYSettled = blkT().y;
    expect(wallY).toBeCloseTo(3, 1); // 静态墙固定在 y=3
    phys.roll(w); // 重落
    for (let i = 181; i <= 200; i++) phys.sync(w, i * 16.7);
    expect(wallT().y).toBeCloseTo(3, 1); // 墙仍在 y=3（未被甩飞）
    expect(blkT().y).toBeGreaterThan(blkYSettled + 2); // 动态块被抬起重落（升到高处）
    phys.dispose();
  });

  it('RigidBody3D + Transform3D（含 quat）是 render-only（不进 hash）', () => {
    const w = new World();
    w.createEntity('d');
    const h0 = hashSnapshot(w.snapshot());
    w.addComponent('d', { type: 'RigidBody3D', shape: 'box', mass: 1, avx: 5 } as RigidBody3D);
    expect(hashSnapshot(w.snapshot())).toBe(h0); // RigidBody3D 不进 hash
    w.addComponent('d', { type: 'Transform3D', x: 0, y: 5, z: 0, quat: [0, 0, 0, 1] } as Transform3D);
    expect(hashSnapshot(w.snapshot())).toBe(h0); // Transform3D 整体 render-only
  });
});

describe('PhysicsWorld3D：物理世界按场景可配（REQ-3D-TOWER-STACK·堆叠）', () => {
  beforeAll(async () => { await preloadPhysics(); });

  // 自由落体 T 秒后的 y ≈ y0 - 0.5·g·T²。用它区分缺省 -42（落得快）vs 配置 -9.82（落得慢）。
  const dropY = (cfg: Record<string, number> | null): number => {
    const w = new World();
    if (cfg) { w.createEntity('pw'); w.addComponent('pw', { type: 'PhysicsWorld3D', ...cfg } as never); }
    w.createEntity('d');
    w.addComponent('d', { type: 'Transform3D', x: 0, y: 40, z: 0 } as Transform3D); // 高空落·不撞地
    w.addComponent('d', { type: 'Mesh3D', shape: 'box', width: 2, height: 2, depth: 2, frontTint: 0xffffff } as Mesh3D);
    w.addComponent('d', { type: 'RigidBody3D', shape: 'box', mass: 1 } as RigidBody3D);
    const phys = new PhysicsSystem();
    for (let i = 1; i <= 30; i++) phys.sync(w, i * 16.7); // ~0.5s
    const y = w.getComponent<Transform3D>('d', 'Transform3D')!.y;
    phys.dispose();
    return y;
  };

  it('缺省（不挂 PhysicsWorld3D）= 现行 -42 重力（落得快·行为逐位不变·护掷骰）', () => {
    const y = dropY(null); // g=-42·0.5s 落 ~5.25 → y≈34.7
    expect(y).toBeLessThan(37); // 明显 < -9.82 情形（该情形 y>38）
  });
  it('配置 gravity:-9.82 → 落得慢（数据路生效）', () => {
    const y = dropY({ gravity: -9.82 }); // 0.5s 落 ~1.23 → y≈38.8
    expect(y).toBeGreaterThan(38);
    expect(dropY({ gravity: -9.82 })).toBeGreaterThan(dropY(null) + 2); // 同口径下配置明显比缺省落得慢
  });

  it('叠叠乐塔：填 {gravity:-9.82,restitution:0,solverIterations:40} → 静置数秒不塌（塔顶不下沉）', () => {
    const w = new World();
    w.createEntity('pw');
    w.addComponent('pw', { type: 'PhysicsWorld3D', gravity: -9.82, restitution: 0, solverIterations: 40 } as never);
    const N = 12, H = 1; // 12 层薄宽积木
    for (let k = 0; k < N; k++) {
      const id = `blk-${k}`;
      w.createEntity(id);
      w.addComponent(id, { type: 'Transform3D', x: 0, y: H / 2 + k * H, z: 0 } as Transform3D); // 层层叠放·底层贴地
      w.addComponent(id, { type: 'Mesh3D', shape: 'box', width: 6, height: H, depth: 3, frontTint: 0xffffff } as Mesh3D);
      w.addComponent(id, { type: 'RigidBody3D', shape: 'box', mass: 1 } as RigidBody3D);
    }
    const topId = `blk-${N - 1}`;
    const y0 = w.getComponent<Transform3D>(topId, 'Transform3D')!.y;
    const phys = new PhysicsSystem();
    for (let i = 1; i <= 300; i++) phys.sync(w, i * 16.7); // ~5s
    const yTop = w.getComponent<Transform3D>(topId, 'Transform3D')!.y;
    expect(y0 - yTop).toBeLessThan(0.4); // 塔顶下沉 < 0.4（站住·未塌）
    phys.dispose();
  });
});

import { NON_DETERMINISTIC } from '@net/determinism.js';

describe('RigidBody3D 物理事件出口（REQ-3D-SETTLE-SIGNAL·落定/失稳→信号）', () => {
  beforeAll(async () => { await preloadPhysics(); });

  function drop(rb: Partial<RigidBody3D>): { w: World; phys: PhysicsSystem } {
    const w = new World();
    w.createEntity('o');
    w.addComponent('o', { type: 'Transform3D', x: 0, y: 3, z: 0 } as Transform3D);
    w.addComponent('o', { type: 'Mesh3D', shape: 'box', width: 2, height: 2, depth: 2, frontTint: 0xffffff } as Mesh3D);
    w.addComponent('o', { type: 'RigidBody3D', shape: 'box', mass: 1, ...rb } as RigidBody3D);
    return { w, phys: new PhysicsSystem() };
  }

  it('settleSignal：落定入睡发一次·不重复·睡醒再落定重发', () => {
    const { w, phys } = drop({ settleSignal: 'landed' });
    const got: { signal: string; arg: string }[] = [];
    for (let i = 1; i <= 400; i++) { phys.sync(w, i * 16.7); got.push(...phys.drainSignals()); } // 落定入睡
    const landed = got.filter((s) => s.signal === 'landed');
    expect(landed.length).toBe(1);          // 发一次
    expect(landed[0]!.arg).toBe('o');        // arg=实体 id（同 Pickable3D 通路）
    for (let i = 401; i <= 460; i++) phys.sync(w, i * 16.7);
    expect(phys.drainSignals().length).toBe(0); // 睡着不重复发
    // 睡醒（重掷）→ 再落定 → 重发一次
    phys.roll(w);
    const got2: { signal: string; arg: string }[] = [];
    for (let i = 461; i <= 900; i++) { phys.sync(w, i * 16.7); got2.push(...phys.drainSignals()); }
    expect(got2.filter((s) => s.signal === 'landed').length).toBe(1);
    phys.dispose();
  });

  it('fix③（RENDERHYG）：入睡刚体不计入 live 数（脏标可歇·不白烧 GPU）', () => {
    const { w, phys } = drop({ settleSignal: 'x' });
    let live = 1;
    for (let i = 1; i <= 400; i++) live = phys.sync(w, i * 16.7); // 跑到入睡
    expect(live).toBe(0); // 入睡 → live=0（原来恒 bodies.size=1·永久占脏标）
    phys.dispose();
  });

  it('toppleSignal：倾角超阈值发信号·平落不误发', () => {
    // 平落（无翻滚）→ 竖直·永不 topple
    const flat = drop({ toppleSignal: 'fell' });
    const flatSig: { signal: string }[] = [];
    for (let i = 1; i <= 300; i++) { flat.phys.sync(flat.w, i * 16.7); flatSig.push(...flat.phys.drainSignals()); }
    expect(flatSig.filter((s) => s.signal === 'fell').length).toBe(0); // 平落不误发
    flat.phys.dispose();
    // 大角速度翻滚 → 倾角必超阈值 → 至少发一次
    const tumble = drop({ toppleSignal: 'fell', avx: 10 });
    const tSig: { signal: string }[] = [];
    for (let i = 1; i <= 200; i++) { tumble.phys.sync(tumble.w, i * 16.7); tSig.push(...tumble.phys.drainSignals()); }
    expect(tSig.filter((s) => s.signal === 'fell').length).toBeGreaterThanOrEqual(1); // 翻倒发信号
    tumble.phys.dispose();
  });

  it('红线：settleSignal 不进 hash（RigidBody3D 仍在 NON_DETERMINISTIC·无新组件）', () => {
    const w = new World();
    w.createEntity('e');
    const h0 = hashSnapshot(w.snapshot());
    w.addComponent('e', { type: 'RigidBody3D', shape: 'box', settleSignal: 'x', toppleSignal: 'y' } as RigidBody3D);
    expect(hashSnapshot(w.snapshot())).toBe(h0);              // 加物理事件字段不改 hash
    expect(NON_DETERMINISTIC.has('RigidBody3D')).toBe(true);  // 走既有 render-only 通路·无新组件
  });
});

describe('RigidBody3D 逐体弹性/摩擦（REQ-3D-RB-MATERIAL·owner 2026-10-22 判 A）', () => {
  beforeAll(async () => { await preloadPhysics(); });
  type Rb = Partial<RigidBody3D>;
  const scene = (bodies: Record<string, { t: Partial<Transform3D>; m: Partial<Mesh3D>; rb: Rb }>) => {
    const w = new World();
    for (const [id, b] of Object.entries(bodies)) {
      w.createEntity(id);
      w.addComponent(id, { type: 'Transform3D', x: 0, y: 0, z: 0, ...b.t } as Transform3D);
      w.addComponent(id, { type: 'Mesh3D', frontTint: 0xffffff, ...b.m } as Mesh3D);
      w.addComponent(id, { type: 'RigidBody3D', ...b.rb } as RigidBody3D);
    }
    return w;
  };
  const tf = (w: World, id: string): Transform3D => w.getComponent<Transform3D>(id, 'Transform3D')!;

  it('未声明 restitution/friction 的场景：逐帧坐标与改动前逐位一致（金标准轨迹）', () => {
    const golden: Record<string, number[]> = {"a@45":[4.482707131111763,7.954609423162486,0,0,0,0.6794767417318223,0.7336970474559008],"b@45":[3,17.95460942316249,-1.241353565555882,0,0,0,1],"c@45":[-1.9099818290235666,1.430368047398137,-0.6235986194712014,0.9997472588803458,-0.0023043506146284017,0.01985800812080976,0.010284349418097423],"a@90":[15.850157604622716,2.853150666052159,-0.3928559037130805,-0.03690197221731597,0.08509276761725146,-0.852801499628731,0.5139329407390586],"b@90":[3,5.974739030718781,-3.074978002171103,-0.1942008379855475,0,0,0.9809617905533891],"c@90":[-1.1565134804751185,2.091853395725369,-3.9148165273632287,0.6400863635249372,-0.12320865517158708,-0.03107924012703152,0.7577223471386844],"a@135":[21.128581584608803,3.1870567157013734,0.5432872150383679,0.1432369335673883,0.17138699401048577,-0.9292227452335672,-0.29437182080976115],"b@135":[3,1.8736149106300588,-4.404452302190927,-0.5928557175114277,0,0,0.8053086974657669],"c@135":[-0.4499989623328104,2.0615585980201727,-5.36914456058747,0.3337928909178993,-0.25089550981906733,-0.08773674221368954,0.9043981497056649],"a@180":[23.59319620679961,2.287587326052527,0.653144872528842,0.11728241876713141,0.10769881615032258,-0.7329981979876463,-0.6613315666099823],"b@180":[3,1.4965331616764166,-5.719211008784343,-0.8785539064298965,0,0,0.4776432073177307],"c@180":[-0.35054617284144435,0.9999556050135329,-6.6484475692884075,-0.0000012585294075302542,-0.2843290387180515,7.878256368215412e-7,0.9587267586437046]};
    const w = scene({
      a: { t: { x: 0, y: 20, z: 0 }, m: { shape: 'box', width: 4, height: 4, depth: 4 }, rb: { shape: 'box', mass: 1, vx: 6, avz: 2 } },
      b: { t: { x: 3, y: 30, z: 1 }, m: { shape: 'sphere', width: 3, height: 3 }, rb: { shape: 'sphere', mass: 2, vz: -3 } },
      c: { t: { x: -2, y: 12, z: 0 }, m: { shape: 'cylinder', width: 4, height: 2 }, rb: { shape: 'cylinder', mass: 1, avx: 5 } },
    });
    const phys = new PhysicsSystem();
    for (let i = 1; i <= 180; i++) {
      phys.sync(w, i * 16.7);
      if (i % 45 === 0) for (const id of ['a', 'b', 'c']) { const t = tf(w, id); expect([t.x, t.y, t.z, ...(t.quat ?? [])]).toEqual(golden[`${id}@${i}`]); }
    }
    phys.dispose();
  });

  const peakAfterFirstBounce = (restitution: number | undefined): number => {
    const w = scene({ ball: { t: { y: 20 }, m: { shape: 'sphere', width: 2, height: 2 }, rb: { shape: 'sphere', mass: 1, ...(restitution === undefined ? {} : { restitution }) } } });
    const phys = new PhysicsSystem();
    let falling = true, peak = 0, prev = 20;
    for (let i = 1; i <= 240; i++) {
      phys.sync(w, i * 16.7);
      const y = tf(w, 'ball').y;
      if (falling && y > prev) falling = false; // 第一次触地后开始上升
      if (!falling) peak = Math.max(peak, y);
      prev = y;
    }
    phys.dispose();
    return peak;
  };

  it('restitution 真接线：0.95 弹得比 0 高，且与不填（世界值 0.4）不同', () => {
    const bouncy = peakAfterFirstBounce(0.95), dead = peakAfterFirstBounce(0), dflt = peakAfterFirstBounce(undefined);
    expect(bouncy).toBeGreaterThan(dflt + 1);
    expect(dead).toBeLessThan(dflt);
  });

  const slide = (friction: number | undefined): number => {
    const w = scene({ crate: { t: { y: 2 }, m: { shape: 'box', width: 4, height: 4, depth: 4 }, rb: { shape: 'box', mass: 1, vx: 12, restitution: 0, ...(friction === undefined ? {} : { friction }) } } });
    const phys = new PhysicsSystem();
    for (let i = 1; i <= 120; i++) phys.sync(w, i * 16.7);
    const x = tf(w, 'crate').x;
    phys.dispose();
    return x;
  };

  it('friction 真接线：摩擦 0 滑得比摩擦 2 远（只填一项时另一项取世界值）', () => {
    expect(slide(0)).toBeGreaterThan(slide(2) + 3);
  });

  it('非法值（负/NaN/弹性>1）拒收：告警并回落世界接触值，轨迹与未声明一致', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const run = (rb: Rb): number => {
        const w = scene({ ball: { t: { y: 20 }, m: { shape: 'sphere', width: 2, height: 2 }, rb: { shape: 'sphere', mass: 1, ...rb } } });
        const phys = new PhysicsSystem();
        for (let i = 1; i <= 150; i++) phys.sync(w, i * 16.7);
        const y = tf(w, 'ball').y; phys.dispose(); return y;
      };
      const base = run({});
      for (const bad of [{ restitution: -0.1 }, { restitution: 1.5 }, { friction: -1 }, { friction: Number.NaN }]) expect(run(bad)).toBe(base);
      expect(warn.mock.calls.filter(c => String(c[0]).includes('[physics] reject')).length).toBe(4);
    } finally { warn.mockRestore(); }
  });

  it('同值刚体共用一个材质；每对材质只注册一次接触材质', () => {
    const w = scene(Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`d${i}`, { t: { x: i * 5, y: 10 }, m: { shape: 'box', width: 2, height: 2, depth: 2 }, rb: { shape: 'box', mass: 1, restitution: i % 2 ? 0.8 : 0.1, friction: 0.5 } }])));
    const phys = new PhysicsSystem();
    phys.sync(w, 16.7);
    const cw = (phys as unknown as { world: { contactmaterials: unknown[] } }).world;
    // 两种声明值 → 2 个材质；配对：A×world, A×A, B×world, B×A, B×B = 5
    expect(cw.contactmaterials.length).toBe(5);
    phys.dispose();
  });
});

describe('RigidBody3D 逐体材质·两个声明体相碰的组合规则', () => {
  beforeAll(async () => { await preloadPhysics(); });
  it('声明体×声明体：摩擦 √(fa·fb)、弹性 max；声明体×世界：直接用声明值', () => {
    const w = new World();
    for (const [id, rb] of [['p', { restitution: 0.2, friction: 0.9 }], ['q', { restitution: 0.7, friction: 0.1 }]] as const) {
      w.createEntity(id);
      w.addComponent(id, { type: 'Transform3D', x: id === 'p' ? 0 : 10, y: 5, z: 0 } as Transform3D);
      w.addComponent(id, { type: 'Mesh3D', shape: 'box', width: 2, height: 2, depth: 2, frontTint: 0xffffff } as Mesh3D);
      w.addComponent(id, { type: 'RigidBody3D', shape: 'box', mass: 1, ...rb } as RigidBody3D);
    }
    const phys = new PhysicsSystem();
    phys.sync(w, 16.7);
    const cms = (phys as unknown as { world: { contactmaterials: { materials: { name: string }[]; friction: number; restitution: number }[] } }).world.contactmaterials;
    const find = (a: string, b: string) => cms.find(c => { const n = c.materials.map(m => m.name).sort().join('+'); return n === [a, b].sort().join('+'); })!;
    const P = 'rb:0.2|0.9', Q = 'rb:0.7|0.1';
    expect(find(P, Q).friction).toBeCloseTo(Math.sqrt(0.9 * 0.1), 12);
    expect(find(P, Q).restitution).toBe(0.7);
    expect(find(P, 'world')).toMatchObject({ friction: 0.9, restitution: 0.2 });
    expect(find(Q, 'world')).toMatchObject({ friction: 0.1, restitution: 0.7 });
    phys.dispose();
  });
});
