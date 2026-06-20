// disha.ts —— 地煞（Boss 招牌历史战术·明牌可破）数据 + 聚合（doc23 §八 · owner 2026-06-19 派甲逐个实装）。
// 纯数据「固定解释器」入参：每张地煞 = {kind 借天罡词汇 + 数值}，按关聚合成 DishaFx 喂 turn-combat 在 Boss(side b) 侧 apply。
// 难易 triage（design G）：🟢易=复用现成胜率/buff · 🟡中=新 hook game-side · 🔴难=给简化兜底（伙伴骑兵/连环船/机动调度）。
// 与 live-combat TengangFx 同构：disha.ts 只定义数据 + 纯聚合，turn-combat import 类型 + 在掷命/推进/大本营 apply（无环依赖）。

// Boss 侧战斗修正聚合（一关 3 张地煞 → 一个 DishaFx）。winPct 字段 = 加到 Boss 掷命胜率的百分点（玩家视角 wr 相应下调）。
export interface DishaFx {
  allWinPct: number;        // 挟天子/破釜沉舟：Boss 全军 +X% 胜率
  generalWinPct: number;    // 霸王之勇/伙伴骑兵(简化)：Boss 主将那张 +X%
  phalanxPerAdj: number;    // 斯巴达方阵/连环船(简化)：每相邻己兵 +X%
  phalanxCap: number;       // 方阵封顶
  phalanxAdj8: boolean;     // true=8 邻(方阵) / false=同路相邻(连环船)
  nearBaseSlots: number;    // 温泉关死守：自家大本营前 N 格(隘口)
  nearBaseWinPct: number;   // 隘口内 +X%
  eliteMidWinPct: number;   // 近卫军(简化)：中路 Boss 前锋 +X%
  flankYouWinPct: number;   // 锤砧：你被左右夹 → 你 −X%（存正·apply 时减你胜率）
  firstStrike: boolean;     // 长枪方阵：前锋先手（平局判 Boss 胜）
  firstStrikeWinPct: number;// + 先手胜率
  winStreakPer: number;     // 九战九捷：Boss 每胜一场 +X%
  winStreakCap: number;     // 连胜封顶
  noRout: boolean;          // 破釜沉舟/死战不退：Boss 主将亡不溃散
  lastStandGeneral: boolean;// 死战不退：Boss 主将 2 命（首负残喘退 1 格·不亡）
  bonusMana: number;        // 大军压境(免费多铺)+机动调度(额外动作) 简化：Boss 回合开始多 N 召唤源泉
  batteryEveryTurns: number;// 大炮兵：每 N 回合压你一路
  batteryWinPct: number;    // 被压一路 −X%
  homeHp: number;           // 温泉关死守：Boss 大本营血（0=默认 3）
}

export const NO_DISHA: DishaFx = {
  allWinPct: 0, generalWinPct: 0, phalanxPerAdj: 0, phalanxCap: 0, phalanxAdj8: false,
  nearBaseSlots: 0, nearBaseWinPct: 0, eliteMidWinPct: 0, flankYouWinPct: 0,
  firstStrike: false, firstStrikeWinPct: 0, winStreakPer: 0, winStreakCap: 0,
  noRout: false, lastStandGeneral: false, bonusMana: 0, batteryEveryTurns: 0, batteryWinPct: 0, homeHp: 0,
};

// 关 1-5 共 15 张地煞精确数值（doc23 §八·★ 弱版起·sim 真机调）。每张 = Partial<DishaFx> 贡献。
export const DISHA_SPECS: Record<string, Partial<DishaFx>> = {
  // 关 1 · 列奥尼达 · 温泉关（★ ~80%）
  thermopylae: { homeHp: 4, nearBaseSlots: 2, nearBaseWinPct: 15 }, // 温泉关死守：4 血 + 隘口 +15%
  phalanx: { phalanxPerAdj: 6, phalanxCap: 24, phalanxAdj8: true }, // 斯巴达方阵：8 邻每邻 +6%·封顶 +24%
  laststand: { lastStandGeneral: true },                            // 死战不退：主将 2 命（仅主将·关1）
  // 关 2 · 亚历山大 · 高加米拉（★★ ~70%）
  companion: { generalWinPct: 20 },                                 // 伙伴骑兵(简化)：主将 +20%（不做跳格直击）
  hammeranvil: { flankYouWinPct: 15 },                             // 锤砧：你被左右夹 −15%
  sarissa: { firstStrike: true, firstStrikeWinPct: 10 },          // 长枪方阵：先手 + 10%
  // 关 3 · 曹操 · 赤壁（★★ ~70%）
  swarm: { bonusMana: 1 },                                          // 大军压境：每回合免费多铺 1（简化为 +1 召唤源泉）
  chainboats: { phalanxPerAdj: 6, phalanxCap: 18, phalanxAdj8: false }, // 连环船(简化)：同路相邻共享·类方阵（v1 不做火攻弱点）
  mandate: { allWinPct: 10 },                                       // 挟天子：全军 +10%
  // 关 4 · 拿破仑 · 滑铁卢（★★★ ~60%）
  battery: { batteryEveryTurns: 3, batteryWinPct: 15 },           // 大炮兵：每 3 回合压你一路 −15%
  guard: { eliteMidWinPct: 25 },                                   // 近卫军(简化)：中路前锋 +25%
  maneuver: { bonusMana: 1 },                                      // 机动调度(简化)：每回合额外 1 动作 → +1 召唤源泉
  // 关 5 · 项羽 · 霸王别姬（★★★ ~60%）
  burnboats: { allWinPct: 20, noRout: true },                     // 破釜沉舟：全军 +20% + 绝不溃
  overlord: { generalWinPct: 40 },                                // 霸王之勇：主将 +40%
  winstreak: { winStreakPer: 5, winStreakCap: 30 },              // 九战九捷：每胜 +5%·封顶 +30%
};

// 关 1-5 → 各 3 张地煞 id（doc23 §八 lineup）。Boss 牌库 = 12 随机天罡 + 这 3 张。
export const STAGE_DISHA: string[][] = [
  ['thermopylae', 'phalanx', 'laststand'],  // 1 列奥尼达
  ['companion', 'hammeranvil', 'sarissa'],  // 2 亚历山大
  ['swarm', 'chainboats', 'mandate'],       // 3 曹操
  ['battery', 'guard', 'maneuver'],         // 4 拿破仑
  ['burnboats', 'overlord', 'winstreak'],   // 5 项羽
];
/** 第 stage 关（1 基）的 3 张地煞 id（越界取末关）。 */
export function stageDisha(stage: number): string[] {
  return STAGE_DISHA[Math.max(0, Math.min(STAGE_DISHA.length - 1, stage - 1))];
}

/** 聚合一组地煞 id → DishaFx（数值相加·布尔取或·封顶/血取最大）。纯函数·确定性。 */
export function aggregateDisha(ids: readonly string[]): DishaFx {
  const fx: DishaFx = { ...NO_DISHA };
  for (const id of ids) {
    const s = DISHA_SPECS[id]; if (!s) continue;
    fx.allWinPct += s.allWinPct ?? 0;
    fx.generalWinPct += s.generalWinPct ?? 0;
    fx.phalanxPerAdj += s.phalanxPerAdj ?? 0;
    fx.phalanxCap += s.phalanxCap ?? 0;
    if (s.phalanxAdj8) fx.phalanxAdj8 = true;
    fx.nearBaseSlots = Math.max(fx.nearBaseSlots, s.nearBaseSlots ?? 0);
    fx.nearBaseWinPct += s.nearBaseWinPct ?? 0;
    fx.eliteMidWinPct += s.eliteMidWinPct ?? 0;
    fx.flankYouWinPct += s.flankYouWinPct ?? 0;
    if (s.firstStrike) fx.firstStrike = true;
    fx.firstStrikeWinPct += s.firstStrikeWinPct ?? 0;
    fx.winStreakPer += s.winStreakPer ?? 0;
    fx.winStreakCap += s.winStreakCap ?? 0;
    if (s.noRout) fx.noRout = true;
    if (s.lastStandGeneral) fx.lastStandGeneral = true;
    fx.bonusMana += s.bonusMana ?? 0;
    fx.batteryEveryTurns = Math.max(fx.batteryEveryTurns, s.batteryEveryTurns ?? 0);
    fx.batteryWinPct += s.batteryWinPct ?? 0;
    fx.homeHp = Math.max(fx.homeHp, s.homeHp ?? 0);
  }
  return fx;
}
