# 能力总览 Capability Plan — game-k《Zombie Slots · 僵尸老虎机》

> 按 CLAUDE.md「游戏能力总览铁律」立项。老虎机是引擎里的**新品类**（离散/事件驱动，非空间实时仿真）。
> 本 plan 论证：它由**现有 capability 组合 + 一个真缺口下沉**即可表达完整循环。
> 落地后用 `node scripts/game-skill-audit.mjs game-k` 核偏差。Lead（本 session·mainbranch）自裁决。

## 1. 游戏一句话

5×3 转轴、20 条赔付线的僵尸主题老虎机：按 SPIN 掷出符号网格，左起连消判赔付线（僵尸王=百搭代入），
生化=分散，≥3 触发 10 次免费旋转（线赢 ×2）。参照物：经典 5×3 视频老虎机（Book/Zombie 系列的核心循环：
下注→掷轮→判线→赔付→免费旋转）。美术走**迪士尼亲和（圆润大眼卡通轮廓）× 次表面散射（暖色内发光透出腐肉 + 边缘冷光）**。

## 2. 消费的引擎能力（对照 `capability-registry` 实名）

| capability（注册 id） | 用来做什么 | 状态 |
|---|---|---|
| `w1-random`（RandomSeed 整数 PRNG） | 世界单例种子随机源（转轴掷骰确定性·可回放） | ✅ 现有 |
| `t2-dice-roll`（DicePool→RolledDice） | **转轴**：15 颗骰（5×3 网格·列优先）按加权面掷出符号 → RolledDice；收到 `spin` 信号当拍掷 | ✅ 现有 |
| `t2-keybind`（InputQueue→Signal） | SPIN/BET± 按钮 action → Signal（`spin`/`betup`/`betdown`）→ dice-roll & slot-payout 消费 | ✅ 现有 |
| `f1-resource`（Resource） | 经济：balance / bet / win / freespins | ✅ 现有 |
| `t3-slot-payout`（SlotMachine→赔付+经济） | **判线赔付 + 老虎机经济**：读 RolledDice 网格→20 线左起连消（百搭代入）+ 分散计数→查赔付表→扣注/记赢/免费旋转→写 LineWins | ⏳ **本作下沉**（真缺口·见 §6） |

> UI：`LayoutNode` 34 控件闭集 + `mountUI`（HUD/下注条/中奖浮层·**UI 铁律·纯数据**）。

## 3. 摆成数据的规则面（每张表都有现成解释器·无虚胖数据）

| 数据表（theme.ts） | 内容 | 谁解释它 |
|---|---|---|
| `REEL_WEIGHTS`（5 列各一份加权符号带）→ DicePool 15 骰 | 每列符号权重（低分密·高分/百搭稀） | `t2-dice-roll`（禁游戏层自写掷轮/随机） |
| `PAYLINES`（20×5 行号） | 赔付线几何 | `t3-slot-payout`（禁游戏层自写连线扫描） |
| `PAYTABLE` / `SCATTER_PAY` | 连数→线注倍率 / 分散数→总注倍率 | `t3-slot-payout` |
| `START_BALANCE/BET_*/FREE_*/SCATTER_MIN` | 经济与免费旋转数值 | `f1-resource` + `t3-slot-payout` |

> 红线自检：**无「数据表 + 待写游戏层解释器」**——每张表的解释器都是现有 / 已下沉的 capability。

## 4. 申请的游戏层代码例外（逐条过审 · Lead=本 session 裁决）

| 例外 | 为什么现有能力表达不了 | 预计行数 | Lead 裁决 | 偿还计划 |
|---|---|---|---|---|
| `game-k.ts` mount/host 编排（建 Engine + QueuedInputSource + mountUI + 把 world 资源/RolledDice/LineWins 投影进 HUD 与转轴演出 + 重开 + 响应式缩放 + cleanup） | 「工程师写 mount/host 层」是契约明许的宿主代码（game-q/game-i 先例）；**不含任何玩法规则**（规则全在 blueprint 数据 + 能力） | ~330 | ✅ 准（常驻·同 game-q 宿主层） | 常驻 |
| **转轴渲染画布**（`game-k.ts` 自建 `<canvas>` + `art.ts` 程序化符号美术）：读 RolledDice/LineWins **outcome-first 投影**成 5×3 转轴演出（滚动/定格/中奖高亮） | 引擎 CanvasRenderer 面向**空间实体 Shape**；老虎机符号网格是「随每旋变化的数据读出」，用 render 组件绑 15 格变符号=不成比例（且逐旋换实体=破 hash）。本画布**纯读世界·绝不回灌 sim·不进 hash**（同 game-q host 的 readState/syncAudio 投影latitude） | ~180 | ✅ 准（表现层例外·基线登记 createElement×7） | 攒够同构（连线消除/连珠）后可下沉「符号网格渲染」capability |
| `hud.ts` / `blueprint.ts` / `theme.ts`（纯数据工厂：返回 LayoutNode / WorldBlueprint / 数值表） | 是**数据**不是系统代码；无自由玩法逻辑 | n/a | ✅ 准（本就是数据） | — |

> 审计红旗自检：裸 Math.random=**无**（sim 随机走 RandomSeed；转轴滚动演出按权重带**确定性**循环·无随机）；
> innerHTML=**无**；createElement=host 容器 6 + art 离屏烘焙 1（基线登记·表现层）；零能力接入=**否**（消费 5 能力）；零测试=**否**（game-k.test.ts 覆盖 蓝图纯数据/掷轮解算/确定性双跑/下注钳制/免费旋转经济/evaluateSlot 判线核/HUD 合法性）。

## 5. 确定性声明

- **随机源**：世界单例 `RandomSeed`（固定种子 `SEED`），转轴掷骰全走 `t2-dice-roll` 的整数 PRNG；序列逐旋进位 → 局内各旋结果不同，同种子+同动作序列 → 同 hash（`game-k.test.ts` 确定性双跑钉死）。
- **回放 / lockstep**：sim 全整数/枚举；`t3-slot-payout` 纯整数线扫描、零随机；`runsAfter:['resource-apply']` 打破与 resource-apply 的 RMW 伪环、定序确定。
- **非确定性风险点**：转轴滚动/中奖高亮/浮层皆**宿主表现层**（performance.now 驱动·纯 CSS/canvas），不被任何 Condition 读、不进 hash → 不破确定性。渲染层不回灌 sim。

## 6. 真缺口 · 下沉记录（`t3-slot-payout`）

- **缺口**：`t2-dice-roll` 只把符号网格掷进 `RolledDice`、`w1-random` 只给整数——没有「按赔付线**左起连消**（百搭代入）+ 分散计数 → 查赔付表 → 扣注/记赢/免费旋转经济」的能力。这是带**有序线扫描 + 前缀连数 + 百搭代入**的算法，`Condition→Event→Effect` / `group-count` 聚合都表达不了（周期表缺的「Line-Eval」格，同 match3-board/poker-hand 的下沉理由）。
- **下沉**：`t3-slot-payout`（tier3 解释器·确定性·零随机）。**通用性**：任何老虎机 / 连线消除 / 连珠计分都消费它——非 game-k 专属。分工严守 manifesto：掷轮=dice-roll、触发=Signal、经济态=Resource，本能力只补「判线赔付 + 老虎机记账」真缺口。纯判线函数 `evaluateSlot` 另导出供单测。
- 注册：`src/skills/tier3/{slot-payout.ts,index.ts}` + `capability-registry.ts`；组件 `SlotMachine`/`LineWins` 在 `protocol/components/cardboard.ts`。

## 评审记录

- 提交人 / 日期：mainbranch session · 2026-07-10
- Lead 裁决：✅ 通过。理由：完整循环 ~90% 由现有能力（dice-roll/keybind/resource/random）组合，唯一真缺口「判线赔付」下沉为**通用可复用** capability（非游戏专属），转轴渲染作表现层例外并基线登记。绿灯门禁（tsc + vitest 2374 + build）全绿。
