// 一次性离线渲染：复用纯函数 collectRenderables（无需 DOM canvas）把 game-d 世界投影成 SVG 一帧。
// 用途：在无浏览器的环境里"看一帧"——确定性、可截图。SVG 走 stdout（免 node:fs 依赖，tsc 干净）：
//   npx vite-node src/games/game-d/render-frame.ts > game-d-frame.svg
import { Engine } from '../../runtime/engine.js';
import { collectRenderables, getCameraView } from '../../renderer/renderable.js';
import type { Transform, SpawnRequest, Status } from '@engine/protocol/components.js';
import { buildGameDBlueprint, GAME_D_ASSETS, VIEWPORT_W, VIEWPORT_H, STATUS_FROZEN } from './index.js';

const PREFIX = 'data:image/svg+xml,';
const innerSvg = (src: string): string => decodeURIComponent(src.slice(PREFIX.length));

const e = new Engine({ tickRate: 60 });
e.load(buildGameDBlueprint());

// 让怪追近英雄。
for (let i = 0; i < 26; i++) e.world.tick();
// 在最近的怪身上放冰霜新星（展示冰环 + 冻住）。
const a = e.world.getComponent<Transform>('enemy_a', 'Transform')!;
e.world.createEntity('shot');
e.world.addComponent('shot', { type: 'SpawnRequest', templateId: 'frost_nova', x: a.x, y: a.y } as SpawnRequest);
for (let i = 0; i < 2; i++) e.world.tick();

const assetSrc = new Map(GAME_D_ASSETS.map((d) => [d.key, d]));
const cam = getCameraView(e.world);
const cx = cam?.centerX ?? 0;
const cy = cam?.centerY ?? 0;
const zoom = cam?.zoom ?? 1;

let body = '';
for (const r of collectRenderables(e.world)) {
  const asset = r.sprite ? assetSrc.get(r.sprite.textureKey) : undefined;
  if (asset && asset.kind === 'texture') {
    const aw = asset.width ?? 16;
    const ah = asset.height ?? 16;
    // 内嵌真实 sprite SVG（嵌套 <svg>，比 <image href=datauri> 兼容性好）。
    body += `<g transform="translate(${r.x - aw / 2},${r.y - ah / 2})">${innerSvg(asset.src)}</g>`;
    // 冰冻标记：被冻的怪画青色定身环。
    const st = e.world.getComponent<Status>(r.entityId, 'Status');
    if (st && (st.flags & STATUS_FROZEN) !== 0) {
      body += `<circle cx="${r.x}" cy="${r.y}" r="15" fill="none" stroke="rgb(120,220,255)" stroke-width="2.5"/>`;
    }
  } else if (r.shape?.kind === 'box') {
    const w = r.shape.width ?? 8;
    const h = r.shape.height ?? 8;
    body += `<rect x="${r.x - w / 2}" y="${r.y - h / 2}" width="${w}" height="${h}" fill="#e2e8f0"/>`;
  }
}

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${VIEWPORT_W}" height="${VIEWPORT_H}">` +
  `<rect width="${VIEWPORT_W}" height="${VIEWPORT_H}" fill="#0a0a14"/>` +
  `<g transform="translate(${VIEWPORT_W / 2},${VIEWPORT_H / 2}) scale(${zoom}) translate(${-cx},${-cy})">${body}</g>` +
  `<text x="12" y="24" font-family="system-ui" font-size="13" fill="#cbd5e1">Game D · 暗黑类 ARPG 切片 —— 怪追英雄 · 冰霜新星冻住范围内怪（纯数据涌现）</text>` +
  `</svg>`;

// SVG → stdout（重定向到文件）；诊断信息走 stderr，不污染 SVG。
console.log(svg);
console.error(`game-d frame: ${collectRenderables(e.world).length} renderables, cam@${cx.toFixed(1)},${cy.toFixed(1)} zoom ${zoom}`);
