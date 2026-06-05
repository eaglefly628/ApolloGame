import { Engine } from './runtime/engine.js';
import { CanvasRenderer } from './renderer/index.js';
import { KeyboardInputSource, MultiInputSource } from './net/index.js';
import {
  buildGameABlueprint,
  LEVEL_SCROLL,
  KEYMAP_A,
  KEYMAP_B,
  PLAYER_A,
  PLAYER_B,
  VIEWPORT_W,
  VIEWPORT_H,
} from './games/game-a/index.js';

// Game A 可挂载模块（launcher 卡带槽契约：export mount(container) → cleanup）。
// 本地双人：两套键位 → MultiInputSource → Engine；CanvasRenderer 读相机（camera-follow 写的
// Camera 实体）做世界→屏幕投影 = 卷轴。卷轴关卡 1920 宽，相机跟两人中点卷动/缩放。
export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;background:#16213e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#cbd5e1;font:13px system-ui';

  const hint = document.createElement('div');
  hint.textContent =
    '蓝 A：A/D 移动 · Space 跳    |    橙 B：←/→ 移动 · / 跳    —— 两人携手走到右端会合即过关（相机自动卷动 / 缩放）';

  const stage = document.createElement('div');
  stage.style.cssText = `width:${VIEWPORT_W}px;height:${VIEWPORT_H}px;border:1px solid #334155;border-radius:6px;overflow:hidden`;

  wrapper.appendChild(hint);
  wrapper.appendChild(stage);
  container.appendChild(wrapper);

  const input = new MultiInputSource([
    new KeyboardInputSource(PLAYER_A, window, KEYMAP_A),
    new KeyboardInputSource(PLAYER_B, window, KEYMAP_B),
  ]);
  const engine = new Engine({ tickRate: 60, input });
  engine.load(buildGameABlueprint(LEVEL_SCROLL));
  engine.attachRenderer(new CanvasRenderer({ width: VIEWPORT_W, height: VIEWPORT_H }), stage);
  engine.start();

  return () => {
    engine.stop();
    input.dispose();
    wrapper.remove();
  };
}
