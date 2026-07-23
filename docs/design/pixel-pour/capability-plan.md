# 能力总览 Capability Plan — Pixel Pour《色流工坊》（GD 草案 2026-07-23·**待 Lead 评审**）

> 依 CLAUDE.md「游戏能力总览铁律」：开工前必交本 plan 过审才许写游戏层代码。
> 尺子（宪法）：规则摆成**数据表** + 由**现有 capability** 解释；填了没有解释器的表 = 虚胖数据（禁）。
> capability 实名对照 `src/assembly/capability-registry.ts`（ALL_CAPABILITIES）；缺口走 requests.md 下沉，不自造。

## 1. 游戏一句话

竖屏休闲益智：传送带承载「色炮」到发射位**自动向中央同色方块开火**消色，5 待命槽复用+连击突破——
清空棋盘/拼出隐藏像素画过关（GDD=`docs/design/pixel-pour/gdd.md`）。

## 2. 消费的引擎能力（对照 `capability-registry` 实名）

| capability（注册名） | 用来做什么 | 状态 |
|---|---|---|
| `clickable` | 补给区取色炮、点待命槽复用（输入信号源） | ✅ 现有 |
| `tray` | **5 个待命槽**：打光弹药的色炮入托盘、点击出托盘复用（堆叠/排序/择机齐射） | ✅ 现有 |
| `zone-occupancy` | 传送带**容量占用**（≤6，突破态≤10）与发射位「队首」判定 | ✅ 现有 |
| `launch` | 发射位向目标方块**抛射彩球**（抛物线弹道） | ✅ 现有 |
| `hitbox` / `collision-resolve` | 弹丸命中方块判定 | ✅ 现有 |
| `tween` / `motion-apply` | 传送带位移、色炮上带/入槽缓动、方块消除缩放 | ✅ 现有 |
| `lifetime` | 弹丸/粒子生命期回收 | ✅ 现有 |
| `group-count` | 按颜色统计**剩余同色方块数**（补给区角标 + 无同色目标判定） | ✅ 现有 |
| `event-when` + `effect-apply` | 规则链：到位且有同色→开火；弹尽→入槽；同色 hp 归零→消除+计分+连击；全清→胜；步/时尽→负 | ✅ 现有 |
| `flow`（GameFlow） | 关卡流程：playing →(全清)victory /(限额尽)defeat；onEnter 落输入闸 | ✅ 现有 |
| `gauge` / stats + resource（atoms） | 得分/连击倍率/步数或倒计时/金币 | ✅ 现有 |
| `timeline` | 连击/突破/结算的多拍演出编排（订阅信号自演） | ✅ 现有 |
| 种子 PRNG（RandomSeed） | 关卡摆盘、补给出色（**游戏层禁裸 Math.random**） | ✅ 现有 |
| UI：LayoutNode 全套（Modal/Particles/flyTo/floatUp/format/stroke/LevelPath） | HUD/结算/飘分/收集飞行/选关 | ✅ 现有（休闲批） |

## 3. 摆成数据的规则面

| 数据表 | 内容 | 谁解释它 |
|---|---|---|
| 关卡表（20 行） | 颜色数/方块阵(行列/摆色/隐藏图案)/硬块 hp/带速/步或时限/星阈/seed | `flow` + `event-when`/`effect-apply` 胜负链 + PRNG 摆盘 |
| 色炮配置 | 每炮弹药量、颜色集 | `launch` + `tray` config |
| 连击表 comboTable | 连击窗口/倍率阶梯 | `event-when`/`effect-apply`（计分链） |
| 突破规则 | 快连间隔阈值→容量 6→10 | `zone-occupancy` config + `event-when` |
| 商业化触发表 | Lv.10 双倍币 / Lv.20 去广告 / 失败续命 | 元层（运行时外·先记数据，接线后置） |

> 红线自检：上表每一行都指向**现有解释器**，无「数据表+待写游戏层解释器」。**唯一存疑**见 §4。

## 4. 申请的游戏层代码例外 / 能力缺口（逐条待 Lead 裁决）

| 项 | 为什么现有能力可能表达不了 | 倾向 | 待 Lead 裁决 |
|---|---|---|---|
| **传送带队列 + 自动同色开火 的编排** | 「到发射位→查同色→自动 launch→弹尽入 tray→队首递进」是一条有序状态机。初判可由 `event-when`/`effect-apply` + `zone-occupancy` + `tray` + `launch` **组合表达**（类似生产线管道），非真缺口 | **先按组合表达装配**；若 PE 落地发现有序编排表达不了（如队首递进/突破态切换），再回本表申请**下沉一个 `conveyor-queue`（传送带队列）通用 capability**（确定性·可复用于任何「排队→到位触发」玩法） | ⏳ |
| **中央方块「同色可消/隐藏图案层」的视图** | 方块=带颜色+hp 的实体阵；消除后露出图案层。可用实体+皮肤槽表达；若需层视图，参考 game-t `LayerCell` 路线 | 优先实体+皮肤；层视图缺口对齐 game-t 三期 | ⏳ |
| balance-sim 脚本（GD 工具） | authoring-time 关卡可解性/难度验证 bot，**非运行时游戏代码** | 准（照 GD 白皮书 balance-sim 模式·确定性种子） | ⏳ |

> 目标 = **零运行时游戏层例外立项**：机制全落 `flow`/`event-when`/`effect-apply` + `tray`/`zone-occupancy`/`launch`/`group-count` 数据；
> 仅当 PE 落地实证组合表达不了「传送带有序编排」时，才下沉 `conveyor-queue`（一条通用能力，服务本类「队列到位触发」玩法），绝不在游戏层写散逻辑。

## 4.5 美术接入（必填）

- 皮肤槽：色炮 / 中央方块 BoardCell / 背景 / UI 面板 全部带皮肤槽（Sprite 或 art: 引用）。
- 主题：卡通像素工坊风（规避原作小猪形象）；中央方块皮=像素图块，隐藏图案=可收集像素画。
- 台账：落地时照 game-q/game-t 样板写推导脚本（脚本名待建）；程序化占位仅作皮肤就绪前回退。

## 5. 确定性声明

- 随机源：引擎 RandomSeed（关卡 seed → 摆盘 + 补给出色）；**任何游戏层非确定性 = 红线**。
- lockstep：单机首发，但保持 lockstep-safe（全整数+种子 PRNG），balance-sim 依赖确定性回放。

## 6. 评审记录

- 提交人 / 日期：GD（Pixel Pour）/ 2026-07-23
- Lead 裁决：⏳ **待评审**（重点裁 §4 首行：传送带编排=组合表达 vs 下沉 `conveyor-queue`）
- 备注：本 plan 未过审前**不写任何游戏层代码**；`prototype.html` 为 GD 设计参考 mockup，非引擎实现。
