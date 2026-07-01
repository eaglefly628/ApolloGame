import { ImageAssetLoader, ModelAssetLoader, type AssetManifest, type AssetLoader, type AssetDescriptor, type AssetHandle } from '@assets/index.js';

// Game Z 基础 3D 资产（glTF/glb 模型 + 真实贴图）。文件在 public/{models,textures}/——vite 从根服·src 用根绝对路径。
// 出处与许可见 public/models/CREDITS.md。蓝图只持 key（保纯·可哈希回滚）；真实字节由对应 loader 取，ThreeRenderer 解析。
export const MODEL_DUCK = 'duck';
export const MODEL_BOX = 'box';
export const MODEL_FOX = 'fox'; // 带骨骼动画（Survey/Walk/Run）·骨骼动画 demo 用
// 真实贴图（REQ-Resource ①·自产程序化生成的木板 albedo + 法线·见 scripts/gen-textures.mjs）。
export const TEX_PLANK_ALBEDO = 'tex/plank-albedo';
export const TEX_PLANK_NORMAL = 'tex/plank-normal';

export const GAME_Z_ASSETS: AssetManifest = [
  { kind: 'model', key: MODEL_DUCK, src: '/models/duck.glb' },
  { kind: 'model', key: MODEL_BOX, src: '/models/box.glb' },
  { kind: 'model', key: MODEL_FOX, src: '/models/fox.glb' },
  { kind: 'texture', key: TEX_PLANK_ALBEDO, src: '/textures/plank_albedo.png', width: 256, height: 256 },
  { kind: 'texture', key: TEX_PLANK_NORMAL, src: '/textures/plank_normal.png', width: 256, height: 256 },
];

// 分发型 loader（ModelAssetLoader 只吃 model·其注释预告的「混合游戏组合分发 loader」）：
// kind:'model' → 取字节(ArrayBuffer)；其余(texture/atlas…) → ImageAssetLoader 取图。game-z 同时要模型 + 贴图故需此。
export class DioramaLoader implements AssetLoader {
  private readonly img = new ImageAssetLoader();
  private readonly mdl = new ModelAssetLoader();
  load(d: AssetDescriptor): Promise<{ handle: AssetHandle; width: number; height: number }> {
    return d.kind === 'model' ? this.mdl.load(d) : this.img.load(d);
  }
}
