// Game I · 剧情 · 伴侣在场件 presence（buildPresenceDemo）—— REQ-DIALOGUE M3 活范例。
//   非剧情小对局叠一层「伴侣反应」：赢/险胜/惜败/发呆 各由反应表 pickReaction 选情绪+台词，
//   buildPresence 用 M1 三件（立绘 + 被动台词气泡）拼成在场件。纯 LayoutNode·确定性选句·起手皮 apollo-toon。
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { buildPresence, pickReaction, SAMPLE_REACTIONS } from '@zerocraft/engine/ui/starters/index.js';

const CASES: Array<{ event: string; label: string; seed: number }> = [
  { event: 'win', label: '🏆 赢了', seed: 3 },
  { event: 'bigPlay', label: '⚡ 险胜', seed: 7 },
  { event: 'lose', label: '💧 惜败', seed: 2 },
  { event: 'idle', label: '💭 发呆', seed: 5 },
];

/** 伴侣在场件展台（四 event 各一个在场件·反应表选情绪+台词·M1 三件拼装）。 */
export function buildPresenceDemo(): LayoutNode {
  return {
    type: 'Panel', id: 'pres-hud',
    props: { bg: { custom: '#efe6d6' }, vignette: true },
    layout: { width: 456, height: 720, direction: 'column', gap: 12, padding: 16 },
    children: [
      { type: 'Label', id: 'pres-t', props: { text: '伴侣在场件 · 非剧情对局叠一层反应', size: 'md', bold: true, color: 'text', font: 'serif' }, layout: { align: 'center' } },
      { type: 'Label', id: 'pres-sub', props: { text: 'gameEvent → 反应表 pickReaction(种子选句·确定性) → buildPresence（立绘 + 被动气泡·M1 三件）', size: 'xs', color: 'sub' }, layout: { align: 'center' } },
      ...CASES.map((c): LayoutNode => ({
        type: 'Panel', id: `pres-row-${c.event}`, props: { accent: true }, layout: { direction: 'column', gap: 6, padding: 10 },
        children: [
          { type: 'Label', id: `pres-lbl-${c.event}`, props: { text: c.label, size: 'sm', bold: true, color: 'gold' } },
          { ...buildPresence({ name: '林清越', side: 'left', reaction: pickReaction(SAMPLE_REACTIONS, c.event, c.seed)!, id: `pres-${c.event}` }) },
        ],
      })),
    ],
  };
}
