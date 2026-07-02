# 3D 美术资产处理流程 · 回顾 + 标准化现状（P3D · 2026-07-02）

> owner 2026-07-02：「专注 3D 引擎回顾，避免走太深」→「主要关注 3D 美术资产处理流程的标准化」。
> 本文 = **只盘 3D 美术资产这一条线**：现状全景 + 标准化打分 + 真缺口 + **明确的「别走深」边界**。
> 不是新实现计划——是让 owner 一眼看清「哪条路已标准、哪条还散、哪些坑不该现在挖」。

---

## 0. 一句话结论

**贴图 + 材质两条线已基本标准化（REQ-Resource ①③④ 落地后），模型线最散（手落、手估 scale、无导入/校验），
vendoring 有工具（⑤）但只覆盖"共享库→游戏本地"，没有"外部新 glb→游戏"的导入器。**
下一步若做，**只补模型线的导入标准**这一件；其余（tiling/genCollision/sound/font/Godot 式 .import 守护进程）**别碰**。

---

## 1. 一个 3D 美术资产的生命周期（当前实况）

统一五段：**获取 → 归一化/导入 → 索引(spec 元数据) → 桥接(registerAssetIndex) → 消费(渲染器)**。
每类资产走到哪一段、哪段是标准/哪段是手工，见下。

### 1.1 材质贴图（albedo / normal / roughness / ao）—— ✅ 已标准
- **获取**：三源——① 程序化自产（`scripts/gen-textures.mjs`·确定性·木板 demo）；② vendor 自共享库（`scripts/vendor-asset.mjs`·⑤）；③ 2D 导入管线（`src/assets/import/{sniff,normalize,slice}`·嗅探/归一化/切割·目前只吃位图）。
- **索引**：texture 条目 + `spec.usage`（闭集 albedo/normal/roughness/…）+ `spec.colorSpace`（**缺省按 usage 自动推**·③）。
- **桥接**：`registerAssetIndex` → `TextureDescriptor{colorSpace}`（②）。
- **消费**：`Material3D.map/normalMap/…` 或经材质资产；渲染器 `pbrMapTexture` **按槽位设色彩空间·索引显式 colorSpace 覆盖**（①③）。
- **判定**：闭集元数据 + 单一桥接 + 色彩空间自动正确（防法线图偏色经典坑）→ **标准化程度高**。

### 1.2 材质（material）—— ✅ 已标准
- **两形态**：① 内置闭集预设（`pbr-materials.ts`·11 种·Filament 实测金属值）；② 数据资产 `type:'material'`（④·引 texture key·无文件）。
- **消费**：`Material3D{preset | materialRef}` + inline 覆盖 + `surface`；`materialRef` → `buildMaterialCatalog` → `applyMaterialRef`（资源作基底·inline 覆盖）。
- **判定**：预设降级为「内置材质资源」、自定义材质=引 key 的数据、物件按 key 引用 → **标准化程度高**。

### 1.3 程序化表面细节（SurfaceDetail）—— ✅ 自成一路（但**非资产**）
- 闭集 `pattern`(bumps/noise/scratches) + 标量 → 渲染器**生成** normal/roughness（`surface-tex.ts`·零文件·确定性）。
- **注意**：它**不进索引、不是资产**，是 `Material3D` 上的 inline 渲染数据。→ 与"真实贴图资产"是**两条平行的得到 normal/roughness 的路**。这不算乱（各有场景：程序化=零美术依赖·真实图=精细），但**文档里要讲清何时用哪条**（resource-manager skill 已提，可再明确）。

### 1.4 模型（glTF/glb）—— 🔶 最散（标准化缺口在此）
- **获取**：**手工**丢进 `public/models/` + 手写 `CREDITS.md`。**无导入器/无校验**。
- **索引**：游戏本地 AssetIndex `type:'mesh'` 条目（game-z 已收编·②）。`spec.scale?/genCollision?` 已定义但——
- **消费**：`Model3D{modelKey, scale}` + `AnimState3D`（骨骼）。
- **散在哪**：
  1. **scale 手估**：fox 用 `scale:0.09` 是肉眼试出来的（模型 ~70u→盒庭尺度）。`MeshSpec.scale` 虽在 schema 里但**没接进任何消费端**（我 ②③ 时特意没接——`ModelDescriptor` 无 scale 字段、无消费者，接了是死字段）。→ 模型尺度**没有标准来源**，每个模型进来都要人肉试。
  2. **无导入/归一化**：2D 有 sniff→normalize→index，**glb 没有对应步骤**（读包围盒→建议 scale、查骨骼动画名、写索引条目、记许可）。
  3. **`genCollision` 无消费者**：定义了 none/box/hull 闭集，但没有"按 mesh 包围盒自动生成 Collider3D"的实现。

### 1.5 目录约定 —— 🔶 不统一
- 2D：`assets/<type>/<category>/<id>.<ext>`（导入器归一化）。
- 3D 模型：`public/models/`；材质贴图：`public/textures/`；vendored：`public/games/<game>/art/`。
- **三个根、无统一 3D 美术目录标准**。owner 拍板的 vendoring 模型（游戏本地库·hermetic）指向：**每游戏一个本地美术目录 + 一份本地 AssetIndex**——但模型/自产贴图目前还散在公共 `public/{models,textures}`，没落进 `public/games/<game>/art/`。

---

## 2. 标准化打分卡

| 资产类型 | 获取 | 索引/元数据 | 桥接 | 消费 | 总评 |
|---|---|---|---|---|---|
| 材质贴图 | 三源齐（自产/vendor/2D 导入） | ✅ 闭集 usage/colorSpace 自动推 | ✅ 单一 registerAssetIndex | ✅ 色彩空间正确 | **✅ 标准** |
| 材质 | 预设 + 数据资产 | ✅ MaterialSpec 闭集 | ✅ buildMaterialCatalog | ✅ materialRef/applyMaterialRef | **✅ 标准** |
| 程序化 surface | 数据即得 | —（非资产·inline） | — | ✅ surface-tex | **✅ 自洽** |
| **模型 glb** | **🔶 手落·无导入器** | 🔶 mesh 条目有·scale 无来源 | ✅ ModelDescriptor | ✅ Model3D/AnimState3D | **🔶 最散** |
| 目录约定 | — | — | — | — | **🔶 三根不统一** |

单一真相：**每游戏自持 AssetIndex + 一个分发 loader（DioramaLoader）+ registerAssetIndex**——这条组织标准 game-z 已示范，可推广为**新游戏模板**。

---

## 3. 真缺口（若要做标准化，只有这些值得）

按性价比排（**都不紧急**·当前 game-z 能跑）：

1. **模型导入标准**（补 1.4 的散）：一个 `scripts/import-model.mjs`——读 glb → 解包围盒 → **建议 scale**（归一化到目标尺度）+ 列出骨骼动画 clip 名 + 写/更新游戏本地 AssetIndex 的 mesh 条目 + 记许可。让"模型进来"从"人肉试 scale"变成"跑一下脚本得标准条目"。**（对应 2D 的 sniff→normalize·补齐 3D 的空白·真缺口）**
2. **3D 美术目录标准**（补 1.5）：定 `public/games/<game>/art/{models,textures}/` 为游戏本地 3D 美术目录标准，vendor + import-model 都往这里落；文档写清。**（约定层·低成本）**
3. **新游戏 3D 资产模板**：把"一份本地 AssetIndex + DioramaLoader + registerAssetIndex + buildMaterialCatalog"固化成模板/skill 步骤（resource-manager skill 已覆盖大半·可补模型段）。

---

## 4. 「别走深」边界（明确不做 / YAGNI）

owner 明令"避免走太深"。以下**现在不碰**，除非出现真消费者：

- ❌ **`genCollision` 自动碰撞生成**：schema 占位即可·没有"模型自动生成 Collider3D"的需求方。
- ❌ **`tiling` 消费**：TextureSpec 里有·但当前无平铺贴图消费场景（大地面走了程序化 surface·不需要平铺真图）。等真要铺平铺贴图再接。
- ❌ **sound/font 资产接入**：无消费者·音频另有 web-audio 路线。
- ❌ **Godot 式 .import 编辑器 / 重导入守护进程 / 资产热重载**：重工程·我们是构建期确定性工具流·不需要常驻编辑器。
- ❌ **模型 LOD / 网格简化 / Draco 压缩管线**：性能优化·当前盒庭规模用不上（W1 实例化已够）。
- ❌ **通用材质编辑器 UI**：材质是数据·手写/脚本产出即可·不做可视化编辑器。

**判据复诵**：这些都是"能力找需求"而非"需求找能力"。schema 里留占位字段（数据契约·弱 LLM 可填）没成本；**给没有消费者的字段写消费代码 = 过度设计**。

---

## 5. 现状锚点（代码位置）
- 索引/桥接/校验：`src/assets/asset-index.ts`（parseAssetIndex·registerAssetIndex·buildMaterialCatalog·deriveColorSpace）。
- 类型：`src/assets/asset-types.ts`（TextureDescriptor.colorSpace·ModelDescriptor）。
- 材质消费：`src/renderer/three/material.ts`（applyMaterialRef·buildPbrMaterial·pbrSig）+ `pbr-materials.ts`。
- 程序化 surface：`src/renderer/three/surface-tex.ts`。
- 模型：`src/assets/model-loader.ts` + `src/renderer/three/models.ts`（GLTFLoader/骨骼）。
- 工具：`scripts/{gen-textures,vendor-asset,import-art-pack}.mjs`。
- 技能：`.claude/skills/resource-manager/SKILL.md`。
- 契约/进度：`docs/workflow/finish/P3D-asset-layer-handoff.md`；需求 `docs/workflow/requests.md` REQ-Resource。
