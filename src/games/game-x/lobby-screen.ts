// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 大厅：角色选择 / Marketplace（LayoutNode·对齐 Designer SYSTEM frame）
//
//  game-x 的入口屏（"把自己加到 gamex 大厅"）：选择住进来的人 → 进 Desk Mode。
//  完全对齐 bundle：双列卡（七月 OWNED 进入 / Mika 购买 $9.99）+ 社区/男性占位锁卡。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@ui/components/index.js';
import { COMPANIONS, type Companion } from './characters.js';
import { charSpriteUri, wakingSpriteUri } from './scenes.js';

// ── 单张角色卡 ────────────────────────────────────────────────────────
function charCard(c: Companion, owned: boolean): LayoutNode {
  const grad = c.id === 'mika' ? 'linear-gradient(160deg,#46324a,#c07a6e)' : 'linear-gradient(160deg,#2a3346,#46406e)';
  const head: LayoutNode[] = [
    { type: 'Image', id: `gx-card-art-${c.id}`, props: { src: charSpriteUri(c.id), fit: 'contain' }, layout: { width: 84, height: 77 } },
  ];
  if (owned) head.unshift({ type: 'Label', id: `gx-owned-${c.id}`, props: { text: 'OWNED', font: 'pixel', color: 'ok', size: 'xs', tracking: 1 }, layout: { x: 8, y: 8 } });
  return {
    type: 'Panel', id: `gx-card-${c.id}`, props: { bg: '#1c1726' },
    layout: { direction: 'column', width: 286, height: 300 },
    children: [
      // 头图区
      {
        type: 'Panel', id: `gx-cardhead-${c.id}`, props: { bg: grad },
        layout: { width: 286, height: 120, justify: 'center', align: 'end', direction: 'row' },
        children: head,
      },
      // 信息区
      {
        type: 'Panel', id: `gx-cardbody-${c.id}`, props: { bare: true },
        layout: { direction: 'column', gap: 6, padding: 12, flex: 1 },
        children: [
          { type: 'Label', id: `gx-cn-${c.id}`, props: { text: c.name, color: 'text', size: 'lg' } },
          { type: 'Label', id: `gx-cp-${c.id}`, props: { text: c.id === 'mika' ? '活泼 · 跳脱 · 话多' : '内敛 · 细腻 · 有点冷', color: c.id === 'mika' ? 'jade' : 'sub', size: 'sm' }, layout: { flex: 1 } },
          owned
            ? { type: 'Button', id: `gx-enter-${c.id}`, props: { label: '进入', kind: 'primary', action: 'lobby.enter', actionArg: c.id } }
            : { type: 'Button', id: `gx-buy-${c.id}`, props: { label: '购买 · $9.99', kind: 'hero', action: 'lobby.enter', actionArg: c.id } },
        ],
      },
    ],
  };
}

// ── 占位锁卡（社区 / 男性·COMING SOON）─────────────────────────────────
function lockCard(id: string, icon: string, label: string, tag: string): LayoutNode {
  return {
    type: 'Panel', id, props: { bare: true },
    layout: { direction: 'column', width: 286, height: 300, justify: 'center', align: 'center', gap: 8 },
    children: [
      { type: 'Label', id: `${id}-i`, props: { text: icon, size: 'xl', color: 'dim' } },
      { type: 'Label', id: `${id}-l`, props: { text: label, color: 'dim', size: 'sm' } },
      { type: 'Label', id: `${id}-t`, props: { text: tag, font: 'pixel', color: 'dim', size: 'xs', tracking: 1 } },
    ],
  };
}

export function lobbyScreen(owned: Record<string, boolean>): LayoutNode {
  const [qiyue, mika] = COMPANIONS;
  return {
    type: 'Screen', id: 'gx-lobby', props: { center: true, bg: '#05060a' },
    layout: { direction: 'column', padding: 0 },
    children: [
      {
        type: 'Panel', id: 'gx-lobwrap', props: { bare: true }, layout: { direction: 'column', gap: 6 },
        children: [
          {
            type: 'Panel', id: 'gx-lobtitle', props: { bare: true }, layout: { direction: 'row', justify: 'between', align: 'end', width: 640 },
            children: [
              { type: 'Label', id: 'gx-lobt', props: { text: '选择住进来的人', color: 'text', size: 'lg' } },
              { type: 'Label', id: 'gx-lobm', props: { text: 'MARKETPLACE', font: 'pixel', color: 'dim', size: 'xs', tracking: 1 } },
            ],
          },
          {
            type: 'Panel', id: 'gx-device-l', props: { bg: '#0a0810' },
            layout: { width: 660, height: 500, padding: 10, direction: 'column' },
            children: [
              {
                type: 'Panel', id: 'gx-lobgrid', props: { bg: '#15101f' },
                layout: { width: 640, height: 480, direction: 'grid', minCol: 286, gap: 14, padding: 18 },
                children: [
                  charCard(qiyue, owned[qiyue.id] ?? true),
                  charCard(mika, owned[mika.id] ?? false),
                  lockCard('gx-lock-comm', '＋', '社区角色', 'COMING SOON'),
                  lockCard('gx-lock-male', '🔒', '男性角色', 'PLANNED'),
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

// ── 开机引导屏（初次见面·对齐 bundle boot）─────────────────────────────
export function bootScreen(c: Companion): LayoutNode {
  return {
    type: 'Screen', id: 'gx-boot', props: { center: true, bg: '#0c0a12' },
    layout: { direction: 'column', padding: 0 },
    children: [
      {
        type: 'Panel', id: 'gx-bootdev', props: { bg: '#0a0810' },
        layout: { width: 660, height: 500, padding: 10 },
        children: [
          {
            type: 'Panel', id: 'gx-bootin', props: { bg: '#0c0a12' },
            layout: { width: 640, height: 480, direction: 'column', justify: 'center', align: 'center', gap: 20, padding: 40 },
            children: [
              { type: 'Label', id: 'gx-boot-brand', props: { text: 'REMNANT POCKET', font: 'pixel', color: 'dim', size: 'sm', tracking: 4 } },
              { type: 'Image', id: 'gx-boot-art', props: { src: wakingSpriteUri(), fit: 'contain' }, layout: { width: 120, height: 140 } },
              { type: 'Label', id: 'gx-boot-hi', props: { text: '……你好。', color: 'text', size: 'xl' } },
              { type: 'Label', id: 'gx-boot-intro', props: { text: `我是${c.id === 'mika' ? 'Mika' : '七月'}。从现在开始，我会住在这里。`, color: 'sub', size: 'md' } },
              {
                type: 'Panel', id: 'gx-boot-hint', props: { bg: '#16121f' },
                layout: { direction: 'row', gap: 10, align: 'center', padding: 12 },
                children: [
                  { type: 'Label', id: 'gx-boot-mag', props: { text: '🧲 把设备放回底座，她就会在桌上生活', color: 'sub', size: 'sm' } },
                ],
              },
              { type: 'Button', id: 'gx-boot-go', props: { label: '放上底座 ▶', kind: 'hero', action: 'boot.dock' } },
            ],
          },
        ],
      },
    ],
  };
}
