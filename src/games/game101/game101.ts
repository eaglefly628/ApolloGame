// game101 ·《海港绯闻》—— 卡带宿主层（工程师写的 mount/host·契约明许·零玩法逻辑）。
//
// 职责（都在 sim 外）：建 Engine + CanvasRenderer 画 play-field 合并板（物品灰盒占位·美术就绪即换皮）。
// M1a 灰盒：只渲染棋盘物品 + 合并动效由 sim 涌现（merge-rule/prefab/over-time·见 blueprint.ts 头注）。
// HUD / 拖放交互 / 生成器·订单·气泡属 M1b+（生成器等待 REQ-101-01 §2.5 裁决下沉引擎能力）。
import { Engine } from '../../runtime/engine.js';
import { CanvasRenderer } from '@renderer/index.js';
import { mountHost } from '@engine/host/mount-host.js';
import { buildBlueprint } from './blueprint.js';
import { FIELD_W, FIELD_H, CELL, BOARD_PAD, BOARD_W, BOARD_H } from './theme.js';

// 暖色 cozy 海港底纹 + 棋盘格线（render-only·CSS·非 sim）。
const SCENE_BG = 'radial-gradient(circle at 50% 34%, #fff6e6 0%, #ffe9cf 46%, #f6d3ad 100%)';
const BOARD_GRID =
  `repeating-linear-gradient(0deg, rgba(120,72,40,0.16) 0 2px, transparent 2px ${CELL}px),` +
  `repeating-linear-gradient(90deg, rgba(120,72,40,0.16) 0 2px, transparent 2px ${CELL}px)`;

export function mount(container: HTMLElement, _host?: { exit: () => void }): () => void {
  const { scene, teardown } = mountHost(container, {
    fieldW: FIELD_W,
    fieldH: FIELD_H,
    sceneBackground: SCENE_BG,
    wrapperBackground: '#2a1c12',
  });

  // 棋盘外框 + 格线（render-only·纯 DOM 装饰·非 sim/非 LayoutNode 世界写入）：暖木边合并板，
  // 格线挂在板矩形自身（原点=BOARD_PAD）→ 与物品格中心精确对齐。
  const boardFrame = document.createElement('div');
  Object.assign(boardFrame.style, {
    position: 'absolute',
    left: `${BOARD_PAD}px`, top: `${BOARD_PAD}px`,
    width: `${BOARD_W}px`, height: `${BOARD_H}px`,
    background: BOARD_GRID,
    border: '3px solid rgba(120,72,40,0.45)', borderRadius: '18px',
    boxShadow: 'inset 0 2px 12px rgba(120,72,40,0.18)', pointerEvents: 'none', zIndex: '0',
  });
  scene.appendChild(boardFrame);

  const engine = new Engine();
  engine.load(buildBlueprint());
  const renderer = new CanvasRenderer({ width: FIELD_W, height: FIELD_H, background: 'transparent' });
  engine.attachRenderer(renderer, scene);
  const canvas = scene.querySelector('canvas') as HTMLCanvasElement | null;
  if (canvas) canvas.style.zIndex = '1';
  engine.start();

  return () => {
    engine.stop();
    renderer.destroy();
    boardFrame.remove();
    teardown();
  };
}
