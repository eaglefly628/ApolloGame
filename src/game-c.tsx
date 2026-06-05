import React from 'react';
import { createRoot } from 'react-dom/client';
import { Engine } from './runtime/engine.js';
import { buildGameCBlueprint } from './games/game-c/blueprint.js';
import { AtelierStage } from './games/game-c/ui/AtelierStage.js';

// Game C 可挂载模块（launcher 卡带槽契约：export mount(container) → cleanup）。
// 与 game-b.tsx 同构：升级 / 换装 / 爱诗展示链住世界里(纯数据)，React 只读它渲染。
// 三消核心棋盘 = 引擎能力 REQ-C-001（建设中），本卡带是 v0.1 工坊预览。
export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;background:#1a1018;display:flex;align-items:center;justify-content:center';
  container.appendChild(wrapper);

  const engine = new Engine({ tickRate: 60 });
  engine.load(buildGameCBlueprint());
  engine.start();

  const root = createRoot(wrapper);
  root.render(<AtelierStage engine={engine} />);

  return () => {
    engine.stop();
    root.unmount();
    wrapper.remove();
  };
}
