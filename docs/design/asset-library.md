# 资源库（Asset Library）— 统一资产库 + 导入器 设计

> 状态：**v1 已落地**（2026-06-10，用户拍板 mockup 后实施）· 布局稿：`asset-library-mockup.html`
> 定位：把「美术贴图货架」升级为**全游戏资源的统一库**——一个浏览器看全部、一个导入器收全部。

## 1. 问题（重构动机）

重构前三套索引并存、形状互不兼容：`assets/index.json`（AssetIndex，TBF 流程）、
`assets/FreeArtLib/index.json`（ArtLibIndex，素材货架）、各游戏手写 `assets.ts`（AssetManifest）。
Studio 被迫为每个游戏写 switch-case；cardgame webp 靠脚本里硬编码排除名单清洗。
第二个素材包进来就会再乱一次。

## 2. 方案：统一模型 + 适配器（不动旧契约）

```
assets/index.json ──projectRecords──┐
FreeArtLib/index.json ─artlibRecords─┼─▶ LibraryRecord[] ─▶ queryLibrary ─▶ 资源库浏览器
games/*/assets.ts ──manifestRecords──┘      （统一记录）        （纯查询）
```

- **`src/assets/library.ts`**：`LibraryRecord`（id/type/category/tags/source/license/status/thumb/spec）
  + 三个来源适配器 + `queryLibrary`（分词全命中 + type/category/status/tags/sources 过滤 + 排序）
  + `LIBRARY_TAXONOMY` 分类法（7 类型常驻：贴图·音频·动画·视频·材质·网格·字体；贴图按用途槽位分 12 子类）。
- **旧契约零破坏**：FreeArtLib 索引仍由脚本生成；游戏 `assets.ts` 只读聚合（迁纯数据归 PE）；
  `assets/index.json` 加**可选** v2 字段（`category/tags/source/license/provenance`），旧条目原样合法。
- **运行时增量**：`registerAssetIndex` 新认 `spec.sheet`（精灵表网格）→ `SpriteSheetDescriptor`，
  与既有 `spec.frames`（atlas）对称——导入器产物落回既有契约，渲染端零新概念。

## 3. 浏览器（`src/studio/AssetLibrary.tsx`）

三栏（对标 Unity Project / Unreal Content Browser，用户已拍板 mockup）：
**左** 类型目录树（计数；空类型常驻）+ 来源（包）勾选 ｜ **中** 缩略图网格（大小滑杆、CAP 400、状态徽章）
｜ **右** 详情（大预览/一键复制 id=textureKey/规格/tags 点击即过滤/来源许可/文件路径）。
顶部：搜索 + 状态/排序下拉 + 面包屑 + tag chips（AND 叠加）。取代旧 `ArtLibBrowser`（已删）。

## 4. 导入器（`src/studio/AssetImportWizard.tsx`）

四步：**① 放入文件**（拖拽/选文件/选整目录）→ **② 模式与归一化** → **③ 预览映射表**（逐行处置+理由，可改写 id、可跳过）→ **④ 提交写库**。

| 模式 | 对应来源 | 关键动作 |
|---|---|---|
| ① 散图批量 | 来源杂的零散图 | 变体分组（`_n`/`(n)`/`-n`）· 同内容 hash 剔重 · slug 命名 · 冲突自动改名 |
| ② 精灵表切割 | 未切割的整张 UV | 网格参数（cell/offset/spacing）+ canvas 叠加预览 + 空白格像素侦测剔除 → `spec.sheet` 或命名帧 `spec.frames` |
| ③ 乱目录归一 | 命名混乱的目录 | ①的全部 + 「路径关键词=分类」规则表（自上而下首个命中） |

**判定全在纯核心**（已单测，UI 只做交互）：
- `import/sniff.ts`：PNG/JPEG/WebP/GIF **字节头解析**出宽高/透明通道（无 canvas 依赖）+ fnv1a 内容哈希。
- `import/profile.ts`：`NormalizationProfile` = **规则即数据**（命名/变体/重复/冲突/分类规则一份 JSON，可存可复放——同输入同 profile 必同输出）。
- `import/normalize.ts`：`planImport`（文件元数据+profile+现有 id 集 → 逐行计划）+ `planEntries`（→ 索引增量条目，带 provenance 溯源）。
- `import/slice.ts`：网格切割数学（`gridCells/sheetSpec/atlasFrames`，keep 剔空格后帧名仍连号）。

**写盘**：apollo.py `POST /api/assets/import`（先全量校验后写：路径锁死 assets/ 子树防穿越、
索引重复 id 整批拒绝），文件落 `assets/<type>/<分类>/`，索引增量含 `provenance`。
apollo 未启动 → 提交失败给出明确提示（浏览/计划预览不受影响）。

## 5. 视觉：壳层统一基调（`src/ui/shell-theme.ts`）

用户要求主页/资源库/各游戏返回钮统一「清幽·高雅·高级·秩序」的引擎气质 →
设计令牌单点化：墨蓝近黑底 + 主色**青瓷** + 辅色**黛紫** + 点睛**淡金** + 发丝线 + 阔字距小标。
launcher 门面、GameRunner 统一返回浮钮（壳层所有，游戏代码零改）、资源库/向导全量取用。
与 `src/ui/themes/`（游戏内 UI 主题包）是两层，不混用。

## 5.5 语义标签上图 + AI 选材（v1.1，2026-06-10）

cc3265d 引入像素扫描语义标签（`artlib-tags.ts`：CAT_TAGS 路径级 + SUBJECT_TAGS 主题级，
查询时现算合并进 `artlibTokens`）。本期把它接到「人可见、AI 可用」：

- **图上可见**：浏览器网格卡片缩略图底部叠加语义标签条（黛紫，≤2 个 + `+n`，悬停 title 给全量）；
  详情面板语义标签（紫）与结构词（路径/主题派生）分组显示，均点击即过滤。
  `artlibSemanticTags()` 与 `artlibTokens()` 合并逻辑严格同构——**显示的 = 搜索/解析用的**。
- **排序器单点**：`rankRecords`（名称全等 100 > 前缀 60 > 语义 tag 50 > 任意 tag 40 > 名称子串 30
  > id 子串 15 > tag 子串 10；AND 全中才入选；同分按 id 稳定）。浏览器搜索默认按它出序
  （sort=relevance），**AI 选材走同一个函数 → 人在浏览器看到的第一名 = AI 选到的那张**。
- **AI 选材 = `art:` 数据引用**（`src/assembly/resolve-art-refs.ts`）：LLM 在 manifest 里写
  `Sprite.textureKey: "art:skeleton warrior"`，进透视器前 `resolveArtRefs` 用 rankRecords top-1
  确定性替换为真实 id；无命中原样保留（渲染占位，不炸加载）；解析全程留痕（resolutions：
  query→id+候选，console 审计）。生成 system prompt（apollo.py）已附写法与常用语义词。
  宣言尺子：LLM 产出的只是查询字符串，选材发生在确定性解释器里——同 manifest 同索引永远同图。

## 5.6 入库主动扫描标注（v1.2，2026-06-10）

用户拍板：**新资产入库时自动视觉打标**，与存量回填共用一条管线：

- **apollo.py `POST /api/assets/autotag`**：`{entries:[{id,path}], model?}` →（路径锁 assets/ 子树）
  每张经 `scripts/contact-sheet.mjs` 放大 6×（最近邻+棋盘底）→ Claude 视觉（默认 `claude-opus-4-8`）
  按受控词表打 4-10 个语义标签（**只标视觉可见**，禁编设定）→ `tags` 合并写回 index.json
  （`provenance.autotag={model,at}` 留痕）。单张失败不拖死整批；无 API key 明确报错。
- **导入向导钩子**：步骤④「✨ 写库后自动扫描标注」默认开，写库成功后异步标注、回显样例标签；
  标注失败不影响导入（可重试）。
- **成本**（2026-05 价目）：~$0.003/张（Opus 4.8）；存量 4761 张回填 ≈ $13（Batch API 半价 ≈ $6.5），
  Sonnet/Haiku 更低。回填脚本走 Batch、产出建议落 `assets/FreeArtLib/tags-scan.json`（生成式数据，
  与人工精标 artlib-tags.ts 分层）—— 待用户确认花费后执行。

## 5.7 确定性像素扫描层（v1.3，2026-06-10 · 用户拍板「不用 API，写程序扫」）

**零 API、零花费、同输入永远同输出**的事实标签层，与语义层（文件名结构 + artlib-tags 人工精标 +
可选 Claude 视觉）分层互补。程序诚实边界：能读颜色构成/明暗/鲜艳度/透明半透明/主体体量形状/暖冷调，
**不做主体识别**（"这是骷髅战士"归语义层）。

- 纯核心（已单测）：`src/assets/import/png-decode.ts`（零依赖 PNG 解码）+ `pixel-tags.ts`
  （HSV 色桶统计 → 定序事实标签；`auditSemanticTags` 语义↔色证对账）。
- 壳：`scripts/scan-pixels.ts`（vite-node）两种模式——全量扫 FreeArtLib → `tags-scan.json`
  （生成式数据：id→标签 + 嫌疑单）；`--assets` 扫项目 index.json 已填贴图并合并写回。
- 合并：`build-artlib-index.mjs` 读 tags-scan.json 并入每条资产 `tags` 字段 →
  `artlibTokens`/`artlibSemanticTags` 已合并 a.tags → **搜索/浏览器/AI 选材零改动直接吃到**。
- 入库挂钩：apollo `handle_asset_import` 写完索引后 best-effort 跑 `--assets` 模式
  （免费必跑）；API 视觉标注降级为「✨ 追加语义标注」可选项。
- 首扫结果：**4687/4892 张打标并入**（跳过 205 张非 PNG，主要是 cardgame webp 卡面），
  index.json 894KB→1.1MB；语义对账嫌疑 **39 条**存 tags-scan.json `suspects`（混有真错标与
  "功能性标签 vs 画面色证"两类，待人工裁决——audit 规则只审视觉性声称，divine/religion 等功能语义不审）。

## 5.8 全量视觉语义层（v1.4，2026-06-10 · 沙盒内本人逐格扫描）

用户拍板「用沙盒里的你全部扫一遍」：19+1 个并行分身按受控词表逐格看图（25/36 格拼图×6/5 倍），
**4687/4687 张全覆盖**产出 `tags-vision.json`（语义层：主体类别/可见特征/质感，禁颜色词禁设定臆测，
merge 时 snake_case 校验+废词过滤+批次完整性核对）。途中实锤并修复 **Adam7 隔行解码缺陷**
（png-decode/contact-sheet 曾把隔行图渲染成噪点），~30 张受害图人工复审补标。
现三层并入索引：**视觉语义（vision）+ 像素事实（scan）+ 人工精标（artlib-tags）**，
索引 1.27MB；省 token 协议沉淀：大拼图分组、增量写盘、禁自验脚本、五行汇报。

## 6. 确定性边界（不变）

库与导入全在表现层：sim 只持字符串 key，像素/索引不进模拟哈希 → 填充/导入/重命名不破坏 lockstep 与录放。

## 7. follow-up（非阻塞）

- 音频/字体导入模式（契约已留：类型目录+索引字段就绪）；
- usedBy 溯源接进资源库详情（数据在 studio/assets-model，待并）；
- StudioInspector 换装 shell-theme（本期只做门面+资源库+返回钮）；
- 游戏 `assets.ts` → 纯数据 manifest（派 PE-E/PE-F）；
- R9 generative provider（一键生成）接进向导第四条路。
