import React from 'react';
import { createRoot } from 'react-dom/client';
import { Engine } from '../../runtime/engine.js';
import { QueuedInputSource } from '../../net/index.js';
import { buildGameHBlueprint } from './blueprint.js';
import { Blackjack3DStage } from './ui/Blackjack3DStage.js';

// Game H 卡带（launcher 槽契约：mount(container) → cleanup）。
// 3D 俯视角 21 点游戏：用 three.js 渲染 3D 赌桌、卡牌、筹码。
// 游戏逻辑 = 数据驱动蓝图 + React + Three.js 实现的点数计算和胜负判定。

export function mount(container: HTMLElement): () => void {
  const input = new QueuedInputSource('p1');
  const engine = new Engine({ tickRate: 60, input });
  engine.load(buildGameHBlueprint());
  engine.start();

  const root = createRoot(container);
  root.render(<Blackjack3DStage engine={engine} />);

  return () => {
    engine.stop();
    root.unmount();
  };
}
