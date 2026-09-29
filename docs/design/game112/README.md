# Game 112《星尾会客厅》·策划档案索引

> 当前阶段：**巡游版 v3（owner 2026-09-28 直令）**：旧菜单概念全部清除；所有按钮内嵌画面（门 / 物件 / 猫 / 木牌）；每房固定猫位；子功能以 Drawer 叠在当前房间上。真实 Chrome 走遍十房 + 全部 Loop-0 动作（59/59 断言·38 图·零控制台错误）。2026-09-29 主程复查补齐画内热点的悬停/按下反馈与不透明实底标签，主场景和馆图 `ui-audit` 均归零；sim 零变。
> **S3 施工主体 = GD/PE-112 session**（owner 2026-09-24 令「游戏端你来连续实现」·本行即锁）· 基线 = S2 复查 PASS（S2-reviewer-agent·2026-09-24 03:10）。引擎三单（05/06/11）归 Lead（05/06 主程已交·等独立复查）。
> **S3/S4 碰过的文件（边界栏·复查范围核查用）**：`games/game112/**` · `public/games/game112/{pipeline.json,art/**,probe/**}` · `docs/design/game112/{acceptance,self-check}/**` · `scripts/game112-playthrough.mjs`（S4 真浏览器试玩·49 断言·32 图）· `scripts/game112-spec-recursion.mjs`（S4 递归复核·11 条款打坏验红）· `scripts/game112-art-requirements.mjs`（美术台账推导）· `docs/design/game112/**`。十房巡游增量没有改 `src/engine/**`、`src/ui/**` 或共享 capability。 另两处越域小修待主程 review：`scripts/scoped-gate.mjs`+test（台账归类·2026-09-24）· `scripts/ui-find.mjs`+test（读拆分后 `gallery/*.ts`·owner 2026-09-28 令自修）。
> Claude Design：任务书 `claude-design-brief.md`（v1·约束与交稿格式）+ **逐屏规格 `claude-design-spec.md`（v2·2026-09-25·S5 起点）**；出稿放 `cloud-design/`。
> **星尾馆空间框架 + 美术设定**：`hall-framework.md`（十间房表·馆图·热点语言·art bible）+ `visual/room-art-review-v2.md`（owner 2026-09-27 确认写入文档的 00–10 编号视觉基线）。当前仍可按编号继续微调，不是不可修改的终稿。
> **S3 参考样例（只学结构·不抄玩法·index.md 铁律 5）**：`games/game111/blueprint.ts`（蓝图组织·KeyBinding→Effect 预展开表·「宿主不许直接塞 Signal」）· `games/game111/ui.ts`（LayoutNode 写法·page() 外壳·壳层右上角保留区）· `games/game111/game111.ts` + `project.ts`（宿主 mount 形状·世界→POD 投影）· `games/game-103/blueprint.ts` ringSpawnerEntities（表展开 ≠ 解释器）· `games/game-103/acceptance-adapter.ts`（S4 薄适配契约）。玩法全部溯 `gdd.md`（关系四量 §6.2 / 星砂 §12 / 杂货铺 §12.4 / 回忆 §11 / 离线小事件 §3.4）。
> 引擎侧文档（GD/PE-112 · 2026-09-23）：`framework.md`（骨架 + 缺口 A/B 摆盘）· `capability-plan.md`（能力总览·待 Lead 审）· `capability-gaps.json`（机读缺口台账）· `requests.md`（游戏级需求单）· `cat-ai.md`（猫 AI 设定·必填档）。

## 建议阅读顺序

1. [`brief.md`](./brief.md) — 一页立项卡，快速确认方向。
2. [`gdd.md`](./gdd.md) — 完整策划总纲，玩法、叙事、经济、照片上传和视频技术方案。
3. [`menu-flow.md`](./menu-flow.md) — 全部菜单、页面、导航与异常流程，交给产品/UI 设计使用。
4. [`ui-visual-handoff.md`](./ui-visual-handoff.md) — 交给 Crow Code 或 UI 设计人员的页面表现要求。
5. [`hall-framework.md`](./hall-framework.md) — 星尾馆十间房、空间连通、房间用途和正式美术设定。
6. [`visual/room-art-review-v2.md`](./visual/room-art-review-v2.md) — **00–10 编号图册**；给 Claude 的当前视觉真相与后续反馈入口。
7. [`visual/`](./visual/) — 其他猫与场景方向图。
8. [`framework.md`](./framework.md) — **引擎骨架**：四层分工（sim / 宿主 / 投影 / UI）、能力对账、竖切三环。
9. [`capability-plan.md`](./capability-plan.md) — 能力总览（模板 `docs/design/capability-plan-template.md`），S2 机器门读它。
10. [`cat-ai.md`](./cat-ai.md) — 猫 AI 设定（牌桌四性格 + 狩猎链参数），`opponent-ai.md` 规定的必填档。
11. [`requests.md`](./requests.md) · [`capability-gaps.json`](./capability-gaps.json) — 需求单与机读缺口台账。

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
| [`../../../../public/games/game112/art/scene/star-tail-main-hall-bg-v2.png`](../../../../public/games/game112/art/scene/star-tail-main-hall-bg-v2.png) | **01 主厅**；全馆材质、尺度与暖光锚点 |
| [`visual/room-art-review-v2.md`](./visual/room-art-review-v2.md) | **00–10 全馆编号图册**；房间色彩、连接关系与逐图预览 |

## 当前口径

- 🟢 世界是“喵星的共同空间”，咖啡厅只是早期表述，不做传统餐厅经营。
- 🟢 玩家可以遇见不同品种/毛色的官方猫，也可以上传自己的猫。
- 🟢 核心是陪伴、牌局与回忆；猫有自己的过去和离线生活。
- 🟢 高保真表现以照片转活视频、爱诗生成视频和视频衔接为主，不要求纯 3D。
- 🟢 星尾馆采用为猫建造的十间房体系；A 型剖面馆图已选，00 总览必须由 01–10 单房成图确定性拼合。
- 🟢 **巡游版铁律（owner 2026-09-28）**：没有画面外的菜单；门 / 物件 / 猫 / 木牌就是全部按钮；猫坐在每房的固定猫位上（`hall-framework.md` §0-bis）。
- 🟡 **猫系统重写中（owner 2026-09-28）**：品种设定 · 引入/选猫机制 · 活动动画由 owner 重新写；第一版先把场景巡游做好，猫锚图暂缓出图。
- 🟡 流程板 S1 的 owner 签字待 owner 本人确认；S3→S5 由 owner 在 S5 直接看游戏独立对齐（不再派 agent 复查这三关）。
- 🟢 编号图册是当前可实现基线，但保持可迭代；后续修改用“编号 + 问题”反馈并升版本，不覆盖历史。
- 🟡 工作名为《星尾会客厅》，场所名为“星尾馆”，记忆媒介称“忆光晶球”。
- 🟡 实时互动采用“缓存即时反应 + 爱诗后台生成下一段”的连续错觉，不逐帧等待云端生成。

## 尚未裁决

- 最终游戏名与场所名。
- 猫猫牌的完整规则、难度和局长。
- 商业化方式与是否存在付费货币。
- 上传照片数量、生成额度、视频保存期限与云端成本。
- “忆光晶球”是否保留为核心世界观装置。
- 桌面悬浮猫是否进入首发范围。
