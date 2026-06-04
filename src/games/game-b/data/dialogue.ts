// Game B · 对话数据（数据驱动）。纯内容，不是世界状态——runner 闭包持有，可单测。
// 节点图：line 节点(单行+next) / choice 节点(若干选项，各带 effects/setFlag/next)。
// 第一幕 scene_01：女主与高冷前辈导演 S 初次见面。对照 game-b-otome-vn.md 第五节。

export interface Effect {
  resource: string; // 目标 Resource 的 id（约定：实体名 === resourceId）
  amount: number;
}

export interface ChoiceOption {
  text: string;
  effects?: Effect[];
  setFlag?: string; // 目标 Flag 的 id（约定：实体名 === flagId）
  next: string;
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
  s1_impressed: { kind: 'line', speaker: 'S', emotion: 'neutral', text: '……有点意思。', next: 's1_end' },
  s1_polite: { kind: 'line', speaker: 'S', emotion: 'neutral', text: '嗯，客套话谁都会说。', next: 's1_end' },
  s1_end: { kind: 'line', speaker: '旁白', text: '（第一次见面，结束。）', next: null },
};
