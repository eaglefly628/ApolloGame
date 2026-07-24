// game-103《幸存者核心原型》—— HUD = 纯 LayoutNode 数据（UI 铁律·禁手写 React/DOM）。
// 写世界只经 action 信号名（restart）→ 宿主 ActionSink 入队。
// 结构照 docs/design/game-103/survivor-io-ui-kit.dc.html（Combat HUD + Victory）+ handoff 设计令牌。
// bright chunky cartoon：chevron 计时徽章 / 分段血经验条 / chunky 描边字 / 金带横幅 / parchment 结算卷轴。
// ⚠ Level Up 三选一(CHOOSE SKILL) / Lucky Wheel / Skills 三屏=后续切片（draft-offer 逻辑接线·见 requests）。
import type { LayoutNode } from '@ui/components/index.js';

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

// chunky 描边显示字（Luckiest Guy 近似=impact/heavy + stroke·handoff 允许同字符替换）。
function display(id: string, text: string, size: number, color: HudColor = 'text'): LayoutNode {
  return { type: 'Label', id, props: { text, font: 'heavy', size, color, bold: true, stroke: true } };
}
type HudColor = 'text' | 'gold' | 'ok' | 'warn' | 'danger' | 'sub' | 'jade';

// ── 顶部 HUD 行：暂停 / chevron 计时徽章 / 金币·击杀 ────────────────────────
function topBar(s: HudState): LayoutNode {
  const counter = (id: string, icon: string, val: string): LayoutNode => ({
    type: 'Panel', id, props: { bare: true },
    layout: { direction: 'row', align: 'center', gap: 5 },
    children: [
      { type: 'Label', id: `${id}-i`, props: { text: icon, size: 18 } },
      display(`${id}-v`, val, 18, 'text'),
    ],
  });
  return {
    type: 'Panel', id: 's-topbar', props: { bare: true },
    layout: { direction: 'row', align: 'start', justify: 'between', padding: 12, gap: 8 },
    children: [
      { type: 'Button', id: 's-pause', props: { label: '❚❚', kind: 'quiet', shape: 'cut', action: 'pause' } },
      // chevron 计时徽章（slate·居中大字）
      { type: 'Button', id: 's-timer', props: { label: mmss(s.elapsed), kind: 'primary', shape: 'chevron' } },
      {
        type: 'Panel', id: 's-counters', props: { bare: true },
        layout: { direction: 'column', align: 'end', gap: 5 },
        children: [counter('s-coin', '🪙', '0'), counter('s-kill', '💀', String(s.score))],
      },
    ],
  };
}

// ── 经验条（orange 分段感·tone warn）+ 等级徽章 ─────────────────────────────
function xpRow(s: HudState): LayoutNode {
  return {
    type: 'Panel', id: 's-xprow', props: { bare: true },
    layout: { direction: 'row', align: 'center', gap: 8, padding: 12 },
    children: [
      { type: 'ProgressBar', id: 's-xp', props: { value: s.xp, max: s.xpMax, tone: 'warn' } },
      display('s-lv', `Lv ${s.level}`, 15, 'gold'),
    ],
  };
}

// ── 底部：玩家血条（green）+ 摇杆视觉（M2 键盘走位·触屏摇杆=输入缺口报 PUI）──
function bottomBar(s: HudState): LayoutNode {
  return {
    type: 'Panel', id: 's-bottom', props: { bare: true },
    layout: { direction: 'column', align: 'center', gap: 12, padding: 16 },
    children: [
      {
        type: 'Panel', id: 's-hpwrap', props: { bare: true },
        layout: { direction: 'row', align: 'center', gap: 6 },
        children: [
          { type: 'Label', id: 's-hp-i', props: { text: '❤', size: 14, color: 'ok' } },
          { type: 'ProgressBar', id: 's-hp', props: { value: s.hp, max: s.maxHp, tone: 'ok', showValue: true } },
        ],
      },
      // 摇杆环 + 摇杆头（静态视觉·占位·真触屏输入待接）
      {
        type: 'Panel', id: 's-joy', props: { bg: { custom: 'rgba(30,34,40,.28)' } },
        layout: { direction: 'row', align: 'center', justify: 'center', width: 110, height: 110, radius: 55 },
        children: [{ type: 'Panel', id: 's-joy-knob', props: { bg: { custom: 'radial-gradient(circle at 40% 35%,#5c6672,#1c1f25)' } }, layout: { width: 50, height: 50, radius: 25 } }],
      },
    ],
  };
}

// ── 战斗 HUD（overlay·SC Combat）────────────────────────────────────────────
export function buildHud(s: HudState): LayoutNode {
  return {
    type: 'Screen', id: 's-hud', props: { bg: 'transparent' },
    layout: { direction: 'column', justify: 'between' },
    children: [
      { type: 'Panel', id: 's-hud-top', props: { bare: true }, layout: { direction: 'column', gap: 2 }, children: [topBar(s), xpRow(s)] },
      bottomBar(s),
    ],
  };
}

// ── 升级三选一（CHOOSE SKILL·时停 draft·SC Level Up）───────────────────────
// offers=draft-offer.rollOffer 产出的候选(经宿主映射)。整张卡可点→action=该项 effectSignal→宿主 applyPick。
export interface LevelUpOffer {
  id: string; name: string; desc: string;
  accent: 'active' | 'passive'; // 红=主动/武器·蓝=被动
  level: number; max: number; isNew: boolean; action: string;
  isEvo?: boolean; // 进化=金框高亮卡（.dc.html SC-3 evochoice）
}
function offerCard(o: LevelUpOffer): LayoutNode {
  const hue = o.isEvo ? 'linear-gradient(155deg,#ffd36b,#e0952a)' : o.accent === 'active' ? 'linear-gradient(155deg,#ff7a4d,#d63b1f)' : 'linear-gradient(155deg,#7fd0ff,#2f7fd0)';
  const nameColor = o.isEvo ? 'gold' : o.accent === 'active' ? 'danger' : 'jade';
  return {
    type: 'Panel', id: `c-${o.id}`,
    props: { bg: { custom: o.isEvo ? 'linear-gradient(#2a2412,#3a2f16)' : 'linear-gradient(#ecdcc0,#e0cfa8)' }, edge: o.isEvo ? 'gold' : o.accent === 'active' ? 'danger' : 'jade', action: o.action },
    layout: { direction: 'column', align: 'center', gap: 5, padding: 10, radius: 14, width: 118, fx: o.isEvo ? [{ kind: 'glow', color: 'gold' }] : undefined },
    children: [
      { type: 'Label', id: `c-${o.id}-n`, props: { text: o.name, font: 'heavy', size: 14, color: nameColor, bold: true, stroke: true } },
      { type: 'Label', id: `c-${o.id}-t`, props: { text: o.isEvo ? '⚡进化' : o.isNew ? 'New' : 'Level Up', size: 11, bold: true, color: o.isEvo ? 'gold' : o.isNew ? 'ok' : 'gold' } },
      { type: 'Panel', id: `c-${o.id}-ico`, props: { bg: { custom: hue } }, layout: { width: 56, height: 56, radius: 14 } },
      { type: 'Label', id: `c-${o.id}-d`, props: { text: o.desc, size: 11, color: o.isEvo ? 'text' : 'ink' } },
      { type: 'Rating', id: `c-${o.id}-s`, props: { value: o.level, max: o.max } },
    ],
  };
}
export function buildLevelUp(offers: LevelUpOffer[]): LayoutNode {
  return {
    type: 'Screen', id: 's-levelup',
    props: { center: true, bg: { custom: 'linear-gradient(rgba(42,46,53,0.94),rgba(30,33,39,0.96))' } },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 22, padding: 18 },
    children: [
      { type: 'Button', id: 's-lu-banner', props: { label: 'CHOOSE SKILL', kind: 'hero', shape: 'ribbon' } },
      {
        type: 'Panel', id: 's-lu-cards', props: { bare: true },
        layout: { direction: 'row', align: 'stretch', justify: 'center', gap: 10 },
        children: offers.map(offerCard),
      },
    ],
  };
}

// ── 结算浮层（Victory=parchment 卷轴 + confetti·Defeat=同版式无庆祝·SC Victory）──
export function buildResult(s: HudState): LayoutNode {
  const win = s.status === 'victory';
  const statPill = (id: string, icon: string, val: string): LayoutNode => ({
    type: 'Panel', id, props: { bg: { custom: '#3a2a16' } },
    layout: { direction: 'row', align: 'center', gap: 6, padding: 8, radius: 14 },
    children: [{ type: 'Label', id: `${id}-i`, props: { text: icon, size: 14 } }, display(`${id}-v`, val, 15, 'text')],
  });
  const scroll: LayoutNode = {
    type: 'Panel', id: 's-scroll', props: { bg: { custom: 'linear-gradient(#ecd6a8,#dcbf88)' }, edge: 'danger' },
    layout: { direction: 'column', align: 'center', gap: 12, padding: 22, radius: 14 },
    children: [
      { type: 'Button', id: 's-r-ribbon', props: { label: win ? 'VICTORY' : 'DEFEAT', kind: win ? 'hero' : 'primary', shape: 'ribbon' } },
      { type: 'Label', id: 's-r-sub', props: { text: win ? 'Chapter 1 · 幸存到底' : `${mmss(s.elapsed)} 阵亡`, font: 'heavy', size: 18, color: 'danger', bold: true } },
      {
        type: 'Panel', id: 's-r-pills', props: { bare: true },
        layout: { direction: 'row', justify: 'center', gap: 8 },
        children: [statPill('s-r-kill', '💀', String(s.score)), statPill('s-r-time', '⏱', mmss(s.elapsed)), statPill('s-r-lv', '⭐', `Lv ${s.level}`)],
      },
      { type: 'Button', id: 's-r-ok', props: { label: 'OK', kind: 'hero', action: 'restart' } },
    ],
  };
  return {
    type: 'Screen', id: 's-result',
    props: { center: true, bg: { custom: 'linear-gradient(rgba(20,22,27,0.92),rgba(20,22,27,0.96))' } },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 16, padding: 24 },
    children: win
      ? [{ type: 'Particles', id: 's-r-confetti', props: { kind: 'confetti' }, layout: { width: 320, height: 120 } }, scroll]
      : [scroll],
  };
}
