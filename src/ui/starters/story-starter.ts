// 剧情起手屏 · Story Starter（REQ-DIALOGUE M4·PUI 半——@ui/starters 复制即跑的剧情屏模板）。
//
// 对标 buildStarterHome/buildStarterResult：传最小数据即得一屏**已接线**的 VN 剧情屏——
//   portrait 立绘（bind 当前说话人）+ dialog 台词框（bind·点击发 dialogue.advance）+ choiceList 选项（bind·选中发 dialogue.choose+下标）
//   + 可选好感 pill（bind Resource）+ M2 表情链（立绘 art 由 DialogueSource 经投影按节点情绪出图·分级降级）。house 主题（STARTER_THEME）+ 金框货架起手。
// 复制即跑：游戏 `renderNode(resolveBindings(resolveDialogue(buildStoryStarter({dialogueEntityId}), dsrc), ds), STARTER_THEME)`
//   → mountUI(host, tree, {}, STARTER_THEME, actionSink)。dialog/choiceList/portrait 的 bind 由 resolveDialogue 从世界当前节点投影
//   （立绘换脸：DialogueSource.current().art 走 M2 emotionArtResolver 出图·见 emotion-art.ts）。
// 红线不破：纯 LayoutNode 数据（M1 闭集控件）·写世界=action 信号·非新控件（全用 M1 三件 + Panel/Label 拼装）。
import type { LayoutNode } from '@ui/components/index.js';

export function buildStoryStarter(o: {
  dialogueEntityId: string;                                 // bind 目标：对话实体 id（resolveDialogue 投影 speaker/text/emotion/art/options）
  speakerName?: string;                                     // 主立绘名兜底（缺省由投影 speaker 覆盖）
  listenerName?: string;                                    // 玩家侧立绘名（缺省 '你'）
  place?: string;                                           // 场景条文字（章节/地点）
  affinityBind?: string;                                    // 好感 Resource id（给了则显金 pill·bind 活值）
  affinityLabel?: string;                                   // 好感 pill 前缀（缺省 '好感 '）
  id?: string;
}): LayoutNode {
  const rootId = o.id ?? 'story';
  const eid = o.dialogueEntityId;
  const topRight: LayoutNode[] = o.affinityBind
    ? [{ type: 'Panel', id: `${rootId}-aff`, props: { bg: 'gold', shape: 'pill' }, layout: { direction: 'row', align: 'center', gap: 5, padding: 8 },
        children: [
          { type: 'Label', id: `${rootId}-aff-i`, props: { text: '💗', size: 'sm' } },
          { type: 'Label', id: `${rootId}-aff-n`, props: { text: o.affinityLabel ?? '好感 ', bind: o.affinityBind, size: 'md', bold: true, color: 'ink' } },
        ] }]
    : [];
  return {
    type: 'Screen', id: rootId, props: { center: false, fill: true },
    layout: { direction: 'column', gap: 14, padding: 16 },
    children: [
      // 环境微光（house 起手「活」的底噪）。
      { type: 'Particles', id: `${rootId}-amb`, props: { kind: 'sparkle', count: 12, loop: true } },
      // ① 场景条：地点 + 可选好感 pill。
      { type: 'Panel', id: `${rootId}-top`, props: { bare: true }, layout: { direction: 'row', align: 'center', justify: 'between' },
        children: [
          { type: 'Label', id: `${rootId}-place`, props: { text: o.place ?? '', size: 'sm', color: 'sub', font: 'serif' } },
          ...topRight,
        ] },
      // ② 立绘台：主说话人（bind·金框高亮）+ 玩家侧影（盾形·dim）。
      { type: 'Panel', id: `${rootId}-stage`, props: { bare: true }, layout: { direction: 'row', align: 'end', justify: 'between', gap: 10, flex: 1 },
        children: [
          { type: 'portrait', id: `${rootId}-por-a`, props: { bind: eid, name: o.speakerName, side: 'left', edge: 'gold', glow: true }, layout: { width: 168, height: 236 } },
          { type: 'portrait', id: `${rootId}-por-b`, props: { name: o.listenerName ?? '你', side: 'right', shape: 'shield' }, layout: { width: 128, height: 180, opacity: 0.9 } },
        ] },
      // ③ 台词框：bind 当前节点 speaker/text/kind（打字机）+ 金框。line/check 整框点击发 dialogue.advance。
      { type: 'dialog', id: `${rootId}-say`, props: { bind: eid, speaker: o.speakerName, kind: 'line', typewriter: 28, edge: 'gold' } },
      // ④ 选项列：bind choice 节点选项 + optionAvailable（house 糖果厚唇钮 + 悬停流光）。选中发 dialogue.choose+下标。
      { type: 'choiceList', id: `${rootId}-pick`, props: { bind: eid, optionKind: 'primary', hoverSheen: true } },
    ],
  };
}
