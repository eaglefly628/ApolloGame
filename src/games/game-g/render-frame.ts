// MARCH-2 · 离线看帧（design/17 行军模型 + 16 §二）：跑一局到关键拍 → 投影成 SVG 落 doc/screenshots/。
// 为什么 SVG 不是 PNG/WebGL：node 无 GL 上下文跑不了真 ThreeRenderer（game-d/game-f 同理用 SVG 投影）→ 确定性/可版本控制/浏览器直接看/可 diff。
// owner 纠偏（design/17）：实时三路行军取代瞬间翻牌。本帧演出 = **兵出老家 → 沿三路推进 → 接敌掷命(金生/石死) → 幸存突破 → 攻克敌方老家(home_hp 见血条)**。
//   · 位置：`scene.marchScreenPos`（match_clock 拍数驱动，与 ThreeRenderer 共用单一真相、纯表现不进 hash）。
//   · 老家牌王座(♔) + **血条**(home_hp/满) + 哨塔 + 三路轨/比分。
// 跑：npx vite-node src/games/game-g/render-frame.ts → doc/screenshots/*.svg
import { mkdirSync, writeFileSync } from 'node:fs';
import { Engine } from '../../runtime/engine.js';
import { hangWarp, revealGlow, faceUpVisible, clamp01, DEAD_DIM, encounterReveal } from './feel.js';
import { buildGameGArmyMatch, armyFromFormation, prepareArmies, bossFor, FORMATION_PRESETS, FLIP_DURATION, MARCH_DURATION, HOME_HP } from './index.js';
import { SCENE_W as W, SCENE_H as H, LANE_Y, LANE_NAME, HOME_AX, HOME_BX, CONTEST, SCENE_CW as cw, SCENE_CH as ch, TOWERS, marchScreenPos, laneScores } from './scene.js'; // 单一真相布局（与 ThreeRenderer 共用）
import type { Transform, Card3D, Tween, Resource, Timer } from '@engine/protocol/components.js';
import type { IWorld } from '@engine/core/types.js';

const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' } as const;
const hx = (n: number): string => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function dim(n: number, k: number): string {
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return hx((Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k));
}
const clockElapsed = (world: IWorld): number => world.getComponent<Timer>('clock', 'Timer')?.elapsed ?? 0;
const homeHp = (world: IWorld, id: 'res_ahome' | 'res_bhome'): number => world.getComponent<Resource>(id, 'Resource')?.current ?? HOME_HP;

interface Card { lane: number; side: 'a' | 'b'; idx: number; isGeneral: boolean; faceUp: boolean; rev: number; lp: number; x: number; y: number; tint: number; back: number; rank?: string; suit?: string }

function project(world: IWorld, elapsed: number): Card[] {
  const out: Card[] = [];
  for (const [id] of world.query('Card3D', 'Transform')) {
    const c = world.getComponent<Card3D>(id, 'Card3D')!;
    const t = world.getComponent<Transform>(id, 'Transform')!;
    const tw = world.getComponent<Tween>(id, 'Tween') ?? undefined;
    if (c.pairKey === undefined || !c.side) continue;
    const lane = Math.floor(c.pairKey / 100);
    const idx = c.pairKey % 100;
    const side: 'a' | 'b' = c.side === 'a' ? 'a' : 'b';
    const lp = encounterReveal(elapsed, FLIP_DURATION, lane); // MARCH-2：面朝下行军 → 接敌点才翻（逐路错开，design/17 §八）
    const faceUp = faceUpVisible(tw ? tw.to : t.rotation);
    const arc = Math.sin(Math.PI * hangWarp(lp));
    const pos = marchScreenPos(lane, side, idx, faceUp, elapsed, arc); // 行军屏位（home→中线→敌家）
    out.push({
      lane, side, idx, isGeneral: idx === 0, // idx0=本路主将（牵动全路）
      faceUp, rev: revealGlow(lp), lp, x: pos.x, y: pos.y,
      tint: c.frontTint ?? 0xeab308, back: c.backTint ?? 0x334155, rank: c.rank, suit: c.suit,
    });
  }
  return out;
}

function cardSvg(c: Card): string {
  const x = c.x, y = c.y; // 行军屏位（scene.ts marchScreenPos）
  const px = x - cw / 2, py = y - ch / 2;
  // MARCH-2：未揭晓（行军中 lp<0.5）→ 面朝下中性牌背（侧色描边；主将暗 ♔ 标列）。接敌(lp≥0.5)才翻面。
  if (c.lp < 0.5) {
    const trim = c.side === 'a' ? '#a16207' : '#0e7490';
    let dn = `<rect x="${px}" y="${py}" width="${cw}" height="${ch}" rx="5" fill="#2a3344" stroke="${trim}" stroke-width="${c.isGeneral ? 3 : 2}"/>` +
      `<rect x="${px + 5}" y="${py + 5}" width="${cw - 10}" height="${ch - 10}" rx="3" fill="none" stroke="${trim}" stroke-width="0.8" opacity="0.5"/>`;
    if (c.isGeneral) dn += `<text x="${x}" y="${py - 3}" text-anchor="middle" font-size="${ch * 0.3}" fill="${trim}">♔</text>`;
    return dn;
  }
  let body: string;
  if (c.faceUp) {
    const red = c.suit === 'H' || c.suit === 'D';
    const sym = c.suit ? SUIT[c.suit as keyof typeof SUIT] ?? '' : '';
    const ink = red ? '#b02a1e' : '#161616';
    // 活牌：金石对比的"金"——落定 gold 辉光（rev 越大越亮）。
    const glow = c.rev > 0.02 ? `<circle cx="${x}" cy="${y}" r="${cw * 0.95}" fill="url(#glow)" opacity="${(c.rev * 0.85).toFixed(2)}"/>` : '';
    body =
      glow +
      `<g>` +
      `<rect x="${px}" y="${py}" width="${cw}" height="${ch}" rx="5" fill="#f7f5ee" stroke="${hx(c.tint)}" stroke-width="${c.isGeneral ? 4 : 2.6}"/>` +
      (c.rank ? `<text x="${x}" y="${y + ch * 0.16}" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" font-size="${ch * 0.5}" fill="${ink}">${esc(sym)}</text>` +
        `<text x="${px + 3}" y="${py + ch * 0.2}" font-family="Georgia,serif" font-weight="bold" font-size="${ch * 0.2}" fill="${ink}">${esc(c.rank)}</text>` : '') +
      `</g>`;
  } else {
    // 死牌：石板压暗 + 碎裂纹（去色变暗）。
    const k = 1 - c.rev * DEAD_DIM;
    const crack = c.rev > 0.3 ? `<path d="M${px + cw * 0.5},${py} L${x - 3},${y} L${px + cw * 0.7},${py + ch} M${x - 3},${y} L${px},${y + ch * 0.4} M${x - 3},${y} L${px + cw},${y + ch * 0.6}" stroke="rgba(255,255,255,${0.28 * c.rev})" stroke-width="1.4" fill="none"/>` : '';
    body = `<rect x="${px}" y="${py}" width="${cw}" height="${ch}" rx="5" fill="${dim(c.back, k)}" stroke="${dim(0x64748b, k)}" stroke-width="1.4"/>${crack}`;
  }
  // 主将(idx0)标识：♔ 王冠（牵动全路一眼可辨）；主将阵亡 → 红「斩」（擒贼擒王→溃散可读）。
  if (c.isGeneral) {
    const col = c.side === 'a' ? '#eab308' : '#38bdf8';
    body += `<text x="${x}" y="${py - 3}" text-anchor="middle" font-size="${ch * 0.32}" fill="${col}">♔</text>`;
    if (!c.faceUp && c.rev > 0.4) body += `<text x="${x}" y="${y + ch * 0.12}" text-anchor="middle" font-family="system-ui" font-weight="800" font-size="${ch * 0.4}" fill="#ef4444" opacity="0.92">斩</text>`;
  }
  return body;
}

// 老家牌王座（♔ + 血条）+ 哨塔 + 三路轨 + 比分。
function scenery(cards: Card[], aHome: number, bHome: number): string {
  let s = '';
  const scores = laneScores(cards); // 单一真相比分
  // 三路横轨（分区带）+ 路名 + 比分（活牌数；弃一保二可读）。
  for (let L = 0; L < 3; L++) {
    const ly = LANE_Y[L];
    s += `<rect x="${HOME_AX + 40}" y="${ly - ch / 2 - 60}" width="${HOME_BX - HOME_AX - 80}" height="${ch + 120}" rx="14" fill="${L === 1 ? '#13201a' : '#141a26'}" stroke="#243042" stroke-width="1.5" opacity="0.7"/>`;
    const { a: aLive, b: bLive } = scores[L];
    const lead = aLive > bLive ? '#eab308' : bLive > aLive ? '#38bdf8' : '#94a3b8';
    s += `<text x="${HOME_AX + 54}" y="${ly - ch / 2 - 30}" font-family="system-ui" font-size="20" font-weight="700" fill="#7c8aa0">${LANE_NAME[L]}</text>`;
    s += `<text x="${CONTEST}" y="${ly - ch / 2 - 30}" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="800" fill="${lead}">${aLive} : ${bLive}</text>`;
  }
  // 接敌中线（命运在此一掷）。
  s += `<line x1="${CONTEST}" y1="60" x2="${CONTEST}" y2="${H - 30}" stroke="#3b2f1a" stroke-width="2" stroke-dasharray="6 8"/>`;
  // 哨塔（每路 A/B 各一，scene.TOWERS 单一真相）。
  for (const tw of TOWERS) {
    const col = tw.side === 'a' ? '#a16207' : '#0e7490';
    s += `<g transform="translate(${tw.x},${tw.y})"><rect x="-13" y="-34" width="26" height="58" rx="4" fill="${col}" stroke="#1e1208" stroke-width="2"/><rect x="-17" y="-44" width="34" height="14" rx="3" fill="${col}"/><text x="0" y="-50" text-anchor="middle" font-size="13" fill="#cbd5e1">♜</text></g>`;
  }
  // 左右老家牌王座 ♔ + 血条（攻克=0=破家）。A 金 / B 青。
  const throne = (x: number, color: string, who: string, hp: number): string => {
    const bw = 84, fill = (bw * clamp01(hp / HOME_HP)).toFixed(1);
    const broken = hp <= 0;
    return `<g transform="translate(${x},${H / 2})">` +
      `<rect x="-46" y="-86" width="92" height="172" rx="12" fill="#10151f" stroke="${broken ? '#ef4444' : color}" stroke-width="3"/>` +
      `<text x="0" y="-30" text-anchor="middle" font-size="64" fill="${broken ? '#7f1d1d' : color}">♔</text>` +
      `<text x="0" y="22" text-anchor="middle" font-family="system-ui" font-size="16" font-weight="700" fill="${color}">${who}</text>` +
      `<text x="0" y="46" text-anchor="middle" font-family="system-ui" font-size="12" fill="#7c8aa0">牌王座</text>` +
      `<rect x="-42" y="64" width="${bw}" height="11" rx="3" fill="#1a2230" stroke="#33415a"/>` +
      `<rect x="-42" y="64" width="${fill}" height="11" rx="3" fill="${broken ? '#ef4444' : color}"/>` +
      `<text x="0" y="100" text-anchor="middle" font-family="system-ui" font-size="12" font-weight="700" fill="${broken ? '#ef4444' : '#9aa7bd'}">${broken ? '已破！' : `老家 ${hp}/${HOME_HP}`}</text>` +
      `</g>`;
  };
  s += throne(HOME_AX, '#eab308', '我军', aHome) + throne(HOME_BX, '#38bdf8', '敌军', bHome);
  return s;
}

function frame(world: IWorld, label: string): string {
  const elapsed = clockElapsed(world);
  const cards = project(world, elapsed);
  // 后排先画（front 接敌牌压在最上）：按 |idx| 降序。
  cards.sort((a, b) => b.idx - a.idx);
  const body = cards.map(cardSvg).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><radialGradient id="glow"><stop offset="0%" stop-color="#fff6cc" stop-opacity="0.95"/><stop offset="45%" stop-color="#f5c542" stop-opacity="0.7"/><stop offset="100%" stop-color="#f5c542" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0c1118"/><stop offset="55%" stop-color="#0e1410"/><stop offset="100%" stop-color="#080a0e"/></linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#ground)"/>` +
    scenery(cards, homeHp(world, 'res_ahome'), homeHp(world, 'res_bhome')) + body +
    `<text x="20" y="36" font-family="system-ui" font-size="22" font-weight="700" fill="#e2e8f0">Game G · ${esc(label)}</text>` +
    `<text x="20" y="${H - 14}" font-family="system-ui" font-size="13" fill="#5b6678">实时三路行军 · 兵出老家→遭遇掷命(金活/石死)→幸存突破→攻克大本营(血条) · design/17</text>` +
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
const runTo = (e: Engine, ticks: number): Engine => { for (let i = 0; i < ticks; i++) e.world.tick(); return e; };

// ① 行军中：兵出老家、沿三路向中线推进（尚未接敌）。
write('02-kickoff.svg', frame(runTo(mk(7), Math.round(FLIP_DURATION * 0.42)).world, '三路行军 · 兵出老家向中线推进'));
// ② 遭遇掷命：前锋接敌、翻牌定生死（金活/石死、主将♔/斩、逐路揭晓）。
write('03-stagger.svg', frame(runTo(mk(7), Math.round(FLIP_DURATION * 0.8)).world, '遭遇掷命 · 接敌逐路翻牌（上路先翻 / 下路仍面朝下推进）'));
// ③ 突破破家：幸存者推进到敌方老家、血条见底=攻克。
write('04-reveal.svg', frame(runTo(mk(7), FLIP_DURATION + MARCH_DURATION + 4).world, '突破破家 · 幸存推进攻克敌方老家'));

const boss = bossFor(5);
const { a, b } = prepareArmies({ formation: FORMATION_PRESETS['锋矢'], deckBias: 8, tiangangs: ['bannerman', 'warlord'], interventions: [], enemyForm: boss.formation, enemyBias: boss.favorBias, boss });
const e3 = new Engine({ tickRate: 60 });
e3.load(buildGameGArmyMatch(a, b, 9));
runTo(e3, FLIP_DURATION + MARCH_DURATION + 4);
write('05-boss.svg', frame(e3.world, `终局 Boss · ${boss.name}（行军破家）`));

console.error('MARCH-2 done · 4 帧（行军出征→遭遇掷命→突破破家 + 老家血条 + 三路战场/哨塔/比分/金石）→ doc/screenshots/');
