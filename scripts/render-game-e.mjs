// 离线预览：把 game-e 桌面视图（小丑排 + 出牌区 + 计分 HUD）合成一张自包含 SVG。
// 用真资产（cards.png sprite-sheet 切格 + 小丑 webp 内嵌 base64），无需浏览器/canvas。
//   node scripts/render-game-e.mjs > game-e-preview.svg
import fs from 'node:fs';

const DIR = 'assets/FreeArtLib/cardgame';
const CARD = `${DIR}/card`;
const b64 = (p, mime) => `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;

// cards.png 8×8 网格几何（与 src/games/game-e/cards-atlas.ts 一致）。
const CELL_W = 71, CELL_H = 84;
const SUIT_COL = { hearts: 0, clubs: 1, diamonds: 2, spades: 3 };
const LEFT = ['A', '2', '3', '4', '5', '6', '7'];
const RIGHT = ['K', 'Q', 'J', '10', '9', '8'];
const cell = (suit, rank) => {
  const li = LEFT.indexOf(rank);
  if (li >= 0) return { col: SUIT_COL[suit], row: li };
  return { col: 4 + SUIT_COL[suit], row: RIGHT.indexOf(rank) };
};

const cardsPng = b64(`${DIR}/cards.png`, 'image/png');

// 视图数据（与 view.ts 一致）。
const JOKERS = [
  ['joker', 'Joker.webp', '+4 Mult'],
  ['jolly_joker', 'Jolly_Joker.webp', '含对子 +8'],
  ['cavendish', 'Cavendish.webp', '×3 Mult'],
  ['the_duo', 'The_Duo.webp', '含对子 ×2'],
  ['golden_joker', 'Golden_Joker.webp', '回合末 +$4'],
];
const HAND = [['spades', '10'], ['spades', 'J'], ['spades', 'Q'], ['spades', 'K'], ['spades', 'A']];

const W = 980, H = 640;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const parts = [];
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="monospace">`);
parts.push(`<rect width="${W}" height="${H}" fill="#0f2027"/>`);
parts.push(`<rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="14" fill="#16323a" stroke="#2b5562" stroke-width="2"/>`);
parts.push(`<text x="${W / 2}" y="44" fill="#ffd166" font-size="26" text-anchor="middle" font-weight="bold">小丑牌·Apollo —— 桌面视图（全 Sprite 数据）</text>`);

// 小丑排
parts.push(`<text x="${W / 2}" y="78" fill="#7fd1de" font-size="16" text-anchor="middle">— JOKERS（小丑排）—</text>`);
JOKERS.forEach(([id, file, desc], i) => {
  const x = 60 + i * 178, y = 92, jw = 120, jh = 160;
  parts.push(`<rect x="${x - 4}" y="${y - 4}" width="${jw + 8}" height="${jh + 8}" rx="10" fill="#0b1c22" stroke="#3a6b78"/>`);
  parts.push(`<image x="${x}" y="${y}" width="${jw}" height="${jh}" preserveAspectRatio="xMidYMid meet" href="${b64(`${CARD}/${file}`, 'image/webp')}"/>`);
  parts.push(`<text x="${x + jw / 2}" y="${y + jh + 22}" fill="#cfe8ee" font-size="13" text-anchor="middle">${esc(desc)}</text>`);
});

// 出牌区（royal flush，cards.png 切格）
parts.push(`<text x="${W / 2}" y="332" fill="#7fd1de" font-size="16" text-anchor="middle">— PLAYED HAND（出牌区 · 黑桃皇家同花顺）—</text>`);
const dispW = 96, dispH = 114, gap = 16, totalW = HAND.length * dispW + (HAND.length - 1) * gap;
HAND.forEach(([suit, rank], i) => {
  const { col, row } = cell(suit, rank);
  const x = (W - totalW) / 2 + i * (dispW + gap), y = 352;
  // 嵌套 svg + viewBox 把整图裁到该格并缩放到显示尺寸。
  parts.push(`<svg x="${x}" y="${y}" width="${dispW}" height="${dispH}" viewBox="${col * CELL_W} ${row * CELL_H} ${CELL_W} ${CELL_H}"><image width="568" height="672" href="${cardsPng}"/></svg>`);
});

// 计分 HUD（黑桃皇家同花顺 + 起手小丑：chips 158 × mult 36 = 5688，与整合测试一致）
const chips = 158, mult = 36, score = chips * mult, money = 4;
parts.push(`<rect x="${W / 2 - 320}" y="510" width="640" height="86" rx="12" fill="#0b1c22" stroke="#3a6b78"/>`);
parts.push(`<text x="${W / 2}" y="548" fill="#fff" font-size="30" text-anchor="middle"><tspan fill="#4cc9f0" font-weight="bold">${chips}</tspan> chips  ×  <tspan fill="#f72585" font-weight="bold">${mult}</tspan> mult  =  <tspan fill="#ffd166" font-weight="bold">${score}</tspan></text>`);
parts.push(`<text x="${W / 2}" y="582" fill="#90be6d" font-size="18" text-anchor="middle">SCORE ${score}     💰 $${money}     （poker-eval 基础 100/8 → +50c/Bull+8c、(8+4)×3 → 158×36）</text>`);

parts.push(`</svg>`);
process.stdout.write(parts.join('\n'));
