// game108 对局屏 —— **设计定稿 1:1 复刻**（纯 LayoutNode 数据·UI 铁律：禁手写 React/自由 DOM）。
//
// 稿子：`games/game108/design_handoff_rule_of_three_battle/`
//   · README.md = 逐区规格（颜色/字号/圆角/描边/投影/动画节拍）
//   · design/battle-screen.dc.html = 每个盒子的绝对 px
//   · screens/*.png = 五个状态的成品图（视觉基准）
// 复刻口径（CLAUDE.md「有 .dc.html 设计稿在档 = 1:1 复刻基准」）：
//   **坐标与颜色一律取自 `design-tokens.ts`**（那份是逐字抄来的），本文件只负责「用闭集控件把它摆出来」。
//   差异逐条记在 `docs/design/game108/self-check/S5-design-alignment.md`，不默降。
//
// 稿子自己也写明了：「this game's UI is a closed-set, data-driven widget system … Everything in this
// design was drawn to map onto that widget set」——所以这里不是"移植 HTML"，是**照着规格用控件搭**。
//
// 三处「稿子是自由 CSS、我们得换个法子做到同一个像素」的地方，都在原处写了为什么：
//   ① 平移投影 / 逐件渐变 / 顶部色条 → 烤进 `Panel.skin` 贴图（`plate-art.ts`）
//   ② 倒计时环的 conic + 血条的渐变填充 → 生成 SVG（`plate-art.ts`）
//   ③ 手的三段动作 → 由相位时钟推出 `layout` 标量（见 `handMotion`）
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';

import {
  HANDS, HAND_CN, CHARGE_CAP, HP_MAX, DMG_BASE, DMG_STEP, ACT, SIDES,
  HP_RES, SMOKE_USES, UI_ACT, type Hand, type Side,
} from './theme.js';
import { C, S, F, L, R, B, SH, CANVAS, dmgFontSize } from './design-tokens.js';
import { plate, ring, hpBar, scene } from './plate-art.js';
import { handArt, armArt, HAND_BOX_SCALE, HAND_BOX_SHIFT } from './hand-art.js';
import { HAND_ICON_SRC } from './hand-icons.js';
import { t, CHAR_W, type Lang } from './strings.js';
import { DEFAULT_CARD } from './card-character.js';

/** 这只手现在打多少【R-108-13】。 */
const DMG_AT = (charge: number): number => DMG_BASE + charge * DMG_STEP;
/** 手型显示名（**走字典**·稿子的键面写「石 · 石头」，槽里写「石 石头」）。 */
const handShort = (lang: Lang, h: Hand): string => t(lang, `hand.${h}.short` as const);
const handFull = (lang: Lang, h: Hand): string => t(lang, `hand.${h}.full` as const);
const CARD_COLOR: Record<Hand, string> = { rock: C.cardRock, paper: C.cardPaper, scissors: C.cardScissors };
/** 谁克谁（屏上提示与判定结论用·与判定表同源的静态常识，不参与判定）。 */
const BEATS: Record<Hand, Hand> = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

export type Phase = 'charge' | 'throw' | 'clash' | 'settle' | 'p1win' | 'p2win';

export interface DuelView {
  phase: Phase;
  /** 相位剩余比例 0..1（倒计时环 + **手的动画时钟**）。 */
  phaseLeft: number;
  /** 相位剩余秒数（稿子的环心读数）。 */
  phaseSec: number;
  round: number;
  hp: Record<Side, number>;
  charge: Record<Side, Record<Hand, number>>;
  /** 本回合双方亮出的手（T3/T4 才有值）。 */
  shown?: Record<Side, Hand | ''>;
  /** 我这回合提交了哪只手（稿子的「已提交」态·出招到揭晓那两秒空窗靠它撑）。 */
  submitted?: Hand | '';
  outcome?: { winner: Side | 'tie'; damage: number };
  smoke: { uses: number; hidden: boolean };
  /** 对手名（稿子样例是「赌徒」）。**约会向定位下这是传入卡片角色的名字**，不是内置对手名。 */
  foeName: string;
  /**
   * 双方画像（已解析图 URL·缺省无 = 退化成名字首字，不留空白）。
   * owner 2026-08-07 定方向：这游戏的对手 = **外部传入的卡片角色（约会对象）**，
   * 所以稿子里那两枚"肤色小样"的位置应该是**两张画像**——我一张、对方一张。
   * 卡片契约（画像/名字/性格字段的定名）尚未到手 → 这里先把槽开出来并接线，
   * 有图就显示、没图就显示名字首字（同 `portrait` 控件的分级降级口径）。
   */
  portrait?: Partial<Record<Side, string>>;
  /** 界面语言（owner 2026-08-07：中英双版·默认中文）。 */
  lang: Lang;
}

const isOver = (p: Phase): boolean => p === 'p1win' || p === 'p2win';
const phaseName = (lang: Lang, p: Phase): string => t(lang, `phase.${p}` as const);

// ── 手的动作（稿子 §Animations·**由相位时钟推出**，不走 CSS 关键帧）──────────
//
// 稿子给的是 CSS 关键帧：`rt3-shake .6s infinite`（3 拍 × 200ms）、`rt3-push .28s`。
// 我们不能照搬——CSS 关键帧跑**墙钟**，与引擎的相位计时器各走各的，必然漂：
// 摇拳该在 T2 那 3 秒里摇完、摇完正好出招，漂了就对不上。而闭集里也确实**没有**
// 「循环的旋转 + 放缩摆动」（缺口 `REQ-108-UI-02` 已开单）。
// 于是换一条路：把稿子那条曲线**逐帧算出来**填进 `layout` 的标量字段。
// 关键帧值一个没改（−34/+6/−22 位移 · −9/+4/−6/+3 度 · 1/1.06/.97/1.04 缩放），
// 只是把「谁来推进时间」从浏览器换成了世界时钟——动作与相位天生同步。
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOutBack = (t: number): number => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;   // ≈cubic-bezier(.2,1.4,.4,1)
const q = (v: number, step: number): number => Math.round(v / step) * step;

/** 稿子 `@keyframes rt3-shake` 的四个关键帧（0 / 25 / 50 / 75 / 100%）。 */
const SHAKE = [
  { y: 0, r: -9, s: 1 },
  { y: -34, r: 4, s: 1.06 },
  { y: 6, r: -6, s: 0.97 },
  { y: -22, r: 3, s: 1.04 },
  { y: 0, r: -9, s: 1 },
] as const;
const SHAKE_MS = 600;   // 稿子：3 拍 × 200ms = 600ms 一轮，5 轮填满 3 秒

interface HandMotion { dx: number; dy: number; rot: number; scale: number }

/** 按稿子的关键帧表逐帧插值（`ease-in-out`·段内缓动，段间连续）。 */
function shakeAt(ms: number): HandMotion {
  const t = (ms % SHAKE_MS) / SHAKE_MS;
  const seg = Math.min(3, Math.floor(t * 4));
  const local = easeInOut(t * 4 - seg);
  const a = SHAKE[seg]!, b = SHAKE[seg + 1]!;
  const mix = (u: number, v: number): number => u + (v - u) * local;
  return { dx: 0, dy: q(mix(a.y, b.y), 1), rot: q(mix(a.r, b.r), 0.5), scale: 1 + q(mix(a.s, b.s) - 1, 0.005) };
}

function handMotion(view: DuelView): HandMotion {
  const p = 1 - view.phaseLeft;   // 本相位已走过的比例 0..1
  switch (view.phase) {
    case 'charge': {
      // 伸入：从画外沿水平方向推进到位（稿子 §Animations 1：不是淡入、不是弹出）。
      const e = easeOutBack(clamp01(p / 0.2));
      return { dx: q((e - 1) * 420, 4), dy: 0, rot: 0, scale: 1 };
    }
    case 'throw':
      return shakeAt(p * 3000);                       // T2 = 3 秒，正好 5 轮
    case 'clash':
    case 'settle': {
      // 出招：手型换成实际那一招，同时朝中线推 26px（稿子 `rt3-push`）。
      const e = easeOutBack(clamp01(p / (view.phase === 'clash' ? 0.14 : 1)));
      return { dx: q(e * 26, 2), dy: 0, rot: 0, scale: 1 };
    }
    default:
      return { dx: 0, dy: 0, rot: 0, scale: 1 };
  }
}

/** 这一帧显示哪个手型：亮拳后 = 真出的那只；否则 = 待机握拳（稿子 `key(mode)`：idle/shake → rock）。 */
const gestureOf = (view: DuelView, side: Side): Hand => view.shown?.[side] || 'rock';

// ── 舞台与手 ──────────────────────────────────────────────────────────
const SCENE_SRC = scene(CANVAS.w, CANVAS.h, C);
/** 手方框按 hand-art 的 PAD 放大并反向偏移——画面缩放与落点与稿子分毫不变（见 hand-art 注释①）。 */
const HAND_BOX = Math.round(L.handBox.size * HAND_BOX_SCALE);
const HAND_SHIFT = Math.round(L.handBox.size * HAND_BOX_SHIFT);

function stageBg(): LayoutNode {
  return {
    type: 'Image', id: 'scene',
    props: { src: SCENE_SRC, alt: '', fit: 'cover' },
    layout: { x: 0, y: 0, width: CANVAS.w, height: CANVAS.h, allowOverlap: true },
  };
}

/** 前臂：贴屏幕边缘的独立件——**手会摇、前臂不摇**，所以不能和手画在一起（稿子明写）。 */
function armNode(side: Side): LayoutNode {
  return {
    type: 'Image', id: `arm-${side}`,
    props: { src: armArt(side, L.arm.w, L.arm.h), alt: '', fit: 'fill' },
    layout: {
      x: side === 'p1' ? 0 : CANVAS.w - L.arm.w, y: L.arm.y,
      width: L.arm.w, height: L.arm.h, allowOverlap: true,
    },
  };
}

/** 一只手（全屏主体）。右手不另出资产：`rotateY:180` 就地镜像（= 稿子的 `scaleX(-1)`）。 */
function handNode(view: DuelView, side: Side): LayoutNode {
  const m = handMotion(view);
  const inward = side === 'p1' ? 1 : -1;
  const homeX = side === 'p1' ? L.handBox.off : CANVAS.w - L.handBox.off - L.handBox.size;
  return {
    type: 'Image', id: `hand-${side}`,
    props: { src: handArt(gestureOf(view, side), side), alt: side === 'p1' ? '你的手' : '对手的手', fit: 'contain' },
    layout: {
      x: homeX - HAND_SHIFT + m.dx * inward,
      y: L.handBox.top - HAND_SHIFT + m.dy,
      width: HAND_BOX, height: HAND_BOX,
      // 稿子右手跑的是 `rt3-shakeR`＝同一条曲线**旋转取反**；镜像后 rotate 仍按屏幕方向算，故这里取反。
      rotate: m.rot * inward, scale: m.scale,
      ...(side === 'p2' ? { rotateY: 180 } : {}),
      allowOverlap: true,
    },
  };
}

// ── 顶栏 ──────────────────────────────────────────────────────────────
/** 身份牌（我方青绿 / 对手绯红·各自带一枚肤色小样，和手的色系对上）。 */
function idPlate(view: DuelView, side: Side): LayoutNode {
  const mine = side === 'p1';
  const name = mine ? t(view.lang, 'side.you') : view.foeName;
  const w = 32 + name.length * S.plate + 12;
  const h = 52;
  // 画像位（稿子这里画的是一枚 34×34「肤色小样」，作用是让顶栏身份与那只手的色系对上）。
  // 约会向定位下它升格成**画像槽**：有卡片图就贴图，没有就退化成名字首字（绝不空着）——
  // 底框仍是稿子那块小样（墨边 + radius 8 + 肤色底），所以没图时观感与稿子一致。
  const art = view.portrait?.[side];
  const swatch: LayoutNode = {
    type: 'Panel', id: `side-${side}-sw`,
    props: { skin: plate({ w: 34, h: 34, fill: mine ? C.youSwatch : C.oppSwatch, border: 3, radius: R.swatch }) },
    layout: { width: 34, height: 34, direction: 'row', align: 'center', justify: 'center', padding: 3 },
    children: [art
      ? { type: 'Image', id: `side-${side}-art`, props: { src: art, alt: name, fit: 'cover', radius: R.swatch - 3 }, layout: { width: 28, height: 28 } }
      : { type: 'Label', id: `side-${side}-art`, props: { text: name.slice(0, 1), size: 19, font: F.cjk, color: 'ink' } }],
  };
  const plateNode: LayoutNode = {
    type: 'Panel', id: `side-${side}-n`,
    props: {
      skin: plate({
        w, h, fill: mine ? C.you : C.opp, border: B.plate, radius: 10,
        shadow: SH.plate, shadowColor: mine ? C.youDkShadow : C.oppDkShadow,
      }),
    },
    layout: { width: w, height: h, direction: 'row', align: 'center', justify: 'center', padding: 0 },
    children: [{
      type: 'Label', id: `side-${side}-nt`,
      props: { text: name, size: S.plate, font: F.cjk, color: 'ink' },
    }],
  };
  return {
    type: 'Panel', id: `side-${side}`, props: { bare: true },
    layout: {
      x: mine ? 18 : CANVAS.w - 18 - L.idPlate.w, y: 22, width: L.idPlate.w,
      direction: 'row', align: 'center', justify: mine ? 'start' : 'end', gap: 10,
    },
    children: mine ? [plateNode, swatch] : [swatch, plateNode],
  };
}

/** 血量块（条 + 大数字 + `/100`）。对手那条**从外侧掉**（稿子明写）。 */
function hpBlock(view: DuelView, side: Side): LayoutNode {
  const mine = side === 'p1';
  const hp = view.hp[side];
  const bar: LayoutNode = {
    type: 'Image', id: `side-${side}-hp`,
    props: {
      src: hpBar(L.hpBlock.w, L.hpTrack.h, (hp / HP_MAX) * 100,
        mine ? ['#5fe8cd', '#1f9c89'] : ['#ff9a8a', '#d0342b'], C.hpTrack, C.ink, mine ? 'left' : 'right'),
      alt: '', fit: 'fill',
    },
    layout: { width: L.hpBlock.w, height: L.hpTrack.h },
  };
  const num: LayoutNode = {
    type: 'Label', id: `side-${side}-hpv`,
    props: { text: `${hp}`, size: S.hp, font: F.num, bold: true, color: mine ? 'jade' : 'foe' },
    // 稿子给数字压了 `line-height:.9`；我们没有行高字段 → 用定高盒把它收住，
    // 否则默认 1.4 倍行高把整块顶出 97px 的顶栏（真渲染目击：数字掉到天空里了）。
    layout: { height: 38 },
  };
  const slash: LayoutNode = {
    type: 'Label', id: `side-${side}-hps`, props: { text: '/100', size: S.hpSlash, font: F.num, color: 'sub' },
  };
  return {
    type: 'Panel', id: `hp-${side}`, props: { bare: true },
    layout: {
      x: mine ? 262 : 1368, y: 14, width: L.hpBlock.w, height: 66,
      direction: 'column', gap: 5, align: mine ? 'start' : 'end',
    },
    children: [bar, {
      type: 'Panel', id: `hp-${side}-r`, props: { bare: true },
      layout: { direction: 'row', align: 'end', gap: 6 },
      children: mine ? [num, slash] : [slash, num],
    }],
  };
}

/** 顶栏中央：回合数 + 倒计时环 + 相位牌。环在最后三分之一整体转红（稿子的硬要求）。 */
function phaseBar(view: DuelView): LayoutNode {
  const pct = Math.round(view.phaseLeft * 100);
  const hot = pct < 34;
  const accent = hot ? C.danger : C.gold;
  const chipW = 26 * 2 + phaseName(view.lang, view.phase).length * S.phaseChip * (view.lang === 'en' ? 0.62 : 1) + 10;
  return {
    type: 'Panel', id: 'status', props: { bare: true },
    layout: { x: 566, y: 10, width: 788, height: 78, direction: 'row', align: 'center', justify: 'center', gap: 18 },
    children: [
      { type: 'Label', id: 'round-b', props: { text: t(view.lang, 'top.round', { n: view.round }), size: S.round, font: F.cjk, color: 'text' } },
      {
        type: 'Panel', id: 'phase-ring',
        props: { skin: ring(L.ring, pct, accent, C.ringDisc, L.ringDisc) },
        layout: { width: L.ring, height: L.ring, direction: 'column', align: 'center', justify: 'center', gap: 0, padding: 0 },
        children: [
          { type: 'Label', id: 'phase-sec', props: { text: view.phaseSec.toFixed(1), size: S.timer, font: F.num, bold: true, color: hot ? 'danger' : 'text' } },
          { type: 'Label', id: 'phase-secu', props: { text: t(view.lang, 'top.sec'), size: S.ringSec, font: F.num, color: 'sub' } },
        ],
      },
      {
        type: 'Panel', id: 'phase-chip',
        props: { skin: plate({ w: chipW, h: 62, fill: accent, border: 5, radius: R.chip, shadow: SH.chip }) },
        layout: { width: chipW, height: 62, direction: 'row', align: 'center', justify: 'center', padding: 0 },
        children: [{ type: 'Label', id: 'phase-t', props: { text: phaseName(view.lang, view.phase), size: S.phaseChip, font: F.cjk, color: 'ink' } }],
      },
    ],
  };
}

function topBar(view: DuelView): LayoutNode[] {
  return [
    {
      type: 'Image', id: 'topbar-bg',
      props: { src: plate({ w: L.topBar.w, h: L.topBar.h, fill: ['rgba(24,17,12,.86)', 'rgba(24,17,12,.62)'], radius: 0 }), alt: '', fit: 'fill' },
      layout: { x: 0, y: 0, width: L.topBar.w, height: L.topBar.h, allowOverlap: true },
    },
    {
      type: 'Image', id: 'topbar-edge',
      props: { src: plate({ w: L.topBar.w, h: 4, fill: C.ink, radius: 0 }), alt: '', fit: 'fill' },
      layout: { x: 0, y: L.topBar.h - 4, width: L.topBar.w, height: 4, allowOverlap: true },
    },
    idPlate(view, 'p1'), hpBlock(view, 'p1'), phaseBar(view), hpBlock(view, 'p2'), idPlate(view, 'p2'),
    {
      type: 'Panel', id: 'gear',
      props: { skin: plate({ w: L.gear.size, h: L.gear.size, fill: C.cream, border: 4, radius: 999, shadow: 4, shadowColor: 'rgba(0,0,0,.3)' }) },
      layout: {
        x: L.gear.x, y: L.gear.y, width: L.gear.size, height: L.gear.size,
        direction: 'row', align: 'center', justify: 'center', padding: 0, allowOverlap: true,
      },
      children: [{ type: 'Label', id: 'gear-t', props: { text: '⚙', size: S.gear, color: 'ink' } }],
    },
    // 语言胶囊（**稿子里没有**·D8 偏差在案）：owner 2026-08-07 要中英双版，
    // 而这一屏没有菜单可放设置，齿轮又是稿子画的装饰件（点了没定义）。
    // 折中：在齿轮正下方挂一枚**自描述**的小胶囊，写着「切过去会变成哪种语言」——
    // 藏进齿轮里点不到、也说不清，比多一个件更糟。真设置面板随「两种模式」那一版做。
    {
      type: 'Panel', id: 'key-lang',
      props: {
        skin: plate({ w: 52, h: 34, fill: C.cream, border: 3, radius: R.pill, shadow: 3, shadowColor: 'rgba(0,0,0,.3)' }),
        action: UI_ACT.lang,
      },
      layout: {
        x: L.gear.x, y: L.gear.y + L.gear.size + 8, width: 52, height: 34,
        direction: 'row', align: 'center', justify: 'center', padding: 0, allowOverlap: true,
      },
      children: [{
        type: 'Label', id: 'key-lang-t',
        props: { text: view.lang === 'zh' ? 'EN' : '中', size: 17, font: F.cjk, color: 'ink' },
      }],
    },
  ];
}

// ── 右上：对手蓄力条（紧凑条·稿子 §⑥）────────────────────────────────────
// 对手条的逐段宽度（**全部算死，不靠 flex 分**）。
// 为什么不能用 `flex:1`：pip 是 `<img>`，**有固有宽度**，而 flex 项的 `min-width` 缺省是 `auto`
// ＝内容固有宽 —— 三枚 pip 的固有宽加起来超过分给它们的空间时，flex **压不下去**，
// 整排 pip 就顶着往右溢出，把右边的 `n/3` 读数压在身下（owner 2026-08-07 目击：「字和图有重叠」）。
// 我方槽那三条没出事纯属巧合：算下来固有宽恰好等于分到的宽。**换成算死的像素，两边都不再靠运气。**
const FOE_STRIP_PAD = 8, FOE_LABEL_W = 76, FOE_GAP = 9;
const FOE_CHIP_W = Math.floor((L.oppStrip.w - B.oppChip * 2 - FOE_STRIP_PAD * 2 - FOE_LABEL_W - FOE_GAP * 3) / 3);
const FOE_CHIP_PAD = 9, FOE_CHIP_GAP = 7, FOE_ICON_W = 28, FOE_READ_W = 44;
const FOE_PIPS_W = FOE_CHIP_W - B.oppChip * 2 - FOE_CHIP_PAD * 2 - FOE_ICON_W - FOE_CHIP_GAP * 2 - FOE_READ_W;
const FOE_PIP_W = Math.floor((FOE_PIPS_W - 4 * 2) / 3);
/** 我方槽内那三条（槽宽 290 - 边 10 - 内距 32，三条间距 7）。 */
const MY_PIP_W = Math.floor((290 - B.card * 2 - 16 * 2 - 7 * 2) / 3);

/** 一枚 pip（我方 20px 高圆角 6 / 对手 9px 高圆角 3·蓄满转金）。 */
function pip(side: Side, h: Hand, i: number, level: number, full: boolean, mine: boolean): LayoutNode {
  const on = i <= level;
  const fill = on ? (full ? C.gold : mine ? C.you : C.opp) : 'rgba(63,43,30,.18)';
  const ph = mine ? 20 : 9;
  const pw = mine ? MY_PIP_W : FOE_PIP_W;
  return {
    type: 'Image', id: `cb-${side}-${h}-p${i}`,
    // 源宽 = 盒宽（同「生成图源尺寸必须等于盒子尺寸」那条），且**不给 flex**——宽度算死。
    props: { src: plate({ w: pw, h: ph, fill, border: mine ? 3 : 2, radius: mine ? R.myPip : R.oppPip }), alt: '', fit: 'fill' },
    layout: { width: pw, height: ph },
  };
}

function foeChip(view: DuelView, h: Hand): LayoutNode {
  const lv = view.smoke.hidden ? 0 : view.charge.p2[h];
  const full = lv >= CHARGE_CAP;
  const w = FOE_CHIP_W, hgt = 50;
  return {
    type: 'Panel', id: `cb-p2-${h}`,
    props: { skin: plate({ w, h: hgt, fill: full ? [C.goldFillA, C.goldFillB] : 'rgba(255,246,226,.94)', border: B.oppChip, radius: R.oppChip - 5 }) },
    layout: { width: w, height: hgt, direction: 'row', align: 'center', gap: FOE_CHIP_GAP, padding: FOE_CHIP_PAD },
    children: [
      { type: 'Image', id: `cb-p2-${h}-i`, props: { src: HAND_ICON_SRC[h], alt: HAND_CN[h], fit: 'contain' }, layout: { width: FOE_ICON_W, height: 34 } },
      {
        type: 'Panel', id: `cb-p2-${h}-b`, props: { bare: true },
        layout: { width: FOE_PIPS_W, direction: 'row', gap: 4, align: 'center' },
        children: [1, 2, 3].map((i) => pip('p2', h, i, lv, full, false)),
      },
      {
        // 读数右对齐（稿子：`min-width:44px; text-align:right`）——定宽盒 + `justify:'end'`。
        type: 'Panel', id: `cb-p2-${h}-vb`, props: { bare: true },
        layout: { width: FOE_READ_W, direction: 'row', align: 'center', justify: 'end' },
        children: [{
          type: 'Label', id: `cb-p2-${h}-v`,
          props: { text: `${lv}/${CHARGE_CAP}`, size: S.oppRead, font: F.num, bold: true, color: full ? 'ok' : 'ink' },
        }],
      },
    ],
  };
}

/** 威胁提示（T1/T2 才出·稿子 §⑥「Threat line」）。 */
function threatLine(view: DuelView): LayoutNode | null {
  if (view.phase !== 'charge' && view.phase !== 'throw') return null;
  let top: Hand = 'rock';
  for (const h of HANDS) if (view.charge.p2[h] > view.charge.p2[top]) top = h;
  const lv = view.smoke.hidden ? 0 : view.charge.p2[top];
  if (lv < CHARGE_CAP) return null;
  const w = 560;
  return {
    type: 'Panel', id: 'threat',
    props: { skin: plate({ w, h: 44, fill: C.opp, border: B.plate, radius: R.pill, shadow: SH.chip, shadowColor: 'rgba(0,0,0,.35)' }) },
    layout: { width: w, height: 44, direction: 'row', align: 'center', justify: 'center', gap: 8, padding: 0 },
    children: [{
      type: 'Label', id: 'threat-t',
      props: {
        size: S.threat, font: F.cjk, color: 'text',
        // 用 `{hand}` 切成三段：手型名单独上金色（稿子如此），中英两版的句子结构不同也吃得住。
        spans: (() => {
          const line = t(view.lang, 'slots.threat', { hand: '\u0000' }).split('\u0000');
          return [{ text: line[0] ?? '' }, { text: handFull(view.lang, top), color: 'gold' as const }, { text: line[1] ?? '' }];
        })(),
      },
    }],
  };
}

function foeStrip(view: DuelView): LayoutNode {
  const threat = threatLine(view);
  return {
    type: 'Panel', id: 'foe-strip', props: { bare: true },
    layout: {
      x: L.oppStrip.x, y: L.oppStrip.y, width: L.oppStrip.w,
      direction: 'column', align: 'end', gap: 7, allowOverlap: true,
    },
    children: [
      {
        type: 'Panel', id: 'foe-slots',
        props: { bg: 'rgba(24,17,12,.62)', edge: 'danger', glass: true },
        layout: { width: L.oppStrip.w, height: 70, direction: 'row', align: 'center', gap: FOE_GAP, padding: FOE_STRIP_PAD, radius: R.oppChip },
        children: [
          {
            // 稿子写死两行：对手名一行、「蓄力」一行。塞成一个 Label 会按框宽乱折（实测折成三行）。
            type: 'Panel', id: 'foe-slots-t', props: { bare: true },
            layout: { width: FOE_LABEL_W, direction: 'column', align: 'center', gap: 0 },
            children: [
              { type: 'Label', id: 'foe-slots-t1', props: { text: view.foeName, size: S.oppRead, font: F.cjk, color: 'foe' } },
              { type: 'Label', id: 'foe-slots-t2', props: { text: t(view.lang, 'slots.foe.b'), size: view.lang === 'en' ? 15 : S.oppRead, font: F.cjk, color: 'foe' } },
            ],
          },
          ...HANDS.map((h) => foeChip(view, h)),
        ],
      },
      ...(threat ? [threat] : []),
    ],
  };
}

// ── 中线区：判定表石板 + 结果横幅（稿子 §④）──────────────────────────────
function ruleSlab(lang: Lang): LayoutNode {
  const w = L.lane.w;
  const cap = t(lang, 'slab.note');
  const capW = Math.round(cap.length * S.slabCap * CHAR_W[lang] + 16);
  const pairs: Array<[Hand, Hand]> = [['rock', 'scissors'], ['scissors', 'paper'], ['paper', 'rock']];
  const rows: LayoutNode[] = pairs.map(([ha, hb], i) => ({
    type: 'Label', id: `slab-r${i}`,
    props: {
      size: S.slab, font: F.cjk, color: 'text',
      spans: [{ text: handShort(lang, ha) }, { text: ' › ', color: 'gold' as const }, { text: handShort(lang, hb) }],
    },
  }));
  return {
    type: 'Panel', id: 'lane-col', props: { bare: true },
    layout: { x: L.lane.x, y: L.slab.y, width: w, direction: 'column', align: 'center', gap: 6, allowOverlap: true },
    children: [
      {
        type: 'Panel', id: 'slab',
        props: {
          skin: plate({
            w, h: 152, fill: C.slabFace, border: 5, radius: R.chip,
            shadow: 6, shadowColor: 'rgba(0,0,0,.3)', insetTop: 'rgba(255,255,255,.22)',
          }),
        },
        layout: { width: w, height: 152, direction: 'column', align: 'center', justify: 'center', gap: 8, padding: 10 },
        children: [
          { type: 'Label', id: 'slab-h', props: { text: t(lang, 'slab.title'), size: S.slabHead, font: F.cjk, color: 'text' } },
          ...rows,
        ],
      },
      {
        type: 'Panel', id: 'slab-cap',
        // 脚注宽按「字数 × 字宽系数」估——英文一字母只有中文一字的 0.55 宽，
        // 用一个写死的宽度会一边撑破一边留白（`CHAR_W` 就是为这个立的）。
        props: { skin: plate({ w: capW, h: 22, fill: 'rgba(255,255,255,.7)', radius: 6 }) },
        layout: { width: capW, height: 22, direction: 'row', align: 'center', justify: 'center', padding: 0 },
        children: [{ type: 'Label', id: 'slab-capt', props: { text: t(lang, 'slab.note'), size: S.slabCap, font: F.cjk, color: 'ink' } }],
      },
    ],
  };
}

/** 结果横幅（T3/T4）：判定结论胶囊 + **随数值放大的伤害数字** + 结果句。 */
function banner(view: DuelView): LayoutNode | null {
  const o = view.outcome;
  if (!o || (view.phase !== 'clash' && view.phase !== 'settle')) return null;
  const shown = view.shown;
  const tie = o.winner === 'tie';
  const iWon = o.winner === 'p1';
  const L2 = view.lang;
  const verdict = tie || !shown?.p1 || !shown?.p2
    ? t(L2, 'result.tieShort')
    : iWon ? `${handShort(L2, shown.p1)} › ${handShort(L2, shown.p2)}` : `${handShort(L2, shown.p2)} › ${handShort(L2, shown.p1)}`;
  const line = tie ? t(L2, 'result.tie') : view.phase === 'settle' ? t(L2, 'result.settled') : iWon ? t(L2, 'result.win') : t(L2, 'result.lose');
  const vw = 120 + verdict.length * S.verdict * 0.6;
  const lw = 80 + line.length * S.resultLine;
  const kids: LayoutNode[] = [{
    type: 'Panel', id: 'verdict',
    props: { skin: plate({ w: vw, h: 76, fill: C.verdict, border: B.verdict, radius: R.pill }) },
    layout: { width: vw, height: 76, direction: 'row', align: 'center', justify: 'center', padding: 0 },
    children: [{ type: 'Label', id: 'verdict-t', props: { text: verdict, size: S.verdict, font: F.cjk, color: 'text' } }],
  }];
  if (!tie) {
    kids.push({
      type: 'Label', id: 'lane-d',
      props: {
        // ASCII 连字符：全角减号 U+2212 在艺术字里常缺字形，会渲成黑豆腐块——
        // 而这是全屏最要紧的一个数字（2026-08-07 真渲染目击）。
        text: `-${o.damage}`, size: dmgFontSize(o.damage), font: F.num, bold: true,
        color: iWon ? 'gold' : 'danger', glow: true, stroke: true,
      },
    });
  }
  kids.push({
    type: 'Panel', id: 'lane-line',
    props: { skin: plate({ w: lw, h: 62, fill: 'rgba(24,17,12,.86)', border: B.verdict, radius: R.pill }) },
    layout: { width: lw, height: 62, direction: 'row', align: 'center', justify: 'center', padding: 0 },
    children: [{ type: 'Label', id: 'lane-t', props: { text: line, size: S.resultLine, font: F.cjk, color: 'text' } }],
  });
  return {
    type: 'Panel', id: 'lane', props: { bare: true },
    layout: {
      x: L.banner.x, y: L.banner.y, width: L.banner.w,
      direction: 'column', align: 'center', gap: 10, anim: 'pop', animMs: 350, allowOverlap: true,
    },
    children: kids,
  };
}

// ── 底栏：招式卡 + 我方蓄力槽 + 烟雾（稿子 §⑤⑥⑦）──────────────────────────
const BOTTOM_INNER_Y = L.bottom.y + L.bottom.pad[0];
const BOTTOM_INNER_H = L.bottom.h - L.bottom.pad[0] * 2;

/** 一张招式卡。同一组键在不同时区含义不同——副标把「这一下打多少」写在键面上。 */
function moveCard(view: DuelView, h: Hand, idx: number): LayoutNode {
  const charging = view.phase === 'charge';
  const throwing = view.phase === 'throw';
  const lv = view.charge.p1[h];
  const full = lv >= CHARGE_CAP;
  const disabled = charging ? full : !throwing;
  const selected = throwing && view.submitted === h;
  const sub = charging ? (full ? t(view.lang, 'card.full') : t(view.lang, 'card.charge', { n: DMG_AT(lv + 1) }))
    : throwing ? t(view.lang, 'card.throwFor', { n: DMG_AT(lv) }) : t(view.lang, 'card.locked');
  const w = L.card.w, hgt = BOTTOM_INNER_H;
  const badge = selected ? t(view.lang, 'card.badgeSent') : full && charging ? t(view.lang, 'card.badgeFull') : '';
  // 三段定高带：色条 38 / 图（吃掉剩余） / 副标条 48 —— 与皮里烤好的色条和副标条严丝合缝。
  // 早先交给 `justify:between` 自由排，副标就压在卡底被裁掉了（真渲染目击）。
  const band = (id: string, height: number | undefined, child: LayoutNode): LayoutNode => ({
    type: 'Panel', id, props: { bare: true },
    layout: {
      ...(height !== undefined ? { height } : { flex: 1 }),
      width: L.card.w - B.card * 2, direction: 'row', align: 'center', justify: 'center', padding: 0,
    },
    children: [child],
  });
  const kids: LayoutNode[] = [
    band(`key-${h}-nb`, 38, { type: 'Label', id: `key-${h}-n`, // 稿子的卡面写「石 · 石头」，中文读起来是**同一个词说两遍**（owner 2026-08-07 当场指出）
      // → 中英一律只用全名：石头 / 布 / 剪刀 · Rock / Paper / Scissors。
      // 短名（石/剪/布 · RK/PP/SC）只留给判定表和判定结论那种要压缩的地方。
      props: { text: handFull(view.lang, h), size: S.cardStrip, font: F.cjk, color: 'text' } }),
    band(`key-${h}-ib`, undefined, { type: 'Image', id: `key-${h}-i`, props: { src: HAND_ICON_SRC[h], alt: HAND_CN[h], fit: 'contain' }, layout: { width: 96, height: 104 } }),
    band(`key-${h}-sb`, 48, { type: 'Label', id: `key-${h}-s`, props: { text: sub, size: (throwing ? S.cardSub2 : S.cardSub) * (view.lang === 'en' ? 0.8 : 1), font: F.cjk, color: disabled ? 'dim' : 'ink' } }),
  ];
  if (badge) {
    kids.push({
      type: 'Panel', id: `key-${h}-badge`,
      props: { skin: plate({ w: 96, h: 34, fill: selected ? C.gold : C.opp, border: 4, radius: R.pill }) },
      layout: {
        x: w - 86, y: -14, width: 96, height: 34,
        direction: 'row', align: 'center', justify: 'center', padding: 0, allowOverlap: true,
      },
      children: [{ type: 'Label', id: `key-${h}-badget`, props: { text: badge, size: S.badge, font: F.cjk, color: selected ? 'ink' : 'text' } }],
    });
  }
  return {
    type: 'Panel', id: `key-${h}`,
    props: {
      skin: plate({
        w, h: hgt, fill: disabled ? C.disabled : C.cream, border: B.card, radius: R.card,
        shadow: selected ? 2 : SH.card, shadowColor: selected ? C.goldDeep : 'rgba(0,0,0,.4)',
        strip: { color: CARD_COLOR[h], h: 38 }, subBar: { h: 48 },
        ...(selected ? { outline: { color: C.gold, w: 6 } } : {}),
        ...(disabled ? { opacity: 0.62 } : {}),
      }),
      ...(disabled ? {} : { action: charging ? ACT.charge(h) : ACT.throw(h) }),
    },
    layout: {
      x: L.bottom.pad[1] + idx * (w + 12), y: BOTTOM_INNER_Y + (selected ? 5 : 0),
      width: w, height: hgt,
      direction: 'column', align: 'center', justify: 'start', gap: 0, padding: B.card, allowOverlap: true,
    },
    children: kids,
  };
}

/** 我方一格蓄力槽（**底栏最重的元素**·稿子把重量给了我方这三格，见 README 的偏差说明）。 */
function mySlot(view: DuelView, h: Hand, idx: number): LayoutNode {
  const lv = view.charge.p1[h];
  const full = lv >= CHARGE_CAP;
  const w = 290, hgt = 222;
  const x = 697 + idx * (w + 12);
  return {
    type: 'Panel', id: `cb-p1-${h}`,
    props: {
      skin: plate({
        w, h: hgt, fill: full ? [C.goldFillA, C.goldFillB] : C.cream, border: B.card, radius: R.card,
        shadow: SH.mySlot, ...(full ? { glow: 'rgba(255,201,60,.9)' } : {}),
      }),
    },
    layout: {
      x, y: 829, width: w, height: hgt,
      direction: 'column', justify: 'center', gap: 12, padding: 16, allowOverlap: true,
    },
    children: [
      {
        type: 'Panel', id: `cb-p1-${h}-r`, props: { bare: true },
        layout: { direction: 'row', align: 'center', gap: 10 },
        children: [
          { type: 'Image', id: `cb-p1-${h}-i`, props: { src: HAND_ICON_SRC[h], alt: HAND_CN[h], fit: 'contain' }, layout: { width: 56, height: 62 } },
          {
            type: 'Panel', id: `cb-p1-${h}-n`, props: { bare: true },
            layout: { flex: 1, direction: 'column', gap: 0, align: 'start' },
            children: [
              { type: 'Label', id: `cb-p1-${h}-nt`, props: { text: handFull(view.lang, h), size: S.slotName, font: F.cjk, color: 'ink' } },
              { type: 'Label', id: `cb-p1-${h}-d`, props: { text: t(view.lang, 'slots.dealsNow', { n: DMG_AT(lv) }), size: S.slotDmg, font: F.num, color: 'sub' } },
            ],
          },
          {
            type: 'Label', id: `cb-p1-${h}-v`,
            props: { text: `${lv}/${CHARGE_CAP}`, size: S.slotRead, font: F.num, bold: true, color: full ? 'gold' : 'ink' },
          },
        ],
      },
      {
        type: 'Panel', id: `cb-p1-${h}-b`, props: { bare: true },
        layout: { direction: 'row', gap: 7 },
        children: [1, 2, 3].map((i) => pip('p1', h, i, lv, full, true)),
      },
    ],
  };
}

function smokeKey(view: DuelView): LayoutNode {
  const off = view.phase === 'clash' || view.phase === 'settle';
  const usable = !off && view.smoke.uses > 0 && !view.smoke.hidden;
  const w = L.smoke.w, hgt = BOTTOM_INNER_H;
  return {
    type: 'Panel', id: 'key-smoke',
    props: {
      skin: plate({
        w, h: hgt, fill: off ? C.disabled : C.cream, border: B.card, radius: R.card,
        shadow: SH.card, ...(off ? { opacity: 0.6 } : {}),
      }),
      ...(usable ? { action: ACT.smoke } : {}),
    },
    layout: {
      x: CANVAS.w - L.bottom.pad[1] - w, y: BOTTOM_INNER_Y, width: w, height: hgt,
      direction: 'column', align: 'center', justify: 'center', gap: 4, padding: 8, allowOverlap: true,
    },
    children: [
      { type: 'Label', id: 'key-smoke-i', props: { text: '💨', size: S.smokeIcon } },
      { type: 'Label', id: 'key-smoke-n', props: { text: t(view.lang, 'smoke.name', { n: view.smoke.uses }), size: S.smokeName, font: F.cjk, color: 'ink' } },
      {
        type: 'Label', id: 'key-smoke-s',
        props: {
          text: off ? t(view.lang, 'smoke.off') : view.smoke.hidden ? t(view.lang, 'smoke.active') : t(view.lang, 'smoke.avail'),
          size: S.smokeSub, font: F.num, color: 'dim',
        },
      },
    ],
  };
}

function bottomBar(view: DuelView): LayoutNode[] {
  return [
    {
      type: 'Image', id: 'bottom-bg',
      props: { src: plate({ w: L.bottom.w, h: L.bottom.h, fill: ['rgba(24,17,12,.78)', 'rgba(24,17,12,.94)'], radius: 0 }), alt: '', fit: 'fill' },
      layout: { x: 0, y: L.bottom.y, width: L.bottom.w, height: L.bottom.h, allowOverlap: true },
    },
    {
      type: 'Image', id: 'bottom-edge',
      props: { src: plate({ w: L.bottom.w, h: 5, fill: C.ink, radius: 0 }), alt: '', fit: 'fill' },
      layout: { x: 0, y: L.bottom.y, width: L.bottom.w, height: 5, allowOverlap: true },
    },
    // 我方蓄力槽的青绿外框（稿子：`rgba(35,181,160,.16)` 底 + 5px `#23b5a0` 边 + radius 18）
    {
      type: 'Panel', id: 'my-slots',
      props: { bg: 'rgba(35,181,160,.16)', edge: 'jade' },
      layout: {
        x: 620, y: BOTTOM_INNER_Y, width: 992, height: BOTTOM_INNER_H,
        direction: 'row', align: 'center', gap: 12, padding: 14, radius: R.mySlotBox, allowOverlap: true,
      },
      children: [{
        // 同对手条：稿子写死两行（「我的」/「蓄力」）。一个 Label 塞 46px 宽会一字一行折成四行。
        type: 'Panel', id: 'my-slots-t', props: { bare: true },
        // 英文「MY / CHARGE」比中文「我的 / 蓄力」长得多 → 列加宽 + 字号降一档（实测 56px 被顶到 90px）。
        layout: { width: view.lang === 'en' ? 84 : 56, direction: 'column', align: 'center', gap: 0 },
        children: [
          { type: 'Label', id: 'my-slots-t1', props: { text: t(view.lang, 'slots.mine.a'), size: S.label, font: F.cjk, color: 'jade' } },
          { type: 'Label', id: 'my-slots-t2', props: { text: t(view.lang, 'slots.mine.b'), size: view.lang === 'en' ? 19 : S.label, font: F.cjk, color: 'jade' } },
        ],
      }],
    },
    ...HANDS.map((h, i) => mySlot(view, h, i)),
    ...HANDS.map((h, i) => moveCard(view, h, i)),
    smokeKey(view),
  ];
}

/** 终局覆盖层。**对局键整条收起**（稿子：`showHud=false`·"此屏无死路操作"）。 */
function endPanel(view: DuelView): LayoutNode[] {
  const won = view.phase === 'p1win';
  const w = L.end.w, hgt = 470;
  const stat = (id: string, n: string, label: string): LayoutNode => ({
    type: 'Panel', id, props: { bare: true },
    layout: { direction: 'column', align: 'center', gap: 2 },
    children: [
      { type: 'Label', id: `${id}-n`, props: { text: n, size: S.endStat, font: F.num, bold: true, color: 'ink' } },
      { type: 'Label', id: `${id}-l`, props: { text: label, size: S.endLabel, font: F.cjk, color: 'sub' } },
    ],
  });
  return [
    {
      type: 'Image', id: 'end-veil',
      // **源图尺寸必须等于盒子尺寸**：`<img>` 带固有宽高比，某些视口缩放下浏览器会按固有比例
      // 反过来定尺寸——用 8×8 的占位源铺满 1920×1080，实测在 1280 视口下整块蒙版缩成了
      // 1080×1080 的正方形、居中盖住画面中段（真渲染目击）。凡生成图，源尺寸一律照盒子给。
      props: { src: plate({ w: CANVAS.w, h: CANVAS.h, fill: 'rgba(16,11,8,.78)', radius: 0 }), alt: '', fit: 'fill' },
      layout: { x: 0, y: 0, width: CANVAS.w, height: CANVAS.h, allowOverlap: true },
    },
    {
      type: 'Panel', id: 'end',
      props: {
        skin: plate({
          w, h: hgt, fill: [C.cream, '#f4e2c4'], border: B.end, radius: R.end,
          shadow: SH.end, shadowColor: 'rgba(0,0,0,.35)',
        }),
      },
      layout: {
        x: (CANVAS.w - w) / 2, y: (CANVAS.h - hgt) / 2, width: w, height: hgt,
        direction: 'column', align: 'center', justify: 'center', gap: 18, padding: 44,
        anim: 'pop', animMs: 400, allowOverlap: true,
      },
      children: [
        // 英文标题（YOU WIN / YOU LOSE）比中文长得多，96px 会撞面板边 → 英文降一档。
        { type: 'Label', id: 'end-t', props: { text: phaseName(view.lang, view.phase), size: view.lang === 'en' ? 72 : S.endTitle, font: F.cjk, color: won ? 'jade' : 'danger', stroke: true } },
        {
          type: 'Panel', id: 'end-stats', props: { bare: true },
          layout: { direction: 'row', align: 'center', justify: 'center', gap: 40 },
          children: [stat('end-s1', `${view.round}`, t(view.lang, 'end.rounds')), stat('end-s2', `${view.hp.p1}`, t(view.lang, 'end.hpLeft'))],
        },
        {
          type: 'Panel', id: 'key-next',
          props: {
            skin: plate({ w: 320, h: 90, fill: C.gold, border: B.verdict, radius: R.mySlotBox, shadow: SH.cta, shadowColor: C.goldDeep }),
            action: ACT.next,
          },
          layout: { width: 320, height: 90, direction: 'row', align: 'center', justify: 'center', padding: 0 },
          children: [{ type: 'Label', id: 'key-next-t', props: { text: t(view.lang, 'end.again'), size: S.cta, font: F.cjk, color: 'ink' } }],
        },
      ],
    },
  ];
}

/** 对局屏。层序：舞台 → 前臂 → 顶栏 → 对手条 → 中线 → **两只手** → 结果横幅 → 底栏 → 终局层。 */
export function buildDuelScreen(view: DuelView): LayoutNode {
  const over = isOver(view.phase);
  const b = banner(view);
  return {
    type: 'Panel', id: 'duel-screen', props: { bare: true },
    layout: { width: CANVAS.w, height: CANVAS.h, padding: 0 },
    children: [
      stageBg(),
      armNode('p1'), armNode('p2'),
      ...topBar(view),
      foeStrip(view),
      ruleSlab(view.lang),
      handNode(view, 'p1'), handNode(view, 'p2'),
      ...(b ? [b] : []),
      ...(over ? endPanel(view) : bottomBar(view)),
    ],
  };
}

export function emptyView(): DuelView {
  const zero = (): Record<Hand, number> => ({ rock: 0, paper: 0, scissors: 0 });
  return {
    phase: 'charge', phaseLeft: 1, phaseSec: 3, round: 1,
    hp: { p1: HP_MAX, p2: HP_MAX },
    charge: { p1: zero(), p2: zero() },
    smoke: { uses: SMOKE_USES, hidden: false },
    foeName: DEFAULT_CARD.name,
    lang: 'zh',
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
