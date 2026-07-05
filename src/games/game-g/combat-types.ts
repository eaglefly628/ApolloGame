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
export interface ClashCard { id?: string; rank: string; suit: string; general: boolean; points: number; buff: number; morale: number; tengang: number; pEff: number; tgBreak?: [string, number][]; nearDef?: number; dishaEdge?: number; phalanx?: number; wins?: number } // phalanx：地煞·斯巴达方阵→每兵按自身相邻友兵数 +确定战力（owner 2026-07-03·改逻辑为真·每兵加战力·进拆解可见）；id：该兵 unitId（owner 2026-06-29·离场动画按 id 定位被撕/光荣离场的兵）；tgBreak：天罡逐张贡献 [天罡id, 加成]（owner 2026-06-21·对决明细溯源）；nearDef：地煞·隘口守军固守 +战力；dishaEdge：地煞·招牌气势折成的确定战力（owner 2026-07-01 确定制·仅 Boss 侧）；wins：连胜场数（owner 2026-07-01·每胜战力对折 0.5^wins·明细里显对折削减）
// tie：50:50 平局如何裁定（owner）—— null=正常概率掷命(战力不等) / 'points'=战力相等·点数大者胜 / 'stamina'=点数也同·续航高者胜 / 'roll'=全同·这一掷定(重揉)。
export interface ClashEvent { tick: number; lane: number; winrate: number; roll: number; rollA?: number; rollB?: number; aWins: boolean; tie: 'points' | 'stamina' | 'roll' | 'power' | null; winStays?: boolean; warLoss?: number; winStreak?: number; lastStand?: boolean; a: ClashCard; b: ClashCard } // rollA/rollB：各自掷战力骰的掷值(owner 2026-07-01·双方各掷 [1,自己战力] 比大小)；winrate=预报胜率；tie=掷平如何裁定(power/points/stamina/roll) // warLoss：胜者本场疲劳战损 pct(v2·胜者留场不回库·owner 2026-06-29)；winStreak：胜者连胜场数 // winStays：战胜硬币·人头=胜牌留场/人面=回库（owner 2026-06-21）；lastStand：本场触发敌主将「死战不退·首负不亡」(关1 列奥尼达地煞)→全屏通知+特写改显(owner 2026-06-21)
// 已施天罡 → 玩家侧(a)持续战斗修正（A-JOKER · cast 后整局生效·一种牌算一次不叠）。
// 聚合(aggregateTengang)在 game-g 读 GAME_G_TIANGANGS 算（避免 live-combat ← blueprint 环依赖）；live-combat 只持有这份扁平修正、在 clash/deploy 钩子读。
// v1 实装：odds(巧手 pEffAdd / 稳手 winFloor) · power(虎符 all / 寡兵 LE3 / 同花魁 sameSuit) · combo(对子诀 pair) · morale(令旗 leader) · stamina(铁汉) · draw(广纳 handMax)。
// flat 批补（doc20 §二·确定生效·无 live 挂点）：odds(灌铅骰 kHard 变硬 / 铁骰 noUpset 占优免爆冷) · combo(鼎立 trips 三条) · stamina(老兵 stamFaces 人头牌续航)。
// power 4 锁（doc20 §二「实装细则」·apply 顺序 add→mul→floor→clamp）：锋矢 powerFront(每路最前+) · 擎天 powerMulHighest(全军 base 点数最高单张 ×mul)。虎符 powerAll / 寡兵 powerLE3 即 v1。
// 10 维度天罡聚合修正（doc20 §二·全锁）。前段=clash 系(power/odds/combo/morale)·后段=经济/续航/攻守(stamina/draw/siege)。tempo/lane 主动定向 + arcane 流派印记另接。
// 掷骰系改掷字段（REQ-G-天罡原生重构 §四.2·替旧 logistic 残留 winFloor/kHard/noUpset）：rollBonus 改掷+N(鬼手)·rollFloor 掷下界抬 N(磐石)·rollTwice 多掷 N 次取高(灌铅骰)·autoWinGE 占优必胜(铁骰·>0 生效)。持方在 resolveClash 的 rollDie 侧 apply。
// killGeneralRout=擒王（REQ-G-天罡原生重构 §四.3·斩敌主将→该路敌全溃·>0 生效·clash 钩子·无需选路）。
export interface TengangFx { pEffAdd: number; powerAll: number; powerLE3: number; powerSameSuit: number; powerFront: number; powerMulHighest: number; comboPair: number; comboTrips: number; moraleLeader: number; stamPlus: number; stamFaces: number; handMaxAdd: number; rollBonus: number; rollFloor: number; rollTwice: number; autoWinGE: number; killGeneralRout: number; revenge: number; noRout: number; relay: number; clashElixir: number; onPlay: number; siegeDefend: number; siegeChip: number }
export const NO_TENGANG: TengangFx = { pEffAdd: 0, powerAll: 0, powerLE3: 0, powerSameSuit: 0, powerFront: 0, powerMulHighest: 0, comboPair: 0, comboTrips: 0, moraleLeader: 0, stamPlus: 0, stamFaces: 0, handMaxAdd: 0, rollBonus: 0, rollFloor: 0, rollTwice: 0, autoWinGE: 0, killGeneralRout: 0, revenge: 0, noRout: 0, relay: 0, clashElixir: 0, onPlay: 0, siegeDefend: 0, siegeChip: 0 };
