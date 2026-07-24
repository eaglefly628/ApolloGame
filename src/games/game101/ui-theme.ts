// game101 ·《海港绯闻》沙滩美食 UITheme（数据·换皮令牌）。
// 来源=Claude Design 稿 MergeBeach.dc.html §Design Tokens（亮蓝沙滩风·1:1 复刻基准）。
// 喂 mountUI/renderNode 即换皮：同一份 LayoutNode 数据、零改解释器（参照 game-g/ui-theme.ts 样板）。
import type { UITheme } from '@ui/components/types.js';

export const GAME101_THEME: UITheme = {
  bg0: '#f2e3c2', // 板框奶油
  bg1: '#ffffff',
  bg2: '#fff8ea', // info 面板奶油
  bg3: '#eddcb6', // 缩略图底
  pageBg: 'linear-gradient(180deg,#bfeaf6 0%,#a6def0 34%,#7fcfe6 100%)', // 沙滩天空
  line: 'rgba(90,74,42,0.18)',
  text: '#5a4a2a', // 暖棕主字
  sub: '#8a7038', // 次级（压深过对比门）
  dim: '#7d6a3a',
  jade: '#2f7bc4', // HUD 蓝（accent）
  jadeWash: 'rgba(63,147,214,0.16)',
  jadeLine: 'rgba(63,147,214,0.5)',
  gold: '#b5760a', // 金币金字
  ok: '#3d9e3d', // 绿勾/交付
  okWash: 'rgba(92,196,92,0.2)',
  warn: '#c85a1e', // MERGE 提示橙
  warnWash: 'rgba(224,86,58,0.16)',
  danger: '#e0392b', // 删除红
  ink: '#173a4a', // 深青字（浅蓝底上）
  fontUi: "'Fredoka','Baloo 2','Nunito','PingFang SC','Microsoft YaHei',sans-serif",
  fontDisplay: "'Fredoka','Baloo 2',sans-serif",
  fontMono: 'ui-monospace,Menlo,Consolas,monospace',
  // 注：Fredoka（稿指定圆体）待 PA vendor 本地 woff2 后加 webfonts 槽；当前回退系统圆体 sans（离线安全·不引 CDN）。
};
