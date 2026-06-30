# Game D《骰途》· 设计文档目录

> 双人骰子 Roguelike《骰途·命运之塔》的全部设计文档。owner 2026-06-29 收进此独立目录。

| 文档 | 管什么 |
|---|---|
| [`gdd.md`](./gdd.md) | **游戏设计总纲**：定位/支柱/核心循环/成长/地牢结构/世界观设定 + 2D UI 范围 + 能力映射 + MVP 分期。高层愿景看这里。 |
| [`combat-design.md`](./combat-design.md) | **战斗系统活文档**：彩色骰/元素/攻防两层/骰斗回合骨架 + 战斗 UI/骰库经济/一局流程 + **双人协作机制** + 呈现/关卡流式 + 待怼清单。细节迭代在这里。 |
| [`balance-design.md`](./balance-design.md) | **平衡性 + 内容设计**：五行相克 + 伤害公式 + 24 款骰子全目录 + 奖励 + 敌人/BOSS + 单/双人难度曲线 + 模拟发现快照。数值看这里（配模拟器 `scripts/game-d-balance-sim.mjs`）。 |
| [`ui-brief.md`](./ui-brief.md) | **视觉设计 Brief（交付外部设计师）**：开场 Title 屏（3D 滚动骰子）/ 塔内场景 / 战斗 HUD 三屏的逐元素描述 + 美术风格指南 + 色板 + 期望交付物。给设计师对位。 |

**相关（不在本目录）**：UI 实操规范 `../ui-playbook.md`；数据驱动宪法 `../data-driven-manifesto.md`；平衡模拟器 `../../../scripts/game-d-balance-sim.mjs`；游戏代码 `../../../src/games/game-d/`。
