import type { AssetManifest } from '@assets/index.js';

// Game Z 基础 3D 模型资产（glTF/glb）。文件在 public/models/——vite 在 dev / build / preview 都从根服，
// 故 src 用根绝对路径 '/models/...'（base='/'）。出处与许可见 public/models/CREDITS.md。
// 蓝图只持 modelKey（保纯·可哈希回滚）；真实模型字节由 ModelAssetLoader 取成 ArrayBuffer，ThreeRenderer 解析。
export const MODEL_DUCK = 'duck';
export const MODEL_BOX = 'box';

export const GAME_Z_ASSETS: AssetManifest = [
  { kind: 'model', key: MODEL_DUCK, src: '/models/duck.glb' },
  { kind: 'model', key: MODEL_BOX, src: '/models/box.glb' },
];
