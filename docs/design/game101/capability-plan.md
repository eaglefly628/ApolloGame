# 能力总览 Capability Plan — game101《海港绯闻》(Merge & Story 复刻)

> 复制自 `docs/design/capability-plan-template.md` 填写。**代码游戏**（src/games/game101 将有装配/胶水层代码）→ 本 plan 须交 Lead 评审过审后才许写游戏层代码。
> 落地后用 `node scripts/game-skill-audit.mjs game101` 核对偏差。
> **GD-101 视角判断：合并玩法与本引擎现有能力高度契合，绝大部分可数据表达；仅 4 处待确认缺口（§2.5），倾向"组合现有能力"或"下沉通用能力"，尽量不写 game101 私有 system。**

---

## 1. 游戏一句话

Merge-2 合并板 + 视觉小说剧情 Meta 的休闲复刻（对标 **Gossip Harbor: Merge & Story**）：点生成器耗体力→合并→交订单→攒星星→推进剧情/装修。

## 2. 消费的引擎能力（对照 `capability-registry` 实名）

| capability（注册名） | 用来做什么 | 状态 |
|---|---|---|
| `t3-merge-rule`（merge-rule） | **核心**：N 换 1 合成。每条物品链每级挂一条 `MergeRule{template, need:2, into, intoOverrides?}`；跨级连锁；封顶=不写最高级规则。确定性（distinct-seq·最老先合·localId 锚点） | ✅ 现有 |
| `t2-grid-drag-square`（grid-drag-square） | 合并棋盘方格网格 + 拖动落格 | ✅ 现有 |
| `t2-drag-place` / `drop-zone` | 拖物到目标（合并落点 / 订单交付区） | ✅ 现有 |
| `prefab-spawn` / `k1-spawn` | 生成器产出物品（prefab 展开·带 PrefabOrigin 戳供 merge-rule 计数） | ✅ 现有 |
| `t2-clickable`（clickable） | 点击生成器 / 点破气泡 / 点交付 | ✅ 现有 |
| `f1-resource` / `resource-apply` | 体力 / 金币 / 星星 / 宝石 / **经验（升等级）** 作为资源 + 增减；泡泡购买扣金币；订单发经验 | ✅ 现有 |
| `e1-timer` / `timer-advance` | 体力按 tick 恢复（每 2min +1）；生成器冷却 / 免体力生成器产能条 | ✅ 现有 |
| `w1-random`（种子 PRNG） | 生成器掉落表随机（**游戏层禁裸 Math.random**·REQ 硬线） | ✅ 现有 |
| `t2-event-when`（event-when） | 触发器：订单可交付 / 剧情任务完成 / 装修节点满足 → 发信号 | ✅ 现有 |
| `t2-effect-apply`（effect-apply） | 交付/完成后发奖（+金币/星星/能量）、置解锁 flag、切场景态 | ✅ 现有 |
| `t3-timeline` / `timeline` | 演出编排：合并迸发、交付飞行、气泡破裂、奖励入袋（juice） | ✅ 现有 |
| `f2-flag` | 气泡锁（locked flag）、装修解锁态、章节/Day 进度位 | ✅ 现有 |
| `craft-recipe`（t2-craft-recipe） | 候选：订单交付=消耗棋盘物→产出资源；装修=消耗星星→产出解锁（见 §2.5 待确认） | ⏳ 待确认适配 |
| `t2-modifier-stack`（modifier-stack） | 可选：生成器升级/加成对掉落表的修正 | ✅ 现有（可选） |
| `dialogue` | 视觉小说剧情演出（立绘 + 名条 + 对白 + 打字机 + 跳过/自动） | ✅ 现有 |
| LayoutNode 控件闭集（`src/ui/components`） | 全部 HUD / 面板 / 菜单（**禁手写 DOM/React 屏**） | ✅ 现有 |

## 2.5 缺口（需确认能否组合表达，否则**下沉成通用能力**·非 game101 私有 system）

> 遵 manifesto §4：先重组现有能力；表达不了才下沉成通用、可复用、审计过的 capability（加在引擎，不在游戏层写 system）。以下 4 项请 Lead 裁"①组合表达 / ②下沉通用能力 / ③游戏层例外"。

| # | 缺口 | 倾向方案 | 待 Lead 裁 |
|---|---|---|---|
| G1 | **生成器点击的"耗体力→按掉落表产出"门控编排**：点击时若体力≥cost 则扣费并 `w1-random` 抽掉落表 → `prefab-spawn`；不足则拒绝 | `clickable`+`event-when`(条件:体力≥cost)+`effect-apply`(扣费)+`w1-random`+`prefab-spawn` 组合。若"条件门控扣费"表达不顺 → 下沉通用 `tap-cost-spawn` | ？ |
| G2 | **订单交付 = 消耗棋盘上某模板的一个实例 → 发奖**（普查/消耗棋盘实例） | `drop-zone`+`craft-recipe`（消耗输入实例→产出资源增量）。需确认 craft-recipe 能消耗"带 PrefabOrigin 的棋盘实例"并产出"资源"。否则下沉通用 `order-fulfill` | ？ |
| G3 | **泡泡（气泡锁）金币购买**：新产出物 locked；点泡泡→**扣金币**（按等级 `bubbles.json`）→清锁才可合并/拖动（owner 金币回收出口） | `f2-flag`(locked)+`clickable`+`resource-apply`(扣金币·不足则拒)。需确认 `merge-rule`/`drag-place` 尊重 locked flag。若不尊重 → 提 requests 让相关能力读该 flag | ？ |
| G4 | **生成器冷却 CD**（owner·产出后冷却 N 秒）+ **免体力生成器产能条**（capacity 自然恢复） | `timer-advance`（点击后置 CD·冷却中 `clickable` 拒绝）+`f1-resource`（把"产能"做成局部资源）。倾向组合表达；若"点击后置冷却门控"不顺 → 并入 G1 的 `tap-cost-spawn` 一并下沉 | ？ |

## 3. 摆成数据的规则面

| 数据表 | 内容 | 谁解释它 |
|---|---|---|
| `MERGE_CHAINS`（每链每级一条 MergeRule need:2 into 次级） | 物品链（食材/渔获/工具/能量/货币…） | `t3-merge-rule`（不许游戏层自写合成解释器） |
| `GENERATOR_CATALOG`（energyCost / dropTable / cooldownSec / capacity?） | 生成器目录（含咖啡机/冰箱·CD） | `prefab-spawn`+`w1-random`+`f1-resource`+`clickable`+`timer-advance`（G1/G4 待裁） |
| `BUBBLE_COST`（coinCostByLevel） | 泡泡金币购买价 | `resource-apply`+`f2-flag`+`clickable`（G3 待裁） |
| `PLAYER_LEVELS`（expToNext / unlocksByLevel） | 经验升等级 + 解锁 | `f1-resource`+`event-when`+`effect-apply` |
| `ENERGY_CONFIG`（cap=100 / regen=1 per 2min / sources） | 体力 | `f1-resource`+`timer-advance` |
| `ORDER_CATALOG`（needItem / reward: exp+coins+stars+energy） | 角色气泡订单 | `event-when`+`effect-apply`（或 `craft-recipe`·G2 待裁） |
| `STORY_DAYS`（每 Day 任务清单：costStars / needItem → unlock） | 剧情任务 / Day 推进 | `event-when`+`effect-apply`+`f2-flag`（或 `craft-recipe`·G2 待裁） |
| `DIALOGUE_SCRIPT`（说话人 / 立绘 / 表情 / 对白 / 可选二选一） | 视觉小说演出 | `dialogue` |
| `RENOVATION_NODES`（costStars → unlock flag → 场景皮肤切换 / 风格可选） | 装修 Meta | `event-when`+`effect-apply`+`f2-flag`+ Sprite 皮肤槽 |
| `JUICE_TIMELINES`（合并/交付/破泡/发奖 序列） | 演出 juice | `t3-timeline`+`effect-apply` |
| LayoutNode UI 树（HUD/订单栏/任务栏/装修/剧情 chrome） | 全部界面 | LayoutNode 渲染器 |

> 红线自查：以上每张表**都指向现有 capability 作解释器**，无"数据表 + 待写游戏层解释器"的虚胖数据；仅 §2.5 四项缺口待裁（未过审前不写对应游戏层代码）。

## 4. 申请的游戏层代码例外（逐条过审）

| 例外 | 为什么现有能力表达不了 | 预计行数 | Lead 裁决 | 偿还计划 |
|---|---|---|---|---|
| game101 装配/场景胶水（manifest 加载、板初始化、HUD↔资源绑定、场景切换） | 各游戏都有的薄装配层（非玩法逻辑）；照现有游戏样板 | ~60–120 | ？ | 无（薄胶水·随基座演进） |
| §2.5 G1–G4 若判"下沉通用能力" | — | — | ？ | **优先下沉为通用 capability（走 requests.md 提 LEAD），不作 game101 私有 system** |

> 承诺：除上表外无游戏层自由代码。审计红旗（裸 Math.random / innerHTML / createElement / 零能力接入 / 零测试）不申请为例外。若 §2.5 缺口最终判"下沉"，则它们成为引擎通用能力、不进本表。

## 4.5 美术接入（必填）

- **皮肤槽清单（主体视觉实体必须有槽）**：
  - 物品（每条链每级一个 `Sprite` 皮肤槽·食材/渔获/工具/能量/货币链）；
  - 生成器（点击型 ×3 起，各含 default/按下/产出态）；免体力生成器（含产能环）；
  - 角色（订单小头像 ×5·剧情立绘含表情差分·女主 4 表情起）；
  - 场景（合并板底纹/操作台、剧情背景 CG、装修场景修复前后、世界地图）；
  - 气泡锁通用蒙层、货币/资源小图标、UI 组件皮肤。
- **台账产出**：编译期游戏 → 照 game-q 样板写推导脚本（脚本名：`__待定__`，M1 接线时定并回填）；素材优先从共享库 vendor（走 `resource-manager` 技能）。
- **程序化观感**：可作皮肤就绪前的回退，**皮肤就绪即盖过**；不走"全程序化=美德"旧叙事。
- **设计稿**：UI 布局用真 LayoutNode 库出（`layout/`·纯数据·见 `ui-brief.md`）；主体视觉实体带皮肤槽，art 就绪即盖过程序化观感。

## 5. 确定性声明

- **随机源**：一切随机（生成器掉落表）走 `w1-random` 种子 PRNG；**游戏层禁裸 Math.random**。seed 从局初始化注入。
- **合并确定性**：`merge-rule` 本身确定（distinct-seq 计数、最老先合、localId 字典序锚点）。
- **实时体力恢复**：体力按 `timer-advance` tick 恢复，实时（挂钟）是外部输入——单机休闲，**无 lockstep / 无联机 / 无强回放需求**；若做录制回放，需把挂钟时间戳记为输入（非核心，M1 不做）。
- 结论：核心玩法（合并/掉落/发奖）确定可测；仅"实时体力恢复"依赖挂钟，隔离在 timer 输入层。

## 6. 评审记录

- 提交人 / 日期：GD-101 / 2026-07-23
- **Lead 裁决：✅ 过审（v1·2026-07-23·核过 registry + craft-recipe/merge-rule/drag-place 源码）——零预下沉·PE-101 可开工 M1（REQ-101-04）**
  - **§2.5 G1 生成器 tap-cost-spawn → ① 组合表达**（不下沉）。门控+扣费=`clickable`+`event-when`(体力≥cost)+`effect-apply`(扣费)；**掉落表加权抽必用引擎加权抽原语**（复用 `draft-offer` 加权核·n=1·空 state 退化为纯加权抽；或 Lead 抽出共享 `weightedPick` 纯函数）·**禁游戏层手写加权/裸 Math.random**；产出=`prefab-spawn`；编排在薄胶水串接。撞墙→回报下沉 `tap-cost-spawn`。
  - **§2.5 G2 订单交付 order-fulfill → 先试组合·撞墙即下沉**（不预下沉）。**`craft-recipe` 确认不适配**（核源码：costs/gains 只吞/产**资源计数**·不吞棋盘**实体实例**）。试组合=`drop-zone`(drag-place)+`event-when`(投放物模板==订单 needItem)+`k2-destroy`(销毁该实例)+`effect-apply`(发奖)。**风险**：event-when 能否引用「被投放的那个具体实例」并干净销毁待 M1 实证；**表达不了→下沉薄 `order-fulfill`**（投放匹配→消耗该实例+发奖·通用于合并/交付游戏）。
  - **§2.5 G3 泡泡锁 → ① 组合表达·推荐 bubble-wrapper**。核过 merge-rule/drag-place **当前不读任何 lock flag**。**推荐**：把锁建模成**独立泡泡实体**（generator 产 `bubble(itemX)`·非 itemX 本体）→点泡泡+扣金币(`clickable`+`resource-apply`)→`k2-destroy`泡泡→`prefab-spawn` 真 itemX；merge-rule 按模板匹配·泡泡天然不参与合并·**零引擎改动**。**备选**（团队要「就地锁 flag」）：给 merge-rule+drag-place 加「读标准 `Locked` flag·锁定实体跳过」小加性守卫（缺 flag=现行为·零回归·可复用）=引擎域小扩展·Lead 做。**owner/GD 二选一**。
  - **§2.5 G4 冷却+产能 → ① 组合表达**。CD=`timer-advance`置冷却+`clickable`冷却期拒；产能=`f1-resource`局部资源。撞墙→并入 G1 复议。
  - **§4 装配胶水 → 准 ≤120 行**（manifest 加载+板初始化+HUD↔资源绑定+场景切换·纯装配非玩法）。**红线**：胶水里**禁**手写加权抽/门控/合成/交付解释器（G1 加权走原语·G3 泡泡走实体+destroy·G2 走组合或下沉件）；超 120 行=藏 solver 信号→回报 Lead。
  - **唯二可能触发引擎动作**（都**撞墙/选路后**才走引擎池占槽·不预占）：① G3 若走 flag 路（Lead 加 lock 守卫）；② G2 若撞墙（Lead 下沉 `order-fulfill`）。
  - 装配胶水豁免范围=上「§4 ≤120 行」；除此 PE-101 无游戏层自由代码（审计红旗照旧不豁免）。
