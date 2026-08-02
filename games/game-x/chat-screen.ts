// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 聊天屏（chat-bubble UI·对齐 Designer Pocket 记忆屏）
//
//  渲染对话引擎当前态：顶栏(头像/称呼/心情/时钟) + 气泡区(她的左蓝边/你的右暖色)
//  + 底部话题菜单(choice 节点的选项) 或 继续/放回(line/end)。全 LayoutNode 数据。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@ui/components/index.js';
import { deviceShell } from './device-frame.js';
import { charSpriteUri } from './scenes.js';
import type { Companion } from './characters.js';

export interface ChatView {
  address: string; // 称呼（按阶段）
  mood: string; // 心情一句
  clock: string; // HH:MM
  bond: number; // 0..100
  herLine: string; // 她当前这句（choice→prompt / line→台词）
  yourLine: string; // 你上一句（回声·可空）
  kind: 'choice' | 'line' | 'end';
  options: Array<{ text: string; index: number }>;
}

function bubbleHer(id: string, text: string): LayoutNode {
  return {
    type: 'Panel', id, props: { bg: { custom: '#211a30' } },
    layout: { direction: 'row', gap: 0, padding: 0, width: 420 },
    children: [
      { type: 'Panel', id: `${id}-bar`, props: { bg: { custom: '#5a7a9a' } }, layout: { width: 3, height: 1 } },
      { type: 'Panel', id: `${id}-body`, props: { bare: true }, layout: { padding: 11, flex: 1 },
        children: [{ type: 'Label', id: `${id}-t`, props: { text, color: 'text', size: 'md' } }] },
    ],
  };
}
function bubbleYou(id: string, text: string): LayoutNode {
  return {
    type: 'Panel', id, props: { bg: { custom: '#2a2410' } },
    layout: { padding: 11, width: 360, align: 'end' },
    children: [{ type: 'Label', id: `${id}-t`, props: { text, color: 'warn', size: 'md' } }],
  };
}

export function chatScreen(c: Companion, v: ChatView): LayoutNode {
  const msgs: LayoutNode[] = [];
  if (v.yourLine) msgs.push({ type: 'Panel', id: 'gx-chat-you-row', props: { bare: true }, layout: { direction: 'row', justify: 'end', width: 600 }, children: [bubbleYou('gx-chat-you', v.yourLine)] });
  msgs.push({ type: 'Panel', id: 'gx-chat-her-row', props: { bare: true }, layout: { direction: 'row', width: 600 }, children: [bubbleHer('gx-chat-her', v.herLine)] });

  // 底部：choice → 话题菜单按钮；line → 继续；end → 放回。
  let foot: LayoutNode;
  if (v.kind === 'choice') {
    foot = {
      type: 'Panel', id: 'gx-chat-topics', props: { bare: true },
      layout: { direction: 'column', gap: 7, width: 600, padding: 4 },
      children: v.options.map((o) => ({
        type: 'Button' as const, id: `gx-chat-opt-${o.index}`,
        props: { label: o.text, kind: 'primary' as const, action: 'chat.choose', actionArg: String(o.index) },
      })),
    };
  } else if (v.kind === 'line') {
    foot = { type: 'Button', id: 'gx-chat-adv', props: { label: '继续 ▶', kind: 'hero', action: 'chat.advance' } };
  } else {
    foot = { type: 'Button', id: 'gx-chat-dock', props: { label: '🔌 放回底座', kind: 'hero', action: 'mode.dock' } };
  }

  return deviceShell({
    id: 'gx-chat',
    chip: `和 ${c.name} 聊天`,
    interior: [
      // 顶栏
      {
        type: 'Panel', id: 'gx-chat-head', props: { bg: { custom: 'linear-gradient(180deg,#3a2f48,#1d182a)' } },
        layout: { direction: 'row', gap: 12, align: 'center', padding: 12, width: 640, height: 64 },
        children: [
          { type: 'Image', id: 'gx-chat-av', props: { src: charSpriteUri(c.id), fit: 'contain' }, layout: { width: 40, height: 40 } },
          {
            type: 'Panel', id: 'gx-chat-name', props: { bare: true }, layout: { direction: 'column', flex: 1 },
            children: [
              { type: 'Label', id: 'gx-chat-n', props: { text: c.name, color: 'text', size: 'md' } },
              { type: 'Label', id: 'gx-chat-mood', props: { text: `· ${v.mood} · 称你「${v.address}」`, color: 'sub', size: 'xs' } },
            ],
          },
          { type: 'Label', id: 'gx-chat-clock', props: { text: v.clock, font: 'display', color: 'gold', size: 'lg' } },
        ],
      },
      // 气泡区
      {
        type: 'Panel', id: 'gx-chat-body', props: { bare: true },
        layout: { direction: 'column', gap: 11, padding: 16, flex: 1, justify: 'start', width: 640, height: 300 },
        children: msgs,
      },
      // 羁绊细条
      {
        type: 'Panel', id: 'gx-chat-bondrow', props: { bare: true },
        layout: { direction: 'row', gap: 8, align: 'center', padding: 10, width: 640 },
        children: [
          { type: 'Label', id: 'gx-chat-bl', props: { text: '💗', size: 'sm' } },
          { type: 'ProgressBar', id: 'gx-chat-bond', props: { value: v.bond, max: 100, tone: 'danger' }, layout: { flex: 1 } },
        ],
      },
      // 底部动作
      { type: 'Panel', id: 'gx-chat-foot', props: { bare: true }, layout: { direction: 'column', padding: 10, width: 640, justify: 'center', align: 'stretch' }, children: [foot] },
    ],
  });
}
