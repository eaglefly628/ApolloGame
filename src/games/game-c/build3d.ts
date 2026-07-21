import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';

// ═══════════════════════════════════════════════════════════════
//  game-c ·《六人德州》3D 牌桌 + 物理围栏（owner 2026-07-18：2D 俯视视角 + 3D 物理筹码扔进池·桌边 3D 围栏挡住）
//
//  纯 render-only 3D 组件（Transform3D/Mesh3D/Camera3D/Light3D/RigidBody3D）——ThreeRenderer（P3D 域）直接消费。
//  「2D 视角」= **陡俯视相机**（近乎垂直看下·桌面看着是平的 2D）；筹码是真 3D 圆柱（物理 cannon-es 落桌翻滚·
//  边缘略见立体=椭圆盘）。围栏 = **一圈静态 box 墙**（mass:0·physics.ts 明许「围栏/地台」静态体）沿桌缘挡住筹码不滚出。
//  ⚠ 红线：render-only·不进 sim/hash（筹码数量永远是 session 资源·物理落点纯表现·回放 lockstep 零影响·翻滚走专属种子）。
//  坐标系：x 右 / y 上（地面 0）/ z 朝镜头近。桌心=原点。
// ═══════════════════════════════════════════════════════════════

// 色板（STORY-POKER V2 稿·紫调绒面椭圆桌·owner 2026-07-21「美术无限逼近」）——照稿 felt radial 中亮 #7d5570 →
//   边暗 #281620 取中值 0x5a3a52 做呢面主色（暖顶光在桌心再提亮=warm pool）；rail 稿 #6a4c38→#3e2c1e 木栏（收敛高光防塑感）。
const FELT = 0x6a4462, FELT_LO = 0x2a1826, RAIL = 0x6f5040, RAIL_HI = 0x8a6448, FLOOR = 0x18101e, FLOOR_EDGE = 0x0b0710;

// 桌面椭圆（跑道形·长轴 x > 短轴 z·正式赛桌比例）。felt=呢面半径；rail=围栏环半径（略大·墙贴桌缘）。
// owner 2026-07-21「纵横比跟稿差不多·别让立绘盖住这么大桌」：短轴收窄 → 呢面更扁·屏上 ≈916×502(1.82:1)·上沿下移给立绘 bust 让位。
export const FELT_RX = 3.55, FELT_RZ = 2.02; // 呢面长/短半轴（世界单位·稿 1.82:1）
const RAIL_RX = 3.72, RAIL_RZ = 2.19;        // 围栏环长/短半轴（呢面外 ~0.17）
const RAIL_SEGS = 46;                         // 围栏墙段数（越多越贴椭圆·段间略叠不漏筹码·平滑）
const RAIL_Y = 0.64, RAIL_H = 0.26;           // 围栏中心高 / 高度（低矮圆润软边·非高墙）
const FELT_TOP = 0.55;                         // 呢面上沿 y（筹码落此面）
export const SEAT_COUNT = 6;
/** 底池位（桌心偏主角侧·筹码扔向此·§下注区）。 */
export const POT3D = { x: 0, y: FELT_TOP + 0.06, z: -0.35 } as const;

/** 座位 i 桌缘世界坐标（主角 i=0 正南 +z 朝镜头·顺时针均布·此处只供筹码抛掷起点）。
 *  count（owner 2026-07-20 入局人数 2~6）：环上均布 = i*2π/count；count=6 时 = i*60°（与旧值一致·零回归）。 */
export function seatWorldPos(i: number, count = 6): { x: number; z: number } {
  const th = (i * 2 * Math.PI) / count; // 0=南(+z)·顺时针均布
  return { x: FELT_RX * 0.9 * Math.sin(th), z: FELT_RZ * 0.9 * Math.cos(th) };
}
/** 座位 i 的筹码堆锚点（该座位桌缘·**贴边**呢面上·owner 2026-07-18「主角堆靠自己桌边·每位姨太也各有堆靠桌边·再往外一点」）。
 *  同一椭圆环（factor f·贴近座位环但留 CHIP_R 余量稳在呢面·不越围栏），角向偏一点点=落在该座位右手侧（避开正前抛掷线 + 底牌位）。
 *  ⚠ 堆=**静态无物理**（setStack 只挂 Transform3D+Mesh3D·无 RigidBody3D）→ cannon-es 不建体·抛入筹码撞不翻（owner「不要被别人撞翻」）。 */
export function seatStackPos(i: number, count = 6): { x: number; y: number; z: number } {
  const th = (i * 2 * Math.PI) / count + 0.32; // 0=南(+z)·顺时针均布；+0.32rad≈该座位右手侧偏一点（count=6→i*60°+偏移）
  const f = 0.85;                              // 桌缘·贴边（往外挪·仍 <0.9 座位环 + 留 CHIP_R 余量稳在呢面·<1.0 围栏）
  return { x: FELT_RX * f * Math.sin(th), y: FELT_TOP, z: FELT_RZ * f * Math.cos(th) };
}

/** 3D 牌桌场景（静态·render-only）：陡俯视相机 + 光 + 暗地板 + 椭圆呢面(带碰撞) + 一圈物理围栏墙。 */
export function build3DTableBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {};

  // 相机：**陡俯视**（近垂直=2D 平面观感·pitch≈1.12rad≈64°）·yaw0=主角(+z)在屏底。distance 框住椭圆长轴。
  entities['cam'] = {
    Camera3D: { yaw: 0, pitch: 1.12, projection: 'perspective', fov: 40, distance: 8.4, near: 0.1, far: 100, pivotX: 0, pivotY: 0.2, pivotZ: 0 },
  };
  // 光：暖顶主光（投影·筹码立体感）+ 冷补 + 暖环境。
  entities['sun'] = { Light3D: { kind: 'directional', color: 0xfff0d8, intensity: 1.05, dirX: -2, dirY: -9, dirZ: -1.5, castShadow: true } };
  entities['fill'] = { Light3D: { kind: 'directional', color: 0x8a6fff, intensity: 0.22, dirX: 4, dirY: -3, dirZ: 4 } }; // 冷紫补（夜景冷调）
  entities['amb'] = { Light3D: { kind: 'ambient', color: 0xe8d0ff, intensity: 0.5 } };                                   // 紫环境补
  // 暖光池（桌心正上方 point·呢面中央提亮=稿 felt radial 中亮 + warm floor pool·朝边自然衰减出深紫）。
  entities['pool'] = { Transform3D: { x: 0, y: 2.4, z: -0.15 }, Light3D: { kind: 'point', color: 0xffd2a0, intensity: 4.6, range: 9 } };

  // 暗地板（夜宴厅氛围·衬托桌面）。
  entities['floor'] = { Transform3D: { x: 0, y: -0.02, z: 0 }, Mesh3D: { shape: 'box', width: 16, height: 0.04, depth: 12, frontTint: FLOOR, backTint: FLOOR, edgeTint: FLOOR_EDGE } };

  // 桌基（木·椭圆·圆柱×scaleX）——呢面下的桌身。
  entities['table-base'] = { Transform3D: { x: 0, y: 0.26, z: 0, scaleX: FELT_RX / FELT_RZ }, Mesh3D: { shape: 'cylinder', width: FELT_RZ * 2 + 0.5, height: 0.5, frontTint: RAIL, edgeTint: 0x4a3218 } };
  // 呢面（椭圆·带静态碰撞体 mass0→筹码落此面堆叠不穿桌）。width=短径×2·scaleX 拉成长椭圆。
  entities['table-felt'] = {
    Transform3D: { x: 0, y: FELT_TOP - 0.03, z: 0, scaleX: FELT_RX / FELT_RZ },
    Mesh3D: { shape: 'cylinder', width: FELT_RZ * 2, height: 0.06, frontTint: FELT, edgeTint: FELT_LO },
    RigidBody3D: { shape: 'cylinder', mass: 0, restitution: 0.18, friction: 0.72 },
  };

  // ── 隐形物理围栏（owner 2026-07-18：可见木栏「太奇怪」·改**看不见的碰撞墙**·朝心一圈·只挡不画）──
  // 一圈静态 box 墙（mass0·physics.ts 明许「围栏/地台」静态体）沿椭圆缘·挡抛入的筹码不滚出台。
  // Visibility:false = 渲染器不画（Mesh3D 仅供物理取盒尺寸·非渲染网格）；rotY 朝径向=墙面对心。
  for (let k = 0; k < RAIL_SEGS; k++) {
    const th = (k / RAIL_SEGS) * Math.PI * 2;
    const x = RAIL_RX * Math.sin(th), z = RAIL_RZ * Math.cos(th);
    const rotY = Math.atan2(x, z); // 墙面法线朝径向（对准桌心）
    const segLen = (Math.PI * (FELT_RX + FELT_RZ)) / RAIL_SEGS * 1.7; // 段长多叠→无缝闭环
    entities[`rail-${k}`] = {
      Transform3D: { x, y: RAIL_Y, z, rotY },
      Mesh3D: { shape: 'box', width: segLen, height: RAIL_H, depth: 0.14, frontTint: RAIL_HI }, // 只为物理取尺寸
      Visibility: { visible: false }, // **不渲染**（owner：围栏看不见·只碰撞）
      RigidBody3D: { shape: 'box', mass: 0, restitution: 0.42, friction: 0.5 },
    };
  }

  return { capabilities: [], entities };
}
