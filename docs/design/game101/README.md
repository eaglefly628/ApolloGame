# game101 · 新立项 ·《海港绯闻》(工作名) — Merge & Story 合并游戏复刻

> **owner 2026-07-23 拍板：新开 game101 槽位**（数字槽·owner 特批，偏离字母约定已知会）。复刻对标 **Gossip Harbor®: Merge & Story**（发行 Microfun）的**核心玩法**——merge-2 合并板 + 视觉小说剧情 Meta。
> 本目录 = GD-101 唯一写权限区（铁律：**只产数据与文档，零代码**）。

## brief（owner 2026-07-23 口述）

> "你是 game101 的策划，我要做一个 Gossip Harbor 这个游戏的复刻。你去调研一下设计，复刻核心 gameplay，然后出一个设计给 claude designer 出设计图。"

拆解：① 调研 Gossip Harbor 核心玩法（合并/体力/订单/剧情/装修）；② 以本项目数据驱动口径复刻**核心 gameplay**（不做整包商业化）；③ 产出**逐屏 UI 规格**（`ui-brief.md`）+ 用真 LayoutNode 库出布局（`layout/`）。详见 `brief.md`。

## 一句话定位

一边把海港餐厅重新经营起来、一边在合并小游戏里放松解压、一边追一部狗血又上头的海港连续剧。**点生成器（耗体力）→ 合并物品 → 交付订单 → 得金币/星星 → 星星推进剧情与装修 → 解锁新内容**。

> **换皮口径（规避 IP）**：只复刻玩法机制，角色/剧情/美术全部原创——原创世界观「云汐湾·汐味馆」，女主「林夏」（详见 `gdd.md` §角色）。Gossip Harbor 的 Quinn/Harrison 等仅作参照，绝不照搬文案。

## 文档索引

| 文档 | 内容 | 状态 |
|---|---|---|
| [`brief.md`](./brief.md) | owner 口述原文 + 调研结论摘要 | ✅ |
| [`gdd.md`](./gdd.md) | 核心玩法策划案（核心循环/合并板/生成器/体力/订单/剧情/装修/数值·config 默认） | 🟢 v1 |
| [`config-schema.md`](./config-schema.md) | 数据驱动配置表结构（合并链/生成器/体力/订单/剧情 JSON + M1 默认值） | 🟢 v1 |
| [`capability-plan.md`](./capability-plan.md) | **S2 能力总览**（对照 registry 实名映射；过 Lead 审才许进代码） | 🟡 草案 v1·待 Lead 评审 |
| [`ui-brief.md`](./ui-brief.md) | 逐屏 UI 规格（控件映射 + 信号·据此用 LayoutNode 出各屏） | 🟢 v1 |
| [`refs.md`](./refs.md) | 原作真机截图拆解 + 对照（版权图不入库·仅文字） | 🟢 |
| [`layout/`](./layout/) | **真 LayoutNode 库 UI 布局**（`s1-merge-board.layout.json` + 暖色主题 + 效果图·纯数据） | 🟢 S1 |
| [`impl-plan.md`](./impl-plan.md) | **程序实现方案**（屏→文件 / 数据→能力 / 信号 / 占位美术 / 施工顺序·PE 蓝图） | 🟢 v1 |
| [`requests.md`](./requests.md) | 游戏级工单（不占引擎池槽；能力缺口→引擎 requests.md 提 LEAD） | 🟢 |

## 状态

- brief：✅（见上 / `brief.md`）
- GDD：🟢 v1 `gdd.md`（核心循环 owner 待拍板；数值/剧情量留开放）
- capability-plan：🟡 草案 v1 `capability-plan.md`（**merge-rule/grid-drag-square/prefab-spawn/resource-apply/timer-advance/w1-random/event-when/effect-apply/timeline/dialogue 高度复用现有能力**；2 处缺口已列 §2.5 待 Lead 裁）
- 设计稿：**改用真 LayoutNode 库出布局**（owner 2026-07-23「用我们 UI 库更好」）→ `layout/s1-merge-board.layout.json`（S1 已落·`validateLayoutNode` 0 issue·`layout/s1-preview.png` 效果图）；早期 emoji `.dc.html` 已删。逐屏规格见 `ui-brief.md`。
- 生产流程板：未开（`docs/playbooks/game-production.md` 八阶段·一会话一阶段）
- 工单号段：**REQ-101-01 起编**（游戏级）；引擎能力缺口进 `docs/workflow/requests.md`

## 里程碑（八阶段对齐见 gdd.md §八阶段对齐）

- **M0 设计**（本次·GD）：立项卡 + GDD + 配置表 + 能力计划 + designer 规格 ✅
- **M1 灰盒**：合并板 + 生成器 + 体力 + merge-2 + 角色气泡订单 + 金币（素皮）
- **M2 追剧闭环**：星星 + 剧情任务 + 视觉小说演出（dialogue）+ 装修 Meta + 章节推进
- **M3 视觉 1:1**：LayoutNode 布局逐屏出全（`layout/*.layout.json`）+ 主题美术接入
- **M4 内容/打磨**：多物品链、多章剧情、数值平衡、手感/特效

## 角色与通道

- **GD-101**：本目录唯一写权限人（**只产数据与文档，零代码**）。
- 能力缺口 / 跨游戏共性 → `docs/workflow/requests.md` 提 LEAD（引擎池·10 硬槽）；游戏级工单开本目录 `requests.md`（随游戏走·不占槽）。
- 实现由 PE-101 领工（capability-plan 过审后）；UI 布局 GD-101 用真 LayoutNode 库出在 `layout/`，PE 移植进 `src/games/game101/`。

## 开工词（owner 开 PE-101 施工 session 时整段粘贴·照 roles/index.md 标准模板）

```
第一动作（先于一切）：git fetch origin claude/mainbranch && git checkout -B claude/mainbranch origin/claude/mainbranch
角色=PE-101 · 任务=《海港绯闻》M1 合并核开工。切完分支先读 docs/roles/index.md 角色卡照办；
立项档=docs/design/game101/（README→gdd→config-schema→capability-plan→ui-brief）——以 mainbranch 最新为准，
你被注入的 feature 分支是旧快照、绝不在其上开工。
先决：capability-plan 必须 Lead 过审（未过审不得写游戏层系统代码）。
本阶段只领 M1（八阶段·一会话一阶段·板未开先按 docs/playbooks/game-production.md 开板）：
src/games/game101/ 用数据表 + 现有能力搭核心循环——merge-rule(need:2 每链一条) + grid-drag-square 板
+ prefab-spawn 生成器（clickable 触发·耗 f1-resource 体力）+ resource-apply(金币/星星) + timer-advance(体力恢复)
+ event-when/effect-apply(订单交付发奖) + w1-random(生成器掉落表·禁裸 Math.random)；
headless 测试钉死（merge 确定性/掉落表同 seed 复现/体力恢复/订单交付发奖）。
硬线不放松：种子 PRNG、禁手写 DOM（走 LayoutNode）、sim 确定性、零测试不出货。
UI 布局用真 LayoutNode 库出在 docs/design/game101/layout/（纯数据·validateLayoutNode 0 issue），
你按其移植成 src/games/game101/ 的 buildXxx(): LayoutNode，落地跑 /check-ui + ui-audit。
产出直推 claude/mainbranch（fetch→rebase→scoped-gate 全绿→push），绝不推 feature 分支。
宣布「完成」必须贴 node scripts/game-pipeline.mjs board game101 输出——不全绿只许说「做到 SN」。
```
