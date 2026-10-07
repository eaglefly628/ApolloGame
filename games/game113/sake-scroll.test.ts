import { describe, expect, it } from 'vitest';
import { SAKE_SCROLL_ARCHIVES, SAKE_SCROLL_TIERS, sakeScrollCanOpen, sakeScrollTier } from './sake-scroll.js';

describe('game113 sake scroll unlocks', () => {
  it('starts with the guide and public competition results, then opens study chapters in order', () => {
    expect(SAKE_SCROLL_TIERS.map((tier) => tier.level)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(SAKE_SCROLL_ARCHIVES.every((entry) => entry.requiredLevel > 0)).toBe(true);
    for (let level = 0; level <= 5; level += 1) {
      expect(sakeScrollCanOpen('guide', level)).toBe(true);
      expect(sakeScrollCanOpen('rankings', level)).toBe(true);
      expect(sakeScrollCanOpen('sources', level)).toBe(true);
      for (const archive of SAKE_SCROLL_ARCHIVES) {
        expect(sakeScrollCanOpen(archive.id, level)).toBe(level >= archive.requiredLevel);
      }
    }
    expect(sakeScrollTier(5).name).toBe('守藏');
  });
});
