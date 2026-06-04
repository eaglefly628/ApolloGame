import React from 'react';
import { createRoot } from 'react-dom/client';
import { Engine } from './runtime/engine.js';
import { buildGameBBlueprint } from './games/game-b/blueprint.js';
import { SCENE_01 } from './games/game-b/data/dialogue.js';
import { VNStage } from './games/game-b/ui/VNStage.js';

// Game B 可挂载模块（launcher 卡带槽契约：export mount(container) → cleanup）。
// 与 game-platformer.tsx 同构。VN 是纯 DOM 演出 + 世界态，无需 canvas。
export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;inset:0;background:#1a1320;display:flex;align-items:center;justify-content:center';
  container.appendChild(wrapper);

  const engine = new Engine({ tickRate: 60 });
  engine.load(buildGameBBlueprint());
  engine.start();

  const root = createRoot(wrapper);
  root.render(<VNStage engine={engine} script={SCENE_01} />);

  return () => {
    engine.stop();
    root.unmount();
    wrapper.remove();
  };
}
