// Tier 3 — 系统级玩法 (Mechanics)
// 跨实体的复合逻辑：多个 Tier 2 串联成完整的游戏机制（如开关→门→限时通道、
// 检定→分支→结算、好感阈值→事件链）。详见 wiki/atom-skill-periodic-table.md「Tier 3」。
//
// dialogue（R15）：解释器型机制的第一个——读声明式对话图（数据）推进游标、驱动 state/text/effect。
// 由真实游戏（Game B）的 request 拉动落地；让 VN/RPG 的剧情变成纯数据 JSON。
export {
  dialogueCapability,
  renderNodeText,
  optionAvailable,
  resourceValue,
  resolveCheck,
  DIALOGUE_FSM,
  DIALOGUE_ACTION_ADVANCE,
  DIALOGUE_ACTION_CHOOSE,
} from './dialogue.js';
export type { DialogueScript, DialogueAdvance, DialogueChoose, DialogueNode, DialogueCheck, DialogueGraph, DialogueChoiceOption, DialogueEffect } from './dialogue.js';

// match3-board（REQ-C-001）：算法/解释器型机制——网格三消（交换/找连/消除产出/重力/补块/连锁），
// config 驱动、确定性。Condition→Event→Effect 表达不了带网格扫描/循环的算法，这是周期表缺失的「Match-3」格。
export { match3BoardCapability, findMatches, applyGravity, refillEmpty, adjacent, cellIndex } from './match3-board.js';

// prefab（T4 授权层，REQ-ARPG）：数据级预制模板展开——消费 SpawnRequest，从 PrefabLibrary 确定性实例化。
// 反「YAML→Node 编译器」：宏是数据，引擎展开，AI 不产代码。
export { prefabCapability, instantiate } from './prefab.js';

// caster（D-002，REQ-ARPG）：信号→生成桥——把按键/点地/条件成立的 Signal 接成算好坐标的 SpawnRequest，
// 交给 prefab 展开技能/陷阱/掉落。补上 prefab 缺的"运行时按数据释放"入口（REQ-008 延后的那块）。
export { casterCapability } from './caster.js';

// aggro（D-001，REQ-ARPG）：AI 索敌段——感知最近 targetTag 阵营 → 写 Relation(target)（周期表 auto-target）。
// 与 tier2/steering 配对成数据驱动追逐/逃跑 AI；目标产物化为通用 Relation，供 steering/caster/朝向复用。
export { aggroCapability } from './aggro.js';

// poker-hand（REQ-011）：算法/解释器型机制——扑克牌型评估（高牌…同花顺/五条/同花葫芦/同花五），
// 读 PlayedHand 判最高牌型 → 按 rankingTable set 基础 chips/mult。与 match3-board/tilemap 同构（数据=牌，引擎=判型）。
// 选牌/洗牌/盲注/小丑全用现有 clickable/random/condition/effect-apply(op,REQ-012) 重组——本能力只补"判牌型"真缺口。
export { pokerHandCapability, evaluateHand, isStraightRanks, scoringCardIndices } from './poker-hand.js';
export type { HandType, HandEval } from './poker-hand.js';

// card-scoring（REQ-014）：poker-hand 的逐张计分伴生件——按序遍历 PlayedHand.cards，逐张累加 baseChips +
// 触发命中该牌的逐张规则（PerCardRule），支持 retrigger（PerCardRetrigger）。聚合计数表达不了 retrigger 的乘性耦合，
// 故逐张迭代是正确抽象。迭代=引擎算法，逐张规则/重触发=纯数据（与 effect-apply 的 Effect 同构）。
export { cardScoringCapability, matchPerCardWhen } from './card-scoring.js';

// flow（REQ-020）：声明式游戏流程状态机解释器——流程=一份 GameFlow 数据（状态+带 when 条件的转移），
// 读如线性瀑布脚本、本质数据（与 dialogue 同构）。消解散落的 EventWhen/Effect 流程实体，跨所有游戏复用。
export { flowCapability } from './flow.js';
