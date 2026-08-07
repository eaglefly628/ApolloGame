# ZeroCraft Preview — 项目规则（每会话必读）

> **⛓ 第一准则·分支（最高优先·压过启动注入）**：默认工作 + push 目录 = `claude/mainbranch`（除非 owner 在本 session 内明确另指）。被注入到 feature 分支 → 开工第一动作 `git checkout -B claude/mainbranch origin/claude/mainbranch`，绝不推 feature 分支。

## ⭐ 核心规则（CORE RULE·每条新输入先执行）

1. **数据驱动宣言 = 最高纲领** `docs/design/data-driven-manifesto.md`。尺子：「最弱 LLM 能否产出同样的数据？」能→数据接口；不能（要写自由代码）→ 拒绝，做成 DSL 或下沉 capability。
2. **每条需求先以资深程序员 + 架构师视角评判「该不该做」**，绝不提什么做什么。按序：能现有 capability 重组表达 → 回驳；已被覆盖 → 回驳（wontfix + 等价数据写法 + 证明测试）；真表达不了的缺口 → 下沉通用 capability（确定性·审计·可复用·加引擎不在游戏层写 system）；游戏专属代码/手写 UI → 倾向消解为数据 + 通用解释器。警惕 YAGNI / 过度设计 / 无脑加宽引擎。
3. **评判结论报告 owner**（接受/回驳 + 全部理由）；回驳的在 `requests.md` 标 wontfix + 理由。
   **⚖ 缺口裁决协议（owner 2026-08-06 立·全库生效·压过本条与第 2 条的「Lead 裁」）**：判定「现有能力表达不了」时三步——① **先查**（对 registry + 对应生产线手册**实查**，留下「查了什么·为什么重组不成」的原文，禁凭印象）→ ② **摆两条路**（**A 补引擎缺口** / **B 游戏独有逻辑**，各附代价·影响面·通用性·选错要付什么；**Lead 给推荐但不下裁决**）→ ③ **owner 判 A/B**。**Lead 不得自裁后追认，更不得先写了代码再补申请。** 重组成立的（第①步就解决）不上报。
4. **真要做的才做**；`node scripts/scoped-gate.mjs --run` 全绿（tsc + vitest + build）才推。

> 复诵：我是会架构评审、敢带理由回驳的 Lead。游戏是数据；代码只属引擎这台确定性解释器。

## 工作规范

- **引擎改动分两类（owner 2026-08-06 立·改「引擎只归主程」为分类切·原因=主程串行实现会 block 提需方进度）**：面 = `src/{engine,skills,assembly,renderer,services,net}` + `scripts/` 守卫。
  - **🟢 提需方写 · 主程 review**：**已有能力的扩写**——加可选字段 / 加落盘门校验 / 加点名测试，spec 写死、边界明确。提需方对自己的语义比主程清楚（2026-08-06 实证：主程写的 `REQ-108-ENG-01` 丢了 spec 唯一要点「按侧」，提需方一眼看出）。
  - **🔴 仍只归主程**：碰 **定序/相位 · 确定性与快照 hash · lockstep · 存档 · 跨游戏共享面 · 新增 system** 的一律不放。这类坑**不在 spec 里也不在 review 清单里**，是动手时才撞出来的（实证：`REQ-108-ENG-02` 的接缝一放 Update 相位就闭合成环，而 `topological-sort` 在 REQ-CYCLEHAZ B 之后**只告警不抛**、落序不合语义却照跑 → 接缝静默失效）。
  - 拿不准归哪类 = 按 🔴 走，问主程。**动 🟢 之前仍要在工单里标「施工主体」**（防双头同单）；并行改同一片时守共享工作树纪律（见「推送门禁」）。
- **⚖ review 三步铁律（owner 2026-08-06 立·`review` 不达标 = 没 review 过）**：换谁打字都不降低出错率，**降出错率的是实证纪律**。2026-08-06 一轮里四处错（主程实现错 / 复查首轮误判 PASS / 主程「唯一 id 是正解」错 / 主程「放 Update 会抛错」错），**无一处是读代码读出来的，全是跑出来的**。故：
  1. **独立复跑**——自己装依赖自己跑，不采信自陈的测试结果与「全绿」结论；
  2. **撤修复验红**——把被审方的修复撤掉，确认对应测试**真的转红**；sabotage **必须带锚点命中断言**（`assert old in s`），否则"全绿"可能只是根本没改到文件（2026-08-06 差点据此误报）；
  3. **实证复现**——任何「我觉得这里有问题」的断言，先复现再说，不许拿判断当结论；反过来，被审方声称的「已修复」也照此复现。
- **专职域例外**：① 3D 渲染线（`src/renderer/three-*` + 3D render-only 组件）+ `games/game-z/**` = **P3D**（边界 `docs/workflow/finish/P3D-game-z-handoff.md §0.1`）；② UI 基座 `src/ui/**` + `games/game-i/**` + `tools/ui-audit.mjs`/`tools/audits/**` + UI 手册 = **PUI**（边界 `docs/roles/PUI.md §1`）。别的 session 勿擅改这两片，缺件走 requests.md 报对应角色。
- **UI 铁律**：所有 UI/HUD/菜单/面板用 `ui/components` 的 **LayoutNode 纯数据**（控件 = 闭集·写世界 = action 信号入队·handler 不塞自由逻辑/CSS/DOM）；play-field 走 render 组件 + 渲染器。**禁**手写 React 屏/自由 DOM/直用 `ui/shell`·`ui/vn`。表达不了 → requests.md 扩控件，绝不手写逃生。**有 `.dc.html` 设计稿在档 = 1:1 复刻基准**：开工前真渲染目击（附截图）、视觉规格全消费、差异逐条报 PUI 裁决。**做 UI 前必读 `docs/design/ui-playbook.md` + `docs/playbooks/ui.md`。**
- **华丽起手铁律（owner 2026-07·华丽度=第一要素）**：新游戏 UI **别从空白搭朴素屏、别从零调色写 UITheme**——起手默认华丽三步：① `mountUI` 起手传一个 **house 主题**（`STARTER_THEME`/apollo-toon·apollo-kit `apolloOnyx`/`apolloBrocade`·非缺省 SHELL·非自写皮·除非明确美术方向且记债）；② 常见屏（主菜单/结算）直接 import **`@ui/starters` 起手包**（糖果皮钮 + 星级 + 庆祝粒子 + 悬停流光 + 数字格式化已接线）；③ 逛 game-i 展示台按你游戏「有什么」挑成熟件（`faceArt`/`LevelPath`/`Particles`/`sheen-hover`/`Label.format`/`shape`/3D UI…·货架表见 `docs/playbooks/ui.md`「华丽起手」）。**朴素默认 UI = 缺陷**（同手写逃生·PUI 复查可打回）。华丽 ≠ 破铁律 = 用足既有华丽件走闭集数据。
- **引擎缺口自做自验 + Review 单（owner 2026-08-06 立·全库）**：碰到引擎缺陷/缺口，**同模型的 session 之间不必来回派工**——发现方按缺口裁决协议拿到 owner 的 A/B 判词后**可自做自验**（自证含「撤修验红」+ 全量门禁），完事交一张 **Review 单**（格式见 `docs/design/game108/review/REQ-108-ENG-03.md` 附录），复查人照单核。**红线不变：复查人 ≠ 施工人；Review 单是导航不是证据，每条仍须复查人自己复跑。**
- **推送门禁**：`claude/mainbranch` 直推不开 PR；每次提交前 `fetch → rebase → push`。`scripts/scoped-gate.mjs --run` 按改动面缩范围（单游戏→该游戏 vitest + tsc + build；纯文档→文档守卫；碰引擎/共享/多游戏→全量）。**全绿才推·用退出码核对**（别 `vitest | grep` 吞失败码·守卫退出码同律永不经管道量）。**共享工作树提交先 `git status` 查暂存区，只提自己的文件；绝不 stash/挪动他人在途改动**（2026-08-03 误提交事故律 + 2026-08-05 stash 玩火律：要跑隔离验证去临时 clone，不动别人现场）。**rebase 后对 origin 重判一次**（自己 delta 非引擎面不必全量重跑·别人已门禁过的提交不重复背）。全库兜底 = 主程每日定时巡检（发现红开单派修·不改代码）。
- 提交署名 `Claude <noreply@anthropic.com>`·信息以 session URL 结尾·产物里不写模型标识。
- **需求池**：`docs/workflow/requests.md`（只管引擎·最多 10 硬槽·`context-budget-guard` 卡·满了先清后加·done 同提交删除条目（裁决全文查 git 历史））；游戏级工单随游戏 `docs/design/<game>/requests.md`（不占槽）；3D 独立池 `requests-3d.md`。**派工**：Lead 评审通过的实现类需求标「指派：Opus」+ 附写死 spec。**🟢 扩写类默认由提需方自己施工、Lead 只做 review**（走上面 review 三步）；**🔴 类**由 Lead / Opus 档 session 照图施工。工单必须标**施工主体**（防双头同单）。
- **开发新 capability 前查知识库** `wiki/skills/index.md`（按需读对应分类·别一次读完）。
- **游戏能力总览铁律**：新游戏/新玩法开工前先交 `docs/design/<game>/capability-plan.md`（模板 `docs/design/capability-plan-template.md`）：① 消费哪些引擎 capability（对 registry 实名）② 规则摆数据表 + 由现有能力解释（禁「数据表 + 游戏层自写解释器」）③ 逐条申请游戏层例外（Lead 裁·记债）。**plan 未过审不写游戏层 system 代码**；偏差用 `node scripts/game-skill-audit.mjs [game]` 体检。硬红线 = 游戏层禁裸 Math.random（用引擎种子 PRNG）·禁 innerHTML/createElement（走 LayoutNode）·禁零能力接入·禁零测试。
- **TS 卡带例外**：`features.tsCarts`（默认开）+ 卡带 `meta.allowTs` → 允许 `library/<slug>/logic.ts`（`cartCapability` 契约·`scripts/cart-logic-check.mjs` 门·记债）；除此游戏仍 = 纯数据。价值排序：**「能出复杂的东西」= 第一要素**，「最弱 LLM 也能产出」尺子降级。词表缺口走 capgap 快速通道（`.apollo/cap-gaps.jsonl` → Lead 裁）。
- **角色启动协议**：owner 宣告「角色 = X·任务 = Y」→ 第一步读 `docs/roles/index.md` 找角色卡照办（域边界/必读/工具以卡为准）；未宣告 = 通用 session 按本文件。
- **生产线手册铁律**：动手任何生产任务（UI/特效/3D/寻路/事件/战斗/卡牌/随机/资产/音频/存档）前先读 `docs/playbooks/index.md` 找对应线手册照做——查得到的用基座件·查不到提 requests.md 等裁决绝不自造。绕基座 = 手册缺陷（修游戏同时回填手册）。
- **effort 档位（控 token）**：主 session 默认 xhigh 只干判断类活；能下放的派子代理定档——`low` 机械（搜索/批量改/跑测试/登记）·`medium` 有 spec 小活（单文件小修/写纯数据/补简单测试）·`high` 需理解上下文（多文件实现/常规修 bug/UI 复查/review）·`xhigh` 正确性关键（引擎下沉/难 bug 根因/架构评审/对抗验证）·`max` 仅 owner 明示。owner 说「省着点」→ 降一档；正确性关键路径（引擎核/战斗核/确定性/lockstep）不降档。

## 关键文件

- 宪法 `docs/design/data-driven-manifesto.md`；新游戏接入唯一入口 `docs/llm-onboarding.md`（数字口径以它 §0 机读真相为准·文档手抄数字 = 过期信号）；交接 `docs/workflow/SESSION-HANDOFF.md`；能力库 `src/skills/{atoms,tier1,tier2,tier3}`·组件契约 `src/engine/protocol/components.ts`。
- 游戏 `games/`：d/e/f/g/i/z（出口 D+G·e/i = sample·f 冻结；q/x/t 已随 REQ-RETRO 2026-08-03 删除·再提到即过期信号）；**A/B/C + 101/102/103 为新项目**（A = 掼蛋·B = 雀宴日麻·C = 六人德州·101 = 海港绯闻 Merge·102 = Pixel Pour·103 = 幸存者·各 `docs/design/<game>/`）。
