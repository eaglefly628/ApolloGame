import type { CSSProperties } from 'react';

// ═══════════════════════════════════════════════════════════════
//  ZeroCraft Shell 统一视觉基调（引擎壳层：launcher / Studio / 资源库 / 游戏返回钮）
//
//  气质定位：清幽 · 高雅 · 高级 · 秩序 —— 一台安静运转的 AI 引擎。
//  · 绯红近黑作底（不是纯黑：保留一点酒红的"夜色"层次·呼应 ZeroCraft 立方体图标的红底）
//  · 主色「珊瑚红」（coral，暖亮·取自图标顶面）；辅色「玫」（rose·取自图标侧面）；点睛「淡金」（克制地表达高级·跟红系相衬）
//  · 发丝线分隔（hairline）替代重边框；阔字距小标签表达秩序感
//  · 语义色（成功/警示/危险）统一降饱和，不抢戏
//
//  与 src/ui/themes/（游戏内 UI 主题包，给玩家看）是两层：这里是引擎自己的脸。
//  规则：壳层组件一律从此取色/取样式，不再各自内联色值。
// ═══════════════════════════════════════════════════════════════

// ZeroCraft 绯玄 onyx 贴图底（品牌重塑 2026-08-01：引擎 chrome 配 ZeroCraft 红立方体图标脸·绯红系）。程序化纹理·零资产。
const ZEROCRAFT_APPBG  = 'radial-gradient(120% 120% at 50% -8%, #4a0e1a 0%, #2a0810 55%, #140409 100%)'; // 酒红径向底色
const ZEROCRAFT_TEXTURE = 'repeating-linear-gradient(45deg, rgba(240,150,160,.05) 0 1px, transparent 1px 9px), repeating-linear-gradient(-45deg, rgba(240,150,160,.04) 0 1px, transparent 1px 9px)'; // 绯红斜向交叉细纹
const ZEROCRAFT_WASH    = 'radial-gradient(120% 85% at 28% 8%, rgba(225,29,72,.20), transparent 55%), radial-gradient(100% 80% at 88% 100%, rgba(18,4,10,.55), transparent 55%)'; // 左上绯光提亮 + 右下压暗

export const SHELL = {
  // 底色（由深到浅四级·绯玄夜色）
  bg0: '#140409',
  bg1: '#1c060d',
  bg2: '#280913',
  bg3: '#380e1a',
  /** 页面大背景渐变 */
  pageBg: 'linear-gradient(180deg, #140409 0%, #2a0812 100%)',
  /** 引擎页面贴图底（ZeroCraft 绯玄 onyx 分层合成：wash , 纹理 , 径向底色）。launcher/Studio 等 React chrome 根背景用它。
   *  刻意只做这一个合成字段、不设 SHELL.texture/wash——否则会污染 renderNode 默认主题、给所有默认数据 Screen 平添贴图（非本需求）。 */
  appBg: `${ZEROCRAFT_WASH}, ${ZEROCRAFT_TEXTURE}, ${ZEROCRAFT_APPBG}`,

  // 发丝线（绯调）
  line: 'rgba(220,150,160,0.10)',
  lineStrong: 'rgba(220,150,160,0.22)',

  // 文字（亮 → 暗·暖调）
  text: '#f5e9ea',
  sub: '#c9a1a8',
  dim: '#8f636c',
  faint: '#5c3b43',

  // 主色 · 珊瑚红（coral·图标顶面·暖亮跳色）
  jade: '#ff7d6e',
  jadeWash: 'rgba(255,125,110,0.12)',
  jadeLine: 'rgba(255,125,110,0.38)',

  // 辅色 · 玫（rose·图标侧面）
  violet: '#ff93a6',
  violetWash: 'rgba(255,147,166,0.12)',
  violetLine: 'rgba(255,147,166,0.34)',

  // 点睛 · 淡金（克制使用：选中态/高亮数字）
  gold: '#d4bd8a',
  goldWash: 'rgba(212,189,138,0.10)',

  // 语义（降饱和）
  ok: '#84c7a4',
  okWash: 'rgba(132,199,164,0.12)',
  warn: '#d6b277',
  warnWash: 'rgba(214,178,119,0.12)',
  danger: '#d99090',
  dangerWash: 'rgba(217,144,144,0.12)',

  // 深墨字（Label color:'ink'·金按钮/浅底上的深色文字）
  ink: '#2a1f12',

  // 字体栈
  fontUi: "-apple-system, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  fontDisplay: "'Palatino Linotype', 'Songti SC', 'Noto Serif SC', Georgia, serif",
  fontMono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  // 像素点阵字体槽（Label font:'pixel'）：优先真像素字体，无则回退等宽（仍是方块感·区别于 sans-serif fontUi）。REQ-UI-fontPixel令牌。
  fontPixel: "'Silkscreen', 'DotGothic16', 'Press Start 2P', ui-monospace, monospace",

  // 阴影
  shadow: '0 12px 40px rgba(3,6,12,0.55)',
} as const;

/** 阔字距小标签（秩序感的来源：节标题/分组名一律用它）。 */
export const sLabel: CSSProperties = {
  fontSize: 10,
  letterSpacing: 2.4,
  textTransform: 'uppercase',
  color: SHELL.dim,
  fontFamily: SHELL.fontUi,
};

/** 按钮三态：primary(青瓷实底洗色) / ghost(发丝线) / quiet(无边框弱按钮)。 */
export function sBtn(kind: 'primary' | 'ghost' | 'quiet' = 'ghost'): CSSProperties {
  const base: CSSProperties = {
    padding: '6px 14px',
    borderRadius: 7,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: SHELL.fontUi,
    outline: 'none',
    transition: 'all .15s',
  };
  if (kind === 'primary')
    return { ...base, background: SHELL.jadeWash, color: SHELL.jade, border: `1px solid ${SHELL.jadeLine}`, fontWeight: 600 };
  if (kind === 'quiet')
    return { ...base, background: 'transparent', color: SHELL.dim, border: '1px solid transparent' };
  return { ...base, background: 'rgba(255,255,255,0.03)', color: SHELL.sub, border: `1px solid ${SHELL.line}` };
}

/** 面板（卡片/侧栏）。 */
export function sPanel(): CSSProperties {
  return { background: SHELL.bg1, border: `1px solid ${SHELL.line}`, borderRadius: 10 };
}

/** 文本输入框。 */
export function sInput(): CSSProperties {
  return {
    background: 'rgba(0,0,0,0.35)',
    color: SHELL.text,
    border: `1px solid ${SHELL.line}`,
    borderRadius: 6,
    fontSize: 12,
    padding: '6px 10px',
    outline: 'none',
    fontFamily: SHELL.fontUi,
  };
}

/** 下拉选择。 */
export function sSelect(): CSSProperties {
  return { ...sInput(), background: SHELL.bg2, color: SHELL.sub, cursor: 'pointer' };
}

/** 可点过滤 chip（tag/分类）。 */
export function sChip(active: boolean): CSSProperties {
  return {
    padding: '3px 10px',
    fontSize: 11,
    borderRadius: 12,
    cursor: 'pointer',
    fontFamily: SHELL.fontUi,
    background: active ? SHELL.jadeWash : 'rgba(255,255,255,0.04)',
    color: active ? SHELL.jade : SHELL.sub,
    border: `1px solid ${active ? SHELL.jadeLine : SHELL.line}`,
    whiteSpace: 'nowrap',
  };
}

/** 状态徽章（filled/tbf/placeholder…）。 */
export function sBadge(tone: 'ok' | 'warn' | 'dim'): CSSProperties {
  const map = {
    ok: { background: SHELL.okWash, color: SHELL.ok },
    warn: { background: SHELL.warnWash, color: SHELL.warn },
    dim: { background: 'rgba(154,170,196,0.10)', color: SHELL.dim },
  } as const;
  return { ...map[tone], fontSize: 9, padding: '1px 7px', borderRadius: 8, whiteSpace: 'nowrap' };
}

/** 棋盘格透明底（资产缩略图背景）。 */
export const sChecker: CSSProperties = {
  background: 'repeating-conic-gradient(#2a0d14 0% 25%, #1a0710 0% 50%) 50% / 16px 16px',
};

/** 游戏内右上角壳层菜单 · 齿轮触发钮（替代旧常驻「返回」pill：缩成一颗图标，不再压住游戏右上角 HUD）。 */
export function sGearBtn(open = false): CSSProperties {
  return {
    width: 34,
    height: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: open ? 'rgba(15,21,35,0.92)' : 'rgba(6,8,13,0.78)',
    color: open ? SHELL.text : SHELL.sub,
    border: `1px solid ${open ? SHELL.jadeLine : SHELL.lineStrong}`,
    borderRadius: 999,
    fontSize: 15,
    lineHeight: 1,
    cursor: 'pointer',
    fontFamily: SHELL.fontUi,
    backdropFilter: 'blur(8px)',
    outline: 'none',
    transition: 'all .15s',
  };
}

/** 壳层菜单浮层（齿轮正下方 · 右对齐展开）。 */
export function sMenuPanel(): CSSProperties {
  return {
    position: 'absolute',
    top: 40,
    right: 0,
    minWidth: 152,
    padding: 5,
    background: 'rgba(10,14,23,0.96)',
    border: `1px solid ${SHELL.lineStrong}`,
    borderRadius: 10,
    boxShadow: SHELL.shadow,
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  };
}

/** 壳层菜单项（整行可点 · hover 高亮）。 */
export function sMenuItem(hover = false): CSSProperties {
  return {
    width: '100%',
    padding: '8px 12px',
    textAlign: 'left',
    background: hover ? SHELL.jadeWash : 'transparent',
    color: hover ? SHELL.jade : SHELL.sub,
    border: '1px solid transparent',
    borderRadius: 7,
    fontSize: 12,
    letterSpacing: 1,
    cursor: 'pointer',
    fontFamily: SHELL.fontUi,
    whiteSpace: 'nowrap',
    outline: 'none',
    transition: 'all .12s',
  };
}
