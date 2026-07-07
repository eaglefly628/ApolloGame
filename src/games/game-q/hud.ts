// Game Q · Neon Siege —— HUD = 纯 LayoutNode 数据（UI 铁律）。
// 写世界只经 action 信号名（buy_pulse/buy_cannon/restart）→ 宿主 ActionSink 入队 → sim keybind/craft-recipe 消费。
// handler 里绝不塞玩法逻辑；这里只按 sim 态（lives/gold/…）产出显示树。
import type { LayoutNode } from '@ui/components/index.js';
import { TOWERS } from './theme.js';

export interface HudState {
  lives: number;
  gold: number;
  enemies: number;
  pending: 'pulse' | 'cannon' | null;
  status: 'playing' | 'victory' | 'defeat';
}

// ── 顶部状态条 ──────────────────────────────────────────────────────────────
type StatColor = 'ok' | 'danger' | 'gold' | 'warn' | 'dim';
export function buildTopBar(s: HudState): LayoutNode {
  const stat = (id: string, icon: string, val: string, color: StatColor): LayoutNode => ({
    type: 'Label', id, props: { text: `${icon} ${val}`, size: 'lg', bold: true, color, glow: true },
  });
  return {
    type: 'Panel', id: 'q-topbar', props: { glass: true },
    layout: { direction: 'row', align: 'center', justify: 'between', padding: 12, gap: 12 },
    children: [
      { type: 'Label', id: 'q-title', props: { text: '◈ NEON SIEGE', font: 'scifi', size: 'xl', color: 'jade', glow: true } },
      {
        type: 'Panel', id: 'q-stats', props: { bare: true },
        layout: { direction: 'row', align: 'center', gap: 20 },
        children: [
          stat('q-lives', '♥', String(s.lives), s.lives <= 5 ? 'danger' : 'ok'),
          stat('q-gold', '⬡', String(s.gold), 'gold'),
          stat('q-threat', '☣', String(s.enemies), s.enemies > 0 ? 'warn' : 'dim'),
        ],
      },
    ],
  };
}

// ── 底部建造条 ──────────────────────────────────────────────────────────────
function buildButton(key: 'pulse' | 'cannon', s: HudState): LayoutNode {
  const def = TOWERS[key];
  const affordable = s.gold >= def.cost;
  const pending = s.pending === key;
  const disabled = s.pending !== null ? !pending : !affordable;
  return {
    type: 'Button',
    id: `q-buy-${key}`,
    props: {
      label: `${def.name}  ⬡${def.cost}`,
      kind: 'primary', // 令牌化 jade 底/字（对比可量·换皮自适应）；pending 强调走 glow fx，不用 hero 金渐变（渐变底测不了对比）
      disabled,
      action: `buy_${key}`,
    },
    layout: pending ? { fx: [{ kind: 'glow', color: 'jade' }] } : undefined,
  };
}

export function buildBottomBar(s: HudState): LayoutNode {
  const hint = s.pending
    ? `▶ Tap the grid to deploy ${TOWERS[s.pending].name}`
    : 'Build towers along the lane · hold the line';
  return {
    type: 'Panel', id: 'q-bottombar', props: { glass: true },
    layout: { direction: 'row', align: 'center', justify: 'center', gap: 16, padding: 12 },
    children: [
      buildButton('pulse', s),
      buildButton('cannon', s),
      {
        type: 'Label', id: 'q-hint',
        props: { text: hint, size: 'sm', color: s.pending ? 'jade' : 'sub' },
      },
    ],
  };
}

// ── 胜负浮层（仅 status !== playing 时挂）─────────────────────────────────────
export function buildOverlay(s: HudState): LayoutNode {
  const win = s.status === 'victory';
  return {
    type: 'Screen', id: 'q-overlay',
    props: { center: true, bg: { custom: 'linear-gradient(rgba(3,7,15,0.86),rgba(3,7,15,0.9)),#05070f' } },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 18, padding: 24 },
    children: [
      {
        type: 'Label', id: 'q-over-title',
        props: { text: win ? 'VICTORY' : 'BASE LOST', font: 'scifi', size: 'xxxl', bold: true, color: win ? 'ok' : 'danger', glow: true },
      },
      {
        type: 'Label', id: 'q-over-sub',
        props: {
          text: win ? 'All waves repelled. The grid holds.' : 'The swarm overran your core.',
          size: 'md', color: 'sub',
        },
      },
      { type: 'Button', id: 'q-restart', props: { label: 'PLAY AGAIN', kind: 'hero', action: 'restart' } },
    ],
  };
}
