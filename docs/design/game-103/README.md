# game-103 ·《幸存者核心原型》设计目录

> 2026-07-23 立 · GD-103。复刻 **Survivor.io / Vampire Survivors** 式割草 Roguelite 的**核心单局玩法**。
> **owner 拍板（2026-07-23）**：形态=编译期 TS 游戏；slot=`game-103`（不占字母位）；§4 编排下沉新能力交 Lead。

## 状态（8 阶段生产板）

- **S1 立项讨论**：✅ v1 → `brief.md`（含 GD 架构评判：接受立项·有前置条件）
- **S2 capability-plan**：✅ 送审稿 → `capability-plan.md`（⏳ 待 Lead 审；§4 三处编排下沉已提 `REQ-SURVIVOR编排`·GD 已诚实核查 event-when/merge-rule/dice-roll 覆盖度；**过审前零游戏层代码**）
- **S3 GDD**：✅ v1 送审稿 → `gdd.md`（武器/进化/被动/敌人/波次/掉落数值表 + DPS 功率曲线）
- **S4 UI/场景设计交接**：✅ v1 → `ui-scene-design.md` + 设计稿 `survivor-hud-mockup.dc.html`（渲染目击在案·PE 1:1 复刻基准）
- S5+ 交 PE 实现：⬜（等 capability-plan 过审 + slot 骨架）

## 文档索引

| 文档 | 内容 |
|---|---|
| [`brief.md`](./brief.md) | 立项讨论稿 + GD 架构评判 + owner 拍板项 + 风险 |
| [`capability-plan.md`](./capability-plan.md) | 能力总览（门禁）：每系统对照 registry 实名消费能力 + §4 三处编排下沉裁决 |
| [`gdd.md`](./gdd.md) | GDD：核心循环/操作/武器/进化/被动/敌人/掉落/数值曲线/里程碑 |
| [`ui-scene-design.md`](./ui-scene-design.md) | S4 场景/UI 布局交接：逐场景详案 + 控件映射 + 信号总表 + 美术槽位 |
| [`survivor-hud-mockup.dc.html`](./survivor-hud-mockup.dc.html) | Claude Designer 设计稿：战斗 HUD + 升级三选一（PE 1:1 复刻基准） |

## 一句话

俯视 2D 单摇杆走位、武器全自动开火。走位躲怪 → 自动杀怪 → 捡经验升级三选一 → 凑武器×被动进化 → 从被追着跑变成清屏机器 → 活满 15 分钟打 Boss。

## 关键结论（给 owner/Lead）

- 引擎**能表达**该玩法：核心系统全部映射到在册能力（移动/索敌/开火/命中/死亡/被动聚合/DoT/掷骰）。
- **待裁焦点**：三选一 draft / 进化 rule / 波次 director 三处编排——GD 倾向下沉为通用能力而非游戏层写 system。
- **头号风险**：这是引擎首个实时动作全游戏（现有 game-i 只是能力展示台），实体规模性能需 S2 原型早验证。
