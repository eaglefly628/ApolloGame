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
import { MODEL_FOX, MAT_PLANK_WOOD, MAT_STONE, MAT_RUNE } from './assets.js';

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
    // 材质铺陈：光面塑料 + 细微凸点浮雕（保留各自体色·比原扁平实例盒有质感·追逐焦点）。
    Material3D: { preset: 'plastic', color: body, surface: { pattern: 'bumps', tiles: 4, normal: 0.4, rough: 0.3 } },
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
      // 缺口 C 跟随柔化：follow{lag,lookAhead} → 镜头软跟鸭子（不硬贴·朝跑动方向轻预读）。
      // 缺口 B 震屏：shake{trigger} → 点物件时 game-z.ts bump trigger 抖一下（打击反馈）。
      cam: { Camera3D: { yaw: 0.7, pitch: 0.72, distance: 98, pivotX: 0, pivotY: 3, pivotZ: 0, fov: 44, mode: 'follow', target: 'hero', pitchMin: 0.12, pitchMax: 1.45, follow: { lag: 0.22, lookAhead: 0.18 }, shake: { trigger: 0, amp: 0.55, freq: 28, decay: 2.2 } } },

      // 数据化光照：暖白太阳（投软影）+ 冷蓝环境补光。
      sun: { Light3D: { kind: 'directional', color: 0xfff1d6, intensity: 1.05, castShadow: true } },
      fill: { Light3D: { kind: 'ambient', color: 0xbfd2ff, intensity: 0.55 } },

      // 后处理：AO + 色彩分级 + SMAA（intensity=AO 不透明度 0..1·渲染器钳死防黑屏）。
      // 缺口 E：vignette 暗角常驻聚焦 + flash 命中闪白（点物件时 game-z.ts bump flash.trigger 全屏闪一下·与震屏同触发）。
      post: { Post3D: { ao: { intensity: 0.85, radius: 5, scale: 1 }, grade: { exposure: 1.02, contrast: 1.08, saturation: 1.12, brightness: 0, tint: 0xfff6ec }, aa: true, vignette: { intensity: 0.42, smoothness: 0.5 }, flash: { trigger: 0, color: 0xffffff, decay: 3 } } },
      // 距离雾（远处柔化·配缩小后的竞技场）。
      fog: { Fog3D: { color: 0xcfe9f7, near: 130, far: 420 } },
      // 天空盒 + IBL（env=环境光照强度·PBR 金属/玻璃靠它反射成像）。
      sky: { Sky3D: { top: 0x4a90d9, bottom: 0xcfe9f7, clouds: true, cloudTint: 0xffffff, scroll: 1, env: 0.55 } },

      // 🦊 狐狸（hero）：AI 自动绕赛道跑（game-z.ts 胶水每帧把 Velocity 设成赛道切线 + 朝向·WASD 可接管）。
      // **骨骼动画 demo**：glTF Fox 自带 Survey/Walk/Run·这里播 'Run'（边跑边迈腿）。Collider3D 胶囊撞障碍被推开·头顶飘字。
      hero: {
        Transform: { x: TRACK_R, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Velocity: { vx: 0, vy: 0, angular: 0 },
        Model3D: { modelKey: MODEL_FOX, scale: 0.09 }, // Fox 模型尺度大(~70u)→缩到盒庭尺度
        AnimState3D: { clip: 'Run', speed: 1.5 }, // 播奔跑动画（骨骼）
        Collider3D: { kind: 'capsule', radius: 2, height: 6 },
        Trail3D: { segments: 30, width: 1.8, color: 0x66e0ff, minDist: 0.4, blend: 'add' }, // 缺口 D：奔跑发光拖尾（绕赛道留青蓝残影·TrailSystem 读 2D Transform 地面位）
        // 富世界空间 UI（REQ-3D-世界空间 UI·#1 面板 + #2 跟随单位）：名牌 Panel（名字 Label + 体力 ProgressBar）
        // 挂 LayoutNode·随奔跑的狐狸每帧跟随投影（血条跟单位·背相机/出屏自动隐）。证明「世界 UI = 富 LayoutNode 锚世界物件」。
        WorldUI3D: { offsetY: 10, node: {
          type: 'Panel', id: 'hero-plate', props: { bare: true }, layout: { gap: 2 },
          children: [
            { type: 'Label', id: 'hero-name', props: { text: '🦊 狐狸', size: 'sm', glow: true } },
            { type: 'ProgressBar', id: 'hero-sta', props: { value: 0.72, tone: 'ok', label: '体力', showValue: true } },
          ],
        } },
      },

      // 中心信标（金属柱 + 魔法喷泉 VFX）：赛道圆心的焦点，鸭子绕它跑。锤打金面（bumps 浮雕·反射更活）。
      // Pickable3D：点它 → 拾取（渲染器 pick 射线命中包围盒 → 发信号 'poke'·arg=实体 id·自证 3D 对象拾取）。
      beacon: { ...block(0, 4, 0, 4, 8, 4, 0xffd54f, 0xffb300), Material3D: { preset: 'gold', surface: { pattern: 'bumps', tiles: 5, normal: 0.5, rough: 0.3 } }, Pickable3D: { signal: 'poke' } },

      // 🖼 真实贴图木箱（REQ-Resource ①①④·验收）：物件只引**材质数据资产** materialRef=MAT_PLANK_WOOD
      // （该材质在索引里 = wood 预设 + 木板 albedo/法线 texture key）。渲染器据 materialRef 查材质目录合成 → 取图挂上。
      // 证明「材质=引 texture key 的数据资产·物件按 key 引材质」端到端通（非物件内联硬编码 preset+贴图）。
      'plank-crate': {
        ...block(11, 4, 6, 8, 8, 8, 0x9c6b3f, 0x9c6b3f),
        Material3D: { preset: 'matte', materialRef: MAT_PLANK_WOOD, tiling: { repeat: 2 } }, // tiling ②：木板纹平铺 2×2（贴图槽补齐）
        Pickable3D: { signal: 'poke' }, // 可拾取（点选自证）
      },
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

      // 障碍（碰撞 + 寻路双用·避开鸭子赛道环 R=30）：内圈三石墩（逼追兵绕行）+ 外圈四石柱（金属 + 素石·视觉边界）。
      // 材质铺陈：石墩/素石柱引复用材质数据资产 MAT_STONE（一处改色·全生效）+ 各自程序化浮雕（凹凸石面/风化）。
      'rock-1': { ...obstacle(15, 2, 6, 5, 6, 0x9e9e9e, 0x616161), Material3D: { preset: 'rock', materialRef: MAT_STONE, surface: { pattern: 'bumps', tiles: 3, normal: 1.2, rough: 0.5, scale: 1.2 } } },
      'rock-2': { ...obstacle(-9, 15, 6, 5, 6, 0x9e9e9e, 0x616161), Material3D: { preset: 'rock', materialRef: MAT_STONE, surface: { pattern: 'bumps', tiles: 3, normal: 1.2, rough: 0.5, scale: 1.4 } } },
      'rock-3': { ...obstacle(-13, -11, 6, 5, 6, 0x9e9e9e, 0x616161), Material3D: { preset: 'rock', materialRef: MAT_STONE, surface: { pattern: 'noise', tiles: 2, normal: 1.3, rough: 0.5, scale: 1.1 } } },
      'pillar-1': { ...obstacle(52, 30, 7, 9, 7, 0x8d6e63, 0x5d4037), Material3D: { preset: 'steel', surface: { pattern: 'scratches', tiles: 3, normal: 0.5, rough: 0.6 } } }, // PBR 钢·拉丝
      'pillar-2': { ...obstacle(-50, 34, 7, 9, 7, 0x8d6e63, 0x5d4037), Material3D: { preset: 'copper', surface: { pattern: 'bumps', tiles: 5, normal: 0.5, rough: 0.35 } } }, // PBR 铜·锤打
      'pillar-3': { ...obstacle(46, -50, 7, 9, 7, 0x8d6e63, 0x5d4037), Material3D: { preset: 'rock', materialRef: MAT_STONE, surface: { pattern: 'noise', tiles: 3, normal: 1.0, rough: 0.6 } } }, // 素石柱·风化
      'pillar-4': { ...obstacle(-48, -46, 7, 9, 7, 0x8d6e63, 0x5d4037), Material3D: { preset: 'rock', materialRef: MAT_STONE, surface: { pattern: 'noise', tiles: 3, normal: 1.0, rough: 0.6, scale: 1.2 } } },

      // 真物理色子（cannon-es·render-only 表现·掉落翻滚·「🎲 掷骰子」按钮重掷）：落在赛道中心区。
      'die-1': die(6, 10, 0xe53935),
      'die-2': die(11, 6, 0x1e88e5),
      'die-3': die(3, 13, 0x43a047),

      // 草地竞技场（顶在 y=0·缩小到 160²·owner「缩小一半 + 去掉低画质小树」）。
      // 材质铺陈：草地色 matte + 程序化起伏浮雕（noise·大 tiles 铺满大地面）→ 掠光下有草皮质感·不再纯平板。
      ground: { ...block(0, -2.5, 0, 160, 5, 160, 0x7cb342, 0x5d4037), Material3D: { preset: 'matte', color: 0x7cb342, surface: { pattern: 'noise', tiles: 16, normal: 0.7, rough: 0.55, scale: 1.5 } } },

      // 🧱 新特性活展台（南侧一排·本会话新能力集中展示）：四种新图元(②) × 各挂不同 PBR 材质 × Anim3D 程序化动画
      // (自转/浮动) × Pickable3D 点选拾取(①·证明拾取在新图元 + 动画物件上也命中)。全纯数据·零专属代码·零新资产。
      // · cylinder：拉丝钢(PBR 金属+surface) + 匀速自转 + 可拾取
      // Anim3D 方法集展示（owner 2026-07-06）：各图元叠加**入场 ease(scale 0→1·outBack 弹出·错峰 delay)** + 循环通道
      //   （spin 自转 / osc 波形振荡 / noise 有机漂移）——同 field 叠加、loop+once 共存，全纯数据。
      'prim-cylinder': {
        Transform3D: { x: -22, y: 4, z: 46 }, Mesh3D: { shape: 'cylinder', width: 6, height: 8, frontTint: 0xc4c7c7 },
        Material3D: { preset: 'steel', surface: { pattern: 'scratches', tiles: 3, normal: 0.5, rough: 0.6 } },
        Anim3D: { channels: [{ kind: 'spin', field: 'rotY', rate: 0.9 }, { kind: 'ease', field: 'scale', from: 0, to: 1, dur: 0.5, curve: 'outBack', delay: 0.0 }] }, Pickable3D: { signal: 'poke' },
      },
      // · cone：自发光 + Glow3D 暖光晕 + 自转 + 入场弹出 + 可拾取
      'prim-cone': {
        Transform3D: { x: -8, y: 4.5, z: 46 }, Mesh3D: { shape: 'cone', width: 7, height: 9, frontTint: 0xfff0a0 },
        Material3D: { preset: 'emissive' }, Glow3D: { color: 0xffe08a, scale: 16, opacity: 0.55 },
        Anim3D: { channels: [{ kind: 'spin', field: 'rotY', rate: 1.2 }, { kind: 'ease', field: 'scale', from: 0, to: 1, dur: 0.5, curve: 'outBack', delay: 0.15 }] }, Pickable3D: { signal: 'poke' },
      },
      // · capsule：铜(PBR) + **osc 三角波**上下弹跳(机械感·区别正弦 bob) + 入场弹出 + 可拾取
      'prim-capsule': {
        Transform3D: { x: 6, y: 6.5, z: 46 }, Mesh3D: { shape: 'capsule', width: 5, height: 11, frontTint: 0xf7bd9e },
        Material3D: { preset: 'copper', surface: { pattern: 'bumps', tiles: 5, normal: 0.4, rough: 0.35 } },
        Anim3D: { channels: [{ kind: 'osc', field: 'y', wave: 'triangle', amp: 1.0, freq: 1.6 }, { kind: 'ease', field: 'scale', from: 0, to: 1, dur: 0.5, curve: 'outBack', delay: 0.3 }] }, Pickable3D: { signal: 'poke' },
      },
      // · torus：金(PBR) + 倾斜自转 + 入场弹出 + 可拾取
      'prim-torus': {
        Transform3D: { x: 20, y: 6, z: 46, rotX: 1.2 }, Mesh3D: { shape: 'torus', width: 9, height: 9, frontTint: 0xffd991, tube: 0.35 },
        Material3D: { preset: 'gold', surface: { pattern: 'bumps', tiles: 6, normal: 0.4, rough: 0.28 } },
        Anim3D: { channels: [{ kind: 'spin', field: 'rotY', rate: 1.4 }, { kind: 'ease', field: 'scale', from: 0, to: 1, dur: 0.5, curve: 'outBack', delay: 0.45 }] }, Pickable3D: { signal: 'poke' },
      },

      // · 符文发光板（REQ-3D ④ emissiveMap 展示·暗底 box + 自发光贴图→符文处发青光）+ 缓慢自转 + 可拾取。
      'rune-slab': {
        Transform3D: { x: 34, y: 5, z: 46 }, Mesh3D: { shape: 'box', width: 8, height: 8, depth: 3, frontTint: 0x0e1419 },
        Material3D: { preset: 'matte', materialRef: MAT_RUNE, tiling: { repeat: 1 } },
        // 自转 + **noise 有机漂移**(y·神经质浮动·非正弦) + 入场弹出——展示 loop(spin/noise)+once(ease) 叠加。
        Anim3D: { channels: [{ kind: 'spin', field: 'rotY', rate: 0.6 }, { kind: 'noise', field: 'y', amp: 0.6, freq: 1.3, seed: 3 }, { kind: 'ease', field: 'scale', from: 0, to: 1, dur: 0.6, curve: 'outBack', delay: 0.6 }] }, Pickable3D: { signal: 'poke' },
      },

      // 🎮 超休闲手感展台（南侧二排·本会话缺口 A-F 活样例·全 render-only 纯数据）：
      // 缺口 A 挤压拉伸：弹跳球——osc y 弹起 + osc scaleY/scaleX 反相（底部压扁·保体积）。分轴非等比缩放的活证。
      'fx-squash': {
        Transform3D: { x: -30, y: 5, z: 62 },
        Mesh3D: { shape: 'sphere', width: 5, height: 5, frontTint: 0xff5252 },
        Material3D: { preset: 'plastic', color: 0xff5252 },
        Anim3D: { channels: [
          { kind: 'osc', field: 'y', wave: 'sine', amp: 3.2, freq: 3.0, phase: 0 },                    // 弹跳高度
          { kind: 'osc', field: 'scaleY', wave: 'sine', amp: 0.28, freq: 3.0, phase: Math.PI / 2 },     // 落地压扁（相位对齐底部）
          { kind: 'osc', field: 'scaleX', wave: 'sine', amp: -0.28, freq: 3.0, phase: Math.PI / 2 },     // 反相 → 横向鼓（保体积）
        ] },
        WorldUI3D: { text: 'A 挤压拉伸', offsetY: 6, size: 'sm', color: 'warn' },
      },
      // 缺口 F 卡通着色：MeshToonMaterial（gradientMap 3 阶·硬分段明暗·cel 观感）+ 自转。
      'fx-toon': {
        Transform3D: { x: -16, y: 5, z: 62 },
        Mesh3D: { shape: 'sphere', width: 6, height: 6, frontTint: 0xffffff },
        Material3D: { preset: 'jade', shading: 'toon', toonSteps: 3 },
        Anim3D: { channels: [{ kind: 'spin', field: 'rotY', rate: 0.8 }, { kind: 'ease', field: 'scale', from: 0, to: 1, dur: 0.5, curve: 'outBack', delay: 0.2 }] },
        WorldUI3D: { text: 'F 卡通 toon', offsetY: 6, size: 'sm', color: 'jade' },
      },
      // 缺口 F 平涂着色：MeshBasicMaterial（无光·纯亮色·超休闲 Helix 招牌观感）。
      'fx-flat': {
        Transform3D: { x: -2, y: 5, z: 62 },
        Mesh3D: { shape: 'sphere', width: 6, height: 6, frontTint: 0xffffff },
        Material3D: { preset: 'gold', shading: 'flat', color: 0xffca28 },
        Anim3D: { channels: [{ kind: 'spin', field: 'rotY', rate: 0.8 }, { kind: 'ease', field: 'scale', from: 0, to: 1, dur: 0.5, curve: 'outBack', delay: 0.35 }] },
        WorldUI3D: { text: 'F 平涂 flat', offsetY: 6, size: 'sm', color: 'gold' },
      },
      // 缺口 D 拖尾（静态展台版）：绕小圈飞的发光球留丝带——osc x/z 相位差 π/2 = 环绕运动 + Trail3D。
      'fx-trail': {
        Transform3D: { x: 16, y: 7, z: 62 },
        Mesh3D: { shape: 'sphere', width: 3, height: 3, frontTint: 0xffe082 },
        Material3D: { preset: 'emissive' }, Glow3D: { color: 0xffe082, scale: 10, opacity: 0.5 },
        Anim3D: { channels: [
          { kind: 'osc', field: 'x', wave: 'sine', amp: 7, freq: 1.6, phase: 0 },
          { kind: 'osc', field: 'z', wave: 'sine', amp: 7, freq: 1.6, phase: Math.PI / 2 }, // x/z 相位差 π/2 = 圆周
        ] },
        Trail3D: { segments: 40, width: 1.2, color: 0xffd54f, minDist: 0.15, blend: 'add' },
        WorldUI3D: { text: 'D 拖尾', offsetY: 5, size: 'sm', color: 'gold' },
      },

      // 北侧 PBR 材质陈列台（材质球·大字标名·调试面板「🔬 看材质」一键看）。
      ...materialBoard(),
    },
  };
}
