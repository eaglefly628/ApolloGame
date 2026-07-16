// launcher.tsx 拆分而来（2026-07-16 纯搬运·行为不变）：卡带轮播 —— useKeyframes / Cartridge / CartridgeCarousel。
import React, { useState, useEffect, useCallback } from 'react';
import type { GameEntry } from '../studio/library-model.js';
import { GAMES } from '../launcher.js';

export function useKeyframes() {
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

export function CartridgeCarousel({ onLaunch, games = GAMES, renderLaunchArea, selectId, onSelected }: {
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
      // 焦点在输入控件里（创作台讨论框/游戏名等）或事件已被弹窗消费 → 轮播键盘导航一律让路：
      // 绝不在用户打字时挪卡带 / 启动游戏。BUG-STUDIO 根因坐实——设计台讨论模式按裸 Enter，
      // 事件冒泡到这个 window 级 handler，把当前选中的库卡带（sample）启动、设计台连同对话一并卸载，
      // 表现就是 owner 说的「按回车蹦出怪 sample + 此前对话全消失」。
      if (e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
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
