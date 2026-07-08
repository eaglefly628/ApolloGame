// renderNode — LayoutNode 树 → HTML 字符串。纯函数，无副作用，可单测。
// 样式来自传入的 UITheme（缺省 = 引擎 SHELL 脸）。游戏传自己那份主题即「换皮」，不接受内联色值。

import { SHELL } from '../shell-theme.js';
import { ART_FONT_FAMILY } from './art-fonts.js';
import type {
  LayoutNode, LayoutConstraints, UITheme, VisualEffect, EffectColor, EdgeColor,
  ButtonProps, LabelProps, DropdownProps, BadgeProps, InputProps, PanelProps,
  CheckboxProps, ToggleProps, RadioGroupProps, ImageProps, ScreenProps, SliderProps,
  TableProps, TableColumn, TabsProps, ProgressBarProps, TagProps, ModalProps, ToastProps, TooltipProps,
  CardProps, PlayingCardProps, StepperProps, SegmentedProps, AvatarProps, AccordionProps,
  RatingProps, ComboboxProps, DrawerProps, VirtualListProps, ContextMenuProps,
  CoinFlipProps, VersusProps, VideoProps,
} from './types.js';

const esc = (s: string): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 数值强制：layout 数值字段虽类型标 number，但弱模型/外部数据运行时可能是字符串
// （如 "0;background:url(x)"）→ 直接插进 style 串即 CSS 注入。统一过 num() 只取有限数字。
const num = (v: unknown, d = 0): number => { const n = Number(v); return Number.isFinite(n) ? n : d; };
// anim 预设白名单（mountUI 注入的关键帧名）：拒绝任意字符串插入 animation。
const ANIM_PRESETS = new Set(['fadeIn', 'slideUp', 'pop', 'shake', 'dealIn', 'flyIn']); // 一次性入场
const LOOP_PRESETS = new Set(['float', 'glow', 'pulse']);                                // 持续循环（浮动/发光/脉冲·环境动效·infinite）
// justify 主轴分布枚举 → CSS justify-content（闭集映射·拒绝任意串注入）。
const JUSTIFY_MAP: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end',
  between: 'space-between', around: 'space-around', evenly: 'space-evenly',
};

// 视觉特效语义色 → 主题令牌（闭集映射·防注入：绝不把 color 串直接插进 CSS）。
function fxColor(t: UITheme, c?: EffectColor): string {
  const m: Record<string, string> = { danger: t.danger, gold: t.gold, jade: t.jade, warn: t.warn, ok: t.ok, white: '#ffffff' };
  return (c && m[c]) || t.gold;
}

// 容器描边语义色 → 主题令牌（闭集·REQ-UI-容器描边形）。mine/foe 取主题阵营令牌·缺省回退暖(warn)/冷(jadeLine)。
function edgeColor(t: UITheme, e: EdgeColor): string {
  switch (e) {
    case 'jade':   return t.jadeLine;
    case 'gold':   return t.gold;
    case 'ok':     return t.ok;
    case 'warn':   return t.warn;
    case 'danger': return t.danger;
    case 'mine':   return t.mine ?? t.warn;
    case 'foe':    return t.foe ?? t.jadeLine;
  }
}
// motion/opacity 类特效 → 复用已注入的关键帧 [keyframe, 缺省 ms]。
const FX_MOTION: Record<string, [string, number]> = {
  pulse: ['apollo-pulse', 1600], float: ['apollo-float', 2600], pop: ['apollo-pop', 360],
};
// VisualEffect[] → CSS（可叠加·分组合成）：motion/opacity 走 animation 列表；glow 走 filter；
// sheen/flash 走 data-fx 叠层（::after/::before）。同组多个 transform 动画同时只末个生效（文档说明·取一个动作即可）。
// 返回 { css: 内联样式增量, dataFx: 叠层 token 串 }。纯函数（受控合成·闭集 kind 由调用前校验器把关）。
function fxToCss(fx: readonly VisualEffect[], t: UITheme): { css: string; dataFx: string } {
  const anim: string[] = [], filter: string[] = [], vars: string[] = [], dataFx: string[] = [];
  for (const e of fx) {
    const ms = num(e.ms, 0);
    if (e.kind === 'pulse' || e.kind === 'float' || e.kind === 'pop') {
      const [kf, dms] = FX_MOTION[e.kind]!;
      const iter = e.kind === 'pop' || e.once ? 'both' : 'infinite';
      anim.push(`${kf} ${ms || dms}ms ease-in-out ${iter}`);
    } else if (e.kind === 'shake') {
      vars.push(`--fx-amp:${num(e.intensity, 1) * 4}px`);
      anim.push(`apollo-fx-shake ${ms || 520}ms ease-in-out ${e.once ? 'both' : 'infinite'}`);
    } else if (e.kind === 'glow') {
      const col = fxColor(t, e.color); const r = num(e.intensity, 1);
      filter.push(`drop-shadow(0 0 ${4 * r}px ${col}) drop-shadow(0 0 ${10 * r}px ${col})`);
    } else if (e.kind === 'sheen') {
      dataFx.push('sheen');
    } else if (e.kind === 'flash') {
      vars.push(`--fx-flash:${fxColor(t, e.color ?? 'danger')}`);
      if (ms) vars.push(`--fx-flash-ms:${ms}ms`);
      dataFx.push('flash');
    } else if (e.kind === 'fade') {
      // 半透明淡出消失（消耗/消退）：opacity→0，一次性停在末态（forwards）。
      anim.push(`apollo-fx-fade ${ms || 600}ms ease-out forwards`);
    }
  }
  const css = [
    ...vars,
    anim.length ? `animation:${anim.join(',')}` : '',
    filter.length ? `filter:${filter.join(' ')}` : '',
    dataFx.length ? 'position:relative' : '',
  ].filter(Boolean).join(';');
  return { css, dataFx: dataFx.join(' ') };
}

function layoutStyle(c?: LayoutConstraints, t?: UITheme): string {
  if (!c) return '';
  const p: string[] = [];
  if (c.x !== undefined) { p.push(`left:${num(c.x)}px`); p.push(`top:${num(c.y)}px`); p.push('position:absolute'); }
  else if (c.y !== undefined) { p.push(`top:${num(c.y)}px`); p.push('position:absolute'); }
  if (c.width   !== undefined) p.push(`width:${num(c.width)}px`);
  if (c.height  !== undefined) p.push(`height:${num(c.height)}px`);
  if (c.flex    !== undefined) p.push(`flex:${num(c.flex)}`);
  if (c.padding !== undefined) p.push(`padding:${num(c.padding)}px`);
  if (c.margin  !== undefined) p.push(`margin:${num(c.margin)}px`);
  // maxWidth（响应式封顶 + 块居中·整页居中 chrome）：max-width 上限 + 自动外边距居中（flex item 亦生效）；
  // 无显式 width 时补 width:100% → 窄屏铺满、宽屏封顶居中。放 margin 之后，让 auto 边距覆盖 margin 简写的左右值。
  if (c.maxWidth !== undefined) {
    p.push(`max-width:${num(c.maxWidth)}px`, 'margin-left:auto', 'margin-right:auto');
    if (c.width === undefined) p.push('width:100%');
  }
  // Transform（旋转/缩放）：声明式数据 → CSS transform。扇形手牌/选中放大等。
  const tf: string[] = [];
  if (c.rotate !== undefined) tf.push(`rotate(${num(c.rotate)}deg)`);
  if (c.scale  !== undefined) tf.push(`scale(${num(c.scale)})`);
  if (tf.length) p.push(`transform:${tf.join(' ')}`);
  // 倒角切角（clip-path 八边形·扑克/art-deco 美学）。切角 px 过 num 防注入。
  if (c.chamfer !== undefined) {
    const k = num(c.chamfer);
    p.push(`clip-path:polygon(${k}px 0,100% 0,100% calc(100% - ${k}px),calc(100% - ${k}px) 100%,0 100%,0 ${k}px)`);
  }
  // 圆角半径（覆盖控件默认圆角·末置生效）。REQ-UI-容器描边形·小件异形/大圆落点圈用。
  if (c.radius !== undefined) p.push(`border-radius:${num(c.radius)}px`);
  // 不透明度（0..1·装饰淡入/水印/剪影）。非数字回退 1（不透明·安全）。REQ-UI-骰途逐像素③。
  if (c.opacity !== undefined) p.push(`opacity:${num(c.opacity, 1)}`);
  // 动画：一次性入场（both ease-out）或持续循环（infinite·环境动效）。仅白名单预设；时长/延迟强制数字。
  if (c.anim && ANIM_PRESETS.has(c.anim)) {
    p.push(`animation:apollo-${c.anim} ${num(c.animMs, 360)}ms ${c.animDelay ? `${num(c.animDelay)}ms ` : ''}both ease-out`);
  } else if (c.anim && LOOP_PRESETS.has(c.anim)) {
    p.push(`animation:apollo-${c.anim} ${num(c.animMs, 2400)}ms ${c.animDelay ? `${num(c.animDelay)}ms ` : ''}ease-in-out infinite`);
  }
  if (c.draggable) p.push('cursor:grab');
  // 视觉特效合集（UI 特效库）：闭集 fx → 动画/滤镜/叠层 CSS。需主题取色 → 仅 t 在场时应用。
  if (c.fx && c.fx.length && t) {
    const f = fxToCss(c.fx, t);
    if (f.css) {
      // REQ-UI-BUG-fx与绝对定位不兼容：x/y 已给 position:absolute（本身即定位祖先·fx 的 ::after 照样定位）→
      // 别让 fx 的 position:relative 覆盖它（否则绝对定位失效、元素跑位）。仅无 x/y 时才需 fx 补 relative。
      const hasAbs = c.x !== undefined || c.y !== undefined;
      const css = hasAbs ? f.css.split(';').filter((s) => s !== 'position:relative').join(';') : f.css;
      if (css) p.push(css);
    }
  }
  return p.join(';');
}

// 背景 UV 滚动声明 → data-bgscroll（mountUI 接逐元素滚动关键帧）。x,y=平移 px，ms=周期。纯数字（防注入过 num）。
function bgScrollAttr(s?: { x?: number; y?: number; ms?: number }): string {
  return s ? ` data-bgscroll="${num(s.x)},${num(s.y)},${num(s.ms, 6000)}"` : '';
}

// 图片贴图 → 一个 background 平铺层。url 先剥离能逃出 url('...') 的字符（引号/括号/空白/反斜杠）防 CSS 注入，
// 再 esc（防属性逃逸）；size 过 num。空 url → ''。配进 background 多层合成。
function texLayer(url?: string, size?: number): string {
  if (!url) return '';
  const safe = esc(String(url).replace(/['"()\\\s]/g, ''));
  return `url('${safe}') 0 0${size !== undefined ? ` / ${num(size)}px` : ''} repeat`;
}

// 异形轮廓（闭集 ShapeToken → 引擎预置 clip-path/border-radius·弱 LLM 只选名·不收自由坐标）。
// pill=全圆胶囊；其余=固定多边形 clip-path（命中区仍是元素包围盒）。附加在 base 之后→后写覆盖既有圆角/切角。
const SHAPE_CSS: Record<string, string> = {
  pill:     'border-radius:999px',
  hexagon:  'clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)',
  diamond:  'clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)',
  shield:   'clip-path:polygon(0 0,100% 0,100% 62%,50% 100%,0 62%)',
  ribbon:   'clip-path:polygon(0 0,100% 0,92% 50%,100% 100%,0 100%,8% 50%)',
  chevron:  'clip-path:polygon(0 0,88% 0,100% 50%,88% 100%,0 100%)',
  tag:      'clip-path:polygon(12% 0,100% 0,100% 100%,12% 100%,0 50%)',
  cut:      'clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)',
};
const shapeCss = (shape?: string): string => (shape && SHAPE_CSS[shape]) ? `;${SHAPE_CSS[shape]}` : '';

// 贴图皮：已解析图 URL → 覆盖按钮底为 cover 图 + 白字投影保可读（同 texLayer 剥离 url() 逃逸字符防注入）。
// 空 → ''。放在样式末尾 → 后写覆盖 kind 的 background/color/border。配 shape 可做透明 PNG 异形贴图键。
const skinCss = (url?: string): string =>
  url ? `;background:url('${esc(String(url).replace(/['"()\\\s]/g, ''))}') center/cover no-repeat;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.85);border:0` : '';

// 面填充三态解析（owner 2026-07-04 色库化）：语义令牌(换皮自适应) / 预设配色(固定观感) / {custom}(显式逃生) / 遗留裸串。
// 令牌→UITheme（随主题变）；preset→引擎内建渐变（色库·固定）；对象→custom 自由串；其余字符串→原样透传(back-compat)。
const SURFACE_TOKEN: Record<string, (t: UITheme) => string> = {
  panel: (t) => t.bg1, raised: (t) => t.bg2, sunken: (t) => t.bg0,
  jade: (t) => t.jadeWash, gold: (t) => t.gold, ok: (t) => t.okWash,
  warn: (t) => t.warnWash, danger: (t) => t.danger, ink: (t) => t.ink ?? t.bg0,
};
const PRESET_FILL: Record<string, string> = {
  'jade-sheen': 'linear-gradient(180deg,#1f4a3a,#123528)',
  'gold-sheen': 'linear-gradient(180deg,#caa53f,#8a6a20)',
  'ink-deep':   'linear-gradient(160deg,#0f1626,#0a0f1a)',
  'steel':      'linear-gradient(180deg,#2a3340,#1a2029)',
  'blood':      'linear-gradient(180deg,#4a1414,#2a0c0c)',
  'frost':      'linear-gradient(180deg,#1f3a4a,#122a35)',
  'ember':      'linear-gradient(180deg,#4a2c14,#2a180c)',
  'void':       'linear-gradient(160deg,#2a1a3a,#170f28)',
};
function resolveFill(bg: unknown, t: UITheme): string | undefined {
  if (bg === undefined || bg === null) return undefined;
  if (typeof bg === 'object') return (bg as { custom?: string }).custom; // 显式逃生（创作者特别指定色）
  const s = String(bg);
  const tok = SURFACE_TOKEN[s]; if (tok) return tok(t); // 语义令牌·换皮自适应
  if (PRESET_FILL[s]) return PRESET_FILL[s];            // 预设配色·固定观感
  return s; // 遗留裸串（back-compat·audit 标记建议迁令牌/preset/custom）
}

// ── 原有 7 个控件 ───────────────────────────────────────────────

function renderButton(id: string, p: ButtonProps, ls: string, t: UITheme): string {
  const kindStyle: Record<string, string> = {
    primary: `background:${t.jadeWash};color:${t.jade};border:1px solid ${t.jadeLine};font-weight:600`,
    ghost:   `background:rgba(255,255,255,0.03);color:${t.sub};border:1px solid ${t.line}`,
    quiet:   `background:transparent;color:${t.dim};border:1px solid transparent`,
  };
  const kind = p.kind ?? 'ghost';
  const action = p.action ? ` data-action="${esc(p.action)}"${p.actionArg ? ` data-arg="${esc(p.actionArg)}"` : ''}` : '';
  // hero：金色倒角 sheen 大 CTA（下沉自 game-g 出征键）。倒角 clip-path + 流光 span(apollo-sheen 关键帧) + 可选副标。
  if (kind === 'hero') {
    const hbase = `position:relative;overflow:hidden;padding:14px 30px;border:0;border-radius:4px;cursor:${p.disabled ? 'not-allowed' : 'pointer'};font-family:${t.fontUi};outline:none;background:linear-gradient(180deg,${t.gold},${t.warn});color:${t.bg0};font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.45);clip-path:polygon(13px 0,100% 0,100% calc(100% - 13px),calc(100% - 13px) 100%,0 100%,0 13px);opacity:${p.disabled ? 0.4 : 1}`;
    const sheen = `<span style="position:absolute;top:0;bottom:0;left:-60%;width:45%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-18deg);animation:apollo-sheen 2.6s ease-in-out infinite;pointer-events:none"></span>`;
    const big = `<span style="display:block;font-size:17px;line-height:1.15">${esc(p.label)}</span>`;
    const sub = p.sub ? `<span style="display:block;font-size:11px;font-weight:600;opacity:.8;margin-top:2px">${esc(p.sub)}</span>` : '';
    return `<button id="${esc(id)}" data-apollo-btn${p.skin ? ' data-apollo-skin' : ''}${action}${p.disabled ? ' disabled' : ''} style="${hbase};${ls}${shapeCss(p.shape)}${skinCss(p.skin)}">${sheen}${big}${sub}</button>`;
  }
  const base = `padding:6px 14px;border-radius:7px;font-size:12px;cursor:${p.disabled ? 'not-allowed' : 'pointer'};font-family:${t.fontUi};outline:none;transition:all .15s;opacity:${p.disabled ? 0.4 : 1}`;
  return `<button id="${esc(id)}" data-apollo-btn${p.skin ? ' data-apollo-skin' : ''}${action}${p.disabled ? ' disabled' : ''} style="${base};${kindStyle[kind]};${ls}${shapeCss(p.shape)}${skinCss(p.skin)}">${esc(p.label)}</button>`;
}

function renderLabel(id: string, p: LabelProps, ls: string, t: UITheme): string {
  const sizeMap: Record<string, number> = { xs: 10, sm: 11, md: 13, lg: 16, xl: 22, xxl: 28, xxxl: 34 };
  const colorMap: Record<string, string> = {
    text: t.text, sub: t.sub, dim: t.dim,
    jade: t.jade, gold: t.gold,
    ok: t.ok, warn: t.warn, danger: t.danger,
    mine: t.mine ?? t.warn, foe: t.foe ?? t.jade, // 阵营字色（我方暖/敌方冷·同 edge 令牌·缺省回退）
    ink: t.ink ?? t.bg0, // 深墨字（金按钮/浅底上的深色文字·REQ-UI-Label ink 令牌·缺省回退最深底 bg0）
  };
  // size 接受具名档 或 裸 px 数字（复刻像素稿精确字号·owner 2026-06-28「字阶该全档」）：数字直用、令牌查表。
  const sz = typeof p.size === 'number' ? p.size : (sizeMap[p.size ?? 'md'] ?? 13);
  const cl = colorMap[p.color ?? 'text'] ?? t.text;
  // 具名字体槽（缺省按 mono 布尔回退·保旧调用方不变）：pixel/display 槽缺省回退 fontUi/fontMono。
  const fontSlot: Record<string, string> = {
    ui: t.fontUi, mono: t.fontMono,
    pixel: t.fontPixel ?? t.fontUi, display: t.fontDisplay ?? t.fontMono, serif: t.fontSerif ?? t.fontUi,
  };
  // 艺术字槽（内嵌 @font-face·slug→family）：CJK 兜底用**单引号**族名——不用 t.fontUi（含双引号会撞 style 属性引号截断 bug·
  // 已报 REQ-UI-BUG-style属性引号截断）。单引号在双引号 style 里安全，art 字体覆拉丁、中文回退 CJK。
  const artFam = p.font ? ART_FONT_FAMILY[p.font] : undefined;
  const fam = artFam ? `${artFam}, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif`
    : (p.font ? fontSlot[p.font] : (p.mono ? t.fontMono : t.fontUi));
  const style = [
    `font-size:${sz}px`, `color:${cl}`,
    p.bold ? 'font-weight:700' : '',
    `font-family:${fam}`,
    // 仅当文本含换行符时保留换行（\n→实换行·多段说明/手册用）；无换行的单行 label 不加·HTML 字节不变（不动既有 golden）。
    (typeof p.text === 'string' && p.text.includes('\n')) ? 'white-space:pre-line' : '',
    p.glow ? `text-shadow:0 0 8px ${cl},0 0 2px ${cl}` : '',
    p.tracking !== undefined ? `letter-spacing:${p.tracking}px` : '',
    ls,
  ].filter(Boolean).join(';');
  // 富文本多段着色(render-only·有 spans 忽略 text)：逐段自带 color(令牌)/bold，外层保字号/字体。
  if (p.spans) {
    const inner = p.spans.map((s) =>
      `<span style="color:${colorMap[s.color ?? 'text'] ?? cl}${s.bold ? ';font-weight:700' : ''}">${esc(s.text)}</span>`,
    ).join('');
    return `<span id="${esc(id)}" style="${style}">${inner}</span>`;
  }
  // 数字滚动补间(render-only)：初值=from(按 decimals 格式化)，mountUI 读 data-tween-* 用定时器动画到 to。
  if (p.tween) {
    const dec = num(p.tween.decimals, 0);
    const tweenAttr = ` data-tween-to="${num(p.tween.to)}" data-tween-ms="${num(p.tween.ms, 600)}" data-tween-dec="${dec}"`;
    return `<span id="${esc(id)}"${tweenAttr} style="${style}">${esc(num(p.tween.from).toFixed(dec))}</span>`;
  }
  const tw = p.typewriter ? ` data-typewriter="${p.typewriter}"` : '';
  return `<span id="${esc(id)}"${tw} style="${style}">${esc(p.text ?? '')}</span>`;
}

function renderDropdown(id: string, p: DropdownProps, ls: string, t: UITheme): string {
  const base = `background:${t.bg2};color:${t.sub};border:1px solid ${t.line};border-radius:6px;font-size:12px;padding:6px 10px;outline:none;font-family:${t.fontUi};cursor:pointer`;
  const action = p.action ? ` data-action="${esc(p.action)}"` : '';
  const ph = p.placeholder
    ? `<option value="" disabled${!p.value ? ' selected' : ''}>${esc(p.placeholder)}</option>`
    : '';
  const opts = p.options
    .map(o => `<option value="${esc(o.value)}"${p.value === o.value ? ' selected' : ''}>${esc(o.label)}</option>`)
    .join('');
  return `<select id="${esc(id)}"${action} style="${base};${ls}">${ph}${opts}</select>`;
}

function renderBadge(id: string, p: BadgeProps, ls: string, t: UITheme): string {
  const toneStyle: Record<string, string> = {
    ok:   `background:${t.okWash};color:${t.ok}`,
    warn: `background:${t.warnWash};color:${t.warn}`,
    dim:  `background:rgba(154,170,196,0.10);color:${t.dim}`,
  };
  const style = `${toneStyle[p.tone ?? 'dim']};font-size:9px;padding:1px 7px;border-radius:8px;white-space:nowrap;font-family:${t.fontUi};${ls}`;
  return `<span id="${esc(id)}" style="${style}">${esc(p.text)}</span>`;
}

function renderInput(id: string, p: InputProps, ls: string, t: UITheme): string {
  const base = `background:${t.inputBg ?? 'rgba(0,0,0,0.35)'};color:${t.text};border:1px solid ${t.line};border-radius:6px;font-size:12px;padding:6px 10px;outline:none;font-family:${t.fontUi}`;
  const action = p.action ? ` data-action="${esc(p.action)}"` : '';
  return `<input id="${esc(id)}" type="${p.type ?? 'text'}" value="${esc(p.value ?? '')}" placeholder="${esc(p.placeholder ?? '')}"${action} style="${base};${ls}">`;
}

function renderDivider(id: string, ls: string, t: UITheme): string {
  return `<hr id="${esc(id)}" style="border:none;border-top:1px solid ${t.line};margin:8px 0;${ls}">`;
}

function renderPanel(id: string, p: PanelProps, c: LayoutConstraints | undefined, children: LayoutNode[], t: UITheme): string {
  const dir = c?.direction ?? 'column';
  const gap = c?.gap ?? 8;
  const align = c?.align ?? 'stretch';
  const justify = JUSTIFY_MAP[c?.justify ?? ''] ?? '';   // 主轴分布（flex 才有意义·grid 忽略）。
  const bare = p.bare === true;          // 无框纯布局容器：不画框/底/圆角、padding 缺省 0（别千层框）。
  const pad = c?.padding ?? (bare ? 0 : 16);
  const ls = layoutStyle(c, t);          // 传 t：让 layout.fx（视觉特效·需主题取色）在 Panel 上也生效。
  const overflow = p.scroll ? 'overflow-y:auto;' : '';
  // grid 排布模式（卡牌格/货架）：cols=N 固定列数（严格等分·消空隙）；否则 auto-fill 自适应（minCol 定最小列宽）。非 grid 走 flex 行/列（支持 justify）。
  const gridCols = c?.cols !== undefined ? `repeat(${num(c.cols)},1fr)` : `repeat(auto-fill,minmax(${c?.minCol ?? 96}px,1fr))`;
  const box = dir === 'grid'
    ? `display:grid;grid-template-columns:${gridCols};gap:${gap}px;align-items:${align}`
    : `display:flex;flex-direction:${dir};gap:${gap}px;align-items:${align}${justify ? `;justify-content:${justify}` : ''}`;
  // chrome：非 bare 才画底/边框/圆角（bg 缺省主题 bg1·与 Screen.bg 同口径·令牌如 'var(--felt)'）；bare=透明无框只做分组。
  // accent：高亮框（jade 描边 + 柔光投影）用于活动视口/强调面板；缺省细线边。bare 时不画框故忽略 accent。
  // edge（REQ-UI-容器描边形）：语义/阵营描边色（闭集令牌·覆盖默认线/accent 取色）；dashed：虚线边；radius：覆盖恒 10 圆角（叠层同步）。
  const border = p.edge ? edgeColor(t, p.edge) : (p.accent ? t.jadeLine : t.line);
  const bStyle = p.dashed ? 'dashed' : 'solid';
  const rad = num(c?.radius ?? 10);
  const glow = (!bare && p.accent) ? `box-shadow:0 0 0 1px ${t.jadeWash},0 10px 34px rgba(0,0,0,.4);` : '';
  // 图片贴图层（平铺·叠在面板底上）。bare 但有贴图 → 只铺贴图、仍无框。
  const tex = texLayer(p.bgTexture, p.bgTextureSize);
  const chrome = bare
    ? (tex ? `background:${tex}, transparent;` : '')
    : `background:${tex ? `${tex}, ` : ''}${resolveFill(p.bg, t) ?? (p.glass ? 'rgba(20,24,32,0.5)' : t.bg1)};border:1px ${bStyle} ${border};border-radius:${rad}px;${glow}${p.glass ? 'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' : ''}`;
  const style = `${box};padding:${pad}px;${chrome}position:relative;${overflow}${ls}`;
  const title = p.title
    ? `<div style="font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:${t.dim};font-family:${t.fontUi};margin-bottom:4px${dir === 'grid' ? ';grid-column:1/-1' : ''}">${esc(p.title)}</div>`
    : '';
  const vignette = (p.vignette && !bare)
    ? `<div style="position:absolute;inset:0;border-radius:${rad}px;pointer-events:none;background:radial-gradient(120% 100% at 50% 30%,transparent 55%,rgba(0,0,0,.45) 100%)"></div>`
    : '';
  // 程序化纹理叠层（REQ-UI-G流光底纹③）：stripe 45°斜条纹 / checker 棋盘格，叠在内容下（felt 牌桌质感）。
  const pattern = p.pattern
    ? `<div style="position:absolute;inset:0;border-radius:${bare ? '0' : `${rad}px`};pointer-events:none;background:${p.pattern === 'checker' ? 'repeating-conic-gradient(rgba(255,255,255,.04) 0% 25%,transparent 0% 50%) 0 0 / 16px 16px' : 'repeating-linear-gradient(45deg,rgba(255,255,255,.045) 0 2px,transparent 2px 12px)'}"></div>`
    : '';
  const inner = children.map((ch) => renderNode(ch, t)).join('');
  // 容器可点（REQ-UI-容器可点）：整个容器发信号（同 Button·只信号名）+ 手型。
  const action = p.action ? ` data-action="${esc(p.action)}"${p.actionArg ? ` data-arg="${esc(p.actionArg)}"` : ''}` : '';
  const cursor = p.action ? 'cursor:pointer;' : '';
  return `<div id="${esc(id)}"${action}${bgScrollAttr(p.bgScroll)} style="${style}${cursor}">${vignette}${pattern}${title}${inner}</div>`;
}

// ── 新增 6 个控件 ───────────────────────────────────────────────

// hidden input 辅助：opacity:0 + 零尺寸，<label for> 触发它；change 事件冒泡给 dispatch。
const hiddenInput = (id: string, type: string, action: string, extra = ''): string =>
  `<input type="${type}" id="${esc(id)}"${action ? ` data-action="${esc(action)}"` : ''} ${extra} style="opacity:0;width:0;height:0;position:absolute">`;

function renderCheckbox(id: string, p: CheckboxProps, ls: string, t: UITheme): string {
  const checked = p.checked ?? false;
  const boxBg     = checked ? t.jadeWash : 'rgba(0,0,0,0.25)';
  const boxBorder = checked ? t.jadeLine  : t.line;
  const mark      = checked ? `<span style="color:${t.jade};font-size:10px;line-height:1;font-weight:700">✓</span>` : '';
  return `<span id="${esc(id)}" style="display:inline-flex;align-items:center;${ls}">
  ${hiddenInput(`${id}-i`, 'checkbox', p.action ?? '', checked ? 'checked' : '')}
  <label for="${esc(id)}-i" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer">
    <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1px solid ${boxBorder};border-radius:3px;background:${boxBg};flex-shrink:0">${mark}</span>
    <span style="font-size:12px;color:${t.sub};font-family:${t.fontUi}">${esc(p.label)}</span>
  </label>
</span>`;
}

function renderToggle(id: string, p: ToggleProps, ls: string, t: UITheme): string {
  const on = p.checked ?? false;
  const trackBg = on ? t.jade        : t.bg3;
  const border   = on ? t.jadeLine   : t.line;
  const knob     = on ? t.bg0        : t.dim;
  const knobLeft = on ? '18px'           : '2px';
  return `<span id="${esc(id)}" style="display:inline-flex;align-items:center;${ls}">
  ${hiddenInput(`${id}-i`, 'checkbox', p.action ?? '', on ? 'checked' : '')}
  <label for="${esc(id)}-i" style="display:inline-flex;align-items:center;gap:10px;cursor:pointer">
    <span style="display:inline-block;width:36px;height:20px;border-radius:10px;background:${trackBg};border:1px solid ${border};position:relative;flex-shrink:0">
      <span style="width:14px;height:14px;border-radius:50%;background:${knob};position:absolute;top:2px;left:${knobLeft}"></span>
    </span>
    <span style="font-size:12px;color:${t.sub};font-family:${t.fontUi}">${esc(p.label)}</span>
  </label>
</span>`;
}

function renderRadioGroup(id: string, p: RadioGroupProps, ls: string, t: UITheme): string {
  const items = p.options.map((opt, i) => {
    const rid = `${id}-r${i}`;
    const sel = p.value === opt.value;
    const dot    = sel ? `<span style="width:7px;height:7px;border-radius:50%;background:${t.jade}"></span>` : '';
    const border = sel ? t.jade : t.line;
    return `<span style="display:inline-flex;align-items:center">
    ${hiddenInput(rid, 'radio', p.action ?? '', `name="${esc(p.name)}" value="${esc(opt.value)}"${sel ? ' checked' : ''}`)}
    <label for="${esc(rid)}" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer">
      <span style="width:14px;height:14px;border-radius:50%;border:1.5px solid ${border};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${dot}</span>
      <span style="font-size:12px;color:${t.sub};font-family:${t.fontUi}">${esc(opt.label)}</span>
    </label>
  </span>`;
  }).join('');
  return `<div id="${esc(id)}" style="display:flex;flex-direction:column;gap:8px;${ls}">${items}</div>`;
}

function renderImage(id: string, p: ImageProps, ls: string): string {
  const fit    = p.fit ?? 'contain';
  const radius = p.radius ?? 0;
  return `<img id="${esc(id)}" src="${esc(p.src)}" alt="${esc(p.alt ?? '')}" style="object-fit:${fit};border-radius:${radius}px;display:block;max-width:100%;${ls}">`;
}

function renderScreen(id: string, p: ScreenProps, children: LayoutNode[], t: UITheme): string {
  const baseBg = resolveFill(p.bg, t) ?? t.pageBg;
  // 分层底（上→下）：wash(晕染) , 图片贴图(bgTexture·平铺) , 程序化纹理(theme.texture) , 底色。任意层缺省即跳过。
  // 三路贴图并存：程序化(theme.texture) / cover 整图(下方 bgImg) / 平铺图片(bgTexture)。
  const bg     = [t.wash, texLayer(p.bgTexture, p.bgTextureSize), t.texture, baseBg].filter(Boolean).join(', ');
  const center = p.center ? 'align-items:center;justify-content:center;' : 'align-items:stretch;';
  const bgImg  = p.image ? `background-image:url('${esc(p.image)}');background-size:cover;background-position:center;` : '';
  const blur   = p.blur ? `backdrop-filter:blur(${p.blur}px);` : '';
  const style  = `width:100%;min-height:100vh;display:flex;flex-direction:column;${center}background:${bg};${bgImg}${blur}font-family:${t.fontUi};position:relative;`;
  return `<div id="${esc(id)}"${bgScrollAttr(p.bgScroll)} style="${style}">${children.map((ch) => renderNode(ch, t)).join('')}</div>`;
}

function renderSlider(id: string, p: SliderProps, ls: string, t: UITheme): string {
  const min   = p.min   ?? 0;
  const max   = p.max   ?? 100;
  const step  = p.step  ?? 1;
  const value = p.value ?? Math.round((min + max) / 2);
  const action = p.action ? ` data-action="${esc(p.action)}"` : '';
  const header = p.label
    ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:11px;color:${t.sub};font-family:${t.fontUi}">${esc(p.label)}</span>
        <span style="font-size:11px;color:${t.dim};font-family:${t.fontMono}">${value}</span>
      </div>`
    : '';
  return `<div id="${esc(id)}" style="display:flex;flex-direction:column;${ls}">
  ${header}<input type="range" min="${min}" max="${max}" step="${step}" value="${value}"${action} style="width:100%;accent-color:${t.jade};cursor:pointer">
</div>`;
}

// ── Table / Tabs（以 game-g 大厅榜单/数值表 + 抗闪屏切页为出发点·下沉成引擎组件）────────

const colFlex = (c: TableColumn): string => (c.width !== undefined ? `flex:0 0 ${c.width}px` : 'flex:1');

// 数据表：列定义 + 行数据 → 表头(淡色阔字距) + 行(发丝线分隔·可点·tone 着色)。游戏只填 columns/rows。
function renderTable(id: string, p: TableProps, ls: string, t: UITheme): string {
  const title = p.title
    ? `<div style="font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:${t.dim};font-family:${t.fontUi};margin-bottom:8px">${esc(p.title)}</div>`
    : '';
  const head = `<div style="display:flex;gap:10px;padding:0 4px 6px;border-bottom:1px solid ${t.line}">${p.columns.map((c) => `<span style="${colFlex(c)};text-align:${c.align ?? 'left'};font-size:9px;letter-spacing:1.6px;text-transform:uppercase;color:${t.dim};font-family:${t.fontUi}">${esc(c.label)}</span>`).join('')}</div>`;
  const toneColor: Record<string, string> = { normal: t.text, accent: t.gold, dim: t.dim };
  const body = p.rows.length
    ? p.rows.map((r) => {
        const act = r.action ? ` data-action="${esc(r.action)}" data-arg="${esc(r.id)}"` : '';
        const cur = r.action ? 'cursor:pointer;' : '';
        const cells = p.columns.map((c) => `<span style="${colFlex(c)};text-align:${c.align ?? 'left'};font-size:12px;color:${toneColor[r.tone ?? 'normal'] ?? t.text};font-family:${t.fontUi};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.cells[c.key] ?? '')}</span>`).join('');
        return `<div${act} style="display:flex;gap:10px;align-items:center;padding:8px 4px;border-bottom:1px solid ${t.line};${cur}">${cells}</div>`;
      }).join('')
    : `<div style="padding:18px 4px;text-align:center;font-size:12px;color:${t.dim};font-family:${t.fontUi}">${esc(p.empty ?? '—')}</div>`;
  return `<div id="${esc(id)}" style="display:flex;flex-direction:column;background:${t.bg1};border:1px solid ${t.line};border-radius:10px;padding:12px 14px;${ls}">${title}${head}${body}</div>`;
}

// 多页(Table Pages)：nav 标签栏 + 各页全渲染(仅 active 显示)。切页由 mountUI 就地 toggle display(不重建·抗闪屏)。
// children 顺序对齐 tabs；data-tab/data-tabpage/data-tabs 是 mountUI 切页的锚点。
function renderTabs(id: string, p: TabsProps, children: LayoutNode[], ls: string, t: UITheme): string {
  const active = p.active ?? p.tabs[0]?.id ?? '';
  const navBtn = (tb: { id: string; label: string; anchor?: string }): string => {
    const on = tb.id === active;
    const act = p.action ? ` data-action="${esc(p.action)}" data-arg="${esc(tb.id)}"` : '';
    const anchor = tb.anchor ? ` data-anchor="${esc(tb.anchor)}"` : ''; // 新手引导锚点：spotlight 到具体页签按钮（REQ-UI-Tabs每页签锚点）
    const style = `padding:7px 14px;font-size:12px;cursor:pointer;background:none;outline:none;font-family:${t.fontUi};border:none;border-bottom:2px solid ${on ? t.gold : 'transparent'};color:${on ? t.gold : t.sub};transition:all .15s`;
    return `<button data-tab="${esc(tb.id)}"${act}${anchor} style="${style}">${esc(tb.label)}</button>`;
  };
  const nav = `<div style="display:flex;gap:4px;border-bottom:1px solid ${t.line};flex-wrap:wrap">${p.tabs.map(navBtn).join('')}</div>`;
  const pages = p.tabs.map((tb, i) => {
    const content = children[i] ? renderNode(children[i], t) : '';
    return `<div data-tabpage="${esc(tb.id)}" style="display:${tb.id === active ? 'block' : 'none'}">${content}</div>`;
  }).join('');
  return `<div id="${esc(id)}" data-tabs="${esc(id)}" style="display:flex;flex-direction:column;gap:12px;${ls}">${nav}${pages}</div>`;
}

// ── ProgressBar / Tag（纯展示比例条 + 可点标签·下沉自游戏 HUD/筛选条）──────────

// 比例条：value/max → 填充宽度%（钳 0..100）；tone 映射主题令牌；可选标签 + 右上数值。纯展示·无事件。
function renderProgressBar(id: string, p: ProgressBarProps, ls: string, t: UITheme): string {
  const max = p.max ?? 1;
  const pct = Math.max(0, Math.min(100, max > 0 ? (p.value / max) * 100 : 0));
  const fillColor: Record<string, string> = { accent: t.jade, gold: t.gold, ok: t.ok, warn: t.warn, danger: t.danger };
  const fill = fillColor[p.tone ?? 'accent'] ?? t.jade;
  const valTxt = max === 1 ? `${Math.round(pct)}%` : `${p.value}/${max}`;
  const header = (p.label || p.showValue)
    ? `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">${p.label ? `<span style="font-size:11px;color:${t.sub};font-family:${t.fontUi}">${esc(p.label)}</span>` : '<span></span>'}${p.showValue ? `<span style="font-size:11px;color:${t.dim};font-family:${t.fontMono}">${esc(valTxt)}</span>` : ''}</div>`
    : '';
  return `<div id="${esc(id)}" style="display:flex;flex-direction:column;${ls}">${header}<div style="height:8px;border-radius:5px;background:${t.bg3};overflow:hidden"><div style="width:${pct}%;height:100%;background:${fill};border-radius:5px;transition:width .2s"></div></div></div>`;
}

// 可点标签：active 或 tone 决定底/字/线色；有 action 则整体可点(arg=actionArg)；removable 加 ×。
function renderTag(id: string, p: TagProps, ls: string, t: UITheme): string {
  const on = p.active ?? false;
  const toneBg: Record<string, string> = { normal: 'rgba(255,255,255,0.04)', accent: t.jadeWash, dim: 'transparent' };
  const toneFg: Record<string, string> = { normal: t.sub, accent: t.jade, dim: t.dim };
  const bg = on ? t.jadeWash : (toneBg[p.tone ?? 'normal'] ?? 'rgba(255,255,255,0.04)');
  const fg = on ? t.jade : (toneFg[p.tone ?? 'normal'] ?? t.sub);
  const border = on ? t.jadeLine : t.line;
  const action = p.action ? ` data-action="${esc(p.action)}"${p.actionArg ? ` data-arg="${esc(p.actionArg)}"` : ''}` : '';
  const cursor = p.action ? 'cursor:pointer;' : '';
  const x = p.removable ? '<span style="margin-left:6px;opacity:.7">×</span>' : '';
  // 尺寸档：md=原默认(向后兼容)；lg=大气药丸(货币计数等·≈2x 体量)；sm=紧凑。[padding, font-size, radius]。
  const TAG_DIMS: Record<string, [string, number, number]> = { sm: ['2px 8px', 10, 10], md: ['3px 10px', 11, 12], lg: ['7px 15px', 16, 16] };
  const [pad, fs, rad] = TAG_DIMS[p.size ?? 'md'] ?? TAG_DIMS['md']!;
  return `<span id="${esc(id)}"${action} style="display:inline-flex;align-items:center;padding:${pad};font-size:${fs}px;border-radius:${rad}px;background:${bg};color:${fg};border:1px solid ${border};font-family:${t.fontUi};white-space:nowrap;${cursor}${ls}">${esc(p.label)}${x}</span>`;
}

// 飘字提示药丸：tone 着色（语义令牌）。挂载器 showToast() 复用它做定时自消浮层。
function renderToast(id: string, p: ToastProps, ls: string, t: UITheme): string {
  const toneMap: Record<string, [string, string, string]> = {
    ok:     [t.okWash, t.ok, t.ok],
    warn:   [t.warnWash, t.warn, t.warn],
    danger: ['rgba(211,137,122,0.16)', t.danger, t.danger],
    accent: [t.jadeWash, t.jade, t.jadeLine],
    dim:    ['rgba(255,255,255,0.06)', t.sub, t.line],
  };
  const [bg, fg, bd] = toneMap[p.tone ?? 'dim'] ?? toneMap['dim'] as [string, string, string];
  return `<div id="${esc(id)}" style="display:inline-flex;align-items:center;gap:8px;padding:9px 15px;border-radius:9px;background:${bg};color:${fg};border:1px solid ${bd};font-size:12px;font-family:${t.fontUi};box-shadow:0 6px 20px rgba(0,0,0,0.3);${ls}">${esc(p.text)}</div>`;
}

// 悬浮提示：包裹 children 作触发元素 + 一颗隐藏气泡(按 placement 定位)。显隐由 mountUI hover 内建。
function renderTooltip(id: string, p: TooltipProps, children: LayoutNode[], ls: string, t: UITheme): string {
  const inner = children.map((ch) => renderNode(ch, t)).join('');
  const posMap: Record<string, string> = {
    top:    'bottom:calc(100% + 6px);left:50%;transform:translateX(-50%)',
    bottom: 'top:calc(100% + 6px);left:50%;transform:translateX(-50%)',
    left:   'right:calc(100% + 6px);top:50%;transform:translateY(-50%)',
    right:  'left:calc(100% + 6px);top:50%;transform:translateY(-50%)',
  };
  const pos = posMap[p.placement ?? 'top'] ?? posMap['top'];
  // 富气泡（bubble=LayoutNode 子树·标题/效果/数值行）：宽气泡、可换行、塞 UI 数据；否则简单单行文本气泡（向后兼容）。
  const rich = !!p.bubble;
  const bubbleInner = rich ? renderNode(p.bubble!, t) : esc(p.content ?? '');
  // 气泡底叠不透明 bg0 兜底（owner 2026-06-28「弹出气泡太透·下面的卡都透出来重叠」）→ 永远实底·不透出后面的牌。
  const bubbleBg = `linear-gradient(${t.bg3},${t.bg3}),${t.bg0}`;
  const bubbleStyle = rich
    ? `display:none;position:absolute;${pos};z-index:250;width:240px;max-width:86vw;padding:10px 13px;border-radius:10px;background:${bubbleBg};color:${t.text};border:1px solid ${t.line};font-family:${t.fontUi};box-shadow:0 10px 30px rgba(0,0,0,0.7);pointer-events:none`
    : `display:none;position:absolute;${pos};z-index:250;padding:5px 9px;border-radius:6px;background:${bubbleBg};color:${t.text};border:1px solid ${t.line};font-size:11px;font-family:${t.fontUi};white-space:nowrap;box-shadow:0 8px 22px rgba(0,0,0,0.6);pointer-events:none`;
  const tag = rich ? 'div' : 'span';
  const bubble = `<${tag} data-tooltip-bubble style="${bubbleStyle}">${bubbleInner}</${tag}>`;
  // block 档：触发元素 display:block + 充满 → 能作 grid/flex item 随 1fr 拉伸（包 grid 卡墙里整张牌不塌陷）。缺省 inline-flex。
  const disp = p.block ? 'display:block;width:100%' : 'display:inline-flex';
  // data-tip-place：把首选方位带给 mountUI·hover 时按视口边界翻转/夹取定位（防首排/最左/最右卡气泡出界被裁）。
  return `<span id="${esc(id)}" data-tooltip data-tip-place="${esc(p.placement ?? 'top')}" tabindex="0" style="position:relative;${disp};${ls}">${inner}${bubble}</span>`;
}

// ── Modal（居中模态浮层 + 遮罩·下沉自各游戏手搭确认框/详情弹窗）─────────────────

// 遮罩满屏居中弹窗体；点 ×(data-action) 或点遮罩本身(data-modal-close·mountUI 内建) → closeAction。
function renderModal(id: string, p: ModalProps, children: LayoutNode[], ls: string, t: UITheme): string {
  const widthMap: Record<string, number> = { sm: 320, md: 460, lg: 640 };
  const w = widthMap[p.size ?? 'md'] ?? 460;
  const closable = p.closable ?? true;
  const scrimClose = p.closeAction ? ` data-modal-close="${esc(p.closeAction)}"` : '';
  const xBtn = (closable && p.closeAction)
    ? `<button data-action="${esc(p.closeAction)}" aria-label="close" style="position:absolute;top:10px;right:13px;width:26px;height:26px;background:none;border:none;color:${t.dim};font-size:19px;line-height:1;cursor:pointer;font-family:${t.fontUi}">×</button>`
    : '';
  const title = p.title
    ? `<div style="font-size:15px;font-weight:700;color:${t.text};font-family:${t.fontUi};margin-bottom:12px;padding-right:26px">${esc(p.title)}</div>`
    : '';
  const body = children.map((ch) => renderNode(ch, t)).join('');
  // 遮罩加深 0.62→0.9（owner 2026-06-28 两度反馈「弹层太透·看穿到本体」）：弹层须与背后大厅强分离·操作看得清。
  // 面板底叠一层不透明 bg0 兜底（防 t.bg1 在半透明主题下透出背景·如战斗皮肤 var(--panel)）→ 内容永远实底可读。
  return `<div id="${esc(id)}"${scrimClose} style="position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,0.9);${ls}"><div style="position:relative;width:${w}px;max-width:100%;max-height:88vh;overflow-y:auto;background:linear-gradient(${t.bg1},${t.bg1}),${t.bg0};border:1px solid ${t.line};border-radius:12px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,0.7)">${xBtn}${title}${body}</div></div>`;
}

// ── Card / Stepper / Segmented / Avatar / Accordion（P1·网格卡/数量/分段/头像/折叠）──────

// 网格卡单元：媒体字形 + 标题 + 副标 + 角标 + tone 边框/暗化 + 可点。children 非空则替默认排版。
function renderCard(id: string, p: CardProps, children: LayoutNode[], ls: string, t: UITheme): string {
  const border = p.tone === 'accent' ? t.jadeLine : t.line;
  const dimmed = (p.tone === 'locked' || p.tone === 'dim') ? 'opacity:.55;' : '';
  const action = p.action ? ` data-action="${esc(p.action)}"${p.actionArg ? ` data-arg="${esc(p.actionArg)}"` : ''}` : '';
  const cursor = p.action ? 'cursor:pointer;' : '';
  const corner = p.corner ? `<span style="position:absolute;top:7px;right:8px;font-size:9px;padding:1px 6px;border-radius:7px;background:${t.jadeWash};color:${t.jade};font-family:${t.fontUi}">${esc(p.corner)}</span>` : '';
  const body = children.length
    ? children.map((ch) => renderNode(ch, t)).join('')
    : `${p.media ? `<div style="font-size:26px;text-align:center;margin-bottom:6px">${esc(p.media)}</div>` : ''}${p.title ? `<div style="font-size:12px;font-weight:700;color:${t.text};font-family:${t.fontUi};text-align:center;line-height:1.3">${esc(p.title)}</div>` : ''}${p.sub ? `<div style="font-size:10px;color:${t.dim};font-family:${t.fontUi};text-align:center;margin-top:3px">${esc(p.sub)}</div>` : ''}`;
  return `<div id="${esc(id)}"${action} style="position:relative;display:flex;flex-direction:column;justify-content:center;padding:12px 10px;border-radius:10px;background:${t.bg2};border:1px solid ${border};font-family:${t.fontUi};${dimmed}${cursor}${ls}">${corner}${body}</div>`;
}

// ── PlayingCard（扑克牌原语）：双角镜像 + 中央大花色 + 正/背面 + 选中/暗态 + 可点。──
// 红黑自动判（♥♦红·其余黑·借主题 danger/text 令牌·随皮走）；尺寸 sm/md/lg；旋转缩放交给 layout。
const PCARD_DIMS: Record<string, [number, number, number, number]> = { sm: [52, 72, 13, 26], md: [64, 90, 15, 34], lg: [82, 116, 18, 46] };
function renderPlayingCard(id: string, p: PlayingCardProps, ls: string, t: UITheme): string {
  const [w, h, corner, big] = PCARD_DIMS[p.size ?? 'md'] ?? PCARD_DIMS['md']!;
  const dim = p.fluid ? 'width:100%;aspect-ratio:5/7' : `width:${w}px;height:${h}px`; // fluid=充满父格(5:7)·替代固定档
  const isRed = p.suit === '♥' || p.suit === '♦';
  const light = p.face === 'light';
  // light=经典白扑克牌（红黑对比·对决卡用）；dark=暗主题卡（牌库格/收藏用·缺省）。
  const sc = light ? (isRed ? '#c0392b' : '#1a1a1a') : (isRed ? t.danger : t.text);
  const faceUp = p.faceUp !== false;
  const action = p.action ? ` data-action="${esc(p.action)}"${p.actionArg ? ` data-arg="${esc(p.actionArg)}"` : ''}` : '';
  const cursor = p.action ? 'cursor:pointer;' : '';
  const dimmed = p.dimmed ? 'opacity:.5;' : '';
  const selBorder = p.selected ? t.gold : sc;
  const glow = p.selected ? `box-shadow:0 0 0 1px ${t.gold},0 0 12px ${t.jadeLine};` : '';
  const pip = (pos: string): string => `<span style="position:absolute;${pos};font-size:${corner}px;line-height:1;color:${sc};font-family:${t.fontUi};text-align:center">${esc(p.rank)}<br>${esc(p.suit)}</span>`;
  // 中央：有立绘 art（REQ-UI-G·G5）→ 居中显立绘剪影、替代中央大花色（角标点数花色仍在）；否则原大花色。
  const center = (faceUp && p.art)
    ? `<img src="${esc(p.art)}" alt="" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:78%;height:78%;object-fit:contain;pointer-events:none">`
    : `<span style="font-size:${big}px;color:${sc};opacity:.9">${esc(p.suit)}</span>`;
  // 牌背程序化纹理（REQ-UI-G流光底纹②）：faceUp:false 时叠 checker 棋盘格 / stripe 斜条纹（原版红牌背质感）。
  const backPat = (!faceUp && p.backPattern)
    ? `<div style="position:absolute;inset:0;border-radius:8px;pointer-events:none;background:${p.backPattern === 'checker' ? 'repeating-conic-gradient(rgba(255,255,255,.06) 0% 25%,transparent 0% 50%) 0 0 / 12px 12px' : 'repeating-linear-gradient(45deg,rgba(255,255,255,.06) 0 2px,transparent 2px 9px)'}"></div>`
    : '';
  const inner = faceUp
    ? `${pip('top:5px;left:6px')}${center}${pip('bottom:5px;right:6px;transform:rotate(180deg)')}`
    : `${backPat}<span style="font-size:${big}px;color:${t.jade};opacity:.5">${esc(p.back ?? '♠')}</span>`;
  const faceBg = faceUp ? (light ? 'linear-gradient(160deg,#fefdfb,#eceae3)' : t.bg2) : (light ? 'linear-gradient(160deg,#b34a4a,#8c3535)' : t.bg3);
  const lblColor = light ? '#5a5048' : t.sub;
  const label = p.label ? `<div style="position:absolute;bottom:3px;left:0;right:0;font-size:9px;color:${lblColor};font-family:${t.fontUi};text-align:center;${light ? '' : 'text-shadow:0 1px 2px rgba(0,0,0,.6)'}">${esc(p.label)}</div>` : '';
  const value = p.value ? `<span style="position:absolute;bottom:4px;right:6px;font-size:10px;font-weight:700;color:${t.gold};font-family:${t.fontUi}">${esc(p.value)}</span>` : '';
  // 悬停翻面（REQ-UI-G收藏卡①）：front=牌面 / back=信息子树，hover 时 scaleX 翻（CSS 注入·见 APOLLO_KEYFRAMES 的 data-flipcard 规则）。
  if (p.flipOnHover && p.backFace) {
    const face = `position:absolute;inset:0;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;border:2px solid ${selBorder};font-family:${t.fontUi};${glow}${dimmed}`;
    const front = `<div data-flip-front style="${face};background:${faceBg}">${inner}${label}${value}</div>`;
    const back = `<div data-flip-back style="${face};background:${t.bg2};padding:7px;overflow:hidden">${renderNode(p.backFace, t)}</div>`;
    return `<div id="${esc(id)}"${action} data-flipcard style="position:relative;${dim};${cursor}${ls}">${front}${back}</div>`;
  }
  return `<div id="${esc(id)}"${action} style="position:relative;display:inline-flex;align-items:center;justify-content:center;${dim};border-radius:8px;background:${faceBg};border:2px solid ${selBorder};font-family:${t.fontUi};${glow}${dimmed}${cursor}${ls}">${inner}${label}${value}</div>`;
}

// ── CoinFlip（掷币）：3D 双面硬币·spinning 播翻转落定到 outcome·静态则直接显示结果面。──
function renderCoinFlip(id: string, p: CoinFlipProps, ls: string, t: UITheme): string {
  const d = num(p.size, 92);
  const ms = num(p.durationMs, 1100);
  const tails = p.outcome === 'tails';
  const action = p.action ? ` data-action="${esc(p.action)}"` : '';
  const cursor = p.action ? 'cursor:pointer;' : '';
  // spinning：用白名单关键帧（apollo-coin-heads/tails·server.ts 注入）落定；静态：直接定到结果面。
  const spin = p.spinning
    ? `animation:apollo-coin-${tails ? 'tails' : 'heads'} ${ms}ms ease-out both;`
    : `transform:rotateX(${tails ? 180 : 0}deg);`;
  const face = (label: string, bg: string, rot: number): string =>
    `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:50%;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform:rotateX(${rot}deg);background:${bg};border:3px solid ${t.gold};color:${t.bg0};font-family:${t.fontUi};font-weight:700;font-size:${Math.round(d / 5)}px">${esc(label)}</div>`;
  return `<div id="${esc(id)}"${action} style="width:${d}px;height:${d}px;perspective:600px;${cursor}${ls}">` +
    `<div style="position:relative;width:100%;height:100%;transform-style:preserve-3d;${spin}">` +
    face(p.headsLabel ?? '正', t.gold, 0) + face(p.tailsLabel ?? '反', t.warn, 180) +
    `</div></div>`;
}

// ── Versus（对决特写）：左右两张 PlayingCard 对决 + 中央胜率/火花 + 胜方高亮。──
function renderVersus(id: string, p: VersusProps, ls: string, t: UITheme): string {
  const spark = p.spark !== false;
  const card = (cp: PlayingCardProps, side: 'left' | 'right'): string => {
    const lose = p.winner && p.winner !== 'none' && p.winner !== side;
    const win = p.winner === side;
    return renderPlayingCard(`${id}-${side}`, { ...cp, size: cp.size ?? 'lg', selected: win, dimmed: lose }, '', t);
  };
  const center = `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:0 14px">` +
    (spark ? `<span style="font-size:26px;color:${t.gold};animation:apollo-spark 700ms ease-out both">✦</span>` : '') +
    `<span style="font-size:18px;color:${t.danger};font-family:${t.fontUi};font-weight:700">⚔</span>` +
    (p.label ? `<span style="font-size:13px;color:${t.gold};font-family:${t.fontUi};font-weight:700;white-space:nowrap">${esc(p.label)}</span>` : '') +
    `</div>`;
  return `<div id="${esc(id)}" style="display:inline-flex;align-items:center;justify-content:center;animation:apollo-clash 500ms ease-out both;${ls}">${card(p.left, 'left')}${center}${card(p.right, 'right')}</div>`;
}

// 数量 ±：到界或无 action 则禁用按钮（不发信号）；按钮 data-arg=钳位后新值。
function renderStepper(id: string, p: StepperProps, ls: string, t: UITheme): string {
  const min = p.min ?? 0, max = p.max ?? 99, step = p.step ?? 1, v = p.value;
  const btn = (lbl: string, target: number, disabled: boolean): string =>
    `<button${disabled ? ' disabled' : ` data-action="${esc(p.action ?? '')}" data-arg="${target}"`} style="width:26px;height:26px;border-radius:6px;background:${t.bg2};border:1px solid ${t.line};color:${t.sub};font-size:15px;line-height:1;cursor:${disabled ? 'not-allowed' : 'pointer'};font-family:${t.fontUi};opacity:${disabled ? 0.4 : 1}">${lbl}</button>`;
  return `<div id="${esc(id)}" style="display:inline-flex;align-items:center;gap:8px;${ls}">${btn('−', Math.max(min, v - step), !p.action || v <= min)}<span style="min-width:28px;text-align:center;font-size:13px;color:${t.text};font-family:${t.fontMono}">${v}</span>${btn('+', Math.min(max, v + step), !p.action || v >= max)}</div>`;
}

// 紧凑分段选择：选中段洗色高亮；点段 → action(arg=value)。
function renderSegmented(id: string, p: SegmentedProps, ls: string, t: UITheme): string {
  const segs = p.options.map((o) => {
    const on = p.value === o.value;
    const action = p.action ? ` data-action="${esc(p.action)}" data-arg="${esc(o.value)}"` : '';
    return `<button${action} style="padding:5px 12px;border:none;border-radius:6px;background:${on ? t.jadeWash : 'transparent'};color:${on ? t.jade : t.sub};font-size:12px;cursor:pointer;font-family:${t.fontUi}">${esc(o.label)}</button>`;
  }).join('');
  return `<div id="${esc(id)}" style="display:inline-flex;gap:2px;padding:2px;border-radius:8px;background:${t.bg2};border:1px solid ${t.line};${ls}">${segs}</div>`;
}

// 头像/立绘位：src 有则图、无则 name 首字；shape 决定圆角。
function renderAvatar(id: string, p: AvatarProps, ls: string, t: UITheme): string {
  const size = p.size ?? 40;
  const radius = p.shape === 'square' ? 0 : p.shape === 'rounded' ? Math.round(size * 0.22) : size;
  const inner = p.src
    ? `<img src="${esc(p.src)}" alt="${esc(p.name ?? '')}" style="width:100%;height:100%;object-fit:cover">`
    : `<span style="font-size:${Math.round(size * 0.42)}px;color:${t.sub};font-family:${t.fontUi}">${esc((p.name ?? '?').slice(0, 1))}</span>`;
  return `<span id="${esc(id)}" title="${esc(p.name ?? '')}" style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:${radius}px;overflow:hidden;background:${t.bg3};border:1px solid ${t.line};${ls}">${inner}</span>`;
}

// 折叠面板：title 行点击切开合（mountUI 内建·锚 data-accordion*）；open 初始展开。
function renderAccordion(id: string, p: AccordionProps, children: LayoutNode[], ls: string, t: UITheme): string {
  const open = p.open ?? false;
  const action = p.action ? ` data-action="${esc(p.action)}"` : '';
  const head = `<button data-accordion-head${action} style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:10px 12px;background:${t.bg2};border:1px solid ${t.line};border-radius:8px;color:${t.text};font-size:13px;font-weight:600;cursor:pointer;font-family:${t.fontUi}"><span>${esc(p.title)}</span><span data-accordion-caret style="color:${t.dim};transition:transform .15s;transform:rotate(${open ? 90 : 0}deg)">▸</span></button>`;
  const body = `<div data-accordion-body style="display:${open ? 'block' : 'none'};padding:10px 12px">${children.map((ch) => renderNode(ch, t)).join('')}</div>`;
  return `<div id="${esc(id)}" data-accordion style="display:flex;flex-direction:column;gap:4px;${ls}">${head}${body}</div>`;
}

// ── Rating / Combobox / Drawer（P2·星级 / 搜索下拉 / 抽屉）──────────────────────

// 星级：1..max 颗，≤value 点亮(金)；有 action 则每颗可点(arg=颗数)设值，无则只读。
function renderRating(id: string, p: RatingProps, ls: string, t: UITheme): string {
  const max = p.max ?? 5;
  const stars = Array.from({ length: max }, (_, i) => {
    const n = i + 1, on = n <= p.value;
    const act = p.action ? ` data-action="${esc(p.action)}" data-arg="${n}"` : '';
    return `<span${act} style="font-size:16px;line-height:1;color:${on ? t.gold : t.dim};${p.action ? 'cursor:pointer;' : ''}">${on ? '★' : '☆'}</span>`;
  }).join('');
  return `<span id="${esc(id)}" style="display:inline-flex;gap:2px;${ls}">${stars}</span>`;
}

// 搜索下拉：输入框 + 选项面板（缺省隐）。开合/过滤/点选/点外合由 mountUI 内建（data-combo* 锚点）。
function renderCombobox(id: string, p: ComboboxProps, ls: string, t: UITheme): string {
  const selected = p.options.find((o) => o.value === p.value);
  const opts = p.options
    .map((o) => `<div data-combo-opt="${esc(o.value)}" data-combo-label="${esc(o.label)}" style="padding:7px 10px;font-size:12px;color:${t.text};cursor:pointer;font-family:${t.fontUi}">${esc(o.label)}</div>`)
    .join('');
  const inp = `background:${t.bg2};color:${t.text};border:1px solid ${t.line};border-radius:6px;font-size:12px;padding:6px 10px;outline:none;font-family:${t.fontUi};width:100%`;
  return `<div id="${esc(id)}" data-combo="${esc(p.action ?? '')}" style="position:relative;${ls}"><input data-combo-search type="text" autocomplete="off" placeholder="${esc(p.placeholder ?? '搜索…')}" value="${esc(selected?.label ?? '')}" style="${inp}"><div data-combo-panel style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:250;max-height:220px;overflow:auto;background:${t.bg2};border:1px solid ${t.line};border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,0.4)">${opts}</div></div>`;
}

// 抽屉：贴边面板 + 遮罩。遮罩关闭复用 mountUI 的 data-modal-close（与 Modal 同套路·零新增运行时）。
function renderDrawer(id: string, p: DrawerProps, children: LayoutNode[], ls: string, t: UITheme): string {
  const side = p.side ?? 'right';
  const panelPos: Record<string, string> = {
    left:   `top:0;left:0;bottom:0;width:340px;max-width:86%;border-right:1px solid ${t.line}`,
    right:  `top:0;right:0;bottom:0;width:340px;max-width:86%;border-left:1px solid ${t.line}`,
    bottom: `left:0;right:0;bottom:0;max-height:82%;border-top:1px solid ${t.line};border-radius:14px 14px 0 0`,
  };
  const scrimClose = p.closeAction ? ` data-modal-close="${esc(p.closeAction)}"` : '';
  const xBtn = p.closeAction
    ? `<button data-action="${esc(p.closeAction)}" aria-label="close" style="position:absolute;top:10px;right:13px;width:26px;height:26px;background:none;border:none;color:${t.dim};font-size:19px;line-height:1;cursor:pointer;font-family:${t.fontUi}">×</button>`
    : '';
  const title = p.title ? `<div style="font-size:15px;font-weight:700;color:${t.text};font-family:${t.fontUi};margin-bottom:12px;padding-right:26px">${esc(p.title)}</div>` : '';
  const body = children.map((ch) => renderNode(ch, t)).join('');
  return `<div id="${esc(id)}"${scrimClose} style="position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.62);${ls}"><div style="position:absolute;${panelPos[side]};background:${t.bg1};padding:20px;overflow:auto;box-shadow:0 0 50px rgba(0,0,0,0.5)">${xBtn}${title}${body}</div></div>`;
}

// ── VirtualList / ContextMenu（P2 收尾·长列表虚拟滚动 / 右键菜单）──────────────────

// 单行（绝对定位在 index*rowHeight）：列定义同 Table；可点(arg=row.id)。
function vlistRowHtml(p: VirtualListProps, row: { id: string; cells: Record<string, string> }, index: number, t: UITheme): string {
  const cols = p.columns ?? [{ key: Object.keys(row.cells)[0] ?? '', label: '' }];
  const act = p.action ? ` data-action="${esc(p.action)}" data-arg="${esc(row.id)}"` : '';
  const cells = cols.map((c) => `<span style="${c.width !== undefined ? `flex:0 0 ${c.width}px` : 'flex:1'};text-align:${c.align ?? 'left'};font-size:12px;color:${t.text};font-family:${t.fontUi};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(row.cells[c.key] ?? '')}</span>`).join('');
  return `<div data-vlist-row="${esc(row.id)}"${act} style="position:absolute;top:${index * p.rowHeight}px;left:0;right:0;height:${p.rowHeight}px;display:flex;align-items:center;gap:10px;padding:0 12px;${p.action ? 'cursor:pointer;' : ''}border-bottom:1px solid ${t.line}">${cells}</div>`;
}

// 可视窗口（按 scrollTop 算 [start,end)·带缓冲）。renderNode 初次用 scrollTop=0；mountUI 滚动时复用本函数。
export function renderVListWindow(p: VirtualListProps, scrollTop: number, t: UITheme): string {
  const viewport = p.height ?? 320;
  const count = Math.ceil(viewport / p.rowHeight) + 4; // 窗口 + 缓冲
  const start = Math.max(0, Math.floor(scrollTop / p.rowHeight) - 2);
  const end = Math.min(p.rows.length, start + count);
  let html = '';
  for (let i = start; i < end; i++) html += vlistRowHtml(p, p.rows[i]!, i, t);
  return html;
}

function renderVirtualList(id: string, p: VirtualListProps, ls: string, t: UITheme): string {
  const h = p.height ?? 320;
  const total = p.rows.length * p.rowHeight;
  return `<div id="${esc(id)}" data-vlist="${esc(id)}" style="height:${h}px;overflow-y:auto;background:${t.bg1};border:1px solid ${t.line};border-radius:10px;${ls}"><div data-vlist-spacer style="position:relative;height:${total}px">${renderVListWindow(p, 0, t)}</div></div>`;
}

// 右键菜单：包裹 children 作触发元素 + 一个隐藏菜单(右键在光标处弹·mountUI 内建)。项带 data-action(arg=item.id)。
function renderContextMenu(id: string, p: ContextMenuProps, children: LayoutNode[], ls: string, t: UITheme): string {
  const items = p.items.map((it) => `<button data-action="${esc(it.action)}" data-arg="${esc(it.id)}" data-ctxmenu-item style="display:block;width:100%;text-align:left;padding:7px 14px;background:none;border:none;color:${t.text};font-size:12px;cursor:pointer;font-family:${t.fontUi};white-space:nowrap;border-radius:5px">${esc(it.label)}</button>`).join('');
  const pop = `<div data-ctxmenu-pop style="display:none;position:fixed;z-index:260;min-width:140px;background:${t.bg2};border:1px solid ${t.line};border-radius:8px;padding:4px;box-shadow:0 12px 30px rgba(0,0,0,0.4)">${items}</div>`;
  const inner = children.map((ch) => renderNode(ch, t)).join('');
  return `<span id="${esc(id)}" data-ctxmenu style="position:relative;display:inline-flex;${ls}">${inner}${pop}</span>`;
}

// ── 统一入口 ────────────────────────────────────────────────────

/** 将 LayoutNode 树渲染为 HTML 字符串。弱模型提供数据 + 可选主题；此函数是解释器。缺省主题 = 引擎 SHELL 脸。 */
/**
 * 渲染 LayoutNode → HTML 串。出口处理拖拽声明（draggable/dropZone）：
 * 把 draggable/data-drag/data-drop 注入到元素的开标签（不加包裹层·不破布局），mountUI 收手势。
 */
// Video：原生 <video> 数据驱动播放（爱诗 AIGP 开场/转场短视频等）。src/poster esc 防属性注入；
// autoplay 自动补 muted（浏览器自动播放策略）；controls 缺省开。纯表现·无 sim 介入。
function renderVideo(id: string, p: VideoProps, ls: string, t: UITheme): string {
  const auto = p.autoplay ? ' autoplay muted' : (p.muted ? ' muted' : '');
  const flags = `${p.controls === false ? '' : ' controls'}${p.loop ? ' loop' : ''}${auto} playsinline`;
  const src = p.src ? ` src="${esc(p.src)}"` : '';
  const poster = p.poster ? ` poster="${esc(p.poster)}"` : '';
  const style = `display:block;max-width:100%;background:#000;border:1px solid ${t.line};border-radius:10px;${ls}`;
  return `<video id="${esc(id)}"${src}${poster}${flags} style="${style}"></video>`;
}

export function renderNode(node: LayoutNode, theme: UITheme = SHELL): string {
  const html = renderDispatch(node, theme);
  const c = node.layout;
  const fxData = c?.fx?.length ? fxToCss(c.fx, theme).dataFx : ''; // sheen/flash 等叠层 token
  if (c && (c.draggable || c.dropZone || c.anchor || c.sheen || fxData)) {
    const a: string[] = [];
    if (c.draggable) a.push(`draggable="true" data-drag="${esc(node.id)}"`);
    if (c.dropZone)  a.push(`data-drop="${esc(c.dropZone)}"`);
    if (c.anchor)    a.push(`data-anchor="${esc(c.anchor)}"`); // 新手引导 spotlight 锚点（OnboardingOverlay 定位）
    if (c.sheen)     a.push('data-sheen'); // 流光层（CSS 注入 ::after·apollo-sheen-sweep）
    if (fxData)      a.push(`data-fx="${esc(fxData)}"`); // 特效叠层（sheen/flash → ::after/::before）
    return html.replace(/^(\s*<[a-zA-Z][\w-]*)/, `$1 ${a.join(' ')}`);
  }
  return html;
}

function renderDispatch(node: LayoutNode, theme: UITheme = SHELL): string {
  const t = theme;
  const ls = layoutStyle(node.layout, t);
  switch (node.type) {
    case 'Button':     return renderButton(node.id, node.props as ButtonProps, ls, t);
    case 'Label':      return renderLabel(node.id, node.props as LabelProps, ls, t);
    case 'Dropdown':   return renderDropdown(node.id, node.props as DropdownProps, ls, t);
    case 'Badge':      return renderBadge(node.id, node.props as BadgeProps, ls, t);
    case 'Input':      return renderInput(node.id, node.props as InputProps, ls, t);
    case 'Divider':    return renderDivider(node.id, ls, t);
    case 'Panel':      return renderPanel(node.id, node.props as PanelProps, node.layout, node.children ?? [], t);
    case 'Checkbox':   return renderCheckbox(node.id, node.props as CheckboxProps, ls, t);
    case 'Toggle':     return renderToggle(node.id, node.props as ToggleProps, ls, t);
    case 'RadioGroup': return renderRadioGroup(node.id, node.props as RadioGroupProps, ls, t);
    case 'Image':      return renderImage(node.id, node.props as ImageProps, ls);
    case 'Screen':     return renderScreen(node.id, node.props as ScreenProps, node.children ?? [], t);
    case 'Slider':     return renderSlider(node.id, node.props as SliderProps, ls, t);
    case 'Table':      return renderTable(node.id, node.props as TableProps, ls, t);
    case 'Tabs':       return renderTabs(node.id, node.props as TabsProps, node.children ?? [], ls, t);
    case 'ProgressBar':return renderProgressBar(node.id, node.props as ProgressBarProps, ls, t);
    case 'Tag':        return renderTag(node.id, node.props as TagProps, ls, t);
    case 'Modal':      return renderModal(node.id, node.props as ModalProps, node.children ?? [], ls, t);
    case 'Toast':      return renderToast(node.id, node.props as ToastProps, ls, t);
    case 'Tooltip':    return renderTooltip(node.id, node.props as TooltipProps, node.children ?? [], ls, t);
    case 'Card':       return renderCard(node.id, node.props as CardProps, node.children ?? [], ls, t);
    case 'PlayingCard':return renderPlayingCard(node.id, node.props as PlayingCardProps, ls, t);
    case 'CoinFlip':   return renderCoinFlip(node.id, node.props as CoinFlipProps, ls, t);
    case 'Versus':     return renderVersus(node.id, node.props as VersusProps, ls, t);
    case 'Stepper':    return renderStepper(node.id, node.props as StepperProps, ls, t);
    case 'Segmented':  return renderSegmented(node.id, node.props as SegmentedProps, ls, t);
    case 'Avatar':     return renderAvatar(node.id, node.props as AvatarProps, ls, t);
    case 'Accordion':  return renderAccordion(node.id, node.props as AccordionProps, node.children ?? [], ls, t);
    case 'Rating':     return renderRating(node.id, node.props as RatingProps, ls, t);
    case 'Combobox':   return renderCombobox(node.id, node.props as ComboboxProps, ls, t);
    case 'Drawer':     return renderDrawer(node.id, node.props as DrawerProps, node.children ?? [], ls, t);
    case 'VirtualList':return renderVirtualList(node.id, node.props as VirtualListProps, ls, t);
    case 'ContextMenu':return renderContextMenu(node.id, node.props as ContextMenuProps, node.children ?? [], ls, t);
    case 'Video':      return renderVideo(node.id, node.props as VideoProps, ls, t);
    default:           return `<!-- unknown: ${String((node as LayoutNode).type)} -->`;
  }
}
