import { Engine } from './runtime/engine.js';
import { CanvasRenderer } from './renderer/index.js';
import { AssetManager, ImageAssetLoader } from '@assets/index.js';
import { buildGameFBlueprint, GAME_F_ASSETS } from './games/game-f/index.js';

// Game F 可挂载模块（launcher 卡带槽契约：export mount(container) → cleanup）。
// 纯数据切片：引擎跑 buildGameFBlueprint，CanvasRenderer 读静态 Camera 投影。无玩家输入（全自动对战）。
// 美术走 R9：注册 GAME_F_ASSETS（势力色占位 token），真 DCSS 皮后补同 key 自动穿皮（见 art-data.md）。
const VIEWPORT_W = 800;
const VIEWPORT_H = 600;

export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;background:#0c0a08;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#cbd5e1;font:13px system-ui';

  const hint = document.createElement('div');
  hint.style.cssText = 'max-width:800px;text-align:center;line-height:1.5';
  hint.textContent =
    '《像素三分天下》自走棋 · MVP-0 骨架 —— 蜀(红) vs 魏(蓝) 全自动对战：棋子索敌→走位→普攻互砍→团灭判胜。战斗每一拍由通用能力(aggro/steering/caster/hitbox/mortal)涌现，零自走棋专属代码。';

  const stage = document.createElement('div');
  stage.style.cssText = `width:${VIEWPORT_W}px;height:${VIEWPORT_H}px;border:1px solid #3a2e22;border-radius:6px;overflow:hidden`;

  wrapper.appendChild(hint);
  wrapper.appendChild(stage);
  container.appendChild(wrapper);

  // 美术资产（数据驱动，R9）：注册清单 → 异步加载；就绪前渲染器退化几何，就绪后自动画占位 token。
  const assets = new AssetManager(new ImageAssetLoader());
  assets.registerManifest(GAME_F_ASSETS);
  void assets.loadAll();

  const engine = new Engine({ tickRate: 60 });
  engine.load(buildGameFBlueprint());
  engine.attachRenderer(new CanvasRenderer({ width: VIEWPORT_W, height: VIEWPORT_H, background: '#0c0a08', assets }), stage);
  engine.start();

  return () => {
    engine.stop();
    if (wrapper.parentNode === container) container.removeChild(wrapper);
  };
}
