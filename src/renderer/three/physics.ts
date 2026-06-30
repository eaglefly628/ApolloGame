import * as CANNON from 'cannon-es';
import type { IWorld } from '@engine/core/types.js';
import type { RigidBody3D, Mesh3D, Transform3D } from '@engine/protocol/components.js';

// ═══════════════════════════════════════════════════════════════
//  three/PhysicsSystem —— 真物理刚体（cannon-es 驱动·TA·**纯表现**）。
//  owner 2026-06-30「为表现非同步」：滚色子/掉落/翻滚 —— **不进 sim/hash·不为联机一致**（RigidBody3D 已入 NON_DETERMINISTIC）。
//  render-only 自由区：可用随机/壁钟。每帧步进 cannon 世界 → 把每个刚体的位置+四元数写回同实体 Transform3D（render-only）
//  → 渲染器照常据 Transform3D 画（含 quat·无万向锁）。体形/尺寸取同实体 Mesh3D（box→半尺寸·sphere→半径）。
//  cannon-es 仅在此（renderer/three 下）import → 进 3D code-split chunk，2D 游戏不连带打包。
// ═══════════════════════════════════════════════════════════════

const STEP = 1 / 60; // 固定物理步长

export class PhysicsSystem {
  private world: CANNON.World | null = null;
  private readonly bodies = new Map<string, CANNON.Body>();
  private last = 0;

  // 每帧步进 + 写回 Transform3D。返回活跃刚体数（>0 → 渲染器把帧号折进 renderSig 持续重渲）。nowMs=performance.now()。
  sync(world: IWorld, nowMs: number): number {
    const ents = world.query('RigidBody3D');
    if (ents.length === 0) { if (this.world) this.disposeWorld(); return 0; }
    if (!this.world) this.initWorld();
    const cw = this.world!;
    const seen = new Set<string>();
    for (const [id] of ents) {
      seen.add(id);
      if (!this.bodies.has(id)) this.spawn(world, id);
    }
    for (const [id, b] of this.bodies) if (!seen.has(id)) { cw.removeBody(b); this.bodies.delete(id); }
    const dt = this.last ? Math.min(0.05, (nowMs - this.last) / 1000) : STEP;
    this.last = nowMs;
    cw.step(STEP, dt, 4);
    for (const [id, b] of this.bodies) {
      const t = world.getComponent<Transform3D>(id, 'Transform3D');
      if (!t) continue;
      t.x = b.position.x; t.y = b.position.y; t.z = b.position.z;
      t.quat = [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w];
    }
    return this.bodies.size;
  }

  // 重掷（掷骰子按钮）：所有刚体抬回各自起点上方 + 随机翻滚（render-only·随机自由）。bodies 为空（未步进过）则 no-op。
  roll(world: IWorld): void {
    for (const [id, b] of this.bodies) {
      const t = world.getComponent<Transform3D>(id, 'Transform3D');
      b.position.set(t?.x ?? 0, 15 + Math.random() * 6, t?.z ?? 0);
      b.quaternion.setFromEuler(Math.random() * 6.283, Math.random() * 6.283, Math.random() * 6.283);
      b.velocity.set((Math.random() - 0.5) * 7, 1, (Math.random() - 0.5) * 7);
      b.angularVelocity.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
      b.wakeUp();
    }
  }

  private initWorld(): void {
    const cw = new CANNON.World({ gravity: new CANNON.Vec3(0, -42, 0) }); // 世界单位较大 → 重力调大·色子下落干脆
    cw.defaultContactMaterial.restitution = 0.4; // 弹一点
    cw.defaultContactMaterial.friction = 0.35;
    const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() }); // 地面：静态·法线朝上·y=0
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    cw.addBody(ground);
    this.world = cw;
    this.last = 0;
  }

  private spawn(world: IWorld, id: string): void {
    const rb = world.getComponent<RigidBody3D>(id, 'RigidBody3D')!;
    const m = world.getComponent<Mesh3D>(id, 'Mesh3D');
    const t = world.getComponent<Transform3D>(id, 'Transform3D');
    const shape = rb.shape ?? (m?.shape === 'sphere' ? 'sphere' : 'box');
    const w = m?.width ?? 4, h = m?.height ?? 4;
    const cshape: CANNON.Shape = shape === 'sphere'
      ? new CANNON.Sphere(Math.max(0.1, w / 2))
      : new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, (m?.depth ?? w) / 2)); // 体素与渲染盒一致（PBR 路径 depth=m.depth??width）
    const body = new CANNON.Body({ mass: rb.mass ?? 1, shape: cshape });
    body.position.set(t?.x ?? 0, t?.y ?? 10, t?.z ?? 0);
    if (rb.vx || rb.vy || rb.vz) body.velocity.set(rb.vx ?? 0, rb.vy ?? 0, rb.vz ?? 0);
    if (rb.avx || rb.avy || rb.avz) body.angularVelocity.set(rb.avx ?? 0, rb.avy ?? 0, rb.avz ?? 0);
    body.allowSleep = true; body.sleepSpeedLimit = 0.6; body.sleepTimeLimit = 0.4; // 静下来就睡（省算力·色子停稳）
    this.world!.addBody(body);
    this.bodies.set(id, body);
  }

  private disposeWorld(): void {
    if (!this.world) return;
    for (const [, b] of this.bodies) this.world.removeBody(b);
    this.bodies.clear();
    this.world = null;
    this.last = 0;
  }

  dispose(): void { this.disposeWorld(); }
}
