---
name: resource-manager
description: >-
  ZeroCraft 引擎「资源管理 Agent」技能——管理美术/3D 资产走统一 Asset 数据路线。用于：①从共享资产库
  vendor（copy）一个资源进某游戏的本地美术目录并登记本地索引；②给游戏新增/编辑材质数据资产
  （type:'material'·引 texture key·非硬编码预设）；③给贴图/网格条目正确填 spec 闭集元数据
  （usage/colorSpace/wrap/genCollision）。凡涉及「引擎资产库、资源目录、材质、真实贴图导入、
  把共享库素材搬进游戏本地目录」的活，用此技能。
---

# 资源管理 Agent 技能（ZeroCraft · REQ-Resource ④⑤）

ZeroCraft 是**数据驱动 + lockstep 确定性** ECS 引擎。资产（贴图/模型/材质）是 **render-only 表现层**——
sim 只持字符串 key（可哈希、可回滚），真实字节/材质只在资产层，怎么变都不威胁确定性。

**动手前必读**：`docs/design/data-driven-manifesto.md`（宪法）+ `docs/design/asset-pipeline-review.md`（资产管线 review）。
尺子：一切资产配置必须是**闭集数据**（最弱的 LLM 也只能在枚举里选、填 key，不能写自由代码）。

---

## 架构：共享库 vs 游戏本地库（owner 2026-07-01 拍板 · vendoring 模型）

- **共享资产库** = `assets/index.json`（~3 万项 devicon/立绘等货架）。它是**被引用/被 copy 的源**，
  **游戏运行时不直接引它**。
- **游戏本地库** = 每游戏自持一份 `AssetIndex`（TS 内联如 `games/game-z/assets.ts` 的 `GAME_Z_INDEX`，
  或本地 JSON `public/games/<game>/art/index.json`）。游戏**只引自己的本地索引**，保持本地目录 hermetic。
- **要用共享库的资源** → 用 §1 的 vendor 工具 **copy 进游戏本地美术目录**，本地索引引这份拷贝。
  绝不让游戏直接引共享库条目，也绝不把游戏专属资产并进共享 `assets/index.json`。

引擎侧统一入口：`registerAssetIndex(manager, parseAssetIndex(index), baseUrl)` 桥接
`texture`(→Texture/Atlas/SpriteSheet) 与 `mesh`(→Model)；`material` 走 `buildMaterialCatalog`。
详见 `src/assets/asset-index.ts`。

---

## 1. Vendor：共享库资源 → 游戏本地美术目录（REQ-Resource ⑤）

用现成脚本，**不要手抄文件**（脚本保证确定性 + 元数据不丢 + 幂等）：

```bash
node scripts/vendor-asset.mjs <shared-asset-id> <game> [--as <local-id>]
# 例：node scripts/vendor-asset.mjs devicon/aarch64-original game-z --as tex/chip
```

它会：
1. 从 `assets/index.json` 定位该 filled 条目，把源文件 copy 进 `public/games/<game>/art/<镜像子路径>`；
2. upsert 进 `public/games/<game>/art/index.json`（本地 `AssetIndex`·站点绝对路径），
   **携带 `spec`(usage/colorSpace 等) + license/source/style/tags/provenance**，并记 `provenance.vendoredFrom`。

游戏侧消费本地索引（baseUrl `''`，因 path 已是站点绝对路径）：

```ts
import localIndex from './art/index.json'; // 或 fetch
registerAssetIndex(assets, parseAssetIndex(localIndex));
```

自检：`games/game-z/vendor.test.ts` 证明 vendor 产物可被统一 Asset 路线消费。

---

## 2. 材质数据资产：`type:'material'`（REQ-Resource ④）

材质 = **引 texture key 的数据资产**（预设降级为「内置材质资源」）。物件不再内联硬编码 preset+贴图，
而是 `Material3D{ materialRef }` 引一个材质资源。

**加一个材质**（进游戏的 `AssetIndex`）：material 是数据型资产，**无文件、免 path**，数据全在 `spec`：

```ts
{ id: 'mat/plank-wood', type: 'material', status: 'filled',
  description: '木板材质',
  spec: { preset: 'wood', map: 'tex/plank-albedo', normalMap: 'tex/plank-normal' } }
```

`MaterialSpec` 闭集字段：`preset?`(内置预设名·见 `src/assets/pbr-materials.ts`) + `color?/roughness?/metalness?/emissive?`(数值覆盖) + `map?/normalMap?/roughnessMap?/aoMap?`(= texture 资产 id)。

**接线**：`const materials = buildMaterialCatalog(GAME_INDEX)` → `new ThreeRenderer({ assets, materials })`。

**引用**：物件 `Material3D: { preset: 'matte', materialRef: 'mat/plank-wood' }`。
渲染器据 `materialRef` 查目录合成有效材质（材质资源作基底，物件 inline 字段覆盖——见
`renderer/three/material.applyMaterialRef`）。参考现成 demo：`games/game-z/diorama.ts` 的 `plank-crate`。

---

## 3. 贴图/网格 spec 闭集元数据（REQ-Resource ③）

`parseAssetIndex` 注册期校验这些闭集枚举，填错**构建期直接抛错**：

- **texture `spec`**：`usage`∈`albedo|normal|roughness|metalness|ao|orm|emissive|sprite`；
  `colorSpace`∈`srgb|linear`（**省略则按 usage 自动推**：颜色类→srgb·数据类→linear——法线/粗糙图**必须线性**，
  设错会渲染偏色）；`wrap`∈`clamp|repeat`；`tiling`(数值)。
- **mesh `spec`**：`scale`(数值)；`genCollision`∈`none|box|hull`。

真实贴图物件直接引 texture key 也行（不必经材质资源）：`Material3D{ map, normalMap, roughnessMap, aoMap }`——
渲染器按每张贴图的 `spec.colorSpace`（缺省按槽位）取图。

---

## 边界 / 纪律（务必守）

- **红线**：① 资产 render-only·sim 只持 key 不进 hash；② 所有导入选项/材质/贴图用途**全是闭集数据**，
  绝不开自由代码/自由 CSS 口子；③ 增量·向后兼容（旧无 usage/colorSpace 的 texture 条目视作 sprite/srgb）。
- **命名**：别引入新 `Resource` 类型（撞 sim `Resource` 组件 hp/mana）——统一用 `Asset*`。
- **代码归属**：`src/assets/**` 是引擎核心（跨 2D/3D）→ 跨界改动**合并前 Lead review**；
  `src/renderer/three/**` + `games/game-z/**` 是 P3D 域。3D 资产需求进 `docs/workflow/requests-3d.md`。
- **门禁**：改完 `tsc + vitest + build` 全绿才提交。

## 现有实现锚点
- `src/assets/asset-index.ts`：`parseAssetIndex`(校验) · `registerAssetIndex`(桥接) · `buildMaterialCatalog` · `deriveColorSpace`/`textureSpecOf`。
- `src/assets/asset-types.ts`：`TextureDescriptor.colorSpace` · `ModelDescriptor`。
- `src/renderer/three/material.ts`：`applyMaterialRef` · `buildPbrMaterial`(挂真实贴图) · `pbrSig`。
- `scripts/vendor-asset.mjs`：vendoring 工具。
- 契约/进度：`docs/workflow/finish/P3D-asset-layer-handoff.md`。
