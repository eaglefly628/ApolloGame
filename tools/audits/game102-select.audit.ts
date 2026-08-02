// 审计入口：game102《色流工坊》③ 选关屏（LevelPath 蛇形路径 + 金币 Badge + 返回·pixelPour 皮）。
// 用法：node tools/ui-audit.mjs tools/audits/game102-select.audit.ts --w 390 --h 844
import { mountUI } from '../../src/ui/components/index.js';
import { buildSelect, pixelPour } from '../../games/game102/index.js';

mountUI(
  document.getElementById('root')!,
  buildSelect({
    coins: 2180,
    nodes: [
      { no: 1, stars: 3, state: 'done' },
      { no: 2, stars: 3, state: 'done' },
      { no: 3, stars: 2, state: 'done' },
      { no: 4, stars: 3, state: 'done' },
      { no: 5, stars: 1, state: 'done' },
      { no: 6, stars: 2, state: 'done' },
      { no: 7, stars: 0, state: 'current' },
      { no: 8, stars: 0, state: 'locked' },
      { no: 9, stars: 0, state: 'locked' },
    ],
  }),
  {},
  pixelPour,
);
