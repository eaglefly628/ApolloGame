// Game A ·《掼蛋夜宴》—— 全部 UI = 纯 LayoutNode 数据（UI 铁律·S3 骨架壳）。
// S5 UI 关按 owner 钦定蓝本 guandan-lite-mockup.html 1:1 复刻（缺口届时提 requests.md 报 PUI）；
// 本文件只立 SC-1 主菜单壳 + 牌桌骨架屏（挂载目击件），控件全取 catalog 闭集实名。
// 写世界只经 action 信号；骨架期 action（menu.start / table.back）全是宿主生命周期动作，HandlerMap 消化零逻辑。
import type { LayoutNode } from '@ui/components/index.js';
import type { SeatSpec } from './rules.js';
import { HAND_SIZE, DRESS_TIERS } from './rules.js';
import { MANOR_BG, CARD_BACK_ID, cardAssetUrl } from './theme.js';

// ── 视图数据（宿主从 world 纯读投影·outcome-first）─────────────────────────────
export interface SeatView {
  seat: SeatSpec;
  cards: number; // 手牌数
  dress: number; // 服饰档 0..5
}
export interface TableView {
  wallet: number;
  stake: number;
  round: number;
  levelOurs: number;
  levelTheirs: number;
  flowState: string;
  deckCount: number; // 庄桌未发牌数（骨架=108）
  partner: SeatView;
  west: SeatView;
  east: SeatView;
  hero: SeatView;
}

const fmtMoney = (n: number): string => n.toLocaleString('en-US');

// ── SC-1 主菜单壳（ui-scene-design §3 SC-1·蓝本 1:1 定稿在 S5）────────────────────
export function buildMenu(): LayoutNode {
  return {
    type: 'Screen',
    id: 'a-menu',
    props: { bg: { custom: MANOR_BG }, center: true },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 16, padding: 24 },
    children: [
      {
        type: 'Panel',
        id: 'a-menu-card',
        props: { vignette: true },
        layout: { direction: 'column', align: 'center', gap: 14, padding: 30 },
        children: [
          { type: 'Label', id: 'a-menu-title', props: { text: '掼蛋夜宴', font: 'elegant', size: 'xxxl', bold: true, color: 'gold' } },
          { type: 'Label', id: 'a-menu-sub', props: { text: '四人两副牌 · 淮安标准全套 · 私宅夜局', size: 'sm', color: 'sub' } },
          {
            type: 'Panel',
            id: 'a-menu-tags',
            props: { bare: true },
            layout: { direction: 'row', gap: 8, justify: 'center' },
            children: [
              { type: 'Tag', id: 'a-menu-tag-1', props: { label: '快局制', tone: 'accent', size: 'sm' } },
              { type: 'Tag', id: 'a-menu-tag-2', props: { label: '2v2 对家', tone: 'normal', size: 'sm' } },
              { type: 'Tag', id: 'a-menu-tag-3', props: { label: '级数爬 A', tone: 'normal', size: 'sm' } },
            ],
          },
          { type: 'Button', id: 'a-menu-start', props: { label: '开始上桌 · 骨架桌（底注 100）', kind: 'primary', action: 'menu.start' } },
          { type: 'Button', id: 'a-menu-settings', props: { label: '设置', kind: 'ghost', disabled: true } },
          { type: 'Label', id: 'a-menu-ver', props: { text: 'S3 骨架版 · 发牌与出牌循环于玩法关（S4）接入', size: 'xs', color: 'dim' } },
        ],
      },
    ],
  };
}

// ── 席位卡（骨架·SC-3 席位区的最小形·S5 按蓝本重排）──────────────────────────────
function seatCard(id: string, v: SeatView): LayoutNode {
  const foe = v.seat.team === 1;
  return {
    type: 'Panel',
    id: `a-seat-${id}`,
    props: {},
    layout: { direction: 'column', align: 'center', gap: 5, padding: 10 },
    children: [
      { type: 'Avatar', id: `a-seat-${id}-face`, props: { name: v.seat.name, size: 40, shape: 'circle' } },
      { type: 'Label', id: `a-seat-${id}-name`, props: { text: v.seat.name, size: 'sm', bold: true } },
      {
        type: 'Panel',
        id: `a-seat-${id}-row`,
        props: { bare: true },
        layout: { direction: 'row', gap: 6, align: 'center' },
        children: [
          { type: 'Badge', id: `a-seat-${id}-cards`, props: { text: `余牌 ${v.cards}`, tone: 'ok' } },
          { type: 'Tag', id: `a-seat-${id}-side`, props: { label: foe ? '对手' : '队友', tone: foe ? 'normal' : 'accent', size: 'sm' } },
        ],
      },
      { type: 'Label', id: `a-seat-${id}-dress`, props: { text: `服饰 ${v.dress}/${DRESS_TIERS}`, size: 'xs', color: 'sub' } },
    ],
  };
}

// ── 牌桌骨架屏（挂载目击件：world 活值投影 + 本地牌资产上画面）────────────────────
export function buildTable(v: TableView): LayoutNode {
  return {
    type: 'Screen',
    id: 'a-table',
    props: { bg: { custom: MANOR_BG } },
    layout: { direction: 'column', gap: 10, padding: 16, justify: 'between' },
    children: [
      // 北 · 对家
      {
        type: 'Panel',
        id: 'a-north',
        props: { bare: true },
        layout: { direction: 'row', justify: 'center' },
        children: [seatCard('partner', v.partner)],
      },
      // 中带：西席 · 中央出牌区骨架 · 东席
      {
        type: 'Panel',
        id: 'a-mid',
        props: { bare: true },
        layout: { direction: 'row', justify: 'between', align: 'center', gap: 12 },
        children: [
          seatCard('west', v.west),
          {
            type: 'Panel',
            id: 'a-center',
            props: { bg: 'sunken', vignette: true },
            layout: { direction: 'column', align: 'center', gap: 8, padding: 18, flex: 1 },
            children: [
              {
                type: 'Image',
                id: 'a-center-deck',
                props: { src: cardAssetUrl(CARD_BACK_ID), fit: 'contain', radius: 6 },
                layout: { width: 72, height: 100 },
              },
              { type: 'Label', id: 'a-center-deckn', props: { text: `牌库 ${v.deckCount} 张 · 未发`, size: 'sm', color: 'sub' } },
              { type: 'Label', id: 'a-center-note', props: { text: '牌桌骨架就绪 · 发牌/出牌循环于玩法关（S4）接入', size: 'xs', color: 'dim' } },
              {
                type: 'Panel',
                id: 'a-info',
                props: { bare: true },
                layout: { direction: 'row', gap: 8, align: 'center', justify: 'center' },
                children: [
                  { type: 'Tag', id: 'a-info-level', props: { label: `级牌 ${v.levelOurs}`, tone: 'accent', size: 'sm' } },
                  { type: 'Label', id: 'a-info-lv', props: { text: `我方 ${v.levelOurs} · 对方 ${v.levelTheirs}`, size: 'xs', color: 'sub' } },
                  { type: 'Badge', id: 'a-info-stake', props: { text: `底注 ${v.stake}` } },
                  { type: 'Label', id: 'a-info-round', props: { text: `第 ${v.round} 盘`, size: 'xs', color: 'sub' } },
                  { type: 'Tag', id: 'a-info-flow', props: { label: `流程 ${v.flowState}`, tone: 'dim', size: 'sm' } },
                ],
              },
            ],
          },
          seatCard('east', v.east),
        ],
      },
      // 南 · 主角条
      {
        type: 'Panel',
        id: 'a-hero-bar',
        props: {},
        layout: { direction: 'row', justify: 'between', align: 'center', gap: 12, padding: 12 },
        children: [
          {
            type: 'Panel',
            id: 'a-hero-id',
            props: { bare: true },
            layout: { direction: 'row', gap: 8, align: 'center' },
            children: [
              { type: 'Avatar', id: 'a-hero-face', props: { name: v.hero.seat.name, size: 36, shape: 'circle' } },
              { type: 'Label', id: 'a-hero-name', props: { text: v.hero.seat.name, size: 'sm', bold: true } },
              { type: 'Badge', id: 'a-hero-wallet', props: { text: `💰 ${fmtMoney(v.wallet)}`, tone: 'ok' } },
            ],
          },
          { type: 'Label', id: 'a-hero-hand', props: { text: `手牌 ${v.hero.cards}/${HAND_SIZE} · 服饰 ${v.hero.dress}/${DRESS_TIERS}`, size: 'xs', color: 'sub' } },
          { type: 'Button', id: 'a-hero-back', props: { label: '返回主菜单', kind: 'ghost', action: 'table.back' } },
        ],
      },
    ],
  };
}
