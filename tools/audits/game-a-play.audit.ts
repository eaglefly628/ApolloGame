// 审计入口：game-a《掼蛋夜宴》S4 可玩牌桌屏（椭圆felt桌+席位环+扇形手牌+中央墩·纯 LayoutNode·夜宴皮）。
// 用法：node tools/ui-audit.mjs tools/audits/game-a-play.audit.ts --w 1280 --h 720
import { mountUI } from '../../src/ui/components/index.js';
import { buildPlay, type PlayView, type SeatView } from '../../src/games/game-a/hud.js';
import { SEATS, DRESS_TIERS, buildDeck108, codeRank, cardCode } from '../../src/games/game-a/rules.js';
import { GAME_A_THEME } from '../../src/games/game-a/theme.js';

const sv = (id: SeatView['seat']['id'], cards: number): SeatView => ({ seat: SEATS.find((s) => s.id === id)!, cards, dress: DRESS_TIERS });
// 满手 27 张（发牌后·按点数排序）看扇形弧列效果。
const hand = buildDeck108().slice(0, 27).sort((a, b) => codeRank(a) - codeRank(b));
const view: PlayView = {
  round: 4,
  stake: 100,
  levelPlay: 7,
  levelOurs: 5,
  levelTheirs: 3,
  wallet: 8420,
  turn: 'hero',
  turnName: '你',
  seats: { partner: sv('partner', 8), west: sv('west', 12), east: sv('east', 5), hero: sv('hero', 27) },
  hand,
  selected: [10, 11, 12], // 选中三张（上浮金边）
  sortMode: 'rank',
  trick: { name: '三连对（木板）', family: 'tube', cards: [cardCode(0, 5), cardCode(1, 5), cardCode(0, 6), cardCode(1, 6), cardCode(0, 7), cardCode(1, 7)] },
  canCommit: true,
  commitWhy: '',
  canPass: true,
};

mountUI(document.getElementById('root')!, buildPlay(view), {}, GAME_A_THEME);
