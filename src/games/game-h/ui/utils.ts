import { BLACKJACK_LIMIT } from '../theme.js';
import type { Card, Hand } from '../theme.js';

export function calculateScore(cards: Card[]): { score: number; hasAce: boolean } {
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

export function canSplit(hand: Hand): boolean {
  if (hand.cards.length !== 2) return false;
  return hand.cards[0].baseValue === hand.cards[1].baseValue;
}
