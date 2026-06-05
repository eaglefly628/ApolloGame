# Game B — 乙游视觉小说（Otome Visual Novel）

> 负责人：**PB（Programmer B）** · 游戏沙盒，不碰引擎/共享层
> 设计文档：[`docs/game-design/game-b-otome-vn.md`](../../../docs/game-design/game-b-otome-vn.md)
> 引擎需求：见 [`docs/workflow/requests.md`](../../../docs/workflow/requests.md) 的 **R1–R8**

---

## 一句话

娱乐圈背景的乙女养成：选择驱动剧情、属性决定命运。压测引擎的 state / resource / flag / text / random / serialization / UI binding。

## 架构决策（专家视角，降引擎依赖）

- **UI 走 React-DOM 浮层**：对话框 / 选项 / 属性面板 / 存读档界面用 React DOM（`GameOverlay` 已是这个路子，CSS 原生换行 + `onClick`），**规避**渲染器的文本换行（R2）与 canvas 命中测试（R3）。
- **canvas 只画演出层**：背景图 + 立绘（依赖 **R1 贴图渲染**，目前渲染器只画占位方块）。
- **叙事状态住在 World 里**：对话指针 / flag / 好感 / 剧情进度都是 ECS 组件 → 自动进 `world.snapshot()` 存档；React 只渲染，点击按 tick 灌进世界（确定性约定见 **R3**）。

## 引擎依赖（阻塞项）

| 能力 | 需求 | 状态 |
|---|---|---|
| 背景/立绘贴图渲染 | R1 (P0) | 待 Lead |
| 对话多行文本 | R2 (P0\*，React-DOM 规避) | — |
| 点击→确定性输入 | R3 (P0\*) | 待 Lead 约定 |
| string 容器（剧情节点/取名/结局标识） | R4 (P1) | 待 Lead |
| 组合条件门控分支 | R5 (P1) | 待 Lead |
| tween 缓动（淡入/条填充） | R6 (P1) | 待 Lead |
| 阈值事件（好感 30/60/90） | R7 (P2) | 待 Lead |
| 音频后端 | R8 (P2) | 待 Lead |

可在现有能力上先做的（不阻塞）：对话 JSON 数据、检定公式逻辑、日程循环骨架、属性面板（React + `useComponent` 读 `Resource`）。

## 计划目录结构

```
src/games/game-b/
├── README.md            # 本文件
├── data/                # 数据驱动：对话树 JSON、角色表、场景表、波次/周期配置
├── assembly/            # Game B blueprint：注册原子 + 初始实体（属性/好感资源、状态机）
├── systems/             # 游戏专属胶水系统：对话运行器、检定、日程结算、结局判定
└── ui/                  # React-DOM：对话框、选项菜单、属性/好感面板、存读档、sakura-otome 主题组件
```

## 数据 vs 代码边界（数据驱动原则 · 给 Lead 泛化通用模块的样本）

**原则**：游戏 = 数据，不是代码。游戏专属 `.ts` 应趋近零；非写不可的代码必须是**通用、可提升为共享模块**的。

| 文件 | 性质 | 说明 |
|---|---|---|
| `data/scene_01.json` | **纯数据** | 对话脚本（节点图 + 选项 + 条件 + 效果） |
| `data/game-b.manifest.json` | **纯数据** | 游戏清单：装哪些模块 + 初始实体(组件数据) + 内容引用 |
| `assets/asset-manifest.json` | **纯数据** | 资产清单（TBF） |
| `data/dialogue.ts` | 数据 schema + JSON 加载 shim | 只有类型契约，无逻辑（待并入通用模块的公共契约） |
| `blueprint.ts` | 薄加载器（**通用、待提升**） | manifest→WorldBlueprint；按 id 解析模块。应由框架通用 module-loader 取代 |
| `dialogue-runner.ts` | **代码（待提升，R15）** | 脚本解释器。本质通用 → 请 Lead 收编为共享"叙事运行器"模块 |
| `ui/VNStage.tsx` | **代码（待提升）** | VN 演出。应泛化为通用可主题化组件 |

**目标终态**：R15 落地后删 `dialogue-runner.ts` + `blueprint.ts` + 泛化 `VNStage` → Game B = 纯数据（manifest + 脚本 + 资产 + 主题），零游戏专属代码。

---

## 当前状态 — v0.2 已落地 ✅（技术债已还清 · 内容已数据化）

在 v0.1 基础上推进，用主程新落地的能力做了三件事：
- **还清技术债**：R10 `runsBefore` 替掉"谎报 reads"、R11 全局按 id 路由替掉"entityId===resourceId 假设"。
- **7 属性系统**：魅力/智慧/体力/事业 + 好感 S/T/U，React 属性面板实时显示（ui-binding）。
- **条件门控选项 + 阈值事件链**：选项支持 `requires`（条件树）；用 `event-when`+`effect-apply`（Condition→Event→Effect）做"好感越线→置位解锁选项"——**纯配置、零游戏代码**。
- **8 个集成测试全绿**：拓扑无环(runsBefore)、7 属性、全局路由改值、阈值链合龙、阈值未达不触发、门控选项可见性、拒绝选不可用项、确定性快照。

推 v0.2 新提的需求：**R14**（一 tick 多 ResourceModify 不便 + 按 id 找实体的 DX 助手）。

---

## v0.1 骨架 ✅

用**现成原子**（`state` + `resource` + `flag` + `text`）+ 游戏层胶水 `dialogue-runner` 拼出了 VN 核心闭环，**验证了"现成 skill 能组合出乙游"**。

| 文件 | 作用 |
|---|---|
| `data/dialogue.ts` | 数据驱动对话脚本（第一幕 scene_01：与角色 S 初见 + 一个改好感的选择） |
| `dialogue-runner.ts` | 游戏层胶水 capability：推进/选择/好感结算/分支，全走现成原子事件链 |
| `blueprint.ts` | `buildGameBBlueprint()` —— 注册 4 原子 + dialogue-runner，建对话/好感/flag 实体 |
| `game-b.test.ts` | **7 个集成测试全绿**：拓扑无环、首行渲染、推进发 StateChanged、选择改好感+置 flag+分支、clamp、确定性快照 |
| `ui/VNStage.tsx` | React-DOM 演出层脚手架（对话框/选项/属性条；规避 R2/R3；背景立绘=占位色块） |
| `assets/` | 资产占位目录 + TBF 清单草稿（流程待 review 落地） |

**验证结论**：核心数值/状态/分支闭环**不依赖任何引擎新能力**就能跑通。R1（贴图）已由 Lead 落地；R2/R3 用 React-DOM 浮层规避。下一步 v0.2：接 R1 真背景/立绘、扩展多场景与日程循环，按 requests.md 推进。
