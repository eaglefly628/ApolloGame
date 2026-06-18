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

const COLORS = {
  bg: '#0a0f1e',
  panel: 'rgba(30,58,47,0.3)',
  text: '#e2e8f0',
  accent: '#4ade80',
  danger: '#ef4444',
  gold: '#fbbf24',
  primary: '#1e3a2f',
};

const CARD_SUITS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

interface GameSession {
  deck: Card[];
  playerHands: Hand[];
  currentHandIndex: number;
  dealerCards: Card[];
  gameState: string;
  outcome?: string;
}

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

function CardComp({ card, hidden = false }: { card: Card; hidden?: boolean }): React.ReactElement {
  return (
    <div
      style={{
        width: 60,
        height: 90,
        background: hidden ? '#1e293b' : '#f0f9ff',
        border: hidden ? '1px solid #475569' : '2px solid #0f172a',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 24,
        fontWeight: 700,
        color: hidden ? '#64748b' : card.suit === 'hearts' || card.suit === 'diamonds' ? '#dc2626' : '#000',
        animation: 'slideIn 0.4s ease-out',
      }}
    >
      {hidden ? '🂠' : displayCard(card)}
    </div>
  );
}

function HandDisplay({
  hand,
  label,
  isActive,
  onSplit,
  onHit,
  onStand,
  canHit,
  canStand,
  canSplitHand,
}: {
  hand: Hand;
  label: string;
  isActive: boolean;
  onSplit?: () => void;
  onHit?: () => void;
  onStand?: () => void;
  canHit: boolean;
  canStand: boolean;
  canSplitHand: boolean;
}): React.ReactElement {
  const { score } = calculateScore(hand.cards);
  const statusText =
    hand.status === 'bust'
      ? '❌ 爆牌'
      : hand.status === 'blackjack'
        ? '⭐ 黑杰克'
        : hand.status === 'stand'
          ? '✋ 停牌'
          : hand.status === 'win'
            ? '✅ 胜'
            : hand.status === 'lose'
              ? '❌ 负'
              : hand.status === 'tie'
                ? '🤝 平'
                : '';

  const borderColor =
    hand.status === 'win'
      ? COLORS.accent
      : hand.status === 'bust' || hand.status === 'lose'
        ? COLORS.danger
        : hand.status === 'tie'
          ? COLORS.gold
          : isActive
            ? COLORS.accent
            : 'rgba(226,232,240,0.2)';

  return (
    <div
      style={{
        border: `2px solid ${borderColor}`,
        borderRadius: 12,
        padding: 16,
        background: isActive ? 'rgba(74, 222, 128, 0.1)' : 'rgba(0,0,0,0.2)',
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>
        {label} {statusText && `${statusText}`}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {hand.cards.map((card: Card, i: number) => (
          <CardComp key={i} card={card} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.accent }}>
          {score} 点 {hand.bet > 0 && `| 押注: $${hand.bet}`}
        </div>
        {isActive && hand.status === 'active' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {canSplitHand && (
              <button
                onClick={onSplit}
                style={{
                  padding: '6px 12px',
                  background: COLORS.gold,
                  color: '#000',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                分牌
              </button>
            )}
            {canHit && (
              <button
                onClick={onHit}
                style={{
                  padding: '6px 12px',
                  background: COLORS.accent,
                  color: '#000',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                要牌
              </button>
            )}
            {canStand && (
              <button
                onClick={onStand}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(74, 222, 128, 0.2)',
                  color: COLORS.accent,
                  border: `1px solid ${COLORS.accent}`,
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                停牌
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BettingPhase({
  chips,
  currentBet,
  onBet,
  onDeal,
}: {
  chips: number;
  currentBet: number;
  onBet: (amount: number) => void;
  onDeal: () => void;
}): React.ReactElement {
  const quickBets = [10, 25, 50, 100, 250, 500];

  return (
    <div
      style={{
        textAlign: 'center',
        padding: 20,
        background: COLORS.panel,
        borderRadius: 12,
        border: `1px solid ${COLORS.accent}`,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: COLORS.text }}>
        💰 选择押注额度
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        {quickBets.map((bet) => (
          <button
            key={bet}
            onClick={() => onBet(Math.min(bet, chips))}
            disabled={bet > chips}
            style={{
              padding: 10,
              background: currentBet === bet ? COLORS.accent : 'rgba(74, 222, 128, 0.2)',
              color: currentBet === bet ? '#000' : COLORS.accent,
              border: `1px solid ${COLORS.accent}`,
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: bet > chips ? 'not-allowed' : 'pointer',
              opacity: bet > chips ? 0.5 : 1,
            }}
          >
            ${bet}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="number"
          min={MIN_BET}
          max={chips}
          value={currentBet || ''}
          onChange={(e) => onBet(Math.min(Math.max(parseInt(e.target.value) || 0, MIN_BET), chips))}
          placeholder="或输入金额"
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${COLORS.accent}`,
            background: 'rgba(0,0,0,0.3)',
            color: COLORS.text,
            fontSize: 14,
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <div style={{ fontSize: 14, color: COLORS.text }}>
          💵 剩余筹码: <span style={{ fontWeight: 700, color: COLORS.accent }}>${chips}</span>
        </div>
      </div>
      {currentBet > 0 && (
        <button
          onClick={onDeal}
          style={{
            marginTop: 16,
            padding: '10px 24px',
            background: COLORS.accent,
            color: '#000',
            border: 'none',
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          开始游戏
        </button>
      )}
    </div>
  );
}

function GameOverScreen({
  chips,
  winAmount,
  outcome,
  onRestart,
}: {
  chips: number;
  winAmount: number;
  outcome?: string;
  onRestart: () => void;
}): React.ReactElement {
  const outcomeText =
    outcome === OUTCOMES.BLACKJACK
      ? '⭐ 黑杰克！获胜'
      : outcome === OUTCOMES.PLAYER_WIN
        ? '✅ 你胜了'
        : outcome === OUTCOMES.DEALER_WIN
          ? '❌ 庄家胜'
          : outcome === OUTCOMES.PLAYER_BUST
            ? '❌ 你爆牌了'
            : outcome === OUTCOMES.DEALER_BUST
              ? '✅ 庄家爆牌，你胜'
              : outcome === OUTCOMES.TIE
                ? '🤝 平局'
                : '';

  const outcomeColor =
    outcome === OUTCOMES.PLAYER_WIN || outcome === OUTCOMES.BLACKJACK || outcome === OUTCOMES.DEALER_BUST
      ? COLORS.accent
      : outcome === OUTCOMES.TIE
        ? COLORS.gold
        : COLORS.danger;

  return (
    <div
      style={{
        textAlign: 'center',
        padding: 24,
        background: `linear-gradient(135deg, rgba(74, 222, 128, 0.1), rgba(239, 68, 68, 0.05))`,
        borderRadius: 12,
        border: `2px solid ${outcomeColor}`,
        animation: 'scaleIn 0.5s ease-out',
      }}
    >
      <div style={{ fontSize: 32, fontWeight: 900, color: outcomeColor, marginBottom: 16 }}>
        {outcomeText}
      </div>
      <div style={{ fontSize: 20, color: COLORS.text, marginBottom: 24 }}>
        {winAmount > 0 ? (
          <>
            获胜 <span style={{ color: COLORS.gold, fontWeight: 700 }}>${winAmount}</span>
          </>
        ) : winAmount < 0 ? (
          <>
            损失 <span style={{ color: COLORS.danger, fontWeight: 700 }}>${Math.abs(winAmount)}</span>
          </>
        ) : (
          '押注退还'
        )}
      </div>
      <div style={{ fontSize: 16, color: 'rgba(226,232,240,0.7)', marginBottom: 20 }}>
        总筹码：<span style={{ fontWeight: 700, color: COLORS.accent }}>${chips}</span>
      </div>
      {chips > 0 ? (
        <button
          onClick={onRestart}
          style={{
            padding: '12px 28px',
            background: COLORS.accent,
            color: '#000',
            border: 'none',
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          再来一局
        </button>
      ) : (
        <div style={{ color: COLORS.danger, fontSize: 16, fontWeight: 700 }}>
          筹码耗尽！游戏结束。
        </div>
      )}
    </div>
  );
}

export function BlackjackStage({ engine }: { engine: Engine }): React.ReactElement {
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
  const [sessionOutcome, setSessionOutcome] = useState<{
    outcome?: string;
    winAmount: number;
  }>({ winAmount: 0 });

  const initializeGame = useCallback(
    (bet: number) => {
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
    },
    []
  );

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

        return {
          ...newSession,
          dealerCards,
          deck,
          gameState: GAME_STATES.GAME_OVER,
        };
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [gameSession.gameState]);

  const currentHand = gameSession.playerHands[gameSession.currentHandIndex];
  const isPlayerTurn = gameSession.gameState === GAME_STATES.PLAYER_TURN;
  const isGameOver = gameSession.gameState === GAME_STATES.GAME_OVER;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 800,
        margin: '0 auto',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        color: COLORS.text,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div>
        <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.accent }}>二十一点</div>
        <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.6)', marginTop: 4 }}>
          Blackjack · v1.0 完整版
        </div>
      </div>

      <div
        style={{
          background: 'rgba(251, 191, 36, 0.1)',
          border: `1px solid ${COLORS.gold}`,
          borderRadius: 8,
          padding: 12,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 14, color: 'rgba(226,232,240,0.7)' }}>💰 筹码</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.gold }}>${chips}</div>
      </div>

      {gameSession.gameState === GAME_STATES.BETTING ? (
        <BettingPhase
          chips={chips}
          currentBet={currentBet}
          onBet={setCurrentBet}
          onDeal={() => {
            initializeGame(currentBet);
            setChips(chips - currentBet);
          }}
        />
      ) : (
        <>
          <div
            style={{
              background: COLORS.panel,
              border: `1px solid rgba(74, 222, 128, 0.2)`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>
              🎰 庄家
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {gameSession.dealerCards.map((card: Card, i: number) => (
                <CardComp key={i} card={card} hidden={isPlayerTurn && i === gameSession.dealerCards.length - 1} />
              ))}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.accent }}>
              {isPlayerTurn ? '? 点' : `${calculateScore(gameSession.dealerCards).score} 点`}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {gameSession.playerHands.map((hand: Hand, i: number) => (
              <HandDisplay
                key={i}
                hand={hand}
                label={`🎴 手 ${gameSession.playerHands.length > 1 ? i + 1 : ''}`}
                isActive={i === gameSession.currentHandIndex && isPlayerTurn}
                onSplit={() => onSplit()}
                onHit={() => onHit()}
                onStand={() => onStand()}
                canHit={hand.status === 'active' && isPlayerTurn}
                canStand={hand.status === 'active' && isPlayerTurn}
                canSplitHand={hand.status === 'active' && isPlayerTurn && canSplit(hand) && chips >= hand.bet}
              />
            ))}
          </div>
        </>
      )}

      {isGameOver && (
        <GameOverScreen
          chips={chips}
          winAmount={sessionOutcome.winAmount}
          outcome={sessionOutcome.outcome}
          onRestart={() => {
            setGameSession({
              deck: [],
              playerHands: [],
              currentHandIndex: 0,
              dealerCards: [],
              gameState: GAME_STATES.BETTING,
            });
            setSessionOutcome({ winAmount: 0 });
          }}
        />
      )}
    </div>
  );
}
