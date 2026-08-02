// Game B ·《雀宴》—— 牌桌世界蓝图 = 纯数据（WorldBlueprint·3D 氛围舞台）。
// 架构（owner 2026-07-18「连个正常人都没法开始·整个流程混乱」根因修正·对标 game-c 先例）：
//   **3D = 纯氛围舞台**（和室夜宴桌/牌山方墙/三家牌背/灯笼月窗）——不再在 3D 里塞「静态假手牌/假牌河」，
//   那假牌与真牌局对不上、玩家分不清"哪把是我的、谁在打"（owner 直指）。
//   **真牌局（自家手牌·四家牌河·宝牌·结算）全部走 2D LayoutNode HUD**（play-ui.ts·牌面=真占位贴图·点牌即打），
//   与 game-c「3D 牌房舞台 + 2D 牌面交互」同构，可靠、清晰、可点。
// 全件走引擎 render-only 3D 组件（Mesh3D/Material3D/Camera3D/Light3D/Glow3D/Post3D）+ 种子 PRNG。
import type { WorldBlueprint, EntityBlueprint } from '@zerocraft/engine/assembly/demo.assembly.js';
import { randomCapability } from '@zerocraft/engine/atom-skills/index.js';
import { U, TINT, CAM_MAIN } from './theme.js';
import { wallLayout, sideHandLayout, SM_W, SM_H, SM_D, type Seat } from './tiles.js';

export interface GameBConfig {
  seed: number; // SessionIn.seed（局外传入·缺省由宿主给定值·绝不裸 Math.random）
}

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

  // ── 中央骰 ×2（开门定格·装饰·真牌河/手牌/宝牌全走 2D HUD·play-ui.ts）───────────────────
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
