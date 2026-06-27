// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 聊天系统（GDD §六 心脏·100% dialogue 能力数据驱动）
//
//  话题分流 + 记忆驱动 callback + 羁绊增减 + 阶段门控 + 每日话题消耗——
//  全部用引擎通用 `dialogue` 能力的 节点图 表达（choice/line + effects/setFlag/requires），
//  无新下沉（manifesto：先重组）。记忆=持久化 Flag；羁绊/阶段=Resource；callback=requires 门。
// ════════════════════════════════════════════════════════════════════════

import type { WorldBlueprint } from '../../assembly/demo.assembly.js';
import {
  resourceCapability, flagCapability, stateCapability, textCapability, randomCapability,
} from '@atom-skills/index.js';
import { dialogueCapability, DIALOGUE_FSM, type DialogueGraph } from '@skills/tier3/index.js';
import type { ConditionExpr } from '@engine/protocol/components.js';
import type { Companion } from './characters.js';
import type { SessionRecord } from './companion.js';
import { bondOf, memoriesOf } from './record.js';

export const R_BOND = 'bond';
export const R_STAGE = 'stage';
export const CHAT_START = 'hub';

// 全部记忆事实 flag（持久化·callback 门控）。
export const MEMORY_FACTS = ['making_game', 'tired_lately', 'likes_cat', 'hates_rain', 'night_owl', 'likes_quiet'] as const;
// 全部每日话题 flag（当天聊过即消）。
export const TOPIC_FLAGS = ['t_day', 't_ask', 't_heart', 't_gamecb'] as const;

const not = (id: string): ConditionExpr => ({ kind: 'not', of: { kind: 'flag', id } });
const stageGte = (v: number): ConditionExpr => ({ kind: 'resource', id: R_STAGE, cmp: 'gte', value: v });
const bond = (n: number) => [{ resource: R_BOND, amount: n }];

// 角色台词集（同骨架·两套声音）。
interface Lines {
  prompt: string; promptHi: string;
  day: string; ask: string; heart: string; bye: string;
  mineTired: string; mineGame: string; mineCat: string; gameCb: string;
}
const QIYUE: Lines = {
  prompt: '（她安静地看着你。想聊什么？）',
  promptHi: '（她放下书，等你开口。）',
  day: '今天……把散乱的书归了位。看着它们整齐起来，心里就安定。你呢。',
  ask: '在读宫泽贤治。「为了别人的幸福，才是真正的幸福」——我一直记得这句。',
  heart: '有时候我会想，人和人之间，能走到哪一步……算了，这个不该跟你说。',
  bye: '嗯。……我会在这儿的。',
  mineTired: '……那就别硬撑。把茶喝了，歇一会儿。我在。',
  mineGame: '做游戏啊……听起来很像你。那种从无到有的事，做的时候一定很孤独吧。',
  mineCat: '猫啊。它们只在想靠近的时候靠近——这一点，我有点羡慕。',
  gameCb: '你那个游戏……进展怎么样了？我有在记着。',
};
const MIKA: Lines = {
  prompt: '（她已经凑过来了，眼睛亮亮的。）',
  promptHi: '（她把画藏在身后，又忍不住想给你看。）',
  day: '今天有七件事！第一件……欸我是不是把第三件先说了？算了你听我讲！',
  ask: '我在画一只猫！但是它有点像你？你不觉得吗你不觉得吗？',
  heart: '其实……我怕有一天你就不打开我了。诶我说了什么，当我没说！',
  bye: '诶——这么快？……好吧好吧，你记得回来哦！',
  mineTired: '累就别说话啦，我画给你看就好——你躺着，我念叨。',
  mineGame: '做游戏？！好酷好酷——那有没有我？！给我留个位置嘛！',
  mineCat: '你也喜欢猫？！那我们绝交不了了，命中注定的朋友！',
  gameCb: '你的游戏！做到哪了做到哪了？我一直在等你说！',
};

export function chatGraph(c: Companion): DialogueGraph {
  const L = c.id === 'mika' ? MIKA : QIYUE;
  const you = '你';
  const her = c.name;
  return {
    hub: {
      kind: 'choice', speaker: her, prompt: L.prompt,
      options: [
        { text: '听你说说今天', requires: not('t_day'), setFlag: 't_day', effects: bond(3), next: 'r_day' },
        { text: '问你一件事', requires: not('t_ask'), setFlag: 't_ask', effects: bond(2), next: 'r_ask' },
        { text: '说说我的事', requires: not('t_mine'), next: 'mine' },
        { text: '聊点心事', requires: { kind: 'and', of: [not('t_heart'), stageGte(1)] }, setFlag: 't_heart', effects: bond(5), next: 'r_heart' },
        { text: '「我那个游戏……」', requires: { kind: 'and', of: [{ kind: 'flag', id: 'making_game' }, not('t_gamecb')] }, setFlag: 't_gamecb', effects: bond(6), next: 'r_gamecb' },
        { text: '该把你放回去了', next: 'bye' },
      ],
    },
    r_day: { kind: 'line', speaker: her, text: L.day, next: 'hub' },
    r_ask: { kind: 'line', speaker: her, text: L.ask, next: 'hub' },
    r_heart: { kind: 'line', speaker: her, text: L.heart, next: 'hub' },
    r_gamecb: { kind: 'line', speaker: her, text: L.gameCb, next: 'hub' },
    mine: {
      kind: 'choice', speaker: you, prompt: '（想跟她说点什么？）',
      options: [
        // 每件事说过一次即消（requires not(fact)）——她记住后，这条就不再出现。
        { text: '我最近有点累。', requires: not('tired_lately'), setFlag: 'tired_lately', effects: bond(3), next: 'r_tired' },
        { text: '我在做一个游戏。', requires: not('making_game'), setFlag: 'making_game', effects: bond(4), next: 'r_game' },
        { text: '我其实挺喜欢猫的。', requires: not('likes_cat'), setFlag: 'likes_cat', effects: bond(3), next: 'r_cat' },
        { text: '（算了，没什么）', next: 'hub' },
      ],
    },
    r_tired: { kind: 'line', speaker: her, text: L.mineTired, next: 'hub' },
    r_game: { kind: 'line', speaker: her, text: L.mineGame, next: 'hub' },
    r_cat: { kind: 'line', speaker: her, text: L.mineCat, next: 'hub' },
    bye: { kind: 'line', speaker: her, text: L.bye, next: null },
  };
}

// 拿起聊天 → 构建对话世界（含羁绊/阶段资源 + 记忆/话题 Flag·从 record 还原）。
export function buildChatBlueprint(c: Companion, rec: SessionRecord, stage: number, seed = 20260626): WorldBlueprint {
  const flags: Record<string, { Flag: { id: string; active: boolean } }> = {};
  const mem = memoriesOf(rec);
  for (const f of MEMORY_FACTS) flags[`flag-${f}`] = { Flag: { id: f, active: mem.includes(f) } };
  const dailyDone = rec.dailyTopics ?? [];
  for (const t of TOPIC_FLAGS) flags[`flag-${t}`] = { Flag: { id: t, active: dailyDone.includes(t) } };
  return {
    capabilities: [resourceCapability, flagCapability, stateCapability, textCapability, randomCapability, dialogueCapability],
    entities: {
      dialogue: {
        DialogueScript: { fsmId: DIALOGUE_FSM, nodes: chatGraph(c) },
        State: { fsmId: DIALOGUE_FSM, current: CHAT_START, previous: '' },
        Text: { content: '', fontSize: 20, fontFamily: 'serif', anchor: 'left', lineSpacing: 4 },
      },
      [`res-${R_BOND}`]: { Resource: { id: R_BOND, current: bondOf(rec), min: 0, max: 100 } },
      [`res-${R_STAGE}`]: { Resource: { id: R_STAGE, current: stage, min: 0, max: 2 } },
      ...flags,
      rng: { RandomSeed: { seed, sequence: 0 } },
    },
  };
}
