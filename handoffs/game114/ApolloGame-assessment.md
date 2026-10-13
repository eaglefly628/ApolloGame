# ApolloGame 参考游戏复刻评估：第一轮引擎盘点

评估日期：2026-10-09（工作区命名日期）。范围：只读评估，不实现、不修改仓库代码、不提交、不推送、不发布。

## 结论

ApolloGame 已有可组合的 2D 战斗、卡牌、升级抽选、声明式 UI、渲染和存档基础。若参考游戏确属俯视角战斗加升级选择，game-103 是较近的复用起点；但参考游戏名称、规则和循环未确认，目前不能给出具体复刻适配结论或总工期。

这里的“已验证”仅表示读到实现/接线或执行了所述审计，不代表浏览器试玩、全部测试通过或生产可用。

## 来源与分支

远端：https://github.com/eaglefly628/ApolloGame 。本任务独立完整克隆 `ApolloGame/` 与浅克隆 `ApolloGame-review/`，未切换任何已有用户工作树。两份克隆均保持默认 master，git status 无改动。

- master：`f5b2184de`，README 明确是 bootstrap。
- claude/mainbranch：`6bf0a03676d8c091e96572f9c82a3dc878ce1047`，提交时间 2026-10-08T01:21:56Z；本轮主要依据。
- codex/mainbranch：`3e6569c26`，同样有实际开发；相对 claude/mainbranch 在 src/games/scripts 上有 86 个文件差异，不能认为两支等价或任意混用。

代码快照 `engine-review/` 由 claude/mainbranch 的 git archive 导出，只含评估需要的源码、游戏、文档、脚本与配置，不含资源大库；不是可运行发布包。可用下述固定提交来源逐条复核：
https://github.com/eaglefly628/ApolloGame/tree/6bf0a03676d8c091e96572f9c82a3dc878ce1047

工作区和父目录没有发现适用 AGENTS.md；开发分支树中未找到 AGENTS.md 或 .agents/skills。仓库实际约定在 CLAUDE.md、.claude/skills 和 docs/playbooks。检查了常见本地 memory_summary.md 位置，没有读取到文件，未扫描其他会话。

## 项目约定对评估的影响

读了 CLAUDE.md、docs/design/data-driven-manifesto.md、docs/llm-onboarding.md、docs/playbooks/index.md 及战斗/卡牌相关手册。项目优先数据与 capability 组合；UI 用 LayoutNode。后续新游戏需要 capability-plan；真实缺口先查 registry 与对应手册，提出 A 补通用引擎 / B 游戏独有逻辑的代价，由 owner 决定。本轮不触发实现流程、抢锁或推送约定。

旧 docs/apollo-engine-overview-for-planner.md 已标记过期，不能用其中“26 原子”等数字宣传当前能力。准确目录以 src/assembly/capability-registry.ts、src/skills/atoms/index.ts、src/ui/components/catalog.ts 和 src/launcher.tsx 为准。

## 可以复用的模块（已读实现或实际接线）

| 领域 | 代码证据 | 复用价值与边界 |
|---|---|---|
| 模拟运行与组合 | src/runtime/engine.ts；src/engine/core/world.ts；src/assembly/capability-registry.ts；manifest.ts、validate-manifest.ts、validate-references.ts | Engine 装载 WorldBlueprint，固定步长、输入命令与状态 hash 接缝；数据字段/引用有校验。是否覆盖目标全部规则待具体映射。 |
| 移动与寻路 | src/skills/tier2/steering.ts、pathfind.ts；src/engine/spatial/astar.ts；games/game-103/blueprint.ts | seek 追击、航点图 A*、碰撞与边界；目标若需复杂动态障碍、群体避让或特殊地形，需要场景验证，不能从有 A* 推导全部支持。 |
| 战斗 | src/skills/tier2/hitbox.ts、mortal.ts、over-time.ts、launch.ts、modifier-stack.ts；src/skills/tier3/caster.ts、aggro.ts | 命中、资源修改、死亡掉落、持续效果、发射和索敌可组合；game-103 的多种弹体/范围攻击是接线示例。 |
| 升级与装备 | src/skills/tier2/draft-offer.ts、inventory.ts；games/game-103/game-103.ts:56、theme.ts:297 | rollOffer/applyPick 是确定性纯函数，具备权重、不重复候选、满级、槽位和前置过滤；不是独立 registry capability，触发与选择仍需接线。 |
| 卡牌 | src/skills/tier2/card-pile.ts、card-play.ts；src/skills/tier3/poker-hand.ts、card-scoring.ts；games/game-e、games/game-g | 牌堆、出牌、计分与 deck-builder 参考；“画面里有卡片”不等于需要这些规则，技能选择卡也可能只用 UI。 |
| AI 与流程 | src/skills/tier2/behavior-tree.ts、event-when.ts、effect-apply.ts；src/skills/tier3/flow.ts | 行为树、条件→信号→效果、胜负与阶段切换可复用；专有敌人行为是否可声明式表达需查对应 schema。 |
| UI 与表现 | src/ui/components/catalog.ts；src/renderer/canvas-renderer.ts、vfx2d.ts；games/game-i；games/game-103/hud.ts | 声明式菜单/HUD/选择面板、Canvas 精灵/动画/特效。有实现基础，未实机确认参考布局、交互与观感可达。 |
| 存档与局外状态 | src/services/storage/save-system.ts、storage-port.ts；src/services/persist/local-store.ts、leaderboard.ts、achievements-ledger.ts | 共享存储/榜单/成就入口存在；中途存档是否完整包含抽选、进化和宿主状态需专项验证。 |

## 现有游戏参考与已发现风险

最接近“俯视战斗”的实证是 game-103：blueprint.ts 组合移动、自动攻击、敌人追击、接触伤害、经验拾取、计时胜负。theme.ts 有武器模式、进化条件、抽选池和刷怪表；game-103.ts:56–102 有拥有态、选项回填、进化条件及升级时停抽选。

关键事实：blueprint.ts 顶部仍写 E1–E4 未接，和当前宿主接线不完全一致。需要以实现及测试为准。进化 Set 和 draftState 位于宿主闭包，不能直接推断其已进入世界 hash/存档；若要求回放、联机或中途继续，需要专门核对该边界。

game-g 可参考回合 deck-builder 流程；game-e 可参考计分数据而不照搬手写 UI；game-i 可参考 UI 组件。src/launcher.tsx 中 game211 明确仍在建、战斗基线尚未替换，不应拿它证明实时 RTS 已交付。game-f 在项目约定中冻结，不作为新改动落点。

## 已执行验证

运行 `node scripts/game-skill-audit.mjs game-103`（在 engine-review 根目录）。退出码 0，结果 `AUDIT: WARNINGS`、`RATCHET: PASS`。完整输出：本任务 `game-103-audit.txt`。

审计报告 7 项已批注覆盖的“引擎同形手写”，集中于成就/榜单、本地存储和宿主调用；1 项墙钟警告（game-103.ts:165）。未覆盖红旗为空。机器放行不代表没有技术债，也不证明试玩闭环。

没有执行 Vitest、tsc、build 或浏览器试玩：评估快照没有 node_modules，未安装依赖或生成构建。现有测试入口是 npm test、npm run build、npm run bench；目标验证文件包括 games/game-103/game-103.test.ts、src/skills/tier2/draft-offer.test.ts、hitbox.test.ts、src/assembly/manifest.test.ts、validate-references.test.ts，以及对应 storage/lockstep 测试。先选择与参考机制相关的用例，再进行短闭环实机验证。

## 待参考确认后的映射与范围

附件 Library ID 精确保留：`libfile_4c81657279188191badde7279b657588`；文件名 `20261009-010355.jpg`。父会话报告真实尺寸 64×2048、标题文字不可辨。本轮未下载或查看像素，因此没有新增视觉判断，不猜游戏名称，不把此前太空骰子游戏当作此图对象。

需要游戏名称或原文链接，或清晰截图/短视频；至少能确认玩家输入、一次战斗/回合如何推进、如何胜负、局内升级是否随机、局外成长是否存在。父会话已向用户请求补充。

补齐后逐项输出：核心循环 → 组件/能力实名 → 数据字段/资源 → 验证剧本 → 现成/需组合/真实缺口。只参考机制，使用原创美术与文案，不提取第三方素材、源码或商标。

以下仅是规划模板（推断），不是对未知参考的工期承诺：

1. 规则确认与适配：小；明确输入、状态、胜负，核对 capability-plan。
2. 最小闭环：中；若为幸存者型，限定一张原创小场地、一个角色、两种敌人、三种攻击/升级、一次选择和胜败/重开。参考若不是此类型，重新定范围。
3. 原创内容与表现：中至大；补原创资源、UI、音效、数值和技能差异，内容量通常主导工作量。
4. 扩展、平衡与验证：中；回放/存档/性能与设备验证。联机或复杂独有规则可能变成大，需先查能力再给 A/B。

当前阻塞：参考身份与机制未确认；功能测试和实机证据尚缺。已完成的是引擎盘点评估，不是代码实现完成。
