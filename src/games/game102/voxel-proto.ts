// Game 102 · 3D 体素立方 —— **核心场景手感原型（throwaway·render-only·丢弃版）**。
//
// ⚠ 验证「好不好玩」+ 复刻概念图场景的一次性原型（不是数据驱动正式游戏）：旋转 + 命中判定跑在 mount 宿主胶水里
// （game-z「拖拽转视角」输入胶水先例的同类·render-only·不进 sim/hash）。HUD 暂 DOM 叠层（正式版 = PUI）。
// 证明好玩后再把「可旋转立方 + 面对齐开火 + 吸附」sink 成引擎能力做纯数据版。
//
// ★ 几何（owner「边上多半块」修正）：立方 = **真 N×N×N 体素点阵**（一个正方体·棱恒对齐），只渲**表面壳**
// （任一轴处于 0/N-1 的体素）——每体素同一格阵上的正方块·各轴同等对待 → 无面板互穿/边缘半块。内层不渲（打掉才现）。
import { Engine } from '../../runtime/engine.js';
import { QueuedInputSource } from '@net/index.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { Transform3D, Pivot3D } from '@engine/protocol/components.js';

// ── 配置（手感旋钮）──────────────────────────────────────────────────────────────────────────
const N = 10;             // 立方边长（N×N×N 点阵·每面 N×N）——owner「10×10」
const PITCH = 22;         // 格步距
const VOX = 20;           // 方块边长（< PITCH → 露缝＝凹槽网格线）
const MAXC = ((N - 1) / 2) * PITCH; // 最外层体素中心坐标（各轴 ±MAXC）
const BEAT_MS = 420;
const AMMO_SLACK = 1.3;
const PALETTE = [
  { name: '红', tint: 0xe0433f, css: '#e0433f' },
  { name: '黄', tint: 0xf2c21e, css: '#f2c21e' },
  { name: '绿', tint: 0x5cb544, css: '#5cb544' },
  { name: '蓝', tint: 0x2e6cf6, css: '#2e6cf6' },
  { name: '白', tint: 0xeaf2ff, css: '#eaf2ff' },
  { name: '紫', tint: 0x8b5cf6, css: '#8b5cf6' },
];

// 六侧：法向 n（朝炮口检测用）+ 该侧固定轴/取值 + 面内两轴索引（把 (a,b) 网格映射到点阵 (i,j,k)）。
// axis: 固定的点阵轴 0=i/1=j/2=k；val: 该轴取 0 或 N-1；ua/ub: 面内两个自由轴索引。
const SIDES: { n: [number, number, number]; axis: number; val: number; ua: number; ub: number }[] = [
  { n: [0, 0, 1],  axis: 2, val: N - 1, ua: 0, ub: 1 }, // +Z 前
  { n: [0, 0, -1], axis: 2, val: 0,     ua: 0, ub: 1 }, // -Z 后
  { n: [1, 0, 0],  axis: 0, val: N - 1, ua: 2, ub: 1 }, // +X 右
  { n: [-1, 0, 0], axis: 0, val: 0,     ua: 2, ub: 1 }, // -X 左
  { n: [0, 1, 0],  axis: 1, val: N - 1, ua: 0, ub: 2 }, // +Y 顶
  { n: [0, -1, 0], axis: 1, val: 0,     ua: 0, ub: 2 }, // -Y 底
];

function shade(tint: number, k: number): number {
  const r = Math.round(((tint >> 16) & 0xff) * k), g = Math.round(((tint >> 8) & 0xff) * k), b = Math.round((tint & 0xff) * k);
  return (r << 16) | (g << 8) | b;
}
function hash3(a: number, b: number, c: number): number {
  let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
  h = (h ^ (h >>> 13)) >>> 0;
  return (h % 997) / 997;
}
function rotVec(x: number, y: number, z: number, rx: number, ry: number): [number, number, number] {
  const cy1 = y * Math.cos(rx) - z * Math.sin(rx), cz1 = y * Math.sin(rx) + z * Math.cos(rx);
  const cx2 = x * Math.cos(ry) + cz1 * Math.sin(ry), cz2 = -x * Math.sin(ry) + cz1 * Math.cos(ry);
  return [cx2, cy1, cz2];
}

interface Cell { id: string; i: number; j: number; k: number; color: number | null; }
const cellId = (i: number, j: number, k: number): string => `v-${i}-${j}-${k}`;
const idx2pos = (i: number): number => (i - (N - 1) / 2) * PITCH;

function buildProtoScene(cells: Cell[]): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {};
  const ids: string[] = [];
  for (const cell of cells) {
    const t = PALETTE[cell.color ?? 0].tint;
    entities[cell.id] = {
      Transform3D: { x: idx2pos(cell.i), y: idx2pos(cell.j), z: idx2pos(cell.k) },
      // 六面全上本色（侧面 shade 0.82 立体阴影·不发灰）。
      Mesh3D: { shape: 'box', width: VOX, height: VOX, depth: VOX, frontTint: t, backTint: t, edgeTint: shade(t, 0.82) },
    };
    ids.push(cell.id);
  }
  // 实心内核块（不可打·随立方转）：垫在壳背后·堵格缝透视→缝成凹槽阴影。面沉在体素正面之后=凹槽深度。
  entities['cube-core'] = {
    Transform3D: { x: 0, y: 0, z: 0 },
    Mesh3D: { shape: 'box', width: MAXC * 2, height: MAXC * 2, depth: MAXC * 2, frontTint: 0x0b1220, backTint: 0x0b1220, edgeTint: 0x0b1220 },
  };
  ids.push('cube-core');
  entities['cube-pivot'] = {
    Transform3D: { x: 0, y: 0, z: 0, rotX: -0.35, rotY: 0.5 },
    Pivot3D: { children: ids, centerX: 0, centerY: 0, centerZ: 0 },
  };
  entities['cam'] = { Transform3D: { x: 0, y: 0, z: 0 }, Camera3D: { yaw: 0, pitch: 0.18, distance: N * PITCH * 3.1, pivotX: 0, pivotY: 0, pivotZ: 0, projection: 'perspective', fov: 40 } };
  entities['sky'] = { Sky3D: { top: 0x0c1730, bottom: 0x14243f, env: 0.5 } };
  entities['sun'] = { Light3D: { kind: 'directional', color: 0xffffff, intensity: 1.15, dirX: -0.45, dirY: -0.9, dirZ: -0.55, castShadow: true } };
  entities['amb'] = { Light3D: { kind: 'ambient', color: 0xa8bce0, intensity: 0.6 } };
  return { capabilities: [], entities };
}

function el(tag: string, css: string, html?: string): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function mountVoxelProto(container: HTMLElement, _host?: { exit: () => void }): () => void {
  // 表面壳体素（任一轴 0/N-1）+ 配色（守恒配弹）。
  const cells: Cell[] = [];
  const count: number[] = PALETTE.map(() => 0);
  const isSurface = (i: number, j: number, k: number): boolean => i === 0 || i === N - 1 || j === 0 || j === N - 1 || k === 0 || k === N - 1;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      for (let k = 0; k < N; k++) {
        if (!isSurface(i, j, k)) continue;
        const color = Math.floor(hash3(i, j, k) * PALETTE.length) % PALETTE.length;
        count[color]++;
        cells.push({ id: cellId(i, j, k), i, j, k, color });
      }
  const cannons = PALETTE.map((_p, i) => ({ color: i, ammo: Math.ceil(count[i] * AMMO_SLACK) }));
  let activeIdx = 0;
  let remaining = cells.length;
  const total = cells.length;
  let over: 'win' | 'lose' | null = null;

  const outer = el('div', 'position:absolute;inset:0;overflow:hidden;background:#060d18;display:flex;align-items:center;justify-content:center;');
  container.appendChild(outer);
  const ASPECT = 0.5625;
  const cw = outer.clientWidth || 900, ch = outer.clientHeight || 1400;
  let fw = Math.round(ch * ASPECT), fh = ch;
  if (fw > cw) { fw = cw; fh = Math.round(cw / ASPECT); }
  const wrapper = el('div', `position:relative;width:${fw}px;height:${fh}px;overflow:hidden;touch-action:none;background:#0e1a30;`
    + 'background-image:linear-gradient(#ffffff10 1px,transparent 1px),linear-gradient(90deg,#ffffff10 1px,transparent 1px);background-size:48px 48px;box-shadow:0 0 40px #000a;');
  outer.appendChild(wrapper);
  const w = fw, h = fh;

  const engine = new Engine({ input: new QueuedInputSource('g102p') });
  engine.load(buildProtoScene(cells));
  const renderer = new ThreeRenderer({ width: w, height: h, background: 0x0e1a30, antialias: true, dprCap: 1.5, shadowMapSize: 1024 });
  engine.attachRenderer(renderer, wrapper);

  // ── 顶部 chrome ──
  const top = el('div', 'position:absolute;left:0;right:0;top:16px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;pointer-events:none;');
  top.appendChild(el('div', 'width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#ff6a5e,#c62f2b);box-shadow:0 4px 0 #8e1f1c,0 6px 10px #0007;display:flex;align-items:center;justify-content:center;font-size:24px;', '⚙️'));
  top.appendChild(el('div', 'padding:10px 30px;border-radius:24px;background:linear-gradient(#f0554f,#d0322d);box-shadow:0 4px 0 #9e1f1b,0 6px 12px #0007;color:#fff;font:800 22px system-ui;letter-spacing:.5px;', 'Level 1'));
  const coin = el('div', 'display:flex;align-items:center;gap:8px;padding:8px 16px 8px 10px;border-radius:22px;background:#0c1a30;border:2px solid #26385c;box-shadow:0 3px 8px #0006;color:#fff;font:800 20px system-ui;', '<span style="width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#ffe27a,#f2b70e);display:inline-block;box-shadow:inset 0 0 0 3px #c98f06"></span><span id="coins">0</span>');
  top.appendChild(coin);
  wrapper.appendChild(top);

  // ── 屏心准星 ──
  const reticle = el('div', 'position:absolute;left:50%;top:46%;width:74px;height:74px;transform:translate(-50%,-50%);pointer-events:none;');
  reticle.innerHTML = `<svg width="74" height="74" viewBox="0 0 74 74" fill="none" stroke="#7fe3ff" stroke-width="4" stroke-linecap="round">
    <path d="M6 20 V6 H20"/><path d="M54 6 H68 V20"/><path d="M68 54 V68 H54"/><path d="M20 68 H6 V54"/></svg>`;
  wrapper.appendChild(reticle);

  // ── 底部 chrome ──
  const beam = el('div', 'position:absolute;left:50%;bottom:96px;width:4px;height:220px;transform:translateX(-50%);background:linear-gradient(#7fe3ff88,#7fe3ff00);pointer-events:none;');
  wrapper.appendChild(beam);
  const bottom = el('div', 'position:absolute;left:0;right:0;bottom:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:12px;padding-bottom:14px;');
  const coreWrap = el('div', 'display:flex;align-items:center;gap:12px;width:86%;');
  coreWrap.appendChild(el('div', 'color:#8fb0e0;font:800 18px system-ui;', 'CORE'));
  const coreTrack = el('div', 'flex:1;height:16px;border-radius:10px;background:#0c1a30;border:2px solid #26385c;overflow:hidden;');
  const coreFill = el('div', 'height:100%;width:0%;border-radius:8px;background:linear-gradient(90deg,#ffb020,#ffe07a);transition:width .2s;');
  coreTrack.appendChild(coreFill);
  coreWrap.appendChild(coreTrack);
  const coreMul = el('div', 'color:#ffd77a;font:800 18px system-ui;', 'x0');
  coreWrap.appendChild(coreMul);
  bottom.appendChild(coreWrap);
  const nextRow = el('div', 'display:flex;align-items:center;gap:10px;');
  nextRow.appendChild(el('div', 'color:#8fb0e0;font:800 16px system-ui;letter-spacing:1px;', 'NEXT'));
  const nextDots = el('div', 'display:flex;gap:10px;');
  nextRow.appendChild(nextDots);
  bottom.appendChild(nextRow);
  const cannon = el('div', 'width:66px;height:52px;border-radius:12px 12px 8px 8px;background:#5cb544;box-shadow:0 0 26px 6px #5cb54488,0 5px 0 #3c8a2c;');
  bottom.appendChild(cannon);
  wrapper.appendChild(bottom);

  const banner = el('div', 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:900 46px system-ui;color:#fff;text-shadow:0 3px 14px #000;pointer-events:none;');
  wrapper.appendChild(banner);

  let hits = 0;
  const refreshChrome = (): void => {
    const c = cannons[activeIdx];
    if (c) {
      cannon.style.background = PALETTE[c.color].css;
      cannon.style.boxShadow = `0 0 26px 6px ${PALETTE[c.color].css}88,0 5px 0 #0006`;
      beam.style.background = `linear-gradient(${PALETTE[c.color].css}88,${PALETTE[c.color].css}00)`;
    }
    nextDots.innerHTML = '';
    for (let i = activeIdx + 1; i < Math.min(activeIdx + 6, cannons.length); i++)
      nextDots.appendChild(el('div', `width:26px;height:26px;border-radius:50%;background:${PALETTE[cannons[i].color].css};box-shadow:0 2px 5px #0006;`));
    coreFill.style.width = `${Math.round(((total - remaining) / total) * 100)}%`;
    coreMul.textContent = `x${hits}`;
    (coin.querySelector('#coins') as HTMLElement).textContent = String(hits);
  };
  refreshChrome();

  // ── 立方旋转（拖拽·手型光标）──
  wrapper.style.cursor = 'grab';
  let dragging = false, lastX = 0, lastY = 0;
  const pivotT = (): Transform3D | undefined => engine.world.getComponent<Transform3D>('cube-pivot', 'Transform3D');
  const onDown = (e: PointerEvent): void => { dragging = true; lastX = e.clientX; lastY = e.clientY; wrapper.style.cursor = 'grabbing'; wrapper.setPointerCapture?.(e.pointerId); };
  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const t = pivotT(); if (!t) return;
    t.rotY = (t.rotY ?? 0) + (e.clientX - lastX) * 0.011;
    t.rotX = Math.max(-1.6, Math.min(1.6, (t.rotX ?? 0) + (e.clientY - lastY) * 0.011));
    lastX = e.clientX; lastY = e.clientY;
    renderer.invalidate?.();
  };
  const onUp = (e: PointerEvent): void => { dragging = false; wrapper.style.cursor = 'grab'; wrapper.releasePointerCapture?.(e.pointerId); };
  wrapper.addEventListener('pointerdown', onDown);
  wrapper.addEventListener('pointermove', onMove);
  wrapper.addEventListener('pointerup', onUp);
  wrapper.addEventListener('pointercancel', onUp);

  const frontSide = (): number => {
    const t = pivotT(); const rx = t?.rotX ?? 0, ry = t?.rotY ?? 0;
    let best = 0, bestDot = -Infinity;
    for (let s = 0; s < 6; s++) {
      const nz = rotVec(SIDES[s].n[0], SIDES[s].n[1], SIDES[s].n[2], rx, ry)[2];
      if (nz > bestDot) { bestDot = nz; best = s; }
    }
    return best;
  };
  const byId = new Map(cells.map((c) => [c.id, c]));
  // 该侧面 (a,b) 网格 → 点阵坐标 → cell。
  const faceCell = (s: number, a: number, b: number): Cell | undefined => {
    const S = SIDES[s];
    const c = [0, 0, 0];
    c[S.axis] = S.val; c[S.ua] = a; c[S.ub] = b;
    return byId.get(cellId(c[0], c[1], c[2]));
  };
  const clearCell = (cell: Cell): void => {
    cell.color = null;
    engine.world.destroyEntity(cell.id);
    const piv = engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D');
    if (piv) { const k = piv.children.indexOf(cell.id); if (k >= 0) piv.children.splice(k, 1); }
    remaining--;
  };
  const finish = (): void => {
    over = remaining === 0 ? 'win' : 'lose';
    banner.textContent = over === 'win' ? '🎉 全清！' : '弹尽 · 未清空';
    banner.style.color = over === 'win' ? '#8affa0' : '#ff8a8a';
  };
  const flash = (ok: boolean): void => {
    reticle.style.filter = ok ? 'drop-shadow(0 0 8px #8affa0)' : 'drop-shadow(0 0 8px #ff6a6a)';
    setTimeout(() => { reticle.style.filter = ''; }, 120);
  };

  const onBeat = (): void => {
    if (over) return;
    const c = cannons[activeIdx];
    if (!c) { finish(); return; }
    const s = frontSide();
    const c0 = (N - 1) / 2;
    let aim: Cell | null = null, bestR = Infinity;
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      const cell = faceCell(s, a, b);
      if (!cell || cell.color === null) continue;
      const r = (a - c0) ** 2 + (b - c0) ** 2;
      if (r < bestR) { bestR = r; aim = cell; }
    }
    let hit = false;
    if (aim && aim.color === c.color) { clearCell(aim); hit = true; hits++; }
    c.ammo -= 1;
    flash(hit);
    if (remaining === 0) { finish(); refreshChrome(); return; }
    if (c.ammo <= 0) { activeIdx++; if (activeIdx >= cannons.length) finish(); }
    refreshChrome();
    renderer.invalidate?.();
  };

  let acc = 0, last = performance.now();
  const unsub = engine.subscribe(() => {
    const now = performance.now();
    acc += now - last; last = now;
    if (acc > 2000) acc = BEAT_MS;
    while (acc >= BEAT_MS) { acc -= BEAT_MS; onBeat(); }
  });
  engine.start();

  return () => {
    unsub();
    engine.stop();
    wrapper.removeEventListener('pointerdown', onDown);
    wrapper.removeEventListener('pointermove', onMove);
    wrapper.removeEventListener('pointerup', onUp);
    wrapper.removeEventListener('pointercancel', onUp);
    renderer.destroy();
    outer.remove();
  };
}
