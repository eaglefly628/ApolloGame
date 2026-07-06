# Apollo 美术工坊 · 引擎美术管线愿景（调研报告 + 目标形态）

> 2026-07-04 · owner 提出「美术库改造成美术编辑器 + AI 产 2D/3D」→ Lead 调研出稿 · status: **设计稿·待 owner 审**
> 行业扫描基于 2026-01 知识截面 + 库内 CCGS 参考；数字为快照，实时以 `assets/index.json` 为准。

## 一、现状盘点（机读事实·2026-07-04 快照）

| 资产面 | 数字 | 说明 |
|---|---|---|
| 共享货架 `assets/index.json` | 30642 项 | **99.9% 是 2D texture**（30618）；material×20 / mesh×3 / sound×1 = 3D 半边刚播种（REQ-PA-3D 施工中） |
| DCSS 货架 `assets/FreeArtLib/` | 4892 项 | CC0 像素·预先存在 |
| 工具链（9 个 CLI） | — | 批量入库 `import-art-pack/import-emoji`（GitHub curl）· vendoring `vendor-asset`（货架→游戏本地）· 程序化贴图 `gen-textures` · 图集 `pack-atlas` · 视觉标签 `contact-sheet`+`merge-vision-tags` · 索引 `build-artlib-index` |
| 治理 | — | PA 角色 + asset-manager agent + resource-manager 技能 + spec 闭集元数据（usage/colorSpace/wrap/genCollision）+ 红旗棘轮 |

**已立住的管线原则（改造中必须保住）**：①单一真相=index，逻辑只引资产 id，资产没填也能跑；②vendoring 制——游戏不直引货架；③spec 闭集元数据；④许可/来源随条目走。
**真缺口（2026-07-04 二稿修正——首稿「零 AI/零可视化」过时，实测已有美术台雏形，见 §七）**：①AI 只有"生成"通道、无修复/变体/整理闭集，且**无人审门**（生成即登记）；②可视化只有列表级（30k 项无缩略图墙/搜索规模化）；③声音资产面≈空白；④三方对账无工具。

## 二、行业对照：现代引擎美术管线长什么样

**传统三引擎（Unity/Unreal/Godot）的公共形**：
1. **source 与 derived 分离**——源文件进库，导入器产引擎态产物+缓存，导入器可重跑（我们对应物=货架条目 + vendor/atlas/gen 产物，方向一致但未成文）；
2. **稳定 ID + 元数据 sidecar**（.meta/GUID）——我们更集中：index 条目即 sidecar，且机读（比散落 .meta 干净）；
3. **资产浏览器**=引擎门面：缩略图库、搜索过滤、拖拽引用、依赖查看——**我们完全没有，这是"编辑器感"的核心差距**；
4. 按平台派生（压缩/分辨率档）与热重载——我们 web 单平台，暂不需要派生矩阵。

**AI 时代新增件（2025-26 已成型的做法）**：
- **2D 生成**：diffusion 系（风格锁定=LoRA/参考图约束）产 sprite/图标/背景；**风格一致性靠"游戏风格锚"**（每游戏一组参考图+调色板），不是裸 prompt；
- **3D 生成**：图生 3D / 文生 3D 服务（Meshy/Tripo/Rodin 一类·外链 API）产低模+PBR——质量适合盒庭图元级，不适合主角级；
- **修复/加工类**（比生成更成熟、性价比最高）：超分、去背、调色板归一、九宫裁切、精灵帧补间、albedo→normal/ORM 推导；
- **共识纪律**：AI 产物必须带 **provenance**（模型/prompt/日期/源图）、必须**人审后入库**（无自动入库）、许可标注升级为硬字段。

## 三、目标形态：Apollo 美术工坊（美术编辑器）

**定位一句话**：不是 DCC（不做画画/建模），是**「货架管理器 + AI 加工台 + 游戏接线器」三合一**，作为创作台的第三面板（复用 apollo.py 服务面 + BYO-key + 本地 Git），PA 角色主管。

```
┌ 美术工坊（studio 第三面板·?mode=art）─────────────────────────┐
│ ①货架区 Library     双货架浏览·缩略图墙·搜索/标签/许可过滤     │
│                     预览（贴图放大/模型转台/音频试听）·预算仪表  │
│ ②导入台 Import      拖拽/URL/GitHub pack → sniff → spec 表单     │
│                     （闭集）→ 许可确认 → 登记 index             │
│ ③AI 加工台 Forge    修复/变体/生成（BYO-key）→ 预览 → 人审 →    │
│                     带 provenance 登记（绝无自动入库）           │
│ ④接线器 Wire        一键 vendor 到游戏本地 + 三方对账报表        │
│                     （引用↔登记↔磁盘·孤儿/悬空双向点名）       │
│ ⑤管线配方 Recipes   批处理=纯数据配方{op 闭集}·可重跑·进 git    │
└──────────────────────────────────────────────────────────────┘
```

**③AI 加工台的操作闭集（第一性设计：AI 是"填表助手+加工工"，不是自由代码）**：
| 类 | 操作（闭集·每个=一条数据配方） | 落地方式 |
|---|---|---|
| 修复 | 超分 / 去背 / 调色板归一（**对齐色库令牌**）/ 破图补全 | 本地模型或 BYO-key·成熟度最高·**M3 首发** |
| 变体 | 重着色 / 风格迁移（游戏风格锚约束）/ 尺寸档派生 | 同上 |
| 2D 生成 | 按风格锚 + prompt 产 sprite/图标/底纹 | BYO-key（千问/其他）·走已有 provider 网关 |
| 3D 生成 | 图生 3D 低模 + PBR 贴图推导（albedo→normal/ORM） | 外链服务·可选开关·M4 |
| 整理 | 九宫裁切 / 精灵帧切分 / 图集打包 / 自动标签 | 收编现有 pack-atlas / merge-vision-tags |

**硬约束（宪法对齐）**：
1. 工坊只产**数据**：index 条目 + 文件 + recipe——不产代码；
2. **provenance 硬字段**：AI 产物必带 `{model, prompt, sourceKey?, date}`，许可字段必填（AI 生成标自有/服务条款）；
3. **人审门**：生成/加工结果一律预览态，人点"入库"才登记（CCGS 学的"无法机验不默认通过"）；
4. **recipe=纯数据可重跑**：`{op:'palette-conform', palette:'jade-sheen', src:'tex/x'}` 弱模型填得了；gen-textures 收编为 recipe；
5. 三方对账进 audit 轴（完整性/合规性两轴分开·CCGS §六已采纳的模式）。

## 四、分期路线（每期可独立派工·验收标准照 testing.md）

| 期 | 内容 | 前置 | 量级 |
|---|---|---|---|
| **M0**（在跑） | 3D 货架统一 + vendoring 3D 半边 | REQ-PA-3D（PA 施工中） | — |
| **M1 货架可视化** | studio 第三面板只读版：缩略图墙+搜索过滤+预览+预算仪表+三方对账报表——**最小"编辑器感"** | M0 | 中 |
| **M2 导入/接线 UI 化** | 导入台（拖拽→spec 表单→登记）+ 接线器（vendor 按钮+对账）——现 CLI 收编为服务端点 | M1 | 中 |
| **M3 AI 加工台·2D** | 修复/变体/整理闭集 + 2D 生成（风格锚+BYO-key+人审门+provenance） | M2 | 大 |
| **M4 3D 生成外链** | 图生 3D + PBR 推导·可选开关 | M3 + 3D 消费面成熟 | 中 |

## 五、不做清单（守边界）

- ❌ DCC 功能（画笔/建模/骨骼编辑）——那是 Aseprite/Blender 的活，我们做管线不做创作工具；
- ❌ 云资产商店/账号体系——本地优先，同创作台哲学；
- ❌ 自研生成模型——一律 BYO-key/外链，模型进步我们白拿；
- ❌ 自动入库——人审门是铁的，AI 时代的资产库死于无人审的垃圾涌入；
- ❌ 平台派生矩阵（多分辨率/压缩档）——web 单平台，YAGNI。

## 七、现台改造评估（2026-07-04·owner 问「当前美术台能改造吗」——答：能，增量改造非推倒）

**已存在的美术台**（此前盘点遗漏·edd2fe23 等）：`AssetLibrary/AssetBrowser/AssetGenPanel`（~616 行·含渲染测试）+ apollo.py 四端点（import/generate/providers/autotag·mock 兜底·路径防注入·密钥打码）+ `scripts/ai-gen.mjs`（**tripo 文生 3D PBR + qwen wanx 文生图两条真调路径都已写好**·无 key 自动 mock·带 provenance 字段）。

| 愿景五区 | 现台 | 改造 gap |
|---|---|---|
| ①货架区 | AssetBrowser 列表+定位（挂 Inspector 内） | 缩略图墙（30k 项虚拟滚动）/许可徽标/双货架树/预算仪表 |
| ②导入台 | `/api/assets/import` 端点在 | spec 闭集表单 + 许可确认流 UI |
| ③AI 加工台 | **生成通道已通**（2D+3D·mock 兜底·provenance 有） | ⚠️**人审门缺失（生成即登记·宪法级·先修）**；修复/变体/整理闭集；风格锚 |
| ④接线器 | vendor CLI 有 | UI + 三方对账报表 |
| ⑤配方 | pack-atlas/gen-textures 散装 CLI | 收编为数据配方 |

**改造顺序（修订版）**：**M2.5 人审门**（小·最先——生成产物改进「待审区」，人点入库才登记，provenance 升硬校验）→ M1 货架可视化 → M2 导入/接线 UI → M3 修复/变体闭集+风格锚 → M4 3D 打磨。原 M0-M4 分期框架不变，只是起点从零改为从现台长出。

## 六、下一步

owner 审本稿 → 拍板后 **M2.5 人审门先行起单**（小·PST/PA 域），M1 随后；spec 由 Lead 出。界面视觉稿另附（SendUserFile 交付·不入库）。
