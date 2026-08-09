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
//   外形矩形薄牌 + **永不立起**，靠 P3D 落地的 `Mesh3D.faceAxis`（REQ-3D-CARD-FACE-AXIS·A 解）解锁：
//   牌**沿 Y 薄**（`faceAxis:'y'` → frontTint/backTint 落顶/底两面·edgeTint 落四侧），于是
//   碰撞体可以直接用**引擎原生 `cylinder`**（轴 Y 的薄圆盘·与牌面同轴）——圆盘侧面是连续曲面，立不住。
//   ⚠ 走过的弯路（别回头）：① box 调薄——方边是**稳定**平衡，抛多了必立；② 收尖棱/收尖圆盘**凸包**——
//   cannon 对长径比 26:1 的薄凸多面体有接触伪影，实测恒斜 ~55°（upY −0.53/+0.47 三连测）；
//   ③ 把牌做成圆盘 mesh——立不住但外形不是扑克牌，owner 否决。原生 cylinder 是唯一实测可靠的（upY 恒 ±1.00）。
const CARD_W = 1.55, CARD_H = 2.15, CARD_T = 0.085;
// 碰撞圆盘半径 = 渲染器由 Mesh3D.width/2 推出（牌半宽）。此处留一份同值常量，供「撞击判据」换算用。
const HULL_R = CARD_W / 2;
const GRAVITY = 20;    // 重力大小（正数·算抛物线用；PhysicsWorld3D 取负）
// 牌的弹性刻意**低**（真纸牌本来就不弹）。教训：调到 0.52 想让撞击「弹开」，结果两张牌撞完各自**弹回原处**
// 落在同一小片区域、互相压着 —— 实测「未躺平」从 1/2 恶化到 2/2。分离要靠**偏心擦碰把它们朝两侧甩开并继续前行**，
// 不是靠对撞回弹。
const CARD_RESTITUTION = 0.14;
// 对称偏心量：**相对碰撞圆盘半径**取比例，才是真正的「擦碰」。0.2 的绝对值相对 R=1.12 几乎等于正心对撞，
// 撞完两张牌几乎原地停下、然后叠在一起 → owner 看到的「还能站在那里」其实是**互相压着**，不是立在边上（实测口径：未躺平 1/2）。
// 0.55×R 是明显的偏心：既给出大力偶（翻滚由碰撞产生），又把两张牌朝相反侧向甩开、各自落地。
// **一对一空中对撞**（owner 2026-08-07「每张牌冲向对面**对应**那张，形成空中撞击」）：
//   两张牌瞄准**同一个交汇点**（同 lane 的 x=0）——中心几乎重合 → 无论翻滚到哪个相位都必然接触。
//   ⚠ 血泪：上一版给了 Z 向持续分离速度（想让撞完分开），结果从出手就在推开，实测**最近距 2.5+ / 判据 1.34
//   → 撞上 0/1 组，三次一次都没碰上**。看着「像撞了」其实是各飞各的。分离绝不能靠出手时就分开。
//   起手**高度差半个身位**：速度仍严格镜像（等大反向·符合「相反的作用力」），但一张从上、一张从下相遇
//   → 接触点必然偏离质心 → 力偶（旋转）由**碰撞本身**产生，且上牌被往上顶、下牌被往下压，撞完自然分开。
const Y_STAGGER = 0.26;
const SPIN0 = 2.2;             // 出手初旋（rad/s·很小·只为飞行中有点翻动；狂翻应由碰撞产生）

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

/** 牌面朝向 → 世界竖直分量（纯函数·可单测）：牌用 `faceAxis:'y'`（沿 Y 薄）→ 正面法线是**局部 +Y**。
 *  把 (0,1,0) 按四元数旋转，取其世界 Y 分量 = 旋转矩阵第二列第二行 = `1 − 2(x² + z²)`。
 *  +1=正面朝上（活）· −1=反面朝上（死）· 0=牌立着（法线水平）。
 *  ⚠ 公式必须跟着 `faceAxis` 走：法线是 +Z 时是 `2(yz − xw)`，是 +Y 时是 `1 − 2(x² + z²)`。
 *  用错的后果实测过——判词与画面对不上（HUD 判「双方都反面」，画面却一灰一蓝）。 */
export function upYOf(q: readonly number[]): number {
  const x = q[0] ?? 0, z = q[2] ?? 0;
  return 1 - 2 * (x * x + z * z);
}

/** 纯函数·由两张牌的正反判胜负。正面=活：都正=同生；都反=同归于尽；一正一反=正面者胜。 */
export function judgeDuel(a: CardOutcome, b: CardOutcome): string {
  if (a.front && b.front) return '双双正面 · 同生（平）';
  if (!a.front && !b.front) return '双双反面 · 同归于尽（平）';
  return a.front ? '我方正面朝上 · 胜' : '敌方正面朝上 · 负';
}

/** 一对牌的出手方案（纯函数·可单测）：给定该道中心 z、出手距 x、抛高 vy、交汇时刻 t，
 *  返回两张牌各自的**起点 + 初速**。不变量（由测试钉死）：
 *   ① t 时刻两者 **x 与 z 完全重合** → 必然相撞（这就是「每张牌冲向对面对应那张」）；
 *   ② 速度**严格镜像**（vx 等大反向·vy 相同·vz 恒 0）→ 相反的作用力；
 *   ③ 全程 y 恒差 `stagger` → 撞击点偏离质心 → 旋转由碰撞产生，而非出手时硬塞。
 *  ⚠ 别再加任何「出手就朝两侧分开」的速度：实测那样最近距 2.5+ / 判据 1.34 → 撞上 0/1 组，看着像撞其实各飞各的。 */
export function throwPlan(laneZ: number, throwX: number, vy: number, tMeet: number, stagger: number): {
  a: { x: number; y: number; z: number; vx: number; vy: number; vz: number };
  b: { x: number; y: number; z: number; vx: number; vy: number; vz: number };
} {
  const vxMag = throwX / tMeet;
  const mk = (dir: 1 | -1) => ({ x: -dir * throwX, y: 0.9 + dir * (stagger / 2), z: laneZ, vx: dir * vxMag, vy, vz: 0 });
  return { a: mk(1), b: mk(-1) };
}

/** 相遇统计（纯函数·可单测）：越过（Δx 变号）或近接（|Δx|min ≤ 2R）都算这一对真的碰上了。
 *  **不依赖采样密度**——越过是拓扑事实，慢帧也漏不掉。 */
export function metCounts(minDx: readonly number[], crossed: readonly boolean[], hullR: number): { total: number; crossed: number; near: number } {
  let c = 0, n = 0;
  for (let i = 0; i < minDx.length; i++) {
    if (crossed[i]) c += 1;
    else if ((minDx[i] ?? Infinity) <= 2 * hullR) n += 1;
  }
  return { total: c + n, crossed: c, near: n };
}

/** 撞击判据（纯函数·可单测）：飞行途中两张牌**中心最近距离** ≤ 判据 → 算撞上了。
 *  判据取 1.2×碰撞半径：两枚半径 R 的圆盘，中心距 >2R 必不接触；但牌是**薄片**，正对时沿某轴厚度仅 0.085，
 *  所以中心距接近 2R 时能不能碰上**取决于翻滚相位**——不可靠。取 1.2R 是「无论翻到哪个相位都必然接触」的稳妥线。 */
export const HIT_DIST_RATIO = 1.2;
export function isHit(minDist: number, hullR: number): boolean { return minDist <= HIT_DIST_RATIO * hullR; }

/** 没躺平的牌数（纯函数·可单测）：|upY| < FLAT_MIN 即牌没有平躺（立着/斜靠）。
 *  这是「牌不许站住」这条要求的**可量化验收口径**——不靠肉眼看，直接数。理想恒为 0。 */
export const FLAT_MIN = 0.7;
export function upright(list: readonly DuelOutcome[]): number {
  let n = 0;
  for (const o of list) for (const c of [o.a, o.b]) if (Math.abs(c.upY) < FLAT_MIN) n += 1;
  return n;
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
  const LANE_SPAN = 3.2, DEPTH_BUDGET = 16; // 道距要容得下「擦碰后朝两侧甩开」的落点，否则相邻道的牌会叠到一起
  const scale = Math.min(1, DEPTH_BUDGET / (LANE_SPAN * n));
  const laneGap = LANE_SPAN * scale;
  const halfZ = Math.max(3.2, (n * laneGap) / 2 + 1.2);
  const halfX = Math.max(5.4, 3.4 * scale + 3.2); // 场地留够横向余量：牌擦碰后要飞出去落地，别撞到围栏斜靠着
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
  // 相遇判据（**帧率无关**）：本方案里同组两牌 z 恒相等（vz=0）、y 差恒为 stagger，
  //   故两牌距离只取决于 |Δx| —— 于是「Δx 是否越过 0」就是一个不依赖采样密度的铁证：
  //   越过 0 ⇒ 必然经过 Δx=0 那一刻，那时距离 = stagger（远小于接触范围）⇒ 一定撞上了。
  //   没越过 0 但 |Δx| 一度很小 ⇒ 撞上后被弹回来了，同样算相遇。
  //   两者都不满足 ⇒ 这一对**真的没碰到**（不是采样漏了）。
  let minDx: number[] = [];      // 每道 |Δx| 的最小值
  let crossed: boolean[] = [];   // 每道 Δx 是否变过号
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

  /** 出手距（与 throwAll 内同式·抽出供撞击判据换算复用）。 */
  // 出手距：与 tMeet 一起决定**接近速度** = 2·throwX/tMeet。
  // owner 2026-08-07「一组对、多组乱」→ 定位到接近速度 14.6 单位/秒、整个对撞不到 0.2 秒：
  //   ① 你看不清（一闪而过，剩下全是牌在地上滑）② 我也测不准（无头 200ms/帧 → 每帧飞 2.9，采样整段漏掉）。
  // 现在 throwX 1.8 + tMeet ~0.56 → 接近速度 ~6.4（原来的 44%），对撞过程 ~0.5 秒，看得见也测得到。
  const throwXOf = (L: ReturnType<typeof layoutFor>): number => 1.2 * L.scale + 0.6;

  /** 地台 + 隐形围栏按当前组数重建（围栏=有 RigidBody3D 无 Mesh3D → 物理有效不渲染）。
   *  ⚠ **每次重建必须换实体 id**（`arenaGen` 后缀）——与牌同一个坑：`PhysicsSystem` 只在 `!bodies.has(id)` 时建刚体，
   *  销毁后用同名 id 重建，刚体**不会重建**、尺寸停留在上一档。实证：从 1 组切到 5 组，围栏还停在 1 组的 z=±4.2
   *  （盒半宽 2 → 占 z∈[2.2,6.2]），而第 1/3 道的牌生在 z=±3.2 **正好在墙体内部** → 出生即被弹开、永不相遇
   *  （|Δx|min 4.54 > 出手间距 3.6·隔一道坏一个的诡异分布就是这么来的）。 */
  let arenaGen = 0;
  function rebuildArena(): void {
    arenaGen += 1;
    for (const id of arenaIds) { try { engine.world.destroyEntity(id); } catch { /* 已不在 */ } }
    arenaIds = [];
    const L = layoutFor(duels);
    const groundId = `g211-ground-${arenaGen}`;
    engine.world.createEntity(groundId);
    engine.world.addComponent(groundId, { type: 'Transform3D', x: 0, y: -0.4, z: 0 } as unknown as Component);
    // 地台必须**包住围栏**（围栏在 ±(half+1.0)）：否则落在「地台边缘～围栏」之间的牌会从桌沿掉出去（实测目击）。
    engine.world.addComponent(groundId, { type: 'Mesh3D', shape: 'box', width: (L.halfX + 1.4) * 2, height: 0.8, depth: (L.halfZ + 1.4) * 2, frontTint: 0x2f6b4f, edgeTint: 0x14301f } as unknown as Component);
    engine.world.addComponent(groundId, { type: 'RigidBody3D', shape: 'box', mass: 0 } as unknown as Component);
    arenaIds.push(groundId);
    const wallX = L.halfX + 1.0, wallZ = L.halfZ + 1.0;
    ([[wallX, 0], [-wallX, 0], [0, wallZ], [0, -wallZ]] as const).forEach(([dx, dz], k) => {
      const id = `g211-wall-${arenaGen}-${k}`;
      engine.world.createEntity(id);
      engine.world.addComponent(id, { type: 'Transform3D', x: dx, y: 2, z: dz } as unknown as Component);
      engine.world.addComponent(id, { type: 'RigidBody3D', shape: 'box', mass: 0 } as unknown as Component);
      arenaIds.push(id);
    });
    const cam = engine.world.getComponent<Camera3D>('cam', 'Camera3D');
    if (cam) cam.distance = L.camDist; // 组数越多镜头越远（缩小视角·把全场收进画面）
  }

  /** 抛一轮：N 组、每组两张。出手几何**全部由纯函数 `throwPlan` 给**（不在这里另算一套——
   *  否则测试钉的是纯函数、真跑的是内联算法，测试就成了摆设）。 */
  function throwAll(): void {
    for (const id of cardIds) { try { engine.world.destroyEntity(id); } catch { /* 已不在 */ } }
    cardIds = [];
    throwNo += 1;                         // 见头注坑②：换 id 才会重建刚体
    prevQuat.clear(); stillSince.clear();
    outcomes = Array.from({ length: duels }, () => null);
    minDx = Array.from({ length: duels }, () => Infinity);
    crossed = Array.from({ length: duels }, () => false);
    status = '抛掷中…';
    const L = layoutFor(duels);
    const throwX = throwXOf(L);
    for (let lane = 0; lane < duels; lane++) {
      const laneZ = (lane - (duels - 1) / 2) * L.laneGap;
      const vy = span(12.4, 13.6);          // 抛更高 → 滞空更长 → 交汇点可以推后
      const tMeet = (vy / GRAVITY) * span(0.80, 0.92); // 交汇更靠近最高点（撞在滞空顶点·停得住·看得清）
      const plan = throwPlan(laneZ, throwX, vy, tMeet, Y_STAGGER * L.scale); // ← 唯一真相·见其头注的四条不变量
      for (const s of SIDE) {
        const id = cardId(lane, s);
        const dir = s === 'a' ? 1 : -1;
        // 严格镜像：同速反向、同 vy、同 |vz| —— 两张牌是**一对一对撞**，不是各飞各的（owner 2026-08-07
        //   「不是一对一朝对象给相反的作用力和旋转，好像用很大力在乱飞」）。
          const p0 = plan[s];
        engine.world.createEntity(id);
        engine.world.addComponent(id, { type: 'Transform3D', x: p0.x, y: p0.y, z: p0.z } as unknown as Component);
        engine.world.addComponent(id, {
        // 沿 Y 薄：width=牌宽 / height=牌厚 / depth=牌高。`faceAxis:'y'` → 正反色落**顶/底**两面（P3D REQ-3D-CARD-FACE-AXIS）。
        // 附带好处：识别姿态（未旋转）就是**平躺**的，不再像沿 Z 薄时那样「牌出生就立着」。
        type: 'Mesh3D', shape: 'box', width: CARD_W * L.scale, height: CARD_T * L.scale, depth: CARD_H * L.scale,
        faceAxis: 'y',
        frontTint: FRONT_TINT[s],  // 正面（顶）= 阵营色 = 活
        backTint: DEATH_TINT,      // 反面（底）= 统一灰 = 死
        edgeTint: EDGE_TINT,       // 四侧 = 牌边
        } as unknown as Component);
        engine.world.addComponent(id, {
        // 原生 cylinder：渲染器按 Mesh3D 取 r=width/2、h=height → 正好是一枚与牌面同轴的**薄圆盘**。
        // 圆盘侧面连续曲面 = 立不住；且是引擎内建形状，无薄凸包的接触伪影。
        type: 'RigidBody3D', shape: 'cylinder', mass: 1.0, restitution: CARD_RESTITUTION, friction: 0.45,
        vx: p0.vx, vy: p0.vy, vz: p0.vz,             // 严格镜像：只在 X 向对冲、不做任何侧向分离（分离交给撞击）
        // 初旋只给**很小**的一点（让牌在飞行中略微翻动·有生气），真正的狂翻交给撞击那一下打出来。
        // ⚠ 上一版给到 ±16 rad/s ≈ 2.5 转/秒 —— 那是「出手就在乱转」，撞击反而被淹没，看着像乱飞。
        avx: dir * SPIN0, avy: span(-0.6, 0.6), avz: span(-0.6, 0.6),
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
      const up = upright(outcomes.filter(Boolean) as DuelOutcome[]);
      const L = layoutFor(duels);
      const met = metCounts(minDx, crossed, HULL_R * L.scale);
      console.info('[dsp/hit] 相遇 %d/%d 组（越过 %d · 近接 %d）· |Δx|min %s', met.total, duels, met.crossed, met.near, minDx.map((d) => d.toFixed(2)).join(','));
      console.info('[game211/duel-spike] 第%d 轮 · %d 组 → 胜%d 负%d 平%d · 未躺平 %d/%d · 帧 %sms(p95 %sms)', throwNo, duels, t.win, t.lose, t.draw, up, duels * 2, perfMean().toFixed(1), perfP95().toFixed(1));
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
      // 相遇判据：记 |Δx| 最小值 + Δx 是否变号（a 出手在 −x 侧 → 初始 Δx<0；变正=两牌交错而过）
      const ta = engine.world.getComponent<Transform3D>(cardId(lane, 'a'), 'Transform3D');
      const tb = engine.world.getComponent<Transform3D>(cardId(lane, 'b'), 'Transform3D');
      if (ta && tb) {
        const dx = ta.x - tb.x;
        if (Math.abs(dx) < (minDx[lane] ?? Infinity)) minDx[lane] = Math.abs(dx);
        if (dx > 0) crossed[lane] = true;
      }
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
    // 立牌计数（验收口径·理想恒 0）：>0 说明还有牌没躺平，一眼可见、不用猜。
    const met = metCounts(minDx, crossed, HULL_R * layoutFor(duels).scale);
    rows.push({ type: 'Label', id: 'dsp-hit', props: { text: `空中相遇 ${met.total} / ${duels} 组`, size: 'sm', color: met.total === duels ? 'ok' : 'danger' }, layout: {} });
    const up = upright(done);
    rows.push({ type: 'Label', id: 'dsp-upright', props: { text: `未躺平 ${up} / ${done.length * 2} 张`, size: 'sm', color: up > 0 ? 'danger' : 'ok' }, layout: {} });
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
