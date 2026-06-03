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

## 当前状态

沙盒已占位。实现待 R1（贴图渲染）+ R3（点击输入约定）落地后开工 v0.1（一个场景 + 一段对话 + 打字机 + 一个改数值的选择）。
