import { ImageAssetLoader, ModelAssetLoader, parseAssetIndex, buildMaterialCatalog, type AssetIndex, type AssetLoader, type AssetDescriptor, type AssetHandle } from '@assets/index.js';

// Game Z 基础 3D 资产（glTF/glb 模型 + 真实贴图）。文件在 public/{models,textures}/——vite 从根服·path 用站点绝对路径故 baseUrl=''。
// 出处与许可见 public/models/CREDITS.md。蓝图只持 key（保纯·可哈希回滚）；真实字节由对应 loader 取，ThreeRenderer 解析。
export const MODEL_DUCK = 'duck';
export const MODEL_BOX = 'box';
export const MODEL_FOX = 'fox'; // 带骨骼动画（Survey/Walk/Run）·骨骼动画 demo 用
// 真实贴图（REQ-Resource ①·自产程序化生成的木板 albedo + 法线·见 scripts/gen-textures.mjs）。
export const TEX_PLANK_ALBEDO = 'tex/plank-albedo';
export const TEX_PLANK_NORMAL = 'tex/plank-normal';
// 材质数据资产（REQ-Resource ④·type:'material'·引上面两张 texture key·物件用 materialRef 引它·非硬编码预设）。
export const MAT_PLANK_WOOD = 'mat/plank-wood';
// 石材质（花岗岩灰·rock 预设）：场景多处复用（石墩 + 素石柱）→ 一处改色·全场景生效（材质数据资产复用示范）。
export const MAT_STONE = 'mat/stone';

// REQ-Resource ②：模型 + 贴图统一走 **AssetIndex 路线**（registerAssetIndex 桥接·不再散调 registerManifest）。
// 条目带 type/status/spec.usage → 桥接时 mesh→ModelDescriptor·texture→TextureDescriptor（colorSpace 按 usage 派生：
// albedo→sRGB·normal→linear）。溯源/许可入条目（统一检索）。path 是站点绝对路径（public/ 下）→ baseUrl ''。
// 注：游戏专属 3D 资产在此自持一份索引数据（非并入 ~3 万项的共享 assets/index.json——游戏资产 ≠ 共享货架·
// 且模型物理在 /models 非 /assets 树）；走的仍是同一套统一 registerAssetIndex 桥接路径。
export const GAME_Z_INDEX: AssetIndex = parseAssetIndex({
  version: 1,
  assets: [
    { id: MODEL_DUCK, type: 'mesh', status: 'filled', path: '/models/duck.glb', description: '鸭子模型', source: 'public/models/CREDITS.md' },
    { id: MODEL_BOX, type: 'mesh', status: 'filled', path: '/models/box.glb', description: '箱子模型', source: 'public/models/CREDITS.md' },
    { id: MODEL_FOX, type: 'mesh', status: 'filled', path: '/models/fox.glb', description: '狐狸模型（骨骼动画 Survey/Walk/Run）', source: 'public/models/CREDITS.md' },
    { id: TEX_PLANK_ALBEDO, type: 'texture', status: 'filled', path: '/textures/plank_albedo.png', description: '木板反照率贴图（程序化自产）', spec: { usage: 'albedo', width: 256, height: 256 }, source: 'scripts/gen-textures.mjs' },
    { id: TEX_PLANK_NORMAL, type: 'texture', status: 'filled', path: '/textures/plank_normal.png', description: '木板法线贴图（程序化自产）', spec: { usage: 'normal', width: 256, height: 256 }, source: 'scripts/gen-textures.mjs' },
    // 材质数据资产（REQ-Resource ④）：无文件·数据全在 spec·引上面两张 texture key。物件 Material3D{materialRef} 引它。
    { id: MAT_PLANK_WOOD, type: 'material', status: 'filled', description: '木板材质（wood 预设 + 木板 albedo/法线贴图）', spec: { preset: 'wood', map: TEX_PLANK_ALBEDO, normalMap: TEX_PLANK_NORMAL } },
    { id: MAT_STONE, type: 'material', status: 'filled', description: '石材质（花岗岩灰·rock 预设·场景复用）', spec: { preset: 'rock', color: 0x8b8178 } },
  ],
});

// 材质资源目录（REQ-Resource ④）：从索引提取 type:'material' → id→MaterialSpec，传给 ThreeRenderer 供 materialRef 查。
export const GAME_Z_MATERIALS = buildMaterialCatalog(GAME_Z_INDEX);

// 分发型 loader（ModelAssetLoader 只吃 model·其注释预告的「混合游戏组合分发 loader」）：
// kind:'model' → 取字节(ArrayBuffer)；其余(texture/atlas…) → ImageAssetLoader 取图。game-z 同时要模型 + 贴图故需此。
export class DioramaLoader implements AssetLoader {
  private readonly img = new ImageAssetLoader();
  private readonly mdl = new ModelAssetLoader();
  load(d: AssetDescriptor): Promise<{ handle: AssetHandle; width: number; height: number }> {
    return d.kind === 'model' ? this.mdl.load(d) : this.img.load(d);
  }
}
