# game101 · S1 UI 布局（真 LayoutNode 库·非 emoji 稿）

> owner 2026-07-23：「用我们 UI 库设计更好」。本目录 = 用项目自己的 **ZeroCraft Kit（`src/ui/components` 的 `LayoutNode` 闭集控件）+ game101 暖色主题**产出的 S1 界面布局（**纯数据**·非 emoji 假稿·非手写 DOM）。这取代了早期的 `mockups/*.dc.html`（已删）。

## 文件

| 文件 | 内容 |
|---|---|
| `s1-merge-board.layout.json` | **S1 主界面 LayoutNode 树**（纯数据·闭集控件）。`validateLayoutNode` = **0 issue**。 |
| `game101-theme.tokens.json` | game101 **暖色海港主题令牌**（UITheme·换皮·库自适应色/字）。 |
| `s1-preview.png` | 用 `mountUI` 真渲染器 + 上面主题渲染的效果图（1080×1920）。 |

## 用到的闭集控件（零手写 UI·零逃生）

`Screen`（页根·pageBg）· `Panel`（容器/bare 布局组）· `Label`（文本·语义色令牌）· `Button`（kind: hero/primary/quiet·`action` 发信号）· `Avatar`（顾客立绘位·首字回退）· `ProgressBar`（体力条）· `Badge`（可交付/等级）。全部来自 `src/ui/components/catalog.ts` 闭集；**全流式布局（column/row/grid）·零绝对定位 → 天然防重叠**（ui-playbook §1）。

## 写世界 = action 信号（handler 无自由逻辑）

`open_shop` / `open_menu` / `open_tasks` / `open_reno` / `open_events`（导航）· 交付走 `deliver_order`（由 sim 能力消费·events-logic）。信号名入队，业务改动在 sim 层。

## 边界与口径（重要）

- **合并板 = play-field**（引擎渲染组件·**按 UI 铁律不归 LayoutNode**）。本树里的 `board-grid` 是 **LayoutNode 网格占位·仅设计示意**；实装时板走引擎 render 组件（`grid-drag-square` + rendering-fx），LayoutNode 只管 chrome（HUD/订单/导航/弹层）。
- **`src/ui/**` 与 `tools/audits/**` 是 PUI 地盘**，本设计**未改动**（渲染只读引用）。缺控件→走 requests.md 报 PUI，绝不手写 React。
- **落地归 PE**：capability-plan 过审后，PE 把本树移植进 `games/game101/`（做成 `buildS1(): LayoutNode` builder·数据一致），并在落地时跑 `/check-ui`（防重叠/对比度/透明度/布局卫生）+ `node tools/ui-audit.mjs`。
- **主题**：`game101-theme.tokens.json` 是设计令牌参考；正式 game101 UITheme 由 PE/PUI 建（参照 game-g `ui-theme.ts` 样板）。

## 复现渲染（设计侧自检·不改仓库）

`validateLayoutNode(tree)` 零 issue → 用 `mountUI(host, tree, {}, theme)`（`@ui/components`）渲染 → chromium 截图（`/opt/pw-browsers`）。渲染 harness 是一次性脚本（未入库）；本目录只留**纯数据 + 效果图**。

## 待续（其余屏也用 LayoutNode 出）

S5 剧情任务面板 / S7 装修 3 选 1 面板 / 商店·体力购买弹层 / 结算屏——这些是**纯 LayoutNode**（比合并板更能展示 UI 库），逐屏补 `*.layout.json`。逐屏规格见 `../ui-brief.md`。
