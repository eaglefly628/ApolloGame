import React, { useState, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Engine } from './runtime/engine.js';
import type { Resource, PlayedHand, Flag, StringVar } from './engine/protocol/components.js';
import { buildGameEBlueprint, toEngineCard, R_CHIPS, R_MULT, R_HAND_SCORE, V_HAND_TYPE, F_SCORING } from './games/game-e/blueprint.js';
import { STANDARD_DECK, HAND_RANKINGS, type Card, type Suit, type Rank, type HandType } from './games/game-e/index.js';
import { cardCell, CELL_W, CELL_H, SHEET_W, SHEET_H } from './games/game-e/cards-atlas.js';

// Game E · 小丑牌 —— 真引擎跑分 + 真美术（MVP-0 单人 vs Boss 核心闭环）。
// 逻辑全在引擎（buildGameEBlueprint：poker-eval 认牌型 + PerCardScore 逐张 + 小丑 effect 有序加乘 + REQ-013 合并）；
// 本文件只是薄表现层：cards.png 切图出真牌面、小丑用真 webp，读引擎资源显示分数（手写 UI 仅布局，logic=数据）。

const CARDS_URL = '/assets/FreeArtLib/cardgame/cards.png';
const JOKER_URL = (file: string) => `/assets/FreeArtLib/cardgame/card/${file}`;
const SCALE = 1.15;
const CW = Math.round(CELL_W * SCALE); // 牌显示宽
const CH = Math.round(CELL_H * SCALE);

// 牌桌上的小丑（与引擎 buildGameEBlueprint 的计分小丑一致）。file=美术；无图则 fallback。
const TABLE_JOKERS = [
  { name: 'Joker', file: 'Joker.webp', desc: '+4 倍率' },
  { name: 'Sly Joker', file: 'Sly_Joker.webp', desc: '+50 筹码' },
  { name: 'Jolly Joker', file: 'Jolly_Joker.webp', desc: '含对子 +8 倍率' },
  { name: 'Cavendish', file: 'Cavendish.webp', desc: '×3 倍率' },
  { name: 'Bull', file: '', desc: '每 $1 +2 筹码' }, // 素材包暂缺
];

const shuffle = <T,>(a: readonly T[]): T[] => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

// cards.png 单格背景定位（按花色点数取格）。
function cardBg(suit: Suit, rank: Rank): React.CSSProperties {
  const { col, row } = cardCell(suit, rank);
  return {
    width: CW,
    height: CH,
    backgroundImage: `url(${CARDS_URL})`,
    backgroundSize: `${SHEET_W * SCALE}px ${SHEET_H * SCALE}px`,
    backgroundPosition: `-${col * CELL_W * SCALE}px -${row * CELL_H * SCALE}px`,
    borderRadius: 6,
  };
}

const BOSS_MAX = 600;

function GameE() {
  const engineRef = useRef<Engine | null>(null);
  if (engineRef.current === null) {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameEBlueprint());
    engineRef.current = e;
  }
  const engine = engineRef.current;

  const [hand, setHand] = useState<Card[]>(() => shuffle(STANDARD_DECK).slice(0, 8));
  const [sel, setSel] = useState<boolean[]>(() => new Array(8).fill(false));
  const [result, setResult] = useState<{ type: HandType; chips: number; mult: number; score: number } | null>(null);
  const [bossHp, setBossHp] = useState(BOSS_MAX);
  const [handsLeft, setHandsLeft] = useState(4);
  const [msg, setMsg] = useState('选最多 5 张 → 出牌，真引擎认牌型并结算');

  const resOf = useCallback((id: string): number => {
    for (const [eid] of engine.world.query('Resource')) {
      const r = engine.world.getComponent<Resource>(eid, 'Resource');
      if (r && r.id === id) return r.current;
    }
    return 0;
  }, [engine]);

  const toggle = useCallback((i: number) => {
    setSel((prev) => {
      const cnt = prev.filter(Boolean).length;
      if (!prev[i] && cnt >= 5) return prev;
      return prev.map((s, j) => (j === i ? !s : s));
    });
  }, []);

  const play = useCallback(() => {
    const chosen = hand.filter((_, i) => sel[i]);
    if (chosen.length === 0 || handsLeft <= 0 || bossHp <= 0) return;

    // 喂给真引擎：填出牌 + 开 scoring → tick 让 poker-eval/逐张/小丑/合并跑完 → 读结果。
    engine.world.getComponent<PlayedHand>('table', 'PlayedHand')!.cards = chosen.map(toEngineCard);
    engine.world.getComponent<Flag>('scoring', 'Flag')!.active = true;
    for (let i = 0; i < 5; i++) engine.world.tick();

    const chips = resOf(R_CHIPS);
    const mult = resOf(R_MULT);
    const score = resOf(R_HAND_SCORE);
    let type: HandType = 'high_card';
    for (const [eid] of engine.world.query('StringVar')) {
      const v = engine.world.getComponent<StringVar>(eid, 'StringVar');
      if (v && v.id === V_HAND_TYPE) type = (v.value.replace(/-/g, '_') as HandType) ?? 'high_card';
    }

    // 收尾：关 scoring + 清出牌（下次重算）。
    engine.world.getComponent<Flag>('scoring', 'Flag')!.active = false;
    engine.world.getComponent<PlayedHand>('table', 'PlayedHand')!.cards = [];

    setResult({ type, chips, mult, score });
    setBossHp((hp) => Math.max(0, hp - score));
    setHandsLeft((h) => h - 1);
    setMsg(`${HAND_RANKINGS[type]?.name ?? type}：${chips} × ${mult} = ${score} 砸向 Boss`);

    // 补牌：移除已出，从牌堆补到 8 张。
    const rest = hand.filter((_, i) => !sel[i]);
    const used = new Set([...rest, ...chosen].map((c) => `${c.suit}${c.rank}`));
    const pool = shuffle(STANDARD_DECK.filter((c) => !used.has(`${c.suit}${c.rank}`)));
    setHand([...rest, ...pool.slice(0, 8 - rest.length)]);
    setSel(new Array(8).fill(false));
  }, [hand, sel, handsLeft, bossHp, engine, resOf]);

  const newRun = useCallback(() => {
    setHand(shuffle(STANDARD_DECK).slice(0, 8));
    setSel(new Array(8).fill(false));
    setResult(null);
    setBossHp(BOSS_MAX);
    setHandsLeft(4);
    setMsg('新一局：选最多 5 张 → 出牌');
  }, []);

  const selCount = sel.filter(Boolean).length;
  const dead = bossHp <= 0;
  const lost = !dead && handsLeft <= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 24, color: '#e2e8f0', font: '13px system-ui', width: '100%', maxWidth: 760 }}>
      {/* Boss 条 */}
      <div style={{ width: '100%', maxWidth: 620 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
          <span>👹 Boss{dead ? ' · 击败！' : ''}</span>
          <span style={{ color: '#fca5a5' }}>{bossHp} / {BOSS_MAX}</span>
        </div>
        <div style={{ height: 16, background: '#2a1118', borderRadius: 8, overflow: 'hidden', border: '1px solid #4b1d24' }}>
          <div style={{ width: `${(bossHp / BOSS_MAX) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#ef4444,#f87171)', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* 小丑排（真美术） */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <span style={{ fontSize: 10, color: '#64748b', paddingBottom: 50, letterSpacing: 1 }}>JOKERS</span>
        {TABLE_JOKERS.map((j) => (
          <div key={j.name} title={j.desc} style={{ width: 78, height: 104, borderRadius: 8, border: '1px solid #3a2a4a', background: '#160f22', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {j.file ? (
              <img src={JOKER_URL(j.file)} alt={j.name} style={{ width: '100%', height: 80, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🃏</div>
            )}
            <div style={{ fontSize: 8, textAlign: 'center', color: '#a78bfa', padding: '3px 2px', lineHeight: 1.2 }}>{j.desc}</div>
          </div>
        ))}
      </div>

      {/* 结算读出 */}
      <div style={{ background: '#0b1c22', border: '1px solid #2b5562', borderRadius: 10, padding: '8px 22px', minWidth: 360, textAlign: 'center' }}>
        {result ? (
          <div style={{ fontSize: 15 }}>
            <span style={{ color: '#ffd166', fontWeight: 700 }}>{HAND_RANKINGS[result.type]?.name ?? result.type}</span>{'  '}
            <span style={{ color: '#4cc9f0', fontWeight: 700 }}>{result.chips}</span> 筹码 ×{' '}
            <span style={{ color: '#f72585', fontWeight: 700 }}>{result.mult}</span> 倍 ={' '}
            <span style={{ color: '#90be6d', fontWeight: 800 }}>{result.score}</span>
          </div>
        ) : (
          <div style={{ color: '#64748b' }}>{msg}</div>
        )}
      </div>

      {/* 手牌（真牌面 cards.png 切图） */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', minHeight: CH + 18 }}>
        {hand.map((c, i) => (
          <div
            key={`${c.suit}${c.rank}${i}`}
            onClick={() => toggle(i)}
            style={{
              ...cardBg(c.suit, c.rank),
              cursor: 'pointer',
              transform: sel[i] ? 'translateY(-14px)' : 'none',
              transition: 'transform 0.15s, box-shadow 0.15s',
              outline: sel[i] ? '3px solid #ffd166' : '1px solid #0008',
              boxShadow: sel[i] ? '0 8px 22px #ffd16655' : 'none',
            }}
          />
        ))}
      </div>

      {/* 操作 */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: handsLeft > 1 ? '#cbd5e1' : '#ef4444' }}>出牌次数 {handsLeft}</div>
        <button
          onClick={play}
          disabled={selCount === 0 || dead || lost}
          style={{ padding: '10px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700, border: 'none', cursor: selCount && !dead && !lost ? 'pointer' : 'default', background: selCount && !dead && !lost ? 'linear-gradient(135deg,#ffd166,#f59e0b)' : '#1e293b', color: selCount && !dead && !lost ? '#1a1020' : '#475569' }}
        >
          ▶ 出牌（{selCount}）
        </button>
        <button onClick={newRun} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, border: '1px solid #334155', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', cursor: 'pointer' }}>
          {dead ? '🎉 再来一局' : lost ? '💀 重来' : '新一局'}
        </button>
      </div>

      <div style={{ fontSize: 10, color: '#3d4a5c', textAlign: 'center', maxWidth: 520, lineHeight: 1.6 }}>
        逻辑全在引擎（poker-eval 认牌型 + 逐张筹码 + 小丑 effect 有序加乘 + 资源×资源合并），本界面只读引擎资源显示。
        牌面取自 cards.png（按花色点数切 UV），小丑为真美术 webp。
      </div>
    </div>
  );
}

export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,#16323a,#0a0714);display:flex;align-items:center;justify-content:center;overflow:auto';
  container.appendChild(wrapper);
  const root = createRoot(wrapper);
  root.render(<GameE />);
  return () => {
    root.unmount();
    wrapper.remove();
  };
}
