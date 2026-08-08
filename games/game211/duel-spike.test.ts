// duel-spike 判词纯函数测试（物理表现不可测·但「朝上面 → 生死判词」这一步是纯函数·必须钉死）。
// 面序 [+X,-X,+Y,-Y,+Z,-Z]：+Z(index 4)=牌正面=活；其余=反面/立面=亡。
import { describe, it, expect } from 'vitest';
import { judgeDuel, type CardOutcome } from './duel-spike.js';

const c = (side: 'a' | 'b', face: number): CardOutcome => ({ side, face, front: face === 4 });

describe('judgeDuel · 抛掷定生死', () => {
  it('一正一反 → 正面者胜（我方正面=胜）', () => {
    expect(judgeDuel(c('a', 4), c('b', 5))).toBe('我方正面朝上 · 胜');
  });
  it('一正一反 → 正面者胜（敌方正面=负）', () => {
    expect(judgeDuel(c('a', 5), c('b', 4))).toBe('敌方正面朝上 · 负');
  });
  it('双正 → 同生（平）', () => {
    expect(judgeDuel(c('a', 4), c('b', 4))).toBe('双双正面 · 同生（平）');
  });
  it('双反 → 同归于尽（平）', () => {
    expect(judgeDuel(c('a', 5), c('b', 5))).toBe('双双反面 · 同归于尽（平）');
  });
  it('立在侧面（face 0..3）算反面·不算活——薄牌立住是罕见但真会发生的落定态', () => {
    for (const f of [0, 1, 2, 3]) expect(c('a', f).front).toBe(false);
    expect(judgeDuel(c('a', 0), c('b', 4))).toBe('敌方正面朝上 · 负');
  });
});
