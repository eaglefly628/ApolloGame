// Game 102 · 3D 体素立方 —— **雕刻爽快版原型（throwaway·render-only·丢弃版）**。
//
// owner 2026-07-27 定案 v4·关卡化：立方**自动转**·每面两阶段（① 换色窗·只选色 ② 开火窗·点方块=以那格为中心集中火力）。
// 过关核心 = **破坏率**；埋藏 3 颗宝石 = 额外达成。**资源按关配**：时间关 / 弹药关 / 混合关（弹药关带弹药功能格·打碎返弹）。
// 尺寸按关升：5×5 教学 → 6/7/8×8（8 是选项非固定）。菜单先选关。功能格词表（火力/加时/引爆/弹药）= 会长大的东西·加行即扩展。
//
// ⚠ 一次性手感原型（宿主胶水·render-only·非数据驱动正式版）。物理/运动全**自管每帧积分**(非 cannon-es)→ 零冻结。
import { Engine } from '../../runtime/engine.js';
import { QueuedInputSource } from '@net/index.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { Transform3D, Pivot3D } from '@engine/protocol/components.js';
import { AssetManager, ImageAssetLoader, registerAssetIndex, parseAssetIndex } from '@assets/index.js';

const PITCH = 33, VOX = 33; // 体素尺寸固定（立方随 N 变大·相机距离按 N 缩放 → 屏上观感一致）
const FACE_MS = 6000;     // 每面总停留（含换色窗 + 开火窗）
const FIRE_MS = 170;      // 开火窗内发射节拍（单炮·当前色）
const REACH_LAYERS = 2;   // 炮可达层数（表面第1层 + 第2层·打得进·第3层起打不到·owner）
const TWEEN = 0.010;
const POWER_MS = 3500;    // 火力格：频率翻倍时长
const TIME_BONUS = 4000;  // 加时格：全局倒计时 +此（ms）
const AMMO_REFUND = 6;    // 弹药格：返还子弹数（弹药关才有意义）
const BOMB_R = 1;
const GEM_N = 3;
const TRAVEL_MS = 240, FRAG_N = 6, GRAV = 900;
// ── 功能格类型表（数据驱动雏形·加行即扩展）──
type CellKind = 'power' | 'time' | 'bomb' | 'ammo';
const CELLS: Record<CellKind, { edge: number; glyph: string; label: string; css: string; weight: number }> = {
  power: { edge: 0xff7a3a, glyph: '🔥', label: '火力', css: '#ff8a4a', weight: 30 },
  time:  { edge: 0x6ad0ff, glyph: '⏱', label: '加时', css: '#6ad0ff', weight: 30 },
  bomb:  { edge: 0xff4a3a, glyph: '💥', label: '引爆', css: '#ff5a4a', weight: 26 },
  ammo:  { edge: 0xffe08a, glyph: '🔫', label: '弹药', css: '#ffe08a', weight: 30 }, // 弹药关专属
};
const pickCellKind = (r: number, kinds: CellKind[]): CellKind => {
  const wsum = kinds.reduce((a, k) => a + CELLS[k].weight, 0); let x = r * wsum;
  for (const k of kinds) { x -= CELLS[k].weight; if (x < 0) return k; } return kinds[0];
};
const GEM_EDGE = 0xffffff, GEM_CSS = '#8fefff';
const PALETTE = [
  { name: '红', tint: 0xe0433f, css: '#e0433f' },
  { name: '黄', tint: 0xf2c21e, css: '#f2c21e' },
  { name: '绿', tint: 0x5cb544, css: '#5cb544' },
  { name: '蓝', tint: 0x2e6cf6, css: '#2e6cf6' },
  { name: '紫', tint: 0x8b5cf6, css: '#8b5cf6' },
];
const ORIENT: [number, number][] = [
  [0, 0], [0, -Math.PI / 2], [0, -Math.PI], [0, -Math.PI * 1.5], [-Math.PI / 2, 0], [Math.PI / 2, 0],
];

// ── 关卡配置（资源按关·尺寸按关·功能格词表按关）──
type Resource = 'time' | 'ammo' | 'both';
// pickMs 缺省=不限时换色（观察窗内全局时间+转面都暂停·玩家从容选·按「开打」开始）；设了值=限时换色（倒计时自动开打·加压）。
interface LevelConfig { name: string; n: number; resource: Resource; totalMs?: number; ammoFrac?: number; revealPass: number; cells: CellKind[]; pickMs?: number; }
const LEVELS: LevelConfig[] = [
  { name: '入门 · 时间', n: 5, resource: 'time', totalMs: 70000, revealPass: 0.5, cells: ['time'] },
  { name: '火力 · 时间', n: 5, resource: 'time', totalMs: 65000, revealPass: 0.55, cells: ['power', 'time'] },
  { name: '连爆 · 时间', n: 6, resource: 'time', totalMs: 78000, revealPass: 0.55, cells: ['power', 'time', 'bomb'] },
  { name: '弹药 · 补给', n: 6, resource: 'ammo', ammoFrac: 0.85, revealPass: 0.55, cells: ['ammo', 'power', 'bomb'] },
  { name: '混合 · 进阶', n: 7, resource: 'both', totalMs: 88000, ammoFrac: 1.0, revealPass: 0.6, cells: ['ammo', 'power', 'time', 'bomb'] },
  { name: '大师 · 限时换色', n: 8, resource: 'both', totalMs: 95000, ammoFrac: 0.92, revealPass: 0.6, cells: ['ammo', 'power', 'time', 'bomb'], pickMs: 2800 },
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
// 普通格：描边 = 深 edgeTint + 体素略小于 PITCH 留细缝（方块间那根线）；纹理 = **每色一套主题材质**（instancing 安全·不破归批）。
//   owner 主题：红=火焰 / 蓝=水 / 黄=黄金 / 紫=紫罗兰 / 绿=草木。真实火/水动图需 Material3D 逐格(破实例化·限尺寸)→ 此处用程序化 voxelTex 近似。
const CELLSZ = PITCH - 3; // 体素渲染边长 < PITCH(33) → 细缝 = 像素格分隔线（描边）
const COLOR_TEX: ((t: number) => Record<string, unknown>)[] = [
  (t) => ({ top: shade(t, 1.3), side: shade(t, 0.7), top2: shade(t, 1.6), trim: 0xffc79a, pattern: 'crystal', tile: 30 }),  // 0 红=火焰（暖·亮闪）
  (t) => ({ top: shade(t, 1.24), side: shade(t, 0.68), top2: shade(t, 1.65), trim: 0xfff0b0, pattern: 'crystal', tile: 22 }), // 1 黄=黄金（金属高光）
  (t) => ({ top: shade(t, 1.1), side: shade(t, 0.8), pattern: 'grass', tile: 22 }),                                          // 2 绿=草木
  (t) => ({ top: shade(t, 1.18), side: shade(t, 0.86), top2: shade(t, 1.42), trim: 0xcfeaff, pattern: 'crystal', tile: 40 }), // 3 蓝=水（清凉波光）
  (t) => ({ top: shade(t, 1.2), side: shade(t, 0.8), top2: shade(t, 1.46), trim: 0xe6ccff, pattern: 'crystal', tile: 26 }),  // 4 紫=紫罗兰（宝石）
];
const voxMesh = (t: number, ci = 0): Record<string, unknown> => ({ shape: 'box', width: CELLSZ, height: CELLSZ, depth: CELLSZ, frontTint: t, backTint: t, edgeTint: shade(t, 0.6), voxelTex: COLOR_TEX[ci % COLOR_TEX.length](t) });
// 功能格贴图 key（美术台账·数据映射）→ 当 emissiveMap（透明底白符号·只符号处发光·底色=方块本身调色板色透出）。
const CELL_ICON_KEY: Record<CellKind, string> = { power: 'cell-icon/fire', time: 'cell-icon/time', bomb: 'cell-icon/bomb', ammo: 'cell-icon/ammo' };
const gemMesh = (): Record<string, unknown> => ({ shape: 'box', width: CELLSZ, height: CELLSZ, depth: CELLSZ, frontTint: 0x9ff2ff, backTint: 0x9ff2ff, edgeTint: GEM_EDGE, voxelTex: { top: 0xd8ffff, side: 0x7fe0ff, top2: 0xffffff, trim: 0xffffff, pattern: 'crystal', tile: 20 } });
type Style = { name: string; post: Record<string, unknown> };
const STYLES: Style[] = [
  { name: '厚AO', post: { ao: { intensity: 1.8, radius: 7 }, vignette: { intensity: 0.38 }, aa: true } },
  { name: '标准', post: { ao: { intensity: 1.2, radius: 6 }, bloom: { strength: 0.22, threshold: 0.75 }, aa: true } },
  { name: '鲜艳', post: { ao: { intensity: 0.9, radius: 6 }, bloom: { strength: 0.45, threshold: 0.65 }, grade: { saturation: 1.22, contrast: 1.08 }, aa: true } },
];
function el(tag: string, css: string, html?: string): HTMLElement { const e = document.createElement(tag); e.style.cssText = css; if (html !== undefined) e.innerHTML = html; return e; }
const RES_ICON: Record<Resource, string> = { time: '⏱', ammo: '🔫', both: '⏱🔫' };

// 对外入口：先选关菜单 → 起关（可再来/回菜单）。
export function mountVoxelProto(container: HTMLElement, host?: { exit: () => void }): () => void {
  let dispose = (): void => {};
  const toMenu = (): void => { dispose(); dispose = renderMenu(container, startLevel); };
  const startLevel = (cfg: LevelConfig): void => { dispose(); const boot = (): void => { const d = runOne(container, cfg, () => { d(); boot(); }, toMenu); dispose = d; }; boot(); };
  toMenu();
  return () => dispose();
}

// 选关器（DOM·丢弃版）。
function renderMenu(container: HTMLElement, onPick: (cfg: LevelConfig) => void): () => void {
  const outer = el('div', 'position:absolute;inset:0;overflow:auto;background:radial-gradient(120% 80% at 50% 0%,#16305a,#060d18 70%);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:40px 16px;');
  container.appendChild(outer);
  outer.appendChild(el('div', 'color:#ffd77a;font:900 34px system-ui;text-shadow:0 3px 10px #000;letter-spacing:2px;margin-bottom:6px;', '色流工坊'));
  outer.appendChild(el('div', 'color:#9fc0ee;font:700 14px system-ui;margin-bottom:26px;', '选关 · 转面切色·点着雕'));
  const grid = el('div', 'display:grid;grid-template-columns:repeat(2,minmax(150px,1fr));gap:14px;width:100%;max-width:420px;');
  LEVELS.forEach((cfg, i) => {
    const card = el('button', 'pointer-events:auto;cursor:pointer;border:2px solid #35507a;border-radius:16px;background:linear-gradient(#182a4a,#0e1a30);color:#fff;padding:16px 12px;text-align:left;box-shadow:0 4px 12px #0007;display:flex;flex-direction:column;gap:6px;');
    card.appendChild(el('div', 'font:900 19px system-ui;', `${i + 1}. ${cfg.name}`));
    card.appendChild(el('div', 'color:#9fc0ee;font:700 13px system-ui;', `${cfg.n}×${cfg.n} · ${RES_ICON[cfg.resource]} · 破坏 ${Math.round(cfg.revealPass * 100)}%`));
    card.appendChild(el('div', 'font:700 15px system-ui;letter-spacing:2px;', cfg.cells.map((k) => CELLS[k].glyph).join(' ')));
    card.onclick = () => onPick(cfg);
    grid.appendChild(card);
  });
  outer.appendChild(grid);
  return () => outer.remove();
}

function runOne(container: HTMLElement, cfg: LevelConfig, restart: () => void, toMenu: () => void): () => void {
  const N = cfg.n;
  const MAXC = ((N - 1) / 2) * PITCH;
  const idx2pos = (i: number): number => (i - (N - 1) / 2) * PITCH;
  const PLATE_Y = -MAXC * 1.8, PLATE_HALF = MAXC * 1.35, PLATE_TH = 18;
  const SIDES: { n: [number, number, number]; axis: number; val: number; ua: number; ub: number }[] = [
    { n: [0, 0, 1],  axis: 2, val: N - 1, ua: 0, ub: 1 },
    { n: [0, 0, -1], axis: 2, val: 0,     ua: 0, ub: 1 },
    { n: [1, 0, 0],  axis: 0, val: N - 1, ua: 2, ub: 1 },
    { n: [-1, 0, 0], axis: 0, val: 0,     ua: 2, ub: 1 },
    { n: [0, 1, 0],  axis: 1, val: N - 1, ua: 0, ub: 2 },
    { n: [0, -1, 0], axis: 1, val: 0,     ua: 0, ub: 2 },
  ];
  const hasTime = cfg.resource === 'time' || cfg.resource === 'both';
  const hasAmmo = cfg.resource === 'ammo' || cfg.resource === 'both';

  // ── 世界生成 ──
  const colorAt = new Map<string, number>();
  const present = new Set<string>();
  const cellType = new Map<string, CellKind>();
  const gemSet = new Set<string>();
  const coverByColor: number[] = PALETTE.map(() => 0);
  const CELL_FRAC = 0.11;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const id = vid(i, j, k); present.add(id);
    const c = Math.floor(hash3(i, j, k) * PALETTE.length) % PALETTE.length; colorAt.set(id, c); coverByColor[c]++;
    if (hash3(i + 7, j + 13, k + 29) < CELL_FRAC) cellType.set(id, pickCellKind(hash3(i + 31, j + 17, k + 5), cfg.cells));
  }
  const interior: [number, number, number, number][] = [];
  for (let i = 1; i < N - 1; i++) for (let j = 1; j < N - 1; j++) for (let k = 1; k < N - 1; k++) interior.push([i, j, k, hash3(i * 3 + 1, j * 5 + 2, k * 7 + 3)]);
  interior.sort((a, b) => a[3] - b[3]);
  for (let n = 0; n < Math.min(GEM_N, interior.length); n++) { const [i, j, k] = interior[n]; const id = vid(i, j, k); gemSet.add(id); cellType.delete(id); }

  const coverTotal = coverByColor.reduce((a, b) => a + b, 0);
  let coverRemaining = coverTotal;
  let gemsGot = 0;
  let ammoPool = hasAmmo ? Math.ceil(coverTotal * (cfg.ammoFrac ?? 0.9)) : 0;
  const tintOf = (id: string): number => PALETTE[colorAt.get(id) ?? 0].tint;
  const inB = (v: number): boolean => v >= 0 && v < N;
  const exposed = (i: number, j: number, k: number): boolean => {
    if (!present.has(vid(i, j, k))) return false;
    return [[i+1,j,k],[i-1,j,k],[i,j+1,k],[i,j-1,k],[i,j,k+1],[i,j,k-1]].some(([a, b, c]) => !inB(a) || !inB(b) || !inB(c) || !present.has(vid(a, b, c)));
  };
  const meshOf = (id: string): Record<string, unknown> => gemSet.has(id) ? gemMesh() : voxMesh(tintOf(id), colorAt.get(id) ?? 0); // 每色一套主题材质·功能格底盒同(图标走 emissiveMap)
  const materialOf = (id: string): Record<string, unknown> | null => { const k = cellType.get(id); return k ? { preset: 'matte', color: tintOf(id), emissive: 0xffffff, emissiveIntensity: 1.35, emissiveMap: CELL_ICON_KEY[k] } : null; }; // 底色=本色·白符号发光叠加

  // ── 对局状态 ──
  let currentColor = 0;
  let phase: 'pick' | 'fire' = 'pick';
  let pickLeft = cfg.pickMs ?? 0;
  let focusTarget: [number, number, number] | null = null;
  let focusScreen: { x: number; y: number } | null = null; // 点中格的屏幕坐标（画虚线+选中标记·开火窗立方停稳→静止有效）
  let styleIdx = 0;
  let orientIdx = 0, faceLeft = FACE_MS;
  let globalLeft = cfg.totalMs ?? 90000;
  let curRx = ORIENT[0][0], curRy = ORIENT[0][1];
  let rapidLeft = 0;

  const rendered = new Set<string>();
  const buildScene = (): WorldBlueprint => {
    const entities: Record<string, EntityBlueprint> = {}; const ids: string[] = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
      if (!exposed(i, j, k)) continue;
      const id = vid(i, j, k); const mat = materialOf(id);
      entities[id] = { Transform3D: { x: idx2pos(i), y: idx2pos(j), z: idx2pos(k) }, Mesh3D: meshOf(id), Pickable3D: { signal: 'hit' }, ...(mat ? { Material3D: mat } : {}) } as unknown as EntityBlueprint;
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
  // 功能格图标贴图资产（异步·就绪后 assetReady 触发重渲上屏·未就绪=纯色底盒回退·不炸）。
  const assets = new AssetManager(new ImageAssetLoader());
  void (async () => { try { const r = await fetch('/games/game102/art/index.json', { cache: 'no-store' }); if (!r.ok) return; registerAssetIndex(assets, parseAssetIndex(await r.json())); await assets.loadAll(); } catch { /* 无美术目录 → 回退纯色底盒·不炸 */ } })();
  const renderer = new ThreeRenderer({ width: fw, height: fh, background: 0x0e1a30, antialias: true, dprCap: 1.5, shadowMapSize: 1024, assets });
  engine.attachRenderer(renderer, wrapper);

  // ── 顶部：破坏率 + 宝石 + 时间(时间关) + 弹药(弹药关) ──
  const top = el('div', 'position:absolute;left:0;right:0;top:14px;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;padding:0 12px;pointer-events:none;');
  const dmg = el('div', 'padding:7px 14px;border-radius:20px;background:#0c1a30;border:2px solid #26385c;color:#ffd77a;font:800 16px system-ui;', '破坏 0%');
  const gemPill = el('div', 'padding:7px 14px;border-radius:20px;background:#0c1a30;border:2px solid #2f6f7a;color:#8fefff;font:800 16px system-ui;', `💎 0/${GEM_N}`);
  const facePill = el('div', 'padding:7px 16px;border-radius:20px;background:linear-gradient(#3a7bd5,#2a5cae);color:#fff;font:800 16px system-ui;box-shadow:0 3px 0 #1c3e7a;', `⏱ ${Math.ceil((cfg.totalMs ?? 90000) / 1000)}`);
  const ammoPill = el('div', 'padding:7px 14px;border-radius:20px;background:#0c1a30;border:2px solid #4a5c3a;color:#c7f27a;font:800 16px system-ui;', `🔫 ${ammoPool}`);
  top.appendChild(dmg); top.appendChild(gemPill); if (hasTime) top.appendChild(facePill); if (hasAmmo) top.appendChild(ammoPill);
  wrapper.appendChild(top);
  const timeBar = el('div', 'position:absolute;left:0;top:0;height:5px;background:#7fe3ff;width:100%;');
  wrapper.appendChild(timeBar);
  const banner = el('div', 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font:900 38px system-ui;color:#8affa0;text-shadow:0 3px 14px #000;pointer-events:none;padding:0 20px;white-space:pre-line;');
  wrapper.appendChild(banner);
  const hint = el('div', 'position:absolute;left:50%;top:92px;transform:translateX(-50%);z-index:22;pointer-events:none;padding:7px 18px;border-radius:16px;background:#0c1a30dd;border:1px solid #7fe3ff66;color:#dff;font:800 16px system-ui;opacity:0;transition:opacity .15s;white-space:nowrap;');
  wrapper.appendChild(hint);
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
  const legend = el('div', 'position:absolute;left:0;right:0;top:52px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:0 12px;pointer-events:none;');
  wrapper.appendChild(legend);
  // 结算按钮：再来 + 选关。
  const overRow = el('div', 'position:absolute;left:50%;top:58%;transform:translateX(-50%);display:none;z-index:40;gap:12px;pointer-events:auto;');
  const againBtn = el('button', 'background:linear-gradient(#ffcf4a,#f2a81e);color:#3a2500;border:none;border-radius:14px;padding:12px 24px;cursor:pointer;font:900 19px system-ui;box-shadow:0 5px 0 #b97e12;', '↻ 再来');
  const menuBtn = el('button', 'background:#1a2740;color:#cfe;border:1px solid #35507a;border-radius:14px;padding:12px 24px;cursor:pointer;font:900 19px system-ui;', '≡ 选关');
  againBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); restart(); });
  menuBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); toMenu(); });
  overRow.appendChild(againBtn); overRow.appendChild(menuBtn); wrapper.appendChild(overRow);
  // 常驻返回菜单（左上）。
  const backBtn = el('button', 'position:absolute;left:8px;top:60px;z-index:20;pointer-events:auto;background:#1a2740ee;color:#cfe;border:1px solid #35507a;border-radius:8px;padding:6px 12px;cursor:pointer;font:700 13px system-ui;', '≡');
  backBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); toMenu(); });
  wrapper.appendChild(backBtn);
  const flash = el('div', 'position:absolute;inset:0;pointer-events:none;z-index:25;background:radial-gradient(circle,#ffdca066,#ff6a2a00 70%);opacity:0;');
  wrapper.appendChild(flash);
  const impactFx = (strength: number): void => {
    const s = Math.min(1, strength);
    wrapper.animate?.([{ transform: 'translate(0,0)' }, { transform: `translate(${6 * s}px,${-5 * s}px)` }, { transform: `translate(${-5 * s}px,${4 * s}px)` }, { transform: 'translate(0,0)' }], { duration: 220 });
    flash.animate?.([{ opacity: 0.55 * s }, { opacity: 0 }], { duration: 300 });
  };
  // ── 炮台 + 选中虚线（owner：选中色进炮台·点方块给选中反馈 + 一根虚线从炮台指向中心）──
  const cannonX = fw / 2, cannonY = fh - 150;
  const NS = 'http://www.w3.org/2000/svg';
  const aimSvg = document.createElementNS(NS, 'svg'); aimSvg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:23;');
  const aimLine = document.createElementNS(NS, 'line'); aimLine.setAttribute('stroke', '#ffffff'); aimLine.setAttribute('stroke-width', '3'); aimLine.setAttribute('stroke-dasharray', '9 8'); aimLine.setAttribute('stroke-linecap', 'round'); aimLine.setAttribute('opacity', '0');
  aimSvg.appendChild(aimLine); wrapper.appendChild(aimSvg);
  const selMark = el('div', 'position:absolute;width:46px;height:46px;border:3px solid #fff;border-radius:9px;box-shadow:0 0 16px #fff,inset 0 0 8px #fff8;transform:translate(-50%,-50%);pointer-events:none;z-index:24;opacity:0;');
  wrapper.appendChild(selMark);
  const cannon = el('div', `position:absolute;left:${cannonX}px;top:${cannonY}px;z-index:24;pointer-events:none;`);
  const barrel = el('div', `position:absolute;left:-11px;top:-54px;width:22px;height:54px;border-radius:9px 9px 4px 4px;background:${PALETTE[0].css};box-shadow:0 2px 6px #0009,inset 0 0 7px #fff7;transform-origin:50% 100%;transition:transform .12s;`);
  const cbase = el('div', 'position:absolute;left:-27px;top:-27px;width:54px;height:54px;border-radius:50%;background:radial-gradient(#2a3a58,#0c1526);border:3px solid #3a5680;box-shadow:0 4px 12px #0008;');
  cannon.appendChild(barrel); cannon.appendChild(cbase); wrapper.appendChild(cannon);
  const updateAim = (): void => {
    if (!over && phase === 'fire' && focusScreen) {
      aimLine.setAttribute('x1', String(cannonX)); aimLine.setAttribute('y1', String(cannonY - 48));
      aimLine.setAttribute('x2', String(focusScreen.x)); aimLine.setAttribute('y2', String(focusScreen.y)); aimLine.setAttribute('opacity', '0.9');
      selMark.style.left = `${focusScreen.x}px`; selMark.style.top = `${focusScreen.y}px`; selMark.style.opacity = '1';
      const dx = focusScreen.x - cannonX, dy = focusScreen.y - cannonY; barrel.style.transform = `rotate(${Math.atan2(dx, -dy) * 180 / Math.PI}deg)`;
    } else { aimLine.setAttribute('opacity', '0'); selMark.style.opacity = '0'; barrel.style.transform = 'rotate(0deg)'; }
  };
  const loadFx = (c: number): void => { // 选中色 → 一个色块 cube 飞进中心炮管 + 炮台染色脉冲
    barrel.style.background = PALETTE[c].css;
    const cr = cubeWraps[c].getBoundingClientRect(), wr = wrapper.getBoundingClientRect();
    const sx = cr.left - wr.left + cr.width / 2, sy = cr.top - wr.top + cr.height / 2;
    const fly = el('div', `position:absolute;left:${sx}px;top:${sy}px;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:7px;background:${PALETTE[c].css};box-shadow:0 0 16px ${PALETTE[c].css},inset 0 0 8px #fff8;z-index:26;pointer-events:none;`);
    wrapper.appendChild(fly);
    const a = fly.animate?.([{ transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 }, { transform: `translate(${cannonX - sx}px,${cannonY - 48 - sy}px) rotate(230deg) scale(0.35)`, opacity: 0.6 }], { duration: 360, easing: 'cubic-bezier(.5,0,.9,.6)' });
    const done = (): void => { fly.remove(); cbase.animate?.([{ transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 220 }); barrel.animate?.([{ filter: 'brightness(1.9)' }, { filter: 'brightness(1)' }], { duration: 260 }); };
    if (a) a.onfinish = done; else done();
  };
  const styleBtn = el('button', 'position:absolute;right:8px;top:60px;z-index:20;pointer-events:auto;background:#1a2740ee;color:#cfe;border:1px solid #35507a;border-radius:8px;padding:6px 12px;cursor:pointer;font:700 13px system-ui;', `🎨 ${STYLES[0].name}`);
  styleBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  const applyStyle = (idx: number): void => { styleIdx = ((idx % STYLES.length) + STYLES.length) % STYLES.length; const st = STYLES[styleIdx]; engine.world.removeComponent('post', 'Post3D'); engine.world.addComponent('post', { type: 'Post3D', ...st.post } as never); styleBtn.textContent = `🎨 ${st.name}`; };
  styleBtn.onclick = () => applyStyle(styleIdx + 1);
  wrapper.appendChild(styleBtn);

  // ── 底部：开打钮（换色阶段·不限时关·放颜色上方不挡观察）+ 5 个随机旋转的色块 cube = 当前主攻色 ──
  const hex = (n: number): string => `#${((n >>> 0) & 0xffffff).toString(16).padStart(6, '0')}`;
  const makeColorCube = (c: number): { wrap: HTMLElement; inner: HTMLElement } => {
    const S = 52, h = S / 2, base = PALETTE[c].tint;
    const wrap = el('div', `position:relative;width:${S}px;height:${S}px;perspective:200px;cursor:pointer;user-select:none;transition:filter .12s,transform .12s;`);
    const inner = el('div', 'position:absolute;inset:0;transform-style:preserve-3d;');
    const mkFace = (tf: string, k: number): HTMLElement => el('div', `position:absolute;width:${S}px;height:${S}px;background:${hex(shade(base, k))};transform:${tf};backface-visibility:hidden;`);
    inner.appendChild(mkFace(`translateZ(${h}px)`, 1.0));
    inner.appendChild(mkFace(`rotateY(180deg) translateZ(${h}px)`, 0.62));
    inner.appendChild(mkFace(`rotateY(90deg) translateZ(${h}px)`, 0.8));
    inner.appendChild(mkFace(`rotateY(-90deg) translateZ(${h}px)`, 0.8));
    inner.appendChild(mkFace(`rotateX(90deg) translateZ(${h}px)`, 1.2));
    inner.appendChild(mkFace(`rotateX(-90deg) translateZ(${h}px)`, 0.5));
    wrap.appendChild(inner);
    wrap.addEventListener('pointerdown', (e) => { e.stopPropagation(); setColor(c); });
    return { wrap, inner };
  };
  const bottom = el('div', 'position:absolute;left:0;right:0;bottom:16px;display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:none;');
  const startBtn = el('button', 'pointer-events:auto;display:none;background:linear-gradient(#8affa0,#3fbf68);color:#06301a;border:none;border-radius:14px;padding:10px 36px;cursor:pointer;font:900 20px system-ui;box-shadow:0 5px 0 #2a8f4c;', '▶ 开打');
  startBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (phase === 'pick') phase = 'fire'; });
  bottom.appendChild(startBtn);
  bottom.appendChild(el('div', 'color:#9fc0ee;font:800 12px system-ui;letter-spacing:1px;', '当前主攻色 · 点旋转方块切换'));
  const cubeRow = el('div', 'display:flex;gap:14px;pointer-events:auto;');
  const cubeWraps: HTMLElement[] = []; const cubeInners: HTMLElement[] = [];
  const cubeAng = PALETTE.map((_, c) => ({ x: c * 0.7, y: c * 1.3, vx: 0.0009 + c * 0.00022, vy: 0.0013 - c * 0.00015 }));
  PALETTE.forEach((_, c) => { const { wrap, inner } = makeColorCube(c); cubeWraps.push(wrap); cubeInners.push(inner); cubeRow.appendChild(wrap); });
  bottom.appendChild(cubeRow);
  wrapper.appendChild(bottom);

  const setColor = (c: number): void => { currentColor = c; refresh(); cubeWraps[c].animate?.([{ transform: 'scale(1.4) translateY(-6px)' }, { transform: 'scale(1.24) translateY(-6px)' }], { duration: 200 }); loadFx(c); };
  const refresh = (): void => {
    cubeWraps.forEach((w, c) => {
      if (c === currentColor) { w.style.filter = `drop-shadow(0 0 10px ${PALETTE[c].css})`; w.style.transform = 'scale(1.24) translateY(-6px)'; }
      else { w.style.filter = 'none'; w.style.transform = 'scale(1)'; }
    });
    dmg.textContent = `破坏 ${Math.round(((coverTotal - coverRemaining) / coverTotal) * 100)}% / ${Math.round(cfg.revealPass * 100)}%`;
    gemPill.textContent = `💎 ${gemsGot}/${GEM_N}`;
    if (hasAmmo) ammoPill.textContent = `🔫 ${ammoPool}`;
  };
  const cellFx = (text: string, css: string): void => {
    const tick = el('div', `position:absolute;left:50%;top:50px;transform:translateX(-50%);color:${css};font:900 22px system-ui;text-shadow:0 2px 8px #000,0 0 12px ${css};pointer-events:none;z-index:30;white-space:nowrap;`, text);
    wrapper.appendChild(tick);
    tick.animate?.([{ transform: 'translate(-50%,0)', opacity: 1 }, { transform: 'translate(-50%,-30px)', opacity: 0 }], { duration: 680 });
    setTimeout(() => tick.remove(), 700);
  };
  refresh();

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

  // ── 运动体 ──
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
  // 一列上最外的前 REACH_LAYERS 个 present 格（表面第1层 + 第2层·可达）。
  const faceCells = (s: number, a: number, b: number): [number, number, number][] => {
    const S = SIDES[s]; const out: [number, number, number][] = [];
    for (let d = 0; d < N && out.length < REACH_LAYERS; d++) { const co = [0, 0, 0]; co[S.axis] = S.val === N - 1 ? N - 1 - d : d; co[S.ua] = a; co[S.ub] = b; if (present.has(vid(co[0], co[1], co[2]))) out.push([co[0], co[1], co[2]]); }
    return out;
  };
  const aimFace = (s: number, color: number, focus: [number, number, number] | null): [number, number, number] | null => {
    const c0 = (N - 1) / 2;
    let best: [number, number, number] | null = null, bestScore = Infinity, bestSp: [number, number, number] | null = null, bestSpScore = Infinity;
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      const cells = faceCells(s, a, b);
      for (let li = 0; li < cells.length; li++) {
        const v = cells[li]; const id = vid(v[0], v[1], v[2]);
        if (colorAt.get(id) !== color) continue;
        const base = focus ? (v[0] - focus[0]) ** 2 + (v[1] - focus[1]) ** 2 + (v[2] - focus[2]) ** 2 : (a - c0) ** 2 + (b - c0) ** 2;
        const score = base + li * 100; // 略偏好浅层（第1层优先于第2层）
        if (score < bestScore) { bestScore = score; best = v; }
        if ((cellType.has(id) || gemSet.has(id)) && score < bestSpScore) { bestSpScore = score; bestSp = v; }
      }
    }
    return bestSp ?? best;
  };
  const reveal = (i: number, j: number, k: number): void => {
    const id = vid(i, j, k); if (rendered.has(id) || !present.has(id) || !exposed(i, j, k)) return;
    try { engine.world.createEntity(id); } catch { /* */ }
    engine.world.addComponent(id, { type: 'Transform3D', x: idx2pos(i), y: idx2pos(j), z: idx2pos(k) } as unknown as Transform3D);
    engine.world.addComponent(id, { type: 'Mesh3D', ...meshOf(id) } as never);
    engine.world.addComponent(id, { type: 'Pickable3D', signal: 'hit' } as never);
    const mat = materialOf(id); if (mat) engine.world.addComponent(id, { type: 'Material3D', ...mat } as never); // 功能格图标贴图
    engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D')?.children.push(id); rendered.add(id);
    legendDirty = true;
  };
  const breakVox = (i: number, j: number, k: number, chain = false): void => {
    const id = vid(i, j, k); const cc = colorAt.get(id);
    if (!present.has(id)) return;
    const kind = cellType.get(id); const isGem = gemSet.has(id);
    if (cc != null) coverByColor[cc]--;
    coverRemaining--;
    cellType.delete(id); gemSet.delete(id); present.delete(id); legendDirty = true;
    if (rendered.has(id)) { engine.world.destroyEntity(id); const piv = engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D'); if (piv) { const x = piv.children.indexOf(id); if (x >= 0) piv.children.splice(x, 1); } rendered.delete(id); }
    if (chain) { const wp = voxWorld(i, j, k); spawnFrags(wp[0], wp[1], wp[2], PALETTE[cc ?? 0].tint); }
    if (isGem) { gemsGot++; cellFx('💎 宝石！', GEM_CSS); impactFx(0.5); const wp = voxWorld(i, j, k); spawnFrags(wp[0], wp[1], wp[2], 0xbff6ff); }
    if (kind === 'power') { rapidLeft = POWER_MS; cellFx('🔥 齐射翻倍!', CELLS.power.css); }
    else if (kind === 'time') { globalLeft += TIME_BONUS; if (hasTime) facePill.animate?.([{ transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 260 }); cellFx(`⏱ +${(TIME_BONUS / 1000).toFixed(0)}s`, CELLS.time.css); }
    else if (kind === 'ammo') { ammoPool += AMMO_REFUND; if (hasAmmo) ammoPill.animate?.([{ transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 260 }); cellFx(`🔫 +${AMMO_REFUND}`, CELLS.ammo.css); }
    else if (kind === 'bomb') { cellFx('💥 连爆!', CELLS.bomb.css); impactFx(0.9); for (let di = -BOMB_R; di <= BOMB_R; di++) for (let dj = -BOMB_R; dj <= BOMB_R; dj++) for (let dk = -BOMB_R; dk <= BOMB_R; dk++) { const a = i + di, b = j + dj, c = k + dk; if ((di || dj || dk) && inB(a) && inB(b) && inB(c) && present.has(vid(a, b, c))) breakVox(a, b, c, true); } }
    ([[i+1,j,k],[i-1,j,k],[i,j+1,k],[i,j-1,k],[i,j,k+1],[i,j,k-1]] as [number,number,number][]).forEach(([a, b, c]) => { if (inB(a) && inB(b) && inB(c)) reveal(a, b, c); });
  };

  let over: 'win' | 'lose' | null = null;
  const endGame = (kind: 'win' | 'lose', text: string, color: string): void => {
    over = kind; banner.textContent = text; banner.style.color = color; overRow.style.display = 'flex'; hint.style.opacity = '0';
    if (kind === 'win') {
      impactFx(1);
      const piv = engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D'); let burst = 0;
      for (const id of [...rendered]) { const [, si, sj, sk] = id.split('-'); const i = +si, j = +sj, k = +sk; if (burst < 70) { const wp = voxWorld(i, j, k); spawnFrags(wp[0], wp[1], wp[2], tintOf(id)); burst++; } engine.world.destroyEntity(id); if (piv) { const x = piv.children.indexOf(id); if (x >= 0) piv.children.splice(x, 1); } }
      rendered.clear(); present.clear();
    }
  };
  const checkEnd = (): void => {
    if (over) return;
    if ((coverTotal - coverRemaining) / coverTotal >= cfg.revealPass) { endGame('win', `🎉 通关！\n💎 宝石 ${gemsGot}/${GEM_N}`, '#8affa0'); return; }
    const bulletsFlying = movers.some((m) => m.kind === 'bullet');
    if (bulletsFlying) return;
    if (hasTime && globalLeft <= 0) { endGame('lose', '⏱ 时间到 · 破坏不足', '#ff8a8a'); return; }
    if (hasAmmo && ammoPool <= 0) { endGame('lose', '🔫 弹尽 · 破坏不足', '#ff8a8a'); return; }
  };
  const fire = (): void => {
    if (over) return;
    if (hasAmmo && ammoPool <= 0) return;
    if (hasAmmo) { ammoPool--; refresh(); } // 消耗（含空放）→ 选错色也吃弹药 = 决策重量
    const aim = aimFace(frontSide(), currentColor, focusTarget);
    if (aim) {
      const to = voxWorld(aim[0], aim[1], aim[2]);
      const L = Math.hypot(to[0], to[1], to[2]) || 1, D = MAXC * 1.9;
      const from: [number, number, number] = [to[0] + (to[0] / L) * D, to[1] + (to[1] / L) * D, to[2] + (to[2] / L) * D];
      const id = `blt-${movN}`; spawnEnt(id, from[0], from[1], from[2], VOX * 0.55, PALETTE[currentColor].tint);
      movers.push({ kind: 'bullet', id, t: 0, from, to, aim: [aim[0], aim[1], aim[2]] });
    }
    if (hasAmmo) checkEnd();
  };
  let afAcc = 0, wasSettled = false;

  const onTap = (e: PointerEvent): void => {
    if (over || phase !== 'fire') return;
    const hit = renderer.pick(e.clientX, e.clientY);
    if (!hit || !hit.entityId.startsWith('v-')) return;
    const [, si, sj, sk] = hit.entityId.split('-'); focusTarget = [+si, +sj, +sk];
    const rect = wrapper.getBoundingClientRect();
    focusScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top }; updateAim();
    const ring = el('div', `position:absolute;left:${focusScreen.x - 18}px;top:${focusScreen.y - 18}px;width:36px;height:36px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px #fff;pointer-events:none;z-index:24;`);
    wrapper.appendChild(ring); ring.animate?.([{ transform: 'scale(0.5)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 420 }); setTimeout(() => ring.remove(), 440);
  };
  wrapper.addEventListener('pointerdown', onTap);

  let raf = 0, last = performance.now();
  const frame = (now: number): void => {
    try {
      const dt = now - last; last = now;
      // 底部 5 个色块 cube 随机旋转（始终转·不受对局暂停影响）。
      for (let c = 0; c < cubeInners.length; c++) { const a = cubeAng[c]; a.x += a.vx * dt; a.y += a.vy * dt; cubeInners[c].style.transform = `rotateX(${a.x}rad) rotateY(${a.y}rad)`; }
      if (!over) {
        // 先判停稳 → 决定是否暂停（换色观察窗：全局时间 + 转面都停·从容选色）。
        const tgt = ORIENT[orientIdx];
        const settled = Math.abs(shortDelta(curRx, tgt[0])) < 0.03 && Math.abs(shortDelta(curRy, tgt[1])) < 0.03;
        if (settled && !wasSettled) { phase = 'pick'; pickLeft = cfg.pickMs ?? 0; focusTarget = null; focusScreen = null; showAnnounce(); }
        wasSettled = settled;
        const paused = settled && phase === 'pick'; // 观察窗 → 冻结时间与转面
        if (!paused) {
          if (hasTime) globalLeft = Math.max(0, globalLeft - dt);
          faceLeft -= dt;
          if (faceLeft <= 0) { orientIdx = (orientIdx + 1) % ORIENT.length; faceLeft = FACE_MS; }
        }
        curRx += shortDelta(curRx, tgt[0]) * Math.min(1, dt * TWEEN);
        curRy += shortDelta(curRy, tgt[1]) * Math.min(1, dt * TWEEN);
        const piv = engine.world.getComponent<Transform3D>('cube-pivot', 'Transform3D'); if (piv) { piv.rotX = curRx; piv.rotY = curRy; }
        if (hasTime) facePill.textContent = `⏱ ${(globalLeft / 1000).toFixed(globalLeft < 10000 ? 1 : 0)}`;
        timeBar.style.width = `${Math.min(100, (faceLeft / FACE_MS) * 100)}%`;
        const wasRapid = rapidLeft > 0; if (rapidLeft > 0 && !paused) rapidLeft = Math.max(0, rapidLeft - dt); const isRapid = rapidLeft > 0;
        if (isRapid !== wasRapid && hasTime) { facePill.style.background = isRapid ? 'linear-gradient(#ff9a3a,#f2671e)' : 'linear-gradient(#3a7bd5,#2a5cae)'; facePill.style.boxShadow = isRapid ? '0 3px 0 #b8430f,0 0 16px #ff8a3a' : '0 3px 0 #1c3e7a'; }
        // 阶段 UI + 开火。开打钮仅在「不限时换色关」的换色窗出现（放颜色上方·不挡观察）。
        startBtn.style.display = paused && !cfg.pickMs ? 'block' : 'none';
        if (!settled) { hint.style.opacity = '0'; afAcc = 0; if (focusScreen) focusScreen = null; }
        else if (phase === 'pick') {
          if (cfg.pickMs) { pickLeft = Math.max(0, pickLeft - dt); hint.textContent = `🎨 选色 · ${(pickLeft / 1000).toFixed(1)}s`; if (pickLeft <= 0) phase = 'fire'; }
          else hint.textContent = '🎨 观察 · 选色后按开打';
          hint.style.opacity = '1'; afAcc = 0;
        } else {
          hint.textContent = '👆 点方块 · 集中火力'; hint.style.opacity = focusScreen ? '0' : '1';
          const cad = isRapid ? FIRE_MS * 0.5 : FIRE_MS;
          afAcc += dt; while (afAcc >= cad) { afAcc -= cad; fire(); }
        }
        if (hasTime && globalLeft <= 0) checkEnd();
        updateAim();
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
