// Game D ·《骰途》场景骨架 —— 无限程序化房间流（弓箭传说/哈迪斯式·一屏一间·往上推进）。
//
// owner 2026-06-29「先搭场景骨架·战斗先别管·一关一关往前流程·近俯视·一屏一战场·把 Streaming 做扎实」。
// 每个房间 = 一座独立竞技场（贴色体素 Mesh3D box·四面围墙 + 前墙留门洞通向上一间）。按 index 即时生成
//（genRoom）——分层（ACTS 循环）、每层 2 战斗 + 1 BOSS。房间**全 render-only**（Transform3D/Mesh3D·出 hash），
// 故可由 game-d.ts 在运行时按需 createEntity/destroyEntity 做**流式生成/卸载**（只保留当前房间附近窗口），
// 无需任何 sim/装配层改动。美术先用"类型颜色"占位（贴图能力后续做），靠现成精装管线（光/景深/泛光/天空）出质感。
// 战斗/骰子/敌人 = 后续接入（见 docs/design/game-d/combat-design.md）。

import type { WorldBlueprint } from '../../assembly/demo.assembly.js';
import type { VoxelTex } from '@engine/protocol/components.js';
import { MODEL_DUCK } from './assets.js';
import { tileArt } from './art.js';

type Ent = WorldBlueprint['entities'][string];

/** 房间沿 +Z 的间距。 */
export const ROOM_SPACING = 36;
/** 普通竞技场半尺寸（BOSS 间更大）。 */
const HW = 13;
const HD = 14;

export interface ActDef {
  name: string;
  floorTop: number; // 地台顶面主色
  top2: number; // 地台顶面点缀色
  floorSide: number; // 地台侧/暗面主色
  side2: number; // 地台侧面点缀色
  wall: number; // 围墙/装饰主色
  trim: number; // 墙顶饰条 / 纹样色
  accent: number; // 焦点/门楣高光色（亮·发光物）
}

/** 层主题（**确切复刻原型 `get themes()` 的 hex**·非近似）。index 增长即换层。 */
export const ACTS: ActDef[] = [
  { name: '翠庭', floorTop: 0x6fae4a, top2: 0x5a9a3a, floorSide: 0x8a5a32, side2: 0x5d3a20, wall: 0x9aa86a, trim: 0xf2d066, accent: 0xffd24a },
  { name: '古殿', floorTop: 0x8b93a4, top2: 0x737c8f, floorSide: 0x565d6e, side2: 0x3c4250, wall: 0x9aa1b4, trim: 0x67d6e0, accent: 0x5fd6e6 },
  { name: '熔心', floorTop: 0x4a3a34, top2: 0x372b27, floorSide: 0x33251f, side2: 0x241a16, wall: 0x5a463c, trim: 0xff7a3c, accent: 0xff7a2c },
  { name: '晶顶', floorTop: 0x4a6f8a, top2: 0x3c5d78, floorSide: 0x3a5070, side2: 0x2a3a58, wall: 0x5a7fa6, trim: 0xc08aff, accent: 0xb58bff },
];

export interface RoomMeta {
  index: number;
  act: number; // 第几层（0 起）
  roomInAct: number; // 层内第几间（0 起）
  type: 'normal' | 'boss'; // 每层 2 战斗 + 1 BOSS
  theme: ActDef;
}

/** 由房间序号派生「第几层 / 层内第几间 / 类型 / 主题」——纯函数·决定式（无 RNG·骰子随机以后接 sim）。 */
export function roomMeta(index: number): RoomMeta {
  const act = Math.floor(index / 3);
  const roomInAct = index % 3;
  return { index, act, roomInAct, type: roomInAct === 2 ? 'boss' : 'normal', theme: ACTS[act % ACTS.length]! };
}

/** 一个体块：中心位姿 + 尺寸 + 顶/侧色。rotY 可选；vox=体素程序化贴图（地砖/墙纹·复刻「带精美贴图的体素」）。 */
function block(x: number, y: number, z: number, w: number, h: number, d: number, top: number, side: number, rotY?: number, vox?: VoxelTex): Ent {
  return {
    Transform3D: { x, y, z, ...(rotY !== undefined ? { rotY } : {}) },
    Mesh3D: { shape: 'box', width: w, height: h, depth: d, frontTint: side, backTint: side, edgeTint: top, ...(vox ? { voxelTex: vox } : {}) },
  };
}
const PAT_BY_ACT: Array<VoxelTex['pattern']> = ['grass', 'stone', 'plain', 'crystal'];
/** 由层主题派生地台/墙的体素贴图。 */
const floorTex = (t: ActDef, act: number): VoxelTex => ({ top: t.floorTop, top2: t.top2, side: t.floorSide, side2: t.side2, trim: t.trim, pattern: PAT_BY_ACT[act % 4], tile: 3, topSrc: tileArt(act, 'top'), sideSrc: tileArt(act, 'side') });
const wallTex = (t: ActDef, act: number): VoxelTex => ({ top: t.wall, side: t.wall, side2: t.side2, trim: t.trim, wall: true, tile: 3, sideSrc: tileArt(act, 'wall') });

/**
 * 即时生成第 index 间竞技场的全部实体（id 以 `r{index}-` 前缀·跨房间唯一·便于流式卸载）。
 * 低矮围墙框住地台、前墙（+Z 端）留中央门洞通向上一间、中心焦点 + 散落"类型色块"占位美术。
 * BOSS 间更大、中心立一座发光巨块。index 0 额外放一只 showcase 小黄鸭（证明模型导入能力）。
 */
/** 加性辉光实体（Glow3D + Transform3D·复刻原型 glowSprite）。 */
const glow = (x: number, y: number, z: number, color: number, scale: number, opacity = 0.7): Ent =>
  ({ Transform3D: { x, y, z }, Glow3D: { color, scale, opacity } });

/** 四角火盆（立柱 + 亮暖火盆 + **加性暖光晕**·复刻原型 brazier glowSprite('#ffb05a',2.2)）——微缩盒庭的暖光与纵向层次。 */
function cornerBraziers(P: string, baseZ: number, hw: number, hd: number, pillar: number, pillarSide: number, hot: number, hotSide: number): Record<string, Ent> {
  const out: Record<string, Ent> = {};
  const xs = [-(hw + 1.5), hw + 1.5], zs = [-(hd + 1.5), hd + 1.5];
  let n = 0;
  for (const x of xs) for (const z of zs) {
    const k = `${P}-bra${n++}`;
    out[`${k}-pil`] = block(x, 2.2, baseZ + z, 1, 4.4, 1, pillar, pillarSide);
    out[`${k}-bowl`] = block(x, 4.7, baseZ + z, 1.5, 0.9, 1.5, hot, hotSide);
    out[`${k}-orb`] = block(x, 5.4, baseZ + z, 1.05, 1.05, 1.05, hot, hot);
    out[`${k}-glow`] = glow(x, 5.7, baseZ + z, 0xffb05a, 8, 0.8); // 火盆暖光晕
  }
  return out;
}

export function genRoom(index: number): Record<string, Ent> {
  const m = roomMeta(index);
  const t = m.theme;
  const boss = m.type === 'boss';
  const hw = boss ? 16 : HW;
  const hd = boss ? 16 : HD;
  const baseZ = index * ROOM_SPACING;
  const P = `r${index}`;
  const segW = hw - 4.5; // 前墙门洞两侧段宽（中央留 9 宽门）
  const segCx = (hw + 4.5) / 2;

  const darken = (c: number, k: number): number => {
    const r = Math.max(0, Math.round(((c >> 16) & 0xff) * (1 - k)));
    const g = Math.max(0, Math.round(((c >> 8) & 0xff) * (1 - k)));
    const b = Math.max(0, Math.round((c & 0xff) * (1 - k)));
    return (r << 16) | (g << 8) | b;
  };
  const BRAZIER = 0xffc79a, BRAZIER_HOT = 0xff8a3c, LANTERN = 0xffe2b0; // 亮暖色·经 bloom 自发光

  const out: Record<string, Ent> = {
    // ── 浮空微缩盒庭：分层基座（往下收窄的两级台，像漂浮模型）──
    [`${P}-plinth1`]: block(0, -4.6, baseZ, hw * 2 + 6, 3, hd * 2 + 6, darken(t.floorSide, 0.18), darken(t.floorSide, 0.34)),
    [`${P}-plinth2`]: block(0, -8, baseZ, hw * 2 + 1.5, 3.5, hd * 2 + 1.5, darken(t.floorSide, 0.42), darken(t.floorSide, 0.56)),
    // 竞技场地台（顶在 y=0）——顶面程序化地砖网格（复刻「带精美贴图的体素」）
    [`${P}-floor`]: block(0, -2, baseZ, hw * 2, 4, hd * 2, t.floorTop, t.floorSide, undefined, floorTex(t, m.act)),
    // 三面围墙（左/右/后=入口侧）——墙纹 + 顶饰条
    [`${P}-wall-l`]: block(-hw, 1.5, baseZ, 1.5, 5, hd * 2, t.wall, t.floorSide, undefined, wallTex(t, m.act)),
    [`${P}-wall-r`]: block(hw, 1.5, baseZ, 1.5, 5, hd * 2, t.wall, t.floorSide, undefined, wallTex(t, m.act)),
    [`${P}-wall-back`]: block(0, 1.5, baseZ - hd, hw * 2, 5, 1.5, t.wall, t.floorSide, undefined, wallTex(t, m.act)),
    // 前墙留中央门洞（+Z 端·通向上一间·发光门楣 + 门内符文光幕）
    [`${P}-wall-fl`]: block(-segCx, 1.5, baseZ + hd, segW, 5, 1.5, t.wall, t.floorSide, undefined, wallTex(t, m.act)),
    [`${P}-wall-fr`]: block(segCx, 1.5, baseZ + hd, segW, 5, 1.5, t.wall, t.floorSide, undefined, wallTex(t, m.act)),
    [`${P}-door-top`]: block(0, 5.5, baseZ + hd, 9, 2, 1.5, t.accent, t.wall),
    [`${P}-portal`]: block(0, 2.6, baseZ + hd - 0.2, 8, 5, 0.5, t.accent, t.accent),
    [`${P}-door-glow`]: glow(0, 4.4, baseZ + hd - 1, t.accent, 9, 0.6), // 门符文光晕（复刻原型 door glowSprite）
    // 通向上一间的短走廊（穿过门洞·暗示"还有更上面"）
    [`${P}-corridor`]: block(0, -2, baseZ + ROOM_SPACING / 2, 9, 4, ROOM_SPACING - hd - HD, t.floorTop, t.floorSide),
    // ── 四角发光火盆（暖光晕 + 纵向层次·微缩盒庭标志）──
    ...cornerBraziers(P, baseZ, hw, hd, t.wall, t.floorSide, BRAZIER, BRAZIER_HOT),
    // ── 上方漂浮灯笼（加性暖光晕·复刻原型 lantern glowSprite('#ffcf8a',1.6)）──
    [`${P}-lan1`]: glow(-8, 10.5, baseZ - 6, LANTERN, 6, 0.5),
    [`${P}-lan2`]: glow(9, 11, baseZ + 3, LANTERN, 6, 0.5),
    [`${P}-lan3`]: glow(0, 12, baseZ - 9, LANTERN, 6, 0.5),
    // 散落元素色块（占位美术·靠颜色区分类型）
    [`${P}-t1`]: block(-7, 0.9, baseZ - 6, 1.4, 1.4, 1.4, t.accent, t.floorSide, 0.6),
    [`${P}-t2`]: block(7.5, 0.9, baseZ + 5, 1.4, 1.4, 1.4, t.wall, t.floorSide, 0.6),
  };

  if (boss) {
    // BOSS 间：中心一座发光巨块（占位"Boss"）
    out[`${P}-boss`] = block(0, 4, baseZ, 7, 8, 7, t.accent, t.wall, 0.4);
    out[`${P}-boss-glow`] = glow(0, 5, baseZ, t.accent, 12, 0.5);
  } else {
    // 战斗间：中心台座 + 斜摆发光宝物 + 宝物光晕（复刻原型 altar gem glowSprite(accent,2)）
    out[`${P}-dais`] = block(0, 0.5, baseZ, 7, 1, 7, t.wall, t.floorSide);
    out[`${P}-gem`] = block(0, 2.8, baseZ, 2.6, 2.6, 2.6, t.accent, t.accent, 0.6);
    out[`${P}-gem-glow`] = glow(0, 2.8, baseZ, t.accent, 7, 0.6);
  }

  // 起手间放 showcase 小黄鸭（证明 glTF 模型导入·非体素）
  if (index === 0) {
    out['duck'] = { Transform3D: { x: 7, y: 0.5, z: 4, rotY: -2.2, scale: 3.0 }, Model3D: { modelKey: MODEL_DUCK } };
  }

  return out;
}

/**
 * 场景**静态单例**蓝图（相机 + 光 + 后处理 + 天空盒）——房间不在这里，由 game-d.ts 运行时流式生成。
 * 相机：近俯视（垂直向下偏 ~30°·pitch≈58°·yaw=π 让出口门/上一间在屏幕上方·前进往上推）·ortho 一屏框一间·两侧留 UI。
 */
export function baseBlueprint(): WorldBlueprint {
  return {
    capabilities: [],
    entities: {
      // 近俯视 ortho·框紧一间（复刻原型 cam pos(0,12,7.8) lookAt 原点·fr≈7）。orthoSize 收到 13 让盒庭填满中段。
      cam: { Camera3D: { yaw: Math.PI, pitch: 0.98, projection: 'ortho', orthoSize: 13, distance: 240, near: 1, far: 900, pivotX: 0, pivotY: 1.5, pivotZ: 0 } },
      // 光照**确切复刻原型 initGame**：key 0xfff0d8 at(6,11,5)→dir(-6,-11,-5)·fill 0x6f7cff at(-5,4,-4)→dir(5,-4,4)·amb 0xffffff。
      sun: { Light3D: { kind: 'directional', color: 0xfff0d8, intensity: 1.05, dirX: -6, dirY: -11, dirZ: -5, castShadow: true } },
      fillDir: { Light3D: { kind: 'directional', color: 0x6f7cff, intensity: 0.35, dirX: 5, dirY: -4, dirZ: 4 } },
      amb: { Light3D: { kind: 'ambient', color: 0xffffff, intensity: 0.6 } },
      // 移轴景深（上下渐糊·微缩模型感）+ 轻泛光（发光物自发光）——设计案核心氛围。
      post: { Post3D: { tiltShift: { focus: 0.54, intensity: 1.7 }, bloom: { strength: 0.72, radius: 0.72, threshold: 0.6 } } },
      // 明快浅暖天穹（微缩盒庭漂在光里·非暗黑）。
      sky: { Sky3D: { top: 0xd7dbe4, bottom: 0xece7de, clouds: false, cloudTint: 0xe8ecf4, scroll: 0.3 } },
    },
  };
}
