import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { StudioInspector } from './studio/StudioInspector.js';
import { parseManifest } from './assembly/manifest.js';
import { buildCapabilityCatalog } from './assembly/capability-catalog.js';
import { ALL_CAPABILITIES } from './assembly/capability-registry.js';
import type { WorldBlueprint } from './assembly/demo.assembly.js';

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
    description: '针线主题三消攒材料 → 主动缝制升级缝纫店做新衣 → 爱诗生成换装短视频。v0.3 可玩：点格消除、缝制解锁、换装展示。',
    color: '#3a1e2c',
    accentColor: '#ff7aa2',
    icon: '👗',
    status: 'playable',
  },
  {
    id: 'game-d',
    title: 'Game D: ARPG PoC',
    subtitle: '暗黑类 ARPG 切片',
    description: '冰霜新星冻住敌人 → 碎冰重锤只对冰冻目标结算 20% maxHP 真伤。纯数据战斗，零专属代码——由 prefab/overlap/trigger/hitbox/resource 五能力涌现。',
    color: '#1a0a08',
    accentColor: '#f97316',
    icon: '⚔️',
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
//  Cartridge + Carousel
// ══════════════════════════════════════

function Cartridge({ game, isSelected }: { game: GameEntry; isSelected: boolean }) {
  return (
    <div style={{
      width: 160,
      height: 240,
      position: 'relative',
      borderRadius: 10,
      background: `linear-gradient(160deg, ${game.color}f0 0%, ${game.color} 55%, #08090f 100%)`,
      border: `2px solid ${isSelected ? game.accentColor : 'rgba(255,255,255,0.13)'}`,
      boxShadow: isSelected
        ? `0 0 0 1px ${game.accentColor}44, 0 20px 52px rgba(0,0,0,0.75), 0 0 38px ${game.accentColor}28, inset 0 1px 0 rgba(255,255,255,0.12)`
        : '0 8px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
      overflow: 'hidden',
      userSelect: 'none',
      flexShrink: 0,
    }}>
      {/* Label */}
      <div style={{
        position: 'absolute',
        top: 10, left: 8, right: 8, bottom: 52,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '10px 8px',
      }}>
        <div style={{ fontSize: 42, lineHeight: 1 }}>{game.icon}</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3 }}>
            {game.title}
          </div>
          <div style={{ fontSize: 9, color: game.accentColor, marginTop: 3 }}>
            {game.subtitle}
          </div>
        </div>
      </div>

      {/* Connector strip */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 48,
        background: '#060810',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
      }}>
        <div style={{
          flex: 1, height: 20,
          backgroundImage: `repeating-linear-gradient(90deg,
            rgba(160,140,80,0.32) 0px, rgba(160,140,80,0.32) 5px,
            rgba(0,0,0,0.25) 5px, rgba(0,0,0,0.25) 9px
          )`,
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.04)',
        }} />
      </div>

      {/* Selected glow */}
      {isSelected && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 50% 10%, ${game.accentColor}1c 0%, transparent 62%)`,
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}

function CartridgeCarousel({ onLaunch }: { onLaunch: (id: string) => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const n = GAMES.length;
  const prevIdx = (activeIndex - 1 + n) % n;
  const nextIdx = (activeIndex + 1) % n;

  const goLeft = useCallback(() => setActiveIndex((i: number) => (i - 1 + n) % n), [n]);
  const goRight = useCallback(() => setActiveIndex((i: number) => (i + 1) % n), [n]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goLeft();
      else if (e.key === 'ArrowRight') goRight();
      else if (e.key === 'Enter') {
        const g = GAMES[activeIndex];
        if (g.status === 'playable') onLaunch(g.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeIndex, goLeft, goRight, onLaunch]);

  const selected = GAMES[activeIndex];

  const cardStyle = (i: number): React.CSSProperties => {
    const isCenter = i === activeIndex;
    const isPrev   = i === prevIdx;
    const isNext   = i === nextIdx;
    let tx = '0px', ty = '0px', scale = '0', opacity = 0;
    if (isCenter)     { tx = '0px';   ty = '0px';  scale = '1';    opacity = 1; }
    else if (isPrev)  { tx = '-178px'; ty = '22px'; scale = '0.72'; opacity = 0.52; }
    else if (isNext)  { tx = '178px';  ty = '22px'; scale = '0.72'; opacity = 0.52; }
    return {
      position: 'absolute' as const,
      left: '50%',
      top: '50%',
      marginLeft: -80,
      marginTop: -120,
      transform: `translateX(${tx}) translateY(${ty}) scale(${scale})`,
      transition: 'transform 0.38s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.38s ease',
      opacity,
      zIndex: isCenter ? 2 : 1,
      cursor: (isPrev || isNext) ? 'pointer' : 'default',
    };
  };

  const arrowStyle = (side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute' as const,
    top: '50%',
    [side]: 8,
    transform: 'translateY(-50%)',
    zIndex: 10,
    width: 36, height: 36,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '50%',
    color: '#94a3b8',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    outline: 'none',
    transition: 'all 0.18s',
  });

  return (
    <div style={{ width: '100%', maxWidth: 880 }}>
      {/* Stage */}
      <div style={{ position: 'relative', height: 288, overflow: 'visible' }}>
        <button onClick={goLeft} style={arrowStyle('left')}>◀</button>

        {GAMES.map((game, i) => (
          <div
            key={game.id}
            style={cardStyle(i)}
            onClick={i === prevIdx ? goLeft : i === nextIdx ? goRight : undefined}
          >
            <Cartridge game={game} isSelected={i === activeIndex} />
          </div>
        ))}

        <button onClick={goRight} style={arrowStyle('right')}>▶</button>
      </div>

      {/* Description */}
      <div style={{ textAlign: 'center', minHeight: 52, padding: '4px 80px' }}>
        <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.65, maxWidth: 400, margin: '0 auto' }}>
          {selected.description}
        </div>
      </div>

      {/* Launch */}
      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <button
          onClick={() => selected.status === 'playable' && onLaunch(selected.id)}
          disabled={selected.status !== 'playable'}
          style={{
            padding: '12px 60px',
            background: selected.status === 'playable'
              ? `linear-gradient(135deg, ${selected.accentColor}, ${selected.accentColor}cc)`
              : 'rgba(255,255,255,0.06)',
            color: selected.status === 'playable' ? '#0f172a' : '#475569',
            border: 'none',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.08em',
            cursor: selected.status === 'playable' ? 'pointer' : 'default',
            boxShadow: selected.status === 'playable'
              ? `0 4px 22px ${selected.accentColor}44, 0 0 0 1px ${selected.accentColor}33`
              : 'none',
            transition: 'all 0.22s',
            outline: 'none',
          }}
        >
          {selected.status === 'playable' ? '▶  LAUNCH' : 'COMING SOON'}
        </button>
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
            <ToolButton label="Bench" icon="⚡" running={running === 'Bench'} onClick={() => runTool('/api/bench', 'Bench')} />
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
      'game-d': () => import('./game-d.js'),
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
  const [studio, setStudio] = useState(false);
  const [studioExtra, setStudioExtra] = useState<{ id: string; title: string; build: () => WorldBlueprint } | null>(null);

  // 「在透视器里打开」：把生成的 manifest(原始 JSON)接进透视器。build 每次重新 parseManifest
  // (而非 clone——蓝图含 capability 函数对象，structuredClone/JSON 都会坏)，重置/重跑安全。
  const openInStudio = useCallback((name: string, raw: unknown) => {
    setStudioExtra({ id: 'generated', title: `生成 · ${name}`, build: () => parseManifest(raw) });
    setStudio(true);
  }, []);

  if (studio) {
    return (
      <StudioInspector
        onBack={() => {
          setStudio(false);
          setStudioExtra(null);
        }}
        extraGame={studioExtra ?? undefined}
      />
    );
  }

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
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: 5, color: '#475569', marginBottom: 6 }}>
          APOLLO ENGINE
        </div>
        <h1 style={{
          fontSize: 30,
          fontWeight: 800,
          background: 'linear-gradient(135deg, #38bdf8, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0,
        }}>
          Game Library
        </h1>
        <button
          onClick={() => setStudio(true)}
          style={{
            marginTop: 12,
            padding: '7px 16px',
            background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(56,189,248,0.15))',
            color: '#a78bfa',
            border: '1px solid rgba(167,139,250,0.3)',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          🔬 数据透视器
        </button>
      </div>

      {/* Game Carousel */}
      <CartridgeCarousel onLaunch={setLaunched} />

      {/* Game Creator (AI Generate) */}
      <div style={{ width: '100%', maxWidth: 880, marginBottom: 12 }}>
        <GameCreator onOpenInStudio={openInStudio} />
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

function GameCreator({ onOpenInStudio }: { onOpenInStudio: (name: string, raw: unknown) => void }) {
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
        // 从引擎 ALL_CAPABILITIES 自动派生能力目录随请求送出 → apollo.py 注入 System Prompt。
        // 引擎自描述：任何能力（hitbox/prefab/…）登记即对生成器可见，零 prompt 维护、不漂移。
        body: JSON.stringify({ prompt, provider, catalog: buildCapabilityCatalog(ALL_CAPABILITIES) }),
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
                    <button
                      onClick={() => {
                        try {
                          parseManifest(result.blueprint); // 先校验可加载
                          onOpenInStudio(result.blueprint?.name || 'game', result.blueprint);
                        } catch (e: any) {
                          setResult({ success: false, error: '无法加载到透视器：' + (e?.message ?? String(e)) });
                        }
                      }}
                      style={{
                        padding: '6px 14px', background: 'rgba(167,139,250,0.18)', color: '#a78bfa',
                        border: '1px solid rgba(167,139,250,0.4)', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      🔬 在透视器里打开
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
