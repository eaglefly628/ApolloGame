// Game B ·《雀宴》—— 牌桌世界蓝图 = 纯数据（WorldBlueprint·S3 骨架）。
// 全件走引擎 render-only 3D 组件（Mesh3D/Material3D/Camera3D/Light3D/Glow3D/Post3D/Pickable3D）+
// 种子 PRNG 能力（RandomSeed·SessionIn.seed 唯一随机源·gdd §十二）——零手写 Three.js/零专属 system。
// 布局=scene-layout-handoff.md §二（归一 × U）；着色=theme.TINT（占位·S6 台账保号换真美术）。
// S3 摆拍口径：满 136 牌山 + 线框稿示意手牌静态陈列；洗牌/发牌/牌河/副露=S4 麻将核驱动。
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import { randomCapability } from '@atom-skills/index.js';
import { U, TINT, CAM_MAIN } from './theme.js';
import { wallLayout, handLayout, DEMO_HAND, DEMO_TSUMO, texKey, TILE_W, TILE_H, TILE_D } from './tiles.js';

export interface GameBConfig {
  seed: number; // SessionIn.seed（局外传入·缺省由宿主给定值·绝不裸 Math.random）
}

/** 手牌 3D 拾取信号名（Pickable3D → 宿主 pick() → S4 起 enqueueAction 入 sim）。 */
export const HAND_PICK_SIGNAL = 'hand-pick';

// 一个体块（Mesh3D box）：中心位姿 + 尺寸 + 顶/侧着色（top=四边含顶面·front/back=±z 面）。
function block(
  x: number, y: number, z: number,
  w: number, h: number, d: number,
  face: number, edge: number, rotY?: number,
): EntityBlueprint {
  return {
    Transform3D: { x, y, z, ...(rotY !== undefined ? { rotY } : {}) },
    Mesh3D: { shape: 'box', width: w, height: h, depth: d, frontTint: face, backTint: face, edgeTint: edge },
  };
}

export function buildTableBlueprint(config: GameBConfig): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {};

  // ── 确定性随机源（唯一 seed 入局·S4 洗牌/掷骰/AI 全由它派生）───────────────────────
  entities.rng = { RandomSeed: { seed: config.seed, sequence: 0 } };

  // ── 相机（主机位·俯视微倾 ~55°·机位表见 theme.CAM_MAIN/CAM_DICE/CAM_MOVES）─────────
  entities.cam = {
    Camera3D: {
      yaw: CAM_MAIN.yaw, pitch: CAM_MAIN.pitch, distance: CAM_MAIN.distance,
      pivotX: CAM_MAIN.pivotX, pivotY: CAM_MAIN.pivotY, pivotZ: CAM_MAIN.pivotZ,
      fov: CAM_MAIN.fov, projection: 'perspective', mode: 'orbit',
    },
  };

  // ── 光照（交接档 §二：暖白顶光 + 琥珀灯笼补光 + 环境底光；演出调光=S4 数据开关）────────
  entities['light-key'] = {
    Light3D: { kind: 'directional', color: TINT.keyLight, intensity: 1.0, dirX: 0.12, dirY: -1, dirZ: -0.2, castShadow: true },
  };
  entities['light-amb'] = { Light3D: { kind: 'ambient', color: 0xffe4d6, intensity: 0.42 } };
  entities['light-lan-e'] = { Light3D: { kind: 'point', color: TINT.fillLight, intensity: 0.35, x: 0.95 * U, y: 0.52 * U, z: -0.2 * U, range: 3.2 * U } };
  entities['light-lan-w'] = { Light3D: { kind: 'point', color: TINT.fillLight, intensity: 0.35, x: -0.95 * U, y: 0.52 * U, z: -0.2 * U, range: 3.2 * U } };

  // ── 后处理（夜宴暖调·数据即开·bloom 托灯笼光晕）────────────────────────────────────
  entities.post = {
    Post3D: {
      bloom: { strength: 0.25, radius: 0.6, threshold: 0.75 },
      grade: { exposure: 1.02, contrast: 1.05, saturation: 1.05, tint: 0xfff0e6 },
      vignette: { intensity: 0.3, smoothness: 0.4 },
      aa: true,
    },
  };

  // ── 桌（桌面中心=原点·桌面 2×2·桌高 0.55：呢面顶=y0·桌体向下·真美术=Model3D 位待 S6）──
  entities.felt = {
    Transform3D: { x: 0, y: -0.008 * U, z: 0 },
    Mesh3D: { shape: 'box', width: 1.8 * U, height: 0.016 * U, depth: 1.8 * U, frontTint: TINT.feltTop, edgeTint: TINT.feltTop },
    Material3D: { preset: 'matte', color: TINT.feltTop, roughness: 0.9, surface: { pattern: 'noise', tiles: 6, normal: 0.35, rough: 0.25 } },
  };
  entities.table = block(0, -0.016 * U - 0.267 * U, 0, 2 * U, 0.534 * U, 2 * U, TINT.wood, TINT.wood);

  // ── 座垫 ×4（四边中点外 0.55·扁圆）+ 点棒托 ×4（各席右手边缘·计数走 UI）──────────────
  const cushionY = -0.55 * U + 0.05 * U; // 地面=桌顶下 0.55·垫高 0.1
  for (const [id, cx, cz] of [
    ['cushion-s', 0, 1.55], ['cushion-n', 0, -1.55], ['cushion-e', 1.55, 0], ['cushion-w', -1.55, 0],
  ] as const) {
    entities[id] = {
      Transform3D: { x: cx * U, y: cushionY, z: cz * U },
      Mesh3D: { shape: 'cylinder', width: 0.5 * U, height: 0.1 * U, frontTint: TINT.cushion },
    };
  }
  for (const [id, tx, tz, rot] of [
    ['tray-s', 0.69, 0.83, 0], ['tray-n', -0.69, -0.83, 0], ['tray-e', 0.83, -0.69, Math.PI / 2], ['tray-w', -0.83, 0.69, Math.PI / 2],
  ] as const) {
    entities[id] = block(tx * U, 0.013 * U, tz * U, 0.36 * U, 0.026 * U, 0.11 * U, TINT.tray, TINT.tray, rot);
  }

  // ── 牌山 136（面朝下平躺·同款同色 → 引擎哑光实例化一批）────────────────────────────
  for (const t of wallLayout()) {
    entities[`wall-${t.side}-${t.stack}-${t.layer}`] = {
      Transform3D: { x: t.x, y: t.y, z: t.z, rotX: t.rotX, ...(t.rotY !== undefined ? { rotY: t.rotY } : {}) },
      Mesh3D: { shape: 'box', width: TILE_W, height: TILE_H, depth: TILE_D, frontTint: TINT.tileFace, backTint: TINT.tileBack, edgeTint: TINT.tileEdge },
    };
  }

  // ── 自家手牌 13+摸牌（立起面向镜头·占位包 PNG 贴面=Material3D map·可拾取）──────────────
  const hand = handLayout();
  const kinds = [...DEMO_HAND, DEMO_TSUMO];
  hand.forEach((p, i) => {
    entities[`hand-${i}`] = {
      Transform3D: { x: p.x, y: p.y, z: p.z },
      Mesh3D: { shape: 'box', width: TILE_W, height: TILE_H, depth: TILE_D, frontTint: TINT.tileFace, backTint: TINT.tileBack, edgeTint: TINT.tileEdge },
      Material3D: { preset: 'matte', color: 0xffffff, roughness: 0.35, map: texKey(kinds[i]) },
      Pickable3D: { signal: HAND_PICK_SIGNAL },
    };
  });

  // ── 骰 ×2（桌心右上偏移·Mesh3D.dieFaces 现成 3D 骰件·对面和 7；掷骰演出=S4 timeline）────
  const PIPS = [1, 6, 2, 5, 3, 4] as const; // 面序 [+X,-X,+Y,-Y,+Z,-Z]
  const die = (x: number, z: number, rotY: number): EntityBlueprint => ({
    Transform3D: { x, y: 0.03 * U + 0.001 * U, z, rotY },
    Mesh3D: {
      shape: 'box', width: 0.06 * U, height: 0.06 * U, depth: 0.06 * U, frontTint: TINT.die,
      dieFaces: PIPS.map((pip) => ({ color: TINT.die, pip })),
    },
  });
  entities['die-a'] = die(0.3 * U, -0.12 * U, 0.5);
  entities['die-b'] = die(0.38 * U, -0.05 * U, 2.2);

  // ── 供托位（桌心·立直棒摆位参考·S4 由 sim 摆真棒）——骨架不摆棒（供托 0）────────────────

  // ── 背景件（2.5D 舞台布景板·障子×2 北后方 + 灯笼×2 东西上方 + 月窗远景 + 地席）─────────
  entities.tatami = block(0, -0.55 * U - 0.015 * U, 0, 6.4 * U, 0.03 * U, 6.4 * U, TINT.tatami, TINT.tatami);
  for (const [id, sx] of [['shoji-l', -0.55], ['shoji-r', 0.55]] as const) {
    entities[id] = {
      Transform3D: { x: sx * U, y: 0.2 * U, z: -1.6 * U },
      Mesh3D: { shape: 'plane', width: 0.74 * U, height: 1.5 * U, frontTint: TINT.shoji },
    };
  }
  entities['moon-window'] = {
    Transform3D: { x: 1.2 * U, y: 0.7 * U, z: -1.9 * U },
    Mesh3D: { shape: 'plane', width: 1.0 * U, height: 0.5 * U, frontTint: TINT.moon },
  };
  for (const [id, lx] of [['lantern-e', 0.95], ['lantern-w', -0.95]] as const) {
    entities[id] = {
      Transform3D: { x: lx * U, y: 0.55 * U, z: -0.2 * U },
      Mesh3D: { shape: 'capsule', width: 0.17 * U, height: 0.26 * U, frontTint: TINT.lantern },
      Glow3D: { color: TINT.lanternGlow, scale: 0.7 * U, opacity: 0.55 },
    };
  }

  return { capabilities: [randomCapability], entities };
}
