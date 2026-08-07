// game108 手部美术 —— **程序化 data-URI SVG**（原创占位级·可整张替换）。
//
// 为什么是程序化而不是贴图文件：横版重构的主体是「手」，而手的美术还没有真图。
// 走 `UITheme.texture`/apollo-toon 同一路子（程序化 data-URI SVG·`docs/playbooks/ui.md` 在案）——
// 先把**结构**（三手型 × 两色系 × 镜像）钉死并真渲染出来，真图到位时只换 `handArt()` 的返回值，
// 消费端（`Image.src`）一行不动。**不落 public/ 目录 → 不产生黑户**（美术台账走真图那一步）。
//
// 画法（卡通厚描边·四遍）：
// ① 轮廓遍：全形状用 line 色描 20px 粗边**并填 line 色** → 并成一条外轮廓，内缝被自己的填充盖掉；
// ② 本色遍：同形状用 base 色纯填盖回内部，只剩外圈 10px 描边；
// ③ 结构遍：指缝/拇指轮廓用 line 色**空心描线** —— 没有这一遍，拳头就是一团圆角方块（首版真渲染目击）；
// ④ 光影遍：暗部 + 前臂高光，让平涂有体积。
// 一个 viewBox 只画**左手**（前臂从左边缘伸入·掌心朝右）；右手用 `layout.rotateY:180` 镜像，不另画。
//
// **两侧色系必须一眼可分**（owner 2026-08-07「两个拳哪个是我出的」那一问的美术侧答案）：
// 我方 = 暖浅肤 + 金袖口；对手 = 深赭肤 + 绯红袖口（明度与色相双重拉开·暗底上也不会认错）。

import type { Hand } from './theme.js';

/** 一套手的配色（肤色/暗部/描边/袖口）。 */
interface HandSkin {
  base: string;
  shade: string;
  line: string;
  cuff: string;
}

export const HAND_SKIN: Record<'p1' | 'p2', HandSkin> = {
  p1: { base: '#f0c79b', shade: '#c98f5f', line: '#2b1a10', cuff: '#e8cd82' },
  p2: { base: '#cf7a3e', shade: '#94501f', line: '#20100a', cuff: '#d0424b' },
};

/** viewBox（左手·前臂从左边缘伸入）。与 `HAND_ASPECT` 同源——屏那边按这个比例定框。 */
const VB = { x: -210, y: 40, w: 670, h: 260 };
export const HAND_ASPECT = VB.w / VB.h;

/**
 * 前臂（三手型共用）。左端**远远出画**——「从画外伸进来」的前提是根部永远看不见。
 * 厚度 74 ≈ 拳团高度（176）的四成：**这个比例是「像不像一只手」的开关**——
 * 首版前臂厚 98、拳团圆角 66，渲出来两截一样粗、还都是胶囊 ⇒ 整只手读作一根面包（真渲染目击）。
 */
const FOREARM = '<path d="M-220 122 L40 140 L130 148 L130 200 L40 208 L-220 226 Z"/>';
/** 腕带（单独一色·卡在最细的腕上 → 读作护腕；圆角别开太大，否则渲成一颗蛋）。 */
const CUFF = '<rect x="56" y="138" width="48" height="74" rx="12"/>';

/** 三手型的实心形状（不含前臂/腕带）。掌心朝右 = 出招方向。 */
const SHAPES: Record<Hand, string> = {
  // 握拳：拳团（近正方·rx 小 → 有棱角）+ 右缘四节指关节 + 横压在下前方的拇指。
  rock:
    '<rect x="140" y="82" width="186" height="176" rx="46"/>'
    + '<circle cx="326" cy="106" r="24"/><circle cx="330" cy="150" r="25"/>'
    + '<circle cx="330" cy="194" r="25"/><circle cx="322" cy="232" r="22"/>'
    + '<rect x="176" y="204" width="152" height="56" rx="28"/>',
  // 张开：掌 + 四指向右铺开（指间留 8 的缝 → 描边后仍剩一道暗线 = 指缝）+ 斜下的拇指。
  paper:
    '<rect x="140" y="96" width="132" height="156" rx="40"/>'
    + '<rect x="258" y="84" width="150" height="40" rx="20"/>'
    + '<rect x="258" y="132" width="162" height="40" rx="20"/>'
    + '<rect x="258" y="180" width="148" height="40" rx="20"/>'
    + '<rect x="254" y="228" width="118" height="36" rx="18"/>'
    + '<rect x="150" y="222" width="120" height="48" rx="24" transform="rotate(14 150 222)"/>',
  // 剪：拳团 + 张开成 V 的食指与中指 + 收起的拇指。
  scissors:
    '<rect x="146" y="130" width="170" height="128" rx="44"/>'
    + '<rect x="220" y="92" width="176" height="40" rx="20" transform="rotate(-20 220 112)"/>'
    + '<rect x="226" y="158" width="170" height="40" rx="20" transform="rotate(14 226 178)"/>'
    + '<rect x="180" y="206" width="118" height="50" rx="25"/>',
};

/**
 * 结构线（空心描线·**这一遍决定了拳头是不是一团面**）。
 * 首版漏了它 → 真渲染出来石头就是个圆角方块，指关节被自己的填充吃掉了。
 */
const GROOVE: Record<Hand, string> = {
  rock:
    '<path d="M238 128 H322"/><path d="M238 172 H324"/>'           // 折指之间的两道横缝
    + '<rect x="176" y="204" width="152" height="56" rx="28"/>',    // 拇指轮廓（兼第三道分界）
  paper:
    '<path d="M266 108 H286"/>'                                     // 掌与食指的交界
    + '<rect x="150" y="222" width="120" height="48" rx="24" transform="rotate(14 150 222)"/>',
  scissors:
    '<path d="M244 146 L372 124"/>'                                 // 两指之间的分缝
    + '<rect x="180" y="206" width="118" height="50" rx="25"/>',
};

/** 暗部（拇指/掌根压一层阴影·让平涂有体积）。 */
const SHADE: Record<Hand, string> = {
  rock: '<rect x="176" y="204" width="152" height="56" rx="28"/>',
  paper: '<rect x="150" y="222" width="120" height="48" rx="24" transform="rotate(14 150 222)"/>',
  scissors: '<rect x="180" y="206" width="118" height="50" rx="25"/>',
};

/**
 * 出一张手的 data-URI。
 * @param hand 手型（石/布/剪）
 * @param side 色系（我方暖浅肤金袖 / 对手深赭肤绯袖）
 */
export function handArt(hand: Hand, side: 'p1' | 'p2'): string {
  const s = HAND_SKIN[side];
  const body = FOREARM + SHAPES[hand];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}">`
    + `<g fill="${s.line}" stroke="${s.line}" stroke-width="20" stroke-linejoin="round">${body}${CUFF}</g>`
    + `<g fill="${s.base}">${body}</g>`
    + `<g fill="${s.cuff}">${CUFF}</g>`
    + `<g fill="${s.shade}" opacity="0.4">${SHADE[hand]}</g>`
    + `<g fill="none" stroke="${s.line}" stroke-width="9" stroke-linecap="round" opacity="0.85">${GROOVE[hand]}</g>`
    + '<rect x="-190" y="142" width="160" height="13" rx="6" fill="#ffffff" opacity="0.16"/>'
    + '</svg>';
  // **必须整串 %XX 化**：`render.ts` 的 `safeUrl` 会把 URL 里的 `'"()\` 与空白**直接剥掉**——
  // 而 `encodeURIComponent` 恰好不转义 `'()` 三个字符（规范里它们是 unreserved mark）。
  // 不补这三条 replace，`rotate(12 196 236)` 的括号会被剥成 `rotate12 196 236` ⇒ SVG 解析失败、**整只手不显示且不报错**。
  return `data:image/svg+xml,${encodeURIComponent(svg)
    .replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/'/g, '%27')}`;
}
