// 审计入口：game-b《雀宴》鸣牌态 HUD（P4·四家副露展示 + 玩家鸣牌按钮条·碰/吃/荣/过）。
// 用法：node tools/ui-audit.mjs tools/audits/game-b-calls.audit.ts --w 1120 --h 630
import { mountUI } from '../../src/ui/components/index.js';
import { buildPlayHud } from '../../games/game-b/play-ui.js';
import { startMatch, aiTurn } from '../../games/game-b/core/game-state.js';
import type { Meld } from '../../games/game-b/core/meld.js';
import { SAKURA } from '../../games/game-b/theme.js';

const M = (n: number): number => n - 1;
const P = (n: number): number => 9 + (n - 1);
const S = (n: number): number => 18 + (n - 1);

const m = startMatch(20260717);
m.interactiveCalls = true;
for (let i = 0; i < 10 && m.cur.phase === 'playing' && m.cur.turn !== 0; i++) aiTurn(m); // 四家牌河有牌
// 注入四家副露（测四位不重叠·碰/吃各样）。
m.cur.melds[0] = [
  { kind: 'pon', tiles: [33, 33, 33], from: 1, called: 33 }, // 碰中
  { kind: 'chi', tiles: [M(2), M(3), M(4)], from: 3, called: M(3) }, // 吃 234萬
] as Meld[];
m.cur.melds[1] = [{ kind: 'ankan', tiles: [P(2), P(2), P(2), P(2)], from: 1, called: P(2) }] as Meld[]; // 暗杠 4 张
m.cur.melds[2] = [{ kind: 'chi', tiles: [P(5), P(6), P(7)], from: 1, called: P(7) }] as Meld[];
m.cur.melds[3] = [{ kind: 'minkan', tiles: [S(9), S(9), S(9), S(9)], from: 0, called: S(9) }] as Meld[]; // 大明杠 4 张
// 注入玩家待鸣窗口（碰 + 大明杠 + 两吃候选 + 荣 全亮·测按钮条满配）。
m.cur.callWindow = {
  discarder: 3,
  tile: M(3),
  options: { ron: true, pon: true, minkan: true, chi: [{ consume: [M(2), M(4)] }, { consume: [M(4), M(5)] }] },
  pending: [],
};
mountUI(document.getElementById('root')!, buildPlayHud(m, { logOpen: false }), {}, SAKURA);
