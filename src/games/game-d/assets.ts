import { parseAssetIndex, type AssetIndex, type AssetManifest } from '@assets/index.js';

// Game D ·《骰途》基础 3D 模型资产（glTF/glb）。文件在 public/models/（vite 根服·src 用根绝对路径）。
// 骰途世界主体用贴色体素(Mesh3D)拼；模型仅作 showcase（证明导入能力·小黄鸭沿用 game-z 先例）。
// 蓝图只持 modelKey（保纯）；真实字节由 ModelAssetLoader 取成 ArrayBuffer，ThreeRenderer 解析。
export const MODEL_DUCK = 'duck';

export const GAME_D_ASSETS: AssetManifest = [
  { kind: 'model', key: MODEL_DUCK, src: '/models/duck.glb' },
];

// ── 2D 美术资产索引（统一 Asset 数据路线·REQ-Resource 本地库 vendoring 模型）─────────────────
// game-d 自持一份本地 AssetIndex（同 src/games/game-z/assets.ts 的 GAME_Z_INDEX 先例）：把 2D 图登记进
// 单一真相·填 spec 闭集元数据（usage/colorSpace）+ provenance.vendoredFrom 溯源到 Cloud Design 交付源。
// parseAssetIndex 在模块加载期校验 spec 闭集枚举（usage/colorSpace）→ 填错构建期即抛（早失败）。
// 2D UI 的 LayoutNode Image 直接加载条目 path（站点绝对 URL·vite 服 public 于根故无需 baseUrl）；
// URL 由此登记经 artUrl() 派生 → art.ts 不再硬编码 `/art/game-d/...` 路径（资产线红线）。
//
// 本批 = 元素法阵图标 6 张（战场左侧法阵环·火/水/木/雷/风/暗·对齐设计稿图标版·非汉字版）。
// TODO(后续·game-d 2D art 全量迁资产线)：其余 2D 图（dice/sky/tiles/cards/fx）仍走 art.ts 硬编码路径·后续同迁本索引。
const ELEMENT_RUNES: ReadonlyArray<{ readonly key: string; readonly zh: string; readonly label: string }> = [
  { key: 'huo', zh: '火', label: '火焰' },
  { key: 'shui', zh: '水', label: '水波' },
  { key: 'mu', zh: '木', label: '叶' },
  { key: 'lei', zh: '雷', label: '闪电' },
  { key: 'feng', zh: '风', label: '风纹' },
  { key: 'an', zh: '暗', label: '暗珠' },
];

export const GAME_D_INDEX: AssetIndex = parseAssetIndex({
  version: 1,
  assets: ELEMENT_RUNES.map(({ key, zh, label }) => ({
    id: `rune/${key}`,
    type: 'texture',
    status: 'filled',
    path: `/art/game-d/element-runes/${key}.png`,
    description: `元素法阵图标·${label}`,
    // 闭集 spec：UI 图标 = sprite·颜色贴图 = srgb（法线/粗糙/AO 类才 linear·此处均无）。
    spec: { usage: 'sprite', colorSpace: 'srgb' },
    category: 'icon.ui',
    tags: ['game-d', 'element-rune', key],
    source: 'Cloud Design（骰途委托设计源）',
    license: 'proprietary',
    style: 'cartoon.ink',
    provenance: {
      vendoredFrom: `src/games/game-d/doc/refartist/骰途-美术素材/element-runes/法阵_${zh}.png`,
      note: 'Cloud Design 交付的骰途元素法阵设计源·cp 进 public/art 由 vite 服务',
    },
  })),
});

// id → 站点绝对 URL：从已登记索引派生·供 2D UI（LayoutNode Image src）消费。
const ART_URL_BY_ID = new Map<string, string>(
  GAME_D_INDEX.assets.filter((a) => a.path).map((a) => [a.id, a.path as string]),
);

/**
 * 从已登记的资产索引派生站点绝对 URL（LayoutNode Image src 可直接加载）。
 * URL 是登记的单一真相·非游戏层硬编码；未登记 id 即抛错（杜绝 key 漂移 / 静默坏图）。
 */
export function artUrl(id: string): string {
  const url = ART_URL_BY_ID.get(id);
  if (url === undefined) throw new Error(`game-d: 资产未登记 "${id}"（见 GAME_D_INDEX）`);
  return url;
}
