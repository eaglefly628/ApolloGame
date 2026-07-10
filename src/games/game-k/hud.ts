// Game K · Zombie Slots —— HUD = 纯 LayoutNode 数据（UI 铁律）。
// 写世界只经 action 信号名（spin/betup/betdown/toggle_mute/reset/ack）→ 宿主 ActionSink 入队 → sim 消费。
import type { LayoutNode } from '@ui/components/index.js';
import { BET_MIN, BET_MAX, PAYLINES } from './theme.js';

export type OverlayKind = 'big' | 'mega' | 'zombie' | 'free' | 'broke';
export interface HudSkins { logo?: string; panel?: string; btnSpin?: string; btnPlus?: string; btnMinus?: string; btnMute?: string; btnInfo?: string; }
export interface HudState {
  balance: number;
  bet: number;
  win: number;      // 上次赢
  free: number;     // 免费旋转剩余
  spinning: boolean; // 宿主：轮子演出中（禁重复点）
  muted: boolean;
  overlay: { kind: OverlayKind; amount: number; free: number; banner?: string } | null;
  skins?: HudSkins; // 皮肤槽 URL（真图就绪才带·否则控件走主题色·fail-soft）
}

const money = (n: number): string => n.toLocaleString('en-US');
type ColorTok = 'text' | 'sub' | 'dim' | 'jade' | 'gold' | 'ok' | 'warn' | 'danger';

// ── 顶部状态条 ──────────────────────────────────────────────────────────────
export function buildTopBar(s: HudState): LayoutNode {
  const stat = (id: string, label: string, val: string, color: ColorTok): LayoutNode => ({
    type: 'Panel', id, props: { bare: true },
    layout: { direction: 'column', align: 'center', gap: 0 },
    children: [
      { type: 'Label', id: `${id}-k`, props: { text: label, size: 'xs', color: 'dim' } },
      { type: 'Label', id: `${id}-v`, props: { text: val, size: 'lg', bold: true, color, glow: true } },
    ],
  });
  const stats: LayoutNode[] = [
    stat('k-bal', 'CREDITS', money(s.balance), 'gold'),
    stat('k-bet', 'BET', money(s.bet), 'jade'),
    stat('k-win', 'WIN', money(s.win), s.win > 0 ? 'ok' : 'dim'),
  ];
  if (s.free > 0) stats.push(stat('k-free', 'FREE SPINS', String(s.free), 'warn'));
  const sk = s.skins ?? {};
  // Logo 皮肤槽（fail-soft）：真图 → Image·否则文字标题。
  const title: LayoutNode = sk.logo
    ? { type: 'Image', id: 'k-logo', props: { src: sk.logo, fit: 'contain', alt: 'ZOMBIE SLOTS' }, layout: { width: 200, height: 48 } }
    : { type: 'Label', id: 'k-title', props: { text: '☣ ZOMBIE SLOTS', size: 'xl', bold: true, color: 'jade', glow: true } };
  return {
    type: 'Panel', id: 'k-topbar', props: { glass: true, bgTexture: sk.panel },
    layout: { direction: 'row', align: 'center', justify: 'between', padding: 12, gap: 10 },
    children: [
      title,
      { type: 'Panel', id: 'k-stats', props: { bare: true }, layout: { direction: 'row', align: 'center', gap: 22 }, children: stats },
      {
        type: 'Panel', id: 'k-tools', props: { bare: true }, layout: { direction: 'row', align: 'center', gap: 6 },
        children: [
          { type: 'Button', id: 'k-mute', props: { label: s.muted ? '🔇' : '🔊', kind: 'ghost', action: 'toggle_mute', skin: sk.btnMute } },
        ],
      },
    ],
  };
}

// ── 底部下注/旋转条 ─────────────────────────────────────────────────────────
export function buildBottomBar(s: HudState): LayoutNode {
  const free = s.free > 0;
  const sk = s.skins ?? {};
  const canSpin = !s.spinning && (free || s.balance >= s.bet);
  const lineBet = Math.max(1, Math.floor(s.bet / PAYLINES.length));
  const betCtl: LayoutNode = {
    type: 'Panel', id: 'k-betctl', props: { bare: true },
    layout: { direction: 'row', align: 'center', gap: 8 },
    children: [
      { type: 'Button', id: 'k-betdown', props: { label: '−', kind: 'primary', disabled: s.spinning || free || s.bet <= BET_MIN, action: 'betdown', skin: sk.btnMinus } },
      {
        type: 'Panel', id: 'k-betbox', props: { bare: true }, layout: { direction: 'column', align: 'center', gap: 0 },
        children: [
          { type: 'Label', id: 'k-betv', props: { text: `BET ${money(s.bet)}`, size: 'md', bold: true, color: 'text' } },
          { type: 'Label', id: 'k-lineb', props: { text: `${PAYLINES.length} lines · ${lineBet}/line`, size: 'xs', color: 'dim' } },
        ],
      },
      { type: 'Button', id: 'k-betup', props: { label: '+', kind: 'primary', disabled: s.spinning || free || s.bet >= BET_MAX, action: 'betup', skin: sk.btnPlus } },
    ],
  };
  const spinBtn: LayoutNode = {
    type: 'Button', id: 'k-spin',
    props: { label: s.spinning ? '···' : free ? `FREE SPIN (${s.free})` : '↻ SPIN', kind: 'hero', disabled: !canSpin, action: 'spin', skin: sk.btnSpin },
    layout: canSpin && !s.spinning ? { fx: [{ kind: 'glow', color: free ? 'warn' : 'jade' }] } : undefined,
  };
  return {
    type: 'Panel', id: 'k-bottombar', props: { glass: true, bgTexture: sk.panel },
    layout: { direction: 'row', align: 'center', justify: 'between', padding: 14, gap: 16 },
    children: [betCtl, spinBtn, { type: 'Label', id: 'k-hint', props: { text: free ? '👑 Wilds walk the horde · wins ×2' : 'Match 3+ left→right · ☣☣☣ = Free Spins', size: 'sm', color: 'sub' } }],
  };
}

// ── 中奖 / 特色浮层 ──────────────────────────────────────────────────────────
const OVERLAY_COPY: Record<OverlayKind, { title: string; sub: string; color: ColorTok; btn: string }> = {
  big: { title: 'BIG WIN', sub: 'The dead pay well tonight.', color: 'ok', btn: 'COLLECT' },
  mega: { title: 'MEGA WIN', sub: 'The graveyard overflows!', color: 'gold', btn: 'COLLECT' },
  zombie: { title: 'ZOMBIE APOCALYPSE', sub: 'An outbreak of riches!', color: 'warn', btn: 'COLLECT' },
  free: { title: 'FREE SPINS', sub: 'The horde spins for you — wins ×2.', color: 'warn', btn: 'ENTER' },
  broke: { title: 'OUT OF CREDITS', sub: 'Rise again with a fresh bankroll.', color: 'danger', btn: 'REVIVE' },
};
export function buildOverlay(s: HudState): LayoutNode {
  const o = s.overlay!;
  const c = OVERLAY_COPY[o.kind];
  // 中奖横幅皮肤槽（fail-soft）：真图 → Image 大横幅·否则文字标题。
  const titleNode: LayoutNode = o.banner
    ? { type: 'Image', id: 'k-ov-banner', props: { src: o.banner, fit: 'contain', alt: c.title }, layout: { width: 460, height: 150 } }
    : { type: 'Label', id: 'k-ov-title', props: { text: c.title, size: 'xxxl', bold: true, color: c.color, glow: true } };
  const children: LayoutNode[] = [
    titleNode,
    { type: 'Label', id: 'k-ov-sub', props: { text: c.sub, size: 'md', color: 'sub' } },
  ];
  if (o.kind === 'free') {
    children.splice(1, 0, { type: 'Label', id: 'k-ov-amt', props: { text: `${o.free} SPINS`, size: 'xxl', bold: true, color: 'gold', glow: true } });
  } else if (o.kind !== 'broke') {
    children.splice(1, 0, { type: 'Label', id: 'k-ov-amt', props: { text: `+${money(o.amount)}`, size: 'xxl', bold: true, color: 'gold', glow: true } });
  }
  children.push({ type: 'Button', id: 'k-ov-btn', props: { label: c.btn, kind: 'hero', action: o.kind === 'broke' ? 'reset' : 'ack' } });
  return {
    type: 'Screen', id: 'k-overlay',
    props: { center: true, bg: { custom: 'radial-gradient(ellipse at 50% 40%, rgba(20,60,28,0.72), rgba(4,8,5,0.92))' } },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 16, padding: 24 },
    children,
  };
}
