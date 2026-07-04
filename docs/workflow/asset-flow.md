# 资产流程（Asset Flow）—— 游戏创作者从第一个原型就用这套

> 给游戏创作角色（GD-\<game\>/PE-\<game\>，历史文档称 Game Creator）。**做原型的第一步起就按这套走**，不要等"有美术了再说"。**术语注：本文旧版的「PA/PB」指游戏创作者，与角色名录 PA（资产管理员）无关，已更名防混。**
> 核心纪律：**逻辑只引用资产 id，永不引用具体文件；资产没填也能跑。**

## 为什么（一句话）

美术/音频是渐进填充的。我们不让"缺图"阻塞玩法原型——**先声明、用占位跑起来，真资产后补**，
而且这条路对开发者和最终用户是**同一套**（你现在用它，将来小白用户也用它）。

## 三层，别搞混

| 层 | 是什么 | 你这一步碰哪层 |
|---|---|---|
| **raw 存储** `assets/` | 按类型分的叶子文件（texture/mesh/material/sound/animation/video）+ `assets/index.json` 索引 | **就用这层**（声明 + 引用 + 填充） |
| 语义槽位 manifest | PB 设计的上层契约（一致性组/表情差分/锚点），见 `docs/design/asset-manifest-and-manager.md` | 后续接入，现在不必 |
| 填充工具/预览器 | 驱动 TBF 的外部框架（一键生成/选库/上传/占位 UI） | 外部团队做，你只管声明状态 |

## 流程：四步（每次需要一份资产都这么走）

### ① 声明（先别管文件）

在 `assets/index.json` 加一条 `status:"tbf"` 的条目：

```jsonc
{
  "id": "bg.office",                 // 稳定 id —— 逻辑只认它
  "type": "texture",                 // texture|mesh|material|sound|animation|video
  "description": "背景·制作人办公室，落地窗，黄昏光，柔粉色调",  // 给人看 + 将来生成 prompt 种子
  "status": "tbf",                   // 待填充
  "spec": { "width": 1280, "height": 720, "format": "png" }   // 可选目标规格
}
```

> id 命名建议：`<域>.<名>[.<变体>]`，如 `bg.office`、`char_S.portrait.neutral`、`bgm.daily`。

### ② 引用（蓝图里只写 id）

游戏蓝图里用 id 当资产键，**绝不写文件路径**：

```ts
world.addComponent(e, { type: 'Sprite', textureKey: 'bg.office', anchorX: 0.5, anchorY: 0.5, zOrder: 0 });
```

游戏启动时把索引接进渲染：

```ts
import { AssetManager, ImageAssetLoader, parseAssetIndex, registerAssetIndex } from '@assets/index.js';
import rawIndex from '../../assets/index.json';   // 或运行时 fetch

const assets = new AssetManager(new ImageAssetLoader('/assets/'));
registerAssetIndex(assets, parseAssetIndex(rawIndex), '/assets/');   // 只注册已 filled 的
await assets.loadAll();
const renderer = new CanvasRenderer({ assets });   // sprite 就绪即画真图
```

### ③ 跑（缺资产照样能玩）

`tbf` 的资产没注册 → 渲染层**退化为占位**（当前是占位方块；带标签占位是下一步增量）。
**所以原型从第一帧就能跑**，零美术也能验证玩法/站位/演出。

### ④ 填充（真资产就绪时）

1. 把文件丢进对应类型目录：`assets/texture/office.png`。
2. 把该条目改成：
   ```jsonc
   { "id": "bg.office", "type": "texture", "status": "filled", "path": "texture/office.png", ... }
   ```
3. **同一个 id，游戏代码一行不改**，真图自动显示。

（将来这一步由"填充工具/预览器"驱动：一键生成 / 选库 / 上传 / 占位。你只需保证 id + 描述准确。）

## 确定性边界（务必记住）

资产是**表现层**。逻辑只持有字符串 id，**像素/音频不进 `world.snapshot()` / 哈希**。
→ 填充、重生成、换风格**都不破坏 lockstep / 录放确定性**。放心随时填。

## 当前能力 / 边界（诚实说明）

- ✅ `texture` 已能按 id 真实加载绘制（filled 时）；`tbf` 退化占位。
- ⏳ `sound/mesh/material/animation/video` 现在**只在索引登记**，运行时消费端后续增量接（音频后端见 `requests.md` R8）。
- ⏳ "带槽位名的可视占位"、语义槽位 manifest、填充工具 UI —— 后续。

## 速查

- 索引文件：`assets/index.json` ｜ 存储目录：`assets/<type>/` ｜ 说明：`assets/README.md`
- 代码 API：`@assets/index.js`（`parseAssetIndex` / `registerAssetIndex` / `pendingAssets`）
- 待填充清单：`pendingAssets(index)` —— 想知道"还差哪些资产"就调它。
