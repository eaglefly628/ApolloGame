// Game 102 · 3D 体素立方 —— **核心场景手感原型（throwaway·render-only·丢弃版）**。
//
// ⚠ 验证「好不好玩」+ 复刻概念图场景的一次性原型（不是数据驱动正式游戏）：旋转 + 命中判定跑在 mount 宿主胶水里
// （game-z「拖拽转视角」输入胶水先例的同类·render-only·不进 sim/hash）。HUD 暂 DOM 叠层（正式版 = PUI）。
// 证明好玩后再把「可旋转立方 + 射线命中 + 逐层剥 + 吸附」sink 成引擎能力做纯数据版。
//
// ★ 几何：立方 = 真 N×N×N 实心体素点阵（棱恒对齐）；只渲**当前暴露层**（打掉一格→其后一格暴露→显出=流入下一层）。
// ★ 开火：底部炮台按拍朝屏心准星射子弹 → 命中前面中心列最外现存格：**同色打破**（露下一层）/ **异色反弹**（不破·空放）。
// ★ 待机自转：不操作时立方缓缓自转（松手 IDLE_DELAY 后启动·操作时停·不飘不坑）。
// ⚠ 真物理（子弹立方/碎裂迸溅/落台）暂撤——首版实现里 cannon-es physics.sync 抛错会连带冻结整个渲染循环（连拖拽都停）；
//   物理留作单独一步、验证过再接回（见文末 TODO）。本版先保证「能转·能打·逐层剥」稳。
import { Engine } from '../../runtime/engine.js';
import { QueuedInputSource } from '@net/index.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { Transform3D, Pivot3D, Mesh3D } from '@engine/protocol/components.js';

// ── 配置（手感旋钮）──────────────────────────────────────────────────────────────────────────
const N = 7;              // 立方边长（N×N×N·奇数→有真面心格·准星更好对）——owner 试 7(343)
const PITCH = 22;         // （相机按 N*PITCH 自适配·改 PITCH 不变屏占·单格变大靠减 N）
const VOX = 22;           // = PITCH：体素相接·无缝→剥层露内层彩格·不再透黑（去掉暗内核块）
const MAXC = ((N - 1) / 2) * PITCH;
const BEAT_MS = 380;
const TIME_LIMIT = 75;    // 计时（秒）·时间到按破坏度评分
const PASS = 0.55;        // 过关破坏度阈值
const IDLE_SPIN = 0.22;   // 待机自转 rad/秒（0=关）
const IDLE_DELAY = 1400;  // 松手后 ms 无操作才启动待机自转
const CAM_DIST = N * PITCH * 3.9; // 相机距离（越大立方越小·owner「缩 20% 留白给以后 3D 轨道」）
const TRAVEL_MS = 600;   // 子弹飞行时长（配「同时只一发」→ 一发一破·反馈清晰）
const FRAG_N = 7;        // 碎裂片数
const GRAV = 900;        // 碎片重力（世界单位/秒²·自管运动积分·非 cannon-es·零冻结风险）
const MUZZLE_W = { x: 0, y: -MAXC * 1.5, z: MAXC * 3.0 }; // 炮口在**立方前方**(相机侧·z 大)偏下→子弹从外侧接近暴露面·不穿透立方；x=0 仍与底部炮台水平对齐
// 金色镂空棱框（12 根细金条·包住瞄中格·与格本色完全独立·作 pivot 子随立方转）。
const GOLD = 0xffd24a;
const FH = VOX / 2 + 2.5, FT = 3, FL = VOX + 6; // 半边/条粗/条长
const FRAME_OFF: [number, number, number, number, number, number][] = (() => {
  const o: [number, number, number, number, number, number][] = [];
  for (const sy of [-FH, FH]) for (const sz of [-FH, FH]) o.push([0, sy, sz, FL, FT, FT]);   // 4 根沿 X
  for (const sx of [-FH, FH]) for (const sz of [-FH, FH]) o.push([sx, 0, sz, FT, FL, FT]);   // 4 根沿 Y
  for (const sx of [-FH, FH]) for (const sy of [-FH, FH]) o.push([sx, sy, 0, FT, FT, FL]);   // 4 根沿 Z
  return o;
})();
const PALETTE = [        // 4 色（owner「多了眼花」）
  { name: '红', tint: 0xe0433f, css: '#e0433f' },
  { name: '黄', tint: 0xf2c21e, css: '#f2c21e' },
  { name: '绿', tint: 0x5cb544, css: '#5cb544' },
  { name: '蓝', tint: 0x2e6cf6, css: '#2e6cf6' },
];

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
function lighten(tint: number, k: number): number { // 向白混（高亮瞄中格）
  const r = (tint >> 16) & 0xff, g = (tint >> 8) & 0xff, b = tint & 0xff;
  return ((Math.round(r + (255 - r) * k)) << 16) | ((Math.round(g + (255 - g) * k)) << 8) | Math.round(b + (255 - b) * k);
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

  let activeColor = 0;              // 玩家当前选中的炮色（可切换·无限弹）
  let timeLeft = TIME_LIMIT;        // 剩余秒（时间到按破坏度评分）
  let targetVox: [number, number, number] | null = null; // 准星射线命中的那一格（精确瞄准）
  const colorRemain = count.slice(); // 每色剩余格数（换色器上显示·破一格减一）
  let remaining = present.size;
  const total = present.size;
  let over: 'win' | 'lose' | null = null;

  const rendered = new Set<string>();
  const buildScene = (): WorldBlueprint => {
    const entities: Record<string, EntityBlueprint> = {};
    const ids: string[] = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
      if (!exposed(i, j, k)) continue;
      const id = vid(i, j, k);
      entities[id] = { Transform3D: { x: idx2pos(i), y: idx2pos(j), z: idx2pos(k) }, Mesh3D: voxMesh(PALETTE[colorAt.get(id)!].tint) as EntityBlueprint['Mesh3D'], Pickable3D: { signal: 'hit' } as EntityBlueprint['Pickable3D'] };
      ids.push(id); rendered.add(id);
    }
    // 金色镂空棱框（12 细金条·作 pivot 子随立方转·初始移出屏外·updateAim 每帧移到瞄中格）。
    FRAME_OFF.forEach((o, n) => {
      const id = `frame-${n}`;
      entities[id] = { Transform3D: { x: 0, y: 1e6, z: 0 }, Mesh3D: { shape: 'box', width: o[3], height: o[4], depth: o[5], frontTint: GOLD, backTint: GOLD, edgeTint: GOLD } as EntityBlueprint['Mesh3D'] };
      ids.push(id);
    });
    // （去掉暗内核块：体素已相接·无透视缝；剥层露的是内层彩格·不再是黑）
    entities['cube-pivot'] = { Transform3D: { x: 0, y: 0, z: 0, rotX: -0.35, rotY: 0.5 }, Pivot3D: { children: ids, centerX: 0, centerY: 0, centerZ: 0 } };
    entities['cam'] = { Transform3D: { x: 0, y: 0, z: 0 }, Camera3D: { yaw: 0, pitch: 0.18, distance: CAM_DIST, pivotX: 0, pivotY: 0, pivotZ: 0, projection: 'perspective', fov: 40 } };
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
  const timePill = el('div', 'padding:10px 30px;border-radius:24px;background:linear-gradient(#3a7bd5,#2a5cae);box-shadow:0 4px 0 #1c3e7a,0 6px 12px #0007;color:#fff;font:800 22px system-ui;', '⏱ 1:15');
  top.appendChild(timePill);
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
  // 颜色切换器（点色块 → 换当前炮色·手型点击不触发立方拖拽）。
  const pickerRow = el('div', 'display:flex;align-items:center;gap:10px;pointer-events:auto;');
  const swatches: HTMLElement[] = [];
  PALETTE.forEach((p, i) => {
    const sw = el('div', `width:54px;height:54px;border-radius:12px;background:${p.css};box-shadow:0 2px 6px #0007;cursor:pointer;border:3px solid transparent;transition:transform .1s,border-color .1s;display:flex;align-items:center;justify-content:center;color:#fff;font:800 17px system-ui;text-shadow:0 1px 3px #000b;`);
    sw.addEventListener('pointerdown', (e) => { e.stopPropagation(); activeColor = i; refreshChrome(); pushLog(`switch color=${i}`); });
    swatches.push(sw); pickerRow.appendChild(sw);
  });
  bottom.appendChild(pickerRow);
  const cannon = el('div', 'width:70px;height:56px;border-radius:12px 12px 8px 8px;background:#5cb544;box-shadow:0 0 26px 6px #5cb54488,0 5px 0 #3c8a2c;display:flex;align-items:center;justify-content:center;color:#fff;font:800 24px system-ui;text-shadow:0 1px 3px #0009;');
  bottom.appendChild(cannon);
  wrapper.appendChild(bottom);
  const banner = el('div', 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:900 46px system-ui;color:#fff;text-shadow:0 3px 14px #000;pointer-events:none;');
  wrapper.appendChild(banner);

  let hits = 0;
  const fmtTime = (sec: number): string => { const s = Math.max(0, Math.ceil(sec)); return `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const refreshChrome = (): void => {
    const css = PALETTE[activeColor].css;
    cannon.style.background = css;
    cannon.style.boxShadow = `0 0 26px 6px ${css}88,0 5px 0 #0006`;
    beam.style.background = `linear-gradient(${css}88,${css}00)`;
    swatches.forEach((sw, i) => { sw.style.borderColor = i === activeColor ? '#fff' : 'transparent'; sw.style.transform = i === activeColor ? 'scale(1.16)' : 'scale(1)'; sw.textContent = String(colorRemain[i]); });
    const pct = Math.round(((total - remaining) / total) * 100);
    coreFill.style.width = `${pct}%`;
    coreMul.textContent = `${pct}% / ${Math.round(PASS * 100)}%`;
    (coin.querySelector('#coins') as HTMLElement).textContent = String(total - remaining);
    timePill.textContent = fmtTime(timeLeft);
  };
  refreshChrome();

  // ── 调试窗口（owner 要求：日志 + 错误上屏·可复制贴回）──────────────────────────────────────
  const logs: string[] = [];
  // 默认开·置于上部（不挡底部换色器）·可用 🐞 收起。
  const logPanel = el('div', 'position:absolute;left:8px;right:8px;top:120px;height:30%;background:#000e;border:1px solid #2b3d5c;border-radius:8px;display:flex;flex-direction:column;z-index:50;font:11px/1.4 monospace;color:#cfe;');
  const logHead = el('div', 'display:flex;gap:6px;align-items:center;padding:5px 8px;border-bottom:1px solid #2b3d5c;');
  logHead.appendChild(el('div', 'flex:1;color:#8fb0e0;font-weight:700;', '🐞 DEBUG'));
  const btnCopy = el('button', 'pointer-events:auto;background:#1a2740;color:#cfe;border:1px solid #35507a;border-radius:5px;padding:2px 8px;cursor:pointer;', '复制');
  const btnClear = el('button', 'pointer-events:auto;background:#1a2740;color:#cfe;border:1px solid #35507a;border-radius:5px;padding:2px 8px;cursor:pointer;', '清空');
  logHead.appendChild(btnCopy); logHead.appendChild(btnClear);
  const logPre = el('pre', 'flex:1;margin:0;padding:6px 8px;overflow:auto;white-space:pre-wrap;user-select:text;-webkit-user-select:text;');
  logPanel.appendChild(logHead); logPanel.appendChild(logPre);
  wrapper.appendChild(logPanel);
  const btnBug = el('button', 'position:absolute;right:8px;top:78px;z-index:51;pointer-events:auto;background:#1a2740ee;color:#cfe;border:1px solid #35507a;border-radius:8px;padding:6px 12px;cursor:pointer;font:700 13px monospace;box-shadow:0 2px 8px #0007;', '🐞 LOG');
  wrapper.appendChild(btnBug);
  let logDirty = false;
  const t0 = performance.now();
  const pushLog = (line: string, err = false): void => {
    logs.push(`[${((performance.now() - t0) / 1000).toFixed(1)}s] ` + (err ? '❌ ' : '') + line);
    if (logs.length > 400) logs.shift();
    logDirty = true;
    if (err && logPanel.style.display === 'none') { logPanel.style.display = 'flex'; }
  };
  const renderLog = (): void => { if (!logDirty) return; logDirty = false; logPre.textContent = logs.join('\n'); logPre.scrollTop = logPre.scrollHeight; };
  // 调试控件的 pointerdown 拦截·不触发立方拖拽。
  [btnBug, btnCopy, btnClear, logPanel].forEach((b) => b.addEventListener('pointerdown', (e) => e.stopPropagation()));
  btnBug.onclick = () => { logPanel.style.display = logPanel.style.display === 'none' ? 'flex' : 'none'; logDirty = true; renderLog(); };
  btnClear.onclick = () => { logs.length = 0; logDirty = true; renderLog(); };
  btnCopy.onclick = () => {
    const all = logs.join('\n');                          // 复制**全部**日志（不受滚动/选区限制）
    const done = (): void => { btnCopy.textContent = '已复制✓'; setTimeout(() => (btnCopy.textContent = '复制'), 1200); };
    if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(all).then(done).catch(() => { logPre.textContent = all; const r = document.createRange(); r.selectNodeContents(logPre); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r); try { document.execCommand('copy'); done(); } catch { /* 手动选 */ } }); }
    else { const r = document.createRange(); r.selectNodeContents(logPre); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r); try { document.execCommand('copy'); done(); } catch { /* */ } }
  };
  const onWinErr = (e: ErrorEvent): void => pushLog(`WINERR ${e.message} @${(e.filename || '').split('/').pop()}:${e.lineno}\n${e.error?.stack?.split('\n').slice(0, 4).join('\n') ?? ''}`, true);
  const onRej = (e: PromiseRejectionEvent): void => pushLog(`REJECT ${String(e.reason?.message ?? e.reason)}\n${e.reason?.stack?.split('\n').slice(0, 4).join('\n') ?? ''}`, true);
  window.addEventListener('error', onWinErr);
  window.addEventListener('unhandledrejection', onRej);
  pushLog(`start · cube ${N}³ · voxels=${total} · 各色=${count.join('/')} · time=${TIME_LIMIT}s pass=${Math.round(PASS * 100)}%`);

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
  const reveal = (i: number, j: number, k: number): void => {
    const id = vid(i, j, k);
    if (rendered.has(id) || !present.has(id) || !exposed(i, j, k)) return;
    try { engine.world.createEntity(id); } catch { /* 已存在 → 忽略 */ } // ★ addComponent 对不存在实体会抛错·先建实体（首版冻结根因）
    engine.world.addComponent(id, { type: 'Transform3D', x: idx2pos(i), y: idx2pos(j), z: idx2pos(k) } as unknown as Transform3D);
    engine.world.addComponent(id, { type: 'Mesh3D', ...voxMesh(PALETTE[colorAt.get(id)!].tint) } as never);
    engine.world.addComponent(id, { type: 'Pickable3D', signal: 'hit' } as never);
    const piv = engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D');
    piv?.children.push(id);
    rendered.add(id);
  };
  const breakVox = (i: number, j: number, k: number): void => {
    const id = vid(i, j, k);
    const cc = colorAt.get(id); if (cc != null) colorRemain[cc]--; // 该色剩余 -1（换色器数字）
    present.delete(id);
    if (rendered.has(id)) {
      engine.world.destroyEntity(id);
      const piv = engine.world.getComponent<Pivot3D>('cube-pivot', 'Pivot3D');
      if (piv) { const x = piv.children.indexOf(id); if (x >= 0) piv.children.splice(x, 1); }
      rendered.delete(id);
    }
    remaining--;
    ([[i+1,j,k],[i-1,j,k],[i,j+1,k],[i,j-1,k],[i,j,k+1],[i,j,k-1]] as [number,number,number][])
      .forEach(([a, b, c]) => { if (inB(a) && inB(b) && inB(c)) reveal(a, b, c); });
  };
  // 某面 (a,b) 列**最外层现存格**（该面此刻可见的那一格·随剥层变深）。
  const faceVisible = (s: number, a: number, b: number): [number, number, number] | null => {
    const S = SIDES[s];
    for (let d = 0; d < N; d++) {
      const co = [0, 0, 0];
      co[S.axis] = S.val === N - 1 ? N - 1 - d : d;
      co[S.ua] = a; co[S.ub] = b;
      if (present.has(vid(co[0], co[1], co[2]))) return [co[0], co[1], co[2]];
    }
    return null;
  };
  // 该面上「可见 + （若指定色则同色）」的格中·最靠面心者（demo：朝立方转向炮口那面自动锁同色·可靠出破碎）。
  const aimFace = (s: number, color: number | null): [number, number, number] | null => {
    const c0 = (N - 1) / 2;
    let best: [number, number, number] | null = null, bestR = Infinity;
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      const v = faceVisible(s, a, b);
      if (!v) continue;
      if (color !== null && colorAt.get(vid(v[0], v[1], v[2])) !== color) continue;
      const r = (a - c0) ** 2 + (b - c0) ** 2;
      if (r < bestR) { bestR = r; best = v; }
    }
    return best;
  };

  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number): void => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
  const flashReticle = (ok: boolean): void => {
    reticle.style.filter = ok ? 'drop-shadow(0 0 8px #8affa0)' : 'drop-shadow(0 0 8px #ff6a6a)';
    later(() => { reticle.style.filter = ''; }, 120);
    beam.style.filter = 'brightness(2.2)';
    later(() => { beam.style.filter = ''; }, 80);
  };
  let bounceN = 0;
  const bounceFx = (): void => {
    const dx = (hash3(bounceN++, remaining, activeColor) - 0.5) * 160;
    const dot = el('div', 'position:absolute;left:50%;top:46%;width:14px;height:14px;border-radius:50%;background:#ff7a6a;box-shadow:0 0 10px #ff6a6a;transform:translate(-50%,-50%);transition:transform .35s ease-out,opacity .35s;pointer-events:none;');
    wrapper.appendChild(dot);
    requestAnimationFrame(() => { dot.style.transform = `translate(calc(-50% + ${dx}px),-140px)`; dot.style.opacity = '0'; });
    later(() => dot.remove(), 400);
  };
  const finish = (win: boolean): void => {
    if (over) return;
    over = win ? 'win' : 'lose';
    const pct = Math.round(((total - remaining) / total) * 100);
    banner.innerHTML = `<div style="text-align:center;line-height:1.3">${win ? '🎉 过关！' : '⏱ 时间到'}<div style="font-size:26px;margin-top:10px;color:#eaf2ff">破坏度 ${pct}%${win ? '' : ` · 需 ${Math.round(PASS * 100)}%`}</div></div>`;
    banner.style.color = win ? '#8affa0' : '#ff8a8a';
  };

  // ── 自管运动体（子弹 + 碎片·3D 世界空间·非 pivot 子·非 cannon-es·每帧我自己积分·零冻结风险）──
  type Bullet = { kind: 'bullet'; id: string; t: number; from: [number, number, number]; to: [number, number, number]; aim: [number, number, number]; color: number; same: boolean };
  type Frag = { kind: 'frag'; id: string; p: [number, number, number]; v: [number, number, number]; life: number };
  const movers: (Bullet | Frag)[] = [];
  const movEnt = new Set<string>();
  let movN = 0;
  const spawnEnt = (id: string, x: number, y: number, z: number, size: number, tint: number): void => {
    try { engine.world.createEntity(id); } catch { /* 已存在 */ }
    engine.world.addComponent(id, { type: 'Transform3D', x, y, z } as unknown as Transform3D);
    engine.world.addComponent(id, { type: 'Mesh3D', shape: 'box', width: size, height: size, depth: size, frontTint: tint, backTint: tint, edgeTint: shade(tint, 0.8) } as never);
    movEnt.add(id);
  };
  const despawnEnt = (id: string): void => { if (movEnt.has(id)) { try { engine.world.destroyEntity(id); } catch { /* */ } movEnt.delete(id); } };
  const setPos = (id: string, x: number, y: number, z: number): void => { const t = engine.world.getComponent<Transform3D>(id, 'Transform3D'); if (t) { t.x = x; t.y = y; t.z = z; } };
  const voxWorld = (i: number, j: number, k: number): [number, number, number] => {
    const t = pivotT(); return rotVec(idx2pos(i), idx2pos(j), idx2pos(k), t?.rotX ?? 0, t?.rotY ?? 0);
  };
  const prand = (): number => hash3(movN++, remaining, hits); // 确定性伪随机（非 Math.random）
  const spawnFragments = (wx: number, wy: number, wz: number, tint: number): void => {
    const L = Math.hypot(wx, wy, wz) || 1;                    // 外向单位向量（立方居中原点→格位即朝外）
    const ox = wx / L, oy = wy / L, oz = wz / L;
    for (let n = 0; n < FRAG_N; n++) {
      const id = `frag-${movN}`;
      spawnEnt(id, wx, wy, wz, VOX * 0.62, tint);
      movers.push({ kind: 'frag', id, p: [wx, wy, wz],
        v: [ox * 260 + (prand() - 0.5) * 200, oy * 260 + 160 + prand() * 140, oz * 260 + (prand() - 0.5) * 200], // 朝外迸溅 + 上抛
        life: 1.6 });
    }
  };

  // 移动金色镂空棱框到瞄中格（局部坐标·随 pivot 转·null=移出屏外）。本色完全不动·真镂空框。
  const setFrame = (t: [number, number, number] | null): void => {
    const lx = t ? idx2pos(t[0]) : 0, ly = t ? idx2pos(t[1]) : 0, lz = t ? idx2pos(t[2]) : 0;
    for (let n = 0; n < FRAME_OFF.length; n++) {
      const tr = engine.world.getComponent<Transform3D>(`frame-${n}`, 'Transform3D');
      if (!tr) continue;
      if (t) { tr.x = lx + FRAME_OFF[n][0]; tr.y = ly + FRAME_OFF[n][1]; tr.z = lz + FRAME_OFF[n][2]; } else tr.y = 1e6;
    }
  };
  // 每帧：从准星（屏心偏上）投射线 → 命中最前体素 = 精确瞄点·金框套住。
  const updateAim = (): void => {
    const rect = wrapper.getBoundingClientRect();
    const hit = renderer.pick(rect.left + rect.width * 0.5, rect.top + rect.height * 0.46);
    if (hit && hit.entityId.startsWith('v-')) {
      const p = hit.entityId.split('-');
      targetVox = [Number(p[1]), Number(p[2]), Number(p[3])];
      setFrame(targetVox);
    } else { targetVox = null; setFrame(null); }
  };
  const onBeat = (): void => {
    if (over || !targetVox) return;
    if (movers.some((m) => m.kind === 'bullet')) return;      // 同时只一发在飞→一发一破·反馈清晰（去掉"要打几下"错觉）
    const [i, j, k] = targetVox;
    if (!present.has(vid(i, j, k))) return;
    const aimColor = colorAt.get(vid(i, j, k))!;
    const same = aimColor === activeColor;                    // 同色→破·异色→弹（玩家切色对准准星那格）
    const to = voxWorld(i, j, k);
    const id = `blt-${movN}`;
    spawnEnt(id, MUZZLE_W.x, MUZZLE_W.y, MUZZLE_W.z, VOX * 0.5, PALETTE[activeColor].tint);
    movers.push({ kind: 'bullet', id, t: 0, from: [MUZZLE_W.x, MUZZLE_W.y, MUZZLE_W.z], to, aim: [i, j, k], color: activeColor, same });
    pushLog(`fire aim=${i},${j},${k} aimC=${aimColor} active=${activeColor} → ${same ? '将破' : '将弹'} rem=${remaining}`);
  };
  // 子弹飞抵结算（同色破+碎裂·异色反弹）。
  const resolveBullet = (b: Bullet): void => {
    if (over) return;
    if (b.same && present.has(vid(b.aim[0], b.aim[1], b.aim[2]))) {
      const wp = voxWorld(b.aim[0], b.aim[1], b.aim[2]);
      breakVox(b.aim[0], b.aim[1], b.aim[2]); hits++;
      spawnFragments(wp[0], wp[1], wp[2], PALETTE[b.color].tint);
      flashReticle(true);
      if (remaining === 0) finish(true);
    } else {
      bounceFx(); flashReticle(false);
    }
    refreshChrome();
  };

  // ── 自管渲染循环（**全程 try/catch·任何一处抛错都只记日志·绝不冻结循环**）──────────────────
  // 教训：engine.start() 内 renderer.sync/notifyListeners 抛错早于 rAF 重排 → 整循环死。这里自己驱动、逐段兜底。
  let raf = 0, acc = 0, last = performance.now(), hb = performance.now(), frames = 0;
  const frame = (now: number): void => {
    try {
      const dt = now - last; last = now;
      frames++;
      if (now - hb > 2000) { pushLog(`❤ fps≈${Math.round(frames / ((now - hb) / 1000))} rendered=${rendered.size} rem=${remaining} tgt=${targetVox ? targetVox.join(',') : '∅'}`); hb = now; frames = 0; }
      updateAim(); // 准星射线求最前体素 → 高亮 + 记为瞄点
      if (IDLE_SPIN > 0 && !dragging && !over && now - lastInteract > IDLE_DELAY) {
        const t = pivotT(); if (t) t.rotY = (t.rotY ?? 0) + IDLE_SPIN * dt / 1000;
      }
      acc += dt; if (acc > 2000) acc = BEAT_MS;
      let guard = 0;
      while (acc >= BEAT_MS && guard++ < 8) { acc -= BEAT_MS; onBeat(); } // guard 防死循环暴发
      if (acc >= BEAT_MS) acc = 0;
      // 运动体积分（子弹匀速飞抵→结算·碎片抛物线落下→超时/落底回收）。
      const ds = Math.min(dt, 50) / 1000;
      for (let m = movers.length - 1; m >= 0; m--) {
        const mv = movers[m];
        if (mv.kind === 'bullet') {
          mv.t += dt;
          const f = Math.min(1, mv.t / TRAVEL_MS);
          setPos(mv.id, mv.from[0] + (mv.to[0] - mv.from[0]) * f, mv.from[1] + (mv.to[1] - mv.from[1]) * f, mv.from[2] + (mv.to[2] - mv.from[2]) * f);
          if (f >= 1) { despawnEnt(mv.id); movers.splice(m, 1); resolveBullet(mv); }
        } else {
          mv.v[1] -= GRAV * ds;
          mv.p[0] += mv.v[0] * ds; mv.p[1] += mv.v[1] * ds; mv.p[2] += mv.v[2] * ds;
          mv.life -= ds;
          setPos(mv.id, mv.p[0], mv.p[1], mv.p[2]);
          if (mv.life <= 0 || mv.p[1] < -MAXC * 4) { despawnEnt(mv.id); movers.splice(m, 1); }
        }
      }
      // 计时倒数（时间到→按破坏度评分）。
      if (!over) {
        timeLeft -= dt / 1000;
        timePill.textContent = fmtTime(timeLeft);
        if (timeLeft <= 0) { timeLeft = 0; finish(remaining === 0 || (total - remaining) / total >= PASS); }
      }
    } catch (e) { pushLog(`FRAME ${(e as Error).message}\n${(e as Error).stack?.split('\n').slice(0, 5).join('\n') ?? ''}`, true); }
    try { renderer.sync(engine.world); } catch (e) { pushLog(`RENDER ${(e as Error).message}\n${(e as Error).stack?.split('\n').slice(0, 5).join('\n') ?? ''}`, true); }
    renderLog();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    engine.stop();
    movers.forEach((mv) => despawnEnt(mv.id));
    timers.forEach(clearTimeout);
    window.removeEventListener('error', onWinErr);
    window.removeEventListener('unhandledrejection', onRej);
    wrapper.removeEventListener('pointerdown', onDown);
    wrapper.removeEventListener('pointermove', onMove);
    wrapper.removeEventListener('pointerup', onUp);
    wrapper.removeEventListener('pointercancel', onUp);
    renderer.destroy();
    outer.remove();
  };
}

// TODO(物理·单独一步)：子弹立方 + 同色碎裂迸溅 + 落台 + 异色反弹（cannon-es RigidBody3D/Impulse3D）。
//   首版失败教训：physics.sync 在 renderer.sync 内、抛错早于 rAF 重排 → 整循环冻结（连拖拽都停）。
//   接回前先：①单独最小场景验证一个物理体能落到平台不炸循环 ②给每帧 onBeat/物理调用包 try/catch 兜底不杀循环。
