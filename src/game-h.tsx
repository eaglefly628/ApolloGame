import React from 'react';
import { createRoot } from 'react-dom/client';
import { Engine } from './runtime/engine.js';
import { QueuedInputSource } from './net/index.js';
import { buildGameHBlueprint } from './games/game-h/blueprint.js';
import { BlackjackStage } from './games/game-h/ui/BlackjackStage.js';

// Game H 卡带（launcher 槽契约：mount(container) → cleanup）。
// 传统 21 点游戏：纯 React UI，无 canvas 绘图。
// 游戏逻辑 = 数据驱动蓝图 + React 组件实现的点数计算和胜负判定。

export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
    'background:linear-gradient(135deg,#0a0f1e,#1e3a2f);padding:16px;' +
    'font-family:system-ui,sans-serif;overflow:auto';

  const panel = document.createElement('div');
  panel.style.cssText = 'flex:0 1 auto;max-width:600px;width:100%';
  wrapper.appendChild(panel);
  container.appendChild(wrapper);

  const input = new QueuedInputSource('p1');
  const engine = new Engine({ tickRate: 60, input });
  engine.load(buildGameHBlueprint());
  engine.start();

  const root = createRoot(panel);
  root.render(<BlackjackStage engine={engine} />);

  return () => {
    engine.stop();
    root.unmount();
    wrapper.remove();
  };
}
