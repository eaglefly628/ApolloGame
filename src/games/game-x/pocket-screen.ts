// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— Pocket Mode 屏幕（LayoutNode 占位实现，等设计层重做）
//
//  基础框架：拿起设备后的对话界面。立绘 + 第一句问候 + 当前对话行 + 选项/继续 + 放回。
//  写世界只发 dialogue.advance / dialogue.choose 信号；放回发 mode.dock 信号。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@ui/components/index.js';
import type { DialogueNode } from '@skills/tier3/index.js';
import { DIALOGUE_ACTION_ADVANCE, DIALOGUE_ACTION_CHOOSE } from '@skills/tier3/index.js';
import type { Companion } from './characters.js';
import { portraitUri } from './scenes.js';
import type { ScheduleEntry } from './characters.js';

export interface PocketView {
  node: DialogueNode | undefined;
  pose: ScheduleEntry['pose'];
  greeting: string; // 拿起时的第一句话（按情境派生）
  warmth: number;
  choices: Array<{ text: string; index: number }>;
  ended: boolean;
}

function speakerOf(n: DialogueNode): string {
  return n.kind === 'line' ? n.speaker : n.speaker ?? '';
}
function textOf(n: DialogueNode): string {
  return n.kind === 'line' ? n.text : n.prompt ?? '';
}
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function actions(v: PocketView): LayoutNode {
  if (v.ended || !v.node) {
    return {
      type: 'Button', id: 'gx-dock',
      props: { label: '🔌 放回底座 · 她继续在桌上生活', kind: 'hero', action: 'mode.dock' },
    };
  }
  if (v.node.kind === 'choice') {
    return {
      type: 'Panel', id: 'gx-choices', props: { bare: true },
      layout: { direction: 'column', gap: 8 },
      children: v.choices.map((c) => ({
        type: 'Button' as const, id: `gx-c-${c.index}`,
        props: { label: c.text, kind: 'primary' as const, action: DIALOGUE_ACTION_CHOOSE, actionArg: String(c.index) },
      })),
    };
  }
  return {
    type: 'Button', id: 'gx-adv',
    props: { label: '继续 ▶', kind: 'hero', action: DIALOGUE_ACTION_ADVANCE },
  };
}

export function pocketScreen(c: Companion, v: PocketView): LayoutNode {
  const node = v.node;
  const line = node ? textOf(node) : '';
  const speaker = node ? speakerOf(node) : c.name;
  return {
    type: 'Screen', id: 'gx-pocket',
    props: { center: true, bg: '#12101a' },
    layout: { direction: 'column', padding: 0 },
    children: [
      {
        type: 'Panel', id: 'gx-pframe', props: { bare: true },
        layout: { width: 640, height: 480, direction: 'column', gap: 12, padding: 18, justify: 'start' },
        children: [
          { type: 'Label', id: 'gx-greet', props: { text: `「${v.greeting}」`, size: 'md', color: 'gold', bold: true } },
          {
            type: 'Panel', id: 'gx-pstage', props: { accent: true },
            layout: { direction: 'row', gap: 16, padding: 14, flex: 1, align: 'stretch' },
            children: [
              { type: 'Image', id: 'gx-pportrait', props: { src: portraitUri(c, v.pose), fit: 'contain' }, layout: { width: 170, height: 200 } },
              {
                type: 'Panel', id: 'gx-ptext', props: { bare: true },
                layout: { direction: 'column', gap: 10, flex: 1, justify: 'start' },
                children: [
                  { type: 'Label', id: 'gx-pspeaker', props: { text: speaker, size: 'lg', bold: true, color: 'jade' } },
                  { type: 'Label', id: `gx-pline-${hash(line)}`, props: { text: line, size: 'md', color: 'text', typewriter: 26 } },
                ],
              },
            ],
          },
          {
            type: 'Panel', id: 'gx-pwarm', props: { bare: true },
            layout: { direction: 'row', gap: 8, align: 'center' },
            children: [
              { type: 'Label', id: 'gx-pwl', props: { text: '此刻的暖意', size: 'sm', color: 'sub' }, layout: { width: 88 } },
              { type: 'ProgressBar', id: 'gx-pw', props: { value: v.warmth, max: 100, tone: 'danger' }, layout: { flex: 1 } },
            ],
          },
          actions(v),
        ],
      },
    ],
  };
}
