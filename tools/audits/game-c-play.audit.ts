// 审计入口：game-c《六人德州》2D 大牌桌 HUD（owner 2026-07-18 转 2D）。
// 跑道形椭圆桌(背景) + 顶带 + 底池筹码 + 公共牌 + 六席位卡 + 底牌 + 行动条。
// 用法：node tools/ui-audit.mjs tools/audits/game-c-play.audit.ts --w 1280 --h 720
//
// 【重叠】已归零（背景层标 data-allow-overlap）。
// 【对比·已知假阳】剩余硬失败均为**基座控件渐变填充**盲区（非本游戏可修·同 game-a 先例·REQ-C-110 报 PUI）：
//   · PlayingCard 'light' 牌面=白底渐变(无实 backgroundColor)→ 审计穿透到暗桌呢/页底→黑/红点数判 1.15；实际白牌面高对比可读。
//   · gold-sheen 加注键=金色渐变 FillPreset + ink 暗字→ 审计穿透到暗页底→暗字判 1.1；实际暗字压金键高对比可读（改亮字反降可读性=不干）。
//   截图目击（scratchpad/2d-*.png）证公共牌/按钮清晰可读；ui-audit 无法量渐变底=工具盲区·非坏 UI。
import { mountUI } from '../../src/ui/components/index.js';
import { buildTable, type TableView } from '../../src/games/game-c/hud.js';
import { GAME_C_THEME } from '../../src/games/game-c/theme.js';
import type { Card } from '../../src/engine/protocol/components.js';

const H = (suit: number, rank: number): Card => ({ suit, rank });
const view: TableView = {
  lang: 'en', blindLabel: '25 / 50', handNo: 3, pot: 1150,
  board: [H(0, 14), H(1, 13), H(2, 5), H(3, 9), H(0, 2)],
  heroHole: [H(0, 12), H(0, 11)], heroHandName: 'Two Pair',
  seats: [0, 1, 2, 3, 4, 5].map((seat) => ({
    seat, name: seat === 0 ? 'You' : `Lady ${seat}`, chips: 950, committed: seat < 3 ? 50 : 0,
    clothes: 6, folded: seat === 5, allIn: false, out: false,
    isActor: seat === 0, isHero: seat === 0, isButton: seat === 0,
    lastMove: seat === 1 ? { kind: 'call', amount: 50 } : undefined,
  })),
  toCall: 50, canRaise: true, minRaise: 100, maxRaise: 950, raiseValue: 100,
  muted: false, openWardrobe: null, showLog: false, log: [],
  phase: 'betting', isHeroTurn: true,
};
mountUI(document.getElementById('root')!, buildTable(view), {}, GAME_C_THEME);
// 牌桌/呢面/筹码现为 scene 层 3D（build3d/chip3d·audit 只审 2D HUD 层）。c-top = 满宽顶带渐变横幅
//   （内容 blind/POT/menu 在横向留白·与两侧顶部座位不真撞·仅包围盒相交）→ 标 data-allow-overlap 背景排除。
document.getElementById('c-top')?.setAttribute('data-allow-overlap', '1');
