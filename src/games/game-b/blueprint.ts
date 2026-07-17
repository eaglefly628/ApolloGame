// Game B ·《雀宴》—— 牌桌世界蓝图 = 纯数据（WorldBlueprint·S3 骨架·视觉重做版）。
// owner 2026-07-17「好好想想麻将什么样子」——照电子麻将（雀魂/天凤）视觉惯例重排：
//   自家手牌=屏幕底部一大排·牌面清晰朝玩家（body 白牌身 + 正面 plane 贴牌面·牌面只在正面，
//   不再 Material3D.map 贴满 6 面糊成「怪双面牌」）；三家=红牌背立牌围三面；牌山=红牌背方墙；
//   各家牌河=弃牌摊开（静态定格「一局进行中」）；中央=宝牌指示 + 骰。
// 全件走引擎 render-only 3D 组件（Mesh3D/Material3D/Camera3D/Light3D/Glow3D/Post3D/Pickable3D）+
// 种子 PRNG（RandomSeed·唯一随机源·gdd §十二）——零手写 Three.js/零专属 system。
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import { randomCapability } from '@atom-skills/index.js';
import { U, TINT, CAM_MAIN } from './theme.js';
import {
  wallLayout, sideHandLayout, riverLayout, handLayout,
  DEMO_HAND, DEMO_TSUMO, RIVER_DEMO, texKey,
  HAND_W, HAND_H, HAND_D, SM_W, SM_H, SM_D, type Seat, type TileKind,
} from './tiles.js';

export interface GameBConfig {
  seed: number; // SessionIn.seed（局外传入·缺省由宿主给定值·绝不裸 Math.random）
}

/** 手牌 3D 拾取信号名（Pickable3D → 宿主 pick() → S4 起 enqueueAction 入 sim）。 */
export const HAND_PICK_SIGNAL = 'hand-pick';

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

// 红牌背牌（牌山/三家手牌·纯色 box·一眼是背面）。pose 含 rotX/rotY。
function backTile(p: { x: number; y: number; z: number; rotX?: number; rotY?: number }): EntityBlueprint {
  return {
    Transform3D: { x: p.x, y: p.y, z: p.z, ...(p.rotX !== undefined ? { rotX: p.rotX } : {}), ...(p.rotY !== undefined ? { rotY: p.rotY } : {}) },
    Mesh3D: { shape: 'box', width: SM_W, height: SM_H, depth: SM_D, frontTint: TINT.tileBack, backTint: TINT.tileBack, edgeTint: TINT.tileBackEdge },
    Material3D: { preset: 'matte', color: TINT.tileBack, roughness: 0.5 },
  };
}

// 牌面朝上/朝前的一张（牌河 / 宝牌指示·plane 贴牌面·只正面显图）。
function faceTile(kind: TileKind, p: { x: number; y: number; z: number; rotX?: number; rotY?: number }): EntityBlueprint {
  return {
    Transform3D: { x: p.x, y: p.y, z: p.z, ...(p.rotX !== undefined ? { rotX: p.rotX } : {}), ...(p.rotY !== undefined ? { rotY: p.rotY } : {}) },
    Mesh3D: { shape: 'plane', width: SM_W, height: SM_H, frontTint: TINT.tileFaceFallback },
    Material3D: { preset: 'matte', color: 0xffffff, roughness: 0.4, map: texKey(kind) },
  };
}

export function buildTableBlueprint(config: GameBConfig): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {};

  // ── 确定性随机源（唯一 seed·S4 洗牌/掷骰/AI 全由它派生）─────────────────────────────
  entities.rng = { RandomSeed: { seed: config.seed, sequence: 0 } };

  // ── 相机（雀魂式主机位·压低聚焦自家手牌）───────────────────────────────────────────
  entities.cam = {
    Camera3D: {
      yaw: CAM_MAIN.yaw, pitch: CAM_MAIN.pitch, distance: CAM_MAIN.distance,
      pivotX: CAM_MAIN.pivotX, pivotY: CAM_MAIN.pivotY, pivotZ: CAM_MAIN.pivotZ,
      fov: CAM_MAIN.fov, projection: 'perspective', mode: 'orbit',
    },
  };

  // ── 光照（暖白顶光 + 琥珀灯笼补光 + 环境底光）──────────────────────────────────────
  entities['light-key'] = {
    Light3D: { kind: 'directional', color: TINT.keyLight, intensity: 1.05, dirX: 0.1, dirY: -1, dirZ: -0.15, castShadow: true },
  };
  entities['light-amb'] = { Light3D: { kind: 'ambient', color: 0xffe8d8, intensity: 0.5 } };
  entities['light-lan-e'] = { Light3D: { kind: 'point', color: TINT.fillLight, intensity: 0.4, x: 0.95 * U, y: 0.52 * U, z: -0.2 * U, range: 3.4 * U } };
  entities['light-lan-w'] = { Light3D: { kind: 'point', color: TINT.fillLight, intensity: 0.4, x: -0.95 * U, y: 0.52 * U, z: -0.2 * U, range: 3.4 * U } };

  // ── 后处理（夜宴暖调）─────────────────────────────────────────────────────────────
  entities.post = {
    Post3D: {
      bloom: { strength: 0.22, radius: 0.6, threshold: 0.8 },
      grade: { exposure: 1.02, contrast: 1.05, saturation: 1.06, tint: 0xfff2e8 },
      vignette: { intensity: 0.32, smoothness: 0.42 },
      aa: true,
    },
  };

  // ── 桌（绿呢桌面 2×2·桌高 0.55·真美术=Model3D 待 S6）────────────────────────────────
  entities.felt = {
    Transform3D: { x: 0, y: -0.006 * U, z: 0 },
    Mesh3D: { shape: 'box', width: 1.82 * U, height: 0.012 * U, depth: 1.82 * U, frontTint: TINT.feltTop, edgeTint: TINT.feltEdge },
    Material3D: { preset: 'matte', color: TINT.feltTop, roughness: 0.92, surface: { pattern: 'noise', tiles: 7, normal: 0.3, rough: 0.2 } },
  };
  entities.table = block(0, -0.012 * U - 0.27 * U, 0, 2.06 * U, 0.54 * U, 2.06 * U, TINT.wood, TINT.wood);

  // ── 座垫 ×4 + 点棒托 ×4 ───────────────────────────────────────────────────────────
  const cushionY = -0.55 * U + 0.05 * U;
  for (const [id, cx, cz] of [
    ['cushion-s', 0, 1.6], ['cushion-n', 0, -1.6], ['cushion-e', 1.6, 0], ['cushion-w', -1.6, 0],
  ] as const) {
    entities[id] = {
      Transform3D: { x: cx * U, y: cushionY, z: cz * U },
      Mesh3D: { shape: 'cylinder', width: 0.5 * U, height: 0.1 * U, frontTint: TINT.cushion },
    };
  }
  for (const [id, tx, tz, rot] of [
    ['tray-s', 0.72, 0.86, 0], ['tray-n', -0.72, -0.86, 0], ['tray-e', 0.86, -0.72, Math.PI / 2], ['tray-w', -0.86, 0.72, Math.PI / 2],
  ] as const) {
    entities[id] = block(tx * U, 0.012 * U, tz * U, 0.34 * U, 0.024 * U, 0.1 * U, TINT.tray, TINT.tray, rot);
  }

  // ── 牌山 136（红牌背朝上平躺·四墙）──────────────────────────────────────────────────
  for (const t of wallLayout()) {
    entities[`wall-${t.side}-${t.stack}-${t.layer}`] = backTile(t);
  }

  // ── 三家手牌（对家北 + 东西·红牌背立牌·各 13）───────────────────────────────────────
  for (const seat of ['north', 'east', 'west'] as Seat[]) {
    sideHandLayout(seat).forEach((p, i) => {
      entities[`hand-${seat}-${i}`] = backTile(p);
    });
  }

  // ── 各家牌河（弃牌摊开·牌面朝上·静态定格）──────────────────────────────────────────
  for (const seat of ['south', 'north', 'east', 'west'] as Array<'south' | Seat>) {
    const poses = riverLayout(seat);
    RIVER_DEMO[seat].forEach((kind, i) => {
      entities[`river-${seat}-${i}`] = faceTile(kind, poses[i]);
    });
  }

  // ── 自家手牌 13+摸（body 白牌身 + 正面 plane 牌面·牌面清晰只在正面·可拾取）──────────────
  const hand = handLayout();
  const kinds: TileKind[] = [...DEMO_HAND, DEMO_TSUMO];
  hand.forEach((p, i) => {
    entities[`hand-${i}`] = {
      Transform3D: { x: p.x, y: p.y, z: p.z },
      Mesh3D: { shape: 'box', width: HAND_W, height: HAND_H, depth: HAND_D, frontTint: TINT.tileBody, backTint: TINT.tileBack, edgeTint: TINT.tileBody },
      Material3D: { preset: 'matte', color: TINT.tileBody, roughness: 0.42 },
      Pickable3D: { signal: HAND_PICK_SIGNAL },
    };
    // 正面牌面（plane 贴图·紧贴 body 正面·牌面朝相机）
    entities[`hand-${i}-face`] = {
      Transform3D: { x: p.x, y: p.y, z: p.z + HAND_D / 2 + 0.02 * U },
      Mesh3D: { shape: 'plane', width: HAND_W * 0.94, height: HAND_H * 0.94, frontTint: TINT.tileFaceFallback },
      Material3D: { preset: 'matte', color: 0xffffff, roughness: 0.4, map: texKey(kinds[i]) },
    };
  });

  // ── 宝牌指示（王牌中央翻开一张·牌面朝上·rotX=-π/2）+ 骰 ×2 ──────────────────────────
  entities['dora-indicator'] = faceTile('sou-5-red', { x: -0.08 * U, y: SM_D / 2 + 0.002 * U, z: 0, rotX: -Math.PI / 2 });
  const PIPS = [1, 6, 2, 5, 3, 4] as const;
  const die = (x: number, z: number, rotY: number): EntityBlueprint => ({
    Transform3D: { x, y: 0.03 * U + 0.001 * U, z, rotY },
    Mesh3D: {
      shape: 'box', width: 0.058 * U, height: 0.058 * U, depth: 0.058 * U, frontTint: TINT.die,
      dieFaces: PIPS.map((pip) => ({ color: TINT.die, pip })),
    },
  });
  entities['die-a'] = die(0.12 * U, 0.05 * U, 0.5);
  entities['die-b'] = die(0.19 * U, 0.11 * U, 2.2);

  // ── 背景件（障子×2 + 灯笼×2 + 月窗 + 地席）──────────────────────────────────────────
  entities.tatami = block(0, -0.55 * U - 0.015 * U, 0, 6.4 * U, 0.03 * U, 6.4 * U, TINT.tatami, TINT.tatami);
  for (const [id, sx] of [['shoji-l', -0.55], ['shoji-r', 0.55]] as const) {
    entities[id] = {
      Transform3D: { x: sx * U, y: 0.22 * U, z: -1.7 * U },
      Mesh3D: { shape: 'plane', width: 0.78 * U, height: 1.6 * U, frontTint: TINT.shoji },
    };
  }
  entities['moon-window'] = {
    Transform3D: { x: 1.2 * U, y: 0.75 * U, z: -1.95 * U },
    Mesh3D: { shape: 'plane', width: 1.0 * U, height: 0.5 * U, frontTint: TINT.moon },
  };
  for (const [id, lx] of [['lantern-e', 0.95], ['lantern-w', -0.95]] as const) {
    entities[id] = {
      Transform3D: { x: lx * U, y: 0.56 * U, z: -0.4 * U },
      Mesh3D: { shape: 'capsule', width: 0.17 * U, height: 0.26 * U, frontTint: TINT.lantern },
      Glow3D: { color: TINT.lanternGlow, scale: 0.7 * U, opacity: 0.55 },
    };
  }

  return { capabilities: [randomCapability], entities };
}
