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
import type { Velocity, Camera3D } from '@engine/protocol/components.js';
import { dioramaBlueprint } from './diorama.js';
import { GAME_Z_ASSETS } from './assets.js';

const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

const fmtK = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

// 角标 HUD（LayoutNode 纯数据）：标题 + 操作提示 + 可开关的性能剖析面板（像虚幻 stat·P 键开关）。
// 剖析数据来自 renderer.readStats()（引擎暴露）；HUD 本体是数据描述（UI 铁律）。pointer-events:none 不挡盒庭。
function hudTree(fps: number, stats: RenderStats | null, showProfiler: boolean): LayoutNode {
  const children: LayoutNode[] = [
    { type: 'Label', id: 'gz-title', props: { text: 'GAME Z', size: 'xxl', glow: true } },
    { type: 'Label', id: 'gz-sub', props: { text: '3D 盒庭 · 数据驱动渲染线 · glTF 模型导入', size: 'sm' } },
    { type: 'Label', id: 'gz-hint', props: { text: 'WASD/方向键 控鸭 · 拖拽旋转 · 滚轮缩放 · P 开关剖析', size: 'sm' } },
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
  const renderer = new ThreeRenderer({ width: w, height: h, background: 0x0b1020, fov: 38, assets });
  engine.attachRenderer(renderer, stage);

  // HUD 叠加层（LayoutNode 纯数据·UI 铁律）。
  const hudHost = document.createElement('div');
  hudHost.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  wrapper.appendChild(hudHost);
  let showProfiler = true; // 性能剖析面板开关（P 键切换·默认开）
  let fps = 60; // 平滑帧率（render-only·不进 sim）
  const ui = mountUI(hudHost, hudTree(60, null, showProfiler));

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
    if (e.code === 'KeyP') { showProfiler = !showProfiler; ui.update(hudTree(Math.round(fps), renderer.readStats(), showProfiler)); }
    held.add(e.code); setVel();
  };
  const onUp = (e: KeyboardEvent): void => { held.delete(e.code); setVel(); };
  const onBlur = (): void => { held.clear(); setVel(); };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);

  // 旋转交互（运行时输入胶水·同键盘先例）：拖拽 → 转 Camera3D yaw/pitch；滚轮 → 拉近/远 distance。
  // Camera3D 是 render-only（不进 hash），运行时改它纯表现安全。pitch 夹在俯视区间、distance 夹在合理范围。
  const cam = (): Camera3D | undefined => engine.world.getComponent<Camera3D>('cam', 'Camera3D');
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const onPointerDown = (e: PointerEvent): void => { dragging = true; lastX = e.clientX; lastY = e.clientY; stage.setPointerCapture?.(e.pointerId); };
  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const c = cam();
    if (!c) return;
    c.yaw += (e.clientX - lastX) * 0.008; // 水平拖 → 绕 Y 环绕
    c.pitch = Math.max(0.12, Math.min(1.45, c.pitch + (e.clientY - lastY) * 0.006)); // 垂直拖 → 俯仰（夹俯视区）
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
    if (now - lastHud > 250) { lastHud = now; ui.update(hudTree(Math.round(fps), renderer.readStats(), showProfiler)); }
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
    wrapper.remove();
  };
}
