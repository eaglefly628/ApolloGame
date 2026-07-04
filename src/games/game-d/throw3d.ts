// Game D · 战场 3D 物理掷骰（owner 2026-07-03「掷骰时物理落地·5 骰入场·给我确定的点数」）。
// 编排现成引擎能力（**不自造 system**·同 autoRun/syncDice3D 胶水先例）：
//   ① 每颗 loadout 骰 → 一颗 `RigidBody3D` 物理骰（面=该骰元素色 + pip·`Mesh3D.dieFaces`）·带初始翻滚角速度；
//   ② cannon-es 物理把它抛落翻滚（渲染器 PhysicsSystem·render-only）；
//   ③ 落定（quat 静止）后 `upFaceIndex(quat)` 读朝上面 → **确定点数**；
//   ④ 头顶挂 `WorldUI3D` 大号点数（owner「最后落地的点数看不清」→ 醒目可读）。
// 翻滚随机 = **专属种子 PRNG**（引擎 nextRandom·从壁钟播种·render-only 表现层·不碰 Math.random、不污染游戏主 seed）。
// ⚠ 结果由物理定 = 非确定性（cannon-es「为表现非同步」）→ 暂放弃 game-d 的 seed/lockstep 可回放（owner「先做效果」·原型阶段）。
import type { Engine } from '../../runtime/engine.js';
import type { Component } from '@engine/core/types.js';
import { upFaceIndex } from '@renderer/three/dice.js';
import { ELEM_INFO, type Die, type RolledDie, type Elem } from './dice.js';

const hex = (el: Elem): number => parseInt(ELEM_INFO[el].hex.slice(1), 16);
// 6 面点数排布（对面和为 7·同 Title 骰）·面序 [+X,-X,+Y,-Y,+Z,-Z]（= dieFaces 与 upFaceIndex 面序）。
const PIPS = [1, 6, 2, 5, 3, 4] as const;
const DIE = 0.82; // 骰边长（世界单位·owner「色子太大·场景不够大」→ 缩小·5 颗在地台里更宽松）

export class Throw3D {
  private ids: string[] = [];        // 骰实体（读朝上面 / 挂点数）
  private wallIds: string[] = [];    // 隐形围栏（静态物理墙·收住骰子·不渲染）
  private dice: Die[] = [];
  private startMs = 0;
  private lastMoveMs = 0;      // 最近一次「有骰在动」的壁钟
  private prevQuat: (readonly number[])[] = [];
  private done: ((r: RolledDie[]) => void) | null = null;
  private active = false;

  constructor(private readonly engine: Engine) {}

  get rolling(): boolean { return this.active; }

  /** 掷：为每颗 loadout 骰生成带初始翻滚的物理骰。roomZ=当前房中心 Z。
   *  rand=**游戏确定性种子**（引擎 rnd/RandomSeed·owner 2026-07-03「用确定的种子数据喂物理→物理由确定输入决定→天然支持
   *  lockstep/回放」）：初始翻滚参数全从 rand 取 → 同种子 → 同落定面 → 可回放/双端一致（cannon 同 build 一致）。done 落定读数后回调。 */
  throw(dice: Die[], roomZ: number, nowMs: number, rand: () => number, done: (r: RolledDie[]) => void): void {
    this.clear();
    this.dice = dice; this.done = done; this.active = true;
    this.startMs = nowMs; this.lastMoveMs = nowMs; this.prevQuat = [];
    // 隐形围栏（4 面静态物理墙·收住骰子不飞出地台）：RigidBody3D 无 Mesh3D → 物理有效但**不渲染**·默认 4³ 静态盒。
    // 中心离场心 4.4 → 内壁 ~±2.4 的托盘；骰从 y3 落入（墙高 y±2·骰从上方落进围栏）。
    const WALL = 4.4;
    ([[WALL, 0], [-WALL, 0], [0, WALL], [0, -WALL]] as const).forEach(([dx, dz], k) => {
      const wid = `gd-pdie-wall-${k}`;
      this.wallIds.push(wid);
      this.engine.world.createEntity(wid);
      this.engine.world.addComponent(wid, { type: 'Transform3D', x: dx, y: 0, z: roomZ + dz } as unknown as Component);
      this.engine.world.addComponent(wid, { type: 'RigidBody3D', shape: 'box', mass: 0 } as unknown as Component); // 静态·无 Mesh3D→隐形
    });
    const n = dice.length;
    dice.forEach((d, i) => {
      const id = `gd-pdie-${i}`;
      this.ids.push(id);
      const el = d.faces[0]!.el; // 元素骰六面同元素 → 取骰元素色
      const faces = PIPS.map((pip) => ({ color: hex(el), pip, emissive: hex(el) }));
      const x = (i - (n - 1) / 2) * 1.05; // 横向铺开·居中（收在托盘内）
      this.engine.world.createEntity(id);
      this.engine.world.addComponent(id, { type: 'Transform3D', x, y: 3 + i * 0.3, z: roomZ + (rand() - 0.5) * 0.6, scale: 1 } as unknown as Component);
      // dieGlass=玻璃骰（同 Title 骰·owner「四角别黑·要通透半透明·度别太高」）：六面元素色 pip 贴花浮于半透玻璃·棱角通透。
      this.engine.world.addComponent(id, { type: 'Mesh3D', shape: 'box', width: DIE, height: DIE, depth: DIE, frontTint: 0xeef4ff, dieFaces: faces, dieGlass: true } as unknown as Component);
      // 强翻滚角速度（落定面随机）+ **很轻**线速度 + 几乎不弹、高摩擦（落定在地台内·不飞散·owner「5 骰掷到场景中」要收得住）。
      this.engine.world.addComponent(id, {
        type: 'RigidBody3D', shape: 'box', mass: 1, restitution: 0.08, friction: 0.82,
        vx: (rand() - 0.5) * 0.6, vy: 0.6 + rand() * 0.8, vz: (rand() - 0.5) * 0.6,
        avx: (rand() - 0.5) * 22, avy: (rand() - 0.5) * 22, avz: (rand() - 0.5) * 22,
      } as unknown as Component);
    });
  }

  /** 每帧调（壁钟 nowMs）：监测各骰是否静止 → 落定后读朝上面。 */
  tick(nowMs: number): void {
    if (!this.active) return;
    const elapsed = nowMs - this.startMs;
    let moving = false;
    this.ids.forEach((id, i) => {
      const t = this.engine.world.getComponent<{ type: 'Transform3D'; quat?: readonly number[] }>(id, 'Transform3D');
      const q = t?.quat ?? [0, 0, 0, 1];
      const p = this.prevQuat[i];
      const d = p ? Math.abs(q[0]! - p[0]!) + Math.abs(q[1]! - p[1]!) + Math.abs(q[2]! - p[2]!) + Math.abs(q[3]! - p[3]!) : 1;
      if (d > 0.0016) moving = true;
      this.prevQuat[i] = [q[0]!, q[1]!, q[2]!, q[3]!];
    });
    if (moving) this.lastMoveMs = nowMs;
    // 静止 ≥350ms 且至少滚了 1.2s（避开初始下落阶段）→ 落定；或 7s 超时兜底强制读。
    if ((elapsed > 1200 && nowMs - this.lastMoveMs > 350) || elapsed > 7000) this.finish();
  }

  private finish(): void {
    const out: RolledDie[] = this.ids.map((id, i) => {
      const t = this.engine.world.getComponent<{ type: 'Transform3D'; quat?: readonly [number, number, number, number] }>(id, 'Transform3D');
      const up = upFaceIndex(t?.quat ?? [0, 0, 0, 1]);
      const pip = PIPS[up]!;
      // 头顶挂大号点数（WorldUI3D 基座件·owner「落地点数看不清」→ 醒目·金色发光）。
      this.engine.world.addComponent(id, { type: 'WorldUI3D', text: String(pip), offsetY: DIE + 0.5, size: 'lg', glow: true, color: 'gold' } as unknown as Component);
      return { dieId: this.dice[i]!.id, v: pip, el: this.dice[i]!.faces[0]!.el };
    });
    this.active = false;
    const cb = this.done; this.done = null;
    if (cb) cb(out);
  }

  /** 清场：撤走物理骰实体 + 围栏 + 停（换房/卸载/重掷前调）。 */
  clear(): void {
    for (const id of [...this.ids, ...this.wallIds]) { try { this.engine.world.destroyEntity(id); } catch { /* noop */ } }
    this.ids = []; this.wallIds = []; this.prevQuat = []; this.active = false;
  }
}
