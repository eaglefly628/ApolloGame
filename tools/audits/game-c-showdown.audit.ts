// 审计入口：game-c《六人德州》摊牌屏（owner 2026-07-18 重设计·防 5~6 人 freeze）。
// 定高卡=顶公共牌板 + 中各家最优五张组合(scroll) + 底确认键钉底常驻（6 人也点得到）。
// 用法：node tools/ui-audit.mjs tools/audits/game-c-showdown.audit.ts --w 1280 --h 720
//
// 【重叠】卡内 0（组合行/确认键=flex 静态流·不重叠）。剩余重叠=摊牌模态层(c-sd-scrim/c-sd-card)盖住身后牌桌
//   （c-top/座位/公共牌/底牌）——**意图模态遮罩**（同衣柜 c-wardrobe-scrim / 局终 c-fin-scrim），标 data-allow-overlap 排除。
// 【对比·已知假阳】硬失败=**PlayingCard 'light' 牌面渐变**盲区（红黑点数穿透暗底判低对比·非本游戏可修·REQ-C-110 报 PUI·同牌桌屏先例）。
import { mountUI } from '../../src/ui/components/index.js';
import { buildTable, type TableView } from '../../src/games/game-c/hud.js';
import { GAME_C_THEME } from '../../src/games/game-c/theme.js';
import type { Card } from '../../src/engine/protocol/components.js';

const H = (suit: number, rank: number): Card => ({ suit, rank });
const river = [H(0, 14), H(1, 13), H(2, 5), H(3, 9), H(0, 2)];
const TY = ['Full House', 'Flush', 'Straight', 'Trips', 'Two Pair', 'High Card'];
const NM = ['You', 'Rose', 'Lily', 'Jade', 'Pearl', 'Iris'];
const view: TableView = {
  lang: 'en', playerCount: 6, blindLabel: '25 / 50', handNo: 7, pot: 2400,
  board: river, heroHole: [H(0, 14), H(1, 14)], heroHandName: 'Full House',
  seats: [0, 1, 2, 3, 4, 5].map((seat) => ({
    seat, name: NM[seat]!, chips: 950, committed: 400,
    clothes: 6, folded: false, allIn: false, out: false,
    isActor: false, isHero: seat === 0, isButton: seat === 0,
  })),
  toCall: 0, canRaise: false, minRaise: 50, maxRaise: 950, raiseValue: 50,
  muted: false, openWardrobe: null, showLog: false, log: [],
  phase: 'showdown', isHeroTurn: false,
  showdown: {
    rows: [0, 1, 2, 3, 4, 5].map((i) => ({
      name: NM[i]!, type: TY[i]!,
      best: [H(0, 14 - i), H(1, 13 - i), H(2, 12 - i), H(3, 11 - i), H(0, 10 - i)],
      hole: [H(0, 14 - i), H(1, 13 - i)],
      won: i === 0 ? 2400 : 0, isWinner: i === 0,
    })),
    potTotal: 2400,
  },
};
mountUI(document.getElementById('root')!, buildTable(view), {}, GAME_C_THEME);
// 意图模态层 + 满宽顶带 → 标 data-allow-overlap（盖身后牌桌=设计如此·非撞车）。
for (const id of ['c-sd-scrim', 'c-sd-card', 'c-top']) document.getElementById(id)?.setAttribute('data-allow-overlap', '1');
