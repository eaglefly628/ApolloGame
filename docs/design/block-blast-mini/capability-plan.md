# 能力总览 Capability Plan — block-blast-mini（方块消除·初版）

> 2026-07-13 · Lead 亲笔（八阶段流程板全流程实践对象·owner「新开游戏怎么靠积木底座走流程出初版」）。
> 形态=**内置纯数据游戏**（`public/games/block-blast-mini/manifest.json`·零游戏层代码；
> `src/games/block-blast-mini/` 只放 walkthrough 走查测试——测试不是游戏代码）。
> 按模板适用范围裁定，纯数据游戏本可免正式 plan；本份仍写全，作为流程实践的 S2 正路示范。

## 1. 游戏一句话

Block Blast-like：从托盘拖多格方块放进 8×8 棋盘，摆满整行/整列即消除得分，托盘用完自动补新，无处可落即终局。参照物=Block Blast / Woodoku。

## 2. 消费的引擎能力（对照 `capability-registry` 实名）

| capability（注册名） | 用来做什么 | 状态 |
|---|---|---|
| `t3-block-grid` | 棋盘核心：落点合法判定/整行整列消除/托盘确定性补形/无处可落判负/格子视图同步 | ✅ 现有（2026-07-13 下沉） |
| `t2-grid-drag-square` | 输入桥：拖托盘块→方格吸附→写 PlaceBlockIntent | ✅ 现有（2026-07-13 下沉） |
| `f1-resource` + `t2-text-binding` | 计分（block-grid 发 ResourceModify→resource-apply 结算）+ 分数实时显示 | ✅ 现有 |
| `f2-flag` | 终局态（block-grid 置 gameOverFlag） | ✅ 现有 |
| `w1-random` | 托盘补形的种子随机（**禁裸 Math.random**） | ✅ 现有 |
| `a1-transform` / `c1-shape` / `l2-color` / `l6-text` / `l5-camera` | 摆盘/命中体/上色/文字/取景 | ✅ 现有 |

## 3. 摆成数据的规则面

| 数据表 | 内容 | 谁解释它 |
|---|---|---|
| `BlockGrid.shapes` | 7 种 polyomino 形状目录（单格/双联横竖/三联横竖/2×2/角 L·各带底色） | 引擎 `t3-block-grid`（canPlace/消除/补形全在引擎） |
| `BlockGrid` config | 棋盘 8×8·cellScore 1·lineScore 10·托盘 3 槽·方格像素几何 | 同上 + `t2-grid-drag-square`（几何吸附） |

## 4. 申请的游戏层代码例外（逐条过审）

**无。** 零游戏层代码；`src/games/block-blast-mini/walkthrough.test.ts` 是测试（S4 玩法关机器门），不是游戏逻辑。

## 4.5 美术接入

- 初版=**纯 Shape/Color 程序化观感**（机制验证优先）——按模板此项须申请例外：**申请理由=初版先证核心循环可玩，美术关（S6）时按台账把格子/托盘块换 `art:` 引用皮**（BlockGrid 格子视图走 BoardCell.Color，皮肤槽升级路径=view-sync 已支持 tint、Sprite 皮为 S6 增补项）。
- 台账产出：内置纯数据游戏落库自动推导。
- **Lead 裁决：✅ 有条件通过**（条件=S6 美术关不得以「程序化即成品」结案，须过台账复核）。

## 5. 确定性声明

- 随机源：仅托盘补形，走 `RandomSeed`（seed=20260713）+ 引擎 mulberry32 整数 PRNG。
- 回放/lockstep：不需要（单机休闲）；但 bench 五轴确定性双跑必须绿（S4/S8 机器门）。

## 6. 评审记录

- 提交人 / 日期：Lead / 2026-07-13
- Lead 裁决：✅ 通过（全现有能力组合·零代码例外·美术例外有条件通过见 §4.5）
