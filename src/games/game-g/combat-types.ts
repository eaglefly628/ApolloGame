// combat-types.ts —— Game G 共享战斗数据类型 / helper（从已退役的实时核 live-combat.ts 抽出 · REQ-G-退役旧战斗核）。
// 旧实时核（initLiveBattle/stepLiveBattle/…）已零调用删除；这些**纯数据件**被存活的回合制核(turn-combat.ts)+UI(game-g.tsx/clash-view)+仿真台复用，故单独成模块、切断对旧核的依赖。无逻辑改动，定义与注释逐字保留。

// 续航（doc19 §五）：数字 1 / 人头(A·J·Q·K) 2 / 大小王(JOKER 牌·非天罡) 3 场 → 神牌也得回家歇、逼牌组轮转。
export function cardStamina(rank: string): number {
  if (rank === 'JOKER' || rank === '★' || rank === '王') return 3;
  if (rank === 'A' || rank === 'K' || rank === 'Q' || rank === 'J') return 2;
  return 1;
}

// 对决事件（doc19 §三「胜率可读」+ 命运一掷 · 给战斗表演特写读数）：双方点数/经营加成/有效战力 P_eff、胜率、所掷点 roll、谁胜。
// 纯记录（不进 liveHash、不改判定）：roll = clash 那一掷的 nextRandom 值，aWins = roll < winrate ——把"算出概率→掷→落在区间定生死"如实暴露。
export interface ClashCard { rank: string; suit: string; general: boolean; points: number; buff: number; morale: number; tengang: number; pEff: number; tgBreak?: [string, number][]; nearDef?: number } // tgBreak：天罡逐张贡献 [天罡id, 加成]（owner 2026-06-21·对决明细溯源）；nearDef：地煞·隘口守军固守 +战力
// tie：50:50 平局如何裁定（owner）—— null=正常概率掷命(战力不等) / 'points'=战力相等·点数大者胜 / 'stamina'=点数也同·续航高者胜 / 'roll'=全同·这一掷定(重揉)。
export interface ClashEvent { tick: number; lane: number; winrate: number; roll: number; aWins: boolean; tie: 'points' | 'stamina' | 'roll' | null; winStays?: boolean; lastStand?: boolean; a: ClashCard; b: ClashCard } // winStays：战胜硬币·人头=胜牌留场/人面=回库（owner 2026-06-21）；lastStand：本场触发敌主将「死战不退·首负不亡」(关1 列奥尼达地煞)→全屏通知+特写改显(owner 2026-06-21)
// 已施天罡 → 玩家侧(a)持续战斗修正（A-JOKER · cast 后整局生效·一种牌算一次不叠）。
// 聚合(aggregateTengang)在 game-g 读 GAME_G_TIANGANGS 算（避免 live-combat ← blueprint 环依赖）；live-combat 只持有这份扁平修正、在 clash/deploy 钩子读。
// v1 实装：odds(巧手 pEffAdd / 稳手 winFloor) · power(虎符 all / 寡兵 LE3 / 同花魁 sameSuit) · combo(对子诀 pair) · morale(令旗 leader) · stamina(铁汉) · draw(广纳 handMax)。
// flat 批补（doc20 §二·确定生效·无 live 挂点）：odds(灌铅骰 kHard 变硬 / 铁骰 noUpset 占优免爆冷) · combo(鼎立 trips 三条) · stamina(老兵 stamFaces 人头牌续航)。
// power 4 锁（doc20 §二「实装细则」·apply 顺序 add→mul→floor→clamp）：锋矢 powerFront(每路最前+) · 擎天 powerMulHighest(全军 base 点数最高单张 ×mul)。虎符 powerAll / 寡兵 powerLE3 即 v1。
// 10 维度天罡聚合修正（doc20 §二·全锁）。前段=clash 系(power/odds/combo/morale)·后段=经济/续航/攻守(stamina/draw/siege)。tempo/lane 主动定向 + arcane 流派印记另接。
export interface TengangFx { pEffAdd: number; winFloor: number; powerAll: number; powerLE3: number; powerSameSuit: number; powerFront: number; powerMulHighest: number; comboPair: number; comboTrips: number; moraleLeader: number; stamPlus: number; stamFaces: number; handMaxAdd: number; kHard: number; noUpset: number; revenge: number; noRout: number; relay: number; clashElixir: number; onPlay: number; siegeDefend: number; siegeChip: number }
export const NO_TENGANG: TengangFx = { pEffAdd: 0, winFloor: 0, powerAll: 0, powerLE3: 0, powerSameSuit: 0, powerFront: 0, powerMulHighest: 0, comboPair: 0, comboTrips: 0, moraleLeader: 0, stamPlus: 0, stamFaces: 0, handMaxAdd: 0, kHard: 0, noUpset: 0, revenge: 0, noRout: 0, relay: 0, clashElixir: 0, onPlay: 0, siegeDefend: 0, siegeChip: 0 };
