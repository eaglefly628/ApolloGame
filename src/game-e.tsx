import React, { useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Engine } from './runtime/engine.js';
import type { Resource, PlayedHand, Flag, StringVar } from './engine/protocol/components.js';
import {
  buildGameEBlueprint, buildJokerEntities, toEngineCard,
  R_CHIPS, R_MULT, R_HAND_SCORE, R_ROUND_SCORE, R_HANDS_LEFT, R_BLIND, V_HAND_TYPE,
} from './games/game-e/blueprint.js';
import { HAND_RANKINGS, shuffledDeck, STARTER_JOKERS, type Card, type Suit, type Rank, type HandType } from './games/game-e/index.js';
import { cardCell, CELL_W, CELL_H, SHEET_W, SHEET_H } from './games/game-e/cards-atlas.js';

// ════════════════════════════════════════════════════════════════════════
//  Game E · 小丑牌 —— 真引擎跑分 + 真美术（MVP-0 单人 vs Boss 核心闭环）。
//
//  ★ 逻辑全在引擎：牌型/逐张筹码/小丑有序加乘/资源×资源合并/回合累加全由 buildGameEBlueprint 算
//  （poker-hand REQ-011 + card-scoring REQ-014 + effect-apply REQ-012/013 + 回合循环边沿门）。
//  本文件是**薄表现层**：① 选牌→写 PlayedHand+scoring（输入层）② 读世界 Resource 投影成画面。
//  回合态(round_score/hands_left)住 ECS（非 React state）；牌序用确定性种子洗牌（lockstep 铺路）。
// ════════════════════════════════════════════════════════════════════════

const CARDS_URL = '/assets/FreeArtLib/cardgame/cards.png';
const JOKER_URL = (file: string) => `/assets/FreeArtLib/cardgame/card/${file}`;
const SCALE = 1.15;
const CW = Math.round(CELL_W * SCALE);
const CH = Math.round(CELL_H * SCALE);
const HAND_SIZE = 8;

// 牌桌上的小丑 = 引擎实际接线的 STARTER_JOKERS（全 14 张，buildJokerEntities 派生进蓝图）。
// 名实一致：UI 显示什么，引擎就按什么计分。art 文件名按官方命名推导，无图 onError fallback emoji。
const TABLE_JOKERS = STARTER_JOKERS.map((j) => ({
  name: j.name,
  file: `${j.name.replace(/ /g, '_')}.webp`,
  desc: j.text,
}));

// cards.png 单格背景定位（按花色点数取格）。
function cardBg(suit: Suit, rank: Rank): React.CSSProperties {
  const { col, row } = cardCell(suit, rank);
  return {
    width: CW, height: CH,
    backgroundImage: `url(${CARDS_URL})`,
    backgroundSize: `${SHEET_W * SCALE}px ${SHEET_H * SCALE}px`,
    backgroundPosition: `-${col * CELL_W * SCALE}px -${row * CELL_H * SCALE}px`,
    borderRadius: 6,
  };
}

function GameE() {
  const engineRef = useRef<Engine | null>(null);
  const seedRef = useRef(20260608);
  const deckRef = useRef<Card[]>([]);
  const deckPtrRef = useRef(0);

  if (engineRef.current === null) {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameEBlueprint(buildJokerEntities(STARTER_JOKERS)));
    engineRef.current = e;
    deckRef.current = shuffledDeck(seedRef.current);
    deckPtrRef.current = HAND_SIZE;
  }
  const engine = engineRef.current;

  const [hand, setHand] = useState<Card[]>(() => deckRef.current.slice(0, HAND_SIZE));
  const [sel, setSel] = useState<boolean[]>(() => new Array(HAND_SIZE).fill(false));
  const [result, setResult] = useState<{ type: HandType; chips: number; mult: number; score: number } | null>(null);
  const [, force] = useState(0); // 触发重渲染读最新世界资源

  const resOf = useCallback((id: string): number => {
    for (const [eid] of engine.world.query('Resource')) {
      const r = engine.world.getComponent<Resource>(eid, 'Resource');
      if (r && r.id === id) return r.current;
    }
    return 0;
  }, [engine]);

  const blind = resOf(R_BLIND);
  const roundScore = resOf(R_ROUND_SCORE);
  const handsLeft = resOf(R_HANDS_LEFT);
  const bossHp = Math.max(0, blind - roundScore); // Boss 血 = 盲注线剩余（round_score 由引擎累加）
  const dead = roundScore >= blind;
  const lost = !dead && handsLeft <= 0;

  const toggle = useCallback((i: number) => {
    setSel((prev) => {
      const cnt = prev.filter(Boolean).length;
      if (!prev[i] && cnt >= 5) return prev;
      return prev.map((s, j) => (j === i ? !s : s));
    });
  }, []);

  const drawTo = useCallback((kept: Card[]): Card[] => {
    const deck = deckRef.current;
    const need = HAND_SIZE - kept.length;
    const drawn = deck.slice(deckPtrRef.current, deckPtrRef.current + need);
    deckPtrRef.current += drawn.length;
    return [...kept, ...drawn];
  }, []);

  const play = useCallback(() => {
    const chosen = hand.filter((_, i) => sel[i]);
    if (chosen.length === 0 || dead || lost) return;

    // ① 输入层：填出牌 + 开 scoring → tick（引擎认牌型/逐张/小丑/合并 + 边沿累加 round_score、hands_left-1）。
    engine.world.getComponent<PlayedHand>('table', 'PlayedHand')!.cards = chosen.map(toEngineCard);
    engine.world.getComponent<Flag>('scoring', 'Flag')!.active = true;
    engine.world.tick();

    const chips = resOf(R_CHIPS);
    const mult = resOf(R_MULT);
    const score = resOf(R_HAND_SCORE);
    let type: HandType = 'high_card';
    for (const [eid] of engine.world.query('StringVar')) {
      const v = engine.world.getComponent<StringVar>(eid, 'StringVar');
      if (v && v.id === V_HAND_TYPE) type = v.value.replace(/-/g, '_') as HandType;
    }

    // ② 收尾一拍：清出牌 + 关 scoring（disarm 边沿门，下手可再触发）。
    engine.world.getComponent<PlayedHand>('table', 'PlayedHand')!.cards = [];
    engine.world.getComponent<Flag>('scoring', 'Flag')!.active = false;
    engine.world.tick();

    setResult({ type, chips, mult, score });

    // ③ 抽牌补手：移除已出，从牌库补到 8 张。
    const rest = hand.filter((_, i) => !sel[i]);
    const next = drawTo(rest);
    setHand(next);
    setSel(new Array(next.length).fill(false));
    force((n) => n + 1);
  }, [hand, sel, dead, lost, engine, resOf, drawTo]);

  const newRun = useCallback(() => {
    seedRef.current += 1; // 换种子 → 新牌序（仍确定性可复现）
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameEBlueprint(buildJokerEntities(STARTER_JOKERS)));
    engineRef.current = e;
    deckRef.current = shuffledDeck(seedRef.current);
    deckPtrRef.current = HAND_SIZE;
    setHand(deckRef.current.slice(0, HAND_SIZE));
    setSel(new Array(HAND_SIZE).fill(false));
    setResult(null);
    force((n) => n + 1);
  }, []);

  const selCount = sel.filter(Boolean).length;
  const msg = dead ? '🎉 击败 Boss（round_score ≥ 盲注线）' : lost ? '💀 出牌耗尽，未达盲注线' : '选最多 5 张 → 出牌，真引擎认牌型并结算';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 24, color: '#e2e8f0', font: '13px system-ui', width: '100%', maxWidth: 760 }}>
      {/* Boss 条（= 盲注线剩余）*/}
      <div style={{ width: '100%', maxWidth: 620 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
          <span>👹 Boss{dead ? ' · 击败！' : ''}　<span style={{ color: '#64748b', fontSize: 11 }}>出牌次数 {handsLeft}</span></span>
          <span style={{ color: '#fca5a5' }}>{bossHp.toLocaleString()} / {blind.toLocaleString()}</span>
        </div>
        <div style={{ height: 16, background: '#2a1118', borderRadius: 8, overflow: 'hidden', border: '1px solid #4b1d24' }}>
          <div style={{ width: `${blind > 0 ? (bossHp / blind) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg,#ef4444,#f87171)', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* 小丑排（全 14 张，引擎接线；真美术 webp，缺图 emoji 兜底）*/}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 720 }}>
        {TABLE_JOKERS.map((j) => (
          <div key={j.name} title={`${j.name} · ${j.desc}`} style={{ width: 64, height: 92, borderRadius: 8, border: '1px solid #3a2a4a', background: '#160f22', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* emoji 兜底层（img 加载成功则覆盖；onError 隐藏 img 露出它）*/}
            <div style={{ width: '100%', height: 66, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🃏</div>
            <img
              src={JOKER_URL(j.file)} alt={j.name}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 66, objectFit: 'cover' }}
            />
            <div style={{ fontSize: 7, textAlign: 'center', color: '#a78bfa', padding: '2px', lineHeight: 1.2 }}>{j.desc}</div>
          </div>
        ))}
      </div>

      {/* 结算读出（读世界，不在视图算）*/}
      <div style={{ background: '#0b1c22', border: '1px solid #2b5562', borderRadius: 10, padding: '8px 22px', minWidth: 360, textAlign: 'center' }}>
        {result ? (
          <div style={{ fontSize: 15 }}>
            <span style={{ color: '#ffd166', fontWeight: 700 }}>{HAND_RANKINGS[result.type]?.name ?? result.type}</span>{'  '}
            <span style={{ color: '#4cc9f0', fontWeight: 700 }}>{result.chips}</span> 筹码 ×{' '}
            <span style={{ color: '#f72585', fontWeight: 700 }}>{result.mult}</span> 倍 ={' '}
            <span style={{ color: '#90be6d', fontWeight: 800 }}>{result.score.toLocaleString()}</span>
          </div>
        ) : (
          <div style={{ color: '#64748b' }}>{msg}</div>
        )}
      </div>

      {/* 手牌（真牌面 cards.png 切图）*/}
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
        逻辑全在引擎（poker-eval 认牌型 + 逐张筹码 + 小丑 effect 有序加乘 + 资源×资源合并 + 回合边沿累加），本界面只读引擎资源显示。
        牌面取自 cards.png（按花色点数切 UV），小丑为真美术 webp。种子洗牌确定性可复现。
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
