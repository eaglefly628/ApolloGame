// portraits.ts 立绘覆盖（owner 07-13 步2「渲染指向索引」）——真图命中即用·未命中回退程序化（默认·帧回归零变）。
import { describe, it, expect, afterEach } from 'vitest';
import { heroPortraitUri, registerPortraitOverrides, clearPortraitOverrides, portraitOverrideCount } from './portraits.js';

describe('portraits · 美术库覆盖（步2）', () => {
  afterEach(() => clearPortraitOverrides());

  it('默认无覆盖 → 程序化矢量 data-URI（观感零变·帧回归绿的根据）', () => {
    const u = heroPortraitUri('♠', '春秋·齐/吴', 'A');
    expect(u.startsWith('data:image/svg+xml')).toBe(true);
    expect(portraitOverrideCount()).toBe(0);
  });

  it('登记真图覆盖 → 该槽（花色字母+军衔）返回真图 URL·非命中槽仍走程序化', () => {
    registerPortraitOverrides({ sA: '/games/game211/art/portraits/real-AS.png' });
    expect(heroPortraitUri('♠', '春秋·齐/吴', 'A')).toBe('/games/game211/art/portraits/real-AS.png');
    // 未登记的槽（红桃 K）仍回退程序化
    expect(heroPortraitUri('♥', '13C·蒙古', 'K').startsWith('data:image/svg+xml')).toBe(true);
  });

  it('clear 后回退程序化（测试/换库确定性）', () => {
    registerPortraitOverrides({ sA: '/x.png' });
    clearPortraitOverrides();
    expect(heroPortraitUri('♠', '春秋·齐/吴', 'A').startsWith('data:image/svg+xml')).toBe(true);
  });
});
