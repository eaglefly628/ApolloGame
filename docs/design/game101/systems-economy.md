# game101 · 系统与经济设计（Systems / Economy · Merge-2 深水层）

> 来源：owner 2026-07-23 提供的《Gossip Harbor》Merge-2 系统拆解（5 系统）。GD-101 按**数据驱动宣言 + 架构评判**处理：机制落成数据 schema + 映射现有能力；**激进的商业化/心理施压调参与本期 In-Scope（核心 gameplay）分离、延后并标注**；真缺口报 Lead。
> 口径尺子：我们复刻**机制深度**（可玩性/空间博弈），**不默认复刻 dark-pattern 调参**（次数劣化逼买体力 / gem 损失厌恶 / 对抗性卡点）——那些进 monetization/liveops 阶段、需 owner 明确拍板 + 合规权衡。

## 0. 评判总表（先评判「该不该做 / 怎么做」）

| # | 系统 | 机制可数据表达? | 消费能力 | 裁决 | 范围/伦理标注 |
|---|---|---|---|---|---|
| 1 | 产出漏斗（多链混产 + 差异掉率） | ✅ 纯数据 | `dropTable` 多链加权(`w1-random`) | **接受·数据** | 空间挤压→背包/格子扩容=空间变现；机制本期做，付费扩容延后 |
| 2 | 生成器次数劣化（Usage Regression） | ✅ 数据 + 微能力 | 生成器带 `charges`(每点 -1) + `merge-rule` 升级设新 charge | **接受机制**；**劣化调参=商业化·延后** | 故意降效逼买体力=施压设计·标注 |
| 3 | 复制泡泡（损失厌恶 + 废料回收） | ✅ 数据 + G3 扩 | `f2-flag`+`timer-advance`(TTL)+`resource-apply`(gem/coin 买)+`event-when`(到期→coin) | **接受机制**；**gem 损失厌恶定价=商业化·延后** | 30s 倒计时 + gem 抢购=心理施压·标注 |
| 4 | DDA 订单（棋盘态自适应 + 情绪曲线） | 🟡 半 | 情绪曲线=**数据模板**(接受)；棋盘态自适应=**需 census+规则选择器·真缺口** | 情绪节奏**接受·数据**；自适应卡点=**缺口 G5/延后** | 对抗性卡点(专门卡玩家)=操纵·延后 + 伦理标 |
| 5 | 蛛网物品（区域解封·Onboarding） | ✅ 纯数据 + G3 类 | `webbed` flag(`f2-flag`·不可拖) + `event-when`(解封条件) + grid 尊重 flag | **接受·数据** | 引导型·正向·空间即奖励·OK |

> 复诵：**机制=数据（现在建）；激进变现调参=延后（Out of Scope·标注）；真缺口=报 Lead**。

---

## 1. 产出漏斗（多链混产）— 接受·纯数据

**机制**：一个生成器 `dropTable` 混多条链、按需求量反向配掉率（主线高、副线低）；副产物在棋盘堆积、玩家舍不得卖 → 挤占空间。

**数据（扩 `generators.json`）**：
```json
{ "id":"gen_grocery","energyCost":1,
  "dropTable":[ {"item":"bread_1","w":55}, {"item":"bread_2","w":20}, {"item":"tea_1","w":18}, {"item":"tea_2","w":7} ] }
```
- 解释器=`w1-random` 加权抽样（**纯数据·零新能力**）。空间挤压是掉率×链长的**涌现结果**，不需要专门系统。
- **范围**：空间挤压→"背包/格子扩容"是**空间变现**点；本期做**空间约束机制**（格子有限），付费扩容（宝石解格）=商业化·延后。

## 2. 生成器次数劣化（Usage Regression）— 接受机制·劣化调参延后

**机制**：生成器有**有限点击次数**（charges）；两个低阶合成一个高阶后，**总 charges 变少**（40→28）但单产更高阶 → 前期"升级变强"爽感、中后期总产量降 → 体力/节奏吃紧 → 转化付费。

**数据（生成器带产能·扩 `generators.json`）**：
```json
{ "id":"gen_coffee_5","charges":20,"rechargeSec":0,
  "dropTable":[{"item":"coffee_1","w":100}],
  "mergeInto":"gen_coffee_6" }
{ "id":"gen_coffee_6","charges":28,
  "dropTable":[{"item":"coffee_1","w":85},{"item":"coffee_2","w":15}] }
```
- 消费能力：生成器实例带 `charges`=**每实例局部资源**(`f1-resource`)，点一次 `effect-apply` -1，0 则耗尽（可 `rechargeSec` 恢复=`timer-advance`）；升级走 `merge-rule`（`gen_coffee_5`×2→`gen_coffee_6`·`intoOverrides` 设新 charges）。→ 并入缺口 **G4**（生成器产能/CD）。
- **裁决**：产能机制**接受**（可玩·就是"果树/免体力生成器"的一般化）。**"故意让总期望下降以逼买体力"= 商业化调参·延后**——本期数值按"公平"配（升级=净增益或持平），激进劣化留给 monetization 阶段 + owner 拍板。

## 3. 复制泡泡（损失厌恶 + 废料回收）— 接受机制·gem 定价延后

**机制**：合高阶物时**随机**冒出一个"复制泡泡"，内含刚合出的稀有物**复制品** + 30s 倒计时：花 gem 买下=白赚一个；不买→到期塌成 1 金币（把"定时空间垃圾"回收成可消除资源，棋盘不死锁）。

> 注意：这与第 §基础的「产出锁泡泡」(G3·新产物 locked·金币开)是**两种泡泡**。本条=**复制泡泡(copy bubble)**。

**数据（`bubbles.json` 扩）**：
```json
{ "copyBubble": {
    "spawnChanceByLevel": {"5":0.08,"6":0.12},   // 合高阶时冒复制泡泡概率
    "ttlSec": 30,
    "buyCost": {"gem": 20},                        // 花 gem 抢购=复制品
    "expirePayout": {"coins": 1}                   // 到期塌成 1 金币(废料回收)
  } }
```
- 消费能力：`event-when`(合成 ≥5 级 → `w1-random` 掷 spawnChance → 生成 copyBubble 实体带 `f2-flag`+`timer-advance` TTL) → `clickable`+`resource-apply`(花 gem 买=释放复制品) → TTL 到 `event-when`→`effect-apply`(替换成 1 金币)。→ 并入缺口 **G3**（泡泡·现扩 TTL/gem/expiry/copy）。
- **裁决**：**废料回收窗**（到期→金币·保棋盘不死锁）= 好机制·**接受**。**"gem 损失厌恶抢购"定价 = 商业化·延后**——本期可先只做"金币锁泡泡"(G3)+"复制泡泡到期回收金币"，gem 抢购定价进 monetization 阶段。

## 4. DDA 订单（棋盘态自适应 + 情绪曲线）— 拆两半

**机制 A·情绪曲线（一难多易）**：大订单（高挫败/高多巴胺）后紧跟 3–4 个 1–3 级"肉鸡订单"给正反馈 → 粘性。
**机制 B·棋盘态自适应卡点**：后台读棋盘存量（如卡了个 8 级海鲜没用途）→ 故意刷 9 级海鲜需求。

**A = 数据模板·接受**（`orders.json` 加节奏序列）：
```json
{ "orderRhythm": { "pattern": ["big","easy","easy","easy","mid","easy"], "easyMaxLevel": 3, "bigMinLevel": 6 } }
```
- 解释器：一个**预设难易序列**发单器（读 pattern·不读棋盘）→ 现有 `event-when`/计数即可驱动。**纯数据·接受**。

**B = 真缺口 G5·或延后**：读棋盘 census → 按规则加权选订单，是**自适应选择器**。游戏层自写解释器=**虚胖数据(禁·manifesto §3 红线)**。
- 选项：① **下沉通用 `order-director` capability**（输入=棋盘存量 census + 规则权重·输出=确定性选单·可回放）；② 本期只做 A（数据模板·够原型）；③ 延后。
- **裁决/建议**：**本期做 A**（数据模板足够撑核心体验）；**B 报 Lead 评估是否下沉 `order-director`**（记 capability-plan §2.5 G5）；**"对抗性卡点"（专门刷你差的那级去卡你）延后 + 伦理标**——那是留存操纵，非核心可玩性，上线需权衡口碑/合规。

## 5. 蛛网物品（区域解封 / Onboarding）— 接受·纯数据

**机制**：新区域格子被灰蛛网罩住、**不可拖动/不可用**；玩家在有限可用格里合出指定物去"解封" → 释放该片棋盘空间。空间约束→努力→释放空间的循环，让**空间本身成为核心奖励**。

**数据（新 `webbed.json`）**：
```json
[ { "region":"kitchen_east","cells":[[5,6],[6,6],[5,7],[6,7]],
    "unlock":{"needItem":"tool_4","qty":1},  // 或 costStars
    "story":"script_unlock_east" } ]
```
- 消费能力：蛛网格=`f2-flag`(webbed·`grid-drag-square`/`merge-rule` 尊重此 flag=不可拖/不落子·**同 G3 的"尊重锁 flag"**) + `event-when`(交指定物/花星 → 清 region 的 webbed flag → 格子可用) + 可选 `dialogue` 演出。**纯数据·接受**。
- 与"空间管理博弈"(gdd §6)同源：这是空间奖励的**引导化包装**·正向设计。

---

## 5.5 挖掘式区域解锁（阻碍层·二消清邻·**核心乐趣**）— owner 2026-07-25 追加·接受

> owner 2026-07-25 交参考图（Gossip Harbor 实机·**IP·不入库**）+ 口径：**「每一格除了消除还有一个锁定/阻碍状态；当你二消时，周边 9 格（3×3）都产生把阻碍状态 −1 的效果；减到 0 再解锁露出格内的东西。这是核心乐趣之一。」**

**机制（挖掘感）**：开局整板大半被**阻碍层**（沙层/脆饼纹·带 🔒）盖住、不可用；玩家在**可用区二消**（合并）→ 该合并格的 **3×3 邻格阻碍层各 −1** → 某格减到 0 → **清层解锁**，露出格内预置内容（L1 物 / 能量包 ⚡ / 宝箱 / 宝石 💎 / 特殊物）。可用空间随游玩**渐进挖开**——**每次合并身兼两职（爬链 + 挖板），空间即奖励**。这正是让心流"停不下来"的加成器：合并不只升级，还在开图。

**与 §5 蛛网的区别（两种解锁·并存·非重复）**：
- §5 蛛网/区域解封 = **目标导向**：交指定成品/花星 → 整片解封（章节引导）。
- §5.5 挖掘阻碍层 = **过程涌现**：任意二消 → 周边 3×3 阻碍 −1 → 归零自解（每步都在挖·组织度奖励）。

**数据（新 `board-cover.json`·纯数据）**：
```json
{
  "coverSprite": "cover_sand",           // 阻碍层皮（沙/脆饼·美术槽·分层可用不同磨损帧）
  "decPerMerge": 1,                      // 每次二消给 3×3 邻格阻碍 −1（可配）
  "radius": 1,                           // 影响半径（1 = 3×3·数据可调）
  "cells": [
    { "cell": 3,  "layers": 2, "reveal": { "kind": "item",   "item": "coffee_1" } },
    { "cell": 5,  "layers": 3, "reveal": { "kind": "energy",  "amount": 20 } },
    { "cell": 6,  "layers": 1, "reveal": { "kind": "chest",   "chest": "chest_small" } },
    { "cell": 55, "layers": 4, "reveal": { "kind": "gem",     "amount": 1 } }
  ]
}
```
- 每个覆盖格 = 带 `Blocker{layers, reveal}` 组件的实体（`layers`=剩余阻碍层数·`reveal`=归零露出物）。
- 覆盖格**不可拖/不可落子**（同 §5「尊重锁 flag」）；`layers==0` → 清层 + 按 `reveal.kind` 产出（`item`→prefab 展开 / `energy`·`gem`→resource-apply / `chest`→开箱子流程）。

**能力判断（架构评审·重要·别在游戏层手写扫格）**：
- ✅ **可组合部分**：阻碍层 = `Blocker` 组件（数据）；覆盖格不可拖 = 同 §5「尊重锁 flag」；归零解锁 = `event-when`(layers==0) + `destroy`(清层) + `caster/prefab`(露物) / `resource-apply`(露能量/宝石)。
- 🔴 **真缺口 = G6（需下沉·非游戏层）**：**「二消(`merge-on-place`)在 cell C 发生 → 对 C 的 3×3 网格邻格 `Blocker.layers` 各 −1」** 这步**空间邻格效应**。原语已备（`spatial-query.queryRange` 半径查询）、同型逻辑已证（`match3-board` 清格→`neighbors4`→减邻格 `blockers`·source line 527「格层减层」），但 **`merge-on-place` 无此挂钩**。**禁**在游戏层/宿主手写"扫 3×3 减邻格"solver（manifesto §3 红线·且宿主非确定性 sim）→ **下沉通用能力**（capability-plan §2.5 **G6**）。

---

## 6. 真缺口 → capability-plan §2.5 G5 / **G6**

**G5 · 订单导演 order-director（棋盘态自适应发单·DDA-B）**：读棋盘存量 census + 规则权重 → 确定性选订单。倾向**下沉成通用能力**（可回放·可测）；未下沉前本期用 §4-A 情绪曲线数据模板替代。对抗性卡点延后。

**G6 · 二消邻格清阻碍 merge-proximity-clear（§5.5·挖掘解锁·核心乐趣）**：merge-on-place 合并事件 → 对 3×3 网格邻格 `Blocker.layers` 各 −1，归零发解锁信号。`queryRange` 原语 + `match3-board` 同型逻辑已存在，倾向**下沉通用能力**（或作 merge-on-place 姊妹件）——游戏层只摆 `board-cover.json` 数据。**报 Lead 裁下沉。**

其余全部落在**已有能力 + 已列缺口**：多链掉率(w1-random)、生成器 charges/劣化(G4)、复制泡泡 TTL/gem/expiry(G3 扩)、蛛网格(G3 类·grid 尊重 flag)。**无需为 1/2/3/5 新增游戏层 system**；G6 = 引擎域下沉（非游戏层 system）。

## 7. 范围 / 伦理口径（重要·owner 决策）

- 本期 **In-Scope = 核心 gameplay**（`brief.md`）；**商业化 / DDA-变现 = Out of Scope**。
- **策略**：机制**数据结构现在建**（引擎能表达这些深度）；**激进变现调参**（次数劣化逼买体力 / gem 损失厌恶抢购 / 对抗性卡点）**延后到 monetization/liveops 阶段·需 owner 明确拍板**——它们是心理施压设计，上线的合规与口碑要单独权衡，不默认开。
- 数值本期按**"公平/正向"**配（升级净增益、泡泡到期回收、情绪曲线给正反馈），把"施压漏斗"做成**可后期调参的开关**而非写死。

## 8. 落库指引

- 数据字段并入 `config-schema.md`：`generators`(多链 dropTable + `charges`/`rechargeSec`/`mergeInto`) · `bubbles`(copyBubble: ttlSec/buyCost/expirePayout) · `orders`(orderRhythm 模板) · 新 `webbed.json`。
- 缺口 **G5 order-director** 记 `capability-plan.md §2.5`（报 Lead）；G3/G4 注记扩 TTL/gem/charges。
- ✅ **已出 `economy-balance.md`**：体力/金币/星星/经验**单日产耗闭环** + 合成成本模型（taps→等级）+ KPI + 公平版 config 锚点。
