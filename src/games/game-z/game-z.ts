// Game Z · 3D 盒庭（Captain Toad 风渲染线 v0）的挂载入口。
//
// 纯数据盒庭蓝图 → 引擎 Engine 装载 → ThreeRenderer 渲染（盒庭模式：Camera3D 轨道相机 + 柔和动态阴影 + 暖冷光 + 天空盒）。
// 盒庭本体走 render 组件（Mesh3D/Transform3D）+ 引擎渲染器（数据，非 UI 库）；HUD 走 LayoutNode（UI 铁律）。
// 角色走动 = 现成 velocity→motion-apply 能力（纯数据 sim）；键盘=运行时输入胶水（input-capture 言明捕获是运行时职责）。
// 玩法暂缓（owner 2026-06-27「先把玩法放一下·先长 3D 这条线」）。
import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer, type RenderStats } from '@renderer/three-renderer.js';
import { AssetManager, ModelAssetLoader } from '@assets/index.js';
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode } from '@ui/components/index.js';
import type { Velocity, Camera3D, Overlap3D, Post3D, Fog3D } from '@engine/protocol/components.js';
import { dioramaBlueprint } from './diorama.js';
import { GAME_Z_ASSETS } from './assets.js';

const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

const fmtK = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

// 角标 HUD（LayoutNode 纯数据）：标题 + 操作提示 + 可开关的性能剖析面板（像虚幻 stat·P 键开关）。
// 剖析数据来自 renderer.readStats()（引擎暴露）；HUD 本体是数据描述（UI 铁律）。pointer-events:none 不挡盒庭。
function hudTree(fps: number, stats: RenderStats | null, showProfiler: boolean, inZone: boolean): LayoutNode {
  const children: LayoutNode[] = [
    { type: 'Label', id: 'gz-title', props: { text: 'GAME Z', size: 'xxl', glow: true } },
    { type: 'Label', id: 'gz-sub', props: { text: '3D 盒庭 · 数据驱动渲染线 · glTF 模型导入', size: 'sm' } },
    { type: 'Label', id: 'gz-hint', props: { text: 'WASD 控鸭 · 拖拽旋转 · 滚轮缩放 · O 正交 · F 跟随 · P 剖析 · C 碰撞体 · N 寻路', size: 'sm' } },
    // 3D 碰撞触发区状态（读确定性 Overlap3D·纯展示）：小黄鸭进绿垫即亮。
    { type: 'Label', id: 'gz-zone', props: { text: inZone ? '🔔 触发区：进入（Overlap3D）' : '触发区：外', size: 'sm', glow: inZone, color: inZone ? undefined : 'dim' } },
  ];
  if (showProfiler && stats) {
    children.push(
      { type: 'Label', id: 'gz-p0', props: { text: '── PROFILE ──', size: 'sm', font: 'mono', glow: true } },
      { type: 'Label', id: 'gz-p1', props: { text: `fps ${fps}   cpu ${stats.cpuMs.toFixed(2)}ms`, size: 'sm', font: 'mono' } },
      { type: 'Label', id: 'gz-p2', props: { text: `draws ${stats.drawCalls}  tris ${fmtK(stats.triangles)}  ${stats.rendered ? 'DRAW' : 'SKIP'}`, size: 'sm', font: 'mono' } },
      { type: 'Label', id: 'gz-p3', props: { text: `batch ${stats.batches}  inst ${stats.instances}  mesh ${stats.fallbackMeshes}  mdl ${stats.models}`, size: 'sm', font: 'mono' } },
      { type: 'Label', id: 'gz-p4', props: { text: `geo ${stats.geometries}  tex ${stats.textures}  prog ${stats.programs}`, size: 'sm', font: 'mono' } },
    );
  }
  return { type: 'Panel', id: 'gz-hud', props: { bare: true }, layout: { x: 18, y: 14, gap: 4 }, children };
}

export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#0b1020;overflow:hidden';
  const stage = document.createElement('div');
  stage.style.cssText = 'position:relative;line-height:0';
  wrapper.appendChild(stage);
  container.appendChild(wrapper);

  const w = Math.max(320, Math.min(1100, wrapper.clientWidth || 900));
  const h = Math.max(240, Math.min(720, wrapper.clientHeight || 560));

  // 3D 模型资产：注册 glTF 清单 → 异步加载（就绪前渲染器跳过该实体，就绪后自动解析显示·向后兼容）。
  // 蓝图持 modelKey 保纯；ModelAssetLoader 取字节(ArrayBuffer)，ThreeRenderer 解析成 three 场景。
  const assets = new AssetManager(new ModelAssetLoader());
  assets.registerManifest(GAME_Z_ASSETS);
  void assets.loadAll();

  const engine = new Engine();
  engine.load(dioramaBlueprint());
  const renderer = new ThreeRenderer({ width: w, height: h, background: 0x0b1020, assets }); // fov 现由 Camera3D 数据驱动
  engine.attachRenderer(renderer, stage);

  // HUD 叠加层（LayoutNode 纯数据·UI 铁律）。
  const hudHost = document.createElement('div');
  hudHost.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  wrapper.appendChild(hudHost);
  let showProfiler = true; // 性能剖析面板开关（P 键切换·默认开）
  let fps = 60; // 平滑帧率（render-only·不进 sim）
  const cam = (): Camera3D | undefined => engine.world.getComponent<Camera3D>('cam', 'Camera3D'); // 取相机组件（行为层写它）
  // 读 3D 碰撞结果（确定性 Overlap3D·纯展示）：小黄鸭是否在触发区里。
  const inZone = (): boolean => engine.world.query('Overlap3D').some(([id]) => {
    const o = engine.world.getComponent<Overlap3D>(id, 'Overlap3D');
    return !!o && (o.entityA === 'zone' || o.entityB === 'zone');
  });
  const ui = mountUI(hudHost, hudTree(60, null, showProfiler, false));

  // 渲染调试面板（独立 pointer-events:auto 宿主·全 LayoutNode·UI 铁律）：开关 + 滑块**实时调渲染参数**——
  // 改的全是 render-only 组件（Post3D/Fog3D·不进 hash）→ 即时生效、无副作用。控件全走主程 UI 库（Toggle/Slider）。
  const menuHost = document.createElement('div');
  menuHost.style.cssText = 'position:absolute;left:14px;bottom:12px;pointer-events:auto;max-height:90%;overflow:auto;width:220px';
  wrapper.appendChild(menuHost);

  // 设置态（初值对齐蓝图 Post3D/Fog3D）。
  const S = { col: false, nav: false, aoOn: true, aoInt: 1.1, aoRad: 5, fogOn: true, fogNear: 190, fogFar: 520, gradeOn: true, exp: 1.02, con: 1.08, sat: 1.12, aa: true };
  const post = (): Post3D | undefined => engine.world.getComponent<Post3D>('post', 'Post3D');
  const fog = (): Fog3D | undefined => engine.world.getComponent<Fog3D>('fog', 'Fog3D');
  // 把设置写进 render-only 组件 + 渲染器（实时生效·不进 hash）。
  const apply = (): void => {
    renderer.setDebugColliders(S.col);
    renderer.setDebugNav(S.nav);
    const p = post();
    if (p) {
      p.ao = S.aoOn ? { intensity: S.aoInt, radius: S.aoRad, scale: 1 } : undefined;
      p.grade = S.gradeOn ? { exposure: S.exp, contrast: S.con, saturation: S.sat, brightness: 0, tint: 0xfff6ec } : undefined;
      p.aa = S.aa;
    }
    if (S.fogOn) {
      const f = fog();
      if (f) { f.near = S.fogNear; f.far = S.fogFar; }
      else engine.world.addComponent('fog', { type: 'Fog3D', color: 0xcfe9f7, near: S.fogNear, far: S.fogFar } as Fog3D);
    } else if (fog()) engine.world.removeComponent('fog', 'Fog3D');
    renderer.invalidate();
  };
  const tog = (id: string, label: string, on: boolean, action: string): LayoutNode => ({ type: 'Toggle', id, props: { label, checked: on, action } });
  const sld = (id: string, label: string, value: number, min: number, max: number, step: number, action: string): LayoutNode => ({ type: 'Slider', id, props: { label, value, min, max, step, action } });
  const tree = (): LayoutNode => ({
    type: 'Panel', id: 'gz-set', props: { bare: true }, layout: { gap: 3 },
    children: [
      { type: 'Label', id: 'gz-set-t', props: { text: '⚙ 渲染调试', size: 'sm', glow: true } },
      tog('gz-col', '碰撞体线框', S.col, 'tCol'),
      tog('gz-nav', '导航网格', S.nav, 'tNav'),
      tog('gz-ao', 'AO 遮蔽', S.aoOn, 'tAo'),
      ...(S.aoOn ? [sld('gz-aoi', 'AO 强度', S.aoInt, 0, 3, 0.05, 'sAoI'), sld('gz-aor', 'AO 半径', S.aoRad, 1, 16, 0.5, 'sAoR')] : []),
      tog('gz-fog', '距离雾', S.fogOn, 'tFog'),
      ...(S.fogOn ? [sld('gz-fn', '雾 near', S.fogNear, 40, 400, 5, 'sFn'), sld('gz-ff', '雾 far', S.fogFar, 200, 800, 10, 'sFf')] : []),
      tog('gz-gr', '色彩分级', S.gradeOn, 'tGr'),
      ...(S.gradeOn ? [sld('gz-ex', '曝光', S.exp, 0.5, 1.6, 0.02, 'sEx'), sld('gz-co', '对比', S.con, 0.5, 1.6, 0.02, 'sCo'), sld('gz-sa', '饱和', S.sat, 0, 2, 0.02, 'sSa')] : []),
      tog('gz-aa', '抗锯齿 SMAA', S.aa, 'tAa'),
    ],
  });
  // 开关 → 改态 + 应用 + 重渲面板（更新勾选 + 显隐从属滑块）。滑块 → 改态 + 应用（**不重渲面板**·免打断拖拽）。
  const refresh = (): void => menuUi.update(tree());
  const tT = (k: 'col' | 'nav' | 'aoOn' | 'fogOn' | 'gradeOn' | 'aa') => (v: unknown): void => { S[k] = v === 'true' || v === true; apply(); refresh(); };
  const sS = (k: 'aoInt' | 'aoRad' | 'fogNear' | 'fogFar' | 'exp' | 'con' | 'sat') => (v: unknown): void => { S[k] = Number(v); apply(); };
  const menuUi = mountUI(menuHost, tree(), {
    tCol: tT('col'), tNav: tT('nav'), tAo: tT('aoOn'), tFog: tT('fogOn'), tGr: tT('gradeOn'), tAa: tT('aa'),
    sAoI: sS('aoInt'), sAoR: sS('aoRad'), sFn: sS('fogNear'), sFf: sS('fogFar'), sEx: sS('exp'), sCo: sS('con'), sSa: sS('sat'),
  });
  const setColliders = (on: boolean): void => { S.col = on; apply(); refresh(); };
  const setNav = (on: boolean): void => { S.nav = on; apply(); refresh(); };

  // 键盘 → 角色 Velocity（运行时输入胶水）：归一化对角线 + 速度；motion-apply 每 tick 把它累加进 Transform。
  const held = new Set<string>();
  const SPEED = 0.5;
  const setVel = (): void => {
    const v = engine.world.getComponent<Velocity>('hero', 'Velocity');
    if (!v) return;
    const dx = (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0);
    const dy = (held.has('ArrowDown') || held.has('KeyS') ? 1 : 0) - (held.has('ArrowUp') || held.has('KeyW') ? 1 : 0);
    const len = Math.hypot(dx, dy) || 1;
    v.vx = (dx / len) * SPEED;
    v.vy = (dy / len) * SPEED;
  };
  const onDown = (e: KeyboardEvent): void => {
    if (MOVE_KEYS.has(e.code)) e.preventDefault();
    if (e.code === 'KeyP') { showProfiler = !showProfiler; ui.update(hudTree(Math.round(fps), renderer.readStats(), showProfiler, inZone())); }
    // 相机数据驱动开关（行为层只写 Camera3D 数据·渲染器解释）：O 切正交/透视、F 切跟随小黄鸭/环绕。
    if (e.code === 'KeyO') { const c = cam(); if (c) c.projection = c.projection === 'ortho' ? 'perspective' : 'ortho'; }
    if (e.code === 'KeyF') { const c = cam(); if (c) { c.mode = c.mode === 'follow' ? 'orbit' : 'follow'; c.target = 'hero'; } }
    if (e.code === 'KeyC') setColliders(!S.col); // 碰撞体线框开关（同调试面板）
    if (e.code === 'KeyN') setNav(!S.nav); // 导航网格开关（同调试面板）
    held.add(e.code); setVel();
  };
  const onUp = (e: KeyboardEvent): void => { held.delete(e.code); setVel(); };
  const onBlur = (): void => { held.clear(); setVel(); };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);

  // 旋转交互（运行时输入胶水·同键盘先例）：拖拽 → 转 Camera3D yaw/pitch；滚轮 → 拉近/远 distance。
  // Camera3D 是 render-only（不进 hash），运行时改它纯表现安全。pitch 夹在俯视区间、distance 夹在合理范围。
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const onPointerDown = (e: PointerEvent): void => { dragging = true; lastX = e.clientX; lastY = e.clientY; stage.setPointerCapture?.(e.pointerId); };
  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const c = cam();
    if (!c) return;
    c.yaw += (e.clientX - lastX) * 0.008; // 水平拖 → 绕 Y 环绕
    // 垂直拖 → 俯仰；夹角读 Camera3D 数据（pitchMin/Max·不再硬编码·解释器也会按此夹）。
    const p = c.pitch + (e.clientY - lastY) * 0.006;
    c.pitch = Math.max(c.pitchMin ?? 0.05, Math.min(c.pitchMax ?? 1.5, p));
    lastX = e.clientX; lastY = e.clientY;
  };
  const onPointerUp = (e: PointerEvent): void => { dragging = false; stage.releasePointerCapture?.(e.pointerId); };
  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const c = cam();
    if (!c) return;
    c.distance = Math.max(40, Math.min(200, (c.distance ?? 92) + e.deltaY * 0.08)); // 滚轮缩放
  };
  stage.style.touchAction = 'none';
  stage.style.cursor = 'grab';
  stage.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('wheel', onWheel, { passive: false });

  // 帧率：每帧测壁钟差 → 平滑 fps，~4 次/秒刷 HUD（含 profiler·读 renderer.readStats）。
  let lastT = performance.now();
  let lastHud = 0;
  const unsub = engine.subscribe(() => {
    const now = performance.now();
    const dt = now - lastT;
    lastT = now;
    if (dt > 0) fps = fps * 0.9 + (1000 / dt) * 0.1;
    if (now - lastHud > 250) { lastHud = now; ui.update(hudTree(Math.round(fps), renderer.readStats(), showProfiler, inZone())); }
  });

  engine.start();

  return () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
    window.removeEventListener('blur', onBlur);
    stage.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    stage.removeEventListener('wheel', onWheel);
    unsub();
    engine.stop();
    renderer.destroy();
    ui();
    menuUi();
    wrapper.remove();
  };
}
