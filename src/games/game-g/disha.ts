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
  nearBaseWinPct: number;   // 隘口内 +X% 胜率（winPct 式·留给文档里的战车环堡/内外双壕等）
  nearBasePower: number;    // 隘口内 守军 +X 战力（power 式·进战力拆解·温泉关用此·owner 2026-06-21：替原 +15% 胜率）
  eliteMidWinPct: number;   // 近卫军(简化)：中路 Boss 前锋 +X%
  flankYouWinPct: number;   // 锤砧：你被左右夹 → 你 −X%（存正·apply 时减你胜率）
  firstStrike: boolean;     // 长枪方阵：前锋先手（平局判 Boss 胜）
  firstStrikeWinPct: number;// + 先手胜率
  winStreakPer: number;     // 九战九捷：Boss 每胜一场 +X%
  winStreakCap: number;     // 连胜封顶
  noRout: boolean;          // 破釜沉舟/死战不退：Boss 主将亡不溃散
  lastStandGeneral: number;// 死战不退：Boss 主将命数 N（0=无·n=战败 n 次才退场·每负一次残喘退 1 格·不亡；老 true 语义=2）
  bonusMana: number;        // 大军压境(免费多铺)+机动调度(额外动作) 简化：Boss 回合开始多 N 召唤源泉
  batteryEveryTurns: number;// 大炮兵：每 N 回合压你一路
  batteryWinPct: number;    // 被压一路 −X%
  homeHp: number;           // 温泉关死守：Boss 大本营血（0=默认 3）
}

export const NO_DISHA: DishaFx = {
  allWinPct: 0, generalWinPct: 0, phalanxPerAdj: 0, phalanxCap: 0, phalanxAdj8: false,
  nearBaseSlots: 0, nearBaseWinPct: 0, nearBasePower: 0, eliteMidWinPct: 0, flankYouWinPct: 0,
  firstStrike: false, firstStrikeWinPct: 0, winStreakPer: 0, winStreakCap: 0,
  noRout: false, lastStandGeneral: 0, bonusMana: 0, batteryEveryTurns: 0, batteryWinPct: 0, homeHp: 0,
};

// 关 1-5 共 15 张地煞精确数值（doc23 §八·★ 弱版起·sim 真机调）。每张 = Partial<DishaFx> 贡献。
// 数值重设（design/boss-config-1-5.md §六·design G 2026-06-21 实测旧值关2/3/4 过强·非单调 → 按该关玩家养成重标）。
// 待甲接真 loader（已接 16 牌组）后 design G 用 simulate-balance.ts 重扫定稿·回填。
export const DISHA_SPECS: Record<string, Partial<DishaFx>> = {
  // 关 1 · 列奥尼达 · 温泉关（目标 98%）
  thermopylae: { homeHp: 2, nearBaseSlots: 2, nearBasePower: 1 }, // 温泉关死守：家 2 血 + 隘口(后2格)守军 +1 战力（§六：2→1）
  phalanx: { phalanxPerAdj: 4, phalanxCap: 12, phalanxAdj8: true }, // 斯巴达方阵：8 邻每邻 +4%·封顶 +12%（§六：6/24→4/12）
  laststand: { lastStandGeneral: 3 },                               // 死战不退：主将 3 命（关1 列奥尼达·战败 3 次才退·REQ-G-主将命数参数化）
  // 关 2 · 亚历山大 · 高加米拉（目标 87%）
  companion: { generalWinPct: 10 },                                 // 伙伴骑兵(简化)：主将 +10%（§六：20→10）
  hammeranvil: { flankYouWinPct: 6 },                              // 锤砧：你被左右夹 −6%（§六：15→6）
  sarissa: { firstStrike: true, firstStrikeWinPct: 4 },           // 长枪方阵：先手 +4%（§六：10→4）
  // 关 3 · 曹操 · 赤壁（目标 75%）
  swarm: { bonusMana: 1 },                                          // 大军压境：每回合免费多铺 1（简化为 +1 召唤源泉）
  chainboats: { phalanxPerAdj: 3, phalanxCap: 9, phalanxAdj8: false }, // 连环船(简化)：同路相邻共享·类方阵（§六：6/18→3/9）
  mandate: { allWinPct: 5 },                                        // 挟天子：全军 +5%（§六：10→5）
  // 关 4 · 拿破仑 · 滑铁卢（目标 70%）
  battery: { batteryEveryTurns: 4, batteryWinPct: 8 },           // 大炮兵：每 4 回合压你一路 −8%（§六：3/15→4/8）
  guard: { eliteMidWinPct: 12 },                                   // 近卫军(简化)：中路前锋 +12%（§六：25→12）
  maneuver: { bonusMana: 0 },                                      // 机动调度：§六 调 0（双倍泉水=悬崖·见 §五）→ 实为不再 +源泉
  // 关 5 · 项羽 · 霸王别姬（目标 65%）
  burnboats: { allWinPct: 20, noRout: true },                     // 破釜沉舟：全军 +20% + 绝不溃（§六：不变）
  overlord: { generalWinPct: 40 },                                // 霸王之勇：主将 +40%（§六：不变）
  winstreak: { winStreakPer: 4, winStreakCap: 20 },              // 九战九捷：每胜 +4%·封顶 +20%（§六：5/30→4/20）
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

// 地煞招牌名（id→名·单一真相·通知/牌面/日志复用·与 campaign-data fiends 对齐）。
export const DISHA_NAME: Record<string, string> = {
  thermopylae: '温泉关死守', phalanx: '斯巴达方阵', laststand: '死战不退',
  companion: '伙伴骑兵', hammeranvil: '锤砧', sarissa: '长枪方阵',
  swarm: '大军压境', chainboats: '连环船', mandate: '挟天子',
  battery: '大炮兵', guard: '近卫军', maneuver: '机动调度',
  burnboats: '破釜沉舟', overlord: '霸王之勇', winstreak: '九战九捷',
};

// 可施放地煞（owner 2026-06-21·混合方案）：「打出 → 整场持续加成」型 → 转成 cost2 可打牌(进 Boss 手牌·AI 攒够源泉择机打)。
// 留 Boss 被动的（开局/定时/经济/地形结构型·不适合「打张牌开启」）：温泉关死守(homeHp 开局定)、大军压境/机动调度(每回合 +源泉)、大炮兵(定时轰)、锤砧(对你的地形夹击)。
export const DISHA_PLAYABLE = new Set<string>(['phalanx', 'laststand', 'companion', 'sarissa', 'chainboats', 'mandate', 'guard', 'burnboats', 'overlord', 'winstreak']);
export const isPlayableDisha = (id: string): boolean => DISHA_PLAYABLE.has(id);

/** 拆一关地煞 id → {passive:开局即生效(聚合进 dishaB), playable:可施放牌(进 Boss 手牌)}。纯函数·保序。 */
export function splitDisha(ids: readonly string[]): { passive: string[]; playable: string[] } {
  const passive: string[] = []; const playable: string[] = [];
  for (const id of ids) (DISHA_PLAYABLE.has(id) ? playable : passive).push(id);
  return { passive, playable };
}

// 地煞字段合并策略（聚合一关多张时·单一真相）：新增一个 DishaFx 字段 = 加一行·不改 aggregateDisha 主体。
//   sum=数值累加 ｜ max=取最大（开局/结构型：隘口格数·炮兵周期·家血） ｜ or=布尔取或（先手/不溃/2命/8邻）
type DishaMerge = 'sum' | 'max' | 'or';
const DISHA_MERGE: Record<keyof DishaFx, DishaMerge> = {
  allWinPct: 'sum', generalWinPct: 'sum', phalanxPerAdj: 'sum', phalanxCap: 'sum', phalanxAdj8: 'or',
  nearBaseSlots: 'max', nearBaseWinPct: 'sum', nearBasePower: 'sum', eliteMidWinPct: 'sum', flankYouWinPct: 'sum',
  firstStrike: 'or', firstStrikeWinPct: 'sum', winStreakPer: 'sum', winStreakCap: 'sum',
  noRout: 'or', lastStandGeneral: 'max', bonusMana: 'sum', batteryEveryTurns: 'max', batteryWinPct: 'sum', homeHp: 'max', // lastStandGeneral 布尔→命数(int)后取 max（取最厚命数·同结构型开局字段）
};

/** 聚合一组地煞 id → DishaFx（按 DISHA_MERGE 策略：数值累加 / 取最大 / 布尔取或）。纯函数·确定性。 */
export function aggregateDisha(ids: readonly string[]): DishaFx {
  const fx: DishaFx = { ...NO_DISHA };
  const f = fx as Record<keyof DishaFx, number | boolean>;
  for (const id of ids) {
    const s = DISHA_SPECS[id]; if (!s) continue;
    for (const key of Object.keys(DISHA_MERGE) as (keyof DishaFx)[]) {
      const sv = s[key]; if (sv === undefined) continue;
      const pol = DISHA_MERGE[key];
      if (pol === 'or') f[key] = (f[key] as boolean) || (sv as boolean);
      else if (pol === 'max') f[key] = Math.max(f[key] as number, sv as number);
      else f[key] = (f[key] as number) + (sv as number);
    }
  }
  return fx;
}
