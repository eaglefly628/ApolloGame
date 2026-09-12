# game111 · 文档索引

| 文档 | 性质 | 状态 |
|---|---|---|
| `concept-source.md` | 外部参考素材（米哈游 AI 生态团队技术方案）忠实归档。**不是本仓设计决定** | ✅ 完成 |
| `framework.md` | 把素材抽象炼化成本仓可落地的基础框架设定 + 4 项缺口 A/B | ✅ **owner 2026-09-12 已裁：①②③=A · ④=B** |
| `capability-plan.md` | 能力总览（模板 `docs/design/capability-plan-template.md`）。**未过审不许写游戏层代码** | 🔶 **待 Lead 评审 §6** |
| `requests.md` | game111 的需求单（三条引擎缺口·**不占引擎槽**） | ✅ 已开 |
| `gdd.md` | 玩法设计文档（含「NPC AI」详设章） | ⬜ 待写 |

**当前阻塞点**：`capability-plan.md` §6 等 Lead 评审（plan + 两条游戏层例外）。

**已开的引擎需求**（`requests.md`·**游戏级不占引擎槽**）：`REQ-111-ENG-01` 端口 · `REQ-111-ENG-02` barrier（二者捆绑）· `REQ-111-ENG-03` 记忆。三件均 🔴 主程面，落地后才开 game111 游戏层。
> 未进引擎池的理由：实测引擎池字符预算已满（24783/25000·槽位尚余），且触发者（Lead 批 plan）不在池内 —— 同 REQ-DIALOGUE 出池先例。过审 + 主程接单时再搬。
