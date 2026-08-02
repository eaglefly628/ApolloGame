// Boss 通用 utility AI（doc27 §八·甲一次写好·零 per-boss 代码）行为测试：画像驱动的不同打法 + 难度档 + 施法 + 确定性。
import { describe, it, expect } from 'vitest';
import { NO_TENGANG } from './combat-types.js';
import { initTurnBattle, aiTakeTurn, turnHash, NEUTRAL_AI, type PokerCard, type Card, type TurnBattle, type TurnUnit } from './turn-combat.js';
import { cardPoints } from './clash-resolve.js';
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

  it('防守威胁响应：玩家压某路、Boss 这路空 → AI 回防（修「空路直捣大本营」exploit·requests#491）', () => {
    const mkU = (id: string, rank: string, slot: number): TurnUnit =>
      ({ id, rank, suit: 'S', points: cardPoints(rank), buff: 0, general: false, stamina: 3, staminaLeft: 3, slot, speed: 1 });
    // 专一路画像(lanePref=0·最爱扎堆·最易漏路) + 高 tier(最优·无失误)：旧贪心会把兵全堆进空敌路、漏掉被压的 lane2。
    const b = initTurnBattle({ seed: 7, aiProfile: { ...NEUTRAL_AI, lanePref: 0 }, aiTier: 4 });
    b.active = 'b'; b.b.mana = 6; b.b.hand = [pk('p0', '9'), pk('p1', '8'), pk('p2', '7')];
    b.lanes[2].a = [mkU('a0', 'K', 7), mkU('a1', 'Q', 6)]; // 玩家两兵压 lane2·逼近 Boss 家(slot7/6)·Boss 三路皆空=漏路
    aiTakeTurn(b); // 含 endTurn→推进→掷命：Boss 回防兵会与玩家前锋交手（胜负不论·关键是"有没有去堵"）
    expect(b.clashLog.some((c) => c.lane === 2)).toBe(true); // Boss 在 lane2 接战了=去堵了漏路（旧贪心会漏→玩家直捣大本营·零掷命）
  });
});
