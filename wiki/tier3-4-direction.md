# Tier 3/4 方向指引 — 女性向乙游涌现目标

> 给主程序的备忘：当 Tier 1/2 原子实现完毕、进入 Tier 3/4 开发时，参照此文件确定涌现方向。

---

## 背景

Apollo Engine 的投资展示目标是：**用通用原子 skill 涌现出一款女性向娱乐圈乙游的核心玩法链路。**

证明路径：26 个通用原子 → Tier 1/2 涌现 → Tier 3 系统级玩法 → Tier 4 行为 → 娱乐圈乙游 MVP。

## 目标游戏

**万千心途 · 娱乐圈世界 · 上升主角期**

MVP 链路：项目选择 → 角色弧光小游戏 → 拍摄检定 → 播出反馈 → 作品结算

## 关键验证条

`stage_03_scene_check`（拍摄关键场次检定）必须端到端跑通：

```
SceneChoiceIntent 输入
  → check.resolve 读取 Relationship.默契 作为 modifier
  → 读取 emotionalBeat 影响 PresentationCue
  → 输出 CheckResultEvent + 画面差异
```

跑通这一条证明三件事：
1. 涌现式开发方法论有效（能产出 check.resolve 这个通用机械件）
2. 通用原子库能承载乙游高品质（domainSlots 接住了默契加成 + 情感节拍）
3. 三文件接口范式成立（vocabulary → binding → capability 咬合成一台机器）

## Tier 3/4 需要涌现的 Capability

| 阶段 | Capability | 对应原子组合 |
|------|-----------|-------------|
| 项目选择 | project.select | state + flag + resource(config) |
| 角色弧光 | char-arc.resolve | state + resource(stat) + flag(unlock) + relation(默契) |
| 拍摄检定 | check.resolve | resource(多种) + relation + state + flag + random |
| 恋爱事件 | love-interest.event | resource(关系值) + flag(threshold) + state |
| 播出反馈 | broadcast.feedback | resource(热度/口碑) + timer + flag(风险) |
| 周期结算 | settlement.resolve | resource(三线汇总) + flag(结局条件) + state |

## 需要的 domainSlot 扩展

当进入 Tier 3 时，`defineCapability` 的 `describe` 需要支持 `domainSlots` 字段：

```typescript
domainSlots: [
  { slot: "relationshipModifier", accepts: "relationshipFields", optional: true },
  { slot: "emotionalBeat", accepts: "emotionalBeats", optional: true },
  { slot: "preparationBonus", accepts: "准备度", optional: false },
]
```

这让通用机械件能承载领域语义，是高品质的关键。

## 完整 Binding Spec

详见 `wiki/otome-capability-binding.json`

该文件包含：
1. 领域受控词表（小喃的语义来源）
2. domainSlot 声明规范
3. 本世界新增 Component（14 个，沿用六类语义分类）
4. 6 个环节的完整 binding（trigger → mapping → presentationHook）
5. 验证锚点和验收标准

## 时间线

```
现在:  Tier 1 原子实现 (26 个)     ← 主程序正在做
接下来: Tier 2 涌现组合 (gravity, collision, etc.)
然后:  Tier 3 → 开始往乙游方向倾斜 ★
最后:  Tier 4 → 完整 MVP 链路展示
```

Tier 1/2 保持完全通用，不做任何领域特化。
Tier 3 开始时回来读这份文件，按 binding spec 规划涌现方向。
