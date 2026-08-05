// Game I · 剧情展台的**真世界**（REQ-DIALOGUE M1 整改·Lead 令：活范例须真跑三控件）。
//   起一个真 dialogueCapability 世界（DialogueScript 节点图 + State 游标 + Text + 好感 Resource + Flag 门 + RandomSeed），
//   宿主在玩家动作时 tick 世界（真信号 → 真节点推进 → 真投影刷新）——非 literal props 静态摆拍。
//   写世界：advance()/choose(i) 加 DialogueAdvance/DialogueChoose 组件后 w.tick()（与 t3-dialogue 单测同路）。
//   读世界：source.current(id) 照 State.current 查脚本当前节点 → 投影 speaker/text/emotion/options+逐项 optionAvailable，
//           喂给 UI 层 resolveDialogue 填三控件。整份剧本=一棵 JSON 节点图（数据·零游戏专属解释器代码）。
import { World } from '@zerocraft/engine/engine/core/world.js';
import { dialogueCapability, optionAvailable, type DialogueGraph, type DialogueScript, type DialogueAdvance, type DialogueChoose } from '@zerocraft/engine/skills/tier3/dialogue.js';
import { resourceCapability } from '@zerocraft/engine/skills/atoms/resource/index.js';
import type { State, Text, Resource, Flag, RandomSeed } from '@zerocraft/engine/engine/protocol/components.js';
import type { DialogueSource, DialogueView } from '@zerocraft/engine/ui/components/index.js';

const ENTITY = 'vn-dlg';
const FSM = 'dialogue';

// 一幕约会性微剧情（数据·雨夜书斋）：line→choice（含好感门控的第三项）→回环→握手结局。
// 演全能力：推进(line)·选择(choice)·effects(好感±)·setFlag(暖场)·requires 门控动态解锁·情绪键驱动立绘。
const SCRIPT: DialogueGraph = {
  start: { kind: 'line', speaker: '林清越', emotion: 'warm', text: '你终于来了……这场雨，我等了很久。要不要陪我把这局棋下完？', next: 'pick' },
  pick: {
    kind: 'choice', speaker: '林清越', emotion: 'warm', prompt: '（你会怎么回应？）',
    options: [
      { text: '「我来了，就没打算走。」', effects: [{ resource: 'aff', amount: 6 }], setFlag: 'warmed', next: 'warm' },
      { text: '「棋盘我可下不过你。」', effects: [{ resource: 'aff', amount: 2 }], next: 'tease' },
      { text: '「握住她的手」', requires: { kind: 'flag', id: 'warmed' }, next: 'hold' }, // 暖场后才解锁
    ],
  },
  warm: { kind: 'line', speaker: '林清越', emotion: 'happy', text: '……你总是这样直白。也好，坐下吧。', next: 'pick' },
  tease: { kind: 'line', speaker: '林清越', emotion: 'calm', text: '嘴上从不饶人。那就手上见真章。', next: 'pick' },
  hold: { kind: 'line', speaker: '林清越', emotion: 'shy', text: '……嗯。就这一局，谁也别松手。', next: null },
};

export interface DialogueWorld {
  source: DialogueSource;        // 喂 resolveDialogue（读世界投影）
  advance(): void;               // line/check 推进（写世界信号 + tick）
  choose(index: number): void;   // choice 选择（写世界信号 + tick）
  affinity(): number;            // 好感当前值（活 HUD 展示·bind:'aff'）
  ended(): boolean;              // 走到结局节点（next=null 的 line）
}

/** 建一个真 dialogueCapability 世界（宿主运行时职责·非游戏数据）。 */
export function createDialogueWorld(): DialogueWorld {
  const w = new World();
  // dialogue（发 ResourceModify·runsBefore resource-apply）+ resource（结算 ResourceModify→Resource.current）：
  // 两能力都上，choice effects 的好感增量才真落到 aff.current（否则只挂个待结算组件·数值不动）。
  for (const s of dialogueCapability.systems) w.addSystem(s);
  for (const s of resourceCapability.systems) w.addSystem(s);
  w.createEntity(ENTITY);
  w.addComponent(ENTITY, { type: 'DialogueScript', fsmId: FSM, nodes: SCRIPT } as DialogueScript);
  w.addComponent(ENTITY, { type: 'State', fsmId: FSM, current: 'start', previous: '' } as State);
  w.addComponent(ENTITY, { type: 'Text', content: '', fontSize: 18, fontFamily: 'serif', anchor: 'left', lineSpacing: 4 } as Text);
  w.createEntity('aff');
  w.addComponent('aff', { type: 'Resource', id: 'aff', current: 8, min: 0, max: 100 } as Resource); // 好感起手 8
  w.createEntity('warmed');
  w.addComponent('warmed', { type: 'Flag', id: 'warmed', active: false } as Flag);
  w.createEntity('vn-rng');
  w.addComponent('vn-rng', { type: 'RandomSeed', seed: 20260805, sequence: 0 } as RandomSeed); // check 节点确定性骰（本剧本暂未用·预留）
  w.tick(); // 初帧：跑一次系统渲染 Text（真 tick）

  const affRes = (): Resource | undefined => w.getComponent<Resource>('aff', 'Resource');

  const source: DialogueSource = {
    current(id): DialogueView | undefined {
      if (id !== ENTITY) return undefined;
      const st = w.getComponent<State>(ENTITY, 'State');
      if (!st) return undefined;
      const node = SCRIPT[st.current];
      if (!node) return undefined;
      const view: DialogueView = {
        kind: node.kind,
        speaker: node.speaker,
        emotion: node.emotion,
        text: node.kind === 'line' ? node.text : node.prompt,
      };
      if (node.kind === 'choice') {
        view.options = node.options.map((o) => ({ label: o.text, available: optionAvailable(w, o) }));
      }
      return view;
    },
  };

  return {
    source,
    advance() { w.addComponent(ENTITY, { type: 'DialogueAdvance' } as DialogueAdvance); w.tick(); },
    choose(index) { w.addComponent(ENTITY, { type: 'DialogueChoose', index } as DialogueChoose); w.tick(); },
    affinity() { return affRes()?.current ?? 0; },
    ended() {
      const st = w.getComponent<State>(ENTITY, 'State');
      const node = st ? SCRIPT[st.current] : undefined;
      return node?.kind === 'line' && node.next === null;
    },
  };
}
