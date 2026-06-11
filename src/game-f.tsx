import { Engine } from './runtime/engine.js';
import { CanvasRenderer } from './renderer/index.js';
import { PointerInputSource, KeyboardInputSource } from './net/index.js';
import type { InputSource } from './net/commands.js';
import { AssetManager, ImageAssetLoader } from '@assets/index.js';
import { buildGameFBlueprint, GAME_F_ASSETS } from './games/game-f/index.js';

// Game F 可挂载模块（launcher 卡带槽契约：export mount(container) → cleanup）。
// 纯数据切片：引擎跑 buildGameFBlueprint，CanvasRenderer 读静态 Camera 投影。
// 指针输入（F-12 修复：此前无输入源，开战/刷新/锁店/卖出按钮画着但点不动）：PointerInputSource
// 采集期做相机逆投影（静态相机 zoom=CAM_ZOOM 居中 → world=(screen-中心)/zoom），clickable 收世界坐标。
// 美术走 R9：注册 GAME_F_ASSETS（势力色占位 token），真 DCSS 皮后补同 key 自动穿皮（见 art-data.md）。
const VIEWPORT_W = 1280;
const VIEWPORT_H = 720;
const CAM_ZOOM = 1.8; // 与 blueprint camera.zoom 一致（静态相机）

export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;background:#0c0a08;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#cbd5e1;font:13px system-ui';

  const hint = document.createElement('div');
  hint.style.cssText = 'max-width:800px;text-align:center;line-height:1.5';
  hint.textContent =
    '《像素三分天下》自走棋 —— 多回合循环：备战(发钱/商店刷新/锁店/卖出)→点「开战」或倒计时→自动战斗→结算扣血→下一回合；打穿关卡=通关。按钮可点（开战/刷新$2/锁店/解锁；点备战席棋子=卖出）。商店 5 槽可视化与点击购买待引擎件(REQ-F-042/043)。';

  const stage = document.createElement('div');
  stage.style.cssText = `width:${VIEWPORT_W}px;height:${VIEWPORT_H}px;border:1px solid #3a2e22;border-radius:6px;overflow:hidden`;

  wrapper.appendChild(hint);
  wrapper.appendChild(stage);
  container.appendChild(wrapper);

  // 美术资产（数据驱动，R9）：注册清单 → 异步加载；就绪前渲染器退化几何，就绪后自动画占位 token。
  const assets = new AssetManager(new ImageAssetLoader());
  assets.registerManifest(GAME_F_ASSETS);
  void assets.loadAll();

  // 输入源懒适配：Engine 的 input 是构造期只读，而 canvas 由 attachRenderer 挂载时才创建 → 占位转发。
  // 键盘（批C 主角移动：WASD/方向键）即时可挂 window；指针等 canvas 就绪。
  const keyboard = new KeyboardInputSource('p1', window);
  let pointer: PointerInputSource | null = null;
  const lazyInput: InputSource = { commandsForTick: (tick) => [...keyboard.commandsForTick(tick), ...(pointer ? pointer.commandsForTick(tick) : [])] };
  const engine = new Engine({ tickRate: 60, input: lazyInput });
  engine.load(buildGameFBlueprint());
  engine.attachRenderer(new CanvasRenderer({ width: VIEWPORT_W, height: VIEWPORT_H, background: '#0c0a08', assets }), stage);
  const canvas = stage.querySelector('canvas');
  if (canvas) {
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'pointer';
    pointer = new PointerInputSource('p1', canvas, {
      worldFromScreen: (sx, sy) => ({ x: (sx - VIEWPORT_W / 2) / CAM_ZOOM, y: (sy - VIEWPORT_H / 2) / CAM_ZOOM }),
    });
  }
  engine.start();

  return () => {
    engine.stop();
    keyboard.dispose();
    pointer?.dispose();
    if (wrapper.parentNode === container) container.removeChild(wrapper);
  };
}
