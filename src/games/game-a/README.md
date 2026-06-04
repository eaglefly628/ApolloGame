# Game A · 双人协作冒险（co-op platformer）

> 《双人成行》式合作冒险。负责人：PA（主策划 + 主程）。
> 设计与引擎需求分析见 [`DESIGN.md`](./DESIGN.md)；上位设计见 `docs/game-design/game-a-coop-platformer.md`。

## 当前版本：v0.2-proto（核心闭环 + 协作目标）

固定屏 640×400，双人移动 + 跳跃 + 平台 + 重力 + 落地 + 边界 + 确定性 + **协作通关目标**（两名玩家都到达右侧目标区才过关，缺一不可 = 最小协作）。**全部用现成引擎原子 + 游戏层规则，未碰引擎/共享层。**

| 角色 | 颜色 | 移动 | 跳 |
|------|------|------|----|
| A | 蓝 | A / D | Space |
| B | 橙 | ← / → | / |

### ⚠️ 更丰富的协作机制被引擎缺口阻塞（已提需求，**未 hack 绕过**）

| 想做的协作机制 | 阻塞于 |
|---------------|--------|
| 踩开关→开门 / 限时门 / 重量台 | **REQ-002**：trigger-zone 与 collision-resolve 抢同一份 Overlap，缺 sensor（非实心触发体） |
| 踩搭档垫高 / 推箱垫脚 | **REQ-003**：ground-sense 只认静态地面，站在动态支撑（搭档/箱）上跳不起来 |

## 结构

| 文件 | 作用 |
|------|------|
| `level.ts` | 关卡数据（地面/平台/出生点/目标区；为多关卡/卷轴留结构） |
| `blueprint.ts` | `buildGameABlueprint(level)` → WorldBlueprint（拼装现成原子 + 协作规则） |
| `coop-goal.ts` | 游戏层规则：两名玩家都进目标区 → 置 coop-clear 旗标（纯读 Transform，非引擎 sensor） |
| `keymaps.ts` | 双人键位（路由到 Controllable.playerId 'A'/'B'） |
| `index.ts` | 对外导出 |
| `game-a.test.ts` | 落地 / 跳跃 / 无二段跳 / 输入路由 / 确定性 |
| `coop-goal.test.ts` | 协作目标：单人到达不算、双人到齐才通关 |

## 怎么跑

v0.1 是无头可测的纯逻辑层（`npm run test` 跑 `game-a.test.ts`）。
接到浏览器画面 = 在 `src/main.tsx` 用 `buildGameABlueprint(LEVEL_W1_1)` + `Engine` + `CanvasRenderer` + `MultiInputSource(KEYMAP_A→'A', KEYMAP_B→'B')`（沿用现有平台跳跃 demo 的接线方式）。

## 路线 / 引擎依赖

见 [`DESIGN.md` §3 引擎需求路线](./DESIGN.md)。已向 Lead 提的需求（`docs/workflow/requests.md`）：**REQ-001** 卷轴/相机、**REQ-002** sensor 触发体、**REQ-003** 站动态支撑落地。它们落地后即解锁卷轴大关卡 + 开关/垫高类协作机制。

## 边界（自我约束）

引擎做不到 → 写 `requests.md` 提需求，**绝不自己改** `engine/** · atom-skills/** · tier1/** · tier2/** · protocol · SystemPhase`。
