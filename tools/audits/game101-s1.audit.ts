// 审计入口：game101《海港绯闻》S1 主界面（活板·benchmark 对齐版）。
// 用法：node tools/ui-audit.mjs tools/audits/game101-s1.audit.ts
import { mountUI } from '../../src/ui/components/index.js';
import { buildS1Live, type S1State } from '../../src/games/game101/s1.js';
import { GAME101_THEME } from '../../src/games/game101/ui-theme.js';

// 样例态（含可交付订单/物品）供审计覆盖。
const cells: S1State['cells'] = new Array(63).fill(null);
cells[0] = { emoji: '🧊', gen: 'gen_fridge' };
cells[7] = { emoji: '🍅' }; cells[8] = { emoji: '🥗', deliverable: true };
const state: S1State = {
  energy: 34, coins: 305, gems: 8, level: 12, cells,
  orders: [
    { char: '周航', itemEmoji: '🥗', coins: 44, deliverable: true },
    { char: '老陈', itemEmoji: '🐠', coins: 38, deliverable: false },
    { char: '苏晴', itemEmoji: '☕', coins: 178, deliverable: false },
    { char: '阿雅', itemEmoji: '🔧', coins: 88, deliverable: false },
  ],
};
mountUI(document.getElementById('root')!, buildS1Live(state), {}, GAME101_THEME);
