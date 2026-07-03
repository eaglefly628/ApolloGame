// disha 地煞（Boss 招牌历史战术·doc23 §八·关1-5 共 15 张）实装行为测试 —— 甲逐个实现的验收（参数→掷命/推进/大本营 行为断言）。
import { describe, it, expect } from 'vitest';
import { cardPoints } from './clash-resolve.js';
import { cardStamina } from './combat-types.js';
import { aggregateDisha, stageDisha, STAGE_DISHA, NO_DISHA, DISHA_PLAYABLE } from './disha.js';
import { initTurnBattle, endTurn, aiTakeTurn, castDisha, clashOdds, MANA_START, type TurnUnit, type TurnBattle } from './turn-combat.js';

const u = (id: string, rank: string, slot: number, o: { buff?: number; general?: boolean } = {}): TurnUnit =>
  ({ id, rank, suit: 'S', points: cardPoints(rank), buff: o.buff ?? 0, general: o.general ?? false, stamina: cardStamina(rank), staminaLeft: cardStamina(rank), slot });

// 混合模型（owner 2026-06-21）：可施放地煞开局进 Boss 手牌·须打出才生效。测 fx 机制时把开局塞进手牌的地煞先打出（不扰乱回合态）。
const activatePlayable = (b: TurnBattle): void => {
  const sv = { active: b.active, mana: b.b.mana, action: b.actionTaken };
  b.active = 'b';
  for (let i = b.b.hand.length - 1; i >= 0; i--) if (b.b.hand[i].kind === 'disha') { b.b.mana = 2; b.actionTaken = null; castDisha(b, 'b', i); }
  b.active = sv.active; b.b.mana = sv.mana; b.actionTaken = sv.action;
};

// 跑一场遭遇掷命（玩家 K@4 vs Boss 9@5·上路相邻）→ 返回 lastClash 玩家胜率（地煞越狠·胜率越低）。
const clashWr = (disha: string[], place: (b: TurnBattle) => void = (b) => { b.lanes[0].a.push(u('a0', 'K', 4)); b.lanes[0].b.push(u('b0', '9', 5)); }): number => {
  const b = initTurnBattle({ seed: 5, disha: place === undefined ? [] : disha });
  place(b); activatePlayable(b); endTurn(b); endTurn(b); // 双方放置完(可施放地煞先打出) → 行动阶段两军逼近 → 相邻掷命，wr 已含地煞调整
  return b.lastClash?.winrate ?? -1;
};
// 各自掷战力骰（owner 2026-07-01）：地煞胜率 edge 折成 Boss 确定战力(dishaEdge)/nearDef → 抬 Boss 战力 → 抬 Boss 掷骰范围 → 压低玩家预报胜率。
// 掷骰随机 → 单场 aWins 与种子相关（不可断言）；改断言**确定的预报胜率 clashOdds**（地煞越狠·玩家胜率越低）+ 折的战力拆解 dishaEdge/nearDef。
const oddsWith = (disha: string[], place: (b: TurnBattle) => void): number => { const b = initTurnBattle({ seed: 5, disha }); place(b); activatePlayable(b); return clashOdds(b, 0) ?? -1; };
const clashLC = (disha: string[], place: (b: TurnBattle) => void) => { const b = initTurnBattle({ seed: 5, disha }); place(b); activatePlayable(b); endTurn(b); endTurn(b); return b.lastClash!; };
const tie9 = (x: TurnBattle): void => { x.lanes[0].a.push(u('a0', '9', 4)); x.lanes[0].b.push(u('b0', '9', 5)); }; // 9v9 同战力对峙

describe('Game G · 地煞（doc23 §八 关1-5 · 15 张 · 甲实装）', () => {
  it('aggregateDisha + STAGE_DISHA：关1-5 各 3 张·关1 列奥尼达聚合(2血/隘口+1战力/方阵/2命·§六重设)', () => {
    expect(STAGE_DISHA.length).toBe(5);
    expect(STAGE_DISHA.every((s) => s.length === 3)).toBe(true);
    expect(stageDisha(1)).toEqual(['thermopylae', 'phalanx', 'laststand']);
    expect(stageDisha(99)).toEqual(STAGE_DISHA[4]); // 越界取末关
    const d = aggregateDisha(stageDisha(1));
    expect(d.homeHp).toBe(2); expect(d.nearBasePower).toBe(1); expect(d.phalanxPerAdj).toBe(4); expect(d.phalanxCap).toBe(12); expect(d.lastStandGeneral).toBe(3); // §六：nearBasePower 2→1·phalanx 6/24→4/12·主将 3 命(REQ-G-主将命数参数化)
    expect(aggregateDisha([])).toEqual(NO_DISHA);
  });

  it('🟢 温泉关死守：Boss 大本营 2 血 + 隘口(贴家 2 格)守军 +1 战力（§六重设：2→1）', () => {
    const b = initTurnBattle({ seed: 1, disha: ['thermopylae'] });
    expect(b.homeB).toBe(2); expect(b.homeA).toBe(3); // 薄血死守(2<普通3)·靠隘口+1战力固守
    // Boss 兵在自家隘口(slot 7,8) → 守军 +1 战力进拆解(nearDef) → 抬 Boss 掷骰范围 → 压低玩家预报胜率；同位无地煞作对比。
    const gapPlace = (x: TurnBattle): void => { x.lanes[0].a.push(u('a0', 'K', 7)); x.lanes[0].b.push(u('b0', '9', 8)); };
    expect(clashLC(['thermopylae'], gapPlace).b.nearDef).toBe(1); // 守军 +1 战力进 Boss 战力拆解
    expect(oddsWith(['thermopylae'], gapPlace)).toBeLessThan(oddsWith([], gapPlace)); // 隘口守军 → 玩家胜率被压低
  });

  it('🟢 挟天子/破釜沉舟/霸王之勇：全军/主将 +胜率 → 折成 Boss 确定战力(dishaEdge)·压低玩家掷骰胜率', () => {
    // 全军 +胜率地煞 → 折成 dishaEdge 战力 → 抬 Boss 掷骰范围 → 玩家预报胜率被压低；折的战力越多压得越狠。
    expect(oddsWith(['mandate'], tie9)).toBeLessThan(oddsWith([], tie9));       // 挟天子 +5%
    expect(oddsWith(['burnboats'], tie9)).toBeLessThan(oddsWith([], tie9));     // 破釜沉舟 +20%
    expect(oddsWith(['burnboats'], tie9)).toBeLessThan(oddsWith(['mandate'], tie9)); // +20% 比 +5% 更狠
    expect(clashLC(['burnboats'], tie9).b.dishaEdge!).toBeGreaterThan(clashLC(['mandate'], tie9).b.dishaEdge!); // 折的战力 +20% > +5%
    // 霸王之勇 +40% 仅对主将 → 需 Boss 主将
    const gen = (x: TurnBattle): void => { x.lanes[0].a.push(u('a0', '9', 4)); x.lanes[0].b.push(u('b0', '9', 5, { general: true })); };
    expect(oddsWith(['overlord'], gen)).toBeLessThan(oddsWith([], gen));  // 主将享 +40%
    expect(clashLC(['overlord'], gen).b.dishaEdge!).toBeGreaterThan(0);   // 折成 dishaEdge>0
  });

  it('🟡 斯巴达方阵：Boss 兵 8 邻越多·掷命加成越高（封顶 +12%·§六 24→12）', () => {
    const lone = (x: TurnBattle): void => { x.lanes[0].a.push(u('a0', 'K', 4)); x.lanes[0].b.push(u('b0', '9', 5)); };
    const packed = (x: TurnBattle): void => { x.lanes[0].a.push(u('a0', 'K', 4)); x.lanes[0].b.push(u('b0', '9', 5), u('b1', '8', 6)); x.lanes[1].b.push(u('b2', '7', 5)); };
    expect(clashWr(['phalanx'], packed)).toBeLessThan(clashWr(['phalanx'], lone)); // 有邻更强
  });

  it('🟡 九战九捷：Boss 连胜累积 +4%/胜（封顶 +20%·§六 5/30→4/20）→ streak 越高折的战力越多·玩家越难', () => {
    const oddsAt = (streak: number): number => { const b = initTurnBattle({ seed: 5, disha: ['winstreak'] }); tie9(b); activatePlayable(b); b.bossWinStreak = streak; return clashOdds(b, 0) ?? -1; };
    expect(oddsAt(4)).toBeLessThan(oddsAt(0)); // streak 高 → dishaEdge 战力 → 压低玩家预报胜率
    const edgeAt = (streak: number): number => { const b = initTurnBattle({ seed: 5, disha: ['winstreak'] }); tie9(b); activatePlayable(b); b.bossWinStreak = streak; endTurn(b); endTurn(b); return b.lastClash!.b.dishaEdge ?? 0; };
    expect(edgeAt(4)).toBeGreaterThan(edgeAt(0));
    // Boss 胜一场 → streak +1（掷骰有随机 → 断言与本场结果一致：Boss 赢则 +1·输则 0）
    const b = initTurnBattle({ seed: 9 }); b.lanes[0].a.push(u('a0', '2', 4)); b.lanes[0].b.push(u('b0', 'A', 5, { buff: 20 })); // Boss 战力碾压(掷高概率极大)
    endTurn(b); endTurn(b); expect(b.bossWinStreak).toBe(b.lastClash!.aWins ? 0 : 1);
  });

  it('🟡 锤砧：你前锋被 Boss 兵左右(slot±1)夹住 → 你掷命 −6%（§六 15→6）', () => {
    // 夹击=瞬态阵位（同步推进模型里后方敌兵会走开），直接用纯 clashOdds 验当前前锋的 bossEdge·不走推进。
    const odds = (place: (b: TurnBattle) => void): number => { const b = initTurnBattle({ seed: 5, disha: ['hammeranvil'] }); place(b); return clashOdds(b, 0) ?? -1; };
    const flanked = odds((x) => { x.lanes[0].a.push(u('a0', '9', 4)); x.lanes[0].b.push(u('b0', '9', 5), u('b1', '9', 3)); }); // boss 在 3 和 5 夹住 a@4 → +6% 折成战力 → Boss 反超 → clashOdds=0
    const oneSide = odds((x) => { x.lanes[0].a.push(u('a0', '9', 4)); x.lanes[0].b.push(u('b0', '9', 5)); }); // 未夹 → 平局判玩家胜 → clashOdds=1
    expect(flanked).toBeLessThan(oneSide);
  });

  it('🟡 大炮兵：每 4 回合压你兵最多的一路；被压路掷命 −8%（§六：3/15→4/8）', () => {
    const b = initTurnBattle({ seed: 3, disha: ['battery'] });
    b.lanes[2].a.push(u('a0', '7', 3), u('a1', '8', 2)); // 下路兵最多
    b.active = 'b'; b.turn = 4; // 4 % 4 === 0 → 触发（§六 everyTurns 3→4）
    aiTakeTurn(b);
    expect(b.batteryLane).toBe(2);
    const b2 = initTurnBattle({ seed: 3, disha: ['battery'] }); b2.lanes[2].a.push(u('a0', '7', 3)); b2.active = 'b'; b2.turn = 2; aiTakeTurn(b2);
    expect(b2.batteryLane).toBe(-1); // 非 4 倍数回合不压
  });

  it('🟡 长枪方阵·先手：掷平判 Boss 胜（他先手）→ 玩家少吃掷平那份胜率', () => {
    // 各自掷战力骰下·先手体现在「掷平如何归属」：无先手 → 掷平归玩家(默认)；有先手 → 掷平归 Boss。
    // 同战力(9v9) → 存在掷平概率 pEqual → 先手把这份胜率从玩家挪给 Boss → 玩家预报胜率严格更低（确定·可断言）。
    const eq = (x: TurnBattle): void => { x.lanes[0].a.push(u('a0', '9', 4)); x.lanes[0].b.push(u('b0', '9', 5)); };
    const bF = initTurnBattle({ seed: 5 }); bF.dishaB = { ...NO_DISHA, firstStrike: true }; eq(bF); // 仅先手·无胜率 edge
    const bN = initTurnBattle({ seed: 5 }); eq(bN);
    expect(clashOdds(bF, 0)!).toBeLessThan(clashOdds(bN, 0)!); // 先手 → 掷平判 Boss → 玩家胜率低一截(=pEqual)
  });

  it('🟡 死战不退：Boss 主将首负不亡·残喘退 1 格·战败 3 次才真死（关1 列奥尼达 3 命）', () => {
    const b = initTurnBattle({ seed: 2, disha: ['laststand'] });
    b.lanes[0].a.push(u('a0', 'A', 4, { buff: 24 })); // 玩家碾压
    b.lanes[0].b.push(u('b0', '3', 5, { general: true })); // Boss 弱主将
    activatePlayable(b); // 死战不退=可施放地煞·打出才生效
    endTurn(b); // 顺序回合：我方放完即推进→玩家胜→主将本应亡，但死战不退→残喘退格（此刻查·尚未轮到敌方反扑·owner ②）
    expect(b.bossGenDefeats).toBe(1); // 消耗第 1 命（3 命·首负不亡）
    expect(b.lanes[0].b.some((x) => x.id === 'b0')).toBe(true); // 仍在场
    expect(b.lanes[0].bGenDead).toBe(false); // 未判主将亡
  });

  it('🟢 死战不退·退格不撞兵·仍居最前（BUG#7 修）：整列后挤填空·一格一兵·不"看着退两格"+标记发作', () => {
    const b = initTurnBattle({ seed: 2, disha: ['laststand'] });
    b.lanes[0].a.push(u('a0', 'A', 4, { buff: 24 })); // 玩家碾压必胜
    b.lanes[0].b.push(u('b0', '3', 5, { general: true })); // Boss 弱主将(前锋·slot5)
    b.lanes[0].b.push(u('b1', '7', 6));                    // 身后紧贴一兵(slot6=主将退入格)
    activatePlayable(b); // 死战不退=可施放地煞·打出才生效（混合模型 bc1c8625）
    endTurn(b); // 顺序回合：玩家胜 → 主将首负不亡·退1格(撞 b1) → 整列后挤·主将仍最前（owner ②·我方推进即结算）
    const B = b.lanes[0].b;
    const slots = B.map((x) => x.slot);
    expect(new Set(slots).size).toBe(slots.length);            // 无两兵同 slot（不再被渲染 bySlot 覆盖吞牌）
    expect(B.some((x) => x.id === 'b0')).toBe(true);            // 主将仍在场
    expect(B.some((x) => x.id === 'b1')).toBe(true);            // 身后兵也没消失
    const b0 = B.find((x) => x.id === 'b0')!, b1 = B.find((x) => x.id === 'b1')!;
    expect(b0.slot).toBeLessThan(b1.slot);                     // 主将退后仍居本列最前(整列后挤·非与身后兵换位 → 不"看着退两格")
    expect(b.lastClash?.lastStand).toBe(true);                 // 标记死战不退发作 → 驱动全屏通知 + 特写改显"死战不退"
  });

  it('🟢 大军压境：Boss 回合开始多 +1 召唤源泉(免费多铺)·机动调度§六调 0', () => {
    const swarm = initTurnBattle({ seed: 1, disha: ['swarm'] }); swarm.lanes[0].a.push(u('a0', '7', 4)); // 给个兵免推进即胜
    endTurn(swarm); // 切到 Boss 回合
    expect(swarm.active).toBe('b'); expect(swarm.b.mana).toBe(MANA_START + 1); // ①起步 MANA_START + 大军压境 +1（turn-1 无基础回合 +）
    const plain = initTurnBattle({ seed: 1 }); plain.lanes[0].a.push(u('a0', '7', 4)); endTurn(plain);
    expect(plain.b.mana).toBe(MANA_START); // 仅 ①起步·turn-1 无基础回合 +
  });

  it('混合·可施放地煞（owner 2026-06-21）：开局进 Boss 手牌(非被动)·打出才并入 dishaB·AI 攒够 2 源泉择机打+返回 id', () => {
    // 可施放型不进开局 dishaB（被动型才进）；关5 三张全可施放 → 开局 dishaB 零修正、3 张在 Boss 手牌。
    const b = initTurnBattle({ seed: 5, disha: ['burnboats', 'overlord', 'winstreak'] });
    expect(b.dishaB).toEqual(NO_DISHA);
    expect(b.b.hand.filter((c) => c.kind === 'disha').length).toBe(3);
    expect(['burnboats', 'overlord', 'winstreak'].every((id) => DISHA_PLAYABLE.has(id))).toBe(true);
    // 手动打出一张 → 并入 dishaB（全军 +20%）
    b.active = 'b'; b.b.mana = 2;
    const idx = b.b.hand.findIndex((c) => c.kind === 'disha' && c.id === 'burnboats');
    expect(castDisha(b, 'b', idx)).toBe(true);
    expect(b.dishaCastIds).toContain('burnboats'); expect(b.dishaB.allWinPct).toBe(20); expect(b.dishaB.noRout).toBe(true);
    expect(b.b.mana).toBe(0); // 花了 2

    // 混合：被动型(温泉关 homeHp)仍开局生效；可施放型不动 homeB。
    const mix = initTurnBattle({ seed: 1, disha: ['thermopylae', 'phalanx', 'laststand'] });
    expect(mix.homeB).toBe(2); // 温泉关被动 homeHp 仍开局生效
    expect(mix.dishaB.phalanxPerAdj).toBe(0); // 方阵=可施放·未打出 → 不在 dishaB
    expect(mix.b.hand.filter((c) => c.kind === 'disha').map((c) => c.kind === 'disha' && c.id)).toEqual(['phalanx', 'laststand']);

    // AI：攒够 2 源泉 + 场上有兵 → 打出地煞，aiTakeTurn 返回打出的 id。
    const ai = initTurnBattle({ seed: 5, disha: ['mandate'] });
    ai.lanes[0].b.push(u('bx', '9', 5)); // 给 Boss 场上一个兵(地煞加成有受益对象)
    ai.active = 'b'; ai.b.mana = 3;
    const used = aiTakeTurn(ai);
    expect(used).toContain('mandate'); expect(ai.dishaB.allWinPct).toBe(5); // 挟天子 §六：10→5
  });

  it('确定性：无地煞 → 与基线行为一致（地煞不入 hash·dishaB 默认零修正）', () => {
    expect(aggregateDisha([])).toEqual(NO_DISHA);
    const b = initTurnBattle({ seed: 7 });
    expect(b.dishaB).toEqual(NO_DISHA); expect(b.homeB).toBe(3); expect(b.batteryLane).toBe(-1);
  });
});
