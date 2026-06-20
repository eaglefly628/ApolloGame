// Boss 通用 utility AI（doc27 §八·甲一次写好·零 per-boss 代码）行为测试：画像驱动的不同打法 + 难度档 + 施法 + 确定性。
import { describe, it, expect } from 'vitest';
import { NO_TENGANG } from './live-combat.js';
import { initTurnBattle, aiTakeTurn, turnHash, NEUTRAL_AI, type PokerCard, type Card, type TurnBattle } from './turn-combat.js';
import { loadLevel } from './level.js';

const pk = (id: string, rank: string): PokerCard => ({ kind: 'poker', id, rank, suit: 'S', general: false, buff: 0 });
const maxLaneB = (b: TurnBattle): number => Math.max(...b.lanes.map((L) => L.b.length));
const lanesUsedB = (b: TurnBattle): number => b.lanes.filter((L) => L.b.length > 0).length;

// 起一个 Boss 回合：满手扑克 + 够源泉 → 跑 AI（tier4=最优·无失误）。
const bossDeploys = (profile: ReturnType<typeof loadLevel>['boss']['aiProfile']): TurnBattle => {
  const b = initTurnBattle({ seed: 11, aiProfile: profile, aiTier: 4 });
  b.active = 'b'; b.b.mana = 6; b.b.hand = [pk('p0', 'K'), pk('p1', 'Q'), pk('p2', 'J'), pk('p3', '9'), pk('p4', '8'), pk('p5', '7')];
  aiTakeTurn(b);
  return b;
};

describe('Game G · Boss 通用 utility AI（doc27 §八·性格即数据）', () => {
  it('lanePref：曹操(铺三路 9)摊得比 列奥尼达(专/守 3)更开·列奥尼达更扎堆', () => {
    const caocao = bossDeploys(loadLevel(3).boss.aiProfile);   // 铺三路
    const leonidas = bossDeploys(loadLevel(1).boss.aiProfile); // 专/扎堆
    expect(lanesUsedB(caocao)).toBeGreaterThanOrEqual(lanesUsedB(leonidas)); // 曹操更摊开
    expect(maxLaneB(leonidas)).toBeGreaterThan(maxLaneB(caocao));            // 列奥尼达更扎堆(单路更高)
  });

  it('AI 真出手：满手 + 源泉 → 部署多个兵并结束回合（不空过）', () => {
    const b = bossDeploys(NEUTRAL_AI);
    expect(b.lanes.reduce((n, L) => n + L.b.length, 0)).toBeGreaterThanOrEqual(3); // 至少铺了几个
    expect(b.active).toBe('a'); // 回合已结束交回玩家
  });

  it('aiTier：低档(1)会犯错→与高档(4)选择可不同（同 seed）', () => {
    const run = (tier: number): string => {
      const b = initTurnBattle({ seed: 4, aiProfile: { ...NEUTRAL_AI, lanePref: 0 }, aiTier: tier });
      b.active = 'b'; b.b.mana = 4; b.b.hand = [pk('p0', 'K'), pk('p1', 'Q'), pk('p2', 'J'), pk('p3', '9')];
      aiTakeTurn(b); return turnHash(b);
    };
    expect(run(1)).not.toBe(run(4)); // 低档掷骰犯错 → 棋面不同
  });

  it('Boss 施法：spellEager 高 + 手有天罡 → AI 打出·aggTengang 回调重算即时生效', () => {
    const b = initTurnBattle({ seed: 3, aiProfile: { ...NEUTRAL_AI, spellEager: 10 }, aiTier: 4 });
    b.active = 'b'; b.b.mana = 2; b.b.hand = [{ kind: 'tengang', id: 'hufu' } as Card];
    let aggWith: readonly string[] = [];
    aiTakeTurn(b, (ids) => { aggWith = ids; return NO_TENGANG; });
    expect(b.b.castIds).toContain('hufu'); // 施法集含已打出
    expect(aggWith).toContain('hufu');     // 回调重算被调用
  });

  it('确定性：同 seed + 同画像 + 同 tier → AI 逐手可复现（turnHash 一致）', () => {
    const run = (): string => {
      const b = initTurnBattle({ seed: 8, aiProfile: loadLevel(5).boss.aiProfile, aiTier: 3 });
      b.active = 'b'; b.b.mana = 5; b.b.hand = [pk('p0', 'A'), pk('p1', 'K'), pk('p2', '7'), pk('p3', '5'), pk('p4', '3')];
      aiTakeTurn(b); return turnHash(b);
    };
    expect(run()).toBe(run());
  });
});
