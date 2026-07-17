// 审计入口：game-a《掼蛋夜宴》SC-1 主菜单壳（S3 骨架·纯 LayoutNode·缺省 SHELL 皮）。
// 用法：node tools/ui-audit.mjs tools/audits/game-a-menu.audit.ts --w 1280 --h 720
import { mountUI } from '../../src/ui/components/index.js';
import { buildMenu } from '../../src/games/game-a/hud.js';

mountUI(document.getElementById('root')!, buildMenu(), {});
