# Game 112《星尾会客厅》·策划档案索引

> 当前阶段：**S1 立项卡已落板 · S2 机器门绿 + 复查 PASS（S2-reviewer-agent）· S3 机器门绿 + 复查 CONCERNS（r2·守卫测试已补）· S4 机器门绿 + 复查 PASS（r2）**（`node scripts/game-pipeline.mjs board game112`）。owner 2026-09-24 判：11 项缺口全裁（游戏专属进游戏层 / 引擎两款能力归 Lead）。
> **S3 施工主体 = GD/PE-112 session**（owner 2026-09-24 令「游戏端你来连续实现」·本行即锁）· 基线 = S2 复查 PASS（S2-reviewer-agent·2026-09-24 03:10）。引擎三单（05/06/11）归 Lead（05/06 主程已交·等独立复查）。
> **S3 碰过的文件（边界栏·复查范围核查用）**：`games/game112/**`（新建）· `public/games/game112/{pipeline.json,art/**,probe/**}`（CLI/脚本/探针写）· `docs/design/game112/{acceptance,self-check}/**`（S4 剧本与自证）· `scripts/game112-playthrough.mjs`（S4 真浏览器试玩·26 断言·16 图）· `scripts/game112-spec-recursion.mjs`（S4 递归复核·11 条款打坏验红）· `docs/design/game112/**` · `src/launcher.tsx`（+1 条 GAMES 登记）· `src/launcher/game-runner.tsx`（+1 行 loader）· `scripts/game112-art-requirements.mjs`（新建·美术台账推导）· 另 `scripts/scoped-gate.mjs`+test（台账文件归类修复·owner 授权·主程 review 欠）。
> Claude Design 对齐稿：`claude-design-brief.md`（出稿放 `cloud-design/`）。
> **S3 参考样例（只学结构·不抄玩法·index.md 铁律 5）**：`games/game111/blueprint.ts`（蓝图组织·KeyBinding→Effect 预展开表·「宿主不许直接塞 Signal」）· `games/game111/ui.ts`（LayoutNode 写法·page() 外壳·壳层右上角保留区）· `games/game111/game111.ts` + `project.ts`（宿主 mount 形状·世界→POD 投影）· `games/game-103/blueprint.ts` ringSpawnerEntities（表展开 ≠ 解释器）· `games/game-103/acceptance-adapter.ts`（S4 薄适配契约）。玩法全部溯 `gdd.md`（关系四量 §6.2 / 星砂 §12 / 杂货铺 §12.4 / 回忆 §11 / 离线小事件 §3.4）。
> 引擎侧文档（GD/PE-112 · 2026-09-23）：`framework.md`（骨架 + 缺口 A/B 摆盘）· `capability-plan.md`（能力总览·待 Lead 审）· `capability-gaps.json`（机读缺口台账）· `requests.md`（游戏级需求单）· `cat-ai.md`（猫 AI 设定·必填档）。

## 建议阅读顺序

1. [`brief.md`](./brief.md) — 一页立项卡，快速确认方向。
2. [`gdd.md`](./gdd.md) — 完整策划总纲，玩法、叙事、经济、照片上传和视频技术方案。
3. [`menu-flow.md`](./menu-flow.md) — 全部菜单、页面、导航与异常流程，交给产品/UI 设计使用。
4. [`ui-visual-handoff.md`](./ui-visual-handoff.md) — 交给 Crow Code 或 UI 设计人员的页面表现要求。
5. [`visual/`](./visual/) — 当前视觉方向图与场景概念。
6. [`framework.md`](./framework.md) — **引擎骨架**：四层分工（sim / 宿主 / 投影 / UI）、能力对账、**十项缺口 A/B 请 owner 判**、竖切三环。
7. [`capability-plan.md`](./capability-plan.md) — 能力总览（模板 `docs/design/capability-plan-template.md`），S2 机器门读它。
8. [`cat-ai.md`](./cat-ai.md) — 猫 AI 设定（牌桌四性格 + 狩猎链参数），`opponent-ai.md` 规定的必填档。
9. [`requests.md`](./requests.md) · [`capability-gaps.json`](./capability-gaps.json) — 需求单与机读缺口台账。

## 决策标记

| 标记 | 含义 |
|---|---|
| 🟢 | owner 已明确表达，视为当前基线 |
| 🟡 | 本策划案提出的推荐方案，等待 owner 确认 |
| ⚪ | 尚未讨论，不应据此开工 |

## 当前视觉资料

| 文件 | 用途 |
|---|---|
| [`visual/cat-art-direction-v1.png`](./visual/cat-art-direction-v1.png) | 首只短毛猫早期方向板 |
| [`visual/cat-art-direction-ragdoll-v1.png`](./visual/cat-art-direction-ragdoll-v1.png) | 布偶猫精致版方向板 |
| [`visual/cat-art-direction-ragdoll-v2-lived-in.png`](./visual/cat-art-direction-ragdoll-v2-lived-in.png) | 布偶猫“有人生活过”方向板，当前风格基线 |
| [`visual/scene-cat-play-ragdoll-v1.png`](./visual/scene-cat-play-ragdoll-v1.png) | 固定低机位逗猫场景概念 |

## 当前口径

- 🟢 世界是“喵星的共同空间”，咖啡厅只是早期表述，不做传统餐厅经营。
- 🟢 玩家可以遇见不同品种/毛色的官方猫，也可以上传自己的猫。
- 🟢 核心是陪伴、牌局与回忆；猫有自己的过去和离线生活。
- 🟢 高保真表现以照片转活视频、爱诗生成视频和视频衔接为主，不要求纯 3D。
- 🟡 工作名为《星尾会客厅》，场所名为“星尾馆”，记忆媒介称“忆光晶球”。
- 🟡 实时互动采用“缓存即时反应 + 爱诗后台生成下一段”的连续错觉，不逐帧等待云端生成。

## 尚未裁决

- 最终游戏名与场所名。
- 猫猫牌的完整规则、难度和局长。
- 商业化方式与是否存在付费货币。
- 上传照片数量、生成额度、视频保存期限与云端成本。
- “忆光晶球”是否保留为核心世界观装置。
- 桌面悬浮猫是否进入首发范围。
