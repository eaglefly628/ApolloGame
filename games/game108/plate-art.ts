// game108 面片美术 —— **把设计稿的"面"程序化生成成贴图**（`Panel.skin` / `Image.src` 吃）。
//
// 为什么需要这一层：设计定稿的招牌是 **粗墨描边 + 平移投影**（`0 7px 0 rgba(0,0,0,.4)` 这种硬边偏移，
// 不是模糊阴影）+ 逐件指定的渐变面。我们的 `Panel` 给得了边框和圆角，**给不了偏移投影**，
// 也给不了逐件自定义渐变——闭集里只有语义令牌和 8 款预设配色。
//
// 两条路：① 提缺口单给 Panel 加 `shadow`/`fill` 自由字段（放宽闭集·影响全库）；
//        ② **把"面"当美术做**——生成一张画好了描边和投影的贴图，用既有的 `Panel.skin` 贴上去，
//           文字与数值照常用 LayoutNode 渲在皮之上（`REQ-PANELSKIN` 的原意就是这个）。
// 选 ②：不动引擎、不放宽闭集、逐件像素可控，且**换真美术时只换这张图**。
//
// 所有函数返回 data-URI。转义口径同 `hand-art.ts`：`render.ts::safeUrl` 会剥掉 `'"()\` 与空白，
// 所以整串 `encodeURIComponent` 之后还要补 `( ) '` 三个字符。

/** 竖向渐变（两段）或纯色。 */
export type Fill = string | readonly [string, string];

export interface PlateSpec {
  w: number;
  h: number;
  fill: Fill;
  /** 墨描边宽（设计里恒为 `C.ink`，可覆盖）。0 = 无边。 */
  border?: number;
  borderColor?: string;
  radius: number;
  /** 平移投影高度 px（`0 Npx 0`）。面会相应缩短 N px——投影是画在盒子里的。 */
  shadow?: number;
  shadowColor?: string;
  /** 顶部内高光（判定表石板的 `inset 0 3px 0 rgba(255,255,255,.22)`）。 */
  insetTop?: string;
  /** 外发光圈（蓄满脉冲的静态形态）。 */
  glow?: string;
  /** 顶部色条（招式卡的「石 / 布 / 剪」色带·带一条 4px 墨色下沿）。 */
  strip?: { color: string; h: number };
  /** 底部副标条（招式卡的 `rgba(63,43,30,.08)` + 3px 上沿）。 */
  subBar?: { h: number };
  /** 外描边（招式卡「已提交」的 `outline:6px solid #ffc93c`）。 */
  outline?: { color: string; w: number };
  /** 整体不透明度（禁用态 .62 / .6）。 */
  opacity?: number;
  /**
   * 【R-108-07】v3 **注水**：从**底**往上灌到 `level`（0..1）的一层色，带一条亮水线。
   * 为什么烤进这张皮而不是叠一个子面板：水面要跟着卡的圆角裁（方角子面板会从圆角里探出来），
   * 而闭集控件没有"按父圆角裁剪"的字段。同 strip/subBar 的处置。
   */
  fillLevel?: { level: number; color: string; lineColor?: string };
  /** 虚线描边（【R-108-07】T1 底栏「已升起」虚影·设计定稿 v3：5px 虚线 + 半透奶油面）。 */
  dashed?: boolean;
}

/**
 * SVG 内部 id（渐变/裁剪）**必须由内容推出，不能用自增计数器**。
 * 踩过的坑：计数器版每调一次就换一个 id ⇒ 同一块面在两帧之间的 data-URI 不相等 ⇒
 * `mountUI` 的最小 diff 判定"props 变了"→ 每帧把整屏面板全部 `outerHTML` 重建，
 * 连带把 `<img>` 的 PNG 重新请求一遍 —— 表现是**网络永远闲不下来**（真跑时 `networkidle` 直接超时），
 * 屏也在无谓地全量重渲。内容相同 → id 相同 → URI 逐字节相同 → 不进 diff。
 */
const hashId = (seed: string): string => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `g${(h >>> 0).toString(36)}`;
};

const svgUri = (svg: string): string =>
  `data:image/svg+xml,${encodeURIComponent(svg).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/'/g, '%27')}`;

const fillDef = (fill: Fill, id: string): { def: string; ref: string } =>
  typeof fill === 'string'
    ? { def: '', ref: fill }
    : {
      def: `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">`
        + `<stop offset="0" stop-color="${fill[0]}"/><stop offset="1" stop-color="${fill[1]}"/></linearGradient>`,
      ref: `url(#${id})`,
    };

/** 一块"面"（卡 / 槽 / 胶囊 / 身份牌 / 终局板都用它）。 */
export function plate(spec: PlateSpec): string {
  const { w, h, radius } = spec;
  const bw = spec.border ?? 0;
  const sh = spec.shadow ?? 0;
  const faceH = h - sh;
  const id = hashId(JSON.stringify(spec));
  const { def, ref } = fillDef(spec.fill, id);
  const r = Math.min(radius, Math.min(w, faceH) / 2);
  const half = bw / 2;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    def ? `<defs>${def}</defs>` : '',
    // ① 平移投影：**与面同形、整体下移 sh**（硬边不模糊 = 卡通「浮空」的立体感来源）。
    //    起点必须是 `half + sh` 而不是 `sh`——面本身从 `half` 起画，写成 `sh` 等于只下移了
    //    `sh - half`，4px 的投影实际只露 2px，整块牌就"贴"在底上不浮了（owner 2026-08-07 一眼看出）。
    sh > 0 ? `<rect x="${half}" y="${half + sh}" width="${w - bw}" height="${faceH - bw}" rx="${r}" fill="${spec.shadowColor ?? 'rgba(0,0,0,.4)'}"/>` : '',
    // ② 外发光圈（蓄满态）：描一圈半透明宽边。
    spec.glow ? `<rect x="${half}" y="${half}" width="${w - bw}" height="${faceH - bw}" rx="${r}" fill="none" stroke="${spec.glow}" stroke-width="12" opacity="0.55"/>` : '',
    // ③ 面 + 墨边。
    `<rect x="${half}" y="${half}" width="${w - bw}" height="${faceH - bw}" rx="${r}" fill="${ref}"`
    + (bw > 0 ? ` stroke="${spec.borderColor ?? '#3f2b1e'}" stroke-width="${bw}"` : '')
    + (spec.dashed === true ? ` stroke-dasharray="${bw * 3} ${bw * 2.4}"` : '') + '/>',
    // ④ 顶部色条 / 底部副标条：**烤进这张皮**，不做成子 LayoutNode——
    //    它们要跟着卡的圆角走（子面板是方角，会从圆角里探出来），且随卡整体缩放。
    ...(spec.strip || spec.subBar || spec.fillLevel ? [`<clipPath id="clip${id}"><rect x="${bw}" y="${bw}" width="${w - bw * 2}" height="${faceH - bw * 2}" rx="${Math.max(0, r - bw)}"/></clipPath>`] : []),
    // ④' 注水层：先于色条/副标条画，让那两条压在水面之上（水是"灌进卡里"的，不是盖在卡上）。
    spec.fillLevel && spec.fillLevel.level > 0
      ? (() => {
        const lv = Math.min(1, spec.fillLevel.level);
        const top = faceH - faceH * lv;
        return `<g clip-path="url(#clip${id})"><rect x="0" y="${top}" width="${w}" height="${faceH - top}" fill="${spec.fillLevel.color}"/>`
          + `<rect x="0" y="${top}" width="${w}" height="4" fill="${spec.fillLevel.lineColor ?? 'rgba(255,255,255,.75)'}"/></g>`;
      })()
      : '',
    spec.strip
      ? `<g clip-path="url(#clip${id})"><rect x="0" y="0" width="${w}" height="${spec.strip.h}" fill="${spec.strip.color}"/>`
      + `<rect x="0" y="${spec.strip.h - 4}" width="${w}" height="4" fill="${spec.borderColor ?? '#3f2b1e'}"/></g>`
      : '',
    spec.subBar
      ? `<g clip-path="url(#clip${id})"><rect x="0" y="${faceH - spec.subBar.h}" width="${w}" height="${spec.subBar.h}" fill="rgba(63,43,30,.08)"/>`
      + `<rect x="0" y="${faceH - spec.subBar.h}" width="${w}" height="3" fill="rgba(63,43,30,.25)"/></g>`
      : '',
    // ⑤ 顶部内高光（判定表石板）。
    spec.insetTop ? `<rect x="${bw + 4}" y="${bw}" width="${w - bw * 2 - 8}" height="3" rx="1.5" fill="${spec.insetTop}"/>` : '',
    // ⑥ 外描边（已提交态）——画在最外圈，别被面盖住。
    spec.outline
      ? `<rect x="${spec.outline.w / 2}" y="${spec.outline.w / 2}" width="${w - spec.outline.w}" height="${faceH - spec.outline.w}"`
      + ` rx="${r}" fill="none" stroke="${spec.outline.color}" stroke-width="${spec.outline.w}"/>`
      : '',
    '</svg>',
  ];
  const body = parts.join('');
  return svgUri(spec.opacity !== undefined && spec.opacity < 1
    ? body.replace('>', ` opacity="${spec.opacity}">`)   // 整张皮压暗（禁用态）
    : body);
}

/**
 * 倒计时环（`conic-gradient(<accent> pct*3.6deg, rgba(255,255,255,.14) 0)` + 中心暗盘）。
 * 用 SVG 圆弧画：`stroke-dasharray` 按比例切一圈——比闭集 `ProgressBar{shape:ring}` 更贴稿
 * （那件的环色走主题令牌，出不来稿子指定的金/红两态）。
 */
export function ring(size: number, pct: number, accent: string, discColor: string, discSize: number): string {
  const rOuter = size / 2;
  const track = 'rgba(255,255,255,.14)';
  const stroke = (size - discSize) / 2;
  const rMid = (size - stroke) / 2;
  const circ = 2 * Math.PI * rMid;
  const on = circ * Math.max(0, Math.min(1, pct / 100));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
    + `<circle cx="${rOuter}" cy="${rOuter}" r="${rMid}" fill="none" stroke="${track}" stroke-width="${stroke}"/>`
    + `<circle cx="${rOuter}" cy="${rOuter}" r="${rMid}" fill="none" stroke="${accent}" stroke-width="${stroke}"`
    + ` stroke-dasharray="${on.toFixed(2)} ${(circ - on).toFixed(2)}" transform="rotate(-90 ${rOuter} ${rOuter})"/>`
    + `<circle cx="${rOuter}" cy="${rOuter}" r="${discSize / 2}" fill="${discColor}"/>`
    + '</svg>';
  return svgUri(svg);
}

/**
 * 血条（槽底 + 墨边 + 渐变填充）。`anchor:'right'` = 对手那条，血从**外侧**开始掉
 * （稿子明写 "bar drains toward the outside edge"）。
 *
 * `ghostPct`（【R-108-06】v3 **双段条**）：先掉的那段用一层惨白留在原处、延迟追上来，
 * 让玩家看清「这一波掉了多少」（格斗游戏惯例）。缺省/≤pct 时整条与旧版逐字节相同（零回归）。
 */
export function hpBar(
  w: number, h: number, pct: number, fill: readonly [string, string], track: string, ink: string,
  anchor: 'left' | 'right', ghostPct?: number, ghostColor?: string,
): string {
  const bw = 3;
  const r = h / 2;
  const span = w - bw * 2;
  const clampPct = (v: number): number => Math.max(0, Math.min(1, v / 100));
  const innerW = span * clampPct(pct);
  const x = anchor === 'left' ? bw : w - bw - innerW;
  // 惨白段 = [pct, ghostPct] 这一截；ghost 未给或没超出当前血量 → 不画（同旧版）。
  const gw = ghostPct !== undefined && ghostPct > pct ? span * clampPct(ghostPct) - innerW : 0;
  const gx = anchor === 'left' ? bw + innerW : w - bw - innerW - gw;
  const id = hashId(`hp${w}${h}${pct}${gw.toFixed(1)}${ghostColor ?? ''}${fill.join()}${track}${ink}${anchor}`);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="${fill[0]}"/><stop offset="1" stop-color="${fill[1]}"/></linearGradient>`
    + `<clipPath id="c${id}"><rect x="${bw}" y="${bw}" width="${span}" height="${h - bw * 2}" rx="${r}"/></clipPath></defs>`
    + `<rect x="${bw / 2}" y="${bw / 2}" width="${w - bw}" height="${h - bw}" rx="${r}" fill="${track}" stroke="${ink}" stroke-width="${bw}"/>`
    + (gw > 0 ? `<rect x="${gx}" y="${bw}" width="${gw}" height="${h - bw * 2}" fill="${ghostColor ?? 'rgba(255,244,232,.82)'}" clip-path="url(#c${id})"/>` : '')
    + `<rect x="${x}" y="${bw}" width="${innerW}" height="${h - bw * 2}" fill="url(#${id})" clip-path="url(#c${id})"/>`
    + '</svg>';
  return svgUri(svg);
}

/**
 * **加载条**（owner 2026-08-08 给的启动画面稿：金属外框 + 深槽 + 紫色斜纹填充 + 顶部高光）。
 *
 * 照稿子的四层结构从外往里画：
 *   ① 外框 —— 浅灰→深灰的竖向渐变，像一圈金属包边
 *   ② 深槽 —— 未填满那段的底色
 *   ③ 填充 —— 紫色渐变 + **45° 亮斜纹**（稿子那条最显眼的特征）
 *   ④ 高光 —— 填充上沿一道半透白，让它看起来是圆的
 *
 * ⚠ `pct` 由调用方**量化**后再传（见 duel-screen 的 `LOAD_STEP`）：这张图是 data-URI，
 * 每换一个值就是一张新贴图 → 每帧换新皮会让 `mountUI` 每帧重建面板、重新请求 PNG，
 * `networkidle` 永不落停（本仓已经吃过一次这个亏，注释留在这里当路标）。
 */
export function loadBar(w: number, h: number, pct: number): string {
  const frame = Math.max(3, Math.round(h * 0.16));       // 金属包边厚度
  const r = h / 2;
  const innerH = h - frame * 2;
  const span = w - frame * 2;
  const fillW = Math.max(0, Math.min(1, pct)) * span;
  const id = hashId(`load${w}${h}${pct.toFixed(3)}`);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + '<defs>'
    + `<linearGradient id="f${id}" x1="0" y1="0" x2="0" y2="1">`
    + '<stop offset="0" stop-color="#e9e9ef"/><stop offset="0.45" stop-color="#9a9aa6"/>'
    + '<stop offset="0.55" stop-color="#6f6f7a"/><stop offset="1" stop-color="#c9c9d2"/></linearGradient>'
    + `<linearGradient id="p${id}" x1="0" y1="0" x2="0" y2="1">`
    + '<stop offset="0" stop-color="#d24be0"/><stop offset="0.5" stop-color="#a219c4"/>'
    + '<stop offset="1" stop-color="#7d0fa4"/></linearGradient>'
    // 45° 亮斜纹：一个 18px 的图案单元里画一条 9px 的半透白带。
    + `<pattern id="s${id}" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + '<rect width="9" height="18" fill="rgba(255,255,255,.22)"/></pattern>'
    + `<clipPath id="c${id}"><rect x="${frame}" y="${frame}" width="${span}" height="${innerH}" rx="${innerH / 2}"/></clipPath>`
    + '</defs>'
    + `<rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="url(#f${id})"/>`
    + `<rect x="${frame}" y="${frame}" width="${span}" height="${innerH}" rx="${innerH / 2}" fill="#3a3a42"/>`
    + (fillW > 0
      ? `<g clip-path="url(#c${id})">`
        + `<rect x="${frame}" y="${frame}" width="${fillW}" height="${innerH}" fill="url(#p${id})"/>`
        + `<rect x="${frame}" y="${frame}" width="${fillW}" height="${innerH}" fill="url(#s${id})"/>`
        + `<rect x="${frame}" y="${frame}" width="${fillW}" height="${Math.round(innerH * 0.34)}" fill="rgba(255,255,255,.22)"/>`
        + '</g>'
      : '')
    + '</svg>';
  return svgUri(svg);
}

/**
 * 背景舞台（天空渐变 + 两道山丘 + 斜纹草地 + 云 + 花）。
 * 稿子里这是十来个绝对定位的 div；这里合成**一张整幅背景图**——它是纯装饰、零交互、每帧不变，
 * 拆成十几个 LayoutNode 只是把美术切碎，既不好读也不好换（真画的背景到位时同样只换这一张）。
 */
export function scene(w: number, h: number, c: {
  skyTop: string; skyMid: string; skyLow: string;
  hillFar: string; hillNear: string; grassTop: string; grassBottom: string;
}): string {
  const horizon = Math.round(h * 0.555);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + '<defs>'
    + `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.skyTop}"/>`
    + `<stop offset="0.42" stop-color="${c.skyMid}"/><stop offset="0.58" stop-color="${c.skyLow}"/>`
    + `<stop offset="1" stop-color="${c.skyLow}"/></linearGradient>`
    + `<linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.grassTop}"/>`
    + `<stop offset="1" stop-color="${c.grassBottom}"/></linearGradient>`
    // 斜纹草地：稿子是 `repeating-linear-gradient(102deg, rgba(255,255,255,.09) 0 46px, transparent 46px 108px)`
    + '<pattern id="stripe" width="108" height="108" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">'
    + '<rect width="46" height="108" fill="rgba(255,255,255,.09)"/></pattern>'
    + '</defs>'
    + `<rect width="${w}" height="${h}" fill="url(#sky)"/>`
    // 远近两道山丘
    + `<ellipse cx="${Math.round(w * 0.24)}" cy="${horizon + 30}" rx="${Math.round(w * 0.30)}" ry="150" fill="${c.hillFar}"/>`
    + `<ellipse cx="${Math.round(w * 0.78)}" cy="${horizon + 44}" rx="${Math.round(w * 0.28)}" ry="128" fill="${c.hillNear}"/>`
    + `<rect x="0" y="${horizon}" width="${w}" height="${h - horizon}" fill="url(#grass)"/>`
    + `<rect x="0" y="${horizon}" width="${w}" height="${h - horizon}" fill="url(#stripe)"/>`
    // 云（稿子里两朵定位云）
    + `<rect x="120" y="90" width="260" height="96" rx="48" fill="#fff" opacity="0.85"/>`
    + `<rect x="1420" y="130" width="340" height="110" rx="55" fill="#fff" opacity="0.7"/>`
    // 零星小花 + 一丛灌木（稿子的点缀件）
    + `<circle cx="300" cy="${horizon + 190}" r="11" fill="#fff3b0"/><circle cx="332" cy="${horizon + 176}" r="9" fill="#ffd9ec"/>`
    + `<circle cx="1620" cy="${horizon + 168}" r="10" fill="#ffd9ec"/><circle cx="1660" cy="${horizon + 196}" r="12" fill="#fff3b0"/>`
    + `<ellipse cx="1246" cy="${horizon + 92}" rx="46" ry="34" fill="#5aa53c"/>`
    + `<rect x="1237" y="${horizon + 92}" width="18" height="60" fill="#c9a06a"/>`
    + '</svg>';
  return svgUri(svg);
}
