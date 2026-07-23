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
| `f1-resource` / `resource-apply` | 体力 / 金币 / 星星 / 宝石作为资源 + 增减 | ✅ 现有 |
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
| G3 | **气泡锁**：新产出物 locked，点击解锁后才可合并/拖动 | `f2-flag`(locked)+`clickable`(clear flag)。需确认 `merge-rule`/`drag-place` 尊重 locked flag（不合并/不可拖被锁物）。若不尊重 → 提 requests 让相关能力读该 flag | ？ |
| G4 | **免体力生成器产能条**（capacity 自然恢复、耗尽停产） | `timer-advance`+`f1-resource`（把"产能"做成生成器局部资源）组合 | ？ |

## 3. 摆成数据的规则面

| 数据表 | 内容 | 谁解释它 |
|---|---|---|
| `MERGE_CHAINS`（每链每级一条 MergeRule need:2 into 次级） | 物品链（食材/渔获/工具/能量/货币…） | `t3-merge-rule`（不许游戏层自写合成解释器） |
| `GENERATOR_CATALOG`（energyCost / dropTable / capacity?） | 生成器目录 | `prefab-spawn`+`w1-random`+`f1-resource`+`clickable`（G1 待裁） |
| `ENERGY_CONFIG`（cap=100 / regen=1 per 2min / sources） | 体力 | `f1-resource`+`timer-advance` |
| `ORDER_CATALOG`（needItem / rewardCoins/Stars/Energy） | 角色气泡订单 | `event-when`+`effect-apply`（或 `craft-recipe`·G2 待裁） |
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
- **设计稿**：claude designer 出 `.dc.html`（见 `ui-brief.md`）作 1:1 复刻基准；**界面必须 LayoutNode 重做，禁直接挪用交付 HTML**。

## 5. 确定性声明

- **随机源**：一切随机（生成器掉落表）走 `w1-random` 种子 PRNG；**游戏层禁裸 Math.random**。seed 从局初始化注入。
- **合并确定性**：`merge-rule` 本身确定（distinct-seq 计数、最老先合、localId 字典序锚点）。
- **实时体力恢复**：体力按 `timer-advance` tick 恢复，实时（挂钟）是外部输入——单机休闲，**无 lockstep / 无联机 / 无强回放需求**；若做录制回放，需把挂钟时间戳记为输入（非核心，M1 不做）。
- 结论：核心玩法（合并/掉落/发奖）确定可测；仅"实时体力恢复"依赖挂钟，隔离在 timer 输入层。

## 6. 评审记录

- 提交人 / 日期：GD-101 / 2026-07-23
- Lead 裁决：⬜ 待评审（本 plan v1 草案）
  - 请重点裁：§2.5 G1–G4 走"组合表达 / 下沉通用能力 / 游戏层例外"哪条；§4 装配胶水行数上限。
  - 未过审前：PE-101 不得写 game101 游戏层系统代码（装配胶水待 Lead 明确豁免范围）。
