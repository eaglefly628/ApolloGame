// Game D ·《骰途》挂载入口 —— 双人骰子 Roguelike 的 3D 场景骨架（无限程序化房间流·战斗未接入）。
//
// owner 2026-06-29「先搭场景骨架·一关一关往前流程·近俯视·一屏一战场·把 Streaming 做扎实」。
// 静态单例蓝图（baseBlueprint：相机/光/后处理/天空盒）→ 引擎装载 → ThreeRenderer 渲染（ortho 近俯视）。
// 房间**流式生成/卸载**：只保留当前房间 ± WINDOW 的窗口——推进时前方 genRoom→createEntity、身后 destroyEntity。
// 房间全 render-only（Transform3D/Mesh3D·出 hash），故运行时增删纯表现安全、无需 sim/装配层改动（M0 已自证）。
// 「往上推」= 把 Camera3D.pivotZ 平滑推到当前房间中心（render-only dolly）。HUD 走 LayoutNode（UI 铁律）。
import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import { AssetManager, ModelAssetLoader } from '@assets/index.js';
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode } from '@ui/components/index.js';
import type { Camera3D } from '@engine/protocol/components.js';
import type { Component } from '@engine/core/types.js';
import { baseBlueprint, genRoom, roomMeta, ROOM_SPACING } from './rooms.js';
import { GAME_D_ASSETS } from './assets.js';

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowUp', 'KeyD', 'Space', 'Enter']);
const PREV_KEYS = new Set(['ArrowLeft', 'ArrowDown', 'KeyA']);
const WINDOW = 1; // 当前房间 ± WINDOW 保持加载（流式窗口）

// 角标 HUD（LayoutNode 纯数据·UI 铁律）：标题 + 层/房间/类型进度 + 操作提示。pointer-events:none 不挡场景。
function hudTree(index: number): LayoutNode {
  const m = roomMeta(index);
  const typeLabel = m.type === 'boss' ? '👑 BOSS' : '⚔ 战斗';
  return {
    type: 'Panel', id: 'gd-hud', props: { bare: true }, layout: { x: 18, y: 14, gap: 4 },
    children: [
      { type: 'Label', id: 'gd-title', props: { text: '🎲 GAME D ·《骰途》', size: 'xxl', glow: true } },
      { type: 'Label', id: 'gd-sub', props: { text: '双人骰子 Roguelike · 3D 场景骨架（战斗未接入）', size: 'sm' } },
      { type: 'Label', id: 'gd-room', props: { text: `第 ${m.act + 1} 层 · 房间 ${m.roomInAct + 1}/3 · ${typeLabel} · ${m.theme.name}`, size: 'lg', glow: true } },
      { type: 'Label', id: 'gd-hint', props: { text: '→ / 空格 前进（往上一关）· ← 后退 · 近俯视 · 一屏一战场 · 房间流式生成', size: 'sm', color: 'dim' } },
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
  engine.load(baseBlueprint()); // 只装静态单例（相机/光/后处理/天空）；房间运行时流式生成
  const renderer = new ThreeRenderer({ width: w, height: h, background: 0x0b1020, assets });
  engine.attachRenderer(renderer, stage);

  // ── 房间流式生成 / 卸载 ──（房间全 render-only·运行时增删纯表现安全·不进 hash）
  const loaded = new Map<number, string[]>(); // 房间序号 → 该房间的实体 id 列表
  const loadRoom = (i: number): void => {
    if (i < 0 || loaded.has(i)) return;
    const ids: string[] = [];
    for (const [id, ent] of Object.entries(genRoom(i))) {
      engine.world.createEntity(id);
      for (const [type, data] of Object.entries(ent as Record<string, object>)) {
        engine.world.addComponent(id, { ...data, type } as Component);
      }
      ids.push(id);
    }
    loaded.set(i, ids);
  };
  const unloadRoom = (i: number): void => {
    const ids = loaded.get(i);
    if (!ids) return;
    for (const id of ids) engine.world.destroyEntity(id);
    loaded.delete(i);
  };
  const refreshStream = (center: number): void => {
    for (const i of [...loaded.keys()]) {
      if (i < center - WINDOW || i > center + WINDOW) unloadRoom(i);
    }
    for (let i = center - WINDOW; i <= center + WINDOW; i++) loadRoom(i);
  };

  // HUD 叠加层（LayoutNode·UI 铁律·不挡场景）。
  const hudHost = document.createElement('div');
  hudHost.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  wrapper.appendChild(hudHost);
  let room = 0; // 当前房间（无上限·无限层；后退夹在 0）
  const ui = mountUI(hudHost, hudTree(room));

  const cam = (): Camera3D | undefined => engine.world.getComponent<Camera3D>('cam', 'Camera3D');

  // 推进到某房间：刷新流式窗口（生成/卸载）+ 刷新 HUD（相机每帧平滑追·见下）。
  const goto = (r: number): void => {
    room = Math.max(0, r);
    refreshStream(room);
    ui.update(hudTree(room));
  };

  refreshStream(room); // 起手装载当前房间（及窗口内）

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

  // 每帧把 Camera3D.pivotZ 平滑推进到当前房间中心（render-only·往上 dolly 转场）。
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
