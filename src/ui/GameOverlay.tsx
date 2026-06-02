import React from 'react';
import { useWorldVersion } from './hooks/use-engine.js';
import type { Engine } from '../runtime/engine.js';
import type { Transform } from '@engine/protocol/components.js';

interface GameOverlayProps {
  engine: Engine;
}

// Live overlay —— UI binding 读取 world 状态投影为界面。
// 演示绑定：每 tick 刷新 tick 数 / 实体数 / 子弹世界坐标。
export function GameOverlay({ engine }: GameOverlayProps) {
  const version = useWorldVersion(engine);
  const entities = engine.world.getAllEntities();
  const bullet = engine.world.getComponent<Transform>('bullet', 'Transform');

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
        tick {version} · entities {entities.length} ·{' '}
        {bullet ? `bullet x=${Math.round(bullet.x)}` : 'bullet despawned'}
      </div>
    </div>
  );
}
