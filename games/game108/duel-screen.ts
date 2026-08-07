// game108 对局屏 —— **纯 LayoutNode 数据**（UI 铁律：禁手写 React/自由 DOM）。
// 屋规照 `games/game-i/casual-hud.ts`（ui-playbook §0.1 展台导览「①抄一整屏结构」）。
// 写世界只经 `action`，信号名一律取自【R-108-70】动作词表（UI / data-action / 验收剧本同源）。
//
// ⚠ **信息层级是本屏的第一设计约束**（owner 2026-08-07 玩家视角复核·self-check「七问」第 1 问）：
// 本作的**唯一支柱**是「对手往哪只手存力，你看得见」。第一版把六条槽做成了一模一样的小灰条，
// 视觉权重跟血条一样甚至更低 ⇒ 玩家要主动去比对六个小数字才读得到核心信息，层级完全反了。
// 现在：**对手的槽是屏上最重的元素**（更宽、带威胁标、蓄满高亮），我方槽退居次级。
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';

import {
  HANDS, HAND_CN, HAND_ICON, CHARGE_CAP, HP_MAX, DMG_BASE, DMG_STEP, ACT, SIDES,
  chargeRes, HP_RES, VIEW_W, VIEW_H, SMOKE_USES, type Hand, type Side,
} from './theme.js';

/** 这只手现在打多少【R-108-13】（数值口径与 theme 同源，屏里不另写公式）。 */
const DMG_AT = (charge: number): number => DMG_BASE + charge * DMG_STEP;

const STAGE_W = VIEW_W, STAGE_H = VIEW_H;

export type Phase = 'charge' | 'throw' | 'clash' | 'settle' | 'p1win' | 'p2win';

export interface DuelView {
  phase: Phase;
  /** 相位剩余比例 0..1（倒计时环）。 */
  phaseLeft: number;
  /** 第几回合（七问第 5 问：玩家得知道自己打到哪了）。 */
  round: number;
  hp: Record<Side, number>;
  charge: Record<Side, Record<Hand, number>>;
  /** 本回合双方亮出的手（T3/T4 才有值）。 */
  shown?: Record<Side, Hand | ''>;
  /** 我这回合提交了哪只手（七问第 2 问：点完到揭晓之间要有确认）。 */
  submitted?: Hand | '';
  /** 上一次结算的结果（七问第 3 问：一眼看出赢没赢、代价多少）。 */
  outcome?: { winner: Side | 'tie'; damage: number };
  /** 烟雾：剩几发 / 现在遮着没有。 */
  smoke: { uses: number; hidden: boolean };
  /** 对手台词（表演型 tell·【R-108-31】）。 */
  tell?: string;
}

const PHASE_CN: Record<Phase, string> = {
  charge: '蓄力', throw: '出招', clash: '对决', settle: '结算', p1win: '你赢了', p2win: '你输了',
};
/** 每个时区一句「现在该干嘛」——七问第 6 问：第一次打开的人得知道这些键干嘛。 */
const PHASE_HINT: Record<Phase, string> = {
  charge: '点一只手蓄力 · 对手看得见',
  throw: '出一只手 · 不必是蓄过的那只',
  clash: '亮拳',
  settle: '出过的手清零',
  p1win: '', p2win: '',
};

/**
 * 一条蓄力槽【R-108-03】。`big` = 对手那三条（屏上最重的元素）。
 * 蓄满时整条转成危险色 + 标「满」——「他攒够了」必须是**一眼可见的事件**，不是要读数字才知道。
 */
function chargeBar(side: Side, h: Hand, view: DuelView, big: boolean): LayoutNode {
  const lv = view.charge[side][h];
  const full = lv >= CHARGE_CAP;
  const hot = lv >= 2;
  return {
    type: 'Panel', id: `cb-${side}-${h}`, props: { bare: true },
    layout: { direction: 'row', align: 'center', gap: big ? 8 : 6 },
    children: [
      { type: 'Label', id: `cb-${side}-${h}-i`, props: { text: HAND_ICON[h], size: big ? 'lg' : 'md' } },
      {
        type: 'ProgressBar', id: `cb-${side}-${h}-b`,
        // bind = resourceId：resolveBindings 时直接取世界 Resource（宿主必须先跑 resolveBindings·否则是哑弹）。
        // **不开 showValue**：基座把它渲成 t.dim 11px，暗底实测 2.93 真读不清（ui-audit 在案）。
        props: {
          value: 0, max: CHARGE_CAP, bind: chargeRes(side, h),
          tone: full ? 'danger' : hot ? 'warn' : side === 'p1' ? 'gold' : 'accent',
        },
        layout: { width: big ? 176 : 118, height: big ? 14 : 8 },
      },
      {
        type: 'Label', id: `cb-${side}-${h}-v`,
        props: {
          text: `${lv}/${CHARGE_CAP}`, size: big ? 'md' : 'sm',
          color: full ? 'danger' : hot ? 'warn' : 'text', bold: hot,
        },
      },
      // 「满」标只在对手那侧出——玩家自己那侧键上已经写着「满蓄·40」了，两处重复反而稀释。
      ...(big && full
        ? [{ type: 'Badge', id: `cb-${side}-${h}-x`, props: { text: '满', tone: 'danger' } } as LayoutNode]
        : []),
    ],
  };
}

/** 对手面板：**屏上最重的一块**——血条 + 三条大号蓄力槽 + 威胁提示。 */
function opponentPanel(view: DuelView): LayoutNode {
  const maxCharge = Math.max(...HANDS.map((h) => view.charge.p2[h]));
  const threat = maxCharge >= CHARGE_CAP ? '他攒满了一手 · 被打中要掉四成血'
    : maxCharge >= 2 ? '他在攒力 · 留意那只手'
      : '';
  return {
    type: 'Panel', id: 'side-p2', props: { bg: 'blood', glass: true, edge: (maxCharge >= 2 ? 'danger' : 'foe') as 'danger' | 'foe' },
    layout: { direction: 'column', gap: 6, padding: 12 },
    children: [
      {
        type: 'Panel', id: 'p2-head', props: { bare: true },
        layout: { direction: 'row', align: 'center', justify: 'between' },
        children: [
          { type: 'Label', id: 'side-p2-n', props: { text: '对手', font: 'cnbrush', size: 'lg', color: 'text', bold: true } },
          {
            type: 'Panel', id: 'p2-hprow', props: { bare: true },
            layout: { direction: 'row', align: 'center', gap: 6 },
            children: [
              { type: 'ProgressBar', id: 'side-p2-hp', props: { value: view.hp.p2, max: HP_MAX, tone: 'ok' }, layout: { width: 120 } },
              { type: 'Label', id: 'side-p2-hpv', props: { text: `${view.hp.p2}`, font: 'impact', size: 'lg', color: 'text', bold: true } },
            ],
          },
        ],
      },
      ...HANDS.map((h) => chargeBar('p2', h, view, true)),
      ...(threat ? [{ type: 'Label', id: 'p2-threat', props: { text: `⚠ ${threat}`, size: 'sm', color: 'danger', bold: true } } as LayoutNode] : []),
    ],
  };
}

/** 我方面板：血条 + 三条次级槽 + **出招确认**（七问第 2 问）。 */
function selfPanel(view: DuelView): LayoutNode {
  const sub = view.submitted;
  return {
    type: 'Panel', id: 'side-p1', props: { bg: 'steel', glass: true, edge: 'gold' },
    layout: { direction: 'column', gap: 5, padding: 10 },
    children: [
      {
        type: 'Panel', id: 'p1-head', props: { bare: true },
        layout: { direction: 'row', align: 'center', justify: 'between' },
        children: [
          { type: 'Label', id: 'side-p1-n', props: { text: '你', font: 'cnbrush', size: 'md', color: 'text', bold: true } },
          {
            type: 'Panel', id: 'p1-hprow', props: { bare: true },
            layout: { direction: 'row', align: 'center', gap: 6 },
            children: [
              { type: 'ProgressBar', id: 'side-p1-hp', props: { value: view.hp.p1, max: HP_MAX, tone: 'ok' }, layout: { width: 120 } },
              { type: 'Label', id: 'side-p1-hpv', props: { text: `${view.hp.p1}`, font: 'impact', size: 'lg', color: 'text', bold: true } },
            ],
          },
        ],
      },
      ...HANDS.map((h) => chargeBar('p1', h, view, false)),
      {
        // 出招确认：点完到揭晓之间有 2 秒空窗（悬念是对的），但**玩家得知道自己提交了什么**，
        // 否则手滑点错了都不知道（七问第 2 问·第一版整个缺这条）。
        type: 'Label', id: 'p1-submitted',
        props: sub
          ? { text: `已出招 ${HAND_ICON[sub]} ${HAND_CN[sub]}`, size: 'sm', color: 'gold', bold: true }
          : { text: view.phase === 'throw' ? '未出招 · 到点顺延上一手' : ' ', size: 'sm', color: 'sub' },
      },
    ],
  };
}

/** 规则石板【R-108-40】：判定表可视化。 */
function ruleSlab(): LayoutNode {
  return {
    type: 'Panel', id: 'slab', props: { shape: 'shield', edge: 'gold', bg: 'ember' },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 2, padding: 8, width: 150, height: 74 },
    children: [
      { type: 'Label', id: 'slab-t', props: { text: '拳律', font: 'cnbrush', size: 'lg', color: 'gold', bold: true, stroke: true, glow: true } },
      { type: 'Label', id: 'slab-r', props: { text: '石 › 剪 › 布 › 石', size: 'xs', color: 'sub' } },
    ],
  };
}

/** 亮手区：**揭晓时占画面中心**（七问第 3 问——亮拳是本作的情绪核，不能是配角）。 */
function tableRow(view: DuelView): LayoutNode {
  const shown = view.shown;
  const revealed = !!(shown?.p1 || shown?.p2);
  const hand = (side: Side, id: string): LayoutNode => ({
    type: 'Label', id,
    props: shown?.[side]
      ? { text: HAND_ICON[shown[side]], size: 'xl', color: side === 'p1' ? 'gold' : 'danger', stroke: true, glow: true }
      : { text: '❔', size: 'lg', color: 'sub' },
  });
  return {
    type: 'Panel', id: 'table', props: { bare: true },
    layout: { direction: 'row', align: 'center', justify: 'center', gap: revealed ? 26 : 18 },
    children: [hand('p2', 'shown-p2'), ruleSlab(), hand('p1', 'shown-p1')],
  };
}

/**
 * 读牌区（T1/T2 揭晓之前占中区）。第一版这块是**大片死空白**——而中区是屏上最大的一块地方，
 * 空着等于告诉玩家「这儿没什么可看的」，正好和本作「你应该盯着对手的手」相反。
 * 现在：把**对手攒得最满的那只手**放大摆在这儿，配一句「他攒了 N 层 · 挨一下掉 M」。
 * 这不是装饰，是七问第 1 问的落点——核心信息该在屏上最重的位置。
 */
function readingArea(view: DuelView): LayoutNode | null {
  if (view.phase === 'clash' || view.phase === 'settle') return null;
  let top: Hand = 'rock';
  for (const h of HANDS) if (view.charge.p2[h] > view.charge.p2[top]) top = h;
  const lv = view.charge.p2[top];
  if (lv <= 0) {
    return {
      type: 'Panel', id: 'reading', props: { bare: true },
      layout: { direction: 'column', align: 'center', gap: 4 },
      children: [{ type: 'Label', id: 'reading-idle', props: { text: '对手还没开始攒力', size: 'sm', color: 'sub' } }],
    };
  }
  return {
    type: 'Panel', id: 'reading', props: { bg: lv >= CHARGE_CAP ? 'blood' : 'sunken', edge: (lv >= CHARGE_CAP ? 'danger' : 'warn') as 'danger' | 'warn' },
    layout: { direction: 'column', align: 'center', gap: 2, padding: 10, width: 290 },
    children: [
      { type: 'Label', id: 'reading-l', props: { text: '他在攒这只手', size: 'xs', color: 'sub' } },
      {
        type: 'Panel', id: 'reading-row', props: { bare: true },
        layout: { direction: 'row', align: 'center', justify: 'center', gap: 10 },
        children: [
          { type: 'Label', id: 'reading-h', props: { text: HAND_ICON[top], size: 'xl', color: 'danger', stroke: true, glow: true } },
          { type: 'Label', id: 'reading-n', props: { text: `${lv}/${CHARGE_CAP}`, font: 'impact', size: 'xl', color: 'danger', bold: true } },
        ],
      },
      { type: 'Label', id: 'reading-d', props: { text: `挨一下掉 ${DMG_AT(lv)} · 用 ${HAND_CN[BEATS[top]]} 克它`, size: 'sm', color: 'warn', bold: true } },
    ],
  };
}

/** 谁克谁（屏上给提示用·与判定表同源的静态常识，不参与判定）。 */
const BEATS: Record<Hand, Hand> = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

/**
 * 结果横幅（七问第 3/4 问）：**一眼看出赢没赢、代价多少**。
 * 第一版只有血条数字在变，玩家得自己算差值；而且 40 和 10 的视觉重量一模一样——
 * 「满蓄一击 = 四成血」本该是全场最大的事件。这里按伤害档位放大字号与颜色。
 */
function outcomeBanner(view: DuelView): LayoutNode | null {
  const o = view.outcome;
  if (!o || (view.phase !== 'clash' && view.phase !== 'settle')) return null;
  if (o.winner === 'tie') {
    return {
      type: 'Panel', id: 'outcome', props: { bg: 'sunken' },
      layout: { direction: 'row', align: 'center', justify: 'center', gap: 8, padding: 6, width: 300 },
      children: [{ type: 'Label', id: 'outcome-t', props: { text: '平局 · 双方都不掉血', font: 'cnbrush', size: 'md', color: 'sub', bold: true } }],
    };
  }
  const iWon = o.winner === 'p1';
  const heavy = o.damage >= 30;          // 满蓄档 → 字更大、加描边（视觉重量跟数值挂钩）
  return {
    type: 'Panel', id: 'outcome', props: { bg: iWon ? 'gold-sheen' : 'blood', edge: (iWon ? 'gold' : 'danger') as 'gold' | 'danger' },
    layout: { direction: 'row', align: 'center', justify: 'center', gap: 10, padding: 6, width: 300 },
    children: [
      { type: 'Label', id: 'outcome-t', props: { text: iWon ? '你赢了这回合' : '你被打中', font: 'cnbrush', size: heavy ? 'lg' : 'md', color: iWon ? 'ink' : 'text', bold: true } },
      // **ASCII 连字符，不是全角减号 U+2212**：`impact`(Anton) 没有 U+2212 的字形，
      // 渲出来是个黑豆腐块——而这是全屏最要紧的一个数字（真渲染目击到才发现·字体缺字形不报错）。
      // 也不加 stroke：描边在这个字号上会把数字糊住。
      { type: 'Label', id: 'outcome-d', props: { text: `-${o.damage}`, font: 'impact', size: heavy ? 'xl' : 'lg', color: iWon ? 'ink' : 'danger', bold: true } },
    ],
  };
}

/** 顶栏：回合数 + 相位环 + 相位名 + 该干嘛（七问第 5/6 问）。 */
function statusBar(view: DuelView): LayoutNode {
  return {
    type: 'Panel', id: 'status', props: { bare: true },
    layout: { direction: 'column', align: 'center', gap: 2 },
    children: [
      {
        type: 'Panel', id: 'status-row', props: { bare: true },
        layout: { direction: 'row', align: 'center', justify: 'center', gap: 10 },
        children: [
          // 回合数用 Label 不用 Badge：Badge 的闭集 tone 只有 ok/warn/dim，dim 在暗底实测 2.93
          // 真读不清（ui-audit 抓到）。而回合数是七问第 5 问要的信息，不该是灰的。
          { type: 'Label', id: 'round-b', props: { text: `第 ${view.round} 回合`, size: 'sm', color: 'text', bold: true } },
          {
            type: 'ProgressBar', id: 'phase-ring',
            // 最后三分之一转红：让「还剩多久必须出手」看得见（七问第 5 问）。
            props: { value: Math.round(view.phaseLeft * 100), max: 100, shape: 'ring', size: 44, tone: view.phaseLeft < 0.34 ? 'danger' : 'gold' },
          },
          { type: 'Label', id: 'phase-t', props: { text: PHASE_CN[view.phase], font: 'cnbrush', size: 'xl', color: 'gold', bold: true, glow: true } },
        ],
      },
      ...(PHASE_HINT[view.phase]
        ? [{ type: 'Label', id: 'phase-hint', props: { text: PHASE_HINT[view.phase], size: 'xs', color: 'sub' } } as LayoutNode]
        : []),
      ...(view.tell ? [{ type: 'Label', id: 'tell', props: { text: view.tell, size: 'sm', color: 'warn' } } as LayoutNode] : []),
    ],
  };
}

/**
 * 动作键排。**信号名取自动作词表**【R-108-70】。
 * 蓄力键在槽满时禁用【R-108-10】：不可点、不产生信号。
 * 烟雾键（第七问：词表里有、屏上没有 = 功能缺失）——`ui-inventory` 曾点名 `smoke.use` 玩家够不着。
 */
function actionRow(view: DuelView): LayoutNode {
  const charging = view.phase === 'charge';
  const throwing = view.phase === 'throw';
  const keys: LayoutNode[] = HANDS.map((h) => {
    const lv = view.charge.p1[h];
    const full = lv >= CHARGE_CAP;
    const action = charging ? ACT.charge(h) : ACT.throw(h);
    const disabled = charging ? full : !throwing;
    return {
      type: 'Button', id: `key-${h}`,
      props: {
        label: `${HAND_ICON[h]} ${HAND_CN[h]}`,
        // 副标把「这一手打多少」写在键面上——【R-108-13】伤害只由蓄力决定，按键前就该看见。
        sub: charging ? (full ? `满蓄 · ${DMG_AT(lv)}` : `蓄力 → ${DMG_AT(lv + 1)}`) : `打 ${DMG_AT(lv)}`,
        kind: 'hero', shape: 'hexagon', disabled,
        ...(disabled ? {} : { action }),
      },
      layout: { width: 118, height: 78, press3d: true },
    };
  });
  return {
    type: 'Panel', id: 'keys', props: { bare: true },
    layout: { direction: 'column', align: 'center', gap: 6, padding: 4 },
    children: [
      { type: 'Panel', id: 'keys-row', props: { bare: true }, layout: { direction: 'row', justify: 'center', gap: 10 }, children: keys },
      {
        type: 'Button', id: 'key-smoke',
        props: {
          label: `💨 烟雾 ×${view.smoke.uses}`,
          sub: view.smoke.hidden ? '生效中 · 对手看不见你的槽' : '遮住自己三条槽 2 回合',
          kind: 'ghost', disabled: view.smoke.uses <= 0 || view.smoke.hidden,
          ...(view.smoke.uses > 0 && !view.smoke.hidden ? { action: ACT.smoke } : {}),
        },
        layout: { width: 260, height: 40 },
      },
    ],
  };
}

/** 对局屏（S-03）。信息层级：对手槽 > 亮手/结果 > 我方槽 > 键。 */
export function buildDuelScreen(view: DuelView): LayoutNode {
  const banner = outcomeBanner(view);
  const reading = readingArea(view);
  return {
    type: 'Panel', id: 'duel-screen', props: { vignette: true },
    layout: { width: STAGE_W, height: STAGE_H, direction: 'column', align: 'center', justify: 'between', gap: 6, padding: 12 },
    children: [
      opponentPanel(view),
      statusBar(view),
      {
        type: 'Panel', id: 'center', props: { bare: true },
        layout: { direction: 'column', align: 'center', justify: 'center', gap: 12, flex: 1 },
        children: [
          ...(reading ? [reading] : []),
          tableRow(view),
          ...(banner ? [banner] : []),
        ],
      },
      selfPanel(view),
      actionRow(view),
    ],
  };
}

/** 起手视图（尚未接 world 投影时的初值·也给测试当基准）。 */
export function emptyView(): DuelView {
  const zero = (): Record<Hand, number> => ({ rock: 0, paper: 0, scissors: 0 });
  return {
    phase: 'charge', phaseLeft: 1, round: 1,
    hp: { p1: HP_MAX, p2: HP_MAX },
    charge: { p1: zero(), p2: zero() },
    smoke: { uses: SMOKE_USES, hidden: false },
  };
}

/** 屏幕里用到的全部 action 信号名（供测试对【R-108-70】词表逐字对账）。 */
export function screenActions(view: DuelView): string[] {
  const out: string[] = [];
  const walk = (n: LayoutNode): void => {
    const a = (n.props as { action?: string } | undefined)?.action;
    if (a) out.push(a);
    for (const c of n.children ?? []) walk(c);
  };
  walk(buildDuelScreen(view));
  return out;
}

export { SIDES };
