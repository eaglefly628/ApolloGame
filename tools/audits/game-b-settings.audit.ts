// 审计入口：game-b《雀宴》设置屏（NIGHT 皮·Modal 流式布局）。
// 用法：node tools/ui-audit.mjs tools/audits/game-b-settings.audit.ts --w 1120 --h 630
import { mountUI } from '../../src/ui/components/index.js';
import { buildSettings, defaultSettings } from '../../games/game-b/menu-settings.js';
import { NIGHT } from '../../games/game-b/theme.js';

mountUI(document.getElementById('root')!, buildSettings(defaultSettings()), {}, NIGHT);
