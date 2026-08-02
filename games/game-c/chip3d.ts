import type { Engine } from '@runtime/engine.js';
import type { Component } from '@engine/core/types.js';
import { mulberry32 } from '@atom-skills/random/index.js';
import { seatWorldPos, seatStackPos, POT3D } from './build3d.js';

// ═══════════════════════════════════════════════════════════════
//  game-c ·《六人德州》3D 物理筹码（owner 2026-07-18「下注就往池里扔真 3D 物理筹码·速度力量随机·别滚出台子」）
//
//  ① 抛注 throwBet：座位下注→从座位前生成圆柱筹码 RigidBody3D，朝底池以**随机速度+力量+翻滚**抛出（cannon-es 物理
//     落桌翻滚堆叠）；桌缘一圈静态围栏墙（build3d rail-*）挡住不滚出台。② 座位筹码堆 setStack(seat)：该座位桌缘内侧
//     一摞静态筹码·**赢得越多摞越高**（owner 2026-07-18「主角堆靠自己桌边·每位姨太也各有堆靠桌边」·六席各一堆）。
//  render-only·不进 sim/hash（翻滚随机走专属种子 PRNG·不碰游戏主 seed）。
// ═══════════════════════════════════════════════════════════════

const CHIP_COLORS = [0xe0b458, 0xc0392b, 0x1b1b22, 0x2e7d5b, 0xf0c96a]; // 金/红/黑/绿/亮金（面额分色·表现）
// REQ-C-113 接槽：筹码面贴图（与 5 色位一一对应·索引里 vendored 真图 filled·即上顶盖；art-replace 换图即换）。
//   Material3D.map 落圆柱**顶盖**（中心内切圆·顶俯视相机正对）；无真图/未解析=回退 frontTint 色（同现观感）。
const CHIP_ART = ['chip/1000-yellow', 'chip/5-red', 'chip/100-black', 'chip/25-green', 'chip/50-orange'];
const CHIP_R = 0.34, CHIP_H = 0.06; // 筹码圆柱直径/高（醒目·堆得起来）
const STACK_MAX = 22;                // 每堆最高摞数（越赢越高·封顶防穿天）
const PER_CHIP = 90;                 // 每 90 筹码 = 堆里一枚（决定摞高）

export class Chip3D {
  private nonce = 0;
  private thrown: string[] = [];              // 抛出的物理筹码 id（新手清场）
  private stacks = new Map<number, string[]>(); // 各座位筹码堆 id（越赢越高·随栈更新重建）
  private players = 6;                          // 入局人数（owner 2026-07-20·决定座位环均布 + 堆布局）
  private readonly rng: () => number;
  constructor(private readonly engine: Engine, seed = 20260717) { this.rng = mulberry32(seed); }

  /** 设入局人数（换局时·N<旧则剪掉多余座位的残留堆·防跨局残留）。 */
  setPlayers(n: number): void {
    this.players = Math.max(2, Math.min(6, n));
    for (const [seat, ids] of this.stacks) {
      if (seat >= this.players) { for (const id of ids) this.engine.world.destroyEntity(id); this.stacks.delete(seat); }
    }
  }

  /** 座位下注 → 从座位前朝底池抛 count 枚筹码（**随机速度+力量+翻滚**·物理落桌·围栏挡住不出台）。 */
  throwBet(seat: number, count: number): void {
    const { x: sx, z: sz } = seatWorldPos(seat, this.players);
    const startX = sx * 0.72, startZ = sz * 0.72; // 座位前（靠桌心·下注区）
    const n = Math.max(1, Math.min(6, count));    // 表现上限 6 枚/次
    const dx = POT3D.x - startX, dz = POT3D.z - startZ;
    const w = this.engine.world;
    for (let i = 0; i < n; i++) {
      const id = `c-chip-${this.nonce++}`;
      this.thrown.push(id);
      const ci = (this.nonce + i) % CHIP_COLORS.length;
      w.createEntity(id);
      w.addComponent(id, { type: 'Transform3D', x: startX + (this.rng() - 0.5) * 0.18, y: 1.35 + i * 0.07, z: startZ + (this.rng() - 0.5) * 0.18 } as unknown as Component);
      w.addComponent(id, { type: 'Mesh3D', shape: 'cylinder', width: CHIP_R, height: CHIP_H, frontTint: CHIP_COLORS[ci] } as unknown as Component);
      w.addComponent(id, { type: 'Material3D', preset: 'matte', color: CHIP_COLORS[ci], map: CHIP_ART[ci] } as unknown as Component); // 顶盖筹码面贴图·无真图回退色
      // 随机速度+力量：朝底池的水平初速按 [0.8,1.35] 随机倍率 + 小横向抖动（多数落池心堆起）+ 上抛弧度随机。
      const power = 0.8 + this.rng() * 0.55;
      // 只绕竖直 Y 轴自旋（avy·飞碟式平旋）·**不给 avx/avz 翻转** → 筹码全程保持平面朝上、平飞平落，不再翻着落地立在桌沿上
      //   （owner 2026-07-23 bug「筹码有时立在桌面上」根因=三轴翻滚落地停在圆柱侧面）。低弹性 restitution 0.12 减少落地弹跳再翻立。
      //   彻底根治（含落地被别的筹码撞立）需引擎侧角约束锁——已提 requests-3d.md REQ-3D-RB-ANGFACTOR（RigidBody3D.angularFactor·下沉后此处填 [0,1,0]）。
      w.addComponent(id, {
        type: 'RigidBody3D', shape: 'cylinder', mass: 1, restitution: 0.12, friction: 0.72,
        vx: dx * power + (this.rng() - 0.5) * 0.45, vy: 1.1 + this.rng() * 0.7, vz: dz * power + (this.rng() - 0.5) * 0.45,
        avx: 0, avy: (this.rng() - 0.5) * 10, avz: 0,
      } as unknown as Component);
    }
  }

  /** 座位筹码堆（该座位桌缘·贴边·**赢得越多摞越高**·六席各一堆）：按当前筹码量重建一摞筹码。
   *  **只挂 Transform3D+Mesh3D·绝不挂 RigidBody3D** → 纯渲染网格·cannon-es 不建体·抛入的物理筹码撞不翻（owner「不要被别人撞翻」）。 */
  setStack(seat: number, chips: number): void {
    const target = Math.max(0, Math.min(STACK_MAX, Math.round(chips / PER_CHIP)));
    const cur = this.stacks.get(seat) ?? [];
    if (target === cur.length) return; // 无变化不重建
    const w = this.engine.world;
    for (const id of cur) w.destroyEntity(id);
    const ids: string[] = [];
    const base = seatStackPos(seat, this.players);
    for (let i = 0; i < target; i++) {
      const id = `c-stk-${seat}-${i}`;
      ids.push(id);
      const ci = i % CHIP_COLORS.length;
      w.createEntity(id);
      w.addComponent(id, { type: 'Transform3D', x: base.x + (i % 2) * 0.02, y: base.y + 0.03 + i * CHIP_H, z: base.z } as unknown as Component);
      w.addComponent(id, { type: 'Mesh3D', shape: 'cylinder', width: CHIP_R, height: CHIP_H, frontTint: CHIP_COLORS[ci] } as unknown as Component);
      // 只给**顶枚**贴筹码面（顶盖朝上·俯视可见）→ 限 PBR 网格数（每堆 1 枚·非整摞）；下面各枚保 Mesh3D 纯色鳞边。
      if (i === target - 1) w.addComponent(id, { type: 'Material3D', preset: 'matte', color: CHIP_COLORS[ci], map: CHIP_ART[ci] } as unknown as Component);
    }
    this.stacks.set(seat, ids);
  }

  /** 新一手清场（移除所有抛出的物理筹码·各座位堆不动）。 */
  clear(): void {
    for (const id of this.thrown) this.engine.world.destroyEntity(id);
    this.thrown = [];
  }

  /** 全拆（teardown）。 */
  dispose(): void {
    this.clear();
    for (const ids of this.stacks.values()) for (const id of ids) this.engine.world.destroyEntity(id);
    this.stacks.clear();
  }
}
