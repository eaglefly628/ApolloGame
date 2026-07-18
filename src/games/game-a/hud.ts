// Game A ·《掼蛋夜宴》—— 全部 UI = 纯 LayoutNode 数据（UI 铁律·夜宴皮 GAME_A_THEME）。
// S5 UI 关：按 owner 钦定蓝本 guandan-lite-mockup.html **1:1 复刻**（椭圆felt桌+席位环+中央墩+扇形手牌+
// 信息条+立绘框+glass操作区·绝对定位屏幕锚点·同 game-c 夜宴牌桌先例）。三屏=SC-1 菜单 / SC-3 牌桌 / SC-4 结算。
// 写世界只经 action 信号；action（menu.start/table.back/hand.toggle/play.commit/pass/hint/round.next/hand.sort）由宿主
// HandlerMap 消化，handler 只做「选牌记账 + 调 session + 重渲」——不塞判型/结算逻辑（那些在 guandan-session sim 内）。
// ui-audit 残留角标对比=light 白扑克牌+扇形叠放盲区（A-007 报 PUI·不降格·owner 两层 1:1 律=视觉 1:1）。
import type { LayoutNode } from '@ui/components/index.js';
import type { SeatSpec } from './rules.js';
import { DRESS_TIERS, codeRank, codeSuit, AI_TIERS, STAKES, BUYIN_MULT, SEATS } from './rules.js';
import { MANOR_BG, FELT_RED, FIELD_W, FIELD_H, SEAT_ANCHORS, SEAT_W, seatTopLeft } from './theme.js';
import { FAMILY_CN, TURN_ORDER, type SeatId } from './guandan-session.js';

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
}
const fmtMoney = (n: number): string => n.toLocaleString('en-US');

// ── SC-1 主菜单（1:1 复刻设计稿 main-menu-guandan.dc.html·owner 2026-07-18）────────────────
// 稿 = 1280×720 绝对定位：星点背景 + 左侧主角立绘占位(300×440) + 左下头像/名/金币 + 右上级牌+大标题
// (掼蛋 米白 / 夜宴 朱砂) + 右侧按钮列(开始上桌金 CTA / 继续 / 设置) + 右下版本。夜宴皮=深胡桃×朱砂×米金。
// 差异（逐条·非阻断）：① 立绘占位去掉 EN-prompt/A-CHAR 台账标注（美术生产注解·非玩家 UI）；
//   ② bob/glow/twinkle 呼吸动效简化（星点用 Particles·徽标静态）；③「继续上局」暂无存档=同「开始」。
const MENU_BG = 'radial-gradient(90% 120% at 78% 30%,#31201a,#160e0a 75%)';
export interface MenuView {
  wallet: number;
  level: number; // 本家级牌（无存档=起始 2）
  showMenu: boolean; // 游戏内菜单（规则/设置）浮层
  menuTab: 'log' | 'rules' | 'settings';
}
export function buildMenu(v: MenuView): LayoutNode {
  const overlay = v.showMenu
    ? buildGameMenu({ menuTab: v.menuTab, logRows: [], tierName: '—', levelPlay: v.level, stake: 0, wallet: v.wallet, sortMode: 'rank', seed: 0 })
    : null;
  return {
    type: 'Screen',
    id: 'a-menu',
    props: { bg: { custom: MENU_BG } },
    layout: { width: FIELD_W, height: FIELD_H },
    children: [
      // 主角立绘占位（左·300×440·斜纹虚框·真立绘 S6 台账 A-CHAR-HERO）
      {
        type: 'Panel',
        id: 'a-menu-portrait',
        props: { vignette: true, bg: { custom: 'repeating-linear-gradient(45deg,rgba(216,184,120,.06) 0 9px,transparent 9px 18px),linear-gradient(160deg,rgba(30,20,14,.72),rgba(22,15,11,.5))' } },
        layout: { x: 96, y: 132, width: 300, height: 440, direction: 'column', align: 'center', justify: 'center', gap: 14, padding: 26, radius: 14 },
        children: [
          { type: 'Label', id: 'a-menu-portrait-icon', props: { text: '▤', size: 44, color: 'gold' } },
          { type: 'Label', id: 'a-menu-portrait-t', props: { text: '主角立绘', font: 'serif', size: 'xxl', bold: true, color: 'text' } },
          { type: 'Tag', id: 'a-menu-portrait-sz', props: { label: '尺寸 300 × 440 · 竖幅', tone: 'accent', size: 'sm' } },
          { type: 'Label', id: 'a-menu-portrait-anchor', props: { text: '风格锚 · 二次元 / 柔光 / 暖夜', size: 'xs', color: 'jade' } },
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
              { type: 'Badge', id: 'a-menu-player-money', props: { text: `◉ ${fmtMoney(v.wallet)}`, tone: 'warn' } },
            ],
          },
        ],
      },
      // 标题（右上·本家级牌 + 掼蛋夜宴大字 + 副标·右对齐）
      {
        type: 'Panel',
        id: 'a-menu-title',
        props: { bare: true },
        layout: { x: 520, y: 74, width: 680, direction: 'column', align: 'end', gap: 12 },
        children: [
          {
            type: 'Panel',
            id: 'a-menu-level',
            props: { bare: true },
            layout: { direction: 'row', align: 'center', gap: 10 },
            children: [
              { type: 'Label', id: 'a-menu-level-l', props: { text: '本家级牌', size: 'sm', color: 'sub' } },
              // 级牌红徽（稿=朱砂红渐变·闭集 Tag/Badge 无 danger 档→创作者指定红底 custom·同 felt 先例）
              {
                type: 'Panel',
                id: 'a-menu-level-v',
                props: { bg: { custom: 'linear-gradient(160deg,rgba(200,53,43,.9),rgba(122,26,18,.92))' } },
                layout: { direction: 'row', align: 'center', gap: 3, padding: 7, radius: 10 },
                children: [
                  { type: 'Label', id: 'a-menu-level-v-t', props: { text: '级', size: 'sm', bold: true, color: 'text' } },
                  { type: 'Label', id: 'a-menu-level-v-n', props: { text: String(v.level), size: 'md', bold: true, color: 'gold' } },
                ],
              },
            ],
          },
          { type: 'Label', id: 'a-menu-title-t', props: { size: 80, font: 'serif', bold: true, color: 'text', spans: [{ text: '掼蛋' }, { text: '夜宴', color: 'danger' }] } },
          { type: 'Label', id: 'a-menu-title-sub', props: { text: '四人两副牌 · 升级同盟 · 逢局必争', size: 'md', color: 'sub' } },
        ],
      },
      // 按钮列（右·红包 tip + 开始上桌金 CTA + 继续 + 设置）
      {
        type: 'Panel',
        id: 'a-menu-btns',
        props: { bare: true },
        layout: { x: 960, y: 352, width: 240, direction: 'column', gap: 14, align: 'stretch' },
        children: [
          { type: 'Badge', id: 'a-menu-tip', props: { text: '每日首局 +88 红包', tone: 'warn' } },
          { type: 'Button', id: 'a-menu-start', props: { label: '开始上桌', kind: 'primary', action: 'menu.start' } }, // primary=米金 CTA 深字(hero 是金字金底 1.05 糊)
          { type: 'Button', id: 'a-menu-resume', props: { label: '继续上局', kind: 'ghost', action: 'menu.start' } },
          { type: 'Button', id: 'a-menu-settings', props: { label: '设置 · 规则', kind: 'ghost', action: 'menu.settings' } },
        ],
      },
      // 版本（右下）
      {
        type: 'Panel',
        id: 'a-menu-ver-wrap',
        props: { bare: true },
        layout: { x: 1000, y: 688, width: 200, direction: 'row', justify: 'end' },
        children: [{ type: 'Label', id: 'a-menu-ver', props: { text: 'v0.1.0 · 盒庭线', size: 'xs', color: 'dim' } }],
      },
      ...(overlay ? [overlay] : []),
    ],
  };
}

// ── SC-2 选桌（难度×底注选择 + 三家人设预览 + 带入确认·owner 稿 SC-2）──────────────
const TRAIT_CN: Record<string, string> = { 沉稳: '稳健', 护家: '护家', 锋利: '锋利', 好胜: '好胜', 跳脱: '多变', 爱起哄: '起哄' };
export interface TableSelectView {
  difficulty: 'l1' | 'l2' | 'l3' | 'l4';
  stake: number;
  wallet: number;
}
function seatPreview(seat: SeatSpec): LayoutNode {
  const foe = seat.team === 1;
  const trait = seat.traits?.[0] ? (TRAIT_CN[seat.traits[0]] ?? seat.traits[0]) : '';
  return {
    type: 'Card',
    id: `a-sel-npc-${seat.id}`,
    props: { title: seat.name },
    layout: { direction: 'column', align: 'center', gap: 6, padding: 12, width: 132 },
    children: [
      { type: 'Avatar', id: `a-sel-npc-${seat.id}-face`, props: { name: seat.name, size: 52, shape: 'circle' } },
      {
        type: 'Panel',
        id: `a-sel-npc-${seat.id}-tags`,
        props: { bare: true },
        layout: { direction: 'row', gap: 4, justify: 'center' },
        children: [
          { type: 'Tag', id: `a-sel-npc-${seat.id}-side`, props: { label: foe ? '对手' : '队友', tone: foe ? 'normal' : 'accent', size: 'sm' } },
          ...(trait ? [{ type: 'Tag' as const, id: `a-sel-npc-${seat.id}-trait`, props: { label: trait, tone: 'dim' as const, size: 'sm' as const } }] : []),
        ],
      },
    ],
  };
}
export function buildTableSelect(v: TableSelectView): LayoutNode {
  const buyin = v.stake * BUYIN_MULT;
  const affordable = v.wallet >= buyin;
  const tierSpec = AI_TIERS.find((t) => t.id === v.difficulty)!;
  const aiSeats = SEATS.filter((s) => s.kind === 'ai');
  return {
    type: 'Screen',
    id: 'a-select',
    props: { bg: { custom: MANOR_BG }, center: true },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 14, padding: 24 },
    children: [
      {
        type: 'Panel',
        id: 'a-sel-card',
        props: { vignette: true },
        layout: { direction: 'column', align: 'center', gap: 14, padding: 26, width: 640 },
        children: [
          { type: 'Label', id: 'a-sel-title', props: { text: '选桌', font: 'elegant', size: 'xxl', bold: true, color: 'gold' } },
          // 难度
          {
            type: 'Panel',
            id: 'a-sel-diff-row',
            props: { bare: true },
            layout: { direction: 'column', align: 'center', gap: 6 },
            children: [
              { type: 'Label', id: 'a-sel-diff-l', props: { text: '难度', size: 'sm', color: 'sub' } },
              {
                type: 'Segmented',
                id: 'a-sel-diff',
                props: { options: AI_TIERS.map((t) => ({ value: t.id, label: t.name })), value: v.difficulty, action: 'select.difficulty' },
              },
              {
                type: 'Label',
                id: 'a-sel-diff-hint',
                props: {
                  text: tierSpec.peek > 0 ? `⚠ ${tierSpec.name}会读牌（开局偷看每对手 ${tierSpec.peek} 张·公平告知）` : `${tierSpec.name} · ${tierSpec.memory === 'full' ? '全量记牌' : tierSpec.memory === 'big-cards' ? '记大牌' : '不记牌'}`,
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
              { type: 'Label', id: 'a-sel-stake-l', props: { text: '底注', size: 'sm', color: 'sub' } },
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
            children: aiSeats.map((s) => seatPreview(s)),
          },
          // 带入确认 + 入座
          {
            type: 'Panel',
            id: 'a-sel-buyin',
            props: { bare: true },
            layout: { direction: 'row', gap: 10, align: 'center', justify: 'center' },
            children: [
              { type: 'Label', id: 'a-sel-buyin-l', props: { text: '带入', size: 'sm', color: 'sub' } },
              { type: 'Badge', id: 'a-sel-buyin-v', props: { text: `💰 ${fmtMoney(buyin)}`, tone: affordable ? 'ok' : 'warn' } },
              { type: 'Label', id: 'a-sel-buyin-note', props: { text: `底注 ${v.stake} × 20 · 荷包 ${fmtMoney(v.wallet)}`, size: 'xs', color: 'dim' } },
            ],
          },
          {
            type: 'Panel',
            id: 'a-sel-btns',
            props: { bare: true },
            layout: { direction: 'row', gap: 10, align: 'center', justify: 'center' },
            children: [
              { type: 'Button', id: 'a-sel-back', props: { label: '返回', kind: 'ghost', action: 'select.back' } },
              { type: 'Button', id: 'a-sel-seat', props: { label: '入座开局', kind: 'primary', action: 'select.seat', sub: affordable ? undefined : '荷包不足·按结余入座' } },
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
function seatCard(v: SeatView, x: number, y: number, active: boolean, leading: boolean, bubble?: string): LayoutNode {
  const foe = v.seat.team === 1;
  const trait = v.seat.traits?.[0] ? (TRAIT_CN[v.seat.traits[0]] ?? v.seat.traits[0]) : '';
  return {
    type: 'Panel',
    id: `a-seat-${v.seat.id}`,
    props: { accent: active, bg: { custom: 'linear-gradient(180deg,rgba(30,20,14,0.92),rgba(20,14,10,0.86))' } },
    layout: { x, y, width: SEAT_W, direction: 'column', align: 'center', gap: 3, padding: 8, radius: 14 },
    children: [
      // 头像金边圈（Avatar 外套圆 Panel 作阵营描边圈）
      {
        type: 'Panel',
        id: `a-seat-${v.seat.id}-ring`,
        props: { bg: foe ? { custom: 'radial-gradient(circle,#5a1f22,#2a0f11)' } : { custom: 'radial-gradient(circle,#1e4030,#14261c)' } },
        layout: { direction: 'row', align: 'center', justify: 'center', padding: 3, radius: 40 },
        children: [{ type: 'Avatar', id: `a-seat-${v.seat.id}-face`, props: { name: v.seat.name, size: 46, shape: 'circle' } }],
      },
      // 暂大者名前缀 🏆（谁出的牌谁大·零增高不触发 audit 重叠）
      { type: 'Label', id: `a-seat-${v.seat.id}-name`, props: { text: v.seat.name, size: 'sm', bold: true, color: 'gold' } }, // 名缩小·谁大改由弹簧箭头指（owner 2026-07-18）
      {
        type: 'Panel',
        id: `a-seat-${v.seat.id}-tags`,
        props: { bare: true },
        layout: { direction: 'row', gap: 4, align: 'center', justify: 'center' },
        children: [
          { type: 'Tag', id: `a-seat-${v.seat.id}-side`, props: { label: foe ? '对手' : '队友', tone: foe ? 'normal' : 'accent', size: 'sm' } },
          ...(trait ? [{ type: 'Tag' as const, id: `a-seat-${v.seat.id}-trait`, props: { label: trait, tone: 'dim' as const, size: 'sm' as const } }] : []),
        ],
      },
      { type: 'Badge', id: `a-seat-${v.seat.id}-cards`, props: { text: `余牌 ${v.cards}`, tone: v.cards <= 3 ? 'warn' : 'ok' } },
      ...(bubble
        ? [{ type: 'Tag' as const, id: `a-seat-${v.seat.id}-bubble`, props: { label: bubble, tone: 'accent' as const, size: 'sm' as const } }]
        : []),
    ],
  };
}

// ── S4 可玩牌桌屏（手牌扇列 + 操作条 + 中央墩·SC-3 的玩法关最小可玩形）──────────────
export interface PlayView {
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
  tributeText: string | null; // 本盘进贡/还贡/抗贡一句话（首盘=null·玩家知情）
  showCounter: boolean; // 记牌器开合
  counter: { rank: string; played: number; total: number }[]; // 明面已出牌计数（showCounter 时填）
  canCommit: boolean; // 选牌构成合法且能压
  commitWhy: string; // 不可出的原因（禁用提示）
  canPass: boolean;
  // 游戏内菜单（☰·出牌日志/规则说明/设置）。
  showMenu: boolean;
  menuTab: 'log' | 'rules' | 'settings';
  logRows: LogRow[];
  tierName: string;
  seed: number; // 本局 run 种子（设置页显示·供报 bug 复现）
}

// 中央墩牌（蓝本经典白扑克面·light·红黑自动判）。
function trickCard(code: number, idx: number): LayoutNode {
  const f = cardFace(code);
  return { type: 'PlayingCard', id: `a-trick-${idx}`, props: { rank: f.rank, suit: f.suit, face: 'light', size: 'sm' } };
}

// ── 座前小牌桌（owner 2026-07-18·像真扑克·本墩此座最近一手摆座位前）──────────────────
// felt 子节点（祖孙嵌套·audit 不判桌面重叠）；出=小牌横排，过=「过」灰签，无=不显。x/y=felt 内相对坐标。
function seatTrayNode(seat: SeatId, play: { cards: number[]; pass: boolean } | undefined, x: number, y: number): LayoutNode | null {
  if (!play) return null;
  if (play.pass) {
    return {
      type: 'Panel', id: `a-tray-${seat}`, props: { bare: true },
      layout: { x, y, direction: 'row' },
      children: [{ type: 'Tag', id: `a-tray-${seat}-pass`, props: { label: '过', tone: 'dim', size: 'sm' } }],
    };
  }
  return {
    type: 'Panel', id: `a-tray-${seat}`, props: { bare: true },
    layout: { x, y, direction: 'row', gap: 2, align: 'center' },
    children: play.cards.map((c, i) => {
      const f = cardFace(c);
      return { type: 'PlayingCard', id: `a-tray-${seat}-${i}`, props: { rank: f.rank, suit: f.suit, face: 'light', size: 'sm' } } as LayoutNode;
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
const HAND_CARD_W = 64;
const HAND_L = 150; // 左端（避主角立绘框·框右缘 100）
const HAND_AVAIL = 900; // 手牌横向可用宽（大弧舒展占底部满宽·右端翘牌在操作区上方错开）
function buildHandFanNodes(hand: number[], selected: number[]): LayoutNode[] {
  const n = hand.length;
  if (n === 0) return [];
  const mid = (n - 1) / 2;
  const step = Math.min(HAND_CARD_W + 2, Math.round(HAND_AVAIL / Math.max(1, n - 1)));
  const totalW = step * (n - 1);
  const startX = HAND_L + Math.round((HAND_AVAIL - totalW) / 2);
  const baseY = FIELD_H - 104; // 中间牌顶 y（两端向上翘）
  // 弧度随手牌张数收（owner 2026-07-18）：满手(≥22 张)=大弧；出牌后牌变少→弧度按张数微微收，不永远这么高地翘。
  const arcScale = Math.min(1, n / 22);
  const maxLift = 62 * arcScale; // 两端上翘幅度（U 弧深·张数越少越平）
  const maxRot = 24 * arcScale; // 端牌旋转角（张数越少越正）
  return hand.map((c, i) => {
    const f = cardFace(c);
    const sel = selected.includes(i);
    const t = mid === 0 ? 0 : (i - mid) / mid; // 归一化 -1..1
    const lift = Math.round(t * t * maxLift); // U 弧：|t| 大 → 上翘多（y 小）
    const rot = Math.round(t * maxRot * 10) / 10; // 左端逆时针 / 右端顺时针
    return {
      type: 'PlayingCard',
      id: `a-hand-${i}`,
      // actionArg=手牌**下标**（非牌码·两副牌同码会联动误选）
      props: { rank: f.rank, suit: f.suit, face: 'light', size: 'md', selected: sel, action: 'hand.toggle', actionArg: String(i) },
      layout: { x: startX + i * step, y: baseY - lift - (sel ? 22 : 0), rotate: rot },
    };
  });
}

export function buildPlay(v: PlayView): LayoutNode {
  const heroTurn = v.turn === 'hero';
  const anchorOf = (id: 'partner' | 'west' | 'east'): { x: number; y: number } =>
    seatTopLeft(SEAT_ANCHORS.find((s) => s.id === id)!);
  const pA = anchorOf('partner');
  const wA = anchorOf('west');
  const eA = anchorOf('east');

  // 中央出牌区（桌心·牌型标签 + 暂大者 + 四家最近一手 + 行动提示）——felt 子节点（祖孙嵌套·audit 不判桌面重叠）。
  // 「谁出的牌谁大」明示（owner 2026-07-18）：当前墩持有者=暂时最大，其余家要么压过、要么过。
  const holderLabel = v.trick ? (v.trick.holder === 'hero' ? '你' : v.trick.holderName) : '';
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
              ? [{ type: 'Tag' as const, id: 'a-p-trickwild', props: { label: `含${v.trick.wilds}🃏逢人配`, tone: 'warn' as const, size: 'sm' as const } }]
              : []),
            // 暂大牌主：本方(队友/你)=绿(ok·安全)·对手=黄(warn·需压)——一眼看清谁大。
            { type: 'Badge', id: 'a-p-holder', props: { text: `🏆 ${holderLabel} 暂大`, tone: v.trick.holderTeam === 0 ? 'ok' : 'warn' } },
          ],
        },
        // 各家出的牌摆在各自座前小牌桌（不在中央重复）；中央只留牌型 + 暂大 + 行动提示。
        {
          type: 'Label',
          id: 'a-p-turn',
          props: {
            text: heroTurn ? '待你应对 · 压过下方最大牌或过' : v.turn === v.trick.holder ? `${v.turnName} 收墩领出中…` : `${v.turnName} 应对中…`,
            size: 'sm',
            color: heroTurn ? 'gold' : 'sub',
          },
        },
      ]
    : [{ type: 'Label', id: 'a-p-lead', props: { text: heroTurn ? '轮到你领出' : `${v.turnName} 领出中…`, font: 'serif', size: 'lg', bold: true, color: heroTurn ? 'gold' : 'sub' } }];
  const centerZone: LayoutNode = {
    type: 'Panel',
    id: 'a-p-center',
    props: { bare: true },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 8, width: 380 },
    children: centerChildren,
  };
  // 进贡/还贡横幅（本盘有则显·felt 子节点=祖孙嵌套·玩家知情盘首进贡）。
  const feltChildren: LayoutNode[] = [];
  if (v.tributeText) {
    feltChildren.push({
      type: 'Panel',
      id: 'a-p-tribute',
      props: { bg: { custom: 'linear-gradient(180deg,rgba(200,53,43,0.28),rgba(30,20,14,0.9))' } },
      layout: { direction: 'row', align: 'center', justify: 'center', gap: 6, padding: 7, radius: 16, margin: 6 },
      children: [{ type: 'Label', id: 'a-p-tribute-l', props: { text: `🎴 ${v.tributeText}`, size: 'sm', color: 'gold', bold: true } }],
    });
  }
  feltChildren.push(centerZone);
  // 座前小牌桌（本墩各座最近一手·felt 子节点·祖孙嵌套 audit 不判桌面重叠）。
  for (const seat of TURN_ORDER) {
    const tray = seatTrayNode(seat, v.plays[seat], TRAY_POS[seat].x, TRAY_POS[seat].y);
    if (tray) feltChildren.push(tray);
  }
  // 弹簧箭头指「谁大」（Float 锚定暂大者座前小牌桌·上下弹跳+呼吸光·近似弹簧·owner 2026-07-18）。
  // felt 子节点（Float 位置 JS 活取·静态 audit 摆不准=祖孙嵌套豁免同扇形/中央墩）；真 scale 弹簧基座缺→用
  // float 弹跳 + glow 近似·已报 PUI A-011。
  if (v.trick) {
    feltChildren.push({
      type: 'Float',
      id: 'a-p-bigarrow',
      props: { anchorTo: { kind: 'node', id: `a-tray-${v.trick.holder}`, at: 'top', offset: { y: -6 } } },
      children: [
        {
          type: 'Panel',
          id: 'a-p-bigarrow-w',
          props: { bare: true },
          layout: { direction: 'column', align: 'center', gap: 0, anim: 'float' },
          children: [
            { type: 'Label', id: 'a-p-bigarrow-t', props: { text: '最大', size: 'xs', bold: true, color: 'gold', glow: true } },
            { type: 'Label', id: 'a-p-bigarrow-a', props: { text: '▼', size: 22, bold: true, color: 'gold', glow: true } },
          ],
        },
      ],
    });
  }
  // 椭圆红呢牌桌（radius 大=胶囊椭圆·felt 红呢 + 暗角 + 金边）·进贡横幅 + 出牌区 flex 居中于桌心（felt 子节点）。
  const feltTable: LayoutNode = {
    type: 'Panel',
    id: 'a-felt',
    props: { bg: { custom: FELT_RED }, vignette: true, accent: true },
    layout: { x: 232, y: 148, width: FIELD_W - 464, height: 322, radius: 160, direction: 'column', align: 'center', justify: 'center', gap: 8 },
    children: feltChildren,
  };

  // 级牌信息条（牌桌下方 pill 一行）。
  const infoBar: LayoutNode = {
    type: 'Panel',
    id: 'a-p-info',
    props: { bg: { custom: 'linear-gradient(180deg,rgba(30,20,14,0.94),rgba(20,14,10,0.9))' } },
    layout: { x: FIELD_W / 2 - 210, y: 512, width: 420, direction: 'row', gap: 12, align: 'center', justify: 'center', padding: 8, radius: 20 },
    children: [
      { type: 'Tag', id: 'a-p-level', props: { label: `级牌 ${v.levelPlay}`, tone: 'accent', size: 'sm' } },
      { type: 'Label', id: 'a-p-lv', props: { text: `我方 ${v.levelOurs} · 对方 ${v.levelTheirs}`, size: 'sm', color: 'sub' } },
      { type: 'Badge', id: 'a-p-stake', props: { text: `底注 ${v.stake}`, tone: 'ok' } },
      { type: 'Label', id: 'a-p-round', props: { text: `第 ${v.round} 盘`, size: 'sm', color: 'sub' } },
    ],
  };

  // 主角立绘框（左下·A-CHAR-HERO 占位·S6 真立绘）。
  const heroPortrait: LayoutNode = {
    type: 'Panel',
    id: 'a-p-portrait',
    props: { vignette: true },
    layout: { x: 12, y: 566, width: 84, height: 126, direction: 'column', align: 'center', justify: 'center', gap: 4, padding: 8 },
    children: [
      { type: 'Avatar', id: 'a-p-portrait-face', props: { name: v.seats.hero.seat.name, size: 64, shape: 'rounded' } },
      { type: 'Label', id: 'a-p-portrait-l', props: { text: '主角立绘', size: 'xs', color: 'dim' } },
      { type: 'Label', id: 'a-p-portrait-dress', props: { text: `服饰 ${v.seats.hero.dress}/${DRESS_TIERS}`, size: 'xs', color: 'sub' } },
    ],
  };

  // 操作区（右下角两行·紧凑靠底·让手牌大弧延伸其上方·参考稿版式）。
  //   行1（y636）：提示 / 过 / 出牌；行2（y684）：金钱 · 理牌 Segmented · 记牌器。
  const actionRow1: LayoutNode = {
    type: 'Panel',
    id: 'a-p-act-btns',
    props: { bare: true },
    layout: { x: FIELD_W - 314, y: 634, width: 302, direction: 'row', gap: 8, align: 'center', justify: 'end' },
    children: [
      { type: 'Button', id: 'a-p-hint', props: { label: '提示', kind: 'ghost', action: 'play.hint', disabled: !heroTurn } },
      { type: 'Button', id: 'a-p-pass', props: { label: '过', kind: 'quiet', action: 'play.pass', disabled: !heroTurn || !v.canPass } },
      { type: 'Button', id: 'a-p-commit', props: { label: '出牌', kind: 'primary', action: 'play.commit', disabled: !heroTurn || !v.canCommit } },
    ],
  };
  const actionRow2: LayoutNode = {
    type: 'Panel',
    id: 'a-p-act-tools',
    props: { bare: true },
    layout: { x: FIELD_W - 336, y: 682, width: 324, direction: 'row', gap: 8, align: 'center', justify: 'end' },
    children: [
      { type: 'Badge', id: 'a-p-wallet', props: { text: `💰 ${fmtMoney(v.wallet)}`, tone: 'ok' } },
      {
        type: 'Segmented',
        id: 'a-p-sort',
        props: { options: [{ value: 'rank', label: '按点数' }, { value: 'family', label: '按牌型' }], value: v.sortMode, action: 'hand.sort' },
      },
      { type: 'Button', id: 'a-p-counter', props: { label: v.showCounter ? '▤ 收起' : '▤ 记牌器', kind: 'quiet', action: 'tools.counter' } },
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
        text: heroTurn ? (!v.canCommit && v.selected.length > 0 ? v.commitWhy : '点牌选中 · 出牌或过') : `${v.turnName} 行动中…`,
        size: 'xs',
        color: heroTurn && !v.canCommit && v.selected.length > 0 ? 'warn' : 'dim',
      },
    }],
  };

  // 右上角：☰ 菜单（出牌日志/规则/设置）+ 返回。
  const topWrap: LayoutNode = {
    type: 'Panel',
    id: 'a-p-backwrap',
    props: { bare: true },
    layout: { x: FIELD_W - 208, y: 12, width: 196, direction: 'row', gap: 8, justify: 'end' },
    children: [
      { type: 'Button', id: 'a-p-menu', props: { label: '☰ 菜单', kind: 'quiet', action: 'menu.open' } },
      { type: 'Button', id: 'a-p-back', props: { label: '返回', kind: 'ghost', action: 'table.back' } },
    ],
  };
  const gameMenu: LayoutNode | null = v.showMenu
    ? buildGameMenu({ menuTab: v.menuTab, logRows: v.logRows, tierName: v.tierName, levelPlay: v.levelPlay, stake: v.stake, wallet: v.wallet, sortMode: v.sortMode, seed: v.seed })
    : null;

  // 记牌器（居中模态浮层·明面已出牌计数·点「▤ 记牌器」开·点遮罩/关闭收·不开天眼）。
  const counterPanel: LayoutNode | null = v.showCounter
    ? {
        type: 'Modal',
        id: 'a-p-counter-modal',
        props: { title: '记牌器 · 明面已出牌（不开天眼）', size: 'sm', closable: true, closeAction: 'tools.counter' },
        children: [
          { type: 'Label', id: 'a-p-counter-hint', props: { text: '各点数 已出 / 共 · 剩余可推断谁手里还有大牌', size: 'xs', color: 'sub' } },
          {
            type: 'Table',
            id: 'a-p-counter-table',
            props: {
              columns: [
                { key: 'rank', label: '点数', width: 72 },
                { key: 'played', label: '已出', width: 72, align: 'center' },
                { key: 'left', label: '剩余', align: 'center' },
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

  // z 序（DOM 顺序）：桌 → 中央墩 → 席位 → 信息条 → 立绘/操作 → 手牌扇（最上·可点）→ 返回。
  return {
    type: 'Screen',
    id: 'a-play',
    props: {},
    layout: { width: FIELD_W, height: FIELD_H },
    children: [
      feltTable, // 含中央出牌区（祖孙嵌套）
      seatCard(v.seats.partner, pA.x, pA.y, v.turn === 'partner', v.trick?.holder === 'partner'),
      seatCard(v.seats.west, wA.x, wA.y, v.turn === 'west', v.trick?.holder === 'west'),
      seatCard(v.seats.east, eA.x, eA.y, v.turn === 'east', v.trick?.holder === 'east'),
      infoBar,
      heroPortrait,
      ...buildHandFanNodes(v.hand, v.selected),
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
export interface LogRow { round: number; who: string; act: string; cards: string; fam: string }
export interface GameMenuView {
  menuTab: 'log' | 'rules' | 'settings';
  logRows: LogRow[];
  tierName: string;
  levelPlay: number;
  stake: number;
  wallet: number;
  sortMode: 'rank' | 'family';
  seed: number; // 本局 run 种子（设置页显示·供报 bug 复现）
}
// 牌型闭集 10 型（gdd §2.2·静态说明数据·非规则逻辑）。
const PATTERN_GUIDE: { name: string; eg: string; note: string }[] = [
  { name: '单张', eg: '♠5', note: '比点数；级牌 > A，大王最大' },
  { name: '对子', eg: '♠5 ♥5', note: '两张同点' },
  { name: '三同张', eg: '♠5 ♥5 ♦5', note: '三张同点' },
  { name: '三带二', eg: '888 + 99', note: '三张带一对，比三张那部分' },
  { name: '顺子', eg: '3-4-5-6-7', note: '五张连续单牌（A 可当 1）' },
  { name: '三连对（木板）', eg: '33 44 55', note: '三副连续的对子' },
  { name: '钢板（二连三）', eg: '888-999', note: '两副连续的三同张（点数必须相邻）' },
  { name: '炸弹', eg: '5555 起', note: '四张及以上同点；先比张数再比点' },
  { name: '同花顺', eg: '♥3-4-5-6-7', note: '同花色顺子，压 5 张炸弹' },
  { name: '四大天王', eg: '双大王+双小王', note: '最大，压一切' },
];
const RULES_LINES: { t: string; b: boolean }[] = [
  { t: '目标：四人两副牌（108 张），2v2 对家；本队两人先出光手牌即胜，爬级打过 A 通关。', b: true },
  { t: '出牌：领出任意合法牌型 → 下家出同型更大的、或用炸弹跨型压 → 压不过就「过」；一圈都过则收墩，收墩者重新领出。', b: false },
  { t: '压制序：四大天王 ＞ 大炸弹 ＞ 同花顺 ＞ 小炸弹 ＞ 普通牌型（同型比大小）。', b: false },
  { t: '级牌 / 逢人配：本盘「级牌」抬到 A 之上、小王之下；红桃级牌 = 逢人配（百搭，可当除王外任意牌）。牌桌/日志里标 🃏 的就是逢人配——所以「2🃏-6-7-8-9」是把 ♥2 当 5 的顺子、「QQQ+KK+2🃏」是 ♥2 当 K 的钢板，都合法。', b: false },
  { t: '进贡 / 还贡：次盘末游向头游进最大牌，头游还一张 ≤10；应贡方手握双大王可「抗贡」免进。', b: false },
  { t: '升级：头游队按 双上 +3 / 一三 +2 / 一四 +1 升级；输队褪一件服饰，到底线转金钱罚。', b: false },
];
export function buildGameMenu(v: GameMenuView): LayoutNode {
  const logTab: LayoutNode = {
    type: 'Panel', id: 'a-menu-log', props: { bare: true },
    layout: { direction: 'column', gap: 8, padding: 4 },
    children: [
      { type: 'Label', id: 'a-menu-log-hint', props: { text: '本局出牌流水（可框选复制贴给作者排查）· 完整日志见浏览器 F12 → Console', size: 'xs', color: 'sub' } },
      v.logRows.length === 0
        ? { type: 'Label', id: 'a-menu-log-empty', props: { text: '（本盘还没有出牌记录）', size: 'sm', color: 'dim' } }
        : {
            type: 'Table', id: 'a-menu-log-tbl',
            props: {
              columns: [
                { key: 'round', label: '盘', width: 40, align: 'center' },
                { key: 'who', label: '玩家', width: 90 },
                { key: 'act', label: '动作', width: 56, align: 'center' },
                { key: 'cards', label: '出的牌' },
                { key: 'fam', label: '牌型', width: 92 },
              ],
              rows: v.logRows.map((r, i) => ({
                id: `a-lg-${i}`,
                cells: { round: String(r.round), who: r.who, act: r.act, cards: r.cards, fam: r.fam },
                tone: (r.act === '过' ? 'dim' : 'normal') as 'dim' | 'normal',
              })),
            },
          },
    ],
  };
  const rulesTab: LayoutNode = {
    type: 'Panel', id: 'a-menu-rules', props: { bare: true },
    layout: { direction: 'column', gap: 8, padding: 4 },
    children: [
      { type: 'Label', id: 'a-menu-rules-h1', props: { text: '牌型（从小到大）', size: 'sm', bold: true, color: 'gold' } },
      {
        type: 'Table', id: 'a-menu-pat-tbl',
        props: {
          columns: [
            { key: 'name', label: '牌型', width: 116 },
            { key: 'eg', label: '例子', width: 152 },
            { key: 'note', label: '说明' },
          ],
          rows: PATTERN_GUIDE.map((p, i) => ({ id: `a-pat-${i}`, cells: { name: p.name, eg: p.eg, note: p.note } })),
        },
      },
      { type: 'Label', id: 'a-menu-rules-h2', props: { text: '基本规则', size: 'sm', bold: true, color: 'gold' } },
      ...RULES_LINES.map((r, i) => ({
        type: 'Label' as const, id: `a-menu-rule-${i}`,
        props: { text: `· ${r.t}`, size: 'xs' as const, color: 'sub' as const, bold: r.b }, // sub=可读正文（dim 4.49 差 AA·规则是要读的内容）
      })),
    ],
  };
  const settingsTab: LayoutNode = {
    type: 'Panel', id: 'a-menu-set', props: { bare: true },
    layout: { direction: 'column', gap: 8, padding: 4 },
    children: [
      { type: 'Label', id: 'a-menu-set-h', props: { text: '本局', size: 'sm', bold: true, color: 'gold' } },
      {
        type: 'Panel', id: 'a-menu-set-row', props: { bare: true },
        layout: { direction: 'row', gap: 8, align: 'center' },
        children: [
          { type: 'Tag', id: 'a-menu-set-tier', props: { label: `难度 ${v.tierName}`, tone: 'accent', size: 'sm' } },
          { type: 'Tag', id: 'a-menu-set-lvl', props: { label: `级牌 ${v.levelPlay}`, tone: 'normal', size: 'sm' } },
          { type: 'Badge', id: 'a-menu-set-stake', props: { text: `底注 ${v.stake}`, tone: 'ok' } },
          { type: 'Badge', id: 'a-menu-set-wallet', props: { text: `💰 ${fmtMoney(v.wallet)}`, tone: 'ok' } },
        ],
      },
      { type: 'Label', id: 'a-menu-set-sort', props: { text: `理牌方式：${v.sortMode === 'rank' ? '按点数' : '按牌型'}（牌桌右下角可切换）`, size: 'xs', color: 'sub' } },
      { type: 'Label', id: 'a-menu-set-seed', props: { text: `本局种子：${v.seed}（报 bug 时贴上·同种子可复现这副牌与走向）`, size: 'xs', color: 'sub' } },
      { type: 'Label', id: 'a-menu-set-more', props: { text: '音效 / 动画速度 / 记牌器等更多设置陆续加入。', size: 'xs', color: 'dim' } },
    ],
  };
  return {
    type: 'Modal',
    id: 'a-menu-modal',
    props: { title: '菜单 · 掼蛋夜宴', size: 'lg', closable: true, closeAction: 'menu.close' },
    children: [
      {
        type: 'Tabs',
        id: 'a-menu-tabs',
        props: {
          tabs: [{ id: 'log', label: '出牌日志' }, { id: 'rules', label: '规则说明' }, { id: 'settings', label: '设置' }],
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
  ranking: { seat: SeatId; name: string; team: 0 | 1 }[];
  winnersTeam: 0 | 1;
  comboLabel: string; // 双上/一三/一四
  totalMult: number;
  payPerPlayer: number;
  levelAfter: [number, number];
  dressOutDoubled: boolean;
  phase: 'settled' | 'run-won' | 'run-lost';
}
export function buildResult(v: ResultView): LayoutNode {
  const runEnd = v.phase !== 'settled';
  const title = v.phase === 'run-won' ? '过 A · 通关！' : v.phase === 'run-lost' ? '对方过 A · 游戏结束' : '本盘结算';
  const heroWon = v.winnersTeam === 0;
  const rankRows = v.ranking.map((r, i) => ({
    id: `rank-${i}`,
    cells: { no: `${i + 1}`, name: r.name, side: r.team === 0 ? '我方' : '对方' },
    tone: (r.team === v.winnersTeam ? 'accent' : 'normal') as 'accent' | 'normal',
  }));
  const dressLine: LayoutNode = v.dressOutDoubled
    ? { type: 'Label', id: 'a-r-dress', props: { text: '有姨太已至底线档 · 金钱罚 ×2', size: 'xs', color: 'warn' } }
    : { type: 'Label', id: 'a-r-dress', props: { text: '输方姨太各褪一件', size: 'xs', color: 'sub' } };
  const actionBtn: LayoutNode = runEnd
    ? { type: 'Button', id: 'a-r-home', props: { label: '回主菜单', kind: 'primary', action: 'table.back' } }
    : { type: 'Button', id: 'a-r-next', props: { label: '下一盘', kind: 'primary', action: 'round.next' } };
  return {
    type: 'Screen',
    id: 'a-result',
    props: { bg: { custom: 'linear-gradient(180deg,rgba(20,10,11,0.94),rgba(20,10,11,0.98)),#140a0b' }, center: true },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 14, padding: 24 },
    children: [
      {
        type: 'Panel',
        id: 'a-r-card',
        props: { vignette: true },
        layout: { direction: 'column', align: 'center', gap: 12, padding: 26 },
        children: [
          { type: 'Label', id: 'a-r-title', props: { text: title, font: 'elegant', size: 'xxl', bold: true, color: runEnd ? (heroWon ? 'gold' : 'danger') : 'gold' } },
          {
            type: 'Table',
            id: 'a-r-rank',
            props: {
              columns: [
                { key: 'no', label: '名次', width: 48, align: 'center' },
                { key: 'name', label: '座' },
                { key: 'side', label: '阵营', width: 64, align: 'center' },
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
              { type: 'Badge', id: 'a-r-pay', props: { text: `${heroWon ? '+' : '-'}${fmtMoney(v.payPerPlayer)}`, tone: heroWon ? 'ok' : 'warn' } },
              { type: 'Label', id: 'a-r-lv', props: { text: `级数 我 ${v.levelAfter[0]} · 敌 ${v.levelAfter[1]}`, size: 'sm', color: 'sub' } },
            ],
          },
          dressLine,
          actionBtn,
        ],
      },
    ],
  };
}
