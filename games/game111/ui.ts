// game111《小都会》—— UI = LayoutNode 纯数据（闭集控件·写世界靠 action 信号·零手写 DOM/React/CSS）。
//
// 华丽起手三步（ui-playbook §0 · 华丽起手铁律）：
//   ① house 主题 = `apolloOnyx`「玄铁」（暗金属 + 钢蓝细纹 + 熔岩橙点睛）——素材整体是深色霓虹赛博调，
//      三款 house 皮里它最近。**不自写 UITheme**（自写须有明确美术方向 + 记债 + 经审）。
//   ② 常见屏 import 起手包 `@ui/starters`：主菜单直接 `buildStarterHome`（糖果钮 + 衬线大标题
//      + 环境微光 + 主 CTA 悬停流光已接线），**不从空白搭朴素屏**。
//   ③ 逛橱窗挑成熟件（本屏用到的，全部对 `catalog.ts` 实查过）：
//      · `Avatar.ring`  头像 + 环形好感度描边（一件顶「头像 + 独立进度环」两件）
//      · `Connector`    关系线（catalog 原话「两目标间连线（VS 连线/攻击指向/**关系线**）」）
//      · `VirtualList`  小星书信息流（千行级只渲可视窗）
//      · `ProgressBar`  四项需求条（tone 按档变色）
//      · `Particles`    称号解锁庆祝
//      · `Label.font`   `cnround` 中文卡通粗圆黑标题 + `mono` 回合号
//      · `Button.kind:'hero'` + `fx:[{kind:'sheen-hover'}]` 主 CTA
//      · `Tag` / `Badge` 分区与称号药丸
//
// 红线：handler 不塞自由逻辑——按钮只发 `action` 信号，由宿主转成输入动作进 sim。
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { buildStarterHome } from '@zerocraft/engine/ui/starters/index.js';
import { ZONE_NAME } from './blueprint.js';
import { NPCS, NEEDS, TITLES, AGENT_NPC_IDS } from './world-data.js';

// ── 投影数据（宿主从世界读出来喂给本文件·UI 侧零世界访问）──────────────────
export interface NpcView {
  readonly id: string;
  readonly name: string;
  readonly zone: string;
  /** 四项需求当前值（key → 值）。 */
  readonly needs: Readonly<Record<string, number>>;
  /** 对玩家的好感度 0-100。 */
  readonly affinity: number;
  /** 本回合做了什么（已翻成人话）。 */
  readonly lastAction?: string;
  /** 这一条是超期降级补的吗。 */
  readonly fallback?: boolean;
}

export interface FeedItem {
  readonly id: string;
  readonly who: string;
  readonly text: string;
  readonly turn: number;
  readonly strength: number;
  /** 记忆来源：intent / fallback / share:<fromId>——链式影响的可观测落点。 */
  readonly source: string;
}

export interface TownView {
  readonly turn: number;
  readonly npcs: readonly NpcView[];
  readonly feed: readonly FeedItem[];
  /** 已解锁的称号 id。 */
  readonly titles: readonly string[];
  /** 本回合刚解锁的称号 id（有则撒粒子庆祝）。 */
  readonly justUnlocked?: string;
  readonly busy?: boolean;
}

// ── 文案模板（纯数据·不是逻辑）────────────────────────────────────────────
/** 动词 → 人话模板。`{o}` = 宾语（分区名或 NPC 名）。 */
export const ACTION_TEXT: Readonly<Record<string, string>> = {
  move_to: '动身去{o}',
  talk_to: '找{o}搭话',
  rest: '歇一会儿',
  observe: '四处看看',
};

/** 记忆 → 小星书帖子文案模板（素材：「NPC 用与玩家真实互动形成的记忆发帖」）。 */
export const FEED_TEXT: Readonly<Record<string, string>> = {
  move: '今天去了{o}，路上没什么人。',
  talk: '和{o}说了会儿话。',
  player: '你说的那句话，我记下来了。',
  gossip: '听说了一件关于{o}的事。',
};

const NAME_OF: Readonly<Record<string, string>> =
  Object.fromEntries(NPCS.map((n) => [n.id, n.name]));

/** id → 人话（分区名优先，其次 NPC 名，都不是就原样）。查表不是逻辑。 */
export function labelOf(id: string | undefined): string {
  if (id === undefined || id === '') return '';
  return ZONE_NAME[id] ?? NAME_OF[id] ?? id;
}

/** 需求值 → 条的着色档（>60 绿 / >30 橙 / 否则红）。纯阈值查表。 */
function needTone(v: number): 'ok' | 'warn' | 'danger' {
  return v > 60 ? 'ok' : v > 30 ? 'warn' : 'danger';
}

/** 面板小标题（用 Label 不用 Panel.title——后者字色不可指定·实测硬失败，见 buildTownBoard 注）。 */
function panelHeading(id: string, text: string): LayoutNode {
  return { type: 'Label', id, props: { text, size: 'md', bold: true, font: 'cnround', color: 'gold' } };
}

// ── ① 主菜单（起手包·不从空白搭）──────────────────────────────────────────
export function buildHome(o: { canExit?: boolean } = {}): LayoutNode {
  return buildStarterHome({
    title: '小都会',
    subtitle: '没有剧本的一座小镇 · NPC 自己决定今天做什么',
    actions: [
      { label: '进入小镇', action: 'town.enter', kind: 'hero', sub: '从第 1 回合开始' },
      { label: '关于这个世界', action: 'town.about', kind: 'ghost' },
      // 壳层传了 exit 钩子才出这一项（owner 2026-06-21：游戏可把退出收进自己的菜单）。
      ...(o.canExit === true ? [{ label: '回游戏库', action: 'town.exit', kind: 'quiet' as const }] : []),
    ],
  });
}

// ── ② NPC 卡（头像环 = 好感度·四条需求·当前所在地）────────────────────────
function npcCard(n: NpcView): LayoutNode {
  return {
    type: 'Panel', id: `npc-${n.id}`, props: { bg: 'raised' },
    // press3d：按下沉入 Z + 底唇收缩（走 :active·触屏也触发）——卡有实体感。
    layout: { direction: 'column', gap: 8, padding: 12, width: 210, press3d: true },
    children: [
      {
        type: 'Panel', id: `npc-${n.id}-head`, props: { bare: true },
        layout: { direction: 'row', gap: 10, align: 'center' },
        children: [
          // Avatar.ring 一件顶两件：头像 + 好感度环（conic 弧绕到 value/max）。
          { type: 'Avatar', id: `npc-${n.id}-av`, props: { name: n.name, size: 44, shape: 'circle', ring: { value: n.affinity, max: 100, tone: 'gold' } } },
          {
            type: 'Panel', id: `npc-${n.id}-id`, props: { bare: true },
            layout: { direction: 'column', gap: 3 },
            children: [
              { type: 'Label', id: `npc-${n.id}-name`, props: { text: n.name, size: 'lg', bold: true, font: 'cnround', color: 'text' } },
              { type: 'Tag', id: `npc-${n.id}-zone`, props: { label: labelOf(n.zone), tone: 'accent' } },
            ],
          },
        ],
      },
      ...(n.lastAction !== undefined ? [{
        type: 'Label', id: `npc-${n.id}-act`,
        // 降级用 warn 不用 dim：dim(#56657a) 落在 raised 面上实测 ratio=2.46（硬失败·真读不清）。
        // 语义上「降级」本就是个警告态，warn 既合规又更对。
        props: { text: n.fallback === true ? `${n.lastAction}（降级）` : n.lastAction, size: 'sm', color: n.fallback === true ? 'warn' : 'gold' },
      } as LayoutNode] : []),
      {
        type: 'Panel', id: `npc-${n.id}-needs`, props: { bare: true },
        layout: { direction: 'column', gap: 4 },
        children: NEEDS.map((need): LayoutNode => ({
          type: 'ProgressBar', id: `npc-${n.id}-need-${need.key}`,
          props: {
            value: n.needs[need.key] ?? 0, max: need.max,
            tone: needTone(n.needs[need.key] ?? 0), label: need.name, showValue: true,
          },
        })),
      },
    ],
  };
}

// ── ③ 关系网（Avatar 节点 + Connector 关系线·同区实线、有好感金线）──────────
export function buildRelationGraph(v: TownView): LayoutNode[] {
  const nodes: LayoutNode[] = v.npcs.map((n): LayoutNode => ({
    type: 'Avatar', id: `rel-${n.id}`,
    props: { name: n.name, size: 52, shape: 'circle', ring: { value: n.affinity, max: 100, tone: 'gold' } },
  }));

  // 连线：两两之间，同区 = 实线（此刻在一起），有好感 = 金色虚线（认识但不在一起）。
  // 只连 i<j，避免同一对画两遍（画两遍在视觉上是加深，属 ui-playbook「重叠」类坏 UI）。
  const links: LayoutNode[] = [];
  for (let i = 0; i < v.npcs.length; i++) {
    for (let j = i + 1; j < v.npcs.length; j++) {
      const a = v.npcs[i]; const b = v.npcs[j];
      const together = a.zone === b.zone;
      if (!together) continue;
      links.push({
        type: 'Connector', id: `link-${a.id}-${b.id}`,
        props: {
          from: { kind: 'node', id: `rel-${a.id}`, at: 'right' },
          to: { kind: 'node', id: `rel-${b.id}`, at: 'left' },
          // **不给 label**：Connector 的线中点标是 SVG `<text>`，`tone` 换成 gold 后 ui-audit 仍判
          // ratio=1.05（审计的 solidBgUp 量不到 SVG 的实底，而渲染侧其实靠 paint-order 描边保可读）。
          // 与其跟审计对赌，不如认清这条信息本来就**重复**——每张 NPC 卡上的分区 Tag 已经说了谁在哪。
          // 去掉它零信息损失、审计归零。控件本身的这个坑已记给 PUI（game111/requests.md）。
          style: 'solid', tone: 'gold',
        },
      });
    }
  }
  return [
    {
      type: 'Panel', id: 'rel-field', props: { bg: 'sunken', vignette: true },
      layout: { direction: 'row', gap: 56, padding: 22, justify: 'center', align: 'center', height: 120 },
      children: nodes,
    },
    ...links,
  ];
}

// ── ④ 小星书（VirtualList·NPC 拿记忆发的帖）──────────────────────────────
export function buildFeed(v: TownView): LayoutNode {
  return {
    type: 'VirtualList', id: 'starbook',
    props: {
      rowHeight: 44,
      height: 260,
      columns: [
        { key: 'who', label: '谁', width: 70 },
        { key: 'text', label: '小星书' },
        { key: 'turn', label: '回合', width: 56 },
      ],
      rows: v.feed.map((f) => ({ id: f.id, cells: { who: f.who, text: f.text, turn: `第${f.turn}回合` } })),
      action: 'feed.open',
    },
  };
}

// ── ⑤ 小镇看板（主屏）──────────────────────────────────────────────────
export function buildTownBoard(v: TownView): LayoutNode {
  const unlocked = TITLES.filter((t) => v.titles.includes(t.id));
  return {
    type: 'Screen', id: 'town-board', props: { fill: true },
    layout: { direction: 'column', gap: 14, padding: 20 },
    children: [
      // 顶栏：回合号 + 称号药丸 + 推进按钮
      {
        type: 'Panel', id: 'topbar', props: { bare: true },
        layout: { direction: 'row', gap: 14, align: 'center', justify: 'between' },
        children: [
          {
            type: 'Panel', id: 'topbar-left', props: { bare: true },
            layout: { direction: 'row', gap: 12, align: 'center' },
            children: [
              { type: 'Label', id: 'town-title', props: { text: '小都会', size: 'xxl', bold: true, font: 'cnround', color: 'gold' } },
              // tween：回合号滚动到位（数字类成熟件·juice）。
              { type: 'Label', id: 'town-turn', props: { text: `第 ${v.turn} 回合`, size: 'md', font: 'mono', color: 'text', tween: { from: Math.max(0, v.turn - 1), to: v.turn, ms: 400 } } },
            ],
          },
          {
            type: 'Button', id: 'btn-next-turn',
            props: {
              label: v.busy === true ? '小镇在想…' : '推进一回合',
              kind: 'hero', action: 'town.next', disabled: v.busy === true, shape: 'cut',
              sub: v.busy === true ? '等 NPC 决策回包' : undefined,
            },
            layout: { fx: [{ kind: 'sheen-hover' as const }] },
          },
        ],
      },

      // 称号条（NPC 给的·不是系统发的）
      ...(unlocked.length > 0 ? [{
        type: 'Panel', id: 'titles', props: { bare: true },
        layout: { direction: 'row', gap: 8, align: 'center' },
        children: [
          { type: 'Label', id: 'titles-cap', props: { text: '他们这样叫你', size: 'sm', color: 'sub' } },
          ...unlocked.map((t): LayoutNode => ({
            type: 'Badge', id: `title-${t.id}`,
            // 稀有度 → 着色档（Badge tone 闭集：ok/warn/dim/accent/gold/danger·**没有 normal**）。
            // 首版写了 'normal'，schema 不认所以退到默认灰，实测 ratio=3.38（AA 未达）。
            props: { text: `${t.text} · ${NAME_OF[t.byNpc] ?? t.byNpc}给的`, tone: t.rarity === 'epic' ? 'gold' : t.rarity === 'rare' ? 'accent' : 'ok' },
          })),
        ],
      } as LayoutNode] : []),

      // 称号刚解锁 → 撒粒子庆祝（render-only·不挡点击）
      ...(v.justUnlocked !== undefined
        ? [{ type: 'Particles', id: 'title-fx', props: { kind: 'confetti', count: 40 } } as LayoutNode]
        : []),

      // NPC 卡列
      {
        // 卡列用 grid + minCol：窄屏自动换行，不靠 flex-wrap（LayoutConstraints 闭集里没有 wrap，
        // 自适应网格的官方写法就是 grid/minCol——首版写 wrap:true 被 schema 当场拒）。
        type: 'Panel', id: 'npc-row', props: { bare: true },
        layout: { direction: 'grid', minCol: 210, gap: 12 },
        children: v.npcs.map(npcCard),
      },

      // 关系网 + 小星书 并排
      {
        type: 'Panel', id: 'lower', props: { bare: true },
        layout: { direction: 'row', gap: 14, align: 'start' },
        children: [
          // 小标题走显式 Label 而非 Panel.title：主题的阔字距小标题色实测 ratio=2.93（硬失败），
          // 而 Panel.title 的字色不可由数据指定 → 只能改用能指定 color 令牌的 Label。
          // glass：磨砂玻璃底（backdrop-filter·成熟件）。
          {
            type: 'Panel', id: 'rel-panel', props: { glass: true },
            layout: { direction: 'column', gap: 8, padding: 12, width: 420 },
            children: [panelHeading('rel-head', '此刻谁和谁在一起'), ...buildRelationGraph(v)],
          },
          {
            type: 'Panel', id: 'feed-panel', props: { glass: true },
            layout: { direction: 'column', gap: 8, padding: 12, width: 420 },
            children: [panelHeading('feed-head', '小星书'), buildFeed(v)],
          },
        ],
      },
    ],
  };
}

/** 本屏发出的全部 action 信号（宿主接线的单一真相·测试对账用）。 */
export const UI_ACTIONS = ['town.enter', 'town.about', 'town.next', 'town.exit', 'feed.open'] as const;

/** 参与看板展示的 NPC（= 调 LLM 的那几个·L1/L2 暂不上看板）。 */
export const BOARD_NPC_IDS = AGENT_NPC_IDS;
