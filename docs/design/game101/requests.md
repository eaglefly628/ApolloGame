# game101 · 游戏级工单（requests）

> 工单随游戏走·**不占引擎池 10 硬槽**。引擎能力缺口 / 跨游戏共性 → `docs/workflow/requests.md` 提 LEAD。
> 号段：**REQ-101-01 起编**。格式：`### REQ-101-nn · 标签 · 日期 · 提出人 → 指派 · status · 优先级 · 类型`。
> status ∈ open / in-progress / done(附提交·迁归档) / wontfix。

---

### REQ-101-01 · capability-plan 评审 · 2026-07-23 · 提出人 GD-101 → 指派 LEAD · status: open · 优先级: P0 · 类型: 评审
> `capability-plan.md` v1 草案待 Lead 备案评审。**重点裁 §2.5 G1–G4**（生成器耗体力门控 / 订单交付消耗棋盘实例 / 气泡锁 flag 尊重 / 免体力生成器产能条）走「①组合现有能力 / ②下沉通用 capability / ③游戏层例外」哪条；并裁 §4 装配胶水行数上限。
> 边界：判为「下沉」的项转 `docs/workflow/requests.md` 引擎池（通用能力·非 game101 私有 system）。**过审前 PE-101 不得写游戏层系统代码。**

### REQ-101-02 · designer 设计稿 · 2026-07-23 · 提出人 GD-101 → 指派 claude designer · status: open · 优先级: P0 · 类型: 美术/UI
> 按 `ui-brief.md` 出 `.dc.html` 设计稿，交付到 `docs/design/game101/mockups/`（+ `support.js`）。Sprint 1 最小起步包：S4 HUD + S1 合并主界面(default) + S2 食材链 Lv1–6 递进 + 3 生成器 + S3 订单卡 + S10 新手首屏。
> 口径：竖屏 1080×1920、百分比锚点；风格见 ui-brief §0。**1:1 复刻基准，但界面 LayoutNode 重做、禁挪用交付 HTML。** 交付后 GD-101 录入 + 写 `mockups/README.md` 编目 + ⚠口径警示表。

### REQ-101-03 · 出货线朝向确认 · 2026-07-23 · 提出人 GD-101 → 指派 LEAD/PUI · status: open · 优先级: P1 · 类型: 平台
> 本品类天然**竖屏**（ui-brief 按 1080×1920 出）；但仓库既有出货线（game-g）口径为**横屏 1280×720**。确认 game101 走竖屏专线还是需适配横屏——影响设计稿定稿朝向。

### REQ-101-04 · M1 灰盒领工 · 2026-07-23 · 提出人 GD-101 → 指派 PE-101（capability-plan 过审后）· status: open · 优先级: P1 · 类型: 实现
> 前置：REQ-101-01 过审。按 `config-schema.md` 落 manifest + 配置表，用现有能力搭核心循环（merge-rule/grid-drag-square/prefab-spawn/resource-apply/timer-advance/w1-random/event-when/effect-apply）。GD-101 同步产出 S4 玩法验收剧本（`acceptance/`）。开工词见 `README.md`。

### REQ-101-05 · 美术台账推导脚本命名 · 2026-07-23 · 提出人 GD-101 → 指派 PA · status: open · 优先级: P2 · 类型: 美术管线
> `capability-plan.md` §4.5 编译期皮肤台账推导脚本名待定（照 game-q 样板）。M1 接线时定名并回填 plan。
