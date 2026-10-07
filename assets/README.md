# `assets/` — 原始资产存储（Raw Asset Store）

> **这是「内容」，不是「代码」。** 资产系统代码在 `src/assets/`，别混淆。

最底层、按类型分、**纯叶子、无逻辑**的资产存储。游戏里用到的每一份美术/音频/模型，
都在这里有一条索引，逻辑层**只引用稳定 id、永不引用二进制文件**。

## 结构

```
assets/
├── index.json     ← 唯一索引：游戏所有资产从这里索引（id → type / 描述 / 状态 / 路径）
├── texture/       ← 贴图（png/jpg/webp…；导入器按 texture/<分类>/ 落盘）
├── mesh/          ← 网格模型
├── material/      ← 材质
├── sound/         ← 音频（bgm/sfx/voice）
├── animation/     ← 动画数据
├── video/         ← 视频
├── font/          ← 字体
└── FreeArtLib/    ← 素材货架（DCSS CC0，自带 index.json，脚本生成，只读）
```

## 星尾馆猫用物件百件库（Game112 商店）

- `curated/game112-cat-toys.v1.json`：T001–T100 的稳定编号、品类、外观方向与出图状态。100 件已按本轮商店接入决定入库。
- `curated/game112-cat-toys-overview.png`：100 件总览；`curated/game112-cat-toys-preview.png` 是 T001–T010 详细拼页，`curated/game112-cat-toys-preview-011-020.png` 至 `...-091-100.png` 是其余九页。每页从左上到右下依编号排列。
- `ai/openai-built-in/game112-cat-toy-*.png` 与 `index.json`：100 张原图及逐张生成记录；`ai/pending.json` 中对应待审项已清空。
- `public/games/game112/art/ai/openai-built-in/` 与本地 `art/index.json`：经 `scripts/vendor-asset.mjs` 复制到 Game112 的运行时资产。价格、分类和商品说明在 `games/game112/shop-catalog.v1.json`。T011–T100 使用 `scripts/game112-toy-batch.mjs` 的稳定提示词模板单独生成，没有从拼图裁成假单品。

这一批不使用网上图集原图；外部图片的商用与二次加工许可必须逐张核对。部分图有透明边缘像素警告，**入游戏不等于发行美术终审通过**，发行前仍需逐张复查并修图。新 100 件目前完成购买与收藏，摆放和猫咪互动需另行逐件制作。

类型集合可扩展，但保持「按类型分的叶子目录」这一约定。

## 索引条目（`index.json`）

| 字段 | 说明 |
|---|---|
| `id` | 稳定 id（如 `bg.office`、`texture/icon.item/sword`）。**逻辑只认它**。 |
| `type` | `texture｜mesh｜material｜sound｜animation｜video｜font` |
| `description` | 给人看 + 将来作生成 prompt 种子 |
| `status` | `tbf`（待填充）/ `filled`（已填） |
| `path` | 相对 `assets/` 的文件路径；**仅 `filled` 时存在** |
| `spec` | 可选目标规格（宽高/透明/格式/loop…；`frames`=图集命名帧，`sheet`=精灵表网格） |
| `category` | 可选子分类（资源库分类法，如 `icon.item`/`background`/`bgm`） |
| `tags` | 可选检索标签 |
| `source`/`license` | 可选来源与许可（导入器写 `source:"import"`） |
| `provenance` | 可选导入溯源（方式/原始文件名/内容哈希） |

## 资源库浏览器 / 导入器

launcher 首页 →「🗃 资源库」：统一浏览**项目资产 + FreeArtLib + 各游戏清单**（搜索/分类树/tag 过滤），
「📥 导入资产」走四步向导（散图批量 / 精灵表切割 / 乱目录归一化），提交经 zerocraft.py
`POST /api/assets/import` 写盘（限 assets/ 子树）并增量更新本索引。设计见 `docs/design/asset-library.md`。

## To-Be-Filled（TBF）约定

- 需要一份资产 → **先在 `index.json` 声明一条 `status:"tbf"` 的条目**（给 id + 描述 + 规格），**先别管文件**。
- 游戏蓝图里用 `id` 引用（如 `Sprite{ textureKey: "bg.office" }`）。
- 资产没填时游戏**照样能跑**（渲染层退化为占位）。
- 真资产就绪 → 文件丢进对应 `assets/<type>/`，把条目改成 `status:"filled"` + `path`。**同一个 id,游戏代码一行不改。**

完整流程见 `docs/workflow/asset-flow.md`。驱动 TBF 的「填充工具 / 预览器」是外部框架,后续接入。

> 确定性：资产是表现层,逻辑只持有字符串 id,像素/音频**不进模拟哈希** → 填充/替换不破坏 lockstep 与录放。
