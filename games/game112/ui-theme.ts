// 锦霞底色沿用引擎 house 主题，仅把 Game112 文字/按钮色调到亮背景可读的深色档。
import { apolloBrocade } from '@zerocraft/engine/ui/components/apollo-kit.js';
import type { UITheme } from '@zerocraft/engine/ui/components/index.js';

export const STAR_TAIL_THEME: UITheme = {
  ...apolloBrocade,
  sub: '#70545a',
  dim: '#70545a',
  gold: '#795016',
  jade: '#8f3150',
  jadeLine: 'rgba(143,49,80,.48)',
};
