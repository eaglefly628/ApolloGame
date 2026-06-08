import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import type { Card, Suit, Rank } from './games/game-e/index.js';
import { SUITS, RANKS, RANK_CHIPS, HAND_RANKINGS } from './games/game-e/index.js';
import type { HandType } from './games/game-e/index.js';
import { JOKER_CATALOG } from './games/game-e/index.js';
import type { JokerCatalogEntry } from './games/game-e/index.js';

// Game E 可挂载模块（launcher 卡带槽契约：export mount(container) → cleanup）。
// Balatro-like PoC：纯 React 事件驱动（卡牌游戏离散，无需 tick 引擎）。
// 数据层来自 games/game-e/（deck/hand-rankings/joker-catalog 纯数据）。
// ECS blueprint 待 REQ-011/012 落地后装配，届时 mount() 切换到 Engine 版本。

// ── 演示手牌（8 张）──
const DEMO_HAND: Card[] = [
  { suit: 'spades',   rank: 'A'  },
  { suit: 'spades',   rank: 'K'  },
  { suit: 'spades',   rank: 'Q'  },
  { suit: 'hearts',   rank: 'A'  },
  { suit: 'hearts',   rank: 'K'  },
  { suit: 'diamonds', rank: '7'  },
  { suit: 'clubs',    rank: '7'  },
  { suit: 'spades',   rank: '3'  },
];

// ── 演示小丑（前 3 张）──
const DEMO_JOKERS = JOKER_CATALOG.slice(0, 3);

// ── 花色显示 ──
const SUIT_SYMBOL: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const SUIT_COLOR:  Record<Suit, string> = { spades: '#94a3b8', hearts: '#f87171', diamonds: '#fb923c', clubs: '#4ade80' };

// ── 手牌评估（纯函数，适配 games/game-e/hand-rankings.ts HandType）──
function evalHandType(cards: Card[]): HandType {
  const n = cards.length;
  if (n === 0) return 'high_card';
  const ranks = cards.map(c => c.rank);
  const suits = cards.map(c => c.suit);
  const rankCount: Record<string, number> = {};
  const suitCount: Record<string, number> = {};
  for (const r of ranks) rankCount[r] = (rankCount[r] ?? 0) + 1;
  for (const s of suits) suitCount[s] = (suitCount[s] ?? 0) + 1;
  const counts = Object.values(rankCount).sort((a, b) => b - a);
  const flush = n >= 5 && Object.values(suitCount).some(c => c >= 5);
  const rankOrder: Record<Rank, number> = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
  const sorted = [...new Set(ranks.map(r => rankOrder[r]))].sort((a,b) => a-b);
  let straight = false;
  if (n >= 5 && sorted.length >= 5) {
    for (let i = 0; i <= sorted.length - 5; i++) {
      if (sorted[i+4] - sorted[i] === 4) straight = true;
    }
    if (!straight && sorted.includes(14)) {
      const lo = sorted.map(v => v === 14 ? 1 : v).sort((a,b)=>a-b);
      if (lo[4] - lo[0] === 4) straight = true;
    }
  }
  if (counts[0] === 5) return flush ? 'flush_five' : 'five_kind';
  if (flush && straight) return 'straight_flush';
  if (counts[0] === 4) return 'four_kind';
  if (counts[0] === 3 && counts[1] === 2) return flush ? 'flush_house' : 'full_house';
  if (flush) return 'flush';
  if (straight) return 'straight';
  if (counts[0] === 3) return 'three_kind';
  if (counts[0] === 2 && counts[1] === 2) return 'two_pair';
  if (counts[0] === 2) return 'pair';
  return 'high_card';
}

// ── UI ──

function CardView({ card, selected, onClick }: { card: Card; selected: boolean; onClick: () => void }) {
  const color = SUIT_COLOR[card.suit];
  return (
    <div onClick={onClick} style={{
      width: 68, height: 96, background: selected ? '#1e293b' : '#0f1623',
      border: `2px solid ${selected ? color : '#1e293b'}`, borderRadius: 8, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
      userSelect: 'none', transform: selected ? 'translateY(-14px)' : 'none',
      transition: 'transform 0.18s, border-color 0.18s',
      boxShadow: selected ? `0 8px 24px ${color}44` : 'none',
    }}>
      <div style={{ fontSize: 20, color, lineHeight: 1 }}>{SUIT_SYMBOL[card.suit]}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{card.rank}</div>
    </div>
  );
}

function JokerView({ joker }: { joker: JokerCatalogEntry }) {
  const rarityColor = { common: '#94a3b8', uncommon: '#34d399', rare: '#60a5fa', legendary: '#f59e0b' }[joker.rarity];
  return (
    <div style={{
      width: 80, height: 110, background: 'linear-gradient(160deg, #1a1020, #0d0818)',
      border: `2px solid ${rarityColor}55`, borderRadius: 8,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 4, padding: '8px 4px',
    }}>
      <div style={{ fontSize: 24 }}>🃏</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: rarityColor, textAlign: 'center', lineHeight: 1.3 }}>{joker.name}</div>
      <div style={{ fontSize: 7.5, color: '#64748b', textAlign: 'center', lineHeight: 1.3, padding: '0 4px' }}>{joker.text}</div>
    </div>
  );
}

function GameEPanel() {
  const [selected, setSelected] = useState<boolean[]>(DEMO_HAND.map(() => false));
  const [result, setResult] = useState<{ type: HandType; chips: number; mult: number; total: number } | null>(null);
  const [roundScore, setRoundScore] = useState(0);
  const [handsLeft, setHandsLeft] = useState(4);

  const toggleCard = useCallback((i: number) => {
    const selCount = selected.filter(Boolean).length;
    setSelected(prev => {
      if (!prev[i] && selCount >= 5) return prev;
      return prev.map((s, j) => j === i ? !s : s);
    });
  }, [selected]);

  const playHand = useCallback(() => {
    const sel = DEMO_HAND.filter((_, i) => selected[i]);
    if (sel.length === 0 || handsLeft <= 0) return;
    const type = evalHandType(sel);
    const hr = HAND_RANKINGS[type];
    const cardChips = sel.reduce((s, c) => s + RANK_CHIPS[c.rank], 0);
    const chips = hr.baseChips + cardChips;
    const mult  = hr.baseMult;
    const total = chips * mult;
    setResult({ type, chips, mult, total });
    setRoundScore(s => s + total);
    setHandsLeft(h => h - 1);
    setSelected(DEMO_HAND.map(() => false));
  }, [selected, handsLeft]);

  const reset = useCallback(() => {
    setSelected(DEMO_HAND.map(() => false));
    setResult(null);
    setRoundScore(0);
    setHandsLeft(4);
  }, []);

  const selCount = selected.filter(Boolean).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '20px 24px', width: '100%', maxWidth: 680 }}>
      {/* 轮次信息 */}
      <div style={{ display: 'flex', gap: 28 }}>
        {[
          { label: 'ROUND SCORE', val: roundScore.toLocaleString(), color: '#f59e0b' },
          { label: 'HANDS LEFT',  val: String(handsLeft), color: handsLeft > 1 ? '#e2e8f0' : '#ef4444' },
          { label: 'BLIND',       val: '300', color: '#94a3b8' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#475569', letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* 上次结算 */}
      {result && (
        <div style={{ background: '#0f1623', border: '1px solid #1e293b', borderRadius: 10, padding: '8px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>{HAND_RANKINGS[result.type].name}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
            <span style={{ color: '#38bdf8' }}>{result.chips}</span>
            {' 筹码 × '}
            <span style={{ color: '#f87171' }}>{result.mult}</span>
            {' = '}
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>{result.total.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* 小丑牌 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 9, color: '#475569', paddingTop: 46, letterSpacing: 1 }}>JOKERS</div>
        {DEMO_JOKERS.map(j => <JokerView key={j.id} joker={j} />)}
      </div>

      {/* 手牌 */}
      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', minHeight: 116 }}>
        {DEMO_HAND.map((c, i) => (
          <CardView key={i} card={c} selected={selected[i]} onClick={() => toggleCard(i)} />
        ))}
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={playHand}
          disabled={selCount === 0 || handsLeft === 0}
          style={{
            padding: '10px 32px', borderRadius: 8, fontSize: 14, fontWeight: 700,
            cursor: selCount > 0 && handsLeft > 0 ? 'pointer' : 'default',
            background: selCount > 0 && handsLeft > 0 ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(255,255,255,0.06)',
            color: selCount > 0 && handsLeft > 0 ? '#0f172a' : '#475569',
            border: 'none', transition: 'all 0.18s',
          }}
        >
          {handsLeft > 0 ? `▶ Play Hand  (${selCount} 张)` : '手牌耗尽'}
        </button>
        <button
          onClick={reset}
          style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid #1e293b' }}
        >
          重置
        </button>
      </div>

      <div style={{ fontSize: 10, color: '#2d3748', textAlign: 'center', maxWidth: 440, lineHeight: 1.6 }}>
        点击选牌（最多 5 张）→ Play Hand 自动识别牌型并结算。数据来自 games/game-e/（Balatro 官方数据）。
        ECS blueprint 待引擎 REQ-011/012 落地后装配。
      </div>
    </div>
  );
}

export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;background:linear-gradient(180deg,#080610 0%,#0a0714 100%);display:flex;align-items:center;justify-content:center;color:#cbd5e1;font:13px system-ui';
  container.appendChild(wrapper);

  const root = createRoot(wrapper);
  root.render(<GameEPanel />);

  return () => {
    root.unmount();
    wrapper.remove();
  };
}
