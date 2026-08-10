// game211 · 大混战 Demo（owner 2026-08-10：24 张 = 1 组，红蓝各 5 组 = 240 张，在场上移动互相厮杀，
// 活着的重新编组，打到只剩一色）。
//
// **零新 system**——全是编排现成能力（同 duel-spike 的胶水先例）：
//  · 行军 = 2D `Transform` + `Velocity` + `Steering{seek + separation}` + `Relation`(目标) + `t1-motion-apply`
//    → **不挂 `Transform3D`**，于是渲染器自动走 `groundPose` 把 2D 位置投到地面 XZ（`three/geometry.ts:16`），
//      并按视觉签名自动归批成 `InstancedMesh`（`three/batches.ts`）。240 个单位 = 少数几个 draw call。
//  · 对决 = 真 cannon 刚体（`Transform3D` + `RigidBody3D`），复用 `duel-spike` 验证过的抛掷几何与落面判据。
//  · 战役规则 = `melee-campaign.ts` 纯函数（配对/判生死/重编组/胜负），已在 2000 场无头统计里验过：
//    必收敛 · 红蓝对称（961/1000/平39）· 中位 26 场对决 · 单场刚体峰值 48。
//  · 随机 = `meta-random.ts` 引擎种子 PRNG（硬红线禁裸 Math.random）。
//  · 挂载 = `stage-shell.ts`（LayoutNode 壳·**零手写 DOM**）。
//
// ⚠ 战场**不设围栏**：上一轮实测坐实「牌斜靠在围栏上站住」占了小场地未躺平的 93%
//（`scripts/game211-throw-lab.mjs` 控制变量实验）。这里场地极大且引擎 initWorld 自带一块无限 y=0 地平面兜底，
// 不需要围栏，也就没有那个 bug。
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import { ThreeRenderer } from '@zerocraft/engine/renderer/three-renderer.js';
import { AssetManager, ModelAssetLoader } from '@zerocraft/engine/assets/index.js';
import { mountUI } from '@zerocraft/engine/ui/components/index.js';
import { transformCapability, velocityCapability, tagCapability, relationCapability, destroyCapability } from '@zerocraft/engine/atom-skills/index.js';
import { motionApplyCapability } from '@zerocraft/engine/skills/tier1/index.js';
import { steeringCapability } from '@zerocraft/engine/skills/tier2/index.js';
import type { LayoutNode } from '@zerocraft/engine/ui/components/types.js';
import type { Component } from '@zerocraft/engine/engine/core/types.js';
import type { WorldBlueprint } from '@zerocraft/engine/assembly/demo.assembly.js';
import type { Transform, Transform3D, Camera3D, Relation } from '@zerocraft/engine/engine/protocol/components.js';
import { GG_THEME_ONYX } from './ui-theme.js';
import { mountStageShell } from './stage-shell.js';
import { metaRandom, metaInt, __setMetaSeed } from './meta-random.js';
import {
  initialGroups, nextEncounter, resolveDuel, applyDuel, regroup, winnerOf, countBySide,
  GROUP_SIZE, type Group, type Side,
} from './melee-campaign.js';
import { upYOf, throwPlan } from './duel-spike.js';

// ── 场地与观感 ──
const FIELD_HALF = 46;             // 大平板地图半径（够 10 组散开·极大 ⇒ 不需要围栏）
const CARD_W = 1.55, CARD_H = 2.15, CARD_T = 0.085;
const GRAVITY = 20;
const TINT: Record<Side, number> = { red: 0xd2453c, blue: 0x3d6fd0 };
const DEATH_TINT = 0x5b6068;
const EDGE_TINT = 0x2a2e34;
// 阵营 Tag 位（`Steering.separation.tagMask` 用它筛「同群邻居」——只被自己人推开，不被敌人推开）。
const TAG_RED = 1 << 0, TAG_BLUE = 1 << 1;
const TAG_OF: Record<Side, number> = { red: TAG_RED, blue: TAG_BLUE };

// ⚠ `Steering.speed` 的单位是**每 tick**（不是每秒）——见 steering.ts 字段注释「写入 Velocity 模长，单位/tick」。
// 60Hz 下 0.16/tick ≈ 9.6 单位/秒：跨过半个战场约 5 秒，看得清也不拖。
const MARCH_SPEED = 0.16;
const SEPARATION_R = 2.6;          // 同队互斥半径（≈ 牌长·排成阵列不叠压）
const SEPARATION_W = 3.2;
const ENGAGE_DIST = 7.0;           // 两组质心近到这个距离 → 开打
const DUEL_SETTLE_MS = 2600;       // 一场对决最多等这么久（超时按当前朝向读数·防个别牌永不入睡卡住整局）

/** 静态场景（相机/光/天/地台）。 */
function fieldBlueprint(): WorldBlueprint {
  return {
    capabilities: [
      transformCapability, velocityCapability, tagCapability, relationCapability,
      destroyCapability, motionApplyCapability, steeringCapability,
    ],
    entities: {
      cam: { Camera3D: { yaw: 0, pitch: 0.86, distance: 96, mode: 'orbit', near: 0.1, far: 600, pivotX: 0, pivotY: 0, pivotZ: 0 } },
      sun: { Light3D: { kind: 'directional', color: 0xfff2dc, intensity: 1.65, dirX: -5, dirY: -9, dirZ: -4, castShadow: true } },
      fill: { Light3D: { kind: 'directional', color: 0x7c9cff, intensity: 0.55, dirX: 5, dirY: -3, dirZ: 5 } },
      amb: { Light3D: { kind: 'ambient', color: 0xffeede, intensity: 0.68 } },
      sky: { Sky3D: { top: 0x35507a, bottom: 0x121a2a, clouds: false, cloudTint: 0x2a3648, scroll: 0.2 } },
      post: { Post3D: { bloom: { strength: 0.26, radius: 0.7, threshold: 0.8 }, vignette: { intensity: 0.4, smoothness: 0.6 } } },
      // 地台（纯表现·物理靠 initWorld 自带的无限 y=0 平面兜底）
      ground: {
        Transform3D: { x: 0, y: -0.4, z: 0 },
        Mesh3D: { shape: 'box', width: FIELD_HALF * 2.4, height: 0.8, depth: FIELD_HALF * 2.4, frontTint: 0x2f6b4f, edgeTint: 0x14301f },
      },
    },
  };
}

export interface MeleeDemoHandle { destroy: () => void }

type Phase = 'march' | 'duel' | 'over';

/** 挂载大混战 demo。 */
export function mountMeleeDemo(container: HTMLElement, opts?: { seed?: number; onExit?: () => void }): MeleeDemoHandle {
  const shell = mountStageShell(container, GG_THEME_ONYX, 'g211-melee');
  const w = Math.max(360, Math.min(1280, container.clientWidth || 1040));
  const h = Math.max(260, Math.min(720, Math.round(w * 0.56)));

  const assets = new AssetManager(new ModelAssetLoader());
  const engine = new Engine();
  engine.load(fieldBlueprint());
  const renderer = new ThreeRenderer({ width: w, height: h, background: 0x121a2a, assets, antialias: true, dprCap: 1.5, shadowMapSize: 1024 });
  engine.attachRenderer(renderer, shell.stage);

  __setMetaSeed(opts?.seed ?? 20260810);
  // 物理档（与 duel-spike 同档·见其头注坑⑥：PhysicsWorld3D 未进蓝图闭集，只能命令式挂）
  engine.world.createEntity('melee-phys');
  engine.world.addComponent('melee-phys', { type: 'PhysicsWorld3D', gravity: -GRAVITY, restitution: 0.22, friction: 0.5, solverIterations: 20 } as unknown as Component);

  // ── 战役状态（真相在 melee-campaign 的纯数据里·世界只是它的投影）──
  let groups: Group[] = initialGroups(FIELD_HALF * 0.62, 15);
  let phase: Phase = 'march';
  let duelNo = 0;
  let status = '行军中';
  let lastVerdict = '';
  const unitIds = new Set<string>();     // 场上行军单位实体 id
  const duelIds: string[] = [];          // 本场对决的刚体实体 id
  let duelEnd = 0;
  let duelCtx: { a: Group; b: Group; pairs: number; aIds: string[]; bIds: string[] } | null = null;

  /** 单位实体 id（牌 id 就是唯一键·重编组不改牌 id）。 */
  const unitEntity = (cardId: string): string => `u-${cardId}`;

  /** 建/更新行军单位：每张活着的牌一个 2D 实体（不挂 Transform3D → 自动投地面 + 自动归批）。 */
  function syncUnits(): void {
    const alive = new Set<string>();
    for (const g of groups) {
      // 阵列：每组排成近似方阵，绕组心铺开。
      const cols = Math.ceil(Math.sqrt(g.cards.length));
      g.cards.forEach((cardId, i) => {
        const id = unitEntity(cardId);
        alive.add(id);
        const ox = ((i % cols) - (cols - 1) / 2) * 2.1;
        const oy = (Math.floor(i / cols) - (cols - 1) / 2) * 2.1;
        if (!unitIds.has(id)) {
          engine.world.createEntity(id);
          engine.world.addComponent(id, { type: 'Transform', x: g.x + ox, y: g.y + oy, rotation: 0, scaleX: 1, scaleY: 1 } as unknown as Component);
          engine.world.addComponent(id, { type: 'Velocity', vx: 0, vy: 0 } as unknown as Component);
          engine.world.addComponent(id, { type: 'Tag', flags: TAG_OF[g.side] } as unknown as Component);
          // 牌平躺在地上行军（faceAxis:'y' → 正面朝天=阵营色）
          engine.world.addComponent(id, {
            type: 'Mesh3D', shape: 'box', width: CARD_W, height: CARD_T, depth: CARD_H,
            faceAxis: 'y', frontTint: TINT[g.side], backTint: DEATH_TINT, edgeTint: EDGE_TINT,
          } as unknown as Component);
          // seek + 同队分离（**只被自己人推开**：tagMask 取本方位 → 敌我可以贴近才打得起来）
          engine.world.addComponent(id, {
            type: 'Steering', mode: 'seek', speed: MARCH_SPEED, stopRange: 1.2,
            separation: { radius: SEPARATION_R, weight: SEPARATION_W, tagMask: TAG_OF[g.side] },
          } as unknown as Component);
          unitIds.add(id);
        }
      });
    }
    // 阵亡的移除
    for (const id of [...unitIds]) {
      if (alive.has(id)) continue;
      try { engine.world.destroyEntity(id); } catch { /* 已不在 */ }
      unitIds.delete(id);
    }
  }

  /** 每 tick 更新索敌：本组所有单位都朝「最近敌组的组心代表」走。 */
  function retarget(): void {
    for (const g of groups) {
      const foes = groups.filter((q) => q.side !== g.side && q.cards.length > 0);
      if (!foes.length) continue;
      let best = foes[0]!;
      let bd = Infinity;
      for (const f of foes) {
        const d = Math.hypot(f.x - g.x, f.y - g.y);
        if (d < bd || (d === bd && f.id < best.id)) { bd = d; best = f; }
      }
      const targetId = unitEntity(best.cards[0]!);
      for (const cardId of g.cards) {
        const rel = engine.world.getComponent<Relation>(unitEntity(cardId), 'Relation');
        // ⚠ `kind:'target'` 不能省：steering 是 `rel.kind === 'target'` 才认目标，否则每 tick 落到
        // 「无目标 → 速度归零」那条分支——单位一动不动，且**不报任何错**（正是最难查的那类静默失效）。
        if (rel) { rel.targetId = targetId; rel.kind = 'target'; }
        else engine.world.addComponent(unitEntity(cardId), { type: 'Relation', kind: 'target', targetId } as unknown as Component);
      }
    }
  }

  /** 从世界读回各组质心（steering 在动，真相在世界里）。 */
  function refreshCentroids(): void {
    groups = groups.map((g) => {
      let sx = 0, sy = 0, n = 0;
      for (const cardId of g.cards) {
        const t = engine.world.getComponent<Transform>(unitEntity(cardId), 'Transform');
        if (!t) continue;
        sx += t.x; sy += t.y; n += 1;
      }
      return n ? { ...g, x: sx / n, y: sy / n } : g;
    });
  }

  /** 开打：在两组之间的中点，把双方各 N 张牌抛成真刚体。 */
  function startDuel(a: Group, b: Group): void {
    const pairs = Math.min(a.cards.length, b.cards.length);
    const cx = (a.x + b.x) / 2, cz = (a.y + b.y) / 2;
    duelNo += 1;
    duelIds.length = 0;
    const aIds: string[] = [], bIds: string[] = [];
    for (let lane = 0; lane < pairs; lane++) {
      const laneZ = cz + (lane - (pairs - 1) / 2) * 3.2;
      const vy = 12.4 + metaRandom() * 1.2;
      const tMeet = (vy / GRAVITY) * (0.80 + metaRandom() * 0.12);
      const plan = throwPlan(0, 1.8, vy, tMeet, 0.05, 0.82);   // 复用 duel-spike 的出手几何（唯一真相）
      for (const side of ['a', 'b'] as const) {
        const p0 = plan[side];
        const grp = side === 'a' ? a : b;
        const id = `duel-${duelNo}-${lane}-${side}`;           // 换 id 才会重建刚体（duel-spike 头注坑②）
        (side === 'a' ? aIds : bIds).push(id);
        engine.world.createEntity(id);
        engine.world.addComponent(id, { type: 'Transform3D', x: cx + p0.x, y: p0.y, z: laneZ + p0.z } as unknown as Component);
        engine.world.addComponent(id, {
          type: 'Mesh3D', shape: 'box', width: CARD_W, height: CARD_T, depth: CARD_H,
          faceAxis: 'y', frontTint: TINT[grp.side], backTint: DEATH_TINT, edgeTint: EDGE_TINT,
        } as unknown as Component);
        engine.world.addComponent(id, {
          type: 'RigidBody3D', shape: 'cylinder', mass: 1.0,
          vx: p0.vx, vy: p0.vy, vz: p0.vz,
          avx: (metaRandom() < 0.5 ? -1 : 1) * (7 + metaRandom() * 11),
          avy: -4 + metaRandom() * 8,
          avz: (metaRandom() < 0.5 ? -1 : 1) * (metaRandom() * 6.3),
        } as unknown as Component);
        duelIds.push(id);
      }
    }
    duelCtx = { a, b, pairs, aIds, bIds };
    duelEnd = performance.now() + DUEL_SETTLE_MS;
    phase = 'duel';
    status = `第 ${duelNo} 场对决 · ${pairs}v${pairs}`;
    // 镜头推近到战场
    const cam = engine.world.getComponent<Camera3D>('cam', 'Camera3D');
    if (cam) { cam.pivotX = cx; cam.pivotZ = cz; cam.distance = 34; }
  }

  /** 读牌面 → 判生死 → 写回战役状态 → 重编组。 */
  function finishDuel(): void {
    if (!duelCtx) return;
    const { a, b, aIds, bIds } = duelCtx;
    // flip 序列直接取自**真物理**的落面（不是模型抽样）：正面朝上 = 活。
    let i = 0;
    const faces: boolean[] = [];
    for (let lane = 0; lane < duelCtx.pairs; lane++) {
      for (const ids of [aIds, bIds]) {
        const t = engine.world.getComponent<Transform3D>(ids[lane]!, 'Transform3D');
        faces.push(upYOf(t?.quat ?? [0, 0, 0, 1]) > 0);
      }
    }
    const r = resolveDuel(a.cards, b.cards, () => faces[i++] ?? true);
    lastVerdict = `第 ${duelNo} 场：赤 ${a.cards.length}→${r.aSurvivors.length} · 蓝 ${b.cards.length}→${r.bSurvivors.length}`;
    groups = regroup(applyDuel(groups, a.id, b.id, r));
    for (const id of duelIds) { try { engine.world.destroyEntity(id); } catch { /* 已不在 */ } }
    duelIds.length = 0;
    duelCtx = null;
    syncUnits();
    const win = winnerOf(groups);
    if (win !== null) {
      phase = 'over';
      status = win === 'draw' ? '同归于尽 · 平局' : win === 'red' ? '赤方获胜' : '蓝方获胜';
    } else {
      phase = 'march';
      status = '行军中';
      const cam = engine.world.getComponent<Camera3D>('cam', 'Camera3D');
      if (cam) { cam.pivotX = 0; cam.pivotZ = 0; cam.distance = 96; }
    }
    renderHud();
  }

  // ── HUD（LayoutNode 闭集）──
  function hudTree(): LayoutNode {
    const n = countBySide(groups);
    const rows: LayoutNode[] = [
      { type: 'Label', id: 'md-title', props: { text: '大混战 · 240 张牌打到只剩一色', size: 'lg', color: 'gold' }, layout: {} },
      { type: 'Label', id: 'md-status', props: { text: `${status} · 第 ${duelNo} 场对决`, size: 'sm', color: 'dim' }, layout: {} },
      { type: 'Label', id: 'md-count', props: { text: `赤 ${n.red} 张（${groups.filter((g) => g.side === 'red').length} 组） · 蓝 ${n.blue} 张（${groups.filter((g) => g.side === 'blue').length} 组）`, size: 'md' }, layout: {} },
    ];
    if (lastVerdict) rows.push({ type: 'Label', id: 'md-last', props: { text: lastVerdict, size: 'sm', color: 'ok' }, layout: {} });
    rows.push({
      type: 'Panel', id: 'md-btns', props: { bare: true }, layout: { direction: 'row', gap: 8 },
      children: [
        { type: 'Button', id: 'md-restart', props: { text: '重开一局', action: 'restart' }, layout: {} },
        { type: 'Button', id: 'md-exit', props: { text: '返回', action: 'exit' }, layout: {} },
      ],
    });
    return { type: 'Panel', id: 'md-root', props: { bare: true }, layout: { direction: 'column', gap: 6, padding: 10 }, children: rows };
  }
  let hudTeardown: (() => void) | undefined;
  function renderHud(): void {
    hudTeardown?.();
    hudTeardown = mountUI(shell.hud, hudTree(), {
      restart: () => restart(),
      exit: () => opts?.onExit?.(),
    }, GG_THEME_ONYX);
  }

  function restart(): void {
    for (const id of [...unitIds]) { try { engine.world.destroyEntity(id); } catch { /* 已不在 */ } }
    unitIds.clear();
    for (const id of duelIds) { try { engine.world.destroyEntity(id); } catch { /* 已不在 */ } }
    duelIds.length = 0;
    duelCtx = null;
    __setMetaSeed((opts?.seed ?? 20260810) + metaInt(1e6));
    groups = initialGroups(FIELD_HALF * 0.62, 15);
    phase = 'march';
    duelNo = 0;
    lastVerdict = '';
    status = '行军中';
    const cam = engine.world.getComponent<Camera3D>('cam', 'Camera3D');
    if (cam) { cam.pivotX = 0; cam.pivotZ = 0; cam.distance = 96; }
    syncUnits();
    renderHud();
  }

  engine.start();
  syncUnits();
  renderHud();

  let raf = 0;
  let hudTick = 0;
  const pump = (): void => {
    if (phase === 'march') {
      refreshCentroids();
      retarget();
      const enc = nextEncounter(groups);
      if (enc && enc.dist <= ENGAGE_DIST) startDuel(enc.a, enc.b);
    } else if (phase === 'duel' && performance.now() >= duelEnd) {
      finishDuel();
    }
    if (++hudTick % 20 === 0) renderHud();   // HUD 每 20 帧刷一次（别每帧重挂）
    raf = requestAnimationFrame(pump);
  };
  raf = requestAnimationFrame(pump);

  return {
    destroy: () => {
      cancelAnimationFrame(raf);
      hudTeardown?.();
      engine.stop?.();
      shell.destroy();
    },
  };
}
