# game101 · 程序实现方案（Implementation Plan · PE 施工蓝图）

> GD-101 · 2026-07-23 · owner 口径「不用再单独设计，用原生布局，出个程序能做的方案」。
> **判断**：原生**布局**=功能性/品类惯例（不受版权保护），已在 `ui-brief.md` + `layout/s1-merge-board.layout.json` 落定 → 直接复刻结构，**跳过 Cloud Design 设计工序**。受版权的仅**像素美术** → 用**授权占位（Twemoji）+ 原创生成**，绝不抠竞品截图。
> 本文 = PE 照着施工的蓝图（屏→文件 / 数据→能力 / 信号 / 占位美术 / 顺序 / 门禁）。GD 只出方案与数据·零代码。

## 0. 前置门（先过再动代码）

1. `capability-plan.md` 过 **Lead 审**（REQ-101-01·含 §2.5 G1–G4 裁决）→ 才许写游戏层代码。
2. 八阶段流程板：**一会话一阶段**（`docs/playbooks/game-production.md`）。
3. 施工前必读：`docs/playbooks/ui.md` + `docs/design/ui-playbook.md`（UI）· `docs/playbooks/rendering-fx.md`（play-field）· `docs/playbooks/art-pipeline.md`（资产）。

## 1. 架构分层（三层·别混）

| 层 | 归谁渲染 | game101 内容 |
|---|---|---|
| **Chrome UI** | LayoutNode（`src/ui` 闭集）| HUD / 顾客订单 / 剧情任务 / 装修 / 商店·体力弹层 / 结算 / 新手 |
| **play-field** | 引擎 render 组件（**非 LayoutNode**）| 7×9 合并棋盘（物品/生成器/气泡）|
| **sim** | 现有 capability 解释配置表 | 合并/掉落/体力/订单/剧情/装修（`config-schema.md` 表 → 能力）|

## 2. 屏清单 → LayoutNode 交付物（每屏一个 `layout/<name>.layout.json`）

| 屏 | 文件 | 关键控件 | 绑定数据 | 主要信号 |
|---|---|---|---|---|
| S1 主界面 | `layout/s1-merge-board.layout.json` ✅**已出** | Screen/Panel/Label/Button/Avatar/ProgressBar/Badge | 体力/金币/星星/宝石/经验 resourceId | `open_shop/menu/tasks/reno/events` |
| 顾客订单（内嵌 S1 顶）| 同 S1 | Panel+Avatar+Label+Badge | `orders.json`（needItem/reward）| `deliver_order` |
| S5 剧情任务 | `layout/tasks.layout.json` | Panel+Label+ProgressBar+Button | `story.json`（Day 清单/costStars）| `task_do` |
| S7 装修 3选1 | `layout/reno.layout.json` | Panel+Image×3+Button | `renovation.json`（3 styles）| `reno_fix` / `reno_pick` |
| 商店·体力购买 | `layout/shop.layout.json` | Modal+Panel+Button | 货币/礼包表 | `buy_energy` / `open_shop` |
| 结算 | `layout/settle.layout.json` | Modal+Label+Particles | 局奖励 | `restart` / `exit` |
| S10 新手 | Coachmark overlay（`src/renderer/coachmark`）| Coachmark | 引导步 | `tutorial_step` |

> 每屏交付前：`validateLayoutNode` **0 issue** + `/check-ui`（防重叠/对比/透明/卫生）+ `node tools/ui-audit.mjs`（PUI 域工具）。全流式布局（column/row/grid）防重叠；文字走语义色令牌。

## 3. 合并板 play-field（引擎渲染·PE + 缺件报主程/rendering-fx）

| 玩法 | 消费能力 | 数据 |
|---|---|---|
| 7×9 网格拖放合并 | `grid-drag-square` + `merge-rule`(need:2·每链每级一条) | `chains.json` |
| 生成器点击产出 | `clickable` →门控(体力≥cost)→`effect-apply`扣体力→`w1-random`抽表→`prefab-spawn` | `generators.json`（含 `cooldownSec`→`timer-advance`）|
| 订单交付区 | `drop-zone` + `event-when`/`effect-apply`（或 `craft-recipe`）| `orders.json` |
| 气泡锁·金币购买 | `f2-flag`(locked) + `clickable` + `resource-apply`(扣金币) | `bubbles.json` |
| 可交单✓ / 新产出🡇 badge | render-only 派生（订单 needItem 在板高亮 / prefab 新戳）| — |

> §2.5 缺口 **G1**(耗体力门控)/**G2**(交付消耗棋盘实例)/**G3**(泡泡金币购买)/**G4**(生成器CD) 未过审前不写对应 system——先等 Lead 裁「组合表达 / 下沉通用能力 / 例外」。

## 4. 数据绑定（`config-schema.md` 表 → 消费方·一一对账）

`game.json`→板尺寸/seed · `chains`→`merge-rule` · `generators`→`prefab-spawn`+`w1-random`+`timer-advance` · `energy`→`f1-resource`+`timer-advance` · `orders`→`drop-zone`+`event-when`+`effect-apply` · `story`→`dialogue`+`event-when`+`f2-flag` · `renovation`→`f2-flag`+Sprite槽 · `bubbles`→`resource-apply`+`f2-flag` · `levels`→`f1-resource`+`event-when` · `juice`→`timeline`。
**HUD 显示绑定**：`ProgressBar`/`Label` 用 `bind`(resourceId) 绑体力/金币/星星/经验/满意度——数值走 sim resource，UI 只读。

## 5. 信号总线（`action` 信号 → sim 能力消费·handler 无自由逻辑）

`gen_tap(genId)` / `buy_bubble(cell)` / `deliver_order(orderId)` / `task_do(taskId)` / `reno_fix(nodeId)` / `reno_pick(nodeId,styleId)` / `buy_energy` / `open_shop|menu|tasks|reno|events` / `restart` / `exit`。信号名入队成 `Signal`（events-logic.md），sim 能力消费；人/AI 共用动作总线。

## 6. 占位美术（授权·PA 域·绝不用竞品像素）

1. **Twemoji 占位**（CC-BY·`assets/emoji` 4871 张）：`scripts/emoji-vendor.mjs game101 --apply` → vendor 进 `public/games/game101/art/emoji/` → 主题 `emoji.base` 指过去 → UI 文本 emoji 自动图渲成套图。物品/生成器/资源图标先用它。
2. **物品/生成器 Sprite 皮肤槽**：`config-schema` 已留 `sprite:item_*/gen_*` 命名；Twemoji 顶第一版，PA 出**原创 cozy 海港风**套图替换（`art-pipeline.md` + 台账推导脚本）。
3. **顾客立绘**：原创生成（PA）；未就绪时 `Avatar` 首字回退（S1 现状=周/陈/晴）。
4. 一切资产走 `asset-manager` 技能 + 美术台账登记（`art-*.md`）；`resolveAsset` 解析 key，**不把二进制塞 sim**。

## 7. 测试 / 验收（headless·确定性·零测试不出货）

- 钉死：merge 确定性（distinct-seq/最老先合）、掉落表**同 seed 复现**、体力按 tick 恢复、订单交付发奖、泡泡扣费门控、生成器 CD。
- GD 出 **S4 验收剧本** `acceptance/`（seed+操作序列→逐步期望·纯数据；PE 修代码不改剧本）。
- 门禁：`node scripts/scoped-gate.mjs --run`（改动全在 game101→只跑该游戏 tsc+vitest+build）。

## 8. 施工顺序（M1 起·一会话一阶段·宣布完成贴 `game-pipeline board game101`）

- **M1a 玩法核**（S3-S4）：manifest + 配置表落 JSON → play-field（合并/生成器/体力/订单/金币）→ headless 测试钉死。
- **M1b 主界面 chrome**（S5 视觉）：移植 `layout/s1-merge-board.layout.json` 进 `src/games/game101/`（做成 `buildS1(): LayoutNode`）+ HUD resource 绑定 + Twemoji 占位接入 → `/check-ui`+`ui-audit`。
- **M2 追剧闭环**：星星→剧情任务（tasks 面板）→`dialogue` 演出→装修（reno 面板）→结算。
- **M3 美术替换**：PA 原创套图替 Twemoji 占位（皮肤槽热替·观感零回归）。

## 9. 角色 / 边界

- **PE-101**：`src/games/game101/**` 施工（capability-plan 过审后）。
- play-field render 组件缺件 → `docs/workflow/requests.md` 提主程（rendering-fx 线）。
- `src/ui` 闭集缺控件/色令牌 → 报 **PUI**（`requests.md`）。3D 无需。
- 资产 → **PA**（asset-manager）。
- **GD-101** 只出本方案 + 数据（layout json / config / 验收剧本）·**零代码**。
