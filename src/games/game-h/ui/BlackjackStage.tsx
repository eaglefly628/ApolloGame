import React, { useState, useEffect, useCallback } from 'react';
import { Engine } from '../../../runtime/engine.js';
import type { Resource, State } from '@engine/protocol/components.js';
import { useWorldVersion } from '@ui/hooks/use-engine.js';
import { useComponent } from '@ui/hooks/use-component.js';
import {
  CHIPS_ID,
  BET_ID,
  BLACKJACK_LIMIT,
  DEALER_STAND_AT,
  INITIAL_CHIPS,
  MIN_BET,
  MAX_BET,
  GAME_STATES,
  OUTCOMES,
  buildDeck,
  type Card,
  type Hand,
} from '../theme.js';
import { GAME_STATE_ENTITY, CHIPS_ENTITY, BET_ENTITY } from '../blueprint.js';

const CARD_SUITS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

type Theme = 'onyx' | 'brocade';
type GamePhase = 'bet' | 'play' | 'result';

interface GameSession {
  deck: Card[];
  playerHands: Hand[];
  currentHandIndex: number;
  dealerCards: Card[];
  gameState: string;
  outcome?: string;
}

const THEMES: Record<Theme, Record<string, string>> = {
  onyx: {
    '--app-bg': 'linear-gradient(135deg, #0a0d12 0%, #06080b 100%)',
    '--hud-bg': 'linear-gradient(180deg, rgba(22,28,37,.95), rgba(14,18,24,.88))',
    '--dock-bg': 'linear-gradient(180deg, rgba(18,23,31,.7), rgba(10,13,18,.97))',
    '--ink': '#e7edf3',
    '--ink-dim': '#7e8c9b',
    '--accent': '#4ade80',
    '--gold': '#ffcb3d',
    '--danger': '#ef4444',
    '--table-bg': 'radial-gradient(130% 100% at 50% 36%, #1d6f4e 0%, #11543a 45%, #082c1f 100%)',
  },
  brocade: {
    '--app-bg': 'linear-gradient(135deg, #fdf4ee 0%, #f3e2dc 100%)',
    '--hud-bg': 'linear-gradient(180deg, rgba(255,250,244,.96), rgba(251,238,229,.9))',
    '--dock-bg': 'linear-gradient(180deg, rgba(255,250,244,.72), rgba(250,236,225,.98))',
    '--ink': '#5a3f44',
    '--ink-dim': '#a98b8f',
    '--accent': '#d8607b',
    '--gold': '#cf9a3f',
    '--danger': '#d65668',
    '--table-bg': 'radial-gradient(130% 100% at 50% 36%, #c97f86 0%, #b15f6b 45%, #8c4654 100%)',
  },
};

function calculateScore(cards: Card[]): { score: number; hasAce: boolean } {
  let score = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === 'A') {
      aces += 1;
      score += 11;
    } else {
      score += card.baseValue;
    }
  }
  while (score > BLACKJACK_LIMIT && aces > 0) {
    score -= 10;
    aces -= 1;
  }
  return { score, hasAce: aces > 0 };
}

function canSplit(hand: Hand): boolean {
  if (hand.cards.length !== 2) return false;
  return hand.cards[0].baseValue === hand.cards[1].baseValue;
}

function displayCard(card: Card): string {
  const suit = CARD_SUITS[card.suit as keyof typeof CARD_SUITS];
  return `${card.display}${suit}`;
}

interface CardCompProps {
  card: Card;
  hidden?: boolean;
}

function CardComp({ card, hidden = false }: CardCompProps): React.ReactElement {
  const suitColor = card.suit === 'hearts' || card.suit === 'diamonds' ? '#c0392b' : '#22303f';
  return (
    <div
      style={{
        width: 100,
        height: 140,
        background: hidden ? 'linear-gradient(150deg, #b1402f, #7d2a1e)' : '#fcf9f1',
        border: hidden ? '3px solid #fbf7ef' : '3px solid #000',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: hidden ? 0 : 28,
        fontWeight: 700,
        color: suitColor,
        animation: 'slideIn 0.4s ease-out',
        boxShadow: hidden ? '0 10px 24px rgba(0,0,0,.5)' : '0 8px 16px rgba(0,0,0,.2)',
        position: 'relative',
      }}
    >
      {!hidden && (
        <>
          <div style={{ position: 'absolute', top: 6, left: 6, textAlign: 'center', lineHeight: 1 }}>
            {displayCard(card)}
          </div>
          <div style={{ position: 'absolute', bottom: 6, right: 6, textAlign: 'center', lineHeight: 1, transform: 'rotate(180deg)' }}>
            {displayCard(card)}
          </div>
          <div style={{ fontSize: 52, textShadow: '0 2px 4px rgba(0,0,0,.1)' }}>
            {CARD_SUITS[card.suit as keyof typeof CARD_SUITS]}
          </div>
        </>
      )}
    </div>
  );
}

interface BlackjackStageProps {
  engine: Engine;
}

export function BlackjackStage({ engine }: BlackjackStageProps): React.ReactElement {
  useWorldVersion(engine);

  const [gameSession, setGameSession] = useState<GameSession>(() => ({
    deck: [],
    playerHands: [],
    currentHandIndex: 0,
    dealerCards: [],
    gameState: GAME_STATES.BETTING,
  }));

  const [currentBet, setCurrentBet] = useState(0);
  const [chips, setChips] = useState(INITIAL_CHIPS);
  const [sessionOutcome, setSessionOutcome] = useState<{ outcome?: string; winAmount: number }>({ winAmount: 0 });
  const [theme, setTheme] = useState<Theme>('onyx');
  const [gamePhase, setGamePhase] = useState<GamePhase>('bet');

  const themeVars = THEMES[theme];

  const initializeGame = useCallback((bet: number) => {
    const fullDeck = buildDeck();
    const deck = [...fullDeck].sort(() => Math.random() - 0.5);
    const playerCards = [deck.pop()!, deck.pop()!];
    const dealerCards = [deck.pop()!, deck.pop()!];

    const playerHand: Hand = {
      cards: playerCards,
      bet,
      status: 'active',
    };

    setGameSession({
      deck,
      playerHands: [playerHand],
      currentHandIndex: 0,
      dealerCards,
      gameState: GAME_STATES.PLAYER_TURN,
    });

    setCurrentBet(0);
    setGamePhase('play');
  }, []);

  const onHit = useCallback(() => {
    setGameSession((prev) => {
      const newSession = { ...prev };
      const hand = newSession.playerHands[newSession.currentHandIndex];

      if (newSession.deck.length === 0) return prev;
      hand.cards.push(newSession.deck.pop()!);

      const { score } = calculateScore(hand.cards);
      if (score > BLACKJACK_LIMIT) {
        hand.status = 'bust';
        if (newSession.currentHandIndex < newSession.playerHands.length - 1) {
          newSession.currentHandIndex += 1;
        } else {
          newSession.gameState = GAME_STATES.DEALER_TURN;
        }
      }

      return newSession;
    });
  }, []);

  const onStand = useCallback(() => {
    setGameSession((prev) => {
      const newSession = { ...prev };
      const hand = newSession.playerHands[newSession.currentHandIndex];
      hand.status = 'stand';

      if (newSession.currentHandIndex < newSession.playerHands.length - 1) {
        newSession.currentHandIndex += 1;
      } else {
        newSession.gameState = GAME_STATES.DEALER_TURN;
      }

      return newSession;
    });
  }, []);

  const onSplit = useCallback(() => {
    setGameSession((prev) => {
      const newSession = { ...prev };
      const hand = newSession.playerHands[newSession.currentHandIndex];

      if (!canSplit(hand) || newSession.deck.length < 2) return prev;

      const splitCard = hand.cards.pop()!;
      const newHand: Hand = {
        cards: [splitCard, newSession.deck.pop()!],
        bet: hand.bet,
        status: 'active',
      };

      hand.cards.push(newSession.deck.pop()!);
      newSession.playerHands.push(newHand);

      return newSession;
    });
  }, []);

  useEffect(() => {
    if (gameSession.gameState !== GAME_STATES.DEALER_TURN) return;

    const timer = setTimeout(() => {
      setGameSession((prev) => {
        const newSession = { ...prev };
        let deck = newSession.deck;
        let dealerCards = [...newSession.dealerCards];

        while (true) {
          const { score } = calculateScore(dealerCards);
          if (score >= DEALER_STAND_AT) break;
          if (deck.length === 0) break;
          dealerCards.push(deck.pop()!);
        }

        const dealerScore = calculateScore(dealerCards).score;

        let totalWinAmount = 0;
        newSession.playerHands.forEach((hand) => {
          const playerScore = calculateScore(hand.cards).score;

          if (playerScore > BLACKJACK_LIMIT) {
            hand.status = 'bust';
            totalWinAmount -= hand.bet;
          } else if (dealerScore > BLACKJACK_LIMIT) {
            hand.status = 'win';
            totalWinAmount += hand.bet;
          } else if (playerScore > dealerScore) {
            hand.status = 'win';
            totalWinAmount += hand.bet;
          } else if (dealerScore > playerScore) {
            hand.status = 'lose';
            totalWinAmount -= hand.bet;
          } else {
            hand.status = 'tie';
          }
        });

        if (newSession.playerHands[0].cards.length === 2 && calculateScore(newSession.playerHands[0].cards).score === 21) {
          newSession.playerHands[0].status = 'blackjack';
          totalWinAmount = totalWinAmount + newSession.playerHands[0].bet * 0.5;
        }

        const newChips = chips + totalWinAmount;
        setChips(newChips);
        setSessionOutcome({
          outcome: newSession.playerHands[0].status,
          winAmount: totalWinAmount,
        });
        setGamePhase('result');

        return {
          ...newSession,
          dealerCards,
          deck,
          gameState: GAME_STATES.GAME_OVER,
        };
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [gameSession.gameState, chips]);

  const currentHand = gameSession.playerHands[gameSession.currentHandIndex];
  const isPlayerTurn = gameSession.gameState === GAME_STATES.PLAYER_TURN;
  const isBetting = gameSession.gameState === GAME_STATES.BETTING;

  const dealerScore = calculateScore(gameSession.dealerCards);
  const playerScore = currentHand ? calculateScore(currentHand.cards) : { score: 0, hasAce: false };
  const totalBet = gameSession.playerHands.reduce((sum, hand) => sum + hand.bet, 0);

  const phaseLabels: Record<GamePhase, string> = {
    bet: '下注阶段 · 放置筹码',
    play: '你的回合 · 要牌或停牌',
    result: '本局结束 · 结算结果',
  };

  return (
    <div style={{ width: '100%', height: '100vh', background: themeVars['--app-bg'], color: themeVars['--ink'], fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* ===== TOP HUD ===== */}
      <div style={{
        height: 80,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '0 28px',
        background: themeVars['--hud-bg'],
        borderBottom: `1px solid rgba(255,255,255,.1)`,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '.03em' }}>GAME H · 二十一点 — 传统赌桌</div>
          <div style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: themeVars['--ink-dim'] }}>BLACKJACK · 庄家 vs 玩家</div>
        </div>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: themeVars['--ink-dim'] }}>回合</span>
        <div style={{ display: 'flex', background: 'rgba(0,0,0,.2)', border: `1px solid ${themeVars['--accent']}`, borderRadius: 10, padding: 3, gap: 4 }}>
          <button onClick={() => setGamePhase('bet')} style={{ padding: '6px 12px', background: gamePhase === 'bet' ? themeVars['--accent'] : 'transparent', color: gamePhase === 'bet' ? '#000' : themeVars['--ink-dim'], border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .15s ease' }}>
            下注
          </button>
          <button onClick={() => setGamePhase('play')} style={{ padding: '6px 12px', background: gamePhase === 'play' ? themeVars['--accent'] : 'transparent', color: gamePhase === 'play' ? '#000' : themeVars['--ink-dim'], border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .15s ease' }}>
            行动
          </button>
          <button onClick={() => setGamePhase('result')} style={{ padding: '6px 12px', background: gamePhase === 'result' ? themeVars['--accent'] : 'transparent', color: gamePhase === 'result' ? '#000' : themeVars['--ink-dim'], border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .15s ease' }}>
            结算
          </button>
        </div>

        <span style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: themeVars['--ink-dim'], marginLeft: 16 }}>皮肤</span>
        <div style={{ display: 'flex', background: 'rgba(0,0,0,.2)', border: `1px solid ${themeVars['--accent']}`, borderRadius: 10, padding: 3, gap: 4 }}>
          <button onClick={() => setTheme('onyx')} style={{ padding: '6px 12px', background: theme === 'onyx' ? themeVars['--accent'] : 'transparent', color: theme === 'onyx' ? '#000' : themeVars['--ink-dim'], border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .15s ease' }}>
            玄铁
          </button>
          <button onClick={() => setTheme('brocade')} style={{ padding: '6px 12px', background: theme === 'brocade' ? themeVars['--accent'] : 'transparent', color: theme === 'brocade' ? '#000' : themeVars['--ink-dim'], border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .15s ease' }}>
            锦霞
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <div style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: themeVars['--ink-dim'] }}>余额</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: themeVars['--gold'] }}>◈ {chips.toLocaleString()}</div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div style={{ flex: 1, display: 'flex', gap: 20, padding: 20, overflow: 'hidden' }}>
        {/* LEFT: Game Table */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {isBetting ? (
            <BettingPanel chips={chips} currentBet={currentBet} onBet={setCurrentBet} onDeal={() => { initializeGame(currentBet); setChips(chips - currentBet); }} theme={theme} />
          ) : (
            <>
              {/* Dealer Area */}
              <div style={{ background: 'rgba(0,0,0,.2)', border: `1px solid rgba(255,255,255,.1)`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: themeVars['--ink-dim'], textTransform: 'uppercase' }}>🎰 庄家</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
                  {gameSession.dealerCards.map((card, i) => (
                    <CardComp key={i} card={card} hidden={isPlayerTurn && i === gameSession.dealerCards.length - 1} />
                  ))}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: themeVars['--accent'] }}>
                  {isPlayerTurn ? '? 点' : `${dealerScore.score} 点`}
                </div>
              </div>

              {/* Game Table / Results */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, position: 'relative' }}>
                {gameSession.gameState === GAME_STATES.GAME_OVER && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,.4)',
                    borderRadius: 12,
                    backdropFilter: 'blur(4px)',
                    animation: 'scaleIn 0.5s ease-out',
                  }}>
                    <div style={{ fontSize: 48, fontWeight: 900, color: themeVars['--gold'], marginBottom: 12 }}>
                      {sessionOutcome.outcome === OUTCOMES.BLACKJACK ? '⭐ BLACKJACK' : sessionOutcome.outcome === OUTCOMES.PLAYER_WIN ? '✅ 你胜了' : sessionOutcome.outcome === OUTCOMES.PLAYER_BUST ? '❌ 爆牌' : sessionOutcome.outcome === OUTCOMES.DEALER_BUST ? '✅ 庄家爆牌' : sessionOutcome.outcome === OUTCOMES.TIE ? '🤝 平局' : '❌ 你负了'}
                    </div>
                    <div style={{ fontSize: 24, color: themeVars['--ink'], marginBottom: 20 }}>
                      {sessionOutcome.winAmount > 0 ? `赢 ◈${sessionOutcome.winAmount}` : sessionOutcome.winAmount < 0 ? `负 ◈${Math.abs(sessionOutcome.winAmount)}` : '平手'}
                    </div>
                    <button onClick={() => { setGameSession({ deck: [], playerHands: [], currentHandIndex: 0, dealerCards: [], gameState: GAME_STATES.BETTING }); setSessionOutcome({ winAmount: 0 }); setGamePhase('bet'); }} style={{ padding: '10px 24px', background: themeVars['--accent'], color: '#000', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                      再来一局
                    </button>
                  </div>
                )}
                <div style={{ textAlign: 'center', opacity: gameSession.gameState === GAME_STATES.GAME_OVER ? 0.3 : 1 }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: themeVars['--gold'], marginBottom: 8 }}>◈ {totalBet.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: themeVars['--ink-dim'] }}>当前下注</div>
                </div>
              </div>

              {/* Player Hands */}
              <div style={{ background: 'rgba(0,0,0,.2)', border: `1px solid rgba(255,255,255,.1)`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gameSession.playerHands.length}, 1fr)`, gap: 12, marginBottom: 12 }}>
                  {gameSession.playerHands.map((hand, i) => (
                    <div key={i} style={{ background: i === gameSession.currentHandIndex && isPlayerTurn ? `rgba(${theme === 'onyx' ? '74,222,128' : '216,96,123'},.15)` : 'transparent', borderRadius: 10, padding: 12, border: `1px solid ${i === gameSession.currentHandIndex && isPlayerTurn ? themeVars['--accent'] : 'transparent'}` }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        {hand.cards.map((card, j) => (
                          <div key={j} style={{ transform: 'scale(0.8)', transformOrigin: 'top left' }}>
                            <CardComp card={card} />
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: themeVars['--accent'], fontWeight: 700 }}>
                        {calculateScore(hand.cards).score} 点 {hand.bet > 0 && `| ◈${hand.bet}`}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {currentHand && isPlayerTurn && currentHand.status === 'active' && (
                    <>
                      {canSplit(currentHand) && chips >= currentHand.bet && (
                        <button onClick={onSplit} style={{ flex: 1, padding: '8px 12px', background: themeVars['--gold'], color: '#000', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          分牌
                        </button>
                      )}
                      <button onClick={onHit} style={{ flex: 1, padding: '8px 12px', background: themeVars['--accent'], color: '#000', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        要牌
                      </button>
                      <button onClick={onStand} style={{ flex: 1, padding: '8px 12px', background: 'rgba(0,0,0,.2)', color: themeVars['--accent'], border: `1px solid ${themeVars['--accent']}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        停牌
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* RIGHT: Sidebar */}
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          {/* Stats */}
          {!isBetting && (
            <div style={{ background: 'rgba(0,0,0,.2)', border: `1px solid rgba(255,255,255,.1)`, borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: themeVars['--ink-dim'], marginBottom: 10 }}>本局</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div style={{ background: 'rgba(0,0,0,.3)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: themeVars['--ink-dim'], marginBottom: 4 }}>庄家</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: themeVars['--ink'] }}>{isPlayerTurn ? '?' : dealerScore.score}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,.3)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: themeVars['--ink-dim'], marginBottom: 4 }}>你</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: themeVars['--gold'] }}>{playerScore.score}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,.3)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: themeVars['--ink-dim'], marginBottom: 4 }}>注额</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: themeVars['--gold'] }}>◈{totalBet}</div>
                </div>
              </div>
            </div>
          )}

          {/* Chip Selector */}
          <div style={{ background: 'rgba(0,0,0,.2)', border: `1px solid rgba(255,255,255,.1)`, borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: themeVars['--ink-dim'], marginBottom: 10 }}>筹码 · 点击下注</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
              {[10, 25, 50, 100, 250, 500].map((denom) => (
                <button
                  key={denom}
                  onClick={() => setCurrentBet(currentBet + denom)}
                  style={{
                    padding: '10px',
                    background: `radial-gradient(circle at 38% 32%, ${theme === 'onyx' ? '#4ade80' : '#d8607b'}dd, ${theme === 'onyx' ? '#4ade80' : '#d8607b'} 62%, rgba(0,0,0,.45))`,
                    border: '2px solid rgba(255,255,255,.7)',
                    borderRadius: '50%',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all .15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  ◈{denom}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setCurrentBet(0)} style={{ flex: 1, padding: '8px', background: 'rgba(0,0,0,.3)', color: themeVars['--accent'], border: `1px solid ${themeVars['--accent']}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                清空
              </button>
              <button onClick={() => setCurrentBet(chips)} style={{ flex: 1, padding: '8px', background: 'rgba(0,0,0,.3)', color: themeVars['--accent'], border: `1px solid ${themeVars['--accent']}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                最大
              </button>
            </div>
          </div>

          {/* Info */}
          <div style={{ background: 'rgba(0,0,0,.2)', border: `1px solid rgba(255,255,255,.1)`, borderRadius: 12, padding: 12, flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: themeVars['--ink-dim'], marginBottom: 10 }}>规则</div>
            <div style={{ fontSize: 11, lineHeight: 1.6, color: themeVars['--ink-dim'] }}>
              <div>• 庄家 17 点必停</div>
              <div>• 黑杰克 3:2 赔付</div>
              <div>• 最小下注 $10</div>
              <div>• 最大下注 $500</div>
              <div>• 可分牌和加倍</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== BOTTOM ACTION BAR ===== */}
      {isPlayerTurn && currentHand && currentHand.status === 'active' && (
        <div style={{
          height: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 28px',
          background: themeVars['--dock-bg'],
          borderTop: `1px solid rgba(255,255,255,.1)`,
          zIndex: 10,
        }}>
          <button
            onClick={onHit}
            style={{
              flex: 1,
              height: 70,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: themeVars['--accent'],
              color: '#000',
              border: 'none',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all .15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <span style={{ fontSize: 24 }}>🃏</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span>要牌</span>
              <span style={{ fontSize: 10, opacity: 0.8 }}>HIT</span>
            </div>
          </button>
          <button
            onClick={onStand}
            style={{
              flex: 1,
              height: 70,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: 'rgba(0,0,0,.2)',
              color: themeVars['--accent'],
              border: `1px solid ${themeVars['--accent']}`,
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all .15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <span style={{ fontSize: 24 }}>✋</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span>停牌</span>
              <span style={{ fontSize: 10, opacity: 0.8 }}>STAND</span>
            </div>
          </button>
          {canSplit(currentHand) && chips >= currentHand.bet && (
            <button
              onClick={onSplit}
              style={{
                flex: 1,
                height: 70,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background: 'rgba(0,0,0,.2)',
                color: themeVars['--gold'],
                border: `1px solid ${themeVars['--gold']}`,
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all .15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <span style={{ fontSize: 24 }}>⑂</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span>分牌</span>
                <span style={{ fontSize: 10, opacity: 0.8 }}>SPLIT</span>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface BettingPanelProps {
  chips: number;
  currentBet: number;
  onBet: (amount: number) => void;
  onDeal: () => void;
  theme: Theme;
}

function BettingPanel({ chips, currentBet, onBet, onDeal, theme }: BettingPanelProps): React.ReactElement {
  const themeVars = THEMES[theme];

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      background: 'rgba(0,0,0,.2)',
      borderRadius: 12,
      padding: 40,
    }}>
      <div style={{ fontSize: 28, fontWeight: 900, color: themeVars['--accent'] }}>💰 选择押注额度</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', maxWidth: 400 }}>
        {[10, 25, 50, 100, 250, 500].map((bet) => (
          <button
            key={bet}
            onClick={() => onBet(Math.min(bet, chips))}
            disabled={bet > chips}
            style={{
              padding: 16,
              background: currentBet === bet ? themeVars['--accent'] : 'rgba(0,0,0,.3)',
              color: currentBet === bet ? '#000' : themeVars['--accent'],
              border: `1px solid ${themeVars['--accent']}`,
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: bet > chips ? 'not-allowed' : 'pointer',
              opacity: bet > chips ? 0.5 : 1,
              transition: 'all .15s ease',
            }}
          >
            ${bet}
          </button>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 400 }}>
        <input
          type="number"
          min={MIN_BET}
          max={chips}
          value={currentBet || ''}
          onChange={(e) => onBet(Math.min(Math.max(parseInt(e.target.value) || 0, MIN_BET), chips))}
          placeholder="或输入金额"
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 8,
            border: `1px solid ${themeVars['--accent']}`,
            background: 'rgba(0,0,0,.3)',
            color: themeVars['--accent'],
            fontSize: 14,
            fontWeight: 700,
          }}
        />
      </div>

      <div style={{ fontSize: 16, color: themeVars['--ink'] }}>
        💵 剩余筹码: <span style={{ fontWeight: 700, color: themeVars['--gold'] }}>${chips.toLocaleString()}</span>
      </div>

      {currentBet > 0 && (
        <button
          onClick={onDeal}
          style={{
            marginTop: 12,
            padding: '14px 32px',
            background: themeVars['--accent'],
            color: '#000',
            border: 'none',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all .15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          开始游戏
        </button>
      )}
    </div>
  );
}
