// 审计入口：game-b《雀宴》对局牌桌 HUD（绝对定位·席位卡四角/四家牌河/底部手牌排/场况角标/行动条/字幕）。
// 用法：node tools/ui-audit.mjs tools/audits/game-b-play.audit.ts --w 1120 --h 630
import { mountUI } from '../../src/ui/components/index.js';
import { buildPlayHud } from '../../games/game-b/play-ui.js';
import { startMatch, aiTurn } from '../../games/game-b/core/game-state.js';
import { SAKURA } from '../../games/game-b/theme.js';

const m = startMatch(20260717);
// 推几步 AI → 四家牌河有牌（测牌河/席位卡/手牌不重叠）；停在玩家回合看满手牌排。
for (let i = 0; i < 16 && m.cur.phase === 'playing' && m.cur.turn !== 0; i++) aiTurn(m);
mountUI(document.getElementById('root')!, buildPlayHud(m, { logOpen: false }), {}, SAKURA);
