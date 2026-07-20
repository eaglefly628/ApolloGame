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

// 色板（art-data §1 夜宴·场景线 vegas-victoriana）。
const FELT = 0x14795a, FELT_LO = 0x0c4a37, RAIL = 0x8a5f2e, RAIL_HI = 0xd3a247, FLOOR = 0x1a110c, FLOOR_EDGE = 0x0d0806;

// 桌面椭圆（跑道形·长轴 x > 短轴 z·正式赛桌比例）。felt=呢面半径；rail=围栏环半径（略大·墙贴桌缘）。
export const FELT_RX = 3.55, FELT_RZ = 2.45; // 呢面长/短半轴（世界单位）
const RAIL_RX = 3.72, RAIL_RZ = 2.62;        // 围栏环长/短半轴（呢面外 ~0.17）
const RAIL_SEGS = 46;                         // 围栏墙段数（越多越贴椭圆·段间略叠不漏筹码·平滑）
const RAIL_Y = 0.64, RAIL_H = 0.26;           // 围栏中心高 / 高度（低矮圆润软边·非高墙）
const FELT_TOP = 0.55;                         // 呢面上沿 y（筹码落此面）
export const SEAT_COUNT = 6;
/** 底池位（桌心偏主角侧·筹码扔向此·§下注区）。 */
export const POT3D = { x: 0, y: FELT_TOP + 0.06, z: -0.35 } as const;

/** 座位 i 桌缘世界坐标（主角 i=0 正南 +z 朝镜头·顺时针 60°·2D HUD 座位卡在屏幕锚点·此处只供筹码抛掷起点）。 */
export function seatWorldPos(i: number): { x: number; z: number } {
  const th = (i * Math.PI) / 3; // 0=南(+z)·顺时针
  return { x: FELT_RX * 0.9 * Math.sin(th), z: FELT_RZ * 0.9 * Math.cos(th) };
}
/** 座位 i 的筹码堆锚点（该座位桌缘·**贴边**呢面上·owner 2026-07-18「主角堆靠自己桌边·每位姨太也各有堆靠桌边·再往外一点」）。
 *  同一椭圆环（factor f·贴近座位环但留 CHIP_R 余量稳在呢面·不越围栏），角向偏一点点=落在该座位右手侧（避开正前抛掷线 + 底牌位）。
 *  ⚠ 堆=**静态无物理**（setStack 只挂 Transform3D+Mesh3D·无 RigidBody3D）→ cannon-es 不建体·抛入筹码撞不翻（owner「不要被别人撞翻」）。 */
export function seatStackPos(i: number): { x: number; y: number; z: number } {
  const th = (i * Math.PI) / 3 + 0.32; // 0=南(+z)·顺时针 60°/座；+0.32rad≈该座位右手侧偏一点
  const f = 0.85;                      // 桌缘·贴边（往外挪·仍 <0.9 座位环 + 留 CHIP_R 余量稳在呢面·<1.0 围栏）
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
  entities['sun'] = { Light3D: { kind: 'directional', color: 0xfff0d8, intensity: 1.2, dirX: -2, dirY: -9, dirZ: -1.5, castShadow: true } };
  entities['fill'] = { Light3D: { kind: 'directional', color: 0x6f7cff, intensity: 0.2, dirX: 4, dirY: -3, dirZ: 4 } };
  entities['amb'] = { Light3D: { kind: 'ambient', color: 0xffe6c4, intensity: 0.58 } };

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
