# game112《星尾会客厅》· 能力总览 Capability Plan

> **模板**：`docs/design/capability-plan-template.md`（代码游戏·必须过审才动工）
> **前置**：`framework.md` §6 十项缺口 + §5 竖切三环 **待 owner 裁决**；本 plan 按「推荐路线」编写，裁决改判则同步改 §2/§3/§4.7 并重审。
> **状态**：🔶 **待 owner 判缺口 → 待 Lead 审**。裁决前不写游戏层代码。
> **实查口径**：§2 每个能力名均已对 `src/assembly/capability-registry.gen.ts` 逐条核对存在（2026-09-23·113 项 registry 快照）；describe 原文出处见 `framework.md` §4/§6。未注册的共享模块单列 §2.2，不冒充 capability。

---

## 1. 游戏一句话

**在喵星的星尾会客厅遇见、收养并陪伴拥有往昔记忆的猫；也可以上传爱猫照片，让它成为能陪你打牌、玩耍、继续留下回忆的数字陪伴化身。**

参照物：数字宠物陪伴（无惩罚·无第二次失去）× Balatro 式轻卡牌（原创「星爪牌」）× 回忆叙事 × 收藏布置；表现层 = 身份锚定的照片转活视频（爱诗）。

**架构基石（`framework.md` §0）**：**猫的行为在 sim，猫的画面是投影。** 生成媒体不是状态，是投影；断网拔掉投影层，玩法完整。

---

## 2. 消费的引擎能力（对 `capability-registry` 实名 · 已逐条核对）

### 2.1 已有能力（✅ 现有）

| capability（注册名） | 用来做什么 | 状态 |
|---|---|---|
| `w1-random` | 一切随机唯一源（游戏层禁裸 `Math.random`）；`deriveSeed` 派生 AI/狩猎/离线子流 | ✅ 现有 |
| `f1-resource` | 星砂 · 心光 · 亲近 · 安心 · 兴致 · AI 黑板四值 · 触摸偏好分 · 物品计数（仓库）· 猫爪剩余次数 · 双方星光 | ✅ 现有 |
| `f2-flag` | 拥有物品 · 章节解锁/确认态 · 敏感跳过 · 握手旗（AI 一级一拍）· 星盘压牌旗 | ✅ 现有 |
| `x3-string-variable` | 当前陪伴猫 id · 当前玩具 · 章节游标 · 猫名字/称呼 | ✅ 现有 |
| `j1-state` | 心态机（牌桌 `mood-card.<cat>`）· 触摸接受/拒绝态 · 上传猫档案状态（草稿/处理中/待确认/可用） | ✅ 现有 |
| `t3-flow` | 狩猎链 FSM（`hunt.<cat>`·`after` 驻留拍）· 牌局相位（准备→对局→结算） | ✅ 现有 |
| `t2-turn-order` | 星牌桌座位轮转（玩家/猫·`advanceSignal:"endTurn"`） | ✅ 现有 |
| `t2-event-when` | 心光阈值解锁章节（edge）· 心态切换 · 触摸判定 · 胜负判定（`resource gte` / `vsResource`） | ✅ 现有 |
| `t2-effect-apply` | 一切写世界的出口：`modify-resource`（星砂/心光/关系）· `set-flag` · `set-state` · `chance{num,den}` 种子概率门 · `destroy @signal-source` | ✅ 现有 |
| `t2-modifier-stack` | 心态/玩具偏好对 AI 黑板与狩猎概率的修正聚合（gate 读 state/string） | ✅ 现有 |
| `t2-over-time` | 兴致自然变化（`duration:0` 永续）· 玩累（扣兴致） | ✅ 现有 |
| `t2-cooldown` | 猫爪动作冷却 · 离线事件每日上限 | ✅ 现有 |
| `t2-gauge` · `t2-text-binding` | 心光/亲近柔和进度 · 星砂数字投影 | ✅ 现有 |
| `t2-keybind` | UI action / 宿主分档 key（`offline.short|long|days`·`owner.confirm`）→ Signal（数据驱动合法入口） | ✅ 现有 |
| `t2-card-pile` | 双方手牌/牌库/补牌（deck = `seededShuffle(buildDeck)`） | ✅ 现有 |
| `t3-hand-pattern` | 星盘组合判型（成对 `ntuple[2]` · 三连 `sequence runLen:3` · 同色三连 `flush-sequence`）——同色任意点数 / 循环月相由 §4 例外④ 游戏层规则核承担（牌规待 owner 对定） | ✅ 现有（部分） |
| `t2-behavior-tree` | 猫的牌桌 AI（一棵树·四性格黑板·叶注册 = §4 例外①） | ✅ 现有 |
| `t2-craft-recipe` | 杂货铺交换（`costs:[星砂]` → `gains:[item 计数]` + `grantsFlag own.<item>`）· 收回物品回库 · 章节完成发纪念物 | ✅ 现有 |
| `t2-drag-place` · `t2-tray` | 布置模式放置/移动（自由落点）· `DropZone` 收纳筐 · 货架/手牌排布 | ✅ 现有 |
| `t2-clickable` | 主厅热点（晶球/牌桌/玩具篮）· 猫身体五分区命中（AABB·最上层） | ✅ 现有 |
| `a2-hierarchy` · `c1-shape` · `a1-transform` | 猫的分区子实体 · 玩具 · 布置物位置 | ✅ 现有 |
| `t2-zone-occupancy` | 关注区 / 纸袋遮挡区（玩具在区内 → Flag）——逗猫重设计中·暂留 | ✅ 现有 |
| `t3-aggro` · `t2-steering` · `t1-motion-apply` | 猫朝玩具移动（Track/Search） | ✅ 现有 |
| `t2-weighted-spawn` · `t3-prefab` · `k1-spawn` · `k2-destroy` · `g1-tag` | 离线小事件按权重表在布置点展开（每档一表）· 展开物挂 Tag 位 · `effect-apply destroy-tagged` 按位批量回收 | ✅ 现有 |
| `t3-dialogue` | 回忆章节（line/choice/requires）· 首次引导 | ✅ 现有 |
| `t3-timeline` | 初遇演出 cue（猫远远观察 → 靠近）· 章节完成演出 | ✅ 现有 |
| `l1-sprite` · `l3-frame` · `t1-animation` · `t2-anim-state` · `t2-facing` · `h1-visibility` | **猫的投影（序列帧路线·缺口 ⑧ 选 A 时）**：按 `State{fsmId}` 切 clip · 前景遮挡靠 zOrder | ✅ 现有 |
| `l7-vfx2d` | 星光粒子（克制）· 晶球微光 | ✅ 现有（`NON_DETERMINISTIC`） |
| `i1-input-capture` · `i2-action-map` | 指针入队契约（点击落点）——指针跟随已撤单·只用 down/up | ✅ 现有（契约） |
| `l6-text` · `l2-color` · `l5-camera` | 场景文字 · 色 · 固定镜头 | ✅ 现有 |

### 2.2 已有共享模块（非注册 capability·不冒充）

| 模块 | 路径 | 用途 |
|---|---|---|
| `condition`（`ConditionExpr`/`evalCondition`） | `src/engine/logic` | 阈值/状态门（经 event-when/flow/modifier-stack 消费） |
| `cardboard-codec.buildDeck` · `seededShuffle` · `weightedPick` · `deriveSeed` | `src/skills/tier2` · `atoms/random` | 牌码 · 洗牌 · 离线事件抽样 · 子流种子 |
| `net/commands` · `net/host/queued-input` | `src/net/` | 宿主把 UI action / 分档 key / 主人确认 确定性喂进 sim 的唯一口 |
| `services/save` · `services/persist` | `src/services/` | 局外信封（猫档案/关系/仓库/布置/相册索引/章节游标/lastSeen）· 小态偏好 |
| `services/aigp.AishePort` | `src/services/aigp/` | 视频生成端口（现状只文本提示·无轮询 = 缺口 ⑤） |
| `engine/host`（`mountHost`/`createRunLoop`） | `src/engine/host/` | 宿主骨架 |
| `debug-trace` | `src/skills/debug-trace.ts` | §5.3 落点 |
| `@ui/starters` · `apollo-kit` · `catalog`（41 控件） | `src/ui/` | §4.6 |

### 2.3 待裁缺口（⏳ · 全文 `framework.md` §6 · 机读 `capability-gaps.json`）

| # | 能力（拟名） | 用来做什么 | 状态 |
|---|---|---|---|
| ① | ~~`t2-shared-pile`~~ | 三个公共星盘 —— **owner 2026-09-24 判：游戏专属规则，不进引擎** → §4 例外④ | ✅ wontfix（游戏层） |
| ② | ~~`t3-hand-pattern` DSL 扩~~ | 星盘组合计分 —— **同上，随 ① 进同一模块** | ✅ wontfix（游戏层） |
| ③ | ~~`t2-pointer-follow`~~ | 逗猫棒跟手 —— **owner 2026-09-24 判：逗猫改视频实现，不做拖羽毛棒 → 撤单** | ✅ wontfix |
| ④ | ~~Clickable 载荷~~ | 触摸方向/速度/时长 —— **owner 2026-09-24 判：B 先行，撤单** | ✅ wontfix（首版按区判） |
| ⑤ | `AishePort` 扩展 | 参考图/角色 ID/首尾帧 · poll/cancel/delete —— **引擎能力「AI 视频生成」之一** | ✅ accepted（owner 2026-09-24）· **delivered**（主程 b21d3ad1·引擎池 REQ-112-AIGP·待独立复查） |
| ⑥ | `MediaJobPort` + `MediaCachePort` | 上传/质检/身份锚/审核队列/Blob 缓存 —— **「AI 视频生成」之二·先立端口·与供应商解耦** | ✅ accepted · **delivered**（主程 b21d3ad1·待独立复查） |
| ⑦ | `Input.type:'file'`（PUI） | 上传照片控件 | ✅ accepted · 报 PUI |
| ⑧ | ~~序列帧管线~~ | 折叠进 ⑪（播放能力的内部实现选项） | wontfix |
| ⑨ ⑩ | ~~VideoActor / Video 事件~~ | 合并进 ⑪ | wontfix |
| **⑪** | **引擎能力「内嵌 AI 视频播放」** | 片段目录数据驱动 · 按状态选片 · 预载缓存 · 不黑帧 · 播完信号进 UI · 回退链 · 叠层 | ✅ accepted（owner 2026-09-24 立）· 待主程接单 |

---

## 3. 摆成数据的规则面

> 技法：先把界面话术翻成「状态 / 事件 / 命令」，再摆表。**每张表的解释器都是现成注册名或待裁缺口，无「待写的游戏层解释器」。**

| 数据表 | 内容 | 谁解释它 |
|---|---|---|
| `CAT_CARDS` | 每猫身份/外观/性格/偏好/`cardPersona`/`playPersona`/隐私范围（GDD §6.1） | `f1-resource`（黑板与偏好分初值）· `j1-state`（档案状态）· `x3-string-variable`（名字）· 宿主装载期展开为蓝图实体 |
| `RELATION_RESOURCES` | `closeness.<cat>` / `ease.<cat>` / `heartlight.<cat>` / `mood.<cat>` 的 min/max/初值/是否持久化 | `f1-resource` · `t2-over-time`（兴致）· `t2-gauge` |
| `RELATION_EFFECTS` | 事件 → 关系增减（问候/陪坐/牌局结束/触摸接受/章节完成）；**心光只增、亲近只增、安心只由具名事件** | `t2-keybind` → `t2-effect-apply modify-resource` |
| `STARCLAW_DECK` 🟡 | 牌码表（星色 × 月相 [× 爪印]）· 手牌上限 · 目标星光 · 猫爪次数 —— **牌规待 owner 对定（2026-09-24）** | `t2-card-pile` · `f1-resource` · §4 例外④ |
| `STARCLAW_FAMILIES` | 组合族 → 星光分（pair/run3/suited-run3 调 `hand-pattern`；suited-set/cycle 在 §4 例外④ 内） | `t3-hand-pattern` + `t2-effect-apply` |
| `STARCLAW_PLATES` | 三个星盘 · 猫爪动作表（swap/pin/pop 各次数/冷却） | §4 例外④ 规则核 · `t2-cooldown` |
| `STARCLAW_FLOW` | 牌局相位（准备→出牌→结算→再来/回厅）· 胜负条件 | `t3-flow` · `t2-turn-order` · `t2-event-when` |
| `CAT_CARD_AI` | 一棵 BT 树 + 四性格黑板值 + 心态机表 + 难度档（`cat-ai.md` §1） | `t2-behavior-tree`（叶 = §4 例外①）· `j1-state` · `t2-modifier-stack` |
| `HUNT_FLOW` 🟡 | 狩猎链状态闭集/转移/驻留拍/概率（`cat-ai.md` §2.1-2.2）—— **逗猫改视频实现·重设计中（2026-09-24）**；保留为「选玩具 → 按状态播片」的状态表 | `t3-flow` · `t2-effect-apply chance` · 缺口 ⑪ 投影 |
| `TOY_TABLE` 🟡 | 五种玩具 → 行为修正 —— 随逗猫重设计 | `t2-modifier-stack` |
| `TOUCH_ZONES` 🟡 | 五分区 + 偏好 —— 随逗猫/陪伴重设计；首版按区判 | `a2-hierarchy` · `c1-shape` · `t2-clickable` · `t2-event-when` · `j1-state` |
| `OFFLINE_EVENTS` | 分档 key → **每档一张权重表**（short/long/days·`world-data.ts` OFFLINE_EVENTS.weight[tier]·权重 0 不入表）→ 模板（纸袋藏牌/叼玩具/睡过位置/打翻杯垫…·**只有装饰模板**）· 看过了 → 按 Tag 批量回收 | `t2-keybind` · `t2-weighted-spawn` · `t3-prefab` · `g1-tag` · `t2-effect-apply destroy-tagged` |
| `CARE_POSE` | 陪伴动作 → 猫姿态机 `pose.<cat>`（rest/lookup/settled·不进档）→ 投影换台词/画面 = 操作的画面确认（S4 八问②） | `j1-state` · `t2-effect-apply set-state` |
| `SHOP_ITEMS` | 物品/价格/分类（装饰·新互动·牌具外观）/放置点 | `t2-craft-recipe` · `t2-tray`（货架） |
| `DECOR_SLOTS` | 可布置位 · 收纳筐 DropZone | `t2-drag-place` · `t2-effect-apply destroy` + recipe 回库 |
| `MEMORY_CHAPTERS` | 官方猫三段式章节 DialogueScript · 解锁阈值 · 敏感标签 · 纪念物 | `t3-dialogue` · `t2-event-when` · `f2-flag` · `t2-craft-recipe`（纪念物） |
| `CLIP_CATALOG` | 每猫每态片段规格（`framework.md` §2）· 回退链 | **引擎能力「内嵌 AI 视频播放」（⑪）**；宿主媒体库索引 |
| `UI_SCREENS` | S00-S97 全部页面 LayoutNode（`menu-flow.md` §4）· 动作词表（§13） | `mountUI` · `t2-keybind` |
| `ACCEPTANCE_SCRIPTS` | GD 验收剧本 ≥3（用 §13 真 UI 动作名） | `scripts/acceptance` harness |

**红线自查**：
- 星爪牌计分：`STARCLAW_FAMILIES` 由 `t3-hand-pattern.matchPattern` 判族（纯函数·`game-a/rules.ts` 先例）→ 族名查表加分走 `Effect modify-resource`；**不在游戏层写计分循环**（`cards.md:26`）。「取星盘顶部 N 张送判型」由 §4 例外④ 规则核承担（owner 2026-09-24 判：游戏专属规则在游戏层）。
- 「仓库」不用 `t2-inventory`（`systems: []` 无信号接线）：每物品一个 `Resource` + `own.<item>` Flag，`CraftRecipe.gains` 直接加计数——等价数据写法，证明测试：买玩具 → 计数 +1 且 Flag 置位 → 主厅热点 visibleWhen 读该 Flag。
- 「恢复进入前」：宿主进布置模式时存 `services/save` 信封，退出不保存 = 重装载；**不写撤销栈**。
- 离线时长：宿主 `localStore` 记 lastSeen → 分档 key 注入；**不需要「数值→Resource 桥」**。
- 上传猫回忆文本：宿主**装载期**拼进 DialogueScript JSON；sim 内不生成文本。

---

## 4. 申请的游戏层代码例外（逐条过审）

| 例外 | 为什么现有能力表达不了 | 预计行数 | Lead 裁决 | 偿还计划 |
|---|---|---|---|---|
| ① BT 叶注册：`enumerate-moves` / `take-best-score` / `use-claw` / `hold-and-place-low` / `place-by-tempo`（`cat-ai.md` §1.2） | `t2-behavior-tree` 叶 = 消费方注册表（describe 原文）；着法枚举/估值无引擎级件（`hand-pattern.legalResponses` 是压制语义） | ~90 | ⬜ | 记债；同形叶在第三个牌游戏出现即下沉「候选枚举」纯函数核 |
| ② 宿主会话驱动（`game112.ts`）：建 Engine · 装载信封 → 蓝图初值 · 分档 key/主人确认 → `QueuedInputSource` · 媒体库索引 · 回退链选片 · 退出写信封 | 宿主契约明许的 sim 外胶水（同 game111 `turn-driver`/`game111.ts`） | ~200 | ⬜ | 非规则逻辑；复查门核「零玩法判定」 |
| ③ 装载期数据拼装：`CAT_CARDS` → 蓝图实体 · 上传猫回忆 → DialogueScript JSON · `CLIP_CATALOG` → anim-state clip 表 | 表展开 ≠ 解释器（`game-103 ringSpawnerEntities()` / game111 `intentEffectEntities` 先例） | ~120 | ⬜ | 无 |
| ④ **星爪牌规则核** `games/game112/starclaw-rules.ts`：三星盘公共堆 · 目标堆出牌 · 猫爪动作（换盘/压牌/拨顶）· 组合计分（同色任意/月相循环/成对/三连/爪印）· 胜负 | **owner 2026-09-24 判**：星盘与计分是本作专属规则，不抽象进引擎（原缺口 ①②）。先例 = game-c 摊牌/边池确定性 TS 模块。纯函数、零 DOM、随机只吃传入 seed、状态经 Resource/Flag 投影给 UI/AI/条件 | ~250 + 测试 ≥30 | ⬜ | 记债；若第三个游戏出现同形「公共堆」再议下沉 |

**没有第五条**：❌ 不申请视频播放器 · ❌ 不申请自由 DOM/React 屏 · ❌ 不申请自写状态机 · ❌ 不申请计分循环 · ❌ 不申请网络生成胶水进 sim。审计红旗零申报。

## 4.5 美术接入（必填）

- **皮肤槽清单**（主体视觉实体必须有槽）：

| 视觉实体 | 槽 | 载体 |
|---|---|---|
| 猫（每猫每态锚图；序列帧就绪即盖过） | `cat.<catId>.<state>` | `Sprite.textureKey` / anim-state `sheet` |
| 场景（主厅/牌桌/逗猫角/晶球厅/回忆廊/杂货铺） | `scene.<name>` | `mountHost.sceneBgSkin` + 装饰 Sprite |
| 星盘 ×3 · 牌背 · 牌面 | `plate.<n>` · `cardback.<theme>` · `card.<code>` | `PlayingCard.faceArt` / Sprite |
| 玩具 ×5 | `toy.<kind>` | Sprite |
| 忆光晶球（每猫） | `orb.<catId>` | `Avatar`/Image |
| 前景遮挡（桌沿/椅脚/纸袋/窗帘） | `fg.<name>` | 高 zOrder Sprite |
| 纪念物 · 商店物品 | `item.<id>` | Sprite / Image |

- **台账产出**：编译期游戏，照 `scripts/game-g-art-requirements.mjs` 样板写推导脚本 `scripts/game112-art-requirements.mjs`（S3 落地）。
- **视觉锚**：`visual/cat-art-direction-ragdoll-v2-lived-in.png` + `scene-cat-play-ragdoll-v1.png`（已目击）。
- 不申请「全程序化」例外；S3 骨架用成形矢量占位（最低标准）。

## 4.6 UI 呈现 · 华丽起手（必填）

- **house 主题**：`apolloBrocade`「锦霞」（暖白锦缎 + 金/胭脂·最接近 GDD「燕麦旧木暖光」）。**不自写主题**；S5 若要「磨砂晶片/旧纸卡」质感，走 `UITheme.texture/panelTexture` + `Panel.glass`，仍不自写。
- **起手包**：标题页 `buildStarterHome({title,subtitle,actions})`；牌局结算 `buildStarterResult`（`stars` 不用·GDD 不评星）。
- **成熟件清单**：

| 屏 / 元素 | 控件 |
|---|---|
| 星爪牌手牌/星盘 | `PlayingCard`（faceArt·翻面）+ `Panel` 星盘区 |
| 回忆影片 / 基础活照片预览 | `Video`（整屏·`controls`）/ `Image` + `fx: pulse/float` 回退 |
| 晶球厅猫卡 | `Avatar` + `Float`（亮度差） |
| 心光 / 亲近 | `ProgressBar.shape:ring`（柔和·仅详情页） |
| 一级页面侧内容 | `Drawer` |
| 分级删除确认 · 收养确认 | `Modal`（禁情绪勒索文案） |
| 生成完成提示 | `Toast`（柔和星光） |
| 相认 / 章节完成 | `Particles`（克制） |
| 设置分类 | `Tabs` / `Segmented`；辅助功能 `Slider`/`Toggle` |
| 回忆章节 | `dialog` + `portrait` + `choiceList` |
| 上传关系语境 | `RadioGroup`；名字 `Input` |
| 上传照片 | **缺口 ⑦**（`Input.type:'file'`·报 PUI） |

主 CTA `sheen-hover` + `Panel.skin`；数值 `Label.format`。零成熟件 = 缺陷，本表 12 项。

## 4.65 对手/敌人 AI 设定（必填）

**有 AI**：猫在牌桌是对手、在逗猫角/陪伴是行为主体。详设在 **`cat-ai.md`**（本目录）。摘要：
- 性格一句话 ×4（谨慎/好胜/贪玩/困倦）= 四个黑板 `Resource`，一棵树不改；玩耍性格 = 每猫八个数。
- 决策口径：BT selector（抢分 → 猫爪 → 攒牌 → 按节奏落盘）+ 握手旗一级一拍；狩猎链 `t3-flow` + `Effect.chance`。
- 难度阶：`gentle/normal/sharp` 三档 = 估值噪声与猫爪次数，数据档位；关系不给数值优势。
- 八件坑对照：①定手窗（叶只读公开牌·白名单测试）②账期（心态在结算后更新）③心态机 `j1-state` ④种子骰 ⑤握手旗 ⑥结构测试 ⑦判定表同源 ⑧一级一拍。
- trace：`decision`/`reject` 必记。

## 4.7 代码准入阶梯申报（必填）

| 规则 | 落级 | 说明 |
|---|---|---|
| 猫档案 / 关系量 / 经济表 / 商店 / 布置位 / 章节 / 片段目录 / 页面 | **L0** 纯数据 | 无 |
| 关系增减 · 章节解锁 · 触摸判定 · 胜负 · 心态切换 | **L1** `event-when` + `effect-apply` + `modifier-stack` | 无 |
| 兴致自然变化 · 玩累 | **L1** `over-time` | 无 |
| 杂货铺 / 仓库 / 纪念物 / 收回 | **L1** `craft-recipe` + Resource 计数（重组·不用 inventory） | 无 |
| 布置放置 / 收回 / 恢复进入前 | **L1** `drag-place` + DropZone + 宿主信封 | 单步撤销 ⚪ 不做 |
| 离线小事件 | **L1** keybind → weighted-spawn → prefab | 时长分档由宿主 |
| 狩猎链骨架 | **L1** `flow` + `chance` + `zone-occupancy` | 驱动量 → L2 |
| 逗猫棒跟手 · 速度/停留 · 距离条件 | ⚪ 不做（owner 2026-09-24：逗猫改视频） | 撤单 |
| 触摸方向/速度/时长 | ⚪ 首版不做（owner 2026-09-24 判 B） | 逗猫重设计后再议 |
| 星爪牌手牌/牌库/轮转 | **L1** `card-pile` + `turn-order` | 无 |
| 公共星盘 · 猫爪动作 · 牌库余量 · 组合判型 | **L3** 受控 TS（§4 例外④·owner 2026-09-24 判） | 游戏专属规则；成对/三连/同色三连仍调 `hand-pattern` 纯函数 |
| 猫 AI 着法枚举/估值叶 | **L3** 受控 TS（§4 例外①） | L0-L2 表达不了：候选枚举无引擎件·记债 |
| 宿主会话驱动 · 装载期拼装 | 宿主胶水（契约明许·§4 例外②③） | 非规则逻辑 |
| 猫的画面（互动片 / 基础活照片） | **L2 已裁 A** → REQ-112-ENG-11「内嵌 AI 视频播放」；裁前占位 = `Image` + fx 微动 | 缺口 ⑪ |
| 回忆影片播放 | **L0** `Video` 控件（整屏）；播完信号随 ⑪ | — |
| 上传 / 身份锚 / 生成 / 审核 / 缓存 | **L2 已裁 A** → REQ-112-ENG-05/06「AI 视频生成」· REQ-112-UI-07 | 缺口 ⑤⑥⑦ |
| **L4** | **零申报** | — |

---

## 5. 确定性声明

### 5.1 口径

| 项 | 口径 |
|---|---|
| 随机源 | `w1-random`；seed = 宿主开局注入（新局随机·回放固定）；子流 `deriveSeed(seed,'cat-card:<id>'|'cat-hunt:<id>'|'offline:<id>')` |
| 墙钟 | 全禁进 sim；离线时长 → 宿主分档 key；`savedAt` 宿主注入 |
| 媒体 | 片段可用性/播放进度/`ended`/生成回包序 **不进 sim**；`Vfx2D` 已在 `NON_DETERMINISTIC`；缺口 ⑪ 交付时其投影组件登记 `NON_DETERMINISTIC` |
| 外部输入 | 主人确认 / 上传完成 / 生成完成 = 宿主侧索引变化 + 具名 action 经 `QueuedInputSource` 入队（tick 边界释放） |
| 回放 | 录输入流（含分档 key 与 seed），重放零服务调用，bit 一致（S4 双跑同 hash 测试） |
| lockstep | 首版单人不需要；写法不留障碍 |

### 5.2 非确定性风险点

| # | 风险点 | 封法 | 归属 |
|---|---|---|---|
| 1 | 投影层把 `ended` 回写 sim | 投影只读；片长 `ticks` 在数据表、flow `after` 推进 | PE-112（结构测试：投影模块无 world 写口） |
| 2 | 宿主直接往世界塞 Signal（event-when 拍头清场） | 一律经 `QueuedInputSource → keybind`（game111 实证） | PE-112 |
| 3 | 离线时长以数值进 sim | 分档 key | PE-112 |
| 4 | AI 叶读玩家手牌 | 叶查询白名单 + 结构测试 | PE-112 |
| 5 | 多猫同名资源被全局路由串台 | 全部 id `<量>.<catId>` | PE-112（registry 校验断链） |
| 6 | 媒体播放进度 / 结束 回写 sim | 缺口 ⑪ 的契约：播放侧只读·结束信号只进 UI 层 | 主程 |

### 5.3 DebugTrace 落点

`decision`（AI 选支 / 狩猎转移）· `transition`（flow / 心态机）· `reject`（有得分着法未用 · 关注区内 Ignore · recipe 星砂不足 · 触摸被拒 · 章节因敏感跳过）· `commit`（着法 / 成交 / 解锁）。验收：只读 trace 能答「为什么这回合没用猫爪」「为什么它没扑」。

### 5.4 测试红线

- 撤修验红 sabotage 带锚点命中断言（性格差异例 · 心光只增例 · 断网回退例）。
- 定序测试断言 `topological-sort` warn 为零（flow 与 turn-order 同 tick 流·防成环）。

---

## 6. 评审记录

- 提交人 / 日期：GD/PE-112（Game Maker 二·程序策划）· 2026-09-23
- 前置裁决：`framework.md` §6 十项 + §5 三环 —— **⬜ 待 owner**
- Lead 裁决：⬜ ✅ 通过 / ⬜ 🔶 有条件通过（条件：…）/ ⬜ ❌ 驳回（理由：…）
- **owner 2026-09-24 判词（第一批）**：①②④ = 游戏专属 → wontfix（①② 进 §4 例外④ 游戏层规则核，**但牌规本身待 owner 对定**；④ 首版不做）。③ 撤单（逗猫改视频实现）。**第二批（同日）**：⑤⑥⑦ 判 A；⑧⑨⑩ 收成一款引擎能力 ⑪「内嵌 AI 视频播放」（与「AI 视频生成」= ⑤+⑥ 成对）。**十一条零 open → S2 机器门绿。** 引擎三单（05/06/11）待主程接单晋升引擎池；PUI 一单（07）。
- S2 机器门：`capability-gaps.json` 11 条零 open → **绿**（2026-09-24）。S2 复查门：CONCERNS（by S2-reviewer-agent·陈旧引用已清·越域改 scoped-gate 待主程 review）。
- 派工与归属（预填·Lead 改）：

| 工件 | 归属 | 理由 |
|---|---|---|
| 缺口 ⑤⑥⑪（AI 视频生成 + 内嵌播放） | 🔴 主程 | services / renderer / host / 组件协议 |
| 星爪牌规则核（原①②） | PE-112 | 游戏层 TS 模块 + 测试（§4 例外④） |
| 缺口 ⑦ ⑩ | PUI | `src/ui` 域 |
| `games/game112/**` + `docs/design/game112/**` | PE/GD-112 | 本游戏域 |
