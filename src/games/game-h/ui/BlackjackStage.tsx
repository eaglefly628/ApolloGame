import React, { useState, useEffect, useCallback } from 'react';
import { Engine } from '../../../runtime/engine.js';
import type { Resource, State, Clickable } from '@engine/protocol/components.js';
import { useWorldVersion } from '@ui/hooks/use-engine.js';
import { useComponent } from '@ui/hooks/use-component.js';
import {
  DECK_ID,
  PLAYER_CARDS_ID,
  PLAYER_SCORE_ID,
  DEALER_CARDS_ID,
  DEALER_SCORE_ID,
  GAME_STATES,
  BLACKJACK_LIMIT,
  DEALER_STAND_AT,
  buildDeck,
  type Card,
} from '../theme.js';
import {
  GAME_STATE_ENTITY,
  PLAYER_ENTITY,
  DEALER_ENTITY,
  HIT_BUTTON_ID,
  STAND_BUTTON_ID,
  RESTART_BUTTON_ID,
} from '../blueprint.js';

// ═══════════════════════════════════════════════════════════════
//  Game H ·《二十一点》(Blackjack) —— 交互舞台（React 表现层）
//
//  核心职责：
//  1. 计算手牌点数（A 灵活计 1 或 11）
//  2. 响应玩家操作（要牌、停牌、重新开始）
//  3. 自动执行庄家 AI（17 点站住）
//  4. 判定胜负并更新世界状态
//  5. 渲染游戏界面和统计数据
// ═══════════════════════════════════════════════════════════════

const COLORS = {
  bg: '#0a0f1e',
  panel: 'rgba(30,58,47,0.3)',
  text: '#e2e8f0',
  accent: '#4ade80',
  danger: '#ef4444',
  primary: '#1e3a2f',
};

const CARD_SUITS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

interface GameState {
  deck: Card[];
  playerCards: Card[];
  dealerCards: Card[];
  gameState: string;
  outcome?: string;
  playerBust: boolean;
  dealerBust: boolean;
}

function calculateScore(cards: Card[]): { score: number; scoreWithAce: number } {
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

  let scoreWithAce = score;
  while (scoreWithAce > BLACKJACK_LIMIT && aces > 0) {
    scoreWithAce -= 10;
    aces -= 1;
  }

  return { score: scoreWithAce, scoreWithAce };
}

function displayCard(card: Card): string {
  const suit = CARD_SUITS[card.suit as keyof typeof CARD_SUITS];
  return `${card.display}${suit}`;
}

function CardComponent({ card, hidden = false }: { card: Card; hidden?: boolean }): React.ReactElement {
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
      }}
    >
      {hidden ? '🂠' : displayCard(card)}
    </div>
  );
}

function Hand({ cards, label, score, hidden = false }: {
  cards: Card[];
  label: string;
  score: number;
  hidden?: boolean;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {cards.map((card: Card, i: number) => (
          <CardComponent key={i} card={card} hidden={hidden && i === cards.length - 1} />
        ))}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.accent }}>
        {hidden && cards.length > 1
          ? `${calculateScore(cards.slice(0, -1)).score} + ?`
          : `${score} 点`}
      </div>
    </div>
  );
}

export function BlackjackStage({ engine }: { engine: Engine }): React.ReactElement {
  useWorldVersion(engine);

  const gameStateComponent = useComponent<State>(engine, GAME_STATE_ENTITY, 'State');
  const playerCardsResource = useComponent<Resource>(engine, PLAYER_ENTITY, 'Resource');
  const dealerCardsResource = useComponent<Resource>(engine, DEALER_ENTITY, 'Resource');

  const [gameState, setGameState] = useState<GameState>(() => ({
    deck: shuffleDeck(buildDeck()),
    playerCards: [],
    dealerCards: [],
    gameState: GAME_STATES.INIT,
    outcome: undefined,
    playerBust: false,
    dealerBust: false,
  }));

  // ── 初始化游戏 ──────────────────────────────────────────────────
  const initializeGame = useCallback(() => {
    const deck = shuffleDeck(buildDeck());
    const playerCards = [deck.pop()!, deck.pop()!];
    const dealerCards = [deck.pop()!, deck.pop()!];

    setGameState({
      deck,
      playerCards,
      dealerCards,
      gameState: GAME_STATES.PLAYER_TURN,
      outcome: undefined,
      playerBust: false,
      dealerBust: false,
    });

    // 更新世界状态
    updateResourceInEngine(engine, DECK_ID, deck.length);
    updateResourceInEngine(engine, PLAYER_CARDS_ID, playerCards.length);
    updateResourceInEngine(engine, DEALER_CARDS_ID, dealerCards.length);
    updateStateInEngine(engine, GAME_STATE_ENTITY, GAME_STATES.PLAYER_TURN);
  }, [engine]);

  // ── 首次初始化 ──────────────────────────────────────────────────
  useEffect(() => {
    if (gameState.gameState === GAME_STATES.INIT) {
      initializeGame();
    }
  }, []);

  // ── 要牌 ──────────────────────────────────────────────────────
  const onHit = useCallback(() => {
    if (gameState.gameState !== GAME_STATES.PLAYER_TURN) return;

    const newDeck = [...gameState.deck];
    const newPlayerCards = [...gameState.playerCards, newDeck.pop()!];
    const { score } = calculateScore(newPlayerCards);

    if (score > BLACKJACK_LIMIT) {
      // 爆牌
      setGameState((prev: GameState) => ({
        ...prev,
        playerCards: newPlayerCards,
        deck: newDeck,
        playerBust: true,
        gameState: GAME_STATES.GAME_OVER,
        outcome: 'player_bust',
      }));
      updateResourceInEngine(engine, DECK_ID, newDeck.length);
      updateResourceInEngine(engine, PLAYER_CARDS_ID, newPlayerCards.length);
      updateStateInEngine(engine, GAME_STATE_ENTITY, GAME_STATES.GAME_OVER);
    } else {
      setGameState((prev: GameState) => ({
        ...prev,
        playerCards: newPlayerCards,
        deck: newDeck,
      }));
      updateResourceInEngine(engine, DECK_ID, newDeck.length);
      updateResourceInEngine(engine, PLAYER_CARDS_ID, newPlayerCards.length);
    }
  }, [gameState, engine]);

  // ── 停牌，进入庄家回合 ──────────────────────────────────────────
  const onStand = useCallback(() => {
    if (gameState.gameState !== GAME_STATES.PLAYER_TURN) return;

    setGameState((prev) => ({
      ...prev,
      gameState: GAME_STATES.DEALER_TURN,
    }));
    updateStateInEngine(engine, GAME_STATE_ENTITY, GAME_STATES.DEALER_TURN);

    // 使用 setTimeout 延迟庄家的行动，以便用户看到动画
    setTimeout(() => {
      applyDealerLogic(gameState.playerCards, gameState.dealerCards, gameState.deck);
    }, 800);
  }, [gameState, engine]);

  // ── 庄家逻辑 ──────────────────────────────────────────────────
  const applyDealerLogic = useCallback(
    (playerCards: Card[], initialDealerCards: Card[], initialDeck: Card[]) => {
      let dealerCards = [...initialDealerCards];
      let deck = [...initialDeck];
      let dealerBust = false;
      let outcome = '';

      // 庄家 AI：< 17 要牌，>= 17 停牌
      while (true) {
        const { score } = calculateScore(dealerCards);
        if (score >= DEALER_STAND_AT) break;
        dealerCards.push(deck.pop()!);
      }

      const playerScore = calculateScore(playerCards).score;
      const dealerScore = calculateScore(dealerCards).score;

      if (dealerScore > BLACKJACK_LIMIT) {
        dealerBust = true;
        outcome = 'dealer_bust';
      } else if (playerScore > dealerScore) {
        outcome = 'player_win';
      } else if (dealerScore > playerScore) {
        outcome = 'dealer_win';
      } else {
        outcome = 'tie';
      }

      setGameState((prev: GameState) => ({
        ...prev,
        dealerCards,
        deck,
        gameState: GAME_STATES.GAME_OVER,
        outcome,
        dealerBust,
        playerBust: false,
      }));

      updateResourceInEngine(engine, DECK_ID, deck.length);
      updateResourceInEngine(engine, DEALER_CARDS_ID, dealerCards.length);
      updateStateInEngine(engine, GAME_STATE_ENTITY, GAME_STATES.GAME_OVER);
    },
    [engine],
  );

  // ── 重新开始 ──────────────────────────────────────────────────
  const onRestart = useCallback(() => {
    initializeGame();
  }, [initializeGame]);

  const playerScore = calculateScore(gameState.playerCards).score;
  const dealerScore = calculateScore(gameState.dealerCards).score;
  const isGameOver = gameState.gameState === GAME_STATES.GAME_OVER;
  const isDealerTurn = gameState.gameState === GAME_STATES.DEALER_TURN;
  const isPlayerTurn = gameState.gameState === GAME_STATES.PLAYER_TURN;

  // 胜负文案
  let outcomeText = '';
  let outcomeColor = COLORS.text;
  if (isGameOver) {
    if (gameState.playerBust) {
      outcomeText = '❌ 爆牌！庄家胜';
      outcomeColor = COLORS.danger;
    } else if (gameState.dealerBust) {
      outcomeText = '✅ 庄家爆牌！你胜';
      outcomeColor = COLORS.accent;
    } else if (gameState.outcome === 'player_win') {
      outcomeText = '✅ 你胜';
      outcomeColor = COLORS.accent;
    } else if (gameState.outcome === 'dealer_win') {
      outcomeText = '❌ 庄家胜';
      outcomeColor = COLORS.danger;
    } else if (gameState.outcome === 'tie') {
      outcomeText = '🤝 平局';
      outcomeColor = COLORS.accent;
    }
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 500,
        margin: '0 auto',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        color: COLORS.text,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* 标题 */}
      <div>
        <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.accent }}>二十一点</div>
        <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.6)', marginTop: 4 }}>Blackjack · 传统纸牌游戏</div>
      </div>

      {/* 游戏板 */}
      <div
        style={{
          background: COLORS.panel,
          border: `1px solid rgba(74, 222, 128, 0.2)`,
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 30,
        }}
      >
        {/* 庄家区 */}
        <Hand
          cards={gameState.dealerCards}
          label="庄家"
          score={dealerScore}
          hidden={isPlayerTurn}
        />

        {/* 玩家区 */}
        <Hand cards={gameState.playerCards} label="你" score={playerScore} />
      </div>

      {/* 状态信息 */}
      <div
        style={{
          background: 'rgba(0,0,0,0.4)',
          borderRadius: 8,
          padding: 12,
          textAlign: 'center',
          fontSize: 14,
        }}
      >
        {isPlayerTurn && (
          <div>当前轮到你：要牌或停牌？</div>
        )}
        {isDealerTurn && (
          <div>庄家正在思考...</div>
        )}
        {isGameOver && (
          <div style={{ color: outcomeColor, fontWeight: 700 }}>
            {outcomeText}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {isPlayerTurn && (
          <>
            <button
              onClick={onHit}
              style={{
                padding: '10px 20px',
                background: COLORS.accent,
                color: '#000',
                border: 'none',
                borderRadius: 6,
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              要牌
            </button>
            <button
              onClick={onStand}
              style={{
                padding: '10px 20px',
                background: 'rgba(74, 222, 128, 0.2)',
                color: COLORS.accent,
                border: `1px solid ${COLORS.accent}`,
                borderRadius: 6,
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              停牌
            </button>
          </>
        )}
        {isGameOver && (
          <button
            onClick={onRestart}
            style={{
              padding: '10px 24px',
              background: COLORS.accent,
              color: '#000',
              border: 'none',
              borderRadius: 6,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            重新开始
          </button>
        )}
      </div>

      {/* 统计信息 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          fontSize: 12,
        }}
      >
        <div style={{ background: 'rgba(74, 222, 128, 0.1)', padding: 10, borderRadius: 6, textAlign: 'center' }}>
          <div style={{ color: 'rgba(226,232,240,0.6)' }}>牌堆剩余</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{gameState.deck.length}</div>
        </div>
        <div style={{ background: 'rgba(74, 222, 128, 0.1)', padding: 10, borderRadius: 6, textAlign: 'center' }}>
          <div style={{ color: 'rgba(226,232,240,0.6)' }}>你的牌</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{gameState.playerCards.length}</div>
        </div>
        <div style={{ background: 'rgba(74, 222, 128, 0.1)', padding: 10, borderRadius: 6, textAlign: 'center' }}>
          <div style={{ color: 'rgba(226,232,240,0.6)' }}>庄家的牌</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{gameState.dealerCards.length}</div>
        </div>
      </div>

      {/* 规则提示 */}
      <div
        style={{
          background: 'rgba(74, 222, 128, 0.1)',
          border: `1px solid rgba(74, 222, 128, 0.2)`,
          borderRadius: 8,
          padding: 10,
          fontSize: 11,
          lineHeight: 1.6,
          color: 'rgba(226,232,240,0.7)',
        }}
      >
        📖 <strong>规则</strong>：目标接近 21 点不超出。A 计 1 或 11 点。J/Q/K 计 10 点。庄家 17 点站住。
      </div>
    </div>
  );
}

// ── 工具函数 ────────────────────────────────────────────────────

function shuffleDeck(deck: readonly any[]): any[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function updateResourceInEngine(engine: Engine, resourceId: string, value: number): void {
  const world = engine.world;
  // 在实际实现中，这里应该更新世界的资源
  // 暂时作为占位符，实际逻辑由引擎层处理
}

function updateStateInEngine(engine: Engine, entityId: string, state: string): void {
  const world = engine.world;
  // 在实际实现中，这里应该更新世界的状态
  // 暂时作为占位符，实际逻辑由引擎层处理
}
