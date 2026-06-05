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
    id: 'game-a',
    title: 'Game A: Co-op Adventure',
    subtitle: '双人协作冒险',
    description: '双人成行风格卷轴合作平台跳跃：两人携手穿越大关卡、合作相机跟随、踩升降台，到右端会合通关。',
    color: '#1e3a2f',
    accentColor: '#4ade80',
    icon: '🤝',
    status: 'playable',
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
  {
    id: 'game-c',
    title: 'Game C: Stitch & Style',
    subtitle: '缝纫物语 · 换装三消',
    description: '针线主题三消攒材料，缝纫店养成做新衣，爱诗视频秀出来。v0.1 工坊预览（三消核心待引擎能力 REQ-C-001）。',
    color: '#3a1e2c',
    accentColor: '#ff7aa2',
    icon: '👗',
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
    if (!containerRef.current) return;
    const loaders: Record<string, () => Promise<{ mount: (el: HTMLElement) => () => void }>> = {
      'game-a': () => import('./game-a.js'),
      'game-b': () => import('./game-b.js'),
      'game-c': () => import('./game-c.js'),
    };
    const loader = loaders[gameId];
    if (!loader) return;
    let cleanup: (() => void) | undefined;
    loader().then(mod => {
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

      {/* Game Creator (AI Generate) */}
      <div style={{ width: '100%', maxWidth: 880, marginBottom: 12 }}>
        <GameCreator />
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

// ══════════════════════════════════════
//  Game Creator (AI Generate)
// ══════════════════════════════════════

interface LLMProvider {
  id: string;
  name: string;
  models: string[];
  available: boolean;
}

function GameCreator() {
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [provider, setProvider] = useState('anthropic');
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [presets, setPresets] = useState<Record<string, { name: string; description: string }>>({});
  const [result, setResult] = useState<{ success: boolean; error?: string; blueprint?: any; warnings?: string[] } | null>(null);
  const [apiOk, setApiOk] = useState(false);

  useEffect(() => {
    Promise.all([
      apiCall('/api/generate/providers').then(d => { setProviders(d); setApiOk(true); }).catch(() => {}),
      apiCall('/api/generate/presets').then(d => setPresets(d)).catch(() => {}),
    ]);
  }, []);

  const generate = useCallback(async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, provider }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ success: false, error: e.message });
    }
    setGenerating(false);
  }, [prompt, provider]);

  const loadPreset = useCallback(async (name: string) => {
    setGenerating(true);
    setResult(null);
    try {
      const data = await apiCall(`/api/generate/preset/${name}`);
      setResult(data);
    } catch (e: any) {
      setResult({ success: false, error: e.message });
    }
    setGenerating(false);
  }, []);

  const availableProviders = providers.filter(p => p.available);

  const EXAMPLES = [
    '做一个双人平台跳跃游戏，有重力和弹跳',
    'Make a pong game with two paddles',
    '一个小球在方块间弹跳的物理沙盒',
    '两个玩家抢夺中间金币的对战游戏',
  ];

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(56,189,248,0.08))',
      borderRadius: 10,
      border: '1px solid rgba(167,139,250,0.15)',
      padding: 16,
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <span style={{ color: '#a78bfa' }}>Create Game</span>
          <span style={{ color: '#64748b', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
            Describe a game, AI builds it
          </span>
        </span>
        <span style={{ color: '#475569', fontSize: 18 }}>{expanded ? '−' : '+'}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          {/* Provider selector */}
          {availableProviders.length > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontSize: 12 }}>AI Provider:</span>
              {providers.map(p => (
                <button
                  key={p.id}
                  onClick={() => p.available && setProvider(p.id)}
                  style={{
                    padding: '3px 10px',
                    background: provider === p.id ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)',
                    color: p.available ? (provider === p.id ? '#a78bfa' : '#94a3b8') : '#334155',
                    border: `1px solid ${provider === p.id ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: p.available ? 'pointer' : 'default',
                    opacity: p.available ? 1 : 0.4,
                  }}
                >
                  {p.name}{!p.available ? ' (no key)' : ''}
                </button>
              ))}
            </div>
          )}

          {/* Prompt input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !generating && generate()}
              placeholder="Describe your game in one sentence..."
              style={{
                flex: 1, padding: '10px 14px',
                background: 'rgba(0,0,0,0.3)',
                color: '#e2e8f0',
                border: '1px solid rgba(167,139,250,0.2)',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              onClick={generate}
              disabled={generating || !prompt.trim()}
              style={{
                padding: '10px 20px',
                background: generating ? 'rgba(167,139,250,0.1)' : 'linear-gradient(135deg, #a78bfa, #38bdf8)',
                color: generating ? '#64748b' : '#0f172a',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                cursor: generating ? 'wait' : 'pointer',
                whiteSpace: 'nowrap' as const,
              }}
            >
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>

          {/* Example prompts */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setPrompt(ex)}
                style={{
                  padding: '4px 10px',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#64748b',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {ex}
              </button>
            ))}
          </div>

          {/* Presets */}
          {Object.keys(presets).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 6 }}>Quick presets (no API needed):</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {Object.entries(presets).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => loadPreset(key)}
                    style={{
                      padding: '6px 14px',
                      background: 'rgba(255,255,255,0.06)',
                      color: '#94a3b8',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{
              marginTop: 12, padding: 12,
              background: result.success ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${result.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              borderRadius: 8,
            }}>
              {result.success ? (
                <div>
                  <div style={{ color: '#22c55e', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                    Generated: {result.blueprint?.name}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>
                    {result.blueprint?.description} · {result.blueprint?.entities?.length ?? 0} entities
                  </div>
                  {result.warnings && result.warnings.length > 0 && (
                    <div style={{
                      color: '#fbbf24', fontSize: 11, marginBottom: 8,
                      padding: '6px 10px', background: 'rgba(251,191,36,0.08)',
                      borderRadius: 4, border: '1px solid rgba(251,191,36,0.15)',
                    }}>
                      {result.warnings.map((w, i) => <div key={i}>Warning: {w}</div>)}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(result.blueprint, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = `${result.blueprint?.name || 'game'}.json`;
                        a.click(); URL.revokeObjectURL(url);
                      }}
                      style={{
                        padding: '6px 14px', background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                        border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      Download Blueprint
                    </button>
                    <button
                      onClick={() => navigator.clipboard?.writeText(JSON.stringify(result.blueprint, null, 2))}
                      style={{
                        padding: '6px 14px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      Copy JSON
                    </button>
                  </div>
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ color: '#64748b', fontSize: 11, cursor: 'pointer' }}>View Blueprint JSON</summary>
                    <pre style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.4, marginTop: 4, maxHeight: 200, overflow: 'auto' }}>
                      {JSON.stringify(result.blueprint, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : (
                <div style={{ color: '#ef4444', fontSize: 13 }}>
                  Error: {result.error}
                </div>
              )}
            </div>
          )}

          {/* API status hint */}
          {!apiOk && (
            <div style={{ marginTop: 8, color: '#475569', fontSize: 11 }}>
              Start with <code style={{ color: '#94a3b8' }}>python3 apollo.py</code> to enable AI generation.
              Presets work without API.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════
//  Mount
// ══════════════════════════════════════

const root = createRoot(document.getElementById('app')!);
root.render(<Launcher />);
