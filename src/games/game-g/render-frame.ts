// VIS-1 · 离线看帧（design/16 §二 · enabler）：跑一局 Game G 到关键拍，把世界投影成 SVG 一帧落盘。
// 为什么 SVG 不是 PNG/WebGL：ThreeRenderer 走 WebGL，node 无 GL 上下文跑不了（headless-gl 未装）；
//   game-d/game-f 同理都用 **SVG 投影**（确定性、可版本控制、浏览器/预览直接看、可 diff）。这里复刻 ThreeRenderer 的
//   抛飞弧/相撞靠拢/翻面/金石对比（共用 feel.ts 曲线，时序与真渲染器一致），让"画面看得见、能评"。
//   ⚠️ 是 3D 场景的 SVG 近似（正交投影，非透视像素级一致），用于评审场景结构/演出，不替代真机 WebGL。
// 跑：npx vite-node src/games/game-g/render-frame.ts  → 落 doc/screenshots/*.svg
import { mkdirSync, writeFileSync } from 'node:fs';
import { Engine } from '../../runtime/engine.js';
import { hangWarp, revealGlow, faceUpVisible, clamp01, ALIVE_GLOW, DEAD_DIM } from './feel.js';
import { buildGameGArmyMatch, armyFromFormation, prepareArmies, bossFor, FORMATION_PRESETS, CARD_W, CARD_H, FLIP_DURATION } from './index.js';
import type { Transform, Card3D, Tween } from '@engine/protocol/components.js';
import type { IWorld } from '@engine/core/types.js';

const APEX_PX = 70; // 抛飞顶点高度（px，≈ ThreeRenderer APEX*ppu）
const COLLIDE = 0.82;
const POP = 0.12; // apex 处放大比（≈ Z_POP 的 2D 近似）
const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' } as const;
const hex = (n: number): string => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
// 颜色按比例压暗（死牌石板用）。
function dim(n: number, k: number): string {
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return hex((Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k));
}

interface View { x: number; y: number; w: number; h: number; faceUp: boolean; rev: number; tint: number; back: number; rank?: string; suit?: string }

// 投影一帧：复刻 ThreeRenderer 的抛飞弧 + 相撞靠拢 + 翻面 + 落定金石对比（共用 feel 曲线）。
function project(world: IWorld): View[] {
  const pairSumX = new Map<number, number>();
  const pairCnt = new Map<number, number>();
  const raw: { t: Transform; c: Card3D; tw?: Tween }[] = [];
  for (const [id] of world.query('Card3D', 'Transform')) {
    const c = world.getComponent<Card3D>(id, 'Card3D')!;
    const t = world.getComponent<Transform>(id, 'Transform')!;
    const tw = world.getComponent<Tween>(id, 'Tween') ?? undefined;
    raw.push({ t, c, tw });
    if (c.pairKey !== undefined) { pairSumX.set(c.pairKey, (pairSumX.get(c.pairKey) ?? 0) + t.x); pairCnt.set(c.pairKey, (pairCnt.get(c.pairKey) ?? 0) + 1); }
  }
  return raw.map(({ t, c, tw }) => {
    const prog = tw && tw.duration > 0 ? clamp01(tw.elapsed / tw.duration) : 1;
    const arc = Math.sin(Math.PI * hangWarp(prog));
    let nudge = 0;
    if (c.pairKey !== undefined) { const n = pairCnt.get(c.pairKey) ?? 1; const cx = (pairSumX.get(c.pairKey) ?? t.x) / n; nudge = (cx - t.x) * COLLIDE * arc; }
    const sc = 1 + POP * arc;
    return {
      x: t.x + nudge, y: t.y - APEX_PX * arc, w: (c.width ?? CARD_W) * sc, h: (c.height ?? CARD_H) * sc,
      faceUp: faceUpVisible(tw ? tw.to : t.rotation), rev: revealGlow(prog),
      tint: c.frontTint ?? 0xeab308, back: c.backTint ?? 0x334155, rank: c.rank, suit: c.suit,
    };
  });
}

function cardSvg(v: View): string {
  const x = v.x - v.w / 2, y = v.y - v.h / 2;
  if (v.faceUp) {
    const glow = v.rev * ALIVE_GLOW; // 活：自队色辉光
    const red = v.suit === 'H' || v.suit === 'D';
    const sym = v.suit ? SUIT[v.suit as keyof typeof SUIT] ?? '' : '';
    const ink = red ? '#c0392b' : '#161616';
    const bg = glow > 0 ? hex((lerp(0xf7, (v.tint >> 16) & 0xff, glow * 0.5) << 16) | (lerp(0xf5, (v.tint >> 8) & 0xff, glow * 0.5) << 8) | lerp(0xee, v.tint & 0xff, glow * 0.5)) : '#f7f5ee';
    return (
      `<g>` +
      `<rect x="${x}" y="${y}" width="${v.w}" height="${v.h}" rx="${10 * (v.w / CARD_W)}" fill="${bg}" stroke="${hex(v.tint)}" stroke-width="${6 * (v.w / CARD_W)}"/>` +
      (v.rank ? `<text x="${v.x}" y="${v.y + v.h * 0.13}" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" font-size="${v.h * 0.42}" fill="${ink}">${esc(sym)}</text>` +
        `<text x="${x + v.w * 0.14}" y="${y + v.h * 0.16}" font-family="Georgia,serif" font-weight="bold" font-size="${v.h * 0.15}" fill="${ink}">${esc(v.rank)}</text>` : '') +
      `</g>`
    );
  }
  const k = 1 - v.rev * DEAD_DIM; // 死：石板压暗
  return `<rect x="${x}" y="${y}" width="${v.w}" height="${v.h}" rx="${10 * (v.w / CARD_W)}" fill="${dim(v.back, k)}" stroke="${dim(0xffffff, k * 0.3)}" stroke-width="${4 * (v.w / CARD_W)}"/>`;
}

function frame(world: IWorld, label: string): string {
  const vs = project(world);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of vs) { minX = Math.min(minX, v.x - v.w / 2); maxX = Math.max(maxX, v.x + v.w / 2); minY = Math.min(minY, v.y - v.h / 2); maxY = Math.max(maxY, v.y + v.h / 2); }
  const pad = 60;
  const vbx = minX - pad, vby = minY - pad, vbw = maxX - minX + pad * 2, vbh = maxY - minY + pad * 2;
  const body = vs.map(cardSvg).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${Math.round((900 * vbh) / vbw)}" viewBox="${vbx} ${vby} ${vbw} ${vbh}">` +
    `<rect x="${vbx}" y="${vby}" width="${vbw}" height="${vbh}" fill="#0a0a14"/>` +
    body +
    `<text x="${vbx + 16}" y="${vby + 40}" font-family="system-ui" font-size="28" fill="#cbd5e1">Game G · ${esc(label)}</text>` +
    `</svg>`
  );
}

// ── 出帧：三路开战(抛牌中) / 掷命揭晓(金石+溃散) / 终局 Boss 决战 ──
const OUT = new URL('./doc/screenshots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const write = (name: string, svg: string): void => { writeFileSync(new URL(name, OUT), svg); console.error(`frame: ${name}`); };

// 普通对局：均衡 vs 均衡。
const mk = (seed: number, a = armyFromFormation('a', 6, FORMATION_PRESETS['均衡']), b = armyFromFormation('b', -4, FORMATION_PRESETS['均衡'])): Engine => {
  const e = new Engine({ tickRate: 60 });
  e.load(buildGameGArmyMatch(a, b, seed));
  return e;
};

const e1 = mk(7);
for (let i = 0; i < Math.round(FLIP_DURATION * 0.5); i++) e1.world.tick(); // 抛牌中（apex 附近）
write('02-kickoff.svg', frame(e1.world, '三路开战 · 抛牌（命运一掷）'));

const e2 = mk(7);
for (let i = 0; i < FLIP_DURATION + 10; i++) e2.world.tick(); // 落定揭晓（金石对比）
write('03-reveal.svg', frame(e2.world, '掷命揭晓 · 金=活/石=死（best-of-3 三路）'));

// 终局 Boss：小王·无常（decapitate×3）vs 玩家集齐将领流。
const boss = bossFor(5);
const { a, b } = prepareArmies({ formation: FORMATION_PRESETS['锋矢'], deckBias: 8, jokers: ['bannerman', 'warlord'], interventions: [], enemyForm: boss.formation, enemyBias: boss.favorBias, boss });
const e3 = new Engine({ tickRate: 60 });
e3.load(buildGameGArmyMatch(a, b, 9));
for (let i = 0; i < FLIP_DURATION + 10; i++) e3.world.tick();
write('04-boss.svg', frame(e3.world, `终局 Boss · ${boss.name}（${boss.taunt}）`));

console.error('VIS-1 done · 3 帧 → src/games/game-g/doc/screenshots/ （⚠️ SVG 近似 3D 场景；现状=有牌没战场，待 VIS-2 建三路/老家/哨塔）');
