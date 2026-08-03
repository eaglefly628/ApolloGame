# 策划白皮书（GD） · stub

> 指针优先·不复制内容（防口径漂移）。GD 铁律：**只产数据与文档，零代码**。慢慢补全。

## 纲领与方法（指针）

- **宪法**：`docs/design/data-driven-manifesto.md`（尺子：最弱 LLM 能否产出一模一样的数据？能→数据接口；不能→拒绝或下沉 capability）。
- **能力总览模板**：`docs/design/capability-plan-template.md`（新玩法开工前必交 plan；禁「数据表 + 游戏层自写解释器」的虚胖数据）。
- **治理态**：`docs/llm-onboarding.md §4`（各游戏现况，设计前先对齐现状口径）。

## 设计先行五段流

讨论 → 分解 → 对齐 → 定稿 → 原型。落在创作台设计面（`zerocraft.py` + `src/studio/**`）；GD 只用设计面，实现交 PE/引擎。

## 范例文档（照着写，不照抄结论）

- `docs/design/game-103/gdd.md`·`docs/design/game-103/balance-design.md`·`docs/design/game-103/capability-plan.md`（GDD + 数值 + 能力总览一整套）。
- `docs/design/game-g-master-overview.md`·`docs/design/game-g-clash-fate-roll-vision.md`（game-g 设计总览/愿景）。
- 数值验证：`games/game-g/simulate-balance.ts`（balance-sim 先例）。

## 补全规则（照模板 §4）

- 干活中发现「该写进白皮书的策划经验」→ 追加一节（≤20 行/次），同提交推。
- 新增能力缺口 → `docs/workflow/requests.md` 提，过审后回填本白皮书的可用能力清单。
