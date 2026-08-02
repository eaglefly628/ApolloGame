// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— Pocket Mode 互动中枢 + 子屏（GDD §六/七/八）
//
//  拿起后的主菜单（六入口·按阶段解锁）+ 关心/送礼/靠近/回忆档案/反应屏。
//  全 LayoutNode 数据；写世界只发信号。陪伴内容在这里铺开。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@ui/components/index.js';
import { deviceShell } from './device-frame.js';
import { charSpriteUri } from './scenes.js';
import type { Companion } from './characters.js';
import type { SessionRecord, RelationStage } from './companion.js';
import { GIFTS } from './gifts.js';
import { MEMORY_DEX, STAGE_LABEL, bondOf, memoriesOf, albumOf } from './record.js';

export interface HubCtx { mood: string; address: string; stage: RelationStage; bond: number; clock: string }

function header(c: Companion, ctx: HubCtx): LayoutNode {
  return {
    type: 'Panel', id: 'gx-hub-head', props: { bg: { custom: 'linear-gradient(180deg,#3a2f48,#1d182a)' } },
    layout: { direction: 'row', gap: 12, align: 'center', padding: 12, width: 640, height: 64 },
    children: [
      { type: 'Image', id: 'gx-hub-av', props: { src: charSpriteUri(c.id), fit: 'contain' }, layout: { width: 40, height: 40 } },
      {
        type: 'Panel', id: 'gx-hub-name', props: { bare: true }, layout: { direction: 'column', flex: 1 },
        children: [
          { type: 'Label', id: 'gx-hub-n', props: { text: `${c.name} · ${STAGE_LABEL[ctx.stage]}`, color: 'text', size: 'md' } },
          { type: 'Label', id: 'gx-hub-m', props: { text: `· ${ctx.mood} · 称你「${ctx.address}」`, color: 'sub', size: 'xs' } },
        ],
      },
      { type: 'Label', id: 'gx-hub-clock', props: { text: ctx.clock, font: 'display', color: 'gold', size: 'lg' } },
    ],
  };
}

function entry(id: string, icon: string, label: string, sub: string, action: string): LayoutNode {
  return {
    type: 'Panel', id: `gx-hub-e-${id}`, props: { bg: { custom: '#1c1726' } },
    layout: { direction: 'row', gap: 12, align: 'center', padding: 14, width: 600 },
    children: [
      { type: 'Label', id: `gx-hub-ei-${id}`, props: { text: icon, size: 'xl' } },
      {
        type: 'Panel', id: `gx-hub-et-${id}`, props: { bare: true }, layout: { direction: 'column', flex: 1, gap: 2 },
        children: [
          { type: 'Label', id: `gx-hub-el-${id}`, props: { text: label, color: 'text', size: 'md' } },
          { type: 'Label', id: `gx-hub-es-${id}`, props: { text: sub, color: 'sub', size: 'xs' } },
        ],
      },
      { type: 'Button', id: `gx-hub-go-${id}`, props: { label: '▶', kind: 'ghost', action } },
    ],
  };
}

// ── 互动中枢（六入口·按阶段解锁）──
export function pocketHub(c: Companion, ctx: HubCtx): LayoutNode {
  const entries: LayoutNode[] = [
    entry('chat', '💬', '聊天', '说话、听她说、说我的事', 'chat.open'),
    entry('act', '🎐', '一起做事', '听歌 / 散步 / 猜你的一天', 'weekend.open'),
    entry('care', '☕', '关心她', '送礼 / 问候 / 陪她安静', 'care.open'),
  ];
  if (ctx.stage !== 'acquaint') entries.push(entry('near', '🤍', '靠近她', '摸头 / 牵手 / 并肩', 'intimacy.open'));
  entries.push(entry('mem', '📖', '回忆与档案', '相册 / 懂你档案 / 纪念日', 'memories.open'));
  return deviceShell({
    id: 'gx-pockethub', chip: `和 ${c.name} 相处`,
    interior: [
      header(c, ctx),
      {
        type: 'Panel', id: 'gx-hub-list', props: { scroll: true, bare: true },
        layout: { direction: 'column', gap: 9, padding: 16, flex: 1, width: 640, justify: 'start' },
        children: entries,
      },
      { type: 'Panel', id: 'gx-hub-foot', props: { bare: true }, layout: { padding: 10, width: 640, align: 'stretch', direction: 'column' },
        children: [{ type: 'Button', id: 'gx-hub-dock', props: { label: '🔌 放回底座', kind: 'hero', action: 'mode.dock' } }] },
    ],
  });
}

// ── 关心她（小菜单）──
export function careScreen(c: Companion): LayoutNode {
  const item = (id: string, label: string, action: string): LayoutNode => ({
    type: 'Button', id: `gx-care-${id}`, props: { label, kind: 'primary', action }, layout: { width: 440 },
  });
  return deviceShell({
    id: 'gx-care', chip: '关心她',
    interior: [{
      type: 'Panel', id: 'gx-care-list', props: { bare: true },
      layout: { direction: 'column', gap: 14, padding: 28, justify: 'center', align: 'center', width: 640, height: 480 },
      children: [
        { type: 'Label', id: 'gx-care-t', props: { text: '想为她做点什么？', color: 'text', size: 'lg' } },
        item('gift', '🎁 送她一件礼物', 'care.gifts'),
        item('greet', '☕ 问她累不累', 'care.greet'),
        item('quiet', '🤍 就这样陪她安静一会儿', 'care.quiet'),
        item('back', '◀ 回去', 'pocket.hub'),
      ],
    }],
  });
}

// ── 礼物选择（网格）──
export function giftScreen(c: Companion, given: string[]): LayoutNode {
  return deviceShell({
    id: 'gx-gift', chip: '送她一件礼物',
    interior: [
      { type: 'Panel', id: 'gx-gift-head', props: { bare: true }, layout: { direction: 'row', justify: 'between', align: 'end', padding: 16, width: 640 },
        children: [
          { type: 'Label', id: 'gx-gift-t', props: { text: '挑一件送给她', color: 'text', size: 'lg' } },
          { type: 'Button', id: 'gx-gift-back', props: { label: '◀ 回去', kind: 'ghost', action: 'care.open' } },
        ] },
      {
        type: 'Panel', id: 'gx-gift-grid', props: { bare: true },
        layout: { direction: 'grid', minCol: 180, gap: 12, padding: 16, width: 640, flex: 1 },
        children: GIFTS.map((g) => ({
          type: 'Panel' as const, id: `gx-gift-${g.id}`, props: { bg: { custom: '#1c1726' } },
          layout: { direction: 'column', gap: 6, padding: 14, align: 'center' },
          children: [
            { type: 'Label' as const, id: `gx-gift-i-${g.id}`, props: { text: g.icon, size: 'xl' as const } },
            { type: 'Label' as const, id: `gx-gift-n-${g.id}`, props: { text: g.name, color: 'text' as const, size: 'sm' as const } },
            { type: 'Button' as const, id: `gx-gift-go-${g.id}`, props: { label: given.includes(g.id) ? '再送一次' : '送给她', kind: 'primary' as const, action: 'care.give', actionArg: g.id } },
          ],
        })),
      },
    ],
  });
}

// ── 靠近她（阶段门控）──
export function intimacyScreen(c: Companion, stageNum: number): LayoutNode {
  const acts: LayoutNode[] = [
    { type: 'Button', id: 'gx-near-head', props: { label: '🤍 摸摸她的头', kind: 'primary', action: 'intimacy.act', actionArg: 'head' }, layout: { width: 440 } },
  ];
  if (stageNum >= 2) {
    acts.push({ type: 'Button', id: 'gx-near-hand', props: { label: '🤝 牵她的手', kind: 'primary', action: 'intimacy.act', actionArg: 'hand' }, layout: { width: 440 } });
    acts.push({ type: 'Button', id: 'gx-near-lean', props: { label: '🫂 并肩靠一会儿', kind: 'primary', action: 'intimacy.act', actionArg: 'lean' }, layout: { width: 440 } });
  }
  acts.push({ type: 'Button', id: 'gx-near-back', props: { label: '◀ 回去', kind: 'ghost', action: 'pocket.hub' }, layout: { width: 440 } });
  return deviceShell({
    id: 'gx-intimacy', chip: '靠近她',
    interior: [{
      type: 'Panel', id: 'gx-near-list', props: { bare: true },
      layout: { direction: 'column', gap: 14, padding: 28, justify: 'center', align: 'center', width: 640, height: 480 },
      children: [
        { type: 'Label', id: 'gx-near-t', props: { text: stageNum >= 2 ? '你们已经很近了。' : '试着，离她近一点。', color: 'text', size: 'lg' } },
        ...acts,
      ],
    }],
  });
}

// ── 回忆与档案（相册 + 懂你档案 + 纪念日 + 阶段/羁绊 + 她的人生线）──
export function memoriesScreen(c: Companion, rec: SessionRecord, ctx: HubCtx, daysTogether: number): LayoutNode {
  const mems = memoriesOf(rec).map((m) => MEMORY_DEX[m]).filter(Boolean);
  const album = albumOf(rec);
  const section = (id: string, title: string, body: LayoutNode[]): LayoutNode => ({
    type: 'Panel', id: `gx-mem-s-${id}`, props: { bg: { custom: '#1c1726' } },
    layout: { direction: 'column', gap: 6, padding: 14, width: 600 },
    children: [{ type: 'Label', id: `gx-mem-st-${id}`, props: { text: title, font: 'pixel', color: 'dim', size: 'xs', tracking: 2 } }, ...body],
  });
  const line = (id: string, text: string, color: 'text' | 'sub' = 'sub'): LayoutNode => ({ type: 'Label', id, props: { text, color, size: 'sm' } });
  return deviceShell({
    id: 'gx-memories', chip: '回忆与档案',
    interior: [
      { type: 'Panel', id: 'gx-mem-head', props: { bare: true }, layout: { direction: 'row', justify: 'between', align: 'end', padding: 16, width: 640 },
        children: [
          { type: 'Label', id: 'gx-mem-t', props: { text: `你们 · ${STAGE_LABEL[ctx.stage]}`, color: 'text', size: 'lg' } },
          { type: 'Button', id: 'gx-mem-back', props: { label: '◀ 回去', kind: 'ghost', action: 'pocket.hub' } },
        ] },
      {
        type: 'Panel', id: 'gx-mem-list', props: { scroll: true, bare: true },
        layout: { direction: 'column', gap: 10, padding: 16, flex: 1, width: 640, justify: 'start' },
        children: [
          section('bond', '羁绊', [{ type: 'ProgressBar', id: 'gx-mem-bond', props: { value: bondOf(rec), max: 100, tone: 'danger', showValue: true } }]),
          section('know', '她了解你的', mems.length ? mems.map((m, i) => line(`gx-mem-k${i}`, `· ${m}`)) : [line('gx-mem-k0', '还没说过关于自己的事。')]),
          section('album', '共同记忆', album.length ? album.slice(-6).map((a, i) => line(`gx-mem-a${i}`, `· ${a.title}（${a.day}）`, 'text')) : [line('gx-mem-a0', '还没有一起经历的事。')]),
          section('anni', '纪念日', [line('gx-mem-anni', rec.firstMetMs ? `你们已经一起 ${Math.max(0, Math.floor(daysTogether))} 天了。` : '从今天开始。')]),
          section('goal', '她在忙的事', [line('gx-mem-goal', c.id === 'mika' ? '在攒画稿，想办第一次个展。' : '在写硕士论文，离投稿不远了。')]),
        ],
      },
    ],
  });
}

// ── 反应屏（通用·她的一句反应 + 返回）──
export function reactionScreen(c: Companion, text: string, backAction: string): LayoutNode {
  return deviceShell({
    id: 'gx-react', chip: c.name,
    interior: [{
      type: 'Panel', id: 'gx-react-box', props: { bare: true },
      layout: { direction: 'column', gap: 18, padding: 36, justify: 'center', align: 'center', width: 640, height: 480 },
      children: [
        { type: 'Image', id: 'gx-react-av', props: { src: charSpriteUri(c.id), fit: 'contain' }, layout: { width: 110, height: 130 } },
        {
          type: 'Panel', id: 'gx-react-bub', props: { bg: { custom: '#211a30' } },
          layout: { padding: 16, width: 460 },
          children: [{ type: 'Label', id: 'gx-react-t', props: { text, color: 'text', size: 'md', typewriter: 24 } }],
        },
        { type: 'Button', id: 'gx-react-back', props: { label: '嗯 ▶', kind: 'hero', action: backAction } },
      ],
    }],
  });
}
