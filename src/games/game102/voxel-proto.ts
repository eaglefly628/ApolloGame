// Game 102 · 3D 体素立方 —— **核心场景手感原型（throwaway·render-only·丢弃版）**。
//
// ⚠ 验证「好不好玩」+ 复刻概念图场景的一次性原型（不是数据驱动正式游戏）：旋转 + 命中判定跑在 mount 宿主胶水里
// （game-z「拖拽转视角」输入胶水先例的同类·render-only·不进 sim/hash）。HUD 暂 DOM 叠层（正式版 = PUI）。
// 证明好玩后再把「可旋转立方 + 射线命中 + 逐层剥 + 同色破/异色弹 + 吸附」sink 成引擎能力做纯数据版。
//
// ★ 几何：立方 = **真 N×N×N 实心体素点阵**（棱恒对齐）；只渲**当前暴露层**（打掉一格→其后一格暴露→显出=流入下一层）。
// ★ 开火：底部炮台按拍朝屏心准星射子弹 → 命中前面中心列最外现存格：**同色打破**（该格掉·露下一层）/ **异色反弹**（不破·空放）。
// ★ 待机自转：不操作时立方缓缓自转（松手 IDLE_DELAY 后启动·操作时停·不飘不坑）。
import { Engine } from '../../runtime/engine.js';
import { QueuedInputSource } from '@net/index.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { Transform3D, Pivot3D } from '@engine/protocol/components.js';

// ── 配置（手感旋钮）──────────────────────────────────────────────────────────────────────────
const N = 10;             // 立方边长（N×N×N 实心点阵）
const PITCH = 22;
const VOX = 20;
const MAXC = ((N - 1) / 2) * PITCH;
const BEAT_MS = 420;
const AMMO_SLACK = 1.3;
const IDLE_SPIN = 0.22;   // 待机自转 rad/秒（0=关）
const IDLE_DELAY = 1400;  // 松手后 ms 无操作才启动待机自转
const PLATFORM_Y = -((N - 1) / 2) * 22 * 2.7; // 平台高度（立方下方）
const MUZZLE = { x: 0, y: -((N - 1) / 2) * 22 * 1.9, z: ((N - 1) / 2) * 22 * 0.9 }; // 炮口世界位（立方前下方）
const BULLET = 16;        // 子弹立方边长
const FLIGHT_MS = 150;    // 子弹飞抵立方用时（到点结算·碎裂/反弹）
const DEBRIS_MS = 4200;   // 碎片存活（落台后回收）
const PALETTE = [
  { name: '红', tint: 0xe0433f, css: '#e0433f' },
  { name: '黄', tint: 0xf2c21e, css: '#f2c21e' },
  { name: '绿', tint: 0x5cb544, css: '#5cb544' },
  { name: '蓝', tint: 0x2e6cf6, css: '#2e6cf6' },
  { name: '白', tint: 0xeaf2ff, css: '#eaf2ff' },
  { name: '紫', tint: 0x8b5cf6, css: '#8b5cf6' },
];

// 六侧：法向 n（朝炮口检测）+ 固定轴/取值 + 面内两自由轴。
const SIDES: { n: [number, number, number]; axis: number; val: number; ua: number; ub: number }[] = [
  { n: [0, 0, 1],  axis: 2, val: N - 1, ua: 0, ub: 1 },
  { n: [0, 0, -1], axis: 2, val: 0,     ua: 0, ub: 1 },
  { n: [1, 0, 0],  axis: 0, val: N - 1, ua: 2, ub: 1 },
  { n: [-1, 0, 0], axis: 0, val: 0,     ua: 2, ub: 1 },
  { n: [0, 1, 0],  axis: 1, val: N - 1, ua: 0, ub: 2 },
  { n: [0, -1, 0], axis: 1, val: 0,     ua: 0, ub: 2 },
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
const vid = (i: number, j: number, k: number): string => `v-${i}-${j}-${k}`;
const idx2pos = (i: number): number => (i - (N - 1) / 2) * PITCH;
const voxMesh = (t: number): Record<string, unknown> => ({ shape: 'box', width: VOX, height: VOX, depth: VOX, frontTint: t, backTint: t, edgeTint: shade(t, 0.82) });

function el(tag: string, css: string, html?: string): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function mountVoxelProto(container: HTMLElement, _host?: { exit: () => void }): () => void {
  // 完整实心点阵配色（守恒配弹）。
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
    const nb: [number, number, number][] = [[i+1,j,k],[i-1,j,k],[i,j+1,k],[i,j-1,k],[i,j,k+1],[i,j,k-1]];
    return nb.some(([a, b, c]) => !inB(a) || !inB(b) || !inB(c) || !present.has(vid(a, b, c)));
  };

  const cannons = PALETTE.map((_p, i) => ({ color: i, ammo: Math.ceil(count[i] * AMMO_SLACK) }));
  let activeIdx = 0;
  let remaining = present.size;
  const total = present.size;
  let over: 'win' | 'lose' | null = null;

  // ── 场景（只渲初始暴露壳）──
  const rendered = new Set<string>();
  const buildScene = (): WorldBlueprint => {
    const entities: Record<string, EntityBlueprint> = {};
    const ids: string[] = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
      if (!exposed(i, j, k)) continue;
      const id = vid(i, j, k);
      entities[id] = { Transform3D: { x: idx2pos(i), y: idx2pos(j), z: idx2pos(k) }, Mesh3D: voxMesh(PALETTE[colorAt.get(id)!].tint) as EntityBlueprint['Mesh3D'] };
      ids.push(id); rendered.add(id);
    }
    entities['cube-core'] = { Transform3D: { x: 0, y: 0, z: 0 }, Mesh3D: { shape: 'box', width: MAXC * 2, height: MAXC * 2, depth: MAXC * 2, frontTint: 0x0b1220, backTint: 0x0b1220, edgeTint: 0x0b1220 } };
    ids.push('cube-core');
    entities['cube-pivot'] = { Transform3D: { x: 0, y: 0, z: 0, rotX: -0.35, rotY: 0.5 }, Pivot3D: { children: ids, centerX: 0, centerY: 0, centerZ: 0 } };
    // 下方平台（静态刚体·碎片/反弹子弹落其上）——**不入 pivot**（世界空间·不随立方转）。
    entities['platform'] = {
      Transform3D: { x: 0, y: PLATFORM_Y, z: 0 },
      Mesh3D: { shape: 'box', width: MAXC * 5, height: 24, depth: MAXC * 5, frontTint: 0x243350, backTint: 0x243350, edgeTint: 0x1a2740 },
      RigidBody3D: { shape: 'box', mass: 0, restitution: 0.3, friction: 0.7 },
    };
    // 相机：缩 ~20% 留白（以后接 3D 轨道）+ 下移取景框住平台。
    entities['cam'] = { Transform3D: { x: 0, y: 0, z: 0 }, Camera3D: { yaw: 0, pitch: 0.28, distance: N * PITCH * 3.9, pivotX: 0, pivotY: -MAXC * 1.15, pivotZ: 0, projection: 'perspective', fov: 40 } };
    entities['sky'] = { Sky3D: { top: 0x0c1730, bottom: 0x14243f, env: 0.5 } };
    entities['sun'] = { Light3D: { kind: 'directional', color: 0xffffff, intensity: 1.15, dirX: -0.45, dirY: -0.9, dirZ: -0.55, castShadow: true } };
    entities['amb'] = { Light3D: { kind: 'ambient', color: 0xa8bce0, intensity: 0.6 } };
    return { capabilities: [], entities };
  };

  const outer = el('div', 'position:absolute;inset:0;overflow:hidden;background:#060d18;display:flex;align-items:center;justify-content:center;');
  container.appendChild(outer);
  const ASPECT = 0.5625;
  const cw = outer.clientWidth || 900, ch = outer.clientHeight || 1400;
  let fw = Math.round(ch * ASPECT), fh = ch;
  if (fw > cw) { fw = cw; fh = Math.round(cw / ASPECT); }
  const wrapper = el('div', `position:relative;width:${fw}px;height:${fh}px;overflow:hidden;touch-action:none;background:#0e1a30;`
    + 'background-image:linear-gradient(#ffffff10 1px,transparent 1px),linear-gradient(90deg,#ffffff10 1px,transparent 1px);background-size:48px 48px;box-shadow:0 0 40px #000a;');
  outer.appendChild(wrapper);

  const engine = new Engine({ input: new QueuedInputSource('g102p') });
  engine.load(buildScene());
  const renderer = new ThreeRenderer({ width: fw, height: fh, background: 0x0e1a30, antialias: true, dprCap: 1.5, shadowMapSize: 1024 });
  engine.attachRenderer(renderer, wrapper);

  // ── chrome ──
  const top = el('div', 'position:absolute;left:0;right:0;top:16px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;pointer-events:none;');
  top.appendChild(el('div', 'width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#ff6a5e,#c62f2b);box-shadow:0 4px 0 #8e1f1c,0 6px 10px #0007;display:flex;align-items:center;justify-content:center;font-size:24px;', '⚙️'));
  top.appendChild(el('div', 'padding:10px 30px;border-radius:24px;background:linear-gradient(#f0554f,#d0322d);box-shadow:0 4px 0 #9e1f1b,0 6px 12px #0007;color:#fff;font:800 22px system-ui;', 'Level 1'));
  const coin = el('div', 'display:flex;align-items:center;gap:8px;padding:8px 16px 8px 10px;border-radius:22px;background:#0c1a30;border:2px solid #26385c;box-shadow:0 3px 8px #0006;color:#fff;font:800 20px system-ui;', '<span style="width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#ffe27a,#f2b70e);display:inline-block;box-shadow:inset 0 0 0 3px #c98f06"></span><span id="coins">0</span>');
  top.appendChild(coin);
  wrapper.appendChild(top);

  const reticle = el('div', 'position:absolute;left:50%;top:46%;width:74px;height:74px;transform:translate(-50%,-50%);pointer-events:none;transition:filter .1s;');
  reticle.innerHTML = `<svg width="74" height="74" viewBox="0 0 74 74" fill="none" stroke="#7fe3ff" stroke-width="4" stroke-linecap="round">
    <path d="M6 20 V6 H20"/><path d="M54 6 H68 V20"/><path d="M68 54 V68 H54"/><path d="M20 68 H6 V54"/></svg>`;
  wrapper.appendChild(reticle);

  const beam = el('div', 'position:absolute;left:50%;bottom:96px;width:4px;height:220px;transform:translateX(-50%);background:linear-gradient(#7fe3ff88,#7fe3ff00);pointer-events:none;transition:filter .08s;');
  wrapper.appendChild(beam);
  const bottom = el('div', 'position:absolute;left:0;right:0;bottom:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:12px;padding-bottom:14px;');
  const coreWrap = el('div', 'display:flex;align-items:center;gap:12px;width:86%;');
  coreWrap.appendChild(el('div', 'color:#8fb0e0;font:800 18px system-ui;', 'CORE'));
  const coreTrack = el('div', 'flex:1;height:16px;border-radius:10px;background:#0c1a30;border:2px solid #26385c;overflow:hidden;');
  const coreFill = el('div', 'height:100%;width:0%;border-radius:8px;background:linear-gradient(90deg,#ffb020,#ffe07a);transition:width .2s;');
  coreTrack.appendChild(coreFill); coreWrap.appendChild(coreTrack);
  const coreMul = el('div', 'color:#ffd77a;font:800 18px system-ui;', 'x0'); coreWrap.appendChild(coreMul);
  bottom.appendChild(coreWrap);
  const nextRow = el('div', 'display:flex;align-items:center;gap:10px;');
  nextRow.appendChild(el('div', 'color:#8fb0e0;font:800 16px system-ui;letter-spacing:1px;', 'NEXT'));
  const nextDots = el('div', 'display:flex;gap:10px;'); nextRow.appendChild(nextDots);
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

  // ── 旋转（拖拽·手型光标）+ 待机自转计时 ──
  wrapper.style.cursor = 'grab';
  let dragging = false, lastX = 0, lastY = 0, lastInteract = performance.now();
  const pivotT = (): Transform3D | undefined => engine.world.getComponent<Transform3D>('cube-pivot', 'Transform3D');
  const touch = (): void => { lastInteract = performance.now(); };
  const onDown = (e: PointerEvent): void => { dragging = true; lastX = e.clientX; lastY = e.clientY; touch(); wrapper.style.cursor = 'grabbing'; wrapper.setPointerCapture?.(e.pointerId); };
  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const t = pivotT(); if (!t) return;
    t.rotY = (t.rotY ?? 0) + (e.clientX - lastX) * 0.011;
    t.rotX = Math.max(-1.6, Math.min(1.6, (t.rotX ?? 0) + (e.clientY - lastY) * 0.011));
    lastX = e.clientX; lastY = e.clientY; touch();
    renderer.invalidate?.();
  };
  const onUp = (e: PointerEvent): void => { dragging = false; touch(); wrapper.style.cursor = 'grab'; wrapper.releasePointerCapture?.(e.pointerId); };
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
  // 显露一格（打掉外层后·其后一格暴露→加实体·流入下一层）。
  const reveal = (i: number, j: number, k: number): void => {
    const id = vid(i, j, k);
    if (rendered.has(id) || !present.has(id) || !exposed(i, j, k)) return;
    engine.world.addComponent(id, { type: 'Transform3D', x: idx2pos(i), y: idx2pos(j), z: idx2pos(k) } as unknown as Transform3D);
    engine.world.addComponent(id, { type: 'Mesh3D', ...voxMesh(PALETTE[colorAt.get(id)!].tint) } as never);
    const piv = engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D');
    piv?.children.push(id);
    rendered.add(id);
  };
  const breakVox = (i: number, j: number, k: number): void => {
    const id = vid(i, j, k);
    present.delete(id);
    if (rendered.has(id)) {
      engine.world.destroyEntity(id);
      const piv = engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D');
      if (piv) { const x = piv.children.indexOf(id); if (x >= 0) piv.children.splice(x, 1); }
      rendered.delete(id);
    }
    remaining--;
    // 邻格若因此暴露 → 显露（流入下一层）。
    ([[i+1,j,k],[i-1,j,k],[i,j+1,k],[i,j-1,k],[i,j,k+1],[i,j,k-1]] as [number,number,number][])
      .forEach(([a, b, c]) => { if (inB(a) && inB(b) && inB(c)) reveal(a, b, c); });
  };
  // 前面中心列最外现存格（准星点瞄·吸附前用几何中心列）。
  const aimVox = (s: number): [number, number, number] | null => {
    const S = SIDES[s];
    const c0 = Math.round((N - 1) / 2);
    for (let d = 0; d < N; d++) {
      const co = [0, 0, 0];
      co[S.axis] = S.val === N - 1 ? N - 1 - d : d;
      co[S.ua] = c0; co[S.ub] = c0;
      if (present.has(vid(co[0], co[1], co[2]))) return [co[0], co[1], co[2]];
    }
    return null;
  };

  const flashReticle = (ok: boolean): void => {
    reticle.style.filter = ok ? 'drop-shadow(0 0 8px #8affa0)' : 'drop-shadow(0 0 8px #ff6a6a)';
    setTimeout(() => { reticle.style.filter = ''; }, 120);
    beam.style.filter = 'brightness(2.2)';
    setTimeout(() => { beam.style.filter = ''; }, 80);
  };
  const finish = (): void => {
    over = remaining === 0 ? 'win' : 'lose';
    banner.textContent = over === 'win' ? '🎉 全清！' : '弹尽 · 未清空';
    banner.style.color = over === 'win' ? '#8affa0' : '#ff8a8a';
  };

  // ── 物理（cannon-es·渲染侧·world-space·不入 pivot）──
  const phys = new Set<string>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number): void => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
  let spawnN = 0;
  const addBody = (id: string, x: number, y: number, z: number, size: number, tint: number, rb: Record<string, unknown>): void => {
    engine.world.addComponent(id, { type: 'Transform3D', x, y, z } as unknown as Transform3D);
    engine.world.addComponent(id, { type: 'Mesh3D', shape: 'box', width: size, height: size, depth: size, frontTint: tint, backTint: tint, edgeTint: shade(tint, 0.82) } as never);
    engine.world.addComponent(id, { type: 'RigidBody3D', shape: 'box', ...rb } as never);
    phys.add(id);
  };
  const kill = (id: string): void => { if (phys.has(id)) { engine.world.destroyEntity(id); phys.delete(id); } };
  const rnd = (a: number, b: number): number => a + hash3(spawnN++, hits, remaining) * (b - a); // 确定性伪随机（无 Math.random）
  // 立方局部格 → 当前世界位（叠 pivot 旋转）。
  const voxWorld = (i: number, j: number, k: number): [number, number, number] => {
    const t = pivotT();
    return rotVec(idx2pos(i), idx2pos(j), idx2pos(k), t?.rotX ?? 0, t?.rotY ?? 0);
  };
  // 从炮口朝目标发射一枚物理子弹立方（初速指向目标·mode velocity 近似）。
  const fireBullet = (tint: number, tx: number, ty: number, tz: number): string => {
    const id = `blt-${spawnN}`;
    const dx = tx - MUZZLE.x, dy = ty - MUZZLE.y, dz = tz - MUZZLE.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    const sp = d / (FLIGHT_MS / 1000);
    addBody(id, MUZZLE.x, MUZZLE.y, MUZZLE.z, BULLET, tint, { mass: 1.2, restitution: 0.45, friction: 0.5, vx: dx / d * sp, vy: dy / d * sp, vz: dz / d * sp });
    return id;
  };
  // 碎裂：目标格位炸出一簇小物理立方（迸溅→落台）。
  const shatter = (wx: number, wy: number, wz: number, tint: number): void => {
    for (let n = 0; n < 6; n++) {
      const id = `deb-${spawnN}`;
      addBody(id, wx + rnd(-6, 6), wy + rnd(-6, 6), wz + rnd(-6, 6), BULLET * 0.6, tint,
        { mass: 0.4, restitution: 0.35, friction: 0.6, vx: rnd(-120, 120), vy: rnd(40, 150), vz: rnd(-120, 120), avx: rnd(-6, 6), avy: rnd(-6, 6), avz: rnd(-6, 6) });
      const did = id; later(() => kill(did), DEBRIS_MS);
    }
  };

  const onBeat = (): void => {
    if (over) return;
    const c = cannons[activeIdx];
    if (!c) { finish(); return; }
    const s = frontSide();
    const aim = aimVox(s);
    const sameColor = !!aim && colorAt.get(vid(aim[0], aim[1], aim[2])) === c.color;
    const wtar = aim ? voxWorld(aim[0], aim[1], aim[2]) : [0, 0, 0] as [number, number, number];
    const bulletTint = PALETTE[c.color].tint;
    const bid = fireBullet(bulletTint, wtar[0], wtar[1], wtar[2]);
    if (sameColor && aim) {
      // 同色：飞抵瞬间打破该格 + 碎裂迸溅落台·子弹消失。
      const a = aim;
      later(() => {
        const wp = voxWorld(a[0], a[1], a[2]);
        breakVox(a[0], a[1], a[2]);
        shatter(wp[0], wp[1], wp[2], bulletTint);
        kill(bid);
        renderer.invalidate?.();
      }, FLIGHT_MS);
      hits++;
    } else if (aim) {
      // 异色：飞抵瞬间反弹（横向+下压冲量→弹开落台）·不破。
      later(() => {
        engine.world.addComponent(bid, { type: 'Impulse3D', trigger: 1, mode: 'velocity', x: rnd(-160, 160), y: 90, z: 180 } as never);
        later(() => kill(bid), DEBRIS_MS);
      }, FLIGHT_MS);
    } else {
      later(() => kill(bid), DEBRIS_MS);
    }
    c.ammo -= 1;
    flashReticle(sameColor);
    if (remaining === 0) { finish(); refreshChrome(); return; }
    if (c.ammo <= 0) { activeIdx++; if (activeIdx >= cannons.length) finish(); }
    refreshChrome();
    renderer.invalidate?.();
  };

  let acc = 0, last = performance.now();
  const unsub = engine.subscribe(() => {
    const now = performance.now();
    const dt = now - last; last = now;
    // 待机自转（不操作·不结束时）。
    if (IDLE_SPIN > 0 && !dragging && !over && now - lastInteract > IDLE_DELAY) {
      const t = pivotT(); if (t) { t.rotY = (t.rotY ?? 0) + IDLE_SPIN * dt / 1000; renderer.invalidate?.(); }
    }
    acc += dt; if (acc > 2000) acc = BEAT_MS;
    while (acc >= BEAT_MS) { acc -= BEAT_MS; onBeat(); }
  });
  engine.start();

  return () => {
    unsub();
    engine.stop();
    timers.forEach(clearTimeout);
    wrapper.removeEventListener('pointerdown', onDown);
    wrapper.removeEventListener('pointermove', onMove);
    wrapper.removeEventListener('pointerup', onUp);
    wrapper.removeEventListener('pointercancel', onUp);
    renderer.destroy();
    outer.remove();
  };
}
