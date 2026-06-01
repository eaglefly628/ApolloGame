import React from 'react';
import { Bar } from './templates/Bar.js';
import { useComponent } from './hooks/use-component.js';
import { useWorldVersion } from './hooks/use-engine.js';
import type { Engine } from '../runtime/engine.js';
import type { BarDisplay } from '../atom-skills/status-bar/index.js';
import type { Health } from '../atom-skills/health/index.js';

interface GameOverlayProps {
  engine: Engine;
}

export function GameOverlay({ engine }: GameOverlayProps) {
  const version = useWorldVersion(engine);
  const barDisplay = useComponent<BarDisplay>(engine, 'hero', 'BarDisplay');
  const health = useComponent<Health>(engine, 'hero', 'Health');
  const isDead = engine.world.hasComponent('hero', 'Dead');

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 10,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: 24,
    }}>
      {/* Top: Health Bar */}
      <div style={{ width: 280 }}>
        {barDisplay && (
          <Bar
            current={barDisplay.current}
            max={barDisplay.max}
            color={barDisplay.color}
            label={barDisplay.label}
          />
        )}
      </div>

      {/* Center: Status */}
      {isDead && (
        <div style={{
          alignSelf: 'center',
          fontSize: 32,
          fontWeight: 'bold',
          color: '#ef4444',
          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          animation: 'pulse 1s infinite',
        }}>
          DEAD
        </div>
      )}

      {/* Bottom: Instructions */}
      <div style={{
        alignSelf: 'center',
        display: 'flex',
        gap: 16,
        pointerEvents: 'auto',
      }}>
        <KeyHint keyName="↑ / W" action="Heal +10" color="#22c55e" />
        <KeyHint keyName="↓ / S" action="Damage -10" color="#ef4444" />
      </div>
    </div>
  );
}

function KeyHint({ keyName, action, color }: { keyName: string; action: string; color: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 16px',
      background: 'rgba(0,0,0,0.7)',
      borderRadius: 8,
      border: `1px solid ${color}44`,
      fontSize: 13,
      color: '#e2e8f0',
    }}>
      <kbd style={{
        padding: '2px 8px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 4,
        fontFamily: 'monospace',
        fontWeight: 'bold',
        color,
      }}>
        {keyName}
      </kbd>
      <span>{action}</span>
    </div>
  );
}
