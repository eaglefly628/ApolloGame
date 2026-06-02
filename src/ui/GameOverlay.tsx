import React from 'react';
import { useWorldVersion } from './hooks/use-engine.js';
import type { Engine } from '../runtime/engine.js';

interface GameOverlayProps {
  engine: Engine;
}

// 占位 overlay —— 旧 skill 已移除。
// Tier 1 原子实现后，UI binding 在此读取 resource/flag 等组件投影为界面。
export function GameOverlay({ engine }: GameOverlayProps) {
  useWorldVersion(engine);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 10,
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        padding: '12px 20px',
        background: 'rgba(0,0,0,0.6)',
        borderRadius: 8,
        color: '#94a3b8',
        fontSize: 13,
        fontFamily: 'monospace',
      }}>
        empty world — 等待 Tier 1 原子 skill
      </div>
    </div>
  );
}
