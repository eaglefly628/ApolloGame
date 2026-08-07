// game108 对局屏 —— **横版·手为主体**（纯 LayoutNode 数据·UI 铁律：禁手写 React/自由 DOM）。
//
// ⚠ 本屏的第一构图约束（owner 2026-08-07 定方向）：
// 「石头剪刀布的核心是**看到那只手出招的过程**——手从边缘伸出来展开，出招前晃一晃，然后变成那一招。
//   当中的路空出来留给手，其余 UI 围着这只手展开。」
// 于是整屏是**一条中央通道 + 四角 HUD**：两只手各占约四分之一画面从左右边缘伸入，
// 顶栏（身份/血/相位）、右上（对手蓄力槽）、左下（我方蓄力槽）、底中（三招键）、右下（烟雾）全部退到边上。
//
// ⚠ 第二约束（self-check 七问第 1 问）：本作的**唯一支柱**是「对手往哪只手存力，你看得见」。
// 所以对手的三条槽是**HUD 里最重的一块**（更宽、蓄满转危险色 + 「满」标），我方槽退居次级。
//
// ⚠ 第三约束（八问第 8 问·owner 一句「哪个是我出的」问出来的）：屏上每样东西都要能一眼归属。
// 三重冗余：**左恒为你 / 右恒为对手**（永不互换）+ **肤色与袖口色分明**（暖浅肤金袖 vs 深橙肤绯袖）
// + 每只手底下**钉一张名牌**（我这张同时兼「已出招 ✋ 布」的确认）。
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';

import {
  HANDS, HAND_CN, HAND_ICON, CHARGE_CAP, HP_MAX, DMG_BASE, DMG_STEP, ACT, SIDES,
  chargeRes, HP_RES, VIEW_W, VIEW_H, SMOKE_USES, type Hand, type Side,
} from './theme.js';
import { handArt, HAND_ASPECT } from './hand-art.js';

/** 这只手现在打多少【R-108-13】（数值口径与 theme 同源，屏里不另写公式）。 */
const DMG_AT = (charge: number): number => DMG_BASE + charge * DMG_STEP;

const STAGE_W = VIEW_W, STAGE_H = VIEW_H;

// ── 构图坐标（1280×720·全部绝对定位·**一处改一处生效**）────────────────────
// 手：整只（前臂 + 掌）640×273，掌部约占画布 21% 宽 × 33% 高 = 全屏最大的单个元素。
// 前臂根部**刻意出画**（HOME_X 为负 / 超右边缘）——「从画外伸进来」的前提是根部看不见。
//
// **手与 HUD 井水不犯河水**（首版真渲染目击：820 宽的手把左下蓄力槽和右上对手槽整块压住了）：
// 掌 x 293–557 / 723–987、y 240–476；前臂 y 306–408 那一条横带**左右两侧刻意留空**，就是给手走的路。
// 四角 HUD 的框全部排在这两个区间之外——下面每个 x/y 都是照着这条约束算的，改一个要重算一遍。
const HAND_W = 704;
const HAND_H = Math.round(HAND_W / HAND_ASPECT);   // 273
const HAND_Y = 230;                                 // 掌心中线 ≈ y 50%
const HAND_HOME_X: Record<Side, number> = { p1: -70, p2: VIEW_W - HAND_W + 70 };
/** 中线通道（两掌之间的缝·x 557–723）——石板挂在缝的上端，结果横幅打在缝的下端。 */
const SLAB_X = 576, SLAB_Y = 112, SLAB_W = 128, SLAB_H = 88;
const LANE_X = 440, LANE_Y = 516, LANE_W = 400, LANE_H = 84;

export type Phase = 'charge' | 'throw' | 'clash' | 'settle' | 'p1win' | 'p2win';

export interface DuelView {
  phase: Phase;
  /** 相位剩余比例 0..1（倒计时环 + **手的动画时钟**）。 */
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

/** 局已结束（胜/负）——终局态的屏跟对局中不是同一屏，别让对局件继续说话。 */
const isOver = (p: Phase): boolean => p === 'p1win' || p === 'p2win';

const PHASE_CN: Record<Phase, string> = {
  charge: '蓄力', throw: '出招', clash: '对决', settle: '结算', p1win: '你赢了', p2win: '你输了',
};
/** 每个时区一句「现在该干嘛」——七问第 6 问：第一次打开的人得知道这些键干嘛。 */
const PHASE_HINT: Record<Phase, string> = {
  charge: '点一只手蓄力 · 对手看得见你存在哪只手上',
  throw: '出一只手 · 不必是蓄过的那只',
  clash: '亮拳',
  settle: '出过的手清零 · 没出的原样保留',
  p1win: '', p2win: '',
};

/** 谁克谁（屏上给提示用·与判定表同源的静态常识，不参与判定）。 */
const BEATS: Record<Hand, Hand> = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

// ── 手的动画（**用相位时钟算出来的变换**·不是 CSS 关键帧）──────────────────
//
// 为什么不用 `layout.anim` 的闭集预设：本作的三段动作（伸入 / 摇拳 / 出招）**必须与相位时长严丝合缝**——
// 摇拳只能发生在 T2 那 3 秒里、摇完正好到出招。CSS 关键帧跑的是**墙钟**，和引擎的相位计时器
// 各走各的、必然漂；而且闭集里 `float` 只有上下位移、`spin` 是整圈自转，**没有**「旋转 + 放缩的循环摆动」
// （缺口已报 `REQ-108-UI-02`）。
// 这里换一条路：**从 `phaseLeft` 这个世界时钟推出每一帧的位移/角度/缩放**，填进 `layout` 的标量。
// 仍是纯数据（闭集字段·无自由 CSS），且动作与相位天然同步；`mountUI` 的最小 diff 只重渲这两个手节点。
// 量化（`q`）是为了压 DOM 打补丁次数：值没变的帧根本不进 diff。
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (t: number): number => 1 - (1 - t) ** 3;
const q = (v: number, step: number): number => Math.round(v / step) * step;

/** 一只手这一帧的姿态。`dx` = **朝中线为正**（两侧对称·各自取号）。 */
interface HandMotion { dx: number; dy: number; rot: number; scale: number }

function handMotion(view: DuelView): HandMotion {
  const p = 1 - view.phaseLeft;   // 本相位已走过的比例 0..1
  switch (view.phase) {
    case 'charge': {
      // ① 伸入：前 18%（约 0.55 秒）从画外一路推进到位，三次方缓出 → 有惯性、不是平移滑块。
      const e = easeOut(clamp01(p / 0.18));
      return { dx: q((e - 1) * 440, 4), dy: 0, rot: 0, scale: 1 };
    }
    case 'throw': {
      // ② 摇拳：现实里「一、二、三」那三下——上下位移 + 旋转 + 放缩**同相**，
      //    最后 25% 收住不摇（蓄势待发的那一顿），玩家据此知道「要出了」。
      const beat = clamp01(p / 0.75);
      const w = Math.sin(beat * Math.PI * 6);        // 3 个整周期 = 三下
      return { dx: 0, dy: q(-Math.abs(w) * 26, 2), rot: q(w * 8, 1), scale: 1 + q(Math.abs(w) * 0.05, 0.01) };
    }
    case 'clash':
    case 'settle': {
      // ③ 出招：手型换成实际那一招（见 `gestureOf`），同时朝中线推一记 + 微涨。
      const e = easeOut(clamp01(p / (view.phase === 'clash' ? 0.22 : 1)));
      return { dx: q(e * 40, 4), dy: 0, rot: 0, scale: 1 + q(e * 0.07, 0.01) };
    }
    default:
      return { dx: 0, dy: 0, rot: 0, scale: 1 };
  }
}

/** 这一帧该显示哪个手型：亮拳后 = 真出的那只；否则 = **待机握拳**（owner：未出招时握拳待机即可）。 */
const gestureOf = (view: DuelView, side: Side): Hand => view.shown?.[side] || 'rock';

/**
 * 一只手（**全屏最大的元素**）。
 * 右手不另画美术：`rotateY:180` 就地镜像（省一半资产·且两侧姿态天然对称）。
 * `allowOverlap` = 意图叠层：手是压在 HUD 之上的舞台主体，包围盒与四角 HUD 相交是构图本意不是 bug。
 */
function handNode(view: DuelView, side: Side): LayoutNode {
  const m = handMotion(view);
  const inward = side === 'p1' ? 1 : -1;
  return {
    type: 'Image', id: `hand-${side}`,
    props: { src: handArt(gestureOf(view, side), side), alt: side === 'p1' ? '你的手' : '对手的手', fit: 'contain' },
    layout: {
      x: HAND_HOME_X[side] + m.dx * inward,
      y: HAND_Y + m.dy,
      width: HAND_W, height: HAND_H,
      // 镜像后 rotate 仍按屏幕方向算 → 右手取反，两只手才是**镜像对称**地摇（同向摇会像在跳同一支舞）。
      rotate: m.rot * inward, scale: m.scale,
      ...(side === 'p2' ? { rotateY: 180 } : {}),
      allowOverlap: true,
    },
  };
}

/**
 * 手底下的名牌（第 8 问「这是谁的」的第三重冗余）。
 * 我这张同时兼**出招确认**：点完到揭晓之间有 2 秒空窗，玩家得知道自己提交了什么（第 2 问）。
 */
function handTag(view: DuelView, side: Side): LayoutNode {
  const mine = side === 'p1';
  const sub = view.submitted;
  const text = mine
    ? (sub ? `已出 ${HAND_ICON[sub]} ${HAND_CN[sub]}` : view.phase === 'throw' ? '未出招 · 顺延上一手' : '你')
    : '对手';
  return {
    type: 'Panel', id: `tag-${side}`,
    props: { bg: mine ? 'gold-sheen' : 'blood', shape: 'pill', edge: (mine ? 'gold' : 'danger') as 'gold' | 'danger' },
    layout: {
      // 钉在各自那只掌的**正下方**（掌心 x 中点 ±60）——名牌离手越近，归属越不用想。
      x: mine ? 365 : 795, y: 484, width: 120, height: 30,
      direction: 'row', align: 'center', justify: 'center', padding: 2,
    },
    children: [{
      type: 'Label', id: `tag-${side}-t`,
      props: { text, size: 'sm', color: mine ? 'ink' : 'text', bold: true },
    }],
  };
}

/**
 * 一条蓄力槽【R-108-03】。`big` = 对手那三条（HUD 里最重的元素）。
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
        layout: { width: big ? 172 : 132, height: big ? 16 : 10 },
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
        ? [{ type: 'Badge', id: `cb-${side}-${h}-x`, props: { text: '满', tone: 'warn' } } as LayoutNode]
        : []),
    ],
  };
}

/** 右上：对手蓄力槽（**HUD 最重的一块**·它就是玩家全程要读的那份情报）。 */
function foeSlots(view: DuelView): LayoutNode {
  const maxCharge = Math.max(...HANDS.map((h) => view.charge.p2[h]));
  return {
    type: 'Panel', id: 'foe-slots',
    props: {
      bg: view.smoke.hidden ? 'ink-deep' : 'blood', glass: true,
      edge: (maxCharge >= 2 ? 'danger' : 'foe') as 'danger' | 'foe',
    },
    layout: { x: 944, y: 72, width: 320, height: 160, direction: 'column', gap: 6, padding: 12 },
    children: [
      {
        type: 'Label', id: 'foe-slots-t',
        props: { text: '对手在攒的力', size: 'sm', color: 'text', bold: true },
      },
      ...HANDS.map((h) => chargeBar('p2', h, view, true)),
    ],
  };
}

/** 左下：我方蓄力槽（次级·比对手那三条轻一档，层级不能反）。 */
function selfSlots(view: DuelView): LayoutNode {
  return {
    type: 'Panel', id: 'self-slots', props: { bg: 'steel', glass: true, edge: 'gold' },
    layout: { x: 12, y: 452, width: 272, height: 150, direction: 'column', gap: 6, padding: 12 },
    children: [
      {
        type: 'Label', id: 'self-slots-t',
        props: { text: view.smoke.hidden ? '你的力 · 💨 已遮蔽' : '你攒的力 · 对手看得见', size: 'sm', color: 'gold', bold: true },
      },
      ...HANDS.map((h) => chargeBar('p1', h, view, false)),
    ],
  };
}

/** 一侧的顶栏身份块（名 + 血条 + 大数字）。左恒为你、右恒为对手，与手的左右严丝合缝。 */
function idBar(view: DuelView, side: Side): LayoutNode {
  const mine = side === 'p1';
  const bar: LayoutNode = {
    type: 'ProgressBar', id: `side-${side}-hp`,
    props: { value: view.hp[side], max: HP_MAX, tone: view.hp[side] <= 30 ? 'danger' : 'ok' },
    layout: { width: 150, height: 14 },
  };
  const num: LayoutNode = {
    type: 'Label', id: `side-${side}-hpv`,
    props: { text: `${view.hp[side]}`, font: 'impact', size: 'xl', color: view.hp[side] <= 30 ? 'danger' : 'text', bold: true },
  };
  const name: LayoutNode = {
    type: 'Label', id: `side-${side}-n`,
    props: { text: mine ? '你' : '对手', font: 'cnbrush', size: 'lg', color: mine ? 'gold' : 'danger', bold: true },
  };
  return {
    type: 'Panel', id: `side-${side}`, props: { bare: true },
    layout: {
      x: mine ? 12 : 948, y: 12, width: 320, height: 56,
      direction: 'row', align: 'center', justify: mine ? 'start' : 'end', gap: 10, padding: 4,
    },
    children: mine ? [name, bar, num] : [num, bar, name],
  };
}

/** 顶栏中央：回合数 + 倒计时环 + 相位名。 */
function phaseBar(view: DuelView): LayoutNode {
  return {
    type: 'Panel', id: 'status', props: { bare: true },
    layout: {
      x: 470, y: 8, width: 340, height: 64,
      direction: 'row', align: 'center', justify: 'center', gap: 12,
    },
    children: [
      // 回合数用 Label 不用 Badge：Badge 的闭集 tone 只有 ok/warn/dim，dim 在暗底实测 2.93
      // 真读不清（ui-audit 抓到）。而回合数是七问第 5 问要的信息，不该是灰的。
      { type: 'Label', id: 'round-b', props: { text: `第 ${view.round} 回合`, size: 'sm', color: 'text', bold: true } },
      {
        type: 'ProgressBar', id: 'phase-ring',
        // 最后三分之一转红：让「还剩多久必须出手」看得见（七问第 5 问）。
        props: { value: Math.round(view.phaseLeft * 100), max: 100, shape: 'ring', size: 46, tone: view.phaseLeft < 0.34 ? 'danger' : 'gold' },
      },
      { type: 'Label', id: 'phase-t', props: { text: PHASE_CN[view.phase], font: 'cnbrush', size: 'xl', color: 'gold', bold: true, glow: true } },
    ],
  };
}

/**
 * 顶栏下的一行读牌提示（七问第 1/6 问的落点）。
 * 横版之后这里不再需要「读牌区」那个大方块——对手的三条槽已经在右上占了重量，
 * 这一行只补最后一步**结论**：他攒满的是哪只、挨一下掉多少、该用什么克。
 */
function readLine(view: DuelView): LayoutNode {
  let top: Hand = 'rock';
  for (const h of HANDS) if (view.charge.p2[h] > view.charge.p2[top]) top = h;
  const lv = view.charge.p2[top];
  const text = isOver(view.phase) ? ''
    : lv >= CHARGE_CAP ? `⚠ 他攒满了 ${HAND_ICON[top]}${HAND_CN[top]} · 挨一下掉 ${DMG_AT(lv)} · 用 ${HAND_CN[BEATS[top]]} 克它`
      : lv >= 1 ? `他在攒 ${HAND_ICON[top]}${HAND_CN[top]}（${lv}/${CHARGE_CAP}）· 挨一下掉 ${DMG_AT(lv)} · 用 ${HAND_CN[BEATS[top]]} 克它`
        : PHASE_HINT[view.phase];
  return {
    type: 'Panel', id: 'read', props: { bare: true },
    layout: { x: 380, y: 76, width: 520, height: 28, direction: 'row', align: 'center', justify: 'center' },
    children: [{
      type: 'Label', id: 'read-t',
      props: { text: text || ' ', size: 'sm', color: lv >= CHARGE_CAP ? 'danger' : lv >= 1 ? 'warn' : 'sub', bold: lv >= 1 },
    }],
  };
}

/** 中线缝的上端：**规则石板**【R-108-40】常驻。将来被碎片/遗物当场改写，重刻的表演也在这块。 */
function ruleSlab(): LayoutNode {
  return {
    type: 'Panel', id: 'slab', props: { shape: 'shield', edge: 'gold', bg: 'ember' },
    layout: {
      x: SLAB_X, y: SLAB_Y, width: SLAB_W, height: SLAB_H,
      direction: 'column', align: 'center', justify: 'center', gap: 2, padding: 6,
    },
    children: [
      { type: 'Label', id: 'slab-t', props: { text: '拳律', font: 'cnbrush', size: 'lg', color: 'gold', bold: true, stroke: true, glow: true } },
      { type: 'Label', id: 'slab-r', props: { text: '石 › 剪 › 布 › 石', size: 'xs', color: 'text' } },
    ],
  };
}

/**
 * 中线缝的下端：**结果横幅**（七问第 3/4 问）——一眼看出赢没赢、代价多少。
 * 位置刻意压在两掌相触点的正下方：亮拳那一刻眼睛就在那儿，不必再找。
 */
function outcomeBanner(view: DuelView): LayoutNode | null {
  const o = view.outcome;
  if (!o || (view.phase !== 'clash' && view.phase !== 'settle')) return null;
  const box = {
    x: LANE_X, y: LANE_Y, width: LANE_W, height: LANE_H,
    direction: 'row' as const, align: 'center' as const, justify: 'center' as const, gap: 14, padding: 6,
  };
  if (o.winner === 'tie') {
    return {
      type: 'Panel', id: 'lane', props: { bg: 'sunken', edge: 'gold' }, layout: box,
      children: [{ type: 'Label', id: 'lane-t', props: { text: '平局 · 双方都不掉血', font: 'cnbrush', size: 'lg', color: 'text', bold: true } }],
    };
  }
  const iWon = o.winner === 'p1';
  const heavy = o.damage >= 30;          // 满蓄档 → 字更大（视觉重量跟数值挂钩）
  return {
    type: 'Panel', id: 'lane', props: { bg: iWon ? 'gold-sheen' : 'blood', edge: (iWon ? 'gold' : 'danger') as 'gold' | 'danger' }, layout: box,
    children: [
      { type: 'Label', id: 'lane-t', props: { text: iWon ? '你赢了这回合' : '你被打中', font: 'cnbrush', size: heavy ? 'xl' : 'lg', color: iWon ? 'ink' : 'text', bold: true } },
      // **ASCII 连字符，不是全角减号 U+2212**：`impact`(Anton) 没有 U+2212 的字形，
      // 渲出来是个黑豆腐块——而这是全屏最要紧的一个数字（真渲染目击到才发现·字体缺字形不报错）。
      { type: 'Label', id: 'lane-d', props: { text: `-${o.damage}`, font: 'impact', size: 'xl', color: iWon ? 'ink' : 'danger', bold: true } },
    ],
  };
}

/**
 * 底中：三招键。**信号名取自动作词表**【R-108-70】。
 * 蓄力键在槽满时禁用【R-108-10】：不可点、不产生信号。
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
      layout: { width: 152, height: 96, press3d: true },
    };
  });
  return {
    type: 'Panel', id: 'keys', props: { bare: true },
    layout: { x: 394, y: 610, width: 492, height: 96, direction: 'row', justify: 'between', align: 'center' },
    children: keys,
  };
}

/** 右下：烟雾键【R-108-20】。 */
function smokeKey(view: DuelView): LayoutNode {
  const usable = view.smoke.uses > 0 && !view.smoke.hidden;
  return {
    type: 'Button', id: 'key-smoke',
    props: {
      label: `💨 烟雾 ×${view.smoke.uses}`,
      sub: view.smoke.hidden ? '生效中 · 对手看不见你的槽' : '遮住自己三条槽 2 回合',
      kind: 'ghost', disabled: !usable,
      ...(usable ? { action: ACT.smoke } : {}),
    },
    layout: { x: 940, y: 626, width: 300, height: 60 },
  };
}

/**
 * 终局面板（覆盖在中线上）。第一版**根本没有**——赢了只是相位名换成「你赢了」，
 * 三个对局键还亮着、点了没用，玩家**卡在死路上没有出口**（真渲染目击 + `ui-inventory` 点名 `duel.next` 够不着）。
 */
function endPanel(view: DuelView): LayoutNode {
  const won = view.phase === 'p1win';
  return {
    type: 'Panel', id: 'end', props: { bg: won ? 'gold-sheen' : 'blood', edge: (won ? 'gold' : 'danger') as 'gold' | 'danger' },
    layout: {
      x: 420, y: 240, width: 440, height: 260, allowOverlap: true,
      direction: 'column', align: 'center', justify: 'center', gap: 12, padding: 18,
    },
    children: [
      { type: 'Label', id: 'end-t', props: { text: won ? '你赢了' : '你输了', font: 'cnbrush', size: 'xl', color: won ? 'ink' : 'text', bold: true, stroke: true } },
      { type: 'Label', id: 'end-s', props: { text: `打了 ${view.round} 回合 · 剩 ${view.hp.p1} 血`, size: 'md', color: won ? 'ink' : 'text' } },
      {
        type: 'Button', id: 'key-next',
        props: { label: '再来一局', kind: 'hero', action: ACT.next },
        layout: { width: 220, height: 56, press3d: true },
      },
    ],
  };
}

/**
 * 对局屏（S-03·横版）。
 * 层序（后画的压前面）：舞台底 → 四角 HUD → **两只手（主体）** → 名牌 → 中线槽 → 终局覆盖层。
 */
export function buildDuelScreen(view: DuelView): LayoutNode {
  const over = isOver(view.phase);
  const banner = outcomeBanner(view);
  return {
    type: 'Panel', id: 'duel-screen', props: { vignette: true },
    layout: { width: STAGE_W, height: STAGE_H, padding: 0 },
    children: [
      idBar(view, 'p1'),
      idBar(view, 'p2'),
      phaseBar(view),
      readLine(view),
      foeSlots(view),
      selfSlots(view),
      ruleSlab(),
      // 手在 HUD 之后画 = 压在 HUD 之上（舞台主体·意图叠层）。
      handNode(view, 'p1'),
      handNode(view, 'p2'),
      handTag(view, 'p1'),
      handTag(view, 'p2'),
      ...(banner ? [banner] : []),
      ...(over ? [endPanel(view)] : [actionRow(view), smokeKey(view)]),
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

export { SIDES, HP_RES, handMotion };
