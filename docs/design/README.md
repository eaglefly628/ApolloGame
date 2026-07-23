# game103 ·《幸存者核心原型》设计文档

复刻 **Survivor.io（幸存者！.io）/ Vampire Survivors** 式割草 Roguelite 的**核心玩法**。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [`00-claude-designer-brief.md`](./00-claude-designer-brief.md) | **Claude Designer 设计描述** — 项目定位、范围界定、协作指令、里程碑 |
| [`02-core-gameplay-GDD.md`](./02-core-gameplay-GDD.md) | **核心玩法策划案** — 核心循环、操作、武器/进化、敌人、掉落、数值曲线 |
| [`03-config-schema.md`](./03-config-schema.md) | **配置表结构** — 数据驱动的 JSON 结构与 M1 默认数值 |

## 一句话定位

俯视角单摇杆走位、武器全自动开火的割草 Roguelite。走位躲怪 → 自动杀怪 → 捡经验升级三选一 → 凑武器×被动进化 → 从被追着跑变成清屏机器 → 活满 15 分钟打 Boss。

## 里程碑

- **M0 设计**（本次）：简报 + GDD + 配置表 ✅
- **M1 灰盒**：走位 + 自动攻击 + 刷怪 + 升级三选一
- **M2 进化**：5 武器 5 被动 + 进化系统
- **M3 关卡**：波次表 + 精英 + Boss + 难度曲线
- **M4 元进度**：金币结算 + 局外永久升级
- **M5 打磨**：手感/特效/数值平衡/性能
