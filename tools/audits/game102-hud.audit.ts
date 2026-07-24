// 审计入口：game102《色流工坊》① 对局 HUD 顶栏（关号/钥匙/得分/暂停 + 宝箱门进度·pixelPour 皮）。
// 用法：node tools/ui-audit.mjs tools/audits/game102-hud.audit.ts --w 390 --h 844
import { mountUI } from '../../src/ui/components/index.js';
import { buildTopBar, defaultHud, pixelPour } from '../../src/games/game102/index.js';

mountUI(document.getElementById('root')!, buildTopBar(defaultHud({ levelNo: 7, keys: 3, score: 8420, doorPct: 62 })), {}, pixelPour);
