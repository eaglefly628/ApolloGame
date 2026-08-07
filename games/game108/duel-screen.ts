// game108 对局屏 —— **纯 LayoutNode 数据**（UI 铁律：禁手写 React/自由 DOM）。
// **照抄参照 = `games/game-i/casual-hud.ts`（🍬 组合·超休闲对局屏）**——按 ui-playbook §0.1
// 展台导览「①抄一整屏结构」定位到它，屋规照它：根 Panel 定尺 + vignette + 环境粒子、
// Label.size 用令牌（xs/md/lg/xl）非数字、flex:1 撑开、写世界只经 action。
// 写世界只经 `action` 信号名，且**信号名一律取自【R-108-70】动作词表**（UI / data-action / 验收剧本同源）。
// 华丽起手（capability-plan §4.6）：house 主题 apolloOnyx + 成熟件（ProgressBar/异形石板/hero 键 + press3d/ring 倒计时）。
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';

import {
  HANDS, HAND_CN, HAND_ICON, CHARGE_CAP, HP_MAX, DMG_BASE, DMG_STEP, ACT, SIDES,
  chargeRes, HP_RES, VIEW_W, VIEW_H, type Hand, type Side,
} from './theme.js';

/** 这只手现在打多少【R-108-13】——键面副标用（数值口径与 theme 同源，不在屏里另写一份公式）。 */
const DMG_AT = (charge: number): number => DMG_BASE + charge * DMG_STEP;

// 舞台定尺取自 theme 的单一真相——与 mountHost 的 field 同源（不同源 = 屏缩在 field 一角）。
const STAGE_W = VIEW_W, STAGE_H = VIEW_H;

/** 相位（对局屏按它决定哪一排键可点）——与 blueprint 的 GameFlow 状态 id 同名。 */
export type Phase = 'charge' | 'throw' | 'clash' | 'settle' | 'p1win' | 'p2win';

export interface DuelView {
  phase: Phase;
  /** 相位剩余比例 0..1（倒计时环）。 */
  phaseLeft: number;
  hp: Record<Side, number>;
  charge: Record<Side, Record<Hand, number>>;
  /** 本回合双方亮出的手（T3/T4 才有值）。 */
  shown?: Record<Side, Hand | ''>;
  /** 对手台词（表演型 tell·【R-108-31】）。 */
  tell?: string;
}

const PHASE_CN: Record<Phase, string> = {
  charge: '蓄力', throw: '出招', clash: '对决', settle: '结算', p1win: '你赢了', p2win: '你输了',
};

/** 一条蓄力槽【R-108-03】：常驻、零操作可读；bind 直连世界资源 id。 */
function chargeBar(side: Side, h: Hand, view: DuelView): LayoutNode {
  const lv = view.charge[side][h];
  return {
    type: 'Panel', id: `cb-${side}-${h}`, props: { bare: true },
    layout: { direction: 'row', align: 'center', gap: 6 },
    children: [
      { type: 'Label', id: `cb-${side}-${h}-i`, props: { text: HAND_ICON[h], size: 'md' } },
      {
        type: 'ProgressBar', id: `cb-${side}-${h}-b`,
        // bind = resourceId：resolveBindings 时 value/max 直接取自世界 Resource（常驻·零操作可读【R-108-03】）。
        // **不开 showValue**：基座把它渲成 `t.dim` 11px，暗色主题下 ui-audit 实测 2.93（真读不清，
        // 不是工具盲区——casual-hud 同写法能过只因它底是亮糖色）。蓄力级数是本作的核心可读信息，
        // 【R-108-03】要求"零操作可读"，故自己出一个高对比 Label（数据同源 view，不另立真相）。
        props: { value: 0, max: CHARGE_CAP, tone: side === 'p1' ? 'gold' : 'danger', bind: chargeRes(side, h) },
        layout: { width: 108 },
      },
      {
        type: 'Label', id: `cb-${side}-${h}-v`,
        props: { text: `${lv}/${CHARGE_CAP}`, size: 'sm', color: lv > 0 ? 'gold' : 'text', bold: lv > 0 },
      },
    ],
  };
}

/** 一侧的面板：血条 + 三条蓄力槽。 */
function sidePanel(side: Side, view: DuelView): LayoutNode {
  return {
    type: 'Panel', id: `side-${side}`,
    // 货架件：`bg` 预设配色（steel/blood·非裸 hex）+ `glass` 磨砂（HUD 浮在 vignette 底上）+ `edge` 语义描边。
    props: { bg: side === 'p1' ? 'steel' : 'blood', glass: true, edge: side === 'p1' ? 'gold' : 'danger' },
    layout: { direction: 'column', gap: 8, padding: 12 },
    children: [
      {
        // 中文艺术字：`heavy`(Anton) 是拉丁族，汉字会**回退成系统默认**（=白瞎一个艺术字槽）。
        // CJK 四款里 `cnbrush`（马善政毛笔行楷）才真渲汉字——「拳律」这种武打调性正对症。
        type: 'Label', id: `side-${side}-n`,
        props: { text: side === 'p1' ? '你' : '对手', font: 'cnbrush', size: 'lg', color: 'text', bold: true },
      },
      {
        type: 'Panel', id: `side-${side}-hprow`, props: { bare: true },
        layout: { direction: 'row', align: 'center', gap: 8 },
        children: [
          {
            type: 'ProgressBar', id: `side-${side}-hp`,
            // ⚠ 血量两侧同 id（matrix-duel 的 hpResource 按侧 local 寻址）→ bind 的全局 id 路由分不清哪一侧，
            // 故此处**不 bind**，由宿主投影 view.hp 填 value（同 game-103 readState 口径）。
            // showValue 同蓄力槽的理由不开：改用高对比 Label（暗底下 t.dim 11px 实测 2.93）。
            props: { value: view.hp[side], max: HP_MAX, tone: 'ok' },
            layout: { width: 190 },
          },
          {
            type: 'Label', id: `side-${side}-hpv`,
            props: { text: `${view.hp[side]}`, font: 'impact', size: 'lg', color: 'text', bold: true },
          },
        ],
      },
      ...HANDS.map((h) => chargeBar(side, h, view)),
    ],
  };
}

/** 规则石板【R-108-40】：判定表可视化，常驻台面中央（异形容器·华丽件）。 */
function ruleSlab(): LayoutNode {
  return {
    // 异形容器 `shape:'shield'` **必须给足宽高**（catalog 原话：异形需给足宽高避免裁掉内容）——
    // 2026-08-07 真渲染目击到不给 height 时盾徽被裁成一个方框加个小尖。
    type: 'Panel', id: 'slab', props: { shape: 'shield', edge: 'gold', bg: 'ember' },
    layout: { direction: 'column', align: 'center', justify: 'center', gap: 6, padding: 12, width: 208, height: 116 },
    children: [
      // `cnbrush` = 中文毛笔行楷（能真渲汉字）；`stroke` 描边 + `glow` 磷光 = 石刻感。
      { type: 'Label', id: 'slab-t', props: { text: '拳律', font: 'cnbrush', size: 'xl', color: 'gold', bold: true, stroke: true, glow: true } },
      { type: 'Label', id: 'slab-r', props: { text: '石 › 剪 › 布 › 石', size: 'sm', color: 'sub' } },
    ],
  };
}

/**
 * 一排动作键。**信号名取自动作词表**【R-108-70】——UI 的 action 与验收剧本步骤名同一串字符。
 * 蓄力键在槽满时禁用【R-108-10】：不可点、不产生信号（而不是静默吞掉）。
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
        // hero 键副标（货架件 `Button.sub`）：把这只手的蓄力级数与伤害写在键上——
        // 【R-108-13】伤害只由蓄力决定，玩家按键前就该看见"这一手打多少"，不必回头数槽。
        sub: full ? `满蓄 · ${DMG_AT(lv)}` : lv > 0 ? `蓄 ${lv} · ${DMG_AT(lv)}` : `${DMG_AT(0)}`,
        kind: 'hero', shape: 'hexagon', disabled,
        ...(disabled ? {} : { action }),
      },
      layout: { width: 122, height: 84, press3d: true },
    };
  });
  return {
    type: 'Panel', id: 'keys', props: { bare: true },
    layout: { direction: 'row', justify: 'center', gap: 12, padding: 4 },
    children: keys,
  };
}

/** 对局屏（S-03）：六条槽 + 石板 + 三大键 + 倒计时环 + 对手台词。 */
export function buildDuelScreen(view: DuelView): LayoutNode {
  const shown = view.shown;
  return {
    type: 'Panel', id: 'duel-screen', props: { vignette: true },
    layout: { width: STAGE_W, height: STAGE_H, direction: 'column', align: 'center', gap: 10, padding: 14 },
    children: [
      sidePanel('p2', view),
      {
        // 台面中区：相位环 + 双方亮手 + 规则石板。**相位环必须在台面里**——2026-08-07 真渲染目击到
        // 它原本贴在「你」面板正上方，读起来像玩家私有物，其实是全局相位（离双方等距才不误读）。
        // flex:1 撑开中区（照 casual-hud 屋规）：台面吃掉余高，双方面板各贴上下缘。
        type: 'Panel', id: 'center', props: { bare: true },
        layout: { direction: 'column', align: 'center', justify: 'center', gap: 16, flex: 1 },
        children: [
          {
            type: 'Panel', id: 'phase', props: { bare: true },
            layout: { direction: 'row', align: 'center', justify: 'center', gap: 10 },
            children: [
              {
                type: 'ProgressBar', id: 'phase-ring',
                props: { value: Math.round(view.phaseLeft * 100), max: 100, shape: 'ring', size: 54, tone: 'gold' },
              },
              { type: 'Label', id: 'phase-t', props: { text: PHASE_CN[view.phase], font: 'cnbrush', size: 'xl', color: 'gold', bold: true, glow: true } },
              ...(view.tell ? [{ type: 'Label', id: 'tell', props: { text: view.tell, size: 'sm', color: 'warn' } } as LayoutNode] : []),
            ],
          },
          {
            // 台面星尘（`Particles`）。**必须显式给宽高**：渲染器给它的容器是 `position:relative`
            // 的在流盒，不给尺寸就塌成 0 高 → 一颗也看不见（2026-08-07 真渲染目击：我起手照抄
            // casual-hud 的无尺寸写法，粒子从头到尾没显形过）。放在相位与台面之间，正好填掉中区空档。
            type: 'Particles', id: 'ds-amb', props: { kind: 'sparkle', count: 20, loop: true },
            layout: { width: STAGE_W - 40, height: 56 },
          },
          {
            type: 'Panel', id: 'table', props: { bare: true },
            layout: { direction: 'row', align: 'center', justify: 'center', gap: 18 },
            children: [
              {
                // 亮手：出手了才发光（stroke+glow）——没亮时是暗问号，亮相那一刻观感有落差。
                type: 'Label', id: 'shown-p2',
                props: { text: shown?.p2 ? HAND_ICON[shown.p2] : '❔', size: 'xl', color: shown?.p2 ? 'danger' : 'sub', ...(shown?.p2 ? { stroke: true, glow: true } : {}) },
              },
              ruleSlab(),
              {
                type: 'Label', id: 'shown-p1',
                props: { text: shown?.p1 ? HAND_ICON[shown.p1] : '❔', size: 'xl', color: shown?.p1 ? 'gold' : 'sub', ...(shown?.p1 ? { stroke: true, glow: true } : {}) },
              },
            ],
          },
        ],
      },
      sidePanel('p1', view),
      actionRow(view),
    ],
  };
}

/** 起手视图（尚未接 world 投影时的初值·也给测试当基准）。 */
export function emptyView(): DuelView {
  const zero = (): Record<Hand, number> => ({ rock: 0, paper: 0, scissors: 0 });
  return {
    phase: 'charge', phaseLeft: 1,
    hp: { p1: HP_MAX, p2: HP_MAX },
    charge: { p1: zero(), p2: zero() },
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
