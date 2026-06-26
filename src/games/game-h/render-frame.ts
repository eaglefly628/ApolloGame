// 离线渲染：把「你造我塔」投影成整关 SVG 一帧（无需浏览器）。
//   npx vite-node src/games/game-h/render-frame.ts > climb.svg
import { collectRenderables } from '../../renderer/renderable.js';
import { applyCommands } from '@net/index.js';
import { buildClimbWorld, WORLD_W, WORLD_H } from './climb-world.js';
import { GAME_H_ASSETS } from './assets.js';

const PREFIX = 'data:image/svg+xml,';
const innerSvg = (src: string): string => decodeURIComponent(src.slice(PREFIX.length));
const hex = (t: number): string => '#' + (t >>> 0).toString(16).padStart(6, '0').slice(-6);

const w = buildClimbWorld(['p1', 'p2']);
// 橙踩住 og(出生即在板上) → 蓝的幻影台已实；蓝爬两步展示。
for (let i = 0; i < 22; i++) applyCommands(w, [{ playerId: 'p1', tick: 0, move: { dx: 1, dy: 0 }, jump: i % 6 === 0 }]), w.tick();

const sheets = new Map(GAME_H_ASSETS.map((d) => [d.key, d]));
let body = '';
for (const r of collectRenderables(w)) {
  const a = r.sprite ? sheets.get(r.sprite.textureKey) : undefined;
  if (a && a.kind === 'sprite-sheet') {
    const fw = a.frameWidth, fh = a.frameHeight, fi = r.frame?.index ?? 0;
    const shapes = innerSvg(a.src).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    body += `<svg x="${r.x - fw / 2}" y="${r.y - fh / 2}" width="${fw}" height="${fh}" viewBox="${fi * fw} 0 ${fw} ${fh}">${shapes}</svg>`;
  } else if (r.shape?.kind === 'box') {
    const bw = r.shape.width ?? 8, bh = r.shape.height ?? 8;
    body += `<rect x="${r.x - bw / 2}" y="${r.y - bh / 2}" width="${bw}" height="${bh}" rx="3" fill="${r.color ? hex(r.color.tint) : '#e2e8f0'}" fill-opacity="${r.color?.alpha ?? 1}"/>`;
  }
}
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${WORLD_W}" height="${WORLD_H}">` +
  `<defs><linearGradient id="bg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0f1830"/><stop offset="1" stop-color="#2a3a64"/></linearGradient></defs>` +
  `<rect width="${WORLD_W}" height="${WORLD_H}" fill="url(#bg)"/>` + body +
  `<text x="14" y="28" font-family="system-ui" font-size="17" fill="#e2e8f0">你造我塔 · 双人合作（青=幻影台，对方踩开关才实体 · 互相搭路登顶）</text>` +
  `</svg>`;
console.log(svg);
console.error(`frame: ${collectRenderables(w).length} renderables, ${WORLD_W}x${WORLD_H}`);
