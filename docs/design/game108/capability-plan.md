# 能力总览 Capability Plan — game108《拳律 / Rule of Three》（S2 送审稿）

> Lead session · 2026-08-04 · 立项卡=`brief.md`（owner 2026-08-04 批）· 规则语义=`gdd.md`（条款 `【R-108-NN】`）。
> **形态 = 编译期 TS 游戏**（需局外元层：图鉴 / 每日种子 / 存档 + 多屏 UI）· slot = `game108`。
> **plan 未过审不写游戏层系统代码**（CLAUDE.md 能力总览铁律）。
> 能力名已对照 `src/skills/{atoms,tier1,tier2,tier3}` 真实 `id` 逐个核准（不手抄清单·口径以 registry 为准）。

## 1. 游戏一句话

手牌制猜拳爬塔 Roguelite：读对手性格与破绽出招，遗物**凿改 3×3 判定表本身**；精英/Boss 战叠加亮牌前加码与弃权。

## 2. 消费的引擎能力（对照 registry 实名）

| capability（注册 id） | 用来做什么 | 状态 |
|---|---|---|
| **`matrix-duel`**（暂名） | **同时决策 × 收益矩阵结算**：判定表 + 补丁 + 亮牌判定【R-108-01/02/03/30】 | ⏳ **需下沉**（`REQ-MATRIXDUEL`·本 plan 唯一缺口） |
| `t2-card-pile`（`CardPile`） | 牌库 12 / 手牌 5 / 抽补 / 弃牌区 / 确定性洗回【R-108-05/07】 | ✅ 现有 |
| `t2-card-play`（`PlayedHand`） | 「出哪张」命令流注入（玩家与 AI 共用一条动作总线）【R-108-10】 | ✅ 现有 |
| `t3-flow`（`GameFlow`） | 回合七拍 + 对局胜负收束 + 爬塔层进【R-108-10/40】 | ✅ 现有 |
| `t2-event-when`（`EventWhen`+`Signal`） | 条件成立发信号：AI 策略规则命中、HP≤0、tell 触发门【R-108-09/20/21】 | ✅ 现有 |
| `t2-effect-apply`（`Effect`） | 信号改世界：扣血 / 给洞察 / 给拳票 / 弃权罚【R-108-04/08/12/13】 | ✅ 现有 |
| `t2-craft-recipe`（`CraftRecipe`） | 花费换取：洞察点换窥视(1)/强制重出(3)、拳票押注【R-108-08/11】 | ✅ 现有 |
| `t2-weighted-spawn`（`WeightedSpawn`） | AI 按权重表确定性抽出招（消费世界 `RandomSeed`）【R-108-20】 | ✅ 现有（重组待 S3 验证·见 §4） |
| `t2-self-rule`（`SelfRule`） | 对手实体各自读自身状态施自身效（连胜计数 / 半血换段）【R-108-22】 | ✅ 现有 |
| `t2-modifier-stack`（`ModifierSource`+`ModifierTotals`） | 遗物对**收益**的加成聚合（重拳 / 纸甲 / 蓄力 +3）【R-108-31】 | ✅ 现有 |
| `t2-stats`（`Stats`） | 玩家/对手属性面（HP 上限·伤害修正基座） | ✅ 现有 |
| `t3-timeline`（`Timeline`） | 演出节拍：亮牌三连 cue / 石板改写演出（cue 只发信号）【S-04】 | ✅ 现有 |
| `t3-dialogue`（`Dialogue`） | 对手台词与 tell 台词的节点数据（UI 侧 `dialog`/`portrait` 投影消费）【R-108-21】 | ✅ 现有 |
| `t2-text-binding` | 数值→文案绑定（伤害数 / 拳票 / 洞察） | ✅ 现有 |
| `t2-clickable`（`Clickable`） | 世界侧点击发信号（如需要·UI 侧走 `action`） | ✅ 现有 |
| `w1-random`（`RandomSeed`）+ `seededShuffle`/`chancePass`/`randomInt` | **一切随机**：洗牌 / AI 抽招 / tell 概率门 / 窥视选牌【R-108-07/08/20/21】 | ✅ 现有 |
| `f1-resource` / `f2-flag` / `j1-state` / `e1-timer` / `x3-string-variable` | HP·洞察·拳票·弃权罚累加器 / 蓄力·加码旗 / 段位状态 / 节拍 / tell 文案键 | ✅ 现有（原子） |
| UI：`LayoutNode`（`ui/components`）+ `@ui/starters` | 全部屏（见 §4.6） | ✅ 现有 |
| 壳层：`engine/host`（`mountHost`+`createRunLoop`）· `services/persist` | 运行环 + 局外小态（图鉴/每日种子记录） | ✅ 现有公共件（禁手写） |

> 先例台：牌堆=`games/game-e/session.ts`（计分核·headless 可测）；数据化效果表=`games/game-e/jokers.ts`（`{op,target,value,when}` 声明式）；种子对掷=`games/game-g/clash-resolve.ts`；UI 达标=`games/game-g` 六屏 + `games/game-i`。

## 3. 摆成数据的规则面

| 数据表 | 内容 | 谁解释它（禁游戏层自写解释器） |
|---|---|---|
| `DUEL_MATRIX` | `{throws[], beats{}, payoff{}, tie{}}`【R-108-01~04】 | **`matrix-duel`**（待下沉） |
| `RELICS` | 12 件遗物 = 对上表的**数据补丁** + modifier 条目【R-108-31】 | `matrix-duel`（补丁字段）+ `t2-modifier-stack`（收益加成） |
| `OPPONENTS` | 5 名对手：HP / 策略表 / tell 参数 / 台词键【R-108-22】 | `t2-event-when`+`t2-weighted-spawn`+`t2-self-rule`+`t3-dialogue` |
| `DECK` | 牌库构成（默认 4/4/4·「断牌」改 3/3/3）【R-108-05】 | `t2-card-pile` |
| `LADDER` | 3 层 × (2 小怪 + 1 精英) + Boss + 层间回复【R-108-40】 | `t3-flow` |
| `SCREENS` | 六屏 LayoutNode 树【§9】 | `mountUI`（闭集控件） |

> 红线自查：**本表无一行是「数据表 + 待写的游戏层解释器」**——`DUEL_MATRIX`/`RELICS` 的解释器就是 §4 申请下沉的 `matrix-duel` 本体，过审前不动工（虚胖数据零容忍）。

## 4. 申请的游戏层代码例外（逐条过审）

| 例外 | 为什么现有能力表达不了 | 预计行数 | Lead 裁决 | 偿还计划 |
|---|---|---|---|---|
| **无** | 游戏层只有：蓝图装配 + §3 数据表 + LayoutNode 屏构造 + `engine/host` 壳接线 —— 均非自由规则代码 | — | — | — |

**唯一缺口走下沉，不走例外**：

### `matrix-duel`（引擎池 `REQ-MATRIXDUEL`·Lead 拟 spec）

- **做什么**：`DuelMatrix{throws[],beats{},payoff{},tie{},patches[]}` + 双方 `DuelIntent{throw}` → 双方 intent 齐备即结算：查表定胜负 → 发具名 `Signal` + 写 `ResourceModify`（伤害/附带效果）→ 清 intent。补丁按序在对局开始时确定性套用。
- **为什么不能重组**：`ConditionExpr` 的 `id` 是**静态**的，无法按「本回合两侧出招」动态查表。三手可以硬写 9 条 `event-when` 规则，但① 遗物**运行时改写**判定表、② 遗物**增设第四手**（3×3→4×4）——静态规则集表达不了。放弃它 = 放弃本作签名机制【R-108-30/31·遗物 1 与 4】。
- **为什么值得进引擎**（通用性）：任何**同时决策收益矩阵**对决都吃它——猜拳全部变体（含蜥蜴斯波克）、田忌赛马、押注对决、石头剪刀布式的战棋兵种相克。确定性（纯整数查表）、可审计、可回放。
- **不做什么**（防加宽）：不含 AI 策略、不含手牌、不含押注——那些由现有能力承担。

**S3 首个验证项（写进骨架关待办）**：AI 策略表用「`t2-event-when` 条件命中发信号 → `t2-weighted-spawn` 按权重表确定性抽出招」重组【R-108-20】。互斥条件若不可维护，**走 capgap 提单等裁决，不在游戏层自写选招器**。

## 4.5 美术接入

- **皮肤槽清单**：① 三手牌面 → `PlayingCard.faceArt`（+`backArt` 牌背）；② 对手立绘 → `portrait.art`（`emotion` 变体：常态/得意/受创/摊牌）；③ 规则石板 → `Panel.skin`(+`skinSlice` 9-slice)；④ 遗物图标 → `Card.media`；⑤ 按钮皮 → `UITheme.buttonSkins`（一 kind 一皮·不逐个塞）；⑥ 背景/面纹 → `UITheme.texture`/`panelTexture`。
- **台账产出**：编译期游戏 → 照 `scripts/game-g-art-requirements.mjs` 样板写推导脚本（脚本名：`scripts/game108-art-requirements.mjs`）。
- **首版占位**：程序化牌面/石板 + 立绘占位（`portrait` 缺图自动落名首字占位，不空白）；**占位不是美德**，台账保号，风格锚到位即逐行替换。
- **文生图**：对手立绘走风格包锚（PA 出「暗调拳馆」锚）；如实披露 AI 生成。

## 4.6 UI 呈现 · 华丽起手

- **house 主题**：**`apolloOnyx`「玄铁」**（apollo-kit·暗金属 + 钢蓝 + 熔岩橙点睛·对硬核心理战）。**不自写 UITheme**。若风格锚最终落「织金拳馆」→ 换 `apolloBrocade`，改一个参数、布局零返工。
- **起手包**：主菜单 `buildStarterHome`、结算 `buildStarterResult`（`@ui/starters`）——**不从空白搭朴素屏**。
- **成熟件清单**（对 `ui-playbook §0` 橱窗货架）：牌面 `PlayingCard.faceArt` + `flipped` 状态驱动翻面（亮牌）· 扇形手牌 `layout.rotate` + `allowOverlap:true` · 选路 `LevelPath` · 庆祝/判定 `Particles` + `anim:'floatUp'`/`popOut` · 主行动键 `Panel.skin` 复合贴图键（动态押注数额·game-c 先例）+ `fx:'sheen-hover'` · 数值 `Label.format` · 异形 `Panel.shape:'shield'`（规则石板）· 环形 `ProgressBar.shape:'ring'`（洞察点）· VN 三件 `dialog`/`choiceList`/`portrait`（对手台词与 tell·消费 `t3-dialogue`·`REQ-DIALOGUE` M1 新件的真实消费方）。
- 交付前跑 `/check-ui`（四关 + `validateLayoutNode` 零 issue + `ui-audit` 归零·深/亮两主题各一遍）。

## 4.7 代码准入阶梯申报

| 规则 | 落级 | 说明 |
|---|---|---|
| 判定表与胜负结算【R-108-01~04】 | **L2 capgap 待裁** | `REQ-MATRIXDUEL`；过审即降为 L1 |
| 遗物补丁（含增设第四手）【R-108-30/31】 | **L0 纯数据** | 由 `matrix-duel` 的 `patches` 消费 |
| 遗物收益加成（重拳/纸甲/蓄力）【R-108-31】 | L1 | `t2-modifier-stack` 聚合 |
| 手牌/弃牌/洗回【R-108-05~07】 | L1 | `t2-card-pile`（`seededShuffle`） |
| 洞察点消费【R-108-08】 | L1 | `t2-craft-recipe`（costs/gains） |
| 血量与死亡【R-108-09】 | L1 | `Resource` + `t2-event-when` → `t2-effect-apply` |
| 回合七拍 + 对局/爬塔流程【R-108-10/40】 | L1 | `t3-flow`（`ConditionExpr`） |
| 加码倍率【R-108-11/13】 | L1 | `t2-craft-recipe` 扣拳票 + `t2-modifier-stack` 供倍率 |
| 弃权递增罚【R-108-12】 | L1 | `foldPenalty` Resource **累加器**（每次弃权 +2 后按其值扣血 = 等价 2×n·避免乘法算子） |
| AI 策略表【R-108-20】 | L1（**S3 验证**） | `t2-event-when` → `t2-weighted-spawn`；不成走 capgap |
| tell 展示【R-108-21】 | L1 | `chancePass` 种子门 + `x3-string-variable` 文案键 + `t3-dialogue` 投影 |
| 六屏 UI【§9】 | **L0 纯数据** | LayoutNode 闭集 + `@ui/starters` |
| 演出节拍【S-04】 | L1 | `t3-timeline` cue 发信号 |
| 局外元层（图鉴/每日种子） | L1 | `services/persist` 公共件 |

> **L3（受控 TS 卡带）/ L4（自由代码）：本项目零申报。**

## 5. 确定性声明

- **随机源**：世界单例 `RandomSeed`；游戏层**零裸 `Math.random`**（`game-skill-audit` 红旗）。
- **seed 来源**：常规局 = 开局一次性取并存档；**每日挑战 = 日期码派生**（同日同塔·天生可比可回放）。
- **消费点**：洗牌 `seededShuffle`【R-108-07】· AI 抽招 `t2-weighted-spawn`【R-108-20】· tell 概率门 `chancePass`【R-108-21】· 窥视选牌 `randomInt`【R-108-08】。
- **回放/lockstep**：单机 PvE，无 lockstep 需求；回放 = 初始 seed + 操作序列（`matrix-duel` 纯整数查表，无浮点分支）。
- 表现层随机抖动**不进 sim**（`Particles` 位置为确定式派生·render-only）。

## 6. 评审记录

- **提交人 / 日期**：Lead session（GD 兼稿）/ 2026-08-04
- **Lead 初裁**：🔶 **有条件通过**——条件两项：
  1. `REQ-MATRIXDUEL` 下沉过审并落地（**未落地不进 S3 玩法骨架**；纯 UI/装配骨架可先行）；
  2. AI 策略表重组【R-108-20】在 S3 首个验证项跑通，或走 capgap 拿到裁决。
- **S2 人门签**：**留给 owner / 另一复查 session**（复查人 ≠ 施工人·本稿由施工方自拟，不自签）。
