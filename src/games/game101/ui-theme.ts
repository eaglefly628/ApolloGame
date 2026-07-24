// game101 ·《海港绯闻》暖色海港 UITheme（数据·换皮令牌）。
// 来源=docs/design/game101/layout/game101-theme.tokens.json（GD 设计令牌）→ 落成正式引擎 UITheme。
// 喂 mountUI/renderNode 即换皮：同一份 LayoutNode 数据、零改解释器（参照 game-g/ui-theme.ts 样板）。
import type { UITheme } from '@ui/components/types.js';

export const GAME101_THEME: UITheme = {
  bg0: '#FFEFD8',
  bg1: '#FFFFFF',
  bg2: '#FFF7EC',
  bg3: '#FFE9CF',
  pageBg: 'linear-gradient(180deg,#9ad9ee 0%,#c3e9f2 8%,#FFF3E0 24%,#FFEFD8 100%)',
  line: 'rgba(150,110,70,0.18)',
  text: '#4A3B2A',
  sub: '#7a6247',
  dim: '#8a6f4a', // 暖棕次级文字·压过 4.5:1 on 亮 cozy 底（原 #b0987e 太浅·ui-audit 硬性低对比）
  jade: '#1F9BC0',
  jadeWash: 'rgba(62,197,232,0.16)',
  jadeLine: 'rgba(62,197,232,0.5)',
  gold: '#C9871E',
  ok: '#2FA84F',
  okWash: 'rgba(87,196,99,0.18)',
  warn: '#B85807', // 生成器/警示徽标字·压深过 3:1（原 #E07A16 在 warnWash 上仅 2.67）
  warnWash: 'rgba(255,154,60,0.18)',
  danger: '#E0557A',
  ink: '#3a2a16',
  fontUi: "'Baloo 2','Nunito','PingFang SC','Microsoft YaHei',sans-serif",
  fontDisplay: "'Baloo 2','Nunito',sans-serif",
  fontMono: 'ui-monospace,Menlo,Consolas,monospace',
};
