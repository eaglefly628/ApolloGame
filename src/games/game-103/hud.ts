// game-103《幸存者核心原型》—— HUD = 纯 LayoutNode 数据（UI 铁律·禁手写 React/DOM）。
// 写世界只经 action 信号名（restart）→ 宿主 ActionSink 入队。
// 结构照 docs/design/game-103/survivor-hud-mockup.dc.html（SC-2 战斗 HUD·SC-4 结算）1:1 素坯复刻。
// ⚠ SC-3 升级三选一 modal 未接：draft 三选一=E1 编排（draft-offer 过滤候选），待 Lead 签 S2（REQ-SURVIVOR编排）。
//    M1 用「升级=固定强化」占位（等级++ / 治疗 / 全局 power+·见 blueprint levelup Effect），无时停弹窗。
import type { LayoutNode } from '@ui/components/index.js';
import { KUNAI } from './theme.js';

export interface HudState {
  hp: number; maxHp: number;
  xp: number; xpMax: number;
  level: number;
  elapsed: number;   // 存活秒数
  score: number;     // 累计击杀
  status: 'playing' | 'victory' | 'defeat';
}

function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── 顶部：经验条 + 状态行（血/攻·计时/等级·击杀/暂停）────────────────────────
function topBlock(s: HudState): LayoutNode {
  return {
    type: 'Panel', id: 's-top', props: { bare: true },
    layout: { direction: 'column', gap: 6, padding: 8 },
    children: [
      // 经验条（满屏顶·tone accent）
      { type: 'ProgressBar', id: 's-xp', props: { value: s.xp, max: s.xpMax, tone: 'accent' } },
      {
        type: 'Panel', id: 's-statrow', props: { bare: true },
        layout: { direction: 'row', align: 'start', justify: 'between', gap: 8 },
        children: [
          // 左坞：血条 + 攻击
          {
            type: 'Panel', id: 's-dock-l', props: { bare: true },
            layout: { direction: 'column', align: 'start', gap: 3 },
            children: [
              { type: 'ProgressBar', id: 's-hp', props: { value: s.hp, max: s.maxHp, tone: 'danger', showValue: true } },
              { type: 'Label', id: 's-atk', props: { text: `⚔️ ${KUNAI.dmg}`, size: 'sm', bold: true, color: 'text' } },
            ],
          },
          // 中：计时 + 等级
          {
            type: 'Panel', id: 's-mid', props: { bare: true },
            layout: { direction: 'column', align: 'center', gap: 2 },
            children: [
              { type: 'Label', id: 's-timer', props: { text: mmss(s.elapsed), size: 'xxl', bold: true, color: 'text', glow: true } },
              { type: 'Badge', id: 's-level', props: { text: `Lv.${s.level}`, tone: 'gold' } },
            ],
          },
          // 右坞：击杀 + 暂停
          {
            type: 'Panel', id: 's-dock-r', props: { bare: true },
            layout: { direction: 'column', align: 'end', gap: 3 },
            children: [
              { type: 'Label', id: 's-score', props: { text: `🪙 ${s.score}`, size: 'sm', bold: true, color: 'gold' } },
            ],
          },
        ],
      },
    ],
  };
}

// ── 底部：武器/被动格（M1 只 1 武器·其余占位·art 皮就绪即换装）──────────────
function bottomTrays(): LayoutNode {
  const slot = (id: string, icon: string, pip: string, filled: boolean): LayoutNode => ({
    type: 'Badge', id, props: { text: pip ? `${icon}${pip}` : icon, tone: filled ? 'ok' : 'dim' },
  });
  return {
    type: 'Panel', id: 's-trays', props: { bare: true },
    layout: { direction: 'column', align: 'center', gap: 5, padding: 8 },
    children: [
      {
        type: 'Panel', id: 's-wrow', props: { bare: true },
        layout: { direction: 'row', justify: 'center', gap: 5 },
        children: [
          slot('s-w0', '⚔️', 'Lv1', true),
          slot('s-w1', '·', '', false), slot('s-w2', '·', '', false),
          slot('s-w3', '·', '', false), slot('s-w4', '·', '', false), slot('s-w5', '·', '', false),
        ],
      },
      {
        type: 'Panel', id: 's-prow', props: { bare: true },
        layout: { direction: 'row', justify: 'center', gap: 5 },
        children: [
          slot('s-p0', '·', '', false), slot('s-p1', '·', '', false), slot('s-p2', '·', '', false),
          slot('s-p3', '·', '', false), slot('s-p4', '·', '', false), slot('s-p5', '·', '', false),
        ],
      },
    ],
  };
}

// ── 战斗 HUD（overlay·pointer-events 由宿主管·SC-2）──────────────────────────
export function buildHud(s: HudState): LayoutNode {
  return {
    type: 'Screen', id: 's-hud', props: { bg: 'transparent' },
    layout: { direction: 'column', justify: 'between' },
    children: [topBlock(s), bottomTrays()],
  };
}

// ── 结算浮层（SC-4·胜/败同版式·败无 confetti）────────────────────────────────
export function buildResult(s: HudState): LayoutNode {
  const win = s.status === 'victory';
  const statCell = (id: string, label: string, val: string, gold = false): LayoutNode => ({
    type: 'Panel', id, props: { bare: true },
    layout: { direction: 'column', align: 'center', gap: 2 },
    children: [
      { type: 'Label', id: `${id}-l`, props: { text: label, size: 'xs', color: 'sub' } },
      { type: 'Label', id: `${id}-v`, props: { text: val, size: 'lg', bold: true, color: gold ? 'gold' : 'text' } },
    ],
  });
  return {
    type: 'Screen', id: 's-result',
    props: { center: true, bg: { custom: 'linear-gradient(rgba(4,7,12,0.92),rgba(4,7,12,0.95))' } },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 16, padding: 24 },
    children: [
      { type: 'Label', id: 's-r-title', props: { text: win ? '胜利！' : '你倒下了', font: 'impact', size: 'xxxl', bold: true, color: win ? 'ok' : 'danger', glow: true } },
      { type: 'Label', id: 's-r-sub', props: { text: win ? '活满 15:00 · 幸存到底' : `生命归零 · ${mmss(s.elapsed)} 阵亡`, size: 'sm', color: 'sub' } },
      {
        type: 'Panel', id: 's-r-stats', props: { bare: true },
        layout: { direction: 'row', justify: 'center', gap: 22 },
        children: [
          statCell('s-r-time', '存活时长', mmss(s.elapsed)),
          statCell('s-r-kills', '击杀数', String(s.score)),
          statCell('s-r-lv', '最高等级', `Lv.${s.level}`),
        ],
      },
      { type: 'Button', id: 's-r-retry', props: { label: '再来一局', kind: 'hero', action: 'restart' } },
    ],
  };
}
