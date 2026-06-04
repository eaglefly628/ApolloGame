// 资产(美术)系统 —— 表现层，活在确定性 sim 之外。
// sim 只持有 textureKey；这里把 key → 已加载资产 + 子矩形，交给渲染后端绘制。
export type {
  Rect,
  TextureDescriptor,
  AtlasDescriptor,
  SpriteSheetDescriptor,
  PrerenderedSequenceDescriptor,
  AssetDescriptor,
  AssetManifest,
  AssetHandle,
  LoadedAsset,
  ResolvedFrame,
  FrameRef,
  AssetLoader,
} from './asset-types.js';
export { AssetManager, StubAssetLoader } from './asset-manager.js';
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
} from './asset-index.js';
