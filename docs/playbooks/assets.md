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
