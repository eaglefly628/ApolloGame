# UI / HUD / 菜单手册（接线图·薄壳）

> **本页是薄壳。做任何 UI 前先读 `docs/design/ui-playbook.md`**（黄金流程 + 防重叠/对比度/透明度/布局卫生四准则 + 自检清单——schema 之外的合理性靠它）。
> **UI 铁律**：所有游戏 UI/HUD/菜单/面板/VN chrome **必须用 `LayoutNode` 数据描述**（控件=闭集 `ComponentType`；显示绑定=resourceId/StringVar id；写世界=`action` 信号名入队）。play-field 走 render 组件（rendering-fx.md）。本页只补**引擎接线**。

## ① 引擎接线链（LayoutNode → 世界）

| 环节 | 机制实名 | 一句 |
|---|---|---|
| 描述界面 | `LayoutNode` 树 | 闭集 `ComponentType` 控件；数据，非 React |
| 挂载/渲染 | `mountUI(...)` | `src/ui/components/server.ts`——把 LayoutNode 渲成 DOM |
| 写世界 = 信号 | `ActionSink` + `action` | 无本地 handler 的 `action` 经 `ActionSink` **入队成 `Signal`**（可带 `arg`）→ 由 sim 能力消费（events-logic.md）；人/AI 共用动作总线 |
| 控件自描述 | `UI_CATALOG` | `src/ui/components/catalog.ts`——有哪些控件/prop/闭集枚举（机读真相，不手抄） |
| 校验树合法 | `validateLayoutNode` | `src/ui/components/validate.ts`——交付前零 issue |
| 新手引导件 | `Coachmark`（组件）+ overlay | `src/renderer/coachmark.ts` + `src/ui/onboarding-overlay.ts`（spotlight 高亮·纯表现不进 hash） |
| 主题令牌 | `UITheme` | `src/ui/components/types.ts`——语义色/字体槽，换皮 |

## ② 样例指针

- **活范例**：`src/games/game-i/gallery.ts`（全控件）+ `mmo-hud.ts`（最复杂 HUD）。
- **达标大厅**：`src/games/game-g/lobby-dd.ts` + 六屏 `home/campaign/collection/craft/deck/turn-battle-screen.ts`（LayoutNode 纯数据）。
- 控件目录/形状：`src/ui/components/catalog.ts` + `types.ts`；渲染 debug：`render.ts`。

## ③ 本线红线（其余合理性准则见 ui-playbook）

- **禁**：游戏层手写 React 屏 / 自由 CSS·DOM（`innerHTML`/`createElement`）；直用 `ui/shell`(UINode) / `ui/vn`（待退役）。
- **handler 里绝不塞自由逻辑**：`action` 只发信号名，世界改动入 sim 能力层。
- LayoutNode 表达不了的 → 走 requests.md 让主程扩控件（下沉成通用 UI 能力），**绝不手写 React 逃生**。

## ④ 正样例 / 反面教材

- ✅ game-i（LayoutNode 纯数据展示台）、game-g 大厅六屏（达标）。
- ✖ 手写 React UI 屏（game-e 旧手写屏已移除；`src/games/game-f/game-f.tsx` 970 行手写 React=**冻结反面教材·勿动勿模仿**）。

## ⑤ 交付前 + 查不到怎么办

- 做完/改完任何 LayoutNode UI → 跑 `/check-ui` 仪式（防重叠/对比度/透明度/布局卫生 + `validateLayoutNode` 零 issue + ui-audit 归零）。
- 控件闭集里没有需要的控件 → `docs/workflow/requests.md` 提缺口，等主程扩 LayoutNode。**不手写 React。**
