// game108 对局屏 —— **设计定稿 1:1 复刻**（纯 LayoutNode 数据·UI 铁律：禁手写 React/自由 DOM）。
//
// 稿子：`games/game108/design_handoff_rule_of_three_battle/`
//   · README.md = 逐区规格（颜色/字号/圆角/描边/投影/动画节拍）
//   · design/battle-screen.dc.html = 每个盒子的绝对 px
//   · screens/*.png = 五个状态的成品图（视觉基准）
// 复刻口径（CLAUDE.md「有 .dc.html 设计稿在档 = 1:1 复刻基准」）：
//   **坐标与颜色一律取自 `design-tokens.ts`**（那份是逐字抄来的），本文件只负责「用闭集控件把它摆出来」。
//   差异逐条记在 `docs/design/game108/self-check/S5-alignment.md`，不默降。
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
  HP_RES, SMOKE_USES, UI_ACT, PHASE_TICKS, TPS, PENALTY_HP, type Hand, type Side,
} from './theme.js';
import { C, S, F, L, R, B, SH, CANVAS, dmgFontSize } from './design-tokens.js';
import { plate, ring, hpBar, scene } from './plate-art.js';
import { handArt, armArt, HAND_BOX_SCALE, HAND_BOX_SHIFT } from './hand-art.js';
import { HAND_ICON_SRC } from './hand-icons.js';
import { t, CHAR_W, enSize, type Lang, type StringKey as StringKeyOf } from './strings.js';
import { DEFAULT_CARD } from './card-character.js';

/** 这只手现在打多少【R-108-13】。 */
const DMG_AT = (charge: number): number => DMG_BASE + charge * DMG_STEP;
/** 手型显示名（**走字典**·稿子的键面写「石 · 石头」，槽里写「石 石头」）。 */
const handShort = (lang: Lang, h: Hand): string => t(lang, `hand.${h}.short` as const);
const handFull = (lang: Lang, h: Hand): string => t(lang, `hand.${h}.full` as const);
const CARD_COLOR: Record<Hand, string> = { rock: C.cardRock, paper: C.cardPaper, scissors: C.cardScissors };
/**
 * 【R-108-07】注水色 —— **定稿明写「就用这只手自己的牌色」**（石 #2f7fd0 / 布 #31a83f / 剪 #c8214f），
 * 顶部 85%（`d9`）不透明往下到实色，**不是金色**：「水、粒子、落点光晕三处同色，
 * 一眼看得出这股力属于哪只手」。我第一版用的是另一套半透色，与粒子对不上，已按稿换掉。
 */
const CARD_WATER: Record<Hand, string> = {
  rock: `${C.cardRock}d9`, paper: `${C.cardPaper}d9`, scissors: `${C.cardScissors}d9`,
};
/** 谁克谁（屏上提示与判定结论用·与判定表同源的静态常识，不参与判定）。 */
const BEATS: Record<Hand, Hand> = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

export type Phase = 'charge' | 'throw' | 'clash' | 'settle' | 'p1win' | 'p2win';

export interface DuelView {
  phase: Phase;
  /** 相位剩余比例 0..1（倒计时环 + **手的动画时钟**）。 */
  phaseLeft: number;
  /** 相位剩余秒数（稿子的环心读数）。 */
  phaseSec: number;
  /**
   * **本状态已走过的毫秒数**（= `flow.elapsed / TPS × 1000`）。所有演出的唯一时钟。
   * 为什么不继续用 `phaseLeft` 推：v3 有两拍**没有时长**（T4 玩家闸门 / T2 罚血读秒），
   * `phaseLeft` 在那两拍恒为 0 —— 照它算，手就僵在原地不摇了（改 v3 时差点漏掉这一处）。
   */
  elapsedMs: number;
  round: number;
  hp: Record<Side, number>;
  charge: Record<Side, Record<Hand, number>>;
  /** 本回合双方亮出的手（T3/T4 才有值）。 */
  shown?: Record<Side, Hand | ''>;
  /** 我这回合提交了哪只手（稿子的「已提交」态·出招到揭晓那两秒空窗靠它撑）。 */
  submitted?: Hand | '';
  outcome?: { winner: Side | 'tie'; damage: number };
  /**
   * 【R-108-04】v3 罚血读秒：免费 5 秒走完仍没出手 → `active`，`debt` = 本回合已欠点数。
   * **屏上必须与"被对手打中"区分得开**（owner 明确）——罚血不是战果，不触发胜负横幅。
   * 相位仍是 `throw`（世界里那两个 `throwPenalty*` 状态是 T2 的尾巴，不是第五拍）。
   */
  penalty?: { active: boolean; debt: number };
  /** 【R-108-05】v3：T4 由玩家点「下一轮」推进——有它才画那枚键（终局屏画的是「再来一局」）。 */
  awaitNext?: boolean;
  /**
   * **还没开局**（owner 2026-08-08 试玩：「我还没有点开始，它就直接三个牌飞上来了」）。
   * 为真时整屏盖一张开始屏，且宿主**不启动引擎**——不是"暂停"，是根本还没开始跑，
   * 所以玩家点开始那一刻看到的是完完整整的第一拍，不是已经播过一半的。
   */
  notStarted?: boolean;
  /**
   * 【R-108-07】T1 注水：本回合蓄的是哪只手 + **蓄下去那一刻在 T1 里的毫秒数**。
   * 注水是"从这一刻起灌 450ms"，屏上只有相位时钟一个钟（表现层也别引入第二个钟），
   * 所以起点必须由宿主在看见槽涨的那一帧记下来传进来。
   */
  charged?: { hand: Hand; atMs: number };
  /**
   * 【R-108-06/09】结算演出的**参照系**：本回合开打前的血量与六条槽。
   * 血槽双段条要画"这一波掉了多少"、蓄力回撤要从"退回前是几层"退起——
   * 两者都不是当前值能反推的，必须在进 T3 那一拍抓一张快照。
   */
  before?: { hp: Record<Side, number>; charge: Record<Side, Record<Hand, number>> };
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
  /** 对手的**心情**（定稿 §⑥：名字下一枚 18px 小签·「它直接解释对手为什么这样打」）。 */
  foeMood?: string;
  /** 界面语言（owner 2026-08-07：中英双版·默认中文）。 */
  lang: Lang;
  /** 设置菜单开着没有（owner 2026-08-07：右上角一个菜单键·里面放音乐和语言）。 */
  menuOpen?: boolean;
  /** 玩法说明开着没有（owner 2026-08-08：「少了个说明文档，需要在这个菜单里加一下」）。 */
  helpOpen?: boolean;
  /** 三个音频开关的当前状态（纯显示·真状态在宿主的音频门面里）。 */
  audio?: { bgm: boolean; sfx: boolean; voice: boolean };
  /** 角色这一刻说的那句（配音发不出声时的**字幕兜底**——听不见也要看得见）。 */
  subtitle?: string;
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
  const ms = view.elapsedMs;
  switch (view.phase) {
    case 'charge': {
      // 伸入：从画外沿水平方向推进到位（稿子 §Animations 1：不是淡入、不是弹出）。
      const e = easeOutBack(clamp01(ms / 500));
      return { dx: q((e - 1) * 420, 4), dy: 0, rot: 0, scale: 1 };
    }
    case 'throw':
      // 摇拳按**真实毫秒**走，摇到你出手为止（v3 的 T2 没有固定长度：免费 5 秒 + 罚血读秒）。
      // 罚血期 `elapsedMs` 每秒归零一次（那是读秒子状态的钟），加上欠债秒数才连得起来。
      return shakeAt(view.penalty?.active ? view.penalty.debt * 1000 + ms : ms);
    case 'clash':
    case 'settle': {
      // 出招：手型换成实际那一招，同时朝中线推 26px（稿子 `rt3-push`）。
      const e = easeOutBack(clamp01(ms / (view.phase === 'clash' ? 210 : 280)));
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
  // **定稿 v3 §⑥ 判词**：34×34 升到 **76×76**（顶栏 97 内留 10px 上下气）；
  // **不另开立绘位**——「对局屏四拍全在读六条槽，立绘会抢注意力；真正该放大画像的是 T4 结算与二选一屏」。
  const art = view.portrait?.[side];
  const P = 76;
  const swatch: LayoutNode = {
    type: 'Panel', id: `side-${side}-sw`,
    props: { skin: plate({ w: P, h: P, fill: mine ? C.youSwatch : C.oppSwatch, border: 4, radius: 14 }) },
    layout: { width: P, height: P, direction: 'row', align: 'center', justify: 'center', padding: 4 },
    children: [art
      ? { type: 'Image', id: `side-${side}-art`, props: { src: art, alt: name, fit: 'cover', radius: 10 }, layout: { width: P - 8, height: P - 8 } }
      : { type: 'Label', id: `side-${side}-art`, props: { text: name.slice(0, 1), size: 40, font: F.cjk, color: 'ink' } }],
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
  // 定稿 §⑥：**心情上屏** —— 名字下一枚 18px 小签。「它直接解释对手为什么这样打」。
  const moodTag: LayoutNode | null = !mine && view.foeMood
    ? {
      type: 'Panel', id: `side-${side}-mood`,
      props: { skin: plate({ w: 96, h: 26, fill: 'rgba(24,17,12,.7)', border: 3, radius: R.pill }) },
      layout: { width: 96, height: 26, direction: 'row', align: 'center', justify: 'center', padding: 0 },
      children: [{ type: 'Label', id: `side-${side}-mood-t`, props: { text: view.foeMood, size: 18, font: F.cjk, color: 'text' } }],
    }
    : null;
  const nameCol: LayoutNode = {
    type: 'Panel', id: `side-${side}-col`, props: { bare: true },
    layout: { direction: 'column', align: mine ? 'start' : 'end', gap: 4 },
    children: moodTag ? [plateNode, moodTag] : [plateNode],
  };
  return {
    type: 'Panel', id: `side-${side}`, props: { bare: true },
    layout: {
      x: mine ? 18 : CANVAS.w - 18 - L.idPlate.w, y: 10, width: L.idPlate.w,
      direction: 'row', align: 'center', justify: mine ? 'start' : 'end', gap: 10,
    },
    children: mine ? [nameCol, swatch] : [swatch, nameCol],
  };
}

/** 血量块（条 + 大数字 + `/100`）。对手那条**从外侧掉**（稿子明写）。 */
/**
 * 【R-108-06】血槽双段条：先掉的那段延迟 220ms 才开始追、620ms 追到位。
 * 参照系是**进 T3 那一拍的血量快照**（`view.before`）——当前值反推不出"这一波掉了多少"。
 * 追完（或没掉血）返回 undefined ⇒ `hpBar` 与旧版逐字节相同，不多生成一张皮。
 */
function ghostPct(view: DuelView, side: Side): number | undefined {
  const was = view.before?.hp[side];
  if (was === undefined || was <= view.hp[side]) return undefined;
  if (view.phase !== 'clash' && view.phase !== 'settle') return undefined;
  // T4 的时钟是玩家闸门（可以停很久）→ 只在 T3 演这一段，进 T4 就已经追平了。
  const ms = view.phase === 'clash' ? view.elapsedMs : Infinity;
  const p = clamp01((ms - DRAIN_DELAY) / DRAIN_MS);
  if (p >= 1) return undefined;
  return q((was - (was - view.hp[side]) * easeInOut(p)) / HP_MAX * 100, 1);
}

function hpBlock(view: DuelView, side: Side): LayoutNode {
  const mine = side === 'p1';
  const hp = view.hp[side];
  const bar: LayoutNode = {
    type: 'Image', id: `side-${side}-hp`,
    props: {
      src: hpBar(L.hpBlock.w, L.hpTrack.h, (hp / HP_MAX) * 100,
        mine ? ['#5fe8cd', '#1f9c89'] : ['#ff9a8a', '#d0342b'], C.hpTrack, C.ink, mine ? 'left' : 'right',
        ghostPct(view, side), mine ? GHOST_MINE : GHOST_FOE),   // 定稿 §④ 指定的滞后条色
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
  // 【R-108-04】罚血读秒（**照设计定稿 v3 改**）：环**不再倒数**——转为满圈红、停住，只当色块用；
  // 「你已经欠了多少」不塞进 78px 的环心（塞不下·我第一版糊出圈外），改由画面正中的欠账牌承担。
  const pen = view.penalty?.active === true;
  const pct = pen ? 100 : Math.round(view.phaseLeft * 100);
  const hot = pen || pct < 34;
  const accent = hot ? C.danger : C.gold;
  const chipText = pen ? t(view.lang, 'penalty.title') : phaseName(view.lang, view.phase);
  const chipW = 26 * 2 + chipText.length * S.phaseChip * (view.lang === 'en' ? 0.62 : 1) + 10;
  return {
    type: 'Panel', id: 'status', props: { bare: true },
    layout: { x: 566, y: 10, width: 788, height: 78, direction: 'row', align: 'center', justify: 'center', gap: 18 },
    children: [
      { type: 'Label', id: 'round-b', props: { text: t(view.lang, 'top.round', { n: view.round }), size: S.round, font: F.cjk, color: 'text' } },
      // 【R-108-05】T4 **没有倒计时**（玩家闸门）——环整个不画。
      // 画一圈停在 0.0 秒的环 = 告诉玩家"时间到了"，而事实是它在等你点；这是最容易骗到人的一种 UI 谎话。
      ...(view.awaitNext ? [] : [{
        type: 'Panel', id: 'phase-ring',
        props: { skin: ring(L.ring, pct, accent, C.ringDisc, L.ringDisc) },
        layout: { width: L.ring, height: L.ring, direction: 'column', align: 'center', justify: 'center', gap: 0, padding: 0 },
        children: [
          { type: 'Label', id: 'phase-sec', props: { text: pen ? '0.0' : view.phaseSec.toFixed(1), size: S.timer, font: F.num, bold: true, color: hot ? 'danger' : 'text' } },
          { type: 'Label', id: 'phase-secu', props: { text: t(view.lang, 'top.sec'), size: S.ringSec, font: F.num, color: 'sub' } },
        ],
      } as LayoutNode]),
      {
        type: 'Panel', id: 'phase-chip',
        props: { skin: plate({ w: chipW, h: 62, fill: accent, border: 5, radius: R.chip, shadow: SH.chip }) },
        layout: { width: chipW, height: 62, direction: 'row', align: 'center', justify: 'center', padding: 0 },
        children: [{ type: 'Label', id: 'phase-t', props: { text: chipText, size: S.phaseChip, font: F.cjk, color: 'ink' } }],
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
      // 稿子把它画成一枚装饰齿轮（点了没定义）。owner 2026-08-07：**右上角要一个菜单键**，
      // 里面放音乐和语言 —— 正好就是它，加个 `action` 即可，不必再往屏上塞新件。
      type: 'Panel', id: 'key-menu',
      props: {
        skin: plate({ w: L.gear.size, h: L.gear.size, fill: C.cream, border: 4, radius: 999, shadow: 4, shadowColor: 'rgba(0,0,0,.3)' }),
        action: UI_ACT.menu,
      },
      layout: {
        x: L.gear.x, y: L.gear.y, width: L.gear.size, height: L.gear.size,
        direction: 'row', align: 'center', justify: 'center', padding: 0, allowOverlap: true,
      },
      children: [{ type: 'Label', id: 'gear-t', props: { text: '⚙', size: S.gear, color: 'ink' } }],
    },
  ];
}

// ── 右上：对手蓄力条（紧凑条·稿子 §⑥）────────────────────────────────────
// 对手条的逐段宽度（**全部算死，不靠 flex 分**）。
// 为什么不能用 `flex:1`：pip 是 `<img>`，**有固有宽度**，而 flex 项的 `min-width` 缺省是 `auto`
// ＝内容固有宽 —— 三枚 pip 的固有宽加起来超过分给它们的空间时，flex **压不下去**，
// 整排 pip 就顶着往右溢出，把右边的 `n/3` 读数压在身下（owner 2026-08-07 目击：「字和图有重叠」）。
// 我方槽那三条没出事纯属巧合：算下来固有宽恰好等于分到的宽。**换成算死的像素，两边都不再靠运气。**
// 定稿 §⑦：**FOE CHARGE 两行 15px、列宽 62px**（中文「对手/蓄力」仍 76）。
const FOE_STRIP_PAD = 8, FOE_GAP = 9;
const foeLabelW = (lang: Lang): number => (lang === 'en' ? 62 : 76);
const FOE_LABEL_W = 76;
const foeChipW = (lang: Lang): number =>
  Math.floor((L.oppStrip.w - B.oppChip * 2 - FOE_STRIP_PAD * 2 - foeLabelW(lang) - FOE_GAP * 3) / 3);
const FOE_CHIP_W = foeChipW('zh');
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
            layout: { width: foeLabelW(view.lang), direction: 'column', align: 'center', gap: 0 },
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
// ── 【R-108-06/09】结算演出 ──────────────────────────────────────────────
//
// 三件套：**红色震动（幅度随掉血量）** + **血槽双段条** + **伤害数字跳数**。
// 全部由相位时钟推（同手的动作），不走 CSS 关键帧——理由见文件上方 handMotion 那段。
// 定稿 §④ 的时长/幅度表（逐条照抄，不再自拟）：
//   伤害跳数 460ms ease-out（跳数期间字号 .82 → 1）
//   双段条：滞后条**停 140ms** 再用 **420ms** ease-in-out 追上；色 #ffd45e（我方）/ #ffb3a6（对方）
//   震屏三档：掉 10 → ±6px/180ms · 20–30 → ±14px/260ms · 40 → ±26px/380ms，配红 inset .16/.26/.38
//   蓄力回撤：**520ms**，从满格往回、每格延迟 **90ms**
const DMG_TWEEN_MS = 460;
const DRAIN_DELAY = 140;
const DRAIN_MS = 420;
const GHOST_MINE = '#ffd45e', GHOST_FOE = '#ffb3a6';

/**
 * 【R-108-06】震屏三档 —— **定稿写死的三档**（不再用我原来的连续式 `4+dmg×0.35`）。
 * 掉 10 → ±6px/180ms · 20–30 → ±14px/260ms · 40 → ±26px/380ms。
 * 档位按伤害区间取，遗物改了 base/step 也只会落进相邻档，不会失配成 0。
 */
const SHAKE_TIERS = [
  { upTo: 10, amp: 6, ms: 180, veil: 0.16 },
  { upTo: 30, amp: 14, ms: 260, veil: 0.26 },
  { upTo: Infinity, amp: 26, ms: 380, veil: 0.38 },
] as const;
const shakeTier = (damage: number): typeof SHAKE_TIERS[number] =>
  SHAKE_TIERS.find((x) => damage <= x.upTo) ?? SHAKE_TIERS[2];

/** 这一帧的震动位移（衰减正弦·量化到 1px 防每帧新皮）。掉血量为 0 → 不抖。 */
function hitShake(view: DuelView): { dx: number; dy: number } {
  const dmg = view.outcome?.damage ?? 0;
  const tier = shakeTier(dmg);
  if (dmg <= 0 || view.phase !== 'clash' || view.elapsedMs > tier.ms) return { dx: 0, dy: 0 };
  const decay = 1 - view.elapsedMs / tier.ms;
  const amp = tier.amp * decay * decay;
  const ph = (view.elapsedMs / 55) * Math.PI;
  return { dx: q(Math.sin(ph) * amp, 1), dy: q(Math.cos(ph * 1.4) * amp * 0.6, 1) };
}

/** 红色震动的另一半：整屏红纱，浓度随掉血量（40 血那一下要"红一下眼"）。 */
function hitVeil(view: DuelView): LayoutNode | null {
  const dmg = view.outcome?.damage ?? 0;
  if (dmg <= 0 || view.phase !== 'clash') return null;
  // 只有**我**挨打才红屏：打中对手时红屏会让玩家以为自己被打了（罚血同理，见下面 penaltyVeil）。
  if (view.outcome?.winner !== 'p2') return null;
  const tier = shakeTier(dmg);
  if (view.elapsedMs > tier.ms) return null;
  const a = q((1 - view.elapsedMs / tier.ms) * tier.veil, 0.02);
  if (a <= 0) return null;
  return {
    type: 'Image', id: 'hit-veil',
    // 生成图的**源尺寸必须等于盒子尺寸**（2026-08-07 踩过：8×8 的源被居中画成 1080 见方一块）。
    props: { src: plate({ w: CANVAS.w, h: CANVAS.h, fill: `rgba(224,72,63,${a})`, radius: 0 }), alt: '', fit: 'fill' },
    layout: { x: 0, y: 0, width: CANVAS.w, height: CANVAS.h, allowOverlap: true },
  };
}

/**
 * 【R-108-04】罚血读秒的**欠账牌** —— 逐条照设计定稿 v3（`design_v3` §③ 原文）。
 *
 * 规格：**放画面正中**（620 宽、墨边 7px、暗红面 `rgba(122,26,18,.94)`、圆角 32、
 * 投影 `0 12px 0 rgba(0,0,0,.45)`）。第一行 = 一枚每秒跳一下的「−1」印章（64px 圆·红面墨边）
 * + **42px** 主句「超时了 · 每思考 1 秒罚 1 滴血」；分隔线（4px 白 22%）；
 * 下面是 **132px** 的累计欠数（`#ffd0c6` + 墨投影 + 红辉光）；底一行 **22px** 小字
 * 「出手即停 · 这不是他打的」。
 *
 * **为什么放正中**（定稿原话）：「这一拍两只手在摇、六条槽不用读，正中是唯一没人抢的地方，
 * 玩家一眼就懂自己在被罚。」——我第一版把它塞进 78px 的倒计时环里，读不出来也糊出圈外。
 */
function penaltyPanel(view: DuelView): LayoutNode[] {
  if (!view.penalty?.active) return [];
  const lang = view.lang;
  const head = t(lang, 'penalty.text');
  const owe = `${view.penalty.debt}`;
  // 定稿标 620 宽，但那是**按它自己的文案排出来的**结果——面板本体是 `padding:24px 56px 28px` 的
  // 自适应列。这里照同一口径**按内容算宽**（620 当下限）：写死 620 会让 42px 的主句折行、
  // 连带把整块面板顶破（真渲染目击过一次）。
  const headSize = lang === 'en' ? 30 : 42;
  const w = Math.max(620, Math.round(64 + 16 + head.length * headSize * CHAR_W[lang] + 112));
  // 高度同理按行高摞：主句 64 + 分隔 4 + 欠数 132 + 脚注 22 + 三道 gap 14 + 上下 padding。
  const oweH = Math.round(132 * 1.05);
  const hgt = 64 + 14 + 4 + 14 + oweH + 14 + 30 + 48;
  const rows: LayoutNode[] = [
    {
      type: 'Panel', id: 'pen-head', props: { bare: true },
      layout: { direction: 'row', align: 'center', gap: 16 },
      children: [
        {
          type: 'Panel', id: 'pen-stamp',
          props: { skin: plate({ w: 64, h: 64, fill: C.danger, border: 5, radius: 999 }) },
          layout: { width: 64, height: 64, direction: 'row', align: 'center', justify: 'center', padding: 0 },
          children: [{ type: 'Label', id: 'pen-stamp-t', props: { text: `-${PENALTY_HP}`, size: 32, font: F.num, bold: true, color: 'ink' } }],
        },
        { type: 'Label', id: 'pen-head-t', props: { text: head, size: headSize, font: F.cjk, color: 'text' } },
      ],
    },
    {
      type: 'Image', id: 'pen-div',
      props: { src: plate({ w: w - 112, h: 4, fill: 'rgba(255,255,255,.22)', radius: 2 }), alt: '', fit: 'fill' },
      layout: { width: w - 112, height: 4 },   // 定稿：标题行下一条 4px 白 22% 分隔
    },
    {
      type: 'Panel', id: 'pen-owe', props: { bare: true },
      layout: { direction: 'row', align: 'end', justify: 'center', gap: 16 },
      children: [
        { type: 'Label', id: 'pen-owe-l', props: { text: t(lang, 'penalty.owe'), size: 28, font: F.cjk, color: 'foe' }, layout: { height: 40 } },
        // 132px 是定稿写死的；不用 tween——owner 要的是**一秒一记**的节拍感，连续滑落读不出来。
        // 定高盒收住：默认 1.4 倍行高会把 132px 的字撑成 185px，整块面板当场顶破（同顶栏血量数字那条）。
        { type: 'Label', id: 'pen-owe-n', props: { text: owe, size: 132, font: F.num, bold: true, color: 'foe', glow: true, stroke: true }, layout: { height: oweH } },
      ],
    },
    { type: 'Label', id: 'pen-foot', props: { text: t(lang, 'penalty.foot'), size: 22, font: F.cjk, color: 'sub' } },
  ];
  return [{
    type: 'Panel', id: 'pen-card',
    props: { skin: plate({ w, h: hgt, fill: 'rgba(122,26,18,.94)', border: 7, radius: 32, shadow: 12, shadowColor: 'rgba(0,0,0,.45)' }) },
    layout: {
      x: Math.round((CANVAS.w - w) / 2), y: Math.round((CANVAS.h - hgt) / 2) - 30, width: w, height: hgt,
      direction: 'column', align: 'center', justify: 'center', gap: 14, padding: 24, allowOverlap: true,
      anim: 'pop', animMs: 260,
    },
    children: rows,
  }];
}

/**
 * 【R-108-04】罚血的另一半：**血条左端渗出的小红滴**（定稿 §③ 明写的区分手段）。
 * 「−1，24px，从血条下沿落 46px，0.9s」，三滴错开 300ms。
 * **不走中央横幅、不放大字号、不震屏、不触发胜负判定**——战果掉血才有那一套。
 * 我第一版用的是「整屏每秒闪一次红纱」，那和挨打的红屏是同一种语言，正是定稿要避开的。
 */
function penaltyDrips(view: DuelView): LayoutNode[] {
  if (!view.penalty?.active) return [];
  const beat = view.elapsedMs % 900;
  return [0, 1, 2].flatMap((i) => {
    const local = (beat - i * 300 + 900) % 900 / 900;
    if (local > 1 || local < 0.02) return [];
    const dy = Math.round(46 * local);
    const a = local < 0.2 ? local / 0.2 : 1 - (local - 0.2) / 0.8;
    if (a <= 0.05) return [];
    return [{
      type: 'Label', id: `pen-drip-${i}`,
      props: { text: `-${PENALTY_HP}`, size: 24, font: F.num, bold: true, color: 'warn', stroke: true },
      layout: { x: 262 + i * 26, y: 190 + dy, allowOverlap: true },
    } as LayoutNode];
  });
}

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
    // 【R-108-09】伤害数字**跳数**：不是直接显示终值，从 0 弹到 -N（`Label.tween` 是基座件）。
    // 减号单独一个 Label：`tween` 接管的是数字本身，前缀塞不进去；而这个减号又不能省
    //（省了就变成"加了 30 血"）。ASCII 连字符——全角减号在艺术字里常缺字形，渲成黑豆腐块。
    const dsize = dmgFontSize(o.damage);
    kids.push({
      type: 'Panel', id: 'lane-dw', props: { bare: true },
      layout: { direction: 'row', align: 'center', justify: 'center', gap: 0 },
      children: [
        { type: 'Label', id: 'lane-dm', props: { text: '-', size: dsize, font: F.num, bold: true, color: iWon ? 'gold' : 'danger', glow: true, stroke: true } },
        {
          type: 'Label', id: 'lane-d',
          props: {
            tween: { from: 0, to: o.damage, ms: DMG_TWEEN_MS, decimals: 0 },
            size: dsize, font: F.num, bold: true, color: iWon ? 'gold' : 'danger', glow: true, stroke: true,
          },
        },
      ],
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

// ── 【R-108-07/08】T1 放大选牌 —— **逐条照设计定稿 v3**（2026-08-08 收稿）────────
//
// 定稿给的是绝对 px 关键帧（`design_v3/battle-screen-v3.dc.html` 的 `rt3-m0/1/2`）：
//   小 → 大：`left 20/218/416, top 814, 186×252`  →  `left 334/770/1206, top 214, 380×520`
// 缓动 `.38s cubic-bezier(.16,1.3,.36,1)`，**三张错开 0/55/110ms**；回落同一套节奏，几何反着走。
// 设计方明写「**不用 transform:scale**——描边 7px、圆角 24px、条头高度全程保持原值不被拉伸，四角同构」
// ⇒ 我们本来就是重画一张皮而不是缩放，正好对上；但**边宽/圆角/条头高在放大态用的是放大态那套值**
// （7 / 24 / 条头 padding 10px 0 · 副标 padding 12px 0），不随 k 插值。
const BIG = { w: 380, h: 520, y: 214, xs: [334, 770, 1206] as const } as const;
const SMALL_XS = [20, 218, 416] as const;   // 定稿的底栏原位 left（与 L.bottom.pad[1]+idx*(186+12) 同址）
const RISE_MS = 380;                        // 升起 / 回落同为 380ms
const RISE_STAGGER = 55;                    // 三张错开 0 / 55 / 110ms
const POUR_MS = 620;                        // 注水（定稿：620ms·四段过冲）
const PARTICLE_MS = 600;                    // 粒子飞行（定稿）
/** 定稿的放大态卡面参数（不随插值变，见上「不用 scale」那条）。 */
const BIG_CARD = { border: 7, radius: 24, shadow: 12, strip: 62, sub: 58, icon: [180, 196] as const } as const;

/** 定稿缓动 `cubic-bezier(.16,1.3,.36,1)` 的近似（回弹型·顶点约 1.09）。 */
const easeBack16 = (x: number): number => 1 + 2.2 * (x - 1) ** 3 + 1.35 * (x - 1) ** 2;

/**
 * 第 idx 张卡这一帧「放大了多少」（0=底栏原位 · 1=中央通道满尺寸）。
 * **每张各自错开**（定稿 0/55/110ms）——三张同时起落会像一整块板子在动，错开才有牌感。
 * 量化到 0.1 档：卡面是生成图，尺寸变一次就是一张新 data-URI；不量化 = 每帧一张新皮，
 * 面板全量重建 + 图片重新请求（2026-08-07 那次 `networkidle` 永不收敛就是这么来的）。
 */
function cardGrow(view: DuelView, idx: number): number {
  if (view.phase !== 'charge') return 0;
  const total = PHASE_TICKS.charge / TPS * 1000;
  const ms = view.elapsedMs - idx * RISE_STAGGER;
  // 收场那一段：**先粒子后回落**（定稿②明写「这一拍分两段」）——粒子飞 600ms 落定，牌才往回缩。
  const backAt = total - RISE_MS;
  if (ms >= backAt) return q(clamp01(1 - easeInOut((ms - backAt) / RISE_MS)), 0.1);
  return q(clamp01(easeBack16(ms / RISE_MS)), 0.1);
}

/** 粒子那一段的进度（0..1）；不在窗口内返回 -1。定稿：回落前的 600ms 射粒子。 */
function particlePhase(view: DuelView): number {
  if (view.phase !== 'charge' || !view.charged) return -1;
  const total = PHASE_TICKS.charge / TPS * 1000;
  const start = total - RISE_MS - PARTICLE_MS;
  const p = (view.elapsedMs - start) / PARTICLE_MS;
  return p >= 0 && p <= 1 ? p : -1;
}

/**
 * 【R-108-07】注水高度：从「蓄下去那一刻」起灌 **620ms**，水位走定稿的**四段过冲**——
 * 62% 处到 76%（快灌）→ 80% 处冲到 108%（拍到顶）→ 92% 回落到 96% → 100% 落定，
 * 「看得出一记『咣』」。直接线性到 1 就没有那一下，定稿专门为此列了四个断点。
 */
const POUR_KEYS = [[0, 0], [0.62, 0.76], [0.80, 1.08], [0.92, 0.96], [1, 1]] as const;
function pourLevel(view: DuelView, h: Hand): number {
  if (view.phase !== 'charge' || view.charged?.hand !== h) return 0;
  const p = clamp01((view.elapsedMs - view.charged.atMs) / POUR_MS);
  let i = 0;
  while (i < POUR_KEYS.length - 2 && p > POUR_KEYS[i + 1]![0]) i++;
  const [t0, v0] = POUR_KEYS[i]!, [t1, v1] = POUR_KEYS[i + 1]!;
  const local = t1 === t0 ? 1 : (p - t0) / (t1 - t0);
  return q(v0 + (v1 - v0) * easeInOut(local), 0.04);
}

/** 一张招式卡。同一组键在不同时区含义不同——副标把「这一下打多少」写在键面上。 */
function moveCard(view: DuelView, h: Hand, idx: number): LayoutNode {
  // 未开局时全体禁用：幕布只是画上去的，探针/键盘照样够得着底下的键——
  // 「盖住了就等于关了」是 2026-08-07 那个死键教过的错。
  const charging = view.phase === 'charge' && view.notStarted !== true;
  const throwing = view.phase === 'throw' && view.notStarted !== true;
  const lv = view.charge.p1[h];
  const full = lv >= CHARGE_CAP;
  const disabled = charging ? full : !throwing;
  const selected = throwing && view.submitted === h;
  const sub = charging ? (full ? t(view.lang, 'card.full') : t(view.lang, 'card.charge', { n: DMG_AT(lv + 1) }))
    : throwing ? t(view.lang, 'card.throwFor', { n: DMG_AT(lv) }) : t(view.lang, 'card.locked');
  // 【R-108-08】放大插值：底栏原位 ↔ 中央通道，几何逐字照定稿关键帧（见 BIG / SMALL_XS）。
  const k = cardGrow(view, idx);
  const lerp = (a: number, b: number): number => Math.round(a + (b - a) * k);
  const w = lerp(L.card.w, BIG.w), hgt = lerp(BOTTOM_INNER_H, BIG.h);
  const cardX = lerp(SMALL_XS[idx] ?? L.bottom.pad[1], BIG.xs[idx] ?? 0);
  // 三段带随 k 一起长（否则图挤在顶上、副标压出卡外——v2 定高带那次真渲染目击过）；
  // 但**边宽/圆角/投影按定稿在放大态换成 7/24/12，不做插值**（「不用 scale·四角同构」）。
  const stripH = lerp(38, BIG_CARD.strip), subH = lerp(48, BIG_CARD.sub);
  const iconW = lerp(96, BIG_CARD.icon[0]), iconH = lerp(104, BIG_CARD.icon[1]);
  const big = k > 0.5;
  const bw = big ? BIG_CARD.border : B.card, rad = big ? BIG_CARD.radius : R.card;
  const pour = pourLevel(view, h);
  const badge = selected ? t(view.lang, 'card.badgeSent') : full && charging ? t(view.lang, 'card.badgeFull') : '';
  // 三段定高带：色条 38 / 图（吃掉剩余） / 副标条 48 —— 与皮里烤好的色条和副标条严丝合缝。
  // 早先交给 `justify:between` 自由排，副标就压在卡底被裁掉了（真渲染目击）。
  const band = (id: string, height: number | undefined, child: LayoutNode): LayoutNode => ({
    type: 'Panel', id, props: { bare: true },
    layout: {
      ...(height !== undefined ? { height } : { flex: 1 }),
      width: w - B.card * 2, direction: 'row', align: 'center', justify: 'center', padding: 0,
    },
    children: [child],
  });
  const kids: LayoutNode[] = [
    band(`key-${h}-nb`, stripH, { type: 'Label', id: `key-${h}-n`, // 稿子的卡面写「石 · 石头」，中文读起来是**同一个词说两遍**（owner 2026-08-07 当场指出）
      // → 中英一律只用全名：石头 / 布 / 剪刀 · Rock / Paper / Scissors。
      // 短名（石/剪/布 · RK/PP/SC）只留给判定表和判定结论那种要压缩的地方。
      props: { text: handFull(view.lang, h), size: Math.round(S.cardStrip * (1 + k * 0.5)), font: F.cjk, color: 'text' } }),
    band(`key-${h}-ib`, undefined, { type: 'Image', id: `key-${h}-i`, props: { src: HAND_ICON_SRC[h], alt: HAND_CN[h], fit: 'contain' }, layout: { width: iconW, height: iconH } }),
    ...(big ? [{
      // 定稿的放大卡**卡底带一排蓄力格**——玩家在放大态挑手时，那只手现在几层要看得见，
      // 不该逼他把视线拉回底栏。小卡态不画（底栏槽就在正下方，重复了）。
      type: 'Panel', id: `key-${h}-pips`, props: { bare: true },
      layout: { width: w - B.card * 2 - 44, height: 30, direction: 'row', justify: 'center', gap: 10, padding: 0 },
      children: [1, 2, 3].map((i) => pip('p1', h, i, lv, full, true)),
    } as LayoutNode] : []),
    band(`key-${h}-sb`, subH, { type: 'Label', id: `key-${h}-s`, props: { text: sub, size: Math.round(enSize(view.lang, throwing ? S.cardSub2 : S.cardSub) * (1 + k * 0.5)), font: F.cjk, color: disabled ? 'dim' : 'ink' } }),
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
        // 满格牌定稿是 `#d5c8b0` 面 + `saturate(.35)`（不是我原来的通用 disabled 灰）。
        w, h: hgt, fill: disabled ? (full ? C.cardFull : C.disabled) : C.cream, border: bw, radius: rad,
        shadow: selected ? 2 : (big ? BIG_CARD.shadow : SH.card), shadowColor: selected ? C.goldDeep : 'rgba(0,0,0,.42)',
        strip: { color: CARD_COLOR[h], h: stripH }, subBar: { h: subH },
        // 【R-108-07】注水：选中的那张从下往上灌，带一条亮水线（不是整块换色）。
        ...(pour > 0 ? { fillLevel: { level: pour, color: CARD_WATER[h], lineColor: 'rgba(255,255,255,.85)' } } : {}),
        ...(selected ? { outline: { color: C.gold, w: big ? 8 : 6 } } : {}),
        ...(disabled ? { opacity: 0.62 } : {}),
      }),
      ...(disabled ? {} : { action: charging ? ACT.charge(h) : ACT.throw(h) }),
    },
    layout: {
      x: cardX, y: lerp(BOTTOM_INNER_Y + (selected ? 5 : 0), BIG.y),
      width: w, height: hgt,
      direction: 'column', align: 'center', justify: 'start', gap: 0, padding: B.card, allowOverlap: true,
    },
    children: kids,
  };
}

/**
 * 【R-108-09】蓄力回撤：从"开打前是几层"一格一格退到当前值，每格 180ms。
 * 只在 T3 演（T4 是玩家闸门，可以停很久，退到一半停住就成了穿帮）。
 */
const DRAIN_PER_PIP = 90;   // 定稿 §④：每格延迟 90ms（整段 520ms）
function drainedLevel(view: DuelView, h: Hand, lv: number): number {
  const was = view.before?.charge.p1[h];
  if (was === undefined || was <= lv || view.phase !== 'clash') return lv;
  const gone = Math.floor(Math.max(0, view.elapsedMs - DRAIN_DELAY) / DRAIN_PER_PIP);
  return Math.max(lv, was - gone);
}

/** 我方一格蓄力槽（**底栏最重的元素**·稿子把重量给了我方这三格，见 README 的偏差说明）。 */
function mySlot(view: DuelView, h: Hand, idx: number): LayoutNode {
  const lv = view.charge.p1[h];
  // 【R-108-09】**蓄力回撤**：出过的手清零时演出式退回，不是瞬间归零——
  // 玩家要看见"我这一下花掉了什么"。灯一格一格灭（不是连续条），所以按时间算显示层数。
  const lvShown = drainedLevel(view, h, lv);
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
        children: [1, 2, 3].map((i) => pip('p1', h, i, lvShown, full, true)),
      },
    ],
  };
}

function smokeKey(view: DuelView): LayoutNode {
  const off = view.phase === 'clash' || view.phase === 'settle' || view.notStarted === true;
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
          size: view.lang === 'en' ? 13 : S.smokeSub, font: F.num, color: 'dim',
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
        // 定稿 §⑦ 的正式解：**MY CHARGE 横排两行 20px、列宽 46→92px**（不动 56px 那一列，是加宽标签列）。
        layout: { width: view.lang === 'en' ? 92 : 56, direction: 'column', align: 'center', gap: 0 },
        children: [
          { type: 'Label', id: 'my-slots-t1', props: { text: t(view.lang, 'slots.mine.a'), size: view.lang === 'en' ? 20 : S.label, font: F.cjk, color: 'jade' } },
          { type: 'Label', id: 'my-slots-t2', props: { text: t(view.lang, 'slots.mine.b'), size: view.lang === 'en' ? 20 : S.label, font: F.cjk, color: 'jade' } },
        ],
      }],
    },
    ...HANDS.map((h, i) => mySlot(view, h, i)),
    // 【R-108-07】底栏原位的虚影（卡升起时）——定稿要求「保住底栏高度不塌」。
    ...HANDS.map((h, i) => cardGhost(view, h, i)).filter((n): n is LayoutNode => n !== null),
    ...HANDS.map((h, i) => moveCard(view, h, i)),
    ...chargeParticles(view),
    smokeKey(view),
  ];
}

/**
 * 【R-108-07】③ **粒子注入** —— 逐条照设计定稿 v3。
 *
 * 定稿的规格（`design_v3` §② 原文）：起手一圈**爆环**（100px 圆、26px 描边取牌色，0.5s 内涨到 2.6 倍
 * 并收边到 2px），随后 **14 颗**射出，直径 12–30 六档，芯白 → 牌色 → 牌色 75% 径向渐变，
 * 外挂 26px 同色光晕 + 5px 白描边；先向上窜 90px 再俯冲，飞行 **600ms**、每颗错开 36ms；
 * 落点一记 200×130 的**同色落地光晕**。**只有被选中的那一张发粒子**，另两张不发。
 *
 * 起点/落点也是定稿写死的绝对 px：`SRC={rock:524,paper:960,scissors:1396}`（放大卡的中线）、
 * `TGT={rock:842,paper:1145,scissors:1447}`（我方三槽的中线）——与本文件的 `mySlot` 落点严丝合缝。
 *
 * 定稿自己标了「这套 CSS 粒子只是形态与节奏的稿，真机建议换引擎粒子器」，并点名接口
 * `layout.flyTo{to,ms,arc}`。故这里用基座件的 flyTo 走真路径，形态/数量/配色照抄。
 */
const PARTICLE_SRC: Record<Hand, number> = { rock: 524, paper: 960, scissors: 1396 };
const PARTICLE_SIZES = [16, 24, 12, 30, 18, 22, 14, 26, 20, 12, 28, 16, 22, 18] as const;

function chargeParticles(view: DuelView): LayoutNode[] {
  const c = view.charged;
  const p = particlePhase(view);
  if (!c || p < 0) return [];
  const col = CARD_COLOR[c.hand];
  const sx = PARTICLE_SRC[c.hand];
  const out: LayoutNode[] = [];
  // ① 爆环：0.5s 内 100px → 2.6 倍、描边 26px → 2px（量化到 0.1 档防每帧新皮）。
  const burst = clamp01(p / (500 / PARTICLE_MS));
  if (burst < 1) {
    const size = Math.round(100 * (1 + 1.6 * q(burst, 0.1)));
    const ring = Math.max(2, Math.round(26 - 24 * q(burst, 0.1)));
    out.push({
      type: 'Image', id: 'spark-burst',
      props: { src: plate({ w: size, h: size, fill: 'rgba(0,0,0,0)', border: ring, borderColor: col, radius: 999 }), alt: '', fit: 'fill' },
      layout: { x: Math.round(sx - size / 2), y: Math.round(424 + 50 - size / 2), width: size, height: size, allowOverlap: true },
    });
  }
  // ② 14 颗：定稿的直径表与起点散布；飞向该手那一格（`layout.flyTo` 是基座件）。
  for (let i = 0; i < 14; i++) {
    const size = PARTICLE_SIZES[i]!;
    const ox = sx + ((i % 7) - 3) * 18, oy = 468 + ((i % 3) - 1) * 10;
    out.push({
      type: 'Panel', id: `spark-${i}`,
      props: { skin: plate({ w: size, h: size, fill: col, border: 5, borderColor: 'rgba(255,255,255,.4)', radius: 999, glow: col }) },
      layout: {
        x: Math.round(ox - size / 2), y: oy, width: size, height: size, allowOverlap: true,
        // arc 让它先窜上去再俯冲（定稿：向上 90px 再下扎）；每颗错开 36ms。
        flyTo: { to: `cb-p1-${c.hand}`, ms: PARTICLE_MS, arc: 90, delay: i * 36 },
      },
    } as LayoutNode);
  }
  return out;
}

/** 【R-108-07】底栏原位的**虚影**（定稿：同尺寸 5px 虚线、面 rgba(255,246,226,.10)、标「已升起」·保住底栏不塌）。 */
function cardGhost(view: DuelView, h: Hand, idx: number): LayoutNode | null {
  if (cardGrow(view, idx) < 0.15) return null;
  const w = L.card.w, hgt = BOTTOM_INNER_H;
  return {
    type: 'Panel', id: `ghost-${h}`,
    props: {
      skin: plate({ w, h: hgt, fill: 'rgba(255,246,226,.10)', border: 5, borderColor: 'rgba(255,246,226,.42)', radius: R.card, dashed: true }),
    },
    layout: {
      x: SMALL_XS[idx] ?? 0, y: BOTTOM_INNER_Y, width: w, height: hgt,
      direction: 'row', align: 'center', justify: 'center', padding: 0, allowOverlap: true,
    },
    children: [{ type: 'Label', id: `ghost-${h}-t`, props: { text: t(view.lang, 'card.badgeRisen'), size: 20, font: F.cjk, color: 'sub' } }],
  };
}

/** 【R-108-08】T1 顶上那条提示（定稿：「选一手蓄力 · 每回合只能加一层」——把 v3 的新规则直接写在屏上）。 */
function pickHint(view: DuelView): LayoutNode | null {
  if (view.phase !== 'charge') return null;
  const txt = t(view.lang, 't1.pick');
  const w = Math.round(txt.length * 24 * CHAR_W[view.lang] + 96);
  return {
    type: 'Panel', id: 'pick-hint',
    props: { skin: plate({ w, h: 46, fill: 'rgba(24,17,12,.86)', border: 4, radius: R.pill }) },
    layout: {
      // y=104：顶栏（0–97）之下、判定表石板（155 起）之上。
      // 放 150 会和石板撞（真渲染目击：提示条把石板的标题条压掉了）。
      x: Math.round((CANVAS.w - w) / 2), y: 104, width: w, height: 46,
      direction: 'row', align: 'center', justify: 'center', padding: 0, allowOverlap: true,
    },
    children: [{ type: 'Label', id: 'pick-hint-t', props: { text: txt, size: 24, font: F.cjk, color: 'text' } }],
  };
}

/**
 * 【R-108-05】T4 的「下一轮」键。**与终局屏的「再来一局」是两个键**——
 * 同一个动作名 `duel.next`，但落点不同（这里是世界闸门，那里是宿主换局），
 * 风格该有关联（同款糖果皮）但文案不能混：混了玩家会以为点一下就重开整局。
 */
function nextKey(view: DuelView): LayoutNode {
  // 定稿 §⑤：居中 x 960、**y 706–790**（底栏之上 10px）、**320×84**、奶油面 + 墨边 + 金色底影、字 40px。
  // 与终局「再来一局」的区别是定稿明写的：那颗是**金面 44px 宽 460**，这颗是**奶油面、更小**
  // ——同族不同重，不会认错。（我第一版占了三张卡的整条位置，比定稿重得多，已按稿改回。）
  const w = 320, hgt = 84;
  return {
    // id 与终局屏那枚**故意不同名**（那枚是 `key-next`）：同名的话试玩走查分不清自己点的是
    // 「进下一回合」还是「重开整局」——2026-08-07 那个死键就是靠"点了它到底该发生什么"抓出来的。
    type: 'Panel', id: 'key-nextround',
    props: {
      skin: plate({ w, h: hgt, fill: C.cream, border: B.card, radius: R.pill, shadow: SH.cta, shadowColor: C.goldDeep }),
      action: ACT.next,
    },
    layout: {
      width: w, height: hgt,
      direction: 'row', align: 'center', justify: 'center', padding: 0,
      anim: 'pop', animMs: 260,
    },
    children: [{ type: 'Label', id: 'key-nextround-t', props: { text: t(view.lang, 'end.nextRound'), size: 40, font: F.cjk, color: 'ink' } }],
  };
}

/**
 * 开始屏（owner 2026-08-08 要）。**设计定稿里没有这一屏**——所以照它的终局屏同一套语言拼：
 * 奶油渐变面 + 墨边 + 硬边投影，主键沿用定稿给「再来一局」的规格（金面·宽 460）。
 * 已在对账单里记为「稿子没画、我按同族语言拼的」，等设计方正式定稿。
 */
function startScreen(view: DuelView): LayoutNode[] {
  const w = 900, hgt = 520;
  const x = Math.round((CANVAS.w - w) / 2), y = Math.round((CANVAS.h - hgt) / 2);
  return [
    {
      type: 'Image', id: 'start-veil',
      props: { src: plate({ w: CANVAS.w, h: CANVAS.h, fill: 'rgba(16,11,8,.72)', radius: 0 }), alt: '', fit: 'fill' },
      layout: { x: 0, y: 0, width: CANVAS.w, height: CANVAS.h, allowOverlap: true },
    },
    {
      type: 'Panel', id: 'start',
      props: { skin: plate({ w, h: hgt, fill: [C.cream, '#f4e2c4'], border: B.end, radius: R.end, shadow: SH.end, shadowColor: 'rgba(0,0,0,.35)' }) },
      layout: {
        x, y, width: w, height: hgt, direction: 'column', align: 'center', justify: 'center', gap: 16, padding: 44,
        anim: 'pop', animMs: 320, allowOverlap: true,
      },
      children: [
        { type: 'Label', id: 'start-t', props: { text: t(view.lang, 'start.title'), size: 96, font: F.cjk, color: 'ink' }, layout: { height: 108 } },
        { type: 'Label', id: 'start-s', props: { text: t(view.lang, 'start.sub'), size: 30, font: F.cjk, color: 'dim' } },
        {
          type: 'Panel', id: 'key-start',
          props: {
            skin: plate({ w: 460, h: 104, fill: [C.goldFillA, C.goldFillB], border: B.end, radius: R.pill, shadow: SH.cta, shadowColor: C.goldDeep }),
            action: UI_ACT.start,
          },
          layout: { width: 460, height: 104, direction: 'row', align: 'center', justify: 'center', padding: 0 },
          children: [{ type: 'Label', id: 'key-start-t', props: { text: t(view.lang, 'start.go'), size: 52, font: F.cjk, color: 'ok' } }],
        },
        { type: 'Label', id: 'start-tip', props: { text: t(view.lang, 'start.tip'), size: 22, font: F.cjk, color: 'sub' } },
      ],
    },
  ];
}

/**
 * 【R-108-21/22】烟雾**演出**（owner 2026-08-08：「烟雾完全没有效果啊，要有一个效果…
 * 从这个烟雾地方飞上去，有个粒子的烟雾特效之类的…比如说遮住他的眼睛」）。
 *
 * 三样：① 从烟雾键升起的粒子雾（`Particles` 是基座件——`kind:'sparkle'`，
 * 定色/定向/拖尾归 `REQ-UIFX` 那张单，到货后换）② 我方三槽罩一层雾
 * ③ 对手画像上一枚「看不见」的标 —— 这一枚才是**信息**：告诉玩家「这两回合他真的读不到你」。
 *
 * ⚠ 规则那一半（AI 真的读不到）**不在这里**，在 `blueprint.ts` 的决策表里，
 * 且要等 gdd §9.0 的 A/B/C 裁完才动——现在 AI 压根不读蓄力，所以烟雾在规则上还是空转的。
 * **这一屏只做"看得见"，不假装"已经生效"**（假装 = 比没做还糟）。
 */
function smokeFx(view: DuelView): LayoutNode[] {
  if (!view.smoke.hidden) return [];
  const out: LayoutNode[] = [];
  // ① 粒子雾：从烟雾键正上方升起（键在底栏最右，见 smokeKey 的落点）。
  const sx = CANVAS.w - L.bottom.pad[1] - L.smoke.w;
  out.push({
    type: 'Particles', id: 'smoke-fx',
    props: { kind: 'sparkle', count: 22, loop: true },
    layout: { x: sx, y: L.bottom.y - 300, width: L.smoke.w, height: 320, allowOverlap: true },
  } as LayoutNode);
  // ② 我方三槽罩雾（雾是"对手看不见"的可视化——我自己仍然读得到底下的数字，故用半透）。
  out.push({
    type: 'Image', id: 'smoke-veil',
    props: { src: plate({ w: 992, h: BOTTOM_INNER_H, fill: ['rgba(226,232,240,.34)', 'rgba(203,213,225,.20)'], radius: R.mySlotBox }), alt: '', fit: 'fill' },
    layout: { x: 620, y: BOTTOM_INNER_Y, width: 992, height: BOTTOM_INNER_H, allowOverlap: true },
  });
  // ③ 对手画像上的「看不见」标 —— 玩家要的确认在这儿。
  const w = 132;
  out.push({
    type: 'Panel', id: 'smoke-blind',
    props: { skin: plate({ w, h: 32, fill: 'rgba(24,17,12,.82)', border: 3, radius: R.pill }) },
    layout: {
      x: CANVAS.w - 18 - w, y: 92, width: w, height: 32,
      direction: 'row', align: 'center', justify: 'center', padding: 0, allowOverlap: true,
    },
    children: [{ type: 'Label', id: 'smoke-blind-t', props: { text: t(view.lang, 'smoke.blind'), size: 19, font: F.cjk, color: 'text' } }],
  });
  return out;
}

/**
 * 玩法说明（owner 2026-08-08 要·从设置菜单里进）。
 * 写法受 §0 验收铁律约束：本作**零记忆零算术**——**说明本身也不许要求玩家记东西或心算**，
 * 所以只写「四拍各干什么 + 三条规则 + 一句为什么」，不列公式、不讲概率。
 */
function helpScreen(view: DuelView): LayoutNode[] {
  const lang = view.lang;
  const w = 1060, hgt = 760;
  const x = Math.round((CANVAS.w - w) / 2), y = Math.round((CANVAS.h - hgt) / 2);
  const head = (id: string, key: StringKeyOf): LayoutNode => ({
    type: 'Label', id: `help-${id}`, props: { text: t(lang, key), size: 30, font: F.cjk, color: 'ok' },
  });
  const line = (id: string, key: StringKeyOf): LayoutNode => ({
    type: 'Label', id: `help-${id}`, props: { text: t(lang, key), size: enSize(lang, 26), font: F.cjk, color: 'ink' },
  });
  return [
    {
      type: 'Image', id: 'help-veil',
      props: { src: plate({ w: CANVAS.w, h: CANVAS.h, fill: 'rgba(16,11,8,.72)', radius: 0 }), alt: '', fit: 'fill' },
      layout: { x: 0, y: 0, width: CANVAS.w, height: CANVAS.h, allowOverlap: true },
    },
    {
      type: 'Panel', id: 'help',
      props: { skin: plate({ w, h: hgt, fill: [C.cream, '#f4e2c4'], border: B.end, radius: R.end, shadow: SH.end, shadowColor: 'rgba(0,0,0,.35)' }) },
      layout: {
        x, y, width: w, height: hgt, direction: 'column', align: 'start', justify: 'center', gap: 10, padding: 48,
        anim: 'pop', animMs: 280, allowOverlap: true,
      },
      children: [
        { type: 'Label', id: 'help-t', props: { text: t(lang, 'help.title'), size: 48, font: F.cjk, color: 'ink' }, layout: { height: 60 } },
        {
          type: 'Image', id: 'help-div',
          props: { src: plate({ w: w - 96, h: 4, fill: 'rgba(63,43,30,.22)', radius: 2 }), alt: '', fit: 'fill' },
          layout: { width: w - 96, height: 4 },
        },
        head('h1', 'help.beats'),
        line('t1', 'help.t1'), line('t2', 'help.t2'), line('t3', 'help.t3'), line('t4', 'help.t4'),
        head('h2', 'help.rules'),
        line('r1', 'help.r1'), line('r2', 'help.r2'), line('r3', 'help.r3'),
        line('pen', 'help.penalty'),
        { type: 'Label', id: 'help-tell', props: { text: t(lang, 'help.tell'), size: enSize(lang, 24), font: F.cjk, color: 'dim' } },
        {
          type: 'Panel', id: 'key-help-close',
          props: { skin: plate({ w: 260, h: 66, fill: C.cream, border: B.card, radius: R.pill, shadow: SH.card }), action: UI_ACT.help },
          layout: { width: 260, height: 66, direction: 'row', align: 'center', justify: 'center', padding: 0 },
          children: [{ type: 'Label', id: 'key-help-close-t', props: { text: t(lang, 'menu.close'), size: 28, font: F.cjk, color: 'ink' } }],
        },
      ],
    },
  ];
}

function settingsMenu(view: DuelView): LayoutNode[] {
  const a = view.audio ?? { bgm: true, sfx: true, voice: true };
  const w = 620, hgt = 470;
  const x = (CANVAS.w - w) / 2, y = (CANVAS.h - hgt) / 2;
  /** 一行：左边名字，右边一枚可点的值键。 */
  const row = (id: string, label: string, value: string, action: string, on: boolean, i: number): LayoutNode => ({
    type: 'Panel', id: `menu-${id}`, props: { bare: true },
    layout: {
      width: w - 96, height: 62, direction: 'row', align: 'center', justify: 'between', gap: 12,
      ...(i === 0 ? {} : {}),
    },
    children: [
      { type: 'Label', id: `menu-${id}-l`, props: { text: label, size: 30, font: F.cjk, color: 'ink' } },
      {
        type: 'Panel', id: `key-${id}`,
        props: {
          skin: plate({
            w: 180, h: 56, fill: on ? C.gold : C.disabled, border: B.card, radius: R.card,
            shadow: SH.chip, shadowColor: on ? C.goldDeep : 'rgba(0,0,0,.3)',
          }),
          action,
        },
        layout: { width: 180, height: 56, direction: 'row', align: 'center', justify: 'center', padding: 0 },
        children: [{ type: 'Label', id: `key-${id}-t`, props: { text: value, size: 26, font: F.cjk, color: 'ink' } }],
      },
    ],
  });
  const on = t(view.lang, 'menu.on'), off = t(view.lang, 'menu.off');
  return [
    {
      // 点幕布也能关——菜单只有一个出口的话，玩家会去找 X（稿子没画 X）。
      type: 'Image', id: 'menu-veil',
      props: { src: plate({ w: CANVAS.w, h: CANVAS.h, fill: 'rgba(16,11,8,.62)', radius: 0 }), alt: '', fit: 'fill' },
      layout: { x: 0, y: 0, width: CANVAS.w, height: CANVAS.h, allowOverlap: true },
    },
    {
      type: 'Panel', id: 'menu',
      props: { skin: plate({ w, h: hgt, fill: [C.cream, '#f4e2c4'], border: B.end, radius: R.end, shadow: SH.end, shadowColor: 'rgba(0,0,0,.35)' }) },
      layout: {
        x, y, width: w, height: hgt, direction: 'column', align: 'center', justify: 'center', gap: 10, padding: 40,
        anim: 'pop', animMs: 260, allowOverlap: true,
      },
      children: [
        { type: 'Label', id: 'menu-t', props: { text: t(view.lang, 'menu.title'), size: 46, font: F.cjk, color: 'ink' } },
        // 定稿 §⑧：**标题下加一条 4px 分隔**（其余——620 宽 / 四行 62px / 开关 180×56 金面 /
        // 关闭键降为奶油面「菜单里没有第二颗主键」——我这版本来就对上了）。
        {
          type: 'Image', id: 'menu-div',
          props: { src: plate({ w: w - 96, h: 4, fill: 'rgba(63,43,30,.22)', radius: 2 }), alt: '', fit: 'fill' },
          layout: { width: w - 96, height: 4 },
        },
        row('bgm', t(view.lang, 'menu.bgm'), a.bgm ? on : off, UI_ACT.bgm, a.bgm, 0),
        row('sfx', t(view.lang, 'menu.sfx'), a.sfx ? on : off, UI_ACT.sfx, a.sfx, 1),
        row('voice', t(view.lang, 'menu.voice'), a.voice ? on : off, UI_ACT.voice, a.voice, 2),
        row('lang', t(view.lang, 'menu.lang'), t(view.lang, view.lang === 'zh' ? 'menu.langZh' : 'menu.langEn'), UI_ACT.lang, true, 3),
        // owner 2026-08-08：说明文档从这里进（菜单里第五行·不是第二颗主键，样式同前四行）。
        row('help', t(view.lang, 'help.open'), '?', UI_ACT.help, true, 4),
        {
          type: 'Panel', id: 'key-menu-close',
          props: { skin: plate({ w: 220, h: 60, fill: C.cream, border: B.card, radius: R.card, shadow: SH.card }), action: UI_ACT.menu },
          layout: { width: 220, height: 60, direction: 'row', align: 'center', justify: 'center', padding: 0 },
          children: [{ type: 'Label', id: 'key-menu-close-t', props: { text: t(view.lang, 'menu.close'), size: 26, font: F.cjk, color: 'ink' } }],
        },
      ],
    },
  ];
}

/** 字幕（配音的兜底·手册「兜底③ = 提示音 + 字幕」）：听不见也要看得见他说了什么。 */
function subtitle(view: DuelView): LayoutNode | null {
  if (!view.subtitle) return null;
  const w = Math.round(view.subtitle.length * 26 * CHAR_W[view.lang] + 80);
  // 结果横幅在场时**让到横幅上方**：两者原本都想占 y≈726 那条带
  // （横幅是自适应高度的列，伤害数字一大就往下长），真渲染目击过字幕把「伤害落定」压掉一半
  // （`S4-play-2c-settle-gate.png`）。横幅是战果、字幕是角色台词，谁也不该盖谁。
  const y = view.outcome && (view.phase === 'clash' || view.phase === 'settle') ? 320 : L.bottom.y - 74;
  return {
    type: 'Panel', id: 'subtitle',
    props: { skin: plate({ w, h: 52, fill: 'rgba(24,17,12,.86)', border: 4, radius: R.pill }) },
    layout: {
      x: (CANVAS.w - w) / 2, y, width: w, height: 52,
      direction: 'row', align: 'center', justify: 'center', padding: 0, allowOverlap: true,
    },
    children: [{ type: 'Label', id: 'subtitle-t', props: { text: view.subtitle, size: 26, font: F.cjk, color: 'text' } }],
  };
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
  // 【R-108-05】「下一轮」**挂进结果横幅那一列的末尾**（定稿 T4 稿图里它就在「伤害落定」正下方）。
  // 为什么不摆成独立绝对定位节点：横幅是**自适应高度的列**，伤害数字一大它就往下长——
  // 摆 y706 那一版真渲染实测过：掉 20 没事，掉 40 时横幅长到 ~750，把键压住 ⇒
  // 探针点在横幅上、**世界零反应且零报错**，试玩当场卡在结算（2026-08-08 第二次撞同一形状）。
  // 挂进同一列 = 由布局保证不重叠，横幅多高都跟着走。
  if (b && view.awaitNext) b.children = [...(b.children ?? []), nextKey(view)];
  const sub = subtitle(view);
  const veil = hitVeil(view);   // 罚血**不**用红纱了：定稿要它与挨打分得开，改走欠账牌 + 血条渗滴
  // 【R-108-06】红色**震动**：整块舞台连人带 UI 一起抖（幅度随掉血量·见 shakeAmp）。
  // 抖的是根面板的落点，所以画布要留出 shake 的余量——`allowOverlap` 下超出部分被裁掉，
  // 而背景本来就是满画布铺的，抖出来的那几像素露的是舞台外框色，正是格斗游戏里那种"顿一下"。
  const sk = hitShake(view);
  return {
    type: 'Panel', id: 'duel-screen', props: { bare: true },
    layout: { x: sk.dx, y: sk.dy, width: CANVAS.w, height: CANVAS.h, padding: 0 },
    children: [
      stageBg(),
      armNode('p1'), armNode('p2'),
      ...topBar(view),
      foeStrip(view),
      ...(view.phase === 'charge' ? [] : [ruleSlab(view.lang)]),
      handNode(view, 'p1'), handNode(view, 'p2'),
      ...(b ? [b] : []),
      ...(over ? endPanel(view) : bottomBar(view)),
      // 没有横幅的结算（理论上罕见：平局且没亮手）也得留出口——否则玩家卡死在 T4。
      ...(view.awaitNext && !b ? [nextKey(view)] : []),
      // T1 放大态：判定表**改画在卡片之上**（定稿 T1b 稿图里它就压在中间那张牌上）——
      // 六条槽与判定表是这一拍唯一要读的两样东西，被自己的牌盖住就等于关掉了。
      ...(view.phase === 'charge' ? [ruleSlab(view.lang)] : []),
      ...(pickHint(view) ? [pickHint(view)!] : []),
      ...(sub ? [sub] : []),
      ...penaltyPanel(view), ...penaltyDrips(view),
      // 红纱压在对局层之上、菜单之下：它是打击感，不该盖住玩家正在操作的设置面板。
      ...(veil ? [veil] : []),
      ...smokeFx(view),
      ...(view.menuOpen ? settingsMenu(view) : []),
      ...(view.helpOpen ? helpScreen(view) : []),
      // 开始屏盖在最上面（含菜单）——还没开局时屏上只该有一个出口。
      ...(view.notStarted ? startScreen(view) : []),
    ],
  };
}

export function emptyView(): DuelView {
  const zero = (): Record<Hand, number> => ({ rock: 0, paper: 0, scissors: 0 });
  return {
    phase: 'charge', phaseLeft: 1, phaseSec: PHASE_TICKS.charge / TPS, elapsedMs: 0, round: 1,
    hp: { p1: HP_MAX, p2: HP_MAX },
    charge: { p1: zero(), p2: zero() },
    smoke: { uses: SMOKE_USES, hidden: false },
    foeName: DEFAULT_CARD.name,
    lang: 'zh',
    audio: { bgm: true, sfx: true, voice: true },
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
