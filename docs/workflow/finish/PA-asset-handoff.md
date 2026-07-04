# P3D → PA · 资产层 / Resource Manager custody 移交

> **移交（owner 2026-07-04 拍板：申请新 PA 接手）。** 出让方 = P3D（我在 owner 授权下**跨界**把统一 Asset 层从零搭到可用）；
> 接手方 = 新 **PA（资产管理员）**。本文 = 交接实况（现状 + 待办 + 边界 + 锚点），PA 开工先读本文再读 `roles/PA.md` 必读三件。
> **为什么移交**：`src/assets` 本是引擎核心、我只是 owner 特批跨界落 REQ-Resource；现有专职 PA + `asset-manager` agent → 该由 PA 常驻守护，P3D 退回渲染线本位。

---

## 0. 你（PA）接手了什么（一句话）

一套**统一 Asset 数据路线**：texture/mesh/material 走同一 `AssetIndex` + `registerAssetIndex` 桥接 + key 引用消费；
材质=引 texture key 的**数据资产**；贴图 spec 闭集元数据（usage/colorSpace 自动推）；共享库→游戏本地 **vendoring** 工具。
主体操作法在 **`.claude/agents/asset-manager.md` + `resource-manager` 技能**（你的两大件·已就位）。

## 1. 已建成并推送（REQ-Resource ①–⑤ + REQ-3D④ 资产侧·全绿在主干）

| 件 | 内容 | 锚点 | 备注 |
|---|---|---|---|
| **①** 材质贴图消费端 | `Material3D.map/normalMap/roughnessMap/aoMap`(=texture key) + 渲染器按 colorSpace 取图 | `renderer/three/material.ts`·`three-renderer.ts` | 消费端（render-only·P3D 域）·已定稿 |
| **②** 桥接 mesh + colorSpace | `registerAssetIndex` 桥 `mesh→ModelDescriptor`·`TextureDescriptor.colorSpace` 派生 | `assets/asset-index.ts`·`asset-types.ts` | **跨界·待 Lead review 定稿** |
| **③** spec 闭集 schema | `TextureSpec/MeshSpec/MaterialSpec` + `validateSpec` 注册期抛错 + `deriveColorSpace` | `assets/asset-index.ts` | **跨界·待 review**·向后兼容（旧 index.json 自检绿） |
| **④** 材质成数据资产 | `type:'material'` 免 path·`buildMaterialCatalog`·`Material3D.materialRef`·`applyMaterialRef` | `assets/asset-index.ts`·`renderer/three/material.ts` | 消费端 render-only；catalog=资产侧 |
| **⑤** vendoring 工具 | 共享库→游戏本地目录 copy + upsert 本地 `AssetIndex`（携 spec/license/provenance+vendoredFrom） | `scripts/vendor-asset.mjs` | 确定性·幂等·零网络·自检 `game-z/vendor.test.ts` |
| **REQ-3D④** 贴图槽 | `MaterialSpec` + `Material3D` 加 `metalnessMap/emissiveMap/ormMap`+`tiling` | `assets/asset-index.ts`（MaterialSpec 那半） | **跨界·待 Lead review**（render 半在 P3D 域已定稿） |

- **资源库 vendoring 架构**（owner 2026-07-01 拍板）：共享 `assets/index.json`（3 万项货架）**不被游戏直接引用**；游戏只引自己的本地 `AssetIndex`；要用共享库资源就 vendor 进本地目录（hermetic）。详见 `requests.md` REQ-Resource ★★ + `P3D-asset-layer-handoff.md §4.6`。
- 契约/回执全史：**`docs/workflow/finish/P3D-asset-layer-handoff.md`**（Lead→P3D 原始契约 + 我的 ①-⑤ 完成回执 §4.5-4.7）——**PA 必读**，那是这套的设计真相。
- 现状评审：`docs/design/3d-asset-pipeline-standard.md`（逐类型标准化打分 + 缺口 + 「别走深」YAGNI 边界）。

## 2. 交给你（PA）的待办 backlog（按性价比·都不紧急）

1. **接手 Lead review 收口**：②③④ + REQ-3D④ 的 `src/assets` 跨界改动仍挂「待 Lead review」——**往后这些归你域**，review 意见的资产侧落地由你做（渲染侧 map 字段由 P3D 配合）。
2. **模型导入标准**（真缺口·`3d-asset-pipeline-standard.md §3①`）：`scripts/import-model.mjs`——读 glb→建议 scale + 列骨骼 clip 名 + 写/更新游戏本地 mesh 条目 + 记许可。把「scale 肉眼试」变「跑脚本得标准条目」。对标 2D 的 sniff→normalize。
3. **`.hdr` 导入线识别**（接 REQ-3D-⑤ HDRI）：资产线支持 `.hdr` 作字节资产（≤2k 分辨率提示·掌机 cartridge）；现渲染消费端已就绪（`Sky3D.envMap`→HDRLoader+PMREM），缺的是资产侧把 `.hdr` 登记成可加载字节。
4. **游戏本地 3D 美术目录标准**：定 `public/games/<game>/art/{models,textures}/` 为约定；vendor + import-model 都往这落；写进 `playbooks/assets.md`。
5. **`metalnessMap/ormMap` 美术**：渲染槽已通（REQ-3D④·sig/catalog 已测），但缺 ORM/金属打包图；有需求时你产（`emissiveMap` 已有程序化 demo：`gen-textures.mjs` 产 `rune_emissive.png`）。
6. **后置·无消费者**：sound/font 桥接、material Phase 4 深化——按需，别 YAGNI 先造。

## 3. 边界：什么归你、什么留 P3D

- **✅ 归 PA（你独占）**：`src/assets/**`（`asset-index`/`asset-types`/`pbr-materials`/`asset-manager`/`import/`/`library`/`model-loader`）· `assets/index.json` · `scripts/{vendor-asset,gen-textures,import-art-pack,import-model}.mjs`（美术产/导入工具）· `resource-manager` 技能 · MaterialSpec/TextureSpec 等 **spec 闭集 schema**。
- **🔶 共享（改前知会对应 P3D/PE）**：渲染消费端的 key 接线——`Material3D` 的 map/materialRef 等**字段是 render-only 组件**（住 `render.ts`·P3D §🔶 域），但**字段值指向的资产 + spec 元数据是你的**。加新贴图槽 = 你定 spec + P3D 加 render 字段，两边对齐。
- **🔒 留 P3D**：3D 渲染线（`renderer/three*`）+ `game-z/game-d`。game 自持的 `GAME_Z_INDEX`/`DioramaLoader`/自产贴图=game-z（P3D）所有，但**照你的约定/schema 写**（你是 schema 与管线的真相）。
- **原则**：P3D 缺资产能力 → 走 `requests.md`/`requests-3d.md` 提，PA 落；不再 P3D 常驻伸手 `src/assets`（owner 那次跨界授权到此收束）。

## 4. 你的两大件已就位（不用我交，指个路）
- **agent**：`.claude/agents/asset-manager.md`（主体职责/工作法·引我写的 `P3D-asset-layer-handoff` + `asset-pipeline-review`）。
- **技能**：`.claude/skills/resource-manager/SKILL.md`（vendor / 加材质 / 填 spec 三段操作法）；另有一份拷在外部全局 `~/.claude/skills/`（仓库副本为准）。
- **手册**：`docs/playbooks/assets.md`（资产线接线图·你踩坑回填它）。

---
**移交完成标准**：PA 读完本文 + `roles/PA.md` 必读三件 → 能独立接 review 收口 + 接 backlog。P3D 从此退回渲染线,资产事项走需求池交接。
