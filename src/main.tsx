import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Engine } from './runtime/engine.js';
import { CanvasRenderer } from '@renderer/index.js';
import { KeyboardInputSource } from '@net/index.js';
import { GameOverlay } from './ui/GameOverlay.js';
import { playgroundBlueprint } from './assembly/playground.assembly.js';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<KeyboardInputSource | null>(null);
  const [engine] = useState(() => {
    // 本地玩家 p1 的键盘输入源；以后换成网络对端，引擎 start() 一行都不用动。
    const input = new KeyboardInputSource('p1');
    inputRef.current = input;
    const e = new Engine({ tickRate: 60, input });
    e.load(playgroundBlueprint);
    return e;
  });

  useEffect(() => {
    // 最简渲染后端：Canvas2D。升级时换成 PhaserBackend / AI 视频后端即可，
    // collectRenderables（渲染数据提取）与引擎逻辑都不用动。
    const renderer = new CanvasRenderer({ width: 640, height: 400, background: '#16213e' });
    if (containerRef.current) engine.attachRenderer(renderer, containerRef.current);
    engine.start();
    return () => {
      engine.stop();
      renderer.destroy();
      inputRef.current?.dispose();
    };
  }, [engine]);

  return (
    <>
      <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: 640, height: 400 }} />
      <GameOverlay engine={engine} />
    </>
  );
}

const root = createRoot(document.getElementById('app')!);
root.render(<App />);
