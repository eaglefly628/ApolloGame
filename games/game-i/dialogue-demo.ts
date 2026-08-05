// Game I · 剧情 · VN 对话三件（buildDialogueScene）—— REQ-DIALOGUE M1 活范例（真跑·Lead 整改后）。
//   闭集 VN 控件三件（portrait 立绘 / dialog 台词框 / choiceList 选项）拼一幕约会性剧情屏，纯 LayoutNode 数据。
//   三控件带 bind='vn-dlg'（对话实体 id）——game-i 宿主起真 dialogueCapability 世界（dialogue-world.ts），
//   render 前跑 resolveDialogue(tree, world.source) 从世界**当前节点**投影 speaker/text/emotion/options+逐项可选性；
//   点台词框真发 dialogue.advance、点选项真发 dialogue.choose+下标 → 世界 tick 推进 → 每帧重投影刷新。
//   写世界=信号（t3-dialogue 认 arg 串·无需游戏 handler）；读世界=resolveDialogue 结构投影。
//   下方 literal props = 无世界时（audit/独立预览）的静态兜底，运行时被世界投影覆盖。起手皮=apollo-toon。
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';

const STAGE_W = 456, STAGE_H = 720;

/** VN 对话屏（纯 LayoutNode·三件闭集·糖果水墨皮起手·MMO/超休闲之外的「剧情向」对位）。 */
export function buildDialogueScene(): LayoutNode {
  return {
    type: 'Panel', id: 'vn-hud',
    props: { bg: { custom: '#efe6d6' }, vignette: true }, // 实底暖宣纸色（ui-audit 能读实底·亮皮深字对比可量）
    layout: { width: STAGE_W, height: STAGE_H, direction: 'column', gap: 14, padding: 16 },
    children: [
      // ① 场景条：地点 + 好感 pill（bind:'aff' 活值·选暖场项 → 好感真涨）。
      { type: 'Panel', id: 'vn-top', props: { bare: true }, layout: { direction: 'row', align: 'center', justify: 'between' },
        children: [
          { type: 'Label', id: 'vn-place', props: { text: '第三章 · 雨夜书斋', size: 'sm', color: 'sub', font: 'serif' } },
          { type: 'Panel', id: 'vn-aff', props: { bg: 'gold', shape: 'pill' }, layout: { direction: 'row', align: 'center', gap: 5, padding: 8 },
            children: [
              { type: 'Label', id: 'vn-aff-i', props: { text: '💗', size: 'sm' } },
              { type: 'Label', id: 'vn-aff-n', props: { text: '好感 ', bind: 'aff', size: 'md', bold: true, color: 'ink' } },
            ] },
        ] },

      // ② 立绘台：主角立绘（bind→当前说话人·金描边 + 高亮外发光）+ 玩家侧影（盾形异形框·dim·side right）。
      { type: 'Panel', id: 'vn-stage', props: { bare: true }, layout: { direction: 'row', align: 'end', justify: 'between', gap: 10 },
        children: [
          { type: 'portrait', id: 'vn-por-a', props: { bind: 'vn-dlg', name: '林清越', emotion: 'warm', side: 'left', edge: 'gold', glow: true }, layout: { width: 168, height: 236 } },
          { type: 'Particles', id: 'vn-amb', props: { kind: 'sparkle', count: 12, loop: true } },
          { type: 'portrait', id: 'vn-por-b', props: { name: '你', emotion: 'calm', side: 'right', shape: 'shield' }, layout: { width: 132, height: 188, opacity: 0.9 } },
        ] },

      // ③ 台词框：bind→世界当前节点 speaker/text/emotion/kind（打字机逐字）+ 金描边货架框。line 节点整框可点推进。
      { type: 'dialog', id: 'vn-say',
        props: { bind: 'vn-dlg', speaker: '林清越', text: '你终于来了……这场雨，我等了很久。要不要陪我把这局棋下完？', emotion: 'warm', kind: 'line', typewriter: 28, edge: 'gold' } },

      // ④ 选项列表：bind→choice 节点选项 + 逐项 optionAvailable（第三项好感门控·暖场后真解锁）。
      //    选项渲成 house 糖果厚唇钮（optionKind:primary→吃主题皮·hoverSheen 悬停流光）。选中发 dialogue.choose+下标。
      { type: 'choiceList', id: 'vn-pick',
        props: { bind: 'vn-dlg', optionKind: 'primary', hoverSheen: true, options: [
          { label: '「我来了，就没打算走。」' },
          { label: '「棋盘我可下不过你。」' },
          { label: '「握住她的手（需暖场）」', available: false },
        ] } },

      // ⑤ 脚注：真跑说明（真 dialogueCapability 世界·点击真发信号推进·resolveDialogue 每 tick 真投影刷新）。
      { type: 'Label', id: 'vn-note', props: {
        text: '真跑 · 写世界=dialogue.advance/choose 信号 · 读世界=resolveDialogue(bind) 每 tick 投影当前节点',
        size: 'xs', color: 'sub' }, layout: { align: 'center' } },
    ],
  };
}
