// game108 设计令牌 —— **逐字抄自设计定稿**，是 1:1 复刻的单一真相。
//
// 来源：`games/game108/design_handoff_rule_of_three_battle/`
//   · README.md「Design Tokens」节（颜色 / 字号 / 圆角 / 描边 / 投影）
//   · design/battle-screen.dc.html（每个盒子的绝对 px 与内联样式）
// 定稿画布 **1920 × 1080**；下面所有数字都是这块画布上的绝对 px。
//
// ⚠ 改这里 = 改设计。要改先回设计方（或记一条偏差），别在屏文件里就地调数字——
//   数字散开之后就再没人说得清「和稿子差了多少」。
//
// ⚠ 颜色一律裸 hex：设计定稿指定了整套配色，属 `PanelFill` 的「创作者特别指定」逃生口
//   （`docs/playbooks/ui.md` 面颜色行：①语义令牌 ②预设配色 ③`{custom:'#hex'}` 显式指定）。

// ── 画布 ──────────────────────────────────────────────────────────────
export const CANVAS = { w: 1920, h: 1080 } as const;

// ── 颜色（README「Colours」表）──────────────────────────────────────────
export const C = {
  ink: '#3f2b1e',            // 每一条描边、每一个边框
  cream: '#fff6e2',          // 卡 / 槽 / 键的面
  gold: '#ffc93c',           // 相位牌、蓄满、已提交、主 CTA
  goldDeep: '#c9932a',       // 金件的投影
  goldText: '#a8720b',       // 金面上的字
  goldFillA: '#ffe9a8',      // 蓄满渐变上
  goldFillB: '#ffd45e',      // 蓄满渐变下
  danger: '#ff5a45',         // 倒计时进入最后三分之一
  you: '#23b5a0',            // 我方主色（身份牌 / 血 / 槽框 / pip）
  youLt: '#7defd6',          // 我方血量数字、标签
  youDkShadow: '#14776a',    // 我方身份牌投影
  youDkText: '#08312c',      // 我方身份牌文字
  youSwatch: '#f9e2c8',      // 我方肤色小样
  opp: '#e0483f',            // 对手主色
  oppLt: '#ff9a8a',          // 对手血量数字、标签
  oppDkShadow: '#94261f',    // 对手身份牌投影
  oppText: '#fff2ec',        // 对手身份牌文字
  oppSwatch: '#f0a468',      // 对手肤色小样
  verdict: '#8e44ad',        // 判定结论胶囊
  dmgLose: '#ff6a58',        // 挨打时的伤害数字
  cardRock: '#2f7fd0',       // 石卡顶条
  cardPaper: '#31a83f',      // 布卡顶条
  cardScissors: '#c8214f',   // 剪卡顶条
  /** 满格招式卡的面色（设计定稿 v3：`#d5c8b0` + saturate(.35)，比通用 disabled 更「褪色」而非「变灰」）。 */
  cardFull: '#d5c8b0',
  disabled: '#cfc3b0',       // 不可点的面
  disabledText: '#9a8873',
  hpTrack: '#2b211a',        // 血槽底
  ringDisc: '#1b1410',       // 倒计时环中心盘
  slabFace: '#6d6257',       // 判定表石板
  slabHead: '#f2e6d2',
  slabText: '#fff8e7',
  textPri: '#e8d9c2',        // 正文一级
  textSec: '#7a6553',        // 二级
  textTer: '#8c7a68',        // 三级
  // 场景（README「Scene」）
  skyTop: '#5fc2ee', skyMid: '#9fdcf7', skyLow: '#d9f1ff',
  hillFar: '#6fb84e', hillNear: '#63ac46',
  grassTop: '#8ccf55', grassBottom: '#77bd45',
  // 手（README「skin-you / skin-opp」）
  skinYou: ['#fff3e2', '#fbe4cb', '#efcda9'] as const, lineYou: '#6b4a3a',
  skinOpp: ['#fdbc86', '#f79f62', '#e9834a'] as const, lineOpp: '#b5501a',
  armYou: ['#fdf0dd', '#eecfab'] as const,
  armOpp: ['#fdbc86', '#e9834a'] as const,
} as const;

// ── 版式（README「Typography」+ dc.html 逐处字号）──────────────────────
//
// 字体：稿子用 ZCOOL KuaiLe（站酷快乐体·卡通粗中文）+ Fredoka（圆润数字）。
//   · 中文 → **`cnround`**：PUI 2026-08-07 按 REQ-108-UI-04 补的第 5 款 CJK 艺术字槽，
//     就是 ZCOOL KuaiLe 本尊（SIL OFL·子集化 woff2·url 惰性载）。**与稿子同款，此项偏差已清。**
//   · 数字 → `bubbly`(Baloo 2)：与 Fredoka 同族圆润无衬线，是闭集里最近的替身（D2·记债不单开单）。
export const F = {
  cjk: 'cnround' as const,
  num: 'bubbly' as const,
} as const;

// ⚠ **中文一律不加 `bold`**：站酷快乐体只有 400 一个字重，`bold:true` 触发的是浏览器**合成粗体**
//   （把字形横向铺开），在这种圆粗展示体上只会糊成一团，稿子也是按 400 用的。
//   「字要饱满」这件事由字形本身解决——换字之前我用 bold 顶字重，是当时没有这款字的权宜。
//   数字那半仍走 `bold`：Baloo 2 有真 500/600/700，稿子指定 Fredoka 700。

/** 字号（画布 px·dc.html 逐处抄来）。 */
export const S = {
  endTitle: 96, verdict: 52, endStat: 52, cta: 44,
  hp: 38, slotRead: 38, resultLine: 38, phaseChip: 34,
  plate: 30, label: 27, slotName: 26, round: 26, cardSub2: 26,
  slab: 24, cardSub: 22, threat: 21, gear: 26,
  oppRead: 19, cardStrip: 20, endLabel: 18, slotDmg: 16, badge: 17,
  slabHead: 15, hpSlash: 15, smokeSub: 14, ringSec: 10, slabCap: 11,
  timer: 24, smokeIcon: 52, smokeName: 27,
} as const;

/** 伤害数字随数值放大（README：`fontSize = 56 + damage × 2.1` → 10/20/30/40 = 77/98/119/140）。 */
export const dmgFontSize = (damage: number): number => Math.round(56 + damage * 2.1);

// ── 构图（dc.html 的绝对 px·**每一个都能在稿子里指到出处**）──────────────
export const L = {
  topBar: { x: 0, y: 0, w: 1920, h: 97 },
  idPlate: { w: 230, h: 44 },
  hpBlock: { w: 290 },
  hpTrack: { h: 22 },
  ring: 78, ringDisc: 60,
  gear: { x: 1848, y: 112, size: 52 },

  /** 手方框：左 (250,150) 640×640，右镜像。 */
  handBox: { off: 250, top: 150, size: 640 },
  /** 前臂：贴屏幕边缘的独立件（不烤进手的贴图——手会摇，前臂不摇）。 */
  arm: { y: 420, w: 430, h: 158 },

  /** 中线区 x 883–1037（46–54%）。 */
  lane: { x: 883, w: 154 },
  slab: { y: 172 },
  banner: { x: 460, y: 392, w: 1000 },

  /** 右上：对手蓄力条（right:112 → x = 1920-112-620）。 */
  oppStrip: { x: 1920 - 112 - 620, y: 110, w: 620 },

  /** 底栏 y 800–1080。 */
  bottom: { x: 0, y: 800, w: 1920, h: 280, pad: [14, 20] as const, gap: 18 },
  card: { w: 186 },
  smoke: { w: 270 },

  end: { w: 840 },
} as const;

/** 圆角 / 描边 / 投影（README 三张小表）。 */
export const R = { pill: 999, end: 28, mySlotBox: 18, card: 16, oppChip: 14, chip: 12, swatch: 8, myPip: 6, oppPip: 3 } as const;
export const B = { end: 9, verdict: 6, card: 5, plate: 4, oppChip: 3 } as const;
export const SH = { cta: 8, card: 7, mySlot: 6, chip: 5, plate: 4, end: 20 } as const;
