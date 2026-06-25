import type { AssetManifest } from '@assets/index.js';

// game-h「双人挑战」美术 —— 原版可爱方块小人，做成 3 帧精灵表（idle + 走路2帧），纯内联 SVG 数据。
// sim 只引用 textureKey；anim-state 按速度在 idle/walk 间切 clip、推 Frame.index，渲染器按帧裁切。
// 真精灵动画：走动时小腿交替（帧1/2），静止 idle（帧0）。换真美术=同 key 换 src，逻辑不动。

const FW = 32; // 单帧宽
const FH = 32; // 单帧高

// 一个角色的 3 帧横向精灵表（96×32）：帧0 idle、帧1/2 走路（小腿左右交替 + 轻微起伏）。
// body=主色，eyes=白+深瞳；legs 用深色描出迈步。
function sheet(body: string, dark: string): string {
  const face = (cx: number) =>
    `<circle cx="${cx + 10}" cy="13" r="3.4" fill="#fff"/><circle cx="${cx + 21}" cy="13" r="3.4" fill="#fff"/>` +
    `<circle cx="${cx + 11}" cy="14" r="1.7" fill="${dark}"/><circle cx="${cx + 22}" cy="14" r="1.7" fill="${dark}"/>`;
  const bodyRect = (cx: number, y: number, h: number) => `<rect x="${cx + 4}" y="${y}" width="24" height="${h}" rx="7" fill="${body}"/>`;
  // 帧0 idle：方块居中、双脚并拢
  const f0 = bodyRect(0, 3, 24) + face(0) + `<rect x="9" y="27" width="6" height="4" rx="1.5" fill="${dark}"/><rect x="17" y="27" width="6" height="4" rx="1.5" fill="${dark}"/>`;
  // 帧1 走A：身体微沉、左脚前
  const f1 = bodyRect(FW, 4, 23) + face(FW) + `<rect x="${FW + 7}" y="27" width="6" height="4" rx="1.5" fill="${dark}"/><rect x="${FW + 19}" y="28" width="6" height="3" rx="1.5" fill="${dark}"/>`;
  // 帧2 走B：右脚前
  const f2 = bodyRect(FW * 2, 4, 23) + face(FW * 2) + `<rect x="${FW * 2 + 19}" y="27" width="6" height="4" rx="1.5" fill="${dark}"/><rect x="${FW * 2 + 7}" y="28" width="6" height="3" rx="1.5" fill="${dark}"/>`;
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${FW * 3}" height="${FH}">${f0}${f1}${f2}</svg>`)}`;
}

export const ASSET_P1_SHEET = 'gh.p1.sheet'; // 蓝
export const ASSET_P2_SHEET = 'gh.p2.sheet'; // 橙

export const GAME_H_ASSETS: AssetManifest = [
  { kind: 'sprite-sheet', key: ASSET_P1_SHEET, src: sheet('#3b82f6', '#15233f'), frameWidth: FW, frameHeight: FH, columns: 3, count: 3 },
  { kind: 'sprite-sheet', key: ASSET_P2_SHEET, src: sheet('#fb923c', '#5b3210'), frameWidth: FW, frameHeight: FH, columns: 3, count: 3 },
];

// 每个角色的动画 clip 表（idle=帧0 定格；walk=帧1..2 循环，fps=6 即每6tick一帧）。
export const ANIM_CLIPS = (sheetKey: string) => ({
  idle: { sheet: sheetKey, from: 0, count: 1, fps: 1, loop: false },
  walk: { sheet: sheetKey, from: 1, count: 2, fps: 6, loop: true },
});
