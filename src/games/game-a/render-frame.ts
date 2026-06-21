// 一次性离线渲染：把 Game A 某关用纯函数 collectRenderables 投影成整关 SVG 一帧（无需浏览器/DOM）。
//   STAGE=0|1|2 npx vite-node src/games/game-a/render-frame.ts > game-a.svg
// 全关世界坐标直出（不走相机），便于审视整张关卡布局（平台/机关/角色）。
import { Engine } from '../../runtime/engine.js';
import { collectRenderables } from '../../renderer/renderable.js';
import { buildGameABlueprint } from './blueprint.js';
import { GAME_A_STAGES, GAME_A_ASSETS } from './index.js';

const PREFIX = 'data:image/svg+xml,';
const innerSvg = (src: string): string => decodeURIComponent(src.slice(PREFIX.length));
const hex = (tint: number): string => '#' + tint.toString(16).padStart(6, '0');

const stageIdx = Number(process.env.STAGE ?? '1');
const stage = GAME_A_STAGES[stageIdx];
const e = new Engine({ tickRate: 60 });
e.load(buildGameABlueprint(stage.level));
for (let i = 0; i < 70; i++) e.world.tick(); // 落定：A 踩板→幻影台变实 等

const W = stage.level.bounds.width;
const H = stage.level.bounds.height;
const assetSrc = new Map(GAME_A_ASSETS.map((d) => [d.key, d]));

let body = '';
for (const r of collectRenderables(e.world)) {
  const asset = r.sprite ? assetSrc.get(r.sprite.textureKey) : undefined;
  if (asset && asset.kind === 'texture') {
    const aw = asset.width ?? 16;
    const ah = asset.height ?? 16;
    body += `<g transform="translate(${r.x - aw / 2},${r.y - ah / 2})">${innerSvg(asset.src)}</g>`;
  } else if (r.shape?.kind === 'box') {
    const w = r.shape.width ?? 8;
    const h = r.shape.height ?? 8;
    const fill = r.color ? hex(r.color.tint) : '#e2e8f0';
    const op = r.color?.alpha ?? 1;
    body += `<rect x="${r.x - w / 2}" y="${r.y - h / 2}" width="${w}" height="${h}" fill="${fill}" fill-opacity="${op}"/>`;
  }
}

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
  `<rect width="${W}" height="${H}" fill="#16213e"/>` +
  body +
  `<text x="10" y="22" font-family="system-ui" font-size="15" fill="#e2e8f0">Game A · ${stage.name}（蓝A 协助 / 橙B 攀登 · 数据驱动）</text>` +
  `</svg>`;
console.log(svg);
console.error(`${stage.name}: ${collectRenderables(e.world).length} renderables, ${W}x${H}`);
