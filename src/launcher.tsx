import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { StudioInspector } from './studio/StudioInspector.js';
import { AssetLibrary } from './studio/AssetLibrary.js';
import { SHELL, sBackPill } from './ui/shell-theme.js';
import { resolveArtRefs } from './assembly/resolve-art-refs.js';
import { artlibRecords, type LibraryRecord } from '@assets/index.js';
import type { ArtLibIndex } from '@assets/artlib.js';
import { parseManifest } from './assembly/manifest.js';
import { deriveAssetIndex } from './assembly/derive-asset-index.js';
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
    id: 'game-e',
    title: 'Game E: Balatro-like',
    subtitle: '小丑牌 · 卡牌构建',
    description: '选最多 5 张 → 真引擎认牌型 + 逐张筹码 + 小丑有序加乘 = 分数砸 Boss。牌面取自 cards.png 切图、小丑真美术。计分全由 poker-hand/effect-apply 通用能力涌现，零游戏专属系统。',
    color: '#1a1020',
    accentColor: '#f59e0b',
    icon: '🃏',
    status: 'playable',
  },
  {
    id: 'game-d',
    title: 'Game D: Diablo-like ARPG',
    subtitle: '暗黑类 ARPG 切片',
    description: '纯数据装配的暗黑类切片：WASD 移动，1/2/3 释放冰霜新星(冻)/碎冰重锤(对冰冻怪真伤)/烈焰(灼烧 DoT)。怪会追你、冻=定身、杀死掉落。AI/技能/战斗全由通用能力涌现，零 ARPG 专属代码。',
    color: '#2a1118',
    accentColor: '#ef4444',
    icon: '⚔️',
    status: 'playable',
  },
  {
    id: 'game-f',
    title: 'Game F: Pixel Three Kingdoms',
    subtitle: '像素三分天下 · 自走棋',
    description: '三国自走棋切片：蜀(红) vs 魏(蓝) 全自动对战——棋子索敌、走位、普攻互砍、团灭判胜。AI/普攻/战斗全由通用能力（aggro/steering/caster/hitbox/mortal）涌现，零自走棋专属代码。三国感靠命名+势力分色，美术走 DCSS 换皮。',
    color: '#2a1f12',
    accentColor: '#e0a83e',
    icon: '♟️',
    status: 'playable',
  },
  {
    id: 'game-g',
    title: 'Game G: Fateflip Poker',
    subtitle: '翻命扑克 · 3D 掷命骨架',
    description: '拟人扑克的空中掷命对决（3D 表现骨架）：outcome-first——胜负先定，物理翻牌是反推的表现（tween 把牌翻到既定面，正面金=活/反面石板=死）。Three.js 渲染后端骨架，验证 3D 表现层接入；翻牌不决定胜负→跨端浮点不影响 gameplay。',
    color: '#10212a',
    accentColor: '#22d3ee',
    icon: '🎴',
    status: 'playable',
  },
  {
    id: 'game-h',
    title: 'Game H: Blackjack',
    subtitle: '二十一点 · 传统纸牌',
    description: '经典 21 点纸牌游戏：玩家与庄家对赌，目标手牌总和接近 21 点不超出。纯数据驱动：蓝图装配 4 个原子能力，点数计算与胜负判定由 React 组件实现。庄家 AI 全自动（17 点站住）。',
    color: '#1a2634',
    accentColor: '#4ade80',
    icon: '💰',
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
      'game-e': () => import('./game-e.js'),
      'game-d': () => import('./game-d.js'),
      'game-f': () => import('./games/game-f/game-f.js'),
      'game-g': () => import('./games/game-g/game-g.js'),
      'game-h': () => import('./game-h.js'),
    };
    const loader = loaders[gameId];
    if (!loader) return;
    // 异步竞态防护：若组件在 loader 完成前已卸载（快速切游戏 / 退回主页），late-resolve 不得再 mount
    // ——否则前一个游戏的引擎在新画面里成孤儿后台空跑（"两个引擎"症状的一种来源）。
    let disposed = false;
    let cleanup: (() => void) | undefined;
    loader().then(mod => {
      if (disposed || !containerRef.current) return;
      cleanup = mod.mount(containerRef.current);
      if (disposed) { cleanup?.(); cleanup = undefined; } // mount 期间又被卸载 → 立即清
    });
    return () => { disposed = true; cleanup?.(); };
  }, [gameId]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: SHELL.bg0 }}>
      {/* 全游戏统一的返回浮钮（壳层所有，游戏代码不掺和）—— 视觉基调见 ui/shell-theme.ts */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 100 }}>
        <button onClick={onBack} style={sBackPill()}>
          ⟵ 返回主界面
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
  // 「正在玩哪个游戏」进 URL（?game=id）：游戏选择若只是 React 状态，任何全页 reload
  // （HMR 失联恢复 / 依赖再优化 / 手动刷新）都会把人弹回主页——这正是「点游戏几秒后跳回主页」
  // 系列 bug 的放大器（根因之一 stdout pipe 阻塞已修，此处把"导航被 reload 清零"永久防住）。
  const [launched, setLaunchedState] = useState<string | null>(() => {
    const q = new URLSearchParams(window.location.search).get('game');
    return q && GAMES.some((g) => g.id === q && g.status === 'playable') ? q : null;
  });
  const setLaunched = useCallback((id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('game', id);
    else url.searchParams.delete('game');
    window.history.replaceState(null, '', url);
    setLaunchedState(id);
  }, []);
  const [studio, setStudio] = useState(false);
  const [artlib, setArtlib] = useState(false);
  const [studioExtra, setStudioExtra] = useState<{ id: string; title: string; build: () => WorldBlueprint } | null>(null);

  // 素材库记录（AI 选材解析用）：启动时拉一次索引，失败不阻塞（art: 引用原样留 → 渲染占位）。
  const artRecordsRef = React.useRef<LibraryRecord[] | null>(null);
  useEffect(() => {
    fetch('/assets/FreeArtLib/index.json')
      .then((r) => r.json())
      .then((j) => { artRecordsRef.current = artlibRecords(j as ArtLibIndex); })
      .catch(() => { artRecordsRef.current = null; });
  }, []);

  // 「在透视器里打开」：把生成的 manifest(原始 JSON)接进透视器。build 每次重新 parseManifest
  // (而非 clone——蓝图含 capability 函数对象，structuredClone/JSON 都会坏)，重置/重跑安全。
  // 进透视器前先过 art: 选材解析（确定性 rankRecords top-1，留痕 console 供审计）。
  const openInStudio = useCallback((name: string, raw: unknown) => {
    let manifest = raw;
    const records = artRecordsRef.current;
    if (records) {
      const { manifest: resolved, resolutions } = resolveArtRefs(raw, records);
      manifest = resolved;
      if (resolutions.length > 0) {
        console.info('[art-resolve] AI 选材解析（query → id；同 query 永远同结果）：',
          resolutions.map((r) => `${r.entity}.${r.component}.${r.field}: "${r.query}" → ${r.id ?? '∅ 无命中(原样保留)'}${r.candidates.length > 1 ? `（候选: ${r.candidates.join(', ')}）` : ''}`));
      }
    }
    setStudioExtra({ id: 'generated', title: `生成 · ${name}`, build: () => parseManifest(manifest) });
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

  if (artlib) {
    return <AssetLibrary onBack={() => setArtlib(false)} />;
  }

  if (launched) {
    return <GameRunner gameId={launched} onBack={() => setLaunched(null)} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: SHELL.pageBg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '36px 20px',
      fontFamily: SHELL.fontUi,
    }}>
      {/* Header —— 壳层统一基调（清幽·高雅·秩序）：阔字距铭牌 + 青瓷×黛紫渐变字 + 发丝线分隔 */}
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <div style={{ fontSize: 11, letterSpacing: 6, color: SHELL.faint, marginBottom: 8 }}>
          A P O L L O &nbsp;E N G I N E
        </div>
        <h1 style={{
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: 2,
          background: `linear-gradient(135deg, ${SHELL.jade}, ${SHELL.violet})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0,
        }}>
          Game Library
        </h1>
        <div style={{ width: 180, height: 1, background: `linear-gradient(90deg, transparent, ${SHELL.lineStrong}, transparent)`, margin: '14px auto 0' }} />
        <button
          onClick={() => setStudio(true)}
          style={{
            marginTop: 14,
            padding: '7px 18px',
            background: SHELL.violetWash,
            color: SHELL.violet,
            border: `1px solid ${SHELL.violetLine}`,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          🔬 数据透视器
        </button>
        <button
          onClick={() => setArtlib(true)}
          style={{
            marginTop: 14,
            marginLeft: 10,
            padding: '7px 18px',
            background: SHELL.jadeWash,
            color: SHELL.jade,
            border: `1px solid ${SHELL.jadeLine}`,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          🗃 资源库
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
        color: SHELL.faint,
        fontSize: 11,
        letterSpacing: 2,
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
                  {/* R9 乙：从 AI 生成的蓝图自动派生「本局所需资产」清单（key 与逻辑同源，缺图自动占位）。 */}
                  {(() => {
                    try {
                      const bp = parseManifest(result.blueprint);
                      const idx = deriveAssetIndex(bp.capabilities, bp.entities);
                      if (idx.assets.length === 0) return null;
                      return (
                        <div style={{
                          color: '#a78bfa', fontSize: 11, marginBottom: 8,
                          padding: '6px 10px', background: 'rgba(167,139,250,0.08)',
                          borderRadius: 4, border: '1px solid rgba(167,139,250,0.15)',
                        }}>
                          🎨 引擎自动提取本局所需资产 {idx.assets.length} 项（待填充，缺图自动占位）：{idx.assets.map(a => a.id).join('、')}
                        </div>
                      );
                    } catch { return null; }
                  })()}
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
