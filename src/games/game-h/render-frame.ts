// 离线渲染：把 是男人就上100层(双人) 的攀爬塔投影成整关 SVG 一帧（无需浏览器）。
//   npx vite-node src/games/game-h/render-frame.ts > climb.svg
// 精灵表按当前 Frame.index 裁帧（嵌套 <svg viewBox>）；平台画 box。全关世界坐标直出。
import { collectRenderables } from '../../renderer/renderable.js';
import { applyCommands } from '@net/index.js';
import { buildClimbWorld, WORLD_W, WORLD_H, CLIMB_PLATFORMS, playerEntity } from './climb-world.js';
import { GAME_H_ASSETS } from './assets.js';

const PREFIX = 'data:image/svg+xml,';
const innerSvg = (src: string): string => decodeURIComponent(src.slice(PREFIX.length));
const hex = (t: number): string => '#' + (t >>> 0).toString(16).padStart(6, '0').slice(-6);

const w = buildClimbWorld(['p1', 'p2']);
// 让两人各爬几层，画面更有看头：p1 往右上、p2 往左上各跳一阵。
for (let i = 0; i < 26; i++) {
  applyCommands(w, [
    { playerId: 'p1', tick: 0, move: { dx: 1, dy: 0 }, jump: i % 6 === 0 },
    { playerId: 'p2', tick: 0, move: { dx: 1, dy: 0 }, jump: i % 6 === 3 },
  ]);
  w.tick();
}

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
    body += `<rect x="${r.x - bw / 2}" y="${r.y - bh / 2}" width="${bw}" height="${bh}" fill="${r.color ? hex(r.color.tint) : '#e2e8f0'}"/>`;
  }
}
// 楼层标注（右侧）：每层画个淡号，体现"上N层"。
let marks = '';
CLIMB_PLATFORMS.forEach((p, i) => { marks += `<text x="600" y="${p.y + 4}" font-family="system-ui" font-size="11" fill="#64748b" text-anchor="end">${i + 1}F</text>`; });

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${WORLD_W}" height="${WORLD_H}">` +
  `<rect width="${WORLD_W}" height="${WORLD_H}" fill="#0f1830"/>` +
  marks + body +
  `<text x="14" y="30" font-family="system-ui" font-size="18" fill="#e2e8f0">是男人就上100层 · 双人合作（蓝/橙 踩头借力往上爬 · 全数据驱动）</text>` +
  `<text x="14" y="${WORLD_H - 16}" font-family="system-ui" font-size="13" fill="#94a3b8">顶部 = 会合目标区（两人都登顶过关）· 相机自动跟双人并缩放</text>` +
  `</svg>`;
console.log(svg);
console.error(`climb frame: ${collectRenderables(w).length} renderables, ${WORLD_W}x${WORLD_H}`);
