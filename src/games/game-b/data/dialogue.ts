import type { ConditionExpr } from '@engine/protocol/components.js';

// Game B · 对话数据（数据驱动）。v0.2：选项支持 requires(条件门控) —— 检定/阈值解锁的雏形。
// 第一幕 scene_01：女主与高冷前辈导演 S 初见。对照 game-b-otome-vn.md 第五节。

export interface Effect {
  resource: string; // 目标 Resource 的 id（按 id 全局路由，无需知道它挂哪个实体）
  amount: number;
}

export interface ChoiceOption {
  text: string;
  effects?: Effect[];
  setFlag?: string; // 目标 Flag 的 id（按 id 全局定位）
  next: string;
  // v0.2：出现/可选的条件门。不满足 → 该选项不显示、runner 也拒绝选它。
  // 检定（属性门）、阈值解锁（好感越线置的 flag 门）都是它的特例。
  requires?: ConditionExpr;
}

export type DialogueNode =
  | { kind: 'line'; speaker: string; emotion?: string; text: string; next: string | null }
  | { kind: 'choice'; speaker?: string; emotion?: string; prompt?: string; options: ChoiceOption[] };

export type DialogueScript = Record<string, DialogueNode>;

export const START_NODE = 's1_l0';

export const SCENE_01: DialogueScript = {
  s1_l0: { kind: 'line', speaker: 'S', emotion: 'cold', text: '你就是新来的制作人？', next: 's1_l1' },
  s1_l1: { kind: 'line', speaker: 'S', emotion: 'cold', text: '我对新人不抱期待。', next: 's1_choice' },

  s1_choice: {
    kind: 'choice',
    speaker: '我',
    prompt: '（该怎么回应？）',
    options: [
      { text: '我会证明自己的。', effects: [{ resource: 'affection_S', amount: 5 }], setFlag: 'met_S', next: 's1_impressed' },
      { text: '请多指教。', effects: [{ resource: 'affection_S', amount: 2 }], setFlag: 'met_S', next: 's1_polite' },
    ],
  },

  s1_impressed: { kind: 'line', speaker: 'S', emotion: 'neutral', text: '……有点意思。', next: 's1_probe' },
  s1_polite: { kind: 'line', speaker: 'S', emotion: 'neutral', text: '嗯，客套话谁都会说。', next: 's1_probe' },

  // 考验节点：三选项分别演示「属性门控」「保底」「阈值解锁」三种条件出现。
  s1_probe: {
    kind: 'choice',
    speaker: 'S',
    prompt: 'S：那你说说，你凭什么？',
    options: [
      // 属性门：魅力 ≥ 12 才出现（初始 charm=10 → 隐藏，演示"差一点的检定"）。
      { text: '（自信地阐述我的企划）', requires: { kind: 'resource', id: 'charm', cmp: 'gte', value: 12 }, effects: [{ resource: 'affection_S', amount: 3 }], next: 's1_warm' },
      // 保底：永远可选。
      { text: '（老实说我还在学）', effects: [{ resource: 'affection_S', amount: 1 }], next: 's1_neutral' },
      // 阈值解锁门：仅当好感越过阈值置位的 S_warmed_flag 时出现（= 上面选了 +5 那条路）。
      { text: '（顺势提起他感兴趣的话题）', requires: { kind: 'flag', id: 'S_warmed_flag' }, effects: [{ resource: 'affection_S', amount: 5 }], next: 's1_special' },
    ],
  },

  s1_warm: { kind: 'line', speaker: 'S', emotion: 'smile', text: '（点头）算你有点底气。', next: 's1_end' },
  s1_neutral: { kind: 'line', speaker: 'S', emotion: 'neutral', text: '诚实，但还不够。', next: 's1_end' },
  s1_special: { kind: 'line', speaker: 'S', emotion: 'blush', text: '……你倒是会看人。', next: 's1_end' },

  s1_end: { kind: 'line', speaker: '旁白', text: '（第一次见面，结束。）', next: null },
};
