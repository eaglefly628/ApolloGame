// 审计入口：game-q Neon Siege HUD（顶/底两条持久 HUD·纯 LayoutNode）。
// 用法：node tools/ui-audit.mjs tools/audits/game-q-hud.audit.ts
// 约定：mount 到 #root。Screen justify:between → 顶条居顶、底条居底（复现实际布局），量重叠 + 对比度。
import { mountUI } from '../../src/ui/components/index.js';
import type { LayoutNode } from '../../src/ui/components/index.js';
import { buildTopBar, buildBottomBar } from '../../src/games/game-q/hud.js';
import { NEON_THEME } from '../../src/games/game-q/theme.js';

// 低血量 + pending 态（触发 danger 色 + hero/glow 强调 → 覆盖最"吃紧"配色）
const s = { lives: 5, gold: 300, enemies: 4, pending: 'pulse' as const, status: 'playing' as const };
const page: LayoutNode = {
  type: 'Screen', id: 'q-hud-audit', props: { bg: 'panel' },
  layout: { direction: 'column', justify: 'between', padding: 0 },
  children: [buildTopBar(s), buildBottomBar(s)],
};
mountUI(document.getElementById('root')!, page, {}, NEON_THEME);
