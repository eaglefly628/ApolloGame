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
import { nextRandom } from '@zerocraft/engine/atom-skills/index.js';
import { mountUI } from '@zerocraft/engine/ui/components/index.js';
import type { LayoutNode } from '@zerocraft/engine/ui/components/types.js';
import type { Component } from '@zerocraft/engine/engine/core/types.js';
import type { WorldBlueprint } from '@zerocraft/engine/assembly/demo.assembly.js';
import type { RandomSeed, Transform3D } from '@zerocraft/engine/engine/protocol/components.js';
import { GG_THEME_ONYX } from './ui-theme.js';

// ── 场地常量（世界单位）──
// 命符 = **圆牌**（owner 2026-08-07「一圈是个圆的·边缘圆弧·不可能站立·再薄一点」）：
//   物理体 = `cylinder`（圆柱侧面是连续曲面 → 立在边上是**不稳定平衡**，落不住）；厚度压薄进一步杜绝。
//   ⚠ 旧版是 `box` 薄板：方边有 4 条稳定棱，实测真会立着落地（owner 目击）——方盒立边是**稳定**平衡，必须换形状，调参数没用。
const DISC_D = 1.9;   // 圆牌直径
const DISC_T = 0.085; // 圆牌厚度（薄·越薄越立不住）
const ARENA = 5.2;    // 围栏半径（隐形墙内壁·收住不飞出画面）
const THROW_X = 2.6;  // 两张牌的出手点（对向）
const GRAVITY = 20;   // 物理档重力大小（正数·算抛物线用；PhysicsWorld3D 里取负）
const SIDE = ['a', 'b'] as const;
type Side = (typeof SIDE)[number];

/** 一张牌的落定读数。upY=牌**局部 +Y 轴**转到世界后的 y 分量（+1=正面完全朝上·−1=完全朝下）；front=正面朝上（活）。 */
export interface CardOutcome { side: Side; upY: number; front: boolean }
/** 一场对决的结局：双方读数 + 判词。 */
export interface DuelOutcome { a: CardOutcome; b: CardOutcome; verdict: string }

/** 圆牌朝向 → 世界 Y 分量（纯函数·可单测）：把局部 +Y=(0,1,0) 按四元数旋转，取 y 分量 = 1−2(x²+z²)。
 *  圆盘只有两个稳定落定态（正面朝上 / 反面朝上）→ 用它判正反，比 6 面骰的 upFaceIndex 贴切。 */
export function upYOf(q: readonly number[]): number {
  const x = q[0] ?? 0, z = q[2] ?? 0;
  return 1 - 2 * (x * x + z * z);
}

/** 把局部偏移 (0,−d,0) 按四元数 q 旋到世界（纯函数·可单测）。反面片贴在正面片下方、随牌一起翻，用它算位置。
 *  用的是标准 v' = v + 2·qw·(q.xyz×v) + 2·q.xyz×(q.xyz×v)，对 v=(0,−d,0) 展开后的闭式（零 trig·省得每帧建四元数对象）。 */
export function offsetUnder(q: readonly number[], d: number): [number, number, number] {
  const x = q[0] ?? 0, y = q[1] ?? 0, z = q[2] ?? 0, w = q[3] ?? 1;
  return [2 * d * (w * z - x * y), -d + 2 * d * (x * x + z * z), -2 * d * (w * x + y * z)];
}

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
  // HUD 宿主**不铺满**：铺满 + pointer-events:none 时，一旦「只给面板开 auto」那一步没命中（选择器/时序任一出错），
  // 整层就变成透明挡板，点击全被下面的 canvas 吃掉 —— 实测就是这样：owner 点「再抛一次」毫无反应，
  // Playwright 报 `<canvas> intercepts pointer events`。改成**贴左上角、按内容自适应、自身可点**，
  // 既不覆盖画面其余部分，也不依赖任何运行时补救。
  const uiHost = document.createElement('div');
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
  engine.world.addComponent('g211-phys', { type: 'PhysicsWorld3D', gravity: -GRAVITY, restitution: 0.22, friction: 0.5, solverIterations: 20 } as unknown as Component);

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

  // ⚠ 实体 id **每次抛掷都换**（`-<throwNo>` 后缀）——PhysicsSystem 只在 `!bodies.has(id)` 时建刚体，
  //   复用同一 id 会让旧刚体（已静止）赖着不走、新初速根本不施加 = 「再抛一次」点了没反应（owner 目击的 bug）。
  let liveIds: string[] = [];
  const cardId = (s: Side): string => `g211-card-${s}-${throwNo}`;
  const backId = (s: Side): string => `g211-card-${s}-${throwNo}-back`;

  /** 抛一次：建两枚圆牌，**对向抛出并保证在半空撞上**。参数全取自种子 PRNG。 */
  function throwOnce(): void {
    for (const id of liveIds) { try { engine.world.destroyEntity(id); } catch { /* 已不在 */ } } // 清上一把（含背面片）
    liveIds = [];
    throwNo += 1;
    settled = new Set();
    prevQuat.clear(); stillSince.clear();
    outcome = null;
    status = '抛掷中…';
    // 空中必相撞（owner 2026-08-07「两个牌在空中要能碰到·产生随机物理碰撞」）：
    //   两枚**同时**出手、用**同一个** vy → 抛物线同步；水平速度按「到达中线所需时间 = 升到交汇点的时间」反解，
    //   于是它们必在中线上方 x≈0 处相遇。**别让 vx/vy 各自乱取**——那样一个先落地、一个还在飞，永远碰不上（旧版就是这样）。
    const vy = span(8.2, 9.4);                       // 共用初速（决定滞空与交汇高度）
    const tMeet = (vy / GRAVITY) * span(0.72, 0.94); // 交汇时刻：略早于最高点（上升段相撞·看得清）
    const vxMag = THROW_X / tMeet;                   // 水平速度反解 → t=tMeet 时两枚同抵 x=0
    for (const s of SIDE) {
      const id = cardId(s), bid = backId(s);
      const dir = s === 'a' ? 1 : -1;                // a 从左抛向右·b 从右抛向左
      // **擦碰**而非正面对撞：给两枚对称的 z 偏移（半径 0.95·偏移 ~0.3 → 必相交但不是心对心）。
      // 正面对撞（z 都≈0）会让两枚在中线原地叠成一摞——既读不出正反、上面那枚还一直晃着不落定（实测目击）。
      // 擦碰则把动量转成横向分离 + 随机自旋 = owner 要的「随机物理碰撞」，且撞完各自弹开、好读。
      const zJit = dir * span(0.26, 0.42);
      engine.world.createEntity(id);
      engine.world.addComponent(id, { type: 'Transform3D', x: -dir * THROW_X, y: 0.9, z: zJit } as unknown as Component);
      // 正面 = 亮金（活）。圆柱图元是单材质 → 正反分色靠下面那片子实体（Pivot3D 合成）。
      engine.world.addComponent(id, { type: 'Mesh3D', shape: 'cylinder', width: DISC_D, height: DISC_T, frontTint: 0xffd86b } as unknown as Component);
      // 反面片：同径薄圆盘贴在正面片下方，逐帧跟随父体位姿（见 syncBacks）→ 翻过来看到的就是深色反面（我方暗红 / 敌方暗蓝）。
      // ⚠ 不能用 `Pivot3D`：它的父变换只读 Euler `rotX/rotY/rotZ`，而物理写回的是 `quat` → 子片永远不跟着转
      //   （实测：牌判定为反面、画面却仍是金色正面）。这是引擎侧口径限制（P3D 域·已记 requests-3d）。
      engine.world.createEntity(bid);
      engine.world.addComponent(bid, { type: 'Transform3D', x: 0, y: -DISC_T * 0.62, z: 0 } as unknown as Component);
      engine.world.addComponent(bid, { type: 'Mesh3D', shape: 'cylinder', width: DISC_D * 0.995, height: DISC_T * 0.55, frontTint: s === 'a' ? 0x8c2018 : 0x1b2f6b } as unknown as Component);
      engine.world.addComponent(id, {
        type: 'RigidBody3D', shape: 'cylinder', mass: 1.0, restitution: 0.24, friction: 0.5,
        vx: dir * vxMag, vy, vz: -dir * span(0.5, 1.1),                          // 对向 + 抛高（同 vy → 同步抛物线）· vz 让两枚交错穿过而非顶牛
        avx: span(-17, 17), avy: span(-7, 7), avz: span(-17, 17),                // 狂翻 → 正反面才有悬念
        settleSignal: `duel-settle-${s}`,
      } as unknown as Component);
      liveIds.push(id, bid);
    }
    renderUI();
  }

  /** 落定读数：quat → 局部+Y 的世界 y 分量 → 正/反。两张都落定即出判词。 */
  function readSettled(side: Side): void {
    if (settled.has(side)) return;
    settled.add(side);
    if (settled.size < SIDE.length) { status = `${side === 'a' ? '我方' : '敌方'}已落定…`; renderUI(); return; }
    const read = (s: Side): CardOutcome => {
      const t = engine.world.getComponent<Transform3D>(cardId(s), 'Transform3D');
      const q = t?.quat ?? [0, 0, 0, 1];
      const upY = upYOf(q);
      return { side: s, upY, front: upY > 0 };
    };
    const a = read('a'), b = read('b');
    outcome = { a, b, verdict: judgeDuel(a, b) };
    status = '落定';
    opts?.onOutcome?.(outcome);
    console.info('[game211/duel-spike] 第%d 掷 · 我方 upY=%s(%s) 敌方 upY=%s(%s) → %s', throwNo, a.upY.toFixed(2), a.front ? '正' : '反', b.upY.toFixed(2), b.front ? '正' : '反', outcome.verdict);
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
    uiTeardown?.();
    uiTeardown = mountUI(uiHost, tree(), { throw: () => throwOnce(), exit: () => opts?.onExit?.() }, GG_THEME_ONYX);
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

  /** 反面片跟随：把父牌的 quat 原样抄给子片，位置 = 父位 + 「局部正下方 DISC_T*0.62」旋到世界。
   *  纯表现胶水（同 game-d Throw3D 范式·不自造 system·不进 hash）。 */
  function syncBacks(): void {
    for (const s2 of SIDE) {
      const pt = engine.world.getComponent<Transform3D>(cardId(s2), 'Transform3D');
      const bt = engine.world.getComponent<Transform3D>(backId(s2), 'Transform3D');
      if (!pt || !bt) continue;
      const q = pt.quat ?? [0, 0, 0, 1];
      const [ox, oy, oz] = offsetUnder(q, DISC_T * 0.62);
      bt.x = pt.x + ox; bt.y = pt.y + oy; bt.z = pt.z + oz; bt.quat = [...q] as [number, number, number, number];
    }
  }

  engine.start();
  let raf = 0;
  const pump = (): void => {
    for (const sig of renderer.drainPhysicsSignals()) {
      const side = sig.signal === 'duel-settle-a' ? 'a' : sig.signal === 'duel-settle-b' ? 'b' : null;
      if (side) readSettled(side);
    }
    syncBacks();
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
