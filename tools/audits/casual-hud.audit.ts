// 审计入口：game-i「组合·超休闲对局」屏（糖果棋盘 + 道具 + juice·apollo-toon 糖果皮）。
// 用法：node tools/ui-audit.mjs tools/audits/casual-hud.audit.ts --w 500 --h 820
import { mountUI } from '../../src/ui/components/index.js';
import { buildCasualHud } from '../../games/game-i/casual-hud.js';
import { apolloToon } from '../../src/ui/apollo-toon-theme.js';
mountUI(document.getElementById('root')!, buildCasualHud(), {}, apolloToon);
