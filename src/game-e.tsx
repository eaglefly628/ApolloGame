import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Engine } from './runtime/engine.js';
import {
  buildGameEBlueprint,
  CARD_FLAG, JOKER_FLAG,
  suitOf, rankOf, isCard, isJoker,
  SUIT_SYMBOL, SUIT_COLOR, RANK_LABEL, RANK_CHIPS,
} from './games/game-e/index.js';

// Game E 可挂载模块（launcher 卡带槽契约：export mount(container) → cleanup）。
// Balatro-like 卡牌构建 PoC：手牌评估 + 小丑效果由此层纯函数计算（离散事件驱动）。
// 数据：卡牌实体（Tag 编码花色/点数）+ 小丑实体（Tag+Resource 效果值）存于 engine.world。

// ── 手牌评估 ──

type HandType =
  | 'High Card' | 'Pair' | 'Two Pair' | 'Three of a Kind'
  | 'Straight' | 'Flush' | 'Full House' | 'Four of a Kind'
  | 'Straight Flush' | 'Royal Flush';

interface HandResult {
  type: HandType;
  baseChips: number;
  baseMult: number;
  cardChips: number;
}

const HAND_TABLE: Record<HandType, { chips: number; mult: number }> = {
  'High Card':       { chips: 5,   mult: 1  },
  'Pair':            { chips: 10,  mult: 2  },
  'Two Pair':        { chips: 20,  mult: 2  },
  'Three of a Kind': { chips: 30,  mult: 3  },
  'Straight':        { chips: 30,  mult: 4  },
  'Flush':           { chips: 35,  mult: 4  },
  'Full House':      { chips: 40,  mult: 4  },
  'Four of a Kind':  { chips: 60,  mult: 7  },
  'Straight Flush':  { chips: 100, mult: 8  },
  'Royal Flush':     { chips: 100, mult: 8  },
};

function evalHand(ranks: number[], suits: number[]): HandResult {
  const n = ranks.length;
  const rankCount: Record<number, number> = {};
  const suitCount: Record<number, number> = {};
  for (let i = 0; i < n; i++) {
    rankCount[ranks[i]] = (rankCount[ranks[i]] ?? 0) + 1;
    suitCount[suits[i]] = (suitCount[suits[i]] ?? 0) + 1;
  }
  const counts = Object.values(rankCount).sort((a, b) => b - a);
  const flush = n >= 5 && Object.values(suitCount).some(c => c >= 5);
  const sorted = [...ranks].sort((a, b) => (a === 1 ? 14 : a) - (b === 1 ? 14 : b));
  let straight = false;
  if (n >= 5) {
    const uniq = [...new Set(sorted.map(r => r === 1 ? 14 : r))].sort((a, b) => a - b);
    for (let i = 0; i <= uniq.length - 5; i++) {
      if (uniq[i + 4] - uniq[i] === 4 && new Set(uniq.slice(i, i + 5)).size === 5) straight = true;
    }
    if (!straight && uniq.includes(14)) {
      const low = uniq.map(r => r === 14 ? 1 : r).sort((a, b) => a - b);
      if (low[4] - low[0] === 4 && new Set(low.slice(0, 5)).size === 5) straight = true;
    }
  }
  const cardChips = ranks.reduce((s, r) => s + RANK_CHIPS[r], 0);
  const royal = flush && straight && sorted[sorted.length - 1] === 13 && sorted.includes(1);

  let type: HandType = 'High Card';
  if (royal)                                   type = 'Royal Flush';
  else if (straight && flush)                  type = 'Straight Flush';
  else if (counts[0] === 4)                    type = 'Four of a Kind';
  else if (counts[0] === 3 && counts[1] === 2) type = 'Full House';
  else if (flush)                              type = 'Flush';
  else if (straight)                           type = 'Straight';
  else if (counts[0] === 3)                    type = 'Three of a Kind';
  else if (counts[0] === 2 && counts[1] === 2) type = 'Two Pair';
  else if (counts[0] === 2)                    type = 'Pair';

  const { chips, mult } = HAND_TABLE[type];
  return { type, baseChips: chips, baseMult: mult, cardChips };
}

// ── 读世界状态 ──

interface CardState { id: string; suit: number; rank: number; selected: boolean; }
interface JokerState { id: string; effectType: 'mult_bonus' | 'chip_bonus'; value: number; }

function readCards(world: Engine['world']): CardState[] {
  const out: CardState[] = [];
  for (const [eid] of world.query('Tag')) {
    const tag = world.getComponent<{ type: 'Tag'; flags: number }>(eid, 'Tag');
    if (!tag || !isCard(tag.flags)) continue;
    const res = world.getComponent<{ type: 'Resource'; id: string; current: number }>(eid, 'Resource');
    out.push({ id: eid, suit: suitOf(tag.flags), rank: rankOf(tag.flags), selected: (res?.current ?? 0) > 0 });
  }
  return out;
}

function readJokers(world: Engine['world']): JokerState[] {
  const out: JokerState[] = [];
  for (const [eid] of world.query('Tag', 'Resource')) {
    const tag = world.getComponent<{ type: 'Tag'; flags: number }>(eid, 'Tag');
    if (!tag || !isJoker(tag.flags)) continue;
    const res = world.getComponent<{ type: 'Resource'; id: string; current: number }>(eid, 'Resource');
    if (!res) continue;
    const effectType = res.id === 'mult_bonus' ? 'mult_bonus' : 'chip_bonus';
    out.push({ id: eid, effectType, value: res.current });
  }
  return out;
}

// ── Card 组件 ──

function CardView({ card, onClick }: { card: CardState; onClick: () => void }) {
  const color = SUIT_COLOR[card.suit];
  return (
    <div
      onClick={onClick}
      style={{
        width: 72, height: 100,
        background: card.selected ? '#1e293b' : '#0f1623',
        border: `2px solid ${card.selected ? color : '#1e293b'}`,
        borderRadius: 8,
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 2, userSelect: 'none',
        transform: card.selected ? 'translateY(-12px)' : 'none',
        transition: 'transform 0.18s, border-color 0.18s',
        boxShadow: card.selected ? `0 8px 24px ${color}44` : 'none',
      }}
    >
      <div style={{ fontSize: 22, color, lineHeight: 1 }}>{SUIT_SYMBOL[card.suit]}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{RANK_LABEL[card.rank]}</div>
    </div>
  );
}

// ── Joker 组件 ──

const JOKER_META: Record<string, { name: string; desc: (v: number) => string; color: string }> = {
  mult_bonus: { name: 'Jolly Joker', desc: v => `每打出一个对子 +${v} 倍率`, color: '#f59e0b' },
  chip_bonus: { name: 'Scholar',     desc: v => `打出 A 时 +${v} 筹码`,       color: '#a78bfa' },
};

function JokerCard({ joker }: { joker: JokerState }) {
  const meta = JOKER_META[joker.effectType] ?? { name: joker.id, desc: v => `+${v}`, color: '#64748b' };
  return (
    <div style={{
      width: 80, height: 110,
      background: 'linear-gradient(160deg, #1a1020, #0d0818)',
      border: `2px solid ${meta.color}66`,
      borderRadius: 8,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 4, padding: '8px 4px',
    }}>
      <div style={{ fontSize: 26 }}>🃏</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: meta.color, textAlign: 'center', lineHeight: 1.3 }}>{meta.name}</div>
      <div style={{ fontSize: 8, color: '#64748b', textAlign: 'center', lineHeight: 1.3 }}>{meta.desc(joker.value)}</div>
    </div>
  );
}

// ── Main Panel ──

function GameEPanel({ engine }: { engine: Engine }) {
  const [cards, setCards] = useState<CardState[]>(() => readCards(engine.world));
  const [jokers, setJokers] = useState<JokerState[]>(() => readJokers(engine.world));
  const [lastScore, setLastScore] = useState<{ hand: string; chips: number; mult: number; total: number } | null>(null);
  const [roundScore, setRoundScore] = useState(0);
  const [handsLeft, setHandsLeft] = useState(4);

  useEffect(() => engine.subscribe(() => {
    setCards(readCards(engine.world));
    setJokers(readJokers(engine.world));
  }), [engine]);

  const toggleCard = useCallback((id: string) => {
    const c = cards.find(c => c.id === id);
    if (!c) return;
    const selected = cards.filter(x => x.selected).length;
    if (!c.selected && selected >= 5) return; // max 5 selected
    const res = engine.world.getComponent<{ type: 'Resource'; id: string; current: number }>(id, 'Resource');
    if (res) res.current = c.selected ? 0 : 1;
    setCards(readCards(engine.world));
  }, [cards, engine]);

  const playHand = useCallback(() => {
    const sel = cards.filter(c => c.selected);
    if (sel.length < 1 || handsLeft <= 0) return;
    const result = evalHand(sel.map(c => c.rank), sel.map(c => c.suit));

    // 应用小丑效果
    let chips = result.baseChips + result.cardChips;
    let mult  = result.baseMult;
    for (const j of jokers) {
      if (j.effectType === 'chip_bonus' && sel.some(c => c.rank === 1)) chips += j.value;
      if (j.effectType === 'mult_bonus' && result.type === 'Pair')       mult  += j.value;
    }
    const total = chips * mult;
    setLastScore({ hand: result.type, chips, mult, total });
    setRoundScore(s => s + total);
    setHandsLeft(h => h - 1);

    // 解除选中状态（写回 world）
    for (const c of sel) {
      const res = engine.world.getComponent<{ type: 'Resource'; id: string; current: number }>(c.id, 'Resource');
      if (res) res.current = 0;
    }
    setCards(readCards(engine.world));
  }, [cards, jokers, handsLeft, engine]);

  const reset = useCallback(() => {
    for (const c of cards) {
      const res = engine.world.getComponent<{ type: 'Resource'; id: string; current: number }>(c.id, 'Resource');
      if (res) res.current = 0;
    }
    setCards(readCards(engine.world));
    setLastScore(null);
    setRoundScore(0);
    setHandsLeft(4);
  }, [cards, engine]);

  const selectedCount = cards.filter(c => c.selected).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 24px', width: '100%', maxWidth: 680 }}>
      {/* Round info */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#475569' }}>ROUND SCORE</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{roundScore.toLocaleString()}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#475569' }}>HANDS LEFT</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: handsLeft > 1 ? '#e2e8f0' : '#ef4444' }}>{handsLeft}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#475569' }}>BLIND</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#94a3b8' }}>300</div>
        </div>
      </div>

      {/* Score display */}
      {lastScore && (
        <div style={{
          background: '#0f1623', border: '1px solid #1e293b', borderRadius: 10,
          padding: '10px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>{lastScore.hand}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            <span style={{ color: '#38bdf8' }}>{lastScore.chips}</span>
            {' 筹码 × '}
            <span style={{ color: '#f87171' }}>{lastScore.mult}</span>
            {' 倍率 = '}
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>{lastScore.total.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Jokers */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 10, color: '#475569', paddingTop: 44 }}>JOKERS</div>
        {jokers.map(j => <JokerCard key={j.id} joker={j} />)}
      </div>

      {/* Hand */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', minHeight: 120 }}>
        {cards.map(c => <CardView key={c.id} card={c} onClick={() => toggleCard(c.id)} />)}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={playHand}
          disabled={selectedCount === 0 || handsLeft === 0}
          style={{
            padding: '10px 32px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: selectedCount > 0 && handsLeft > 0 ? 'pointer' : 'default',
            background: selectedCount > 0 && handsLeft > 0 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.06)',
            color: selectedCount > 0 && handsLeft > 0 ? '#0f172a' : '#475569',
            border: 'none', transition: 'all 0.18s',
          }}
        >
          {handsLeft > 0 ? `▶ Play Hand (${selectedCount} selected)` : 'No Hands Left'}
        </button>
        <button
          onClick={reset}
          style={{
            padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid #1e293b',
          }}
        >
          Reset
        </button>
      </div>

      <div style={{ fontSize: 10, color: '#334155', textAlign: 'center', maxWidth: 480, lineHeight: 1.6 }}>
        点击卡牌选中（最多 5 张）→ Play Hand 结算。小丑牌自动叠加效果。
        手牌评估 + 小丑效果为 UI 层纯函数（卡牌数据存于 engine.world 实体）。
      </div>
    </div>
  );
}

export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;background:linear-gradient(180deg,#080610 0%,#0a0714 100%);display:flex;align-items:center;justify-content:center;color:#cbd5e1;font:13px system-ui';

  const reactWrap = document.createElement('div');
  reactWrap.style.cssText = 'width:100%;display:flex;justify-content:center';
  wrapper.appendChild(reactWrap);
  container.appendChild(wrapper);

  const engine = new Engine({ tickRate: 10 }); // 低频 tick：卡牌游戏事件驱动，tick 仅保障状态同步
  engine.load(buildGameEBlueprint());
  engine.start();

  const root = createRoot(reactWrap);
  root.render(<GameEPanel engine={engine} />);

  return () => {
    engine.stop();
    root.unmount();
    wrapper.remove();
  };
}
