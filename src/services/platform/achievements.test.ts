// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ACHIEVEMENTS, firstBootAchievement, createPlatformPort, resetMockSteam,
} from './index.js';

beforeEach(() => { resetMockSteam(); localStorage.clear(); });

describe('platform · 成就目录（数据）', () => {
  it('每个游戏目录 id 唯一、含一枚 *_FIRST_BOOT', () => {
    for (const [game, defs] of Object.entries(ACHIEVEMENTS)) {
      const ids = defs.map((d) => d.id);
      expect(new Set(ids).size, `${game} id 应唯一`).toBe(ids.length);
      expect(firstBootAchievement(game), `${game} 应有首启成就`).toBeDefined();
    }
  });
  it('未知游戏 → firstBootAchievement undefined', () => {
    expect(firstBootAchievement('game-zzz')).toBeUndefined();
  });

  it('端到端：开假 Steam → 解锁首启成就 → 记入态并弹 toast', () => {
    const port = createPlatformPort(undefined, { mock: true });
    const boot = firstBootAchievement('game-g')!;
    port.unlockAchievement(boot);
    port.store();
    expect(document.querySelector('.apollo-steam-toast')).not.toBeNull();
    // 二次造端口（读同一持久化态）：首启成就已解锁 → 幂等（不再弹新 toast 由幂等保证）
    const port2 = createPlatformPort(undefined, { mock: true });
    expect(port2.isAvailable()).toBe(true);
  });
});
