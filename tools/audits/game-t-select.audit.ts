// 审计入口：game-t《墨消》选关长卷（LevelPath 蛇形 + 标题/脚注·apollo-toon 皮）。
// 用法：node tools/ui-audit.mjs tools/audits/game-t-select.audit.ts --w 440 --h 780
// 态覆盖节点三态：done(带星)/current/locked。
import { mountUI } from '../../src/ui/components/index.js';
import { buildSelect } from '../../src/games/game-t/hud.js';
import { apolloToon } from '../../src/ui/apollo-toon-theme.js';

const s = {
  nodes: [
    { no: 1, name: '初磨', stars: 3, state: 'done' as const },
    { no: 2, name: '拾砂', stars: 1, state: 'done' as const },
    { no: 3, name: '浸润', stars: 0, state: 'current' as const },
    { no: 4, name: '冰纹', stars: 0, state: 'locked' as const },
    { no: 5, name: '五形小试', stars: 0, state: 'locked' as const },
  ],
  muted: false,
};
mountUI(document.getElementById('root')!, buildSelect(s), {}, apolloToon);
