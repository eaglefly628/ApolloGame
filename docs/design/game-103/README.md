# game-103 ·《幸存者核心原型》设计目录

> 2026-07-23 立 · GD-103。复刻 **Survivor.io / Vampire Survivors** 式割草 Roguelite 的**核心单局玩法**。
> **owner 拍板（2026-07-23）**：形态=编译期 TS 游戏；slot=`game-103`（不占字母位）；§4 编排下沉新能力交 Lead。

## 状态（8 阶段生产板）

- **S1 立项讨论**：✅ v1 → `brief.md`（含 GD 架构评判：接受立项·有前置条件）
- **S2 capability-plan**：✅ 送审稿 → `capability-plan.md`（⏳ 待 Lead 审；§4 三处编排下沉已提 `REQ-SURVIVOR编排`·GD 已诚实核查 event-when/merge-rule/dice-roll 覆盖度；**过审前零游戏层代码**）
- **S3 GDD + 数值**：✅ v1 → `gdd.md` + `balance-design.md`（伤害公式/逐级成长/难度曲线/**P-M 功率曲线手算验证**/经济/balance-sim spec）
- **S4 UI/场景设计交接**：✅ v1 → `ui-scene-design.md` + 设计稿 `survivor-hud-mockup.dc.html`（战斗+三选一）+ `survivor-menu-result.dc.html`（主菜单+结算胜/负）·均渲染目击在案·PE 1:1 复刻基准
- **PE 开工交接**：✅ v1 → `pe-handoff.md`（流程板 S3–S8 映射 + 各线手册 + 现有能力接线 + 门禁分清）
- S5+ 交 PE 实现：⬜（S3 骨架/M1 灰盒可现在起步；E1–E4 编排等 Lead 签 S2）

## 文档索引

| 文档 | 内容 |
|---|---|
| [`brief.md`](./brief.md) | 立项讨论稿 + GD 架构评判 + owner 拍板项 + 风险 |
| [`capability-plan.md`](./capability-plan.md) | 能力总览（门禁）：每系统对照 registry 实名消费能力 + §4 三处编排下沉裁决 |
| [`gdd.md`](./gdd.md) | GDD：核心循环/操作/武器/进化/被动/敌人/掉落/数值曲线/里程碑 |
| [`balance-design.md`](./balance-design.md) | 数值平衡：伤害公式/逐级成长/被动叠加/难度曲线/P-M 功率曲线验证/经济/sim spec |
| [`art-plan.md`](./art-plan.md) | 美术解决方案：三段路径（占位几何→FreeArtLib CC0 库→风格包 AI 生成）+ 槽位映射 + 分工 |
| [`ui-scene-design.md`](./ui-scene-design.md) | S4 场景/UI 布局交接：逐场景详案 + 控件映射 + 信号总表 + 美术槽位 |
| [`survivor-hud-mockup.dc.html`](./survivor-hud-mockup.dc.html) | 设计稿：战斗 HUD + 升级三选一（PE 1:1 复刻基准） |
| [`survivor-menu-result.dc.html`](./survivor-menu-result.dc.html) | 设计稿：主菜单 + 结算（胜利/失败）（PE 1:1 复刻基准） |
| [`pe-handoff.md`](./pe-handoff.md) | PE 开工交接：流程板 S3–S8 映射 + 各线手册 + 实体能力接线 + 门禁分清（可做/阻塞） |

## 一句话

俯视 2D 单摇杆走位、武器全自动开火。走位躲怪 → 自动杀怪 → 捡经验升级三选一 → 凑武器×被动进化 → 从被追着跑变成清屏机器 → 活满 15 分钟打 Boss。

## 关键结论（给 owner/Lead）

- 引擎**能表达**该玩法：核心系统全部映射到在册能力（移动/索敌/开火/命中/死亡/被动聚合/DoT/掷骰）。
- **待裁焦点**：三选一 draft / 进化 rule / 波次 director 三处编排——GD 倾向下沉为通用能力而非游戏层写 system。
- **头号风险**：这是引擎首个实时动作全游戏（现有 game-i 只是能力展示台），实体规模性能需 S2 原型早验证。
