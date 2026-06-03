# Game A · 双人协作冒险（co-op platformer）

> 《双人成行》式合作冒险。负责人：PA（主策划 + 主程）。
> 设计与引擎需求分析见 [`DESIGN.md`](./DESIGN.md)；上位设计见 `docs/game-design/game-a-coop-platformer.md`。

## 当前版本：v0.1（核心闭环验证）

固定屏 640×400，双人移动 + 跳跃 + 平台 + 重力 + 落地 + 边界 + 确定性。**全部用现成引擎原子，未碰引擎/共享层。**

| 角色 | 颜色 | 移动 | 跳 |
|------|------|------|----|
| A | 蓝 | A / D | Space |
| B | 橙 | ← / → | / |

## 结构

| 文件 | 作用 |
|------|------|
| `level.ts` | 关卡数据（数据驱动，为多关卡/卷轴留结构） |
| `blueprint.ts` | `buildGameABlueprint(level)` → WorldBlueprint（拼装现成原子） |
| `keymaps.ts` | 双人键位（路由到 Controllable.playerId 'A'/'B'） |
| `index.ts` | 对外导出 |
| `game-a.test.ts` | 落地 / 跳跃 / 无二段跳 / 输入路由 / 确定性 |

## 怎么跑

v0.1 是无头可测的纯逻辑层（`npm run test` 跑 `game-a.test.ts`）。
接到浏览器画面 = 在 `src/main.tsx` 用 `buildGameABlueprint(LEVEL_W1_1)` + `Engine` + `CanvasRenderer` + `MultiInputSource(KEYMAP_A→'A', KEYMAP_B→'B')`（沿用现有平台跳跃 demo 的接线方式）。

## 路线 / 引擎依赖

见 [`DESIGN.md` §3 引擎需求路线](./DESIGN.md)。下一步 v0.2 需要**卷轴/相机**——已向 Lead 提需求 `docs/workflow/requests.md` REQ-001。

## 边界（自我约束）

引擎做不到 → 写 `requests.md` 提需求，**绝不自己改** `engine/** · atom-skills/** · tier1/** · tier2/** · protocol · SystemPhase`。
