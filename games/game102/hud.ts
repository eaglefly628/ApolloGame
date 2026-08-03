// game102《色流工坊 / Pixel Pour》—— 四屏 UI = 纯 LayoutNode 数据（UI 铁律·pixelPour 像素糖果皮）。
// 交付基准 = docs/design/game102/ui-layout-spec.html（GD 布局稿·零新控件）+ game102-screens.dc.html（PUI 视觉稿·1:1）。
//
// 写世界只经 action 信号；本文件全 action（pause/resume/retry/next/back/play/revive_ad/revive_pay/give_up）
// 皆宿主生命周期动作，由宿主 HandlerMap 消化——不碰 sim（play-field 的落子/取炮走 render+clickable，不经 UI·PE 域）。
// 边界：play-field（像素画棋盘 / 传送带 / 色炮 / 弹道 / 待命槽 / 补给实体）= PE 的 render 层·非本文件范围；
//       本文件只出「浮在 render 层之上的 UI chrome」：对局 HUD 顶栏 / 连击突破飘层 / 结算 / 选关 / 失败续命。
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { KEYS_TOTAL, DOOR_GOAL } from './ui-theme.js';

// 千分位（确定性·不依赖 locale·匹配视觉稿「12,340」）。
function commas(n: number): string {
  return Math.trunc(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ── 状态视图（UI 侧只读快照·由宿主从 sim 投影·本文件不持逻辑）────────────────────────
export interface HudState {
  levelNo: number;
  keys: number; // 已集金钥匙（0..keysTotal）
  keysTotal: number;
  score: number;
  doorPct: number; // 宝箱门进度 0..100
  paused: boolean;
}
export interface BurstState {
  combo: number; // 当前连击（>1 显 COMBO×N 飘分）
  burst: boolean; // 突破态（容量 5→10·光爆更盛）
}
export interface ResultState {
  levelNo: number;
  stars: number; // 结算星 1..3（胜利保底 1）
  keys: number;
  keysTotal: number;
  score: number;
  hasNext: boolean;
}
export interface SelectState {
  coins: number;
  nodes: Array<{ no: number; stars: number; state: 'done' | 'current' | 'locked' }>;
}
export interface ReviveState {
  hint: string; // 差多少·如「还差 1 块就点亮宝箱门」
  price: string; // 续命价·如「$6.99」
  ammo: number; // 续命补几发色炮
  revived: boolean; // 已复活 → 出 Toast，收 Modal
}

// ── ① 对局 HUD 顶栏（关号 / 金钥匙 / 得分 / 暂停 + 宝箱门计量）──────────────────────────
// 竖屏顶部一条 chrome，浮在 play-field render 层之上；play-field 本体（棋盘/传送带/色炮）= PE 渲染器。
export function buildTopBar(s: HudState): LayoutNode {
  const doorOpen = s.keys >= s.keysTotal;
  return {
    type: 'Panel',
    id: 'g102-hud',
    props: {},
    layout: { direction: 'column', gap: 8, padding: 10 },
    children: [
      {
        type: 'Panel',
        id: 'g102-hud-row',
        props: { bare: true },
        layout: { direction: 'row', align: 'center', justify: 'between', gap: 10 },
        children: [
          {
            type: 'Panel',
            id: 'g102-hud-left',
            props: { bare: true },
            layout: { direction: 'row', align: 'center', gap: 8 },
            children: [
              { type: 'Label', id: 'g102-lv-cap', props: { text: '关', size: 'sm', color: 'sub' } },
              { type: 'Label', id: 'g102-lv', props: { text: String(s.levelNo), size: 'xl', bold: true, color: 'gold' } },
              {
                type: 'Badge',
                id: 'g102-keys',
                props: { text: `🔑 ${s.keys}/${s.keysTotal}`, tone: doorOpen ? 'ok' : 'dim' },
              },
            ],
          },
          {
            type: 'Panel',
            id: 'g102-hud-right',
            props: { bare: true },
            layout: { direction: 'row', align: 'center', gap: 10 },
            children: [
              { type: 'Label', id: 'g102-score', props: { text: `◆ ${commas(s.score)}`, size: 'lg', bold: true, color: 'gold' } },
              {
                type: 'Button',
                id: 'g102-pause',
                props: s.paused
                  ? { label: '▶', kind: 'quiet', action: 'resume' }
                  : { label: '⏸', kind: 'quiet', action: 'pause' },
              },
            ],
          },
        ],
      },
      {
        type: 'ProgressBar',
        id: 'g102-door',
        props: {
          value: Math.max(0, Math.min(DOOR_GOAL, s.doorPct)),
          max: DOOR_GOAL,
          tone: 'gold',
          label: doorOpen ? '宝箱门 · 已开启' : '宝箱门',
          showValue: true,
        },
      },
    ],
  };
}

// ── 连击 / 突破飘层（Float 飘分 + Particles 星爆·render-only·浮在 play-field 上）──────────────
// COMBO×N 锚在得分位（play-field 是 canvas 无逐格 DOM 节点·node 锚只此一处可用·飘完即消 ttl 自隐）；
// 星爆铺满该层。突破态用 stars（更盛）·常连用 sparkle。宿主以 pointer-events:none 覆盖层挂载（纯表现）。
export function buildBurst(s: BurstState): LayoutNode {
  const children: LayoutNode[] = [
    {
      type: 'Particles',
      id: 'g102-burst-fx',
      props: { kind: s.burst ? 'stars' : 'sparkle', count: s.burst ? 40 : 20, loop: false },
    },
  ];
  if (s.combo > 1) {
    children.push({
      type: 'Float',
      id: 'g102-combo-float',
      props: { anchorTo: { kind: 'node', id: 'g102-score', at: 'bottom', offset: { y: 10 } }, ttlTicks: 42 },
      children: [
        {
          type: 'Label',
          id: 'g102-combo',
          props: { text: `COMBO ×${s.combo}`, font: 'display', size: 'xxl', bold: true, color: s.burst ? 'warn' : 'jade' },
        },
      ],
    });
  }
  return {
    type: 'Screen',
    id: 'g102-burst',
    props: { bg: { custom: 'transparent' } },
    layout: { direction: 'column', align: 'center', justify: 'center' },
    children,
  };
}

// ── ② 结算屏（通关·星级=Rating + 钥匙 Badge + 得分 + 庆祝 Particles）──────────────────────
// 透明关纪律：半透 scrim 只当幕布不载字——文字全坐**不透明纸面 Panel 卡**（对比按实底算·ui-playbook §3）。
// 采 Screen + 居中卡 + 屏级 confetti（同已删 game-t 结算先例·confetti 需铺满全屏·Modal 卡会裁切）；语义即"结算模态"。
export function buildResult(s: ResultState): LayoutNode {
  const doorOpen = s.keys >= s.keysTotal;
  const card: LayoutNode = {
    type: 'Panel',
    id: 'g102-result-card',
    props: {},
    layout: { direction: 'column', align: 'center', gap: 14, padding: 24 },
    children: [
      { type: 'Label', id: 'g102-res-title', props: { text: '通关！', font: 'display', size: 'xxxl', bold: true, color: 'gold' } },
      { type: 'Rating', id: 'g102-res-stars', props: { value: s.stars, max: 3 } },
      {
        type: 'Badge',
        id: 'g102-res-keys',
        props: { text: `🔑 ${s.keys}/${s.keysTotal}${doorOpen ? ' · 宝箱门开启' : ''}`, tone: doorOpen ? 'ok' : 'warn' },
      },
      { type: 'Label', id: 'g102-res-cap', props: { text: '本关得分', size: 'sm', color: 'sub' } },
      { type: 'Label', id: 'g102-res-score', props: { text: commas(s.score), size: 'xxl', bold: true, color: 'gold' } },
      {
        type: 'Panel',
        id: 'g102-res-btns',
        props: { bare: true },
        layout: { direction: 'row', align: 'center', gap: 12 },
        children: [
          { type: 'Button', id: 'g102-res-retry', props: { label: '重来', kind: 'quiet', action: 'retry' } },
          ...(s.hasNext
            ? [{ type: 'Button' as const, id: 'g102-res-next', props: { label: '下一关 →', kind: 'hero' as const, action: 'next' } }]
            : []),
        ],
      },
    ],
  };
  return {
    type: 'Screen',
    id: 'g102-result',
    props: { center: true, bg: { custom: 'linear-gradient(rgba(15,11,34,0.72),rgba(15,11,34,0.86))' } },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 14, padding: 24 },
    children: [{ type: 'Particles', id: 'g102-res-confetti', props: { kind: 'confetti', count: 34, loop: false } }, card],
  };
}

// ── ③ 选关屏（LevelPath 蛇形路径·已删 game-t 曾用同款活范例 + 金币 Badge + 返回）────────────────────
export function buildSelect(s: SelectState): LayoutNode {
  return {
    type: 'Screen',
    id: 'g102-select',
    props: {},
    layout: { direction: 'column', gap: 14, padding: 16 },
    children: [
      {
        type: 'Panel',
        id: 'g102-sel-top',
        props: {},
        layout: { direction: 'row', align: 'center', justify: 'between', gap: 10, padding: 10 },
        children: [
          { type: 'Button', id: 'g102-sel-back', props: { label: '←', kind: 'quiet', action: 'back' } },
          { type: 'Label', id: 'g102-sel-title', props: { text: '色流工坊', font: 'display', size: 'xl', bold: true, color: 'text' } },
          { type: 'Badge', id: 'g102-sel-coins', props: { text: `🪙 ${commas(s.coins)}`, tone: 'warn' } },
        ],
      },
      {
        type: 'Panel',
        id: 'g102-sel-path-wrap',
        props: { bare: true },
        layout: { direction: 'column', padding: 14 }, // 内边距：防蛇形首尾节点贴屏缘裁切
        children: [
          {
            type: 'LevelPath',
            id: 'g102-sel-path',
            props: {
              nodes: s.nodes.map((n) => ({
                label: String(n.no),
                state: n.state,
                stars: n.stars,
                action: 'play',
                actionArg: String(n.no),
              })),
              cols: 3,
              tone: 'gold',
            },
          },
        ],
      },
    ],
  };
}

// ── ④ 失败 / 续命屏（失败点变现·Modal offer + 复活/续命 Button + 提示 Toast）──────────────────
// 复活/续命是宿主生命周期动作（发信号·宿主消化计费/激励视频接线）；UI 只出选项，不塞计费逻辑。
// 复活后：收 Modal、出 Toast「已复活」。play-field 灰屏定格 = PE render 层（本文件不出）。
export function buildRevive(s: ReviveState): LayoutNode {
  if (s.revived) {
    return {
      type: 'Toast',
      id: 'g102-revived',
      props: { text: `已复活 · 补 ${s.ammo} 发色炮 ✨`, tone: 'ok' },
    };
  }
  return {
    type: 'Modal',
    id: 'g102-revive',
    props: { title: '再来一发就赢！', size: 'sm', closable: false },
    children: [
      {
        type: 'Panel',
        id: 'g102-revive-body',
        props: { bare: true },
        layout: { direction: 'column', align: 'center', gap: 10, padding: 6 },
        children: [
          { type: 'Label', id: 'g102-revive-hint', props: { text: s.hint, size: 'md', color: 'sub' } },
          { type: 'Button', id: 'g102-revive-ad', props: { label: '📺 看广告复活', kind: 'hero', action: 'revive_ad' } },
          { type: 'Button', id: 'g102-revive-pay', props: { label: `${s.price} 续命 · 补 ${s.ammo} 发`, kind: 'ghost', action: 'revive_pay' } },
          { type: 'Button', id: 'g102-revive-give', props: { label: '放弃 · 回选关', kind: 'quiet', action: 'give_up' } },
        ],
      },
    ],
  };
}

// 缺省态工厂（走查夹具 + 宿主初值·keysTotal 归一到主题常量）。
export function defaultHud(over: Partial<HudState> = {}): HudState {
  return { levelNo: 1, keys: 0, keysTotal: KEYS_TOTAL, score: 0, doorPct: 0, paused: false, ...over };
}
