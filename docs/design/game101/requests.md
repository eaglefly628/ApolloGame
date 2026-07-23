# game101 · 游戏级工单（requests）

> 工单随游戏走·**不占引擎池 10 硬槽**。引擎能力缺口 / 跨游戏共性 → `docs/workflow/requests.md` 提 LEAD。
> 号段：**REQ-101-01 起编**。格式：`### REQ-101-nn · 标签 · 日期 · 提出人 → 指派 · status · 优先级 · 类型`。
> status ∈ open / in-progress / done(附提交·迁归档) / wontfix。

---

### REQ-101-01 · capability-plan 评审 · 2026-07-23 · 提出人 GD-101 → 指派 LEAD · status: open · 优先级: P0 · 类型: 评审
> `capability-plan.md` v1 草案待 Lead 备案评审。**重点裁 §2.5 G1–G4**（生成器耗体力门控 / 订单交付消耗棋盘实例 / 气泡锁 flag 尊重 / 免体力生成器产能条）走「①组合现有能力 / ②下沉通用 capability / ③游戏层例外」哪条；并裁 §4 装配胶水行数上限。
> 边界：判为「下沉」的项转 `docs/workflow/requests.md` 引擎池（通用能力·非 game101 私有 system）。**过审前 PE-101 不得写游戏层系统代码。**

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
