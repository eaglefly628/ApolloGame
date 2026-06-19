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
    '--app-bg': 'radial-gradient(120% 120% at 50% -10%, #1a2230 0%, #0a0d12 55%, #06080b 100%)',
    '--texture': 'repeating-linear-gradient(45deg, rgba(135,175,215,.05) 0 1px, transparent 1px 9px)',
    '--hud-bg': 'linear-gradient(180deg, rgba(22,28,37,.95), rgba(14,18,24,.88))',
    '--dock-bg': 'linear-gradient(180deg, rgba(18,23,31,.7), rgba(10,13,18,.97))',
    '--panel-grad': 'linear-gradient(180deg, #1c2531, #121821)',
    '--panel-border': '#33404f',
    '--hairline': 'rgba(255,214,150,.12)',
    '--ink': '#e7edf3',
    '--ink-dim': '#7e8c9b',
    '--accent': '#4ade80',
    '--accent-soft': 'rgba(74,222,128,.15)',
    '--accent-grad': 'linear-gradient(180deg, #5ef395, #28a745)',
    '--gold': '#ffcb3d',
    '--gold-grad': 'linear-gradient(180deg, #ffe08a, #e0a52e)',
    '--danger': '#ff404f',
    '--table-bg': 'radial-gradient(130% 100% at 50% 36%, #1d6f4e 0%, #11543a 45%, #082c1f 100%)',
    '--table-edge': '#0a2a1f',
    '--btn-bg': 'linear-gradient(180deg, #283341, #1a222c)',
    '--btn-edge': '#3d4b5b',
  },
  brocade: {
    '--app-bg': 'radial-gradient(120% 120% at 50% -10%, #fdf4ee 0%, #f3e2dc 60%, #ecd6cf 100%)',
    '--texture': 'radial-gradient(circle, rgba(201,148,72,.14) 1px, transparent 1.7px) 0 0/26px 26px',
    '--hud-bg': 'linear-gradient(180deg, rgba(255,250,244,.96), rgba(251,238,229,.9))',
    '--dock-bg': 'linear-gradient(180deg, rgba(255,250,244,.72), rgba(250,236,225,.98))',
    '--panel-grad': 'linear-gradient(180deg, #fffdfa, #fbeee4)',
    '--panel-border': '#e3c896',
    '--hairline': 'rgba(216,164,78,.4)',
    '--ink': '#5a3f44',
    '--ink-dim': '#a98b8f',
    '--accent': '#d8607b',
    '--accent-soft': 'rgba(216,96,123,.15)',
    '--accent-grad': 'linear-gradient(180deg, #e887a0, #cf5070)',
    '--gold': '#cf9a3f',
    '--gold-grad': 'linear-gradient(180deg, #f3e2a4, #cf9a3f)',
    '--danger': '#d65668',
    '--table-bg': 'radial-gradient(130% 100% at 50% 36%, #c97f86 0%, #b15f6b 45%, #8c4654 100%)',
    '--table-edge': '#6e3a44',
    '--btn-bg': 'linear-gradient(180deg, #fffaf4, #fbece1)',
    '--btn-edge': '#ecd3b2',
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

const CARD_SUITS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const SUIT_COLORS = { hearts: '#c0392b', diamonds: '#c0651a', clubs: '#2d6a3f', spades: '#22303f' };

function displayCard(card: Card): string {
  const suit = CARD_SUITS[card.suit as keyof typeof CARD_SUITS];
  return `${card.display}${suit}`;
}

interface CardCompProps {
  card: Card;
  hidden?: boolean;
  index?: number;
}

function CardComp({ card, hidden = false, index = 0 }: CardCompProps): React.ReactElement {
  const suitColor = SUIT_COLORS[card.suit as keyof typeof SUIT_COLORS];
  const rotation = (index - 0.5) * 5;

  return (
    <div
      style={{
        width: 110,
        height: 154,
        background: hidden ? 'linear-gradient(150deg, #b1402f, #7d2a1e)' : '#fcf9f1',
        border: hidden ? '4px solid #fbf7ef' : '3px solid #000',
        borderRadius: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: hidden ? 0 : 32,
        fontWeight: 700,
        color: suitColor,
        animation: 'cardDeal 0.4s cubic-bezier(0.2, 0.8, 0.3, 1) both',
        animationDelay: `${index * 0.12}s`,
        boxShadow: hidden ? '0 14px 30px rgba(0,0,0,.5)' : '0 14px 30px rgba(0,0,0,.45), inset 0 0 0 1px rgba(0,0,0,.05)',
        position: 'relative',
        transform: `rotate(${rotation}deg)`,
        '--rot': `${rotation}deg`,
      } as any}
    >
      {!hidden && (
        <>
          <div style={{ position: 'absolute', top: 8, left: 8, textAlign: 'center', lineHeight: 0.9, fontSize: 22 }}>
            {displayCard(card)}
          </div>
          <div style={{ position: 'absolute', bottom: 8, right: 8, textAlign: 'center', lineHeight: 0.9, fontSize: 22, transform: 'rotate(180deg)' }}>
            {displayCard(card)}
          </div>
          <div style={{ fontSize: 64, textShadow: '0 2px 4px rgba(0,0,0,.12)' }}>
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

  const T = THEMES[theme];

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

  const ScorePill = ({ value, label }: { value: string | number; label: string }) => (
    <div style={{
      minWidth: 52,
      padding: '6px 14px',
      borderRadius: 99,
      background: label === '庄家' && isPlayerTurn ? 'rgba(8,20,14,.7)' : label === '你' ? T['--gold-grad'] : 'rgba(0,0,0,.3)',
      border: `1px solid ${label === '你' ? 'transparent' : T['--hairline']}`,
      color: label === '你' ? '#2a1a08' : '#fff',
      fontFamily: 'monospace',
      fontSize: 18,
      textAlign: 'center',
      fontWeight: 700,
      boxShadow: '0 4px 12px rgba(0,0,0,.3)',
    }}>
      {value}
    </div>
  );

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      background: T['--app-bg'],
      color: T['--ink'],
      fontFamily: "'Noto Sans SC', system-ui, -apple-system, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: T['--texture'],
        pointerEvents: 'none',
        opacity: 0.3,
      }} />

      <style>{`
        @keyframes cardDeal {
          0% { transform: translate(220px, -180px) rotate(40deg) scale(0.7); opacity: 0; }
          100% { transform: translate(0, 0) rotate(var(--rot, 0deg)) scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -120% 0; }
          100% { background-position: 220% 0; }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 203, 61, 0); }
          50% { box-shadow: 0 0 26px 4px rgba(255, 203, 61, 0.45); }
        }
        button:active { transform: scale(0.97) translateY(1px); }
      `}</style>

      {/* ===== TOP HUD ===== */}
      <div style={{
        height: 88,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '0 30px',
        background: T['--hud-bg'],
        borderBottom: `1px solid var(--panel-border)`,
        zIndex: 10,
        position: 'relative',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{
            fontFamily: 'var(--font-heading, monospace)',
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: '.03em',
          }}>
            GAME H · 二十一点
          </div>
          <div style={{
            fontSize: 11,
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            color: T['--ink-dim'],
          }}>
            BLACKJACK · 庄家 vs 玩家
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <span style={{
          fontSize: 10,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          color: T['--ink-dim'],
        }}>回合</span>

        <div style={{
          display: 'flex',
          background: 'rgba(0,0,0,.2)',
          border: `1px solid ${T['--panel-border']}`,
          borderRadius: 11,
          padding: 3,
          gap: 3,
        }}>
          {(['bet', 'play', 'result'] as GamePhase[]).map((phase) => (
            <button
              key={phase}
              onClick={() => setGamePhase(phase)}
              style={{
                padding: '7px 15px',
                background: gamePhase === phase ? T['--accent-grad'] : 'transparent',
                color: gamePhase === phase ? '#000' : T['--ink-dim'],
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all .15s ease',
                boxShadow: gamePhase === phase ? 'inset 0 1px 0 rgba(255,255,255,.3)' : 'none',
              }}
            >
              {phase === 'bet' ? '下注' : phase === 'play' ? '行动' : '结算'}
            </button>
          ))}
        </div>

        <span style={{
          fontSize: 10,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          color: T['--ink-dim'],
          marginLeft: 6,
        }}>皮肤</span>

        <div style={{
          display: 'flex',
          background: 'rgba(0,0,0,.2)',
          border: `1px solid ${T['--panel-border']}`,
          borderRadius: 11,
          padding: 3,
          gap: 3,
        }}>
          {(['onyx', 'brocade'] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              style={{
                padding: '7px 15px',
                background: theme === t ? T['--accent-grad'] : 'transparent',
                color: theme === t ? '#000' : T['--ink-dim'],
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all .15s ease',
                boxShadow: theme === t ? 'inset 0 1px 0 rgba(255,255,255,.3)' : 'none',
              }}
            >
              {t === 'onyx' ? '玄铁' : '锦霞'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
          <span style={{
            fontSize: 10,
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            color: T['--ink-dim'],
          }}>余额</span>
          <span style={{
            fontFamily: 'monospace',
            fontSize: 22,
            color: T['--gold'],
            marginTop: 3,
            fontWeight: 700,
          }}>◈ {chips.toLocaleString()}</span>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: 20,
        padding: 18,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* LEFT: Game Table */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {isBetting ? (
            <BettingPanel chips={chips} currentBet={currentBet} onBet={setCurrentBet} onDeal={() => { initializeGame(currentBet); setChips(chips - currentBet); }} theme={theme} />
          ) : (
            <>
              {/* Dealer Area */}
              <div style={{
                background: T['--panel-grad'],
                border: `1px solid ${T['--panel-border']}`,
                borderRadius: 14,
                padding: 16,
                marginBottom: 16,
                boxShadow: `inset 0 0 0 1px ${T['--hairline']}, 0 4px 14px rgba(0,0,0,.18)`,
              }}>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '.08em',
                  marginBottom: 10,
                  color: T['--ink'],
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <span style={{ fontSize: 18 }}>♣</span>
                  庄家
                </div>
                <div style={{ display: 'flex', gap: 14, marginBottom: 12, alignItems: 'flex-end' }}>
                  {gameSession.dealerCards.map((card, i) => (
                    <CardComp key={i} card={card} hidden={isPlayerTurn && i === gameSession.dealerCards.length - 1} index={i} />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ScorePill value={isPlayerTurn ? '?' : dealerScore.score} label="庄家" />
                </div>
              </div>

              {/* Game Table / Results */}
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                position: 'relative',
              }}>
                {gameSession.gameState === GAME_STATES.GAME_OVER && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(8,16,12,.7)',
                    borderRadius: 12,
                    border: `2px solid ${T['--gold']}`,
                    backdropFilter: 'blur(3px)',
                    animation: 'pulse 1.8s ease-in-out infinite',
                    boxShadow: `0 0 50px ${T['--gold']}66`,
                  }}>
                    <div style={{
                      fontSize: 46,
                      fontWeight: 900,
                      color: T['--gold'],
                      marginBottom: 12,
                      lineHeight: 1,
                    }}>
                      {sessionOutcome.outcome === OUTCOMES.BLACKJACK ? '⭐ BLACKJACK' : sessionOutcome.outcome === OUTCOMES.PLAYER_WIN ? '✅ 胜' : sessionOutcome.outcome === OUTCOMES.PLAYER_BUST ? '❌ 爆牌' : sessionOutcome.outcome === OUTCOMES.DEALER_BUST ? '✅ 庄家爆牌' : sessionOutcome.outcome === OUTCOMES.TIE ? '🤝 平' : '❌ 负'}
                    </div>
                    <div style={{
                      fontSize: 20,
                      color: T['--ink'],
                      marginBottom: 20,
                    }}>
                      {sessionOutcome.winAmount > 0 ? `赢 ◈${sessionOutcome.winAmount}` : sessionOutcome.winAmount < 0 ? `负 ◈${Math.abs(sessionOutcome.winAmount)}` : '押注退还'}
                    </div>
                    <div style={{ fontSize: 16, color: T['--ink-dim'], marginBottom: 20 }}>
                      总筹码：<span style={{ fontWeight: 700, color: T['--gold'] }}>◈{chips.toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => {
                        setGameSession({ deck: [], playerHands: [], currentHandIndex: 0, dealerCards: [], gameState: GAME_STATES.BETTING });
                        setSessionOutcome({ winAmount: 0 });
                        setGamePhase('bet');
                      }}
                      style={{
                        padding: '12px 28px',
                        background: T['--accent-grad'],
                        color: '#000',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 16,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all .15s ease',
                      }}
                    >
                      再来一局
                    </button>
                  </div>
                )}
                <div style={{ textAlign: 'center', opacity: gameSession.gameState === GAME_STATES.GAME_OVER ? 0.3 : 1 }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: T['--gold'], marginBottom: 8 }}>◈ {totalBet.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: T['--ink-dim'] }}>当前下注</div>
                </div>
              </div>

              {/* Player Hands */}
              <div style={{
                background: T['--panel-grad'],
                border: `1px solid ${T['--panel-border']}`,
                borderRadius: 14,
                padding: 16,
                boxShadow: `inset 0 0 0 1px ${T['--hairline']}, 0 4px 14px rgba(0,0,0,.18)`,
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gameSession.playerHands.length}, 1fr)`, gap: 12, marginBottom: 12 }}>
                  {gameSession.playerHands.map((hand, i) => {
                    const handScore = calculateScore(hand.cards).score;
                    const isActive = i === gameSession.currentHandIndex && isPlayerTurn;
                    return (
                      <div
                        key={i}
                        style={{
                          background: isActive ? T['--accent-soft'] : 'rgba(0,0,0,.2)',
                          borderRadius: 10,
                          padding: 12,
                          border: `2px solid ${isActive ? T['--accent'] : 'transparent'}`,
                          transition: 'all .15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          {hand.cards.map((card, j) => (
                            <div key={j} style={{ transform: 'scale(0.75)', transformOrigin: 'top left' }}>
                              <CardComp card={card} index={j} />
                            </div>
                          ))}
                        </div>
                        <div style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: T['--gold'],
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}>
                          {handScore} 点
                          {hand.bet > 0 && <span style={{ fontSize: 12, color: T['--ink-dim'] }}>| ◈{hand.bet}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {currentHand && isPlayerTurn && currentHand.status === 'active' && (
                    <>
                      {canSplit(currentHand) && chips >= currentHand.bet && (
                        <button
                          onClick={onSplit}
                          style={{
                            flex: 1,
                            padding: '10px 12px',
                            background: T['--gold-grad'],
                            color: '#2a1a08',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all .12s ease',
                          }}
                        >
                          分牌
                        </button>
                      )}
                      <button
                        onClick={onHit}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          background: T['--accent-grad'],
                          color: '#000',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all .12s ease',
                        }}
                      >
                        要牌
                      </button>
                      <button
                        onClick={onStand}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          background: T['--btn-bg'],
                          color: T['--accent'],
                          border: `1px solid ${T['--btn-edge']}`,
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all .12s ease',
                        }}
                      >
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
        <div style={{ width: 304, display: 'flex', flexDirection: 'column', gap: 13, overflow: 'auto' }}>
          {/* Stats */}
          {!isBetting && (
            <div style={{
              background: T['--panel-grad'],
              border: `1px solid ${T['--panel-border']}`,
              borderRadius: 14,
              boxShadow: `inset 0 0 0 1px ${T['--hairline']}, 0 4px 14px rgba(0,0,0,.18)`,
              padding: '15px 16px',
            }}>
              <div style={{
                fontSize: 10,
                letterSpacing: '.2em',
                textTransform: 'uppercase',
                color: T['--ink-dim'],
                marginBottom: 12,
              }}>本局</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5,
                  padding: '11px 6px',
                  borderRadius: 11,
                  background: 'rgba(0,0,0,.3)',
                  border: `1px solid ${T['--panel-border']}`,
                }}>
                  <span style={{ fontSize: 11, color: T['--ink-dim'] }}>庄家</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 19, color: T['--ink'], fontWeight: 700 }}>{isPlayerTurn ? '?' : dealerScore.score}</span>
                </div>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5,
                  padding: '11px 6px',
                  borderRadius: 11,
                  background: 'rgba(0,0,0,.3)',
                  border: `1px solid ${T['--panel-border']}`,
                }}>
                  <span style={{ fontSize: 11, color: T['--ink-dim'] }}>你</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 19, color: T['--gold'], fontWeight: 700 }}>{playerScore.score}</span>
                </div>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5,
                  padding: '11px 6px',
                  borderRadius: 11,
                  background: 'rgba(0,0,0,.3)',
                  border: `1px solid ${T['--panel-border']}`,
                }}>
                  <span style={{ fontSize: 11, color: T['--ink-dim'] }}>注额</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 19, color: T['--gold'], fontWeight: 700 }}>◈{totalBet}</span>
                </div>
              </div>
            </div>
          )}

          {/* Chip Selector */}
          <div style={{
            background: T['--panel-grad'],
            border: `1px solid ${T['--panel-border']}`,
            borderRadius: 14,
            boxShadow: `inset 0 0 0 1px ${T['--hairline']}, 0 4px 14px rgba(0,0,0,.18)`,
            padding: '15px 16px',
          }}>
            <div style={{
              fontSize: 10,
              letterSpacing: '.2em',
              textTransform: 'uppercase',
              color: T['--ink-dim'],
              marginBottom: 12,
            }}>筹码 · 点击下注</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 11, marginBottom: 13 }}>
              {[5, 25, 50, 100, 250, 500].map((denom) => {
                const chipColors = { onyx: '#4ade80', brocade: '#d8607b' };
                const chipColor = chipColors[theme];
                return (
                  <button
                    key={denom}
                    onClick={() => setCurrentBet(Math.min(currentBet + denom, chips))}
                    style={{
                      aspectRatio: '1',
                      padding: 0,
                      background: `radial-gradient(circle at 38% 32%, ${chipColor}ee, ${chipColor} 62%, rgba(0,0,0,.45))`,
                      border: '4px dashed rgba(255,255,255,.82)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      boxShadow: '0 5px 12px rgba(0,0,0,.4), inset 0 0 0 1px rgba(255,255,255,.15)',
                      transition: 'all .12s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.04)'; e.currentTarget.style.filter = 'brightness(1.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.filter = 'brightness(1)'; }}
                  >
                    <span style={{ fontSize: 12, color: '#fff', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>◈{denom}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button
                onClick={() => setCurrentBet(0)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'rgba(0,0,0,.3)',
                  border: `1px solid ${T['--panel-border']}`,
                  borderRadius: 10,
                  color: T['--ink'],
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all .15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)'; e.currentTarget.style.borderColor = T['--accent']; }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.borderColor = T['--panel-border']; }}
              >
                清空
              </button>
              <button
                onClick={() => setCurrentBet(chips)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'rgba(0,0,0,.3)',
                  border: `1px solid ${T['--panel-border']}`,
                  borderRadius: 10,
                  color: T['--ink'],
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all .15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)'; e.currentTarget.style.borderColor = T['--accent']; }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.borderColor = T['--panel-border']; }}
              >
                最大
              </button>
            </div>
          </div>

          {/* Rules */}
          <div style={{
            background: T['--panel-grad'],
            border: `1px solid ${T['--panel-border']}`,
            borderRadius: 14,
            boxShadow: `inset 0 0 0 1px ${T['--hairline']}, 0 4px 14px rgba(0,0,0,.18)`,
            padding: '15px 16px',
            flex: 1,
          }}>
            <div style={{
              fontSize: 10,
              letterSpacing: '.2em',
              textTransform: 'uppercase',
              color: T['--ink-dim'],
              marginBottom: 12,
            }}>规则</div>
            <div style={{ fontSize: 11, color: T['--ink-dim'], lineHeight: 1.6 }}>
              <div>• 庄家 17 点必停</div>
              <div>• 黑杰克 3:2 赔付</div>
              <div>• 可分牌和加倍</div>
              <div>• 最小注额 $10</div>
              <div>• 最大注额 $500</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== BOTTOM ACTION BAR ===== */}
      {isPlayerTurn && currentHand && currentHand.status === 'active' && (
        <div style={{
          height: 118,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 30px',
          background: T['--dock-bg'],
          borderTop: `1px solid ${T['--panel-border']}`,
          zIndex: 10,
        }}>
          {[
            { glyph: '🃏', label: '要牌', sub: 'HIT', primary: true, action: onHit },
            { glyph: '✋', label: '停牌', sub: 'STAND', primary: false, action: onStand },
            ...(canSplit(currentHand) && chips >= currentHand.bet ? [{ glyph: '⑂', label: '分牌', sub: 'SPLIT', primary: false, action: onSplit }] : []),
          ].map((btn, i) => (
            <button
              key={i}
              onClick={btn.action}
              style={{
                flex: 1,
                height: 78,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                background: btn.primary ? T['--accent-grad'] : T['--btn-bg'],
                color: btn.primary ? '#000' : T['--btn-edge'],
                border: btn.primary ? 'none' : `1px solid ${T['--btn-edge']}`,
                borderRadius: 15,
                cursor: 'pointer',
                boxShadow: btn.primary ? `0 8px 22px ${T['--accent-soft']}, inset 0 1px 0 rgba(255,255,255,.3)` : `inset 0 0 0 1px ${T['--hairline']}`,
                transition: 'all .15s ease',
                overflow: 'hidden',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.filter = 'brightness(1.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.filter = 'brightness(1)';
              }}
            >
              <span style={{ position: 'relative', fontSize: 26, lineHeight: 1 }}>{btn.glyph}</span>
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
                <span style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: 19,
                  letterSpacing: '.04em',
                  color: btn.primary ? '#000' : T['--ink'],
                }}>
                  {btn.label}
                </span>
                <span style={{
                  fontSize: 10,
                  letterSpacing: '.16em',
                  opacity: 0.7,
                  color: btn.primary ? '#000' : T['--ink-dim'],
                }}>
                  {btn.sub}
                </span>
              </div>
            </button>
          ))}
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
  const T = THEMES[theme];

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      background: T['--panel-grad'],
      borderRadius: 12,
      border: `1px solid ${T['--panel-border']}`,
      padding: 40,
      boxShadow: `inset 0 0 0 1px ${T['--hairline']}, 0 4px 14px rgba(0,0,0,.18)`,
    }}>
      <div style={{ fontSize: 28, fontWeight: 900, color: T['--accent'], textAlign: 'center' }}>💰 选择押注额度</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: '100%', maxWidth: 400 }}>
        {[10, 25, 50, 100, 250, 500].map((bet) => (
          <button
            key={bet}
            onClick={() => onBet(Math.min(bet, chips))}
            disabled={bet > chips}
            style={{
              padding: 10,
              background: currentBet === bet ? T['--accent-grad'] : 'rgba(0,0,0,.2)',
              color: currentBet === bet ? '#000' : T['--accent'],
              border: `1px solid ${T['--accent']}`,
              borderRadius: 6,
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
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${T['--accent']}`,
            background: 'rgba(0,0,0,.3)',
            color: T['--accent'],
            fontSize: 14,
          }}
        />
      </div>

      <div style={{ fontSize: 14, color: T['--ink'] }}>
        💵 剩余筹码: <span style={{ fontWeight: 700, color: T['--gold'] }}>${chips.toLocaleString()}</span>
      </div>

      {currentBet > 0 && (
        <button
          onClick={onDeal}
          style={{
            marginTop: 12,
            padding: '10px 24px',
            background: T['--accent-grad'],
            color: '#000',
            border: 'none',
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: `0 8px 22px ${T['--accent-soft']}, inset 0 1px 0 rgba(255,255,255,.3)`,
            transition: 'all .15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          开始游戏
        </button>
      )}
    </div>
  );
}
