// 审计入口：game-a《掼蛋夜宴》S4 可玩牌桌屏（手牌扇列+操作条+中央墩·纯 LayoutNode·缺省 SHELL 皮）。
// 用法：node tools/ui-audit.mjs tools/audits/game-a-play.audit.ts --w 1280 --h 720
import { mountUI } from '../../src/ui/components/index.js';
import { buildPlay, type PlayView, type SeatView } from '../../src/games/game-a/hud.js';
import { SEATS, DRESS_TIERS, INITIAL_FUNDS, cardCode, RANK_BIG_JOKER } from '../../src/games/game-a/rules.js';

const sv = (id: SeatView['seat']['id']): SeatView => ({ seat: SEATS.find((s) => s.id === id)!, cards: 27, dress: DRESS_TIERS });
const view: PlayView = {
  round: 3,
  stake: 100,
  levelPlay: 2,
  levelOurs: 3,
  levelTheirs: 2,
  wallet: INITIAL_FUNDS,
  turn: 'hero',
  turnName: '你',
  seats: { partner: sv('partner'), west: sv('west'), east: sv('east'), hero: sv('hero') },
  hand: [cardCode(0, 3), cardCode(1, 3), cardCode(0, 7), cardCode(2, 9), cardCode(3, 13), cardCode(0, 14), cardCode(0, RANK_BIG_JOKER)],
  selected: [0, 1], // 选中手牌前两张（下标·非牌码）
  trick: { name: '对子', family: 'pair', cards: [cardCode(2, 2), cardCode(3, 2)] },
  canCommit: true,
  commitWhy: '',
  canPass: true,
};

mountUI(document.getElementById('root')!, buildPlay(view), {});
