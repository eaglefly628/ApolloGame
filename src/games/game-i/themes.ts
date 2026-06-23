// Game I · 主题令牌包（换皮演示用）。
//
// 红线：游戏/测试场只填 UITheme 令牌（颜色/字体字符串，最弱 LLM 能填），
// 不写 CSS/DOM。同一棵 LayoutNode + 不同令牌包 = 换皮（数据驱动·零改解释器）。

import { SHELL } from '@ui/shell-theme.js';
import type { UITheme } from '@ui/components/index.js';

/** 引擎缺省脸「青瓷·墨蓝」——直接取 SHELL 的 UITheme 子集。 */
export const onyx: UITheme = {
  bg0: SHELL.bg0, bg1: SHELL.bg1, bg2: SHELL.bg2, bg3: SHELL.bg3, pageBg: SHELL.pageBg,
  line: SHELL.line,
  text: SHELL.text, sub: SHELL.sub, dim: SHELL.dim,
  jade: SHELL.jade, jadeWash: SHELL.jadeWash, jadeLine: SHELL.jadeLine,
  gold: SHELL.gold,
  ok: SHELL.ok, okWash: SHELL.okWash, warn: SHELL.warn, warnWash: SHELL.warnWash, danger: SHELL.danger,
  fontUi: SHELL.fontUi, fontMono: SHELL.fontMono,
};

/** 暖金·锦缎——证明同一份控件数据换一套令牌即变脸。 */
export const brocade: UITheme = {
  bg0: '#140d06', bg1: '#1c1308', bg2: '#241a0c', bg3: '#2e2210',
  pageBg: 'linear-gradient(180deg, #140d06 0%, #1f1505 100%)',
  line: 'rgba(214,184,122,0.14)',
  text: '#f3e9d6', sub: '#c2a878', dim: '#8a7448',
  jade: '#e0b964', jadeWash: 'rgba(224,185,100,0.12)', jadeLine: 'rgba(224,185,100,0.40)',
  gold: '#f2cf7a',
  ok: '#9fc98a', okWash: 'rgba(159,201,138,0.12)',
  warn: '#e0b964', warnWash: 'rgba(224,185,100,0.12)', danger: '#d98a6a',
  fontUi: SHELL.fontUi, fontMono: SHELL.fontMono,
};

/** 冷雾·素白——第三套对照（浅底高对比）。 */
export const frost: UITheme = {
  bg0: '#0d1014', bg1: '#121821', bg2: '#18202c', bg3: '#212b3a',
  pageBg: 'linear-gradient(180deg, #0d1014 0%, #141c28 100%)',
  line: 'rgba(180,200,224,0.14)',
  text: '#eef3fa', sub: '#9fb0c6', dim: '#5f6e84',
  jade: '#7fc7e8', jadeWash: 'rgba(127,199,232,0.12)', jadeLine: 'rgba(127,199,232,0.40)',
  gold: '#cfd8e6',
  ok: '#7fd6a8', okWash: 'rgba(127,214,168,0.12)',
  warn: '#e6c574', warnWash: 'rgba(230,197,116,0.12)', danger: '#e88a8a',
  fontUi: SHELL.fontUi, fontMono: SHELL.fontMono,
};

export const THEMES: Record<string, UITheme> = { onyx, brocade, frost };
export const THEME_OPTIONS = [
  { value: 'onyx', label: '青瓷·墨蓝' },
  { value: 'brocade', label: '暖金·锦缎' },
  { value: 'frost', label: '冷雾·素白' },
];
