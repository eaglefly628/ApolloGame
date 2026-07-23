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
// FELT（呢面色·无真图回退底 + 基色·真图就绪由 felt-albedo 覆盖）。RAIL（桌边木料色·暖蜜橡·wood preset 上）。
const FELT = 0x2e7d4e, RAIL = 0xa5703c, RAIL_HI = 0xc08a4e;

// 呢面锚点半径（保留·chip3d 座位堆/抛掷锚点仍用·落点在长方呢面内）。
export const FELT_RX = 3.55, FELT_RZ = 2.02;
// 长方桌呢面尺寸（owner 2026-07-22：椭圆→长方·flat plane 易换材质）：长×宽（世界单位·≈1.8:1 赛桌比例）。
const TBL_W = 7.1, TBL_D = 3.95;
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

  // 相机：**顶视·稍斜**（owner 2026-07-22：长方 3D 桌·顶视稍斜=看清呢面 + 一点桌体立体/木边光泽）·pitch≈1.28rad≈73°。
  //   yaw0=主角(+z)在屏底。distance 框住长方桌。pivotY 抬一点看向桌面。
  entities['cam'] = {
    Camera3D: { yaw: 0, pitch: 1.28, projection: 'perspective', fov: 40, distance: 8.6, near: 0.1, far: 100, pivotX: 0, pivotY: 0.12, pivotZ: 0 },
  };
  // 光：暖顶主光（投影·筹码立体感）+ 冷补 + 暖环境。
  entities['sun'] = { Light3D: { kind: 'directional', color: 0xfff0d8, intensity: 1.05, dirX: -2, dirY: -9, dirZ: -1.5, castShadow: true } };
  entities['fill'] = { Light3D: { kind: 'directional', color: 0x8a6fff, intensity: 0.22, dirX: 4, dirY: -3, dirZ: 4 } }; // 冷紫补（夜景冷调）
  entities['amb'] = { Light3D: { kind: 'ambient', color: 0xe8d0ff, intensity: 0.5 } };                                   // 紫环境补
  // 暖光池（桌心正上方 point·呢面中央提亮=稿 felt radial 中亮 + warm floor pool·朝边自然衰减出深紫）。
  entities['pool'] = { Transform3D: { x: 0, y: 2.4, z: -0.15 }, Light3D: { kind: 'point', color: 0xffd2a0, intensity: 4.6, range: 9 } };

  // ── owner 2026-07-22 定稿：长方 3D 桌（椭圆→长方·桌面 flat plane 易换材质·桌边 glossy 木纹跟老版差不多）────────
  //   桌面呢面 = 长方 flat plane + Material3D.map（clean UV·一张贴图整幅铺·易换材质·owner「继续出桌面贴图台账」）。
  //   桌边/桌体 = glossy 木纹（wood preset·roughness 0.4 出光泽·+ 程序木纹 + rail 贴图槽·owner「木质木纹·要有光泽度」）。
  //   物理：木桌体 box 碰撞 mass0 接筹码 + 四面矮墙挡池（不可见）。背幕=setBackgroundTexture 室内环境（桌四周）。

  // 木桌体 + 桌边（长方木盒·比呢面略大=四周露木边框/rail·glossy 木纹·可换 rail 真图）。top 在呢面沿·中心被呢面盖·四周露木。
  entities['table-body'] = {
    Transform3D: { x: 0, y: FELT_TOP - 0.24, z: 0 },
    Mesh3D: { shape: 'box', width: TBL_W + 0.55, height: 0.48, depth: TBL_D + 0.55, frontTint: RAIL, edgeTint: 0x4a3218 },
    Material3D: { preset: 'wood', color: RAIL, roughness: 0.4, surface: { pattern: 'scratches', tiles: 5, normal: 0.45, rough: 0.35, scale: 1.1 }, map: 'game-c/table/rail-albedo', normalMap: 'game-c/table/rail-normal' },
    RigidBody3D: { shape: 'box', mass: 0, restitution: 0.15, friction: 0.72 },
  };
  // 桌面呢面（长方 flat plane·rotX -90° 面朝上·略高于木桌体·四周留木边）。Material3D.map=felt-albedo（整幅呢面图·clean UV·易换）+ normalMap felt-normal；无真图=纯色 FELT 回退。
  entities['table-felt'] = {
    Transform3D: { x: 0, y: FELT_TOP + 0.004, z: 0, rotX: -Math.PI / 2 },
    Mesh3D: { shape: 'plane', width: TBL_W, height: TBL_D, frontTint: FELT },
    Material3D: { preset: 'matte', color: FELT, roughness: 0.85, map: 'game-c/table/felt-albedo', normalMap: 'game-c/table/felt-normal' },
  };

  // ── 四面隐形矮墙（长方·挡抛入筹码不滑出呢面·mass0 静态·不渲染）──
  const WALL_Y = FELT_TOP + 0.13, WALL_H = 0.26, hw = TBL_W / 2, hd = TBL_D / 2;
  const walls = [
    { x: 0, z: hd, w: TBL_W + 0.3, d: 0.12 },  // 远边
    { x: 0, z: -hd, w: TBL_W + 0.3, d: 0.12 },  // 近边
    { x: hw, z: 0, w: 0.12, d: TBL_D + 0.3 },   // 右边
    { x: -hw, z: 0, w: 0.12, d: TBL_D + 0.3 },  // 左边
  ];
  walls.forEach((wl, k) => {
    entities[`rail-${k}`] = {
      Transform3D: { x: wl.x, y: WALL_Y, z: wl.z },
      Mesh3D: { shape: 'box', width: wl.w, height: WALL_H, depth: wl.d, frontTint: RAIL_HI }, // 只为物理取盒尺寸
      Visibility: { visible: false }, // 不渲染·只碰撞
      RigidBody3D: { shape: 'box', mass: 0, restitution: 0.4, friction: 0.5 },
    };
  });

  return { capabilities: [], entities };
}
