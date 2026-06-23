import { type Formation, FORMATION_PRESETS } from './formation-data.js'; // 军阵预设（Boss 力压哪路）
import { type Intervention } from './lever-data.js'; // 起手干预（Boss 强度杠杆之一）
import { type Archetype } from './tiangang-data.js'; // Boss 流派标签（克制网用）

// ── 终局 Boss 阵容（design/13 · 每 run 轮换一名牌王座）──
// 每 Boss = 一个拟人化扑克人格，强度全用 3 个**数据**杠杆表达：formation(力压哪路)/favorBias(多强)/openingLevers(起手干预)。
// 起手干预 = 对 Boss(B)侧跑 applyInterventions(caster='b')：增益落 Boss 己方、诅咒/斩首落玩家——**对称、零新算子**(design/13 §二)。
// taunt/persona 仅 flavor(UI 台词)、无可执行逻辑——力量全在三杠杆，守"整个游戏是数据"(最弱 LLM 能填 BossSpec)。
export interface BossSpec { id: string; name: string; persona: string; formation: Formation; favorBias: number; openingLevers: Intervention[]; taunt: string; archetype: Archetype }
const BOSS_BIAS = 14; // 终局基准偏置(≈battleSpec(4)=18 同档，余强度由 openingLevers 补)；数值可调，平衡总表归 design G。
export const BOSS_ROSTER: BossSpec[] = [
  { id: 'spadeK', name: '黑桃王·铁壁', persona: '沉稳防守', archetype: 'general', formation: FORMATION_PRESETS['均衡'], favorBias: BOSS_BIAS, openingLevers: [{ kind: 'bless', lane: 0 }, { kind: 'bless', lane: 1 }, { kind: 'bless', lane: 2 }], taunt: '铜墙铁壁，寸土不让。' },
  { id: 'heartQ', name: '红桃皇后·倾国', persona: '妖艳压制', archetype: 'probability', formation: FORMATION_PRESETS['锋矢'], favorBias: BOSS_BIAS, openingLevers: [{ kind: 'curse', lane: 0 }, { kind: 'curse', lane: 1 }], taunt: '一顾倾人城，再顾倾你军。' },
  { id: 'diamondJ', name: '方块J·诡牌', persona: '花哨赌徒', archetype: 'cardtype', formation: FORMATION_PRESETS['均衡'], favorBias: BOSS_BIAS, openingLevers: [{ kind: 'flush', lane: 0 }, { kind: 'flush', lane: 1 }, { kind: 'flush', lane: 2 }], taunt: '满手好牌，张张要命。' },
  { id: 'clubK', name: '梅花K·人海', persona: '暴兵碾压', archetype: 'wide', formation: FORMATION_PRESETS['均衡'], favorBias: BOSS_BIAS - 4, openingLevers: [{ kind: 'reinforce', lane: 0 }, { kind: 'reinforce', lane: 1 }, { kind: 'reinforce', lane: 2 }], taunt: '人海无尽，淹没你的旗。' },
  { id: 'bigJoker', name: '大王·天命', persona: '疯赌', archetype: 'tianji', formation: FORMATION_PRESETS['锋矢'], favorBias: BOSS_BIAS + 6, openingLevers: [{ kind: 'flush', lane: 1 }], taunt: '天命在我，一掷定乾坤！' },
  { id: 'smallJoker', name: '小王·无常', persona: '阴狠刺客', archetype: 'decap', formation: FORMATION_PRESETS['两翼'], favorBias: BOSS_BIAS, openingLevers: [{ kind: 'decapitate', lane: 0 }, { kind: 'decapitate', lane: 1 }, { kind: 'decapitate', lane: 2 }], taunt: '擒贼擒王，先取你将首。' },
];
/** 取第 idx 名 Boss（每 run 轮换；越界自动归一）。 */
export function bossFor(idx: number): BossSpec {
  const n = BOSS_ROSTER.length;
  return BOSS_ROSTER[((idx % n) + n) % n];
}
