import React from 'react';
import { createRoot } from 'react-dom/client';
import { useEngine } from './ui/hooks/use-engine.js';
import { GameOverlay } from './ui/GameOverlay.js';
import { demoBlueprint } from './assembly/demo.assembly.js';

function App() {
  const engine = useEngine(demoBlueprint);

  return (
    <>
      {/* Background canvas placeholder (Phaser will go here later) */}
      <canvas
        width={640}
        height={400}
        ref={(canvas) => {
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#16213e';
              ctx.fillRect(0, 0, 640, 400);

              // grid pattern
              ctx.strokeStyle = 'rgba(255,255,255,0.03)';
              for (let x = 0; x < 640; x += 32) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 400); ctx.stroke();
              }
              for (let y = 0; y < 400; y += 32) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(640, y); ctx.stroke();
              }

              // Title
              ctx.fillStyle = 'rgba(255,255,255,0.15)';
              ctx.font = '24px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('Apollo Engine', 320, 200);
              ctx.font = '14px sans-serif';
              ctx.fillText('empty world — awaiting Tier 1 atom skills', 320, 230);
            }
          }
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 640,
          height: 400,
        }}
      />

      {/* React UI Overlay */}
      <GameOverlay engine={engine} />
    </>
  );
}

const root = createRoot(document.getElementById('app')!);
root.render(<App />);
