// game108 手部美术 —— **逐形状抄自设计定稿**（`design/battle-screen.dc.html` 的内联 SVG）。
//
// 稿子里手是画在 `viewBox 0 0 700 700` 里的一组圆角矩形 + 一颗高光椭圆，
// 描边 15、`stroke-linejoin:round`，填一条 45° 的三段肤色渐变。**下面的坐标一个没动**——
// 这是 1:1 复刻的地基，动了就不是复刻了。
//
// 与稿子的三处差别，都是"落到我们这边必须做的换算"，不是改设计：
// ① 稿子的 `<svg overflow:visible>` 让图形能画出 viewBox 外（`布` 的拇指顶到 y≈−15，
//    `剪` 的食指顶到 x≈700）。我们走 `Image`，**超出 viewBox 会被裁掉**
//    → 把 viewBox 四周各放 40 单位、盒子按同比例放大并反向偏移，**画面缩放与落点分毫不变**。
// ② 右手在稿子里是 `transform:scaleX(-1)`；我们用 `layout.rotateY:180`（同一件事·闭集字段）。
// ③ 前臂在稿子里是独立的 div（**手会摇、前臂不摇**，所以不能烤进手的贴图）→ 这里也单出一张。
//
// 真美术到位时（稿子要 6 张 1280×1280 @2x 贴图）只换本文件的返回值，屏那边一行不动。

import type { Hand } from './theme.js';
import { C } from './design-tokens.js';

/** 稿子的 viewBox 是 0 0 700 700；我们四周各放 `PAD` 单位，防止溢出图形被裁。 */
const VB = 700;
const PAD = 40;
/** 盒子相对稿子 640×640 的放大倍率（把 PAD 换算进去）。 */
export const HAND_BOX_SCALE = (VB + PAD * 2) / VB;
/** 盒子相对稿子落点要反向偏移的比例（乘以稿子的 640 得到 px）。 */
export const HAND_BOX_SHIFT = PAD / VB;

/** 三手型的形状集 —— 逐字抄自 dc.html（左手；掌心朝右）。 */
const SHAPES: Record<Hand, string> = {
  rock:
    '<rect x="60" y="110" width="400" height="520" rx="190"/>'
    + '<rect x="300" y="122" width="288" height="142" rx="71" transform="rotate(-3 320 193)"/>'
    + '<rect x="305" y="256" width="315" height="142" rx="71"/>'
    + '<rect x="300" y="388" width="292" height="140" rx="70" transform="rotate(3 320 458)"/>'
    + '<rect x="292" y="512" width="248" height="132" rx="66" transform="rotate(7 312 578)"/>'
    + '<rect x="268" y="112" width="168" height="322" rx="84" transform="rotate(-10 352 273)"/>',
  paper:
    '<rect x="300" y="108" width="352" height="116" rx="58" transform="rotate(-16 330 166)"/>'
    + '<rect x="305" y="240" width="378" height="118" rx="59" transform="rotate(-3 335 299)"/>'
    + '<rect x="300" y="358" width="362" height="116" rx="58" transform="rotate(9 330 416)"/>'
    + '<rect x="285" y="458" width="310" height="110" rx="55" transform="rotate(22 315 513)"/>'
    + '<rect x="95" y="92" width="285" height="128" rx="64" transform="rotate(-44 200 156)"/>'
    + '<rect x="50" y="170" width="400" height="400" rx="180"/>',
  scissors:
    '<rect x="300" y="98" width="388" height="122" rx="61" transform="rotate(-13 330 159)"/>'
    + '<rect x="300" y="244" width="398" height="122" rx="61" transform="rotate(4 330 305)"/>'
    + '<rect x="60" y="215" width="400" height="400" rx="180"/>'
    + '<rect x="300" y="378" width="228" height="122" rx="61"/>'
    + '<rect x="292" y="490" width="206" height="116" rx="58"/>'
    + '<rect x="290" y="400" width="135" height="200" rx="67" transform="rotate(8 357 500)"/>',
};

/** 掌纹（只有「布」有·稿子里是两条 `stroke-width:10 opacity:.4` 的曲线）。 */
const CREASE: Record<Hand, string> = {
  rock: '',
  paper: '<path fill="none" stroke-width="10" d="M150 290 Q225 348 208 428"/>'
    + '<path fill="none" stroke-width="10" d="M220 300 Q292 360 278 445"/>',
  scissors: '',
};

/** 高光椭圆（逐手型各自的落点·稿子里我方 .45、对手 .34）。 */
const GLINT: Record<Hand, { cx: number; cy: number; rx: number; ry: number }> = {
  rock: { cx: 180, cy: 240, rx: 78, ry: 56 },
  paper: { cx: 150, cy: 270, rx: 66, ry: 48 },
  scissors: { cx: 160, cy: 320, rx: 68, ry: 50 },
};

const svgUri = (svg: string): string =>
  `data:image/svg+xml,${encodeURIComponent(svg).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/'/g, '%27')}`;

/** 一只手（左手朝向；右手由屏那边 `rotateY:180` 镜像）。 */
export function handArt(hand: Hand, side: 'p1' | 'p2'): string {
  const mine = side === 'p1';
  const skin = mine ? C.skinYou : C.skinOpp;
  const line = mine ? C.lineYou : C.lineOpp;
  const glintOpacity = mine ? 0.45 : 0.34;
  const creaseOpacity = mine ? 0.4 : 0.38;
  const g = GLINT[hand];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-PAD} ${-PAD} ${VB + PAD * 2} ${VB + PAD * 2}">`
    + `<defs><linearGradient id="sk" x1="0" y1="0" x2=".35" y2="1">`
    + `<stop offset="0" stop-color="${skin[0]}"/><stop offset=".55" stop-color="${skin[1]}"/>`
    + `<stop offset="1" stop-color="${skin[2]}"/></linearGradient></defs>`
    + `<g stroke="${line}" stroke-width="15" stroke-linejoin="round" fill="url(#sk)">${SHAPES[hand]}</g>`
    + (CREASE[hand] ? `<g stroke="${line}" opacity="${creaseOpacity}">${CREASE[hand]}</g>` : '')
    + `<ellipse cx="${g.cx}" cy="${g.cy}" rx="${g.rx}" ry="${g.ry}" fill="#fff" opacity="${glintOpacity}"/>`
    + '</svg>';
  return svgUri(svg);
}

/**
 * 前臂（贴屏幕边缘的独立件）。稿子：`430×158`、`border:15px solid <line>`、竖向两段肤色渐变，
 * 且**外侧那条边不画**（`border-left:none` / `border-right:none`）——它是被屏幕裁掉的断面。
 * 这里画法：矩形往外侧多伸 60 单位再由 viewBox 裁掉，外侧那条描边自然就没了。
 */
export function armArt(side: 'p1' | 'p2', w: number, h: number): string {
  const mine = side === 'p1';
  const skin = mine ? C.armYou : C.armOpp;
  const line = mine ? C.lineYou : C.lineOpp;
  const bw = 15;
  const over = 60;                                   // 往外侧多伸出去、被 viewBox 裁掉的那一截
  const x = mine ? -over : bw / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="${skin[0]}"/><stop offset="1" stop-color="${skin[1]}"/></linearGradient></defs>`
    + `<rect x="${x}" y="${bw / 2}" width="${w - bw / 2 + over}" height="${h - bw}"`
    + ` fill="url(#ar)" stroke="${line}" stroke-width="${bw}"/>`
    + '</svg>';
  return svgUri(svg);
}
