# game112《星尾会客厅》· 基础框架设定（Framework）

> **本文性质**：把 CodeX 落档的策划案（`gdd.md` / `menu-flow.md` / `ui-visual-handoff.md`）翻成**本仓引擎的骨架语言**——什么在 sim、什么在宿主、什么在投影层；哪些能力现成、哪些是缺口、缺口摆 A/B 请 owner 判。
> **状态**：🔶 待 owner 裁决（§6）。**裁决前不写游戏层代码。**
> **实查依据**：2026-09-23 四路实查（卡牌线 / 媒体线 / 行为·经济·存档线 / S2 格式），每条能力名均对 `src/assembly/capability-registry.gen.ts` 与对应 `src/skills/**` 文件的 describe 原文核过，出处写在各节。
> **作者**：GD/PE-112（Game Maker 二·程序策划）。**推荐 ≠ 裁决**（CLAUDE.md ⚖ 缺口裁决协议：Lead/提案方给推荐，owner 判）。

---

## 0. 一句话

**猫的行为在 sim，猫的画面是投影。** 关系、经济、牌局、狩猎链、回忆解锁 = 确定性数据 + 现有能力；视频/序列帧 = 只读 sim 状态的表现层；照片上传与生成 = sim 外异步作业，其结果只改变「哪段画面可播」，**永不改变** sim 状态。

这是 game111「LLM 不是解释器，LLM 是输入源」在本作的对应命题：**生成媒体不是状态，生成媒体是投影。**

---

## 1. 核心矛盾与解法

### 1.1 矛盾

GDD 要三样东西同时成立：① 猫必须高保真且身份稳定（照片转活视频）；② 玩法必须确定性、可复盘、可回放（牌局、关系、经济）；③ 生成失败/断网时**基础陪伴与牌局照常**（GDD §8.3 ⑤、§16.3 ②）。

若把「当前在播哪段视频」「视频播完了没」写进 sim，②③ 立刻破：`<video>` 的 `ended` 是墙钟事实，网络到达序是本地事实（`src/net/determinism.ts:38` 对 `IntentInbox` 的注释原文：「进 hash 等于把网络抖动焊进指纹」）。

### 1.2 解法：四层分工（写死）

| 层 | 装什么 | 载体 | 确定性 |
|---|---|---|---|
| **① sim** | 猫的状态（狩猎链 FSM、心态机）、四种关系量、星砂/心光、牌局全部规则、回忆解锁、布置坐标、离线事件的展开 | `WorldBlueprint` 纯数据 + registry 能力 | 进 snapshot/hash，可回放 |
| **② 宿主胶水**（契约明许·sim 外） | 会话驱动：把 UI action / 离线时长分档 / 主人确认结果 经 `QueuedInputSource → applyCommands → InputQueue` 喂进 sim；持久化（`services/save` 信封 + `services/persist` 小态）；媒体库索引；生成作业提交与轮询 | `games/game112/game112.ts` 等宿主文件 | 只喂输入，不写世界 |
| **③ 投影层** | 猫的画面：读 `State/StateChanged` 选片；缺片走回退链（个性片 → 通用片 → 基础活照片 → 静态锚图 + fx 微动） | 现有 `l1-sprite`+`t2-anim-state`（序列帧路线）或未来 VideoActor（视频路线，§6 缺口 ⑨） | 表现组件；`Vfx2D` 已在 `NON_DETERMINISTIC` |
| **④ UI** | 全部菜单/HUD/上传流程/隐私中心 | LayoutNode 闭集（41 控件·`catalog.ts`） | action 信号入队 |

**铁律三条**：
1. 投影层**只读**：片段结束不回写 sim；猫「什么时候从 Stalk 进 Pounce」由 sim 的整数 tick（`t3-flow` 的 `after` + 片长数据）决定，画面跟着状态走，不反过来。
2. 生成作业的**唯一合法回流**是「媒体库索引多了一条可播片」（宿主侧数据），以及主人确认结果作为**命令**进 InputQueue（同 game111 的 `NpcAgentPort` 经 barrier 进 sim 的口径；本作主人确认是同步人类输入，不需要 barrier）。
3. 任何时刻拔掉网络，①②④ 完整，③ 退到静态锚图 + fx 微动。

---

## 2. 状态 → 画面 的投影契约（数据形状）

`CLIP_CATALOG`（每猫一份·纯数据·GDD §8.5 的落地）：

```
{ catId, identityVersion, scene: 'hall'|'table'|'play'|'memory',
  state: 'Rest'|'Notice'|'Track'|'Stalk'|'Pounce'|'Catch'|'Miss'|'Hold'|'Search'|'Groom'|'Ignore'|…,
  clipKey,            // 资产 key（序列帧图集或视频）
  ticks,              // 片长（整数 tick·sim 用它推进 after）
  loop, energy: 0..3, poseIn: 'neutral'|…, poseOut: 'neutral'|…,
  anchor: {x,y},      // 猫在画面中的锚点
  hitZones: [{zone:'head'|'cheek'|'chin'|'back'|'paw', shape}],   // 触摸分区（首版 AABB）
  fallbackClipKey,    // 缺片回退
  review: 'pending'|'approved'|'rejected', source: 'official'|'generated' }
```

- 序列帧路线下，这张表**直接**是 `t2-anim-state` 的 clip 表形状（`{sheet,from,count,fps,loop}`·按 `State{fsmId}` 选 clip·`anim-state.ts` describe 原文「动画只表现、不驱动逻辑」）。
- 视频路线下，同一张表喂未来的 VideoActor。**表不变，投影件可换**——这是把媒体路线延后裁决而不阻塞玩法的关键。

---

## 3. 世界运行模型

- **实时 tick**（非回合）：主厅/逗猫/陪伴走引擎 tick；牌局用 `t2-turn-order` 在同一 tick 流里做座位轮转（无需第二个时间基）。
- **一个活动镜头一只猫**（GDD §6.4）：`activeCat` 为 `x3-string-variable`；每猫的资源/状态 id 一律 `<量>.<catId>` 全局唯一（`events-logic.md` 「全局 id 路由」坑）。
- **随机**：`w1-random` 世界种子；AI 与狩猎链各自 `deriveSeed(seed,'cat-card:<id>')` / `'cat-hunt:<id>'` 派生（`random/index.ts:44`）。
- **墙钟**：只在宿主；离线时长**分档成 key** 注入（`offline.short|long|days`），sim 只见 Signal。

---

## 4. 玩法子系统 → 现有能力对账（实查结论摘要·细表在 `capability-plan.md` §2/§3）

| 子系统 | 现成能力 | 判定 |
|---|---|---|
| 四种关系量（亲近/安心/心光/兴致） | `f1-resource`（每量一实体·`resource/index.ts:64`「一个实体一个 Resource」）+ `t2-modifier-stack` + `t2-over-time`（兴致自然变化·`duration:0` 永续）+ `t2-gauge` | ✅ 全表达。「只增」靠数据纪律（心光不进任何 costs、无负向 Effect），测试钉死 |
| 星砂经济 / 杂货铺 / 仓库 | `f1-resource` + `t2-craft-recipe`（`craft-recipe.ts:28`「信号到达且 costs 可负担时原子扣料 + gains + grantsFlag」）；仓库 = 每物品一个 `Resource` 计数 + `own.<item>` Flag | ✅ **重组**（不用 `t2-inventory`：它 `systems: []` 无信号接线，不立缺口） |
| 布置模式 放置/移动/收回 | `t2-drag-place`（自由落点写终点 Transform）+ `DropZone` 收纳筐 → `Effect destroy @signal-source` + recipe 回库；货架 `t2-tray` | ✅；**「恢复进入前」= 宿主在进入布置模式时存一份 `services/save` 信封、退出不保存即重装载**（宿主胶水·非规则逻辑）；单步撤销首版不做（GDD ⚪） |
| 回忆章节 | `t2-event-when`（心光 gte·edge）→ `set-flag`；章节 = `t3-dialogue` 节点图（line/choice/requires）；确认态 = Flag；敏感跳过 = `skip.<id>` Flag + `requires` 绕节点 | ✅；上传猫的回忆文本由宿主**装载期**拼进 DialogueScript JSON |
| 离线「田螺姑娘」 | 宿主分档 key → `t2-keybind` → `t2-weighted-spawn`（种子抽模板）→ `t3-prefab` 在布置点展开 | ✅ 重组（数值时长→Resource 桥不需要：分档即够） |
| 星爪牌 | `t2-card-pile` / `t2-turn-order` / `t3-hand-pattern`（成对·连续可判）/ `t2-behavior-tree`（猫 AI）/ `w1-random` | ⚠ **两处缺口**：公共星盘（§6 ①）· 组合 DSL（§6 ②） |
| 逗猫狩猎链 | `t3-flow` 状态闭集 + `after` 驻留 + `Effect.chance` 落旗 + `t2-zone-occupancy` 近似关注区 | ⚠ **驱动量缺口**：指针实时位置/速度进 sim（§6 ③） |
| 触摸分区 | 子实体 `a2-hierarchy` + `c1-shape` + `t2-clickable`（AABB 取最上层） | ⚠ 方向/速度/时长读不到（§6 ④）；首版按区判 |
| 猫的画面（互动片） | `l1-sprite` + `t2-anim-state` + `t1-animation`（序列帧）| ✅ **播放侧零缺口**；缺的是「生成片 → alpha 序列帧」转换（§6 ⑧） |
| 回忆影片（整屏） | LayoutNode `Video{src,controls}` | ✅ 播放；作业轮询是缺口（§6 ⑤） |
| 照片上传 / 身份锚 / 质检 / 审核 / 缓存 | — | ❌ 全是缺口（§6 ⑤⑥⑦） |
| 持久化 | `services/save` 信封（猫档案/关系/仓库/布置/相册索引/章节游标/lastSeen）+ `services/persist` 小态（偏好） | ✅（`save-platform.md:36`「savedAt 由宿主注入」） |

---

## 5. 竖切重切（推荐·owner 判）

GDD §16.1「必须有」把上传+生成+逗猫+牌局+回忆一次装进首个竖切。按 `game-flow-questions.md` T2「先做一条能从头跑到尾的最小循环」，我建议**分三环、顺序不减项**：

| 环 | 内容 | 依赖缺口 | 门 |
|---|---|---|---|
| **Loop-0** | 主厅（静态锚图 + fx 微动）→ 星爪牌一局 → 星砂 → 杂货铺买玩具 → 玩具出现在主厅 → 心光解锁一段官方猫回忆 → 再来一局 | ① ②（或选 B 改牌规） | **S4 闭环** |
| **Loop-1** | 逗猫角（狩猎链 + 序列帧猫 + 前景遮挡）+ 触摸陪伴 | ③ ⑧ | S4 扩 |
| **Loop-2** | 上传 → 素材检查 → 身份锚 → 主人确认 → 基础活照片 → 后台扩充 | ⑤ ⑥ ⑦ | 媒体线独立门 |

理由：Loop-0 **零媒体缺口**，可在引擎排期媒体件的同时先跑通、先复查、先目击；GDD §16.3 ②「网络生成失败时仍能完成陪伴与牌局」本来就要求 Loop-0 独立成立。

---

## 6. 缺口裁决：10 项，请 owner 判 A/B

> **owner 2026-09-24 第一批判词**：「只有能抽象成引擎通用能力的才立缺口；游戏专属规则直接在游戏逻辑里实现。」据此 **①② = 游戏专属 → 游戏层确定性 TS 模块**（`capability-plan.md` §4 例外④·game-c 摊牌/边池先例；**牌规本身 owner 还要对**），**④ = B 先行·撤单**，**③ = 撤单（逗猫改用视频实现·不做拖羽毛棒）**。逗猫改视频后媒体线重心从 ⑧（画布序列帧）移到 ⑩（Video 控件按状态换片·播完信号·不黑帧）。下面 ①②④ 原文保留作实查记录，裁决以本段为准；余 ③⑤⑥⑦⑧⑨⑩ 逐条待判。

> 按 CLAUDE.md「⚖ 缺口裁决协议」：① 已实查（原文见各条）→ ② 摆两条路 → ③ **owner 判**。**推荐不是裁决，裁决前不动代码。** 机读投影：`capability-gaps.json`（全部 `state:"open"`）。

### 缺口 ① 公共星盘（持久公共牌堆 + 目标堆出牌 + 堆操作动词）

**实查**：`card-pile.ts:141`「出牌区在同实体」、`:179-180`「reset-then-apply：本拍没出牌…→ 清空出牌区」；`card-play.ts:78-89` 每 tick 按本拍输入覆写 PlayedHand（一拍脉冲·不累积·不从手牌移除）；`effect-apply.ts:47-48` kind 闭集 `set-flag|set-flag-tagged|modify-resource|set-state|set-sensor|set-visible|set-visible-tagged|destroy|destroy-tagged|reset-timer`——**无任何改 deck/hand/PlayedHand 的动词**；`CardPile` 字段（`cardboard.ts:191-217`）无牌库余量出口。
**为什么重组不成**：把牌做成实体走 `t2-queue-slots`/`t2-tray` 能摆出三个盘，但所有计分件只读 `PlayedHand.cards` 数组，两边接不上。

| | **A · 下沉引擎 `t2-shared-pile`** | **B · 改牌规适配现有词表** |
|---|---|---|
| 做什么 | 新组件 `SharedPile{id, cards[], top, depth}`；`CardPile.play` 输入加目标堆参数；输入键/Effect 动词 `swap-piles`/`pin-card`/`pop-top`；`CardPile.deckCountResource` 出口 | 星爪牌改成「出牌即结算」：各自 `PlayedHand` 一拍成组（对子/三条走 `t3-poker-hand` rankingTable），猫爪动作改成修正（压牌 = 对方下回合 mult×½ 经 `t2-modifier-stack`；拨牌 = 对方 `discard` 一张） |
| 代价 | 🔴 主程面（碰 CardPile 定序·card-scoring 读取面）·估 2-3 天含测试 | 零引擎改动；GDD §10.2「公共落牌区」核心张力消失，规则要 GD 重写（规则本就 🟡） |
| 影响面 | 掼蛋出牌区 / 麻将牌河 / 任何桌游公共堆——**rule-of-three 可期**（game-a/b 均有同形需求） | 只本作 |
| 通用性 | 高 | — |
| 选错要付什么 | A 选错 = 引擎多一件没人用的堆 | B 选错 = 牌局失去「三个盘上的博弈」，后期想加回来仍要做 A |

**推荐：A**（公共堆是桌游通用件，且 GDD 把三星盘当牌局身份）。

### 缺口 ② 组合判型 DSL（同色任意点数 · 循环点数域 · 第三属性）

**实查**：`hand-pattern.ts:27-32` 牌族 kind 闭集 `ntuple|sequence|tuple-sequence|flush-sequence|fixed-set`——**无「同花色、点数任意」**；`:237-245` 连续扫描 1..14 线性域**不能回绕**（月相残→新）；`cardboard.ts:58-73` Card 只有 `suit/rank` 两维，**爪印无字段**；`poker-hand.ts:112/119` flush/straight 需 ≥5（fourFlush 也 ≥4），3 张判不出；`card-scoring.ts` 谓词只看单张（`cardboard.ts:124-131`）。
**能表达的**：成对 `{kind:'ntuple',composition:[2]}`、三连 `{kind:'sequence',runLen:3}`、同色三连 `{kind:'flush-sequence',runLen:3,suited:true}`。

| | **A · 扩 `t3-hand-pattern` DSL** | **B · 收窄牌属性到现有两维** |
|---|---|---|
| 做什么 | 新 kind `suited-set`（同 suit 任意 rank）；`HandFamily.rankCycle?: number`（循环域）；第三属性编码约定（如 rank 高位或 `Card.tag`） | 牌 = 星色（suit）× 月相（rank，去循环）两维；「爪印」改成猫爪动作次数而非牌属性；组合只留 成对/三连/同色三连 |
| 代价 | 🟢 已有能力扩写（纯函数·spec 明确·测试可钉）·估 1 天 | 零引擎改动；GDD §10.2 三属性设计降一维 |
| 影响面 | 麻将「花色任意」、月相类循环牌全受益 | 只本作 |
| 选错要付什么 | A：多两个没人用的 kind（成本低） | B：牌面表达力少一维，后期加回仍要 A |

**推荐：A**（扩写成本低、通用；`suited-set` 是麻将/UNO 类都要的族）。**若 ① 选 B，② 也应选 B**（一起收窄）。

### 缺口 ③ 指针跟随实体 + 距离/速度条件叶（逗猫驱动量）

**实查**：`queued-input.ts:96-101` `PointerInputSource{move:true}` **能**把 `{x,y,phase:'move'}` 逐拍入 InputQueue（`input-capture/index.ts:17` 契约）；但全仓 `phase === 'move'` 只在测试命中——**无任何 sim 能力把 move 写进实体 Transform**；`t2-keybind` 只透传 `arg` 不透传 `x/y/values`（`keybind.ts:98`）；`ConditionExpr` 闭集（`logic.ts:78-90`）`always|and|or|not|resource|flag|state|timer|string|cooldown`——**无距离/速度/位置叶**；`t3-caster at:'pointer'` 是唯一读指针坐标的 sim 能力（只能在光标处 spawn）。
**能近似的**：`t2-zone-occupancy`（矩形区内有玩具 → Flag）当关注区/纸袋遮挡区；`t3-aggro`+`t2-steering` 让猫朝玩具移动。**做不了**「缓慢移动」「速度合适」「未及时逃开」。

| | **A · 下沉 `t2-pointer-follow` + 条件叶** | **B · 逗猫降级为「区占用 + 拍数」** |
|---|---|---|
| 做什么 | 新组件 `PointerFollow{playerId, smoothing}` 每拍把最新 move 写自身 Transform 并派生 `Resource speed.<id>` / `dwell.<id>`；`ConditionExpr` 加 `distance{a,b,cmp,value}` 与复用 resource 叶读 speed | 玩具只在 pointerdown/up 落点瞬移；关注区/遮挡用 zone-occupancy 旗；「逃逸窗口」用 `after` 拍数 + `Effect.chance` |
| 代价 | 🔴 主程面（碰 InputQueue 消费定序 + ConditionExpr 闭集·`logic.ts` 共享）·估 2 天 | 零引擎改动；GDD §8.3 ①「玩具跟手」与 §9.3「可读预兆」落空，逗猫退化成点击小游戏 |
| 影响面 | 一切「鼠标当玩具/光标当诱饵」玩法、拖拽预览（`grid-drag-square.ts:20` 原文「本引擎尚无先例」）| 只本作 |
| 通用性 | 高 | — |
| 选错要付什么 | A：一件多数游戏用不上的输入件 | B：本作的第二支柱（玩耍）不成立 |

**推荐：A**（玩耍是体验支柱，且「跟手」是 GDD 三条实时定义之首）。

### 缺口 ④ 触摸手势数值载荷（方向 / 速度 / 持续时长）

**实查**：`clickable.ts:113` 产出 `Signal{name,source}` **不带坐标/方向/速度**；`clickable.ts:44-46` phase 只承诺 `down|up`；`drag-place.ts` 只在抬起时给起终点（`queued-input.ts:45-57`）无时长；命中 AABB（`clickable.ts:121`）。
**首版可做**：五分区子实体 + Clickable → 按「区 + 安心/兴致」判接受/拒绝（`cat-ai.md` §2.3）。

| | **A · Signal 带数值载荷 / 触摸解释器** | **B · 首版只按区判** |
|---|---|---|
| 做什么 | `Clickable.emitPayload:true` → Signal 附 `{x,y,dx,dy,dwellTicks}`；或与 ③ 合并（pointer-follow 的 speed/dwell 已是 Resource，条件可读） | 偏好只看区；方向/速度/时长留 ⚪ |
| 代价 | 与 ③ 合并时 ≈ 0 增量；单做 🔴 主程面 1 天 | 零 |
| 影响面 | 摸宠/按摩/擦拭类玩法 | — |
| 选错要付什么 | 低 | GDD §9.1 五个读取量只落一个；可后补 |

**推荐：B 先行，与 ③ 合并交付时再补 A**（P2·不锁关）。

### 缺口 ⑤ `AishePort` 扩展（身份参考图 / 角色 ID / 首尾帧 · 轮询 / 取消 / 删除）

**实查**：`src/services/aigp/aishe-port.ts` 接口全文——`AisheGenerateOptions{aspect?,negativePrompt?,seconds?,seed?}`，`generate(prompt,opts)` **唯一方法**；**零图片字段**；句柄 `pending` 后**无 poll/getStatus/cancel/delete**；全仓只有 `NullAishePort` 被实例化（`games/game-i/game-i.ts:136`），`HttpAishePort` 无消费方、无代理脚本。GDD §8.8「已查到①」属实但**漏了「pending 推进不了」**。

| | **A · 扩端口（Lead·services）** | **B · 只用文本提示 + 同步 ready 后端** |
|---|---|---|
| 做什么 | `AisheGenerateOptions` 加 `referenceImages[]/characterId/firstFrame/lastFrame`；端口加 `poll(id)/cancel(id)/delete(id)`；开发期代理脚本（照 `scripts/game111-deepseek-proxy.mjs` 形态·key 不进浏览器） | 不带参考图 → **身份不稳定**，违反 GDD §8.7「视频不能从任意单张照片自由发挥」 |
| 代价 | 🔴 主程面 services（异步旁路·不碰 world）·估 2 天 + 真后端对接 | 产品核心承诺「它仍然是它」不成立 |
| 影响面 | 一切图生视频消费方（game-i 的 aishe-studio 直接受益） | — |
| 选错要付什么 | 低 | 高 |

**推荐：A**（无 B 可言；这是产品成立的前提）。

### 缺口 ⑥ 媒体作业链（玩家上传端点 · 素材检查 · 身份锚生成 · 主人审核队列 · 媒体 Blob 缓存 · 删除/导出）

**实查**：`main_entry/server.py` `/api/art/upload` 只收 `{slug,no,dataBase64,ext}` 单图、白名单 png/webp/jpg/jpeg/glb、**是创作者换美术槽用的**；无 multipart；`/api/assets/matte|generate|review|autotag` 全是**开发期创作台件**（review 待审区形态可参考）；`services/storage` 的 `IndexedDbKV` **只收 string**（存不了视频 Blob）；无 CacheStorage/Service Worker；无「图→特征」「图→图」端口（`ai-gen` 只文本生图）。**现仓没有「玩家运行时后端」这一层。**

| | **A · 立「媒体作业服务」（services 端口 + 开发期代理 + Blob 缓存端口）** | **B · 首版不做玩家上传，只做官方猫** |
|---|---|---|
| 做什么 | `MediaJobPort{submit,poll,cancel,delete,export}` + `MediaCachePort`（Blob）+ 审核队列数据形状；产品后端由 owner 另定（本仓只出端口与 Null/Http 实现 + 开发期代理） | Loop-2 整体延后；官方猫的片段走离线生成入库（创作台 review 门已有） |
| 代价 | 🔴 主程面 + 产品后端（本仓外）·估 1-2 周 | 零引擎改动；产品第二承诺「上传自己的猫」延后 |
| 影响面 | 任何 UGC 媒体游戏 | — |
| 选错要付什么 | A 早做 = 在后端未定时先固化端口形状（可控：端口薄） | B = 首发少一半卖点，但 Loop-0/1 不受影响 |

**推荐：A 的端口层先立（薄·Null 实现即可跑 CI），真后端与 Loop-2 排期由 owner 定。**

### 缺口 ⑦ 玩家侧文件/照片上传控件（PUI）

**实查**：`catalog.ts` Input 的 `type` 只有 `'text'|'number'`；全仓 `type="file"` 只在 studio 的 React 代码；LayoutNode **无文件/相机控件**。

| | **A · PUI 扩 `Input.type:'file'`（accept/multiple/capture）→ action 带文件句柄** | **B · 上传页走宿主壳层自由 DOM** |
|---|---|---|
| 代价 | PUI 域·估 0.5-1 天 | **违反 UI 铁律**（禁手写 DOM）——不接受 |

**推荐：A**（报 PUI·P2·Loop-2 前交付即可）。

### 缺口 ⑧ 「生成片段 → alpha 序列帧图集」转换管线（媒体线的关键重组）

**实查**：`AssetType` 闭集（`asset-index.ts:15`）**已含 `'video'`** 但 `registerAssetIndex` 只桥 texture/mesh（原文「其它类型…运行时消费端后续增量接入」·index.json 里 video 0 条）；`asset-types.ts` 已有 `prerendered-sequence` kind（「由 3D 模型预渲染出的有序 2D 帧…当一张 2D 图集切片用」）；`t2-anim-state` clip 表 `{sheet,from,count,fps,loop}` 按 State 切 clip；`canvas-renderer.ts` 精灵有 zOrder、`t2-clickable` 可命中——**播放/遮挡/命中/确定性四件全现成**。`/api/assets/matte`（rembg 抠图）只处理单张。
**GDD 漏看的路**：生成片段在服务侧一次性转成 alpha 序列帧图集（12fps·512px·webp），入库当 `prerendered-sequence`，猫就活在画布层里，与前景遮挡、逗猫棒、命中区天然同层。

| | **A · 序列帧路线（转换管线 + `video` 资产桥接）** | **B · 真视频路线（= 缺口 ⑨ VideoActor）** |
|---|---|---|
| 做什么 | 服务侧 `clip → 逐帧 matte → 图集 + manifest` 作业（可挂在 ⑥ 的作业链上）；`registerAssetIndex` 桥接 `prerendered-sequence`；`CLIP_CATALOG` 直接映射到 anim-state clip 表 | 见 ⑨ |
| 代价 | 🟢 资产面扩写 + 转换脚本（PST/资产管线）·估 2 天；**体积**：3 秒片 ≈ 36 帧 ≈ 3-6 MB/片（webp）·每猫 8-12 互动片 ≈ 40-70 MB，桌面/网页可接受，移动端要按需拉 | 见 ⑨ |
| 影响面 | 一切「AI 生成动画角色」游戏；与 3D 预渲染同一条资产路 | — |
| 选错要付什么 | 帧率上限 12-15fps、体积；高保真毛发在 webp 有损下略糊（可用 png 换体积） | 见 ⑨ |

**推荐：A 作为 Loop-1 基线**（播放侧零引擎改动、确定性天然成立、遮挡/命中免费）；回忆影片继续走 `Video` 控件整屏播（已可用）。

### 缺口 ⑨ 视频角色投影件 VideoActor（宿主视频层 · 透明合成 · 预载/切换/结束事件）

**实查**：`mount-host.ts` 分层 = 背景图 < 画布 z0 < UI z10/z20，**无视频层槽位**；`canvas-renderer.ts` 无遮罩/裁剪/混合/视频纹理（`grep -rni video src/renderer src/engine src/skills` = 0）；`<video>` 不透明（render.ts:1015 硬写 `background:#000`）；`Video` 改 `src` 整元素重建（黑帧）；无 `ended` 事件（`server.ts` 监听表无 ended/timeupdate）。GDD §8.8 缺口②③ **属实**。

| | **A · 下沉 VideoActor（新 RendererBackend 层 + 宿主视频槽 + alpha 合成 + 结束→sim tick 对齐）** | **B · 首版不做·用 ⑧ 序列帧覆盖** |
|---|---|---|
| 代价 | 🔴 主程面（renderer + host + 组件协议 + determinism 名单）·估 1-2 周·浏览器透明视频（VP9 alpha/HEVC alpha）兼容性坑 | 零；高帧率/超长片留给 Video 整屏 |
| 影响面 | 一切「AI 视频角色」游戏 | — |
| 选错要付什么 | 早做 = 大投入押在浏览器透明视频上 | 晚做 = 逗猫最高 15fps |

**推荐：B（延后·P2）**，等 ⑧ 跑出体积/观感数据再判。

### 缺口 ⑩ `Video` 控件事件与绑定（PUI·小）

**实查**：`VideoProps{src,poster,controls,loop,autoplay,muted}`（`types.ts:642`·catalog 漏登 `muted`）；无 `onEnded action`、无 `bind`（Image 有）、无 `preload/fit`。回忆影片「播完先停留不弹奖励」需要播完信号（进 UI 层·不进 sim）。

**推荐：A（报 PUI·P3）**：`Video.onEnded: action` + `bind` + `fit`；顺手补 catalog 的 `muted`。

### 裁决汇总表（请 owner 直接在此批注）

| # | 缺口 | 推荐 | 池 / 域 | 锁哪关 | **owner 裁决** |
|---|---|---|---|---|---|
| ① | 公共星盘 | — | **游戏层**（PE-112） | — | ✅ **游戏专属·不进引擎**（2026-09-24） |
| ② | 判型 DSL 扩展 | — | **游戏层**（随 ①） | — | ✅ **游戏专属·不进引擎**（2026-09-24） |
| ③ | 指针跟随 + 距离/速度叶 | — | — | — | ✅ **撤单**（2026-09-24·逗猫改视频实现） |
| ④ | 触摸手势载荷 | B 先行 | — | — | ✅ **B·撤单**（2026-09-24） |
| ⑤ | AishePort 扩展 | A | engine services（主程） | —（Loop-2） | ⬜ A ⬜ B |
| ⑥ | 媒体作业链 | A（端口先立） | engine services + 产品后端（owner 另定） | —（Loop-2） | ⬜ A ⬜ B |
| ⑦ | 文件上传控件 | A | pui | —（Loop-2） | ⬜ A ⬜ B |
| ⑧ | 片段→序列帧转换 + video 资产桥接 | A → **降 P2**（逗猫改视频后非硬需求） | engine 资产面 / PST 脚本 | — | ⬜ A ⬜ B |
| ⑨ | VideoActor | **B（延后）** | engine（主程） | — | ⬜ A ⬜ B |
| ⑩ | Video 控件事件 + 按状态绑定 + 换片不黑帧 | A → **升 P1**（猫画面基本件） | pui | — | ⬜ A ⬜ B |

**另请 owner 一并判**：§5 竖切分三环（Loop-0 零媒体缺口先跑通）⬜ 准 ⬜ 按 GDD §16.1 原样一次到位。

---

## 7. 确定性声明（框架级）

| 项 | 口径 |
|---|---|
| 随机源 | `w1-random` 世界种子；子流 `deriveSeed`（AI / 狩猎链 / 离线事件）；游戏层零 `Math.random` |
| 墙钟 | 全禁进 sim；离线时长由宿主分档成 key 注入；`savedAt` 宿主注入 |
| 媒体 | 片段可用性、播放进度、`ended`、生成回包到达序 **全不进 sim**；投影层组件登记 `NON_DETERMINISTIC`（若 ⑨ 选 A） |
| 外部输入 | 主人确认 / 上传结果 / 生成完成 → 宿主侧媒体库索引 + 经 `QueuedInputSource` 的具名 action 进 InputQueue |
| 回放 | 录输入流（含分档 key），重放不调任何服务，bit 一致 |
| lockstep | 首版单人，不需要；但**不许**在游戏层留下未来做不了 lockstep 的写法（同上四条即够） |

---

## 8. UI 与美术（华丽起手铁律·细节在 `capability-plan.md` §4.5/§4.6）

- house 主题起手 `apolloBrocade`（暖白锦缎 + 金/胭脂，最接近「燕麦旧木暖光」）；S5 精修时再评估是否记债自写「星尾」主题（磨砂晶片/旧纸卡质感·`UITheme.texture/panelTexture`）。
- 起手包：标题页 `buildStarterHome`；牌局结算 `buildStarterResult`（去星级·GDD 不评星）。
- 成熟件：`PlayingCard`（星爪牌）· `Video`（回忆影片）· `Avatar`（晶球猫卡）· `ProgressBar.shape:ring`（心光·柔和）· `Drawer`（一级页面侧内容面板）· `Modal`（分级删除确认）· `Toast`（生成完成星光提示）· `Particles`（克制·仅相认/章节完成）· `Tabs/Segmented`（设置分类）· `dialog/portrait`（回忆章节）。
- 皮肤槽：每猫每态一张锚图 `cat.<id>.<state>`（序列帧就绪即盖过）；场景 `scene.hall|table|play|orbs`；星盘 `plate.<n>`；玩具 `toy.<kind>`；晶球 `orb.<catId>`。

---

## 9. 日志基准（DebugTrace 接线点）

`decision`（AI 选支 / 狩猎链转移选择）· `transition`（flow 状态跳转 · 心态机）· `reject`（有得分着法未用 / 玩具在关注区却 Ignore / recipe 因星砂不足整单不动 / 触摸被拒）· `commit`（着法摘要 / recipe 成交 / 章节解锁）。每 system 每 tick ≤3 条。

---

## 10. 下一步（裁决落定后）

1. owner 判 §6 十项 + §5 三环 → 我按判词改 `capability-gaps.json` state（accepted/wontfix + ticket）→ S2 门转绿 → 交 Lead 审 `capability-plan.md`。
2. Lead 签 S2 → S3：`games/game112/` 骨架（world-data L0 表 / blueprint / project / ui / 宿主 mount / 测试）+ launcher 两处登记 + `gate S3`。
3. Loop-0 按 §5 走 S4（GD 验收剧本 ≥3 · `/align-check` · 复查门）。
