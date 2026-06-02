import React from 'react';
import { useWorldVersion } from './hooks/use-engine.js';
import type { Engine } from '../runtime/engine.js';

interface GameOverlayProps {
  engine: Engine;
}

// Live overlay —— UI binding 读取 world 状态投影为界面，每 tick 刷新。
export function GameOverlay({ engine }: GameOverlayProps) {
  const version = useWorldVersion(engine);
  const entities = engine.world.getAllEntities();

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 10,
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
    }}>
      <div style={{
        marginTop: 12,
        padding: '8px 16px',
        background: 'rgba(0,0,0,0.6)',
        borderRadius: 8,
        color: '#94a3b8',
        fontSize: 13,
        fontFamily: 'monospace',
      }}>
        tick {version} · entities {entities.length}
      </div>
    </div>
  );
}
