# ZeroCraft UI 迁移指南（手写 DOM/HTML → 数据驱动 UI）

> 给把现有游戏 UI（手写 HTML 字符串 / React / 内联 CSS）迁到 **ZeroCraft 数据驱动 UI** 的程序员。
> 以 **Game G（翻命扑克）** 为首个对象，但方法对 E/F/任意游戏通用。
>
> 配套读：
> - `apollo-ui-contract.md` —— 30 控件 props 总表（填什么数据）
> - `apollo-ui-porting-contract.md` —— 渲染后端（HTML→Canvas/微信小游戏）
> - **活样板：`games/game-i/`** —— 30 控件 + 2 个组合演示 + 绑定/拖放/动画，照抄即可
>
> **分工**：UI 库（控件/能力/契约/样板/评审）归 Lead；**各游戏的屏迁移在自己 `games/<game>/` 里做**，缺能力提 `requests.md`，不自行改 `src/ui`。

---

## 0. 心法：UI 是数据，不是代码

```
                ┌ renderNode(tree, theme)  → HTML 串（纯函数·画）
LayoutNode 树 ──┤
（你产出的数据） └ mountUI(host, tree, handlers, theme) → 绑事件 + 返回 teardown
```

三条铁律（迁移时反复对照）：
1. **视图 = 状态的纯函数**：`buildScreen(state): LayoutNode`，没有 DOM 操作、没有 `innerHTML`。
2. **交互 = 信号名字符串**：控件只填 `action: 'play'`，"按下去干什么"写在 `HandlerMap` 里。二者只在信号名处相遇。
3. **变了就重挂**：状态变 → 重跑 `buildScreen(newState)` → `mountUI` 重挂（Tabs 切页/Accordion 开合/Combobox 过滤/VirtualList 滚动/Modal 关 这些**引擎已内建就地处理**，不必你重挂）。

> 这就是 MVU：Model（state）→ View（buildScreen）→ Update（信号→reducer→新 state→重挂）。
> Game G 已用这套跑通"返回大厅确认框"（`game-g.tsx:522-544`），迁移=把它推广到更多屏。

---

## 1. 三步迁移法（每屏照做）

### 步骤 ① 把屏拆成 LayoutNode 树（替掉 HTML 字符串）
- 容器用 `Panel`（`direction: row/column/grid`）/ `Screen` / `Tabs`。
- 叶子查 `apollo-ui-contract.md` 选控件，**别造新控件**——先重组。
- 绝对定位/旋转/缩放用 `layout: { x, y, rotate, scale }`。

### 步骤 ② 事件 → 信号名 + HandlerMap
- 每个可点元素填 `action` (+`actionArg`)；把原来 `onclick`/`data-act` 分支逻辑搬进 `handlers`。
- 样板：`games/game-i/handlers.ts`（信号名 → 回调）。

### 步骤 ③ 状态驱动
- **只读世界数据（HUD）**：用 `bind: 'resourceId'`，挂载前 `resolveBindings(tree, dataSource)` 自动填值。样板：game-i 活 HUD（`game-i.ts` 的 `dataSource` + `resolveBindings`）。
- **本地交互状态（选中/分类/数量）**：写纯 reducer `apply(state, 信号, arg) → 新 state(+toast 意图)`，宿主持 state、调 reducer、`showToast`、重挂。样板：`shop.ts` / `pickcards.ts`。

---

## 2. Game G 各屏 → 控件映射（直接照填）

| game-g 屏 / 现状 | 迁成什么 | 样板参考 |
|---|---|---|
| 大厅 5 屏 tab（`lobby-screen.ts` HTML 串） | `Tabs`（内建切页·不重建） + 每屏 `Panel` | game-i `gallery.ts` 顶层 Tabs |
| 顶栏资源 🪙💎🧩✨ | `Panel(row)` + `Label/ProgressBar` `bind:` 资源 | game-i 活 HUD |
| 战役 52 关列表 | `VirtualList`（虚拟滚动·千行不卡） | game-i 数据展示页 `demo-vlist` |
| 天罡货架 / 改造坊 52 位牌网格 | `Panel(direction:'grid', minCol)` + `Card` | game-i `shop.ts` 商品网格 |
| 牌组构筑（52 选 16·多选） | 状态 + `Card(tone:'accent')`，**多选≤N 纯重组** | **game-i `pickcards.ts`（多选≤5 已证）** |
| 放牌落子 / 调路 | `draggable` 牌 + `dropZone` 路格（新能力） | game-i 选牌页拖入「选入区」 |
| 手牌（扇形/选中抬起） | `Card` + `layout:{x, rotate, scale}`（新能力） | game-i 选牌页扇形手牌 |
| 商城/充值/抽卡浮层 | `Modal` / `Drawer` + 内嵌 `Card` 网格 | game-i Modal/Drawer 演示 |
| 卦象掷骰按钮 / 动作钮 | `Button(action)` / `Segmented` | game-i 输入交互页 |
| BGM/音量设置 | `Slider` / `Segmented` / `Toggle` | game-i 输入交互页 |
| 牌卡富文本 tip | `Tooltip`（纯文本）；带高亮见 §5 缺口 | game-i Tooltip 演示 |
| 故事/叙述文本 | `Label` + `typewriter`（逐字显·已内建） | 契约 typewriter |
| 结算 / 返回确认 | `Modal` + `Label` + `Button` | game-g 现有确认框 |
| 发牌入场 / 部署错峰 | `layout:{ anim:'dealIn', animDelay: i*60 }`（新能力） | game-i 选牌页 |

迁移次序建议：**大厅 5 屏（纯菜单·零新能力）→ 弹窗/设置 → 战斗屏（用拖放/动画）**。先吃最稳的 70%。

---

## 3. 新能力速查（本会话刚下沉·填法）

全部是 `LayoutConstraints`（节点 `layout`）上的**数据字段**，渲染/手势由引擎接：

```ts
layout: {
  rotate: 8,            // 旋转角度（度）→ 扇形手牌/斜摆
  scale: 1.12,          // 缩放 → 选中放大
  anim: 'dealIn',       // 入场动画：fadeIn/slideUp/pop/shake/dealIn/flyIn
  animMs: 360, animDelay: 120,  // 时长/延迟（错峰发牌：animDelay: i*60）
  draggable: true,      // 可拖（载荷=该节点 id）
  dropZone: 'dropPlay', // 放置区信号 → drop 时 handlers['dropPlay'](被拖节点 id)
}
```
绑定（HUD 只读）：`props.bind: 'hp'` + 挂载前 `resolveBindings(tree, { resource:(id)=>world[id] })`。

---

## 4. 边界·回驳清单（**别迁进 UI 数据·留 Canvas/renderer**）

按宣言「UI ↔ 游戏世界」分离，下列属**世界渲染或自由代码**，强塞 LayoutNode 反而违宣言——继续留在 game-g 的 canvas/CSS 层：

| 别迁 | 为什么 | 留哪 |
|---|---|---|
| 兵沿斜梯/路径逐格行军 | 世界实体坐标·逐帧 | renderer / canvas |
| 掷骰 3D 翻腾、硬币 rotateX 翻面 | 3D 演出·与逻辑帧同步 | CSS/canvas（现状保留） |
| 单位头顶浮动血条/伤害飘字 | 跟世界坐标 | renderer 的 gauge/Text |
| 捷径门 SVG 斜梯路径 | 单用途矢量 | CSS border / canvas |
| AI 思考蒙层旋转、全屏播报转场 | 纯演出动画 | CSS keyframes |
| 与计分逻辑逐帧同步的命令式时间轴 | 自由代码 | 宿主脚本 |

> 音效不是 UI 数据字段——在 `HandlerMap` 的回调里触发即可（信号到了就播），无需控件加 `sfx`。

---

## 5. 库尚缺·需 Lead 开发（提了 requests·迁移到此再等）

迁 game-g 时若撞到下面两项，**别自己在游戏层硬写**——已登记 `requests.md`，由 Lead 评审下沉后你再填数据：

1. **数值补间 / 数字滚动（number tween）** —— 掷骰数字滚到命点、筹码/分数跳动。
   候选数据形态：`Label` 加 `tween: { from, to, ms }`，mountUI 动画。**recurring（E 筹码 / G 掷骰）→ 该下沉。**（`REQ-UI-数字补间`）
2. **富文本 / 多段着色（richText spans）** —— 天罡/地煞词条带高亮、说明文本分色。
   现 `Label` 是单色纯文本（+typewriter）。候选：`Label.spans: [{text,color,bold}]`。（`REQ-UI-富文本`）

> 其余（3D transform / SVGPath / 六角 hex 布局 / WorldFollower）= 单游戏或世界渲染，**暂不下沉**（YAGNI / 归 renderer），见 §4。

---

## 6. 迁移 DoD（每屏完成判据）

- 该屏 `buildScreen` 是**纯函数**（无 `innerHTML`/DOM 操作），交互全走 `action` + `HandlerMap`。
- 主题走 `UITheme` 令牌（game-g 已有 `GG_THEME_ONYX/GG_LOBBY_THEME`），不写死色值。
- 旧 HTML 字符串/CSS 该屏分支**删净**（只在 git 历史可见）。
- **门禁全绿**：tsc + vitest + build；**`turnHash` 回归不变**（迁 UI 不得改战斗逻辑行为）。
- 视觉走查：与旧屏对照不跑版（必要时补 golden 帧）。
