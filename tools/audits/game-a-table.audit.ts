// 审计入口：game-a《掼蛋夜宴》牌桌骨架屏（S3·四席位+中央牌库+主角条·纯 LayoutNode·缺省 SHELL 皮）。
// 用法：node tools/ui-audit.mjs tools/audits/game-a-table.audit.ts --w 1280 --h 720
import { mountUI } from '../../src/ui/components/index.js';
import { buildTable, type TableView, type SeatView } from '../../src/games/game-a/hud.js';
import { SEATS, DECK_SIZE, DRESS_TIERS, INITIAL_FUNDS } from '../../src/games/game-a/rules.js';

const sv = (id: SeatView['seat']['id']): SeatView => ({
  seat: SEATS.find((s) => s.id === id)!,
  cards: 0,
  dress: DRESS_TIERS,
});
const view: TableView = {
  wallet: INITIAL_FUNDS,
  stake: 100,
  round: 1,
  levelOurs: 2,
  levelTheirs: 2,
  flowState: 'table-idle',
  deckCount: DECK_SIZE,
  partner: sv('partner'),
  west: sv('west'),
  east: sv('east'),
  hero: sv('hero'),
};

mountUI(document.getElementById('root')!, buildTable(view), {});
