// 审计入口：game-a《掼蛋夜宴》SC-2 选桌屏（难度×底注+人设预览+带入·夜宴皮）。
// 用法：node tools/ui-audit.mjs tools/audits/game-a-select.audit.ts --w 1280 --h 720
import { mountUI } from '../../src/ui/components/index.js';
import { buildTableSelect } from '../../src/games/game-a/hud.js';
import { GAME_A_THEME } from '../../src/games/game-a/theme.js';

mountUI(document.getElementById('root')!, buildTableSelect({ lang: 'zh', difficulty: 'l4', stake: 500, wallet: 10000 }), {}, GAME_A_THEME);
