// turn-combat 单机回合制核（doc24 · A0 重构）：回合状态机 + 离散 9 格 slot 棋盘 + 互斥动作 + 推进/遭遇掷命(复用 clash-resolve) + 确定性 hash。
import { describe, it, expect } from 'vitest';
import { cardPoints } from './clash-resolve.js';
import { cardStamina } from './combat-types.js';
import {
  initTurnBattle, drawCard, deployUnit, castTengang, swapCard, endTurn, aiTakeTurn, turnHash, turnActive,
  unitPowerParts, REST_RECOVER_PM, SWAP_PER_TURN,
  MANA_START, A_DEPLOY_SLOT, A_GOAL, TURN_HOME_BLOOD, MORALE_SHOCK_PTS, MORALE_SHOCK_TURNS,
  type PokerCard, type TengangHandCard, type TurnUnit, type TurnBattle,
} from './turn-combat.js';

const poker = (id: string, rank: string, suit = 'S', buff = 0, general = false): PokerCard => ({ kind: 'poker', id, rank, suit, general, buff });
const tg = (id: string): TengangHandCard => ({ kind: 'tengang', id });
const unit = (id: string, rank: string, slot: number, buff = 0, general = false): TurnUnit =>
  ({ id, rank, suit: 'S', points: cardPoints(rank), buff, general, stamina: cardStamina(rank), staminaLeft: cardStamina(rank), slot });

describe('Game G · turn-combat（doc24 单机回合制 · A0 重构）', () => {
  it('init：A 先手·召唤源泉公平起步(双方 MANA_START·owner 2026-06-29 ①)·双方 3 血·空轨', () => {
    const b = initTurnBattle({ seed: 1 });
    expect(b.active).toBe('a'); expect(b.turn).toBe(1);
    expect(b.a.mana).toBe(MANA_START); expect(b.b.mana).toBe(MANA_START); // ①公平：双方都 MANA_START 起步
    expect(b.homeA).toBe(TURN_HOME_BLOOD); expect(b.homeB).toBe(TURN_HOME_BLOOD);
    expect(b.lanes.every((l) => l.a.length === 0 && l.b.length === 0)).toBe(true);
  });

  it('抽牌：花召唤源泉进手牌；召唤源泉不够停', () => {
    const b = initTurnBattle({ seed: 1, a: { pokerDeck: [poker('p0', '7'), poker('p1', '8')] } });
    b.a.mana = 1; // 强制只剩 1 点：抽一张后 mana=0 → 第二次抽失败
    expect(drawCard(b, 'a', 'poker')).toBe(true);
    expect(b.a.hand.length).toBe(1); expect(b.a.mana).toBe(0); expect(b.actionTaken).toBe('draw');
    expect(drawCard(b, 'a', 'poker')).toBe(false); // mana=0 → 源泉不足停
    expect(b.a.hand.length).toBe(1);
  });

  it('三行为自由（owner 2026-07-03）：抽/放/打天罡 一回合内任意混·只被源泉限制（大类互斥退役）', () => {
    const b = initTurnBattle({ seed: 1, a: { pokerDeck: [poker('p0', '7')] } });
    b.a.mana = 5; b.a.hand.push(poker('h0', 'K'));
    expect(drawCard(b, 'a', 'poker')).toBe(true);   // 抽（mana 5→4·actionTaken=draw）
    expect(b.a.mana).toBe(4);
    // ★ 新模型：抽完同回合还能放（旧模型此处 false·大类互斥锁死）——只要 mana≥cost。
    expect(deployUnit(b, 'a', 0, 0)).toBe(true);     // 放（测试用 poker 无 cost→免费·mana 不减）
    expect(b.lanes[0].a.length).toBe(1);
    // 放完还能接着施天罡（第三类·继续混）。
    b.a.hand.push(tg('hufu'));
    expect(castTengang(b, 'a', b.a.hand.length - 1)).toBe(true);
    expect(b.a.castIds).toContain('hufu');
    expect(b.a.mana).toBe(3);                        // 抽1 + 放0 + 施1 = 5−2 → 3（一回合混了三类）
  });

  it('换牌（owner 2026-07-03·SWAP_PER_TURN=1·免费·随机补·取代旧纯弃牌）', () => {
    const b = initTurnBattle({ seed: 1, a: { pokerDeck: [poker('deckA', '9'), poker('deckB', '10')] } });
    b.a.hand.push(poker('h0', '3'), poker('h1', 'K')); b.a.mana = 4;
    expect(b.a.swapsUsed).toBe(0);
    const handBefore = b.a.hand.length; const deckBefore = b.a.pokerDeck.length;
    expect(swapCard(b, 'a', 0, 'poker')).toBe(true);   // 换掉手里第0张(3) → 从库随机补1
    expect(b.a.hand.length).toBe(handBefore);          // 弃1补1·手牌数不变
    expect(b.a.pokerDeck.length).toBe(deckBefore - 1); // 库少1
    expect(b.a.hand.some((c) => c.id === 'h0')).toBe(false); // 原牌已弃
    expect(b.a.mana).toBe(4);                          // 免费(SWAP_COST=0)
    expect(b.a.swapsUsed).toBe(SWAP_PER_TURN);
    expect(swapCard(b, 'a', 0, 'poker')).toBe(false);  // 硬帽·本回合不能再换
    // 换牌不锁其它动作（非互斥）：换完还能放牌（费0·买得起）。
    expect(deployUnit(b, 'a', 0, 0)).toBe(true);
    // 回合切换后 swapsUsed 重置：a 结束 → b 回合 → b 结束回 a。
    endTurn(b);                                         // a 推进 → 轮到 b
    if (b.winner === 'pending') aiTakeTurn(b);          // b 决策+推进 → 回 a·turn+1·重置 a.swapsUsed
    if (b.winner === 'pending' && b.active === 'a') expect(b.a.swapsUsed).toBe(0);
  });

  it('放牌：扑克兵上场到放牌区(贴家)·免费·有牌可一直放（机关门已退役·owner 2026-07-03）', () => {
    const b = initTurnBattle({ seed: 1 }); b.a.mana = 2; b.a.hand.push(poker('h0', 'Q'), poker('h1', 'K'), poker('h2', '7'));
    expect(deployUnit(b, 'a', 0, 1)).toBe(true);
    expect(b.lanes[1].a.length).toBe(1);
    expect(b.lanes[1].a[0].slot).toBe(A_DEPLOY_SLOT); // 队首在放牌区前沿(贴家3格之首)
    expect(b.a.mana).toBe(2);                        // 放牌免费·召唤源泉不减(owner 2026-06-20)
    expect(deployUnit(b, 'a', 0, 1)).toBe(true);     // 第二张照样放（同回合·无数张·只要有牌）
    expect(deployUnit(b, 'a', 0, 1)).toBe(true);     // 第三张
    expect(b.lanes[1].a.length).toBe(3); expect(b.a.mana).toBe(2); // 三张全上·源泉仍 2
    expect(b.actionTaken).toBe('deploy');
    expect(turnActive(b)).toBe(true);                // 场上有兵 → 未决
  });

  it('机关门整套退役（owner 2026-07-03）：turnHash 不含 g 段·deployUnit 无 gateToggle', () => {
    const b = initTurnBattle({ seed: 1 });
    expect(turnHash(b)).not.toContain('|g');         // 门态已从 hash 删除
    expect('gatesOpen' in b).toBe(false);            // TurnBattle 不再有 gatesOpen 状态
  });

  it('顺序回合：我放完→我方立即推进/攻击；敌放完→敌方推进（owner 2026-06-29 ②·替同步推进）', () => {
    const b = initTurnBattle({ seed: 1 });
    b.lanes[0].a.push(unit('a0', '7', A_DEPLOY_SLOT)); // 我方兵在部署格
    endTurn(b); // 我方结束 → 我方推进一格（不再等敌方回合·owner ②）
    expect(b.lanes[0].a[0].slot).toBe(A_DEPLOY_SLOT + 1); // 我方放完即推进
    expect(b.active).toBe('b'); expect(b.b.mana).toBe(MANA_START); // 切敌方·turn-1 不额外 +源泉（①公平起步）
    expect(b.turn).toBe(1); // 尚未进下一轮
    endTurn(b); // 敌方结束 → 敌方推进（本例敌方无兵·我方兵不再动）
    expect(b.lanes[0].a[0].slot).toBe(A_DEPLOY_SLOT + 1); // 敌方回合我方兵不动（只推敌方）
    expect(b.active).toBe('a'); expect(b.turn).toBe(2); // 回我方放置·回合数 +1
  });

  it('攻方胜 → 占据阵亡敌兵腾出的格 / 守方胜 → 守原位（owner 2026-07-06·攻守定去留）', () => {
    // 攻方占位：a(行动方) 强兵 A@2 撞 弱敌 2@3 → a 胜 → a 前进占据 slot3。
    const atk = initTurnBattle({ seed: 1 });
    atk.lanes[0].a.push(unit('a0', 'A', A_DEPLOY_SLOT + 2));      // pEff 14
    atk.lanes[0].b.push(unit('b0', '2', A_DEPLOY_SLOT + 3, -1));  // pEff 1·敌前锋相邻
    endTurn(atk); // a 行动相：a0 推进撞 b0 → a 胜
    expect(atk.lastClash?.aWins).toBe(true);
    expect(atk.lanes[0].b.length).toBe(0);                        // 敌阵亡
    expect(atk.lanes[0].a[0].slot).toBe(A_DEPLOY_SLOT + 3);       // 攻方胜 → 占据敌腾出的格

    // 守方守原位：a(行动方) 弱兵撞强敌 → a 亡·b 是守方胜 → 不占 a 的格、守原位。
    const def = initTurnBattle({ seed: 1 });
    def.lanes[0].a.push(unit('a1', '2', A_DEPLOY_SLOT + 2, -1));  // pEff 1
    def.lanes[0].b.push(unit('b1', 'A', A_DEPLOY_SLOT + 3));      // pEff 14·敌前锋相邻
    endTurn(def); // a 行动相：a1 撞 b1 → a 败
    expect(def.lastClash?.aWins).toBe(false);
    expect(def.lanes[0].a.length).toBe(0);                        // 攻方 a 阵亡
    expect(def.lanes[0].b[0].slot).toBe(A_DEPLOY_SLOT + 3);       // 守方 b 胜 → 守原位(未前压占格)
  });

  it('无敌路推进到底 → 敌大本营 −1 血、该兵退场', () => {
    const b = initTurnBattle({ seed: 1 });
    b.lanes[0].a.push(unit('a0', '7', A_DEPLOY_SLOT));
    let guard = 0;
    while (b.homeB === TURN_HOME_BLOOD && guard++ < 40) endTurn(b); // 反复推进直到抵敌家
    expect(b.homeB).toBe(TURN_HOME_BLOOD - 1);
    expect(b.lanes[0].a.length).toBe(0); // 抵家后退场
  });

  it('相邻遭遇 → 各自掷战力骰对决；掷平(战力都为1·必同掷) → 战力相等按点数大者胜(确定裁定)', () => {
    const b = initTurnBattle({ seed: 1 });
    // 双方 pEff 都压到 1（掷骰恒 1→必掷平）→ 走掷平阶梯：战力相等 → 点数大者(K 13 > 5)胜 → A 阵亡。
    b.lanes[0].a.push(unit('a0', '5', A_DEPLOY_SLOT, -4));      // 5−4 = pEff 1
    b.lanes[0].b.push(unit('b0', 'K', A_DEPLOY_SLOT + 2, -12)); // K(13)−12 = pEff 1·敌前锋 2 格外
    endTurn(b); endTurn(b); // 行动阶段：两军逼近 → 相邻 → 各自掷战力骰（都掷 1 → 平）
    expect(b.clashSeq).toBe(1);
    expect(b.lastClash?.tie).toBe('points'); // 掷平 → 战力相等 → 点数裁定
    expect(b.lastClash?.aWins).toBe(false);
    expect(b.lanes[0].a.length).toBe(0); // A 输 → 阵亡
    expect(b.lanes[0].b.length).toBe(1); // B 胜 → 留场续战（连胜 1 < WIN_CAP·winStays true）
    expect(b.lastClash?.winStays).toBe(true);
  });

  it('unitPowerParts(⑥ 战力来源透明)：任意兵拆解 = 点数 + 经营 + 士气，且各源恰好加到 pEff', () => {
    const b = initTurnBattle({ seed: 1 });
    // 同路：主将 K + 下属兵 7(+3 经营)。下属应吃主将坐镇士气 +2(MORALE_PTS)。
    b.lanes[0].a.push(unit('gen', 'K', A_DEPLOY_SLOT, 0, true), unit('a0', '7', A_DEPLOY_SLOT + 1, 3));
    const sub = b.lanes[0].a.find((u) => u.id === 'a0')!;
    const parts = unitPowerParts(b, 'a', 0, sub);
    expect(parts.points).toBe(cardPoints('7'));
    expect(parts.buff).toBe(3);          // 经营
    expect(parts.morale).toBe(2);        // 主将坐镇 → 士气 +2
    expect(parts.tengang).toBe(0);       // 无天罡
    expect(parts.pEff).toBe(cardPoints('7') + 3 + 2); // 各源之和 = 有效战力（无封顶/倍率）
    // 主将本人不吃士气（effPower general 分支 shift 0）
    const gen = b.lanes[0].a.find((u) => u.id === 'gen')!;
    expect(unitPowerParts(b, 'a', 0, gen).morale).toBe(0);
  });

  it('士气 v2(主将阵亡·临时震荡)：当时在场兵 −N 线性衰减·N回合归0 / 新兵免疫 / 不永久', () => {
    const b = initTurnBattle({ seed: 1 });
    b.lanes[0].aGenDead = true; // 主将已亡（该路）
    const deathTurn = b.turn;   // =1
    const until = deathTurn + MORALE_SHOCK_TURNS;
    // 当时在场兵：盖震荡到期回合 until；新兵：无 moraleShock 字段 → 免疫。
    const veteran: TurnUnit = { ...unit('vet', '9', A_DEPLOY_SLOT), moraleShock: until };
    const rookie = unit('new', '9', A_DEPLOY_SLOT + 1); // 阵亡后新部署·无字段
    b.lanes[0].a.push(veteran, rookie);
    // ① 阵亡当回合：老兵满档 −N；新兵 0（免疫）。
    expect(unitPowerParts(b, 'a', 0, veteran).morale).toBe(-MORALE_SHOCK_PTS);
    expect(unitPowerParts(b, 'a', 0, rookie).morale).toBe(0);
    // ② 逐回合线性衰减·始终朝 0 收（不永久）。
    let prev = -MORALE_SHOCK_PTS;
    for (let t = deathTurn + 1; t < until; t++) {
      b.turn = t;
      const m = unitPowerParts(b, 'a', 0, veteran).morale;
      expect(m).toBeGreaterThan(prev); // 越来越轻（趋 0）
      expect(m).toBeLessThan(0);       // 尚未归零
      expect(unitPowerParts(b, 'a', 0, rookie).morale).toBe(0); // 新兵恒免疫
      prev = m;
    }
    // ③ 第 N 回合：归 0（震荡散尽·死亡螺旋被斩断）。
    b.turn = until;
    expect(unitPowerParts(b, 'a', 0, veteran).morale).toBe(0);
  });

  it('判负：大本营血归 0 → 该方负', () => {
    const b = initTurnBattle({ seed: 1, homeMax: 1 });
    b.lanes[0].a.push(unit('a0', 'A', A_GOAL)); // 已在敌区末格 → 下次推进越线破家
    let guard = 0;
    while (b.winner === 'pending' && guard++ < 10) endTurn(b);
    expect(b.homeB).toBe(0); expect(b.winner).toBe('a');
  });

  it('确定性：同 seed + 同脚本 → 逐回合 turnHash 完全一致；掷命真消费 rng（复用 clash 核）', () => {
    const run = (seed: number): { hashes: string[]; clashSeq: number } => {
      const b = initTurnBattle({
        seed,
        a: { pokerDeck: [poker('a0', '9'), poker('a1', 'J'), poker('a2', '6')] },
        b: { pokerDeck: [poker('z0', '8'), poker('z1', 'Q'), poker('z2', '4')] },
      });
      const hashes: string[] = [turnHash(b)];
      let guard = 0;
      while (turnActive(b) && b.winner === 'pending' && guard++ < 200) {
        if (b.active === 'a') {
          const pi = b.a.hand.findIndex((c) => c.kind === 'poker');
          if (pi >= 0 && b.a.mana >= 1 && b.actionTaken === null) deployUnit(b, 'a', pi, guard % 3);
          else if (b.a.mana >= 1 && b.actionTaken === null && b.a.pokerDeck.length) drawCard(b, 'a', 'poker');
          endTurn(b);
        } else {
          aiTakeTurn(b);
        }
        hashes.push(turnHash(b));
      }
      return { hashes, clashSeq: b.clashSeq };
    };
    const r1 = run(20), r2 = run(20);
    expect(r1.hashes).toEqual(r2.hashes);     // 逐回合 hash 完全一致（确定性 · 同输入同 seed 可回放）
    expect(r1.clashSeq).toBeGreaterThan(0);   // 掷命真发生过 → rng 真消费、clash 核真被复用
  });

  it('castTengang：天罡进 castIds + 花召唤源泉（持续修正由 caller 经 aggregateTengang 重算）', () => {
    const b = initTurnBattle({ seed: 1 }); b.a.mana = 2; b.a.hand.push(tg('hufu'));
    expect(castTengang(b, 'a', 0)).toBe(true);
    expect(b.a.castIds).toEqual(['hufu']); expect(b.a.mana).toBe(1); expect(b.actionTaken).toBe('cast');
  });

  it('放置不可落在已占格（敌我皆不可·owner 2026-06-21）', () => {
    const b = initTurnBattle({ seed: 1 });
    b.lanes[0].b.push(unit('e', '7', A_DEPLOY_SLOT)); // 敌兵深入我放牌区 slot 0
    b.a.hand.push(poker('h0', '7'));
    expect(deployUnit(b, 'a', 0, 0)).toBe(true);
    expect(b.lanes[0].a[0].slot).toBe(A_DEPLOY_SLOT + 1); // 跳过被敌占的 0 → 落 1
    // 放牌区 3 格全被敌占 → 拒绝
    const c = initTurnBattle({ seed: 1 });
    c.lanes[0].b.push(unit('e0', '7', A_DEPLOY_SLOT), unit('e1', '7', A_DEPLOY_SLOT + 1), unit('e2', '7', A_DEPLOY_SLOT + 2));
    c.a.hand.push(poker('h0', '7'));
    expect(deployUnit(c, 'a', 0, 0)).toBe(false); // 无空格 → 拒
  });

  it('确定制胜者留场 + 每胜累加疲劳（owner 2026-07-06 连续疲劳条·胜者不退场继续作战·有效战力对折）', () => {
    const b = initTurnBattle({ seed: 1 }); b.a.mana = 0;
    const w = unit('w', 'A', A_DEPLOY_SLOT); w.cost = 3; // A=14 点
    b.lanes[0].a.push(w);
    b.lanes[0].b.push(unit('lz', '2', A_DEPLOY_SLOT + 1, -1)); // 2−1=pEff1 → 敌恒掷 1；w=A(14)掷[1,14]≥1·掷平也按战力 14>1 判 w → w 必胜(确定)
    const before = unitPowerParts(b, 'a', 0, w).pEff;           // 对折前有效战力 = 14
    endTurn(b); // 我方推进 → 各自掷战力骰 → w 胜
    expect(b.lastClash?.aWins).toBe(true);
    expect(b.lanes[0].a.some((c) => c.id === 'w')).toBe(true);   // 胜者留场（不退场·战场不空）
    expect(w.wins).toBe(1);                                      // 累计胜 +1
    expect(w.fatiguePm).toBe(500);                               // 疲劳 0 → 0+round(1000×0.5)=500
    expect(unitPowerParts(b, 'a', 0, w).pEff).toBe(Math.floor(before * 0.5)); // 有效战力对折（14→7）·w 本轮参战 → 不休整回血
    expect(b.lastClash?.warLoss).toBe(0.5);                      // 本场对折率 50%
    expect(b.lastClash?.fatiguePm).toBe(500);                    // 事件带胜者累计疲劳（供 UI 显/恢复回看）
    expect(b.lastClash?.winStays).toBe(true);                    // 恒留场（无自动退场·owner 2026-07-06 光荣回库已删）
  });

  it('连胜多场无自动退场（owner 2026-07-06「没必要退场·满3光荣回库删掉」）：疲劳累加·始终留场不回库', () => {
    const b = initTurnBattle({ seed: 1 }); b.a.mana = 0;
    const w = unit('w', 'A', A_DEPLOY_SLOT); w.cost = 3; w.wins = 2; w.fatiguePm = 750; // 已胜 2 场（疲劳 750）·本场达成第 3 胜
    b.lanes[0].a.push(w);
    b.lanes[0].b.push(unit('lz', '2', A_DEPLOY_SLOT + 1, -1)); // pEff1·恒负 → w 必胜
    endTurn(b);
    expect(b.lastClash?.aWins).toBe(true);
    expect(b.lanes[0].a.some((c) => c.id === 'w')).toBe(true);   // **始终留场**（无 WIN_CAP 退场·连胜 3 场照样在场）
    expect(b.a.pokerDeck.some((c) => c.id === 'w')).toBe(false); // 不回牌库
    expect(w.fatiguePm).toBe(875);                              // 750 + round(250×0.5)=875（疲劳继续累加·渐近满）
    expect(b.lastClash?.winStays).toBe(true);                   // 恒留场
  });

  it('休整回血（owner 2026-07-06·P20「本轮不战斗恢复10%」）：在场兵本轮无 clash → 疲劳回落 REST_RECOVER_PM，夹≥0', () => {
    const b = initTurnBattle({ seed: 1 }); b.a.mana = 0;
    const rest = unit('r', 'A', 3); rest.fatiguePm = 500; // 疲劳兵·本路无敌 → 只推进不战
    b.lanes[0].a.push(rest);
    endTurn(b); // 我方行动·rest 推进但无遭遇 → 休整回血
    expect(b.clashSeq).toBe(0);                                 // 本轮没打
    expect(rest.fatiguePm).toBe(500 - REST_RECOVER_PM);        // 回落一档（500→400）
    // 连歇多轮回到满血（夹≥0·回不到负）
    for (let k = 0; k < 6 && b.winner === 'pending'; k++) { b.active = 'a'; if (b.lanes[0].a[0]) b.lanes[0].a[0].slot = 3; endTurn(b); }
    expect(b.lanes[0].a[0] ? (b.lanes[0].a[0].fatiguePm ?? 0) : 0).toBe(0); // 多轮休整 → 疲劳清零（满血）
  });

  it('碰撞才战斗 + 攻方胜占据腾出格(owner 2026-07-06 攻守定去留·替 07-04 一律守原位)：落点空只走位·踩到敌才打·攻方赢了前进占腾出格', () => {
    const b = initTurnBattle({ seed: 1, startFormation: [{ rank: '2', suit: 'S', lane: 0, slot: 6, buff: -1 }] }); // 敌守军 2@6·pEff1(恒掷1·必负)
    b.lanes[0].a.push(unit('p', 'A', 3)); // 玩家 A@3·pEff14·speed1·必胜
    b.active = 'a'; endTurn(b); // 3→落点4(空) → 不打·只走位
    expect(b.clashSeq).toBe(0); expect(b.lanes[0].a[0].slot).toBe(4);
    b.active = 'a'; endTurn(b); // 4→落点5(空) → 不打
    expect(b.clashSeq).toBe(0); expect(b.lanes[0].a[0].slot).toBe(5);
    b.active = 'a'; endTurn(b); // 5→落点6(敌!) → 碰撞才战 → A(攻方) 必胜 → 守军亡 → A **前进占据 6**(owner 2026-07-06 攻方占位)
    expect(b.clashSeq).toBe(1); expect(b.lastClash?.aWins).toBe(true);
    expect(b.lanes[0].b.length).toBe(0);   // 守军阵亡
    expect(b.lanes[0].a[0].slot).toBe(6);  // 攻方胜 → 占据敌腾出的格(6)·非停 5
    b.active = 'a'; endTurn(b);            // 下回合无敌 → 继续行军 6→7
    expect(b.lanes[0].a[0].slot).toBe(7);
  });

  it('源泉封顶 10（owner 2026-07-04·防无处可花累积溢出到 15）', () => {
    const b = initTurnBattle({ seed: 5 });                       // 空场·双方无兵 → 不消耗源泉
    for (let i = 0; i < 40 && b.winner === 'pending'; i++) endTurn(b); // 空跑多回合·源泉本会一路涨
    expect(b.a.mana).toBeLessThanOrEqual(10); expect(b.b.mana).toBeLessThanOrEqual(10); // 封顶
    expect(Math.max(b.a.mana, b.b.mana)).toBe(10);              // 确实涨到了上限(证封顶生效而非没涨)
  });

  it('突深边角回归(REQ-G-突深边角)：玩家突深贴敌家·敌新兵落身后 → 敌移动不反向传送/不越界', () => {
    const b = initTurnBattle({ seed: 5 });
    b.lanes[0].a = [unit('as', 'A', 7)];                                 // 玩家突深单兵 @7(贴敌家8)
    b.lanes[0].b = [unit('6s', '6', 6), unit('7s', '7', 8)];             // 敌(b 升序·前锋=最低格)：6S@6(落我身后·突穿侧) + 7S@8(近家)
    b.active = 'b'; endTurn(b);                                          // 敌行动一次
    for (const u of b.lanes[0].b) { expect(u.slot).toBeGreaterThanOrEqual(0); expect(u.slot).toBeLessThan(9); } // 无越界(slot 9 不存在·SLOTS=9)
    const s6 = b.lanes[0].b.find((u) => u.id === '6s');
    expect(s6 && s6.slot <= 6).toBe(true);                              // 突穿侧兵不被反向顶回敌家(→8)·应朝敌家0方向推进(≤6)
  });

  it('开局排阵守军(REQ-G-开局排阵)：明牌摆兵 + 静守（不前压/不冲家/接触才战）', () => {
    const b = initTurnBattle({ seed: 1, startFormation: [{ rank: '8', suit: 'S', lane: 0, slot: 8 }, { rank: '9', suit: 'H', lane: 2, slot: 7 }] });
    expect(b.lanes[0].b.some((u) => u.slot === 8 && u.hold)).toBe(true); // 上路 slot8 守军·hold
    expect(b.lanes[2].b.some((u) => u.slot === 7 && u.hold)).toBe(true); // 下路 slot7 守军·hold
    expect(b.lanes[1].b.length).toBe(0);                                 // 中路无守军
    // 敌方行动：守军静守 → 不前压(原 slot 不变) + 不自动冲家(我家不掉血)
    const held = b.lanes[0].b.find((u) => u.hold)!; const before = held.slot; const homeA0 = b.homeA;
    b.active = 'b'; endTurn(b);
    expect(b.lanes[0].b.find((u) => u.hold)?.slot).toBe(before); // 不前压·原地守
    expect(b.homeA).toBe(homeA0);                                // 不自动冲家·我家没掉血
    // 接触才战：玩家兵推到守军 → 正常掷命
    const c = initTurnBattle({ seed: 2, startFormation: [{ rank: '8', suit: 'S', lane: 0, slot: 8 }] });
    c.lanes[0].a.push(unit('p', '9', A_DEPLOY_SLOT));
    for (let k = 0; k < 8 && c.clashSeq === 0 && c.winner === 'pending'; k++) { c.active = 'a'; endTurn(c); }
    expect(c.clashSeq).toBeGreaterThan(0); // 玩家推到守军相邻 → 接触才战
  });
});
