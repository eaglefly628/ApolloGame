// 审计入口：game101《海港绯闻》S1 主界面（活板·benchmark 对齐版）。
// 用法：node tools/ui-audit.mjs tools/audits/game101-s1.audit.ts
import { mountUI } from '../../src/ui/components/index.js';
import { buildS1Live, type S1State } from '../../src/games/game101/s1.js';
import { GAME101_THEME } from '../../src/games/game101/ui-theme.js';

// 样例态（含可交付订单/物品）供审计覆盖。
const cells: S1State['cells'] = new Array(63).fill(null);
cells[0] = { emoji: '🧊', gen: 'gen_fridge' };
cells[7] = { emoji: '🍅' }; cells[8] = { emoji: '🥗', deliverable: true };
cells[15] = { emoji: '🔒', cover: 1 }; cells[16] = { emoji: '🦀', timer: 12 };
cells[17] = { emoji: '🔒', cover: 3, coverReward: '⚡20' }; cells[18] = { emoji: '🔒', cover: 2, coverReward: '🎁' };
const state: S1State = {
  energy: 34, coins: 305, gems: 8, level: 12, cells,
  orders: [
    { char: '周航', slots: [{ itemEmoji: '🥗', filled: false, want: true }], coins: 44, stars: 0, deliverable: true, mood: 0.2, moodFace: '🙂' },
    { char: '老陈', slots: [{ itemEmoji: '🐠', filled: true, want: false }, { itemEmoji: '🐠', filled: false, want: false }], coins: 78, stars: 2, deliverable: false, mood: 0.6, moodFace: '😄' },
    { char: '苏晴', slots: [{ itemEmoji: '☕', filled: false, want: false }, { itemEmoji: '🥗', filled: false, want: true }, { itemEmoji: '🔧', filled: false, want: false }], coins: 220, stars: 3, deliverable: true, mood: 1, moodFace: '😍', timed: true, timeLeft: 24 },
  ],
};
mountUI(document.getElementById('root')!, buildS1Live(state), {}, GAME101_THEME);
