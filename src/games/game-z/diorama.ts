// Game Z · 3D 盒庭（Captain Toad 风渲染线 v0）
//
// 纯蓝图数据，零专属 system：每个物件 = Transform3D（地面 XZ + Y 高度的真三维位姿）+ Mesh3D（体块）。
// 一个 Camera3D 单例把场景切进「盒庭模式」——引擎 ThreeRenderer 据它按 yaw/pitch 环绕取景、开柔和阴影、
// 暖白主光 + 冷蓝补光、哑光材质。换一组数字即换一个盒庭，零手写 Three.js。
//
// 盒面着色约定（Mesh3D box）：顶面 + 侧面取 edgeTint（俯视盒庭最显眼），朝镜头那面取 frontTint（做二色阴面）。
// 故 top=主色、side=暗一档。盒中心 y = 高度/2 时下沿坐地（地台顶在 y=0）。

import type { WorldBlueprint } from '../../assembly/demo.assembly.js';
import { motionApplyCapability } from '@skills/tier1/index.js';
import { overlapDetect3dCapability, navmeshBakeCapability, collisionResolve3dCapability } from '@skills/atoms/index.js';
import { pathfindCapability } from '@skills/tier2/index.js';
import { MODEL_DUCK } from './assets.js';

type Ent = WorldBlueprint['entities'][string];

// 一个体块：位姿(中心 x,y,z) + 尺寸(w,h,d) + 顶/侧色。rotY 可选（如让宝石斜摆）。
function block(x: number, y: number, z: number, w: number, h: number, d: number, top: number, side: number, rotY?: number): Ent {
  return {
    Transform3D: { x, y, z, ...(rotY !== undefined ? { rotY } : {}) },
    Mesh3D: { shape: 'box', width: w, height: h, depth: d, frontTint: side, backTint: side, edgeTint: top },
  };
}

// 斜置凸块（REQ-3D-Collision·P2 demo）：绕 Y 转 30° 的盒 → 凸多面体 hull 碰撞体。
// 面法线轴 = 预烘焙数据（三角值写死成常量·非运行时计算）；8 顶点由轴 + 半尺寸**只用 ×/+** 生成 → 跨机逐位确定。
// render 用 Transform3D.rotY 同角度斜摆，collision 用 hull 顶点 —— 渲染与碰撞各取所需、同一朝向。
const COS30 = 0.8660254037844387, SIN30 = 0.5;
const WALL_AXES = [[COS30, 0, -SIN30], [0, 1, 0], [SIN30, 0, COS30]]; // 绕 +Y 转 30°（同 three rotY）
function hullBoxVerts(hx: number, hy: number, hz: number, a: number[][]): number[] {
  const out: number[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
    for (let k = 0; k < 3; k++) out.push(sx * hx * a[0]![k]! + sy * hy * a[1]![k]! + sz * hz * a[2]![k]!);
  return out;
}

// 实心障碍（碰撞 + 寻路双用）：2D Transform(碰撞/寻路 planar) + Transform3D(render 精确位姿) + Mesh3D + Collider3D box。
// 下沿坐地（baseY=0·中心 y=h/2）。navmesh-bake 把它栅格化成封格，自动生成的 NavGraph 让追兵绕开它（「寻路碰撞」）。
function obstacle(x: number, z: number, w: number, h: number, d: number, top: number, side: number): Ent {
  return {
    Transform: { x, y: z, rotation: 0, scaleX: 1, scaleY: 1 },
    Transform3D: { x, y: h / 2, z },
    Mesh3D: { shape: 'box', width: w, height: h, depth: d, frontTint: side, backTint: side, edgeTint: top },
    Collider3D: { kind: 'box', halfX: w / 2, halfY: h / 2, halfZ: d / 2 },
  };
}

// 鹅卵石小径：一排**完全相同**的石块（同尺寸同色 → 同视觉签名）。展示 W1-A 实例化：N 个同款盒 → 1 个
// InstancedMesh（1 draw call）。纯数据（蓝图摆 N 个实体），渲染器自动批，零渲染旗标。
function steppingStones(): Record<string, Ent> {
  const out: Record<string, Ent> = {};
  for (let i = 0; i < 8; i++) {
    out[`stone-${i}`] = block(-22 + i * 5.2, 0.4, 22, 3, 0.8, 3, 0xbcaaa4, 0x8d6e63);
  }
  return out;
}

// 渲染压力测试：一片**完全相同**的尖塔铺在外环（中央留出玩法区）。同款 → W1-A 归一批实例化。
// 位置用确定性公式抖动（render-only·非随机），约 320 个。
function forest(): Record<string, Ent> {
  const out: Record<string, Ent> = {};
  let n = 0;
  for (let gx = -114; gx <= 114; gx += 12) {
    for (let gz = -114; gz <= 114; gz += 12) {
      if (Math.abs(gx) < 52 && Math.abs(gz) < 52) continue; // 留出中央玩法区
      const jx = ((n * 17) % 9) - 4, jz = ((n * 13) % 9) - 4; // 确定性抖动（散布更自然）
      out[`spire-${n}`] = block(gx + jx, 2.5, gz + jz, 2.4, 5, 2.4, 0x66bb6a, 0x2e7d32);
      n++;
    }
  }
  return out;
}

/** 盒庭样例蓝图：草地台 + 抬升石台（站 Toad）+ 金阶梯 + 板条箱 + 终点宝石 + 蘑菇 + 鹅卵石径 + 天空盒 + 可控角色。 */
export function dioramaBlueprint(): WorldBlueprint {
  return {
    // 角色 velocity→motion-apply 走动 + overlap-detect-3d 3D 逻辑碰撞 + navmesh-bake（自动烘 NavGraph）+ 主程 pathfind
    // （A* 沿路跟随）—— 皆确定性 sim·进 hash。寻路：自动生成（非手摆），复用主程 NavGraph/NavAgent/pathfind。
    capabilities: [motionApplyCapability, overlapDetect3dCapability, collisionResolve3dCapability, navmeshBakeCapability, pathfindCapability],
    entities: {
      // 盒庭相机（REQ-3D-Camera·语义参数全数据化）：轨道俯角环绕·fov/俯仰夹角进数据（不再写死在渲染器/胶水）。
      // 运行时：拖拽改 yaw/pitch、滚轮改 distance（行为层）；O 切正交、F 切跟随小黄鸭（game-z.ts 输入胶水）。
      cam: { Camera3D: { yaw: 0.72, pitch: 0.66, distance: 312, pivotX: 0, pivotY: 2, pivotZ: 0, fov: 38, pitchMin: 0.12, pitchMax: 1.45 } },

      // 数据化光照（Light3D·替原写死的灯）：暖白太阳（投软影）+ 冷蓝环境补光。
      // 曝光收敛（owner 2026-06-28「太阳太亮·曝光过度」）：太阳 1.6→1.05、环境补光 0.45→0.55 提暗部。
      sun: { Light3D: { kind: 'directional', color: 0xfff1d6, intensity: 1.05, castShadow: true } },
      fill: { Light3D: { kind: 'ambient', color: 0xbfd2ff, intensity: 0.55 } },
      // 动态局部光（TA Phase 2·预算 2 盏 point/spot）：两盏都挂在会动的方块追兵身上（见下方 seeker / seeker-2）——
      // 暖光跟橙追兵、冷光跟蓝追兵，随寻路在 140² 大地图上游走照亮（owner「两个点光源都给两个动的方块」）。

      // 后处理（Post3D·TA Phase 4 第一梯队画质）：AO 环境光遮蔽 + 色彩分级（绘本调色板）+ SMAA 抗锯齿。
      // 移轴景深/泛光仍移除（owner「景深奇怪·先移掉」），待自适配版再加。
      post: {
        Post3D: {
          ao: { intensity: 1.1, radius: 5, scale: 1 },
          grade: { exposure: 1.02, contrast: 1.08, saturation: 1.12, brightness: 0.0, tint: 0xfff6ec }, // 暖一点·略提对比/饱和
          aa: true,
        },
      },
      // 距离雾（TA Phase 4）：远处柔化 + 盒庭纵深·雾色取天色（near/far 配 140² 大地图）。
      fog: { Fog3D: { color: 0xcfe9f7, near: 190, far: 520 } },

      // 天空盒：蓝天 → 浅地平线 + 程序化白云缓慢飘动
      sky: { Sky3D: { top: 0x4a90d9, bottom: 0xcfe9f7, clouds: true, cloudTint: 0xffffff, scroll: 1 } },

      // 可控角色（WASD/方向键 → Velocity → motion-apply 走动）：用 2D Transform，盒庭模式自动落到地面。
      // 导入式 glTF 小黄鸭真模型（替原方块蘑菇人·展示模型导入）。Transform.x→地面 X，Transform.y→地面 Z（景深）；
      // 起步站在草地中央。模型原点在脚底 → groundPose(y=0) 坐地。scale 把鸭子放大到盒庭尺度。
      // 角色挂 Collider3D 竖直胶囊（碰撞用·进 hash·与 Model3D 渲染分离）。
      hero: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Velocity: { vx: 0, vy: 0, angular: 0 },
        Model3D: { modelKey: MODEL_DUCK, scale: 3.2 },
        Collider3D: { kind: 'capsule', radius: 2, height: 6 },
        // 头顶飘字（TA Phase 3·世界 UI·走主程 LayoutNode·渲染线只做世界锚 + 投影）。
        WorldUI3D: { text: '🦆 小黄鸭', offsetY: 9, size: 'sm', glow: true },
      },

      // 触发区（REQ-3D-Collision demo）：地面半透明绿垫（Mesh3D render·Color.alpha<1 走单 mesh）+ Collider3D box trigger
      // （sim·进 hash）。同一 2D Transform 同时驱动渲染(落地面)与碰撞(planar)。小黄鸭走进 → overlap-detect-3d 产
      // Overlap3D → game-z 读到点亮（拖 WASD 进出试）。起步即罩住原点 → 截图见触发态。
      zone: {
        Transform: { x: 0, y: 4, rotation: 0, scaleX: 1, scaleY: 1 },
        Mesh3D: { shape: 'box', width: 12, height: 0.8, depth: 12, frontTint: 0x33d17a, backTint: 0x33d17a, edgeTint: 0x2ec27e },
        Color: { tint: 0x33d17a, alpha: 0.4 },
        Collider3D: { kind: 'box', halfX: 6, halfY: 4, halfZ: 6, trigger: true },
      },

      // 静态大黄鸭（终点装饰·走 Transform3D 真三维位姿）：与可控鸭共享同一解析模板（多实例复用·省显存）。
      'duck-statue': {
        Transform3D: { x: 16, y: 5.5, z: 9, rotY: -2.2, scale: 3.6 },
        Model3D: { modelKey: MODEL_DUCK },
      },

      // 草地大地台（顶在 y=0）—— 渲染压力测试：再放大 → 240²（owner 2026-06-28）。
      ground: block(0, -2.5, 0, 240, 5, 240, 0x8bc34a, 0x5d4037),

      // ⚡ 渲染压力测试：~320 个**完全相同**的尖塔（同尺寸同色 → 同视觉签名 → W1-A 自动归 1 个 InstancedMesh·
      // 1 draw call）。证明「同款物件再多·draw call 也几乎不涨」。纯 render（Mesh3D·无 Collider3D·不进碰撞/寻路）。
      ...forest(),

      // 抬升石台（顶在 y=6）
      platform: block(-12, 3, -8, 26, 6, 22, 0xb0bec5, 0x607d8b),
      // 石台上的「Toad」：白身 + 红蘑菇帽
      'toad-body': block(-12, 8.5, -8, 5, 5, 5, 0xfafafa, 0xe0e0e0),
      'toad-cap': block(-12, 12.5, -8, 7, 3, 7, 0xe53935, 0xc62828),

      // 金阶梯（两级上行）+ 顶上的终点宝石（斜摆）
      'step-1': block(8, 1.5, 6, 10, 3, 10, 0xffd54f, 0xffb300),
      'step-2': block(15, 3.5, 9, 10, 3, 10, 0xffd54f, 0xffb300),
      gem: block(16, 7.5, 9, 4, 4, 4, 0x4dd0e1, 0x26a69a, 0.6),

      // 板条箱
      crate: block(6, 3, -10, 6, 6, 6, 0xa1887f, 0x795548),

      // 斜墙（P2·hull 凸多面体碰撞体 demo）：绕 Y 转 30° 的石板。render 斜摆 + hull 碰撞（小黄鸭走右侧撞它·
      // 产 Overlap3D）。开「碰撞体线框」菜单可见其真实斜置 hull 线框（白）——证明 SAT 按真朝向判定·非轴对齐 AABB。
      'angle-wall': {
        Transform: { x: 20, y: -4, rotation: 0, scaleX: 1, scaleY: 1 }, // 2D：碰撞 planar（x→X、y→Z）
        Transform3D: { x: 20, y: 4, z: -4, rotY: 0.5235987755982988 }, // 3D：render 斜摆 30°（=hull 朝向）
        Mesh3D: { shape: 'box', width: 12, height: 8, depth: 3, frontTint: 0x90a4ae, backTint: 0x90a4ae, edgeTint: 0xb0bec5 },
        Collider3D: { kind: 'hull', baseY: 4, verts: hullBoxVerts(6, 4, 1.5, WALL_AXES), axes: WALL_AXES.flat() },
      },

      // ── 碰撞感知寻路（REQ-3D-Nav · owner「自动摆放」+ 扩充关卡）──
      // 寻路数据 = **自动烘焙**：NavMesh 罩住扩充后的 100² 草地台，navmesh-bake 每帧把 Collider3D 障碍栅格化、
      // 可行走格自动织成主程 NavGraph → 主程 pathfind 用（零手摆航点）。
      nav: { NavMesh: { minX: -68, minZ: -68, maxX: 68, maxZ: 68, cellSize: 3, agentRadius: 2.6 } },

      // 实心石墩障碍（碰撞 + 寻路双用）：散在中央，逼追兵绕行。
      'rock-1': obstacle(-14, -12, 6, 5, 10, 0x9e9e9e, 0x616161),
      'rock-2': obstacle(-4, -18, 9, 5, 6, 0x9e9e9e, 0x616161),
      'rock-3': obstacle(-16, 4, 6, 5, 8, 0x9e9e9e, 0x616161),
      // 扩充区石柱（更多 nav 空洞 + 视觉填充·撒到 140² 外环）。
      'pillar-1': obstacle(-48, -44, 7, 8, 7, 0x8d6e63, 0x5d4037),
      'pillar-2': obstacle(46, -42, 7, 8, 7, 0x8d6e63, 0x5d4037),
      'pillar-3': obstacle(54, 18, 7, 8, 7, 0x8d6e63, 0x5d4037),
      'pillar-4': obstacle(-54, 28, 7, 8, 7, 0x8d6e63, 0x5d4037),
      'pillar-5': obstacle(30, 56, 7, 8, 7, 0x8d6e63, 0x5d4037),
      'pillar-6': obstacle(-30, 58, 7, 8, 7, 0x8d6e63, 0x5d4037),
      // **蛇形迷墙**（扩充区·寻路展示主角）：两道交错长墙各留一个缺口 → 远角追兵必须先绕左、再绕右才能穿到中央。
      // 自动生成的 NavGraph 会精确避开墙体、只在缺口处连通；开「导航网格」可见黄线沿缺口蜿蜒。
      'maze-1': obstacle(-15, 30, 56, 7, 4, 0x78909c, 0x546e7a), // x[-43,13]·缺口在右
      'maze-2': obstacle(17, 40, 56, 7, 4, 0x78909c, 0x546e7a),  // x[-11,45]·缺口在左

      // 寻路追兵①（橙盒·左下远角）：主程 NavAgent + Relation(target=hero) → pathfind 沿自动生成的 NavGraph 绕障碍
      // 逼近小黄鸭，写 Velocity → motion-apply 走动。只挂 2D Transform → render groundPose 跟随寻路移动。
      // 开左下「导航网格」菜单：青点/线 = 自动生成的可走图（没点处=被碰撞封住）、黄线 = 追兵当前规划路径。
      seeker: {
        Transform: { x: -62, y: -62, rotation: 0, scaleX: 1, scaleY: 1 },
        Velocity: { vx: 0, vy: 0, angular: 0 },
        Mesh3D: { shape: 'box', width: 3.2, height: 3.2, depth: 3.2, frontTint: 0xff7043, backTint: 0xff7043, edgeTint: 0xffab91 },
        NavAgent: { speed: 0.5, arriveRange: 7 },
        Relation: { kind: 'target', targetId: 'hero' },
        // 移动点光①（暖·跟橙追兵·随寻路在大地图游走照亮脚下地面/经过的盒子）。
        Light3D: { kind: 'point', color: 0xffb060, intensity: 120, range: 30, baseY: 5 },
        WorldUI3D: { text: '追兵·橙', offsetY: 5, size: 'xs', color: 'warn' },
      },
      // 寻路追兵②（蓝盒·迷墙后远角）：从 140² 远端出发，必须穿蛇形迷墙的两个缺口才能到中央 → 展示长程绕路寻路。
      'seeker-2': {
        Transform: { x: 62, y: 62, rotation: 0, scaleX: 1, scaleY: 1 },
        Velocity: { vx: 0, vy: 0, angular: 0 },
        Mesh3D: { shape: 'box', width: 3.2, height: 3.2, depth: 3.2, frontTint: 0x42a5f5, backTint: 0x42a5f5, edgeTint: 0x90caf9 },
        NavAgent: { speed: 0.55, arriveRange: 7 },
        Relation: { kind: 'target', targetId: 'hero' },
        // 移动点光②（冷·跟蓝追兵）。两盏=预算上限·都挂在会动的方块上。
        Light3D: { kind: 'point', color: 0x6cc6ff, intensity: 110, range: 28, baseY: 5 },
        WorldUI3D: { text: '追兵·蓝', offsetY: 5, size: 'xs', color: 'jade' },
      },

      // ── VFX（TA Phase 1·数据驱动粒子·render-only）──
      // 宝石上的金→青魔法喷泉（cone·additive·size/color 随寿命）：展示发射形状 + 力 + 曲线 + 渐变。
      'vfx-gem': {
        Vfx3D: {
          x: 16, y: 9, z: 9, shape: 'cone', coneAngle: 0.55, rate: 130, lifetime: 1.2, lifeVar: 0.3,
          speed: 9, speedVar: 3, gravity: 11, size: 2.6, max: 260, blend: 'add',
          sizeCurve: { keys: [{ t: 0, v: 0.2 }, { t: 0.15, v: 1 }, { t: 1, v: 0 }], mode: 'smooth' },
          colorGradient: { stops: [{ t: 0, color: 0xfff6c0, alpha: 1 }, { t: 0.5, color: 0x4dd0e1, alpha: 1 }, { t: 1, color: 0x26a69a, alpha: 0 }] },
        },
      },
      // 石台上空缓缓上浮的花粉微尘（sphere·alpha·负重力上飘）：展示 alpha 混合 + 体积发射 + 柔生灭。
      'vfx-motes': {
        Vfx3D: {
          x: -12, y: 9, z: -8, shape: 'sphere', emitRadius: 15, rate: 30, lifetime: 4.5, lifeVar: 1.5,
          speed: 0.7, gravity: -0.4, size: 1.1, max: 160, blend: 'alpha',
          sizeCurve: { keys: [{ t: 0, v: 0 }, { t: 0.2, v: 1 }, { t: 0.8, v: 1 }, { t: 1, v: 0 }], mode: 'smooth' },
          colorGradient: { stops: [{ t: 0, color: 0xfff3c4, alpha: 0 }, { t: 0.5, color: 0xfff3c4, alpha: 0.75 }, { t: 1, color: 0xffffff, alpha: 0 }] },
        },
      },

      // 两朵蘑菇（茎 + 伞盖）
      'mush-a-stem': block(2, 1, 14, 3, 2, 3, 0xfff3e0, 0xffe0b2),
      'mush-a-cap': block(2, 3, 14, 6, 3, 6, 0xef5350, 0xd32f2f),
      'mush-b-stem': block(-6, 1, 12, 3, 2, 3, 0xfff3e0, 0xffe0b2),
      'mush-b-cap': block(-6, 3, 12, 5, 2.5, 5, 0xab47bc, 0x8e24aa),

      // 鹅卵石小径（8 个同款石 → 1 实例化批·展示 W1-A）。
      ...steppingStones(),
    },
  };
}
