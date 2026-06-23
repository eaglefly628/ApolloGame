# Apollo UI 渲染后端移植契约（HTML → Canvas / 微信小游戏）

> 给「把 Apollo 游戏库移植到微信小游戏」的团队：照本文实现一台 **Canvas 后端解释器**，
> 即可让**所有现有游戏的 UI 数据原样跑起来**，无需改任何游戏代码或控件契约。
>
> 配套读：`docs/design/apollo-ui-contract.md`（控件 props 总表）。本文只讲**怎么把数据画出来 + 收交互**。

---

## 0. 核心认知：你只需要换"解释器"，不碰数据

Apollo UI = **数据（LayoutNode 树 + UITheme 令牌）** + **解释器（renderNode 画 + mountUI 收事件）**。
现有解释器是 **HTML/DOM 后端**（`src/ui/components/render.ts` 出 HTML 串、`server.ts` 绑 DOM 事件）。
微信小游戏没有 DOM，所以你**重写一台 Canvas 后端解释器**，消费**同一份数据**。

```
                         ┌─ HTML 后端：renderNode → HTML 串 + mountUI → DOM 事件   （现有·Web）
LayoutNode 数据 ─────────┤
（games 产出·零改）      └─ Canvas 后端：你要写的——布局求解 + 画 + 命中测试        （微信小游戏）
```

**直接复用、零改**：`types.ts` 全部（LayoutNode / LayoutConstraints / ComponentType / 各 Props / UITheme / HandlerMap）、
所有游戏的 LayoutNode 数据、所有主题令牌包、所有 action 信号名。

---

## 1. 你要实现的四件事

### 1.1 布局求解器（最大工作量）—— LayoutConstraints → 盒子矩形

HTML 后端靠 CSS flex/grid 免费算位置；Canvas 你得自己算。给每个节点求出 `{x, y, w, h}`。规则（对齐 `render.ts`）：

容器 = `Panel`/`Screen`/`Tabs` 等，按其 `layout`（LayoutConstraints）排子节点：

| 字段 | 语义 |
|---|---|
| `direction: 'row'` | 子节点横向排，主轴 = x；`gap` 为间距 |
| `direction: 'column'`（缺省） | 子节点纵向排，主轴 = y；`gap` 为间距 |
| `direction: 'grid'` | 自适应网格：列数 = `floor((容器宽) / minCol)`（`minCol` 缺省 96），等宽列，`gap` 行列间距 |
| `flex: n` | 子节点在主轴按 n 比例分剩余空间（同 CSS flex-grow） |
| `width` / `height` | 固定尺寸 px（覆盖 flex） |
| `align: start/center/end/stretch` | 交叉轴对齐（缺省 stretch=拉满交叉轴） |
| `gap` | 子节点间距 px（缺省 8） |
| `padding` | 容器内边距 px（缺省 16；Panel/Screen 有，叶子控件多为 0） |
| `x` / `y` | **绝对定位**：相对父容器左上角偏移（Modal/Drawer/Toast 浮层用 fixed 满屏） |
| `margin` | 外边距 px |

**文本测量**：Label/Button/Table 单元等的宽高要用 `ctx.measureText()` 量文字（含 `fontUi`/`fontMono` 字体、`size` 字号），
HTML 免费、Canvas 必须显式量。换行/省略（Table 单元 `text-overflow:ellipsis`）也要自己处理。

> 实现建议：写成两趟——① measure（自底向上量内容尺寸）② layout（自顶向下分配位置）。即一个迷你 flexbox。
> grid 与绝对定位是特例分支。这是整个移植里唯一"有算法"的部分，其余都是照着画。

### 1.2 绘制函数 —— 每个 ComponentType 画到 canvas

28 个控件，每个就是 **矩形 + 文字 + 边框 + 个别简单形状**。逐个对照 `src/ui/components/render.ts` 的视觉译成 canvas 2d 调用。
颜色/字体**一律取自 UITheme 令牌**（§3），不要硬编码。要点举例：

- **Panel**：圆角矩形(`bg1` 填 + `line` 描边 + radius 10) → 画 title（小字阔字距 `dim`）→ 递归画子节点。
- **Label**：`ctx.fillText`，字号查 `{xs:10,sm:11,md:13,lg:16,xl:22}`，颜色查 color map（text/sub/dim/jade/gold/ok/warn/danger）。
- **Button**：圆角矩形(kind 决定 `jadeWash`/`line` 等) + 居中文字；记录其矩形 + `action` 供命中测试。
- **Table**：表头行(列定义·`dim` 阔字距) + 数据行(发丝线 `line` 分隔·tone 着色 normal/accent/dim)；列宽按 `width`(固定) 或 flex 均分。
- **ProgressBar**：底槽(`bg3`) + 填充条(宽 = value/max·tone 取色)；可选 label + 右上数值。
- **Tag / Badge / Card / Avatar / Stepper / Segmented / Rating**：都是小矩形/圆 + 文字/星，照 render.ts。
- **浮层类**（Modal/Drawer/Toast/Tooltip）：先画半透明遮罩盖满屏，再画居中/贴边/角落的面板。

### 1.3 命中测试事件 —— 触点 → action 信号

DOM 靠事件冒泡找 `[data-action]`；Canvas 你在布局时**记下每个可交互节点的矩形 + 它的 action/arg**，触摸时：
1. `wx.onTouchEnd` 拿触点坐标 → 命中**最上层**含该点、且带 `action` 的节点矩形。
2. 调 `handlers[action](arg)` —— `arg` 取自该节点（Button 的 `actionArg`、Table 行的 `id`、Tag/Card 的 `actionArg`、Stepper/Rating 的目标值、Segmented/Combobox 选项的 value）。
3. 输入类（Input/Dropdown/Combobox）需接小游戏的原生输入（`wx.showKeyboard` 等）回填后发信号。

**信号名契约不变**：`action` 是字符串信号名，回调由游戏的 `HandlerMap` 提供（写世界/切屏等）。你只负责"命中 → 调对应信号名的回调"。

### 1.4 六类运行时行为（命中后的状态切换·照 `server.ts`）

这些 HTML 后端在 `mountUI` 里内建，你在 Canvas 后端等价实现（都是改状态 + 重画）：

| 行为 | 触发 | 效果 |
|---|---|---|
| **Tabs 切页** | 点 `data-tab` | 切当前页 id，只重画该 Tabs 区（抗闪屏：别整屏重建） |
| **Modal/Drawer 遮罩关** | 点遮罩区(非面板体) | 调 `closeAction` 信号 |
| **Toast 定时自消** | `showToast()` | 画一个角落药丸，`duration`(缺省 2600ms) 后移除（用 `setTimeout` 等价物） |
| **Tooltip 悬浮** | 长按/点 触发元素 | 显/隐气泡（小游戏无 hover → 改"按下显示、抬起隐藏"或点切换） |
| **Accordion 折叠** | 点标题行 | 切 open 态、重画该面板（+ 可选 action 信号） |
| **Combobox 搜索** | 点输入框/输入/点项 | 开面板→过滤→点项回填+发 action+合 |

---

## 2. 直接复用（不要重写）

- `src/ui/components/types.ts` —— LayoutNode / LayoutConstraints / 28 控件 Props / UITheme / HandlerMap。**整文件 copy**。
- 各游戏产出的 LayoutNode 数据 / 主题令牌包 / action 信号名 —— 原样。
- `resolveBindings(tree, ds)`（`bindings.ts`）—— 世界绑定解析是**纯函数·无 DOM**，可直接复用；你只需提供一份 `UIDataSource`（读你那边的世界）。

---

## 3. 主题令牌 → canvas 样式

`UITheme` 是一组颜色/字体**字符串**令牌（`bg0..3`/`line`/`text`/`sub`/`dim`/`jade*`/`gold`/`ok*`/`warn*`/`danger`/`fontUi`/`fontMono`）。
HTML 后端把它们填进 CSS；你把它们填进 `ctx.fillStyle`/`ctx.strokeStyle`/`ctx.font`。**令牌值原样可用**（`#rrggbb`/`rgba()`）。
注意：若令牌是 `var(--xxx)`（某些游戏的"内嵌宿主皮"），Canvas 没有 CSS 变量——让那些游戏提供一份**死值版**主题令牌即可（同一接口、换一份值）。

---

## 4. 不会变的（吃下这颗定心丸）

移植**不触碰**：任何游戏的 UI 数据、28 控件的 props 契约、主题令牌接口、action 信号名、`resolveBindings` 逻辑。
你只新增一个 `canvas-backend/`（布局求解 + 画 + 命中测试），和现有 HTML 后端**并列**。游戏侧零感知。

---

## 5. 落地顺序建议

1. 布局求解器（先 row/column + flex + padding/gap，跑通 Panel/Label/Button）。
2. 命中测试 + Button 信号（能点了）。
3. 铺开 28 控件的绘制（照 render.ts 逐个）。
4. grid 排布 + Table。
5. 浮层四件套（Modal/Drawer/Toast/Tooltip）+ 六类运行时行为。
6. 输入类接原生键盘 + Combobox。
7. 拿 game-i（控件画廊）当**验收床**：它一屏摆了全部控件，是天然的后端一致性回归用例。
