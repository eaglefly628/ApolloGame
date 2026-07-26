// Game 102 · 3D 体素立方 —— **雕刻爽快版原型（throwaway·render-only·丢弃版）**。
//
// owner 2026-07-26 定案 v1：立方**自动转**·每 5 秒转到下一面·6 面循环。当前面朝你 5 秒内你**狂按颜色发射键**
// → 轰碎那面的**同色暴露格**（零瞄准·从中心往外啃=扫射感）·海量碎片=爽。立方小而体素多(N=12)。
// Pixel Flow 的 DNA：不瞄准 + 同色 + 暴露逐层；张力换成**每面限时 + 破坏度**（非稀缺死锁）。道具(别色弹/炸弹)下一版接。
//
// ⚠ 一次性手感原型（宿主胶水·render-only·非数据驱动正式版）。物理/运动全**自管每帧积分**(非 cannon-es)→ 零冻结。
import { Engine } from '../../runtime/engine.js';
import { QueuedInputSource } from '@net/index.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { Transform3D, Pivot3D } from '@engine/protocol/components.js';

const N = 12;             // 立方边长（体素多→更细更爽·只渲外壳~728格）
const PITCH = 22;
const VOX = 22;           // =PITCH：相接无缝·剥层露内层彩格
const MAXC = ((N - 1) / 2) * PITCH;
const FACE_MS = 5000;     // 每面停留（ms）→ 转下一面
const TWEEN = 0.010;      // 转面缓动系数（×dt）
const FIRE_MS = 110;      // 长按连发间隔（扫射手感）
const TRAVEL_MS = 260;    // 子弹飞抵（爽快版·快）
const FRAG_N = 6;
const GRAV = 900;
const PALETTE = [        // 总 5 色·但同时只有 3 个发射槽（稀缺调度）
  { name: '红', tint: 0xe0433f, css: '#e0433f' },
  { name: '黄', tint: 0xf2c21e, css: '#f2c21e' },
  { name: '绿', tint: 0x5cb544, css: '#5cb544' },
  { name: '蓝', tint: 0x2e6cf6, css: '#2e6cf6' },
  { name: '紫', tint: 0x8b5cf6, css: '#8b5cf6' },
];
const SLOT_N = 3;         // 发射槽数（< 颜色数 → 你得快速换槽对齐这一面的色）
// 6 面朝相机(+Z)的目标欧拉角（idx 循环）。
const ORIENT: [number, number][] = [
  [0, 0], [0, -Math.PI / 2], [0, -Math.PI], [0, -Math.PI * 1.5], [-Math.PI / 2, 0], [Math.PI / 2, 0],
];
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
const voxMesh = (t: number): Record<string, unknown> => ({ shape: 'box', width: VOX, height: VOX, depth: VOX, frontTint: t, backTint: t, edgeTint: shade(t, 0.82) });
// ── 渲染样式集（owner「做几个版本对比」）：材质(果冻/卡通/黏土/平涂/糖果) + 对应后处理(AO/bloom/描边/分级)──
type Style = { name: string; mat: (t: number) => Record<string, unknown>; post: Record<string, unknown> };
const STYLES: Style[] = [
  { name: '果冻', mat: (t) => ({ preset: 'plastic', color: t, roughness: 0.24, metalness: 0, surface: { pattern: 'bumps', normal: 1.4, rough: 0.5 } }), post: { ao: { intensity: 1.1, radius: 5 }, bloom: { strength: 0.22, threshold: 0.75 }, aa: true } },
  { name: '卡通', mat: (t) => ({ preset: 'plastic', color: t, shading: 'toon', toonSteps: 3, outline: { width: 1.4, color: 0x10141d } }), post: { ao: { intensity: 0.8, radius: 5 }, aa: true } },
  { name: '黏土', mat: (t) => ({ preset: 'matte', color: t, roughness: 0.95, surface: { pattern: 'bumps', normal: 0.8, rough: 0.6 } }), post: { ao: { intensity: 1.5, radius: 6 }, vignette: { intensity: 0.35 }, grade: { saturation: 1.08 }, aa: true } },
  { name: '平涂', mat: (t) => ({ preset: 'plastic', color: t, shading: 'flat' }), post: { ao: { intensity: 0.6, radius: 5 }, bloom: { strength: 0.4, threshold: 0.7 } } },
  { name: '糖果', mat: (t) => ({ preset: 'plastic', color: t, roughness: 0.12, metalness: 0.12 }), post: { ao: { intensity: 0.8, radius: 5 }, bloom: { strength: 0.6, threshold: 0.65 }, grade: { saturation: 1.2, contrast: 1.08 }, aa: true } },
];
function el(tag: string, css: string, html?: string): HTMLElement { const e = document.createElement(tag); e.style.cssText = css; if (html !== undefined) e.innerHTML = html; return e; }

export function mountVoxelProto(container: HTMLElement, _host?: { exit: () => void }): () => void {
  const colorAt = new Map<string, number>();
  const present = new Set<string>();
  const count: number[] = PALETTE.map(() => 0);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const color = Math.floor(hash3(i, j, k) * PALETTE.length) % PALETTE.length;
    colorAt.set(vid(i, j, k), color); present.add(vid(i, j, k)); count[color]++;
  }
  const inB = (v: number): boolean => v >= 0 && v < N;
  const exposed = (i: number, j: number, k: number): boolean => {
    if (!present.has(vid(i, j, k))) return false;
    return [[i+1,j,k],[i-1,j,k],[i,j+1,k],[i,j-1,k],[i,j,k+1],[i,j,k-1]].some(([a, b, c]) => !inB(a) || !inB(b) || !inB(c) || !present.has(vid(a, b, c)));
  };
  const colorRemain = count.slice();
  const slots = Array.from({ length: SLOT_N }, (_, i) => i % PALETTE.length); // 3 槽当前色
  let selSlot = 0;         // 选中的槽（点色装入它·金色强调）
  let styleIdx = 0;
  let remaining = present.size; const total = present.size;
  let orientIdx = 0, faceLeft = FACE_MS;
  let curRx = ORIENT[0][0], curRy = ORIENT[0][1];

  const rendered = new Set<string>();
  const buildScene = (): WorldBlueprint => {
    const entities: Record<string, EntityBlueprint> = {}; const ids: string[] = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
      if (!exposed(i, j, k)) continue;
      const id = vid(i, j, k); const t = PALETTE[colorAt.get(id)!].tint;
      entities[id] = { Transform3D: { x: idx2pos(i), y: idx2pos(j), z: idx2pos(k) }, Mesh3D: voxMesh(t) as EntityBlueprint['Mesh3D'], Material3D: { ...STYLES[0].mat(t) } as unknown as EntityBlueprint['Material3D'] };
      ids.push(id); rendered.add(id);
    }
    entities['post'] = { Post3D: { ...STYLES[0].post } as unknown as EntityBlueprint['Post3D'] };
    entities['cube-pivot'] = { Transform3D: { x: 0, y: 0, z: 0, rotX: curRx, rotY: curRy }, Pivot3D: { children: ids, centerX: 0, centerY: 0, centerZ: 0 } };
    // 相机略斜(yaw+pitch)→看得到立体棱面·不再正对死板(owner「稍微斜一点」)。
    entities['cam'] = { Transform3D: { x: 0, y: 0, z: 0 }, Camera3D: { yaw: 0.42, pitch: 0.42, distance: N * PITCH * 4.0, pivotX: 0, pivotY: 0, pivotZ: 0, projection: 'perspective', fov: 40 } };
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
  const facePill = el('div', 'padding:8px 20px;border-radius:20px;background:linear-gradient(#3a7bd5,#2a5cae);color:#fff;font:800 18px system-ui;box-shadow:0 3px 0 #1c3e7a;', '⏱ 5.0');
  top.appendChild(dmg); top.appendChild(facePill); wrapper.appendChild(top);
  const timeBar = el('div', 'position:absolute;left:0;top:0;height:5px;background:#7fe3ff;width:100%;');
  wrapper.appendChild(timeBar);
  const banner = el('div', 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:900 44px system-ui;color:#8affa0;text-shadow:0 3px 14px #000;pointer-events:none;');
  wrapper.appendChild(banner);

  // 渲染样式切换（点循环 5 种·对比看）。
  const styleBtn = el('button', 'position:absolute;right:8px;top:60px;z-index:20;pointer-events:auto;background:#1a2740ee;color:#cfe;border:1px solid #35507a;border-radius:8px;padding:6px 12px;cursor:pointer;font:700 14px system-ui;box-shadow:0 2px 8px #0007;', `🎨 ${STYLES[0].name}`);
  styleBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  const applyStyle = (idx: number): void => {
    styleIdx = ((idx % STYLES.length) + STYLES.length) % STYLES.length;
    const st = STYLES[styleIdx];
    engine.world.removeComponent('post', 'Post3D');
    engine.world.addComponent('post', { type: 'Post3D', ...st.post } as never);
    for (const id of rendered) {
      const cc = colorAt.get(id); if (cc == null) continue;
      engine.world.removeComponent(id, 'Material3D');
      engine.world.addComponent(id, { type: 'Material3D', ...st.mat(PALETTE[cc].tint) } as never);
    }
    styleBtn.textContent = `🎨 ${st.name}`;
  };
  styleBtn.onclick = () => applyStyle(styleIdx + 1);
  wrapper.appendChild(styleBtn);

  // ── 底部：5 色库存(点色→装入选中槽) + 3 发射槽(点=发射+选中·选中槽金色强调) ──
  const bottom = el('div', 'position:absolute;left:0;right:0;bottom:16px;display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:none;');
  bottom.appendChild(el('div', 'color:#8fb0e0;font:700 12px system-ui;letter-spacing:1px;', '库存 · 点色装入选中槽'));
  const invRow = el('div', 'display:flex;gap:8px;pointer-events:auto;');
  const chips: HTMLElement[] = [];
  PALETTE.forEach((p, c) => {
    const chip = el('div', `width:46px;height:46px;border-radius:10px;background:${p.css};box-shadow:0 2px 5px #0007;cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:center;color:#fff;font:800 15px system-ui;text-shadow:0 1px 2px #000b;`);
    chip.addEventListener('pointerdown', (e) => { e.stopPropagation(); loadColor(c); });
    chips.push(chip); invRow.appendChild(chip);
  });
  bottom.appendChild(invRow);
  const slotRow = el('div', 'display:flex;gap:18px;pointer-events:auto;margin-top:4px;');
  const slotEls: HTMLElement[] = [];
  for (let i = 0; i < SLOT_N; i++) {
    const s = el('div', 'width:72px;height:72px;border-radius:16px;cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:center;color:#fff;font:800 24px system-ui;text-shadow:0 1px 3px #000b;transition:transform .06s,box-shadow .1s;');
    const idx = i;
    s.addEventListener('pointerdown', (e) => { e.stopPropagation(); selSlot = idx; startFire(idx); s.style.transform = 'scale(.9)'; s.setPointerCapture?.(e.pointerId); refresh(); });
    const end = (): void => { stopFire(idx); refresh(); };
    s.addEventListener('pointerup', end); s.addEventListener('pointercancel', end); s.addEventListener('pointerleave', end);
    slotEls.push(s); slotRow.appendChild(s);
  }
  bottom.appendChild(slotRow);
  wrapper.appendChild(bottom);

  const loadColor = (c: number): void => { slots[selSlot] = c; refresh(); slotEls[selSlot].animate?.([{ transform: 'scale(1.3)' }, { transform: 'scale(1.08)' }], { duration: 220 }); };
  const refresh = (): void => {
    chips.forEach((ch, c) => { ch.textContent = String(colorRemain[c]); ch.style.opacity = colorRemain[c] > 0 ? '1' : '0.28'; ch.style.border = slots.includes(c) ? '2px solid #fff8' : '2px solid #0000'; });
    slotEls.forEach((s, i) => {
      const col = PALETTE[slots[i]].css;
      s.style.background = col; s.textContent = String(colorRemain[slots[i]]);
      if (i === selSlot) { s.style.boxShadow = `0 0 0 4px #ffd24a,0 0 24px 7px ${col}cc,0 5px 0 #0006`; s.style.transform = 'scale(1.1)'; }
      else { s.style.boxShadow = '0 5px 0 #0006,0 4px 10px #0008'; s.style.transform = 'scale(1)'; }
    });
    dmg.textContent = `破坏 ${Math.round(((total - remaining) / total) * 100)}%`;
  };
  refresh();

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
  const prand = (): number => hash3(movN++, remaining, total);
  const spawnFrags = (wx: number, wy: number, wz: number, tint: number): void => {
    const L = Math.hypot(wx, wy, wz) || 1, ox = wx / L, oy = wy / L, oz = wz / L;
    for (let n = 0; n < FRAG_N; n++) {
      const id = `frag-${movN}`; spawnEnt(id, wx, wy, wz, VOX * 0.6, tint);
      engine.world.addComponent(id, { type: 'Anim3D', channels: [{ kind: 'spring', field: 'scale', from: 0.35, to: 1, freq: 8, damping: 0.35 }] } as never); // 弹Q 弹出
      movers.push({ kind: 'frag', id, p: [wx, wy, wz], v: [ox * 260 + (prand() - 0.5) * 220, oy * 260 + 160 + prand() * 150, oz * 260 + (prand() - 0.5) * 220], life: 1.5 });
    }
  };

  const frontSide = (): number => { let best = 0, bd = -Infinity; for (let s = 0; s < 6; s++) { const nz = rotVec(SIDES[s].n[0], SIDES[s].n[1], SIDES[s].n[2], curRx, curRy)[2]; if (nz > bd) { bd = nz; best = s; } } return best; };
  const faceVisible = (s: number, a: number, b: number): [number, number, number] | null => {
    const S = SIDES[s];
    for (let d = 0; d < N; d++) { const co = [0, 0, 0]; co[S.axis] = S.val === N - 1 ? N - 1 - d : d; co[S.ua] = a; co[S.ub] = b; if (present.has(vid(co[0], co[1], co[2]))) return [co[0], co[1], co[2]]; }
    return null;
  };
  // 前面上「暴露 + 同色」中最靠面心者（零瞄准·从中心往外啃）。
  const aimFace = (s: number, color: number): [number, number, number] | null => {
    const c0 = (N - 1) / 2; let best: [number, number, number] | null = null, bestR = Infinity;
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) { const v = faceVisible(s, a, b); if (!v || colorAt.get(vid(v[0], v[1], v[2])) !== color) continue; const r = (a - c0) ** 2 + (b - c0) ** 2; if (r < bestR) { bestR = r; best = v; } }
    return best;
  };
  const reveal = (i: number, j: number, k: number): void => {
    const id = vid(i, j, k); if (rendered.has(id) || !present.has(id) || !exposed(i, j, k)) return;
    try { engine.world.createEntity(id); } catch { /* */ }
    engine.world.addComponent(id, { type: 'Transform3D', x: idx2pos(i), y: idx2pos(j), z: idx2pos(k) } as unknown as Transform3D);
    const t = PALETTE[colorAt.get(id)!].tint;
    engine.world.addComponent(id, { type: 'Mesh3D', ...voxMesh(t) } as never);
    engine.world.addComponent(id, { type: 'Material3D', ...STYLES[styleIdx].mat(t) } as never);
    engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D')?.children.push(id); rendered.add(id);
  };
  const breakVox = (i: number, j: number, k: number): void => {
    const id = vid(i, j, k); const cc = colorAt.get(id); if (cc != null) colorRemain[cc]--;
    present.delete(id);
    if (rendered.has(id)) { engine.world.destroyEntity(id); const piv = engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D'); if (piv) { const x = piv.children.indexOf(id); if (x >= 0) piv.children.splice(x, 1); } rendered.delete(id); }
    remaining--;
    ([[i+1,j,k],[i-1,j,k],[i,j+1,k],[i,j-1,k],[i,j,k+1],[i,j,k-1]] as [number,number,number][]).forEach(([a, b, c]) => { if (inB(a) && inB(b) && inB(c)) reveal(a, b, c); });
  };

  let over = false;
  const fire = (color: number): void => {
    if (over) return;
    const aim = aimFace(frontSide(), color); if (!aim) return;   // 该面无此色暴露格 → 空按不发
    const to = voxWorld(aim[0], aim[1], aim[2]);
    const L = Math.hypot(to[0], to[1], to[2]) || 1, D = MAXC * 1.9;
    const from: [number, number, number] = [to[0] + (to[0] / L) * D, to[1] + (to[1] / L) * D, to[2] + (to[2] / L) * D];
    const id = `blt-${movN}`; spawnEnt(id, from[0], from[1], from[2], VOX * 0.55, PALETTE[color].tint);
    movers.push({ kind: 'bullet', id, t: 0, from, to, aim: [aim[0], aim[1], aim[2]] });
  };
  const fireTimers: (ReturnType<typeof setInterval> | null)[] = Array.from({ length: SLOT_N }, () => null);
  const startFire = (i: number): void => { fire(slots[i]); if (fireTimers[i] == null) fireTimers[i] = setInterval(() => fire(slots[i]), FIRE_MS); };
  const stopFire = (i: number): void => { if (fireTimers[i] != null) { clearInterval(fireTimers[i]!); fireTimers[i] = null; } };

  // ── 主循环（自管·全 try/catch·绝不冻结）──
  let raf = 0, last = performance.now();
  const frame = (now: number): void => {
    try {
      const dt = now - last; last = now;
      // 自动转面：倒计时→到点切下一面·平滑缓动到目标角。
      if (!over) {
        faceLeft -= dt;
        if (faceLeft <= 0) { orientIdx = (orientIdx + 1) % ORIENT.length; faceLeft = FACE_MS; }
        const [trx, try_] = ORIENT[orientIdx];
        curRx += shortDelta(curRx, trx) * Math.min(1, dt * TWEEN);
        curRy += shortDelta(curRy, try_) * Math.min(1, dt * TWEEN);
        const piv = engine.world.getComponent<Transform3D>('cube-pivot', 'Transform3D'); if (piv) { piv.rotX = curRx; piv.rotY = curRy; }
        facePill.textContent = `⏱ ${(faceLeft / 1000).toFixed(1)}`;
        timeBar.style.width = `${(faceLeft / FACE_MS) * 100}%`;
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
            if (present.has(vid(mv.aim[0], mv.aim[1], mv.aim[2]))) { const wp = voxWorld(mv.aim[0], mv.aim[1], mv.aim[2]); breakVox(mv.aim[0], mv.aim[1], mv.aim[2]); spawnFrags(wp[0], wp[1], wp[2], PALETTE[colorAt.get(vid(mv.aim[0], mv.aim[1], mv.aim[2]))!]?.tint ?? 0xffffff); }
            refresh();
            if (remaining === 0 && !over) { over = true; banner.textContent = '🎉 全清！'; }
          }
        } else {
          mv.v[1] -= GRAV * ds; mv.p[0] += mv.v[0] * ds; mv.p[1] += mv.v[1] * ds; mv.p[2] += mv.v[2] * ds; mv.life -= ds;
          setPos(mv.id, mv.p[0], mv.p[1], mv.p[2]);
          if (mv.life <= 0 || mv.p[1] < -MAXC * 4) { despawnEnt(mv.id); movers.splice(m, 1); }
        }
      }
    } catch { /* 记录省略·绝不冻结 */ }
    try { renderer.sync(engine.world); } catch { /* */ }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    fireTimers.forEach((t) => t && clearInterval(t));
    movers.forEach((mv) => despawnEnt(mv.id));
    engine.stop();
    renderer.destroy();
    outer.remove();
  };
}
