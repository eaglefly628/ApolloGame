// game211 · 物理对决试验台（owner 2026-08-07「两个刚体空中抛掷以后对决的结果·先把表现做出来看看是不是我想要的」）。
//
// 这是**表现验证竖切**，不是战斗核：两张「命牌」被抛向空中 → 空中相撞 → 翻滚落地 → 落定读朝上的面
//   → **正面朝上 = 活/胜 · 反面朝上 = 亡/负**。这正是 game-g 的童年原型（抛牌·正面活反面死），只是这次由**真物理**裁决。
//
// 编排现成引擎能力，**不自造 system**（同 game-d `throw3d.ts` 胶水先例）：
//   ① 牌 = `RigidBody3D{shape:'box'}` + `Mesh3D{shape:'box',frontTint/backTint}` + `Transform3D`；
//   ② 抛掷 = 初速 `vx/vy/vz` + 初角速度 `avx/avy/avz`（两张对向抛出→空中必相撞）；
//   ③ cannon-es 把它抛落翻滚（渲染器 PhysicsSystem·render-only·懒加载）；
//   ④ 落定 = `RigidBody3D.settleSignal` → `ThreeRenderer.drainPhysicsSignals()`（**本仓首个消费者**·顺带验证这条信号通路真能用）；
//   ⑤ 读数 = `upFaceIndex(quat)`（面序 [+X,-X,+Y,-Y,+Z,-Z]）→ 牌正面是 +Z（`Mesh3D.frontTint` 即 +z 面）→ **index 4 = 正面朝上**。
//
// 随机 = 引擎种子 PRNG（`RandomSeed`+`nextRandom`·**禁裸 Math.random**·红线）。同种子 → 同抛掷参数 → cannon 同 build 下同落点，
//   故这个试验台是**可复现**的（掷出好看的一把可以记下种子重放）。⚠ 但物理结果本身仍 render-only、不进 hash（B 线既定代价）。
//
// UI 走 `LayoutNode` 闭集 + `mountUI`（UI 铁律·禁手写 DOM）。
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import { ThreeRenderer } from '@zerocraft/engine/renderer/three-renderer.js';
import { AssetManager, ModelAssetLoader } from '@zerocraft/engine/assets/index.js';
import { upFaceIndex } from '@zerocraft/engine/renderer/three/dice.js';
import { nextRandom } from '@zerocraft/engine/atom-skills/index.js';
import { mountUI } from '@zerocraft/engine/ui/components/index.js';
import type { LayoutNode } from '@zerocraft/engine/ui/components/types.js';
import type { Component } from '@zerocraft/engine/engine/core/types.js';
import type { WorldBlueprint } from '@zerocraft/engine/assembly/demo.assembly.js';
import type { RandomSeed, Transform3D } from '@zerocraft/engine/engine/protocol/components.js';
import { GG_THEME_ONYX } from './ui-theme.js';

// ── 场地常量（世界单位）──
const CARD_W = 1.5, CARD_H = 2.1, CARD_D = 0.16; // 命牌尺寸（薄板·像张牌）
const ARENA = 5.2;   // 围栏半径（隐形墙内壁·收住不飞出画面）
const THROW_X = 2.6; // 两张牌的出手点（对向）

const FACE_FRONT = 4; // upFaceIndex 面序 [+X,-X,+Y,-Y,+Z,-Z] → +Z = Mesh3D 正面
const SIDE = ['a', 'b'] as const;
type Side = (typeof SIDE)[number];

/** 一张牌的落定读数。face=upFaceIndex 结果；front=是否正面朝上（活）。 */
export interface CardOutcome { side: Side; face: number; front: boolean }
/** 一场对决的结局：双方读数 + 判词。 */
export interface DuelOutcome { a: CardOutcome; b: CardOutcome; verdict: string }

/** 纯函数·由两张牌的朝上面判胜负（可单测·与表现解耦）。
 *  正面=活：两张都正面 → 平（同生）；都反面 → 平（同归于尽）；一正一反 → 正面者胜。 */
export function judgeDuel(a: CardOutcome, b: CardOutcome): string {
  if (a.front && b.front) return '双双正面 · 同生（平）';
  if (!a.front && !b.front) return '双双反面 · 同归于尽（平）';
  return a.front ? '我方正面朝上 · 胜' : '敌方正面朝上 · 负';
}

/** 静态场地蓝图（相机/光/天空/后处理/物理档·纯数据）。牌与围栏在 mount 里按次建（每次重掷重置）。 */
function arenaBlueprint(): WorldBlueprint {
  return {
    capabilities: [],
    entities: {
      // 斜俯视轨道机位：看得见牌在空中翻，也看得见落地那一刻的正反面。
      cam: { Camera3D: { yaw: 0, pitch: 0.52, distance: 8.6, mode: 'orbit', near: 0.1, far: 300, pivotX: 0, pivotY: 0.8, pivotZ: 0 } },
      sun: { Light3D: { kind: 'directional', color: 0xfff2dc, intensity: 1.7, dirX: -5, dirY: -9, dirZ: -4, castShadow: true } },
      fill: { Light3D: { kind: 'directional', color: 0x7c9cff, intensity: 0.6, dirX: 5, dirY: -3, dirZ: 5 } },
      amb: { Light3D: { kind: 'ambient', color: 0xffeede, intensity: 0.62 } },
      sky: { Sky3D: { top: 0x35507a, bottom: 0x121a2a, clouds: false, cloudTint: 0x2a3648, scroll: 0.2 } },
      post: { Post3D: { bloom: { strength: 0.34, radius: 0.7, threshold: 0.72 }, vignette: { intensity: 0.42, smoothness: 0.6 } } },
      // 地台：静态刚体（mass 0）+ 可见网格。
      ground: {
        Transform3D: { x: 0, y: -0.4, z: 0 },
        Mesh3D: { shape: 'box', width: ARENA * 2.2, height: 0.8, depth: ARENA * 2.2, frontTint: 0x2f6b4f, edgeTint: 0x14301f },
        RigidBody3D: { shape: 'box', mass: 0 },
      },
    },
  };
}

export interface DuelSpikeHandle { destroy: () => void }

/** 挂载物理对决试验台。onOutcome=每次落定后回调（供上层记录/展示）。 */
export function mountDuelSpike(container: HTMLElement, opts?: { seed?: number; onOutcome?: (o: DuelOutcome) => void; onExit?: () => void }): DuelSpikeHandle {
  // 布局按 game-z 可用范式：wrapper=有真实尺寸的定位盒·stage=`position:relative` 收紧包住 canvas。
  // ⚠ 别用 `position:absolute;inset:0` 当 stage——容器未定位时它塌成 0 高，canvas 不可见 → 渲染器不画 → 物理也不步进（本竖切踩过）。
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#121a2a;overflow:hidden';
  const stage = document.createElement('div');
  stage.style.cssText = 'position:relative;line-height:0';
  wrapper.appendChild(stage);
  const uiHost = document.createElement('div');
  uiHost.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  wrapper.appendChild(uiHost);
  container.appendChild(wrapper);

  const w = Math.max(320, Math.min(1280, wrapper.clientWidth || 1000));
  const h = Math.max(240, Math.min(800, wrapper.clientHeight || 640));
  const assets = new AssetManager(new ModelAssetLoader());
  const engine = new Engine();
  engine.load(arenaBlueprint());
  const renderer = new ThreeRenderer({ width: w, height: h, background: 0x121a2a, assets, antialias: true, dprCap: 1.5, shadowMapSize: 1024 });
  engine.attachRenderer(renderer, stage);

  // 种子 PRNG（禁裸 Math.random·红线）。缺省从时钟取一次熵播种；传 seed 则完全可复现。
  const seed0 = (opts?.seed ?? (Date.now() >>> 0)) || 1;
  engine.world.createEntity('g211-rng');
  engine.world.addComponent('g211-rng', { type: 'RandomSeed', seed: seed0, sequence: 0 } as unknown as Component);
  const rnd = (): number => { const rs = engine.world.getComponent<RandomSeed>('g211-rng', 'RandomSeed'); return rs ? nextRandom(rs) : 0.5; };
  const span = (lo: number, hi: number): number => lo + rnd() * (hi - lo);

  // 物理档：牌要「翻得起来、落得干脆、不弹个没完」→ 比掷骰档温和的重力 + 低弹性（3d.md 物理世界配置）。
  // ⚠ `PhysicsWorld3D` **未登记进 `src/assembly/component-map.ts` 的蓝图组件闭集** → 蓝图里写不了，只能命令式挂
  //   （渲染器直接 world.query 读得到，功能正常）。这是 3d.md 文档与闭集登记的一处不一致，已记 requests-3d 待 P3D 补登记。
  engine.world.createEntity('g211-phys');
  engine.world.addComponent('g211-phys', { type: 'PhysicsWorld3D', gravity: -22, restitution: 0.22, friction: 0.5, solverIterations: 20 } as unknown as Component);

  // 隐形围栏：有 RigidBody3D 无 Mesh3D = 物理有效但不渲染（3d.md「无 Mesh3D 的 RigidBody3D=隐形墙」·同 game-d 掷骰盒）。
  ([[ARENA, 0], [-ARENA, 0], [0, ARENA], [0, -ARENA]] as const).forEach(([dx, dz], k) => {
    const id = `g211-wall-${k}`;
    engine.world.createEntity(id);
    engine.world.addComponent(id, { type: 'Transform3D', x: dx, y: 2, z: dz } as unknown as Component);
    engine.world.addComponent(id, { type: 'RigidBody3D', shape: 'box', mass: 0 } as unknown as Component);
  });

  let throwNo = 0;
  let settled = new Set<string>();
  let outcome: DuelOutcome | null = null;
  let status = '按「抛掷」开始';

  const cardId = (s: Side): string => `g211-card-${s}`;

  /** 抛一次：重建两张牌（对向抛出·空中相撞）。参数全取自种子 PRNG。 */
  function throwOnce(): void {
    throwNo += 1;
    settled = new Set();
    prevQuat.clear(); stillSince.clear();
    outcome = null;
    status = '抛掷中…';
    for (const s of SIDE) {
      const id = cardId(s);
      try { engine.world.destroyEntity(id); } catch { /* 首次无此实体 */ }
      const dir = s === 'a' ? 1 : -1;           // a 从左抛向右·b 从右抛向左 → 空中对撞
      engine.world.createEntity(id);
      engine.world.addComponent(id, { type: 'Transform3D', x: -dir * THROW_X, y: span(0.9, 1.4), z: span(-0.5, 0.5) } as unknown as Component);
      engine.world.addComponent(id, {
        type: 'Mesh3D', shape: 'box', width: CARD_W, height: CARD_H, depth: CARD_D,
        frontTint: 0xffd86b,                          // 正面 = 亮金牌面（活）——两方同色：定生死的是正反，不是敌我
        backTint: s === 'a' ? 0x5e1512 : 0x101c3e,    // 反面 = 深底（亡）·我方暗红 / 敌方暗蓝（同时分敌我）
        edgeTint: s === 'a' ? 0x8c3b2f : 0x2f4a8c,    // 侧边同阵营色 → 立着/半翻时也认得出是谁的牌
      } as unknown as Component);
      engine.world.addComponent(id, {
        type: 'RigidBody3D', shape: 'box', mass: 1.1, restitution: 0.2, friction: 0.5,
        vx: dir * span(3.4, 4.6), vy: span(7.2, 8.8), vz: span(-0.8, 0.8),            // 抛向对面 + 抛高
        avx: span(-14, 14), avy: span(-9, 9), avz: span(-14, 14),                      // 翻滚（正反面才有悬念）
        settleSignal: `duel-settle-${s}`,                                              // 落定信号（本仓首个消费者）
      } as unknown as Component);
    }
    renderUI();
  }

  /** 落定读数：quat → upFaceIndex → 正/反。两张都落定即出判词。 */
  function readSettled(side: Side): void {
    if (settled.has(side)) return;
    settled.add(side);
    if (settled.size < SIDE.length) { status = `${side === 'a' ? '我方' : '敌方'}已落定…`; renderUI(); return; }
    const read = (s: Side): CardOutcome => {
      const t = engine.world.getComponent<Transform3D>(cardId(s), 'Transform3D');
      const q = (t?.quat ?? [0, 0, 0, 1]) as [number, number, number, number];
      const face = upFaceIndex(q);
      return { side: s, face, front: face === FACE_FRONT };
    };
    const a = read('a'), b = read('b');
    outcome = { a, b, verdict: judgeDuel(a, b) };
    status = '落定';
    opts?.onOutcome?.(outcome);
    console.info('[game211/duel-spike] 第%d 掷 · 我方面=%d(%s) 敌方面=%d(%s) → %s', throwNo, a.face, a.front ? '正' : '反', b.face, b.front ? '正' : '反', outcome.verdict);
    renderUI();
  }

  // ── HUD（LayoutNode 闭集·UI 铁律）──
  const faceTxt = (c: CardOutcome | undefined): string => (c ? (c.front ? '正面 · 活' : '反面 · 亡') : '—');
  function tree(): LayoutNode {
    const rows: LayoutNode[] = [
      { type: 'Label', id: 'dsp-title', props: { text: '物理对决试验台 · 抛掷定生死', size: 'lg', color: 'gold' }, layout: {} },
      { type: 'Label', id: 'dsp-status', props: { text: `第 ${throwNo} 掷 · ${status}`, size: 'sm', color: 'dim' }, layout: {} },
      { type: 'Label', id: 'dsp-a', props: { text: `我方：${faceTxt(outcome?.a)}`, size: 'md' }, layout: {} },
      { type: 'Label', id: 'dsp-b', props: { text: `敌方：${faceTxt(outcome?.b)}`, size: 'md' }, layout: {} },
    ];
    if (outcome) rows.push({ type: 'Label', id: 'dsp-verdict', props: { text: outcome.verdict, size: 'lg', color: 'gold' }, layout: {} });
    rows.push({ type: 'Button', id: 'dsp-throw', props: { label: throwNo === 0 ? '抛掷' : '再抛一次', action: 'throw', kind: 'hero' }, layout: {} });
    // 返回键收进本面板（别另开叠层：右上角会被启动器齿轮压住·实测撞过）。
    if (opts?.onExit) rows.push({ type: 'Button', id: 'dsp-exit', props: { label: '← 返回大厅', kind: 'ghost', action: 'exit' }, layout: {} });
    // ⚠ 叠加层的根**必须**是 bare Panel，不能是 `Screen`——Screen.bg 缺省铺主题 pageBg，会把底下的 3D canvas 整块盖黑
    //   （本竖切踩过：canvas 在、相机对、网格在，却全黑）。同 game-z `gz-hud` 范式。
    return { type: 'Panel', id: 'dsp-panel', props: {}, layout: { x: 18, y: 14, direction: 'column', gap: 8, padding: 14, width: 300 }, children: rows };
  }
  let uiTeardown: (() => void) | null = null;
  function renderUI(): void {
    uiHost.style.pointerEvents = 'none';
    uiTeardown?.();
    uiTeardown = mountUI(uiHost, tree(), { throw: () => throwOnce(), exit: () => opts?.onExit?.() }, GG_THEME_ONYX);
    // 面板本身要能点（宿主层透传·只让控件收事件）。
    const panel = uiHost.querySelector('[data-ui-id="dsp-panel"]') as HTMLElement | null;
    if (panel) panel.style.pointerEvents = 'auto';
  }

  // ── 驱动：引擎跑起来 + 每帧判落定 ──
  // 落定判定走**双保险**：
  //   ① `RigidBody3D.settleSignal`（入睡沿·引擎现成出口·便宜）；
  //   ② **四元数静止轮询兜底**（同 game-d `Throw3D` 先例）——实测本竖切里 ①（入睡）在牌看着已静止时仍迟迟不来，
  //      薄板牌贴地微抖达不到 cannon 的 sleepSpeedLimit，而那两个阈值是引擎侧常量（P3D 域·游戏层改不了）。
  //      故以 ② 为主判、① 为加速：谁先到算谁。别只押 ①，否则「牌停了但判词永远不出」。
  const STILL_EPS = 0.004;   // 四元数逐分量变化阈值（低于即视作没动）
  const STILL_MS = 420;      // 连续静止多久算落定
  const prevQuat = new Map<Side, readonly number[]>();
  const stillSince = new Map<Side, number>();
  function pollStill(nowMs: number): void {
    for (const s of SIDE) {
      if (settled.has(s)) continue;
      const t = engine.world.getComponent<Transform3D>(cardId(s), 'Transform3D');
      const q = t?.quat;
      if (!q) continue;
      const p = prevQuat.get(s);
      const moved = !p || q.some((v, i) => Math.abs(v - (p[i] ?? 0)) > STILL_EPS);
      prevQuat.set(s, [...q]);
      if (moved) { stillSince.set(s, nowMs); continue; }
      const since = stillSince.get(s) ?? nowMs;
      if (nowMs - since >= STILL_MS) readSettled(s);
    }
  }

  engine.start();
  let raf = 0;
  const pump = (): void => {
    for (const sig of renderer.drainPhysicsSignals()) {
      const side = sig.signal === 'duel-settle-a' ? 'a' : sig.signal === 'duel-settle-b' ? 'b' : null;
      if (side) readSettled(side);
    }
    pollStill(performance.now());
    raf = requestAnimationFrame(pump);
  };
  raf = requestAnimationFrame(pump);

  const onResize = (): void => renderer.resize(Math.max(320, Math.min(1280, wrapper.clientWidth || w)), Math.max(240, Math.min(800, wrapper.clientHeight || h)));
  window.addEventListener('resize', onResize);

  renderUI();
  throwOnce(); // 进来就抛一把（owner 要「先看到表现」·不用先点）

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
