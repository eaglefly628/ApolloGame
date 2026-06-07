import { Engine } from './runtime/engine.js';
import { CanvasRenderer } from './renderer/index.js';
import { AssetManager, ImageAssetLoader } from '@assets/index.js';
import { KeyboardInputSource } from './net/index.js';
import { buildGameDBlueprint, GAME_D_ASSETS, KEYMAP_D, PLAYER_D, VIEWPORT_W, VIEWPORT_H } from './games/game-d/index.js';

// Game D 可挂载模块（launcher 卡带槽契约：export mount(container) → cleanup）。
// 纯数据切片：引擎跑 buildGameDBlueprint，CanvasRenderer 读相机(camera-follow 写的 Camera)做世界→屏幕投影，
// KeyboardInputSource(WASD 移动 + 数字键 1/2/3 离散动作 → keybind → 技能信号 → caster 自动索敌放技能)。
// 美术走 R9 资产流程：注册 GAME_D_ASSETS（声明 id），就绪前渲染器退化几何方块，补真贴图后自动穿皮。
export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;background:#0a0a14;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#cbd5e1;font:13px system-ui';

  const hint = document.createElement('div');
  hint.textContent =
    '英雄(蓝)：WASD 移动 · 1 冰霜新星(冻住范围内怪) · 2 碎冰重锤(对冰冻怪真伤) · 3 烈焰(灼烧 DoT) —— 怪(红)会追你，杀死掉落金币';

  const stage = document.createElement('div');
  stage.style.cssText = `width:${VIEWPORT_W}px;height:${VIEWPORT_H}px;border:1px solid #334155;border-radius:6px;overflow:hidden`;

  wrapper.appendChild(hint);
  wrapper.appendChild(stage);
  container.appendChild(wrapper);

  const input = new KeyboardInputSource(PLAYER_D, window, KEYMAP_D);

  // 美术资产（数据驱动，R9）：注册清单 → 异步加载；就绪前渲染器退化几何，就绪后自动画真贴图。
  const assets = new AssetManager(new ImageAssetLoader());
  assets.registerManifest(GAME_D_ASSETS);
  void assets.loadAll();

  const engine = new Engine({ tickRate: 60, input });
  engine.load(buildGameDBlueprint());
  engine.attachRenderer(new CanvasRenderer({ width: VIEWPORT_W, height: VIEWPORT_H, background: '#0a0a14', assets }), stage);
  engine.start();

  return () => {
    engine.stop();
    input.dispose();
    wrapper.remove();
  };
}
