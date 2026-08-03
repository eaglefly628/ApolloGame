# 骰途 · Cloud Design 1:1 参考代码（Three.js r128）

owner 上传的**原型 1:1 TS 参考**。**用途：参考效果与精确数值，NOT 抄代码**——用 ZeroCraft 引擎的 render-only 数据组件（Mesh3D/Transform3D/Glow3D/Material3D/Vfx3D…）+ 游戏层时间驱动（`engine.subscribe` 里改 render-only 分量，同 title 骰自转先例）复刻同款效果。**表达不了的 → 记在这里、告知 owner、按需下沉成通用 capability（P3D 域·render-only）。**

| # | 文件 | 效果 | 我方可行性 |
|---|------|------|-----------|
| 01 | `01-die-material-rotation.ref.ts` | 命运骰材质 + 固定匀速翻滚 | ✅ **已实现**（Mesh3D dieFaces + dieGlass·固定 tumble·三点补光） |
| 02 | `02-dice-throw.ref.ts` | 出战骰组高空落场（抛物弧 + 单轴翻滚衰减） | ✅ **可做**（现有原语）|
| 03 | `03-shell-transition.ref.ts` | 巨骰壳包场 → 螺旋升走换层 → 旋入落定（2.5s） | 🔶 **半可**：壳/柔光易；**整场 arena 作单一 pivot 螺旋** = 缺 3D 层级 |
| 04 | `04-loot-deal.ref.ts` | 3D 卡牌扇形浮现 + 点选飞近放大 | 🔶 **缺 2 项**：非立方图片卡面 + 3D 拾取；现有 2D 版已覆盖玩法 |

## 逐项评估

### 02 掷骰 —— ✅ 现有能力可做
- 骰 = `Mesh3D{dieFaces, dieGlass?}`（size 0.58·emissive .2）；落场动画 = `engine.subscribe` 时间驱动改 `Transform3D`：
  - 位置 `lerp(from,to, cubic-out)` + `y += sin(t·π)·2.2·(1-t·0.3)` 抛物弧 → 直接写 Transform3D.x/y/z。
  - 翻滚：原型 `rotateOnAxis(单一随机轴)`；我方 Transform3D 只有欧拉 rotX/rotY/rotZ、无轴角。**按固定随机轴的分量比例增量 rotX/rotY/rotZ 近似**——纯视觉表演、观感等价。
- **无需改引擎。**

### 03 骰壳转场 —— 🔶 缺「3D 层级/pivot」
- **易**：巨骰壳 = `Mesh3D dieFaces size 8.6`；包裹柔光 = `Glow3D`；壳自身的 scale/spin/升起 = 单实体 Transform3D + eOutBack 驱动。
- **真缺口**：原型把**旧 arena + 壳 + 柔光全 add 进一个 pivot Group**，对 pivot 整体转/缩/移（整场螺旋升走）。我方 `Transform3D` 是**逐实体世界位姿·无 3D 父子层级**（`Hierarchy` 组件是 2D 的）。整座 arena（7×7 地格 + 墙 + 火盆 ~50+ 实体）没法作为一个单元一起转。
  - **建议下沉**：加一个 render-only **`Pivot3D`（父合成）**能力——一个实体的 Transform3D 在渲染前**合成到其列出的子实体**上。通用（任何 3D 场景要把子树当一个单元动都用得上）、确定无关（render-only 不进 hash）、P3D 域。
  - 备选（不改引擎）：游戏层每帧把 pivot 矩阵合成进每个 arena 实体的 Transform3D——~50 实体逐个算，重且乱，不推荐。

### 04 战利品发牌（全 3D）—— 🔶 缺 2 项能力
- **缺口 1**：卡牌是**非立方图片盒**（2.0×2.8×0.1·正/背面 = 卡图片贴图·四侧纯色）。我方 `dieFaces` 只建**立方体**（size³）；Mesh3D box 面只有 frontTint/backTint 纯色，**无 box 正/背面图片贴图**。→ 需给 Mesh3D 加 `frontSrc/backSrc`（box 面图片）。
- **缺口 2**：**3D 拾取**（Raycaster 点选浮空卡）。我方输入走 LayoutNode 2D action，**无 3D 指针拾取**。→ 需加 3D pick 能力，或用投影跟随的 2D 隐形热区。
- **现状**：`rewardTree` 已有 **2D LayoutNode 版**（Image 卡 + float + 点选 action）——UI 铁律合规、玩法已覆盖。全 3D 扇形飞近是更炫的表演。
  - **建议**：要么保留 2D 版（已完成），要么 owner 确认要全 3D 卡剧场 → 我再加上述 2 项能力。

## 结论（告 owner）
- **02 现在就能做**（不改引擎）。
- **03 要一个 render-only `Pivot3D` 父合成能力**才能整场螺旋（其余部分现成）——这是真缺口，属该下沉的通用能力。
- **04 全 3D 版要 box 图片面 + 3D 拾取两项**；否则 2D 版已够用。
</content>
