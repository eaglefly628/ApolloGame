// Game B ·《雀宴》—— 牌桌 HUD 壳（LayoutNode 纯数据·UI 铁律）。
// 布局 1:1 复原 docs/design/game-b/ui-mockup.html（⚖ owner 2026-07-17「按美术策划文档 1:1」）：
//   场况角标左上 · 设置右上 · 席位卡×4（头像+名+点数+风位章+衣物5章+立直条）· 字幕胶囊 · 行动按钮排。
// 文案数值=gdd 拍板口径（起点 50,000·東1局 0本場·mockups/README 口径警示）；人名=gdd 工作名。
// 写世界只走 action 信号（S3 全钮 disabled·S4 接 sim 后按合法性点亮）；缺件（樱瓣异形钮）S5 报 PUI。
import type { LayoutNode } from '@ui/components/index.js';
import { FIELD_W, FIELD_H } from './theme.js';

// ── 席位视图数据（S3=开局摆拍·S4 起由 world 投影）────────────────────────────────────
export interface SeatView {
  id: string;
  name: string;
  avatar: string; // 头像位：单字占位（真头像=角色卡/台账 B-01~03·Avatar.src 就位即换）
  wind: '東' | '南' | '西' | '北';
  points: number;
  cloth: boolean[]; // 5 件衣物·true=在穿（轻表示：逐件熄灭）
  riichi?: boolean;
}

/** 衣物 5 件（gdd §三：簪/打挂/帯/襦袢/足袋·章上取首字·图标资产=台账 B-13~17 待产）。 */
export const CLOTH_ITEMS = ['簪', '掛', '帯', '襦', '足'] as const;

export interface HudState {
  seats: { north: SeatView; west: SeatView; east: SeatView; hero: SeatView };
  round: string; // 東1局
  honba: number; // 本場
  kyotaku: number; // 供托
  wallLeft: number; // 余牌
  subtitle?: { speaker: string; line: string };
}

/** 开局初值（gdd §四：起点 50,000·点数=金钱 1:1；名=gdd 工作名·风位排布 1:1 线框稿）。 */
export function initialHud(): HudState {
  const seat = (id: string, name: string, avatar: string, wind: SeatView['wind']): SeatView => ({
    id, name, avatar, wind, points: 50000, cloth: [true, true, true, true, true],
  });
  return {
    seats: {
      north: seat('north', '大姨太·绫', '绫', '西'),
      west: seat('west', '二姨太·莉世', '莉', '南'),
      east: seat('east', '三姨太·小夜', '夜', '北'),
      hero: seat('hero', '主角（角色卡）', '主', '東'),
    },
    round: '東1局',
    honba: 0,
    kyotaku: 0,
    wallLeft: 70,
    subtitle: { speaker: '绫', line: '「ようこそ、雀宴へ」' },
  };
}

const fmtPts = (n: number): string => n.toLocaleString('en-US');

// ── 席位卡（线框稿 .seat：宽 172·纸面·row1[头像|名+点数|风位章]+衣物行+立直条）─────────────
function seatCard(seat: SeatView, x: number, y: number): LayoutNode {
  const children: LayoutNode[] = [
    {
      type: 'Panel', id: `${seat.id}-row1`, props: { bare: true },
      layout: { direction: 'row', gap: 8, align: 'center' },
      children: [
        { type: 'Avatar', id: `${seat.id}-ava`, props: { name: seat.avatar, size: 34, shape: 'circle' } },
        {
          type: 'Panel', id: `${seat.id}-nm`, props: { bare: true },
          layout: { direction: 'column', gap: 1, flex: 1 },
          children: [
            { type: 'Label', id: `${seat.id}-name`, props: { text: seat.name, size: 'sm', bold: true } },
            { type: 'Label', id: `${seat.id}-pts`, props: { text: fmtPts(seat.points), size: 'sm', bold: true, color: 'danger' } },
          ],
        },
        { type: 'Tag', id: `${seat.id}-wind`, props: { label: seat.wind, tone: 'accent', size: 'sm' } },
      ],
    },
    {
      type: 'Panel', id: `${seat.id}-cloth`, props: { bare: true },
      layout: { direction: 'row', gap: 4 },
      children: CLOTH_ITEMS.map((item, i): LayoutNode => ({
        type: 'Tag', id: `${seat.id}-cl${i}`,
        props: { label: item, size: 'sm', tone: seat.cloth[i] ? 'normal' : 'dim', active: seat.cloth[i] },
      })),
    },
  ];
  if (seat.riichi) {
    children.push({
      type: 'Tag', id: `${seat.id}-riichi`,
      props: { label: '立直 ●———', tone: 'accent', size: 'sm' },
    });
  }
  return {
    type: 'Panel', id: `seat-${seat.id}`, props: {},
    layout: { x, y, width: 172, padding: 8, gap: 6, direction: 'column' },
    children,
  };
}

// ── 场况角标（线框稿 .info：左上暗底虚线框·局/本场/供托/余牌 + 宝牌指示位）────────────────
function infoPanel(st: HudState): LayoutNode {
  return {
    type: 'Panel', id: 'info',
    props: { bg: { custom: 'rgba(30,20,30,0.72)' }, dashed: true },
    layout: { x: 14, y: 12, padding: 10, gap: 4, direction: 'column' },
    children: [
      {
        type: 'Label', id: 'info-line',
        props: { text: `${st.round} · ${st.honba}本場 ｜ 供托 ${st.kyotaku} ｜ 余牌 ${st.wallLeft}`, size: 'sm', color: 'jade' },
      },
      {
        type: 'Panel', id: 'info-dora', props: { bare: true },
        layout: { direction: 'row', gap: 4, align: 'center' },
        children: [
          { type: 'Label', id: 'info-dora-t', props: { text: 'ドラ', size: 'sm', color: 'jade' } },
          // 宝牌指示牌缩略位（S4 由 sim 翻示·骨架摆占位章）
          { type: 'Tag', id: 'info-dora-1', props: { label: '？', size: 'sm', tone: 'dim' } },
        ],
      },
    ],
  };
}

// ── 行动按钮排（线框稿 .actions：吃碰杠立直和跳过·仅合法时亮·全 action 信号·S3 全暗）──────
const ACTIONS: Array<{ id: string; label: string; action: string }> = [
  { id: 'chi', label: '吃', action: 'act-chi' },
  { id: 'pon', label: '碰', action: 'act-pon' },
  { id: 'kan', label: '杠', action: 'act-kan' },
  { id: 'riichi', label: '立直', action: 'act-riichi' },
  { id: 'agari', label: '和', action: 'act-agari' },
  { id: 'pass', label: '跳过', action: 'act-pass' },
];

function actionBar(): LayoutNode {
  return {
    type: 'Panel', id: 'actions', props: { bare: true },
    layout: { x: 335, y: 494, direction: 'row', gap: 10 },
    children: ACTIONS.map((a): LayoutNode => ({
      type: 'Button', id: `act-${a.id}`,
      props: { label: a.label, kind: a.id === 'riichi' ? 'primary' : 'ghost', shape: 'pill', disabled: true, action: a.action },
    })),
  };
}

// ── 字幕条（线框稿 .subtitle：底部胶囊·说话人樱粉+台词·语音/TTS 同步位）───────────────────
function subtitleBar(sub: { speaker: string; line: string }): LayoutNode {
  return {
    type: 'Panel', id: 'subtitle',
    props: { bg: { custom: 'rgba(24,16,24,0.82)' } },
    layout: { x: 360, y: 444, width: 400, padding: 8, align: 'center' },
    children: [
      {
        type: 'Label', id: 'subtitle-line',
        props: {
          size: 'sm',
          spans: [
            { text: sub.speaker, color: 'jade', bold: true },
            { text: '　' + sub.line },
          ],
        },
      },
    ],
  };
}

// ── 整幅 HUD（overlayHost 一次挂载·座标=线框稿 1120×630 逐位对照）──────────────────────
export function buildHud(st: HudState): LayoutNode {
  const children: LayoutNode[] = [
    infoPanel(st),
    {
      type: 'Button', id: 'gear',
      props: { label: '⚙ 設定', kind: 'quiet', disabled: true, action: 'open-settings' },
      layout: { x: FIELD_W - 100, y: 12 },
    },
    seatCard(st.seats.north, FIELD_W / 2 - 86, 64), // 北席·顶中
    seatCard(st.seats.west, 16, Math.round(FIELD_H * 0.44)), // 西侧·左中
    seatCard(st.seats.east, FIELD_W - 16 - 172, Math.round(FIELD_H * 0.44)), // 东侧·右中
    seatCard(st.seats.hero, 16, FIELD_H - 16 - 92), // 自席·左下
    actionBar(),
  ];
  if (st.subtitle) children.push(subtitleBar(st.subtitle));
  return {
    type: 'Panel', id: 'hud-root', props: { bare: true },
    layout: { x: 0, y: 0, width: FIELD_W, height: FIELD_H },
    children,
  };
}
