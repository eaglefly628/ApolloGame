// Game 102 · 3D 体素立方 —— **雕刻爽快版原型（throwaway·render-only·丢弃版）**。
//
// owner 2026-07-26 定案 v1：立方**自动转**·每 5 秒转到下一面·6 面循环。3 门炮自动扫射当前面**同色暴露格**
// （零瞄准·从中心往外啃=扫射感）·海量碎片=爽。立方小而体素多(N=12)。
// owner 2026-07-27 定案 v2·**全局共享弹药**：弹药 = 全局一个池（任何颜色都从这一池扣·打空即输）·不再每色/每面回满。
// → 空放（槽色没对齐这面 = 无同色暴露格 = 打不出去仍扣弹）直接吃掉总预算 → 换槽/调度有全局重量 = Pixel Flow 调度焦虑。
// Pixel Flow 的 DNA：不瞄准 + 同色 + 暴露逐层；张力 = **限时转面 + 全局弹药预算**（错配 → 池耗尽 → 输）。道具(别色弹/炸弹)下一版接。
//
// ⚠ 一次性手感原型（宿主胶水·render-only·非数据驱动正式版）。物理/运动全**自管每帧积分**(非 cannon-es)→ 零冻结。
import { Engine } from '../../runtime/engine.js';
import { QueuedInputSource } from '@net/index.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { Transform3D, Pivot3D } from '@engine/protocol/components.js';
import { VOXEL_SURFACES, VOXEL_SURFACE_NAMES, type VoxelSurface } from './voxel-surfaces.js';

const N = 8;              // 立方边长（owner：放大格子=少排数·12→8·配 1.5× size 总尺寸不变·更易看清）
const PITCH = 33;
const VOX = 33;           // =PITCH：相接无缝·1.5× 更大更易辨（原 22）
const MAXC = ((N - 1) / 2) * PITCH;
const FACE_MS = 5000;     // 每面停留（ms）→ 转下一面（固定·永不延长·总有节奏地轮面）
const TOTAL_MS = 75000;   // ★ 全局限时（整局倒计时·归零=输）·加时格喂这个·非每面
const TWEEN = 0.010;      // 转面缓动系数（×dt）
const FIRE_MS = 300;      // 自动发射节拍（轮流一门炮射一发·慢下来=不乱·原 150 太密）
const AMMO_POOL_FRAC = 0.9; // 全局弹药池 = 外料总数 ×此（<1 → 打空前必须靠"少浪费"露够·空放吃预算）= 过关难度旋钮
const CELL_FRAC = 0.11;    // 约此比例外料格 = 特殊格（格子变少→略提密度保可见量）
const AMMO_REFUND = 3;     // 弹药格返还子弹数
const POWER_MS = 3500;     // 火力格：齐射频率翻倍持续时长
const TIME_BONUS = 4000;   // 加时格：给全局倒计时 +此（ms）
const BOMB_R = 1;          // 引爆格：炸半径（1 = 3×3×3 邻域·同为引爆格则连锁）
// ── 特殊格类型表（数据驱动雏形·下沉正式版即 cellEffects 表的行）──
//   body 仍是本色（→ 仍按色瞄准）·edge 发光色 + glyph 编码类型（一眼识别值钱/危险）。
type CellKind = 'ammo' | 'power' | 'time' | 'bomb';
const CELLS: Record<CellKind, { edge: number; glyph: string; label: string; css: string; weight: number }> = {
  ammo:  { edge: 0xffe08a, glyph: '🔫', label: '弹药', css: '#ffe08a', weight: 42 }, // +弹
  power: { edge: 0xff7a3a, glyph: '🔥', label: '火力', css: '#ff8a4a', weight: 20 }, // 短时齐射翻倍
  time:  { edge: 0x6ad0ff, glyph: '⏱', label: '加时', css: '#6ad0ff', weight: 20 }, // 当前面 +时间
  bomb:  { edge: 0xff4a3a, glyph: '💥', label: '引爆', css: '#ff5a4a', weight: 18 }, // 3×3×3 连锁炸
};
const CELL_KINDS = Object.keys(CELLS) as CellKind[];
const CELL_WSUM = CELL_KINDS.reduce((a, k) => a + CELLS[k].weight, 0);
const pickCellKind = (r: number): CellKind => { let x = r * CELL_WSUM; for (const k of CELL_KINDS) { x -= CELLS[k].weight; if (x < 0) return k; } return 'ammo'; };
const REVEAL_PASS = 0.7;  // 剥掉多少外料算「雕像现形」过关
const GOLD_TINT = 0xffd24a; // 雕像色（受保护·gold）
const TRAVEL_MS = 260;    // 子弹飞抵（爽快版·快）
const FRAG_N = 6;
const GRAV = 900;
// sprite = 炮台精灵资产的站点绝对路径（已登记 public/games/game102/art/index.json·id `cannon-tower/<color>`·
//   由 scripts/game-102-cannon-gen.mjs 程序化生成·CC0）。DOM 炮图标直接 background-image 消费此 URL。
const PALETTE = [        // 总 5 色·但同时只有 3 个发射槽（稀缺调度）
  { name: '红', tint: 0xe0433f, css: '#e0433f', sprite: '/games/game102/art/cannon-tower-red.png' },
  { name: '黄', tint: 0xf2c21e, css: '#f2c21e', sprite: '/games/game102/art/cannon-tower-yellow.png' },
  { name: '绿', tint: 0x5cb544, css: '#5cb544', sprite: '/games/game102/art/cannon-tower-green.png' },
  { name: '蓝', tint: 0x2e6cf6, css: '#2e6cf6', sprite: '/games/game102/art/cannon-tower-blue.png' },
  { name: '紫', tint: 0x8b5cf6, css: '#8b5cf6', sprite: '/games/game102/art/cannon-tower-purple.png' },
];
const SLOT_N = 3;         // 发射槽数（< 颜色数 → 你得快速换槽对齐这一面的色）
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
  const r = Math.round(((t >> 16) & 0xff) * k), g = Math.round(((t >> 8) & 0xff) * k), b = Math.round((t & 0xff) * k);
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
// ★ 实例化友好：Mesh3D voxelTex（P3D 大规模渲染入库·同款体素归批 InstancedMesh）→ 立方可又大又细。
//   **不挂 Material3D**（挂了会退化成单 mesh/格·卡且做不大·见 three-renderer:312）。观感靠 GTAO/post 出厚度。
//   表面观感走 voxel-surfaces 预设配方（数据驱动·闭集·同 (surface,color) 一批 → 不破归批）。
let voxSurface: VoxelSurface = 'gem';  // 默认宝石感（当前展示态·下方按钮可循环切换）
const voxMesh = (t: number, kind?: CellKind): Record<string, unknown> => ({ shape: 'box', width: VOX, height: VOX, depth: VOX, frontTint: t, backTint: t, edgeTint: kind ? CELLS[kind].edge : shade(t, 0.82), voxelTex: VOXEL_SURFACES[voxSurface](t) });
// ── 渲染样式集（instancing-safe·只切后处理·GTAO/bloom/暗角/分级）——保持实例化不破·大立方也能切 ──
type Style = { name: string; post: Record<string, unknown> };
const STYLES: Style[] = [           // 厚AO 置首=默认（owner）·去掉柔光（发糊看不清）
  { name: '厚AO', post: { ao: { intensity: 1.8, radius: 7 }, vignette: { intensity: 0.38 }, aa: true } },
  { name: '标准', post: { ao: { intensity: 1.2, radius: 6 }, bloom: { strength: 0.22, threshold: 0.75 }, aa: true } },
  { name: '鲜艳', post: { ao: { intensity: 0.9, radius: 6 }, bloom: { strength: 0.45, threshold: 0.65 }, grade: { saturation: 1.22, contrast: 1.08 }, aa: true } },
];
function el(tag: string, css: string, html?: string): HTMLElement { const e = document.createElement(tag); e.style.cssText = css; if (html !== undefined) e.innerHTML = html; return e; }

// 对外入口：包一层支持「再来一局」——重开 = 拆掉当前实例 + 重新 boot（状态全新生成·确定性撒点一致）。
export function mountVoxelProto(container: HTMLElement, host?: { exit: () => void }): () => void {
  let dispose = (): void => {};
  const boot = (): void => { const d = runOne(container, host, () => { d(); boot(); }); dispose = d; };
  boot();
  return () => dispose();
}

function runOne(container: HTMLElement, _host: { exit: () => void } | undefined, restart: () => void): () => void {
  const cxc = (N - 1) / 2;
  const isSculpt = (i: number, j: number, k: number): boolean => Math.abs(i - cxc) + Math.abs(j - cxc) + Math.abs(k - cxc) <= N * 0.36; // 居中八面体雕像
  const colorAt = new Map<string, number>();          // 0..4=外料色 · 5=雕像(gold·受保护·炮打不到)
  const present = new Set<string>();
  const cellType = new Map<string, CellKind>();        // 特殊格（外料子集·携带 payload·打碎触发·发光边）
  const coverByColor: number[] = PALETTE.map(() => 0); // 每色外料数（=弹药基准）
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const id = vid(i, j, k); present.add(id);
    if (isSculpt(i, j, k)) { colorAt.set(id, 5); }
    else {
      const c = Math.floor(hash3(i, j, k) * PALETTE.length) % PALETTE.length; colorAt.set(id, c); coverByColor[c]++;
      if (hash3(i + 7, j + 13, k + 29) < CELL_FRAC) cellType.set(id, pickCellKind(hash3(i + 31, j + 17, k + 5))); // 确定性撒点+定型
    }
  }
  const coverTotal = coverByColor.reduce((a, b) => a + b, 0);
  let coverRemaining = coverTotal;
  let ammoPool = Math.ceil(coverTotal * AMMO_POOL_FRAC); // ★ 全局共享弹药池（任何色都从这里扣·打空即输）
  const tintOf = (id: string): number => { const c = colorAt.get(id); return c === 5 ? GOLD_TINT : PALETTE[c ?? 0].tint; };
  const inB = (v: number): boolean => v >= 0 && v < N;
  const exposed = (i: number, j: number, k: number): boolean => {
    if (!present.has(vid(i, j, k))) return false;
    return [[i+1,j,k],[i-1,j,k],[i,j+1,k],[i,j-1,k],[i,j,k+1],[i,j,k-1]].some(([a, b, c]) => !inB(a) || !inB(b) || !inB(c) || !present.has(vid(a, b, c)));
  };
  const slots = Array.from({ length: SLOT_N }, (_, i) => i % PALETTE.length); // 3 炮当前色
  let selSlot = 0;         // 选中的炮（点色装入它·金色强调）
  let styleIdx = 0;
  let orientIdx = 0, faceLeft = FACE_MS;
  let globalLeft = TOTAL_MS; // 全局倒计时（加时格喂它·归零=输）
  let curRx = ORIENT[0][0], curRy = ORIENT[0][1];
  let rapidLeft = 0;       // 火力格：>0 时三炮齐射频率翻倍（每帧递减）

  const rendered = new Set<string>();
  const buildScene = (): WorldBlueprint => {
    const entities: Record<string, EntityBlueprint> = {}; const ids: string[] = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
      if (!exposed(i, j, k)) continue;
      const id = vid(i, j, k); const t = PALETTE[colorAt.get(id)!].tint;
      entities[id] = { Transform3D: { x: idx2pos(i), y: idx2pos(j), z: idx2pos(k) }, Mesh3D: voxMesh(t, cellType.get(id)) as EntityBlueprint['Mesh3D'] }; // 无 Material3D → 归批实例化
      ids.push(id); rendered.add(id);
    }
    entities['post'] = { Post3D: { ...STYLES[0].post } as unknown as EntityBlueprint['Post3D'] };
    // 底部盘子（接碎片·世界固定·不入 pivot）+ 四矮边围一圈。
    entities['plate'] = { Transform3D: { x: 0, y: PLATE_Y, z: 0 }, Mesh3D: { shape: 'box', width: PLATE_HALF * 2, height: PLATE_TH, depth: PLATE_HALF * 2, frontTint: 0x7a5636, backTint: 0x7a5636, edgeTint: 0x503420 } };
    const rimH = 22, rimT = 10, R = PLATE_HALF;
    entities['rim-n'] = { Transform3D: { x: 0, y: PLATE_Y + rimH / 2, z: -R }, Mesh3D: { shape: 'box', width: R * 2 + rimT, height: rimH, depth: rimT, frontTint: 0x8a6440, backTint: 0x8a6440, edgeTint: 0x5c3c22 } };
    entities['rim-s'] = { Transform3D: { x: 0, y: PLATE_Y + rimH / 2, z: R }, Mesh3D: { shape: 'box', width: R * 2 + rimT, height: rimH, depth: rimT, frontTint: 0x8a6440, backTint: 0x8a6440, edgeTint: 0x5c3c22 } };
    entities['rim-e'] = { Transform3D: { x: R, y: PLATE_Y + rimH / 2, z: 0 }, Mesh3D: { shape: 'box', width: rimT, height: rimH, depth: R * 2 + rimT, frontTint: 0x8a6440, backTint: 0x8a6440, edgeTint: 0x5c3c22 } };
    entities['rim-w'] = { Transform3D: { x: -R, y: PLATE_Y + rimH / 2, z: 0 }, Mesh3D: { shape: 'box', width: rimT, height: rimH, depth: R * 2 + rimT, frontTint: 0x8a6440, backTint: 0x8a6440, edgeTint: 0x5c3c22 } };
    entities['cube-pivot'] = { Transform3D: { x: 0, y: 0, z: 0, rotX: curRx, rotY: curRy }, Pivot3D: { children: ids, centerX: 0, centerY: 0, centerZ: 0 } };
    // 相机略斜(yaw+pitch)→看得到立体棱面·不再正对死板(owner「稍微斜一点」)。
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

  // ── 顶部：破坏度 + 每面倒计时 ──
  const top = el('div', 'position:absolute;left:0;right:0;top:14px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;pointer-events:none;');
  const dmg = el('div', 'padding:8px 18px;border-radius:20px;background:#0c1a30;border:2px solid #26385c;color:#ffd77a;font:800 18px system-ui;', '破坏 0%');
  const ammoPill = el('div', 'padding:8px 18px;border-radius:20px;background:#0c1a30;border:2px solid #4a5c3a;color:#c7f27a;font:800 18px system-ui;', '🔫 0'); // 全局共享弹药池
  const facePill = el('div', 'padding:8px 20px;border-radius:20px;background:linear-gradient(#3a7bd5,#2a5cae);color:#fff;font:800 18px system-ui;box-shadow:0 3px 0 #1c3e7a;', `⏱ ${Math.ceil(TOTAL_MS / 1000)}`); // 全局限时
  top.appendChild(dmg); top.appendChild(ammoPill); top.appendChild(facePill); wrapper.appendChild(top);
  const timeBar = el('div', 'position:absolute;left:0;top:0;height:5px;background:#7fe3ff;width:100%;');
  wrapper.appendChild(timeBar);
  const banner = el('div', 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:900 44px system-ui;color:#8affa0;text-shadow:0 3px 14px #000;pointer-events:none;');
  wrapper.appendChild(banner);
  // 本面补给清单（Q2 可读性）：告诉你当前面有哪些特殊格·什么色 → 你据此装色去收（不必看清单颗像素）。
  const legend = el('div', 'position:absolute;left:0;right:0;top:56px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:0 12px;pointer-events:none;');
  wrapper.appendChild(legend);
  // 再来一局（仅结算时出现·点=拆当前实例重开）——playtest 必备·不用刷新页面。
  const againBtn = el('button', 'position:absolute;left:50%;top:56%;transform:translateX(-50%);display:none;z-index:40;pointer-events:auto;background:linear-gradient(#ffcf4a,#f2a81e);color:#3a2500;border:none;border-radius:14px;padding:12px 30px;cursor:pointer;font:900 20px system-ui;box-shadow:0 5px 0 #b97e12,0 8px 18px #0008;', '↻ 再来一局');
  againBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); restart(); });
  wrapper.appendChild(againBtn);
  // 冲击特效：屏震（wrapper 抖）+ 一闪暖光罩（引爆用·爽感）。
  const flash = el('div', 'position:absolute;inset:0;pointer-events:none;z-index:25;background:radial-gradient(circle,#ffdca066,#ff6a2a00 70%);opacity:0;');
  wrapper.appendChild(flash);
  const impactFx = (strength: number): void => {
    const s = Math.min(1, strength);
    wrapper.animate?.([{ transform: 'translate(0,0)' }, { transform: `translate(${6 * s}px,${-5 * s}px)` }, { transform: `translate(${-5 * s}px,${4 * s}px)` }, { transform: 'translate(0,0)' }], { duration: 220 });
    flash.animate?.([{ opacity: 0.55 * s }, { opacity: 0 }], { duration: 300 });
  };

  // 渲染样式切换（点循环 5 种·对比看）。
  const styleBtn = el('button', 'position:absolute;right:8px;top:60px;z-index:20;pointer-events:auto;background:#1a2740ee;color:#cfe;border:1px solid #35507a;border-radius:8px;padding:6px 12px;cursor:pointer;font:700 14px system-ui;box-shadow:0 2px 8px #0007;', `🎨 ${STYLES[0].name}`);
  styleBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  const applyStyle = (idx: number): void => {
    styleIdx = ((idx % STYLES.length) + STYLES.length) % STYLES.length;
    const st = STYLES[styleIdx];
    engine.world.removeComponent('post', 'Post3D');
    engine.world.addComponent('post', { type: 'Post3D', ...st.post } as never); // 只切后处理·实例化不破
    styleBtn.textContent = `🎨 ${st.name}`;
  };
  styleBtn.onclick = () => applyStyle(styleIdx + 1);
  wrapper.appendChild(styleBtn);

  // 体素表面材质预设切换（提速块 / 宝石 / 素面·循环）——只换 voxelTex 参数配方·同款仍归批·实例化不破。
  const surfBtn = el('button', 'position:absolute;right:8px;top:100px;z-index:20;pointer-events:auto;background:#1a2740ee;color:#cfe;border:1px solid #35507a;border-radius:8px;padding:6px 12px;cursor:pointer;font:700 14px system-ui;box-shadow:0 2px 8px #0007;', `🧊 ${voxSurface}`);
  surfBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  const SURF_LABEL: Record<VoxelSurface, string> = { speed: '提速块', gem: '宝石', matte: '素面' };
  surfBtn.onclick = () => {
    const cur = VOXEL_SURFACE_NAMES.indexOf(voxSurface);
    voxSurface = VOXEL_SURFACE_NAMES[(cur + 1) % VOXEL_SURFACE_NAMES.length];
    surfBtn.textContent = `🧊 ${SURF_LABEL[voxSurface]}`;
    for (const id of rendered) {                        // 就地换所有已渲染体素的表面配方（不重置对局）
      engine.world.removeComponent(id, 'Mesh3D');
      engine.world.addComponent(id, { type: 'Mesh3D', ...voxMesh(tintOf(id), cellType.get(id)) } as never);
    }
  };
  surfBtn.textContent = `🧊 ${SURF_LABEL[voxSurface]}`;
  wrapper.appendChild(surfBtn);

  // ── 底部：3 发射炮台(上·炮台图标染当前色·点=发射+选中) + 5 色备选(下·点装入选中炮·三炮互斥) ──
  const bottom = el('div', 'position:absolute;left:0;right:0;bottom:16px;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;');
  const slotRow = el('div', 'display:flex;gap:20px;pointer-events:auto;');
  const slotEls: HTMLElement[] = []; const slotIcon: HTMLElement[] = []; const slotNum: HTMLElement[] = [];
  for (let i = 0; i < SLOT_N; i++) {
    const s = el('div', 'position:relative;width:78px;height:78px;border-radius:16px;background:#0c1a30;cursor:pointer;user-select:none;transition:transform .06s,box-shadow .1s;');
    const icon = el('div', 'position:absolute;inset:7px;background-position:center;background-repeat:no-repeat;background-size:contain;filter:drop-shadow(0 2px 3px #0009);');
    const num = el('div', 'position:absolute;right:5px;bottom:2px;color:#fff;font:800 17px system-ui;text-shadow:0 1px 3px #000,0 0 4px #000;');
    s.appendChild(icon); s.appendChild(num);
    const idx = i;
    s.addEventListener('pointerdown', (e) => { e.stopPropagation(); selSlot = idx; refresh(); }); // 点炮=选中（炮自动发射·无需按）
    slotEls.push(s); slotIcon.push(icon); slotNum.push(num); slotRow.appendChild(s);
  }
  bottom.appendChild(slotRow);
  bottom.appendChild(el('div', 'color:#8fb0e0;font:700 11px system-ui;letter-spacing:1px;margin-top:2px;', '备选色 · 点装入选中炮（三炮互斥）'));
  const invRow = el('div', 'display:flex;gap:8px;pointer-events:auto;');
  const chips: HTMLElement[] = [];
  PALETTE.forEach((p, c) => {
    const chip = el('div', `width:44px;height:44px;border-radius:10px;background:${p.css};box-shadow:0 2px 5px #0007;cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:center;color:#fff;font:800 14px system-ui;text-shadow:0 1px 2px #000b;`);
    chip.addEventListener('pointerdown', (e) => { e.stopPropagation(); loadColor(c); });
    chips.push(chip); invRow.appendChild(chip);
  });
  bottom.appendChild(invRow);
  wrapper.appendChild(bottom);

  const loadColor = (c: number): void => {
    const other = slots.indexOf(c);
    if (other >= 0 && other !== selSlot) slots[other] = slots[selSlot]; // 已在别炮→交换（三炮互斥）
    slots[selSlot] = c;
    const flashed = selSlot;
    selSlot = (selSlot + 1) % SLOT_N;  // ★ 自动移到下一炮 → 连点几色即可填/换·每色永远可点
    refresh(); syncBeacons(); // 换色 → 重算"现在能打"的高亮光标
    slotEls[flashed].animate?.([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 220 });
  };
  const refresh = (): void => {
    const dry = ammoPool <= 0;
    chips.forEach((ch) => { ch.style.opacity = dry ? '0.28' : '1'; }); // 全局共享池：弹尽=全色变暗（不再每色独立数）
    slotEls.forEach((s, i) => {
      const col = PALETTE[slots[i]].css;
      slotIcon[i].style.backgroundImage = `url("${PALETTE[slots[i]].sprite}")`; slotNum[i].textContent = ''; // 弹药走顶部共享池·槽内不再单列数

      if (i === selSlot) { s.style.boxShadow = `0 0 0 4px #ffd24a,0 0 22px 6px ${col}cc`; s.style.transform = 'scale(1.1)'; s.style.background = '#16233d'; }
      else { s.style.boxShadow = '0 4px 10px #0008'; s.style.transform = 'scale(1)'; s.style.background = '#0c1a30'; }
    });
    ammoPill.textContent = `🔫 ${ammoPool}`;
    ammoPill.style.color = ammoPool <= coverTotal * 0.15 ? '#ff9a6a' : '#c7f27a'; // 见底告警
    dmg.textContent = `露出 ${Math.round(((coverTotal - coverRemaining) / coverTotal) * 100)}% / ${Math.round(REVEAL_PASS * 100)}%`;
  };
  // 特殊格触发反馈：中上冒一行发光字（正反馈可见=玩家学会去抢特殊格）。
  const cellFx = (text: string, css: string): void => {
    const tick = el('div', `position:absolute;left:50%;top:52px;transform:translateX(-50%);color:${css};font:900 22px system-ui;text-shadow:0 2px 8px #000,0 0 12px ${css};pointer-events:none;z-index:30;white-space:nowrap;`, text);
    wrapper.appendChild(tick);
    tick.animate?.([{ transform: 'translate(-50%,0)', opacity: 1 }, { transform: 'translate(-50%,-30px)', opacity: 0 }], { duration: 680 });
    setTimeout(() => tick.remove(), 700);
  };
  refresh();

  // 本面补给清单：扫前面每列最外露格·统计 (类型,颜色) → 芯片"[色点]glyph×n"。只在换面/有破坏时重算（省）。
  let legendSide = -1, legendDirty = true;
  const updateFaceLegend = (s: number): void => {
    const tally = new Map<string, { kind: CellKind; color: number; n: number }>();
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      const v = faceVisible(s, a, b); if (!v) continue; const id = vid(v[0], v[1], v[2]);
      const kind = cellType.get(id); if (!kind) continue; const color = colorAt.get(id) ?? 0;
      const key = `${kind}-${color}`; const e = tally.get(key); if (e) e.n++; else tally.set(key, { kind, color, n: 1 });
    }
    legend.innerHTML = '';
    if (tally.size === 0) return; // 无特殊格 → 不占屏
    const rows = [...tally.values()].sort((x, y) => y.n - x.n).slice(0, 6);
    for (const r of rows) {
      const chip = el('div', `display:flex;align-items:center;gap:4px;padding:3px 9px;border-radius:14px;background:#0c1a30cc;border:2px solid ${PALETTE[r.color].css};font:800 14px system-ui;color:#fff;text-shadow:0 1px 2px #000;`);
      chip.appendChild(el('span', `width:11px;height:11px;border-radius:3px;background:${PALETTE[r.color].css};display:inline-block;`));
      chip.appendChild(el('span', '', `${CELLS[r.kind].glyph}×${r.n}`));
      legend.appendChild(chip);
    }
  };

  // ── 特殊格 3D 光标（beacon）：贴在每个暴露特殊格的外露面上·浮出一个亮块 → 一眼看清哪些是功能格。
  //   随立方转（pivot 子）。当前装载色的格子光标更大更亮 = "现在能打的目标"（配 aimFace 优先=你用装色操控打谁）。
  const DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const outNormal = (i: number, j: number, k: number): [number, number, number] => {
    for (const [dx, dy, dz] of DIRS) { const a = i + dx, b = j + dy, c = k + dz; if (!inB(a) || !inB(b) || !inB(c) || !present.has(vid(a, b, c))) return [dx, dy, dz]; }
    return [0, 0, 1];
  };
  const beacons = new Set<string>();
  const beaconId = (i: number, j: number, k: number): string => `bc-${i}-${j}-${k}`;
  const syncBeacons = (): void => {
    const piv = engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D');
    const want = new Set<string>();
    for (const [id, kind] of cellType) {
      if (!present.has(id)) continue;
      const [, si, sj, sk] = id.split('-'); const i = +si, j = +sj, k = +sk;
      if (!exposed(i, j, k)) continue;
      want.add(id);
      const bid = beaconId(i, j, k);
      const [nx, ny, nz] = outNormal(i, j, k);
      const loaded = slots.includes(colorAt.get(id) ?? -1);
      const sz = loaded ? VOX * 0.5 : VOX * 0.34;      // 装载色 = 更大 = "现在能打"
      const tint = CELLS[kind].edge;
      const bx = idx2pos(i) + nx * PITCH * 0.62, by = idx2pos(j) + ny * PITCH * 0.62, bz = idx2pos(k) + nz * PITCH * 0.62;
      if (!beacons.has(id)) {
        try { engine.world.createEntity(bid); } catch { /* */ }
        engine.world.addComponent(bid, { type: 'Transform3D', x: bx, y: by, z: bz } as unknown as Transform3D);
        piv?.children.push(bid); beacons.add(id);
      }
      engine.world.removeComponent(bid, 'Mesh3D');
      engine.world.addComponent(bid, { type: 'Mesh3D', shape: 'box', width: sz, height: sz, depth: sz, frontTint: tint, backTint: tint, edgeTint: 0xffffff } as never);
      const tr = engine.world.getComponent<Transform3D>(bid, 'Transform3D'); if (tr) { tr.x = bx; tr.y = by; tr.z = bz; }
    }
    for (const id of [...beacons]) if (!want.has(id)) {
      const [, si, sj, sk] = id.split('-'); const bid = beaconId(+si, +sj, +sk);
      try { engine.world.destroyEntity(bid); } catch { /* */ }
      const piv2 = engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D'); if (piv2) { const x = piv2.children.indexOf(bid); if (x >= 0) piv2.children.splice(x, 1); }
      beacons.delete(id);
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
    // 碎片总量封顶（防积多卡）：超 140 先回收最老的。
    let fc = 0; for (const m of movers) if (m.kind === 'frag') fc++;
    while (fc > 140) { const k = movers.findIndex((m) => m.kind === 'frag'); if (k < 0) break; despawnEnt(movers[k].id); movers.splice(k, 1); fc--; }
    const L = Math.hypot(wx, wy, wz) || 1, ox = wx / L, oy = wy / L, oz = wz / L;
    for (let n = 0; n < FRAG_N; n++) {
      const id = `frag-${movN}`; spawnEnt(id, wx, wy, wz, VOX * 0.6, tint);
      engine.world.addComponent(id, { type: 'Anim3D', channels: [{ kind: 'spring', field: 'scale', from: 0.35, to: 1, freq: 8, damping: 0.35 }] } as never); // 弹Q 弹出
      movers.push({ kind: 'frag', id, p: [wx, wy, wz], v: [ox * 260 + (prand() - 0.5) * 220, oy * 260 + 160 + prand() * 150, oz * 260 + (prand() - 0.5) * 220], life: 2.6 });
    }
  };

  const frontSide = (): number => { let best = 0, bd = -Infinity; for (let s = 0; s < 6; s++) { const nz = rotVec(SIDES[s].n[0], SIDES[s].n[1], SIDES[s].n[2], curRx, curRy)[2]; if (nz > bd) { bd = nz; best = s; } } return best; };
  const faceVisible = (s: number, a: number, b: number): [number, number, number] | null => {
    const S = SIDES[s];
    for (let d = 0; d < N; d++) { const co = [0, 0, 0]; co[S.axis] = S.val === N - 1 ? N - 1 - d : d; co[S.ua] = a; co[S.ub] = b; if (present.has(vid(co[0], co[1], co[2]))) return [co[0], co[1], co[2]]; }
    return null;
  };
  // 前面上「暴露 + 同色」中的目标（零瞄准）：★优先同色特殊格（你用"装哪色"操控打谁）·否则最靠面心者。
  const aimFace = (s: number, color: number): [number, number, number] | null => {
    const c0 = (N - 1) / 2;
    let best: [number, number, number] | null = null, bestR = Infinity;
    let bestSp: [number, number, number] | null = null, bestSpR = Infinity;
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      const v = faceVisible(s, a, b); if (!v) continue; const id = vid(v[0], v[1], v[2]);
      if (colorAt.get(id) !== color) continue;
      const r = (a - c0) ** 2 + (b - c0) ** 2;
      if (r < bestR) { bestR = r; best = v; }
      if (cellType.has(id) && r < bestSpR) { bestSpR = r; bestSp = v; } // 同色特殊格优先
    }
    return bestSp ?? best;
  };
  const reveal = (i: number, j: number, k: number): void => {
    const id = vid(i, j, k); if (rendered.has(id) || !present.has(id) || !exposed(i, j, k)) return;
    try { engine.world.createEntity(id); } catch { /* */ }
    engine.world.addComponent(id, { type: 'Transform3D', x: idx2pos(i), y: idx2pos(j), z: idx2pos(k) } as unknown as Transform3D);
    engine.world.addComponent(id, { type: 'Mesh3D', ...voxMesh(tintOf(id), cellType.get(id)) } as never); // 无 Material3D → 归批实例化（雕像露出=gold·特殊格发光边）
    engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D')?.children.push(id); rendered.add(id);
    legendDirty = true;
  };
  // 破坏一格：记账 + 触发特殊格效果 + 露内层；引爆格连锁炸 3×3×3。chain=true 表示是被连锁波及（自己冒碎片）。
  const breakVox = (i: number, j: number, k: number, chain = false): void => {
    const id = vid(i, j, k); const cc = colorAt.get(id);
    if (cc === 5 || !present.has(id)) return;       // 雕像受保护·不碎；已碎不重复
    const kind = cellType.get(id);
    if (cc != null) coverByColor[cc]--;
    coverRemaining--;
    cellType.delete(id);
    present.delete(id);
    legendDirty = true;
    if (rendered.has(id)) { engine.world.destroyEntity(id); const piv = engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D'); if (piv) { const x = piv.children.indexOf(id); if (x >= 0) piv.children.splice(x, 1); } rendered.delete(id); }
    // 连锁波及格：自己也冒一簇碎片（主命中格的碎片由子弹落点侧生成）。
    if (chain) { const wp = voxWorld(i, j, k); spawnFrags(wp[0], wp[1], wp[2], tintOf(id) === GOLD_TINT ? GOLD_TINT : PALETTE[cc ?? 0].tint); }
    // ★ 特殊格效果分发（下沉正式版 = cellEffects 表的行）。
    if (kind === 'ammo')  { ammoPool += AMMO_REFUND; ammoPill.animate?.([{ transform: 'scale(1.28)' }, { transform: 'scale(1)' }], { duration: 260 }); cellFx(`🔫 +${AMMO_REFUND}`, CELLS.ammo.css); }
    else if (kind === 'power') { rapidLeft = POWER_MS; cellFx('🔥 齐射翻倍!', CELLS.power.css); }
    else if (kind === 'time')  { globalLeft += TIME_BONUS; facePill.animate?.([{ transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 260 }); cellFx(`⏱ +${(TIME_BONUS / 1000).toFixed(0)}s`, CELLS.time.css); }
    else if (kind === 'bomb')  { cellFx('💥 连爆!', CELLS.bomb.css); impactFx(0.9); for (let di = -BOMB_R; di <= BOMB_R; di++) for (let dj = -BOMB_R; dj <= BOMB_R; dj++) for (let dk = -BOMB_R; dk <= BOMB_R; dk++) { const a = i + di, b = j + dj, c = k + dk; if ((di || dj || dk) && inB(a) && inB(b) && inB(c) && colorAt.get(vid(a, b, c)) !== 5) breakVox(a, b, c, true); } } // 3×3×3 连锁（引爆格递归引爆·雕像免疫）
    ([[i+1,j,k],[i-1,j,k],[i,j+1,k],[i,j-1,k],[i,j,k+1],[i,j,k-1]] as [number,number,number][]).forEach(([a, b, c]) => { if (inB(a) && inB(b) && inB(c)) reveal(a, b, c); });
  };

  let over: 'win' | 'lose' | null = null;
  const endGame = (kind: 'win' | 'lose', text: string, color: string): void => { over = kind; banner.textContent = text; banner.style.color = color; againBtn.style.display = 'block'; };
  const checkEnd = (): void => {
    if (over) return;
    if (coverRemaining === 0 || (coverTotal - coverRemaining) / coverTotal >= REVEAL_PASS) { endGame('win', '🎉 雕像现形！', '#8affa0'); return; }
    if (globalLeft <= 0) { endGame('lose', '⏱ 时间到 · 雕像未露', '#ff8a8a'); return; } // 全局限时归零→输
    // 弹尽才判输——但仍有子弹在飞（可能打进阈值）时先不判·等落地结算（公平）。
    if (ammoPool <= 0 && !movers.some((m) => m.kind === 'bullet')) { endGame('lose', '弹尽 · 雕像未露', '#ff8a8a'); return; }
  };
  // 单发（自动炮调用）：从全局池扣一发弹；正对这面有同色暴露格→射子弹清一格·否则空放浪费（仍扣池）。
  const fire = (color: number): void => {
    if (over || ammoPool <= 0) return;
    ammoPool--;
    const aim = aimFace(frontSide(), color);
    if (aim) {
      const to = voxWorld(aim[0], aim[1], aim[2]);
      const L = Math.hypot(to[0], to[1], to[2]) || 1, D = MAXC * 1.9;
      const from: [number, number, number] = [to[0] + (to[0] / L) * D, to[1] + (to[1] / L) * D, to[2] + (to[2] / L) * D];
      const id = `blt-${movN}`; spawnEnt(id, from[0], from[1], from[2], VOX * 0.55, PALETTE[color].tint);
      movers.push({ kind: 'bullet', id, t: 0, from, to, aim: [aim[0], aim[1], aim[2]] });
    }
    checkEnd(); refresh();
  };
  let afAcc = 0, fireCursor = 0; // 自动发射节拍累加 + 轮流开火游标

  // ── 主循环（自管·全 try/catch·绝不冻结）──
  let raf = 0, last = performance.now();
  const frame = (now: number): void => {
    try {
      const dt = now - last; last = now;
      // 自动转面：倒计时→到点切下一面·平滑缓动到目标角。
      if (!over) {
        // 全局限时：归零判负（在飞子弹落地会再 checkEnd·此处只递减+显示）。
        globalLeft = Math.max(0, globalLeft - dt);
        // 每面固定停留·永不延长 → 到点必转下一面（有节奏地轮面·加时格不再锁死单面）。
        faceLeft -= dt;
        if (faceLeft <= 0) { orientIdx = (orientIdx + 1) % ORIENT.length; faceLeft = FACE_MS; }
        const [trx, try_] = ORIENT[orientIdx];
        curRx += shortDelta(curRx, trx) * Math.min(1, dt * TWEEN);
        curRy += shortDelta(curRy, try_) * Math.min(1, dt * TWEEN);
        const piv = engine.world.getComponent<Transform3D>('cube-pivot', 'Transform3D'); if (piv) { piv.rotX = curRx; piv.rotY = curRy; }
        facePill.textContent = `⏱ ${(globalLeft / 1000).toFixed(globalLeft < 10000 ? 1 : 0)}`;
        timeBar.style.width = `${Math.min(100, (faceLeft / FACE_MS) * 100)}%`; // 细条 = 本面转面进度
        // 火力格：齐射频率翻倍（rapidLeft>0 期间节拍减半）+ 可见指示（facePill 转火橙）。
        const wasRapid = rapidLeft > 0;
        if (rapidLeft > 0) rapidLeft = Math.max(0, rapidLeft - dt);
        const isRapid = rapidLeft > 0;
        if (isRapid !== wasRapid) {
          facePill.style.background = isRapid ? 'linear-gradient(#ff9a3a,#f2671e)' : 'linear-gradient(#3a7bd5,#2a5cae)';
          facePill.style.boxShadow = isRapid ? '0 3px 0 #b8430f,0 0 16px #ff8a3a' : '0 3px 0 #1c3e7a';
        }
        const cad = isRapid ? FIRE_MS * 0.5 : FIRE_MS;
        // ★ 自动发射：轮流一门炮射一发（不再三炮齐射=不乱·慢节拍）·扣弹→无同色暴露则浪费。
        afAcc += dt; while (afAcc >= cad) { afAcc -= cad; fire(slots[fireCursor % SLOT_N]); fireCursor++; }
        if (globalLeft <= 0) checkEnd();
        // 本面补给清单 + 特殊格光标（换面或有破坏时重算）。
        const fs = frontSide(); if (fs !== legendSide || legendDirty) { legendSide = fs; legendDirty = false; updateFaceLegend(fs); syncBeacons(); }
      }
      // 运动体积分。
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
          const fh = VOX * 0.3, topY = PLATE_Y + PLATE_TH / 2 + fh, R = PLATE_HALF - fh;
          if (mv.p[1] < topY) { mv.p[1] = topY; if (mv.v[1] < 0) mv.v[1] = -mv.v[1] * 0.34; mv.v[0] *= 0.7; mv.v[2] *= 0.7; } // 落盘弹跳+摩擦
          mv.p[0] = Math.max(-R, Math.min(R, mv.p[0])); mv.p[2] = Math.max(-R, Math.min(R, mv.p[2])); // 围在盘内
          mv.life -= ds; setPos(mv.id, mv.p[0], mv.p[1], mv.p[2]);
          if (mv.life <= 0 || mv.p[1] < -MAXC * 8) { despawnEnt(mv.id); movers.splice(m, 1); }
        }
      }
    } catch { /* 记录省略·绝不冻结 */ }
    try { renderer.sync(engine.world); } catch { /* */ }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    movers.forEach((mv) => despawnEnt(mv.id));
    engine.stop();
    renderer.destroy();
    outer.remove();
  };
}
