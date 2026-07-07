// game-i · 贴图 UI 资产（贴图按钮皮 sample「入库」·owner 2026-07-07）。
//
// 走**统一 Asset 数据路线**（资产手册 §6）：贴图皮 = 登记进本地索引的正规资产，游戏侧按 **key** 引用，
// 解析成站点绝对 URL 后喂 `Button.skin`（已解析 URL·同 Image.src 约定）。**不再内联 data-URI 硬编码**（旧 sample 的临时凑合）。
// 真相文件：`public/games/game-i/art/index.json`（同一份·供站点服务 + vendor 自检测试）；此处 inline 一份供构建期消费。
import { parseAssetIndex, type AssetIndex } from '@assets/index.js';

export const SKIN_METAL = 'tex/skin-metal';
export const SKIN_WOOD = 'tex/skin-wood';
export const SKIN_STONE = 'tex/skin-stone';
export const SKIN_SCROLL = 'tex/skin-scroll';

/** game-i 本地贴图 UI 索引（与 public/games/game-i/art/index.json 同源·闭集 spec 校验通过）。 */
export const GAME_I_UI_INDEX: AssetIndex = parseAssetIndex({
  version: 1,
  assets: [
    { id: SKIN_METAL, type: 'texture', status: 'filled', path: '/games/game-i/art/textures/skin-metal.svg', description: '金属铆钉板按钮皮', spec: { usage: 'sprite', width: 220, height: 88 }, category: 'ui.button-skin', license: 'CC0', source: 'src/games/game-i (自产)' },
    { id: SKIN_WOOD, type: 'texture', status: 'filled', path: '/games/game-i/art/textures/skin-wood.svg', description: '木纹板按钮皮', spec: { usage: 'sprite', width: 220, height: 88 }, category: 'ui.button-skin', license: 'CC0', source: 'src/games/game-i (自产)' },
    { id: SKIN_STONE, type: 'texture', status: 'filled', path: '/games/game-i/art/textures/skin-stone.svg', description: '花岗岩石纹按钮皮', spec: { usage: 'sprite', width: 220, height: 88 }, category: 'ui.button-skin', license: 'CC0', source: 'src/games/game-i (自产)' },
    { id: SKIN_SCROLL, type: 'texture', status: 'filled', path: '/games/game-i/art/textures/skin-scroll.svg', description: '卷轴羊皮按钮皮', spec: { usage: 'sprite', width: 220, height: 88 }, category: 'ui.button-skin', license: 'CC0', source: 'src/games/game-i (自产)' },
  ],
});

// key → 站点绝对 URL 映射（path 已是绝对路径·baseUrl ''）。这就是 DOM UI 侧的 resolveAsset：sim/数据持 key，渲染前解析成 URL。
const URL_BY_ID = new Map(GAME_I_UI_INDEX.assets.map((a) => [a.id, a.path ?? '']));

/** 贴图皮资产 key → 已解析 URL（喂 Button.skin）。未登记/未 filled → 空串（fail-soft·渲染层退化无皮·不炸）。 */
export function uiTextureUrl(id: string): string {
  return URL_BY_ID.get(id) ?? '';
}
