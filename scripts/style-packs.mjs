// 风格包库（style-packs·REQ-DEMO-T1 ②·工作流档 §四）——纯数据·闭集·工坊维护。
// 一个 packId 翻译成各家方言（万相吃中文 promptZh·Tripo/Meshy 吃英文 promptEn）；弱 LLM/用户只碰 packId。
// palette = palette-snap 后处理的靶（同款游戏全列表共用 → 天然成套）。**schema 请 PA 会审**。
// 扩包=加一条进 STYLE_PACKS（纯数据）；demo 前先调稳这 3 包。

/** @typedef {{ packId:string, name:string, promptZh:string, promptEn:string, palette:number[],
 *   negative:{zh:string,en:string}, post:{paletteSnap:boolean, pixelGrid?:number},
 *   params:{provider:'qwen'|'tripo'|'meshy', model:string, seed?:number}, refImage?:string }} StylePack */

/** @type {Record<string, StylePack>} */
export const STYLE_PACKS = {
  'neon-synthwave': {
    packId: 'neon-synthwave', name: '霓虹合成波',
    promptZh: '霓虹合成波风格，赛博朋克，深紫黑底＋品红青光晕，扫描线，80 年代复古未来，高对比霓虹描边',
    promptEn: 'neon synthwave style, cyberpunk, deep purple-black background with magenta and cyan glow, retro-futuristic 80s, high-contrast neon rim light',
    palette: [0x0d0221, 0x261447, 0x7a04eb, 0xff2a6d, 0x05d9e8, 0xd1f7ff],
    negative: { zh: '写实照片，杂乱背景，低对比，土黄', en: 'photorealistic, cluttered background, low contrast, muddy brown' },
    post: { paletteSnap: true },
    params: { provider: 'qwen', model: 'wanx2.1-t2i-turbo', seed: 1770 },
  },
  'pixel-retro': {
    packId: 'pixel-retro', name: '像素复古',
    promptZh: '16 位像素风，复古掌机调色板，硬边像素，清晰轮廓，透明底，游戏精灵图标',
    promptEn: '16-bit pixel art, retro handheld palette, hard-edged pixels, crisp silhouette, transparent background, game sprite icon',
    palette: [0x1a1c2c, 0x5d275d, 0xb13e53, 0xef7d57, 0xffcd75, 0xa7f070, 0x38b764, 0x41a6f6],
    negative: { zh: '模糊，抗锯齿，渐变噪点，写实', en: 'blurry, anti-aliased, gradient noise, photorealistic' },
    post: { paletteSnap: true, pixelGrid: 32 },
    params: { provider: 'qwen', model: 'wanx2.1-t2i-turbo', seed: 1771 },
  },
  'cartoon-thick': {
    packId: 'cartoon-thick', name: '厚描边卡通',
    promptZh: '厚描边卡通风格，明快饱和色，扁平上色，粗黑轮廓线，友好可爱，干净白底',
    promptEn: 'thick-outline cartoon style, bright saturated colors, flat shading, bold black outlines, friendly and cute, clean white background',
    palette: [0x2b2b3a, 0xffffff, 0xff6b6b, 0xffd93d, 0x6bcb77, 0x4d96ff, 0x9b5de5],
    negative: { zh: '写实，暗沉，噪点，细碎纹理', en: 'photorealistic, dark, noisy, fine cluttered texture' },
    post: { paletteSnap: true },
    params: { provider: 'qwen', model: 'wanx2.1-t2i-turbo', seed: 1772 },
  },
};

export const STYLE_PACK_IDS = Object.keys(STYLE_PACKS);

/** 风格包 → 供 UI/端点列出的摘要（不回内部 seed 之外的敏感项·此处全可公开）。 */
export function listStylePacks() {
  return STYLE_PACK_IDS.map((id) => {
    const p = STYLE_PACKS[id];
    return { packId: p.packId, name: p.name, palette: p.palette, provider: p.params.provider, post: p.post };
  });
}
