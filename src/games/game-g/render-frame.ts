// VIS-1/2/2b · 离线看帧（design/16 §二/§三/§八）：跑一局 Game G 到关键拍 → 投影成 SVG 落 doc/screenshots/。
// 为什么 SVG 不是 PNG/WebGL：node 无 GL 上下文跑不了真 ThreeRenderer（game-d/game-f 同理用 SVG 投影）→ 确定性/可版本控制/浏览器直接看/可 diff。
// 第 1 轮评审(design G `16`§八)：① 有牌没战场 ② 命运一掷太平(flat) → 本轮 VIS-2/2b：
//   · **三路战场**：三路分区(上/中/下)轨 + 左右老家牌王座(♔) + 哨塔 + 卡按路列阵(A 左/B 右,front 接敌) + 三路比分(弃一保二可读)。
//   · **命运一掷加戏**：活牌落定 gold 辉光(radialGradient) / 死牌碎裂+压暗 / 古风战场底(非纯 void)。
//   ⚠️ 渲染器侧**纯表现重映射**（按 lane/side/idx 摆成 MOBA 三路，gameplay 位置 laneSlot 不变、不进 hash）；3D 场景的 2D 近似，待 ThreeRenderer 同步。
// 跑：npx vite-node src/games/game-g/render-frame.ts → doc/screenshots/*.svg
import { mkdirSync, writeFileSync } from 'node:fs';
import { Engine } from '../../runtime/engine.js';
import { hangWarp, revealGlow, faceUpVisible, clamp01, DEAD_DIM } from './feel.js';
import { buildGameGArmyMatch, armyFromFormation, prepareArmies, bossFor, FORMATION_PRESETS, CARD_W, CARD_H, FLIP_DURATION } from './index.js';
import type { Transform, Card3D, Tween } from '@engine/protocol/components.js';
import type { IWorld } from '@engine/core/types.js';

// ── MOBA 三路布局常量（纯表现，px）──
const W = 1280, H = 760; // 画布
const LANE_Y = [180, 380, 580]; // 上/中/下 路的横轨 y
const LANE_NAME = ['上路', '中路', '下路'];
const HOME_AX = 96, HOME_BX = W - 96; // 左右老家 x
const CONTEST = W / 2; // 接敌中线
const CS = 0.42; // 卡缩放（54v54 要塞得下）
const cw = CARD_W * CS, ch = CARD_H * CS;
const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' } as const;
const hx = (n: number): string => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function dim(n: number, k: number): string {
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return hx((Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k));
}

interface Card { lane: number; side: 'a' | 'b'; idx: number; faceUp: boolean; rev: number; arc: number; tint: number; back: number; rank?: string; suit?: string }

function project(world: IWorld): Card[] {
  const out: Card[] = [];
  for (const [id] of world.query('Card3D', 'Transform')) {
    const c = world.getComponent<Card3D>(id, 'Card3D')!;
    const t = world.getComponent<Transform>(id, 'Transform')!;
    const tw = world.getComponent<Tween>(id, 'Tween') ?? undefined;
    if (c.pairKey === undefined || !c.side) continue;
    const prog = tw && tw.duration > 0 ? clamp01(tw.elapsed / tw.duration) : 1;
    out.push({
      lane: Math.floor(c.pairKey / 100), side: c.side === 'a' ? 'a' : 'b', idx: c.pairKey % 100,
      faceUp: faceUpVisible(tw ? tw.to : t.rotation), rev: revealGlow(prog), arc: Math.sin(Math.PI * hangWarp(prog)),
      tint: c.frontTint ?? 0xeab308, back: c.backTint ?? 0x334155, rank: c.rank, suit: c.suit,
    });
  }
  return out;
}

// 卡 → MOBA 屏位：A 从左老家、B 从右老家，front(col0)在接敌中线，后排退向各自老家；3 行竖排。
function pos(c: Card): { x: number; y: number } {
  const col = Math.floor(c.idx / 3), row = c.idx % 3;
  const sign = c.side === 'a' ? -1 : 1;
  const x = CONTEST + sign * (40 + col * (cw + 6));
  const y = LANE_Y[c.lane] + (row - 1) * (ch + 5) - 56 * c.arc; // 抛飞弧上跳
  return { x, y };
}

function cardSvg(c: Card): string {
  const { x, y } = pos(c);
  const px = x - cw / 2, py = y - ch / 2;
  if (c.faceUp) {
    const red = c.suit === 'H' || c.suit === 'D';
    const sym = c.suit ? SUIT[c.suit as keyof typeof SUIT] ?? '' : '';
    const ink = red ? '#b02a1e' : '#161616';
    // 活牌：金石对比的"金"——落定 gold 辉光（rev 越大越亮）。
    const glow = c.rev > 0.02 ? `<circle cx="${x}" cy="${y}" r="${cw * 0.95}" fill="url(#glow)" opacity="${(c.rev * 0.85).toFixed(2)}"/>` : '';
    return (
      glow +
      `<g>` +
      `<rect x="${px}" y="${py}" width="${cw}" height="${ch}" rx="5" fill="#f7f5ee" stroke="${hx(c.tint)}" stroke-width="${2.6}"/>` +
      (c.rank ? `<text x="${x}" y="${y + ch * 0.16}" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" font-size="${ch * 0.5}" fill="${ink}">${esc(sym)}</text>` +
        `<text x="${px + 3}" y="${py + ch * 0.2}" font-family="Georgia,serif" font-weight="bold" font-size="${ch * 0.2}" fill="${ink}">${esc(c.rank)}</text>` : '') +
      `</g>`
    );
  }
  // 死牌：石板压暗 + 碎裂纹（去色变暗）。
  const k = 1 - c.rev * DEAD_DIM;
  const crack = c.rev > 0.3 ? `<path d="M${px + cw * 0.5},${py} L${x - 3},${y} L${px + cw * 0.7},${py + ch} M${x - 3},${y} L${px},${y + ch * 0.4} M${x - 3},${y} L${px + cw},${y + ch * 0.6}" stroke="rgba(255,255,255,${0.28 * c.rev})" stroke-width="1.4" fill="none"/>` : '';
  return `<rect x="${px}" y="${py}" width="${cw}" height="${ch}" rx="5" fill="${dim(c.back, k)}" stroke="${dim(0x64748b, k)}" stroke-width="1.4"/>${crack}`;
}

// 老家牌王座（♔）+ 哨塔 + 三路轨 + 比分。
function scenery(cards: Card[]): string {
  let s = '';
  // 三路横轨（分区带）+ 路名 + 比分（活牌数；弃一保二可读）。
  for (let L = 0; L < 3; L++) {
    const ly = LANE_Y[L];
    s += `<rect x="${HOME_AX + 40}" y="${ly - ch / 2 - 60}" width="${HOME_BX - HOME_AX - 80}" height="${ch + 120}" rx="14" fill="${L === 1 ? '#13201a' : '#141a26'}" stroke="#243042" stroke-width="1.5" opacity="0.7"/>`;
    const aLive = cards.filter((c) => c.lane === L && c.side === 'a' && c.faceUp).length;
    const bLive = cards.filter((c) => c.lane === L && c.side === 'b' && c.faceUp).length;
    const lead = aLive > bLive ? '#eab308' : bLive > aLive ? '#38bdf8' : '#94a3b8';
    s += `<text x="${HOME_AX + 54}" y="${ly - ch / 2 - 30}" font-family="system-ui" font-size="20" font-weight="700" fill="#7c8aa0">${LANE_NAME[L]}</text>`;
    s += `<text x="${CONTEST}" y="${ly - ch / 2 - 30}" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="800" fill="${lead}">${aLive} : ${bLive}</text>`;
  }
  // 接敌中线（命运在此一掷）。
  s += `<line x1="${CONTEST}" y1="60" x2="${CONTEST}" y2="${H - 30}" stroke="#3b2f1a" stroke-width="2" stroke-dasharray="6 8"/>`;
  // 哨塔（每路 A/B 各一）。
  for (let L = 0; L < 3; L++) for (const [tx, col] of [[CONTEST - 250, '#a16207'], [CONTEST + 250, '#0e7490']] as const) {
    s += `<g transform="translate(${tx},${LANE_Y[L]})"><rect x="-13" y="-34" width="26" height="58" rx="4" fill="${col}" stroke="#1e1208" stroke-width="2"/><rect x="-17" y="-44" width="34" height="14" rx="3" fill="${col}"/><text x="0" y="-50" text-anchor="middle" font-size="13" fill="#cbd5e1">♜</text></g>`;
  }
  // 左右老家牌王座 ♔（A 金 / B 青）。
  const throne = (x: number, color: string, who: string): string =>
    `<g transform="translate(${x},${H / 2})"><rect x="-46" y="-86" width="92" height="172" rx="12" fill="#10151f" stroke="${color}" stroke-width="3"/><text x="0" y="-30" text-anchor="middle" font-size="64" fill="${color}">♔</text><text x="0" y="22" text-anchor="middle" font-family="system-ui" font-size="16" font-weight="700" fill="${color}">${who}</text><text x="0" y="46" text-anchor="middle" font-family="system-ui" font-size="12" fill="#7c8aa0">牌王座</text></g>`;
  s += throne(HOME_AX, '#eab308', '我军') + throne(HOME_BX, '#38bdf8', '敌军');
  return s;
}

function frame(world: IWorld, label: string): string {
  const cards = project(world);
  // 后排先画（front 接敌牌压在最上）：按 |idx| 降序。
  cards.sort((a, b) => b.idx - a.idx);
  const body = cards.map(cardSvg).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><radialGradient id="glow"><stop offset="0%" stop-color="#fff6cc" stop-opacity="0.95"/><stop offset="45%" stop-color="#f5c542" stop-opacity="0.7"/><stop offset="100%" stop-color="#f5c542" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0c1118"/><stop offset="55%" stop-color="#0e1410"/><stop offset="100%" stop-color="#080a0e"/></linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#ground)"/>` +
    scenery(cards) + body +
    `<text x="20" y="36" font-family="system-ui" font-size="22" font-weight="700" fill="#e2e8f0">Game G · ${esc(label)}</text>` +
    `<text x="20" y="${H - 14}" font-family="system-ui" font-size="13" fill="#5b6678">三路 best-of-3 · 金=活/石=死 · 弃一保二看比分 · 命运一掷在中线</text>` +
    `</svg>`
  );
}

const OUT = new URL('./doc/screenshots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const write = (name: string, svg: string): void => { writeFileSync(new URL(name, OUT), svg); console.error(`frame: ${name}`); };
const mk = (seed: number, a = armyFromFormation('a', 6, FORMATION_PRESETS['均衡']), b = armyFromFormation('b', -4, FORMATION_PRESETS['均衡'])): Engine => {
  const e = new Engine({ tickRate: 60 });
  e.load(buildGameGArmyMatch(a, b, seed));
  return e;
};

const e1 = mk(7);
for (let i = 0; i < Math.round(FLIP_DURATION * 0.5); i++) e1.world.tick();
write('02-kickoff.svg', frame(e1.world, '三路开战 · 抛牌（命运一掷）'));

const e2 = mk(7);
for (let i = 0; i < FLIP_DURATION + 10; i++) e2.world.tick();
write('03-reveal.svg', frame(e2.world, '掷命揭晓 · 金=活/石=死（三路 best-of-3）'));

const boss = bossFor(5);
const { a, b } = prepareArmies({ formation: FORMATION_PRESETS['锋矢'], deckBias: 8, jokers: ['bannerman', 'warlord'], interventions: [], enemyForm: boss.formation, enemyBias: boss.favorBias, boss });
const e3 = new Engine({ tickRate: 60 });
e3.load(buildGameGArmyMatch(a, b, 9));
for (let i = 0; i < FLIP_DURATION + 10; i++) e3.world.tick();
write('04-boss.svg', frame(e3.world, `终局 Boss · ${boss.name}`));

console.error('VIS-2/2b done · 3 帧（三路战场+老家牌王座+哨塔+比分+金辉光/石碎裂）→ doc/screenshots/');
