import type { CSSProperties } from 'react';

// ═══════════════════════════════════════════════════════════════
//  Apollo Shell 统一视觉基调（引擎壳层：launcher / Studio / 资源库 / 游戏返回钮）
//
//  气质定位：清幽 · 高雅 · 高级 · 秩序 —— 一台安静运转的 AI 引擎。
//  · 墨蓝近黑作底（不是纯黑：保留一点蓝灰的"夜色"层次）
//  · 主色「青瓷」（低饱和青绿，清幽）；辅色「黛紫」（沿袭旧紫但降噪）；点睛「淡金」（克制地表达高级）
//  · 发丝线分隔（hairline）替代重边框；阔字距小标签表达秩序感
//  · 语义色（成功/警示/危险）统一降饱和，不抢戏
//
//  与 src/ui/themes/（游戏内 UI 主题包，给玩家看）是两层：这里是引擎自己的脸。
//  规则：壳层组件一律从此取色/取样式，不再各自内联色值。
// ═══════════════════════════════════════════════════════════════

export const SHELL = {
  // 底色（由深到浅四级）
  bg0: '#06080d',
  bg1: '#0a0e17',
  bg2: '#0f1523',
  bg3: '#151c2e',
  /** 页面大背景渐变 */
  pageBg: 'linear-gradient(180deg, #06080d 0%, #0b1120 100%)',

  // 发丝线
  line: 'rgba(154,170,196,0.10)',
  lineStrong: 'rgba(154,170,196,0.22)',

  // 文字（亮 → 暗）
  text: '#e3e8f0',
  sub: '#96a2b8',
  dim: '#5d6880',
  faint: '#39435a',

  // 主色 · 青瓷
  jade: '#9cd2c5',
  jadeWash: 'rgba(156,210,197,0.10)',
  jadeLine: 'rgba(156,210,197,0.35)',

  // 辅色 · 黛紫
  violet: '#a79ddb',
  violetWash: 'rgba(167,157,219,0.10)',
  violetLine: 'rgba(167,157,219,0.32)',

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

  // 字体栈
  fontUi: '-apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  fontDisplay: '"Palatino Linotype", "Songti SC", "Noto Serif SC", Georgia, serif',
  fontMono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',

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
  background: 'repeating-conic-gradient(#161c2b 0% 25%, #0d1220 0% 50%) 50% / 16px 16px',
};

/** 游戏内右上角「返回主界面」浮钮 —— 全游戏统一的一颗。 */
export function sBackPill(): CSSProperties {
  return {
    padding: '6px 16px',
    background: 'rgba(6,8,13,0.78)',
    color: SHELL.sub,
    border: `1px solid ${SHELL.lineStrong}`,
    borderRadius: 999,
    fontSize: 12,
    letterSpacing: 1,
    cursor: 'pointer',
    fontFamily: SHELL.fontUi,
    backdropFilter: 'blur(8px)',
    outline: 'none',
  };
}
