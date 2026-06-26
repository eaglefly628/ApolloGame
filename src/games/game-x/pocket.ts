// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— Pocket Mode 对话数据 + 世界蓝图（GDD §六）
//
//  「拿起设备、真正互动的时间」。基础框架阶段：每个角色一棵**静态对话图（数据）**，
//  用引擎通用 `dialogue` 能力解释（推进/选择/effects 改情感温度）。
//  正式版的 AI 对话（LLM·记忆·情绪一致性）是运行期云端能力，超出确定性引擎范畴；
//  这里先用脚本对话把**数据流跑通**（拿起→对话→放回更新关系记录），等设计层接入真对话内容。
//
//  情感温度 warmth(0..100) = 一个 Resource：选项 effects 改它 → 放回底座时宿主把它写回
//  SessionRecord.emotionTemp（跨会话持久），于是 Desk Mode 底部温度细线会因这次互动升温。
// ════════════════════════════════════════════════════════════════════════

import type { WorldBlueprint } from '../../assembly/demo.assembly.js';
import {
  resourceCapability,
  flagCapability,
  stateCapability,
  textCapability,
  randomCapability,
} from '@atom-skills/index.js';
import { dialogueCapability, DIALOGUE_FSM, type DialogueGraph } from '@skills/tier3/index.js';
import type { Companion } from './characters.js';

export const R_WARMTH = 'warmth'; // 情感温度 0..100（本次互动累加，放回时回写 emotionTemp）
export const POCKET_START = 'hub';

const warm = (amount: number) => [{ resource: R_WARMTH, amount }];

// ── 七月：克制、慢热。回应短，但选对了会有微小的暖。────────────────────────
const QIYUE_POCKET: DialogueGraph = {
  hub: {
    kind: 'choice',
    speaker: '你',
    prompt: '（她安静地看着你。想聊点什么？）',
    options: [
      { text: '今天读了什么？', effects: warm(6), next: 'q_book' },
      { text: '我今天有点累。', effects: warm(8), next: 'q_tired' },
      { text: '（只是安静地陪着她）', effects: warm(5), next: 'q_quiet' },
      { text: '该把你放回去了。', next: 'q_bye' },
    ],
  },
  q_book: { kind: 'line', speaker: '林七月', emotion: 'read', text: '宫泽贤治。……你要是想听，我可以念一段给你。不过，下次吧。', next: 'hub' },
  q_tired: { kind: 'line', speaker: '林七月', emotion: 'soft', text: '……那就别说话了。把茶喝了，歇一会儿。我在。', next: 'hub' },
  q_quiet: { kind: 'line', speaker: '林七月', emotion: 'wait', text: '（她没说话，只是把书往你这边挪了挪。）', next: 'hub' },
  q_bye: { kind: 'line', speaker: '林七月', emotion: 'wait', text: '嗯。……我会在这儿的。', next: null },
};

// ── Mika：元气、话多。回应长、跑题、问号结尾。────────────────────────────
const MIKA_POCKET: DialogueGraph = {
  hub: {
    kind: 'choice',
    speaker: '你',
    prompt: '（她已经凑过来了，眼睛亮亮的。）',
    options: [
      { text: '今天画了什么？', effects: warm(8), next: 'm_draw' },
      { text: '吃饭了吗？', effects: warm(7), next: 'm_eat' },
      { text: '给我讲讲今天的事？', effects: warm(9), next: 'm_day' },
      { text: '我先把你放回去啦。', next: 'm_bye' },
    ],
  },
  m_draw: { kind: 'line', speaker: '宋 Mika', emotion: 'draw', text: '画了你！……才不是啦，是一只猫，但是它有点像你？你不觉得吗？', next: 'hub' },
  m_eat: { kind: 'line', speaker: '宋 Mika', emotion: 'eat', text: '吃啦吃啦——啊不对我好像只吃了块面包？你呢你呢？你有没有好好吃饭？', next: 'hub' },
  m_day: { kind: 'line', speaker: '宋 Mika', emotion: 'lively', text: '今天有七件事！第一件……欸我刚刚是不是把第三件先说了？算了你听我讲！', next: 'hub' },
  m_bye: { kind: 'line', speaker: '宋 Mika', emotion: 'wait', text: '诶——这么快？……好吧好吧，你记得回来哦！', next: null },
};

export function pocketGraph(c: Companion): DialogueGraph {
  return c.id === 'mika' ? MIKA_POCKET : QIYUE_POCKET;
}

// 拿起设备 → 构建一个 Pocket Mode 对话世界（含情感温度资源 + 确定性随机种子）。
export function buildPocketBlueprint(c: Companion, startWarmth: number, seed = 20260626): WorldBlueprint {
  return {
    capabilities: [
      resourceCapability,
      flagCapability,
      stateCapability,
      textCapability,
      randomCapability,
      dialogueCapability,
    ],
    entities: {
      dialogue: {
        DialogueScript: { fsmId: DIALOGUE_FSM, nodes: pocketGraph(c) },
        State: { fsmId: DIALOGUE_FSM, current: POCKET_START, previous: '' },
        Text: { content: '', fontSize: 20, fontFamily: 'serif', anchor: 'left', lineSpacing: 4 },
      },
      [R_WARMTH]: { Resource: { id: R_WARMTH, current: Math.round(startWarmth), min: 0, max: 100 } },
      rng: { RandomSeed: { seed, sequence: 0 } },
    },
  };
}
