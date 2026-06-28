// Game Z · 3D 盒庭（Captain Toad 风渲染线 v0）的挂载入口。
//
// 纯数据盒庭蓝图 → 引擎 Engine 装载 → ThreeRenderer 渲染（盒庭模式：Camera3D 轨道相机 + 柔和动态阴影 + 暖冷光 + 天空盒）。
// 盒庭本体走 render 组件（Mesh3D/Transform3D）+ 引擎渲染器（数据，非 UI 库）；HUD 走 LayoutNode（UI 铁律）。
// 角色走动 = 现成 velocity→motion-apply 能力（纯数据 sim）；键盘=运行时输入胶水（input-capture 言明捕获是运行时职责）。
// 玩法暂缓（owner 2026-06-27「先把玩法放一下·先长 3D 这条线」）。
import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import { AssetManager, ModelAssetLoader } from '@assets/index.js';
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode } from '@ui/components/index.js';
import type { Velocity } from '@engine/protocol/components.js';
import { dioramaBlueprint } from './diorama.js';
import { GAME_Z_ASSETS } from './assets.js';

const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

// 角标 HUD（LayoutNode 纯数据）：标题 + 帧率 + 操作提示。pointer-events:none 不挡盒庭。
function hudTree(fps: number): LayoutNode {
  return {
    type: 'Panel', id: 'gz-hud', props: { bare: true }, layout: { x: 18, y: 14, gap: 4 },
    children: [
      { type: 'Label', id: 'gz-title', props: { text: 'GAME Z', size: 'xxl', glow: true } },
      { type: 'Label', id: 'gz-sub', props: { text: '3D 盒庭 · 数据驱动渲染线 · glTF 模型导入', size: 'sm' } },
      { type: 'Label', id: 'gz-fps', props: { text: `${fps} FPS`, size: 'sm', font: 'mono', glow: true } },
      { type: 'Label', id: 'gz-hint', props: { text: 'WASD / 方向键 控制小黄鸭走动', size: 'sm' } },
    ],
  };
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
  const ui = mountUI(hudHost, hudTree(60));

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
  const onDown = (e: KeyboardEvent): void => { if (MOVE_KEYS.has(e.code)) e.preventDefault(); held.add(e.code); setVel(); };
  const onUp = (e: KeyboardEvent): void => { held.delete(e.code); setVel(); };
  const onBlur = (): void => { held.clear(); setVel(); };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);

  // 帧率：每帧测壁钟差 → 平滑 fps，~4 次/秒刷 HUD（render-only·不进 sim）。
  let lastT = performance.now();
  let fps = 60;
  let lastHud = 0;
  const unsub = engine.subscribe(() => {
    const now = performance.now();
    const dt = now - lastT;
    lastT = now;
    if (dt > 0) fps = fps * 0.9 + (1000 / dt) * 0.1;
    if (now - lastHud > 250) { lastHud = now; ui.update(hudTree(Math.round(fps))); }
  });

  engine.start();

  return () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
    window.removeEventListener('blur', onBlur);
    unsub();
    engine.stop();
    renderer.destroy();
    ui();
    wrapper.remove();
  };
}
