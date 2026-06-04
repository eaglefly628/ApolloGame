import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

interface GameEntry {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  accentColor: string;
  icon: string;
  status: 'playable' | 'coming-soon';
  module: string;
}

const GAMES: GameEntry[] = [
  {
    id: 'platformer-lockstep',
    title: 'Platformer Demo',
    subtitle: '双人帧同步平台跳跃',
    description: '方向键/WASD 移动跳跃，开两个标签页 = 两名玩家联机。引擎基础验证 Demo。',
    color: '#1e3a5f',
    accentColor: '#38bdf8',
    icon: '🎮',
    status: 'playable',
    module: './game-platformer.js',
  },
  {
    id: 'game-a',
    title: 'Game A: Co-op Adventure',
    subtitle: '双人协作冒险',
    description: '双人成行风格。踩开关、抛射搭档、绳索摆荡，只有合作才能通关。PA 负责开发。',
    color: '#1e3a2f',
    accentColor: '#4ade80',
    icon: '🤝',
    status: 'coming-soon',
    module: './game-a.js',
  },
  {
    id: 'game-b',
    title: 'Game B: Otome VN',
    subtitle: '乙游视觉小说',
    description: '娱乐圈乙女养成。选择驱动剧情，属性决定命运，多结局。PB 负责开发。',
    color: '#3a1e3a',
    accentColor: '#e8618c',
    icon: '🌸',
    status: 'coming-soon',
    module: './game-b.js',
  },
];

function GameCard({ game, onLaunch }: { game: GameEntry; onLaunch: () => void }) {
  const [hovered, setHovered] = useState(false);
  const isPlayable = game.status === 'playable';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={isPlayable ? onLaunch : undefined}
      style={{
        position: 'relative',
        width: 280,
        background: hovered
          ? `linear-gradient(135deg, ${game.color}, ${game.color}dd)`
          : game.color,
        borderRadius: 12,
        border: `1px solid ${hovered && isPlayable ? game.accentColor : 'rgba(255,255,255,0.1)'}`,
        padding: 24,
        cursor: isPlayable ? 'pointer' : 'default',
        transition: 'all 0.25s ease',
        transform: hovered && isPlayable ? 'translateY(-4px)' : 'none',
        boxShadow: hovered && isPlayable
          ? `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${game.accentColor}33`
          : '0 4px 16px rgba(0,0,0,0.3)',
        opacity: isPlayable ? 1 : 0.6,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 12,
      }}
    >
      <div style={{ fontSize: 40 }}>{game.icon}</div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{game.title}</div>
        <div style={{ fontSize: 13, color: game.accentColor, marginTop: 4 }}>{game.subtitle}</div>
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
        {game.description}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 12 }}>
        {isPlayable ? (
          <div style={{
            display: 'inline-block',
            padding: '8px 20px',
            background: game.accentColor,
            color: '#0f172a',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            transition: 'transform 0.15s',
            transform: hovered ? 'scale(1.05)' : 'none',
          }}>
            Launch
          </div>
        ) : (
          <div style={{
            display: 'inline-block',
            padding: '8px 20px',
            background: 'rgba(255,255,255,0.08)',
            color: '#64748b',
            borderRadius: 6,
            fontSize: 14,
          }}>
            Coming Soon
          </div>
        )}
      </div>
    </div>
  );
}

function Launcher() {
  const [launched, setLaunched] = useState<string | null>(null);

  if (launched) {
    return (
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 100,
        }}>
          <button
            onClick={() => setLaunched(null)}
            style={{
              padding: '6px 16px',
              background: 'rgba(0,0,0,0.7)',
              color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            Back to Launcher
          </button>
        </div>
        <div id="game-container" style={{ width: '100%', height: '100%' }} />
        <GameLoader gameId={launched} />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0f1e 0%, #111827 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 20px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 14, letterSpacing: 4, color: '#475569', marginBottom: 8 }}>
          APOLLO ENGINE
        </div>
        <h1 style={{
          fontSize: 36,
          fontWeight: 800,
          background: 'linear-gradient(135deg, #38bdf8, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0,
        }}>
          Game Library
        </h1>
        <div style={{ fontSize: 14, color: '#64748b', marginTop: 12 }}>
          Select a game cartridge to launch
        </div>
      </div>

      {/* Game Grid */}
      <div style={{
        display: 'flex',
        gap: 24,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 920,
      }}>
        {GAMES.map(game => (
          <GameCard
            key={game.id}
            game={game}
            onLaunch={() => setLaunched(game.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 60,
        padding: '20px 0',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        textAlign: 'center',
        color: '#334155',
        fontSize: 12,
        width: '100%',
        maxWidth: 920,
      }}>
        <div>Apollo Engine v0.6 · 26 Atoms · Tier 1-2 Complete</div>
        <div style={{ marginTop: 4 }}>ECS Architecture · Deterministic Lockstep · Canvas2D Renderer</div>
      </div>
    </div>
  );
}

function GameLoader({ gameId }: { gameId: string }) {
  React.useEffect(() => {
    const container = document.getElementById('game-container');
    if (!container || gameId !== 'platformer-lockstep') return;

    let cleanup: (() => void) | undefined;

    import('./game-platformer.js').then(mod => {
      cleanup = mod.mount(container);
    });

    return () => cleanup?.();
  }, [gameId]);

  return null;
}

const root = createRoot(document.getElementById('app')!);
root.render(<Launcher />);
