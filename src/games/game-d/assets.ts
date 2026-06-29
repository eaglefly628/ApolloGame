import type { AssetManifest } from '@assets/index.js';

// Game D ·《骰途》基础 3D 模型资产（glTF/glb）。文件在 public/models/（vite 根服·src 用根绝对路径）。
// 骰途世界主体用贴色体素(Mesh3D)拼；模型仅作 showcase（证明导入能力·小黄鸭沿用 game-z 先例）。
// 蓝图只持 modelKey（保纯）；真实字节由 ModelAssetLoader 取成 ArrayBuffer，ThreeRenderer 解析。
export const MODEL_DUCK = 'duck';

export const GAME_D_ASSETS: AssetManifest = [
  { kind: 'model', key: MODEL_DUCK, src: '/models/duck.glb' },
];
