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

type Ent = WorldBlueprint['entities'][string];

// 一个体块：位姿(中心 x,y,z) + 尺寸(w,h,d) + 顶/侧色。rotY 可选（如让宝石斜摆）。
function block(x: number, y: number, z: number, w: number, h: number, d: number, top: number, side: number, rotY?: number): Ent {
  return {
    Transform3D: { x, y, z, ...(rotY !== undefined ? { rotY } : {}) },
    Mesh3D: { shape: 'box', width: w, height: h, depth: d, frontTint: side, backTint: side, edgeTint: top },
  };
}

/** 盒庭样例蓝图：草地台 + 抬升石台（站 Toad）+ 金阶梯 + 板条箱 + 终点宝石 + 蘑菇 + 天空盒 + 可控角色。 */
export function dioramaBlueprint(): WorldBlueprint {
  return {
    // 角色靠现成 velocity→motion-apply 走动（纯数据 sim·确定性）；其余全静态。
    capabilities: [motionApplyCapability],
    entities: {
      // 盒庭轨道相机（等距俯角环绕·注视场景中心略上方）
      cam: { Camera3D: { yaw: 0.72, pitch: 0.6, distance: 92, pivotX: 0, pivotY: 5, pivotZ: 0 } },

      // 天空盒：蓝天 → 浅地平线 + 程序化白云缓慢飘动
      sky: { Sky3D: { top: 0x4a90d9, bottom: 0xcfe9f7, clouds: true, cloudTint: 0xffffff, scroll: 1 } },

      // 可控角色（WASD/方向键 → Velocity → motion-apply 走动）：用 2D Transform，盒庭模式自动落到地面。
      // 红/白小蘑菇人。Transform.x→地面 X，Transform.y→地面 Z（景深）；起步站在草地中央。
      hero: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Velocity: { vx: 0, vy: 0, angular: 0 },
        Mesh3D: { shape: 'box', width: 4.5, height: 7, depth: 4.5, frontTint: 0xff7043, backTint: 0xf4511e, edgeTint: 0xffccbc },
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
    },
  };
}
