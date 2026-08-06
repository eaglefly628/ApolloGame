// Game I · 剧情 · 伴侣在场件 presence（buildPresenceDemo）—— REQ-DIALOGUE M3 + M2 表情链 活范例。
//   非剧情小对局叠一层「伴侣反应」：赢/险胜/惜败/发呆 各由反应表 pickReaction 选情绪+台词，
//   buildPresence 用 M1 三件（立绘 + 被动台词气泡）拼成在场件；立绘经 M2 emotionArtResolver 按情绪出图（分级降级）。
//   纯 LayoutNode·确定性选句·起手皮 apollo-toon。demoResolveAsset=**程序化占位**（真图走美术台账·此处只演接线链）。
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { buildPresence, pickReaction, SAMPLE_REACTIONS, emotionArtResolver, SAMPLE_EMOTION_ART } from '@zerocraft/engine/ui/starters/index.js';

const CASES: Array<{ event: string; label: string; seed: number }> = [
  { event: 'win', label: '🏆 赢了', seed: 3 },
  { event: 'bigPlay', label: '⚡ 险胜', seed: 7 },
  { event: 'lose', label: '💧 惜败', seed: 2 },
  { event: 'idle', label: '💭 发呆', seed: 5 },
];

// 程序化占位立绘（demo·非真图）：情绪→色·出一张 tinted 圆脸 data-URI。演 M2 链「情绪→key→URL」的出图端。
// SAMPLE_EMOTION_ART 有 neutral/happy/warm/shy/excited；lose/idle 的情绪(gentle/calm)不在表 → 降级 neutral（可见降级）。
const EMO_COLOR: Record<string, string> = { happy: '#E8A13A', warm: '#D8503F', shy: '#8A5A7A', excited: '#345C68', neutral: '#6E675E' };
function demoResolveAsset(key: string): string | undefined {
  const emo = key.split('/')[1] ?? 'neutral';         // 'lin/happy' → 'happy'
  const col = EMO_COLOR[emo];
  if (!col) return undefined;                          // 无对应色 → 缺图（触发降级/占位）
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="150">` +
    `<rect width="120" height="150" fill="${col}" fill-opacity="0.18"/>` +
    `<circle cx="60" cy="66" r="34" fill="${col}"/>` +
    `<circle cx="49" cy="60" r="4" fill="#fff"/><circle cx="71" cy="60" r="4" fill="#fff"/>` +
    `<path d="M46 78 Q60 ${emo === 'happy' || emo === 'excited' ? 92 : emo === 'shy' ? 74 : 84} 74 78" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/[()']/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
const resolveArt = emotionArtResolver(SAMPLE_EMOTION_ART, '林清越', demoResolveAsset);

/** 伴侣在场件展台（四 event·反应表选情绪+台词·M2 表情链按情绪出图·M1 三件拼装）。 */
export function buildPresenceDemo(): LayoutNode {
  return {
    type: 'Panel', id: 'pres-hud',
    props: { bg: { custom: '#efe6d6' }, vignette: true },
    layout: { width: 456, height: 720, direction: 'column', gap: 12, padding: 16 },
    children: [
      { type: 'Label', id: 'pres-t', props: { text: '伴侣在场件 · 非剧情对局叠一层反应', size: 'md', bold: true, color: 'text', font: 'serif' }, layout: { align: 'center' } },
      { type: 'Label', id: 'pres-sub', props: { text: 'event→pickReaction(种子选句) · emotion→表情链出图(分级降级) · M1 三件拼装', size: 'xs', color: 'sub' }, layout: { align: 'center' } },
      ...CASES.map((c): LayoutNode => ({
        type: 'Panel', id: `pres-row-${c.event}`, props: { accent: true }, layout: { direction: 'column', gap: 6, padding: 10 },
        children: [
          { type: 'Label', id: `pres-lbl-${c.event}`, props: { text: c.label, size: 'sm', bold: true, color: 'gold' } },
          { ...buildPresence({ name: '林清越', side: 'left', reaction: pickReaction(SAMPLE_REACTIONS, c.event, c.seed)!, resolveArt, id: `pres-${c.event}` }) },
        ],
      })),
    ],
  };
}
