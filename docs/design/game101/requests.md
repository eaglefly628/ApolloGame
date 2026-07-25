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

### REQ-101-07 · 顾客卡基准保真·待 PUI 异型容器 · 2026-07-24 · 提出人 PE-101 → 指派 PUI（引擎池 REQ-UI-异型容器） · status: open（异型待 PUI·多槽已落） · 优先级: P2 · 类型: UI 基座依赖
> owner 对基准截图定「顾客托盘最多 3 slot + 右侧动态异形限时菜单」为**底层需求**（ui-brief §4.0/4.1/4.2）。PE 评审：
> - **✅ 多 slot 显示已落地（2026-07-24）**：现有闭集（`Panel(row)+N 子 slot`）表达·orders.json needItems 数组驱动（1–3 槽）·`order-fulfill` 交付逐槽置满·真渲染目击在案。
> - **异型限时菜单卡 = 仍待 PUI**：基座 `Panel` 无 shape 枚举 → 引擎池 `REQ-UI-异型容器`（PUI）。落地前 game101 用矩形卡顶着，本件落地即升级异型。
> **不越界**：不在游戏层塞 clip-path/硬贴图逃生（manifesto 红线）——按流程报 PUI。

### REQ-101-06 · 生成器接线撞墙·待引擎加权 spawn · 2026-07-24 · 提出人 PE-101 → 指派 主程/Lead（引擎池 REQ-TAPSPAWN） · status: open（阻塞·非全库阻断） · 优先级: P1 · 类型: 实现阻塞
> M1 生成器（G1）按 Lead §6「组合」接线时**撞墙**（子代理源码复核确认）：扣费半场 `clickable`+`craft-recipe` 可组合，但**加权运行时 spawn 无引擎原语**（`caster`/`self-rule` 固定 template·`effect-apply` 不能 spawn·`draft-offer` 未接世界 `RandomSeed`/未接线）。
> 已按 §6「撞墙→回报下沉 tap-cost-spawn」报**引擎池** `docs/workflow/requests.md REQ-TAPSPAWN`。**`generators.json` 已备数据·待该能力落地即接线**（clickable+craft-recipe 扣费 + 新 weighted-spawn 产出）。其余 M1 面（合并/资源/体力/S1）不受阻·已绿（8/8 测试）。
> **不违规**：不在游戏层手写加权/裸 Math.random（manifesto 红线）——故按流程报引擎缺口，不硬接。

### REQ-101-08 · 挖掘式区域解锁（阻碍层·二消清邻·核心乐趣）· 2026-07-25 · 提出人 owner→GD-101 → 指派 **主程/Lead（引擎能力 G6）+ PE（游戏数据/接线）** · status: open · 优先级: P1 · 类型: 机制（引擎下沉 + 游戏数据）
> **需求（owner 2026-07-25·参考图 Gossip Harbor 实机·IP 不入库）**：每格除消除外有**阻碍/锁定层**；**二消时周边 3×3 格阻碍各 −1**；减到 0 **解锁**露出格内内容（能量⚡/宝箱/宝石💎/物品）。**核心乐趣之一**——合并身兼爬链 + 挖板、空间即奖励。设计详见 `systems-economy.md §5.5` + `config-schema.md §10 board-cover.json` + `capability-plan.md §2.5 G6`。
> **架构裁断（GD·别在游戏层手写扫格 solver）**：
> - ✅ **游戏层（PE）**：只摆 `board-cover.json`（覆盖格 `Blocker{layers, reveal}` 数据）；覆盖格不可拖/不可落子（同 §5 尊重锁 flag）；`layers==0` 解锁按 `reveal.kind` 走 prefab / resource-apply / 开箱。**零手写玩法逻辑**。
> - 🔴 **引擎层（主程/Lead·G6 下沉）**：**「merge-on-place 合并 → 3×3 网格邻格 `Blocker.layers` 各 −1·归零发信号」** 空间邻格效应。原语 `spatial-query.queryRange` 已有 + `match3-board` 同型「格层减层·`neighbors4` 减邻格 blockers·line 527」已证；下沉通用 `merge-proximity-clear`（或 merge-on-place 姊妹件）。**禁游戏层/宿主手写扫 3×3 减邻格**（manifesto §3 红线·且宿主非确定性 sim）。
> **前置**：G6 引擎能力需 Lead 裁下沉 + 占引擎池（`docs/workflow/requests.md`·现池近满·由 Lead 清槽/排期）。能力落地前 PE 可先备 `board-cover.json` 数据 + 覆盖格渲染（阻碍层皮·不可拖），**不硬接减层逻辑**。
> **验收**：headless — 覆盖格不可拖；在其 3×3 内二消 N 次 → 该格 `layers` 减 N；归零 → 清层 + 露出 `reveal` 内容 + 确定性同 hash。真玩 — 挖开一片露出能量/宝箱、可用空间扩大。
