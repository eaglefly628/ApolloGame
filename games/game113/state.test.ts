import { describe, expect, it } from 'vitest';
import { dailyRecommendation } from './data.js';
import { INITIAL_STATE, normalizeState, previewBuy, previewSell, toggleInterest, toggleFollow } from './state.js';

describe('game113 application demo state', () => {
  it('rotates a recommendation among interests the visitor has not selected', () => {
    const selected = ['watch', 'woodwork'] as const;
    const first = dailyRecommendation([...selected], new Date(2026, 8, 30));
    const next = dailyRecommendation([...selected], new Date(2026, 9, 1));
    expect(selected).not.toContain(first.id);
    expect(selected).not.toContain(next.id);
    expect(first.id).not.toBe('cigar');
    expect(next.id).not.toBe('cigar');
    expect(first.id).not.toBe(next.id);
  });
  it('keeps interests and follows independent', () => {
    const interested = toggleInterest(INITIAL_STATE, 'watch');
    expect(interested.interests).toEqual(['watch']);
    expect(interested.following).toEqual([]);
    expect(toggleFollow(interested, 'watch').following).toEqual(['watch']);
    expect(toggleInterest(interested, 'watch').interests).toEqual([]);
  });

  it('records a local preview purchase and sale without changing the original state', () => {
    const bought = previewBuy(INITIAL_STATE, 'watch-01');
    expect(bought.error).toBeUndefined();
    expect(bought.state.balance).toBe(1720);
    expect(bought.state.owned).toContain('watch-01');
    expect(INITIAL_STATE.owned).not.toContain('watch-01');
    expect(previewBuy(bought.state, 'watch-01').error).toBeTruthy();

    const sold = previewSell(bought.state, 'watch-01');
    expect(sold.error).toBeUndefined();
    expect(sold.state.balance).toBe(2366);
    expect(sold.state.owned).not.toContain('watch-01');
    expect(sold.state.ledger[0].amount).toBe(646);
  });

  it('rejects missing items and unaffordable preview purchases', () => {
    expect(previewBuy(INITIAL_STATE, 'missing').error).toBeTruthy();
    expect(previewSell(INITIAL_STATE, 'watch-01').error).toBeTruthy();
    expect(previewBuy({ ...INITIAL_STATE, balance: 0 }, 'watch-01').error).toBeTruthy();
  });

  it('normalizes malformed local storage data', () => {
    expect(normalizeState(null)).toEqual(INITIAL_STATE);
    const recovered = normalizeState({ onboarded: true, balance: -10, interests: ['watch', 'unknown'], owned: ['walnut-01', 'fake'], largeText: true });
    expect(recovered.onboarded).toBe(true);
    expect(recovered.balance).toBe(INITIAL_STATE.balance);
    expect(recovered.interests).toEqual(['watch']);
    expect(recovered.owned).toEqual(['walnut-01']);
    expect(recovered.largeText).toBe(true);
  });
});
