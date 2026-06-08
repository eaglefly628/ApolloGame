import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Engine } from './runtime/engine.js';
import type { Resource, PlayedHand, Flag, StringVar } from './engine/protocol/components.js';
import {
  buildGameEBlueprint, buildJokerEntities, jokerToEntities, toEngineCard,
  R_CHIPS, R_MULT, R_MONEY, R_HAND_SCORE, R_ROUND_SCORE, R_HANDS_LEFT, R_DISCARDS_LEFT, R_BLIND, V_HAND_TYPE,
} from './games/game-e/blueprint.js';
import {
  HAND_RANKINGS, RANK_ORDER, shuffledDeck, STARTER_JOKERS, blindRequirement, BLIND_ORDER,
  type Card, type Suit, type Rank, type HandType, type JokerCard, type BlindKind,
} from './games/game-e/index.js';
import { cardCell, CELL_W, CELL_H, SHEET_W, SHEET_H } from './games/game-e/cards-atlas.js';

// ════════════════════════════════════════════════════════════════════════
//  Game E · 小丑牌 单人 MVP（按设计稿 §五 回合流程：Ante→三盲注→冲线→商店）。
//
//  顺序：每个 Ante = Small(×1)→Big(×1.5)→Boss(×2) 三道盲注。每道：发 8 张 + hands(4)/discards(3)
//    → 选≤5 出牌(累加 round_score) 或弃牌(补牌不计分) → round_score≥盲注线 即过关
//    → 结算 $（基础+剩余手数+利息）→ 商店买小丑 → 下一道盲注；hands 耗尽未过线 = 失败。
//  ★ 开局 0 小丑（buildJokerEntities([])）；小丑只能在商店买（jokerToEntities 加进运行中的引擎）。
//  逻辑全在引擎（poker-hand/card-scoring/effect-apply）；本文件是回合流程 + 表现的薄层（读/写世界资源）。
// ════════════════════════════════════════════════════════════════════════

const CARDS_URL = '/assets/FreeArtLib/cardgame/cards.png';
const JOKER_URL = (name: string) => `/assets/FreeArtLib/cardgame/card/${name.replace(/ /g, '_')}.webp`;
const SCALE = 1.1;
const CW = Math.round(CELL_W * SCALE);
const CH = Math.round(CELL_H * SCALE);
const HAND_SIZE = 8;
const HANDS_PER_BLIND = 4;
const DISCARDS_PER_BLIND = 3;
const JOKER_SLOTS = 5;
const REROLL_COST = 5;

const RARITY_COLOR: Record<string, string> = { common: '#9ca3af', uncommon: '#34d399', rare: '#60a5fa', legendary: '#f59e0b' };

const BLIND_META: Record<BlindKind, { label: string; icon: string; reward: number }> = {
  small: { label: '小盲注', icon: '🔸', reward: 3 },
  big: { label: '大盲注', icon: '🔶', reward: 4 },
  boss: { label: 'Boss 盲注', icon: '👹', reward: 5 },
};

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

type Phase = 'playing' | 'shop' | 'lost';

function GameE() {
  const engineRef = useRef<Engine | null>(null);
  const seedRef = useRef(20260608);
  const deckRef = useRef<Card[]>([]);
  const deckPtrRef = useRef(0);

  const [ante, setAnte] = useState(1);
  const [blindIdx, setBlindIdx] = useState(0); // 0 small, 1 big, 2 boss
  const [owned, setOwned] = useState<JokerCard[]>([]);
  const [hand, setHand] = useState<Card[]>(() => shuffledDeck(20260608).slice(0, HAND_SIZE));
  const [sel, setSel] = useState<boolean[]>(() => new Array(HAND_SIZE).fill(false));
  const [phase, setPhase] = useState<Phase>('playing');
  const [result, setResult] = useState<{ type: HandType; chips: number; mult: number; score: number } | null>(null);
  const [shopOffer, setShopOffer] = useState<JokerCard[]>([]);
  const [anim, setAnim] = useState<{ idx: number[]; mode: 'play' | 'discard' } | null>(null); // 正在飞出的手牌下标
  const [newKeys, setNewKeys] = useState<Set<string>>(() => new Set()); // 刚抽到的牌（飞入动画）
  const [, force] = useState(0);
  const bump = () => force((n) => n + 1);
  const keyOf = (c: Card) => `${c.suit}${c.rank}`;
  const busy = anim !== null;

  const [log, setLog] = useState<string[]>([]); // 算分回馈 log（游戏性流水）
  const pushLog = (s: string) => setLog((l) => [s, ...l].slice(0, 14));

  // 飞入动画播完即清（避免后续重渲染重复触发）。
  useEffect(() => {
    if (newKeys.size === 0) return;
    const t = window.setTimeout(() => setNewKeys(new Set()), 450);
    return () => window.clearTimeout(t);
  }, [newKeys]);

  // 手牌排序（表现层）：按花色或点数；sel 跟着牌一起重排（不错位）。
  const SUIT_ORD: Record<Suit, number> = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
  const sortHand = useCallback((mode: 'suit' | 'rank') => {
    setHand((h) => {
      const paired = h.map((c, i) => ({ c, s: sel[i] ?? false }));
      paired.sort((a, b) => mode === 'suit'
        ? (SUIT_ORD[a.c.suit] - SUIT_ORD[b.c.suit]) || (RANK_ORDER[b.c.rank] - RANK_ORDER[a.c.rank])
        : (RANK_ORDER[b.c.rank] - RANK_ORDER[a.c.rank]) || (SUIT_ORD[a.c.suit] - SUIT_ORD[b.c.suit]));
      setSel(paired.map((p) => p.s));
      return paired.map((p) => p.c);
    });
  }, [sel]);

  // ── 引擎资源读写（输入/投影层）──
  const resOf = useCallback((id: string): Resource | undefined => {
    const e = engineRef.current!;
    for (const [eid] of e.world.query('Resource')) {
      const r = e.world.getComponent<Resource>(eid, 'Resource');
      if (r && r.id === id) return r;
    }
    return undefined;
  }, []);
  const get = useCallback((id: string) => resOf(id)?.current ?? 0, [resOf]);
  const set = useCallback((id: string, v: number) => {
    const r = resOf(id);
    if (r) r.current = Math.max(r.min, Math.min(r.max, v));
  }, [resOf]);

  // 一道盲注开局：重置回合资源 + 设盲注线 + 洗牌发 8 张。
  const startBlind = useCallback((a: number, bi: number) => {
    const e = engineRef.current!;
    setLog([`— Ante ${a} · ${BLIND_META[BLIND_ORDER[bi]].label} 目标 ${blindRequirement(a, BLIND_ORDER[bi]).toLocaleString()} —`]);
    set(R_ROUND_SCORE, 0); set(R_HANDS_LEFT, HANDS_PER_BLIND); set(R_DISCARDS_LEFT, DISCARDS_PER_BLIND);
    set(R_CHIPS, 0); set(R_MULT, 0); set(R_HAND_SCORE, 0);
    set(R_BLIND, blindRequirement(a, BLIND_ORDER[bi]));
    e.world.getComponent<PlayedHand>('table', 'PlayedHand')!.cards = [];
    seedRef.current += 1;
    deckRef.current = shuffledDeck(seedRef.current);
    deckPtrRef.current = HAND_SIZE;
    setHand(deckRef.current.slice(0, HAND_SIZE));
    setSel(new Array(HAND_SIZE).fill(false));
    setResult(null);
    setPhase('playing');
    bump();
  }, [set]);

  // 首次构建引擎（开局 0 小丑）。
  if (engineRef.current === null) {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameEBlueprint(buildJokerEntities([])));
    engineRef.current = e;
    deckRef.current = shuffledDeck(seedRef.current);
    deckPtrRef.current = HAND_SIZE;
    // 初始第一道盲注线（resource 默认 300=ante1 small，对齐）。
  }
  const engine = engineRef.current;

  const drawTo = useCallback((kept: Card[]): Card[] => {
    const deck = deckRef.current;
    const need = HAND_SIZE - kept.length;
    const drawn = deck.slice(deckPtrRef.current, deckPtrRef.current + need);
    deckPtrRef.current += drawn.length;
    return [...kept, ...drawn];
  }, []);

  const blindKind = BLIND_ORDER[blindIdx];
  const target = get(R_BLIND);
  const roundScore = get(R_ROUND_SCORE);
  const handsLeft = get(R_HANDS_LEFT);
  const discardsLeft = get(R_DISCARDS_LEFT);
  const money = get(R_MONEY);
  const selCount = sel.filter(Boolean).length;

  const toggle = useCallback((i: number) => {
    setSel((prev) => {
      const cnt = prev.filter(Boolean).length;
      if (!prev[i] && cnt >= 5) return prev;
      return prev.map((s, j) => (j === i ? !s : s));
    });
  }, []);

  const commitPlay = useCallback(() => {
    const chosen = hand.filter((_, i) => sel[i]);
    if (chosen.length === 0) { setAnim(null); return; }

    engine.world.getComponent<PlayedHand>('table', 'PlayedHand')!.cards = chosen.map(toEngineCard);
    engine.world.getComponent<Flag>('scoring', 'Flag')!.active = true;
    engine.world.tick(); // poker-eval + 逐张 + 小丑 + 合并 + 边沿累加 round_score、hands-1

    const chips = get(R_CHIPS), mult = get(R_MULT), score = get(R_HAND_SCORE);
    let type: HandType = 'high_card';
    for (const [eid] of engine.world.query('StringVar')) {
      const v = engine.world.getComponent<StringVar>(eid, 'StringVar');
      if (v && v.id === V_HAND_TYPE) type = v.value.replace(/-/g, '_') as HandType;
    }
    engine.world.getComponent<PlayedHand>('table', 'PlayedHand')!.cards = [];
    engine.world.getComponent<Flag>('scoring', 'Flag')!.active = false;
    engine.world.tick(); // 收尾：disarm 边沿门

    setResult({ type, chips, mult, score });
    pushLog(`▶ ${HAND_RANKINGS[type]?.name ?? type}　${chips.toLocaleString()} × ${mult} = ${score.toLocaleString()}`);

    const rs = get(R_ROUND_SCORE);
    pushLog(`　累计 ${rs.toLocaleString()} / ${get(R_BLIND).toLocaleString()}${rs >= get(R_BLIND) ? '　✅ 过关！' : ''}`);
    if (rs >= get(R_BLIND)) {
      // 过关 → 结算 $（基础 + 剩余手数 + 利息 $1/$5 上限5）→ 商店。
      const reward = BLIND_META[blindKind].reward + get(R_HANDS_LEFT) + Math.min(5, Math.floor(get(R_MONEY) / 5));
      set(R_MONEY, get(R_MONEY) + reward);
      const pool = STARTER_JOKERS.filter((j) => !owned.some((o) => o.id === j.id));
      const offer: JokerCard[] = [];
      const tmp = [...pool];
      for (let k = 0; k < 3 && tmp.length; k++) offer.push(tmp.splice(Math.floor(Math.random() * tmp.length), 1)[0]);
      setShopOffer(offer);
      setPhase('shop');
      setAnim(null);
      bump();
      return;
    }
    if (get(R_HANDS_LEFT) <= 0) { setPhase('lost'); setAnim(null); bump(); return; }

    const kept = hand.filter((_, i) => !sel[i]);
    const next = drawTo(kept);
    setHand(next);
    setSel(new Array(next.length).fill(false));
    setNewKeys(new Set(next.slice(kept.length).map(keyOf))); // 补抽的牌 → 飞入
    setAnim(null);
    bump();
  }, [hand, sel, engine, get, set, drawTo, blindKind, owned]);

  const commitDiscard = useCallback(() => {
    set(R_DISCARDS_LEFT, get(R_DISCARDS_LEFT) - 1);
    const kept = hand.filter((_, i) => !sel[i]);
    pushLog(`♻ 弃 ${hand.length - kept.length} 张，补牌`);
    const next = drawTo(kept);
    setHand(next);
    setSel(new Array(next.length).fill(false));
    setNewKeys(new Set(next.slice(kept.length).map(keyOf)));
    setAnim(null);
    bump();
  }, [hand, sel, get, set, drawTo]);

  // 两段式：先播飞出动画（380ms）→ 再提交（引擎结算 + 补牌飞入）。
  const beginAction = useCallback((mode: 'play' | 'discard') => {
    if (phase !== 'playing' || busy) return;
    const idx = sel.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
    if (idx.length === 0) return;
    if (mode === 'play' && handsLeft <= 0) return;
    if (mode === 'discard' && discardsLeft <= 0) return;
    setAnim({ idx, mode });
    window.setTimeout(() => (mode === 'play' ? commitPlay() : commitDiscard()), 380);
  }, [phase, busy, sel, handsLeft, discardsLeft, commitPlay, commitDiscard]);

  // 买小丑：扣 $、加入 owned、把它的实体注入运行中的引擎。
  const buyJoker = useCallback((j: JokerCard) => {
    if (owned.length >= JOKER_SLOTS || money < j.cost) return;
    set(R_MONEY, money - j.cost);
    const ents = jokerToEntities(j, owned.length);
    for (const [eid, comps] of Object.entries(ents)) {
      engine.world.createEntity(eid);
      for (const [type, data] of Object.entries(comps as Record<string, object>)) {
        engine.world.addComponent(eid, { type, ...(data as object) } as never);
      }
    }
    setOwned((o) => [...o, j]);
    setShopOffer((s) => s.filter((x) => x.id !== j.id));
    bump();
  }, [owned, money, engine, set]);

  const rollShop = useCallback((): JokerCard[] => {
    const tmp = STARTER_JOKERS.filter((j) => !owned.some((o) => o.id === j.id));
    const offer: JokerCard[] = [];
    for (let k = 0; k < 3 && tmp.length; k++) offer.push(tmp.splice(Math.floor(Math.random() * tmp.length), 1)[0]);
    return offer;
  }, [owned]);
  const reroll = useCallback(() => {
    if (money < REROLL_COST) return;
    set(R_MONEY, money - REROLL_COST);
    setShopOffer(rollShop());
    bump();
  }, [money, set, rollShop]);

  const nextBlind = useCallback(() => {
    let a = ante, bi = blindIdx + 1;
    if (bi > 2) { bi = 0; a += 1; setAnte(a); }
    setBlindIdx(bi);
    startBlind(a, bi);
  }, [ante, blindIdx, startBlind]);

  const restart = useCallback(() => {
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameEBlueprint(buildJokerEntities([])));
    engineRef.current = e;
    setOwned([]); setAnte(1); setBlindIdx(0);
    startBlind(1, 0);
  }, [startBlind]);

  const lost = phase === 'lost';
  const inShop = phase === 'shop';
  const progress = target > 0 ? Math.min(100, (roundScore / target) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 22, color: '#e2e8f0', font: '13px system-ui', width: '100%', maxWidth: 820 }}>
      {/* 算分回馈 log（右侧固定窗，游戏性流水）*/}
      <div style={{ position: 'fixed', right: 12, top: 70, width: 210, maxHeight: '70vh', overflowY: 'auto', background: 'rgba(11,28,34,0.92)', border: '1px solid #2b5562', borderRadius: 10, padding: '10px 12px', fontSize: 11, lineHeight: 1.7, zIndex: 20 }}>
        <div style={{ fontWeight: 700, color: '#ffd166', marginBottom: 6, fontSize: 12 }}>📜 结算日志</div>
        {log.length === 0 && <div style={{ color: '#475569' }}>（出牌后这里显示算分流水）</div>}
        {log.map((line, i) => (
          <div key={i} style={{ color: i === 0 ? '#e2e8f0' : '#7d93a8', borderBottom: line.startsWith('—') ? '1px dashed #2b5562' : 'none', paddingBottom: line.startsWith('—') ? 4 : 0, marginBottom: line.startsWith('—') ? 4 : 0 }}>{line}</div>
        ))}
      </div>
      {/* 顶部：Ante / 盲注 / 进度线 / 钱 */}
      <div style={{ width: '100%', maxWidth: 680 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
          <span style={{ fontWeight: 700 }}>Ante {ante} · {BLIND_META[blindKind].icon} {BLIND_META[blindKind].label}（{blindIdx + 1}/3）</span>
          <span>💰 <span style={{ color: '#ffd166', fontWeight: 700 }}>${money}</span>　<span style={{ color: '#64748b', fontSize: 11 }}>出牌 {handsLeft} · 弃牌 {discardsLeft}</span></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 3 }}>
          <span>得分 <span style={{ color: '#90be6d', fontWeight: 700 }}>{roundScore.toLocaleString()}</span></span>
          <span>目标 <span style={{ color: '#fca5a5' }}>{target.toLocaleString()}</span></span>
        </div>
        <div style={{ height: 14, background: '#1e293b', borderRadius: 7, overflow: 'hidden', border: '1px solid #334155' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg,#22c55e,#86efac)', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* 小丑排（owned；开局空）*/}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', minHeight: 74, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontSize: 10, color: '#64748b', letterSpacing: 1 }}>小丑 {owned.length}/{JOKER_SLOTS}</span>
        {owned.length === 0 && <span style={{ fontSize: 11, color: '#475569' }}>（开局无小丑，过盲注进商店购买）</span>}
        {owned.map((j) => (
          <div key={j.id} title={`${j.name} · ${j.text}`} style={{ width: 50, height: 70, borderRadius: 6, border: '1px solid #3a2a4a', background: '#160f22', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🃏</div>
            <img src={JOKER_URL(j.name)} alt={j.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
        ))}
      </div>

      {/* 结算读出 */}
      {result && !inShop && (
        <div style={{ background: '#0b1c22', border: '1px solid #2b5562', borderRadius: 10, padding: '6px 20px', fontSize: 14 }}>
          <span style={{ color: '#ffd166', fontWeight: 700 }}>{HAND_RANKINGS[result.type]?.name ?? result.type}</span>{'  '}
          <span style={{ color: '#4cc9f0', fontWeight: 700 }}>{result.chips}</span> ×{' '}
          <span style={{ color: '#f72585', fontWeight: 700 }}>{result.mult}</span> ={' '}
          <span style={{ color: '#90be6d', fontWeight: 800 }}>{result.score.toLocaleString()}</span>
        </div>
      )}

      {/* ── 商店（美化：稀有度光晕 + 进场交错 + 悬浮抬升 + 重摇）── */}
      {inShop && (
        <div style={{ width: '100%', maxWidth: 660, background: 'linear-gradient(160deg,#132a33,#0a1622)', border: '1px solid #2b5562', borderRadius: 16, padding: 20, boxShadow: '0 12px 40px #0008', position: 'relative', overflow: 'hidden' }}>
          <style>{`
            @keyframes ge-shopIn { from { transform: translateY(24px) scale(.9); opacity: 0 } to { transform: none; opacity: 1 } }
            @keyframes ge-coin { 0%{transform:translateY(0)} 50%{transform:translateY(-3px)} 100%{transform:translateY(0)} }
            @keyframes ge-sheen { from { background-position: -200% 0 } to { background-position: 200% 0 } }
            .ge-shop-card { transition: transform .18s ease, box-shadow .18s ease; }
            .ge-shop-card:hover { transform: translateY(-8px) scale(1.03); }
            .ge-buy:hover:not(:disabled) { filter: brightness(1.12); }
          `}</style>

          {/* 顶部光带 */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,transparent,#ffd166,#f59e0b,transparent)', backgroundSize: '200% 100%', animation: 'ge-sheen 3s linear infinite' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#ffd166', letterSpacing: 1 }}>🛒 商店</span>
            <span style={{ fontSize: 15, color: '#ffd166', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', animation: 'ge-coin 1.6s ease-in-out infinite' }}>💰</span> ${money}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', minHeight: 200 }}>
            {shopOffer.length === 0 && <span style={{ color: '#64748b', fontSize: 12, alignSelf: 'center' }}>（已售空 —— 重摇或进入下一道）</span>}
            {shopOffer.map((j, i) => {
              const rc = RARITY_COLOR[j.rarity];
              const can = money >= j.cost && owned.length < JOKER_SLOTS;
              return (
                <div key={j.id} className="ge-shop-card" style={{
                  width: 150, borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
                  background: 'linear-gradient(165deg,#1a1226,#0d0818)', border: `1.5px solid ${rc}`,
                  boxShadow: `0 0 14px ${rc}44, inset 0 0 20px ${rc}11`,
                  animation: `ge-shopIn .35s ease ${i * 0.08}s both`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: rc, textTransform: 'uppercase', letterSpacing: 1 }}>{j.rarity}</span>
                    <span style={{ fontSize: 9, color: '#64748b' }}>{j.jokerType}</span>
                  </div>
                  <div style={{ width: '100%', height: 120, borderRadius: 8, overflow: 'hidden', position: 'relative', background: '#0d0818', boxShadow: `inset 0 0 16px ${rc}22` }}>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🃏</div>
                    <img src={JOKER_URL(j.name)} alt={j.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: '#f1f5f9' }}>{j.name}</div>
                  <div style={{ fontSize: 9.5, color: '#a78bfa', textAlign: 'center', minHeight: 26, lineHeight: 1.35 }}>{j.text}</div>
                  <button className="ge-buy" onClick={() => buyJoker(j)} disabled={!can} style={{ padding: '7px', borderRadius: 8, fontSize: 13, fontWeight: 800, border: 'none', cursor: can ? 'pointer' : 'default', background: can ? `linear-gradient(135deg,${rc},#f59e0b)` : '#1e293b', color: can ? '#1a1020' : '#475569', transition: 'filter .15s' }}>
                    {owned.length >= JOKER_SLOTS ? '槽位已满' : money < j.cost ? `💰$${j.cost}（钱不够）` : `购买 💰$${j.cost}`}
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
            <button onClick={reroll} disabled={money < REROLL_COST} style={{ padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700, border: '1px solid #475569', cursor: money >= REROLL_COST ? 'pointer' : 'default', background: money >= REROLL_COST ? 'rgba(96,165,250,0.12)' : '#1e293b', color: money >= REROLL_COST ? '#93c5fd' : '#475569' }}>
              🎲 重摇 💰${REROLL_COST}
            </button>
            <span style={{ fontSize: 11, color: '#64748b' }}>小丑槽 {owned.length}/{JOKER_SLOTS}</span>
            <button onClick={nextBlind} style={{ padding: '10px 24px', borderRadius: 9, fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#06210f', boxShadow: '0 4px 16px #22c55e44' }}>
              下一道盲注 ▶
            </button>
          </div>
        </div>
      )}

      {/* ── 手牌 + 操作（playing）── */}
      {phase === 'playing' && (
        <>
          {/* 出/弃/抽 动画关键帧（表现层）：飞入=从左上牌堆吸过来；飞出=向右垃圾桶；出牌=向上飞 */}
          <style>{`
            @keyframes ge-drawIn { from { transform: translate(-340px,-90px) scale(.25) rotate(-28deg); opacity: 0 } to { transform: none; opacity: 1 } }
            @keyframes ge-flyTrash { from { transform: none; opacity: 1 } to { transform: translate(320px,60px) scale(.45) rotate(40deg); opacity: 0 } }
            @keyframes ge-flyPlay { from { transform: translateY(-12px); opacity: 1 } to { transform: translateY(-170px) scale(1.18); opacity: 0 } }
          `}</style>

          {/* 排序按钮（表现层：按花色 / 按点数重排手牌） */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: '#64748b' }}>
            <span>排序</span>
            <button onClick={() => sortHand('suit')} disabled={busy} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, border: '1px solid #334155', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', cursor: busy ? 'default' : 'pointer' }}>🎨 花色</button>
            <button onClick={() => sortHand('rank')} disabled={busy} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, border: '1px solid #334155', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', cursor: busy ? 'default' : 'pointer' }}>🔢 点数</button>
          </div>

          {/* 牌堆(左) · 手牌(中) · 垃圾桶(右) */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 760, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', minHeight: CH + 36 }}>
            <div style={{ position: 'absolute', left: 8, bottom: 6, textAlign: 'center', color: '#64748b', fontSize: 10 }}>
              <div style={{ width: 42, height: 58, borderRadius: 6, background: 'linear-gradient(135deg,#1e3a5f,#0b1c33)', border: '1px solid #2b5562', boxShadow: '2px 2px 0 #0b1c33, 4px 4px 0 #0b1c33' }} />
              <div style={{ marginTop: 4 }}>牌堆</div>
            </div>

            <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 600 }}>
              {hand.map((c, i) => {
                const leaving = anim?.idx.includes(i);
                const animName = leaving ? (anim!.mode === 'discard' ? 'ge-flyTrash' : 'ge-flyPlay') : (newKeys.has(keyOf(c)) ? 'ge-drawIn' : undefined);
                return (
                  <div key={keyOf(c)} onClick={() => !busy && toggle(i)} style={{
                    ...cardBg(c.suit, c.rank), cursor: busy ? 'default' : 'pointer',
                    transform: sel[i] && !leaving ? 'translateY(-12px)' : 'none', transition: 'transform 0.15s',
                    outline: sel[i] ? '3px solid #ffd166' : '1px solid #0008',
                    boxShadow: sel[i] ? '0 8px 20px #ffd16655' : 'none',
                    animation: animName ? `${animName} 0.38s ease forwards` : undefined,
                  }} />
                );
              })}
            </div>

            <div title="弃牌桶" style={{ position: 'absolute', right: 8, bottom: 6, textAlign: 'center', color: '#64748b', fontSize: 10 }}>
              <div style={{ fontSize: 40, lineHeight: 1, filter: anim?.mode === 'discard' ? 'drop-shadow(0 0 8px #60a5fa)' : 'none', transition: 'filter 0.2s' }}>🗑️</div>
              <div style={{ marginTop: 2 }}>弃牌</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => beginAction('play')} disabled={selCount === 0 || handsLeft <= 0 || busy} style={{ padding: '10px 26px', borderRadius: 8, fontSize: 14, fontWeight: 700, border: 'none', cursor: selCount && handsLeft > 0 && !busy ? 'pointer' : 'default', background: selCount && handsLeft > 0 && !busy ? 'linear-gradient(135deg,#ffd166,#f59e0b)' : '#1e293b', color: selCount && handsLeft > 0 && !busy ? '#1a1020' : '#475569' }}>
              ▶ 出牌（{selCount}）
            </button>
            <button onClick={() => beginAction('discard')} disabled={selCount === 0 || discardsLeft <= 0 || busy} style={{ padding: '10px 22px', borderRadius: 8, fontSize: 14, fontWeight: 700, border: 'none', cursor: selCount && discardsLeft > 0 && !busy ? 'pointer' : 'default', background: selCount && discardsLeft > 0 && !busy ? 'linear-gradient(135deg,#60a5fa,#3b82f6)' : '#1e293b', color: selCount && discardsLeft > 0 && !busy ? '#0a1020' : '#475569' }}>
              ♻ 弃牌（{discardsLeft}）
            </button>
          </div>
        </>
      )}

      {/* ── 失败 ── */}
      {lost && (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, padding: 20 }}>
          <div style={{ fontSize: 18, color: '#ef4444', fontWeight: 700 }}>💀 出牌耗尽，未达盲注线（{roundScore.toLocaleString()} / {target.toLocaleString()}）</div>
          <button onClick={restart} style={{ padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#ffd166,#f59e0b)', color: '#1a1020', alignSelf: 'center' }}>重新开始</button>
        </div>
      )}

      <div style={{ fontSize: 10, color: '#3d4a5c', textAlign: 'center', maxWidth: 560, lineHeight: 1.6 }}>
        Ante 三盲注(Small×1/Big×1.5/Boss×2) → 选≤5 出牌冲线 / 弃牌换牌 → 过线结算$进商店买小丑 → 下一道。
        逻辑全在引擎（牌型/计分/小丑），本界面只读写世界资源。开局 0 小丑（Balatro 设定）。
      </div>
    </div>
  );
}

export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;inset:0;background:radial-gradient(circle at 50% 25%,#16323a,#0a0714);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px 0';
  container.appendChild(wrapper);
  const root = createRoot(wrapper);
  root.render(<GameE />);
  return () => { root.unmount(); wrapper.remove(); };
}
