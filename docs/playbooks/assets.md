# 资产手册

> 美术/3D 资产走**统一 Asset 数据路线**：AI 只写查询字符串，选材/登记发生在引擎这台固定解释器里，可审计、同输入同结果。
> **主力工具**：`asset-manager` agent（导入/接线/spec 元数据）· `resource-manager` 技能（从共享库 vendor + 材质数据 + spec 闭集）。
> 机读真相：单一真相 `assets/index.json`；检索器 `src/assets/library.ts`（`rankRecords`）。

## ① 做 X → 用什么

| 任务 | 能力/机制实名 | 怎么接（一句） |
|---|---|---|
| AI 合理选材（贴图字段） | `art:` 引用 → `resolveArtRefs` | manifest 里写 `"art:skeleton warrior"`；加载前 `src/assembly/resolve-art-refs.ts` 用 `rankRecords` 确定性解析成真实 id（同库同排序器） |
| 算「这局差哪些资产」 | `deriveAssetIndex` | `src/assembly/derive-asset-index.ts` 扫蓝图所有 `assetKey` 字段 → 生成购物单（与逻辑同源，根除 key 漂移） |
| 从共享库导入一个资源 | `resource-manager` 技能 | vendor（copy）进游戏本地美术目录 + 登记本地索引 |
| 加贴图/模型/图集/精灵表 | `asset-manager` agent | 维护 `assets/index.json` 单一真相 + 按类型填 spec |
| 批量灌入共享货架（图标/emoji 系列） | `scripts/import-art-pack.mjs` · `import-emoji.mjs` | 整包从 GitHub 拉取→sniff→盖 style/license/source/provenance→并入 `assets/index.json`（加一个包=加一条 PACKS 配置，纯数据）；细节见 `docs/workflow/art-library-handoff.md` |
| 贴图/网格 spec 元数据 | spec 闭集 | usage/colorSpace/wrap/genCollision（贴图）· scale（模型）——闭集，非自由字段 |
| 3D 材质数据资产 | `Material3D`（type:'material'） | 引 texture key（走上面 art:/index），非硬编码预设 |
| 消费端接线 | `Sprite`/`Frame`/`Material3D` | 渲染组件的 key 指向已登记资产（见 rendering-fx.md / 3d.md） |

## ② 样例指针

- 机制说明：`src/assembly/resolve-art-refs.ts`（`art:` 解析 + `ArtResolution` 留痕）、`derive-asset-index.ts`。
- 真实用法：`src/games/game-e/assets.ts`+`cards-atlas.ts`（牌面图集）、`src/games/game-g/art-textures.ts`。
- 索引/类型：`src/assets/index.ts`（`ASSET_TYPES`/`AssetIndex`）、`assets/index.json`、`assets/FreeArtLib/index.json`。

## ③ 本线红线

- 资产**只走统一路线**（art: 引用 / assetKey / index.json），不在游戏层硬编码路径或手写 loader。
- spec 元数据填**闭集**值（usage/colorSpace…），不自由造字段。
- 解析失败的 `art:` 引用原样保留 → 渲染层退化占位，**不炸加载**（fail-soft）。

## ④ 正样例 / 反面教材

- ✅ `resolveArtRefs`：LLM 只产查询串，选材在引擎（与库浏览器同排序器·所见即所选·可审计）。
- ✖ 游戏层写死贴图路径 / 逻辑 key 与资产 id 不同源导致漂移（hero_idle vs hero_idel）。

## ⑤ 查不到怎么办

共享库没有需要的素材 / spec 闭集缺字段 → `docs/workflow/requests.md` 提缺口，或让 `asset-manager` agent 评估导入。**不在游戏层绕开 index.json 自管资产。**

## ⑥ 本地美术目录标准 · vendoring 落点（owner 2026-07-04）

Free Library（共享 `assets/index.json` + `FreeArtLib/`）= **货架·只被 copy**；游戏运行时**只引自己的本地索引**，要用共享资源就 vendor 进本地、**不直引货架、也不直引全局散落目录**。
- 本地根：`public/games/<game>/art/`；本地索引：`public/games/<game>/art/index.json`（站点绝对路径 `/games/<game>/art/...` + `baseUrl ''`，游戏侧 `registerAssetIndex(parseAssetIndex(local))` 直接消费）。
- 分类子目录（约定）：`textures/`（贴图）· `models/`（mesh glb）· `materials/`（`type:'material'` 数据资产·无文件可省目录）· `env/`（天空盒 hdr）。3D 别混进 2D 平铺目录。
- 工具：`node scripts/vendor-asset.mjs <shared-id> <game> [--as <local-id>]`（2D/3D 同一条·携 spec/license/`provenance.vendoredFrom`·幂等；材质等数据型无文件也支持）。
- 🚫 反例：游戏直引 `public/textures/` 等全局散落目录（绕过货架+本地索引）——正被 `REQ-PA-3D公用货架` ④b 消解。

## ⑦ 公用 3D 基础素材货架（可 vendor·`scripts/gen-shelf-3d.mjs` 备料）

共享货架已备公用 3D 基础素材，游戏按需 `vendor-asset` 进本地再引（**别直引货架、别自造重复**）：
- **材质**（数据型·无文件·引 pbr 预设）：`mat/matte|plastic|steel|iron|gold|copper|glass|rock|dirt|wood|emissive`。vendor 后 `Material3D.materialRef` 引它。
- **基础 mesh**（程序化 glb）：`mesh/plane`（地块）·`mesh/cube`（箱体）·`mesh/sphere`（星体/占位），spec `scale/genCollision`。
- **程序化贴图**：`tex/plank_albedo`·`tex/plank_normal`（线性）·`tex/rune_emissive`。
- **天空盒**：`env/sky-gradient`（equirect 渐变）。
- 备料/扩充：`node scripts/gen-shelf-3d.mjs [materials|meshes|textures|env|all]`（确定性·幂等·零网络·CC0 自产）。缺某类基础素材 → 扩这个脚本，不在游戏层自造。
