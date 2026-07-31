// Game E 美术稿（Balatro 双栏布局）：左信息栏(盲注/回合分/chips×mult/手数弃牌钱/Ante) + 右牌桌(小丑排/出牌区/手牌)。
// 用真资产合成自包含 SVG，供美术方向评审；node scripts/render-game-e.mjs > game-e-preview.svg
import fs from 'node:fs';

const DIR = 'assets/FreeArtLib/cardgame';
const CARD = `${DIR}/card`;
const b64 = (p, mime) => `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
const cardsPng = b64(`${DIR}/cards.png`, 'image/png');

const CW = 71, CH = 96;
const SUIT_COL = { hearts: 0, clubs: 1, diamonds: 2, spades: 3 };
const LEFT = ['A', '2', '3', '4', '5', '6', '7'], RIGHT = ['K', 'Q', 'J', '10', '9', '8'];
const cell = (s, r) => { const li = LEFT.indexOf(r); return li >= 0 ? { col: SUIT_COL[s], row: li } : { col: 4 + SUIT_COL[s], row: RIGHT.indexOf(r) }; };

const W = 1120, H = 700, P = [];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
// 一张牌（cards.png 切格，可选上浮高亮）
const cardImg = (s, r, x, y, w, sel) => {
  const { col, row } = cell(s, r), h = Math.round(w * CH / CW), yy = sel ? y - 16 : y;
  return `<g>${sel ? `<rect x="${x - 3}" y="${yy - 3}" width="${w + 6}" height="${h + 6}" rx="8" fill="none" stroke="#ffd166" stroke-width="3"/>` : ''}`
    + `<svg x="${x}" y="${yy}" width="${w}" height="${h}" viewBox="${col * CW} ${row * CH} ${CW} ${CH}"><image width="568" height="672" href="${cardsPng}"/></svg></g>`;
};

P.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Segoe UI',system-ui,sans-serif">`);
// 背景：暗青毛毡 + 暗角
P.push(`<defs><radialGradient id="felt" cx="50%" cy="38%" r="75%"><stop offset="0%" stop-color="#1c4a4f"/><stop offset="100%" stop-color="#0a1419"/></radialGradient></defs>`);
P.push(`<rect width="${W}" height="${H}" fill="url(#felt)"/>`);

// ───────── 左信息栏 ─────────
const LX = 22, LW = 256;
P.push(`<rect x="${LX}" y="22" width="${LW}" height="${H - 44}" rx="16" fill="#0c1f26" stroke="#234" stroke-width="2"/>`);
// 盲注 token（Boss 红）
P.push(`<rect x="${LX + 20}" y="44" width="${LW - 40}" height="92" rx="12" fill="#3a1118" stroke="#b23" stroke-width="2"/>`);
P.push(`<circle cx="${LX + 52}" cy="90" r="26" fill="#1a0a0e" stroke="#e0455a" stroke-width="3"/><text x="${LX + 52}" y="98" font-size="26" text-anchor="middle">👹</text>`);
P.push(`<text x="${LX + 92}" y="78" fill="#ff6b81" font-size="15" font-weight="700">Boss 盲注</text>`);
P.push(`<text x="${LX + 92}" y="100" fill="#cfe8ee" font-size="11">诅咒：♦不计分</text>`);
P.push(`<text x="${LX + 92}" y="122" fill="#ffd166" font-size="13">奖励 💰$5</text>`);
// Round score
P.push(`<text x="${LX + LW / 2}" y="172" fill="#9fb3bd" font-size="13" text-anchor="middle" letter-spacing="2">本回合得分</text>`);
P.push(`<rect x="${LX + 20}" y="184" width="${LW - 40}" height="50" rx="10" fill="#06121a"/>`);
P.push(`<text x="${LX + LW / 2}" y="220" fill="#fff" font-size="30" font-weight="800" text-anchor="middle">2,310</text>`);
P.push(`<text x="${LX + LW / 2}" y="252" fill="#fca5a5" font-size="13" text-anchor="middle">目标 4,000</text>`);
// chips × mult 框（蓝×红）
const boxY = 272, bw = 104, bh = 64;
P.push(`<rect x="${LX + 14}" y="${boxY}" width="${bw}" height="${bh}" rx="10" fill="#10405f" stroke="#4cc9f0" stroke-width="2"/>`);
P.push(`<text x="${LX + 14 + bw / 2}" y="${boxY + 24}" fill="#8fd9f5" font-size="11" text-anchor="middle">筹码 CHIPS</text>`);
P.push(`<text x="${LX + 14 + bw / 2}" y="${boxY + 52}" fill="#fff" font-size="26" font-weight="800" text-anchor="middle">126</text>`);
P.push(`<text x="${LX + LW / 2}" y="${boxY + 40}" fill="#fff" font-size="22" text-anchor="middle">×</text>`);
P.push(`<rect x="${LX + LW - 14 - bw}" y="${boxY}" width="${bw}" height="${bh}" rx="10" fill="#5e1322" stroke="#f72585" stroke-width="2"/>`);
P.push(`<text x="${LX + LW - 14 - bw / 2}" y="${boxY + 24}" fill="#ff9ec4" font-size="11" text-anchor="middle">倍率 MULT</text>`);
P.push(`<text x="${LX + LW - 14 - bw / 2}" y="${boxY + 52}" fill="#fff" font-size="26" font-weight="800" text-anchor="middle">24</text>`);
// hands / discards / money
const pill = (x, label, val, col) => `<rect x="${x}" y="358" width="72" height="52" rx="9" fill="#06121a" stroke="${col}" stroke-width="1.5"/><text x="${x + 36}" y="378" fill="${col}" font-size="10" text-anchor="middle">${label}</text><text x="${x + 36}" y="400" fill="#fff" font-size="20" font-weight="800" text-anchor="middle">${val}</text>`;
P.push(pill(LX + 14, '出牌', '3', '#4cc9f0'));
P.push(pill(LX + 92, '弃牌', '3', '#f87171'));
P.push(pill(LX + 170, '💰', '$4', '#ffd166'));
// Ante / round
P.push(`<rect x="${LX + 20}" y="430" width="${LW - 40}" height="44" rx="9" fill="#06121a"/>`);
P.push(`<text x="${LX + 40}" y="458" fill="#cfe8ee" font-size="14">Ante 1 / 8</text><text x="${LX + LW - 40}" y="458" fill="#9fb3bd" font-size="13" text-anchor="end">第 3 道盲注</text>`);
P.push(`<text x="${LX + LW / 2}" y="${H - 36}" fill="#3a5560" font-size="11" text-anchor="middle">小丑牌·ZeroCraft</text>`);

// ───────── 右牌桌 ─────────
const RX = 300;
// 小丑排
P.push(`<text x="${RX}" y="48" fill="#7fd1de" font-size="13" font-weight="700">小丑 3/5</text>`);
const jk = [['Joker.webp', '+4 倍率', '#9ca3af'], ['Jolly_Joker.webp', '含对子+8', '#9ca3af'], ['Cavendish.webp', '×3 倍率', '#9ca3af']];
jk.forEach(([f, d, rc], i) => {
  const x = RX + i * 116, y = 58, w = 96, h = 132;
  P.push(`<rect x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" rx="10" fill="#160f22" stroke="${rc}" stroke-width="1.5"/>`);
  P.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" href="${b64(`${CARD}/${f}`, 'image/webp')}"/>`);
  P.push(`<text x="${x + w / 2}" y="${y + h + 16}" fill="#cfe8ee" font-size="11" text-anchor="middle">${esc(d)}</text>`);
});
// 空槽
[3, 4].forEach((i) => { const x = RX + i * 116, y = 58; P.push(`<rect x="${x}" y="${y}" width="96" height="132" rx="10" fill="none" stroke="#2b4651" stroke-width="2" stroke-dasharray="6 5"/><text x="${x + 48}" y="${y + 74}" fill="#2b4651" font-size="30" text-anchor="middle">+</text>`); });

// 出牌区（中央 box）：黑桃皇家同花顺 + 牌型预览
P.push(`<rect x="${RX}" y="232" width="${W - RX - 30}" height="190" rx="14" fill="#0c2128" stroke="#2b5562" stroke-width="2"/>`);
P.push(`<text x="${RX + 20}" y="262" fill="#ffd166" font-size="16" font-weight="800">同花顺　<tspan fill="#8fd9f5">100</tspan> <tspan fill="#9fb3bd" font-size="13">×</tspan> <tspan fill="#ff9ec4">8</tspan></text>`);
const hand5 = [['spades', '10'], ['spades', 'J'], ['spades', 'Q'], ['spades', 'K'], ['spades', 'A']];
hand5.forEach(([s, r], i) => P.push(cardImg(s, r, RX + 40 + i * 96, 285, 80, false)));
P.push(`<text x="${RX + 560}" y="345" fill="#90be6d" font-size="34" font-weight="800">= 7,524</text>`);

// 手牌（底部一行，选中上浮）
P.push(`<text x="${RX}" y="468" fill="#7fd1de" font-size="13" font-weight="700">手牌（点选 ≤5）</text>`);
const hand8 = [['hearts', '2', 0], ['clubs', '7', 1], ['diamonds', 'K', 0], ['spades', '9', 1], ['hearts', 'A', 0], ['clubs', '4', 0], ['diamonds', 'Q', 1], ['spades', '3', 0]];
hand8.forEach(([s, r, sel], i) => P.push(cardImg(s, r, RX + 10 + i * 92, 490, 80, sel)));
// 按钮
P.push(`<rect x="${RX + 180}" y="618" width="150" height="48" rx="10" fill="#f59e0b"/><text x="${RX + 255}" y="648" fill="#1a1020" font-size="18" font-weight="800" text-anchor="middle">▶ 出牌</text>`);
P.push(`<rect x="${RX + 350}" y="618" width="150" height="48" rx="10" fill="#3b82f6"/><text x="${RX + 425}" y="648" fill="#0a1020" font-size="18" font-weight="800" text-anchor="middle">♻ 弃牌</text>`);

P.push(`</svg>`);
process.stdout.write(P.join('\n'));
