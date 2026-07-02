import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Engine } from '../runtime/engine.js';
import { CanvasRenderer } from '@renderer/canvas-renderer.js';
import { parseManifest } from '../assembly/manifest.js';
import { SHELL } from '../ui/shell-theme.js';
import type { WorldBlueprint } from '../assembly/demo.assembly.js';
import type { GameEntry, LibraryEntry } from './library-model.js';

// ═══════════════════════════════════════════════════════════════
//  创作台 v1 · 卡带架接库前端（玩家模式）
//   · EmptyShelf            —— 空库欢迎态（呼吸虚线「新建游戏」空卡位 + 装入示例）
//   · StatusLight           —— 顶栏 API 状态灯（已连接 / 未配置）
//   · LibraryShelf          —— 受控展示：entries=null 加载中 / [] 空态 / 有 → renderCarousel
//   · LibActionBar          —— 选中 library 卡带的操作条（开始 / 继续创作 / 版本历史 / 导出占位）
//   · VersionHistoryOverlay —— 版本历史浮层（列 history · 逐行回滚）
//   · DataCartridgeRunner   —— 全屏纯运行（挂载即拉 manifest→parse→跑，左上返回架上）
//  数据（library 列表）由 launcher 统一拉取持有——返修 Lead 缺陷 #1 的根因正是「shelf 自拉 +
//  launcher 另拉」两份状态在玩家模式下断线；收成单一数据源杜绝这一类。
//  纯运行部分抽自 StudioInspector 的引擎生命周期（load→CanvasRenderer→start），无检查器 chrome。
// ═══════════════════════════════════════════════════════════════

const CART_W = 160; // 对齐现有 Cartridge 尺寸/圆角
const CART_H = 240;
const CART_RADIUS = 10;

// 呼吸动画注入（幂等·全局单例）：prefers-reduced-motion 下自动降级为静态描边（媒体查询关掉 animation）。
function ensureShelfKeyframes(): void {
  if (typeof document === 'undefined') return;
  const id = 'apollo-shelf-kf';
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `
    @keyframes apollo-shelf-breathe {
      0%, 100% { border-color: rgba(56,189,248,0.28); box-shadow: 0 0 0 0 rgba(56,189,248,0.0); }
      50%      { border-color: rgba(56,189,248,0.72); box-shadow: 0 0 22px 2px rgba(56,189,248,0.18); }
    }
    .apollo-shelf-newcard { animation: apollo-shelf-breathe 2.8s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) {
      .apollo-shelf-newcard { animation: none; border-color: rgba(56,189,248,0.5); }
    }
  `;
  document.head.appendChild(s);
}

// ── 顶栏 API 状态灯（纯显示；点击行为留 M3 设置页）──
export function StatusLight({ tone, label }: { tone: 'ok' | 'warn'; label: string }) {
  const color = tone === 'ok' ? SHELL.ok : SHELL.warn;
  const wash = tone === 'ok' ? SHELL.okWash : SHELL.warnWash;
  return (
    <span
      title={label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '4px 12px', borderRadius: 999,
        background: wash, border: `1px solid ${color}55`,
        color, fontSize: 12, fontWeight: 600, letterSpacing: 0.4,
        userSelect: 'none',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
      {label}
    </span>
  );
}

// ── 空库欢迎态 ──
export function EmptyShelf({ onNewGame, onInstallSample, installing }: {
  onNewGame: () => void;
  onInstallSample: () => void;
  installing?: boolean;
}) {
  useEffect(ensureShelfKeyframes, []);
  const [hover, setHover] = useState(false);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 26, padding: '48px 20px', textAlign: 'center',
    }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: SHELL.text, letterSpacing: 1 }}>
          你的游戏架还是空的
        </div>
        <div style={{ marginTop: 10, fontSize: 14, color: SHELL.sub, maxWidth: 420, lineHeight: 1.7 }}>
          说一句创意，让 AI 为你压出第一盘卡带
        </div>
      </div>

      {/* 呼吸虚线「新建游戏」空卡位（尺寸/圆角对齐现有 Cartridge） */}
      <button
        onClick={onNewGame}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="apollo-shelf-newcard"
        aria-label="新建游戏"
        style={{
          width: CART_W, height: CART_H, borderRadius: CART_RADIUS,
          border: '2px dashed rgba(56,189,248,0.5)',
          background: hover ? 'rgba(56,189,248,0.07)' : 'rgba(56,189,248,0.03)',
          color: SHELL.text, cursor: 'pointer', outline: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
          transition: 'background 0.2s',
          fontFamily: SHELL.fontUi,
        }}
      >
        <span style={{ fontSize: 46, lineHeight: 1, color: '#38bdf8', fontWeight: 300 }}>＋</span>
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 1 }}>新建游戏</span>
      </button>

      {/* 次按钮：装入官方示例卡带 */}
      <button
        onClick={onInstallSample}
        disabled={installing}
        style={{
          padding: '8px 18px', borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${SHELL.line}`,
          color: installing ? SHELL.dim : SHELL.sub,
          fontSize: 13, cursor: installing ? 'wait' : 'pointer',
          outline: 'none', fontFamily: SHELL.fontUi,
        }}
      >
        {installing ? '装入中…' : '⤓ 装入官方示例卡带'}
      </button>
    </div>
  );
}

// ── library 卡带架（受控展示）：entries=null 加载中 / [] 空态 / 有 → renderCarousel ──
export function LibraryShelf({ entries, installing, onNewGame, onInstallSample, renderCarousel }: {
  entries: LibraryEntry[] | null;
  installing?: boolean;
  onNewGame: () => void;
  onInstallSample: () => void;
  renderCarousel: (entries: LibraryEntry[]) => React.ReactNode;
}) {
  if (entries === null) {
    return <div style={{ padding: 60, textAlign: 'center', color: SHELL.dim, fontSize: 13 }}>加载游戏架…</div>;
  }
  if (entries.length === 0) {
    return <EmptyShelf onNewGame={onNewGame} onInstallSample={onInstallSample} installing={installing} />;
  }
  return <>{renderCarousel(entries)}</>;
}

// ── 选中 library 卡带的操作条（spec ③·替代内置卡带的单个 LAUNCH 大按钮区域）──
export function LibActionBar({ entry, onStart, onContinue, onHistory }: {
  entry: GameEntry;
  onStart: () => void;
  onContinue: () => void;
  onHistory: () => void;
}) {
  const playable = entry.status === 'playable';
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
      <button
        onClick={() => playable && onStart()}
        disabled={!playable}
        title={playable ? undefined : 'manifest 损坏，先修复（继续创作）'}
        style={{ ...opBtn(true, entry.accentColor), opacity: playable ? 1 : 0.4, cursor: playable ? 'pointer' : 'default' }}
      >
        ▶ 开始游戏
      </button>
      <button onClick={onContinue} style={opBtn(false)}>✎ 继续创作</button>
      <button onClick={onHistory} style={opBtn(false)}>⟲ 版本历史</button>
      <button disabled title="即将支持" style={{ ...opBtn(false), opacity: 0.4, cursor: 'default' }}>⤓ 导出</button>
    </div>
  );
}

interface HistoryEntry { rev: string; subject: string; date: string; }

// ── 版本历史浮层：列 GET history 的 entries，逐行「回滚」→ POST rollback → 刷新浮层 + 通知上层刷架 ──
export function VersionHistoryOverlay({ api, slug, onClose, onRolledBack }: {
  api: string;
  slug: string;
  onClose: () => void;
  onRolledBack?: () => void;
}) {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [rolling, setRolling] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`${api}/api/library/${slug}/history`)
      .then((r) => r.json())
      .then((data) => setHistory(Array.isArray(data?.entries) ? (data.entries as HistoryEntry[]) : []))
      .catch(() => setHistory([]));
  }, [api, slug]);

  useEffect(load, [load]);

  const rollback = useCallback(async (rev: string) => {
    setRolling(rev);
    try {
      await fetch(`${api}/api/library/${slug}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rev }),
      });
    } catch { /* 离线：静默 */ }
    setRolling(null);
    load();
    onRolledBack?.();
  }, [api, slug, load, onRolledBack]);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(3,6,12,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 480, maxWidth: '92%', maxHeight: '80%', overflow: 'auto',
        background: SHELL.bg1, border: `1px solid ${SHELL.lineStrong}`, borderRadius: 12, padding: 20,
        fontFamily: SHELL.fontUi,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: SHELL.text }}>⟲ 版本历史</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: SHELL.dim, cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        {history === null ? (
          <div style={{ color: SHELL.dim, fontSize: 13 }}>加载中…</div>
        ) : history.length === 0 ? (
          <div style={{ color: SHELL.dim, fontSize: 13 }}>（暂无历史版本）</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((h) => (
              <div key={h.rev} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${SHELL.line}`, borderRadius: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: SHELL.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.subject}</div>
                  <div style={{ fontSize: 11, color: SHELL.dim, fontFamily: SHELL.fontMono }}>{h.date}</div>
                </div>
                <button onClick={() => rollback(h.rev)} disabled={rolling === h.rev} style={opBtn(false)}>
                  {rolling === h.rev ? '回滚中…' : '回滚'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 纯运行：build 引擎 + CanvasRenderer 跑 WorldBlueprint（无检查器面板）──
const RUN_VP = { w: 960, h: 600 };

function RunOnly({ blueprint }: { blueprint: WorldBlueprint }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const div = ref.current;
    if (!div) return;
    div.innerHTML = '';
    const engine = new Engine({ tickRate: 60 });
    engine.load(blueprint);
    const renderer = new CanvasRenderer({ width: RUN_VP.w, height: RUN_VP.h });
    engine.attachRenderer(renderer, div);
    engine.start();
    return () => {
      engine.stop();
      renderer.destroy();
      div.innerHTML = '';
    };
  }, [blueprint]);
  return <div ref={ref} style={{ width: RUN_VP.w, height: RUN_VP.h, maxWidth: '100%' }} />;
}

type RunState =
  | { phase: 'loading' }
  | { phase: 'running'; bp: WorldBlueprint }
  | { phase: 'error'; message: string };

// ── 数据卡带运行器：挂载即拉 manifest → resolveArt → parseManifest → 全屏纯运行。
//    操作条在架上（LibActionBar），此处只管「跑」；左上「← 返回架上」。──
export function DataCartridgeRunner({ slug, entry, api, resolveArt, onBack }: {
  slug: string;
  entry: GameEntry;
  api: string;
  /** manifest 原始 JSON → 过 art: 选材解析（launcher 注入·与 openInStudio 同一段）。缺省=原样。 */
  resolveArt?: (raw: unknown) => unknown;
  onBack: () => void;
}) {
  const [state, setState] = useState<RunState>({ phase: 'loading' });

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const res = await fetch(`${api}/api/library/${slug}/manifest`);
        const raw = await res.json();
        const manifest = resolveArt ? resolveArt(raw) : raw;
        const bp = parseManifest(manifest);
        if (!dead) setState({ phase: 'running', bp });
      } catch (e: unknown) {
        if (!dead) setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => { dead = true; };
  }, [api, slug, resolveArt]);

  return (
    <div style={{
      position: 'absolute', inset: 0, background: SHELL.bg0, color: SHELL.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: SHELL.fontUi,
    }}>
      {state.phase === 'loading' && (
        <div style={{ textAlign: 'center', color: SHELL.dim, fontSize: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{entry.icon}</div>
          正在装入「{entry.title}」…
        </div>
      )}
      {state.phase === 'error' && (
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ color: SHELL.danger, fontSize: 14, marginBottom: 8 }}>卡带装入失败</div>
          <div style={{ color: SHELL.sub, fontSize: 13, lineHeight: 1.6 }}>{state.message}</div>
        </div>
      )}
      {state.phase === 'running' && <RunOnly blueprint={state.bp} />}
      <button onClick={onBack} style={backBtnStyle}>← 返回架上</button>
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  position: 'absolute', top: 14, left: 14, zIndex: 210,
  padding: '7px 14px', borderRadius: 8,
  background: 'rgba(255,255,255,0.06)', border: `1px solid ${SHELL.line}`,
  color: SHELL.sub, fontSize: 13, cursor: 'pointer', outline: 'none',
  fontFamily: SHELL.fontUi,
};

function opBtn(primary: boolean, accent: string = SHELL.jade): React.CSSProperties {
  return {
    padding: primary ? '11px 30px' : '9px 18px',
    borderRadius: 9,
    background: primary ? `linear-gradient(135deg, ${accent}, ${accent}cc)` : 'rgba(255,255,255,0.05)',
    color: primary ? '#0f172a' : SHELL.sub,
    border: primary ? 'none' : `1px solid ${SHELL.line}`,
    fontSize: primary ? 15 : 13,
    fontWeight: primary ? 700 : 600,
    letterSpacing: 0.5,
    cursor: 'pointer',
    outline: 'none',
    fontFamily: SHELL.fontUi,
    boxShadow: primary ? `0 4px 20px ${accent}44` : 'none',
  };
}
