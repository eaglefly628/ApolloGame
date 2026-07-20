// 审计入口：game-a《掼蛋夜宴》S4 盘结算浮层（名次+金钱+级数·run-won 变体·纯 LayoutNode·缺省 SHELL 皮）。
// 用法：node tools/ui-audit.mjs tools/audits/game-a-result.audit.ts --w 1280 --h 720
import { mountUI } from '../../src/ui/components/index.js';
import { buildResult, type ResultView } from '../../src/games/game-a/hud.js';

const view: ResultView = {
  lang: 'zh',
  ranking: [
    { seat: 'hero', name: '你', team: 0 },
    { seat: 'partner', name: '沈玉薇', team: 0 },
    { seat: 'west', name: '林曼笙', team: 1 },
    { seat: 'east', name: '顾念念', team: 1 },
  ],
  winnersTeam: 0,
  comboLabel: '双上 ×3',
  totalMult: 3,
  payPerPlayer: 300,
  levelAfter: [5, 2],
  dressOutDoubled: false,
  phase: 'settled',
};

mountUI(document.getElementById('root')!, buildResult(view), {});
