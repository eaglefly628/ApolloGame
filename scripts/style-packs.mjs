// 风格包库（style-packs·REQ-DEMO-T1 ②·工作流档 §四）——**纯数据文件 `scripts/style-packs.json`**，本模块只是薄加载器。
// 一个 packId 翻译成各家方言（万相吃中文 promptZh·Tripo/Meshy 吃英文 promptEn）；弱 LLM/用户只碰 packId。
// palette = palette-snap 后处理的靶（同款游戏全列表共用 → 天然成套）。
// **扩包 = 往 style-packs.json 加一条（不改任何代码）**；demo 前先调稳这 3 包。
// refImage（定调图参考·图生图锚）：字段保留在 schema；adapters 当前无参考图入参——
//   blocker 记录：万相 style-repaint / Meshy image-to-3D 的参考图 API 待真 key 验证后接（工作流档 §四）。

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @typedef {{ packId:string, name:string, promptZh:string, promptEn:string, palette:number[],
 *   negative:{zh:string,en:string}, post:{paletteSnap:boolean, pixelGrid?:number},
 *   params:{provider:'qwen'|'tripo'|'meshy', model:string, seed?:number}, refImage?:string }} StylePack */

const PACKS_FILE = join(dirname(fileURLToPath(import.meta.url)), 'style-packs.json');

/** @type {Record<string, StylePack>} */
export const STYLE_PACKS = JSON.parse(readFileSync(PACKS_FILE, 'utf8'));

export const STYLE_PACK_IDS = Object.keys(STYLE_PACKS);

/** 风格包 → 供 UI/端点列出的摘要（不回内部 seed 之外的敏感项·此处全可公开）。 */
export function listStylePacks() {
  return STYLE_PACK_IDS.map((id) => {
    const p = STYLE_PACKS[id];
    return { packId: p.packId, name: p.name, palette: p.palette, provider: p.params.provider, post: p.post };
  });
}
