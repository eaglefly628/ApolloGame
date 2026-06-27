// Game Z · 3D 盒庭（Captain Toad 风渲染线 v0）的挂载入口。
//
// 纯数据盒庭蓝图 → 引擎 Engine 装载 → ThreeRenderer 渲染（盒庭模式：Camera3D 轨道相机 + 柔和阴影 + 暖冷光）。
// 盒庭本体走 render 组件（Mesh3D/Transform3D）+ 引擎渲染器（数据，非 UI 库）；HUD 走 LayoutNode（UI 铁律）。
// 玩法暂缓（owner 2026-06-27「先把玩法放一下·先长 3D 这条线」）——v0 立起可渲染的盒庭底座。
import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode } from '@ui/components/index.js';
import { dioramaBlueprint } from './diorama.js';

// 角标 HUD（LayoutNode 纯数据）：标题 + 一行说明。pointer-events:none 不挡盒庭。
function hudTree(): LayoutNode {
  return {
    type: 'Panel', id: 'gz-hud', props: { bare: true }, layout: { x: 18, y: 14, gap: 4 },
    children: [
      { type: 'Label', id: 'gz-title', props: { text: 'GAME Z', size: 'xxl', glow: true } },
      { type: 'Label', id: 'gz-sub', props: { text: '3D 盒庭 · 数据驱动渲染线 v0', size: 'sm' } },
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

  const engine = new Engine();
  engine.load(dioramaBlueprint());
  const renderer = new ThreeRenderer({ width: w, height: h, background: 0x0b1020, fov: 38 });
  engine.attachRenderer(renderer, stage);
  engine.start();

  const hudHost = document.createElement('div');
  hudHost.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  wrapper.appendChild(hudHost);
  const ui = mountUI(hudHost, hudTree());

  return () => {
    engine.stop();
    renderer.destroy();
    ui();
    wrapper.remove();
  };
}
