// Game Z · 3D 盒庭 —— 「永远追逐」关卡（endless chase）。
//
// 玩法：鸭子(hero) AI 绕环形赛道自动跑（运行时输入胶水写 Velocity·同 WASD 先例·见 game-z.ts），
// 追兵(NavAgent target=hero) 循自动烘焙的 NavGraph 一路追逐，相机跟随鸭子。一切都在动。
// 纯数据蓝图 + 引擎能力（motion-apply / overlap-detect-3d / navmesh-bake / pathfind / collision-resolve-3d），零专属 system。
// 旁置：北侧 PBR 材质陈列台（材质球·IBL 反射·调试面板「🔬 看材质」一键看）。
//
// 盒面着色约定（Mesh3D box）：top=主色（顶/侧·俯视最显眼）、front=暗一档阴面。盒中心 y=h/2 时下沿坐地（地台顶在 y=0）。

import type { WorldBlueprint } from '../../assembly/demo.assembly.js';
import { motionApplyCapability } from '@skills/tier1/index.js';
import { overlapDetect3dCapability, navmeshBakeCapability, collisionResolve3dCapability } from '@skills/atoms/index.js';
import { pathfindCapability } from '@skills/tier2/index.js';
import { MODEL_DUCK } from './assets.js';

type Ent = WorldBlueprint['entities'][string];

// 赛道半径（鸭子绕跑·game-z.ts 自动跑胶水按此把 Velocity 设成切线方向）。
export const TRACK_R = 30;

// 一个体块：位姿(中心 x,y,z) + 尺寸(w,h,d) + 顶/侧色。rotY 可选。
function block(x: number, y: number, z: number, w: number, h: number, d: number, top: number, side: number, rotY?: number): Ent {
  return {
    Transform3D: { x, y, z, ...(rotY !== undefined ? { rotY } : {}) },
    Mesh3D: { shape: 'box', width: w, height: h, depth: d, frontTint: side, backTint: side, edgeTint: top },
  };
}

// 实心障碍（碰撞 + 寻路双用）：2D Transform(碰撞/寻路 planar·x→X、y→Z) + Transform3D(render 精确位姿) + Mesh3D + Collider3D box。
// 下沿坐地（baseY=0·中心 y=h/2）。navmesh-bake 把它栅格化成封格 → 自动生成的 NavGraph 让追兵绕开它（「寻路碰撞」）。
function obstacle(x: number, z: number, w: number, h: number, d: number, top: number, side: number): Ent {
  return {
    Transform: { x, y: z, rotation: 0, scaleX: 1, scaleY: 1 },
    Transform3D: { x, y: h / 2, z },
    Mesh3D: { shape: 'box', width: w, height: h, depth: d, frontTint: side, backTint: side, edgeTint: top },
    Collider3D: { kind: 'box', halfX: w / 2, halfY: h / 2, halfZ: d / 2 },
  };
}

// ── PBR 材质陈列台（TA Phase 5·「我怎么测材质」）──────────────────────────────────────────────
// 一排**材质球**，每球挂一种闭集预设 + 头顶飘字标名（放大字号），摆在北侧独立石台上、IBL 环境反射照亮，
// 让金属能照出反射、玻璃能透光 → 一眼对比所有材质。纯数据：样品 = Mesh3D sphere + Material3D{preset}。
// surface=程序化 normal/roughness 贴图（渲染器据参数生成·零美术文件）：给岩石/钢/金/木挂表面起伏，一眼看出法线/粗糙图效果。
type SD = { pattern: 'bumps' | 'noise' | 'scratches'; tiles?: number; normal?: number; rough?: number; scale?: number };
const MAT_SAMPLES: { preset: string; label: string; color?: number; surface?: SD }[] = [
  { preset: 'matte', label: '哑光', color: 0xcccccc },
  { preset: 'plastic', label: '塑料', color: 0xcc4444 },
  { preset: 'rock', label: '岩石', surface: { pattern: 'noise', tiles: 2, normal: 1.3, rough: 0.5, scale: 1.3 } }, // 凹凸石面
  { preset: 'dirt', label: '土', surface: { pattern: 'noise', tiles: 3, normal: 0.9, rough: 0.4 } },
  { preset: 'wood', label: '木', surface: { pattern: 'scratches', tiles: 2, normal: 0.7, rough: 0.4, scale: 1.2 } }, // 木纹
  { preset: 'steel', label: '钢', surface: { pattern: 'scratches', tiles: 3, normal: 0.5, rough: 0.6 } }, // 拉丝金属
  { preset: 'iron', label: '铁' },
  { preset: 'gold', label: '金', surface: { pattern: 'bumps', tiles: 5, normal: 0.5, rough: 0.3 } }, // 锤打金面
  { preset: 'copper', label: '铜' },
  { preset: 'glass', label: '玻璃' },
  { preset: 'emissive', label: '自发光' },
];
const BOARD_Z = -58; // 陈列台 Z（赛道外·北侧）
function materialBoard(): Record<string, Ent> {
  const out: Record<string, Ent> = {};
  const n = MAT_SAMPLES.length;
  const gap = 7, z = BOARD_Z, baseTop = 4, dia = 5;
  const x0 = -((n - 1) * gap) / 2;
  out['matboard-base'] = block(0, baseTop / 2, z, n * gap + 4, baseTop, 9, 0x455a64, 0x37474f);
  MAT_SAMPLES.forEach((s, i) => {
    const x = x0 + i * gap;
    out[`mat-${s.preset}`] = {
      Transform3D: { x, y: baseTop + dia / 2, z }, // 球坐在石台上（中心 = 台顶 + 半径）
      Mesh3D: { shape: 'sphere', width: dia, height: dia, frontTint: 0xffffff },
      Material3D: { preset: s.preset, ...(s.color !== undefined ? { color: s.color } : {}), ...(s.surface ? { surface: s.surface } : {}) },
      WorldUI3D: { text: s.label, offsetY: dia / 2 + 4, size: 'md', glow: true }, // 字号放大 xs→md（owner「字太小」）
    };
  });
  return out;
}
// 看材质机位（调试面板「🔬 看材质陈列台」按钮 → 切到此机位正对陈列台·render-only 写 Camera3D）。
export const BOARD_CAM = { yaw: 0, pitch: 0.4, distance: 82, pivotX: -12, pivotY: 8, pivotZ: BOARD_Z };
// 总览机位（「🏠 回总览」按钮）：俯瞰整个赛道竞技场。
export const HOME_CAM = { yaw: 0.7, pitch: 0.82, distance: 168, pivotX: 0, pivotY: 2, pivotZ: 0 };

// 一只追兵（NavAgent + Relation(target=hero) → pathfind 沿自动 NavGraph 追鸭子）。light 给前两只（动态光预算 2 盏）。
function pursuer(x: number, z: number, body: number, edge: number, label: string, color: string, light?: { color: number; intensity: number; range: number }): Ent {
  return {
    Transform: { x, y: z, rotation: 0, scaleX: 1, scaleY: 1 },
    Velocity: { vx: 0, vy: 0, angular: 0 },
    Mesh3D: { shape: 'box', width: 3.4, height: 3.4, depth: 3.4, frontTint: body, backTint: body, edgeTint: edge },
    NavAgent: { speed: 0.5, arriveRange: 5 }, // 略慢于鸭子自动跑速（0.58）→ 永远在后面追（追不太上）
    Relation: { kind: 'target', targetId: 'hero' },
    ...(light ? { Light3D: { kind: 'point' as const, color: light.color, intensity: light.intensity, range: light.range, baseY: 5 } } : {}),
    WorldUI3D: { text: label, offsetY: 5, size: 'sm', color },
  };
}

// 一颗色子（真物理刚体·render-only 表现·cannon-es 驱动）：起步抬高 → 落地翻滚 → 静稳。塑料材质 + 初角速度翻滚。
// Material3D 路径走单 mesh → applyPose 用物理写回的 quat（无万向锁翻滚）。RigidBody3D 是 render-only·不进 hash。
function die(x: number, z: number, color: number): Ent {
  return {
    Transform3D: { x, y: 14, z },
    Mesh3D: { shape: 'box', width: 4, height: 4, depth: 4, frontTint: 0xffffff, backTint: 0xffffff, edgeTint: 0xffffff },
    Material3D: { preset: 'plastic', color },
    RigidBody3D: { shape: 'box', mass: 1, restitution: 0.45, avx: 7, avy: 5, avz: 6 },
  };
}

/** 「永远追逐」蓝图：环形赛道 + AI 自动跑的鸭子 + 三只追兵 + 中心信标喷泉 + 障碍 + 物理色子 + 北侧材质陈列台 + 天空盒。 */
export function dioramaBlueprint(): WorldBlueprint {
  return {
    capabilities: [motionApplyCapability, overlapDetect3dCapability, collisionResolve3dCapability, navmeshBakeCapability, pathfindCapability],
    entities: {
      // 相机：**跟随鸭子**（mode:'follow'·跑酷视角）。F 切环绕、O 切正交、按钮切总览/看材质。
      cam: { Camera3D: { yaw: 0.7, pitch: 0.72, distance: 98, pivotX: 0, pivotY: 3, pivotZ: 0, fov: 44, mode: 'follow', target: 'hero', pitchMin: 0.12, pitchMax: 1.45 } },

      // 数据化光照：暖白太阳（投软影）+ 冷蓝环境补光。
      sun: { Light3D: { kind: 'directional', color: 0xfff1d6, intensity: 1.05, castShadow: true } },
      fill: { Light3D: { kind: 'ambient', color: 0xbfd2ff, intensity: 0.55 } },

      // 后处理：AO + 色彩分级 + SMAA（intensity=AO 不透明度 0..1·渲染器钳死防黑屏）。
      post: { Post3D: { ao: { intensity: 0.85, radius: 5, scale: 1 }, grade: { exposure: 1.02, contrast: 1.08, saturation: 1.12, brightness: 0, tint: 0xfff6ec }, aa: true } },
      // 距离雾（远处柔化·配缩小后的竞技场）。
      fog: { Fog3D: { color: 0xcfe9f7, near: 130, far: 420 } },
      // 天空盒 + IBL（env=环境光照强度·PBR 金属/玻璃靠它反射成像）。
      sky: { Sky3D: { top: 0x4a90d9, bottom: 0xcfe9f7, clouds: true, cloudTint: 0xffffff, scroll: 1, env: 0.55 } },

      // 🦆 鸭子（hero）：AI 自动绕赛道跑（game-z.ts 胶水每帧把 Velocity 设成赛道切线·WASD 可接管）。
      // 真模型 glTF·Collider3D 竖直胶囊（撞障碍被 collision-resolve 推开）·头顶飘字。起步在赛道右侧 (X=TRACK_R)。
      hero: {
        Transform: { x: TRACK_R, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Velocity: { vx: 0, vy: 0, angular: 0 },
        Model3D: { modelKey: MODEL_DUCK, scale: 3.2 },
        Collider3D: { kind: 'capsule', radius: 2, height: 6 },
        WorldUI3D: { text: '🦆 鸭子', offsetY: 9, size: 'sm', glow: true },
      },

      // 中心信标（金属柱 + 魔法喷泉 VFX）：赛道圆心的焦点，鸭子绕它跑。
      beacon: { ...block(0, 4, 0, 4, 8, 4, 0xffd54f, 0xffb300), Material3D: { preset: 'gold' } },
      'vfx-beacon': {
        Vfx3D: {
          x: 0, y: 9, z: 0, shape: 'cone', coneAngle: 0.5, rate: 120, lifetime: 1.3, lifeVar: 0.3,
          speed: 9, speedVar: 3, gravity: 11, size: 2.4, max: 240, blend: 'add',
          sizeCurve: { keys: [{ t: 0, v: 0.2 }, { t: 0.15, v: 1 }, { t: 1, v: 0 }], mode: 'smooth' },
          colorGradient: { stops: [{ t: 0, color: 0xfff6c0, alpha: 1 }, { t: 0.5, color: 0x4dd0e1, alpha: 1 }, { t: 1, color: 0x26a69a, alpha: 0 }] },
        },
      },

      // 三只追兵（从鸭子后方出发·鸭子起步在 (30,0) 向 +Z 跑 → 后方=−Z 侧·循 NavGraph 追逐）。前两只带动态点光。
      seeker: pursuer(30, -16, 0xff7043, 0xffab91, '追兵·橙', 'warn', { color: 0xffb060, intensity: 120, range: 30 }),
      'seeker-2': pursuer(38, -26, 0x42a5f5, 0x90caf9, '追兵·蓝', 'jade', { color: 0x6cc6ff, intensity: 110, range: 28 }),
      'seeker-3': pursuer(22, -28, 0xab47bc, 0xce93d8, '追兵·紫', 'danger'),

      // 导航网格（罩住竞技场·自动烘焙 NavGraph 给 pathfind·零手摆航点）。
      nav: { NavMesh: { minX: -72, minZ: -72, maxX: 72, maxZ: 72, cellSize: 3, agentRadius: 2.6 } },

      // 障碍（碰撞 + 寻路双用·避开鸭子赛道环 R=30）：内圈三石墩（逼追兵绕行）+ 外圈四石柱（部分 PBR 金属·视觉边界）。
      'rock-1': obstacle(15, 2, 6, 5, 6, 0x9e9e9e, 0x616161),
      'rock-2': obstacle(-9, 15, 6, 5, 6, 0x9e9e9e, 0x616161),
      'rock-3': obstacle(-13, -11, 6, 5, 6, 0x9e9e9e, 0x616161),
      'pillar-1': { ...obstacle(52, 30, 7, 9, 7, 0x8d6e63, 0x5d4037), Material3D: { preset: 'steel' } }, // PBR 钢
      'pillar-2': { ...obstacle(-50, 34, 7, 9, 7, 0x8d6e63, 0x5d4037), Material3D: { preset: 'copper' } }, // PBR 铜
      'pillar-3': obstacle(46, -50, 7, 9, 7, 0x8d6e63, 0x5d4037),
      'pillar-4': obstacle(-48, -46, 7, 9, 7, 0x8d6e63, 0x5d4037),

      // 真物理色子（cannon-es·render-only 表现·掉落翻滚·「🎲 掷骰子」按钮重掷）：落在赛道中心区。
      'die-1': die(6, 10, 0xe53935),
      'die-2': die(11, 6, 0x1e88e5),
      'die-3': die(3, 13, 0x43a047),

      // 草地竞技场（顶在 y=0·缩小到 160²·owner「缩小一半 + 去掉低画质小树」）。
      ground: block(0, -2.5, 0, 160, 5, 160, 0x8bc34a, 0x5d4037),

      // 北侧 PBR 材质陈列台（材质球·大字标名·调试面板「🔬 看材质」一键看）。
      ...materialBoard(),
    },
  };
}
