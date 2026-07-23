# 能力总览 Capability Plan — Pixel Pour《色流工坊》（GD 草案 2026-07-23·**待 Lead 评审**）

> 依 CLAUDE.md「游戏能力总览铁律」：开工前必交本 plan 过审才许写游戏层代码。
> 尺子（宪法）：规则摆成**数据表** + 由**现有 capability** 解释；填了没有解释器的表 = 虚胖数据（禁）。
> capability 实名对照 `src/assembly/capability-registry.ts`（ALL_CAPABILITIES）；缺口走 requests.md 下沉，不自造。

## 1. 游戏一句话

竖屏休闲益智：传送带承载「色炮」到发射位**自动向中央同色像素块开火**消色，5 待命槽复用+连击突破——
清空**整幅像素画棋盘**（并集金钥匙/开宝箱门）过关（GDD=`docs/design/game102/gdd.md`；已按 2026-07-23 实机截图校准）。

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
| `group-count` | 按颜色统计**剩余同色像素块数**（补给区角标 + 无同色目标判定） | ✅ 现有 |
| `event-when` + `effect-apply` | 规则链：到位且有同色→开火；弹尽→入槽；同色 hp 归零→消除+计分+连击；**收集钥匙→计数/开门**；全清/目标达成→胜；步/时尽→负 | ✅ 现有 |
| `flow`（GameFlow） | 关卡流程：playing →(全清/门开)victory /(限额尽)defeat；onEnter 落输入闸 | ✅ 现有 |
| `gauge` / stats + resource（atoms） | 得分/连击倍率/步数或倒计时/金币/**钥匙计数/宝箱门目标计量（100）** | ✅ 现有 |
| `tilemap`（位图棋盘） | **中央像素画棋盘**：位图+调色板→带色像素块阵列（关卡=位图数据） | ✅ 现有（待 PE 核对适配度） |
| `timeline` | 连击/突破/结算的多拍演出编排（订阅信号自演） | ✅ 现有 |
| 种子 PRNG（RandomSeed） | 关卡摆盘、补给出色（**游戏层禁裸 Math.random**） | ✅ 现有 |
| UI：LayoutNode 全套（Modal/Particles/flyTo/floatUp/format/stroke/LevelPath） | HUD/结算/飘分/收集飞行/选关 | ✅ 现有（休闲批） |

## 3. 摆成数据的规则面

| 数据表 | 内容 | 谁解释它 |
|---|---|---|
| 关卡表（20 行） | 颜色数/带速/步或时限/星阈/seed/目标（清空·钥匙数·门目标值） | `flow` + `event-when`/`effect-apply` 胜负链 |
| **像素画位图**（每关一张） | 位图像素→像素块颜色 + 硬块 hp + 特殊件坐标（`key`/`door`） | `tilemap`（位图→格）+ 视图映射（色/皮） |
| 色炮配置 | 每炮弹药量、颜色集 | `launch` + `tray` config |
| 连击表 comboTable | 连击窗口/倍率阶梯 | `event-when`/`effect-apply`（计分链） |
| 突破规则 | 快连间隔阈值→容量 5→10 | `zone-occupancy` config + `event-when` |
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

- 提交人 / 日期：GD（game102 / Pixel Pour）/ 2026-07-23
- **⚖ Lead 裁决：✅ 裁 ①（2026-07-23）**——准以「**先组合表达·零运行时游戏层例外**」立项，**不预下沉 `conveyor-queue`**（manifesto §4 先重组 + YAGNI；registry 六件全在）。全文见工单 `requests.md` REQ-G102-CAPREVIEW（已完结）。
  - 三条时序疑点的组合摆法（Lead 给）：队首递进=`zone-occupancy`+`event-when` 到位边沿；突破 5→10=`event-when` 条件树切容量数据；弹尽入槽=`event-when`(`group-count`=0)→`tray`。
  - 附两条 ✅ 准：像素画视图走 render 组件（不手写 DOM）；balance-sim=authoring-time 工具。
  - 实机校准补充受理：钥匙/门= `event-when`+`resource`/`gauge` 表达；**位图棋盘 PE 落地核 `tilemap` 适配度**，不合再回工单报缺口。
- **可开工范围**：§1-3 数据面 + §4 组合装配（PE）。撞墙（组合真表达不了）→回工单升级引擎池走下沉，**在此之前零游戏层 system 代码红线不破**。
- 备注：`prototype.html` 为 GD 设计参考 mockup，非引擎实现。
