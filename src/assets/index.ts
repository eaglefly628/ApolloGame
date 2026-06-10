// 资产(美术)系统 —— 表现层，活在确定性 sim 之外。
// sim 只持有 textureKey；这里把 key → 已加载资产 + 子矩形，交给渲染后端绘制。
export type {
  Rect,
  TextureDescriptor,
  AtlasDescriptor,
  SpriteSheetDescriptor,
  PrerenderedSequenceDescriptor,
  AssetDescriptor,
  AnimationDescriptor,
  AssetManifest,
  AssetHandle,
  LoadedAsset,
  ResolvedFrame,
  FrameRef,
  AssetLoader,
} from './asset-types.js';
export { AssetManager, StubAssetLoader } from './asset-manager.js';
export { ftpFrames, ftpToAtlasEntry, mergeAtlasIntoIndex, normalizeFrameName, type FtpAtlasJson } from './pack-atlas.js';
export { ImageAssetLoader, isImageHandle, type ImageAssetHandle } from './image-loader.js';
export {
  parseAssetIndex,
  pendingAssets,
  filledAssets,
  registerAssetIndex,
  ASSET_TYPES,
  type AssetType,
  type AssetStatus,
  type AssetIndexEntry,
  type AssetIndex,
  type SheetSpec,
} from './asset-index.js';
// 资源库统一模型（浏览器/搜索用；三来源适配成一种记录）
export {
  LIBRARY_TAXONOMY,
  taxonomyOf,
  categoryLabel,
  inferCategory,
  projectRecords,
  artlibRecords,
  manifestRecords,
  queryLibrary,
  libraryCounts,
  type LibraryRecord,
  type LibrarySource,
  type LibraryStatus,
  type LibraryQuery,
  type LibraryTypeDef,
  type LibraryCategoryDef,
} from './library.js';
// 导入器纯核心（嗅探/归一化/切割；UI 与写盘在外层）
export { sniffImage, fnv1a, type ImageInfo, type ImageFormat } from './import/sniff.js';
export { DEFAULT_PROFILE, type NormalizationProfile, type CategoryRule } from './import/profile.js';
export {
  planImport,
  planEntries,
  slugify,
  splitVariant,
  categoryFor,
  type ImportFile,
  type ImportPlan,
  type PlanRow,
  type PlanAction,
} from './import/normalize.js';
export { gridDims, gridCells, sheetSpec, atlasFrames, type GridParams } from './import/slice.js';
