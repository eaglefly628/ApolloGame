// game211 · 物理对决试验台（owner 2026-08-07「两个刚体空中抛掷以后对决的结果·先把表现做出来看看是不是我想要的」）。
//
// 表现验证竖切，不是战斗核：两张命牌对向抛出 → **半空相撞** → 翻滚落地 → 读朝上的面：
//   **正面（阵营色）= 活 · 反面（统一灰）= 亡**。即 game-g 的童年原型（抛牌定生死），改由真物理裁决。
// 并发压测：可切 1/3/5/10/20 组同时对决 + 实时帧耗时读数 → 回答「同场能跑多少组物理对决」。
//
// 编排现成引擎能力，**不自造 system**（同 game-d `throw3d.ts` 胶水先例）。随机走引擎种子 PRNG（禁裸 Math.random）。
// UI 走 `LayoutNode` 闭集 + `mountUI`（UI 铁律·禁手写 DOM）。
//
// ⚠ 踩过的坑（改前先读·别复踩）：
//  1. HUD 宿主别铺满 + pointer-events:none —— 那一步一旦没命中就成透明挡板，点击全被 canvas 吃掉
//     （Playwright 实证 `<canvas> intercepts pointer events`·owner 报「再抛一次没反应」）。现在贴角、自适应、自身可点。
//  2. 重掷**必须换实体 id** —— PhysicsSystem 只在 `!bodies.has(id)` 时建刚体，复用 id 会让旧刚体赖着不走、新初速不施加。
//  3. 叠加层根节点别用 `Screen` —— `Screen.bg` 缺省铺主题底色，会把 3D canvas 整块盖黑。用 bare `Panel`。
//  4. `stage` 别用 `position:absolute;inset:0` —— 容器未定位时塌成 0 高，canvas 不可见 → 渲染器不画 → 物理也不步进。
//  5. `Pivot3D` 跟不了物理 —— 它的父变换只读 Euler `rotX/rotY/rotZ`，而物理写回的是 `quat`（引擎侧口径限制·待提 P3D）。
//  6. `PhysicsWorld3D` 未登记进蓝图组件闭集 —— 只能命令式 addComponent（同上·待提 P3D）。
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import { ThreeRenderer } from '@zerocraft/engine/renderer/three-renderer.js';
import { AssetManager, ModelAssetLoader } from '@zerocraft/engine/assets/index.js';
import { nextRandom } from '@zerocraft/engine/atom-skills/index.js';
import { mountUI } from '@zerocraft/engine/ui/components/index.js';
import type { LayoutNode } from '@zerocraft/engine/ui/components/types.js';
import type { Component } from '@zerocraft/engine/engine/core/types.js';
import type { WorldBlueprint } from '@zerocraft/engine/assembly/demo.assembly.js';
import type { RandomSeed, Transform3D, Camera3D } from '@zerocraft/engine/engine/protocol/components.js';
import { GG_THEME_ONYX } from './ui-theme.js';

// 命牌 = **扑克牌矩形**（owner 2026-08-07 澄清「不是让它变成圆牌，还是跟扑克牌一样，只要求它不会立起来」）。
//   外形照旧矩形薄牌（`Mesh3D{shape:'box'}` 原生正反分色）；**立不住靠碰撞体做成「收尖的棱」**：
//   `RigidBody3D{shape:'convex'}` 喂一副**中腰最宽、两面收窄**的凸包 → 牌的四条边不是平面而是一道**脊线**。
//   平面边有支撑面 = 立着是**稳定**平衡（实测真会立·owner 目击）；脊线没有支撑面 = 不稳定，一碰就倒平。
//   ⚠ 走过的弯路：① 只把 box 调薄——薄只降低概率，方边仍是稳定平衡，躲不掉；
//                  ② 换 `cylinder` 圆盘——确实立不住，但外形成了圆牌，不是要的东西。
const CARD_W = 1.55, CARD_H = 2.15, CARD_T = 0.085;
const BEVEL_K = 0.87;  // 正/反面相对全尺寸的收窄比 → 中腰(z=0) 最宽、边缘成脊
const GRAVITY = 20;    // 重力大小（正数·算抛物线用；PhysicsWorld3D 取负）

const SIDE = ['a', 'b'] as const;
type Side = (typeof SIDE)[number];

// 配色语义（owner 2026-08-07 更正）：**正面 = 阵营色 = 活**（我方赤 / 敌方蓝）；**反面 = 双方同一个灰 = 死**。
//   （此前做反了：正面双方同金、反面才分敌我 —— 那样「谁死了」反而要靠颜色猜。死就是死，不分敌我。）
const FRONT_TINT: Record<Side, number> = { a: 0xd2453c, b: 0x3d6fd0 };
const DEATH_TINT = 0x5b6068;
const EDGE_TINT = 0x2a2e34;

/** 可切的同场对决组数（压测档·owner 2026-08-07「3 个对决、5 个对决，直到同时 20 个」）。 */
export const DUEL_COUNTS = [1, 3, 5, 10, 20] as const;

/** 一张牌的落定读数。upY=牌**正面法线**转到世界后的竖直分量（+1=正面朝上·−1=反面朝上·0=立在边上）。 */
export interface CardOutcome { side: Side; upY: number; front: boolean }
/** 一组对决的结局。 */
export interface DuelOutcome { a: CardOutcome; b: CardOutcome; verdict: string }

/** 牌面朝向 → 世界竖直分量（纯函数·可单测）：`Mesh3D{shape:'box'}` 的正面是**局部 +Z**（frontTint 即 +z 面）。
 *  把 (0,0,1) 按四元数旋转，取其**世界 Y 分量** = 旋转矩阵第三列的第二行 = `2(yz − xw)`。
 *  +1=正面朝上（活）· −1=反面朝上（死）· 0=牌立着（法线水平）。
 *  ⚠ 别写成 `1−2(x²+y²)`：那是旋转后 Z 轴的 **Z** 分量，不是 Y 分量——用它会让判词与画面对不上
 *  （实测：HUD 判「双方都反面」，画面却一灰一蓝）。圆盘版读局部 +Y 时公式是 `1−2(x²+z²)`，换成盒牌后必须跟着改。 */
export function upYOf(q: readonly number[]): number {
  const x = q[0] ?? 0, y = q[1] ?? 0, z = q[2] ?? 0, w = q[3] ?? 1;
  return 2 * (y * z - x * w);
}

/** 收尖棱凸包（纯函数·可单测）：中腰 z=0 是**全尺寸**矩形，正/反面在 ±t/2 处收窄到 k 倍
 *  → 侧面成斜坡、四边收成脊线，落不住。返回 12 个局部顶点（每角 3 个：中腰 / 正面 / 反面）。 */
export function bevelCardHull(w: number, h: number, t: number, k: number): [number, number, number][] {
  const hw = w / 2, hh = h / 2, hz = t / 2, iw = hw * k, ih = hh * k;
  const out: [number, number, number][] = [];
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, -1], [-1, 1]] as const) {
    out.push([sx * hw, sy * hh, 0], [sx * iw, sy * ih, hz], [sx * iw, sy * ih, -hz]);
  }
  return out;
}

/** 纯函数·由两张牌的正反判胜负。正面=活：都正=同生；都反=同归于尽；一正一反=正面者胜。 */
export function judgeDuel(a: CardOutcome, b: CardOutcome): string {
  if (a.front && b.front) return '双双正面 · 同生（平）';
  if (!a.front && !b.front) return '双双反面 · 同归于尽（平）';
  return a.front ? '我方正面朝上 · 胜' : '敌方正面朝上 · 负';
}

/** 多组对决 → 战况统计（纯函数·可单测）。 */
export function tallyOf(list: readonly DuelOutcome[]): { win: number; lose: number; draw: number } {
  let win = 0, lose = 0, draw = 0;
  for (const o of list) {
    if (o.a.front && !o.b.front) win += 1;
    else if (!o.a.front && o.b.front) lose += 1;
    else draw += 1;
  }
  return { win, lose, draw };
}

/** 组数 → 场地/牌尺缩放（纯函数·可单测）：组数越多，牌越小、道越密、镜头越远——把 N 组塞进同一块桌面。 */
export function layoutFor(n: number): { scale: number; laneGap: number; halfZ: number; halfX: number; camDist: number } {
  // 道间距必须 ≥ 牌的最长边（牌平躺时沿 Z 最多占 CARD_H×scale），否则相邻两道的牌会互相压到一起，
  // 20 组时全堆到场中央、看着是一坨而不是 20 组对决（实测目击）。故 laneGap = 2.5×scale（含余量）。
  const LANE_SPAN = 2.5, DEPTH_BUDGET = 14;
  const scale = Math.min(1, DEPTH_BUDGET / (LANE_SPAN * n));
  const laneGap = LANE_SPAN * scale;
  const halfZ = Math.max(3.2, (n * laneGap) / 2 + 1.2);
  const halfX = Math.max(4.2, 3.4 * scale + 2.2);
  return { scale, laneGap, halfZ, halfX, camDist: 7.2 + halfZ * 1.15 };
}

/** 静态场地蓝图（相机/光/天空/后处理·纯数据）。地台/围栏随组数重建，故不写在这。 */
function arenaBlueprint(): WorldBlueprint {
  return {
    capabilities: [],
    entities: {
      cam: { Camera3D: { yaw: 0, pitch: 0.62, distance: 9.8, mode: 'orbit', near: 0.1, far: 400, pivotX: 0, pivotY: 0.4, pivotZ: 0 } },
      sun: { Light3D: { kind: 'directional', color: 0xfff2dc, intensity: 1.7, dirX: -5, dirY: -9, dirZ: -4, castShadow: true } },
      fill: { Light3D: { kind: 'directional', color: 0x7c9cff, intensity: 0.6, dirX: 5, dirY: -3, dirZ: 5 } },
      amb: { Light3D: { kind: 'ambient', color: 0xffeede, intensity: 0.62 } },
      sky: { Sky3D: { top: 0x35507a, bottom: 0x121a2a, clouds: false, cloudTint: 0x2a3648, scroll: 0.2 } },
      post: { Post3D: { bloom: { strength: 0.3, radius: 0.7, threshold: 0.75 }, vignette: { intensity: 0.42, smoothness: 0.6 } } },
    },
  };
}

export interface DuelSpikeHandle { destroy: () => void }

/** 挂载物理对决试验台。 */
export function mountDuelSpike(container: HTMLElement, opts?: { seed?: number; onExit?: () => void }): DuelSpikeHandle {
  // 布局按 game-z 可用范式：wrapper=有真实尺寸的定位盒·stage=`position:relative` 收紧包住 canvas。
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#121a2a;overflow:hidden';
  const stage = document.createElement('div');
  stage.style.cssText = 'position:relative;line-height:0';
  wrapper.appendChild(stage);
  const uiHost = document.createElement('div'); // 见头注坑①：贴角 + 自身可点，不铺满
  uiHost.style.cssText = 'position:absolute;left:0;top:0;pointer-events:auto;z-index:3';
  wrapper.appendChild(uiHost);
  container.appendChild(wrapper);

  const w = Math.max(320, Math.min(1280, wrapper.clientWidth || 1000));
  const h = Math.max(240, Math.min(800, wrapper.clientHeight || 640));
  const assets = new AssetManager(new ModelAssetLoader());
  const engine = new Engine();
  engine.load(arenaBlueprint());
  const renderer = new ThreeRenderer({ width: w, height: h, background: 0x121a2a, assets, antialias: true, dprCap: 1.5, shadowMapSize: 1024 });
  engine.attachRenderer(renderer, stage);

  const seed0 = (opts?.seed ?? (Date.now() >>> 0)) || 1;
  engine.world.createEntity('g211-rng');
  engine.world.addComponent('g211-rng', { type: 'RandomSeed', seed: seed0, sequence: 0 } as unknown as Component);
  const rnd = (): number => { const rs = engine.world.getComponent<RandomSeed>('g211-rng', 'RandomSeed'); return rs ? nextRandom(rs) : 0.5; };
  const span = (lo: number, hi: number): number => lo + rnd() * (hi - lo);

  // 物理档（见头注坑⑥：只能命令式挂）。
  engine.world.createEntity('g211-phys');
  engine.world.addComponent('g211-phys', { type: 'PhysicsWorld3D', gravity: -GRAVITY, restitution: 0.22, friction: 0.5, solverIterations: 20 } as unknown as Component);

  let duels: number = DUEL_COUNTS[0];
  let throwNo = 0;
  let arenaIds: string[] = [];
  let cardIds: string[] = [];
  let outcomes: (DuelOutcome | null)[] = [];
  let status = '准备';

  const cardId = (lane: number, s: Side): string => `g211-card-${throwNo}-${lane}-${s}`;

  // ── 帧耗时采样（回答「同场能跑多少组」）：滚动窗口取均值 / p95 ──
  const frameMs: number[] = [];
  let lastFrame = 0;
  const perfMean = (): number => (frameMs.length ? frameMs.reduce((s2, x) => s2 + x, 0) / frameMs.length : 0);
  const perfP95 = (): number => {
    if (!frameMs.length) return 0;
    const sorted = [...frameMs].sort((x, y) => x - y);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!;
  };

  /** 地台 + 隐形围栏按当前组数重建（围栏=有 RigidBody3D 无 Mesh3D → 物理有效不渲染）。 */
  function rebuildArena(): void {
    for (const id of arenaIds) { try { engine.world.destroyEntity(id); } catch { /* 已不在 */ } }
    arenaIds = [];
    const L = layoutFor(duels);
    engine.world.createEntity('g211-ground');
    engine.world.addComponent('g211-ground', { type: 'Transform3D', x: 0, y: -0.4, z: 0 } as unknown as Component);
    // 地台必须**包住围栏**（围栏在 ±(half+1.0)）：否则落在「地台边缘～围栏」之间的牌会从桌沿掉出去（实测目击）。
    engine.world.addComponent('g211-ground', { type: 'Mesh3D', shape: 'box', width: (L.halfX + 1.4) * 2, height: 0.8, depth: (L.halfZ + 1.4) * 2, frontTint: 0x2f6b4f, edgeTint: 0x14301f } as unknown as Component);
    engine.world.addComponent('g211-ground', { type: 'RigidBody3D', shape: 'box', mass: 0 } as unknown as Component);
    arenaIds.push('g211-ground');
    const wallX = L.halfX + 1.0, wallZ = L.halfZ + 1.0;
    ([[wallX, 0], [-wallX, 0], [0, wallZ], [0, -wallZ]] as const).forEach(([dx, dz], k) => {
      const id = `g211-wall-${k}`;
      engine.world.createEntity(id);
      engine.world.addComponent(id, { type: 'Transform3D', x: dx, y: 2, z: dz } as unknown as Component);
      engine.world.addComponent(id, { type: 'RigidBody3D', shape: 'box', mass: 0 } as unknown as Component);
      arenaIds.push(id);
    });
    const cam = engine.world.getComponent<Camera3D>('cam', 'Camera3D');
    if (cam) cam.distance = L.camDist; // 组数越多镜头越远（缩小视角·把全场收进画面）
  }

  /** 抛一轮：N 组、每组两张，**同组必在半空相撞**（共用 vy 同步抛物线 + 水平速度按交汇时刻反解 + 对称 z 偏移擦碰）。 */
  function throwAll(): void {
    for (const id of cardIds) { try { engine.world.destroyEntity(id); } catch { /* 已不在 */ } }
    cardIds = [];
    throwNo += 1;                         // 见头注坑②：换 id 才会重建刚体
    prevQuat.clear(); stillSince.clear();
    outcomes = Array.from({ length: duels }, () => null);
    status = '抛掷中…';
    const L = layoutFor(duels);
    const hull = bevelCardHull(CARD_W * L.scale, CARD_H * L.scale, CARD_T * L.scale, BEVEL_K);
    const throwX = 1.7 * L.scale + 0.9;
    for (let lane = 0; lane < duels; lane++) {
      const laneZ = (lane - (duels - 1) / 2) * L.laneGap;
      const vy = span(8.0, 9.2);
      const tMeet = (vy / GRAVITY) * span(0.72, 0.94); // 交汇略早于最高点（上升段相撞·看得清）
      const vxMag = throwX / tMeet;
      for (const s of SIDE) {
        const id = cardId(lane, s);
        const dir = s === 'a' ? 1 : -1;
        const zOff = dir * span(0.16, 0.30) * L.scale;  // 擦碰（非心对心）→ 撞完横向分离·不叠成一摞
        engine.world.createEntity(id);
        engine.world.addComponent(id, { type: 'Transform3D', x: -dir * throwX, y: 0.9, z: laneZ + zOff } as unknown as Component);
        engine.world.addComponent(id, {
          type: 'Mesh3D', shape: 'box', width: CARD_W * L.scale, height: CARD_H * L.scale, depth: CARD_T * L.scale,
          frontTint: FRONT_TINT[s],  // 正面 = 阵营色 = 活
          backTint: DEATH_TINT,      // 反面 = 统一灰 = 死
          edgeTint: EDGE_TINT,
        } as unknown as Component);
        engine.world.addComponent(id, {
          type: 'RigidBody3D', shape: 'convex', hull, mass: 1.0, restitution: 0.24, friction: 0.5,
          vx: dir * vxMag, vy, vz: -dir * span(0.4, 0.9),
          avx: span(-16, 16), avy: span(-16, 16), avz: span(-7, 7), // 绕 X/Y 狂翻 → 正反才有悬念（绕 Z 只是自转不换面）
        } as unknown as Component);
        cardIds.push(id);
      }
    }
    renderUI();
  }

  /** 一组落定 → 读两张牌的正反、出判词。 */
  function settleLane(lane: number): void {
    if (outcomes[lane]) return;
    const read = (s: Side): CardOutcome => {
      const t = engine.world.getComponent<Transform3D>(cardId(lane, s), 'Transform3D');
      const upY = upYOf(t?.quat ?? [0, 0, 0, 1]);
      return { side: s, upY, front: upY > 0 };
    };
    const a = read('a'), b = read('b');
    outcomes[lane] = { a, b, verdict: judgeDuel(a, b) };
    const done = outcomes.filter(Boolean).length;
    status = done === duels ? '全部落定' : `落定 ${done}/${duels}`;
    if (done === duels) {
      const t = tallyOf(outcomes.filter(Boolean) as DuelOutcome[]);
      console.info('[game211/duel-spike] 第%d 轮 · %d 组 → 胜%d 负%d 平%d · 帧 %sms(p95 %sms)', throwNo, duels, t.win, t.lose, t.draw, perfMean().toFixed(1), perfP95().toFixed(1));
    }
    renderUI();
  }

  // ── 落定判定：四元数静止轮询（settleSignal 在薄牌贴地微抖时不可靠·阈值是引擎侧常量改不了）──
  const STILL_EPS = 0.004, STILL_MS = 380;
  const prevQuat = new Map<string, readonly number[]>();
  const stillSince = new Map<string, number>();
  function pollStill(nowMs: number): void {
    for (let lane = 0; lane < duels; lane++) {
      if (outcomes[lane]) continue;
      let bothStill = true;
      for (const s of SIDE) {
        const id = cardId(lane, s);
        const q = engine.world.getComponent<Transform3D>(id, 'Transform3D')?.quat;
        if (!q) { bothStill = false; continue; }
        const p = prevQuat.get(id);
        const moved = !p || q.some((v, i) => Math.abs(v - (p[i] ?? 0)) > STILL_EPS);
        prevQuat.set(id, [...q]);
        if (moved) { stillSince.set(id, nowMs); bothStill = false; continue; }
        if (nowMs - (stillSince.get(id) ?? nowMs) < STILL_MS) bothStill = false;
      }
      if (bothStill) settleLane(lane);
    }
  }

  // ── HUD（LayoutNode 闭集·根用 bare Panel·见头注坑③）──
  const faceTxt = (c: CardOutcome | undefined): string => (c ? (c.front ? '正面 · 活' : '反面 · 亡') : '—');
  function tree(): LayoutNode {
    const done = outcomes.filter(Boolean) as DuelOutcome[];
    const t = tallyOf(done);
    const p95 = perfP95();
    const rows: LayoutNode[] = [
      { type: 'Label', id: 'dsp-title', props: { text: '物理对决试验台 · 抛掷定生死', size: 'lg', color: 'gold' }, layout: {} },
      { type: 'Label', id: 'dsp-status', props: { text: `第 ${throwNo} 轮 · ${duels} 组同时对决 · ${status}`, size: 'sm', color: 'dim' }, layout: {} },
      { type: 'Label', id: 'dsp-perf', props: { text: `帧 ${perfMean().toFixed(1)}ms · p95 ${p95.toFixed(1)}ms · 刚体 ${duels * 2}`, size: 'sm', color: p95 > 16.7 ? 'danger' : p95 > 11 ? 'warn' : 'ok' }, layout: {} },
    ];
    if (duels === 1) {
      rows.push(
        { type: 'Label', id: 'dsp-a', props: { text: `我方（赤）：${faceTxt(done[0]?.a)}`, size: 'md' }, layout: {} },
        { type: 'Label', id: 'dsp-b', props: { text: `敌方（蓝）：${faceTxt(done[0]?.b)}`, size: 'md' }, layout: {} },
      );
      if (done[0]) rows.push({ type: 'Label', id: 'dsp-verdict', props: { text: done[0].verdict, size: 'lg', color: 'gold' }, layout: {} });
    } else {
      rows.push({ type: 'Label', id: 'dsp-tally', props: { text: `战况：我方胜 ${t.win} · 负 ${t.lose} · 平 ${t.draw}`, size: 'md', color: 'gold' }, layout: {} });
    }
    rows.push(
      { type: 'Button', id: 'dsp-throw', props: { label: throwNo === 0 ? '抛掷' : '再抛一次', action: 'throw', kind: 'hero' }, layout: {} },
      { type: 'Label', id: 'dsp-count-t', props: { text: '同时对决组数（压测）', size: 'sm', color: 'dim' }, layout: {} },
      // 一排直接跳档（不是循环切换）：既省得连点五次才到 20，也让每颗按钮有唯一短标签、自动化点得准。
      { type: 'Panel', id: 'dsp-count-row', props: { bare: true }, layout: { direction: 'row', gap: 6, padding: 0 },
        children: DUEL_COUNTS.map((n) => ({
          type: 'Button', id: `dsp-n${n}`,
          props: { label: `${n}组`, action: 'count', actionArg: String(n), kind: n === duels ? 'primary' : 'quiet' },
          layout: {},
        })) },
    );
    if (opts?.onExit) rows.push({ type: 'Button', id: 'dsp-exit', props: { label: '← 返回大厅', kind: 'ghost', action: 'exit' }, layout: {} });
    return { type: 'Panel', id: 'dsp-panel', props: {}, layout: { x: 18, y: 14, direction: 'column', gap: 8, padding: 14, width: 300 }, children: rows };
  }
  let uiTeardown: (() => void) | null = null;
  function renderUI(): void {
    uiTeardown?.();
    uiTeardown = mountUI(uiHost, tree(), {
      throw: () => throwAll(),
      count: (arg) => { const n = Number(arg); if (!Number.isFinite(n) || n === duels) return; duels = n; frameMs.length = 0; rebuildArena(); throwAll(); },
      exit: () => opts?.onExit?.(),
    }, GG_THEME_ONYX);
  }

  engine.start();
  let raf = 0;
  const pump = (): void => {
    const now = performance.now();
    if (lastFrame) { frameMs.push(now - lastFrame); if (frameMs.length > 150) frameMs.shift(); }
    lastFrame = now;
    pollStill(now);
    raf = requestAnimationFrame(pump);
  };
  raf = requestAnimationFrame(pump);

  const onResize = (): void => renderer.resize(Math.max(320, Math.min(1280, wrapper.clientWidth || w)), Math.max(240, Math.min(800, wrapper.clientHeight || h)));
  window.addEventListener('resize', onResize);

  rebuildArena();
  renderUI();
  throwAll(); // 进来就抛一轮（owner 要「先看到表现」·不用先点）

  return {
    destroy: (): void => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      uiTeardown?.();
      engine.stop();
      wrapper.remove();
    },
  };
}
