// Game D ·《骰途》挂载入口 —— 双人骰子 Roguelike 的 3D 场景骨架（战斗未接入）。
//
// owner 2026-06-29「先搭场景骨架·一关一关往前流程·3D 要有美术艺术感」。
// 纯数据房间走廊蓝图（rooms.ts）→ 引擎装载 → ThreeRenderer 渲染（ortho 45° 等距·精装光照/后处理/天空盒）。
// 「往前推」= 运行时输入胶水把 Camera3D.pivotZ 平滑推进到当前房间（render-only·不进 hash·同 game-z 拖拽先例）。
// HUD 走 LayoutNode 纯数据（UI 铁律）。骰子/敌人/战斗 = 后续接入（见 game-d-combat-design.md）。
import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import { AssetManager, ModelAssetLoader } from '@assets/index.js';
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode } from '@ui/components/index.js';
import type { Camera3D } from '@engine/protocol/components.js';
import { dungeonBlueprint, ROOMS, ROOM_SPACING } from './rooms.js';
import { GAME_D_ASSETS } from './assets.js';

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowUp', 'KeyD', 'Space', 'Enter']);
const PREV_KEYS = new Set(['ArrowLeft', 'ArrowDown', 'KeyA']);

// 角标 HUD（LayoutNode 纯数据·UI 铁律）：标题 + 当前关卡 + 操作提示。pointer-events:none 不挡场景。
function hudTree(room: number): LayoutNode {
  const def = ROOMS[room]!;
  return {
    type: 'Panel', id: 'gd-hud', props: { bare: true }, layout: { x: 18, y: 14, gap: 4 },
    children: [
      { type: 'Label', id: 'gd-title', props: { text: '🎲 GAME D ·《骰途》', size: 'xxl', glow: true } },
      { type: 'Label', id: 'gd-sub', props: { text: '双人骰子 Roguelike · 3D 场景骨架（战斗未接入）', size: 'sm' } },
      { type: 'Label', id: 'gd-room', props: { text: `关卡 ${room + 1}/${ROOMS.length} · ${def.name}`, size: 'lg', glow: true } },
      { type: 'Label', id: 'gd-hint', props: { text: '→ / 空格 前进 · ← 后退 · 拖拽看不动（固定 45° 前推视角）', size: 'sm', color: 'dim' } },
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

  const w = Math.max(320, Math.min(1100, wrapper.clientWidth || 960));
  const h = Math.max(240, Math.min(720, wrapper.clientHeight || 600));

  // 3D 模型资产（showcase 小黄鸭·异步加载·就绪前渲染器跳过·就绪后自动显示）。
  const assets = new AssetManager(new ModelAssetLoader());
  assets.registerManifest(GAME_D_ASSETS);
  void assets.loadAll();

  const engine = new Engine();
  engine.load(dungeonBlueprint());
  const renderer = new ThreeRenderer({ width: w, height: h, background: 0x0b1020, assets });
  engine.attachRenderer(renderer, stage);

  // HUD 叠加层（LayoutNode·UI 铁律·不挡场景）。
  const hudHost = document.createElement('div');
  hudHost.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  wrapper.appendChild(hudHost);
  let room = 0; // 当前关卡（房间）索引
  const ui = mountUI(hudHost, hudTree(room));

  const cam = (): Camera3D | undefined => engine.world.getComponent<Camera3D>('cam', 'Camera3D');

  // 推进到某房间：只改目标 Z，相机每帧平滑追（dolly）；刷新 HUD。
  const goto = (r: number): void => {
    room = Math.max(0, Math.min(ROOMS.length - 1, r));
    ui.update(hudTree(room));
  };

  // 可点击「前进 / 后退」按钮（独立 pointer-events:auto 宿主·LayoutNode·action 经 handler 入队·UI 铁律）。
  const navHost = document.createElement('div');
  navHost.style.cssText = 'position:absolute;right:18px;bottom:14px;pointer-events:auto';
  wrapper.appendChild(navHost);
  const navTree: LayoutNode = {
    type: 'Panel', id: 'gd-nav', props: { bare: true }, layout: { gap: 6, direction: 'row' },
    children: [
      { type: 'Button', id: 'gd-prev', props: { label: '← 后退', kind: 'ghost', action: 'prev' } },
      { type: 'Button', id: 'gd-next', props: { label: '前进 →', kind: 'primary', action: 'next' } },
    ],
  };
  const navUi = mountUI(navHost, navTree, { next: () => goto(room + 1), prev: () => goto(room - 1) });

  // 键盘前进/后退（运行时输入胶水·同 game-z 先例）。
  const onKey = (e: KeyboardEvent): void => {
    if (NEXT_KEYS.has(e.code)) { e.preventDefault(); goto(room + 1); }
    else if (PREV_KEYS.has(e.code)) { e.preventDefault(); goto(room - 1); }
  };
  window.addEventListener('keydown', onKey);

  // 每帧把 Camera3D.pivotZ 平滑推进到当前房间中心（render-only·前推 dolly）。
  const unsub = engine.subscribe(() => {
    const c = cam();
    if (!c) return;
    const targetZ = room * ROOM_SPACING;
    const cur = c.pivotZ ?? 0;
    c.pivotZ = Math.abs(targetZ - cur) < 0.05 ? targetZ : cur + (targetZ - cur) * 0.12;
  });

  engine.start();

  return () => {
    window.removeEventListener('keydown', onKey);
    unsub();
    engine.stop();
    renderer.destroy();
    ui();
    navUi();
    wrapper.remove();
  };
}
