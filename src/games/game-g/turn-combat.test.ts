// turn-combat 单机回合制核（doc24 · A0 重构）：回合状态机 + 离散 9 格 slot 棋盘 + 互斥动作 + 推进/遭遇掷命(复用 clash-resolve) + 确定性 hash。
import { describe, it, expect } from 'vitest';
import { cardPoints } from './clash-resolve.js';
import { cardStamina } from './combat-types.js';
import {
  initTurnBattle, drawCard, deployUnit, castTengang, discardCard, endTurn, aiTakeTurn, turnHash, turnActive,
  toggleGate, tryGate, GATES, unitPowerParts, WIN_CAP,
  MANA_START, A_DEPLOY_SLOT, A_GOAL, TURN_HOME_BLOOD,
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

  it('互斥：抽/放/打天罡 三类互斥（抽后不能放）；弃牌不互斥 + 返 0.5 源泉（owner 2026-06-21）', () => {
    const b = initTurnBattle({ seed: 1, a: { pokerDeck: [poker('p0', '7')] } });
    b.a.mana = 5; b.a.hand.push(poker('h0', 'K'));
    expect(drawCard(b, 'a', 'poker')).toBe(true);   // 选了"抽"
    expect(deployUnit(b, 'a', 1, 0)).toBe(false);   // 同回合不能再"放"(互斥)
    // 弃牌：不互斥·返 0.5 源泉·弃完还能抽
    const c = initTurnBattle({ seed: 1, a: { pokerDeck: [poker('p1', '8')] } }); c.a.hand.push(poker('h0', 'K'), poker('h1', '3')); c.a.mana = 1;
    expect(discardCard(c, 'a', 0)).toBe(true);
    expect(c.a.mana).toBe(1.5);                     // 返 0.5 源泉
    expect(c.a.hand.length).toBe(1); expect(c.actionTaken).toBe(null); // 不锁动作(不互斥)
    expect(drawCard(c, 'a', 'poker')).toBe(true);   // 弃完还能抽(不互斥)
  });

  it('放牌：扑克兵上场到放牌区(贴家)·免费·有牌可一直放；放牌可顺手翻门(闭↔开)', () => {
    const b = initTurnBattle({ seed: 1 }); b.a.mana = 2; b.a.hand.push(poker('h0', 'Q'), poker('h1', 'K'), poker('h2', '7'));
    expect(b.gatesOpen[0]).toBe(false);              // 默认闭 ✕
    expect(deployUnit(b, 'a', 0, 1, 0)).toBe(true);  // gateToggle=0 → 顺手翻 0 号捷径门
    expect(b.lanes[1].a.length).toBe(1);
    expect(b.lanes[1].a[0].slot).toBe(A_DEPLOY_SLOT); // 队首在放牌区前沿(贴家3格之首)
    expect(b.gatesOpen[0]).toBe(true);               // 翻成 ◉(通路)
    expect(b.a.mana).toBe(2);                        // 放牌免费·召唤源泉不减(owner 2026-06-20)
    expect(deployUnit(b, 'a', 0, 1)).toBe(true);     // 第二张照样放（同回合·无数张·只要有牌）
    expect(deployUnit(b, 'a', 0, 1)).toBe(true);     // 第三张
    expect(b.lanes[1].a.length).toBe(3); expect(b.a.mana).toBe(2); // 三张全上·源泉仍 2
    expect(b.actionTaken).toBe('deploy');
    expect(turnActive(b)).toBe(true);                // 场上有兵 → 未决
  });

  it('捷径门：8 门定向·默认全闭(✕)；toggleGate ✕↔通路；门开+源格有兵+目标空 → tryGate 过门跨路；目标占→失败', () => {
    expect(GATES.length).toBe(8); // 我方 4 + 敌方镜像 4
    const b = initTurnBattle({ seed: 1 });
    expect(b.gatesOpen.every((o) => o === false)).toBe(true); // 默认全闭(owner 拍板)
    expect(turnHash(b)).toContain('|g00000000|');    // 门态进 hash（确定性回放）
    // GATES[0]：side a · 上路(0) slot1 → 中路(1) slot2
    expect(tryGate(b, 0)).toBe(false);               // 闭 → 不可过
    expect(toggleGate(b, 0)).toBe(true); expect(b.gatesOpen[0]).toBe(true); // 翻通路 ◉
    expect(tryGate(b, 0)).toBe(false);               // 门开但源格无兵 → 不可过
    b.lanes[0].a.push(unit('a0', '7', 1));           // 源格(上路 slot1)放一兵
    expect(tryGate(b, 0)).toBe(true);                // 过门
    expect(b.lanes[0].a.length).toBe(0);             // 离开上路
    expect(b.lanes[1].a.some((u) => u.slot === 2 && u.id === 'a0')).toBe(true); // 抵中路 slot2
    b.lanes[0].a.push(unit('a1', '8', 1));           // 再来一兵
    expect(tryGate(b, 0)).toBe(false);               // 目标格已被 a0 占 → 失败
    expect(b.lanes[0].a.length).toBe(1);             // a1 留原地
  });

  it('开关门·下一步移动：开门后推进阶段把源格己兵按门向过门到目标格(目标占则失败)', () => {
    const b = initTurnBattle({ seed: 1 }); // 默认全闭
    // GATES[2]：中路(1) slot3 → 上路(0) slot4。源格放一兵 + 开门 → endTurn 推进时过门。
    b.lanes[1].a.push(unit('m0', '7', 3));
    endTurn(b); endTurn(b); // 走完放置 → 行动阶段；门闭 → 不过门，正常直进
    expect(b.lanes[1].a.some((u) => u.id === 'm0')).toBe(true); // 还在中路
    const c = initTurnBattle({ seed: 1 });
    c.lanes[1].a.push(unit('m0', '7', 3));
    expect(toggleGate(c, 2)).toBe(true);             // 开 GATES[2]
    endTurn(c); endTurn(c);                          // 行动阶段过门
    expect(c.lanes[1].a.length).toBe(0);             // 离开中路
    expect(c.lanes[0].a.some((u) => u.id === 'm0' && u.slot === 4)).toBe(true); // 过门抵上路 slot4
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

  it('无敌路推进到底 → 敌大本营 −1 血、该兵退场', () => {
    const b = initTurnBattle({ seed: 1 });
    b.lanes[0].a.push(unit('a0', '7', A_DEPLOY_SLOT));
    let guard = 0;
    while (b.homeB === TURN_HOME_BLOOD && guard++ < 40) endTurn(b); // 反复推进直到抵敌家
    expect(b.homeB).toBe(TURN_HOME_BLOOD - 1);
    expect(b.lanes[0].a.length).toBe(0); // 抵家后退场
  });

  it('相邻遭遇 → 掷命对决（复用 clash-resolve）；战力相等按点数大者胜(确定性)', () => {
    const b = initTurnBattle({ seed: 1 });
    // A: 5 点 +9 buff = pEff 14；B: K(13) +1 buff = pEff 14 → 平 → 点数大者(K 13 > 5)胜 → A 阵亡。
    b.lanes[0].a.push(unit('a0', '5', A_DEPLOY_SLOT, 9));
    b.lanes[0].b.push(unit('b0', 'K', A_DEPLOY_SLOT + 2, 1)); // 敌前锋 2 格外
    endTurn(b); endTurn(b); // 行动阶段：两军逼近 → 相邻 → 掷命
    expect(b.clashSeq).toBe(1);
    expect(b.lastClash?.tie).toBe('points');
    expect(b.lastClash?.aWins).toBe(false);
    expect(b.lanes[0].a.length).toBe(0); // A 输 → 阵亡
    // B 胜 → 战胜硬币定去留：人头留场 / 人面回牌库（owner 2026-06-21）
    if (b.lastClash?.winStays) expect(b.lanes[0].b.length).toBe(1); // 人头 → 留场
    else { expect(b.lanes[0].b.length).toBe(0); expect(b.b.pokerDeck.some((c) => c.id === 'b0')).toBe(true); } // 人面 → 回库
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

  it('v2 胜者留场 + 每胜战损疲劳（owner 2026-06-29·替战胜硬币·胜者不回库继续作战）', () => {
    const b = initTurnBattle({ seed: 1 }); b.a.mana = 0;
    const w = unit('w', 'A', A_DEPLOY_SLOT); w.cost = 3; // A=14 点
    b.lanes[0].a.push(w);
    b.lanes[0].b.push(unit('lz', '2', A_DEPLOY_SLOT + 1, 12)); // 2+12=pEff14 → 点数 A(14)>2 → A 必胜(确定)
    endTurn(b); // 我方推进 → 掷命 → w 胜
    expect(b.lastClash?.aWins).toBe(true);
    expect(b.lanes[0].a.some((c) => c.id === 'w')).toBe(true);   // 胜者留场（不回库·战场不空）
    expect(w.fatigue ?? 0).toBeGreaterThan(0);                   // 每胜累加战损疲劳
    expect(w.wins).toBe(1);
    expect(b.lastClash?.winStays).toBe(true);                    // 未满连胜上限 → 留场
  });

  it('v2 连胜满 WIN_CAP → 光荣回库 + 全额返还泉水（owner 2026-06-29·防强兵无限霸场）', () => {
    const b = initTurnBattle({ seed: 1 }); b.a.mana = 0;
    const w = unit('w', 'A', A_DEPLOY_SLOT); w.cost = 3; w.wins = WIN_CAP - 1; // 已差一场满上限·本场达成
    b.lanes[0].a.push(w);
    b.lanes[0].b.push(unit('lz', '2', A_DEPLOY_SLOT + 1, 12));
    endTurn(b);
    expect(b.lastClash?.aWins).toBe(true);
    expect(b.lanes[0].a.some((c) => c.id === 'w')).toBe(false);  // 满 WIN_CAP → 离场
    expect(b.a.pokerDeck.some((c) => c.id === 'w')).toBe(true);  // 回牌库
    expect(b.a.mana).toBe(3);                                    // 全额返还 cost 3（turn 仍 1·我方本轮无新增）
    expect(b.lastClash?.winStays).toBe(false);                   // 离场 → UI 演光荣回库
  });
});
