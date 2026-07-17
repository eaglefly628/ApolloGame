// 审计入口：game-a《掼蛋夜宴》SC-1 主菜单壳（纯 LayoutNode·夜宴皮）。
// 用法：node tools/ui-audit.mjs tools/audits/game-a-menu.audit.ts --w 1280 --h 720
import { mountUI } from '../../src/ui/components/index.js';
import { buildMenu } from '../../src/games/game-a/hud.js';
import { GAME_A_THEME } from '../../src/games/game-a/theme.js';

mountUI(document.getElementById('root')!, buildMenu(), {}, GAME_A_THEME);
