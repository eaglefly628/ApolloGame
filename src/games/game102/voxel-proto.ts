// Game 102 · 3D 体素立方 —— **雕刻爽快版原型（throwaway·render-only·丢弃版）**。
//
// owner 2026-07-27 定案 v3·核心重构：立方**自动转**·每面停到你面前几秒·6 面循环。每面两阶段·一次只做一件事：
//   ① 换色窗（几秒·不开火）：点底部 5 色之一 = 设「当前主攻色」。
//   ② 开火窗：炮自动打当前色的同色暴露格；你**点立方面 = 把火力集中砸到你点的地方**（控制打哪里·零瞄准=点击）。
// 过关核心 = **破坏率**（拆够 REVEAL_PASS 就赢）。埋在里面的 **3 颗宝石 = 额外达成**（挖到并打出=收集·非必需）。
// 稀缺 = **时间**（全局限时 + 每面窗口）：选错色/打空 = 浪费一面的火力窗 = 少破坏。功能格（火力/加时/引爆）= 会长大的词表。
//
// ⚠ 一次性手感原型（宿主胶水·render-only·非数据驱动正式版）。物理/运动全**自管每帧积分**(非 cannon-es)→ 零冻结。
import { Engine } from '../../runtime/engine.js';
import { QueuedInputSource } from '@net/index.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { Transform3D, Pivot3D } from '@engine/protocol/components.js';
import { VOXEL_SURFACES, VOXEL_SURFACE_NAMES, type VoxelSurface } from './voxel-surfaces.js';

const N = 8;              // 立方边长（owner：放大格子·少排数·配 1.5× size 总尺寸不变）
const PITCH = 33;
const VOX = 33;           // =PITCH：相接无缝·1.5× 更大更易辨
const MAXC = ((N - 1) / 2) * PITCH;
const FACE_MS = 6000;     // 每面总停留（含 换色窗 + 开火窗）→ 转下一面
const PICK_MS = 3000;     // 换色窗：停稳后此段不开火·给你看清+选色（只做一件事=选色·owner：来不及看→3s）
const TOTAL_MS = 90000;   // 全局限时（归零=输·加时格喂它）= 主难度旋钮
const TWEEN = 0.010;      // 转面缓动系数（×dt）
const FIRE_MS = 170;      // 开火窗内发射节拍（单炮·当前色·比原三炮齐射清爽）
const REVEAL_PASS = 0.55; // 破坏率≥此 = 过关（核心目标）= 难度旋钮
const CELL_FRAC = 0.11;   // 约此比例格 = 功能格（携带 payload·打碎触发·面上发光晶纹标记）
const POWER_MS = 3500;    // 火力格：发射频率翻倍时长
const TIME_BONUS = 4000;  // 加时格：全局倒计时 +此（ms）
const BOMB_R = 1;         // 引爆格：炸半径（1 = 3×3×3·同为引爆格则连锁）
const GEM_N = 3;          // 埋藏宝石数（额外达成·挖到并打出=收集）
// ── 功能格类型表（数据驱动雏形·下沉正式版即 cellEffects 表的行·扩展=加行）──
type CellKind = 'power' | 'time' | 'bomb';
const CELLS: Record<CellKind, { edge: number; glyph: string; label: string; css: string; weight: number }> = {
  power: { edge: 0xff7a3a, glyph: '🔥', label: '火力', css: '#ff8a4a', weight: 34 }, // 短时齐射翻倍
  time:  { edge: 0x6ad0ff, glyph: '⏱', label: '加时', css: '#6ad0ff', weight: 34 }, // 全局 +时间
  bomb:  { edge: 0xff4a3a, glyph: '💥', label: '引爆', css: '#ff5a4a', weight: 32 }, // 3×3×3 连锁炸
};
const CELL_KINDS = Object.keys(CELLS) as CellKind[];
const CELL_WSUM = CELL_KINDS.reduce((a, k) => a + CELLS[k].weight, 0);
const pickCellKind = (r: number): CellKind => { let x = r * CELL_WSUM; for (const k of CELL_KINDS) { x -= CELLS[k].weight; if (x < 0) return k; } return 'power'; };
const GEM_EDGE = 0xffffff, GEM_CSS = '#8fefff';
const TRAVEL_MS = 240;    // 子弹飞抵（爽快版·快）
const FRAG_N = 6;
const GRAV = 900;
const PALETTE = [        // 5 色（当前主攻色在其中切换）
  { name: '红', tint: 0xe0433f, css: '#e0433f' },
  { name: '黄', tint: 0xf2c21e, css: '#f2c21e' },
  { name: '绿', tint: 0x5cb544, css: '#5cb544' },
  { name: '蓝', tint: 0x2e6cf6, css: '#2e6cf6' },
  { name: '紫', tint: 0x8b5cf6, css: '#8b5cf6' },
];
// 6 面朝相机(+Z)的目标欧拉角（idx 循环）。
const ORIENT: [number, number][] = [
  [0, 0], [0, -Math.PI / 2], [0, -Math.PI], [0, -Math.PI * 1.5], [-Math.PI / 2, 0], [Math.PI / 2, 0],
];
const PLATE_Y = -MAXC * 1.8, PLATE_HALF = MAXC * 1.35, PLATE_TH = 18; // 底部接碎片的盘子
const SIDES: { n: [number, number, number]; axis: number; val: number; ua: number; ub: number }[] = [
  { n: [0, 0, 1],  axis: 2, val: N - 1, ua: 0, ub: 1 },
  { n: [0, 0, -1], axis: 2, val: 0,     ua: 0, ub: 1 },
  { n: [1, 0, 0],  axis: 0, val: N - 1, ua: 2, ub: 1 },
  { n: [-1, 0, 0], axis: 0, val: 0,     ua: 2, ub: 1 },
  { n: [0, 1, 0],  axis: 1, val: N - 1, ua: 0, ub: 2 },
  { n: [0, -1, 0], axis: 1, val: 0,     ua: 0, ub: 2 },
];

function shade(t: number, k: number): number {
  const r = Math.min(255, Math.round(((t >> 16) & 0xff) * k)), g = Math.min(255, Math.round(((t >> 8) & 0xff) * k)), b = Math.min(255, Math.round((t & 0xff) * k));
  return (r << 16) | (g << 8) | b;
}
function hash3(a: number, b: number, c: number): number {
  let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791); h = (h ^ (h >>> 13)) >>> 0; return (h % 997) / 997;
}
function rotVec(x: number, y: number, z: number, rx: number, ry: number): [number, number, number] {
  const cy1 = y * Math.cos(rx) - z * Math.sin(rx), cz1 = y * Math.sin(rx) + z * Math.cos(rx);
  const cx2 = x * Math.cos(ry) + cz1 * Math.sin(ry), cz2 = -x * Math.sin(ry) + cz1 * Math.cos(ry);
  return [cx2, cy1, cz2];
}
const shortDelta = (a: number, b: number): number => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const vid = (i: number, j: number, k: number): string => `v-${i}-${j}-${k}`;
const idx2pos = (i: number): number => (i - (N - 1) / 2) * PITCH;
// ★ 实例化友好：Mesh3D voxelTex（P3D 大规模渲染入库·同款体素归批 InstancedMesh）→ 立方可又大又细·不挂 Material3D。
let voxSurface: VoxelSurface = 'matte'; // 默认干净素面（一个放大的干净体素·中间无拼缝线）
// 普通格 = 干净素面（本色）；功能格 = 面上发光晶纹 + 类型色亮边（贴图即标记·一眼可辨）；宝石 = 亮白晶体。
const funcTex = (t: number, kind: CellKind): Record<string, unknown> => ({ top: shade(t, 1.22), side: shade(t, 0.9), top2: shade(t, 1.45), side2: shade(t, 1.1), trim: CELLS[kind].edge, pattern: 'crystal', tile: 8 });
const voxMesh = (t: number, kind?: CellKind): Record<string, unknown> => kind
  ? { shape: 'box', width: VOX, height: VOX, depth: VOX, frontTint: shade(t, 1.1), backTint: t, edgeTint: CELLS[kind].edge, voxelTex: funcTex(t, kind) }
  : { shape: 'box', width: VOX, height: VOX, depth: VOX, frontTint: t, backTint: t, edgeTint: shade(t, 0.82), voxelTex: VOXEL_SURFACES[voxSurface](t) };
const gemMesh = (): Record<string, unknown> => ({ shape: 'box', width: VOX, height: VOX, depth: VOX, frontTint: 0x9ff2ff, backTint: 0x9ff2ff, edgeTint: GEM_EDGE, voxelTex: { top: 0xd8ffff, side: 0x7fe0ff, top2: 0xffffff, trim: 0xffffff, pattern: 'crystal', tile: 8 } });
// ── 渲染样式集（instancing-safe·只切后处理）──
type Style = { name: string; post: Record<string, unknown> };
const STYLES: Style[] = [
  { name: '厚AO', post: { ao: { intensity: 1.8, radius: 7 }, vignette: { intensity: 0.38 }, aa: true } },
  { name: '标准', post: { ao: { intensity: 1.2, radius: 6 }, bloom: { strength: 0.22, threshold: 0.75 }, aa: true } },
  { name: '鲜艳', post: { ao: { intensity: 0.9, radius: 6 }, bloom: { strength: 0.45, threshold: 0.65 }, grade: { saturation: 1.22, contrast: 1.08 }, aa: true } },
];
function el(tag: string, css: string, html?: string): HTMLElement { const e = document.createElement(tag); e.style.cssText = css; if (html !== undefined) e.innerHTML = html; return e; }

// 对外入口：包一层支持「再来一局」——重开 = 拆掉当前实例 + 重新 boot。
export function mountVoxelProto(container: HTMLElement, host?: { exit: () => void }): () => void {
  let dispose = (): void => {};
  const boot = (): void => { const d = runOne(container, host, () => { d(); boot(); }); dispose = d; };
  boot();
  return () => dispose();
}

function runOne(container: HTMLElement, _host: { exit: () => void } | undefined, restart: () => void): () => void {
  // ── 世界生成：每格一色 0..4 · 撒功能格 · 埋 GEM_N 颗内部宝石 ──
  const colorAt = new Map<string, number>();
  const present = new Set<string>();
  const cellType = new Map<string, CellKind>();
  const gemSet = new Set<string>();
  const coverByColor: number[] = PALETTE.map(() => 0);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const id = vid(i, j, k); present.add(id);
    const c = Math.floor(hash3(i, j, k) * PALETTE.length) % PALETTE.length; colorAt.set(id, c); coverByColor[c]++;
    if (hash3(i + 7, j + 13, k + 29) < CELL_FRAC) cellType.set(id, pickCellKind(hash3(i + 31, j + 17, k + 5)));
  }
  // 宝石埋在内部（非表面·得挖到）·确定性选点。
  const interior: [number, number, number, number][] = [];
  for (let i = 1; i < N - 1; i++) for (let j = 1; j < N - 1; j++) for (let k = 1; k < N - 1; k++) interior.push([i, j, k, hash3(i * 3 + 1, j * 5 + 2, k * 7 + 3)]);
  interior.sort((a, b) => a[3] - b[3]);
  for (let n = 0; n < Math.min(GEM_N, interior.length); n++) { const [i, j, k] = interior[n]; const id = vid(i, j, k); gemSet.add(id); cellType.delete(id); }

  const coverTotal = coverByColor.reduce((a, b) => a + b, 0);
  let coverRemaining = coverTotal;
  let gemsGot = 0;
  const tintOf = (id: string): number => PALETTE[colorAt.get(id) ?? 0].tint;
  const inB = (v: number): boolean => v >= 0 && v < N;
  const exposed = (i: number, j: number, k: number): boolean => {
    if (!present.has(vid(i, j, k))) return false;
    return [[i+1,j,k],[i-1,j,k],[i,j+1,k],[i,j-1,k],[i,j,k+1],[i,j,k-1]].some(([a, b, c]) => !inB(a) || !inB(b) || !inB(c) || !present.has(vid(a, b, c)));
  };
  const meshOf = (id: string): Record<string, unknown> => gemSet.has(id) ? gemMesh() : voxMesh(tintOf(id), cellType.get(id));

  // ── 对局状态 ──
  let currentColor = 0;    // 当前主攻色（换色窗内点色切换）
  let phase: 'pick' | 'fire' = 'pick';
  let pickLeft = PICK_MS;
  let focusTarget: [number, number, number] | null = null; // 开火窗点方块 → 火力集中点
  let styleIdx = 0;
  let orientIdx = 0, faceLeft = FACE_MS;
  let globalLeft = TOTAL_MS;
  let curRx = ORIENT[0][0], curRy = ORIENT[0][1];
  let rapidLeft = 0;

  const rendered = new Set<string>();
  const buildScene = (): WorldBlueprint => {
    const entities: Record<string, EntityBlueprint> = {}; const ids: string[] = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
      if (!exposed(i, j, k)) continue;
      const id = vid(i, j, k);
      entities[id] = { Transform3D: { x: idx2pos(i), y: idx2pos(j), z: idx2pos(k) }, Mesh3D: meshOf(id) as EntityBlueprint['Mesh3D'], Pickable3D: { signal: 'hit' } } as unknown as EntityBlueprint;
      ids.push(id); rendered.add(id);
    }
    entities['post'] = { Post3D: { ...STYLES[0].post } as unknown as EntityBlueprint['Post3D'] };
    entities['plate'] = { Transform3D: { x: 0, y: PLATE_Y, z: 0 }, Mesh3D: { shape: 'box', width: PLATE_HALF * 2, height: PLATE_TH, depth: PLATE_HALF * 2, frontTint: 0x7a5636, backTint: 0x7a5636, edgeTint: 0x503420 } };
    const rimH = 22, rimT = 10, R = PLATE_HALF;
    entities['rim-n'] = { Transform3D: { x: 0, y: PLATE_Y + rimH / 2, z: -R }, Mesh3D: { shape: 'box', width: R * 2 + rimT, height: rimH, depth: rimT, frontTint: 0x8a6440, backTint: 0x8a6440, edgeTint: 0x5c3c22 } };
    entities['rim-s'] = { Transform3D: { x: 0, y: PLATE_Y + rimH / 2, z: R }, Mesh3D: { shape: 'box', width: R * 2 + rimT, height: rimH, depth: rimT, frontTint: 0x8a6440, backTint: 0x8a6440, edgeTint: 0x5c3c22 } };
    entities['rim-e'] = { Transform3D: { x: R, y: PLATE_Y + rimH / 2, z: 0 }, Mesh3D: { shape: 'box', width: rimT, height: rimH, depth: R * 2 + rimT, frontTint: 0x8a6440, backTint: 0x8a6440, edgeTint: 0x5c3c22 } };
    entities['rim-w'] = { Transform3D: { x: -R, y: PLATE_Y + rimH / 2, z: 0 }, Mesh3D: { shape: 'box', width: rimT, height: rimH, depth: R * 2 + rimT, frontTint: 0x8a6440, backTint: 0x8a6440, edgeTint: 0x5c3c22 } };
    entities['cube-pivot'] = { Transform3D: { x: 0, y: 0, z: 0, rotX: curRx, rotY: curRy }, Pivot3D: { children: ids, centerX: 0, centerY: 0, centerZ: 0 } };
    entities['cam'] = { Transform3D: { x: 0, y: 0, z: 0 }, Camera3D: { yaw: 0.42, pitch: 0.42, distance: N * PITCH * 4.5, pivotX: 0, pivotY: -MAXC * 0.55, pivotZ: 0, projection: 'perspective', fov: 40 } };
    entities['sky'] = { Sky3D: { top: 0x0c1730, bottom: 0x14243f, env: 0.5 } };
    entities['sun'] = { Light3D: { kind: 'directional', color: 0xffffff, intensity: 1.15, dirX: -0.45, dirY: -0.9, dirZ: -0.55, castShadow: true } };
    entities['amb'] = { Light3D: { kind: 'ambient', color: 0xa8bce0, intensity: 0.6 } };
    return { capabilities: [], entities };
  };

  const outer = el('div', 'position:absolute;inset:0;overflow:hidden;background:#060d18;display:flex;align-items:center;justify-content:center;');
  container.appendChild(outer);
  const ASPECT = 0.5625; const cw = outer.clientWidth || 900, ch = outer.clientHeight || 1400;
  let fw = Math.round(ch * ASPECT), fh = ch; if (fw > cw) { fw = cw; fh = Math.round(cw / ASPECT); }
  const wrapper = el('div', `position:relative;width:${fw}px;height:${fh}px;overflow:hidden;touch-action:none;background:#0e1a30;`
    + 'background-image:linear-gradient(#ffffff10 1px,transparent 1px),linear-gradient(90deg,#ffffff10 1px,transparent 1px);background-size:48px 48px;box-shadow:0 0 40px #000a;');
  outer.appendChild(wrapper);

  const engine = new Engine({ input: new QueuedInputSource('g102p') });
  engine.load(buildScene());
  const renderer = new ThreeRenderer({ width: fw, height: fh, background: 0x0e1a30, antialias: true, dprCap: 1.5, shadowMapSize: 1024 });
  engine.attachRenderer(renderer, wrapper);

  // ── 顶部：破坏率 + 宝石 + 全局倒计时 ──
  const top = el('div', 'position:absolute;left:0;right:0;top:14px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;pointer-events:none;');
  const dmg = el('div', 'padding:8px 16px;border-radius:20px;background:#0c1a30;border:2px solid #26385c;color:#ffd77a;font:800 17px system-ui;', '破坏 0%');
  const gemPill = el('div', 'padding:8px 16px;border-radius:20px;background:#0c1a30;border:2px solid #2f6f7a;color:#8fefff;font:800 17px system-ui;', `💎 0/${GEM_N}`);
  const facePill = el('div', 'padding:8px 18px;border-radius:20px;background:linear-gradient(#3a7bd5,#2a5cae);color:#fff;font:800 17px system-ui;box-shadow:0 3px 0 #1c3e7a;', `⏱ ${Math.ceil(TOTAL_MS / 1000)}`);
  top.appendChild(dmg); top.appendChild(gemPill); top.appendChild(facePill); wrapper.appendChild(top);
  const timeBar = el('div', 'position:absolute;left:0;top:0;height:5px;background:#7fe3ff;width:100%;');
  wrapper.appendChild(timeBar);
  const banner = el('div', 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font:900 40px system-ui;color:#8affa0;text-shadow:0 3px 14px #000;pointer-events:none;padding:0 20px;');
  wrapper.appendChild(banner);
  // 阶段提示（换色 / 点方块）。
  const hint = el('div', 'position:absolute;left:50%;top:44%;transform:translateX(-50%);z-index:22;pointer-events:none;padding:7px 18px;border-radius:16px;background:#0c1a30dd;border:1px solid #7fe3ff66;color:#dff;font:800 17px system-ui;opacity:0;transition:opacity .15s;white-space:nowrap;');
  wrapper.appendChild(hint);
  // 前置屏幕提醒（强调 UI·bigtext 风·换色窗一开砸出来·抓注意不错过选色）。
  const announce = el('div', 'position:absolute;left:0;right:0;top:38%;display:flex;justify-content:center;pointer-events:none;z-index:32;');
  const announceInner = el('div', 'padding:14px 40px;border-radius:20px;background:linear-gradient(#ffe58a,#f2b21e);color:#5a3800;font:900 40px system-ui;letter-spacing:2px;box-shadow:0 6px 0 #b97e12,0 10px 30px #000a,inset 0 2px 0 #fff8;text-shadow:0 2px 0 #fff6;opacity:0;', '🎨 换色');
  announce.appendChild(announceInner); wrapper.appendChild(announce);
  const showAnnounce = (): void => {
    announceInner.animate?.([
      { opacity: 0, transform: 'scale(0.5) rotate(-6deg)' },
      { opacity: 1, transform: 'scale(1.12) rotate(2deg)', offset: 0.35 },
      { opacity: 1, transform: 'scale(1) rotate(0deg)', offset: 0.6 },
      { opacity: 0, transform: 'scale(0.96)' },
    ], { duration: 1100, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  };
  // 本面补给清单（当前面有哪些功能格·什么色）。
  const legend = el('div', 'position:absolute;left:0;right:0;top:56px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:0 12px;pointer-events:none;');
  wrapper.appendChild(legend);
  // 再来一局。
  const againBtn = el('button', 'position:absolute;left:50%;top:58%;transform:translateX(-50%);display:none;z-index:40;pointer-events:auto;background:linear-gradient(#ffcf4a,#f2a81e);color:#3a2500;border:none;border-radius:14px;padding:12px 30px;cursor:pointer;font:900 20px system-ui;box-shadow:0 5px 0 #b97e12,0 8px 18px #0008;', '↻ 再来一局');
  againBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); restart(); });
  wrapper.appendChild(againBtn);
  // 冲击特效：屏震 + 暖光一闪（引爆/通关用）。
  const flash = el('div', 'position:absolute;inset:0;pointer-events:none;z-index:25;background:radial-gradient(circle,#ffdca066,#ff6a2a00 70%);opacity:0;');
  wrapper.appendChild(flash);
  const impactFx = (strength: number): void => {
    const s = Math.min(1, strength);
    wrapper.animate?.([{ transform: 'translate(0,0)' }, { transform: `translate(${6 * s}px,${-5 * s}px)` }, { transform: `translate(${-5 * s}px,${4 * s}px)` }, { transform: 'translate(0,0)' }], { duration: 220 });
    flash.animate?.([{ opacity: 0.55 * s }, { opacity: 0 }], { duration: 300 });
  };
  // 渲染样式 / 表面切换（调参用）。
  const styleBtn = el('button', 'position:absolute;right:8px;top:60px;z-index:20;pointer-events:auto;background:#1a2740ee;color:#cfe;border:1px solid #35507a;border-radius:8px;padding:6px 12px;cursor:pointer;font:700 13px system-ui;', `🎨 ${STYLES[0].name}`);
  styleBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  const applyStyle = (idx: number): void => { styleIdx = ((idx % STYLES.length) + STYLES.length) % STYLES.length; const st = STYLES[styleIdx]; engine.world.removeComponent('post', 'Post3D'); engine.world.addComponent('post', { type: 'Post3D', ...st.post } as never); styleBtn.textContent = `🎨 ${st.name}`; };
  styleBtn.onclick = () => applyStyle(styleIdx + 1);
  wrapper.appendChild(styleBtn);
  const surfBtn = el('button', 'position:absolute;right:8px;top:98px;z-index:20;pointer-events:auto;background:#1a2740ee;color:#cfe;border:1px solid #35507a;border-radius:8px;padding:6px 12px;cursor:pointer;font:700 13px system-ui;', '🧊');
  surfBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  const SURF_LABEL: Record<VoxelSurface, string> = { speed: '提速块', gem: '宝石', matte: '素面' };
  surfBtn.onclick = () => {
    const cur = VOXEL_SURFACE_NAMES.indexOf(voxSurface); voxSurface = VOXEL_SURFACE_NAMES[(cur + 1) % VOXEL_SURFACE_NAMES.length]; surfBtn.textContent = `🧊 ${SURF_LABEL[voxSurface]}`;
    for (const id of rendered) { engine.world.removeComponent(id, 'Mesh3D'); engine.world.addComponent(id, { type: 'Mesh3D', ...meshOf(id) } as never); }
  };
  surfBtn.textContent = `🧊 ${SURF_LABEL[voxSurface]}`;
  wrapper.appendChild(surfBtn);

  // ── 底部：5 色 = 当前主攻色（点切换·换色窗高亮）──
  const bottom = el('div', 'position:absolute;left:0;right:0;bottom:18px;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;');
  bottom.appendChild(el('div', 'color:#9fc0ee;font:800 12px system-ui;letter-spacing:1px;', '当前主攻色 · 点切换'));
  const chipRow = el('div', 'display:flex;gap:12px;pointer-events:auto;');
  const chips: HTMLElement[] = [];
  PALETTE.forEach((p, c) => {
    const chip = el('div', `width:58px;height:58px;border-radius:14px;background:${p.css};box-shadow:0 3px 6px #0008;cursor:pointer;user-select:none;transition:transform .06s,box-shadow .1s;`);
    chip.addEventListener('pointerdown', (e) => { e.stopPropagation(); setColor(c); });
    chips.push(chip); chipRow.appendChild(chip);
  });
  bottom.appendChild(chipRow);
  wrapper.appendChild(bottom);

  const setColor = (c: number): void => { currentColor = c; refresh(); chips[c].animate?.([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 200 }); };
  const refresh = (): void => {
    chips.forEach((ch, c) => {
      if (c === currentColor) { ch.style.boxShadow = `0 0 0 4px #fff,0 0 22px 6px ${PALETTE[c].css};`; ch.style.transform = 'scale(1.14) translateY(-4px)'; }
      else { ch.style.boxShadow = '0 3px 6px #0008'; ch.style.transform = 'scale(1)'; }
    });
    dmg.textContent = `破坏 ${Math.round(((coverTotal - coverRemaining) / coverTotal) * 100)}% / ${Math.round(REVEAL_PASS * 100)}%`;
    gemPill.textContent = `💎 ${gemsGot}/${GEM_N}`;
  };
  const cellFx = (text: string, css: string): void => {
    const tick = el('div', `position:absolute;left:50%;top:50px;transform:translateX(-50%);color:${css};font:900 22px system-ui;text-shadow:0 2px 8px #000,0 0 12px ${css};pointer-events:none;z-index:30;white-space:nowrap;`, text);
    wrapper.appendChild(tick);
    tick.animate?.([{ transform: 'translate(-50%,0)', opacity: 1 }, { transform: 'translate(-50%,-30px)', opacity: 0 }], { duration: 680 });
    setTimeout(() => tick.remove(), 700);
  };
  refresh();

  // 本面补给清单：扫前面每列最外露格·统计 (类型,颜色)。
  let legendSide = -1, legendDirty = true;
  const updateFaceLegend = (s: number): void => {
    const tally = new Map<string, { kind: CellKind; color: number; n: number }>();
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      const v = faceVisible(s, a, b); if (!v) continue; const id = vid(v[0], v[1], v[2]);
      const kind = cellType.get(id); if (!kind) continue; const color = colorAt.get(id) ?? 0;
      const key = `${kind}-${color}`; const e = tally.get(key); if (e) e.n++; else tally.set(key, { kind, color, n: 1 });
    }
    legend.innerHTML = '';
    const rows = [...tally.values()].sort((x, y) => y.n - x.n).slice(0, 6);
    for (const r of rows) {
      const chip = el('div', `display:flex;align-items:center;gap:4px;padding:3px 9px;border-radius:14px;background:#0c1a30cc;border:2px solid ${PALETTE[r.color].css};font:800 14px system-ui;color:#fff;text-shadow:0 1px 2px #000;`);
      chip.appendChild(el('span', `width:11px;height:11px;border-radius:3px;background:${PALETTE[r.color].css};display:inline-block;`));
      chip.appendChild(el('span', '', `${CELLS[r.kind].glyph}×${r.n}`));
      legend.appendChild(chip);
    }
  };

  // ── 运动体（子弹/碎片·自管积分）──
  type Bullet = { kind: 'bullet'; id: string; t: number; from: [number, number, number]; to: [number, number, number]; aim: [number, number, number] };
  type Frag = { kind: 'frag'; id: string; p: [number, number, number]; v: [number, number, number]; life: number };
  const movers: (Bullet | Frag)[] = []; const movEnt = new Set<string>(); let movN = 0;
  const spawnEnt = (id: string, x: number, y: number, z: number, size: number, tint: number): void => {
    try { engine.world.createEntity(id); } catch { /* */ }
    engine.world.addComponent(id, { type: 'Transform3D', x, y, z } as unknown as Transform3D);
    engine.world.addComponent(id, { type: 'Mesh3D', shape: 'box', width: size, height: size, depth: size, frontTint: tint, backTint: tint, edgeTint: shade(tint, 0.8) } as never);
    movEnt.add(id);
  };
  const despawnEnt = (id: string): void => { if (movEnt.has(id)) { try { engine.world.destroyEntity(id); } catch { /* */ } movEnt.delete(id); } };
  const setPos = (id: string, x: number, y: number, z: number): void => { const t = engine.world.getComponent<Transform3D>(id, 'Transform3D'); if (t) { t.x = x; t.y = y; t.z = z; } };
  const voxWorld = (i: number, j: number, k: number): [number, number, number] => rotVec(idx2pos(i), idx2pos(j), idx2pos(k), curRx, curRy);
  const prand = (): number => hash3(movN++, coverRemaining, coverTotal);
  const spawnFrags = (wx: number, wy: number, wz: number, tint: number): void => {
    let fc = 0; for (const m of movers) if (m.kind === 'frag') fc++;
    while (fc > 140) { const k = movers.findIndex((m) => m.kind === 'frag'); if (k < 0) break; despawnEnt(movers[k].id); movers.splice(k, 1); fc--; }
    const L = Math.hypot(wx, wy, wz) || 1, ox = wx / L, oy = wy / L, oz = wz / L;
    for (let n = 0; n < FRAG_N; n++) {
      const id = `frag-${movN}`; spawnEnt(id, wx, wy, wz, VOX * 0.6, tint);
      engine.world.addComponent(id, { type: 'Anim3D', channels: [{ kind: 'spring', field: 'scale', from: 0.35, to: 1, freq: 8, damping: 0.35 }] } as never);
      movers.push({ kind: 'frag', id, p: [wx, wy, wz], v: [ox * 260 + (prand() - 0.5) * 220, oy * 260 + 160 + prand() * 150, oz * 260 + (prand() - 0.5) * 220], life: 2.6 });
    }
  };

  const CAMV: [number, number, number] = [Math.sin(0.42) * Math.cos(0.42), Math.sin(0.42), Math.cos(0.42) * Math.cos(0.42)];
  const frontSide = (): number => { let best = 0, bd = -Infinity; for (let s = 0; s < 6; s++) { const rn = rotVec(SIDES[s].n[0], SIDES[s].n[1], SIDES[s].n[2], curRx, curRy); const dot = rn[0] * CAMV[0] + rn[1] * CAMV[1] + rn[2] * CAMV[2]; if (dot > bd) { bd = dot; best = s; } } return best; };
  const faceVisible = (s: number, a: number, b: number): [number, number, number] | null => {
    const S = SIDES[s];
    for (let d = 0; d < N; d++) { const co = [0, 0, 0]; co[S.axis] = S.val === N - 1 ? N - 1 - d : d; co[S.ua] = a; co[S.ub] = b; if (present.has(vid(co[0], co[1], co[2]))) return [co[0], co[1], co[2]]; }
    return null;
  };
  // 前面上「暴露 + 当前色」的目标：★优先功能格/宝石·按到 focus（点的地方·否则面心）的距离取最近 → 你点哪就往哪打。
  const aimFace = (s: number, color: number, focus: [number, number, number] | null): [number, number, number] | null => {
    const c0 = (N - 1) / 2;
    let best: [number, number, number] | null = null, bestScore = Infinity, bestSp: [number, number, number] | null = null, bestSpScore = Infinity;
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      const v = faceVisible(s, a, b); if (!v) continue; const id = vid(v[0], v[1], v[2]);
      if (colorAt.get(id) !== color) continue;
      const score = focus ? (v[0] - focus[0]) ** 2 + (v[1] - focus[1]) ** 2 + (v[2] - focus[2]) ** 2 : (a - c0) ** 2 + (b - c0) ** 2;
      if (score < bestScore) { bestScore = score; best = v; }
      if ((cellType.has(id) || gemSet.has(id)) && score < bestSpScore) { bestSpScore = score; bestSp = v; }
    }
    return bestSp ?? best;
  };
  const reveal = (i: number, j: number, k: number): void => {
    const id = vid(i, j, k); if (rendered.has(id) || !present.has(id) || !exposed(i, j, k)) return;
    try { engine.world.createEntity(id); } catch { /* */ }
    engine.world.addComponent(id, { type: 'Transform3D', x: idx2pos(i), y: idx2pos(j), z: idx2pos(k) } as unknown as Transform3D);
    engine.world.addComponent(id, { type: 'Mesh3D', ...meshOf(id) } as never);
    engine.world.addComponent(id, { type: 'Pickable3D', signal: 'hit' } as never);
    engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D')?.children.push(id); rendered.add(id);
    legendDirty = true;
  };
  // 破坏一格：记账 + 宝石收集 + 功能格效果 + 露内层；引爆格连锁炸。chain=true=被连锁波及（自冒碎片）。
  const breakVox = (i: number, j: number, k: number, chain = false): void => {
    const id = vid(i, j, k); const cc = colorAt.get(id);
    if (!present.has(id)) return;
    const kind = cellType.get(id); const isGem = gemSet.has(id);
    if (cc != null) coverByColor[cc]--;
    coverRemaining--;
    cellType.delete(id); gemSet.delete(id); present.delete(id); legendDirty = true;
    // focusTarget 不因这格碎了而清 → 火力以「你点的那格」为中心持续砸周围（区域集中·非单格·owner）。
    if (rendered.has(id)) { engine.world.destroyEntity(id); const piv = engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D'); if (piv) { const x = piv.children.indexOf(id); if (x >= 0) piv.children.splice(x, 1); } rendered.delete(id); }
    if (chain) { const wp = voxWorld(i, j, k); spawnFrags(wp[0], wp[1], wp[2], PALETTE[cc ?? 0].tint); }
    if (isGem) { gemsGot++; cellFx('💎 宝石！', GEM_CSS); impactFx(0.5); const wp = voxWorld(i, j, k); spawnFrags(wp[0], wp[1], wp[2], 0xbff6ff); }
    if (kind === 'power') { rapidLeft = POWER_MS; cellFx('🔥 齐射翻倍!', CELLS.power.css); }
    else if (kind === 'time') { globalLeft += TIME_BONUS; facePill.animate?.([{ transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 260 }); cellFx(`⏱ +${(TIME_BONUS / 1000).toFixed(0)}s`, CELLS.time.css); }
    else if (kind === 'bomb') { cellFx('💥 连爆!', CELLS.bomb.css); impactFx(0.9); for (let di = -BOMB_R; di <= BOMB_R; di++) for (let dj = -BOMB_R; dj <= BOMB_R; dj++) for (let dk = -BOMB_R; dk <= BOMB_R; dk++) { const a = i + di, b = j + dj, c = k + dk; if ((di || dj || dk) && inB(a) && inB(b) && inB(c) && present.has(vid(a, b, c))) breakVox(a, b, c, true); } }
    ([[i+1,j,k],[i-1,j,k],[i,j+1,k],[i,j-1,k],[i,j,k+1],[i,j,k-1]] as [number,number,number][]).forEach(([a, b, c]) => { if (inB(a) && inB(b) && inB(c)) reveal(a, b, c); });
  };

  let over: 'win' | 'lose' | null = null;
  const endGame = (kind: 'win' | 'lose', text: string, color: string): void => {
    over = kind; banner.textContent = text; banner.style.color = color; againBtn.style.display = 'block'; hint.style.opacity = '0';
    if (kind === 'win') { // 通关烟花：把剩下的都轰掉（可见部分冒碎片）。
      impactFx(1);
      const piv = engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D'); let burst = 0;
      for (const id of [...rendered]) { const [, si, sj, sk] = id.split('-'); const i = +si, j = +sj, k = +sk; if (burst < 70) { const wp = voxWorld(i, j, k); spawnFrags(wp[0], wp[1], wp[2], tintOf(id)); burst++; } engine.world.destroyEntity(id); if (piv) { const x = piv.children.indexOf(id); if (x >= 0) piv.children.splice(x, 1); } }
      rendered.clear(); present.clear();
    }
  };
  const checkEnd = (): void => {
    if (over) return;
    if ((coverTotal - coverRemaining) / coverTotal >= REVEAL_PASS) { endGame('win', `🎉 通关！\n💎 宝石 ${gemsGot}/${GEM_N}`, '#8affa0'); return; }
    if (globalLeft <= 0 && !movers.some((m) => m.kind === 'bullet')) { endGame('lose', '⏱ 时间到 · 破坏不足', '#ff8a8a'); return; }
  };
  // 单发（开火窗按拍调用）：正对面有当前色暴露格 → 射子弹清一格·否则空放（浪费这一发火力窗）。
  const fire = (): void => {
    if (over) return;
    const aim = aimFace(frontSide(), currentColor, focusTarget);
    if (aim) {
      const to = voxWorld(aim[0], aim[1], aim[2]);
      const L = Math.hypot(to[0], to[1], to[2]) || 1, D = MAXC * 1.9;
      const from: [number, number, number] = [to[0] + (to[0] / L) * D, to[1] + (to[1] / L) * D, to[2] + (to[2] / L) * D];
      const id = `blt-${movN}`; spawnEnt(id, from[0], from[1], from[2], VOX * 0.55, PALETTE[currentColor].tint);
      movers.push({ kind: 'bullet', id, t: 0, from, to, aim: [aim[0], aim[1], aim[2]] });
    }
  };
  let afAcc = 0, wasSettled = false;

  // 开火窗内点立方面 → 集中火力到点中的格（render.pick 射线拾取·零瞄准=点击）。
  const onTap = (e: PointerEvent): void => {
    if (over || phase !== 'fire') return;
    const hit = renderer.pick(e.clientX, e.clientY);
    if (!hit || !hit.entityId.startsWith('v-')) return;
    const [, si, sj, sk] = hit.entityId.split('-'); focusTarget = [+si, +sj, +sk];
    const rect = wrapper.getBoundingClientRect();
    const ring = el('div', `position:absolute;left:${e.clientX - rect.left - 18}px;top:${e.clientY - rect.top - 18}px;width:36px;height:36px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px #fff;pointer-events:none;z-index:24;`);
    wrapper.appendChild(ring); ring.animate?.([{ transform: 'scale(0.5)', opacity: 1 }, { transform: 'scale(1.4)', opacity: 0 }], { duration: 380 }); setTimeout(() => ring.remove(), 400);
  };
  wrapper.addEventListener('pointerdown', onTap);

  // ── 主循环（自管·全 try/catch·绝不冻结）──
  let raf = 0, last = performance.now();
  const frame = (now: number): void => {
    try {
      const dt = now - last; last = now;
      if (!over) {
        globalLeft = Math.max(0, globalLeft - dt);
        faceLeft -= dt;
        if (faceLeft <= 0) { orientIdx = (orientIdx + 1) % ORIENT.length; faceLeft = FACE_MS; }
        const [trx, try_] = ORIENT[orientIdx];
        curRx += shortDelta(curRx, trx) * Math.min(1, dt * TWEEN);
        curRy += shortDelta(curRy, try_) * Math.min(1, dt * TWEEN);
        const piv = engine.world.getComponent<Transform3D>('cube-pivot', 'Transform3D'); if (piv) { piv.rotX = curRx; piv.rotY = curRy; }
        facePill.textContent = `⏱ ${(globalLeft / 1000).toFixed(globalLeft < 10000 ? 1 : 0)}`;
        timeBar.style.width = `${Math.min(100, (faceLeft / FACE_MS) * 100)}%`;
        // 火力格：频率翻倍 + 可见指示。
        const wasRapid = rapidLeft > 0; if (rapidLeft > 0) rapidLeft = Math.max(0, rapidLeft - dt); const isRapid = rapidLeft > 0;
        if (isRapid !== wasRapid) { facePill.style.background = isRapid ? 'linear-gradient(#ff9a3a,#f2671e)' : 'linear-gradient(#3a7bd5,#2a5cae)'; facePill.style.boxShadow = isRapid ? '0 3px 0 #b8430f,0 0 16px #ff8a3a' : '0 3px 0 #1c3e7a'; }
        // 停稳判定 → 两阶段状态机（换色窗 → 开火窗）·转动中不做任何事（修打错面）。
        const tgt = ORIENT[orientIdx];
        const settled = Math.abs(shortDelta(curRx, tgt[0])) < 0.03 && Math.abs(shortDelta(curRy, tgt[1])) < 0.03;
        if (settled && !wasSettled) { phase = 'pick'; pickLeft = PICK_MS; focusTarget = null; showAnnounce(); } // 新面 → 进换色窗·前置强调提醒·清上一面集中点
        wasSettled = settled;
        if (!settled) { hint.style.opacity = '0'; afAcc = 0; }
        else if (phase === 'pick') {
          pickLeft = Math.max(0, pickLeft - dt);
          hint.textContent = `🎨 选色 · ${(pickLeft / 1000).toFixed(1)}s`; hint.style.opacity = '1'; afAcc = 0;
          if (pickLeft <= 0) phase = 'fire';
        } else {
          hint.textContent = '👆 点方块 · 集中火力'; hint.style.opacity = focusTarget ? '0' : '1'; // 点了就不再提示
          const cad = isRapid ? FIRE_MS * 0.5 : FIRE_MS;
          afAcc += dt; while (afAcc >= cad) { afAcc -= cad; fire(); }
        }
        if (globalLeft <= 0) checkEnd();
        const fs = frontSide(); if (fs !== legendSide || legendDirty) { legendSide = fs; legendDirty = false; updateFaceLegend(fs); }
      }
      const ds = Math.min(dt, 50) / 1000;
      for (let m = movers.length - 1; m >= 0; m--) {
        const mv = movers[m];
        if (mv.kind === 'bullet') {
          mv.t += dt; const f = Math.min(1, mv.t / TRAVEL_MS);
          setPos(mv.id, mv.from[0] + (mv.to[0] - mv.from[0]) * f, mv.from[1] + (mv.to[1] - mv.from[1]) * f, mv.from[2] + (mv.to[2] - mv.from[2]) * f);
          if (f >= 1) {
            despawnEnt(mv.id); movers.splice(m, 1);
            if (present.has(vid(mv.aim[0], mv.aim[1], mv.aim[2]))) { const wp = voxWorld(mv.aim[0], mv.aim[1], mv.aim[2]); const ft = tintOf(vid(mv.aim[0], mv.aim[1], mv.aim[2])); breakVox(mv.aim[0], mv.aim[1], mv.aim[2]); spawnFrags(wp[0], wp[1], wp[2], ft); }
            refresh(); checkEnd();
          }
        } else {
          mv.v[1] -= GRAV * ds; mv.p[0] += mv.v[0] * ds; mv.p[1] += mv.v[1] * ds; mv.p[2] += mv.v[2] * ds;
          const fhh = VOX * 0.3, topY = PLATE_Y + PLATE_TH / 2 + fhh, R = PLATE_HALF - fhh;
          if (mv.p[1] < topY) { mv.p[1] = topY; if (mv.v[1] < 0) mv.v[1] = -mv.v[1] * 0.34; mv.v[0] *= 0.7; mv.v[2] *= 0.7; }
          mv.p[0] = Math.max(-R, Math.min(R, mv.p[0])); mv.p[2] = Math.max(-R, Math.min(R, mv.p[2]));
          mv.life -= ds; setPos(mv.id, mv.p[0], mv.p[1], mv.p[2]);
          if (mv.life <= 0 || mv.p[1] < -MAXC * 8) { despawnEnt(mv.id); movers.splice(m, 1); }
        }
      }
    } catch { /* 绝不冻结 */ }
    try { renderer.sync(engine.world); } catch { /* */ }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    wrapper.removeEventListener('pointerdown', onTap);
    movers.forEach((mv) => despawnEnt(mv.id));
    engine.stop();
    renderer.destroy();
    outer.remove();
  };
}
