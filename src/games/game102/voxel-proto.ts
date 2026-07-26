// Game 102 · 3D 体素立方 —— **核心循环手感原型（throwaway·render-only·丢弃版）**。
//
// ⚠ 这是**验证「好不好玩」的一次性手感原型**，不是数据驱动的正式游戏：旋转 + 命中判定跑在 mount 宿主胶水里
// （game-z「拖拽转 Camera3D」输入胶水先例的同类·render-only·不进 sim/hash）。**证明好玩后**再把「可旋转立方 +
// 面对齐开火」sink 成引擎能力、正式做成纯数据蓝图（当前规则禁玩法逻辑进宿主·此原型仅为拍板服务·经 owner 同意）。
//
// 核心循环（owner 2026-07-26 拍板）：唯一操作=拖拽旋转立方；当前炮台按拍自动开火 → 你把同色面转到炮口（世界 +Z）
// → 正对同色命中消除·错色/空格空放浪费（弹照扣）→ 打完这门弹才轮下一色 → 全清即胜·炮弹用尽仍有格则负。
import { Engine } from '../../runtime/engine.js';
import { QueuedInputSource } from '@net/index.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { Transform3D, Pivot3D, Mesh3D } from '@engine/protocol/components.js';

// ── 配置（手感旋钮·随便调）──────────────────────────────────────────────────────────────────
const N = 6;              // 每面 N×N 格
const PITCH = 24;         // 格步距
const VOX = 22;           // 方块边长（露缝＝网格线）
const H = (N * PITCH) / 2; // 立方半边（面板贴在 ±H）
const BEAT_MS = 380;      // 开火节拍（越小越紧张）
const AMMO_SLACK = 1.25;  // 每色弹药 = 该色格数 × 此值（>1 给容错·空放才不必然死）
const PALETTE = [
  { name: '红', tint: 0xe0433f },
  { name: '绿', tint: 0x5cb544 },
  { name: '蓝', tint: 0x2e6cf6 },
];

// 六面：法向 n + 面内两轴 u,v（格心 = n·H + u·ca + v·cb）。
const FACES: { n: [number, number, number]; u: [number, number, number]; v: [number, number, number] }[] = [
  { n: [0, 0, 1],  u: [1, 0, 0],  v: [0, 1, 0] },  // +Z 前
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },  // -Z 后
  { n: [1, 0, 0],  u: [0, 0, -1], v: [0, 1, 0] },  // +X 右
  { n: [-1, 0, 0], u: [0, 0, 1],  v: [0, 1, 0] },  // -X 左
  { n: [0, 1, 0],  u: [1, 0, 0],  v: [0, 0, -1] }, // +Y 顶
  { n: [0, -1, 0], u: [1, 0, 0],  v: [0, 0, 1] },  // -Y 底
];

// 整数哈希（确定性配色·无 Math.random）。
function hash3(a: number, b: number, c: number): number {
  let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
  h = (h ^ (h >>> 13)) >>> 0;
  return (h % 997) / 997;
}
function rotVec(x: number, y: number, z: number, rx: number, ry: number): [number, number, number] {
  const cy1 = y * Math.cos(rx) - z * Math.sin(rx), cz1 = y * Math.sin(rx) + z * Math.cos(rx); // Rx
  const cx2 = x * Math.cos(ry) + cz1 * Math.sin(ry), cz2 = -x * Math.sin(ry) + cz1 * Math.cos(ry); // Ry
  return [cx2, cy1, cz2];
}

interface Cell { id: string; face: number; a: number; b: number; color: number | null; }

// ── 原型场景蓝图（体素面板 + pivot + 相机 + 光）──────────────────────────────────────────────
function buildProtoScene(cells: Cell[]): { blueprint: WorldBlueprint; ids: string[] } {
  const entities: Record<string, EntityBlueprint> = {};
  const ids: string[] = [];
  const c0 = (N - 1) / 2;
  for (const cell of cells) {
    const f = FACES[cell.face];
    const ca = (cell.a - c0) * PITCH, cb = (cell.b - c0) * PITCH;
    const x = f.n[0] * H + f.u[0] * ca + f.v[0] * cb;
    const y = f.n[1] * H + f.u[1] * ca + f.v[1] * cb;
    const z = f.n[2] * H + f.u[2] * ca + f.v[2] * cb;
    const tint = PALETTE[cell.color ?? 0].tint;
    entities[cell.id] = {
      Transform3D: { x, y, z },
      Mesh3D: { shape: 'box', width: VOX, height: VOX, depth: VOX, frontTint: tint, edgeTint: 0x1c1f2b },
    };
    ids.push(cell.id);
  }
  entities['cube-pivot'] = {
    Transform3D: { x: 0, y: 0, z: 0, rotX: 0, rotY: 0 },
    Pivot3D: { children: ids, centerX: 0, centerY: 0, centerZ: 0 },
  };
  // 炮台（固定于世界 +Z·朝立方·随当前色换 tint）——不入 pivot（不随立方转）。
  entities['cannon'] = {
    Transform3D: { x: 0, y: 0, z: H + 90, rotX: Math.PI / 2 },
    Mesh3D: { shape: 'cone', width: 40, height: 60, frontTint: PALETTE[0].tint, edgeTint: 0x222633 },
  };
  entities['cam'] = { Transform3D: { x: 0, y: 0, z: 0 }, Camera3D: { yaw: 0, pitch: 0.22, distance: H * 7.2, pivotX: 0, pivotY: 0, pivotZ: 0, projection: 'perspective', fov: 42 } };
  entities['sky'] = { Sky3D: { top: 0x1a2748, bottom: 0x6f93c8, clouds: true, cloudTint: 0xffffff, scroll: 0.015, env: 0.55 } };
  entities['sun'] = { Light3D: { kind: 'directional', color: 0xffffff, intensity: 1.15, dirX: -0.4, dirY: -1, dirZ: -0.5, castShadow: true } };
  entities['amb'] = { Light3D: { kind: 'ambient', color: 0x9fb4d8, intensity: 0.55 } };
  return { blueprint: { capabilities: [], entities }, ids };
}

// ── 手感原型挂载 ────────────────────────────────────────────────────────────────────────────
export function mountVoxelProto(container: HTMLElement, _host?: { exit: () => void }): () => void {
  // 造格 + 配色（守恒：弹药按色数配）。
  const cells: Cell[] = [];
  const count: number[] = PALETTE.map(() => 0);
  for (let face = 0; face < 6; face++) {
    for (let a = 0; a < N; a++) {
      for (let b = 0; b < N; b++) {
        const color = Math.floor(hash3(face, a, b) * PALETTE.length) % PALETTE.length;
        count[color]++;
        cells.push({ id: `c-${face}-${a}-${b}`, face, a, b, color });
      }
    }
  }
  const cannons = PALETTE.map((p, i) => ({ color: i, ammo: Math.ceil(count[i] * AMMO_SLACK) }));
  let activeIdx = 0;
  let remaining = cells.length;
  let over: 'win' | 'lose' | null = null;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;inset:0;background:#0a1424;overflow:hidden;touch-action:none;';
  container.appendChild(wrapper);
  const w = wrapper.clientWidth || 960, h = wrapper.clientHeight || 540;

  const { blueprint } = buildProtoScene(cells);
  const engine = new Engine({ input: new QueuedInputSource('g102p') });
  engine.load(blueprint);
  const renderer = new ThreeRenderer({ width: w, height: h, background: 0x0a1424, antialias: true, dprCap: 1.5, shadowMapSize: 1024 });
  engine.attachRenderer(renderer, wrapper);

  // HUD（DOM 叠层·原型用·正式版走 PUI LayoutNode）。
  const hud = document.createElement('div');
  hud.style.cssText = 'position:absolute;left:16px;top:14px;font:600 15px/1.5 system-ui,sans-serif;color:#eaf2ff;text-shadow:0 1px 3px #000;pointer-events:none;';
  wrapper.appendChild(hud);
  const banner = document.createElement('div');
  banner.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 44px system-ui,sans-serif;color:#fff;text-shadow:0 3px 12px #000;pointer-events:none;';
  wrapper.appendChild(banner);
  const tip = document.createElement('div');
  tip.style.cssText = 'position:absolute;left:0;right:0;bottom:14px;text-align:center;font:500 13px system-ui,sans-serif;color:#9fb4d8;pointer-events:none;';
  tip.textContent = '拖拽旋转立方 —— 把当前颜色的面转到下方炮口，炮按拍自动开火（横屏体验最佳）';
  wrapper.appendChild(tip);
  const swatch = (t: number): string => '#' + t.toString(16).padStart(6, '0');
  const updateHud = (lastHit?: boolean): void => {
    const c = cannons[activeIdx];
    const nm = c ? PALETTE[c.color].name : '—';
    const tint = c ? PALETTE[c.color].tint : 0x888888;
    hud.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${swatch(tint)};vertical-align:-2px;margin-right:6px"></span>`
      + `当前炮台：<b>${nm}</b> &nbsp; 弹药 <b>${c ? c.ammo : 0}</b> &nbsp; 剩余格 <b>${remaining}</b>`
      + (lastHit === false ? ' &nbsp; <span style="color:#ff8a8a">空放！</span>' : lastHit ? ' &nbsp; <span style="color:#8affa0">命中</span>' : '');
  };
  updateHud();

  // 立方旋转（拖拽·render-only 改 pivot 欧拉角）。
  let dragging = false, lastX = 0, lastY = 0;
  const pivotT = (): Transform3D | undefined => engine.world.getComponent<Transform3D>('cube-pivot', 'Transform3D');
  const onDown = (e: PointerEvent): void => { dragging = true; lastX = e.clientX; lastY = e.clientY; wrapper.setPointerCapture?.(e.pointerId); };
  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const t = pivotT(); if (!t) return;
    t.rotY = (t.rotY ?? 0) + (e.clientX - lastX) * 0.011;   // 水平拖 → 绕竖轴
    const rx = (t.rotX ?? 0) + (e.clientY - lastY) * 0.011; // 垂直拖 → 俯仰（夹 ±1.6 让顶/底面也能转到炮口）
    t.rotX = Math.max(-1.6, Math.min(1.6, rx));
    lastX = e.clientX; lastY = e.clientY;
    renderer.invalidate?.();
  };
  const onUp = (e: PointerEvent): void => { dragging = false; wrapper.releasePointerCapture?.(e.pointerId); };
  wrapper.addEventListener('pointerdown', onDown);
  wrapper.addEventListener('pointermove', onMove);
  wrapper.addEventListener('pointerup', onUp);
  wrapper.addEventListener('pointercancel', onUp);

  // 当前朝炮口（世界 +Z）的面 = 旋转后法向与 (0,0,1) 点积最大者。
  const frontFace = (): number => {
    const t = pivotT(); const rx = t?.rotX ?? 0, ry = t?.rotY ?? 0;
    let best = 0, bestDot = -Infinity;
    for (let i = 0; i < 6; i++) {
      const [, , nz] = rotVec(FACES[i].n[0], FACES[i].n[1], FACES[i].n[2], rx, ry);
      if (nz > bestDot) { bestDot = nz; best = i; }
    }
    return best;
  };
  // 按面索引取该面某格。
  const byId = new Map(cells.map((c) => [c.id, c]));
  const setCannonTint = (): void => {
    const m = engine.world.getComponent<Mesh3D>('cannon', 'Mesh3D');
    const c = cannons[activeIdx];
    if (m && c) m.frontTint = PALETTE[c.color].tint;
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

  const onBeat = (): void => {
    if (over) return;
    const c = cannons[activeIdx];
    if (!c) { finish(); return; }
    const F = frontFace();
    const c0 = (N - 1) / 2;
    // 该面剩余同色格中取最靠面心者（逐圈往里剥·手感更顺）。
    let target: Cell | null = null, bestR = Infinity;
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      const cell = byId.get(`c-${F}-${a}-${b}`);
      if (!cell || cell.color !== c.color) continue;
      const r = (a - c0) ** 2 + (b - c0) ** 2;
      if (r < bestR) { bestR = r; target = cell; }
    }
    let hit = false;
    if (target) { clearCell(target); hit = true; }
    c.ammo -= 1;               // 空放浪费：命中与否都扣一发
    if (remaining === 0) { finish(); updateHud(hit); return; }
    if (c.ammo <= 0) { activeIdx++; setCannonTint(); if (activeIdx >= cannons.length) { finish(); } }
    updateHud(hit);
    renderer.invalidate?.();
  };

  // 每帧钩子（engine.start 每帧 renderer.sync + notifyListeners）：跑开火节拍。
  let acc = 0, last = performance.now();
  const unsub = engine.subscribe(() => {
    const now = performance.now();
    acc += now - last; last = now;
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
    wrapper.remove();
  };
}
