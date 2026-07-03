import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { StudioInspector } from './studio/StudioInspector.js';
import { AssetLibrary } from './studio/AssetLibrary.js';
import { SHELL, sGearBtn, sMenuPanel, sMenuItem } from './ui/shell-theme.js';
import { resolveArtRefs } from './assembly/resolve-art-refs.js';
import { artlibRecords, type LibraryRecord } from '@assets/index.js';
import type { ArtLibIndex } from '@assets/artlib.js';
import { parseManifest } from './assembly/manifest.js';
import { deriveAssetIndex } from './assembly/derive-asset-index.js';
import { buildCapabilityCatalog } from './assembly/capability-catalog.js';
import { ALL_CAPABILITIES } from './assembly/capability-registry.js';
import type { WorldBlueprint } from './assembly/demo.assembly.js';
import {
  metaToGameEntry, libSlug, providerStatus, LIB_ID_PREFIX,
  type GameEntry, type LibraryEntry, type ProviderInfo,
} from './studio/library-model.js';
import {
  DataCartridgeRunner, LibraryShelf, LibActionBar, VersionHistoryOverlay, StatusLight, BenchOverlay,
} from './studio/DataCartridgeRunner.js';
import { CreationWizard, type WizardMode } from './studio/CreationWizard.js';
import { DesignStudio, EntryChoice, ContinueChoice } from './studio/DesignStudio.js';
import { SettingsPanel } from './studio/SettingsPanel.js';

const API = 'http://localhost:4000';

// ══════════════════════════════════════
//  Types
// ══════════════════════════════════════

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
    subtitle: '翻命扑克 · 实时三路掷命',
    description: '拟人扑克的实时三路行军博弈：布局阶段铺底牌 → 手牌实时派上/中/下、读秒暂停 → 兵一格格慢慢爬、过门线显形 → 最前两张相邻「命运一掷」（点数+经营+士气=战力 → 胜率区间 → 掷点定生死，可读）→ 突破敌 3 血大本营先破者胜。outcome-first：胜负规则定、可回放；大厅忠实港绿呢牌桌双皮。',
    color: '#10212a',
    accentColor: '#22d3ee',
    icon: '🎴',
    status: 'playable',
  },
  {
    id: 'game-i',
    title: 'Game I: UI Gallery',
    subtitle: '控件测试场 · 数据驱动 UI',
    description: '它不做玩法——「玩法」就是玩 UI。把引擎 15 个数据驱动控件按「容器与布局 / 数据展示 / 输入与交互」三页铺成可玩画廊：换皮（三套 UITheme 令牌）、事件日志实时看信号流。画廊本体 100% LayoutNode 纯数据，渲染走 renderNode、挂载走 mountUI，零重造控件。以后游戏的 UI 都从这套底座搭。',
    color: '#0f1722',
    accentColor: '#7fc7e8',
    icon: '🎛️',
    status: 'playable',
  },
  {
    id: 'game-h',
    title: 'Game H: 3D Blackjack',
    subtitle: '二十一点 · 3D 俯视角赌桌',
    description: '经典 21 点纸牌游戏的 3D 版本：俯视角赌桌、3D 渲染卡牌与筹码。玩家与庄家对赌，目标手牌总和接近 21 点不超出。纯 three.js 渲染：程序生成的 3D 模型、Canvas 纹理卡牌、彩色筹码堆。庄家 AI 全自动（17 点站住）。支持分牌与多手牌对战。',
    color: '#1a2634',
    accentColor: '#4ade80',
    icon: '🎰',
    status: 'playable',
  },
  {
    id: 'game-x',
    title: 'Game X: 残响 Living Companion',
    subtitle: '掌上伴侣 · 时间感知 Desk Mode',
    description: '「一个住在你桌上的人。」LovePlus 在 AI 时代的复活——基础框架：时间感知系统（她知道现在几点、星期几、你多久没来）驱动 Desk Mode，角色按真实作息在桌面生活；拿起设备进 Pocket Mode 用引擎 dialogue 能力对话，放回时把暖意写回关系记录（localStorage 跨会话真实流动）。首发两位：内敛的林七月 / 元气的宋 Mika。角色作息、缺席反应、问候全是数据；时间→活动派生纯函数可测。表现层待 designer 接入。',
    color: '#16121f',
    accentColor: '#d8607b',
    icon: '🕯️',
    status: 'playable',
  },
  {
    id: 'game-z',
    title: 'Game Z: 盒庭 Diorama',
    subtitle: '3D 微缩盒庭 · Captain Toad 风渲染线',
    description: '不做玩法（先放一边）——它是引擎「3D 盒庭」渲染线的底座：草地台 + 抬升石台站着 Toad + 金阶梯 + 终点宝石 + 蘑菇，全是 Transform3D（真三维位姿·地面 XZ + Y 高度）+ Mesh3D（体块）的纯数据；一个 Camera3D 单例把场景切进盒庭模式——引擎 ThreeRenderer 按 yaw/pitch 轨道取景、柔和接触阴影、暖白主光 + 冷蓝补光、哑光材质。换一组数字即换一个盒庭，零手写 Three.js。后续长出：移轴景深 / 模型导入 / 可旋转交互 / 玩法。',
    color: '#0b1020',
    accentColor: '#9ccc65',
    icon: '🧊',
    status: 'playable',
  },
  {
    id: 'game-d',
    title: 'Game D: 骰途 Dice & Dungeons',
    subtitle: '双人骰子 Roguelike · 3D 场景骨架',
    description: '「所有战斗都用掷骰子解决」的双人合作 Roguelike——两人各带骰池、一关一关往前闯，过关三选一拿 buff（哈迪斯式），骰子凑不够掏宝物消耗品救场，打穿一层拿局外永久解锁，全灭重开。当前=场景骨架：无限程序化房间流（分层 + 每层 2 战斗 + 1 BOSS）串成往上推进的地牢，近俯视一屏一战场、房间流式生成/卸载；精装管线（暖冷光 + 移轴景深 + 泛光 + 软影 + 天空盒）让美术不糙。战斗/骰子/敌人后续接入（见 docs/design/game-d/combat-design.md）。',
    color: '#140e1f',
    accentColor: '#c084fc',
    icon: '🎲',
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

function useKeyframes() {
  useEffect(() => {
    const id = 'apollo-launcher-kf';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      @keyframes al-shimmer {
        0%   { transform: translateX(-120%) skewX(-12deg); }
        100% { transform: translateX(380%)  skewX(-12deg); }
      }
      @keyframes al-pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.72; }
      }
    `;
    document.head.appendChild(s);
  }, []);
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
      {/* Selected shimmer sweep */}
      {isSelected && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 10 }}>
          <div style={{
            position: 'absolute', top: 0, bottom: 0, width: '40%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)',
            animation: 'al-shimmer 3s ease-in-out infinite',
          }} />
        </div>
      )}
      {/* Selected top glint */}
      {isSelected && (
        <div style={{
          position: 'absolute', top: 0, left: '12%', right: '12%', height: 1,
          background: `linear-gradient(90deg, transparent, ${game.accentColor}88, transparent)`,
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}

function CartridgeCarousel({ onLaunch, games = GAMES, renderLaunchArea, selectId, onSelected }: {
  onLaunch: (id: string) => void;
  games?: GameEntry[];
  /** 选中卡带的启动区自定义（library 卡带 → 四键操作条）；返回 null → 默认单个 LAUNCH 大按钮。 */
  renderLaunchArea?: (selected: GameEntry) => React.ReactNode | null;
  /** 保存新卡带后请求选中该 id（`lib:<slug>`）；出现在列表里即跳到它。 */
  selectId?: string;
  /** 跳转完成回调（供上层把 selectId 清成一次性，避免之后每次刷架都重新跳）。 */
  onSelected?: () => void;
}) {
  const [rawIndex, setActiveIndex] = useState(0);
  const [arrowHover, setArrowHover] = useState<'left' | 'right' | null>(null);
  const n = games.length;
  // 列表可能变短（切玩家/开发模式、库刷新）→ 夹取，避免越界。
  const activeIndex = n > 0 ? rawIndex % n : 0;
  const prevIdx  = (activeIndex - 1 + n) % n;
  const nextIdx  = (activeIndex + 1) % n;
  const prevPrev = (activeIndex - 2 + n) % n;
  const nextNext = (activeIndex + 2) % n;

  const goLeft = useCallback(() => setActiveIndex((i: number) => (i - 1 + n) % n), [n]);
  const goRight = useCallback(() => setActiveIndex((i: number) => (i + 1) % n), [n]);

  // 保存新卡带后跳到它（onSaved → 刷库 → 新条目进 games → 这里选中·一次性）。
  useEffect(() => {
    if (!selectId) return;
    const idx = games.findIndex((g) => g.id === selectId);
    if (idx >= 0) { setActiveIndex(idx); onSelected?.(); }
  }, [selectId, games, onSelected]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goLeft();
      else if (e.key === 'ArrowRight') goRight();
      else if (e.key === 'Enter') {
        const g = games[activeIndex];
        if (g && g.status === 'playable') onLaunch(g.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeIndex, goLeft, goRight, onLaunch, games]);

  const selected = games[activeIndex];
  if (!selected) return null; // 空列表（玩家模式空库由 LibraryShelf 呈现，不进轮播）

  const cardStyle = (i: number): React.CSSProperties => {
    const isCenter   = i === activeIndex;
    const isPrev     = i === prevIdx;
    const isNext     = i === nextIdx;
    const isPrevPrev = n > 4 && i === prevPrev && i !== prevIdx && i !== activeIndex;
    const isNextNext = n > 4 && i === nextNext && i !== nextIdx && i !== activeIndex;
    let tx = '0px', ty = '0px', scale = '0', opacity = 0;
    if (isCenter)        { tx = '0px';    ty = '0px';  scale = '1';    opacity = 1; }
    else if (isPrev)     { tx = '-178px'; ty = '22px'; scale = '0.72'; opacity = 0.52; }
    else if (isNext)     { tx = '178px';  ty = '22px'; scale = '0.72'; opacity = 0.52; }
    else if (isPrevPrev) { tx = '-295px'; ty = '40px'; scale = '0.52'; opacity = 0.18; }
    else if (isNextNext) { tx = '295px';  ty = '40px'; scale = '0.52'; opacity = 0.18; }
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
    transform: arrowHover === side ? 'translateY(-50%) scale(1.15)' : 'translateY(-50%)',
    zIndex: 10,
    width: 36, height: 36,
    background: arrowHover === side ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${arrowHover === side ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: '50%',
    color: arrowHover === side ? '#e2e8f0' : '#94a3b8',
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
        <button onClick={goLeft} style={arrowStyle('left')}
          onMouseEnter={() => setArrowHover('left')}
          onMouseLeave={() => setArrowHover(null)}>◀</button>

        {/* Ambient color glow behind active card */}
        <div style={{
          position: 'absolute',
          width: 320, height: 320,
          background: `radial-gradient(circle, ${selected.accentColor}18 0%, transparent 68%)`,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          transition: 'background 0.5s ease',
          borderRadius: '50%',
        }} />

        {games.map((game, i) => (
          <div
            key={game.id}
            style={cardStyle(i)}
            onClick={i === prevIdx ? goLeft : i === nextIdx ? goRight : undefined}
          >
            <Cartridge game={game} isSelected={i === activeIndex} />
          </div>
        ))}

        <button onClick={goRight} style={arrowStyle('right')}
          onMouseEnter={() => setArrowHover('right')}
          onMouseLeave={() => setArrowHover(null)}>▶</button>
      </div>

      {/* Dot indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, padding: '10px 0 2px' }}>
        {games.map((g, i) => (
          <div
            key={g.id}
            onClick={() => setActiveIndex(i)}
            style={{
              width: i === activeIndex ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === activeIndex ? selected.accentColor : 'rgba(255,255,255,0.15)',
              cursor: 'pointer',
              transition: 'all 0.32s cubic-bezier(0.25,0.46,0.45,0.94)',
              flexShrink: 0,
            }}
          />
        ))}
      </div>

      {/* Description */}
      <div style={{ textAlign: 'center', minHeight: 52, padding: '4px 80px' }}>
        <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.65, maxWidth: 400, margin: '0 auto' }}>
          {selected.description}
        </div>
      </div>

      {/* Launch —— library 卡带换成四键操作条（spec ③），内置卡带保持单个 LAUNCH 大按钮 */}
      {renderLaunchArea?.(selected) ?? (
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
            animation: selected.status === 'playable' ? 'al-pulse 2.4s ease-in-out infinite' : 'none',
            outline: 'none',
          }}
        >
          {selected.status === 'playable' ? '▶  LAUNCH' : 'COMING SOON'}
        </button>
      </div>
      )}
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
      <span>Atoms: <b style={{ color: '#38bdf8' }}>{status.atoms}</b></span>
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

interface OverlayMenuItem { label: string; onClick: () => void; }

// 全游戏统一的壳层菜单：齿轮钮 → 浮层，收纳「返回主界面」等全局动作（壳层所有，游戏代码不掺和）。
// 收编旧的常驻「返回」pill —— 缩成一颗齿轮、按需展开，给未来壳层级开关（全屏/重开/静音…）留好统一的位置；今天只放返回。
// Esc / 点浮层外关闭；齿轮常显、不藏，退出仍一眼可寻。
function GameOverlayMenu({ items }: { items: OverlayMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'absolute', top: 10, right: 10, zIndex: 100 }}>
      <button onClick={() => setOpen((o) => !o)} style={sGearBtn(open)} aria-label="菜单" aria-expanded={open} title="菜单">
        ⚙
      </button>
      {open && (
        <div style={sMenuPanel()} role="menu">
          {items.map((it, i) => (
            <button
              key={i}
              role="menuitem"
              onClick={() => { setOpen(false); it.onClick(); }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              style={sMenuItem(hover === i)}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GameRunner({ gameId, onBack }: { gameId: string; onBack: () => void }) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // mount 第二参 host（可选·向后兼容）：把壳层「退出到游戏库」钩子传给游戏，让游戏可把退出收进自己的设置菜单（owner 2026-06-21）。
    const loaders: Record<string, () => Promise<{ mount: (el: HTMLElement, host?: { exit: () => void }) => () => void }>> = {
      'game-e': () => import('./game-e.js'),
      'game-f': () => import('./games/game-f/game-f.js'),
      'game-g': () => import('./games/game-g/game-g.js'),
      'game-i': () => import('./games/game-i/game-i.js'),
      'game-h': () => import('./games/game-h/game-h.js'),
      'game-x': () => import('./games/game-x/game-x.js'),
      'game-z': () => import('./games/game-z/game-z.js'),
      'game-d': () => import('./games/game-d/game-d.js'),
    };
    const loader = loaders[gameId];
    if (!loader) return;
    // 异步竞态防护：若组件在 loader 完成前已卸载（快速切游戏 / 退回主页），late-resolve 不得再 mount
    // ——否则前一个游戏的引擎在新画面里成孤儿后台空跑（"两个引擎"症状的一种来源）。
    let disposed = false;
    let cleanup: (() => void) | undefined;
    loader().then(mod => {
      if (disposed || !containerRef.current) return;
      cleanup = mod.mount(containerRef.current, { exit: onBack });
      if (disposed) { cleanup?.(); cleanup = undefined; } // mount 期间又被卸载 → 立即清
    });
    return () => { disposed = true; cleanup?.(); };
  }, [gameId]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: SHELL.bg0 }}>
      {/* 全游戏统一的壳层菜单（齿轮 → 收纳「返回主界面」等全局动作；游戏代码不掺和）—— 视觉基调见 ui/shell-theme.ts。
          game-g 已把退出收进自己的设置菜单（owner 2026-06-21「去掉右上角返回·收进设置」，经 mount(el,{exit}) 接走）→ 壳层不再为它叠这颗。 */}
      {gameId !== 'game-g' && (
        <GameOverlayMenu items={[{ label: '⟵ 返回主界面', onClick: onBack }]} />
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

// ══════════════════════════════════════
//  Main Launcher
// ══════════════════════════════════════

export function Launcher() {
  useKeyframes();
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

  // 玩家模式（?mode=player）：面向 To-C 用户——隐藏内置 GAMES 与 DevTools，卡带架数据源=用户游戏库。
  const playerMode = React.useMemo(
    () => new URLSearchParams(window.location.search).get('mode') === 'player', []);

  // 用户游戏库（library）：**launcher 统一拉取的单一数据源**（返修 Lead 缺陷 #1：此前玩家模式
  // 由 LibraryShelf 自拉、launcher 另存一份永远为空的 libEntries → LAUNCH 查不到条目静默无反应；
  // 收成一份状态后玩家/开发两模式同源）。null=加载中；libRefresh 变更即重拉（装样例/回滚后刷新）。
  const [libEntries, setLibEntries] = useState<LibraryEntry[] | null>(null);
  const [libRefresh, setLibRefresh] = useState(0);
  const [libRunner, setLibRunner] = useState<{ slug: string; entry: GameEntry } | null>(null);
  // 版本历史浮层（从架上操作条打开·spec ③ ⟲）。
  const [libHistory, setLibHistory] = useState<{ slug: string } | null>(null);
  // 体检浮层（M4·架上操作条 🩺 打开）：五轴分 + 总分 + 及格线。
  const [libBench, setLibBench] = useState<{ slug: string; title: string } | null>(null);
  // 设置面板（M3·状态灯点开）：BYO key + 测试连接。
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  // 顶栏 API 状态灯：读现有 providers 端点，任一**云** provider 配了 key → 绿，否则琥珀（local 不计·见 providerStatus）。
  //   config 里配了云 key 也算已连接——get_available_providers/get_api_key 已把 config 计入（优先级 config>env>.env），
  //   故设置页保存后 bump providersRefresh 重拉即更新状态灯（M3 增强，无需前端另判 config）。
  const [providers, setProviders] = useState<ProviderInfo[] | null>(null);
  const [providersRefresh, setProvidersRefresh] = useState(0);
  // 「新建游戏 / 继续创作」→ 打开 GameCreator 并预置游戏名（dev 模式沿用旧面板）。nonce 变更触发展开+填词。
  const [creatorSeed, setCreatorSeed] = useState<{ prompt: string; nonce: number } | null>(null);
  // M2 创作向导（玩家模式·⚡ 快速模式）：create=新建 / revise=继续创作某盘卡带。
  const [wizard, setWizard] = useState<{ mode: WizardMode; slug?: string; name?: string } | null>(null);
  // 设计先行流：新建入口双选卡（🗣 设计 / ⚡ 快速）+ 设计工作台 + 继续创作双选（改设计 / 快改数值）。
  const [entryChoice, setEntryChoice] = useState(false);
  const [designStudio, setDesignStudio] = useState<{ slug?: string; name?: string } | null>(null);
  const [continueChoice, setContinueChoice] = useState<{ slug: string; name: string } | null>(null);
  // 保存新卡带后请求轮播选中它（`lib:<slug>`）。
  const [selectSlug, setSelectSlug] = useState<string | null>(null);
  // 能力目录（从引擎 ALL_CAPABILITIES 自动派生）：向导生成请求随之送出，注入系统词。派生一次即可。
  const catalog = React.useMemo(() => buildCapabilityCatalog(ALL_CAPABILITIES), []);

  useEffect(() => {
    apiCall('/api/generate/providers')
      .then((d) => setProviders(Array.isArray(d) ? d : []))
      .catch(() => setProviders([]));
  }, [providersRefresh]);

  // 库列表：两模式统一在此拉（玩家模式喂 LibraryShelf，dev 模式追加在内置卡带之后）。
  useEffect(() => {
    apiCall('/api/library')
      .then((list) => setLibEntries(Array.isArray(list) ? list : []))
      .catch(() => setLibEntries([]));
  }, [libRefresh]);

  // 空库态「装入官方示例卡带」：POST 后刷新列表。
  const installSample = useCallback(async () => {
    setInstalling(true);
    try {
      await fetch(`${API}/api/library/install-sample`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch { /* API 离线：静默，刷新后仍空态 */ }
    setInstalling(false);
    setLibRefresh((k) => k + 1);
  }, []);

  // 素材库记录（AI 选材解析用）：启动时拉一次索引，失败不阻塞（art: 引用原样留 → 渲染占位）。
  const artRecordsRef = React.useRef<LibraryRecord[] | null>(null);
  useEffect(() => {
    fetch('/assets/FreeArtLib/index.json')
      .then((r) => r.json())
      .then((j) => { artRecordsRef.current = artlibRecords(j as ArtLibIndex); })
      .catch(() => { artRecordsRef.current = null; });
  }, []);

  // manifest 原始 JSON → 过 art: 选材解析（确定性 rankRecords top-1，留痕 console 供审计）。
  // openInStudio 与数据卡带运行共用同一段（复用现成 artRecords 加载逻辑）。
  const resolveArt = useCallback((raw: unknown): unknown => {
    const records = artRecordsRef.current;
    if (!records) return raw;
    const { manifest: resolved, resolutions } = resolveArtRefs(raw, records);
    if (resolutions.length > 0) {
      console.info('[art-resolve] AI 选材解析（query → id；同 query 永远同结果）：',
        resolutions.map((r) => `${r.entity}.${r.component}.${r.field}: "${r.query}" → ${r.id ?? '∅ 无命中(原样保留)'}${r.candidates.length > 1 ? `（候选: ${r.candidates.join(', ')}）` : ''}`));
    }
    return resolved;
  }, []);

  // 「在透视器里打开」：把生成的 manifest(原始 JSON)接进透视器。build 每次重新 parseManifest
  // (而非 clone——蓝图含 capability 函数对象，structuredClone/JSON 都会坏)，重置/重跑安全。
  const openInStudio = useCallback((name: string, raw: unknown) => {
    const manifest = resolveArt(raw);
    setStudioExtra({ id: 'generated', title: `生成 · ${name}`, build: () => parseManifest(manifest) });
    setStudio(true);
  }, [resolveArt]);

  // 「继续创作」：玩家模式下——有设计稿 → 双选（改设计 / 快改数值）；无设计稿 → 直接 M2 revise。
  // dev 模式 → 沿用旧 GameCreator 面板。
  const continueCreate = useCallback((entry: GameEntry) => {
    setLibRunner(null);
    const slug = libSlug(entry.id);
    if (playerMode && slug) {
      if (entry.hasDesign) setContinueChoice({ slug, name: entry.title });
      else setWizard({ mode: 'revise', slug, name: entry.title });
    } else setCreatorSeed({ prompt: entry.title, nonce: Date.now() });
  }, [playerMode]);

  // 向导 / 设计工作台保存成功 → 关面板、刷卡带架、请求选中新卡带。
  const onWizardSaved = useCallback((slug: string) => {
    setWizard(null);
    setDesignStudio(null);
    setSelectSlug(`${LIB_ID_PREFIX}${slug}`);
    setLibRefresh((k) => k + 1);
  }, []);
  // 轮播跳转完成 → 清 selectSlug（一次性，之后刷架不再强跳）。
  const clearSelect = useCallback(() => setSelectSlug(null), []);

  // 库条目 → 卡带 GameEntry（玩家模式独占轮播；dev 模式追加在内置之后）。
  const libGameEntries = React.useMemo(() => (libEntries ?? []).map(metaToGameEntry), [libEntries]);

  // 打开某盘库卡带（直接携带 entry，不再查另一份状态——缺陷 #1 的修法）。
  const openLibCartridge = useCallback((entry: GameEntry) => {
    const slug = libSlug(entry.id);
    if (slug) setLibRunner({ slug, entry });
  }, []);

  // 卡带启动分流（默认 LAUNCH 按钮 / 键盘 Enter 走这里）：库卡带 → 运行器；内置 game-* → GameRunner。
  const onLaunchCartridge = useCallback((id: string) => {
    const libEntry = libGameEntries.find((g) => g.id === id);
    if (libEntry) { openLibCartridge(libEntry); return; }
    setLaunched(id);
  }, [libGameEntries, openLibCartridge, setLaunched]);

  // 选中 library 卡带 → 四键操作条（spec ③）；内置卡带 → null（默认 LAUNCH 大按钮）。
  const renderLaunchArea = useCallback((selected: GameEntry): React.ReactNode | null => {
    const slug = libSlug(selected.id);
    if (!slug) return null;
    return (
      <LibActionBar
        entry={selected}
        onStart={() => openLibCartridge(selected)}
        onContinue={() => continueCreate(selected)}
        onHistory={() => setLibHistory({ slug })}
        onBench={() => setLibBench({ slug, title: selected.title })}
      />
    );
  }, [openLibCartridge, continueCreate]);

  const statusLight = providerStatus(providers ?? []);

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

  if (libRunner) {
    return (
      <DataCartridgeRunner
        slug={libRunner.slug}
        entry={libRunner.entry}
        api={API}
        resolveArt={resolveArt}
        onBack={() => setLibRunner(null)}
      />
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: SHELL.appBg, // Apollo Kit 玄铁贴图底（owner 2026-06-25·替原 pageBg 纯渐变）
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '36px 20px',
      fontFamily: SHELL.fontUi,
    }}>
      {/* 顶栏 API 状态灯（右上角·M3 可点击→设置面板）——读 providers 端点：有 key 绿、无 key 琥珀。 */}
      <div style={{ position: 'absolute', top: 18, right: 20 }}>
        <StatusLight tone={statusLight.tone} label={statusLight.label} onClick={() => setSettingsOpen(true)} />
      </div>

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
          {playerMode ? '我的游戏架' : 'Game Library'}
        </h1>
        <div style={{ width: 180, height: 1, background: `linear-gradient(90deg, transparent, ${SHELL.lineStrong}, transparent)`, margin: '14px auto 0' }} />
        {/* dev 工具入口仅开发模式显示（玩家模式=纯净创作台） */}
        {!playerMode && (
          <>
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
          </>
        )}
      </div>

      {/* Game Carousel —— 玩家模式：库卡带架（空态=欢迎+新建）；dev 模式：内置 + 库卡带追加 */}
      {playerMode ? (
        <LibraryShelf
          entries={libEntries}
          installing={installing}
          onNewGame={() => setEntryChoice(true)}
          onInstallSample={installSample}
          renderCarousel={() => (
            <CartridgeCarousel games={libGameEntries} onLaunch={onLaunchCartridge} renderLaunchArea={renderLaunchArea} selectId={selectSlug ?? undefined} onSelected={clearSelect} />
          )}
        />
      ) : (
        <CartridgeCarousel games={[...GAMES, ...libGameEntries]} onLaunch={onLaunchCartridge} renderLaunchArea={renderLaunchArea} selectId={selectSlug ?? undefined} onSelected={clearSelect} />
      )}

      {/* 玩家模式·非空架：显式「＋ 新建游戏」入口（空架时 EmptyShelf 已有大卡位·此处不重复） */}
      {playerMode && libEntries && libEntries.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <button
            onClick={() => setEntryChoice(true)}
            style={{
              padding: '10px 24px', borderRadius: 9,
              background: SHELL.jadeWash, color: SHELL.jade,
              border: `1px solid ${SHELL.jadeLine}`,
              fontSize: 14, fontWeight: 600, letterSpacing: 0.5,
              cursor: 'pointer', outline: 'none', fontFamily: SHELL.fontUi,
            }}
          >
            ＋ 新建游戏
          </button>
        </div>
      )}

      {/* 版本历史浮层（架上操作条 ⟲ 打开；回滚成功 → 刷新库列表） */}
      {libHistory && (
        <VersionHistoryOverlay
          api={API}
          slug={libHistory.slug}
          onClose={() => setLibHistory(null)}
          onRolledBack={() => setLibRefresh((k) => k + 1)}
        />
      )}

      {/* 体检浮层（M4·架上操作条 🩺 打开）：五轴分 + 总分 + 及格线 70。 */}
      {libBench && (
        <BenchOverlay
          api={API}
          slug={libBench.slug}
          title={libBench.title}
          onClose={() => setLibBench(null)}
        />
      )}

      {/* 设置面板（M3·状态灯点开）：BYO key + model + 测试连接。保存后重拉 providers 更新状态灯。 */}
      {settingsOpen && (
        <SettingsPanel
          api={API}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => setProvidersRefresh((k) => k + 1)}
        />
      )}

      {/* 新建入口双选卡（🗣 设计一个游戏 推荐 / ⚡ 快速生成）。 */}
      {entryChoice && (
        <EntryChoice
          onDesign={() => { setEntryChoice(false); setDesignStudio({}); }}
          onQuick={() => { setEntryChoice(false); setWizard({ mode: 'create' }); }}
          onClose={() => setEntryChoice(false)}
        />
      )}

      {/* 继续创作双选（已有 design 的卡带）：改设计 / 快改数值(M2 revise)。 */}
      {continueChoice && (
        <ContinueChoice
          name={continueChoice.name}
          onEditDesign={() => { const c = continueChoice; setContinueChoice(null); setDesignStudio({ slug: c.slug, name: c.name }); }}
          onQuickRevise={() => { const c = continueChoice; setContinueChoice(null); setWizard({ mode: 'revise', slug: c.slug, name: c.name }); }}
          onClose={() => setContinueChoice(null)}
        />
      )}

      {/* 设计工作台（设计先行流主件·全屏）：讨论 → 分解 → 对齐 → 定稿 → 原型。保存 → 刷架 + 选中新卡带。 */}
      {designStudio && (
        <DesignStudio
          api={API}
          providers={providers ?? []}
          catalog={catalog}
          resolveArt={resolveArt}
          initialSlug={designStudio.slug}
          initialName={designStudio.name}
          onClose={() => setDesignStudio(null)}
          onSaved={onWizardSaved}
          onDirty={() => setLibRefresh((k) => k + 1)}
        />
      )}

      {/* M2 创作向导（右滑面板·玩家模式·⚡ 快速模式）：新建 create / 继续创作 revise。保存 → 刷架 + 选中新卡带。 */}
      {wizard && (
        <CreationWizard
          api={API}
          mode={wizard.mode}
          slug={wizard.slug}
          initialName={wizard.name}
          providers={providers ?? []}
          catalog={catalog}
          resolveArt={resolveArt}
          onClose={() => setWizard(null)}
          onSaved={onWizardSaved}
        />
      )}

      {/* Game Creator (AI Generate) —— dev 模式沿用旧面板；玩家模式走上方创作向导（不显示此条） */}
      {!playerMode && (
        <div style={{ width: '100%', maxWidth: 880, marginBottom: 12 }}>
          <GameCreator onOpenInStudio={openInStudio} seed={creatorSeed} />
        </div>
      )}

      {/* Dev Tools —— 玩家模式隐藏 */}
      {!playerMode && (
      <div style={{ width: '100%', maxWidth: 880 }}>
        <DevTools />
      </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 'auto',
        paddingTop: 32,
        textAlign: 'center',
        color: SHELL.faint,
        fontSize: 11,
        letterSpacing: 2,
      }}>
        {/* 口径铁律：页脚不手抄数字/版本号（机读真相见 docs/llm-onboarding.md §0） */}
        Apollo Engine · 数据驱动 · Deterministic Lockstep
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

function GameCreator({ onOpenInStudio, seed }: {
  onOpenInStudio: (name: string, raw: unknown) => void;
  /** 「新建游戏」/「继续创作」触发：nonce 变更 → 展开面板并预置 prompt。 */
  seed?: { prompt: string; nonce: number } | null;
}) {
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

  // 外部（新建/继续创作）驱动：展开面板 + 预置游戏名。
  useEffect(() => {
    if (!seed) return;
    setExpanded(true);
    setPrompt(seed.prompt);
  }, [seed?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

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

// #app 存在才挂载（index.html 恒有）；无 #app（如无头集成测试 import 本模块）→ 零副作用，
// 让测试能渲染导出的 <Launcher /> 走真实接线（返修 Lead 要求的 launcher 层集成测试的前提）。
const appEl = document.getElementById('app');
if (appEl) createRoot(appEl).render(<Launcher />);
