import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

const API = 'http://localhost:4000';

// ══════════════════════════════════════
//  Types
// ══════════════════════════════════════

interface GameEntry {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  accentColor: string;
  icon: string;
  status: 'playable' | 'coming-soon';
}

interface ProjectStatus {
  branch: string;
  lastCommit: string;
  atoms: number;
  testFiles: number;
  themes: string[];
  skillModules: number;
  games: string[];
}

interface CmdResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number;
}

// ══════════════════════════════════════
//  Game Registry
// ══════════════════════════════════════

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
  },
  {
    id: 'game-a',
    title: 'Game A: Co-op Adventure',
    subtitle: '双人协作冒险',
    description: '双人成行风格。踩开关、抛射搭档、绳索摆荡，只有合作才能通关。',
    color: '#1e3a2f',
    accentColor: '#4ade80',
    icon: '🤝',
    status: 'coming-soon',
  },
  {
    id: 'game-b',
    title: 'Game B: Otome VN',
    subtitle: '乙游视觉小说',
    description: '娱乐圈乙女养成。选择驱动剧情，属性决定命运，多结局。',
    color: '#3a1e3a',
    accentColor: '#e8618c',
    icon: '🌸',
    status: 'playable',
  },
];

// ══════════════════════════════════════
//  API helpers
// ══════════════════════════════════════

async function apiCall(endpoint: string): Promise<any> {
  const res = await fetch(`${API}${endpoint}`);
  return res.json();
}

// ══════════════════════════════════════
//  Components
// ══════════════════════════════════════

function GameCard({ game, onLaunch }: { game: GameEntry; onLaunch: () => void }) {
  const [hovered, setHovered] = useState(false);
  const playable = game.status === 'playable';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={playable ? onLaunch : undefined}
      style={{
        width: 260,
        background: hovered ? `linear-gradient(135deg, ${game.color}, ${game.color}dd)` : game.color,
        borderRadius: 12,
        border: `1px solid ${hovered && playable ? game.accentColor : 'rgba(255,255,255,0.1)'}`,
        padding: 20,
        cursor: playable ? 'pointer' : 'default',
        transition: 'all 0.25s ease',
        transform: hovered && playable ? 'translateY(-4px)' : 'none',
        boxShadow: hovered && playable
          ? `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${game.accentColor}33`
          : '0 4px 16px rgba(0,0,0,0.3)',
        opacity: playable ? 1 : 0.6,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 10,
      }}
    >
      <div style={{ fontSize: 36 }}>{game.icon}</div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{game.title}</div>
        <div style={{ fontSize: 12, color: game.accentColor, marginTop: 2 }}>{game.subtitle}</div>
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{game.description}</div>
      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 16px',
          background: playable ? game.accentColor : 'rgba(255,255,255,0.08)',
          color: playable ? '#0f172a' : '#64748b',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
        }}>
          {playable ? 'Launch' : 'Coming Soon'}
        </div>
      </div>
    </div>
  );
}

// ── Dev Tools Panel ──

function ToolButton({ label, icon, running, onClick }: {
  label: string; icon: string; running: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={running}
      style={{
        padding: '8px 14px',
        background: running ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
        color: running ? '#64748b' : '#e2e8f0',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6,
        cursor: running ? 'wait' : 'pointer',
        fontSize: 13,
        fontFamily: 'monospace',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 0.15s',
      }}
    >
      <span>{running ? '...' : icon}</span>
      <span>{label}</span>
    </button>
  );
}

function OutputPanel({ title, result, onClose }: {
  title: string; result: CmdResult | null; onClose: () => void;
}) {
  if (!result) return null;
  return (
    <div style={{
      background: '#0f172a',
      border: `1px solid ${result.success ? '#22c55e44' : '#ef444444'}`,
      borderRadius: 8,
      padding: 16,
      marginTop: 12,
      maxHeight: 300,
      overflow: 'auto',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      }}>
        <span style={{
          color: result.success ? '#22c55e' : '#ef4444',
          fontSize: 13,
          fontWeight: 600,
        }}>
          {result.success ? 'PASS' : 'FAIL'} — {title}
          {result.code !== undefined && ` (exit ${result.code})`}
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#64748b',
          cursor: 'pointer', fontSize: 16,
        }}>x</button>
      </div>
      <pre style={{
        color: '#94a3b8',
        fontSize: 12,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        margin: 0,
      }}>
        {result.stdout || result.stderr || '(no output)'}
      </pre>
    </div>
  );
}

function StatusBar({ status }: { status: ProjectStatus | null }) {
  if (!status) return null;
  return (
    <div style={{
      display: 'flex',
      gap: 16,
      flexWrap: 'wrap',
      fontSize: 12,
      color: '#64748b',
      padding: '8px 0',
    }}>
      <span>Branch: <b style={{ color: '#94a3b8' }}>{status.branch}</b></span>
      <span>Atoms: <b style={{ color: '#38bdf8' }}>{status.atoms}/26</b></span>
      <span>Tests: <b style={{ color: '#94a3b8' }}>{status.testFiles}</b></span>
      <span>Skills: <b style={{ color: '#94a3b8' }}>{status.skillModules}</b></span>
      <span>Themes: <b style={{ color: '#a78bfa' }}>{status.themes?.length ?? 0}</b></span>
    </div>
  );
}

function DevTools() {
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<{ title: string; data: CmdResult } | null>(null);
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [apiOk, setApiOk] = useState(false);

  useEffect(() => {
    apiCall('/api/status')
      .then(data => { setStatus(data); setApiOk(true); })
      .catch(() => setApiOk(false));
  }, []);

  const runTool = useCallback(async (endpoint: string, label: string) => {
    setRunning(label);
    setResult(null);
    try {
      const data = await apiCall(endpoint);
      setResult({ title: label, data });
      if (endpoint === '/api/status') setStatus(data);
    } catch {
      setResult({ title: label, data: { success: false, stdout: '', stderr: 'API unreachable', code: -1 } });
    }
    setRunning(null);
  }, []);

  if (!apiOk) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        padding: '10px 16px',
        fontSize: 12,
        color: '#475569',
        textAlign: 'center',
      }}>
        Dev Tools offline — start with <code style={{ color: '#94a3b8' }}>python3 apollo.py</code> to enable
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.06)',
      padding: 16,
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{ color: '#94a3b8', fontSize: 14, fontWeight: 600 }}>
          Dev Tools
        </span>
        <span style={{ color: '#475569', fontSize: 18 }}>{expanded ? '−' : '+'}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          <StatusBar status={status} />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <ToolButton label="Run Tests" icon="T" running={running === 'Tests'} onClick={() => runTool('/api/test', 'Tests')} />
            <ToolButton label="Type Check" icon="TS" running={running === 'TypeCheck'} onClick={() => runTool('/api/typecheck', 'TypeCheck')} />
            <ToolButton label="Build" icon="B" running={running === 'Build'} onClick={() => runTool('/api/build', 'Build')} />
            <ToolButton label="Git Log" icon="G" running={running === 'Git Log'} onClick={() => runTool('/api/git-log', 'Git Log')} />
            <ToolButton label="Git Status" icon="S" running={running === 'Git Status'} onClick={() => runTool('/api/git-status', 'Git Status')} />
            <ToolButton label="Git Pull" icon="P" running={running === 'Git-pull'} onClick={() => runTool('/api/git-pull', 'Git-pull')} />
            <ToolButton label="Refresh" icon="R" running={running === 'Status'} onClick={() => runTool('/api/status', 'Status')} />
          </div>

          <OutputPanel
            title={result?.title ?? ''}
            result={result?.data ?? null}
            onClose={() => setResult(null)}
          />
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════
//  Game Runtime
// ══════════════════════════════════════

function GameRunner({ gameId, onBack }: { gameId: string; onBack: () => void }) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || gameId !== 'platformer-lockstep') return;
    let cleanup: (() => void) | undefined;
    import('./game-platformer.js').then(mod => {
      if (containerRef.current) cleanup = mod.mount(containerRef.current);
    });
    return () => cleanup?.();
  }, [gameId]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0a0f1e' }}>
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 100 }}>
        <button
          onClick={onBack}
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
          Back to Library
        </button>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

// ══════════════════════════════════════
//  Main Launcher
// ══════════════════════════════════════

function Launcher() {
  const [launched, setLaunched] = useState<string | null>(null);

  if (launched) {
    return <GameRunner gameId={launched} onBack={() => setLaunched(null)} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0f1e 0%, #111827 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 20px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 12, letterSpacing: 4, color: '#475569', marginBottom: 6 }}>
          APOLLO ENGINE
        </div>
        <h1 style={{
          fontSize: 32,
          fontWeight: 800,
          background: 'linear-gradient(135deg, #38bdf8, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0,
        }}>
          Game Library
        </h1>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
          Select a game to launch — or use Dev Tools below
        </div>
      </div>

      {/* Game Grid */}
      <div style={{
        display: 'flex',
        gap: 20,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 880,
        marginBottom: 32,
      }}>
        {GAMES.map(game => (
          <GameCard key={game.id} game={game} onLaunch={() => setLaunched(game.id)} />
        ))}
      </div>

      {/* Dev Tools */}
      <div style={{ width: '100%', maxWidth: 880 }}>
        <DevTools />
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 'auto',
        paddingTop: 32,
        textAlign: 'center',
        color: '#334155',
        fontSize: 11,
      }}>
        Apollo Engine v0.6 · 26 Atoms · Tier 1-2 · Deterministic Lockstep
      </div>
    </div>
  );
}

<<<<<<< HEAD
// 卡带加载器：gameId → 该游戏的可挂载模块（静态 import 串，Vite 友好）。
// 新增 game-b（PB）。后续 game-a 等就绪后在此加一行即可。
const GAME_LOADERS: Record<string, () => Promise<{ mount: (c: HTMLElement) => () => void }>> = {
  'platformer-lockstep': () => import('./game-platformer.js'),
  'game-b': () => import('./game-b.js'),
};

function GameLoader({ gameId }: { gameId: string }) {
  React.useEffect(() => {
    const container = document.getElementById('game-container');
    const load = GAME_LOADERS[gameId];
    if (!container || !load) return;

    let cleanup: (() => void) | undefined;

    load().then(mod => {
      cleanup = mod.mount(container);
    });

    return () => cleanup?.();
  }, [gameId]);

  return null;
}
=======
// ══════════════════════════════════════
//  Mount
// ══════════════════════════════════════
>>>>>>> 772c31d (feat: integrated dev tools panel in launcher UI + Python API backend)

const root = createRoot(document.getElementById('app')!);
root.render(<Launcher />);
