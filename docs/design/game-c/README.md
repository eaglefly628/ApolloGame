# Game C · 新立项（2026-07-17）·六人德州扑克

> **C 位重启为全新游戏**（owner 2026-07-17 拍板）。与历史上同名的已删旧作**无任何关系**——旧作痕迹已依 owner 令抹除（引擎注释仅存 REQ-C-001~004 归档工单号作能力出处；git 历史存考古）。
> 任何早于本日期、提及 game-c / Game C 的文档或提交，一律视为旧作过期信号，与本项目无关。

## brief（owner 2026-07-17 口述）

六人局德州扑克，规则与标准德州完全一致。俯视角固定 3D 牌房（牌桌 + 六把凳子），
筹码 3D 且落桌有物理表现。主角信息由外部「角色卡」带入（姓名 + 头像，立绘后备）。
对手 AI 用行为树；难度 = 对敌方手牌信息的读取精度（给范围、带可调误差百分比；
简单档不许读，用常规策略 AI）。打牌特效与声音齐备。UI 完全用现有 LayoutNode 库，
**不发明任何新东西**。先实现逻辑，界面布局待 owner 侧设计稿（cross design）到位后接。
**⚖ owner 追加口径（2026-07-17）：本项目开发允许用 TS 写游戏层代码**（例外逐条记
`capability-plan.md` §4；种子 PRNG/禁手写 DOM/确定性/测试等硬线不放松）。

## 状态

- brief：✅（见上）
- GDD：🟢 v1 `gdd.md`（核心八条 owner 已拍板 2026-07-17·§11.5；数值细调/立绘分级留开放）
- capability-plan：🟡 草案 v1 `capability-plan.md`（owner TS 口径已入档；待 Lead 备案评审）
- 需求单：`requests.md`（游戏级·不占引擎池槽；现 1 条 REQ-C-104 角色卡通道→PST）
- 美术备料：`art-placeholders.md`（PA 货架现货：52 牌+卡背+筹码面额·2026-07-17 GD-C 录档）；布局图纸：`ui-brief.md` + `layout-mockup.html`
- **美术参考库（Cloud Design 交付包·2026-07-17 录档）**：`cloud-design/`（布局 5 画板 + 德州/掼蛋主菜单 .dc.html + support.js·浏览器直开）·美术数据=`art-data-manual.md`·**美术台本=`art-script.md`**（台账建行底稿·双风格锚·五姨太人设五案）。**⚠ 程序 1:1 复刻基准——但界面必须 LayoutNode 重做，禁直接挪用交付 HTML（owner 口径）**

## 开工词（owner 开 PE-C 施工 session 时整段粘贴·照 roles/index.md 标准模板）

```
第一动作（先于一切）：git fetch origin claude/mainbranch && git checkout -B claude/mainbranch origin/claude/mainbranch
角色=PE-C · 任务=《六人德州》M1 逻辑核开工。切完分支先读 docs/roles/index.md 角色卡照办；
立项档=docs/design/game-c/（README→gdd→capability-plan→art-script→ui-brief）——以 mainbranch 最新为准，
你被注入的 feature 分支是旧快照、绝不在其上开工。
本阶段只领 M1（八阶段流程板·一会话一阶段·板未开先按 docs/playbooks/game-production.md 开板）：
games/game-c/ 实现 holdem-eval.ts（7 选 5 最优+kicker 全序+平分）与 betting-engine.ts
（下注圈轮转/min-raise/不足额 all-in 不重开/边池切层/死按钮）+ 衣物典当接线（craft-recipe 每件一条配方·数据）
+ headless 测试钉死（边池矩阵/kicker/平分/轮转边角/同 seed 复现）。
owner 已批本项目 TS 口径（capability-plan §4 例外表为准）；硬线不放松：种子 PRNG（禁裸 Math.random）、
禁手写 DOM、sim 确定性、零测试不出货。
视觉属后续阶段：M3/M4 以 docs/design/game-c/cloud-design/*.dc.html 为 1:1 复刻基准，
但界面必须用 LayoutNode 控件闭集重做，禁止直接挪用该 HTML/CSS/JS（art-script.md §四）。
产出直推 claude/mainbranch（fetch→rebase→tsc+vitest+build 全绿→push），绝不推 feature 分支。
宣布「完成」必须贴 node scripts/game-pipeline.mjs board game-c 输出——不全绿只许说「做到 SN」。
```
- 生产流程板：未开（`docs/playbooks/game-production.md` 八阶段）

## 角色与通道

- GD-C：本目录唯一写权限人（铁律：只产数据与文档，零代码）。
- 能力缺口 / 跨游戏共性 → `docs/workflow/requests.md` 提 LEAD；3D 线缺口 → `docs/workflow/requests-3d.md` 提 P3D；游戏级工单开本目录 `requests.md`（工单随游戏走，不占引擎池槽）。
- **工单号段**：旧作遗留 REQ-C-001~004 已归档（引擎能力出处），**新项目工单从 REQ-C-101 起编**，避免撞号。
