# 接入清单 · 新手引导（coachmark）· 甲乙「用起来」（owner 2026-06-21）

> design G ｜ 2026-06-21 ｜ owner：主程已下沉引擎通用高亮能力（验收 PASS），**推给甲乙做起来·两人都要做**。
> 上位：策划案 `docs/design/onboarding-coachmark-capability.md` · REQ `docs/workflow/requests.md` REQ-ARCH-COACH · 首启 `doc28`。
> 引擎能力（主程 `ac64e1c1` 已落·勿重做）：`Coachmark` 组件(`protocol/render`) + `src/renderer/coachmark.ts`(纯·collect/几何/SVG) + `src/ui/onboarding-overlay.ts`(`mountOnboardingOverlay`) + GameShell `UINode.anchor`。

## 0. design G 验收 = PASS
表现层最小包逐条对上策划案（组件全字段 / data-anchor 统一两套 UI / 纯表现不进 hash / YAGNI 砍 Canvas/富文本）。coachmark 7 测绿 · tsc 0。**逻辑层（首次触发/步骤/看过不再弹/点对推进）= 现有能力重组（flow+flag+condition+clickable.onlyFlag+save）= 游戏侧数据 = 本清单甲乙的活。**
- ⚠️ 小瑕非阻塞：`arrow?` 字段已定义、SVG/DOM 暂未画箭头（后补·不挡）。
- ⚠️ mainbranch 有 2 个无关红测（`turn-battle-screen.click`·并行提交弄坏·非引擎）→ 甲顺手修。

## 1. 怎么用（三步 · 甲乙通用）
1. **打锚点**：要被引导的 UI 元素加 `data-anchor="<key>"`——GameShell 用 `UINode.anchor`（自动落 data-anchor）；手写 DOM 屏（lobby/battle）直接在元素上加属性（与现有 `data-act` 并存·零重构）。
2. **数据接线（game-side·重组·零引擎）**：每个功能一条引导 =
   - `Coachmark` 实体 `{ anchor:'<key>', text:'一句话', visibleWhen:'coach_<x>' }`
   - 首次触发 `EventWhen{ when: and(not flag('seen_<x>'), <该功能可见/进屏条件>) }` → 置 `coach_<x>` flag（亮高亮）
   - 点对推进：被引导按钮 `Clickable{ onlyFlag:'coach_<x>' }`（教学期只它可点）→ 完成 → `Effect set-flag seen_<x>` + 灭 `coach_<x>`
   - **看过不再弹**：`seen_<x>` 进 `save`（world.snapshot 持久化）
   - 线性强制流（doc28 教学关）= 一个 `GameFlow{ states: 各 step }` 串起来；情境首触（用某功能即教）= 各功能独立 `EventWhen{not seen_x}`。
3. **挂 overlay**：`game-g.tsx` 调 `mountOnboardingOverlay(host, world, anchorRoot)`，每帧/每 tick `update()`；卸载 `destroy()`。

## 2. 甲（战斗）—— 教 放牌 / 抽牌 / 推进掷命 / 打天罡
- `turn-battle-screen.ts` 动作按钮加 `data-anchor`：放牌 / 抽牌 / 打天罡 / 弃 / 结束回合 / 召唤源泉条 / 大本营。
- **doc28 教学关（关0）脚本 → Coachmark 数据 + GameFlow step**：每步亮一个 anchor + 一句话 + 点对（`Clickable.onlyFlag`）推进；一路点到底（放牌→推进→掷命→打天罡→破家→胜利解封）。
- seen：`seen_combat_deploy / _draw / _clash / _tiangang …` 进 save。
- 顺手修 2 个无关红测（turn-battle-screen.click）。

## 3. 乙（菜单）—— 教 改造坊 / 牌组构筑 / 商城 / 收藏 / 一键构筑
- `lobby-screen.ts` tab/按钮加 `data-anchor`：改造坊 / 我的牌组 / 商城 / 收藏 / **一键自动构筑** / 天梯 / 钻石充值。
- **首次进各屏即弹** coachmark 指示该点哪里（情境首触·`not seen_lobby_<x>`）。
- 接首启流程（doc28 引导 A/B/C）：开场故事 → 强制点玩法手册 → 点开始教学关 → 商城领赠送抽一发 → 进关1。
- seen：`seen_lobby_craft / _deck / _shop / _coll / _autobuild …` 进 save。

## 4. 与 doc28 / B6 对齐（删手写引导）
- **doc28 首启教学关** = 用本能力表达（线性 GameFlow + 每步 coachmark），**不再手写引导 DOM**。
- **B6 `doc/match-flow.html` 流程图** = HOME「新手指导」按钮开的 overlay 看图（旁路·与 coachmark 并存）。
- 若 game-g 现有 `tutorialBox()` 等手写引导 → 迁移到本能力或保留为静态说明（不与 coachmark 冲突）。

## 5. 验收
- headless：能力本体 collect 门控/几何已绿（主程）；游戏侧加 **seen 存档往返断言**（看过→存档→重载不再弹·确定性 hash 一致）+ 出帧（coachmark 高亮落在 anchor rect）。
- 全绿 tsc+vitest+build 才推；翻棒回 `PROGRAM-G-TASKS.md` + `PG-finish-list.md`。
- 真机：owner 看高亮/气泡观感（headless 看不到 live DOM）。
