// 审计入口：game101《海港绯闻》S1 主界面（HUD + 顾客订单 + 棋盘占位 + 底部导航）。
// 用法：node tools/ui-audit.mjs tools/audits/game101-s1.audit.ts
// 约定：把要审计的 LayoutNode 树 mount 到 #root（与 ui-audit.mjs 默认 --mount root 对齐）。
import { mountUI } from '../../src/ui/components/index.js';
import { buildS1 } from '../../src/games/game101/s1.js';
import { GAME101_THEME } from '../../src/games/game101/ui-theme.js';

mountUI(document.getElementById('root')!, buildS1(), {}, GAME101_THEME);
