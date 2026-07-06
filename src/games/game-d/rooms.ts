// Game D ·《骰途》场景骨架 —— 无限程序化房间流（弓箭传说/哈迪斯式·一屏一间·往上推进）。
//
// owner 2026-06-29「先搭场景骨架·战斗先别管·一关一关往前流程·近俯视·一屏一战场·把 Streaming 做扎实」。
// **比例 = Cloud Design `docs/design/game-d/3d-motion-spec.md` §B 确切值**（owner 2026-07-02「各种数据对齐」）：
// 竞技场 7×7 地格(格 1×1×0.45)·墙高 0.85·门洞 gap 1.5·基座 y −1.0/−2.3·四角火盆 @±4.3·相机 ortho fr7 pos(0,12,7.8)。
// 每个房间 = 一座独立竞技场（贴色体素 Mesh3D box·四面围墙 + 前墙留门洞通向上一间）。按 index 即时生成
//（genRoom）——分层（ACTS 循环）、每层 2 战斗 + 1 BOSS。房间**全 render-only**（Transform3D/Mesh3D·出 hash），
// 故可由 game-d.ts 在运行时按需 createEntity/destroyEntity 做**流式生成/卸载**（只保留当前房间附近窗口），
// 无需任何 sim/装配层改动。美术先用"类型颜色"占位（贴图能力后续做），靠现成精装管线（光/景深/泛光/天空）出质感。
// 战斗/骰子/敌人 = 后续接入（见 docs/design/game-d/combat-design.md）。

import type { WorldBlueprint } from '../../assembly/demo.assembly.js';
import type { VoxelTex } from '@engine/protocol/components.js';
import { tileArt } from './art.js';

type Ent = WorldBlueprint['entities'][string];

/** 房间沿 +Z 的间距（§B 尺度下·7 深房 + 走廊）。 */
export const ROOM_SPACING = 12;
/** 普通竞技场半尺寸 = 7×7 地格的一半（§B）；BOSS 间略大。 */
const HW = 3.5;
const HD = 3.5;
/** 竞技场地台半宽（供物理掷骰把「反弹墙」对齐到可见围墙内壁·throw3d 消费）。 */
export const ARENA_HALF = HW;
/** 墙高 / 墙厚 / 地台厚（§B：墙 h0.85·地格 0.45 薄板）。 */
const WALL_H = 0.85;
const WALL_T = 0.35;
const FLOOR_H = 0.45;
/** 门洞宽（§B gap 1.5）。 */
const DOOR = 1.5;

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
/** 围墙体素贴图（tile=每边格数·§B 7×7 → tile 7）。地台改金属 Material3D 后不再用 floorTex（已删）。 */
const wallTex = (t: ActDef, act: number): VoxelTex => ({ top: t.wall, side: t.wall, side2: t.side2, trim: t.trim, wall: true, tile: 7, sideSrc: tileArt(act, 'wall') });
// 场馆整体金属化（owner 2026-07-03「所有东西换金属质感·跟金环一致·不完全一样·色彩微调」）：
//   结构件（墙/地/基座）= 哑光**铁** iron + 主题色 tint（暗·粗糙·稳）；亮件（火盆碗珠/门/环）= 抛光**金** gold（亮·反射强）。
//   Material3D 优先于 voxelTex（渲染器）·都靠 Sky3D.env(IBL) 反射成像。一致=同金属家族·不同=结构哑光 vs 亮件抛光。
const metalStruct = (color: number) => ({ preset: 'iron' as const, color, surface: { pattern: 'bumps' as const, tiles: 6, normal: 0.3, rough: 0.55 } });
const metalBright = (color: number) => ({ preset: 'gold' as const, color, surface: { pattern: 'bumps' as const, tiles: 5, normal: 0.32, rough: 0.32 } });
// 地盘专用金属（owner「地板太丑」→ 换干净的**抛光拉丝钢**·去掉锤打噪点·细腻拉丝纹·低粗糙=反光干净·暖深钢灰跟金环一致）。
const metalFloor = { preset: 'steel' as const, color: 0x69645d, surface: { pattern: 'scratches' as const, tiles: 3, normal: 0.09, rough: 0.32 } };

/**
 * 即时生成第 index 间竞技场的全部实体（id 以 `r{index}-` 前缀·跨房间唯一·便于流式卸载）。
 * 低矮围墙框住地台、前墙（+Z 端）留中央门洞通向上一间、中心焦点 + 散落"类型色块"占位美术。
 * BOSS 间更大、中心立一座发光巨块。index 0 额外放一只 showcase 小黄鸭（证明模型导入能力）。
 */
/** 加性辉光实体（Glow3D + Transform3D·复刻原型 glowSprite）。 */
const glow = (x: number, y: number, z: number, color: number, scale: number, opacity = 0.7): Ent =>
  ({ Transform3D: { x, y, z }, Glow3D: { color, scale, opacity } });

/** 竖立的旋转金属环（owner 2026-07-03·借 game-z prim-torus 配方：金 PBR + 表面细节 + 绕 Y 自转）。
 *  torus 默认在 XY 平面 = **竖直**环（面朝 ±Z）；spin rotY = 绕竖轴转（面→侧→面·别忘了它旋转）。金属靠 Sky3D.env(IBL) 反射成像。 */
const metalRing = (x: number, y: number, z: number, dia: number, spin: number): Ent => ({
  Transform3D: { x, y, z },
  Mesh3D: { shape: 'torus', width: dia, height: dia, frontTint: 0xffd991, tube: 0.32 },
  Material3D: { preset: 'gold', surface: { pattern: 'bumps', tiles: 6, normal: 0.4, rough: 0.28 } },
  Anim3D: { channels: [{ kind: 'spin', field: 'rotY', rate: spin }] },
});

/** 四角火盆（立柱 + 亮暖火盆 + **加性暖光晕**·复刻原型 brazier·§B @±4.3）——微缩盒庭的暖光与纵向层次。 */
function cornerBraziers(P: string, baseZ: number, hw: number, hd: number, pillar: number, pillarSide: number, hot: number, hotSide: number): Record<string, Ent> {
  const out: Record<string, Ent> = {};
  const xs = [-(hw + 0.8), hw + 0.8], zs = [-(hd + 0.8), hd + 0.8]; // ±4.3
  let n = 0;
  for (const x of xs) for (const z of zs) {
    const k = `${P}-bra${n++}`;
    out[`${k}-pil`] = { ...block(x, 0.55, baseZ + z, 0.28, 1.1, 0.28, pillar, pillarSide), Material3D: metalStruct(pillar) }; // 火炬立柱=铁
    out[`${k}-bowl`] = { ...block(x, 1.22, baseZ + z, 0.42, 0.24, 0.42, hot, hotSide), Material3D: metalBright(hot) }; // 火盆碗=金
    out[`${k}-orb`] = { ...block(x, 1.5, baseZ + z, 0.28, 0.28, 0.28, hot, hot), Material3D: metalBright(hot) }; // 火珠=金
    out[`${k}-glow`] = glow(x, 1.62, baseZ + z, 0xffb05a, 1.7, 0.42); // 火盆暖光晕（收敛·owner「颜色怪」=地台上过亮光斑→降透明/尺寸）
  }
  return out;
}

export function genRoom(index: number): Record<string, Ent> {
  const m = roomMeta(index);
  const t = m.theme;
  const boss = m.type === 'boss';
  const hw = boss ? 4.5 : HW;
  const hd = boss ? 4.5 : HD;
  const baseZ = index * ROOM_SPACING;
  const P = `r${index}`;
  const segW = hw - DOOR / 2; // 前墙门洞两侧段宽（中央留 DOOR 宽门）
  const segCx = (hw + DOOR / 2) / 2;

  const darken = (c: number, k: number): number => {
    const r = Math.max(0, Math.round(((c >> 16) & 0xff) * (1 - k)));
    const g = Math.max(0, Math.round(((c >> 8) & 0xff) * (1 - k)));
    const b = Math.max(0, Math.round((c & 0xff) * (1 - k)));
    return (r << 16) | (g << 8) | b;
  };
  const BRAZIER = 0xffc79a, BRAZIER_HOT = 0xff8a3c, LANTERN = 0xffe2b0; // 亮暖色·经 bloom 自发光
  const wcy = WALL_H / 2; // 墙中心 y（下沿坐地 y0）

  const out: Record<string, Ent> = {
    // ── 浮空微缩盒庭：分层基座（往下收窄的两级台·§B 基座 y −1.0 / −2.3）──
    [`${P}-plinth1`]: { ...block(0, -1.0, baseZ, hw * 2 + 1.0, 0.6, hd * 2 + 1.0, darken(t.floorSide, 0.18), darken(t.floorSide, 0.34)), Material3D: metalStruct(darken(t.floorSide, 0.22)) },
    [`${P}-plinth2`]: { ...block(0, -2.3, baseZ, hw * 2 + 0.3, 0.7, hd * 2 + 0.3, darken(t.floorSide, 0.42), darken(t.floorSide, 0.56)), Material3D: metalStruct(darken(t.floorSide, 0.42)) },
    // 竞技场地台（顶在 y=0·§B 薄地格 0.45）——**金属地盘**（owner 整场金属化）。撤 floorTex（顶面手绘草贴图会盖过 Material3D）→ 纯金属；
    // 色彩微调：地面用暖青铜色 floorSide（非绿 floorTop）→ 明显金属、跟金环一致。
    [`${P}-floor`]: { ...block(0, -FLOOR_H / 2, baseZ, hw * 2, FLOOR_H, hd * 2, t.floorTop, t.floorSide), Material3D: metalFloor },
    // 三面围墙（左/右/后=入口侧·§B 墙高 0.85）——墙纹 + 顶饰条
    [`${P}-wall-l`]: { ...block(-hw, wcy, baseZ, WALL_T, WALL_H, hd * 2, t.wall, t.floorSide, undefined, wallTex(t, m.act)), Material3D: metalStruct(t.wall) },
    [`${P}-wall-r`]: { ...block(hw, wcy, baseZ, WALL_T, WALL_H, hd * 2, t.wall, t.floorSide, undefined, wallTex(t, m.act)), Material3D: metalStruct(t.wall) },
    [`${P}-wall-back`]: { ...block(0, wcy, baseZ - hd, hw * 2, WALL_H, WALL_T, t.wall, t.floorSide, undefined, wallTex(t, m.act)), Material3D: metalStruct(t.wall) },
    // 前墙留中央门洞（+Z 端·通向上一间·发光门楣 + 门内符文光幕）
    [`${P}-wall-fl`]: { ...block(-segCx, wcy, baseZ + hd, segW, WALL_H, WALL_T, t.wall, t.floorSide, undefined, wallTex(t, m.act)), Material3D: metalStruct(t.wall) },
    [`${P}-wall-fr`]: { ...block(segCx, wcy, baseZ + hd, segW, WALL_H, WALL_T, t.wall, t.floorSide, undefined, wallTex(t, m.act)), Material3D: metalStruct(t.wall) },
    [`${P}-door-top`]: { ...block(0, WALL_H + 0.16, baseZ + hd, DOOR, 0.32, WALL_T, t.accent, t.wall), Material3D: metalBright(t.accent) }, // 门楣=金
    [`${P}-portal`]: block(0, 0.5, baseZ + hd - 0.04, DOOR - 0.15, WALL_H + 0.15, 0.08, t.accent, t.accent),
    [`${P}-door-glow`]: glow(0, 0.75, baseZ + hd - 0.2, t.accent, 2.4, 0.6), // 门符文光晕
    // 通向上一间的短走廊（穿过门洞·暗示"还有更上面"）
    [`${P}-corridor`]: { ...block(0, -FLOOR_H / 2, baseZ + ROOM_SPACING / 2, DOOR, FLOOR_H, ROOM_SPACING - hd - HD, t.floorTop, t.floorSide), Material3D: metalStruct(t.floorTop) },
    // ── 四角发光火盆（暖光晕 + 纵向层次·微缩盒庭标志·§B @±4.3）──
    ...cornerBraziers(P, baseZ, hw, hd, t.wall, t.floorSide, BRAZIER, BRAZIER_HOT),
    // ── 上方漂浮灯笼（加性暖光晕·复刻原型 lantern glowSprite）──
    // 命运之环：两个小巧竖立旋转金属环，摆在**战场左上角/右上角**（= 屏上方门侧两个火炬/火盆的位置·+Z 端·owner 2026-07-03 澄清）——悬在火炬上方、左右反向不同速转。
    [`${P}-ring-l`]: metalRing(-(hw + 0.8), 1.85, baseZ + (hd + 0.8), 0.8, 1.4),
    [`${P}-ring-r`]: metalRing(hw + 0.8, 1.85, baseZ + (hd + 0.8), 0.8, -1.15),
    // 三盏漂浮灯笼撤了（上面两盏换成命运之环·顶后一盏也去掉·保持光秃）。四角火炬(火盆)留着做「竖起来的火炬」。
  };

  // 中心 furniture 全撤（owner 2026-07-03「场景里的平台 + 旋转骰子都去掉·先要光秃秃的场景」）：
  //   去掉 dais 台座 + 自转 gem 宝物（=中间那颗旋转骰）+ 散落色块 t1/t2 + BOSS 中心巨块 →
  //   中心空出=纯地台（正好给物理掷骰腾地方）。boss/normal 暂同样光秃（后续按玩法再加）。
  return out;
}

/**
 * 场景**静态单例**蓝图（相机 + 光 + 后处理 + 天空盒）——房间不在这里，由 game-d.ts 运行时流式生成。
 * 相机 = **§B 确切值**：Orthographic fr=7·pos(0,12,7.8)·lookAt(0,0,0)（→ yaw π 让出口门在屏上方·pitch atan2(12,7.8)≈0.99·前进往上推）。
 * 光 = §B 暖态（t≈1）：Key #fff0d8 int1.2 pos(6,11,5) 投影·Fill #6f7cff int0.20 pos(-5,4,-4)·Ambient int0.66。
 */
export function baseBlueprint(): WorldBlueprint {
  return {
    capabilities: [],
    entities: {
      // §B：ortho fr7·pos(0,12,7.8) lookAt 原点 → yaw π·pitch 0.99·orthoSize 7·pivot 抬到盒庭中段(y0.35)。
      cam: { Camera3D: { yaw: Math.PI, pitch: 0.99, projection: 'ortho', orthoSize: 5.2, distance: 200, near: 1, far: 900, pivotX: 0, pivotY: 0.35, pivotZ: 0 } }, // orthoSize 7→5.2：拉近·地台填满更多画面（owner「场景太小」）
      // 光照 = **暖调**（对齐设计稿 02-arena 暖房间·与 setMood(false) 一致）：key 暖白·fill 弱冷蓝·amb 暖白降强度加对比。
      sun: { Light3D: { kind: 'directional', color: 0xfff0d8, intensity: 1.05, dirX: -6, dirY: -11, dirZ: -5, castShadow: true } },
      fillDir: { Light3D: { kind: 'directional', color: 0x6f7cff, intensity: 0.18, dirX: 5, dirY: -4, dirZ: 4 } },
      amb: { Light3D: { kind: 'ambient', color: 0xfff1de, intensity: 0.48 } },
      // 移轴景深（收敛·别糊成雾）+ 轻泛光（阈值高·只发光物晕·不洗白全场）——owner「太白·曝光过度」整改。
      post: { Post3D: { tiltShift: { focus: 0.54, intensity: 0.85 }, bloom: { strength: 0.32, radius: 0.72, threshold: 0.78 } } },
      // 暖调奶油天穹（对齐设计稿暖房·非近白）。
      sky: { Sky3D: { top: 0xe9dcc2, bottom: 0xd6c2a0, clouds: false, cloudTint: 0xf0e6d0, scroll: 0.3 } },
    },
  };
}
