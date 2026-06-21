// disha 地煞（Boss 招牌历史战术·doc23 §八·关1-5 共 15 张）实装行为测试 —— 甲逐个实现的验收（参数→掷命/推进/大本营 行为断言）。
import { describe, it, expect } from 'vitest';
import { cardPoints } from './clash-resolve.js';
import { cardStamina } from './live-combat.js';
import { aggregateDisha, stageDisha, STAGE_DISHA, NO_DISHA } from './disha.js';
import { initTurnBattle, endTurn, aiTakeTurn, clashOdds, type TurnUnit, type TurnBattle } from './turn-combat.js';

const u = (id: string, rank: string, slot: number, o: { buff?: number; general?: boolean } = {}): TurnUnit =>
  ({ id, rank, suit: 'S', points: cardPoints(rank), buff: o.buff ?? 0, general: o.general ?? false, stamina: cardStamina(rank), staminaLeft: cardStamina(rank), slot });

// 跑一场遭遇掷命（玩家 K@4 vs Boss 9@5·上路相邻）→ 返回 lastClash 玩家胜率（地煞越狠·胜率越低）。
const clashWr = (disha: string[], place: (b: TurnBattle) => void = (b) => { b.lanes[0].a.push(u('a0', 'K', 4)); b.lanes[0].b.push(u('b0', '9', 5)); }): number => {
  const b = initTurnBattle({ seed: 5, disha: place === undefined ? [] : disha });
  place(b); endTurn(b); endTurn(b); // 双方放置完 → 行动阶段两军逼近 → 相邻掷命，wr 已含地煞调整
  return b.lastClash?.winrate ?? -1;
};

describe('Game G · 地煞（doc23 §八 关1-5 · 15 张 · 甲实装）', () => {
  it('aggregateDisha + STAGE_DISHA：关1-5 各 3 张·关1 列奥尼达聚合(2血/隘口+2战力/方阵/2命)', () => {
    expect(STAGE_DISHA.length).toBe(5);
    expect(STAGE_DISHA.every((s) => s.length === 3)).toBe(true);
    expect(stageDisha(1)).toEqual(['thermopylae', 'phalanx', 'laststand']);
    expect(stageDisha(99)).toEqual(STAGE_DISHA[4]); // 越界取末关
    const d = aggregateDisha(stageDisha(1));
    expect(d.homeHp).toBe(2); expect(d.nearBasePower).toBe(2); expect(d.phalanxPerAdj).toBe(6); expect(d.phalanxCap).toBe(24); expect(d.lastStandGeneral).toBe(true);
    expect(aggregateDisha([])).toEqual(NO_DISHA);
  });

  it('🟢 温泉关死守：Boss 大本营 2 血 + 隘口(贴家 2 格)守军 +2 战力（owner 2026-06-21·替原 4血/+15%胜率）', () => {
    const b = initTurnBattle({ seed: 1, disha: ['thermopylae'] });
    expect(b.homeB).toBe(2); expect(b.homeA).toBe(3); // 薄血死守(2<普通3)·靠隘口+2战力固守
    // Boss 兵在自家隘口(slot 7,8)→ 守军 +2 战力 → 玩家攻其更难(胜率更低)；同位无地煞作对比
    const inGap = clashWr(['thermopylae'], (x) => { x.lanes[0].a.push(u('a0', 'K', 7)); x.lanes[0].b.push(u('b0', '9', 8)); });
    const noGap = clashWr([], (x) => { x.lanes[0].a.push(u('a0', 'K', 7)); x.lanes[0].b.push(u('b0', '9', 8)); });
    expect(inGap).toBeLessThan(noGap);
  });

  it('🟢 挟天子/破釜沉舟/霸王之勇：全军/主将 +胜率 → 玩家胜率被压低', () => {
    const base = clashWr([]);
    expect(clashWr(['mandate'])).toBeLessThan(base);    // 挟天子 全军 +10%
    expect(clashWr(['burnboats'])).toBeLessThan(base);  // 破釜沉舟 全军 +20%
    // 霸王之勇 +40% 仅对主将 → 需 Boss 主将
    const gen = (x: TurnBattle): void => { x.lanes[0].a.push(u('a0', 'K', 4)); x.lanes[0].b.push(u('b0', '9', 5, { general: true })); };
    expect(clashWr(['overlord'], gen)).toBeLessThan(clashWr([], gen));
    expect(clashWr(['burnboats'])).toBeLessThan(clashWr(['mandate'])); // +20% 比 +10% 更狠
  });

  it('🟡 斯巴达方阵：Boss 兵 8 邻越多·掷命加成越高（封顶 +24%）', () => {
    const lone = (x: TurnBattle): void => { x.lanes[0].a.push(u('a0', 'K', 4)); x.lanes[0].b.push(u('b0', '9', 5)); };
    const packed = (x: TurnBattle): void => { x.lanes[0].a.push(u('a0', 'K', 4)); x.lanes[0].b.push(u('b0', '9', 5), u('b1', '8', 6)); x.lanes[1].b.push(u('b2', '7', 5)); };
    expect(clashWr(['phalanx'], packed)).toBeLessThan(clashWr(['phalanx'], lone)); // 有邻更强
  });

  it('🟡 九战九捷：Boss 连胜累积 +5%/胜（封顶 +30%）→ streak 越高玩家越难', () => {
    const place = (x: TurnBattle): void => { x.lanes[0].a.push(u('a0', 'K', 4)); x.lanes[0].b.push(u('b0', '9', 5)); };
    const at = (streak: number): number => { const b = initTurnBattle({ seed: 5, disha: ['winstreak'] }); place(b); b.bossWinStreak = streak; endTurn(b); endTurn(b); return b.lastClash!.winrate; };
    expect(at(4)).toBeLessThan(at(0));
    // Boss 胜一场 → streak +1
    const b = initTurnBattle({ seed: 9 }); b.lanes[0].a.push(u('a0', '2', 4)); b.lanes[0].b.push(u('b0', 'A', 5, { buff: 20 })); // Boss 碾压必胜
    endTurn(b); endTurn(b); expect(b.lastClash!.aWins).toBe(false); expect(b.bossWinStreak).toBe(1);
  });

  it('🟡 锤砧：你前锋被 Boss 兵左右(slot±1)夹住 → 你掷命 −15%', () => {
    // 夹击=瞬态阵位（同步推进模型里后方敌兵会走开），直接用纯 clashOdds 验当前前锋的 bossEdge·不走推进。
    const odds = (place: (b: TurnBattle) => void): number => { const b = initTurnBattle({ seed: 5, disha: ['hammeranvil'] }); place(b); return clashOdds(b, 0) ?? -1; };
    const flanked = odds((x) => { x.lanes[0].a.push(u('a0', 'K', 4)); x.lanes[0].b.push(u('b0', '9', 5), u('b1', '9', 3)); }); // boss 在 3 和 5 夹住 a@4
    const oneSide = odds((x) => { x.lanes[0].a.push(u('a0', 'K', 4)); x.lanes[0].b.push(u('b0', '9', 5)); });
    expect(flanked).toBeLessThan(oneSide);
  });

  it('🟡 大炮兵：每 3 回合压你兵最多的一路；被压路掷命 −15%', () => {
    const b = initTurnBattle({ seed: 3, disha: ['battery'] });
    b.lanes[2].a.push(u('a0', '7', 3), u('a1', '8', 2)); // 下路兵最多
    b.active = 'b'; b.turn = 3; // 3 % 3 === 0 → 触发
    aiTakeTurn(b);
    expect(b.batteryLane).toBe(2);
    const b2 = initTurnBattle({ seed: 3, disha: ['battery'] }); b2.lanes[2].a.push(u('a0', '7', 3)); b2.active = 'b'; b2.turn = 2; aiTakeTurn(b2);
    expect(b2.batteryLane).toBe(-1); // 非 3 倍数回合不压
  });

  it('🟡 长枪方阵·先手：全平局判 Boss 胜（他先手）', () => {
    const b = initTurnBattle({ seed: 5, disha: ['sarissa'] });
    b.lanes[0].a.push(u('a0', '9', 4)); b.lanes[0].b.push(u('b0', '9', 5)); // 同点同续航 → 全平
    endTurn(b); endTurn(b);
    expect(b.lastClash!.tie).toBe('roll'); expect(b.lastClash!.aWins).toBe(false); // 先手 → Boss 胜
  });

  it('🟡 死战不退：Boss 主将首负不亡·残喘退 1 格·二次才真死（关1 仅主将）', () => {
    const b = initTurnBattle({ seed: 2, disha: ['laststand'] });
    b.lanes[0].a.push(u('a0', 'A', 4, { buff: 24 })); // 玩家碾压
    b.lanes[0].b.push(u('b0', '3', 5, { general: true })); // Boss 弱主将
    endTurn(b); endTurn(b); // 行动阶段：玩家胜 → 主将本应亡，但死战不退 → 残喘退格
    expect(b.bossLastStandUsed).toBe(true);
    expect(b.lanes[0].b.some((x) => x.id === 'b0')).toBe(true); // 仍在场
    expect(b.lanes[0].bGenDead).toBe(false); // 未判主将亡
  });

  it('🟢 大军压境/机动调度：Boss 回合开始多 +1 召唤源泉(免费多铺)', () => {
    const swarm = initTurnBattle({ seed: 1, disha: ['swarm'] }); swarm.lanes[0].a.push(u('a0', '7', 4)); // 给个兵免推进即胜
    endTurn(swarm); // 切到 Boss 回合
    expect(swarm.active).toBe('b'); expect(swarm.b.mana).toBe(2); // +1 基础 +1 大军压境
    const plain = initTurnBattle({ seed: 1 }); plain.lanes[0].a.push(u('a0', '7', 4)); endTurn(plain);
    expect(plain.b.mana).toBe(1); // 仅基础 +1
  });

  it('确定性：无地煞 → 与基线行为一致（地煞不入 hash·dishaB 默认零修正）', () => {
    expect(aggregateDisha([])).toEqual(NO_DISHA);
    const b = initTurnBattle({ seed: 7 });
    expect(b.dishaB).toEqual(NO_DISHA); expect(b.homeB).toBe(3); expect(b.batteryLane).toBe(-1);
  });
});
