import React from 'react';
import { createRoot } from 'react-dom/client';
import { Engine } from './runtime/engine.js';
import { QueuedInputSource } from './net/index.js';
import { buildGameBBlueprint, buildGameBBinding } from './games/game-b/blueprint.js';
import { SCENE_01 } from './games/game-b/data/dialogue.js';
import { VNStage } from './ui/vn/index.js';
import { sakuraOtomeTheme } from './ui/themes/sakura-otome/theme.js';

// Game B 可挂载模块（launcher 卡带槽契约：export mount(container) → cleanup）。
// 与 game-platformer.tsx 同构。VN 是纯 DOM 演出 + 世界态，无需 canvas。
// R16：演出层用**通用** @ui/vn/VNStage + sakura 主题数据 + 从 manifest 派生的绑定数据；
// 输入经 R3 确定性接缝（QueuedInputSource）注入，不再直接改世界。Game B 不再有 VNStage 代码。
export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;inset:0;background:#33232e;display:flex;align-items:center;justify-content:center';
  container.appendChild(wrapper);

  // R3 输入接缝：UI enqueueAction → 引擎 tick 边界确定性消费（applyRawActions → InputQueue → dialogue）。
  const input = new QueuedInputSource('p1');
  const engine = new Engine({ tickRate: 60, input });
  engine.load(buildGameBBlueprint());
  engine.start();

  const root = createRoot(wrapper);
  root.render(<VNStage engine={engine} script={SCENE_01} theme={sakuraOtomeTheme} binding={buildGameBBinding()} input={input} />);

  return () => {
    engine.stop();
    root.unmount();
    wrapper.remove();
  };
}
