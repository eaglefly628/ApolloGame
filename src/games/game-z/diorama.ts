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
import { overlapDetect3dCapability } from '@skills/atoms/index.js';
import { MODEL_DUCK } from './assets.js';

type Ent = WorldBlueprint['entities'][string];

// 一个体块：位姿(中心 x,y,z) + 尺寸(w,h,d) + 顶/侧色。rotY 可选（如让宝石斜摆）。
function block(x: number, y: number, z: number, w: number, h: number, d: number, top: number, side: number, rotY?: number): Ent {
  return {
    Transform3D: { x, y, z, ...(rotY !== undefined ? { rotY } : {}) },
    Mesh3D: { shape: 'box', width: w, height: h, depth: d, frontTint: side, backTint: side, edgeTint: top },
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

/** 盒庭样例蓝图：草地台 + 抬升石台（站 Toad）+ 金阶梯 + 板条箱 + 终点宝石 + 蘑菇 + 鹅卵石径 + 天空盒 + 可控角色。 */
export function dioramaBlueprint(): WorldBlueprint {
  return {
    // 角色 velocity→motion-apply 走动 + overlap-detect-3d 3D 逻辑碰撞（确定性 sim·进 hash）。
    capabilities: [motionApplyCapability, overlapDetect3dCapability],
    entities: {
      // 盒庭相机（REQ-3D-Camera·语义参数全数据化）：轨道俯角环绕·fov/俯仰夹角进数据（不再写死在渲染器/胶水）。
      // 运行时：拖拽改 yaw/pitch、滚轮改 distance（行为层）；O 切正交、F 切跟随小黄鸭（game-z.ts 输入胶水）。
      cam: { Camera3D: { yaw: 0.72, pitch: 0.6, distance: 92, pivotX: 0, pivotY: 5, pivotZ: 0, fov: 38, pitchMin: 0.12, pitchMax: 1.45 } },

      // 数据化光照（Light3D·替原写死的灯）：暖白太阳（投软影）+ 冷蓝环境补光。
      sun: { Light3D: { kind: 'directional', color: 0xfff1d6, intensity: 1.6, castShadow: true } },
      fill: { Light3D: { kind: 'ambient', color: 0xbfd2ff, intensity: 0.45 } },

      // 后处理（Post3D）：移轴景深 → Captain Toad 微缩模型感（清晰带居中·上下渐糊）+ 轻泛光。
      post: { Post3D: { tiltShift: { focus: 0.52, intensity: 3.4 }, bloom: { strength: 0.35, radius: 0.5, threshold: 0.8 } } },

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

      // 草地大地台（顶在 y=0）
      ground: block(0, -2.5, 0, 70, 5, 70, 0x8bc34a, 0x5d4037),

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
