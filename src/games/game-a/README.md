# Game A · 双人协作冒险（co-op platformer）

> 《双人成行》式合作冒险。负责人：PA（主策划 + 主程）。
> 设计与引擎需求分析见 [`DESIGN.md`](./DESIGN.md)；上位设计见 `docs/game-design/game-a-coop-platformer.md`。

## 当前版本：v0.3-proto（卷轴 + 美术 + 移动平台，全数据驱动）

双人移动/跳跃/平台/重力/落地/边界/确定性 + **协作通关目标**（两人都到才过关，缺一不可）+ **卷轴大关卡**（1920×400，合作相机跟中点/动态缩放/钳边界，REQ-001）+ **背景/目标美术**（资产清单数据 + Sprite）+ **Tween 驱动移动平台**。

> **核心原则：游戏 = 组件数据（关卡 / 资产清单 / Sprite / Tween），不是游戏专属代码。**
> 全程未碰引擎/共享层；游戏层唯一的"代码"是 `coop-goal` 一条规则（待 sensor+condition 落地后亦可退成纯数据）。新增美术 = 加清单数据；新增移动平台 = 加 Tween 数据。代码量没涨 → 方向对。

| 角色 | 颜色 | 移动 | 跳 |
|------|------|------|----|
| A | 蓝 | A / D | Space |
| B | 橙 | ← / → | / |

可玩：launcher 选 "Game A: Co-op Adventure"（`src/game-a.tsx` 卡带）。

### ⚠️ 更丰富的机制被引擎缺口阻塞（已提需求，**未 hack**——能数据表达才做，否则提需求）

| 想做的 | 阻塞于 |
|--------|--------|
| 踩开关→开门 / 限时门 / 重量台 | **REQ-002**：trigger-zone 与 collision-resolve 抢 Overlap，缺 sensor |
| 踩搭档垫高 / 推箱垫脚 | **REQ-003**：ground-sense 只认静态地面，站动态支撑上跳不起来 |
| 连续往复移动平台 / 电梯 / 巡逻台 | **REQ-004**：Tween 一次性，无 loop/pingpong（一次性升降已可做） |
| 玩家/敌人/箱子的角色美术 | **REQ-005**：渲染器 Shape 盖过 Sprite，可碰撞实体显示不了贴图皮 |

## 结构

| 文件 | 作用 |
|------|------|
| `level.ts` | 关卡数据（地面/平台/出生点/目标区/**背景/移动平台**；LEVEL_W1_1 固定屏 + LEVEL_SCROLL 卷轴） |
| `assets.ts` | 美术资产清单（**数据**：textureKey → 内联 SVG 占位图；真美术经 provider 填同 key） |
| `blueprint.ts` | `buildGameABlueprint(level)` → 把关卡数据拼成实体 + 相机 + Tween 平台 + Sprite 美术 |
| `coop-goal.ts` | 游戏层唯一规则：两人都进目标区 → 置 coop-clear 旗标（纯读 Transform） |
| `keymaps.ts` / `index.ts` | 双人键位 / 对外导出 |
| `*.test.ts` | game-a（平台核心）· coop-goal（协作）· camera（卷轴相机）· moving-platform（Tween 载人） |

## 怎么跑

- 逻辑（无头）：`npm run test`（game-a 4 个测试文件）。
- 画面：`npm run dev` → launcher 选 "Game A"（`src/game-a.tsx`：Engine + CanvasRenderer 卷轴投影 + 双键盘 MultiInputSource）。

## 路线 / 引擎依赖

见 [`DESIGN.md` §3](./DESIGN.md)。需求（`docs/workflow/requests.md`）：**REQ-001 卷轴/相机 ✅done**；**REQ-002** sensor、**REQ-003** 动态支撑落地、**REQ-004** Tween loop、**REQ-005** Sprite 穿皮 —— open。落地后解锁开关/垫高/连续平台/角色美术。

## 边界（自我约束）

引擎做不到 → 写 `requests.md` 提需求，**绝不自己改** `engine/** · atom-skills/** · tier1/** · tier2/** · protocol · SystemPhase`。
