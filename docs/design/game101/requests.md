# game101 · 游戏级工单（requests）

> 工单随游戏走·**不占引擎池 10 硬槽**。引擎能力缺口 / 跨游戏共性 → `docs/workflow/requests.md` 提 LEAD。
> 号段：**REQ-101-01 起编**。格式：`### REQ-101-nn · 标签 · 日期 · 提出人 → 指派 · status · 优先级 · 类型`。
> status ∈ open / in-progress / done(附提交·迁归档) / wontfix。

---

### REQ-101-01 · capability-plan 评审 · 2026-07-23 · 提出人 GD-101 → 指派 LEAD · status: **✅ done（⚖ Lead 过审 2026-07-23·全文见 `capability-plan.md §6`）** · 优先级: P0 · 类型: 评审
> **⚖ Lead 裁决（2026-07-23·核过 registry + craft-recipe/merge-rule/drag-place 源码·全文落 `capability-plan.md §6`）：✅ 过审·零预下沉·PE-101 可开工 M1（REQ-101-04）。**
> - **G1 tap-cost-spawn → ① 组合**（`clickable`+`event-when`门控+`effect-apply`扣费+**引擎加权抽原语**掉落表+`prefab-spawn`；禁游戏层手写加权/裸 Math.random）。
> - **G2 订单交付 → 先试组合·撞墙即下沉 `order-fulfill`**。⚠ **`craft-recipe` 不适配**（核实：只吞/产资源计数·不吞棋盘实体实例）；试 `drop-zone`+`event-when`+`k2-destroy`+`effect-apply`·M1 实证「消耗被投放实例」表达不了才下沉。
> - **G3 泡泡锁 → ① 组合·推荐 bubble-wrapper**（锁=独立泡泡实体·点破+扣币→destroy 泡泡→spawn 真物·merge 按模板天然不碰·零引擎改动）。备选=给 merge-rule+drag-place 加 `Locked` flag 小守卫（Lead 做）·owner/GD 二选一。
> - **G4 冷却+产能 → ① 组合**（`timer-advance` 置 CD + `clickable` 拒 + `f1-resource` 产能）。
> - **§4 胶水 ≤120 行**（纯装配·禁写加权/门控/合成/交付 solver）。
> **唯二可能触发引擎动作**（撞墙/选路后才走引擎池占槽·不预占）：G3 flag 路 / G2 下沉 order-fulfill。判「下沉」的项到时转 `docs/workflow/requests.md`。**PE-101 M1 照此开工·撞墙回本表报缺口。**

### REQ-101-02 · UI 布局设计 · 2026-07-23 · 提出人 GD-101 → 指派 GD-101 · status: in-progress · 优先级: P0 · 类型: UI
> 【owner 2026-07-23「用我们 UI 库设计更好」→ 改口径】弃用 emoji `.dc.html`，改用真 **LayoutNode 闭集控件 + game101 暖色主题**出布局（纯数据）。
> **S1 已落** `layout/s1-merge-board.layout.json`（`validateLayoutNode` 0 issue·效果图 `layout/s1-preview.png`）；早期 `mockups/*.dc.html` 已删。
> 待续：S5 剧情任务 / S7 装修 3选1 / 商店·体力弹层 / 结算 等纯 LayoutNode 面板逐屏出 `layout/<screen>.layout.json`。落地移植进 `src/games/game101/` 归 PE（capability-plan 过审后·落地跑 /check-ui + ui-audit）。

### REQ-101-03 · 出货线朝向确认 · 2026-07-23 · 提出人 GD-101 → 指派 LEAD/PUI · status: done · 优先级: P1 · 类型: 平台
> ✅ owner 2026-07-23 拍板：**走竖屏 1080×1920，不适配横屏**。设计稿/接线一律按竖屏。（本条完结·下次清理迁归档）

### REQ-101-04 · M1 灰盒领工 · 2026-07-23 · 提出人 GD-101 → 指派 PE-101（capability-plan 过审后）· status: open · 优先级: P1 · 类型: 实现
> 前置：REQ-101-01 过审。按 `config-schema.md` 落 manifest + 配置表，用现有能力搭核心循环（merge-rule/grid-drag-square/prefab-spawn/resource-apply/timer-advance/w1-random/event-when/effect-apply）。GD-101 同步产出 S4 玩法验收剧本（`acceptance/`）。开工词见 `README.md`。

### REQ-101-05 · 美术台账推导脚本命名 · 2026-07-23 · 提出人 GD-101 → 指派 PA · status: open · 优先级: P2 · 类型: 美术管线
> `capability-plan.md` §4.5 编译期皮肤台账推导脚本名待定（照 game-q 样板）。M1 接线时定名并回填 plan。

### REQ-101-07 · 顾客卡基准保真（多槽 + 异型限时菜单）· 2026-07-24 · 提出人 PE-101 → 指派 PUI（引擎池 REQ-UI-异型容器） · status: **✅ done（2026-07-25·多槽 + 异型均已落）** · 优先级: P2 · 类型: UI 基座依赖
> owner 对基准截图定「顾客托盘最多 3 slot + 右侧动态异形限时菜单」为**底层需求**（ui-brief §4.0/4.1/4.2）。PE 评审：
> - **✅ 多 slot 显示（2026-07-24）**：现有闭集（`Panel(row)+N 子 slot`）表达·orders.json needItems 数组驱动（1–3 槽）·`order-fulfill` 交付逐槽置满·真渲染目击。
> - **✅ 异型限时菜单卡（2026-07-25·PUI 交 `Panel.shape` 后接）**：PUI `REQ-UI-异型容器` 已交（commit fff62209·Panel.shape 8 款 ShapeToken 复用 Button clip-path）→ 限时特惠订单卡（苏晴）升级 `shape:'cut'`（八边切角·内容安全不裁 slot/奖励·区别 hexagon/diamond 重裁）+ 金框 edge:'gold' + ⏱ 倒计时。clip-path polygon 目击在案·ui-audit 0 阻断。**不再手写 clip-path·用基座闭集。**（本条完结·下次清理迁归档）

### REQ-101-06 · 生成器接线撞墙·待引擎加权 spawn · 2026-07-24 · 提出人 PE-101 → 指派 主程/Lead（引擎池 REQ-TAPSPAWN） · status: **✅ done（2026-07-25·weighted-spawn 已落地并接线）** · 优先级: P1 · 类型: 实现阻塞
> **✅ 解除阻塞并接线（2026-07-25）**：引擎 `t2-weighted-spawn` 已落地（Lead 裁 REQ-TAPSPAWN），生成器接线完成——`Clickable`(点)+`CraftRecipe`(全局体力 afford 闸门·按 id 扣全局 energy)+`EventWhen`(旗→do_spawn)+`WeightedSpawn{onSignal:do_spawn, table:dropTable}`(按权重抽产出·换掉原 caster 固定产表首项)。+ 世界 `RandomSeed` 单例（确定性/回放·禁裸 Math.random）。
> **注（报 Lead·非阻断）**：weighted-spawn 自带的 `cost` 读的是**实体自身 Resource**（每实体预算模型）·不匹配 game101 全局体力池 → 故体力仍走 craft-recipe（全局 id 扣），weighted-spawn 只设 table 不设 cost。若 Lead 想让 cost 支持全局 id 口径（同 craft-recipe），可后续加 scope；当前组合已正确工作。
> **验收**：23 测试绿（含加权分布测试·多点跨掉落表≥2 档=真加权非恒首项 + 确定性 hash）；浏览器目击（点米仓→稻谷落开放工作格→合出米饭🍚→顾客槽变绿可交付·体力逐点扣）。**同提交连带修**初始关卡开放工作格（原 6 开放格全占满→生成器产物无处落=没法玩·今开出 8 空工作格 10-13/17-20·核心循环闭环）。

### REQ-101-08 · 挖掘式区域解锁（阻碍层·二消清邻·核心乐趣）· 2026-07-25 · 提出人 owner→GD-101 → 指派 **主程/Lead（引擎能力 G6）+ PE（游戏数据/接线）** · status: **✅ 实现已交·待 Lead 复核**（引擎能力 `t2-merge-proximity-clear` + 游戏数据接线·PE-101 按 owner「game101 核心循环端到端建」标准建·同 merge-on-place/order-fulfill 口径） · 优先级: P1 · 类型: 机制（引擎下沉 + 游戏数据）
> **✅ 实现（2026-07-25·PE-101·标记 Lead 复核）**：
> - **引擎能力** `src/skills/tier2/merge-proximity-clear.ts`（`t2-merge-proximity-clear`·登记 registry）：读 `MergeEvent`（merge-on-place 合成时发·新增）+ 单例 `MergeProximity{cellSize,radius,dec}` → 对半径内 `Blocker` 各 −dec·归零发 DestroyRequest + reveal（spawn=SpawnRequest / resource=资源+amount 钳限）。**减层全在引擎 sim·零游戏层/宿主扫格**（红线守）。7 单测 + merge-on-place 加发 MergeEvent（5 测仍绿）。
> - **组件**：`Blocker{layers,reveal}`·`MergeEvent{x,y}`·`MergeProximity{cellSize,radius,dec}`（component-map + baseline 已更）。
> - **游戏数据**：`config/board-cover.json`（6 覆盖格·layers/reveal）；theme `coverReveal` 友好 kind→引擎 reveal（item→spawn·energy/gem/chest→resource）；blueprint `coverEntities` 摆 Blocker+Transform + MergeProximity 单例。
> - **渲染**：覆盖格沙色 🔒+层数·不可拖（host onDown 天然跳·onUp/relocate 排除覆盖格）。2 集成测（邻近二消挖开 cell15 露 coffee_1·远格 cell24 不动）+ ui-audit 0 阻断。
> - **真机目击**：二消 🍅🍅→🥗 → 邻格 cover 15(1层)清层露 🫘·cover 16(2层)减到 1（截图在案）。
> - **引擎池** `REQ-MERGEDIG` 同步标「实现已交·待 Lead 复核」。**Lead 若判 API/边界需调**，PE 配合改。
> **需求（owner 2026-07-25·参考图 Gossip Harbor 实机·IP 不入库）**：每格除消除外有**阻碍/锁定层**；**二消时周边 3×3 格阻碍各 −1**；减到 0 **解锁**露出格内内容（能量⚡/宝箱/宝石💎/物品）。**核心乐趣之一**——合并身兼爬链 + 挖板、空间即奖励。设计详见 `systems-economy.md §5.5` + `config-schema.md §10 board-cover.json` + `capability-plan.md §2.5 G6`。
> **架构裁断（GD·别在游戏层手写扫格 solver）**：
> - ✅ **游戏层（PE）**：只摆 `board-cover.json`（覆盖格 `Blocker{layers, reveal}` 数据）；覆盖格不可拖/不可落子（同 §5 尊重锁 flag）；`layers==0` 解锁按 `reveal.kind` 走 prefab / resource-apply / 开箱。**零手写玩法逻辑**。
> - 🔴 **引擎层（主程/Lead·G6 下沉）**：**「merge-on-place 合并 → 3×3 网格邻格 `Blocker.layers` 各 −1·归零发信号」** 空间邻格效应。原语 `spatial-query.queryRange` 已有 + `match3-board` 同型「格层减层·`neighbors4` 减邻格 blockers·line 527」已证；下沉通用 `merge-proximity-clear`（或 merge-on-place 姊妹件）。**禁游戏层/宿主手写扫 3×3 减邻格**（manifesto §3 红线·且宿主非确定性 sim）。
> **前置**：G6 引擎能力已挂引擎池 `docs/workflow/requests.md REQ-MERGEDIG`（待 Lead/主程 裁下沉·排期）。能力落地前 PE 可先备 `board-cover.json` 数据 + 覆盖格渲染（阻碍层皮·不可拖），**不硬接减层逻辑**。
> **验收**：headless — 覆盖格不可拖；在其 3×3 内二消 N 次 → 该格 `layers` 减 N；归零 → 清层 + 露出 `reveal` 内容 + 确定性同 hash。真玩 — 挖开一片露出能量/宝箱、可用空间扩大。
