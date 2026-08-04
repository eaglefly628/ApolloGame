// Game I · 剧情 · VN 对话三件（buildDialogueScene）—— REQ-DIALOGUE M1 活范例。
//   闭集 VN 控件三件（portrait 立绘 / dialog 台词框 / choiceList 选项）拼一幕约会性剧情屏，纯 LayoutNode 数据。
//   写世界=信号：台词框点击发 dialogue.advance；选项发 dialogue.choose+下标（t3-dialogue 认 arg 串·无需游戏 handler）。
//   读世界=投影：真游戏给 bind=对话实体 id，用 resolveDialogue(tree, DialogueSource) 从世界当前节点填 speaker/text/options；
//     本展台用 literal props 静态呈现（含一条 available:false 门控项，示范可选性灰显）。起手皮=apollo-toon。
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';

const STAGE_W = 456, STAGE_H = 720;

/** VN 对话屏（纯 LayoutNode·三件闭集·糖果水墨皮起手·MMO/超休闲之外的「剧情向」对位）。 */
export function buildDialogueScene(): LayoutNode {
  return {
    type: 'Panel', id: 'vn-hud',
    props: { bg: { custom: '#efe6d6' }, vignette: true }, // 实底暖宣纸色（ui-audit 能读实底·亮皮深字对比可量）
    layout: { width: STAGE_W, height: STAGE_H, direction: 'column', gap: 14, padding: 16 },
    children: [
      // ① 场景条：地点 + 章节（Tag pill）。
      { type: 'Panel', id: 'vn-top', props: { bare: true }, layout: { direction: 'row', align: 'center', justify: 'between' },
        children: [
          { type: 'Label', id: 'vn-place', props: { text: '第三章 · 雨夜书斋', size: 'sm', color: 'sub', font: 'serif' } },
          { type: 'Tag', id: 'vn-affinity', props: { label: '好感 8', icon: '💗', tone: 'accent', size: 'lg' } },
        ] },

      // ② 立绘台：主角立绘（active·warm）+ 玩家侧影（dim·side right）。
      { type: 'Panel', id: 'vn-stage', props: { bare: true }, layout: { direction: 'row', align: 'end', justify: 'between', gap: 10 },
        children: [
          { type: 'portrait', id: 'vn-por-a', props: { name: '林清越', emotion: 'warm', side: 'left' }, layout: { width: 168, height: 236 } },
          { type: 'Particles', id: 'vn-amb', props: { kind: 'sparkle', count: 12, loop: true } },
          { type: 'portrait', id: 'vn-por-b', props: { name: '你', emotion: 'calm', side: 'right' }, layout: { width: 120, height: 176, opacity: 0.85 } },
        ] },

      // ③ 台词框：说话人 + 台词（打字机逐字）+ 情绪键。line 节点整框可点推进。
      { type: 'dialog', id: 'vn-say',
        props: { speaker: '林清越', text: '你终于来了……这场雨，我等了很久。要不要陪我把这局棋下完？', emotion: 'warm', kind: 'line', typewriter: 28 } },

      // ④ 选项列表：三选项·第三条好感门控（available:false → 灰显不可点）。选中发 dialogue.choose+下标。
      { type: 'choiceList', id: 'vn-pick',
        props: { options: [
          { label: '「我来了，就没打算走。」' },
          { label: '「棋盘我可下不过你。」' },
          { label: '「握住她的手（需好感 ≥ 12）」', available: false },
        ] } },

      // ⑤ 脚注：投影说明（本展台 literal·真游戏 bind=对话实体 → resolveDialogue 读世界）。
      { type: 'Label', id: 'vn-note', props: {
        text: '闭集三件 · 写世界=dialogue.advance/choose 信号 · 读世界=resolveDialogue(bind) 投影当前节点',
        size: 'xs', color: 'sub' }, layout: { align: 'center' } },
    ],
  };
}
