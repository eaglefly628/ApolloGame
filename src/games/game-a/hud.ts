// Game A ·《掼蛋夜宴》—— 全部 UI = 纯 LayoutNode 数据（UI 铁律·夜宴皮 GAME_A_THEME）。
// S5 UI 关：按 owner 钦定蓝本 guandan-lite-mockup.html **1:1 复刻**（椭圆felt桌+席位环+中央墩+扇形手牌+
// 信息条+立绘框+glass操作区·绝对定位屏幕锚点·同 game-c 夜宴牌桌先例）。三屏=SC-1 菜单 / SC-3 牌桌 / SC-4 结算。
// 写世界只经 action 信号；action（menu.start/table.back/hand.toggle/play.commit/pass/hint/round.next/hand.sort）由宿主
// HandlerMap 消化，handler 只做「选牌记账 + 调 session + 重渲」——不塞判型/结算逻辑（那些在 guandan-session sim 内）。
// ui-audit 残留角标对比=light 白扑克牌+扇形叠放盲区（A-007 报 PUI·不降格·owner 两层 1:1 律=视觉 1:1）。
// 主 CTA 用 hero kind（金渐变底+深墨字·蓝本「深字金底」·真机≈8:1 可读）；ui-audit contrast 只读 background-color、
// 读不到渐变底 → 误报「开始上桌」1.05 假阳（A-022 报 PUI·同 A-007 不降格·视觉真绿）。
import type { LayoutNode } from '@ui/components/index.js';
import type { SeatSpec } from './rules.js';
import { DRESS_TIERS, codeRank, codeSuit, AI_TIERS, STAKES, BUYIN_MULT, SEATS } from './rules.js';
import { MANOR_BG, feltTexture, art, FIELD_W, FIELD_H, SEAT_ANCHORS, SEAT_W, seatTopLeft } from './theme.js';
import { TURN_ORDER, type SeatId } from './guandan-session.js';
import {
  type Lang, t, traitName, tierName, PATTERN_GUIDE, RULES_LINES,
  fmtTurnLead, fmtTurnWonLead, fmtTurnRespond, fmtActing, fmtHolder, fmtWildTag,
  fmtCardsLeft, fmtLevelTag, fmtLevels, fmtStake, fmtRound, fmtDress, fmtBuyinNote,
  fmtTierName, fmtPeekHint, fmtMemHint, fmtSortSetting, fmtSeed, fmtLevelsAfter,
} from './strings.js';

// ── 语言切换段控（EN / 中·当前档 primary 高亮·发 set_lang 信号·菜单与牌桌顶栏共用·mirror game-c）──
function langToggle(l: Lang, idp: string): LayoutNode {
  const btn = (lang: Lang, label: string): LayoutNode => ({
    type: 'Button', id: `${idp}-${lang}`, props: { label, kind: l === lang ? 'primary' : 'ghost', action: 'set_lang', actionArg: lang },
  });
  return {
    type: 'Panel', id: idp, props: { bare: true }, layout: { direction: 'row', gap: 4, align: 'center' },
    children: [btn('en', 'EN'), btn('zh', '中')],
  };
}

// ── 牌码 → PlayingCard props（经典白扑克面·红黑自动判）───────────────────────────
const RANK_TEXT: Record<number, string> = {
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '小王', 16: '大王',
};
const SUIT_SYM = ['♠', '♥', '♦', '♣'];
export function cardFace(code: number): { rank: string; suit: string } {
  const r = codeRank(code);
  if (r >= 15) return { rank: RANK_TEXT[r], suit: r === 16 ? '🃏' : '🂿' };
  return { rank: RANK_TEXT[r] ?? String(r), suit: SUIT_SYM[codeSuit(code)] };
}

// ── 视图数据（宿主从 world 纯读投影·outcome-first）─────────────────────────────
export interface SeatView {
  seat: SeatSpec;
  cards: number; // 手牌数
  dress: number; // 服饰档 0..5
  avatar?: string; // 角色卡头像 src（REQ-CHARCARD·无则 Avatar 退首字铭牌·默认卡无媒体=零变）
  flavor?: string; // 人设问候（REQ-CHARCARD·闲时气泡·已截断·无活跃玩法气泡时显）
}
const fmtMoney = (n: number): string => n.toLocaleString('en-US');

// ── SC-1 主菜单（1:1 复刻设计稿 main-menu-guandan.dc.html·owner 2026-07-18）────────────────
// 稿 = 1280×720 绝对定位：星点背景 + 左侧主角立绘占位(300×440) + 左下头像/名/金币 + 右上级牌+大标题
// (掼蛋 米白 / 夜宴 朱砂) + 右侧按钮列(开始上桌金 CTA / 继续 / 设置) + 右下版本。夜宴皮=深胡桃×朱砂×米金。
// 差异（逐条·非阻断）：① 立绘占位去掉 EN-prompt/A-CHAR 台账标注（美术生产注解·非玩家 UI）；
//   ② bob/glow/twinkle 呼吸动效简化（星点用 Particles·徽标静态）；③「继续上局」暂无存档=同「开始」。
const MENU_BG = 'radial-gradient(90% 120% at 78% 30%,#31201a,#160e0a 75%)';
// 夜宴外围美术：Screen 底图/图标经 theme art(slot) 解析（工坊 skinKey 覆盖优先·换图即生效·真图未到回退内置占位）。
// 小图标（1em 内联·Button.icon / Tag.icon 消费·换图即生效）。
const coinTag = (id: string, text: string): LayoutNode => ({ type: 'Tag', id, props: { label: text, tone: 'accent', size: 'md', icon: art('icon/coin') } });
export interface MenuView {
  lang: Lang; // 界面语言（owner 2026-07-20 中英切换·默认中文·宿主持久）
  wallet: number;
  level: number; // 本家级牌（无存档=起始 2）
  showMenu: boolean; // 游戏内菜单（规则/设置）浮层
  menuTab: 'log' | 'rules' | 'settings';
}
export function buildMenu(v: MenuView): LayoutNode {
  const l = v.lang;
  const overlay = v.showMenu
    ? buildGameMenu({ lang: l, menuTab: v.menuTab, logRows: [], tierName: '—', levelPlay: v.level, stake: 0, wallet: v.wallet, sortMode: 'rank', seed: 0 })
    : null;
  return {
    type: 'Screen',
    id: 'a-menu',
    props: { bg: { custom: MENU_BG }, image: art('bg/menu') },
    layout: { width: FIELD_W, height: FIELD_H },
    children: [
      // 夜窗框（owner 2026-07-22 修「不同分辨率下按钮/框错位」根因）：窗框原画在 bg 图里走 background cover（按纵横比裁切），
      //   而标题/按钮在 letterbox 缩放的**场内坐标**——两套坐标系在非 16:9 分辨率下漂移=框离开按钮。修法：把窗框**画进场内
      //   LayoutNode**（与按钮同坐标系·任何分辨率恒对齐）：深夜空底 + 金边 + 城市微光 Particles。作首子=垫在标题/按钮之下。
      {
        type: 'Panel', id: 'a-menu-frame',
        props: { bg: { custom: 'linear-gradient(180deg,#0e0a08,#1a120d 68%,#2c1d12)' }, edge: 'gold' },
        // 级牌/标题/副标/按钮**全嵌进框**（同一坐标系·框内居中·flex 列）——整框随缩放等比缩，任何分辨率恒对齐居中、
        //   标题不超框、按钮居中（owner 2026-07-22：确保随放缩率不变）。padding 留边、gap 分隔、中段 flex 撑开把按钮推到下半。
        layout: { x: 890, y: 54, width: 316, height: 572, radius: 10, direction: 'column', align: 'center', padding: 20, gap: 10, allowOverlap: true },
        children: [
          { type: 'Particles', id: 'a-menu-frame-lights', props: { kind: 'sparkle', count: 16, loop: true }, layout: { x: 0, y: 0, width: 316, height: 572, allowOverlap: true } },
          // 本家级牌（顶·满宽行右对齐）
          {
            type: 'Panel', id: 'a-menu-level', props: { bare: true },
            layout: { width: 276, direction: 'row', align: 'center', justify: 'end', gap: 10 },
            children: [
              { type: 'Label', id: 'a-menu-level-l', props: { text: t(l, 'menu.levelLabel'), size: 'sm', color: 'sub' } },
              {
                type: 'Panel', id: 'a-menu-level-v',
                props: { bg: { custom: 'linear-gradient(160deg,rgba(200,53,43,.9),rgba(122,26,18,.92))' } },
                layout: { direction: 'row', align: 'center', gap: 3, padding: 7, radius: 10 },
                children: [
                  { type: 'Label', id: 'a-menu-level-v-t', props: { text: t(l, 'menu.levelBadge'), size: 'sm', bold: true, color: 'text' } },
                  { type: 'Label', id: 'a-menu-level-v-n', props: { text: String(v.level), size: 'md', bold: true, color: 'gold' } },
                ],
              },
            ],
          },
          // 标题（居中·62 缩到框内不超框·原 80 超框） + 副标（居中）
          { type: 'Label', id: 'a-menu-title-t', props: { size: 62, font: 'serif', bold: true, color: 'text', spans: [{ text: t(l, 'menu.titleA') }, { text: t(l, 'menu.titleB'), color: 'danger' }] } },
          { type: 'Label', id: 'a-menu-title-sub', props: { text: t(l, 'menu.subtitle'), size: 'md', color: 'sub' } },
          { type: 'Panel', id: 'a-menu-gap', props: { bare: true }, layout: { flex: 1 } },
          // 红包 tip + 三按钮组（固定宽 276·align stretch=等宽·框内居中）
          {
            type: 'Panel', id: 'a-menu-btns', props: { bare: true },
            layout: { width: 276, direction: 'column', gap: 12, align: 'stretch' },
            children: [
              { type: 'Badge', id: 'a-menu-tip', props: { text: t(l, 'menu.tip'), tone: 'warn' } },
              { type: 'Button', id: 'a-menu-start', props: { label: t(l, 'menu.start'), kind: 'hero', action: 'menu.start' } }, // hero=金渐变底+深墨字+倒角流光=蓝本主 CTA（skin 皮强制白字→浅金失读·故用引擎 hero kind）
              { type: 'Button', id: 'a-menu-resume', props: { label: t(l, 'menu.resume'), kind: 'ghost', action: 'menu.start' } },
              { type: 'Button', id: 'a-menu-settings', props: { label: t(l, 'menu.settings'), kind: 'ghost', action: 'menu.settings' } },
            ],
          },
        ],
      },
      // 主角立绘占位（左·300×440·斜纹虚框·真立绘 S6 台账 A-CHAR-HERO）
      {
        type: 'Panel',
        id: 'a-menu-portrait',
        props: { vignette: true, bg: { custom: 'repeating-linear-gradient(45deg,rgba(216,184,120,.06) 0 9px,transparent 9px 18px),linear-gradient(160deg,rgba(30,20,14,.72),rgba(22,15,11,.5))' } },
        layout: { x: 96, y: 132, width: 300, height: 440, direction: 'column', align: 'center', justify: 'center', gap: 14, padding: 26, radius: 14 },
        children: [
          { type: 'Label', id: 'a-menu-portrait-icon', props: { text: '▤', size: 44, color: 'gold' } },
          { type: 'Label', id: 'a-menu-portrait-t', props: { text: t(l, 'menu.portraitTitle'), font: 'serif', size: 'xxl', bold: true, color: 'text' } },
          { type: 'Tag', id: 'a-menu-portrait-sz', props: { label: t(l, 'menu.portraitSize'), tone: 'accent', size: 'sm' } },
          { type: 'Label', id: 'a-menu-portrait-anchor', props: { text: t(l, 'menu.portraitAnchor'), size: 'xs', color: 'jade' } },
        ],
      },
      // 玩家（左下·金边圆头像 + 名 + 金币 Badge）
      {
        type: 'Panel',
        id: 'a-menu-player',
        props: { bare: true },
        layout: { x: 96, y: 636, direction: 'row', align: 'center', gap: 14 },
        children: [
          {
            type: 'Panel',
            id: 'a-menu-player-ring',
            props: { accent: true, bg: { custom: 'linear-gradient(145deg,#5a3d2e,#39251b)' } },
            layout: { width: 64, height: 64, radius: 32, direction: 'row', align: 'center', justify: 'center' },
            children: [{ type: 'Label', id: 'a-menu-player-init', props: { text: '君', font: 'serif', size: 'xxl', bold: true, color: 'text' } }],
          },
          {
            type: 'Panel',
            id: 'a-menu-player-col',
            props: { bare: true },
            layout: { direction: 'column', gap: 6 },
            children: [
              { type: 'Label', id: 'a-menu-player-name', props: { text: '夜阑君', font: 'serif', size: 'lg', bold: true, color: 'text' } },
              coinTag('a-menu-player-money', fmtMoney(v.wallet)),
            ],
          },
        ],
      },
      // 语言段控（右上·EN/中·mirror game-c 主菜单右上角）
      {
        type: 'Panel',
        id: 'a-menu-lang',
        props: { bare: true },
        layout: { x: FIELD_W - 150, y: 24, width: 120, direction: 'row', justify: 'end' },
        children: [langToggle(l, 'a-menu-lang-seg')],
      },
      // 版本（右下）
      {
        type: 'Panel',
        id: 'a-menu-ver-wrap',
        props: { bare: true },
        layout: { x: 1000, y: 688, width: 200, direction: 'row', justify: 'end' },
        children: [{ type: 'Label', id: 'a-menu-ver', props: { text: t(l, 'menu.version'), size: 'xs', color: 'dim' } }],
      },
      ...(overlay ? [overlay] : []),
    ],
  };
}

// ── SC-2 选桌（难度×底注选择 + 三家人设预览 + 带入确认·owner 稿 SC-2）──────────────
// 性格标签/难度名/阵营=strings.ts 双语查表（traitName/tierName/t·键=rules 原始值·不解析 session 中文）。
export interface TableSelectView {
  lang: Lang; // 界面语言（owner 2026-07-20 中英切换）
  difficulty: 'l1' | 'l2' | 'l3' | 'l4';
  stake: number;
  wallet: number;
  avatars?: Partial<Record<SeatId, string>>; // 角色卡头像 src（REQ-CHARCARD·无则退首字铭牌·默认卡无=零变）
}
function seatPreview(seat: SeatSpec, l: Lang, avatar?: string): LayoutNode {
  const foe = seat.team === 1;
  const trait = seat.traits?.[0] ? traitName(l, seat.traits[0]) : '';
  return {
    type: 'Card',
    id: `a-sel-npc-${seat.id}`,
    props: { title: seat.name },
    layout: { direction: 'column', align: 'center', gap: 6, padding: 12, width: 132 },
    children: [
      { type: 'Avatar', id: `a-sel-npc-${seat.id}-face`, props: { name: seat.name, size: 52, shape: 'circle', ...(avatar ? { src: avatar } : {}) } },
      {
        type: 'Panel',
        id: `a-sel-npc-${seat.id}-tags`,
        props: { bare: true },
        layout: { direction: 'row', gap: 4, justify: 'center' },
        children: [
          { type: 'Tag', id: `a-sel-npc-${seat.id}-side`, props: { label: foe ? t(l, 'seat.foe') : t(l, 'seat.ally'), tone: foe ? 'normal' : 'accent', size: 'sm' } },
          ...(trait ? [{ type: 'Tag' as const, id: `a-sel-npc-${seat.id}-trait`, props: { label: trait, tone: 'dim' as const, size: 'sm' as const } }] : []),
        ],
      },
    ],
  };
}
export function buildTableSelect(v: TableSelectView): LayoutNode {
  const l = v.lang;
  const buyin = v.stake * BUYIN_MULT;
  const affordable = v.wallet >= buyin;
  const tierSpec = AI_TIERS.find((tt) => tt.id === v.difficulty)!;
  const aiSeats = SEATS.filter((s) => s.kind === 'ai');
  return {
    type: 'Screen',
    id: 'a-select',
    props: { bg: { custom: MANOR_BG }, image: art('bg/table'), center: true },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 14, padding: 24 },
    children: [
      {
        type: 'Panel',
        id: 'a-sel-card',
        props: { vignette: true },
        layout: { direction: 'column', align: 'center', gap: 14, padding: 26, width: 640 },
        children: [
          { type: 'Label', id: 'a-sel-title', props: { text: t(l, 'sel.title'), font: 'elegant', size: 'xxl', bold: true, color: 'gold' } },
          // 难度
          {
            type: 'Panel',
            id: 'a-sel-diff-row',
            props: { bare: true },
            layout: { direction: 'column', align: 'center', gap: 6 },
            children: [
              { type: 'Label', id: 'a-sel-diff-l', props: { text: t(l, 'sel.difficulty'), size: 'sm', color: 'sub' } },
              {
                type: 'Segmented',
                id: 'a-sel-diff',
                props: { options: AI_TIERS.map((tt) => ({ value: tt.id, label: tierName(l, tt.id) })), value: v.difficulty, action: 'select.difficulty' },
              },
              {
                type: 'Label',
                id: 'a-sel-diff-hint',
                props: {
                  text: tierSpec.peek > 0 ? fmtPeekHint(l, tierSpec.id, tierSpec.peek) : fmtMemHint(l, tierSpec.id, tierSpec.memory),
                  size: 'xs',
                  color: tierSpec.peek > 0 ? 'warn' : 'dim',
                },
              },
            ],
          },
          // 底注
          {
            type: 'Panel',
            id: 'a-sel-stake-row',
            props: { bare: true },
            layout: { direction: 'column', align: 'center', gap: 6 },
            children: [
              { type: 'Label', id: 'a-sel-stake-l', props: { text: t(l, 'sel.stake'), size: 'sm', color: 'sub' } },
              {
                type: 'Segmented',
                id: 'a-sel-stake',
                props: { options: STAKES.map((s) => ({ value: String(s), label: String(s) })), value: String(v.stake), action: 'select.stake' },
              },
            ],
          },
          // 三家人设预览
          {
            type: 'Panel',
            id: 'a-sel-npcs',
            props: { bare: true },
            layout: { direction: 'row', gap: 12, justify: 'center' },
            children: aiSeats.map((s) => seatPreview(s, l, v.avatars?.[s.id])),
          },
          // 带入确认 + 入座
          {
            type: 'Panel',
            id: 'a-sel-buyin',
            props: { bare: true },
            layout: { direction: 'row', gap: 10, align: 'center', justify: 'center' },
            children: [
              { type: 'Label', id: 'a-sel-buyin-l', props: { text: t(l, 'sel.buyin'), size: 'sm', color: 'sub' } },
              { type: 'Badge', id: 'a-sel-buyin-v', props: { text: `💰 ${fmtMoney(buyin)}`, tone: affordable ? 'ok' : 'warn' } },
              { type: 'Label', id: 'a-sel-buyin-note', props: { text: fmtBuyinNote(l, v.stake, v.wallet), size: 'xs', color: 'dim' } },
            ],
          },
          {
            type: 'Panel',
            id: 'a-sel-btns',
            props: { bare: true },
            layout: { direction: 'row', gap: 10, align: 'center', justify: 'center' },
            children: [
              { type: 'Button', id: 'a-sel-back', props: { label: t(l, 'sel.back'), kind: 'ghost', action: 'select.back' } },
              { type: 'Button', id: 'a-sel-seat', props: { label: t(l, 'sel.seat'), kind: 'hero', action: 'select.seat', sub: affordable ? undefined : t(l, 'sel.seatPoor') } }, // hero 金 CTA（sub=不足提示·hero 原生副标槽）
            ],
          },
        ],
      },
    ],
  };
}

// ── 席位卡（蓝本 SC-3·绝对定位到屏幕锚点·圆头像金边圈 + 阵营/性格 pill + 余牌 + 表情气泡）──
// 固定相机=固定屏幕锚点（同 game-c 先例）；active=当前出牌者金边高亮；leading=当前墩持有者（暂大·名前缀🏆·
// 零增高防重叠）；bubble=表情/「过」气泡（可空）。
function seatCard(v: SeatView, x: number, y: number, active: boolean, leading: boolean, l: Lang, bubble?: string): LayoutNode {
  const foe = v.seat.team === 1;
  const trait = v.seat.traits?.[0] ? traitName(l, v.seat.traits[0]) : '';
  // 气泡：活跃玩法气泡（表情/过）优先；无则退人设问候（idle greeting·REQ-CHARCARD·已截断）。
  const shownBubble = bubble ?? (v.flavor || undefined);
  return {
    type: 'Panel',
    id: `a-seat-${v.seat.id}`,
    props: { accent: active, bg: { custom: 'linear-gradient(180deg,rgba(30,20,14,0.92),rgba(20,14,10,0.86))' } },
    // 当前轮到的席位=金光呼吸（turn indicator·mirror game-c fx:glow·filter+animation 不碰 position→不冲突绝对定位 x/y）。owner 2026-07-22 动态元素。
    layout: { x, y, width: SEAT_W, direction: 'column', align: 'center', gap: 3, padding: 8, radius: 14, ...(active ? { fx: [{ kind: 'glow' as const, color: 'gold' as const }, { kind: 'pulse' as const }] } : {}) },
    children: [
      // 头像金边圈（Avatar 外套圆 Panel 作阵营描边圈）
      {
        type: 'Panel',
        id: `a-seat-${v.seat.id}-ring`,
        props: { bg: foe ? { custom: 'radial-gradient(circle,#5a1f22,#2a0f11)' } : { custom: 'radial-gradient(circle,#1e4030,#14261c)' } },
        layout: { direction: 'row', align: 'center', justify: 'center', padding: 3, radius: 40 },
        children: [{ type: 'Avatar', id: `a-seat-${v.seat.id}-face`, props: { name: v.seat.name, size: 46, shape: 'circle', ...(v.avatar ? { src: v.avatar } : {}) } }],
      },
      // 暂大者名前缀 🏆（谁出的牌谁大·零增高不触发 audit 重叠）
      { type: 'Label', id: `a-seat-${v.seat.id}-name`, props: { text: v.seat.name, size: 'sm', bold: true, color: 'gold' } }, // 名缩小·谁大改由弹簧箭头指（owner 2026-07-18）
      {
        type: 'Panel',
        id: `a-seat-${v.seat.id}-tags`,
        props: { bare: true },
        layout: { direction: 'row', gap: 4, align: 'center', justify: 'center' },
        children: [
          { type: 'Tag', id: `a-seat-${v.seat.id}-side`, props: { label: foe ? t(l, 'seat.foe') : t(l, 'seat.ally'), tone: foe ? 'normal' : 'accent', size: 'sm' } },
          ...(trait ? [{ type: 'Tag' as const, id: `a-seat-${v.seat.id}-trait`, props: { label: trait, tone: 'dim' as const, size: 'sm' as const } }] : []),
        ],
      },
      { type: 'Badge', id: `a-seat-${v.seat.id}-cards`, props: { text: fmtCardsLeft(l, v.cards), tone: v.cards <= 3 ? 'warn' : 'ok' } },
      ...(shownBubble
        ? [{ type: 'Tag' as const, id: `a-seat-${v.seat.id}-bubble`, props: { label: shownBubble, tone: 'accent' as const, size: 'sm' as const } }]
        : []),
    ],
  };
}

// ── S4 可玩牌桌屏（手牌扇列 + 操作条 + 中央墩·SC-3 的玩法关最小可玩形）──────────────
export interface PlayView {
  lang: Lang; // 界面语言（owner 2026-07-20 中英切换）
  round: number;
  stake: number;
  levelPlay: number; // 本盘打的级
  levelOurs: number;
  levelTheirs: number;
  wallet: number;
  turn: SeatId;
  turnName: string;
  seats: { partner: SeatView; west: SeatView; east: SeatView; hero: SeatView };
  hand: number[]; // hero 手牌牌码（显示顺序·按 sortMode 排）
  selected: number[]; // 已选手牌**下标**（指向显示顺序·非牌码——两副牌同码会联动误选，故按 idx 标识）
  sortMode: 'rank' | 'family'; // 理牌当前档（Segmented 高亮用）
  // 当前墩（含持有者=暂大者·「谁出的牌谁大」明示；wilds=本墩用的逢人配张数）。
  trick: { name: string; family: string; cards: number[]; holder: SeatId; holderName: string; holderTeam: 0 | 1; wilds: number } | null;
  // 本墩各座最近一手（座前小牌桌·像真扑克·出=牌码/过=pass）。
  plays: Partial<Record<SeatId, { cards: number[]; pass: boolean }>>;
  justPlayed?: SeatId | null; // 最近落子座（座前牌入场动效只播它·防全桌/上一张一起重播）；缺省=都不播（fixture 只验布局）
  tributeText: string | null; // 本盘进贡/还贡/抗贡一句话（首盘=null·玩家知情）
  showCounter: boolean; // 记牌器开合
  counter: { rank: string; played: number; total: number }[]; // 明面已出牌计数（showCounter 时填）
  canCommit: boolean; // 选牌构成合法且能压
  commitWhy: string; // 不可出的原因（禁用提示）
  canPass: boolean;
  mustPass: boolean; // hero 应对时无任何合法压牌（只能过）→ 高亮「过」引导（owner 2026-07-18）
  // 游戏内菜单（☰·出牌日志/规则说明/设置）。
  showMenu: boolean;
  menuTab: 'log' | 'rules' | 'settings';
  logRows: LogRow[];
  tierName: string;
  seed: number; // 本局 run 种子（设置页显示·供报 bug 复现）
  freshDeal?: boolean; // 仅「开局/新盘发牌」首帧真→手牌错落入场；其余渲染（点击/提示/出牌/开关菜单）假=不重播（owner 2026-07-22）。
}

// 中央墩牌（蓝本经典白扑克面·light·红黑自动判）。
function trickCard(code: number, idx: number): LayoutNode {
  const f = cardFace(code);
  return { type: 'PlayingCard', id: `a-trick-${idx}`, props: { rank: f.rank, suit: f.suit, face: 'light', size: 'sm' } };
}

// ── 座前小牌桌（owner 2026-07-18·像真扑克·本墩此座最近一手摆座位前）──────────────────
// felt 子节点（祖孙嵌套·audit 不判桌面重叠）；出=小牌横排，过=「过」灰签，无出牌=**空占位**（稳定 felt 子键，
// 见下 buildPlay 恒 4 槽注）。**动画逐张 anim 而非整槽 anim**——只有刚变的那槽重渲、只有那槽的牌重播入场，
// 避免「全桌牌一起播」bug（owner 2026-07-18）；per-card animDelay=错落、按座位方向选入场式（从手上/落盘）。
// 入座方向→入场式（从该座方向飞入·owner 2026-07-18「根据入桌方向」）：east 无 from-right 关键帧→暂 dealIn·报 PUI A-017。
const TRAY_ANIM: Record<SeatId, 'slideUp' | 'dealIn' | 'flyIn'> = { hero: 'slideUp', partner: 'dealIn', west: 'flyIn', east: 'dealIn' };
// animate=仅「最近落子座」为真（justPlayed）：入场动效只播它，其余座前牌静态渲染——
// 治「全桌一起播 / 上一张一起重播」（owner 2026-07-20）：非本次落子的座不带 anim，任何重渲/换根都不会重放它们。
// 炸弹级牌型（炸弹/同花顺/四大天王）——打出走**彩虹全息**（holo·库里最炫·owner 2026-07-22 二层特效）。
const BOMB_FAMILIES = new Set(['bomb', 'straight-flush', 'sky']);
function seatTrayNode(seat: SeatId, play: { cards: number[]; pass: boolean } | undefined, x: number, y: number, l: Lang, animate: boolean, bomb = false): LayoutNode {
  if (!play) return { type: 'Panel', id: `a-tray-${seat}`, props: { bare: true }, layout: { x, y } }; // 空占位（稳定键·0 尺寸不显）
  if (play.pass) {
    return {
      type: 'Panel', id: `a-tray-${seat}`, props: { bare: true },
      layout: { x, y, direction: 'row' },
      children: [{ type: 'Tag', id: `a-tray-${seat}-pass`, props: { label: t(l, 'play.pass'), tone: 'dim', size: 'sm' }, ...(animate ? { layout: { anim: 'fadeIn' as const } } : {}) }],
    };
  }
  const dir = TRAY_ANIM[seat];
  return {
    type: 'Panel', id: `a-tray-${seat}`, props: { bare: true },
    layout: { x, y, direction: 'row', gap: 2, align: 'center' },
    children: play.cards.map((c, i) => {
      const f = cardFace(c);
      // 炸弹级=每张挂 holo 彩虹箔（PlayingCard 是 tray 行 flex 子·无 x/y→holo 的 position:relative 不冲突）。
      const bombFx = bomb ? { fx: [{ kind: 'holo' as const }] } : {};
      return {
        type: 'PlayingCard', id: `a-tray-${seat}-${i}`,
        props: { rank: f.rank, suit: f.suit, face: 'light', size: 'sm' },
        // 仅落子座错落入场；其余静态（无 anim=重渲不重放）。炸弹级叠 holo 彩虹箔（与入场 anim 共存）。
        ...(animate || bomb ? { layout: { ...(animate ? { anim: dir, animDelay: i * 70 } : {}), ...bombFx } } : {}),
      } as LayoutNode;
    }),
  };
}
// 座前小牌桌的 felt 内相对锚点（felt 816×322·各座朝桌心方向摆）。
const TRAY_POS: Record<SeatId, { x: number; y: number }> = {
  partner: { x: 300, y: 4 }, // 北·顶中
  west: { x: 8, y: 132 }, // 西·左
  east: { x: 566, y: 132 }, // 东·右
  hero: { x: 300, y: 250 }, // 南·底中（你）
};

// ── 扇形手牌（蓝本底部弧列·flex 流式 + 负 margin 叠放 + 扇形旋转 + 选中上浮）──
// 用流式（非绝对定位）叠牌：ui-audit 只查绝对定位元素的重叠，流式叠不误报（扇形叠是纸牌意图叠层）。
// 选中金边（PlayingCard 自带）+ marginTop 负上浮；扇形倾斜靠逐张 rotate。
// ── 扇形手牌（蓝本底部大弧·绝对定位逐张：水平步进叠放 + U 弧上翘 + 扇形旋转 + 选中上浮）──
// 蓝本算法=translateX(中心偏移)+translateY(弧形+lift)+rotate；U 弧（中间牌低·两端翘起=手持牌形），
// 端牌 rotate 左逆右顺。per-card 垂直弧 flex 表达不了 → 绝对定位。
// audit 提示：扇形叠放=纸牌意图叠层，ui-audit 判重叠是盲区（LayoutNode 缺 data-allow-overlap·A-007 报 PUI）。
// 扇形手牌（owner 2026-07-18 二次校准·固定弧模型）：**每张重叠步进固定**（不随张数撑开）、**弧曲率固定**
// （lift=K·offset²·用绝对张数偏移·不归一化）→ 牌越少=整把越短越平但**弧度一致**，居中。牌少「完全展开」=旧
// 归一化+撑满宽 bug，此模型消除。
const HAND_CARD_W = 64;
const HAND_STEP = 25; // 固定重叠步进（每张露出 25px·恒定·牌少不撑开）。满手 27 张≈650px——收窄自 34（A-019 真碰撞修：34 时右端 a-hand-24~26 压进操作按钮区·非 allowOverlap 掩盖；25 两端各留 ~35px 余量）。
const HAND_CURVE_K = 0.28; // 固定弧曲率（lift = K·offset²·弧度一致·不随张数变·更平缓）
const HAND_ROT_PER = 1.6; // 固定每张旋转角（度·扇形一致）
const HAND_CENTER_X = 556; // 扇形中心 x（略左移·给右下操作按钮列腾位·A-019 真碰撞修）。满手右端<操作区左缘 966；左端翘牌旋摆不压立绘框（x/y 双清）。
function buildHandFanNodes(hand: number[], selected: number[], freshDeal = false): LayoutNode[] {
  const n = hand.length;
  if (n === 0) return [];
  const mid = (n - 1) / 2;
  const totalW = HAND_STEP * (n - 1);
  const startX = Math.round(HAND_CENTER_X - totalW / 2 - HAND_CARD_W / 2); // 居中（含半张宽偏移·中心牌心对齐 center）
  const baseY = FIELD_H - 104; // 中间牌顶 y（两端向上翘）
  return hand.map((c, i) => {
    const f = cardFace(c);
    const sel = selected.includes(i);
    const off = i - mid; // 距中心的**绝对**张数偏移（不归一化=弧度恒定·牌少自然浅）
    const lift = Math.round(HAND_CURVE_K * off * off); // U 弧：固定曲率抛物线（两端翘·弧度一致）
    const rot = Math.round(off * HAND_ROT_PER * 10) / 10; // 左端逆时针 / 右端顺时针（固定每张角）
    return {
      type: 'PlayingCard',
      id: `a-hand-${i}`,
      // actionArg=手牌**下标**（非牌码·两副牌同码会联动误选）
      props: { rank: f.rank, suit: f.suit, face: 'light', size: 'md', selected: sel, action: 'hand.toggle', actionArg: String(i) },
      // 扇形手牌=**故意叠放**（playbook §意图叠层）→ allowOverlap 豁免 ui-audit 重叠（相邻牌本就压半张·非误叠）。
      // 发牌错落入场只在 freshDeal（开局/新盘首帧）挂 anim——**否则不挂 anim**（点击/提示/出牌/开关菜单重渲时 style 重写会重启动画→整片手牌重跑·owner 2026-07-22 报过度表现·根因）。
      layout: { x: startX + Math.round(i * HAND_STEP), y: baseY - lift - (sel ? 22 : 0), rotate: rot, allowOverlap: true, ...(freshDeal ? { anim: 'fadeIn' as const, animDelay: i * 22 } : {}) },
    };
  });
}

export function buildPlay(v: PlayView): LayoutNode {
  const l = v.lang;
  const heroTurn = v.turn === 'hero';
  const anchorOf = (id: 'partner' | 'west' | 'east'): { x: number; y: number } =>
    seatTopLeft(SEAT_ANCHORS.find((s) => s.id === id)!);
  const pA = anchorOf('partner');
  const wA = anchorOf('west');
  const eA = anchorOf('east');

  // 中央出牌区（桌心·牌型标签 + 暂大者 + 四家最近一手 + 行动提示）——felt 子节点（祖孙嵌套·audit 不判桌面重叠）。
  // 「谁出的牌谁大」明示（owner 2026-07-18）：当前墩持有者=暂时最大，其余家要么压过、要么过。
  // holderName / trick.name = 宿主已本地化（hero→t(seat.you)·牌型名→handName·随 lang）。
  const holderLabel = v.trick ? v.trick.holderName : '';
  const centerChildren: LayoutNode[] = v.trick
    ? [
        {
          type: 'Panel',
          id: 'a-p-trickhead',
          props: { bare: true },
          layout: { direction: 'row', align: 'center', justify: 'center', gap: 6 },
          children: [
            { type: 'Tag', id: 'a-p-trickname', props: { label: v.trick.name, tone: 'accent', size: 'md' } },
            // 逢人配提示：本墩含 N 张百搭时明示（让玩家看懂 2🃏-6-7-8-9 这类含百搭的合法牌型·owner 2026-07-18）。
            ...(v.trick.wilds > 0
              ? [{ type: 'Tag' as const, id: 'a-p-trickwild', props: { label: fmtWildTag(l, v.trick.wilds), tone: 'warn' as const, size: 'sm' as const } }]
              : []),
            // 暂大牌主：本方(队友/你)=绿(ok·安全)·对手=黄(warn·需压)——一眼看清谁大。
            { type: 'Badge', id: 'a-p-holder', props: { text: fmtHolder(l, holderLabel), tone: v.trick.holderTeam === 0 ? 'ok' : 'warn' } },
          ],
        },
        // 各家出的牌摆在各自座前小牌桌（不在中央重复）；中央只留牌型 + 暂大 + 行动提示。
        {
          type: 'Label',
          id: 'a-p-turn',
          props: {
            text: heroTurn ? t(l, 'play.yourRespond') : v.turn === v.trick.holder ? fmtTurnWonLead(l, v.turnName) : fmtTurnRespond(l, v.turnName),
            size: 'sm',
            color: heroTurn ? 'gold' : 'sub',
            glow: heroTurn, // 轮到你=金光提示（owner 2026-07-22 动态元素）
          },
          ...(heroTurn ? { layout: { anim: 'pulse' as const } } : {}),
        },
      ]
    : [{ type: 'Label', id: 'a-p-lead', props: { text: heroTurn ? t(l, 'play.yourLead') : fmtTurnLead(l, v.turnName), font: 'serif', size: 'lg', bold: true, color: heroTurn ? 'gold' : 'sub', glow: heroTurn }, ...(heroTurn ? { layout: { anim: 'pulse' as const } } : {}) }];
  const centerZone: LayoutNode = {
    type: 'Panel',
    id: 'a-p-center',
    props: { bare: true },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 8, width: 380 },
    children: centerChildren,
  };
  // 进贡/还贡横幅（本盘有则显·felt 子节点=祖孙嵌套·玩家知情盘首进贡）。
  const feltChildren: LayoutNode[] = [];
  // 呢面环境微光（Particles sparkle·render-only·pointer-events:none·衬夜宴华光·满铺呢面·allowOverlap 豁免叠 audit·owner 2026-07-22「很多动态元素」）。
  feltChildren.push({
    type: 'Particles', id: 'a-p-felt-sparkle',
    props: { kind: 'sparkle', count: 10, loop: true },
    layout: { x: 0, y: 0, width: FIELD_W - 464, height: 322, allowOverlap: true },
  });
  if (v.tributeText) {
    feltChildren.push({
      type: 'Panel',
      id: 'a-p-tribute',
      props: { bg: { custom: 'linear-gradient(180deg,rgba(200,53,43,0.28),rgba(30,20,14,0.9))' } },
      layout: { direction: 'row', align: 'center', justify: 'center', gap: 6, padding: 7, radius: 16, margin: 6 },
      children: [
        { type: 'Image', id: 'a-p-tribute-ic', props: { src: art('icon/tribute'), fit: 'contain' }, layout: { width: 18, height: 18 } },
        { type: 'Label', id: 'a-p-tribute-l', props: { text: v.tributeText, size: 'sm', color: 'gold', bold: true } },
      ],
    });
  }
  feltChildren.push(centerZone);
  // 座前小牌桌·**恒 4 槽**（无出牌=空占位）——稳定 felt 子键序，reconciler 只重渲「内容真变了的那槽」，
  // 只有刚出牌的那家的牌重播入场（修 owner 2026-07-18「播打牌动画时全桌牌一起播」bug·根因=旧实现 tray 数随出牌
  // 增减→felt 子键序变→整片 felt 被 outerHTML 重建→所有 tray 一起重播）。
  // 暂大者(holder)的座前牌若是炸弹级牌型→该座前牌走 holo 彩虹箔（trick.family 判炸·holder=当前最大=打炸那家）。
  const bombSeat = v.trick && v.trick.family != null && BOMB_FAMILIES.has(v.trick.family) ? v.trick.holder : null;
  for (const seat of TURN_ORDER) feltChildren.push(seatTrayNode(seat, v.plays[seat], TRAY_POS[seat].x, TRAY_POS[seat].y, l, seat === v.justPlayed, seat === bombSeat));
  // 弹簧箭头指「谁大」（Float 锚定暂大者座前小牌桌·上下弹跳+呼吸光·近似弹簧·owner 2026-07-18）。**恒渲**（无墩=锚到
  // 不存在的槽·Float 找不到目标自隐）——稳定 felt 子键序，箭头出没不再触发整片 felt 重建（=全桌牌重播）。
  // felt 子节点（Float 位置 JS 活取·静态 audit 摆不准=祖孙嵌套豁免同扇形/中央墩）；真 scale 弹簧基座缺→float+glow 近似·A-011。
  feltChildren.push({
    type: 'Float',
    id: 'a-p-bigarrow',
    // Float=JS 活取锚定暂大者座前（静态 audit 摆不准·指向即贴 tray）→ allowOverlap 豁免（意图指示·非误叠）。
    layout: { allowOverlap: true },
    props: { anchorTo: { kind: 'node', id: v.trick ? `a-tray-${v.trick.holder}` : 'a-tray-none', at: 'top', offset: { y: -6 } } },
    children: [
      {
        type: 'Panel',
        id: 'a-p-bigarrow-w',
        props: { bare: true },
        layout: { direction: 'column', align: 'center', gap: 0, anim: 'float' },
        children: [
          { type: 'Label', id: 'a-p-bigarrow-t', props: { text: t(l, 'play.biggest'), size: 'xs', bold: true, color: 'gold', glow: true } },
          { type: 'Label', id: 'a-p-bigarrow-a', props: { text: '▼', size: 22, bold: true, color: 'gold', glow: true } },
        ],
      },
    ],
  });
  // 长方形红呢牌桌（owner 2026-07-22「改长方形桌·退回 2D」·radius 小=方正圆角矩形·felt 天鹅绒红呢 + 暗角 + 金边）·进贡横幅 + 出牌区 flex 居中于桌心（felt 子节点）。
  const feltTable: LayoutNode = {
    type: 'Panel',
    id: 'a-felt',
    props: { bg: { custom: feltTexture() }, vignette: true, accent: true },
    layout: { x: 232, y: 148, width: FIELD_W - 464, height: 322, radius: 28, direction: 'column', align: 'center', justify: 'center', gap: 8 },
    children: feltChildren,
  };

  // 级牌信息条（牌桌下方 pill 一行）。
  const infoBar: LayoutNode = {
    type: 'Panel',
    id: 'a-p-info',
    props: { bg: { custom: 'linear-gradient(180deg,rgba(30,20,14,0.94),rgba(20,14,10,0.9))' } },
    layout: { x: FIELD_W / 2 - 210, y: 512, width: 420, direction: 'row', gap: 12, align: 'center', justify: 'center', padding: 8, radius: 20 },
    children: [
      { type: 'Tag', id: 'a-p-level', props: { label: fmtLevelTag(l, v.levelPlay), tone: 'accent', size: 'sm', icon: art('icon/level') } },
      { type: 'Label', id: 'a-p-lv', props: { text: fmtLevels(l, v.levelOurs, v.levelTheirs), size: 'sm', color: 'sub' } },
      { type: 'Badge', id: 'a-p-stake', props: { text: fmtStake(l, v.stake), tone: 'ok' } },
      { type: 'Label', id: 'a-p-round', props: { text: fmtRound(l, v.round), size: 'sm', color: 'sub' } },
    ],
  };

  // 主角立绘框（左·A-CHAR-HERO 占位·S6 真立绘）。owner 2026-07-20：尺寸大一倍——头像 64→112、框 84×126→128×194；
  // 位置由「左下角」上移到「西家席位下方·手牌扇左缘之上」的左侧留白带（bottom≈560 让过满手扇左端 y≈569），
  // 这样放大后既不压手牌扇（无需右移扇心·免右端挤操作区）、也不压西家席位/felt——纯占左侧空区。
  const heroPortrait: LayoutNode = {
    type: 'Panel',
    id: 'a-p-portrait',
    props: { vignette: true },
    layout: { x: 10, y: 358, width: 128, height: 192, direction: 'column', align: 'center', justify: 'center', gap: 6, padding: 8 },
    children: [
      { type: 'Avatar', id: 'a-p-portrait-face', props: { name: v.seats.hero.seat.name, size: 112, shape: 'rounded' } },
      { type: 'Label', id: 'a-p-portrait-l', props: { text: t(l, 'menu.portraitTitle'), size: 'xs', color: 'dim' } },
      { type: 'Label', id: 'a-p-portrait-dress', props: { text: fmtDress(l, v.seats.hero.dress, DRESS_TIERS), size: 'xs', color: 'sub' } },
    ],
  };

  // 操作区（右下角两行·紧凑靠底·让手牌大弧延伸其上方·参考稿版式）。
  //   行1（y636）：提示 / 过 / 出牌；行2（y684）：金钱 · 理牌 Segmented · 记牌器。
  // 压不过下家最大牌（只能过）→「过」升为金色 CTA + 呼吸光高亮·「出牌」降格·「提示」禁用（owner 2026-07-18：不该让人自己找）。
  const passHi = heroTurn && v.mustPass;
  const actionRow1: LayoutNode = {
    type: 'Panel',
    id: 'a-p-act-btns',
    props: { bare: true },
    layout: { x: FIELD_W - 314, y: 634, width: 302, direction: 'row', gap: 8, align: 'center', justify: 'end' },
    children: [
      // press3d=按压沉 Z+底唇（触屏友好糖果按钮·手感·owner 2026-07-22 动态元素）。
      { type: 'Button', id: 'a-p-hint', props: { label: t(l, 'play.hint'), kind: 'ghost', action: 'play.hint', disabled: !heroTurn || v.mustPass }, layout: { press3d: true } },
      {
        type: 'Button', id: 'a-p-pass',
        props: { label: passHi ? t(l, 'play.passSkip') : t(l, 'play.pass'), kind: passHi ? 'primary' : 'quiet', action: 'play.pass', disabled: !heroTurn || !v.canPass },
        layout: passHi ? { anim: 'glow' as const, press3d: true } : { press3d: true },
      },
      { type: 'Button', id: 'a-p-commit', props: { label: t(l, 'play.commit'), kind: passHi ? 'ghost' : 'primary', action: 'play.commit', disabled: !heroTurn || !v.canCommit }, layout: { press3d: true } },
    ],
  };
  const actionRow2: LayoutNode = {
    type: 'Panel',
    id: 'a-p-act-tools',
    props: { bare: true },
    layout: { x: FIELD_W - 336, y: 682, width: 324, direction: 'row', gap: 8, align: 'center', justify: 'end' },
    children: [
      coinTag('a-p-wallet', fmtMoney(v.wallet)),
      {
        type: 'Segmented',
        id: 'a-p-sort',
        props: { options: [{ value: 'rank', label: t(l, 'play.sortRank') }, { value: 'family', label: t(l, 'play.sortFamily') }], value: v.sortMode, action: 'hand.sort' },
      },
      { type: 'Button', id: 'a-p-counter', props: { label: v.showCounter ? t(l, 'play.counterHide') : t(l, 'play.counterShow'), kind: 'quiet', action: 'tools.counter', icon: art('icon/counter') } },
    ],
  };
  const actionHint: LayoutNode = {
    type: 'Panel',
    id: 'a-p-why-wrap',
    props: { bare: true },
    layout: { x: FIELD_W - 314, y: 610, width: 302, direction: 'row', justify: 'end' },
    children: [{
      type: 'Label',
      id: 'a-p-why',
      props: {
        text: !heroTurn
          ? fmtActing(l, v.turnName)
          : passHi
            ? t(l, 'play.mustPass')
            : !v.canCommit && v.selected.length > 0
              ? v.commitWhy // 非法原因来自 session.legalCheck（红线·恒中文·见 game-a.ts commitState 注）
              : t(l, 'play.selectHint'),
        size: 'xs',
        color: passHi ? 'gold' : heroTurn && !v.canCommit && v.selected.length > 0 ? 'warn' : 'dim',
      },
    }],
  };

  // 右上角：语言段控（EN/中·mirror game-c 顶栏）+ ☰ 菜单（出牌日志/规则/设置）+ 返回。
  const topWrap: LayoutNode = {
    type: 'Panel',
    id: 'a-p-backwrap',
    props: { bare: true },
    layout: { x: FIELD_W - 330, y: 12, width: 318, direction: 'row', gap: 8, align: 'center', justify: 'end' },
    children: [
      langToggle(l, 'a-p-lang'),
      { type: 'Button', id: 'a-p-menu', props: { label: t(l, 'play.menu'), kind: 'quiet', action: 'menu.open', icon: art('icon/menu') } },
      { type: 'Button', id: 'a-p-back', props: { label: t(l, 'sel.back'), kind: 'ghost', action: 'table.back' } },
    ],
  };
  const gameMenu: LayoutNode | null = v.showMenu
    ? buildGameMenu({ lang: l, menuTab: v.menuTab, logRows: v.logRows, tierName: v.tierName, levelPlay: v.levelPlay, stake: v.stake, wallet: v.wallet, sortMode: v.sortMode, seed: v.seed })
    : null;

  // 记牌器（居中模态浮层·明面已出牌计数·点「▤ 记牌器」开·点遮罩/关闭收·不开天眼）。
  const counterPanel: LayoutNode | null = v.showCounter
    ? {
        type: 'Modal',
        id: 'a-p-counter-modal',
        props: { title: t(l, 'counter.title'), size: 'sm', closable: true, closeAction: 'tools.counter' },
        children: [
          { type: 'Label', id: 'a-p-counter-hint', props: { text: t(l, 'counter.hint'), size: 'xs', color: 'sub' } },
          {
            type: 'Table',
            id: 'a-p-counter-table',
            props: {
              columns: [
                { key: 'rank', label: t(l, 'counter.rank'), width: 72 },
                { key: 'played', label: t(l, 'counter.played'), width: 72, align: 'center' },
                { key: 'left', label: t(l, 'counter.left'), align: 'center' },
              ],
              rows: v.counter.map((r) => ({
                id: `cnt-${r.rank}`,
                cells: { rank: r.rank, played: `${r.played}/${r.total}`, left: String(r.total - r.played) },
                tone: (r.total - r.played === 0 ? 'dim' : 'normal') as 'dim' | 'normal',
              })),
            },
          },
        ],
      }
    : null;

  // 夜宴跑马灯（桌下窄带 y474·felt 底 470 与信息条 512 之间空档·anim:marquee 横向滚动氛围条·owner 2026-07-22 三层特效）。
  const ticker = l === 'zh'
    ? `🀄 夜宴既开，落座从容　·　第 ${v.round} 盘　·　稳中求胜，静观其变　·　快牌快开，气氛正酣　✦　`
    : `🀄 The banquet begins　·　Round ${v.round}　·　Play steady, read the table　·　keep it lively　✦　`;
  const tickerBar: LayoutNode = {
    type: 'Panel', id: 'a-p-ticker',
    props: { bg: { custom: 'linear-gradient(90deg,transparent,rgba(30,20,14,0.55) 12%,rgba(30,20,14,0.55) 88%,transparent)' } },
    layout: { x: FIELD_W / 2 - 300, y: 474, width: 600, height: 20, direction: 'row', align: 'center', radius: 10, allowOverlap: true },
    children: [{ type: 'Label', id: 'a-p-ticker-t', props: { text: ticker, size: 'sm', color: 'gold', bold: true }, layout: { anim: 'marquee', allowOverlap: true } }],
  };

  // z 序（DOM 顺序）：桌 → 中央墩 → 席位 → 信息条 → 立绘/操作 → 手牌扇（最上·可点）→ 返回。
  return {
    type: 'Screen',
    id: 'a-play',
    props: { image: art('bg/table') }, // 2D 牌室背图（owner 2026-07-22 退回 2D）
    layout: { width: FIELD_W, height: FIELD_H },
    children: [
      feltTable, // 含中央出牌区（祖孙嵌套）
      seatCard(v.seats.partner, pA.x, pA.y, v.turn === 'partner', v.trick?.holder === 'partner', l),
      seatCard(v.seats.west, wA.x, wA.y, v.turn === 'west', v.trick?.holder === 'west', l),
      seatCard(v.seats.east, eA.x, eA.y, v.turn === 'east', v.trick?.holder === 'east', l),
      infoBar,
      tickerBar,
      heroPortrait,
      ...buildHandFanNodes(v.hand, v.selected, v.freshDeal),
      actionHint,
      actionRow1,
      actionRow2,
      ...(counterPanel ? [counterPanel] : []),
      ...(gameMenu ? [gameMenu] : []),
      topWrap,
    ],
  };
}

// ── 游戏内菜单（☰）：出牌日志 + 牌型/规则说明 + 设置（owner 2026-07-18·让玩家能复制日志+学规则）──
// 全 LayoutNode 闭集（Modal + Tabs + Table + Label）；Tabs.action='menu.tab' 由宿主记 active（AI 重渲不丢页）。
export interface LogRow { round: number; who: string; act: string; cards: string; fam: string; pass?: boolean } // act/who/cards/fam=中文日志口径（红线·恒中文）；pass=过牌置灰用（非中文串比对）
export interface GameMenuView {
  lang: Lang; // 界面语言（owner 2026-07-20 中英切换）
  menuTab: 'log' | 'rules' | 'settings';
  logRows: LogRow[];
  tierName: string; // 已本地化难度显示名（宿主传 tierName(lang,id)·pre-game 菜单='—'）
  levelPlay: number;
  stake: number;
  wallet: number;
  sortMode: 'rank' | 'family';
  seed: number; // 本局 run 种子（设置页显示·供报 bug 复现）
}
// 牌型说明表 PATTERN_GUIDE + 基本规则 RULES_LINES = strings.ts 双语静态数据（按 v.lang 取·非规则逻辑）。
export function buildGameMenu(v: GameMenuView): LayoutNode {
  const l = v.lang;
  const logTab: LayoutNode = {
    type: 'Panel', id: 'a-menu-log', props: { bare: true },
    layout: { direction: 'column', gap: 8, padding: 4 },
    children: [
      {
        type: 'Panel', id: 'a-menu-log-head', props: { bare: true },
        layout: { direction: 'row', gap: 8, align: 'center', justify: 'between' },
        children: [
          { type: 'Label', id: 'a-menu-log-hint', props: { text: t(l, 'gm.logHint'), size: 'xs', color: 'sub' } },
          // 一键复制本盘完整记录（起始四家手牌 + 过程 + 结果）→ 剪贴板·发作者调 AI（owner 2026-07-18）。
          { type: 'Button', id: 'a-menu-log-copy', props: { label: t(l, 'gm.copyLog'), kind: 'quiet', action: 'tools.copylog', icon: art('icon/copy') } },
        ],
      },
      v.logRows.length === 0
        ? { type: 'Label', id: 'a-menu-log-empty', props: { text: t(l, 'gm.logEmpty'), size: 'sm', color: 'dim' } }
        : {
            type: 'Table', id: 'a-menu-log-tbl',
            props: {
              columns: [
                { key: 'round', label: t(l, 'gm.colRound'), width: 40, align: 'center' },
                { key: 'who', label: t(l, 'gm.colWho'), width: 90 },
                { key: 'act', label: t(l, 'gm.colAct'), width: 56, align: 'center' },
                { key: 'cards', label: t(l, 'gm.colCards') },
                { key: 'fam', label: t(l, 'gm.colType'), width: 92 },
              ],
              rows: v.logRows.map((r, i) => ({
                id: `a-lg-${i}`,
                cells: { round: String(r.round), who: r.who, act: r.act, cards: r.cards, fam: r.fam },
                tone: (r.pass ? 'dim' : 'normal') as 'dim' | 'normal',
              })),
            },
          },
    ],
  };
  const rulesTab: LayoutNode = {
    type: 'Panel', id: 'a-menu-rules', props: { bare: true },
    layout: { direction: 'column', gap: 8, padding: 4 },
    children: [
      { type: 'Label', id: 'a-menu-rules-h1', props: { text: t(l, 'gm.rulesH1'), size: 'sm', bold: true, color: 'gold' } },
      {
        type: 'Table', id: 'a-menu-pat-tbl',
        props: {
          columns: [
            { key: 'name', label: t(l, 'gm.colType'), width: 116 },
            { key: 'eg', label: t(l, 'gm.colEg'), width: 152 },
            { key: 'note', label: t(l, 'gm.colNote') },
          ],
          rows: PATTERN_GUIDE[l].map((p, i) => ({ id: `a-pat-${i}`, cells: { name: p.name, eg: p.eg, note: p.note } })),
        },
      },
      { type: 'Label', id: 'a-menu-rules-h2', props: { text: t(l, 'gm.rulesH2'), size: 'sm', bold: true, color: 'gold' } },
      ...RULES_LINES[l].map((r, i) => ({
        type: 'Label' as const, id: `a-menu-rule-${i}`,
        props: { text: `· ${r.t}`, size: 'xs' as const, color: 'sub' as const, bold: r.b }, // sub=可读正文（dim 4.49 差 AA·规则是要读的内容）
      })),
    ],
  };
  const settingsTab: LayoutNode = {
    type: 'Panel', id: 'a-menu-set', props: { bare: true },
    layout: { direction: 'column', gap: 8, padding: 4 },
    children: [
      { type: 'Label', id: 'a-menu-set-h', props: { text: t(l, 'gm.setH'), size: 'sm', bold: true, color: 'gold' } },
      {
        type: 'Panel', id: 'a-menu-set-row', props: { bare: true },
        layout: { direction: 'row', gap: 8, align: 'center' },
        children: [
          { type: 'Tag', id: 'a-menu-set-tier', props: { label: fmtTierName(l, v.tierName), tone: 'accent', size: 'sm' } },
          { type: 'Tag', id: 'a-menu-set-lvl', props: { label: fmtLevelTag(l, v.levelPlay), tone: 'normal', size: 'sm' } },
          { type: 'Badge', id: 'a-menu-set-stake', props: { text: fmtStake(l, v.stake), tone: 'ok' } },
          coinTag('a-menu-set-wallet', fmtMoney(v.wallet)),
        ],
      },
      // 语言段控（设置页也放一份·EN/中·mirror game-c 设置项）
      {
        type: 'Panel', id: 'a-menu-set-lang-row', props: { bare: true },
        layout: { direction: 'row', gap: 8, align: 'center' },
        children: [
          { type: 'Label', id: 'a-menu-set-lang-l', props: { text: t(l, 'gm.language'), size: 'xs', color: 'sub' } },
          langToggle(l, 'a-menu-set-lang'),
        ],
      },
      { type: 'Label', id: 'a-menu-set-sort', props: { text: fmtSortSetting(l, v.sortMode), size: 'xs', color: 'sub' } },
      { type: 'Label', id: 'a-menu-set-seed', props: { text: fmtSeed(l, v.seed), size: 'xs', color: 'sub' } },
      { type: 'Label', id: 'a-menu-set-more', props: { text: t(l, 'gm.setMore'), size: 'xs', color: 'dim' } },
    ],
  };
  return {
    type: 'Modal',
    id: 'a-menu-modal',
    props: { title: t(l, 'gm.title'), size: 'lg', closable: true, closeAction: 'menu.close' },
    children: [
      {
        type: 'Tabs',
        id: 'a-menu-tabs',
        props: {
          tabs: [{ id: 'log', label: t(l, 'gm.tabLog') }, { id: 'rules', label: t(l, 'gm.tabRules') }, { id: 'settings', label: t(l, 'gm.tabSettings') }],
          active: v.menuTab,
          action: 'menu.tab',
        },
        children: [logTab, rulesTab, settingsTab],
      },
    ],
  };
}

// ── 盘结算浮层（SC-4·名次+金钱+级数+服饰·run 终局变体）──────────────────────────
export interface ResultView {
  lang: Lang; // 界面语言（owner 2026-07-20 中英切换）
  ranking: { seat: SeatId; name: string; team: 0 | 1 }[];
  winnersTeam: 0 | 1;
  comboLabel: string; // 双上/一三/一四·宿主已本地化（fmtComboLabel）
  totalMult: number;
  payPerPlayer: number;
  levelAfter: [number, number];
  dressOutDoubled: boolean;
  phase: 'settled' | 'run-won' | 'run-lost';
}
export function buildResult(v: ResultView): LayoutNode {
  const l = v.lang;
  const runEnd = v.phase !== 'settled';
  const title = v.phase === 'run-won' ? t(l, 'res.titleWon') : v.phase === 'run-lost' ? t(l, 'res.titleLost') : t(l, 'res.titleSettled');
  const heroWon = v.winnersTeam === 0;
  const rankRows = v.ranking.map((r, i) => ({
    id: `rank-${i}`,
    cells: { no: `${i + 1}`, name: r.name, side: r.team === 0 ? t(l, 'side.us') : t(l, 'side.them') },
    tone: (r.team === v.winnersTeam ? 'accent' : 'normal') as 'accent' | 'normal',
  }));
  const dressLine: LayoutNode = v.dressOutDoubled
    ? { type: 'Label', id: 'a-r-dress', props: { text: t(l, 'res.dressDoubled'), size: 'xs', color: 'warn' } }
    : { type: 'Label', id: 'a-r-dress', props: { text: t(l, 'res.dressNormal'), size: 'xs', color: 'sub' } };
  const actionBtn: LayoutNode = runEnd
    ? { type: 'Button', id: 'a-r-home', props: { label: t(l, 'res.home'), kind: 'primary', action: 'table.back' } }
    : { type: 'Button', id: 'a-r-next', props: { label: t(l, 'res.next'), kind: 'primary', action: 'round.next' } };
  return {
    type: 'Screen',
    id: 'a-result',
    props: { bg: { custom: 'linear-gradient(180deg,rgba(20,10,11,0.94),rgba(20,10,11,0.98)),#140a0b' }, image: art('bg/table'), center: true },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 14, padding: 24 },
    children: [
      // 通关胜利彩带（仅 run-won·满屏叠于结算卡后）：底图 fx/win（换图即生效）+ 彩纸雨 Particles + 金币雨 Particles（一次性爆·owner 2026-07-22 特效）。
      ...(v.phase === 'run-won'
        ? [
            { type: 'Image', id: 'a-r-confetti', props: { src: art('fx/win'), fit: 'cover' as const }, layout: { x: 0, y: 0, width: FIELD_W, height: FIELD_H, anim: 'fadeIn' as const } } as LayoutNode,
            { type: 'Particles', id: 'a-r-confetti-fx', props: { kind: 'confetti', loop: false }, layout: { x: 0, y: 0, width: FIELD_W, height: FIELD_H, allowOverlap: true } } as LayoutNode,
            { type: 'Particles', id: 'a-r-coins-fx', props: { kind: 'coins', loop: false }, layout: { x: 0, y: 0, width: FIELD_W, height: FIELD_H, allowOverlap: true } } as LayoutNode,
          ]
        : []),
      // 金币飞进奖金（flyTo·仅赢·5 枚从上方沿弧线拖尾飞落 a-r-pay 奖金数·owner 2026-07-22 三层特效）。
      ...(heroWon
        ? Array.from({ length: 5 }, (_, i) => ({
            type: 'Image' as const, id: `a-r-fly-${i}`, props: { src: art('icon/coin'), fit: 'contain' as const },
            layout: { x: FIELD_W / 2 - 13 + (i - 2) * 46, y: 148, width: 26, height: 26, flyTo: { to: 'a-r-pay', arc: 66, delay: 300 + i * 120, ms: 820 }, allowOverlap: true },
          } as LayoutNode))
        : []),
      {
        type: 'Panel',
        id: 'a-r-card',
        props: { vignette: true, accent: heroWon }, // 胜=金边（手感 placeholder·owner 2026-07-18·真特效留下一步美术）
        layout: { direction: 'column', align: 'center', gap: 12, padding: 26, anim: 'pop' }, // 结算卡一次性 pop 入场
        children: [
          { type: 'Label', id: 'a-r-title', props: { text: title, font: 'elegant', size: 'xxl', bold: true, glow: heroWon, color: runEnd ? (heroWon ? 'gold' : 'danger') : 'gold' }, ...(heroWon ? { layout: { fx: [{ kind: 'sheen' as const }] } } : {}) },
          {
            type: 'Table',
            id: 'a-r-rank',
            props: {
              columns: [
                { key: 'no', label: t(l, 'res.colNo'), width: 48, align: 'center' },
                { key: 'name', label: t(l, 'res.colSeat') },
                { key: 'side', label: t(l, 'res.colSide'), width: 64, align: 'center' },
              ],
              rows: rankRows,
            },
          },
          {
            type: 'Panel',
            id: 'a-r-money',
            props: { bare: true },
            layout: { direction: 'row', gap: 10, align: 'center', justify: 'center' },
            children: [
              { type: 'Tag', id: 'a-r-combo', props: { label: v.comboLabel, tone: 'accent', size: 'sm' } },
              { type: 'Badge', id: 'a-r-mult', props: { text: `×${v.totalMult}`, tone: 'ok' } },
              // 结算奖金**数字滚动**（tween 0→额·owner 2026-07-22 三层特效）：符号 + 滚动数（保 a-r-pay id 供金币 flyTo 落点）。
              {
                type: 'Panel', id: 'a-r-pay', props: { bare: true },
                layout: { direction: 'row', gap: 1, align: 'center', anim: 'pop' },
                children: [
                  { type: 'Label', id: 'a-r-pay-sign', props: { text: heroWon ? '+' : '−', size: 'lg', bold: true, color: heroWon ? 'ok' : 'danger' } },
                  { type: 'Label', id: 'a-r-pay-n', props: { text: fmtMoney(v.payPerPlayer), tween: { from: 0, to: v.payPerPlayer, ms: 900 }, size: 'lg', bold: true, color: heroWon ? 'ok' : 'danger', glow: true } },
                ],
              },
              { type: 'Label', id: 'a-r-lv', props: { text: fmtLevelsAfter(l, v.levelAfter[0], v.levelAfter[1]), size: 'sm', color: 'sub' } },
            ],
          },
          dressLine,
          {
            type: 'Panel', id: 'a-r-foot', props: { bare: true },
            layout: { direction: 'row', gap: 10, align: 'center', justify: 'center' },
            children: [
              // 复制本盘完整记录（发牌+过程+结果）→ 剪贴板 + F12·发作者调 AI（owner 2026-07-18）。
              { type: 'Button', id: 'a-r-copylog', props: { label: t(l, 'gm.copyLog'), kind: 'ghost', action: 'tools.copylog', sub: t(l, 'res.copyLogSub') } },
              actionBtn,
            ],
          },
        ],
      },
    ],
  };
}
