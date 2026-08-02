// Game T ·《墨消》—— 全部 UI = 纯 LayoutNode 数据（UI 铁律·apollo-toon「水墨玩趣」主题皮）。
// 写世界只经 action 信号；本 HUD 的 action（play/retry/next/back/toggle_mute）全是宿主生命周期动作，
// 由宿主 HandlerMap 消化——不碰 sim（棋盘输入走画布 clickable，不经 UI）。
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import type { ChapterSpec } from './levels.js';

export interface HudGoalView {
  label: string;
  cur: number;
  need: number;
}
export interface HudState {
  levelNo: number;
  levelName: string;
  moves: number;
  score: number;
  goals: HudGoalView[];
  status: 'playing' | 'settling' | 'win' | 'lose';
  stars: number; // 结算星（win 时 1..3）
  brush: number; // 收笔分（剩步×1000）
  finalScore: number;
  selIndex: number; // 当前选中格（-1=无·选中高亮=三期④ 前以文案提示）
  cols: number;
  muted: boolean;
  hasNext: boolean;
}
export interface SelectState {
  nodes: Array<{ no: number; name: string; stars: number; state: 'done' | 'current' | 'locked' }>;
  muted: boolean;
}

// ── 选关长卷（LevelPath=水墨长卷·蛇形路径·GDD §五）─────────────────────────────
export function buildSelect(s: SelectState): LayoutNode {
  return {
    type: 'Screen',
    id: 't-select',
    props: { center: true },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 18, padding: 20 },
    children: [
      {
        // 标题卡：文字坐实底纸面（Screen 的远山渐变非实底·直坐会吃深兜底假对比）
        type: 'Panel',
        id: 't-title-card',
        props: {},
        layout: { direction: 'column', align: 'center', gap: 6, padding: 14 },
        children: [
          { type: 'Label', id: 't-title', props: { text: '墨 消', font: 'hand', size: 'xxxl', bold: true, color: 'gold' } },
          { type: 'Label', id: 't-sub', props: { text: '功夫修行 · 水墨三消（拖拽滑动或点选两珠交换）', size: 'sm', color: 'text' } },
        ],
      },
      {
        type: 'Panel',
        id: 't-path-wrap',
        props: { bare: true },
        layout: { direction: 'column', padding: 14 }, // 内边距：防蛇形首尾节点贴屏缘裁切
        children: [
          {
            type: 'LevelPath',
            id: 't-path',
            props: {
              nodes: s.nodes.map((n) => ({
                label: String(n.no),
                state: n.state,
                stars: n.stars,
                action: 'play',
                actionArg: String(n.no),
              })),
              cols: 5, // 30 关 · 五章×6 → 六排蛇形
              tone: 'gold',
            },
          },
        ],
      },
      {
        type: 'Panel',
        id: 't-foot-card',
        props: {},
        layout: { direction: 'row', align: 'center', gap: 12, padding: 10 },
        children: [
          { type: 'Label', id: 't-foot', props: { text: '五形师父五章 · 三十关（balance-sim 定标 · 平铺计分口径）', size: 'sm', color: 'text' } },
          { type: 'Button', id: 't-mute', props: { label: s.muted ? '🔇 静音中' : '🔊 音效', kind: 'ghost', action: 'toggle_mute' } },
        ],
      },
    ],
  };
}

// ── 顶栏：关号/目标进度/步数（竖屏三分区之顶）────────────────────────────────────
export function buildTopBar(s: HudState): LayoutNode {
  // 亮皮（apollo-toon）上 sub/dim 过不了对比硬地板（ui-audit 实测 2.77）→ 未达目标用默认正文令牌
  const goal = (g: HudGoalView, i: number): LayoutNode => ({
    type: 'Label',
    id: `t-goal-${i}`,
    props: {
      text: `${g.label} ${Math.min(g.cur, g.need)}/${g.need}`,
      size: 'sm',
      bold: g.cur >= g.need,
      color: g.cur >= g.need ? 'ok' : 'text', // 缺省色=白（暗主题设计）·亮皮必须显式 text 令牌

    },
  });
  // 实底纸面（非 glass）：文字坐不透明实底（ui-playbook §3·亮皮 glass 会让对比按深兜底算）
  return {
    type: 'Panel',
    id: 't-topbar',
    props: {},
    layout: { direction: 'row', align: 'center', justify: 'between', padding: 10, gap: 10 },
    children: [
      {
        type: 'Panel',
        id: 't-top-left',
        props: { bare: true },
        layout: { direction: 'column', gap: 4 },
        children: [
          { type: 'Label', id: 't-lv', props: { text: `第${s.levelNo}关 · ${s.levelName}`, size: 'md', bold: true, color: 'gold' } },
          {
            type: 'Panel',
            id: 't-goals',
            props: { bare: true },
            layout: { direction: 'row', gap: 10 },
            children: s.goals.map(goal),
          },
        ],
      },
      {
        type: 'Panel',
        id: 't-top-right',
        props: { bare: true },
        layout: { direction: 'column', align: 'center', gap: 2 },
        children: [
          { type: 'Label', id: 't-moves-cap', props: { text: '步数', size: 'sm', color: 'text' } },
          {
            type: 'Label',
            id: 't-moves',
            props: { text: String(Math.max(0, s.moves)), size: 'xxl', bold: true, color: s.moves <= 5 ? 'danger' : 'gold' },
          },
        ],
      },
    ],
  };
}

// ── 底栏：道具条（占位·S2 计划门定接线）+ 操作提示 ──────────────────────────────
export function buildBottomBar(s: HudState): LayoutNode {
  const hint =
    s.status === 'settling'
      ? '收势结算中…'
      : s.selIndex >= 0
        ? `已选 ${Math.floor(s.selIndex / s.cols) + 1}行${(s.selIndex % s.cols) + 1}列 · 点/滑向相邻珠交换`
        : '按住墨珠滑向邻格交换（点选两珠亦可）';
  return {
    type: 'Panel',
    id: 't-bottombar',
    props: {},
    layout: { direction: 'row', align: 'center', justify: 'between', padding: 10, gap: 8 },
    children: [
      {
        type: 'Panel',
        id: 't-items',
        props: { bare: true },
        layout: { direction: 'row', gap: 8 },
        children: [
          // 道具接线走 GDD §四 三星奖励经济，S2 计划门裁后开：先占位禁用（不塞假逻辑）。
          { type: 'Button', id: 't-item-paper', props: { label: '🪨 镇纸', kind: 'ghost', disabled: true, action: 'item_paperweight' } },
          { type: 'Button', id: 't-item-wash', props: { label: '🫗 洗砚', kind: 'ghost', disabled: true, action: 'item_washstone' } },
        ],
      },
      // jade/sub 在亮皮玻璃面硬性低对比（实测 2.65）→ 选中态用 ok+加粗区分
      {
        type: 'Label',
        id: 't-hint',
        props: { text: hint, size: 'sm', bold: s.selIndex >= 0, color: s.selIndex >= 0 ? 'ok' : 'text' },
      },
      {
        type: 'Panel',
        id: 't-sys',
        props: { bare: true },
        layout: { direction: 'row', gap: 8 },
        children: [
          { type: 'Button', id: 't-mute2', props: { label: s.muted ? '🔇' : '🔊', kind: 'ghost', action: 'toggle_mute' } },
          { type: 'Button', id: 't-back', props: { label: '🖼 长卷', kind: 'ghost', action: 'back' } },
        ],
      },
    ],
  };
}

// ── 章节过场（GDD §二点五 轻叙事·章首关未过时挂·师父立绘=S6 台账件到位后补图位）────
export function buildChapterIntro(ch: ChapterSpec): LayoutNode {
  return {
    type: 'Screen',
    id: 't-chapter',
    props: { center: true, bg: { custom: 'linear-gradient(rgba(24,20,14,0.55),rgba(24,20,14,0.72))' } },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 14, padding: 24 },
    children: [
      {
        type: 'Panel',
        id: 't-chapter-card',
        props: {},
        layout: { direction: 'column', align: 'center', gap: 12, padding: 22 },
        children: [
          { type: 'Label', id: 't-ch-name', props: { text: `第${ch.name}章`, size: 'sm', color: 'sub' } },
          { type: 'Label', id: 't-ch-master', props: { text: ch.master, font: 'hand', size: 'xxl', bold: true, color: 'gold' } },
          { type: 'Label', id: 't-ch-intro', props: { text: ch.intro, size: 'md', color: 'text' } },
          { type: 'Button', id: 't-ch-go', props: { label: '领训 · 开始修行', kind: 'hero', action: 'chapter_go' } },
        ],
      },
    ],
  };
}

// ── 结算浮层（win：星级+收笔明细+confetti；lose：重试）·仅终局挂载 ────────────────
// 透明关纪律：半透 scrim 只当幕布不载字——文字全坐**不透明纸面 Panel 卡**（对比按实底算·ui-playbook §3）。
export function buildResultOverlay(s: HudState): LayoutNode {
  const win = s.status === 'win';
  const children: LayoutNode[] = [
    {
      type: 'Label',
      id: 't-over-title',
      props: { text: win ? '妙手！' : '力竭', font: 'hand', size: 'xxxl', bold: true, color: win ? 'gold' : 'danger' },
    },
  ];
  if (win) {
    children.push(
      { type: 'Rating', id: 't-stars', props: { value: s.stars, max: 3 } },
      { type: 'Label', id: 't-score-a', props: { text: `消除 ${s.score}`, size: 'md', color: 'text' } },
      { type: 'Label', id: 't-score-b', props: { text: `收笔 +${s.brush}`, size: 'md', color: 'text' } },
      { type: 'Label', id: 't-score-t', props: { text: `合计 ${s.finalScore}`, size: 'xl', bold: true, color: 'gold' } },
    );
  } else {
    children.push({ type: 'Label', id: 't-over-sub', props: { text: '步数用尽 · 目标未成', size: 'md', color: 'text' } });
  }
  children.push({
    type: 'Panel',
    id: 't-over-btns',
    props: { bare: true },
    layout: { direction: 'row', gap: 12 },
    children: [
      { type: 'Button', id: 't-retry', props: { label: win ? '再习一局' : '再试一次', kind: win ? 'ghost' : 'hero', action: 'retry' } },
      ...(win && s.hasNext
        ? [{ type: 'Button' as const, id: 't-next', props: { label: '下一式 →', kind: 'hero' as const, action: 'next' } }]
        : []),
      { type: 'Button', id: 't-back2', props: { label: '返回长卷', kind: 'ghost', action: 'back' } },
    ],
  });
  const card: LayoutNode = {
    type: 'Panel',
    id: 't-over-card',
    props: {},
    layout: { direction: 'column', align: 'center', gap: 14, padding: 24 },
    children,
  };
  return {
    type: 'Screen',
    id: 't-overlay',
    props: { center: true, bg: { custom: 'linear-gradient(rgba(24,20,14,0.55),rgba(24,20,14,0.72))' } },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 14, padding: 24 },
    children: win
      ? [{ type: 'Particles', id: 't-confetti', props: { kind: 'confetti', count: 32, loop: false } }, card]
      : [card],
  };
}
