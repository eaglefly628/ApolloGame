// 审计入口：game-a《掼蛋夜宴》游戏内菜单（☰·出牌日志/规则说明/设置·Modal+Tabs+Table·纯 LayoutNode）。
// PUI 域文件（audits/**）·PE-A 加·域注知会（照 game-a-play/menu 先例）。owner 2026-07-18 需求。
// 用法：node tools/ui-audit.mjs tools/audits/game-a-gamemenu.audit.ts --w 1280 --h 720
import { mountUI } from '../../src/ui/components/index.js';
import { buildGameMenu } from '../../src/games/game-a/hud.js';
import { GAME_A_THEME } from '../../src/games/game-a/theme.js';

// 规则说明页信息最密（牌型表 10 行 + 规则 6 行）——审这页最能暴露重叠/对比问题。
mountUI(
  document.getElementById('root')!,
  buildGameMenu({
    menuTab: 'rules',
    logRows: [{ round: 3, who: '顾念念', act: '领出', cards: '♥4 ♥4 ♣4 ♠5 ♠5 ♥5', fam: '钢板' }],
    tierName: '常客',
    levelPlay: 2,
    stake: 100,
    wallet: 10000,
    sortMode: 'rank',
  }),
  {},
  GAME_A_THEME,
);
