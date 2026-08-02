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

import type { WorldBlueprint } from '@zerocraft/engine/assembly/demo.assembly.js';
import type { VoxelTex } from '@zerocraft/engine/engine/protocol/components.js';

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
  art: ThemeArt; // 主题美术（材质/天空/灯光/尘埃）——见 ThemeArt
}

/** 一条 PBR 材质数据（现有 Material3D 能力的子集·程序化预设+色+表面纹+自发光）。 */
export type Mat = {
  preset: 'matte' | 'steel' | 'iron' | 'gold' | 'copper';
  color?: number;
  surface?: { pattern: 'bumps' | 'noise' | 'scratches'; tiles?: number; normal?: number; rough?: number };
  emissive?: number; emissiveIntensity?: number;
};
/** 主题美术描述（owner 2026-07-06「很多肉鸽关卡·要主题性美术设计」）：**一行数据 = 一个主题的全套外观**——
 *  地/墙/亮件材质 + 环色 + 天空 + 灯光 + 尘埃色。全由现有渲染能力（Material3D/Sky3D/Light3D/Vfx3D）解释，
 *  **加一个新主题关卡 = 加一行**（过"最弱 LLM 也能照抄产出"尺子·非虚胖代码）。程序化 PBR 起步·日后真实贴图/AI 图接同一批字段。 */
export interface ThemeArt {
  floor: Mat;   // 地盘
  struct: Mat;  // 围墙（基座/走廊/火炬柱由它压暗派生）
  bright: Mat;  // 亮件（火盆碗珠 / 门楣）
  ring: number; // 命运之环主色（steel 环染此色）
  sky: { top: number; bottom: number; env: number };       // 天穹渐变 + IBL 强度
  light: { sun: number; sunI: number; amb: number; ambI: number; fill: number; fillI: number }; // 主/环境/补光 色+强
  dust: [number, number, number]; // 战场尘埃渐变（起/中/末色）
  glow: number; // 火盆 / 门符文暖光色
}

/** 层主题（名/占位色复刻原型 + **主题美术 art**·index 增长即换层）。**加新主题层 = 加一行**（含 art 全套外观数据）。 */
export const ACTS: ActDef[] = [
  { name: '翠庭', floorTop: 0x6fae4a, top2: 0x5a9a3a, floorSide: 0x8a5a32, side2: 0x5d3a20, wall: 0x9aa86a, trim: 0xf2d066, accent: 0xffd24a,
    art: { // 翠绿花庭·暖阳
      floor: { preset: 'matte', color: 0x5fa83c, surface: { pattern: 'noise', tiles: 12, normal: 0.4, rough: 0.96 } },   // 绿草地
      struct: { preset: 'matte', color: 0x7c8560, surface: { pattern: 'bumps', tiles: 5, normal: 0.5, rough: 0.9 } },    // 苔痕石墙
      bright: { preset: 'matte', color: 0xc9b98a, surface: { pattern: 'bumps', tiles: 4, normal: 0.3, rough: 0.7 } },    // 暖砂石亮件
      ring: 0xd8dcc0, sky: { top: 0xbcd2b8, bottom: 0xa8c48c, env: 0.4 },
      light: { sun: 0xfff2e0, sunI: 1.05, amb: 0xeaf0dc, ambI: 0.52, fill: 0x8fb0ff, fillI: 0.15 },
      dust: [0xffe6c0, 0xdff0b0, 0xbfe08a], glow: 0xffb05a } },
  { name: '古殿', floorTop: 0x8b93a4, top2: 0x737c8f, floorSide: 0x565d6e, side2: 0x3c4250, wall: 0x9aa1b4, trim: 0x67d6e0, accent: 0x5fd6e6,
    art: { // 苍蓝古殿·青焰
      floor: { preset: 'matte', color: 0x7c86a0, surface: { pattern: 'bumps', tiles: 8, normal: 0.5, rough: 0.85 } },    // 冷石板地
      struct: { preset: 'matte', color: 0x8f98ae, surface: { pattern: 'bumps', tiles: 6, normal: 0.55, rough: 0.82 } },  // 青石墙
      bright: { preset: 'steel', color: 0xc4c7c7 },                                                                       // 抛光银
      ring: 0xc4d0dc, sky: { top: 0xb0bccb, bottom: 0x93a2b6, env: 0.5 },
      light: { sun: 0xeef2ff, sunI: 1.0, amb: 0xe3ebf6, ambI: 0.55, fill: 0x6f8cff, fillI: 0.18 },
      dust: [0xdfeaff, 0xbcd0ea, 0x9fb8d8], glow: 0x67d6e0 } },
  { name: '熔心', floorTop: 0x4a3a34, top2: 0x372b27, floorSide: 0x33251f, side2: 0x241a16, wall: 0x5a463c, trim: 0xff7a3c, accent: 0xff7a2c,
    art: { // 熔火之心·余烬
      floor: { preset: 'matte', color: 0x2e241f, surface: { pattern: 'noise', tiles: 10, normal: 0.7, rough: 0.9 } },    // 黑玄武岩
      struct: { preset: 'matte', color: 0x46352c, surface: { pattern: 'bumps', tiles: 6, normal: 0.6, rough: 0.85 } },   // 焦岩墙
      bright: { preset: 'matte', color: 0xff6a1e, emissive: 0xff5a12, emissiveIntensity: 0.9 },                          // 熔浆自发光
      ring: 0xd08a5a, sky: { top: 0x3a2620, bottom: 0x1c1210, env: 0.32 },
      light: { sun: 0xff9a5a, sunI: 1.1, amb: 0x5a382c, ambI: 0.5, fill: 0xff5a2a, fillI: 0.12 },
      dust: [0xffcf90, 0xff8a3c, 0xff5a1e], glow: 0xff6a1e } },
  { name: '晶顶', floorTop: 0x4a6f8a, top2: 0x3c5d78, floorSide: 0x3a5070, side2: 0x2a3a58, wall: 0x5a7fa6, trim: 0xc08aff, accent: 0xb58bff,
    art: { // 霜晶之巅·紫辉
      floor: { preset: 'matte', color: 0x8fb4cf, surface: { pattern: 'noise', tiles: 10, normal: 0.3, rough: 0.7 } },    // 冰晶地
      struct: { preset: 'steel', color: 0x9fb8d0 },                                                                       // 冰晶反光墙
      bright: { preset: 'matte', color: 0xc79bff, emissive: 0xb58bff, emissiveIntensity: 0.8 },                          // 紫晶自发光
      ring: 0xd7c4ff, sky: { top: 0xd6e4f0, bottom: 0xb8cade, env: 0.6 },
      light: { sun: 0xeef4ff, sunI: 1.15, amb: 0xdce8f6, ambI: 0.6, fill: 0xb58bff, fillI: 0.2 },
      dust: [0xeadcff, 0xc8b0ff, 0xa88fff], glow: 0xb58bff } },
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
// 主题美术（owner 2026-07-06「很多肉鸽关卡·要主题性美术设计」）：地/墙/亮件/环/天空/灯光/尘埃全从 `t.art` 一行数据取
//   → 现有渲染能力解释，**加主题 = 加数据行**。此处只留派生工具：基座 = 围墙材质压暗一档（同层同族·有纵深）。
const dk = (c: number, k: number): number => {
  const r = Math.max(0, Math.round(((c >> 16) & 0xff) * (1 - k)));
  const g = Math.max(0, Math.round(((c >> 8) & 0xff) * (1 - k)));
  const b = Math.max(0, Math.round((c & 0xff) * (1 - k)));
  return (r << 16) | (g << 8) | b;
};
const plinthMat = (struct: Mat, k: number): Mat => ({ ...struct, color: dk(struct.color ?? 0x808080, k) }); // 基座 = 围墙材质压暗

/**
 * 即时生成第 index 间竞技场的全部实体（id 以 `r{index}-` 前缀·跨房间唯一·便于流式卸载）。
 * 低矮围墙框住地台、前墙（+Z 端）留中央门洞通向上一间、中心焦点 + 散落"类型色块"占位美术。
 * BOSS 间更大、中心立一座发光巨块。index 0 额外放一只 showcase 小黄鸭（证明模型导入能力）。
 */
/** 加性辉光实体（Glow3D + Transform3D·复刻原型 glowSprite）。 */
const glow = (x: number, y: number, z: number, color: number, scale: number, opacity = 0.7): Ent =>
  ({ Transform3D: { x, y, z }, Glow3D: { color, scale, opacity } });

/** 竖立的旋转金属环（铁 PBR·owner 2026-07-06「各方向都有加速度在随机旋转」= 魔幻乱翻）：
 *  rotX/Y/Z 各叠 **spin(匀速漂移)+bob(正弦摆动)** → 同轴叠加=**变速自转**（加速↔减速·anim3d 同 field compose）；
 *  三轴不同 rate + 互质 freq/phase → 准周期不重复=看着随机乱翻·各方向都在转。o=每环相位偏移（两环独立乱转·不同步）。
 *  纯数据（引擎 Anim3D 能力·非游戏层逐帧改 rate 的 bypass）。torus 默认 XY 平面=竖直环。金属靠 Sky3D.env(IBL) 成像。 */
const metalRing = (x: number, y: number, z: number, dia: number, o: number, tint: number): Ent => ({
  Transform3D: { x, y, z, rotX: o * 0.7, rotZ: o * 1.3 }, // 起始姿态错开
  Mesh3D: { shape: 'torus', width: dia, height: dia, frontTint: tint, tube: 0.32 },
  Material3D: { preset: 'steel', color: tint }, // 抛光铁环·染主题环色（owner 主题美术）
  Anim3D: { channels: [
    { kind: 'spin', field: 'rotX', rate: 1.1 - o * 0.4 },
    { kind: 'bob', field: 'rotX', amp: 1.0, freq: 0.71 + o * 0.13, phase: o * 1.9 },
    { kind: 'spin', field: 'rotY', rate: 1.5 + o * 0.5 },
    { kind: 'bob', field: 'rotY', amp: 1.2, freq: 0.53 + o * 0.17, phase: o * 0.7 },
    { kind: 'spin', field: 'rotZ', rate: 0.8 + o * 0.6 },
    { kind: 'bob', field: 'rotZ', amp: 0.9, freq: 0.89 - o * 0.11, phase: o * 2.6 },
  ] },
});

/** 四角火盆（立柱 + 亮火盆 + **加性光晕**·复刻原型 brazier·§B @±4.3）——用主题材质：柱=struct、碗珠=bright、光晕=主题 glow 色。 */
function cornerBraziers(P: string, baseZ: number, hw: number, hd: number, a: ThemeArt): Record<string, Ent> {
  const out: Record<string, Ent> = {};
  const xs = [-(hw + 0.8), hw + 0.8], zs = [-(hd + 0.8), hd + 0.8]; // ±4.3
  const pc = a.struct.color ?? 0x808080, bc = a.bright.color ?? 0xffffff;
  let n = 0;
  for (const x of xs) for (const z of zs) {
    const k = `${P}-bra${n++}`;
    out[`${k}-pil`] = { ...block(x, 0.55, baseZ + z, 0.28, 1.1, 0.28, pc, dk(pc, 0.3)), Material3D: a.struct }; // 火炬立柱=主题结构材
    out[`${k}-bowl`] = { ...block(x, 1.22, baseZ + z, 0.42, 0.24, 0.42, bc, bc), Material3D: a.bright }; // 火盆碗=主题亮件
    out[`${k}-orb`] = { ...block(x, 1.5, baseZ + z, 0.28, 0.28, 0.28, bc, bc), Material3D: a.bright }; // 火珠=主题亮件
    out[`${k}-glow`] = glow(x, 1.62, baseZ + z, a.glow, 1.7, 0.42); // 火盆光晕=主题暖光色（翠庭暖橙/古殿青/熔心炽橙/晶顶紫）
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

  const a = t.art; // 本层主题美术（一行数据 → 全套材质/环色）
  const wcy = WALL_H / 2; // 墙中心 y（下沿坐地 y0）

  const out: Record<string, Ent> = {
    // ── 浮空微缩盒庭：分层基座（往下收窄的两级台·§B 基座 y −1.0 / −2.3）——基座=围墙材质压暗一档（同族有纵深）──
    [`${P}-plinth1`]: { ...block(0, -1.0, baseZ, hw * 2 + 1.0, 0.6, hd * 2 + 1.0, dk(t.floorSide, 0.18), dk(t.floorSide, 0.34)), Material3D: plinthMat(a.struct, 0.22) },
    [`${P}-plinth2`]: { ...block(0, -2.3, baseZ, hw * 2 + 0.3, 0.7, hd * 2 + 0.3, dk(t.floorSide, 0.42), dk(t.floorSide, 0.56)), Material3D: plinthMat(a.struct, 0.42) },
    // 竞技场地台（顶在 y=0·§B 薄地格 0.45）——**主题地盘**（owner 2026-07-06 主题美术·a.floor：翠庭绿草/古殿冷石/熔心玄武岩/晶顶冰面）。
    [`${P}-floor`]: { ...block(0, -FLOOR_H / 2, baseZ, hw * 2, FLOOR_H, hd * 2, t.floorTop, t.floorSide), Material3D: a.floor },
    // 三面围墙（左/右/后=入口侧·§B 墙高 0.85）——主题结构材（a.struct）
    [`${P}-wall-l`]: { ...block(-hw, wcy, baseZ, WALL_T, WALL_H, hd * 2, t.wall, t.floorSide), Material3D: a.struct },
    [`${P}-wall-r`]: { ...block(hw, wcy, baseZ, WALL_T, WALL_H, hd * 2, t.wall, t.floorSide), Material3D: a.struct },
    [`${P}-wall-back`]: { ...block(0, wcy, baseZ - hd, hw * 2, WALL_H, WALL_T, t.wall, t.floorSide), Material3D: a.struct },
    // 前墙留中央门洞（+Z 端·通向上一间·发光门楣 + 门内符文光幕）
    [`${P}-wall-fl`]: { ...block(-segCx, wcy, baseZ + hd, segW, WALL_H, WALL_T, t.wall, t.floorSide), Material3D: a.struct },
    [`${P}-wall-fr`]: { ...block(segCx, wcy, baseZ + hd, segW, WALL_H, WALL_T, t.wall, t.floorSide), Material3D: a.struct },
    [`${P}-door-top`]: { ...block(0, WALL_H + 0.16, baseZ + hd, DOOR, 0.32, WALL_T, t.accent, t.wall), Material3D: a.bright }, // 门楣=主题亮件
    [`${P}-portal`]: block(0, 0.5, baseZ + hd - 0.04, DOOR - 0.15, WALL_H + 0.15, 0.08, t.accent, t.accent),
    [`${P}-door-glow`]: glow(0, 0.75, baseZ + hd - 0.2, a.glow, 2.4, 0.6), // 门符文光晕=主题光色
    // 通向上一间的短走廊（穿过门洞·暗示"还有更上面"）——同主题地盘材质
    [`${P}-corridor`]: { ...block(0, -FLOOR_H / 2, baseZ + ROOM_SPACING / 2, DOOR, FLOOR_H, ROOM_SPACING - hd - HD, t.floorTop, t.floorSide), Material3D: a.floor },
    // ── 四角发光火盆（主题材质/光色·微缩盒庭标志·§B @±4.3）──
    ...cornerBraziers(P, baseZ, hw, hd, a),
    // 命运之环：两个小巧竖立旋转金属环，摆在**战场左上角/右上角**（+Z 端门侧火炬位·owner 2026-07-03）——多轴变速乱转·染主题环色。
    [`${P}-ring-l`]: metalRing(-(hw + 0.8), 1.85, baseZ + (hd + 0.8), 0.8, 0, a.ring),
    [`${P}-ring-r`]: metalRing(hw + 0.8, 1.85, baseZ + (hd + 0.8), 0.8, 1, a.ring),
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
      // 中性冷灰天穹（owner 2026-07-06 去黄改铁皮·IBL 决定金属成像色）。运行时由 setMood 盒庭支同步（此值仅首帧前）。
      sky: { Sky3D: { top: 0xbcc2c9, bottom: 0xa4aab2, clouds: false, cloudTint: 0xdfe3e8, scroll: 0.3 } },
    },
  };
}
