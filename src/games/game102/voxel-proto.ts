// Game 102 · 3D 体素立方 —— **核心场景手感原型（throwaway·render-only·丢弃版）**。
//
// ⚠ 这是**验证「好不好玩」+ 复刻概念图场景**的一次性原型，不是数据驱动正式游戏：旋转 + 命中判定跑在 mount
// 宿主胶水里（game-z「拖拽转视角」输入胶水先例的同类·render-only·不进 sim/hash）。HUD 暂用 DOM 叠层
// （正式版 = PUI LayoutNode）。**证明好玩后**再把「可旋转立方 + 面对齐开火 + 吸附」sink 成引擎能力做纯数据版。
//
// 场景（owner 2026-07-26 概念图）：暗底网格 + 中央多彩体素立方（唯一操作 = 鼠标在立方上呈手型·上下左右拖拽旋转）
// + 屏心准星（炮口瞄点）+ 底部发光炮台朝上开火 + NEXT 下一批炮色队列 + CORE 进度条 + 顶部 关卡/金币/设置 chrome。
// 循环：底部炮台按拍朝准星开火 → 你转立方把同色格转到准星 → 正对同色命中·错色/空格空放浪费 → 打完轮下一色。
// 吸附（把选中格精确对齐准星）owner 明示「后面再说」——本里程碑先把场景立起来。
import { Engine } from '../../runtime/engine.js';
import { QueuedInputSource } from '@net/index.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { Transform3D, Pivot3D } from '@engine/protocol/components.js';

// ── 配置（手感旋钮·随便调）──────────────────────────────────────────────────────────────────
const N = 8;              // 每面 N×N 格（概念图约 8）
const PITCH = 22;
const VOX = 20;
const H = (N * PITCH) / 2;
const BEAT_MS = 420;      // 开火节拍
const AMMO_SLACK = 1.3;   // 每色弹药 = 该色格数 × 此值（容错）
// 概念图 6 色：红·黄·绿·蓝·白·紫。
const PALETTE = [
  { name: '红', tint: 0xe0433f, css: '#e0433f' },
  { name: '黄', tint: 0xf2c21e, css: '#f2c21e' },
  { name: '绿', tint: 0x5cb544, css: '#5cb544' },
  { name: '蓝', tint: 0x2e6cf6, css: '#2e6cf6' },
  { name: '白', tint: 0xeaf2ff, css: '#eaf2ff' },
  { name: '紫', tint: 0x8b5cf6, css: '#8b5cf6' },
];

const FACES: { n: [number, number, number]; u: [number, number, number]; v: [number, number, number] }[] = [
  { n: [0, 0, 1],  u: [1, 0, 0],  v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
  { n: [1, 0, 0],  u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1],  v: [0, 1, 0] },
  { n: [0, 1, 0],  u: [1, 0, 0],  v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0],  v: [0, 0, 1] },
];

// 压暗一个 0xRRGGBB 色（k<1·给方块侧面/棱做阴影·仍带本色·不发灰）。
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

interface Cell { id: string; face: number; a: number; b: number; color: number | null; }

function buildProtoScene(cells: Cell[]): { blueprint: WorldBlueprint; ids: string[] } {
  const entities: Record<string, EntityBlueprint> = {};
  const ids: string[] = [];
  const c0 = (N - 1) / 2;
  for (const cell of cells) {
    const f = FACES[cell.face];
    const ca = (cell.a - c0) * PITCH, cb = (cell.b - c0) * PITCH;
    entities[cell.id] = {
      Transform3D: {
        x: f.n[0] * H + f.u[0] * ca + f.v[0] * cb,
        y: f.n[1] * H + f.u[1] * ca + f.v[1] * cb,
        z: f.n[2] * H + f.u[2] * ca + f.v[2] * cb,
      },
      // 六面全上本色（frontTint=+z 面·backTint=-z 面·edgeTint=四侧面）——否则一转就露灰侧面。侧面压暗 0.82 做立体阴影。
      Mesh3D: (() => { const t = PALETTE[cell.color ?? 0].tint; return { shape: 'box' as const, width: VOX, height: VOX, depth: VOX, frontTint: t, backTint: t, edgeTint: shade(t, 0.82) }; })(),
    };
    ids.push(cell.id);
  }
  // 实心内核块（不可打·随立方转）：垫在外壳体素背后·堵住格间缝的「透视看穿对面」→ 缝变凹槽阴影。
  // 尺寸略小于外壳外沿、覆盖体素侧向范围、面沉在体素正面之后（露出 = 凹槽深度）。深色 = 槽内阴影。
  entities['cube-core'] = {
    Transform3D: { x: 0, y: 0, z: 0 },
    Mesh3D: { shape: 'box', width: H * 2, height: H * 2, depth: H * 2, frontTint: 0x0b1220, backTint: 0x0b1220, edgeTint: 0x0b1220 },
  };
  ids.push('cube-core');
  entities['cube-pivot'] = {
    Transform3D: { x: 0, y: 0, z: 0, rotX: -0.35, rotY: 0.5 }, // 初始 3/4 视角（同概念图斜俯视）
    Pivot3D: { children: ids, centerX: 0, centerY: 0, centerZ: 0 },
  };
  entities['cam'] = { Transform3D: { x: 0, y: 0, z: 0 }, Camera3D: { yaw: 0, pitch: 0.18, distance: H * 7.6, pivotX: 0, pivotY: 0, pivotZ: 0, projection: 'perspective', fov: 40 } };
  entities['sky'] = { Sky3D: { top: 0x0c1730, bottom: 0x14243f, env: 0.5 } };
  entities['sun'] = { Light3D: { kind: 'directional', color: 0xffffff, intensity: 1.15, dirX: -0.45, dirY: -0.9, dirZ: -0.55, castShadow: true } };
  entities['amb'] = { Light3D: { kind: 'ambient', color: 0xa8bce0, intensity: 0.6 } };
  return { blueprint: { capabilities: [], entities }, ids };
}

// ── DOM chrome（原型叠层·复刻概念图布局）─────────────────────────────────────────────────────
function el(tag: string, css: string, html?: string): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function mountVoxelProto(container: HTMLElement, _host?: { exit: () => void }): () => void {
  const cells: Cell[] = [];
  const count: number[] = PALETTE.map(() => 0);
  for (let face = 0; face < 6; face++)
    for (let a = 0; a < N; a++)
      for (let b = 0; b < N; b++) {
        const color = Math.floor(hash3(face, a, b) * PALETTE.length) % PALETTE.length;
        count[color]++;
        cells.push({ id: `c-${face}-${a}-${b}`, face, a, b, color });
      }
  const cannons = PALETTE.map((_p, i) => ({ color: i, ammo: Math.ceil(count[i] * AMMO_SLACK) }));
  let activeIdx = 0;
  let remaining = cells.length;
  const total = cells.length;
  let over: 'win' | 'lose' | null = null;

  // 外层信箱（填满容器·深色边）+ 竖版机框（照参考图 9:16 竖屏·居中·letterbox）。
  const outer = el('div', 'position:absolute;inset:0;overflow:hidden;background:#060d18;display:flex;align-items:center;justify-content:center;');
  container.appendChild(outer);
  const ASPECT = 0.5625; // w/h = 9:16 竖屏
  const cw = outer.clientWidth || 900, ch = outer.clientHeight || 1400;
  let fw = Math.round(ch * ASPECT), fh = ch;
  if (fw > cw) { fw = cw; fh = Math.round(cw / ASPECT); }
  // 背景：暗底 + 淡网格（概念图）。
  const wrapper = el('div', `position:relative;width:${fw}px;height:${fh}px;overflow:hidden;touch-action:none;background:#0e1a30;`
    + 'background-image:linear-gradient(#ffffff10 1px,transparent 1px),linear-gradient(90deg,#ffffff10 1px,transparent 1px);background-size:48px 48px;box-shadow:0 0 40px #000a;');
  outer.appendChild(wrapper);
  const w = fw, h = fh;

  const { blueprint } = buildProtoScene(cells);
  const engine = new Engine({ input: new QueuedInputSource('g102p') });
  engine.load(blueprint);
  const renderer = new ThreeRenderer({ width: w, height: h, background: 0x0e1a30, antialias: true, dprCap: 1.5, shadowMapSize: 1024 });
  engine.attachRenderer(renderer, wrapper);

  // ── 顶部 chrome：设置 / Level / 金币 ──
  const top = el('div', 'position:absolute;left:0;right:0;top:16px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;pointer-events:none;');
  top.appendChild(el('div', 'width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#ff6a5e,#c62f2b);box-shadow:0 4px 0 #8e1f1c,0 6px 10px #0007;display:flex;align-items:center;justify-content:center;font-size:24px;', '⚙️'));
  top.appendChild(el('div', 'padding:10px 30px;border-radius:24px;background:linear-gradient(#f0554f,#d0322d);box-shadow:0 4px 0 #9e1f1b,0 6px 12px #0007;color:#fff;font:800 22px system-ui;letter-spacing:.5px;', 'Level 1'));
  const coin = el('div', 'display:flex;align-items:center;gap:8px;padding:8px 16px 8px 10px;border-radius:22px;background:#0c1a30;border:2px solid #26385c;box-shadow:0 3px 8px #0006;color:#fff;font:800 20px system-ui;', '<span style="width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#ffe27a,#f2b70e);display:inline-block;box-shadow:inset 0 0 0 3px #c98f06"></span><span id="coins">0</span>');
  top.appendChild(coin);
  wrapper.appendChild(top);

  // ── 屏心准星（炮口瞄点）──
  const reticle = el('div', `position:absolute;left:50%;top:46%;width:74px;height:74px;transform:translate(-50%,-50%);pointer-events:none;`);
  reticle.innerHTML = `<svg width="74" height="74" viewBox="0 0 74 74" fill="none" stroke="#7fe3ff" stroke-width="4" stroke-linecap="round">
    <path d="M6 20 V6 H20"/><path d="M54 6 H68 V20"/><path d="M68 54 V68 H54"/><path d="M20 68 H6 V54"/></svg>`;
  wrapper.appendChild(reticle);

  // ── 底部：CORE 进度条 + NEXT 队列 + 发光炮台 + 炮线 ──
  const beam = el('div', 'position:absolute;left:50%;bottom:96px;width:4px;height:220px;transform:translateX(-50%);background:linear-gradient(#7fe3ff88,#7fe3ff00);pointer-events:none;');
  wrapper.appendChild(beam);

  const bottom = el('div', 'position:absolute;left:0;right:0;bottom:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:12px;padding-bottom:14px;');
  // CORE 条
  const coreWrap = el('div', 'display:flex;align-items:center;gap:12px;width:86%;');
  coreWrap.appendChild(el('div', 'color:#8fb0e0;font:800 18px system-ui;', 'CORE'));
  const coreTrack = el('div', 'flex:1;height:16px;border-radius:10px;background:#0c1a30;border:2px solid #26385c;overflow:hidden;');
  const coreFill = el('div', 'height:100%;width:0%;border-radius:8px;background:linear-gradient(90deg,#ffb020,#ffe07a);transition:width .2s;');
  coreTrack.appendChild(coreFill);
  coreWrap.appendChild(coreTrack);
  const coreMul = el('div', 'color:#ffd77a;font:800 18px system-ui;', 'x0');
  coreWrap.appendChild(coreMul);
  bottom.appendChild(coreWrap);
  // NEXT 队列
  const nextRow = el('div', 'display:flex;align-items:center;gap:10px;');
  nextRow.appendChild(el('div', 'color:#8fb0e0;font:800 16px system-ui;letter-spacing:1px;', 'NEXT'));
  const nextDots = el('div', 'display:flex;gap:10px;');
  nextRow.appendChild(nextDots);
  bottom.appendChild(nextRow);
  // 发光炮台
  const cannon = el('div', 'width:66px;height:52px;border-radius:12px 12px 8px 8px;background:#5cb544;box-shadow:0 0 26px 6px #5cb54488,0 5px 0 #3c8a2c;');
  bottom.appendChild(cannon);
  wrapper.appendChild(bottom);

  const banner = el('div', 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:900 46px system-ui;color:#fff;text-shadow:0 3px 14px #000;pointer-events:none;');
  wrapper.appendChild(banner);

  let hits = 0;
  const refreshChrome = (): void => {
    const c = cannons[activeIdx];
    // 炮台 + 准星染当前色。
    if (c) {
      cannon.style.background = PALETTE[c.color].css;
      cannon.style.boxShadow = `0 0 26px 6px ${PALETTE[c.color].css}88,0 5px 0 #0006`;
      beam.style.background = `linear-gradient(${PALETTE[c.color].css}88,${PALETTE[c.color].css}00)`;
    }
    // NEXT = 之后几门炮的色。
    nextDots.innerHTML = '';
    for (let i = activeIdx + 1; i < Math.min(activeIdx + 6, cannons.length); i++) {
      nextDots.appendChild(el('div', `width:26px;height:26px;border-radius:50%;background:${PALETTE[cannons[i].color].css};box-shadow:0 2px 5px #0006;`));
    }
    const cleared = total - remaining;
    coreFill.style.width = `${Math.round((cleared / total) * 100)}%`;
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

  const frontFace = (): number => {
    const t = pivotT(); const rx = t?.rotX ?? 0, ry = t?.rotY ?? 0;
    let best = 0, bestDot = -Infinity;
    for (let i = 0; i < 6; i++) {
      const nz = rotVec(FACES[i].n[0], FACES[i].n[1], FACES[i].n[2], rx, ry)[2];
      if (nz > bestDot) { bestDot = nz; best = i; }
    }
    return best;
  };
  const byId = new Map(cells.map((c) => [c.id, c]));
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
    const F = frontFace();
    const c0 = (N - 1) / 2;
    // 瞄准星 = 前面**最靠面心的现存格**（吸附前的近似点瞄）。
    let aim: Cell | null = null, bestR = Infinity;
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      const cell = byId.get(`c-${F}-${a}-${b}`);
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
    if (acc > 2000) acc = BEAT_MS; // 后台标签页回来不暴发
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
