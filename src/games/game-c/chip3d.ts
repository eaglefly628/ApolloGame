import type { Engine } from '../../runtime/engine.js';
import type { Component } from '@engine/core/types.js';
import { mulberry32 } from '@atom-skills/random/index.js';
import { seatWorldPos } from './build3d.js';

// ═══════════════════════════════════════════════════════════════
//  game-c ·《六人德州》3D 物理筹码抛掷（owner 2026-07-17「筹码 3D 真实物理扔上去」·capability-plan §4-e）
//
//  照 game-d/throw3d.ts 先例：下注时从该座位前方生成筹码 RigidBody3D(cylinder·cannon-es 物理)+初速抛向底池
//  → 物理落桌翻滚堆叠（渲染器 PhysicsSystem·P3D 渲染线消费·我只建实体数据）。
//  ⚠ 红线：**render-only·不进 sim/hash**——筹码数量永远是 session 内 sim 资源，物理落点纯表现、不回写游戏状态
//  （跳过物理结果逐字节同·回放/lockstep 零影响）。翻滚随机走专属种子 PRNG（表现层·不碰游戏主 seed）。
// ═══════════════════════════════════════════════════════════════

const CHIP_COLORS = [0xe0b458, 0xc0392b, 0x1b1b22, 0x2e7d5b, 0xf0c96a]; // 金/红/黑/绿/亮金（面额分色·表现）
const POT = { x: 0, y: 0.62, z: -0.5 }; // 底池位（build3d 桌心偏北筹码堆处）
const CHIP_R = 0.3, CHIP_H = 0.05; // 筹码圆柱直径/高

export class Chip3D {
  private nonce = 0;
  private ids: string[] = [];
  private readonly rng: () => number;
  constructor(private readonly engine: Engine, seed = 20260717) { this.rng = mulberry32(seed); }

  /** 座位下注 → 从座位前上方抛 count 枚筹码物理落向底池（同 throw3d：初速朝底池 + 上抛 + 翻滚）。 */
  throwBet(seat: number, count: number): void {
    const { x: sx, z: sz } = seatWorldPos(seat);
    const startX = sx * 0.62, startZ = sz * 0.62; // 座位前（靠桌心·下注区）
    const n = Math.max(1, Math.min(6, count)); // 表现上限 6 枚/次
    const dx = POT.x - startX, dz = POT.z - startZ;
    const w = this.engine.world;
    for (let i = 0; i < n; i++) {
      const id = `c-chip-${this.nonce++}`;
      this.ids.push(id);
      w.createEntity(id);
      w.addComponent(id, { type: 'Transform3D', x: startX + (this.rng() - 0.5) * 0.12, y: 1.15 + i * 0.06, z: startZ + (this.rng() - 0.5) * 0.12 } as unknown as Component);
      w.addComponent(id, { type: 'Mesh3D', shape: 'cylinder', width: CHIP_R, height: CHIP_H, frontTint: CHIP_COLORS[(this.nonce + i) % CHIP_COLORS.length] } as unknown as Component);
      const sp = 0.85 + this.rng() * 0.4;
      w.addComponent(id, {
        type: 'RigidBody3D', shape: 'cylinder', mass: 1, restitution: 0.32, friction: 0.62,
        vx: dx * sp + (this.rng() - 0.5) * 0.5, vy: 1.3 + this.rng() * 0.7, vz: dz * sp + (this.rng() - 0.5) * 0.5,
        avx: (this.rng() - 0.5) * 11, avy: (this.rng() - 0.5) * 11, avz: (this.rng() - 0.5) * 11,
      } as unknown as Component);
    }
  }

  /** 收池 / 新一手清场（render-only·移除所有抛出的物理筹码）。 */
  clear(): void {
    for (const id of this.ids) this.engine.world.destroyEntity(id);
    this.ids = [];
  }
}
