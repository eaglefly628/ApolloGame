// game211 · 大规模 RTS 对战原型（owner 2026-08-10）。
//
// owner 定的范围：「3D 场景里大规模海量 NPC 对战的 RTS，**唯一操作是布置兵种相克 + 对应的投放点**」
// 「不用抛掷了，按照数值计算伤害还有一些战场规则」。参考=抖音直播互动战争那一类
// （两军持续投兵 · 自动对撞 · 底部兵种条标克制箭头 · 顶上兵力条 · 战线随强弱前后推移）。
//
// **零新 system**——移动/渲染全用现成能力，战斗结算是编排胶水（同 `duel-spike` 先例）：
//  · 行军 = 2D `Transform` + `Velocity` + `Steering{seek + separation}` + `Relation{kind:'target'}`
//    + `t1-motion-apply`。**不挂 `Transform3D`** → 渲染器自动 `groundPose` 投地面（`three/geometry.ts:16`）
//    并按视觉签名自动归批成 `InstancedMesh`（`three/batches.ts`）→ 上千单位只有几个 draw call。
//  · 邻居查询 = `queryRange`（空间网格分桶·`spatial-query/index.ts:81`），复杂度跟邻居数走不跟总数走。
//  · 数值/相克/战线 = `rts-combat.ts` 纯函数（21 例测试·环形相克每一环实测成立）。
//  · 随机 = `meta-random`（引擎种子 PRNG·硬红线禁裸 Math.random）。**伤害本身无随机**（确定性数值）。
//  · 挂载 = `stage-shell`（LayoutNode 壳·零手写 DOM）。
//
// 规模依据（`slg-scale.bench.test.ts` 实测·真引擎能力）：
//   240 单位 0.39ms/tick · 1000 单位 2.21ms · 2000 单位 5.22ms（贴 sim 安全线 16.7/3）
//   且**大地图更便宜**（同 1000 单位：战场 512 → 5.15ms，战场 8192 → 2.32ms）。
//   故本原型放心开到 ~1200 单位上限。
//
// ⚠ 一处已知的能力口径（记录·暂用胶水绕过）：`Hitbox` 的伤害是**每 Hitbox 固定值**，
//   而相克要求「伤害随目标兵种变」。用现成 hitbox 链表达需要每单位挂多个子实体（实体数 ×3，
//   正好吃掉规模优势）。故本原型的伤害结算走游戏层胶水（只读引擎维护的 Transform，
//   不定义新组件/新相位——同 duel-spike 判定落面的形态）。若此玩法定型，
//   正解是下沉 `Hitbox.damageByTag`（按目标 Tag 位取伤害）——届时走 requests 报单。
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import { ThreeRenderer } from '@zerocraft/engine/renderer/three-renderer.js';
import { AssetManager, ModelAssetLoader } from '@zerocraft/engine/assets/index.js';
import { mountUI } from '@zerocraft/engine/ui/components/index.js';
import { queryRange } from '@zerocraft/engine/atom-skills/index.js';
import { transformCapability, velocityCapability, tagCapability, relationCapability, destroyCapability } from '@zerocraft/engine/atom-skills/index.js';
import { motionApplyCapability } from '@zerocraft/engine/skills/tier1/index.js';
import { steeringCapability } from '@zerocraft/engine/skills/tier2/index.js';
import type { LayoutNode } from '@zerocraft/engine/ui/components/types.js';
import type { Component } from '@zerocraft/engine/engine/core/types.js';
import type { WorldBlueprint } from '@zerocraft/engine/assembly/demo.assembly.js';
import type { Transform, Camera3D, Relation, Velocity } from '@zerocraft/engine/engine/protocol/components.js';
import { GG_THEME_ONYX } from './ui-theme.js';
import { mountStageShell } from './stage-shell.js';
import {
  SUITS, UNIT, damageOf, counterPairs, nextSpawnSuit, compTotal, EMPTY_COMP,
  regenSupply, canAfford, paySupply, frontLine, frontWinner,
  type Suit, type Composition, type Supply,
} from './rts-combat.js';

// ── 战场 ──
const HALF_X = 60;                 // 战场半宽（红从 −x 打向 +x）
const HALF_Z = 34;                 // 战场半深
const LANES = [-20, 0, 20] as const;   // 三条投放道（owner 的第二个操作：投放点）
const SPAWN_X = HALF_X - 6;        // 投放点距基地
const MAX_UNITS = 1200;            // 规模闸（实测 2000 才贴安全线·留足余量给渲染）
const CARD_W = 1.4, CARD_T = 0.09, CARD_H = 2.0;
const SEP_R = 2.0, SEP_W = 2.6;
const TAG_RED = 1 << 0, TAG_BLUE = 1 << 1;

type Side = 'red' | 'blue';
const OTHER: Record<Side, Side> = { red: 'blue', blue: 'red' };
const TAG_OF: Record<Side, number> = { red: TAG_RED, blue: TAG_BLUE };
const SIDE_DIR: Record<Side, number> = { red: -1, blue: 1 };   // 己方基地在哪一侧

/** 场上一个单位的运行态（真相在这里·世界只是它的投影）。 */
interface Unit {
  readonly id: string;
  readonly side: Side;
  readonly suit: Suit;
  hp: number;
  cd: number;          // 攻击冷却剩余 tick
}

function fieldBlueprint(): WorldBlueprint {
  return {
    capabilities: [
      transformCapability, velocityCapability, tagCapability, relationCapability,
      destroyCapability, motionApplyCapability, steeringCapability,
    ],
    entities: {
      cam: { Camera3D: { yaw: 0, pitch: 0.92, distance: 118, mode: 'orbit', near: 0.1, far: 900, pivotX: 0, pivotY: 0, pivotZ: 0 } },
      sun: { Light3D: { kind: 'directional', color: 0xfff2dc, intensity: 1.6, dirX: -5, dirY: -9, dirZ: -4, castShadow: true } },
      fill: { Light3D: { kind: 'directional', color: 0x7c9cff, intensity: 0.5, dirX: 5, dirY: -3, dirZ: 5 } },
      amb: { Light3D: { kind: 'ambient', color: 0xffeede, intensity: 0.72 } },
      sky: { Sky3D: { top: 0x35507a, bottom: 0x121a2a, clouds: false, cloudTint: 0x2a3648, scroll: 0.2 } },
      post: { Post3D: { bloom: { strength: 0.24, radius: 0.7, threshold: 0.82 }, vignette: { intensity: 0.4, smoothness: 0.6 } } },
      ground: {
        Transform3D: { x: 0, y: -0.4, z: 0 },
        Mesh3D: { shape: 'box', width: HALF_X * 2.2, height: 0.8, depth: HALF_Z * 2.4, frontTint: 0x33684c, edgeTint: 0x16301f },
      },
      // 两侧基地（纯表现·标出胜利线在哪）
      baseR: { Transform3D: { x: -HALF_X, y: 0.6, z: 0 }, Mesh3D: { shape: 'box', width: 3, height: 2.4, depth: HALF_Z * 1.6, frontTint: 0xd2453c, edgeTint: 0x5a1a16 } },
      baseB: { Transform3D: { x: HALF_X, y: 0.6, z: 0 }, Mesh3D: { shape: 'box', width: 3, height: 2.4, depth: HALF_Z * 1.6, frontTint: 0x3d6fd0, edgeTint: 0x16305a } },
    },
  };
}

export interface RtsDemoHandle { destroy: () => void }

export function mountRtsDemo(container: HTMLElement, opts?: { onExit?: () => void; onSpike?: () => void }): RtsDemoHandle {
  const shell = mountStageShell(container, GG_THEME_ONYX, 'g211-rts');
  const w = Math.max(360, Math.min(1280, container.clientWidth || 1060));
  const h = Math.max(260, Math.min(700, Math.round(w * 0.52)));

  const assets = new AssetManager(new ModelAssetLoader());
  const engine = new Engine();
  engine.load(fieldBlueprint());
  const renderer = new ThreeRenderer({ width: w, height: h, background: 0x121a2a, assets, antialias: true, dprCap: 1.5, shadowMapSize: 1024 });
  engine.attachRenderer(renderer, shell.stage);

  // ── 玩家的两个操作 ──
  let comp: Composition = { ...EMPTY_COMP, spade: 1 };   // ① 兵种配比
  let lane = 1;                                          // ② 投放点（LANES 下标）
  // AI 对手：固定一套配比（原型阶段·让玩家能感到相克真的有用）
  const aiComp: Composition = { spade: 1, heart: 1, diamond: 0, club: 1 };

  const units = new Map<string, Unit>();
  const sent: Record<Side, Composition> = { red: { ...EMPTY_COMP }, blue: { ...EMPTY_COMP } };
  const supply: Record<Side, Supply> = {
    red: { current: 60, max: 140, regen: 0.42 },
    blue: { current: 60, max: 140, regen: 0.42 },
  };
  let uid = 0;
  let tick = 0;
  let front = 0;
  let over: Side | null = null;
  let killed: Record<Side, number> = { red: 0, blue: 0 };

  const posOf = (id: string): Transform | undefined => engine.world.getComponent<Transform>(id, 'Transform');

  // 集结点：每方一个**只有 2D Transform、没有 Mesh3D** 的实体（不渲染），摆在对方基地前。
  // ⚠ 为什么必须走它、不能自己写 Velocity：`steering` 每 tick 都会**覆盖 Velocity**——
  // 无目标时它把速度归零。上一版在 combatTick 里手写 v.vx 推进，被 steering 当场抹掉，
  // 表现就是「单位堆在出生点、战线恒 0」且**零报错**（同 melee 那次 Relation.kind 的静默失效）。
  // 给个真目标让 steering 自己去 seek，才是顺着它的语义走。
  const RALLY: Record<Side, string> = { red: 'rally-red', blue: 'rally-blue' };
  for (const side of ['red', 'blue'] as const) {
    const id = RALLY[side];
    engine.world.createEntity(id);
    // 目标点 = 对方基地稍内侧（−SIDE_DIR = 敌方那一侧）
    engine.world.addComponent(id, { type: 'Transform', x: -SIDE_DIR[side] * (HALF_X - 2), y: 0, rotation: 0, scaleX: 1, scaleY: 1 } as unknown as Component);
  }

  /** 投放一个单位（战场规则：只在己方 lane 的投放点出生·扣兵力）。 */
  function spawn(side: Side, suit: Suit, laneIdx: number): void {
    if (units.size >= MAX_UNITS) return;
    const st = UNIT[suit];
    const id = `u${++uid}`;
    const dir = SIDE_DIR[side];
    const z = LANES[laneIdx] ?? 0;
    engine.world.createEntity(id);
    engine.world.addComponent(id, { type: 'Transform', x: dir * SPAWN_X, y: z, rotation: 0, scaleX: 1, scaleY: 1 } as unknown as Component);
    engine.world.addComponent(id, { type: 'Velocity', vx: 0, vy: 0 } as unknown as Component);
    engine.world.addComponent(id, { type: 'Tag', flags: TAG_OF[side] } as unknown as Component);
    engine.world.addComponent(id, {
      type: 'Mesh3D', shape: 'box', width: CARD_W, height: CARD_T, depth: CARD_H,
      faceAxis: 'y', frontTint: st.tint, backTint: 0x5b6068, edgeTint: 0x2a2e34,
    } as unknown as Component);
    engine.world.addComponent(id, {
      type: 'Steering', mode: 'seek', speed: st.speed, stopRange: st.range * 0.85,
      separation: { radius: SEP_R, weight: SEP_W, tagMask: TAG_OF[side] },
    } as unknown as Component);
    units.set(id, { id, side, suit, hp: st.hp, cd: 0 });
  }

  /** 索敌 + 战斗结算（编排胶水：只读引擎维护的 Transform，不定义新组件/相位）。 */
  function combatTick(): void {
    const dead: string[] = [];
    // 逐单位：找射程内最近的敌人 → 够近就打，不够近就把 Relation 指过去让 steering 走过去。
    for (const [id, u] of units) {
      const t = posOf(id);
      if (!t) { dead.push(id); continue; }
      if (u.cd > 0) u.cd -= 1;
      const st = UNIT[u.suit];
      // 搜索半径取 max(射程, 一个索敌视野) —— 视野比射程大，否则单位站着不动等敌人走进射程。
      const scan = Math.max(st.range, 16);
      const near = queryRange(engine.world, t.x, t.y, scan);
      let bestId: string | null = null;
      let bestD = Infinity;
      for (const nid of near) {
        const foe = units.get(nid);
        if (!foe || foe.side === u.side) continue;
        const ft = posOf(nid);
        if (!ft) continue;
        const d = Math.hypot(ft.x - t.x, ft.y - t.y);
        // 全序 tie-break：先距离、后 id —— 同输入必得同输出（可回放）
        if (d < bestD || (d === bestD && (bestId === null || nid < bestId))) { bestD = d; bestId = nid; }
      }
      if (!bestId) {
        // 没敌人 → 朝**集结点**推进（战场规则：占领是目标，不是纯歼灭）。
        // 走 Relation 让 steering 自己驱动，不手写 Velocity（见 RALLY 处的血泪注）。
        const rel = engine.world.getComponent<Relation>(id, 'Relation');
        if (rel) { rel.kind = 'target'; rel.targetId = RALLY[u.side]; }
        else engine.world.addComponent(id, { type: 'Relation', kind: 'target', targetId: RALLY[u.side] } as unknown as Component);
        continue;
      }
      // 有敌人 → steering 追过去（到 stopRange 自动停 = 站在射程边缘输出）
      const rel = engine.world.getComponent<Relation>(id, 'Relation');
      if (rel) { rel.kind = 'target'; rel.targetId = bestId; }
      else engine.world.addComponent(id, { type: 'Relation', kind: 'target', targetId: bestId } as unknown as Component);
      // 进射程 + 冷却好了 → 结算伤害（**确定性数值·无随机**）
      if (bestD <= st.range && u.cd <= 0) {
        const foe = units.get(bestId)!;
        foe.hp -= damageOf(u.suit, foe.suit);
        u.cd = st.cooldown;
        if (foe.hp <= 0) { dead.push(bestId); killed[u.side] += 1; }
      }
    }
    for (const id of dead) {
      if (!units.has(id)) continue;
      units.delete(id);
      try { engine.world.destroyEntity(id); } catch { /* 已不在 */ }
    }
  }

  /** 战线（战场规则的核心读数）：红方最前沿与蓝方最前沿的中点。 */
  function updateFront(): void {
    let redMax: number | null = null, blueMin: number | null = null;
    for (const [id, u] of units) {
      const t = posOf(id);
      if (!t) continue;
      if (u.side === 'red') redMax = redMax === null ? t.x : Math.max(redMax, t.x);
      else blueMin = blueMin === null ? t.x : Math.min(blueMin, t.x);
    }
    front = frontLine(redMax, blueMin, HALF_X);
    const w2 = frontWinner(front, HALF_X);
    if (w2 && !over) over = w2;
  }

  /** AI 对手：兵力够就按自己的配比投，随机挑一条道（走引擎种子 PRNG）。 */
  function aiTick(): void {
    const s = nextSpawnSuit(aiComp, sent.blue);
    if (!s || !canAfford(supply.blue, s)) return;
    supply.blue = paySupply(supply.blue, s);
    sent.blue = { ...sent.blue, [s]: sent.blue[s] + 1 };
    spawn('blue', s, tick % LANES.length);
  }

  /** 玩家侧自动投放（配比 + 选定的投放点·唯一操作就是改这两个）。 */
  function playerTick(): void {
    const s = nextSpawnSuit(comp, sent.red);
    if (!s || !canAfford(supply.red, s)) return;
    supply.red = paySupply(supply.red, s);
    sent.red = { ...sent.red, [s]: sent.red[s] + 1 };
    spawn('red', s, lane);
  }

  // ── HUD（LayoutNode 闭集）──
  function countOf(side: Side, suit: Suit): number {
    let n = 0;
    for (const u of units.values()) if (u.side === side && u.suit === suit) n += 1;
    return n;
  }
  function hudTree(): LayoutNode {
    const rows: LayoutNode[] = [];
    const redN = [...units.values()].filter((u) => u.side === 'red').length;
    const blueN = units.size - redN;
    rows.push({ type: 'Label', id: 'rt-title', props: { text: '大规模 RTS · 兵种相克 + 投放点', size: 'lg', color: 'gold' }, layout: {} });
    rows.push({
      type: 'Label', id: 'rt-stat',
      props: {
        text: over ? (over === 'red' ? '🎉 赤方攻陷蓝方基地' : '蓝方攻陷赤方基地')
          : `场上 ${units.size} · 赤 ${redN} / 蓝 ${blueN} · 战线 ${front.toFixed(1)} · 兵力 ${Math.floor(supply.red.current)}/${supply.red.max}`,
        size: 'sm', color: over ? 'gold' : 'dim',
      }, layout: {},
    });
    // 兵种计数（红/蓝逐兵种·像参考图顶部那条）
    rows.push({
      type: 'Label', id: 'rt-counts',
      props: { text: SUITS.map((s) => `${UNIT[s].label} ${countOf('red', s)}:${countOf('blue', s)}`).join('  ·  '), size: 'sm' }, layout: {},
    });
    // 克制关系（数据出自 counterPairs·与判定同源）
    rows.push({
      type: 'Label', id: 'rt-counter',
      props: { text: '克制： ' + counterPairs().map((p) => `${UNIT[p.from].label.slice(0, 3)}→${UNIT[p.to].label.slice(0, 3)}`).join('  '), size: 'sm', color: 'ok' }, layout: {},
    });
    // ① 兵种配比（唯一操作之一）
    rows.push({ type: 'Label', id: 'rt-comp-t', props: { text: `投放配比（点击 +1 / 右侧清零）· 当前总份额 ${compTotal(comp)}`, size: 'sm', color: 'dim' }, layout: {} });
    rows.push({
      type: 'Panel', id: 'rt-comp', props: { bare: true }, layout: { direction: 'row', gap: 6 },
      children: SUITS.map((s) => ({
        type: 'Button', id: `rt-s-${s}`,
        // ⚠ 带参 action 的约定是 `action` + **`actionArg`** 两个字段（server.ts 读 data-action / data-arg）。
        // 写成 `action:'pick:spade'` 会让 handler 名变成字面量 `pick:spade` → 查不到 handler → **静默无效**（已踩）。
        props: { label: `${UNIT[s].label} ×${comp[s]}  (${UNIT[s].cost})`, kind: comp[s] > 0 ? 'primary' : 'ghost', action: 'pick', actionArg: s },
        layout: {},
      } as LayoutNode)),
    });
    // ② 投放点（唯一操作之二）
    rows.push({ type: 'Label', id: 'rt-lane-t', props: { text: '投放点', size: 'sm', color: 'dim' }, layout: {} });
    rows.push({
      type: 'Panel', id: 'rt-lane', props: { bare: true }, layout: { direction: 'row', gap: 6 },
      children: LANES.map((z, i) => ({
        type: 'Button', id: `rt-l-${i}`,
        props: { label: i === 0 ? '上路' : i === 1 ? '中路' : '下路', kind: lane === i ? 'primary' : 'ghost', action: 'lane', actionArg: String(i) },
        layout: {},
      } as LayoutNode)),
    });
    rows.push({
      type: 'Panel', id: 'rt-btns', props: { bare: true }, layout: { direction: 'row', gap: 8 },
      children: [
        { type: 'Button', id: 'rt-clear', props: { label: '清空配比', kind: 'ghost', action: 'clear' }, layout: {} },
        { type: 'Button', id: 'rt-restart', props: { label: '重开', kind: 'ghost', action: 'restart' }, layout: {} },
        ...(opts?.onSpike ? [{ type: 'Button', id: 'rt-spike', props: { label: '← 回对决台', kind: 'ghost', action: 'spike' }, layout: {} } as LayoutNode] : []),
        ...(opts?.onExit ? [{ type: 'Button', id: 'rt-exit', props: { label: '返回大厅', kind: 'ghost', action: 'exit' }, layout: {} } as LayoutNode] : []),
      ],
    });
    return { type: 'Panel', id: 'rt-root', props: { bare: true }, layout: { direction: 'column', gap: 5, padding: 10 }, children: rows };
  }
  // HUD 只挂一次，之后走 `handle.update()` 的**按 id diff/patch**（server.ts:58-60）——
  // 整树重挂会把按钮 DOM 换掉，正在点的那一下就落空了（Playwright 实证点击不生效）。
  let hudHandle: ReturnType<typeof mountUI> | undefined;
  function renderHud(): void {
    if (hudHandle) { hudHandle.update(hudTree(), GG_THEME_ONYX); return; }
    hudHandle = mountUI(shell.hud, hudTree(), {
      pick: (arg) => { const s = arg as Suit; if (s && SUITS.includes(s)) { comp = { ...comp, [s]: comp[s] + 1 }; renderHud(); } },
      lane: (arg) => { const i = Number(arg); if (Number.isFinite(i)) { lane = i; renderHud(); } },
      clear: () => { comp = { ...EMPTY_COMP }; renderHud(); },
      restart: () => restart(),
      spike: () => opts?.onSpike?.(),
      exit: () => opts?.onExit?.(),
    }, GG_THEME_ONYX);
  }

  function restart(): void {
    for (const id of units.keys()) { try { engine.world.destroyEntity(id); } catch { /* 已不在 */ } }
    units.clear();
    sent.red = { ...EMPTY_COMP }; sent.blue = { ...EMPTY_COMP };
    supply.red = { current: 60, max: 140, regen: 0.42 };
    supply.blue = { current: 60, max: 140, regen: 0.42 };
    killed = { red: 0, blue: 0 };
    over = null; front = 0; tick = 0;
    renderHud();
  }

  engine.start();
  renderHud();

  let raf = 0;
  let hudTick = 0;
  const pump = (): void => {
    if (!over) {
      tick += 1;
      supply.red = regenSupply(supply.red);
      supply.blue = regenSupply(supply.blue);
      if (tick % 12 === 0) { playerTick(); aiTick(); }   // 投放节奏（战场规则）
      combatTick();
      updateFront();
      // 镜头跟着战线走 —— 参考图那种「战线在哪镜头在哪」的观感
      const cam = engine.world.getComponent<Camera3D>('cam', 'Camera3D');
      if (cam) cam.pivotX = front * 0.6;
    }
    if (++hudTick % 15 === 0) renderHud();
    raf = requestAnimationFrame(pump);
  };
  raf = requestAnimationFrame(pump);

  return {
    destroy: () => {
      cancelAnimationFrame(raf);
      hudHandle?.();
      engine.stop?.();
      shell.destroy();
    },
  };
}
