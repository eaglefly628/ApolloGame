// 回合流向指示 + 副露来源标签 目击：中场（AI 出牌中）· 玩家已碰 · 中央指向条。
import { mountUI } from '../../src/ui/components/index.js';
import { buildPlayHud } from '../../games/game-b/play-ui.js';
import { startMatch, aiTurn } from '../../games/game-b/core/game-state.js';
import { SAKURA } from '../../games/game-b/theme.js';
const m = startMatch(20260717);
m.interactiveCalls = true;
for (let i=0;i<14 && m.cur.phase==='playing' && m.cur.turn!==0;i++) aiTurn(m); // 推到四家有河
m.cur.melds[0] = [{ kind:'pon', tiles:[33,33,33], from:2, called:33 }] as never;      // 玩家碰莉世
m.cur.melds[1] = [{ kind:'chi', tiles:[9,10,11], from:0, called:11 }] as never;        // 绫吃主角
m.cur.turn = 2; // 北家（莉世·对家）出牌中 → 指向条应显「▲ 莉世 出牌中」
m.cur.callWindow = null;
mountUI(document.getElementById('root')!, buildPlayHud(m, { logOpen:false }), {}, SAKURA);
