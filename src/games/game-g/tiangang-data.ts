// Game G · 天罡牌类型 + 三十六天罡数据（doc20 §二·拆分自 blueprint.ts·纯类型+数据叶子·无 blueprint 反向依赖）。

// contract③ 天罡牌稀有度（doc20 §一）普/稀/史/传
export type TiangangRarity = 'common' | 'rare' | 'epic' | 'legendary';
// 旧 build-时 favor 变换 kinds + 新 contract③ 10 维度 kinds（甲写解释器）
export type TiangangKind = 'suit-synergy' | 'polarize' | 'lane-pref' | 'diehard' | 'morale' | 'link' | 'economy' | 'revenge'
  | 'odds' | 'roll' | 'power' | 'combo' | 'tempo' | 'stamina' | 'draw' | 'lane' | 'siege' | 'arcane'; // roll=掷骰系（REQ-G-天罡原生重构 §四.2·原 odds 概率系重设）
export type Archetype = 'decap' | 'cardtype' | 'general' | 'wide' | 'probability' | 'tianji'; // 6 流派 id（design/12 §四）
export interface TiangangCard {
  id: string; name: string; kind: TiangangKind; cost: number; archetype: Archetype; text: string;
  amount?: number; // favor 量（旧 build-时变换用）
  lane?: number; // lane-pref 偏好路
  moraleMul?: number; // morale：本路士气倍率（旗手 1.5 / 枭雄 2）
  // contract③ 天罡牌字段（一期 20 张）：
  rarity?: TiangangRarity; // 稀有度
  params?: Record<string, unknown>; // kind-specific params（甲写解释器读）
  power?: number; // 牌力 ⭐1–5
  phat?: number; // P̂ 0–10 设计估胜率影响（仿真台实测校准）
  icon?: string; // game-icons 路径（doc20 §二尾 icon 配表 · 逐张）
  tint?: string; // icon 染色（按维度配色）
}
export const GAME_G_TIANGANGS: TiangangCard[] = [
  // 三十六天罡（doc20 §二 定稿 · owner 2026-06-20「用新的」· 主动施法·确定生效·功能优先·名字临时 · icon 配表 §二尾）
  // A ⭐掷骰系 roll（REQ-G-天罡原生重构 §四.2·原概率系锚死 logistic → 重设为「改自己的战力骰」·更贴掷命/翻命身份）
  { id: 'ghosthand', name: '鬼手', kind: 'roll', rarity: 'common', cost: 12, archetype: 'probability', power: 1, params: { op: 'bonus', value: 2 }, icon: 'skoll/d10', tint: '#a78bfa', text: '改掷 +2（这一掷稳稳偏向你）' },
  { id: 'bedrock', name: '磐石', kind: 'roll', rarity: 'rare', cost: 16, archetype: 'probability', power: 2, params: { op: 'floor', value: 2 }, icon: 'delapouite/stone-wall', tint: '#a78bfa', text: '掷下界 +2（你掷 [3,战力]·最差也不空手·收窄下风）' },
  { id: 'leaddice', name: '灌铅骰', kind: 'roll', rarity: 'rare', cost: 16, archetype: 'probability', power: 2, params: { op: 'twice', value: 1 }, icon: 'delapouite/rolling-dices', tint: '#a78bfa', text: '灌铅骰·掷两次取高（偏高端·强者愈强）' },
  { id: 'irondice', name: '铁骰', kind: 'roll', rarity: 'epic', cost: 22, archetype: 'probability', power: 3, params: { op: 'autoWinGE' }, icon: 'delapouite/dice-shield', tint: '#a78bfa', text: '占优必胜·前锋战力 ≥ 敌 → 免掷直接胜' },
  // B 点数系 power
  { id: 'tigertally', name: '虎符', kind: 'power', rarity: 'common', cost: 12, archetype: 'general', power: 1, params: { op: 'add', value: 2 }, icon: 'delapouite/tiger-head', tint: '#ef4444', text: '全军 +2 点数' },
  { id: 'arrowhead', name: '锋矢', kind: 'power', rarity: 'rare', cost: 16, archetype: 'wide', power: 2, params: { op: 'add', value: 4, filter: 'front' }, icon: 'lorc/arrowhead', tint: '#ef4444', text: '每路最前一张 +4（前锋破阵）' },
  { id: 'atlas', name: '擎天', kind: 'power', rarity: 'rare', cost: 16, archetype: 'general', power: 2, params: { op: 'mul', value: 1.5, filter: 'highest' }, icon: 'delapouite/atlas', tint: '#ef4444', text: '最强一张 +50%（强者愈强）' },
  { id: 'fewtroops', name: '寡兵', kind: 'power', rarity: 'epic', cost: 22, archetype: 'tianji', power: 3, params: { op: 'add', value: 6, filter: 'countLE3' }, icon: 'delapouite/star-medal', tint: '#ef4444', text: '本路 ≤3 张 → 每张 +6（以少胜多）' },
  // C 成组系(同rank) combo
  { id: 'twinblade', name: '双锋', kind: 'combo', rarity: 'common', cost: 12, archetype: 'cardtype', power: 1, params: { op: 'pair', bonus: 6 }, icon: 'lorc/crossed-swords', tint: '#2dd4bf', text: '本路含对子(两张同点) → +6' },
  { id: 'tripod', name: '鼎立', kind: 'combo', rarity: 'rare', cost: 16, archetype: 'cardtype', power: 2, params: { op: 'trips', bonus: 12 }, icon: 'lorc/cauldron', tint: '#2dd4bf', text: '本路含三条(三张同点) → +12' },
  // D 将领系 morale
  { id: 'bannerman', name: '旗手', kind: 'morale', rarity: 'common', cost: 12, archetype: 'general', power: 1, params: { op: 'leaderBuff', value: 4 }, icon: 'lorc/rally-the-troops', tint: '#fcd34d', text: '主将在 → 同路士气 +（光环）' },
  { id: 'capturektg', name: '擒王', kind: 'morale', rarity: 'rare', cost: 16, archetype: 'decap', power: 2, params: { op: 'killGeneralRout' }, icon: 'lorc/decapitation', tint: '#fcd34d', text: '打掉敌方主将 → 敌该路全体溃散（擒贼擒王）' },
  { id: 'grieve', name: '哀兵', kind: 'morale', rarity: 'rare', cost: 16, archetype: 'general', power: 2, params: { op: 'revenge', value: 14 }, icon: 'delapouite/enrage', tint: '#fcd34d', text: '我主将被斩 → 该路余部 +14' },
  { id: 'deathwatch', name: '督战', kind: 'morale', rarity: 'epic', cost: 22, archetype: 'general', power: 3, params: { op: 'noRout' }, icon: 'delapouite/drum', tint: '#fcd34d', text: '主将阵亡不溃散' },
  // E 行军系 tempo
  { id: 'swiftmarch', name: '疾行', kind: 'tempo', rarity: 'rare', cost: 16, archetype: 'wide', power: 2, params: { op: 'advance', value: 1, target: 'self' }, icon: 'lorc/sprint', tint: '#22c55e', text: '指定我一路，该路兵每回合多推进 1 格（抢攻）' },
  { id: 'mire', name: '泥沼', kind: 'tempo', rarity: 'rare', cost: 16, archetype: 'decap', power: 2, params: { op: 'slow', target: 'enemy' }, icon: 'delapouite/swamp', tint: '#22c55e', text: '指定敌一路，该路敌兵隔回合才推进（拖住）' },
  { id: 'beachhead', name: '抢滩', kind: 'tempo', rarity: 'epic', cost: 22, archetype: 'wide', power: 3, params: { op: 'jumpToMid' }, icon: 'delapouite/jump-across', tint: '#22c55e', text: '指定一路，该路新部署兵直接到中线格（抢线）' },
  { id: 'ironchain', name: '铁索', kind: 'tempo', rarity: 'epic', cost: 22, archetype: 'decap', power: 3, params: { op: 'slow', target: 'enemy', scope: 'all' }, icon: 'lorc/linked-rings', tint: '#22c55e', text: '敌全军隔回合才推进（连环锁脚）' },
  // F 续航系 stamina
  { id: 'veteran', name: '老兵', kind: 'stamina', rarity: 'common', cost: 12, archetype: 'wide', power: 1, params: { op: 'stamPlus', value: 1, filter: 'faces' }, icon: 'delapouite/sergeant', tint: '#38bdf8', text: '人头牌(JQKA) 续航 +1' },
  { id: 'unyield', name: '不屈', kind: 'stamina', rarity: 'rare', cost: 16, archetype: 'wide', power: 2, params: { op: 'stamPlus', value: 1 }, icon: 'lorc/mailed-fist', tint: '#38bdf8', text: '全军续航 +1' },
  { id: 'relay', name: '薪火', kind: 'stamina', rarity: 'epic', cost: 22, archetype: 'wide', power: 3, params: { op: 'relay', value: 2 }, icon: 'delapouite/torch', tint: '#38bdf8', text: '一张阵亡 → 同路下一张续航 +2（接棒·非复活）' },
  // G 抽牌系 draw
  { id: 'widehand', name: '广纳', kind: 'draw', rarity: 'common', cost: 12, archetype: 'general', power: 1, params: { op: 'handMax', value: 2 }, icon: 'faithtoken/card-pick', tint: '#06b6d4', text: '手牌上限 +2' },
  { id: 'flow', name: '川流', kind: 'draw', rarity: 'rare', cost: 16, archetype: 'general', power: 2, params: { op: 'onPlay', value: 1 }, icon: 'faithtoken/card-draw', tint: '#06b6d4', text: '出牌后立即补抽 1 张（手不空）' },
  { id: 'tidewave', name: '战潮', kind: 'draw', rarity: 'epic', cost: 22, archetype: 'wide', power: 3, params: { op: 'clashElixir', value: 1 }, icon: 'delapouite/two-coins', tint: '#06b6d4', text: '遭遇对决 → 返召唤源泉（经济·心流回点）' },
  // H 三路系 lane（城门令/gateorder 已随机关门整套退役·owner 2026-07-03·REQ-G-退役机关门 → 天罡池 36→35）
  { id: 'rush', name: '驰援', kind: 'lane', rarity: 'rare', cost: 16, archetype: 'wide', power: 2, params: { op: 'reinforce', value: 2 }, icon: 'lorc/backup', tint: '#94a3b8', text: '指定一路 +2 张兵' },
  { id: 'discard2', name: '舍车', kind: 'lane', rarity: 'epic', cost: 22, archetype: 'tianji', power: 3, params: { op: 'sacrifice', value: 10 }, icon: 'lorc/trade', tint: '#94a3b8', text: '弃一路 → 另两路各 +10' },
  { id: 'lurefoe', name: '调虎', kind: 'lane', rarity: 'epic', cost: 22, archetype: 'decap', power: 3, params: { op: 'forceMigrate' }, icon: 'delapouite/fishing-lure', tint: '#94a3b8', text: '强制敌一路一张迁去别路（调虎离山）' },
  // I 攻守系 siege
  { id: 'laststand', name: '死守', kind: 'siege', rarity: 'rare', cost: 16, archetype: 'general', power: 2, params: { op: 'defend', value: 1 }, icon: 'badges/shield', tint: '#a8a29e', text: '我老家首次被破免疫' },
  { id: 'ram', name: '攻城锤', kind: 'siege', rarity: 'epic', cost: 22, archetype: 'decap', power: 3, params: { op: 'chipMore', value: 1 }, icon: 'darkzaitzev/ram', tint: '#a8a29e', text: '破老家多 chip 1 血' },
  // J 流派印记(传说) arcane
  { id: 'markdecap', name: '斩首印', kind: 'arcane', rarity: 'legendary', cost: 42, archetype: 'decap', power: 5, params: { mark: 'decap' }, icon: 'lorc/backstab', tint: '#fbbf24', text: '集齐斩首流 → 斩首额外 −溃散·敌主将更脆（招牌质变）' },
  { id: 'markmorale', name: '将魂印', kind: 'arcane', rarity: 'legendary', cost: 42, archetype: 'general', power: 5, params: { mark: 'morale' }, icon: 'lorc/crown', tint: '#fbbf24', text: '集齐将领流 → 主将士气 ×1.3（招牌质变）' },
  { id: 'markswarm', name: '铺场印', kind: 'arcane', rarity: 'legendary', cost: 42, archetype: 'wide', power: 5, params: { mark: 'swarm' }, icon: 'sbed/overmind', tint: '#fbbf24', text: '集齐铺场流 → 每路 +2 兵（招牌质变）' },
  { id: 'marktianji', name: '田忌印', kind: 'arcane', rarity: 'legendary', cost: 42, archetype: 'tianji', power: 5, params: { mark: 'sacrifice' }, icon: 'skoll/chess-king', tint: '#fbbf24', text: '集齐弃一保二流 → 弃路 favor 转移 ×1.5（招牌质变）' },
  { id: 'marksamerank', name: '双锋印', kind: 'arcane', rarity: 'legendary', cost: 42, archetype: 'cardtype', power: 5, params: { mark: 'sameRank' }, icon: 'lorc/duality', tint: '#fbbf24', text: '集齐同 rank 流 → 对子/三条加成再 +1 档（招牌质变）' },
  { id: 'markodds', name: '铁律印', kind: 'arcane', rarity: 'legendary', cost: 42, archetype: 'probability', power: 5, params: { mark: 'odds' }, icon: 'delapouite/weight-scale', tint: '#fbbf24', text: '集齐确定流 → 下限再抬 + 方差再收（招牌质变）' },
];

export const TIANGANG_BY_ID: ReadonlyMap<string, TiangangCard> = new Map(GAME_G_TIANGANGS.map((j) => [j.id, j]));
