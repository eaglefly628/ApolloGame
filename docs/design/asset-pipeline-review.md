# 资产导入管线 · Review + 改进提案（借鉴 Godot）

> owner 2026-06-30 要求：好好 review 引擎的资产导入管线，从每一种数据说起，评估是否该建一套更好的**资产管理库 + 导入管线**处理美术资产，借鉴 Godot。
> 本文由 P3D 汇编。**边界声明**：`src/assets/**` 是**引擎级、跨 2D/3D 的资产层（🔒 主程域）**——本文是 **review + 提案**，engine-wide 改动交 **主程/Lead 裁决**；P3D 只独占「3D 消费端」（渲染器把 key 解析成 three 贴图/材质）。**先不写代码，先对齐方向。**

---

## 0. TL;DR（结论先行）

- **我们其实已经有一套相当不错的 2D 图片导入管线**（sniff 格式→去重→归一化 id→分类→写 `assets/index.json`，带溯源 provenance）——这块已经很 Godot-like，别推倒重来。
- **真正的缺口不在"有没有管线"，而在"管线只打通了 2D texture 一种数据"**：
  - `registerAssetIndex` 运行时**只桥接 `texture` 类型**（`asset-index.ts:152`）；`mesh/material/sound/animation/font/video` 在索引里登记了却**没接进运行时**。
  - **3D 模型走的是另一条路**：各游戏**手写 manifest**（`registerManifest(GAME_Z_ASSETS)`）直接塞进 AssetManager，**绕过 index.json 管线**。→ 两条平行路径，3D 没进统一索引。
  - **PBR 材质 + 材质贴图（albedo/normal/roughness）完全没有管线**：材质是 `pbr-materials.ts` 里**写死的预设**；贴图没有「这是某材质的法线图」这个概念。**这正是 owner 卡住的"真实贴图美术管线"。**
- **该做**：不是新建一套，而是**把现有 index/import 管线从"2D texture 单打"扩成"每种数据一等公民"**，并**加一层 Godot 式的"每资产导入描述"（import options 作数据）**。分 3 期，第 1 期就解 owner 的贴图需求。

---

## 1. 现状架构（三层 + 两条平行路径）

```
                 ┌─────────────────────────────────────────────┐
  美术源文件 ──▶ │ 导入管线 import/*  (纯函数·可单测)            │
 (png/jpg/…)     │  sniff(嗅探格式/尺寸/alpha) → planImport      │
                 │  (hash 去重·变体拆分·slug id·分类规则·冲突改名)│
                 │  → planEntries → AssetIndexEntry             │
                 └───────────────┬─────────────────────────────┘
                                 ▼ 写
                 ┌─────────────────────────────────────────────┐
   路径A(索引)   │ assets/index.json  (AssetIndexEntry[])       │  ← raw 存储层单一真相
                 │  id/type/status/path/spec/category/tags/     │
                 │  source/license/style/provenance             │
                 └───────────────┬─────────────────────────────┘
                                 ▼ registerAssetIndex（**只桥 texture**）
                 ┌─────────────────────────────────────────────┐
                 │ AssetManager（register/load/resolve/get）     │
   路径B(手写)   │  ▲ registerManifest(GAME_*_ASSETS)  ← 3D 模型走这里·绕过索引
                 │  loader: Image/Model/Stub（I/O 可插拔）        │
                 └───────────────┬─────────────────────────────┘
                                 ▼ get(key)/resolve(key,frame)
                    渲染器（Canvas / Three）按 key 取句柄绘制
       library.ts / artlib.ts = 资源库浏览/检索模型（三来源适配·给编辑器/搜索用·不在运行时热路径）
```

**红线（保持）**：sim/蓝图只持 `key`（可哈希/回滚）；真实像素/字节只在资产层；AssetManager 不碰 world/hash。这条**已经很对**，任何改进都要守住。

---

## 2. 逐数据类型现状（owner 要的「从每一种数据说起」）

| 数据类型 | 索引类型 | 导入管线 | 运行时桥接 | 状态 | 缺口 |
|---|---|---|---|---|---|
| **2D 贴图 texture**（整图/atlas/sprite-sheet） | `texture` | ✅ 全（sniff→plan→index，含 atlas frames / sheet 网格 spec） | ✅ `registerAssetIndex` 建 Texture/Atlas/SpriteSheet 描述符 | **成熟** | — |
| **3D 模型 mesh**（glTF/glb） | `mesh` | ❌ 无（手写 manifest：src+key） | ⚠️ **绕过索引**·各游戏 `registerManifest` → ModelPool 解析 | **能用但游离** | 没进统一索引/无溯源/无导入配置（scale/动画/生成碰撞） |
| **PBR 材质 material** | `material` | ❌ 无 | ❌ 写死在 `pbr-materials.ts` 预设 | **硬编码** | 材质不是资产·不能被库管理/检索/覆盖 |
| **材质贴图**（albedo/normal/roughness/ORM） | (归 `texture`) | ❌ 无「用途/色彩空间」概念 | ❌ 无（Material3D 无 map 字段） | **缺失** | **owner 卡住的"真实贴图"就在这**·无 colorSpace(线性 vs sRGB)·无 map 用途 |
| **音效 sound** | `sound` | ❌ | ❌ 索引登记·无运行时 | 占位 | 待玩法要 |
| **命名动画 animation** | `animation` | 部分（AnimationDescriptor 手注册） | ⚠️ 手注册·不经索引 | 半接 | 骨骼动画 clip（AnimState3D）与此无关·各走各 |
| **字体 font / 视频 video** | `font`/`video` | ❌ | ❌ | 占位 | 待需要 |

**一句话**：**texture 是唯一端到端打通的类型**；其余要么绕过索引（mesh）、要么硬编码（material）、要么完全缺失（材质贴图）、要么占位（sound/font/video）。

---

## 3. Godot 的资产管线（值得借鉴的点）

Godot 4.x 的**非破坏式导入**：
1. **源文件不动**；每个源旁生成 `<asset>.import` **sidecar**（记：用哪个 ResourceImporter、输出类型、**类型专属参数**、缓存路径）。
2. **ResourceImporter 按类型**：texture（压缩模式/是否法线图/mipmap/sRGB-vs-线性）、scene（glTF：材质/骨架/动画/生成碰撞/LOD）、audio、font…；每类有**预设 + 每资产覆盖**。
3. **改源或改 import 设置 → 自动重导**；缓存进 `.godot/imported/`（sidecar 进版本库·缓存可重建）。
4. 导入产物是**引擎原生 Resource**，运行时按引用取（引用计数共享）。

**对我们最关键的三点**：
- **A. 每资产的"导入描述"是数据**（sidecar）——尤其**类型专属选项**（texture 的 sRGB/normal-map/压缩·glTF 的 scale/动画）。我们的 `AssetIndexEntry.spec` 已是雏形，但没有类型专属 import options 的规范。
- **B. 统一索引桥接所有类型**（不是只 texture）——Godot 所有资产走同一 import→resource 流。
- **C. 贴图的"用途 + 色彩空间"**是一等信息（法线图必须线性·albedo 必须 sRGB）——这正是我们做真实贴图**必须先有**的。

**别借**：Godot 的 `.import` 是编辑器耦合 + C++ ResourceImporter；我们没有编辑器、是构建期 + 数据驱动。所以**借"每资产导入描述作数据"这个概念，不借它的实现**。

---

## 4. 提案：把现有管线扩成「每种数据一等公民」+ 导入描述作数据

**设计不变量**（守住）：① 一切 key 化（弱 LLM 只引 key）；② 导入选项是**数据**（弱 LLM 也能填 `colorSpace:'srgb'`）；③ sim 只持 key·render-only 消费真实字节；④ 增量·向后兼容（现有 texture 路径不动）。

### 4.1 `AssetIndexEntry.spec` 规范化「类型专属 import options」（= Godot sidecar 概念·作数据）
每类型定义闭集 spec（进 index.json·弱 LLM 可填）：
- **texture**：`{ usage: 'albedo'|'normal'|'roughness'|'metalness'|'orm'|'sprite', colorSpace: 'srgb'|'linear', wrap?, tiling? }`（法线/粗糙=linear·albedo/sprite=srgb·**这就是真实贴图的关键元数据**）；atlas frames / sheet 网格保持。
- **mesh**：`{ scale?, animations?: string[], genCollision?: 'box'|'hull'|'none' }`。
- **material**：`{ preset?, color?, roughness?, metalness?, map?, normalMap?, roughnessMap?, surface? }`（**材质变成引 texture key 的数据资产**·取代写死预设或让预设成"内置材质资源"）。

### 4.2 `registerAssetIndex` 桥接**所有**类型（不只 texture）
- `texture` → 现状（+按 usage/colorSpace 建 THREE.Texture 正确色彩空间）。
- `mesh` → ModelPool（**把手写 manifest 收编进索引**·各游戏不再 `registerManifest` 散注册）。
- `material` → 解析成 Material3D 数据（引 texture key 的贴图）。
- `sound/font` → 各自 loader（按需）。
> 收编后**一条索引 = 单一真相**·mesh 也有溯源/许可/检索（现在 fox.glb 只在 CREDITS.md）。

### 4.3 3D 消费端（**P3D 域·可先落**）：材质贴图
- `Material3D` 加 `map?/normalMap?/roughnessMap?/aoMap?`（= texture asset key）。
- 渲染器 `buildPbrMaterial` 据 key 从 AssetManager 取 THREE.Texture·**按 spec.colorSpace 设 sRGB/线性**（法线图错设 sRGB 会渲染错·这是必须的）·挂到材质。
- **这直接解 owner 的"真实贴图"**：美术库放贴图（配 usage/colorSpace 数据）→ 物件 `Material3D{ map:'tex/wood_albedo', normalMap:'tex/wood_normal' }`。与现有**程序化 surface** 并存（有 map 用图·无则程序化/纯色）。

### 4.4 导入器扩类型（构建期·可后置）
- import 管线现只吃图片；扩到吃 `.glb`（sniff glTF·读 animations/尺寸→写 mesh 条目）、贴图按目录/命名猜 usage（`*_normal`→normal/linear）。**非阻塞·先手写 spec 也行。**

---

## 5. 分期落地（建议顺序·各自可独立交付）

- **第 1 期（解 owner 当前需求·P3D 域可先动）**：**材质贴图消费端**——`Material3D.map/normalMap/roughnessMap` + 渲染器按 key + colorSpace 取贴图。先手工在 game-z 资产清单加一两张贴图（配 usage/colorSpace）验证。**这一步不碰引擎级索引·纯 3D 渲染线 + 美术库数据·我 P3D 能独立做。**
- **第 2 期（主程域·收编）**：`registerAssetIndex` 桥接 `mesh`（+material），把各游戏手写 manifest 收进 index.json（模型也进统一索引/溯源）。
- **第 3 期（主程域·规范）**：`spec` 类型专属 import options 定为闭集 schema + 校验；导入器扩 `.glb`/贴图 usage 自动猜。
- **第 4 期（按需）**：材质成索引资产（取代硬编码预设 / 预设降为内置材质资源）；sound/font 接入。

---

## 6. 建议

1. **不推倒重来**——现有 2D texture 管线 + index.json + provenance + library 浏览器是好底子，方向对。
2. **先做第 1 期（材质贴图消费端）**：这是 owner 反复卡的"真实贴图"，且**落在 P3D 域我能独立交付**，风险低、见效快。**建议我先做这个。**
3. **第 2/3 期是引擎级（主程域）**：把"只桥 texture"扩成"桥所有类型" + 导入描述规范化——**这需要主程/Lead 拍板**（跨 2D/3D·动 `src/assets` 核心）。我把本文 + 提案交上去，owner 裁决要不要我跨界做（同之前资产层授权先例）或派主程。

> **复诵红线**：资产是 render-only 表现层（sim 只持 key）；导入选项/材质/贴图用途全是**数据**（弱 LLM 尺子）；改进只在这两条之内扩，不在核心开自由代码口子。
